import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { dedupePortfolios, canonicalPortfolioName } from '@/lib/portfolio';
import { ROSTER_FIELD_MAP, toRosterRecord } from '@/lib/rosterFields';

export const dynamic = 'force-dynamic';

const REQUIRED = ['cmsId', 'fullName', 'portfolio', 'designation'];

export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { rows, dryRun } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Import is capped at 500 rows at a time.' }, { status: 400 });
  }

  const { headers, records: existing } = await readSheet(TABS.roster, 'A:ZZ', { fresh: true });
  const existingCmsIds = new Set(existing.map((r) => r['CMS ID']).filter(Boolean));
  const existingPortfolios = dedupePortfolios(existing.map((r) => r['Portfolio']));
  const seenInFile = new Set();

  const results = rows.map((row, i) => {
    const errors = [];
    for (const field of REQUIRED) {
      if (!row[field] || !String(row[field]).trim()) {
        errors.push(`Missing ${ROSTER_FIELD_MAP[field]}`);
      }
    }
    const cmsId = (row.cmsId || '').trim();
    if (cmsId) {
      if (existingCmsIds.has(cmsId)) errors.push(`CMS ID ${cmsId} is already on the roster`);
      if (seenInFile.has(cmsId)) errors.push(`CMS ID ${cmsId} is duplicated in this file`);
      seenInFile.add(cmsId);
    }

    const canonicalPortfolio = row.portfolio
      ? canonicalPortfolioName(row.portfolio, existingPortfolios)
      : '';

    return {
      row: i + 1,
      cmsId,
      fullName: row.fullName || '',
      portfolio: canonicalPortfolio,
      ok: errors.length === 0,
      errors,
      record: { ...row, portfolio: canonicalPortfolio },
    };
  });

  const validRows = results.filter((r) => r.ok);

  if (dryRun) {
    return NextResponse.json({ results, validCount: validRows.length, totalCount: rows.length });
  }

  const effectiveHeaders = headers.length ? headers : Object.values(ROSTER_FIELD_MAP);
  for (const r of validRows) {
    await appendRow(TABS.roster, effectiveHeaders, toRosterRecord(r.record));
  }

  return NextResponse.json({
    imported: validRows.length,
    skipped: results.length - validRows.length,
    results,
  });
}
