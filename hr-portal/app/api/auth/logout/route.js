import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSessionCookie } from '@/lib/auth';
import { WELCOME_COOKIE } from '@/lib/welcome';

export async function POST() {
  await clearSessionCookie();

  // Also clear the "already seen the welcome this session" marker, so
  // signing back in replays the intro instead of dropping straight into
  // the portal. Without this the marker outlives the session it was set
  // in — it has no expiry, so it survives until the browser process
  // ends, and a logout/login round trip would skip the sequence
  // entirely. Deliberately here rather than inside clearSessionCookie(),
  // which stays purely about auth.
  const cookieStore = await cookies();
  cookieStore.delete(WELCOME_COOKIE);

  return NextResponse.json({ ok: true });
}
