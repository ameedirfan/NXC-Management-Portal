import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { canManageLogins } from '@/lib/authz';
import { dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'manager', 'member'];

function toLoginSummary(record) {
  return {
    username: record['Username'] || '',
    fullName: record['Full Name'] || '',
    cmsId: record['CMS ID'] || '',
    portfolio: record['Portfolio'] || '',
    role: (record['Role'] || 'member').toLowerCase(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageLogins(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  let records;
  try {
    ({ records } = await readSheet(TABS.login));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }
  return NextResponse.json({ logins: records.map(toLoginSummary) });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageLogins(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const username = (body.username || '').trim();
  const password = body.password || '';
  const fullName = (body.fullName || '').trim();
  const cmsId = (body.cmsId || '').trim();
  const portfolio = (body.portfolio || '').trim();
  const role = (body.role || '').trim().toLowerCase();

  if (!username || !password || !fullName || !role) {
    return NextResponse.json(
      { error: 'Username, password, full name, and role are required.' },
      { status: 400 }
    );
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Role must be admin, manager, or member." }, { status: 400 });
  }
  if (role !== 'admin' && !portfolio) {
    return NextResponse.json(
      { error: 'A portfolio is required for manager and member accounts.' },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const [{ headers, records: logins }, { records: roster }] = await Promise.all([
    readSheet(TABS.login, 'A:ZZ', { fresh: true }),
    readSheet(TABS.roster),
  ]);

  if (logins.some((r) => (r['Username'] || '').toLowerCase() === username.toLowerCase())) {
    return NextResponse.json({ error: `Username "${username}" is already taken.` }, { status: 409 });
  }
  const rosterPortfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));
  const canonicalPortfolio = canonicalPortfolioName(portfolio, rosterPortfolios);
  if (role !== 'admin' && !rosterPortfolios.some((p) => p === canonicalPortfolio)) {
    return NextResponse.json(
      { error: `No roster members have the portfolio "${portfolio}". Check spelling.` },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const effectiveHeaders = headers.length
    ? headers
    : ['Username', 'Password', 'Full Name', 'CMS ID', 'Portfolio', 'Role'];

  await appendRow(TABS.login, effectiveHeaders, {
    Username: username,
    Password: passwordHash,
    'Full Name': fullName,
    'CMS ID': cmsId,
    Portfolio: canonicalPortfolio,
    Role: role,
  });

  return NextResponse.json({ ok: true });
}
