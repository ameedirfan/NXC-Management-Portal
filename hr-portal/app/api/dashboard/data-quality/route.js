import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { canViewDashboard } from '@/lib/authz';
import { normalizePortfolio, dedupePortfolios } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canViewDashboard(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const [{ records: roster }, { records: logins }, { records: applicants }] = await Promise.all([
    readSheet(TABS.roster),
    readSheet(TABS.login),
    readSheet(TABS.applicants),
  ]);

  const cmsIdCounts = new Map();
  for (const r of roster) {
    const id = r['CMS ID'];
    if (!id) continue;
    if (!cmsIdCounts.has(id)) cmsIdCounts.set(id, []);
    cmsIdCounts.get(id).push(r['Full Name'] || 'No name');
  }
  const duplicateCmsIds = [...cmsIdCounts.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([cmsId, names]) => ({ cmsId, names }));

  const rosterCmsIds = new Set(roster.map((r) => r['CMS ID']).filter(Boolean));
  const orphanedLogins = logins
    .filter((l) => l['CMS ID'] && !rosterCmsIds.has(l['CMS ID']))
    .map((l) => ({ username: l['Username'], cmsId: l['CMS ID'] }));

  const loginCmsIds = new Set(logins.map((l) => l['CMS ID']).filter(Boolean));
  const rosterWithoutLogin = roster
    .filter((r) => r['CMS ID'] && !loginCmsIds.has(r['CMS ID']))
    .map((r) => ({ cmsId: r['CMS ID'], fullName: r['Full Name'] || 'No name', portfolio: r['Portfolio'] || '' }));

  const rosterPortfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));
  const normRosterPortfolios = new Set(rosterPortfolios.map(normalizePortfolio));
  const applicantsBadPortfolio = applicants
    .filter((a) => !a['Portfolio'] || !normRosterPortfolios.has(normalizePortfolio(a['Portfolio'])))
    .map((a) => ({
      cmsId: a['CMS ID'],
      fullName: a['Full Name'] || 'No name',
      portfolio: a['Portfolio'] || 'Blank',
    }));

  return NextResponse.json({ duplicateCmsIds, orphanedLogins, rosterWithoutLogin, applicantsBadPortfolio });
}
