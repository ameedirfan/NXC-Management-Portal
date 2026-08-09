import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, upsertAttendance, TABS } from '@/lib/sheets';
import { isManagerOrAdmin, canManuallyMarkAttendance } from '@/lib/authz';
import { normalizePortfolio, canonicalPortfolioName } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const portfolio = searchParams.get('portfolio');
  const date = searchParams.get('date');
  if (!portfolio || !date) {
    return NextResponse.json({ error: 'portfolio and date are required.' }, { status: 400 });
  }

  const [{ records: roster }, { records: attendance }] = await Promise.all([
    readSheet(TABS.roster),
    readSheet(TABS.attendance),
  ]);

  const people = roster
    .filter((p) => normalizePortfolio(p['Portfolio']) === normalizePortfolio(portfolio))
    .map((p) => {
      const matches = attendance
        .filter((a) => a['Date'] === date && a['CMS ID'] === p['CMS ID'])
        .sort((a, b) => (a['Timestamp'] || '').localeCompare(b['Timestamp'] || ''));
      const existing = matches[matches.length - 1];
      return {
        cmsId: p['CMS ID'],
        fullName: p['Full Name'],
        designation: p['Designation'],
        status: existing ? existing['Status'] : '',
      };
    });

  return NextResponse.json({ people });
}

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManuallyMarkAttendance(session)) {
    return NextResponse.json(
      { error: 'Only managers and admins can mark attendance manually.' },
      { status: 403 }
    );
  }

  const { date, portfolio, records } = await request.json();
  if (!date || !portfolio || !Array.isArray(records)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const { records: roster } = await readSheet(TABS.roster);
  const rosterPortfolios = [...new Set(roster.map((p) => p['Portfolio']).filter(Boolean))];
  const canonicalPortfolio = canonicalPortfolioName(portfolio, rosterPortfolios);
  const allowedCmsIds = new Set(
    roster
      .filter((p) => normalizePortfolio(p['Portfolio']) === normalizePortfolio(portfolio))
      .map((p) => p['CMS ID'])
  );

  const rows = records
    .filter((r) => r.status && allowedCmsIds.has(r.cmsId))
    .map((r) => ({
      Date: date,
      Portfolio: canonicalPortfolio,
      'CMS ID': r.cmsId,
      'Full Name': r.fullName,
      Designation: r.designation,
      Status: r.status,
      'Marked By': session.fullName || session.username,
      Timestamp: new Date().toISOString(),
    }));

  await upsertAttendance(rows);
  return NextResponse.json({ ok: true });
}
