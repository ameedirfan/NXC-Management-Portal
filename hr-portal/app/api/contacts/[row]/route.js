import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateRow, TABS } from '@/lib/sheets';
import { canManageContacts } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageContacts(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const rowNumber = Number(params.row);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    return NextResponse.json({ error: 'Invalid contact.' }, { status: 400 });
  }

  const body = await request.json();
  const fullName = (body.fullName || '').trim();
  const position = (body.position || '').trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();

  if (!fullName || !position) {
    return NextResponse.json({ error: 'Full Name and Position are required.' }, { status: 400 });
  }

  const { headers, records } = await readSheet(TABS.contacts, 'A:ZZ', { fresh: true });
  const existing = records.find((r) => r._row === rowNumber);
  if (!existing) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  await updateRow(TABS.contacts, rowNumber, headers, {
    ...existing,
    'Full Name': fullName,
    Position: position,
    'Phone Number': phone,
    Email: email,
  });

  return NextResponse.json({ ok: true });
}
