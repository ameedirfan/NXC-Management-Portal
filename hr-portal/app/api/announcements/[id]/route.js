import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateRow, deleteRow, TABS } from '@/lib/sheets';
import { canManageAnnouncements } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const AUDIENCES = ['All', 'Members', 'Managers', 'Admins'];

// Announcements are the confirmed exception to add-and-edit-never-delete:
// a sent announcement can be edited after the fact, and deleted outright.
export async function PATCH(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageAnnouncements(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const message = (body.message || '').trim();
  const audience = (body.audience || 'All').trim();
  if (!message) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience.' }, { status: 400 });
  }

  const { headers, records } = await readSheet(TABS.announcements, 'A:ZZ', { fresh: true });
  const existing = records.find((r) => r['ID'] === params.id);
  if (!existing) return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });

  await updateRow(TABS.announcements, existing._row, headers, {
    ...existing,
    Message: message,
    Audience: audience,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageAnnouncements(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { records } = await readSheet(TABS.announcements, 'A:ZZ', { fresh: true });
  const existing = records.find((r) => r['ID'] === params.id);
  if (!existing) return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });

  await deleteRow(TABS.announcements, existing._row);
  return NextResponse.json({ ok: true });
}
