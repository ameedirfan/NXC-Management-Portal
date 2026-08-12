import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateRow, TABS } from '@/lib/sheets';
import { canAccessFinance } from '@/lib/authz';

export const dynamic = 'force-dynamic';

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function PATCH(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canAccessFinance(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const rowNumber = Number(params.row);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    return NextResponse.json({ error: 'Invalid entry.' }, { status: 400 });
  }

  const body = await request.json();
  const date = (body.date || '').trim();
  const description = (body.description || '').trim();
  const amount = parseAmount(body.amount);
  let type = (body.type || '').trim();

  if (!date || !description || !body.amount) {
    return NextResponse.json({ error: 'Date, Description, and Amount are required.' }, { status: 400 });
  }
  if (!type) type = amount < 0 ? 'Expense' : 'Income';

  const { headers, records } = await readSheet(TABS.finance, 'A:ZZ', { fresh: true });
  const existing = records.find((r) => r._row === rowNumber);
  if (!existing) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  if ((existing['Type'] || '').trim() === 'Opening Balance') {
    return NextResponse.json(
      { error: 'The Opening Balance row is set directly in the sheet, not through the app.' },
      { status: 400 }
    );
  }

  await updateRow(TABS.finance, rowNumber, headers, {
    ...existing,
    Date: date,
    Description: description,
    Amount: amount,
    Type: type,
  });

  return NextResponse.json({ ok: true });
}
