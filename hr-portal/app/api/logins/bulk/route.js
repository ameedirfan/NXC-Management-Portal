import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { isAdmin } from '@/lib/authz';
import { canonicalPortfolioName, dedupePortfolios } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'manager', 'member'];
// Excludes 0/O, 1/l/I, so a printed or handwritten password is never
// ambiguous when someone types it back in.
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generatePassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  return out;
}

function slugifyUsername(fullName) {
  const clean = (fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'member';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

function uniqueUsername(base, taken) {
  let candidate = base;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}${n}`;
    n++;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

// Admin only, same tier as the rest of Login management. Two step flow:
//
// Step 1, dry run: body is { cmsIds, role, usernameStrategy }. Generates a
// candidate username and a random password per selected roster member,
// without writing anything.
//
// Step 2, confirm: body is { entries: [{ cmsId, username, password, role }],
// dryRun: false }. Writes exactly the entries that were previewed, using
// the same usernames and passwords, nothing is regenerated between preview
// and confirm, so what the admin reviewed is exactly what gets created.
export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();

  const [{ headers, records: logins }, { records: roster }] = await Promise.all([
    readSheet(TABS.login, 'A:ZZ', { fresh: true }),
    readSheet(TABS.roster),
  ]);
  const existingUsernames = new Set(logins.map((l) => (l['Username'] || '').toLowerCase()));
  const loginCmsIds = new Set(logins.map((l) => l['CMS ID']).filter(Boolean));
  const rosterByCmsId = new Map(roster.map((r) => [r['CMS ID'], r]));
  const rosterPortfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));

  if (body.dryRun === false && Array.isArray(body.entries)) {
    const results = [];
    const takenThisRun = new Set(existingUsernames);
    const effectiveHeaders = headers.length
      ? headers
      : ['Username', 'Password', 'Full Name', 'CMS ID', 'Portfolio', 'Role'];

    for (const entry of body.entries) {
      const { cmsId, username, password, role } = entry;
      const errors = [];
      const person = rosterByCmsId.get(cmsId);
      if (!person) errors.push('No longer on the roster');
      if (loginCmsIds.has(cmsId)) errors.push('Already has a login');
      if (!ROLES.includes(role)) errors.push('Invalid role');
      if (!username || takenThisRun.has(username.toLowerCase())) {
        errors.push(`Username "${username}" is taken`);
      }

      if (errors.length > 0) {
        results.push({ cmsId, username, ok: false, errors });
        continue;
      }

      const canonicalPortfolio = canonicalPortfolioName(person['Portfolio'], rosterPortfolios);
      const passwordHash = await bcrypt.hash(password, 10);

      await appendRow(TABS.login, effectiveHeaders, {
        Username: username,
        Password: passwordHash,
        'Full Name': person['Full Name'] || '',
        'CMS ID': cmsId,
        Portfolio: canonicalPortfolio,
        Role: role,
      });

      takenThisRun.add(username.toLowerCase());
      results.push({ cmsId, username, password, fullName: person['Full Name'] || '', role, ok: true, errors: [] });
    }

    return NextResponse.json({
      created: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => !r.ok).length,
      results,
    });
  }

  const { cmsIds, role, usernameStrategy } = body;
  if (!Array.isArray(cmsIds) || cmsIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one roster member.' }, { status: 400 });
  }
  if (cmsIds.length > 200) {
    return NextResponse.json({ error: 'Bulk create is capped at 200 at a time.' }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role must be admin, manager, or member.' }, { status: 400 });
  }

  const takenUsernames = new Set(existingUsernames);
  const results = cmsIds.map((cmsId) => {
    const person = rosterByCmsId.get(cmsId);
    const errors = [];
    if (!person) errors.push('Not found on the roster');
    if (loginCmsIds.has(cmsId)) errors.push('Already has a login');
    if (role !== 'admin' && person && !person['Portfolio']) errors.push('No portfolio on roster record');

    if (errors.length > 0 || !person) {
      return { cmsId, fullName: person?.['Full Name'] || '', ok: false, errors };
    }

    const base = usernameStrategy === 'name' ? slugifyUsername(person['Full Name']) : cmsId;
    const username = uniqueUsername(base, takenUsernames);
    const password = generatePassword();

    return {
      cmsId,
      fullName: person['Full Name'] || '',
      portfolio: person['Portfolio'] || '',
      username,
      password,
      role,
      ok: true,
      errors: [],
    };
  });

  return NextResponse.json({
    results,
    validCount: results.filter((r) => r.ok).length,
    totalCount: cmsIds.length,
  });
}
