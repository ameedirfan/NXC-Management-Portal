import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isManagerOrAdmin } from '@/lib/authz';
import {
  readSheet,
  appendRow,
  batchUpdateFields,
  TABS,
  APPLICANT_STATUSES,
  EMAIL_LOG_HEADERS,
} from '@/lib/sheets';
import { sendGmailMessage } from '@/lib/gmail';
import { renderAnnouncementHtml } from '@/lib/markdown';
import { isSendableEmail } from '@/lib/email';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const STATUS_HISTORY_HEADERS = ['CMS ID', 'From Status', 'To Status', 'Changed By', 'Timestamp'];
const BATCH_SIZE = 150; // spec section 4.5 — Gmail's practical BCC limit per call

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function logEmailAttempt({ session, subject, recipientCmsIds, skippedLabel, status }) {
  try {
    await appendRow(TABS.emailLog, EMAIL_LOG_HEADERS, {
      Timestamp: new Date().toISOString(),
      'Sent By': session.fullName || session.username,
      Subject: subject,
      'Recipient Count': status === 'Success' ? recipientCmsIds.length : 0,
      'Recipient CMS IDs': status === 'Success' ? recipientCmsIds.join(', ') : '',
      'Skipped (no email)': skippedLabel,
      Status: status,
    });
  } catch {
    // Email Log tab not set up yet — don't let a logging failure mask the
    // real send result, same tolerance as Status History elsewhere.
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { cmsIds, subject, body, bulkStatus, skipped } = await request.json();

  if (!Array.isArray(cmsIds) || cmsIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one recipient.' }, { status: 400 });
  }
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Subject and body are both required.' }, { status: 400 });
  }
  if (bulkStatus && !APPLICANT_STATUSES.includes(bulkStatus)) {
    return NextResponse.json({ error: 'Not a valid status.' }, { status: 400 });
  }

  let headers, records;
  try {
    // Bypass the 15s read cache: this is exactly the kind of write where
    // acting on stale data (an email that changed, a status that moved)
    // would matter.
    ({ headers, records } = await readSheet(TABS.applicants, 'A:ZZ', { fresh: true }));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const cmsIdSet = new Set(cmsIds);
  const matched = records.filter((r) => cmsIdSet.has(r['CMS ID']));
  const sendable = matched.filter((r) => isSendableEmail(r['Email']));

  const skippedLabel = Array.isArray(skipped)
    ? skipped.map((s) => s.fullName || s.cmsId).join(', ')
    : '';

  if (sendable.length === 0) {
    return NextResponse.json(
      { error: 'None of the selected recipients currently have a valid email on file.' },
      { status: 400 }
    );
  }

  const recipientEmails = sendable.map((r) => r['Email'].trim());
  const recipientCmsIds = sendable.map((r) => r['CMS ID']);
  const html = renderAnnouncementHtml(body);

  // The gmail.send scope alone can't look this address up via the Gmail
  // API (that needs a broader scope), so it's just the NXC society's own
  // address, configured once — it's also literally the account the OAuth
  // refresh token was authorized as, so this is not a separate secret.
  const fromAddress = process.env.NXC_GMAIL_ADDRESS;
  if (!fromAddress) {
    return NextResponse.json(
      { error: 'NXC_GMAIL_ADDRESS is not set in your environment variables.' },
      { status: 500 }
    );
  }

  const batches = chunk(recipientEmails, BATCH_SIZE);
  let sentBatches = 0;
  try {
    for (const batch of batches) {
      await sendGmailMessage({ to: fromAddress, bcc: batch, subject, html });
      sentBatches += 1;
    }
  } catch (err) {
    await logEmailAttempt({ session, subject, recipientCmsIds, skippedLabel, status: 'Failed' });
    const partialNote =
      sentBatches > 0
        ? ` ${sentBatches} of ${batches.length} batches already went out before this failed — those recipients did receive it, retrying will email them again.`
        : ' No email went out.';
    return NextResponse.json(
      { error: `Send failed: ${err.message}.${partialNote} Nothing was marked as emailed.` },
      { status: 500 }
    );
  }

  // Only reached once every batch succeeded — nothing below runs on a
  // partial or total failure, per spec section 4.5 point 4.
  const now = new Date().toISOString();
  const updates = sendable.map((r) => ({
    row: r._row,
    fields: bulkStatus ? { 'Last Emailed At': now, Status: bulkStatus } : { 'Last Emailed At': now },
  }));
  try {
    await batchUpdateFields(TABS.applicants, headers, updates);
  } catch (err) {
    return NextResponse.json(
      {
        error: `The email sent successfully, but recording Last Emailed At failed: ${err.message}. Fix this directly in the sheet so records stay accurate.`,
      },
      { status: 500 }
    );
  }

  if (bulkStatus) {
    for (const r of sendable) {
      const fromStatus = r['Status'] || '';
      if (fromStatus === bulkStatus) continue;
      try {
        await appendRow(TABS.statusHistory, STATUS_HISTORY_HEADERS, {
          'CMS ID': r['CMS ID'],
          'From Status': fromStatus || 'none',
          'To Status': bulkStatus,
          'Changed By': session.fullName || session.username,
          Timestamp: now,
        });
      } catch {
        // Status History tab not set up yet, same tolerance as the
        // single-applicant status change route.
      }
    }
  }

  await logEmailAttempt({ session, subject, recipientCmsIds, skippedLabel, status: 'Success' });

  return NextResponse.json({ ok: true, recipientCount: sendable.length });
}
