import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, upsertMeetingAttendance, TABS } from '@/lib/sheets';
import { verifyCheckinToken } from '@/lib/checkinToken';
import { haversineDistanceKm, MAX_CHECKIN_DISTANCE_KM } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { token, lat, lng } = await request.json();
  const payload = verifyCheckinToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'This check in code is invalid or has expired. Ask for a fresh one.' },
      { status: 400 }
    );
  }

  const [{ records: meetings }, { records: attendance }] = await Promise.all([
    readSheet(TABS.meetings),
    readSheet(TABS.attendance),
  ]);

  const meeting = meetings.find((m) => m['Meeting ID'] === payload.meetingId);
  if (!meeting) {
    return NextResponse.json({ error: 'This meeting no longer exists.' }, { status: 404 });
  }
  if (meeting['Status'] === 'Voided') {
    return NextResponse.json({ error: 'This meeting has been voided.' }, { status: 400 });
  }

  // A row only pre-exists for this meeting if the person was in scope
  // (all of Council, or that portfolio) when the meeting was created.
  const existing = attendance.find(
    (a) => a['Meeting ID'] === payload.meetingId && a['CMS ID'] === session.cmsId
  );
  if (!existing) {
    return NextResponse.json(
      {
        error:
          "You are not on the roster for this meeting, so you can't check yourself in. Ask your portfolio's Manager or Admin.",
      },
      { status: 404 }
    );
  }

  // The real enforcement point, per spec section 4 — always re-read from
  // the sheet, never trust the token's geoRestricted hint (that's only a
  // client-side UX shortcut, see lib/checkinToken.js). Applies to anyone
  // checking in, including a manager or admin scanning their own
  // attendance, not bypassed by role.
  if (meeting['Geo Restricted'] === 'Yes') {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: 'Location access is required to check in to this meeting.', reason: 'location_required' },
        { status: 400 }
      );
    }

    const venueLat = meeting['Venue Latitude'] ? Number(meeting['Venue Latitude']) : null;
    const venueLng = meeting['Venue Longitude'] ? Number(meeting['Venue Longitude']) : null;
    if (venueLat === null || venueLng === null) {
      return NextResponse.json(
        { error: "This meeting's venue location was never set correctly. Ask an admin to fix it." },
        { status: 400 }
      );
    }

    const distanceKm = haversineDistanceKm(lat, lng, venueLat, venueLng);
    if (distanceKm > MAX_CHECKIN_DISTANCE_KM) {
      return NextResponse.json(
        { error: "You don't appear to be at the meeting location.", reason: 'out_of_range' },
        { status: 403 }
      );
    }
  }

  await upsertMeetingAttendance([
    {
      'Meeting ID': payload.meetingId,
      'CMS ID': session.cmsId,
      'Full Name': existing['Full Name'],
      Status: 'Present',
      'Marked By': `${session.fullName || session.username} (self, QR)`,
      Timestamp: new Date().toISOString(),
    },
  ]);

  return NextResponse.json({
    ok: true,
    scope: meeting['Scope'],
    portfolio: meeting['Portfolio'],
    date: meeting['Date'],
  });
}
