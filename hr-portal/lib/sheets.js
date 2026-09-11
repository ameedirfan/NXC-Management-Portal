import { google } from 'googleapis';

export const TABS = {
  roster: 'Roster',
  login: 'Login',
  attendance: 'Attendance',
  applicants: 'Applicants',
  reviews: 'Reviews',
  statusHistory: 'Status History',
  contacts: 'Contacts',
  meetings: 'Meetings',
  finance: 'Finance',
  announcements: 'Announcements',
  trips: 'Trips',
  emailLog: 'Email Log',
};

// Columns for the Meeting ID linked Attendance schema (see upsertMeetingAttendance).
export const MEETING_ATTENDANCE_HEADERS = [
  'Meeting ID',
  'CMS ID',
  'Full Name',
  'Status',
  'Marked By',
  'Timestamp',
];

// Geo Restricted / Venue Latitude / Venue Longitude back the optional
// 1km check-in radius (see lib/geo.js and the checkin page). Radius
// itself is a fixed system constant, not stored per meeting.
export const MEETING_HEADERS = [
  'Meeting ID',
  'Date',
  'Scope',
  'Portfolio',
  'Created By',
  'Status',
  'Geo Restricted',
  'Venue Latitude',
  'Venue Longitude',
];

// The Applicants tab can have any number of extra columns beyond these
// core ones (interview questions, ratings, whatever a club adds) — those
// extra columns get surfaced automatically on the applicant page. This
// list is just what the app treats as "core" fields with dedicated UI.
export const CORE_APPLICANT_FIELDS = [
  'CMS ID',
  'Name',
  'School',
  'Batch',
  'Contact Number',
  'Email',
  'Portfolio',
  'Status',
  'Last Emailed At',
];

export const APPLICANT_STATUSES = ['Pending', 'Interviewed', 'Reserve', 'Not Recommended', 'Selected'];

export const EMAIL_LOG_HEADERS = [
  'Timestamp',
  'Sent By',
  'Subject',
  'Recipient Count',
  'Recipient CMS IDs',
  'Skipped (no email)',
  'Status',
];

let cachedClient = null;

function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Reads are cached for 15 seconds per tab, and invalidated immediately on
// any write to that tab, so multiple people using the app (or editing the
// sheet directly) never see data more than a moment stale.
const CACHE_MS = 15 * 1000;
const cache = new Map(); // tabName -> { data, expiresAt }

function invalidateTab(tabName) {
  cache.delete(tabName);
}

// Header text typed into a spreadsheet by hand picks up things nobody can
// see: a trailing space, a non-breaking space pasted from a doc, a double
// space between words. Every column lookup in this file is by header text,
// so one invisible character silently detached the app from that column —
// reads came back blank and writes went nowhere. Cleaned once on read so
// the rest of the app only ever sees tidy header names. Positions are
// untouched, so `headers` stays valid for writing by column index.
function cleanHeader(value) {
  return String(value ?? '')
    .replace(/[\u200b-\u200d\ufeff]/g, '') // zero width characters
    .replace(/[\u00a0\s]+/g, ' ') // non-breaking space and runs of whitespace
    .trim();
}

// Every header the app writes to by name. A sheet whose header differs
// only in casing ("Last emailed at") is mapped back to the spelling the
// code uses, so a cosmetic edit in Sheets cannot disconnect a column.
const KNOWN_HEADERS = [
  ...MEETING_ATTENDANCE_HEADERS,
  ...MEETING_HEADERS,
  ...CORE_APPLICANT_FIELDS,
  ...EMAIL_LOG_HEADERS,
  'CMS ID',
  'From Status',
  'To Status',
  'Changed By',
  'Timestamp',
];
const CANONICAL_HEADERS = new Map(KNOWN_HEADERS.map((h) => [h.toLowerCase(), h]));

export function canonicalHeader(value) {
  const cleaned = cleanHeader(value);
  return CANONICAL_HEADERS.get(cleaned.toLowerCase()) ?? cleaned;
}

// Locates a column by header text. Exact match first, then a tolerant
// match, so a lookup still succeeds against a sheet this app did not
// create. Returns -1 when the column genuinely is not there — callers
// must treat that as an error, never as "nothing to write".
export function findColumnIndex(headers, fieldName) {
  const exact = headers.indexOf(fieldName);
  if (exact !== -1) return exact;
  const wanted = cleanHeader(fieldName).toLowerCase();
  return headers.findIndex((h) => cleanHeader(h).toLowerCase() === wanted);
}

function columnLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// Reads a tab into { headers, records }. Each record is a plain object
// keyed by header text, plus a hidden _row field (the 1-indexed sheet row
// number) used by write operations to target the right row.
export async function readSheet(tabName, range = 'A:ZZ', options = {}) {
  if (!options.fresh) {
    const cached = cache.get(tabName);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!${range}`,
  });

  const rows = res.data.values || [];
  // Cleaned in place, so both the records below and every caller that
  // writes by header name see the tidy spelling. Column order is
  // preserved, which is what writes actually key off.
  const headers = (rows[0] || []).map(canonicalHeader);
  const records = rows.slice(1).map((row, i) => {
    const record = { _row: i + 2 }; // +2: header row is row 1, data starts at row 2
    headers.forEach((h, colIdx) => {
      record[h] = row[colIdx] ?? '';
    });
    return record;
  });

  const data = { headers, records };
  cache.set(tabName, { data, expiresAt: Date.now() + CACHE_MS });
  return data;
}

// Appends a new row at the bottom of a tab. `headers` determines column
// order — pass the tab's actual current headers (from readSheet) rather
// than an assumed order, so this stays correct even if columns get
// reordered by hand in Sheets.
export async function appendRow(tabName, headers, rowObject) {
  const sheets = getSheetsClient();
  const values = [headers.map((h) => rowObject[h] ?? '')];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  invalidateTab(tabName);
}

// Updates a single column's value on one existing row.
export async function updateField(tabName, rowNumber, headers, fieldName, value) {
  const colIndex = findColumnIndex(headers, fieldName);
  if (colIndex === -1) throw new Error(`Column "${fieldName}" not found in ${tabName}.`);
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!${columnLetter(colIndex)}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
  invalidateTab(tabName);
}

// Overwrites every column of one row in a single call, used when several
// fields change at once (e.g. editing a roster member). Callers should
// build `rowObject` by merging their changes onto the record's existing
// values (readSheet gives you those) so columns they did not touch keep
// their current value instead of being blanked out.
export async function updateRow(tabName, rowNumber, headers, rowObject) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers.map((h) => rowObject[h] ?? '')] },
  });
  invalidateTab(tabName);
}

// Deletes one row outright. Used only where the app's philosophy has a
// confirmed exception to add-and-edit-never-delete (Announcements).
export async function deleteRow(tabName, rowNumber) {
  const sheets = getSheetsClient();
  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(sheetId,title))',
  });
  const sheetProps = sheetMeta.data.sheets.find((s) => s.properties.title === tabName);
  if (!sheetProps) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: sheetProps.properties.sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    },
  });
  invalidateTab(tabName);
}

// Updates one or more named fields across many existing rows in a single
// batch call. Used by the recruitment bulk email send to stamp Last
// Emailed At (and optionally Status) on every recipient at once, instead
// of one API call per row.
export async function batchUpdateFields(tabName, headers, updates) {
  // updates: [{ row, fields: { 'Column Name': value, ... } }]
  const data = [];
  const missing = new Set();
  for (const { row, fields } of updates) {
    for (const [fieldName, value] of Object.entries(fields)) {
      const colIndex = findColumnIndex(headers, fieldName);
      // Skipping a missing column silently is what made the recruitment
      // bulk send look like it worked while never stamping Last Emailed
      // At: no writes were produced, the empty batch returned early, and
      // the route reported success. updateField() has always thrown here;
      // this is the same contract, applied to the batch path.
      if (colIndex === -1) {
        missing.add(fieldName);
        continue;
      }
      data.push({ range: `${tabName}!${columnLetter(colIndex)}${row}`, values: [[value]] });
    }
  }
  if (missing.size > 0) {
    const names = [...missing].map((n) => `"${n}"`).join(', ');
    throw new Error(
      `Column ${names} not found in ${tabName}. Add ${missing.size > 1 ? 'those columns' : 'that column'} as a header in the ${tabName} tab.`
    );
  }
  if (data.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { data, valueInputOption: 'USER_ENTERED' },
  });
  invalidateTab(tabName);
}

// Appends many rows to a tab in a single batch call. Used for the bulk
// Absent-row write when a meeting is created.
export async function appendRows(tabName, headers, rowObjects) {
  if (rowObjects.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rowObjects.map((obj) => headers.map((h) => obj[h] ?? '')) },
  });
  invalidateTab(tabName);
}

// Attendance rows are pre-created as Absent the moment a meeting is
// created, so marking someone (manually or via QR check in) is a
// find-and-edit of their existing (Meeting ID, CMS ID) row, not an
// append. Falls back to appending if a matching row genuinely doesn't
// exist yet (e.g. someone added to the roster after the meeting was
// created), so the sheet stays self-healing rather than erroring out.
export async function upsertMeetingAttendance(records) {
  const headers = MEETING_ATTENDANCE_HEADERS;

  // Bypass the cache here: an up-to-15s-stale view of "what already
  // exists" is exactly what would make a race more likely, not less.
  const { records: existing } = await readSheet(TABS.attendance, 'A:ZZ', { fresh: true });
  const sheets = getSheetsClient();

  const updates = [];
  const appends = [];

  for (const rec of records) {
    const match = existing.find(
      (e) => e['Meeting ID'] === rec['Meeting ID'] && e['CMS ID'] === rec['CMS ID']
    );
    if (match) {
      updates.push({ row: match._row, rec });
    } else {
      appends.push(rec);
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        data: updates.map(({ row, rec }) => ({
          range: `${TABS.attendance}!A${row}`,
          values: [headers.map((h) => rec[h] ?? '')],
        })),
        valueInputOption: 'USER_ENTERED',
      },
    });
  }

  if (appends.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TABS.attendance}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: appends.map((rec) => headers.map((h) => rec[h] ?? '')) },
    });
  }

  invalidateTab(TABS.attendance);
}
