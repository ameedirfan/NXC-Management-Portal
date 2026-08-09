import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canGenerateCheckinCode } from '@/lib/authz';
import { createCheckinToken, CHECKIN_TOKEN_MAX_AGE_SECONDS } from '@/lib/checkinToken';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canGenerateCheckinCode(session)) {
    return NextResponse.json({ error: 'Only admins can generate a check in code.' }, { status: 403 });
  }

  const { portfolio, date } = await request.json();
  if (!portfolio || !date) {
    return NextResponse.json({ error: 'portfolio and date are required.' }, { status: 400 });
  }

  const token = createCheckinToken({ portfolio, date });
  return NextResponse.json({ token, expiresInSeconds: CHECKIN_TOKEN_MAX_AGE_SECONDS });
}
