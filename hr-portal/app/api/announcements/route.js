import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { canManageAnnouncements, announcementMatchesRole } from '@/lib/authz';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const AUDIENCES = ['All', 'Members', 'Managers', 'Admins'];

function toAnnouncement(record) {
  return {
    row: record._row,
    id: record['ID'] || '',
    message: record['Message'] || '',
    author: record['Author'] || '',
    audience: record['Audience'] || 'All',
    timestamp: record['Timestamp'] || '',
  };
}

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let records;
  try {
    ({ records } = await readSheet(TABS.announcements));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }
  const announcements = records
    .map(toAnnouncement)
    .filter((a) => announcementMatchesRole(a.audience, session.role))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return NextResponse.json({ announcements, canManage: canManageAnnouncements(session) });
}

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageAnnouncements(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const message = (body.message || '').trim();
  const audience = (body.audience || 'All').trim();

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }
  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience.' }, { status: 400 });
  }

  const id = `A${Date.now()}`;
  try {
    const { headers } = await readSheet(TABS.announcements, 'A:ZZ', { fresh: true });
    const effectiveHeaders = headers.length ? headers : ['ID', 'Message', 'Author', 'Audience', 'Timestamp'];

    await appendRow(TABS.announcements, effectiveHeaders, {
      ID: id,
      Message: message,
      Author: session.fullName || session.username,
      Audience: audience,
      Timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
