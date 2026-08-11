import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { canAccessFinance } from '@/lib/authz';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const OPENING_BALANCE_TYPE = 'Opening Balance';

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function toEntry(record) {
  return {
    row: record._row,
    date: record['Date'] || '',
    description: record['Description'] || '',
    amount: parseAmount(record['Amount']),
    type: record['Type'] || '',
    recordedBy: record['Recorded By'] || '',
  };
}

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canAccessFinance(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  let records;
  try {
    ({ records } = await readSheet(TABS.finance));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  // Opening Balance lives directly in the sheet as a designated row (Type
  // = "Opening Balance"), not something entered through the app. If more
  // than one such row exists, the first one wins, whatever value is set
  // there is what every calculation starts from.
  const openingRow = records.find((r) => (r['Type'] || '').trim() === OPENING_BALANCE_TYPE);
  const openingBalance = openingRow ? parseAmount(openingRow['Amount']) : 0;

  const entries = records
    .filter((r) => (r['Type'] || '').trim() !== OPENING_BALANCE_TYPE)
    .map(toEntry)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalIncome = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const treasuryBalance = openingBalance + entries.reduce((sum, e) => sum + e.amount, 0);

  return NextResponse.json({ entries, openingBalance, totalIncome, totalExpense, treasuryBalance });
}

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canAccessFinance(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
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

  try {
    const { headers } = await readSheet(TABS.finance, 'A:ZZ', { fresh: true });
    const effectiveHeaders = headers.length ? headers : ['Date', 'Description', 'Amount', 'Type', 'Recorded By'];

    await appendRow(TABS.finance, effectiveHeaders, {
      Date: date,
      Description: description,
      Amount: amount,
      Type: type,
      'Recorded By': session.fullName || session.username,
    });
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
