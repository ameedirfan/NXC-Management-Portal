// Portfolio names are typed by humans in a few different places (the
// Roster form, the external recruitment Google Form that fills the
// Applicants tab, hand edits directly in Sheets), so "Logistics",
// "logistics", and "LOGISTICS " have all shown up as three different
// values to the app. Every comparison and every grouping should treat
// those as the same portfolio; every new write should snap to whichever
// spelling already exists, so drift does not compound.

export function normalizePortfolio(value) {
  return (value || '').trim().toLowerCase();
}

// Given a freshly typed value and the list of portfolios that already
// exist, returns the existing canonical spelling if one matches case
// insensitively, or the trimmed input as is if this is a genuinely new
// portfolio.
export function canonicalPortfolioName(value, knownPortfolios) {
  const norm = normalizePortfolio(value);
  const match = knownPortfolios.find((p) => normalizePortfolio(p) === norm);
  return match || (value || '').trim();
}

// De-duplicates a list of portfolio names case insensitively, keeping the
// first spelling encountered as canonical. Used anywhere a dropdown or a
// dashboard grouping needs one entry per real portfolio.
export function dedupePortfolios(values) {
  const seen = new Map(); // normalized -> canonical spelling
  for (const v of values) {
    if (!v) continue;
    const norm = normalizePortfolio(v);
    if (!seen.has(norm)) seen.set(norm, v.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
