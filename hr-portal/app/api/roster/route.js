import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { dedupePortfolios, canonicalPortfolioName, normalizePortfolio } from '@/lib/portfolio';
import { toRosterRecord, toRosterMember } from '@/lib/rosterFields';
import { joinAttendanceToMeetings, percentage } from '@/lib/attendanceStats';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const wantsFull = searchParams.get('view') === 'full';

  let records;
  try {
    ({ records } = await readSheet(TABS.roster));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }
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

    // Roster "at a glance" strip: headcount and current attendance
    // percentage per portfolio, same percentage math as the Dashboard's
    // Portfolio view (Present / (Present + Absent), Leave and Voided
    // meetings excluded as ghost entries). Kept in its own try/catch so
    // this endpoint (also used by the Logins page and the Dashboard)
    // still works before the Meetings tab exists in the sheet, just
    // without the strip.
    try {
      const [{ records: attendance }, { records: meetings }] = await Promise.all([
        readSheet(TABS.attendance),
        readSheet(TABS.meetings),
      ]);
      const eligible = joinAttendanceToMeetings(attendance, meetings).filter((r) => r.status !== 'Leave');
      payload.portfolioStats = allPortfolios.map((p) => {
        const memberIds = new Set(
          records.filter((r) => normalizePortfolio(r['Portfolio']) === normalizePortfolio(p)).map((r) => r['CMS ID'])
        );
        const rows = eligible.filter((r) => memberIds.has(r.cmsId));
        const present = rows.filter((r) => r.status === 'Present').length;
        const absent = rows.filter((r) => r.status === 'Absent').length;
        return { portfolio: p, headcount: memberIds.size, percentage: percentage(present, absent) };
      });
    } catch (err) {
      payload.portfolioStats = [];
      payload.portfolioStatsError = friendlyReadError(err);
    }
  }

  return NextResponse.json(payload);
}

export async function POST(request) {
  const session = await getSession();
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
