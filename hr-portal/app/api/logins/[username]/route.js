import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { readSheet, updateRow, TABS } from '@/lib/sheets';
import { isAdmin } from '@/lib/authz';
import { dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'manager', 'member'];

export async function PATCH(request, { params }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { headers, records } = await readSheet(TABS.login, 'A:ZZ', { fresh: true });
  const record = records.find(
    (r) => (r['Username'] || '').toLowerCase() === params.username.toLowerCase()
  );
  if (!record) {
    return NextResponse.json({ error: 'Login not found.' }, { status: 404 });
  }

  const nextRole =
    body.role !== undefined ? String(body.role).trim().toLowerCase() : (record['Role'] || '').toLowerCase();
  if (body.role !== undefined && !ROLES.includes(nextRole)) {
    return NextResponse.json({ error: "Role must be admin, manager, or member." }, { status: 400 });
  }

  const wasAdmin = (record['Role'] || '').toLowerCase() === 'admin';
  if (wasAdmin && nextRole !== 'admin') {
    const otherAdmins = records.filter(
      (r) => r._row !== record._row && (r['Role'] || '').toLowerCase() === 'admin'
    );
    if (otherAdmins.length === 0) {
      return NextResponse.json(
        { error: 'Cannot change the last admin account away from admin.' },
        { status: 400 }
      );
    }
  }

  let nextUsername = record['Username'];
  if (body.username !== undefined) {
    const trimmed = String(body.username).trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Username cannot be blank.' }, { status: 400 });
    }
    if (
      trimmed.toLowerCase() !== record['Username'].toLowerCase() &&
      records.some((r) => r._row !== record._row && (r['Username'] || '').toLowerCase() === trimmed.toLowerCase())
    ) {
      return NextResponse.json({ error: `Username "${trimmed}" is already taken.` }, { status: 409 });
    }
    nextUsername = trimmed;
  }

  const merged = { ...record, Username: nextUsername, Role: nextRole };
  if (body.fullName !== undefined) merged['Full Name'] = String(body.fullName).trim();
  if (body.cmsId !== undefined) merged['CMS ID'] = String(body.cmsId).trim();
  if (body.portfolio !== undefined) {
    const { records: roster } = await readSheet(TABS.roster);
    const rosterPortfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));
    merged['Portfolio'] = canonicalPortfolioName(String(body.portfolio).trim(), rosterPortfolios);
  }
  if (nextRole !== 'admin' && !merged['Portfolio']) {
    return NextResponse.json(
      { error: 'A portfolio is required for manager and member accounts.' },
      { status: 400 }
    );
  }

  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    merged['Password'] = await bcrypt.hash(body.password, 10);
  }

  await updateRow(TABS.login, record._row, headers, merged);
  return NextResponse.json({ ok: true });
}
