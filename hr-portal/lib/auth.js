import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'nxc_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set in your environment variables.');
  }
  return secret;
}

function sign(body) {
  return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
}

// Session payload shape: { username, fullName, cmsId, portfolio, role }
export function createSessionToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = sign(body);
  return `${body}.${sig}`;
}

export async function setSessionCookie(payload) {
  const token = createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  let expectedSig;
  try {
    expectedSig = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - payload.iat > MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
