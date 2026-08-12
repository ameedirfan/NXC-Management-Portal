import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendRow, readSheet, TABS } from '@/lib/sheets';
import { isManagerOrAdmin } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const HEADERS = ['CMS ID', 'Reviewer', 'Recommendation', 'Review Text', 'Timestamp'];

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { cmsId, recommendation, reviewText } = await request.json();
  if (!cmsId || !recommendation) {
    return NextResponse.json({ error: 'cmsId and recommendation are required.' }, { status: 400 });
  }

  const { records: applicants } = await readSheet(TABS.applicants);
  const applicant = applicants.find((a) => a['CMS ID'] === cmsId);
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 });
  }

  await appendRow(TABS.reviews, HEADERS, {
    'CMS ID': cmsId,
    Reviewer: session.fullName || session.username,
    Recommendation: recommendation,
    'Review Text': reviewText || '',
    Timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
