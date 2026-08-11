import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, upsertMeetingAttendance, TABS } from '@/lib/sheets';
import { isManagerOrAdmin, canManuallyMarkAttendance } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const STATUSES = ['Present', 'Absent', 'Leave'];

export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const meetingId = searchParams.get('meetingId');
  if (!meetingId) {
    return NextResponse.json({ error: 'meetingId is required.' }, { status: 400 });
  }

  const [{ records: meetings }, { records: attendance }, { records: roster }] = await Promise.all([
    readSheet(TABS.meetings),
    readSheet(TABS.attendance),
    readSheet(TABS.roster),
  ]);

  const meeting = meetings.find((m) => m['Meeting ID'] === meetingId);
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });

  const rosterByCmsId = new Map(roster.map((r) => [r['CMS ID'], r]));
  const people = attendance
    .filter((a) => a['Meeting ID'] === meetingId)
    .map((a) => ({
      cmsId: a['CMS ID'],
      fullName: a['Full Name'],
      designation: rosterByCmsId.get(a['CMS ID'])?.['Designation'] || '',
      status: a['Status'] || '',
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({
    meeting: {
      id: meeting['Meeting ID'],
      date: meeting['Date'],
      scope: meeting['Scope'],
      portfolio: meeting['Portfolio'],
      status: meeting['Status'] || '',
    },
    people,
  });
}

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManuallyMarkAttendance(session)) {
    return NextResponse.json(
      { error: 'Only managers and admins can mark attendance manually.' },
      { status: 403 }
    );
  }

  const { meetingId, records } = await request.json();
  if (!meetingId || !Array.isArray(records)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const { records: meetings } = await readSheet(TABS.meetings);
  const meeting = meetings.find((m) => m['Meeting ID'] === meetingId);
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });

  // Only people who already have a pre-created row for this meeting are
  // valid targets, this is a find-and-edit, never an append of someone
  // outside the meeting's scope.
  const { records: existingAttendance } = await readSheet(TABS.attendance);
  const validCmsIds = new Set(
    existingAttendance.filter((a) => a['Meeting ID'] === meetingId).map((a) => a['CMS ID'])
  );

  const rows = records
    .filter((r) => STATUSES.includes(r.status) && validCmsIds.has(r.cmsId))
    .map((r) => ({
      'Meeting ID': meetingId,
      'CMS ID': r.cmsId,
      'Full Name': r.fullName,
      Status: r.status,
      'Marked By': session.fullName || session.username,
      Timestamp: new Date().toISOString(),
    }));

  await upsertMeetingAttendance(rows);
  return NextResponse.json({ ok: true });
}
