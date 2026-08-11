// Shared attendance percentage math for the Dashboard (3 views) and the
// Roster at a glance strip, so both compute the exact same numbers the
// exact same way.

export function round(n) {
  return Math.round(n * 10) / 10;
}

// Percentage rule, confirmed final: Present / (Present + Absent). Leave
// is a ghost entry, excluded from both the numerator and the
// denominator, callers should already have filtered Leave rows out of
// `present`/`absent` counts before calling this.
export function percentage(present, absent) {
  const denom = present + absent;
  return denom ? round((present / denom) * 100) : 0;
}

// Joins Attendance rows to their Meeting for Date/Scope/Portfolio, and
// drops any row whose meeting is missing or Voided, same ghost entry
// mechanic as Leave, just applied at the whole meeting level.
export function joinAttendanceToMeetings(attendance, meetings) {
  const meetingById = new Map(meetings.map((m) => [m['Meeting ID'], m]));
  const out = [];
  for (const a of attendance) {
    const meeting = meetingById.get(a['Meeting ID']);
    if (!meeting || meeting['Status'] === 'Voided') continue;
    out.push({
      cmsId: a['CMS ID'],
      fullName: a['Full Name'],
      status: a['Status'],
      meetingId: a['Meeting ID'],
      date: meeting['Date'],
      scope: meeting['Scope'],
      portfolio: meeting['Portfolio'],
    });
  }
  return out;
}
