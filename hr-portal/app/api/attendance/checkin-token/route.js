import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { canGenerateCheckinCode } from '@/lib/authz';
import { createCheckinToken, CHECKIN_TOKEN_MAX_AGE_SECONDS } from '@/lib/checkinToken';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canGenerateCheckinCode(session)) {
    return NextResponse.json({ error: 'Only managers and admins can generate a check in code.' }, { status: 403 });
  }

  const { meetingId } = await request.json();
  if (!meetingId) {
    return NextResponse.json({ error: 'meetingId is required.' }, { status: 400 });
  }

  const { records: meetings } = await readSheet(TABS.meetings);
  const meeting = meetings.find((m) => m['Meeting ID'] === meetingId);
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (meeting['Status'] === 'Voided') {
    return NextResponse.json({ error: 'This meeting has been voided.' }, { status: 400 });
  }

  const token = createCheckinToken({ meetingId, geoRestricted: meeting['Geo Restricted'] === 'Yes' });
  return NextResponse.json({ token, expiresInSeconds: CHECKIN_TOKEN_MAX_AGE_SECONDS });
}
