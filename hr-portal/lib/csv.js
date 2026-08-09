// Small, dependency free CSV export and import used by the Attendance,
// Recruitment, Roster, and Dashboard pages. No library needed for CSV,
// it is just text.
//
// PDF export (see the Dashboard page) deliberately uses the browser's
// native print to PDF instead of a PDF library, for the same reason: it
// works everywhere with zero added dependencies and nothing to keep
// updated.

// Guards against CSV/formula injection: a cell starting with =, +, -, or @
// is interpreted as a formula by Excel/Sheets when the file is opened, so
// a malicious applicant name like "=cmd|'/c calc'!A1" could execute code
// on whoever opens the export. Prefixing with a tab neutralizes it while
// staying invisible in normal viewing.
function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(str) ? `\t${str}` : str;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toCSV(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  // Leading BOM so Excel opens UTF-8 CSVs (names with accents, etc.) correctly.
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Parses CSV text into an array of row objects keyed by the header row.
// Handles quoted fields (commas and newlines inside quotes, escaped "" for
// a literal quote) since that is what Excel and Sheets produce on export.
// Strips a leading UTF-8 BOM if present (toCSV above writes one).
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((c) => c !== '')) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}
