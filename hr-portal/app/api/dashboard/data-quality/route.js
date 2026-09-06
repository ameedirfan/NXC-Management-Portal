import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { canViewDashboard } from '@/lib/authz';
import { normalizePortfolio, dedupePortfolios } from '@/lib/portfolio';
import { friendlyReadError } from '@/lib/apiError';
import { normalizeUsername, isBcryptHash } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canViewDashboard(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  let roster, logins, applicants;
  try {
    [{ records: roster }, { records: logins }, { records: applicants }] = await Promise.all([
      readSheet(TABS.roster),
      readSheet(TABS.login),
      readSheet(TABS.applicants),
    ]);
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

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
      fullName: a['Name'] || 'No name',
      portfolio: a['Portfolio'] || 'Blank',
    }));

  // Rows in Logins that cannot sign in no matter what the person types.
  // Sign in itself now copes with stray whitespace and duplicate rows, but
  // a password saved as plain text or a hash truncated on paste is a
  // permanent lockout that only a password reset fixes — so surface which
  // account it is. The password value itself is never read out or returned,
  // only whether it has the shape of a bcrypt hash.
  const usernameCounts = new Map();
  for (const l of logins) {
    const key = normalizeUsername(l['Username']);
    if (!key) continue;
    usernameCounts.set(key, (usernameCounts.get(key) || 0) + 1);
  }

  const brokenLogins = [];
  const seenDuplicate = new Set();
  for (const l of logins) {
    const rawUsername = String(l['Username'] ?? '');
    const key = normalizeUsername(rawUsername);
    const label = key || `Row ${l._row}`;

    if (!key) {
      brokenLogins.push({ username: label, row: l._row, reason: 'No username in this row' });
      continue;
    }
    if (rawUsername !== rawUsername.trim()) {
      brokenLogins.push({ username: label, row: l._row, reason: 'Username cell has extra spaces around it' });
    }
    if (usernameCounts.get(key) > 1 && !seenDuplicate.has(key)) {
      seenDuplicate.add(key);
      brokenLogins.push({
        username: label,
        row: l._row,
        reason: `Used by ${usernameCounts.get(key)} rows, delete the one that is out of date`,
      });
    }
    if (!String(l['Password'] ?? '').trim()) {
      brokenLogins.push({ username: label, row: l._row, reason: 'No password set, this account cannot sign in' });
    } else if (!isBcryptHash(String(l['Password']).trim())) {
      brokenLogins.push({
        username: label,
        row: l._row,
        reason: 'Password is not a valid hash, set a new password from Logins',
      });
    }
  }

  return NextResponse.json({
    duplicateCmsIds,
    orphanedLogins,
    rosterWithoutLogin,
    applicantsBadPortfolio,
    brokenLogins,
  });
}
