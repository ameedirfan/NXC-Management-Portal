import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, upsertAttendance, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { verifyCheckinToken } from '@/lib/checkinToken';
import { normalizePortfolio, canonicalPortfolioName } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { token } = await request.json();
  const payload = verifyCheckinToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'This check in code is invalid or has expired. Ask for a fresh one.' },
      { status: 400 }
    );
  }

  if (
    !isManagerOrAdmin(session) &&
    normalizePortfolio(session.portfolio) !== normalizePortfolio(payload.portfolio)
  ) {
    return NextResponse.json(
      { error: 'This check in code is for a different portfolio than yours.' },
      { status: 403 }
    );
  }

  const { records: roster } = await readSheet(TABS.roster);
  const person = roster.find((r) => r['CMS ID'] === session.cmsId);
  if (!person) {
    return NextResponse.json(
      {
        error:
          "You are not currently on the roster, so you can't check yourself in. Ask your portfolio's Manager or Admin.",
      },
      { status: 404 }
    );
  }

  const rosterPortfolios = [...new Set(roster.map((r) => r['Portfolio']).filter(Boolean))];
  const canonicalPortfolio = canonicalPortfolioName(payload.portfolio, rosterPortfolios);

  await upsertAttendance([
    {
      Date: payload.date,
      Portfolio: canonicalPortfolio,
      'CMS ID': person['CMS ID'],
      'Full Name': person['Full Name'],
      Designation: person['Designation'],
      Status: 'Present',
      'Marked By': `${session.fullName || session.username} (self, QR)`,
      Timestamp: new Date().toISOString(),
    },
  ]);

  return NextResponse.json({ ok: true, portfolio: canonicalPortfolio, date: payload.date });
}
