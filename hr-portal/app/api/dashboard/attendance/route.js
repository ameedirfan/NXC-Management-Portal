import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { canViewDashboard } from '@/lib/authz';
import { normalizePortfolio, canonicalPortfolioName, dedupePortfolios } from '@/lib/portfolio';
import { joinAttendanceToMeetings, percentage } from '@/lib/attendanceStats';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

function trendFromRows(rows) {
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, { present: 0, absent: 0 });
    const b = byDate.get(r.date);
    if (r.status === 'Present') b.present += 1;
    else if (r.status === 'Absent') b.absent += 1;
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, b]) => ({ date, presentPct: percentage(b.present, b.absent) }));
}

export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canViewDashboard(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'council';
  const cmsId = searchParams.get('cmsId') || '';
  const portfolioParam = searchParams.get('portfolio') || '';

  let roster, attendance, meetings;
  try {
    [{ records: roster }, { records: attendance }, { records: meetings }] = await Promise.all([
      readSheet(TABS.roster),
      readSheet(TABS.attendance),
      readSheet(TABS.meetings),
    ]);
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const rosterPortfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));
  const rosterByCmsId = new Map(roster.map((r) => [r['CMS ID'], r]));
  const joined = joinAttendanceToMeetings(attendance, meetings);

  if (view === 'individual') {
    const person = rosterByCmsId.get(cmsId);
    if (!cmsId || !person) {
      return NextResponse.json({ error: 'Choose a roster member.' }, { status: 400 });
    }
    const rows = joined.filter((r) => r.cmsId === cmsId).sort((a, b) => (a.date < b.date ? -1 : 1));
    const eligible = rows.filter((r) => r.status !== 'Leave');
    const present = eligible.filter((r) => r.status === 'Present').length;
    const absent = eligible.filter((r) => r.status === 'Absent').length;
    const leave = rows.length - eligible.length;

    let runPresent = 0;
    let runAbsent = 0;
    const trend = eligible.map((r) => {
      if (r.status === 'Present') runPresent += 1;
      else runAbsent += 1;
      return { date: r.date, presentPct: percentage(runPresent, runAbsent) };
    });

    return NextResponse.json({
      person: { cmsId, fullName: person['Full Name'], portfolio: person['Portfolio'] },
      counts: { present, absent, leave },
      percentage: percentage(present, absent),
      trend,
    });
  }

  if (view === 'portfolio') {
    const canonicalPortfolio = canonicalPortfolioName(portfolioParam, rosterPortfolios);
    if (!canonicalPortfolio) {
      return NextResponse.json({ error: 'Choose a portfolio.' }, { status: 400 });
    }
    const memberCmsIds = new Set(
      roster
        .filter((r) => normalizePortfolio(r['Portfolio']) === normalizePortfolio(canonicalPortfolio))
        .map((r) => r['CMS ID'])
    );
    const rows = joined.filter((r) => memberCmsIds.has(r.cmsId));
    const eligible = rows.filter((r) => r.status !== 'Leave');
    const present = eligible.filter((r) => r.status === 'Present').length;
    const absent = eligible.filter((r) => r.status === 'Absent').length;

    const byMember = new Map();
    for (const r of eligible) {
      if (!byMember.has(r.cmsId)) byMember.set(r.cmsId, { present: 0, absent: 0 });
      const b = byMember.get(r.cmsId);
      if (r.status === 'Present') b.present += 1;
      else b.absent += 1;
    }
    const members = [...memberCmsIds]
      .map((id) => {
        const b = byMember.get(id) || { present: 0, absent: 0 };
        const person = rosterByCmsId.get(id);
        return {
          cmsId: id,
          fullName: person?.['Full Name'] || id,
          present: b.present,
          absent: b.absent,
          percentage: percentage(b.present, b.absent),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({
      portfolio: canonicalPortfolio,
      overall: { present, absent, percentage: percentage(present, absent) },
      trend: trendFromRows(eligible),
      members,
    });
  }

  // Council-wide combined view: overall rate, trend over time, and a bar
  // per portfolio plus one for Council Meets, side by side.
  const eligibleAll = joined.filter((r) => r.status !== 'Leave');
  const presentAll = eligibleAll.filter((r) => r.status === 'Present').length;
  const absentAll = eligibleAll.filter((r) => r.status === 'Absent').length;

  const byGroup = new Map();
  for (const r of eligibleAll) {
    const label = r.scope === 'Council' ? 'Council Meets' : canonicalPortfolioName(r.portfolio, rosterPortfolios) || r.portfolio;
    if (!byGroup.has(label)) byGroup.set(label, { present: 0, absent: 0 });
    const b = byGroup.get(label);
    if (r.status === 'Present') b.present += 1;
    else b.absent += 1;
  }
  const byPortfolio = [...byGroup.entries()]
    .map(([label, b]) => ({ label, percentage: percentage(b.present, b.absent) }))
    .sort((a, b) => {
      if (a.label === 'Council Meets') return -1;
      if (b.label === 'Council Meets') return 1;
      return a.label.localeCompare(b.label);
    });

  return NextResponse.json({
    overall: { present: presentAll, absent: absentAll, percentage: percentage(presentAll, absentAll) },
    trend: trendFromRows(eligibleAll),
    byPortfolio,
  });
}
