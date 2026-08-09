import crypto from 'crypto';

// Short lived signed tokens for QR meeting check in, same HMAC signed,
// base64url encoded approach as lib/auth.js's session tokens (reuses
// SESSION_SECRET, no new env var needed), but with a much shorter expiry:
// a check in code is only meant to be valid for the meeting it was
// generated for, not for a week.

const CHECKIN_TOKEN_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set in your environment variables.');
  }
  return secret;
}

export function createCheckinToken({ portfolio, date }) {
  const body = Buffer.from(JSON.stringify({ portfolio, date, iat: Date.now() })).toString(
    'base64url'
  );
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// Returns { portfolio, date, iat } if the token is validly signed and not
// expired, or null otherwise (tampered, malformed, or past its 30 minutes).
export function verifyCheckinToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expectedSig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - payload.iat > CHECKIN_TOKEN_MAX_AGE_MS) return null;
    if (!payload.portfolio || !payload.date) return null;
    return payload;
  } catch {
    return null;
  }
}

export const CHECKIN_TOKEN_MAX_AGE_SECONDS = CHECKIN_TOKEN_MAX_AGE_MS / 1000;
