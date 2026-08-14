import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { normalizePortfolio, dedupePortfolios } from '@/lib/portfolio';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const portfolio = searchParams.get('portfolio') || '';
  const status = searchParams.get('status') || '';
  const emailed = searchParams.get('emailed') || ''; // 'never' | 'already'
  const search = (searchParams.get('search') || '').trim().toLowerCase();

  let records;
  try {
    ({ records } = await readSheet(TABS.applicants));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  // Computed from the full, unfiltered set so the Portfolio dropdown
  // itself doesn't shrink based on whatever filter is currently applied.
  // The Applicants sheet isn't linked to the Roster (spec section 1), so
  // a portfolio can exist here with nobody on the Roster in it yet — the
  // dropdown needs to reflect that, not just Roster's portfolio list.
  const applicantPortfolios = dedupePortfolios(records.map((r) => r['Portfolio']));

  let filtered = records;
  if (portfolio) {
    const normPortfolio = normalizePortfolio(portfolio);
    filtered = filtered.filter((r) => normalizePortfolio(r['Portfolio']) === normPortfolio);
  }
  if (status) {
    filtered = filtered.filter((r) => r['Status'] === status);
  }
  if (emailed === 'never') {
    filtered = filtered.filter((r) => !r['Last Emailed At']);
  } else if (emailed === 'already') {
    filtered = filtered.filter((r) => !!r['Last Emailed At']);
  }
  if (search) {
    filtered = filtered.filter(
      (r) =>
        (r['Name'] || '').toLowerCase().includes(search) ||
        (r['CMS ID'] || '').toLowerCase().includes(search)
    );
  }

  const applicants = filtered.map((r) => ({
    cmsId: r['CMS ID'],
    fullName: r['Name'],
    portfolio: r['Portfolio'],
    email: r['Email'],
    status: r['Status'],
    lastEmailedAt: r['Last Emailed At'] || '',
  }));

  return NextResponse.json({ applicants, portfolios: applicantPortfolios });
}
