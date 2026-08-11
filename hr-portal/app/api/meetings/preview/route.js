import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { canCreateMeeting } from '@/lib/authz';
import { normalizePortfolio } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

// Backs the one step confirmation shown before a meeting is created:
// "This will create an Absent record for all N roster members / N
// Logistics members." Read only, no write happens here.
export async function GET(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canCreateMeeting(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || '';
  const portfolio = searchParams.get('portfolio') || '';

  const { records: roster } = await readSheet(TABS.roster);
  const count =
    scope === 'Council'
      ? roster.length
      : roster.filter((r) => normalizePortfolio(r['Portfolio']) === normalizePortfolio(portfolio)).length;

  return NextResponse.json({ count });
}
