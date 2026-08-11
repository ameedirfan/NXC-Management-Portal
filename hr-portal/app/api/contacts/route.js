import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { canManageContacts } from '@/lib/authz';

export const dynamic = 'force-dynamic';

function toContact(record) {
  return {
    row: record._row,
    fullName: record['Full Name'] || '',
    position: record['Position'] || '',
    phone: record['Phone Number'] || '',
    email: record['Email'] || '',
  };
}

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { records } = await readSheet(TABS.contacts);
  return NextResponse.json({
    contacts: records.map(toContact),
    canManage: canManageContacts(session),
  });
}

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageContacts(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const fullName = (body.fullName || '').trim();
  const position = (body.position || '').trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();

  if (!fullName || !position) {
    return NextResponse.json({ error: 'Full Name and Position are required.' }, { status: 400 });
  }

  const { headers } = await readSheet(TABS.contacts, 'A:ZZ', { fresh: true });
  const effectiveHeaders = headers.length ? headers : ['Full Name', 'Position', 'Phone Number', 'Email'];
  await appendRow(TABS.contacts, effectiveHeaders, {
    'Full Name': fullName,
    Position: position,
    'Phone Number': phone,
    Email: email,
  });

  return NextResponse.json({ ok: true });
}
