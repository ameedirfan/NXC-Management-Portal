// Credential normalisation, shared by the login route and the Data
// quality check so both agree on what counts as "the same username" and
// what a stored password is supposed to look like.
//
// Why this exists: every way a sign in can go wrong produces the same
// "Invalid username or password." message, which made a handful of very
// different problems look like one random bug. The ones actually seen:
// a username or password pasted out of WhatsApp with a trailing space or
// non-breaking space, a mobile keyboard adding a space after autocorrect,
// and stray whitespace typed into the Logins sheet by hand. None of those
// are the person getting their password wrong.

// Invisible characters that survive a copy/paste but nobody types on
// purpose: zero width space/non-joiner/joiner, and the byte order mark.
// Ordinary spaces, tabs and newlines are already handled by trim(), which
// also covers U+00A0 (the non-breaking space chat apps love to insert).
const INVISIBLE = /[\u200b-\u200d\ufeff]/g;

// Case insensitive, whitespace insensitive form used for every username
// comparison. Sign in already lowercased; it never trimmed, so a single
// leading space meant "no such user".
export function normalizeUsername(value) {
  return String(value ?? '')
    .replace(INVISIBLE, '')
    .trim()
    .toLowerCase();
}

// Passwords are deliberately handled more conservatively than usernames:
// what the person typed is always tried first and exactly as typed, so an
// account whose password genuinely ends in a space keeps working. Only if
// that fails do we retry without the surrounding invisibles. Returns one
// entry in the common case, so this costs nothing extra for a clean sign in.
export function passwordCandidates(value) {
  const raw = String(value ?? '');
  const cleaned = raw.replace(INVISIBLE, '').trim();
  return cleaned === raw ? [raw] : [raw, cleaned];
}

// A bcrypt hash as produced by bcryptjs: $2<variant>$<cost>$<22 char salt +
// 31 char digest>. Anything else in the Password column can never match —
// a password saved as plain text by hand, a hash truncated on paste, or one
// with a stray space — and the person is locked out permanently rather than
// intermittently.
const BCRYPT_HASH = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptHash(value) {
  return BCRYPT_HASH.test(String(value ?? ''));
}
