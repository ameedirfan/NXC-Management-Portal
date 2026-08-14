import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readSheet, appendRow, appendRows, TABS, MEETING_HEADERS, MEETING_ATTENDANCE_HEADERS } from '@/lib/sheets';
import { isManagerOrAdmin, canCreateMeeting } from '@/lib/authz';
import { normalizePortfolio, canonicalPortfolioName, dedupePortfolios } from '@/lib/portfolio';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

const SCOPES = ['Council', 'Portfolio'];

function toMeeting(record) {
  return {
    id: record['Meeting ID'] || '',
    date: record['Date'] || '',
    scope: record['Scope'] || '',
    portfolio: record['Portfolio'] || '',
    createdBy: record['Created By'] || '',
    status: record['Status'] || '',
    // Blank/missing (older meetings, or a sheet that hasn't gained these
    // columns yet) reads as not geo restricted, deliberately, so nothing
    // that predates this feature is retroactively affected.
    geoRestricted: record['Geo Restricted'] === 'Yes',
    venueLat: record['Venue Latitude'] ? Number(record['Venue Latitude']) : null,
    venueLng: record['Venue Longitude'] ? Number(record['Venue Longitude']) : null,
  };
}

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let records;
  try {
    ({ records } = await readSheet(TABS.meetings));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }
  const meetings = records
    .map(toMeeting)
    .filter((m) => !date || m.date === date);

  return NextResponse.json({ meetings });
}

// Creating a meeting is manager/admin (see lib/authz.js canCreateMeeting)
// and immediately pre-creates every applicable person's Attendance row as
// Absent, in one batch write, per the "pre-created as Absent" rule.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!canCreateMeeting(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required to create a meeting.' }, { status: 403 });
  }

  const body = await request.json();
  const date = (body.date || '').trim();
  const scope = (body.scope || '').trim();
  const rawPortfolio = (body.portfolio || '').trim();
  const geoRestricted = !!body.geoRestricted;
  const venueLat = geoRestricted ? Number(body.venueLat) : null;
  const venueLng = geoRestricted ? Number(body.venueLng) : null;

  if (!date || !SCOPES.includes(scope)) {
    return NextResponse.json({ error: 'A date and a valid scope (Council or Portfolio) are required.' }, { status: 400 });
  }
  if (scope === 'Portfolio' && !rawPortfolio) {
    return NextResponse.json({ error: 'A portfolio is required for a Portfolio Meet.' }, { status: 400 });
  }
  if (geoRestricted && (!Number.isFinite(venueLat) || !Number.isFinite(venueLng))) {
    return NextResponse.json(
      { error: 'A pinned venue location is required for a geo restricted meeting.' },
      { status: 400 }
    );
  }

  const { records: roster } = await readSheet(TABS.roster);
  const rosterPortfolios = dedupePortfolios(roster.map((r) => r['Portfolio']));
  const canonicalPortfolio = scope === 'Portfolio' ? canonicalPortfolioName(rawPortfolio, rosterPortfolios) : '';

  const applicable =
    scope === 'Council'
      ? roster
      : roster.filter((r) => normalizePortfolio(r['Portfolio']) === normalizePortfolio(canonicalPortfolio));

  if (applicable.length === 0) {
    return NextResponse.json({ error: 'No roster members match this meeting\'s scope.' }, { status: 400 });
  }

  const meetingId = `M${Date.now()}`;
  try {
    const { headers: meetingHeaders } = await readSheet(TABS.meetings, 'A:ZZ', { fresh: true });
    const effectiveMeetingHeaders = meetingHeaders.length ? meetingHeaders : MEETING_HEADERS;

    await appendRow(TABS.meetings, effectiveMeetingHeaders, {
      'Meeting ID': meetingId,
      Date: date,
      Scope: scope,
      Portfolio: canonicalPortfolio,
      'Created By': session.fullName || session.username,
      Status: '',
      'Geo Restricted': geoRestricted ? 'Yes' : 'No',
      'Venue Latitude': geoRestricted ? venueLat : '',
      'Venue Longitude': geoRestricted ? venueLng : '',
    });

    const timestamp = new Date().toISOString();
    await appendRows(
      TABS.attendance,
      MEETING_ATTENDANCE_HEADERS,
      applicable.map((p) => ({
        'Meeting ID': meetingId,
        'CMS ID': p['CMS ID'],
        'Full Name': p['Full Name'],
        Status: 'Absent',
        'Marked By': `${session.fullName || session.username} (meeting created)`,
        Timestamp: timestamp,
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    meeting: {
      id: meetingId,
      date,
      scope,
      portfolio: canonicalPortfolio,
      status: '',
      geoRestricted,
      venueLat,
      venueLng,
    },
    absentCount: applicable.length,
  });
}
