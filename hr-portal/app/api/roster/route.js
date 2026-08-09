import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';
import { toRosterRecord, toRosterMember } from '@/lib/rosterFields';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const wantsFull = searchParams.get('view') === 'full';

  const { records } = await readSheet(TABS.roster);
  const allPortfolios = dedupePortfolios(records.map((r) => r['Portfolio']));

  const canonicalOwnPortfolio = session.portfolio
    ? canonicalPortfolioName(session.portfolio, allPortfolios)
    : '';
  const portfolios = isManagerOrAdmin(session) ? allPortfolios : [canonicalOwnPortfolio].filter(Boolean);

  const payload = { portfolios, defaultPortfolio: canonicalOwnPortfolio, role: session.role };

  if (wantsFull) {
    if (!isManagerOrAdmin(session)) {
      return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
    }
    payload.members = records.map(toRosterMember);
  }

  return NextResponse.json(payload);
}

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const cmsId = (body.cmsId || '').trim();
  const fullName = (body.fullName || '').trim();
  const portfolio = (body.portfolio || '').trim();
  const designation = (body.designation || '').trim();

  if (!cmsId || !fullName || !portfolio || !designation) {
    return NextResponse.json(
      { error: 'CMS ID, Full Name, Portfolio, and Designation are required.' },
      { status: 400 }
    );
  }

  const { headers, records } = await readSheet(TABS.roster, 'A:ZZ', { fresh: true });
  if (records.some((r) => r['CMS ID'] === cmsId)) {
    return NextResponse.json({ error: `CMS ID ${cmsId} is already on the roster.` }, { status: 409 });
  }

  const existingPortfolios = dedupePortfolios(records.map((r) => r['Portfolio']));
  const canonicalPortfolio = canonicalPortfolioName(portfolio, existingPortfolios);

  const effectiveHeaders = headers.length
    ? headers
    : ['Wing', 'Portfolio', 'Designation', 'Full Name', 'Gender', 'Contact No.', 'Email Address', 'CMS ID', 'Batch', 'Department', 'Residential Status', 'Hostel'];
  await appendRow(TABS.roster, effectiveHeaders, toRosterRecord({ ...body, portfolio: canonicalPortfolio }));

  return NextResponse.json({ ok: true });
}
