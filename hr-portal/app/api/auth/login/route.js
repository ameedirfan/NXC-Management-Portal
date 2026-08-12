import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { readSheet, TABS } from '@/lib/sheets';
import { setSessionCookie } from '@/lib/auth';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitKey = `${ip}:${username.toLowerCase()}`;

  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const { records } = await readSheet(TABS.login);
  const user = records.find((r) => (r['Username'] || '').toLowerCase() === username.toLowerCase());

  if (!user) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const match = await bcrypt.compare(password, user['Password'] || '');
  if (!match) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  clearAttempts(rateLimitKey);

  await setSessionCookie({
    username: user['Username'],
    fullName: user['Full Name'] || '',
    cmsId: user['CMS ID'] || '',
    portfolio: user['Portfolio'] || '',
    role: (user['Role'] || 'member').toLowerCase(),
  });

  return NextResponse.json({ ok: true });
}
