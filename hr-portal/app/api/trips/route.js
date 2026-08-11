import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, TABS } from '@/lib/sheets';
import { canManageTrips } from '@/lib/authz';

export const dynamic = 'force-dynamic';

function toTrip(record) {
  return {
    row: record._row,
    id: record['Trip ID'] || '',
    location: record['Location'] || '',
    days: record['Number of Days'] || '',
    participantCount: record['Total Participant Count'] || '',
    itineraryLink: record['Itinerary File Link'] || '',
    seatingPlanLink: record['Seating Plan File Link'] || '',
    groupPhotoLink: record['Group Photo Link'] || '',
    createdBy: record['Created By'] || '',
    dateAdded: record['Date Added'] || '',
  };
}

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { records } = await readSheet(TABS.trips);
  const trips = records.map(toTrip).sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1));

  return NextResponse.json({ trips, canManage: canManageTrips(session) });
}

// Admin only: enter Location + Number of Days + Total Participant Count.
// Files are uploaded afterwards, per file, via /api/trips/[id]/files.
export async function POST(request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageTrips(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const location = (body.location || '').trim();
  const days = (body.days || '').trim();
  const participantCount = (body.participantCount || '').trim();

  if (!location || !days || !participantCount) {
    return NextResponse.json(
      { error: 'Location, Number of Days, and Total Participant Count are required.' },
      { status: 400 }
    );
  }

  const { headers } = await readSheet(TABS.trips, 'A:ZZ', { fresh: true });
  const effectiveHeaders = headers.length
    ? headers
    : [
        'Trip ID',
        'Location',
        'Number of Days',
        'Total Participant Count',
        'Itinerary File Link',
        'Seating Plan File Link',
        'Group Photo Link',
        'Created By',
        'Date Added',
      ];

  const id = `T${Date.now()}`;
  await appendRow(TABS.trips, effectiveHeaders, {
    'Trip ID': id,
    Location: location,
    'Number of Days': days,
    'Total Participant Count': participantCount,
    'Itinerary File Link': '',
    'Seating Plan File Link': '',
    'Group Photo Link': '',
    'Created By': session.fullName || session.username,
    'Date Added': new Date().toISOString().slice(0, 10),
  });

  return NextResponse.json({ ok: true, id });
}
