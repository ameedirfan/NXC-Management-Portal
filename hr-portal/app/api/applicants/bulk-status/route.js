import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, batchUpdateFields, TABS, APPLICANT_STATUSES } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const STATUS_HISTORY_HEADERS = ['CMS ID', 'From Status', 'To Status', 'Changed By', 'Timestamp'];

// Sets one status across many applicants in a single Sheets call, the
// same way the bulk email send stamps Last Emailed At. Until this
// existed, a status could only move one applicant at a time from their
// own page, or as a side effect of actually emailing people — so marking
// forty applicants Interviewed after a day of interviews meant either
// forty page visits or sending forty of them an email nobody wanted.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { cmsIds, status } = await request.json();
  if (!Array.isArray(cmsIds) || cmsIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one applicant.' }, { status: 400 });
  }
  if (!APPLICANT_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Not a valid status.' }, { status: 400 });
  }

  let headers, records;
  try {
    // Fresh, not the 15s cached view: this decides what gets written, and
    // a status someone else just changed should not be overwritten off a
    // stale read.
    ({ headers, records } = await readSheet(TABS.applicants, 'A:ZZ', { fresh: true }));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const wanted = new Set(cmsIds);
  const matched = records.filter((r) => wanted.has(r['CMS ID']));
  if (matched.length === 0) {
    return NextResponse.json(
      { error: 'None of the selected applicants are still in the Applicants tab.' },
      { status: 404 }
    );
  }

  // Rows already on the target status are left out of the write entirely
  // — nothing to change, and they should not appear in Status history as
  // a move from a status to itself.
  const changed = matched.filter((r) => (r['Status'] || '') !== status);
  if (changed.length === 0) {
    return NextResponse.json({ updated: 0, unchanged: matched.length, notFound: cmsIds.length - matched.length });
  }

  try {
    await batchUpdateFields(
      TABS.applicants,
      headers,
      changed.map((r) => ({ row: r._row, fields: { Status: status } }))
    );
  } catch (err) {
    return NextResponse.json({ error: `Could not update the status: ${err.message}` }, { status: 500 });
  }

  // Best effort, exactly as the single-applicant PATCH treats it: the
  // Status History tab is optional, and a club that has not set it up
  // should still be able to move statuses.
  for (const r of changed) {
    try {
      await appendRow(TABS.statusHistory, STATUS_HISTORY_HEADERS, {
        'CMS ID': r['CMS ID'],
        'From Status': r['Status'] || 'none',
        'To Status': status,
        'Changed By': session.fullName || session.username,
        Timestamp: new Date().toISOString(),
      });
    } catch {
      break; // the tab is missing or unwritable, so the rest will fail too
    }
  }

  return NextResponse.json({
    updated: changed.length,
    unchanged: matched.length - changed.length,
    notFound: cmsIds.length - matched.length,
  });
}
