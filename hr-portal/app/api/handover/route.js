import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, TABS } from '@/lib/sheets';
import { isAdmin } from '@/lib/authz';
import { toRosterMember } from '@/lib/rosterFields';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const OPENING_BALANCE_TYPE = 'Opening Balance';

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Bundles a full end-of-tenure snapshot pulled straight from every
// existing tab, admin only. No new Sheets tab, nothing computed here is
// stored anywhere, this is a read-only export.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  let rosterRecords, financeRecords, attendanceRecords, meetingRecords, tripRecords;
  try {
    [
      { records: rosterRecords },
      { records: financeRecords },
      { records: attendanceRecords },
      { records: meetingRecords },
      { records: tripRecords },
    ] = await Promise.all([
      readSheet(TABS.roster),
      readSheet(TABS.finance),
      readSheet(TABS.attendance),
      readSheet(TABS.meetings),
      readSheet(TABS.trips),
    ]);
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const roster = rosterRecords.map(toRosterMember);

  const openingRow = financeRecords.find((r) => (r['Type'] || '').trim() === OPENING_BALANCE_TYPE);
  const openingBalance = openingRow ? parseAmount(openingRow['Amount']) : 0;
  const financeEntries = financeRecords
    .filter((r) => (r['Type'] || '').trim() !== OPENING_BALANCE_TYPE)
    .map((r) => ({
      date: r['Date'] || '',
      description: r['Description'] || '',
      amount: parseAmount(r['Amount']),
      type: r['Type'] || '',
      recordedBy: r['Recorded By'] || '',
    }));
  const totalIncome = financeEntries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = financeEntries.filter((e) => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const treasuryBalance = openingBalance + financeEntries.reduce((sum, e) => sum + e.amount, 0);

  const meetingById = new Map(meetingRecords.map((m) => [m['Meeting ID'], m]));
  const attendanceHistory = attendanceRecords.map((a) => {
    const meeting = meetingById.get(a['Meeting ID']) || {};
    return {
      meetingId: a['Meeting ID'] || '',
      date: meeting['Date'] || '',
      scope: meeting['Scope'] || '',
      portfolio: meeting['Portfolio'] || '',
      meetingStatus: meeting['Status'] || '',
      cmsId: a['CMS ID'] || '',
      fullName: a['Full Name'] || '',
      status: a['Status'] || '',
      markedBy: a['Marked By'] || '',
    };
  });

  const trips = tripRecords.map((t) => ({
    id: t['Trip ID'] || '',
    location: t['Location'] || '',
    days: t['Number of Days'] || '',
    participantCount: t['Total Participant Count'] || '',
    itineraryLink: t['Itinerary File Link'] || '',
    seatingPlanLink: t['Seating Plan File Link'] || '',
    groupPhotoLink: t['Group Photo Link'] || '',
    createdBy: t['Created By'] || '',
    dateAdded: t['Date Added'] || '',
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    roster,
    finance: { entries: financeEntries, openingBalance, totalIncome, totalExpense, treasuryBalance },
    attendanceHistory,
    trips,
  });
}
