// Every new-feature tab (Meetings, Contacts, Finance, Announcements,
// Trips) has to be created by hand in the Google Sheet before its API
// routes work. Until that happens, readSheet's underlying Google API
// call throws "Unable to parse range: TabName!A:ZZ", which is otherwise
// an opaque 500 with no body the client can show. This turns that into
// a message that says exactly what's missing, instead of routes just
// crashing and pages silently rendering an empty list with no way to
// tell "genuinely empty" apart from "couldn't load".

export function friendlyReadError(err) {
  const msg = err?.message || '';
  const match = msg.match(/Unable to parse range:\s*([^!]+)!/);
  if (match) {
    return `The "${match[1]}" tab wasn't found in the Google Sheet (or has no header row). Add it, with the expected column headers in row 1, then try again.`;
  }
  return msg || 'Something went wrong reading the sheet.';
}
