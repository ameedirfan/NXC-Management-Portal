import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { canViewDashboard } from '@/lib/authz';
import { normalizePortfolio, dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const APPLICANT_STATUSES = ['Pending', 'Interviewing', 'Recommended', 'Not recommended', 'Hired'];

// Attendance analytics (the 3 view modes) live at /api/dashboard/attendance
// now. This endpoint stays for the parts of the Dashboard that aren't
// attendance: the portfolio list and the recruitment funnel.
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canViewDashboard(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  let roster, applicants;
  try {
    ({ records: roster } = await readSheet(TABS.roster));
    ({ records: applicants } = await readSheet(TABS.applicants));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const portfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));
  const canon = (name) => canonicalPortfolioName(name, portfolios);

  const funnelCounts = new Map(APPLICANT_STATUSES.map((s) => [s, 0]));
  let noStatus = 0;
  for (const row of applicants) {
    const statusVal = row['Status'];
    if (!statusVal) {
      noStatus += 1;
    } else if (funnelCounts.has(statusVal)) {
      funnelCounts.set(statusVal, funnelCounts.get(statusVal) + 1);
    } else {
      funnelCounts.set(statusVal, (funnelCounts.get(statusVal) || 0) + 1);
    }
  }
  const funnel = [...funnelCounts.entries()].map(([status, count]) => ({ status, count }));
  if (noStatus) funnel.push({ status: 'No status', count: noStatus });

  const applicantsByPortfolioMap = new Map();
  for (const row of applicants) {
    const portfolio = row['Portfolio'];
    if (!portfolio) continue;
    const key = normalizePortfolio(portfolio);
    if (!applicantsByPortfolioMap.has(key)) {
      applicantsByPortfolioMap.set(key, { label: canon(portfolio), total: 0 });
    }
    applicantsByPortfolioMap.get(key).total += 1;
  }
  const applicantsByPortfolio = [...applicantsByPortfolioMap.values()]
    .map((b) => ({ portfolio: b.label, total: b.total }))
    .sort((a, b) => a.portfolio.localeCompare(b.portfolio));

  return NextResponse.json({
    portfolios,
    applicants: { funnel, byPortfolio: applicantsByPortfolio },
  });
}
