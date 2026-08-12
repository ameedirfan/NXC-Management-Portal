import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, updateField, TABS } from '@/lib/sheets';
import { canManageTrips } from '@/lib/authz';
import { uploadTripFile, deleteTripFile, extractDriveFileId } from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';

const SLOTS = {
  itinerary: { column: 'Itinerary File Link', kinds: ['application/pdf'] },
  seatingPlan: { column: 'Seating Plan File Link', kinds: ['application/pdf'] },
  groupPhoto: { column: 'Group Photo Link', kinds: ['image/png', 'image/jpeg'] },
};

// Re-uploading a file is the confirmed exception to add-and-edit-never-
// delete here: the old Drive file is deleted, not kept as an orphan.
export async function POST(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canManageTrips(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const formData = await request.formData();
  const slotKey = formData.get('slot');
  const file = formData.get('file');
  const slot = SLOTS[slotKey];

  if (!slot || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'A valid slot and file are required.' }, { status: 400 });
  }
  if (!slot.kinds.includes(file.type)) {
    return NextResponse.json(
      { error: slotKey === 'groupPhoto' ? 'Group photo must be a PNG or JPG.' : 'This file must be a PDF.' },
      { status: 400 }
    );
  }

  const { headers, records } = await readSheet(TABS.trips, 'A:ZZ', { fresh: true });
  const trip = records.find((r) => r['Trip ID'] === params.id);
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });

  const oldFileId = extractDriveFileId(trip[slot.column]);

  const buffer = Buffer.from(await file.arrayBuffer());
  let uploaded;
  try {
    uploaded = await uploadTripFile(buffer, file.name || slotKey, file.type);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not upload this file.' }, { status: 500 });
  }

  await updateField(TABS.trips, trip._row, headers, slot.column, uploaded.previewUrl);

  if (oldFileId) await deleteTripFile(oldFileId);

  return NextResponse.json({ ok: true, url: uploaded.previewUrl });
}
