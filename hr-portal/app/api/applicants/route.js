import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { normalizePortfolio } from '@/lib/portfolio';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const portfolio = searchParams.get('portfolio') || '';
  const search = (searchParams.get('search') || '').trim().toLowerCase();

  let records;
  try {
    ({ records } = await readSheet(TABS.applicants));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  let filtered = records;
  if (portfolio) {
    const normPortfolio = normalizePortfolio(portfolio);
    filtered = filtered.filter(
      (r) =>
        normalizePortfolio(r['Portfolio']) === normPortfolio ||
        normalizePortfolio(r['1st Preference']) === normPortfolio ||
        normalizePortfolio(r['2nd Preference']) === normPortfolio
    );
  }
  if (search) {
    filtered = filtered.filter(
      (r) =>
        (r['Full Name'] || '').toLowerCase().includes(search) ||
        (r['CMS ID'] || '').toLowerCase().includes(search)
    );
  }

  const applicants = filtered.map((r) => ({
    cmsId: r['CMS ID'],
    fullName: r['Full Name'],
    portfolio: r['Portfolio'],
    firstPreference: r['1st Preference'],
    secondPreference: r['2nd Preference'],
    status: r['Status'],
  }));

  return NextResponse.json({ applicants });
}
