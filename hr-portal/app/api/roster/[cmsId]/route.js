import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateRow, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';
import { ROSTER_FIELD_MAP } from '@/lib/rosterFields';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  if (body.cmsId !== undefined && body.cmsId.trim() !== params.cmsId) {
    return NextResponse.json(
      { error: 'CMS ID cannot be changed here. Edit it directly in the Roster tab.' },
      { status: 400 }
    );
  }

  const { headers, records } = await readSheet(TABS.roster, 'A:ZZ', { fresh: true });
  const record = records.find((r) => r['CMS ID'] === params.cmsId);
  if (!record) {
    return NextResponse.json({ error: 'Roster member not found.' }, { status: 404 });
  }

  const merged = { ...record };
  for (const [key, header] of Object.entries(ROSTER_FIELD_MAP)) {
    if (body[key] !== undefined) merged[header] = String(body[key]).trim();
  }
  if (body.portfolio !== undefined) {
    const existingPortfolios = dedupePortfolios(records.map((r) => r['Portfolio']));
    merged['Portfolio'] = canonicalPortfolioName(body.portfolio, existingPortfolios);
  }

  await updateRow(TABS.roster, record._row, headers, merged);
  return NextResponse.json({ ok: true });
}
