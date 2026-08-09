import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { isAdmin } from '@/lib/authz';
import { normalizePortfolio, dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

const APPLICANT_STATUSES = ['Pending', 'Interviewing', 'Recommended', 'Not recommended', 'Hired'];
const TREND_MAX_POINTS = 15;

function round(n) {
  return Math.round(n * 10) / 10;
}

export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const trendPortfolio = searchParams.get('portfolio') || '';

  const [{ records: roster }, { records: attendance }, { records: applicants }] = await Promise.all([
    readSheet(TABS.roster),
    readSheet(TABS.attendance),
    readSheet(TABS.applicants),
  ]);

  const rosterPortfolios = roster.map((r) => r['Portfolio']).filter(Boolean);
  const portfolios = dedupePortfolios(rosterPortfolios);
  const canon = (name) => canonicalPortfolioName(name, portfolios);

  const byPortfolioMap = new Map();
  for (const row of attendance) {
    const portfolio = row['Portfolio'];
    const date = row['Date'];
    const statusVal = row['Status'];
    if (!portfolio || !date || !statusVal) continue;
    const key = normalizePortfolio(portfolio);
    if (!byPortfolioMap.has(key)) {
      byPortfolioMap.set(key, { label: canon(portfolio), dates: new Set(), present: 0, total: 0 });
    }
    const bucket = byPortfolioMap.get(key);
    bucket.dates.add(date);
    bucket.total += 1;
    if (statusVal === 'Present') bucket.present += 1;
  }
  const attendanceByPortfolio = [...byPortfolioMap.values()]
    .map((b) => ({
      portfolio: b.label,
      meetingsHeld: b.dates.size,
      avgPresentPct: b.total ? round((b.present / b.total) * 100) : 0,
    }))
    .sort((a, b) => a.portfolio.localeCompare(b.portfolio));

  const normTrendPortfolio = normalizePortfolio(trendPortfolio);
  const trendByDateMap = new Map();
  for (const row of attendance) {
    if (normTrendPortfolio && normalizePortfolio(row['Portfolio']) !== normTrendPortfolio) continue;
    const date = row['Date'];
    const statusVal = row['Status'];
    if (!date || !statusVal) continue;
    if (!trendByDateMap.has(date)) trendByDateMap.set(date, { present: 0, total: 0 });
    const bucket = trendByDateMap.get(date);
    bucket.total += 1;
    if (statusVal === 'Present') bucket.present += 1;
  }
  const trend = [...trendByDateMap.entries()]
    .map(([date, b]) => ({ date, presentPct: b.total ? round((b.present / b.total) * 100) : 0 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-TREND_MAX_POINTS);

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
    attendance: { byPortfolio: attendanceByPortfolio, trend, trendPortfolio: trendPortfolio || null },
    applicants: { funnel, byPortfolio: applicantsByPortfolio },
  });
}
