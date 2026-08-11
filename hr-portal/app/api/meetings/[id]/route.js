import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateField, TABS } from '@/lib/sheets';
import { canVoidMeeting } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// Voiding, not deleting, a mistakenly created meeting. Attendance rows
// tied to a Voided meeting are simply skipped by the percentage
// calculation, same "ghost entry" mechanic as a Leave status.
export async function PATCH(request, { params }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canVoidMeeting(session)) {
    return NextResponse.json({ error: 'Admin access required to void a meeting.' }, { status: 403 });
  }

  const body = await request.json();
  if (body.status !== 'Voided') {
    return NextResponse.json({ error: 'Only voiding is supported here.' }, { status: 400 });
  }

  const { headers, records } = await readSheet(TABS.meetings, 'A:ZZ', { fresh: true });
  const meeting = records.find((r) => r['Meeting ID'] === params.id);
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });

  await updateField(TABS.meetings, meeting._row, headers, 'Status', 'Voided');
  return NextResponse.json({ ok: true });
}
