import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { readSheet, TABS } from '@/lib/sheets';
import { setSessionCookie } from '@/lib/auth';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';
import { normalizeUsername, passwordCandidates } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const submittedUsername = normalizeUsername(username);
  if (!submittedUsername) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitKey = `${ip}:${submittedUsername}`;

  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const { records } = await readSheet(TABS.login);

  // Every row whose username matches, not just the first. The Logins tab
  // is hand-editable, so the same person can end up with two rows (an old
  // one and a re-created one); find() would only ever try the older row's
  // password and lock them out of the account that was actually issued to
  // them. Data quality flags the duplicate so it can be cleaned up, but
  // sign in should not be the thing that breaks in the meantime.
  const candidates = records.filter((r) => normalizeUsername(r['Username']) === submittedUsername);

  // Try the password exactly as typed first, then without surrounding
  // whitespace — see lib/credentials.js for why. The stored hash is
  // trimmed too: a space that crept into the sheet cell makes bcrypt
  // reject every password forever.
  const variants = passwordCandidates(password);
  let user = null;
  for (const candidate of candidates) {
    const hash = String(candidate['Password'] || '').trim();
    if (!hash) continue;
    for (const variant of variants) {
      // bcryptjs throws on a malformed hash rather than returning false.
      // One unusable row must not 500 the whole sign in.
      let ok = false;
      try {
        ok = await bcrypt.compare(variant, hash);
      } catch {
        ok = false;
      }
      if (ok) {
        user = candidate;
        break;
      }
    }
    if (user) break;
  }

  if (!user) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  clearAttempts(rateLimitKey);

  await setSessionCookie({
    // Trimmed: a stray space in the sheet cell would otherwise ride along
    // in the session and break every later lookup keyed on the username.
    username: String(user['Username'] || '').trim(),
    fullName: (user['Full Name'] || '').trim(),
    cmsId: user['CMS ID'] || '',
    portfolio: user['Portfolio'] || '',
    role: (user['Role'] || 'member').toLowerCase(),
  });

  return NextResponse.json({ ok: true });
}
