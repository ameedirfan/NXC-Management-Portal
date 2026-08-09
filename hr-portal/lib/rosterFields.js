// Maps the roster form's field names to the Roster tab's exact column
// headers. Shared by every route that reads or writes roster rows (add,
// edit, bulk import) so there is one place to update if a field is ever
// renamed.

export const ROSTER_FIELD_MAP = {
  wing: 'Wing',
  portfolio: 'Portfolio',
  designation: 'Designation',
  fullName: 'Full Name',
  gender: 'Gender',
  contactNo: 'Contact No.',
  email: 'Email Address',
  cmsId: 'CMS ID',
  batch: 'Batch',
  department: 'Department',
  residentialStatus: 'Residential Status',
  hostel: 'Hostel',
};

export function toRosterRecord(body) {
  const out = {};
  for (const [key, header] of Object.entries(ROSTER_FIELD_MAP)) {
    if (body[key] !== undefined) out[header] = String(body[key]).trim();
  }
  return out;
}

export function toRosterMember(record) {
  const out = {};
  for (const [key, header] of Object.entries(ROSTER_FIELD_MAP)) {
    out[key] = record[header] ?? '';
  }
  return out;
}
