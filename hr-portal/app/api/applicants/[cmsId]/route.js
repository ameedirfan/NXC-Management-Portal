import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateField, appendRow, TABS, CORE_APPLICANT_FIELDS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const STATUS_HISTORY_HEADERS = ['CMS ID', 'From Status', 'To Status', 'Changed By', 'Timestamp'];

async function readStatusHistorySafely() {
  try {
    return await readSheet(TABS.statusHistory);
  } catch {
    return { headers: [], records: [] };
  }
}

export async function GET(_request, { params }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let applicants, reviews, statusHistory;
  try {
    ({ records: applicants } = await readSheet(TABS.applicants));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }
  const applicant = applicants.find((a) => a['CMS ID'] === params.cmsId);
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 });
  }
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  try {
    [{ records: reviews }, { records: statusHistory }] = await Promise.all([
      readSheet(TABS.reviews),
      readStatusHistorySafely(),
    ]);
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const applicantReviews = reviews
    .filter((r) => r['CMS ID'] === params.cmsId)
    .map((r) => ({
      reviewer: r['Reviewer'],
      recommendation: r['Recommendation'],
      reviewText: r['Review Text'],
      timestamp: r['Timestamp'],
    }))
    .reverse();

  const applicantStatusHistory = statusHistory
    .filter((r) => r['CMS ID'] === params.cmsId)
    .map((r) => ({
      fromStatus: r['From Status'],
      toStatus: r['To Status'],
      changedBy: r['Changed By'],
      timestamp: r['Timestamp'],
    }))
    .reverse();

  const extraFields = Object.entries(applicant).filter(
    ([key, value]) => key !== '_row' && !CORE_APPLICANT_FIELDS.includes(key) && value !== ''
  );

  return NextResponse.json({
    applicant: {
      cmsId: applicant['CMS ID'],
      fullName: applicant['Full Name'],
      contactNo: applicant['Contact No.'],
      email: applicant['Email Address'],
      firstPreference: applicant['1st Preference'],
      secondPreference: applicant['2nd Preference'],
      batch: applicant['Batch'],
      department: applicant['Department'],
      status: applicant['Status'],
      extraFields,
    },
    reviews: applicantReviews,
    statusHistory: applicantStatusHistory,
  });
}

export async function PATCH(request, { params }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { status } = await request.json();
  const { headers, records: applicants } = await readSheet(TABS.applicants);
  const applicant = applicants.find((a) => a['CMS ID'] === params.cmsId);
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 });
  }
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const fromStatus = applicant['Status'] || '';
  await updateField(TABS.applicants, applicant._row, headers, 'Status', status);

  if (fromStatus !== status) {
    try {
      await appendRow(TABS.statusHistory, STATUS_HISTORY_HEADERS, {
        'CMS ID': params.cmsId,
        'From Status': fromStatus || 'none',
        'To Status': status,
        'Changed By': session.fullName || session.username,
        Timestamp: new Date().toISOString(),
      });
    } catch {
      // Status History tab not set up yet, see readStatusHistorySafely above.
    }
  }

  return NextResponse.json({ ok: true });
}
