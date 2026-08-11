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

export const MEETING_HEADERS = ['Meeting ID', 'Date', 'Scope', 'Portfolio', 'Created By', 'Status'];

// The Applicants tab can have any number of extra columns beyond these
// core ones (interview questions, ratings, whatever a club adds) — those
// extra columns get surfaced automatically on the applicant page. This
// list is just what the app treats as "core" fields with dedicated UI.
export const CORE_APPLICANT_FIELDS = [
  'CMS ID',
  'Full Name',
  'Contact No.',
  'Email Address',
  'Portfolio',
  '1st Preference',
  '2nd Preference',
  'Batch',
  'Department',
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
  const headers = rows[0] || [];
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
  const colIndex = headers.indexOf(fieldName);
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
