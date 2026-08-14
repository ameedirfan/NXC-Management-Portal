import { google } from 'googleapis';

// Gmail send goes out as the real NXC society account, not the service
// account used for Sheets/Drive. A service account can't send mail as a
// personal Gmail address, so this uses a separate OAuth2 client + a
// refresh token obtained once via the one-time consent flow in
// app/api/gmail-auth (see the "Recruitment bulk email" section in
// README.md). That refresh token is stored as an env var, same treatment
// as every other credential this app uses, not written to the sheet.

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export function getOAuth2Client(redirectUri) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set in your environment variables.');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Builds an authenticated Gmail client using the stored refresh token.
// Throws with a clear message if the one-time setup hasn't been done yet,
// rather than failing deep inside a send call.
export function getGmailClient() {
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      'GOOGLE_GMAIL_REFRESH_TOKEN is not set. Run the one-time Gmail setup at /api/gmail-auth/start (admin only) first.'
    );
  }
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Confirms the stored refresh token still works and returns the address
// it's actually authorized to send as, so setup can be verified without
// sending a real email.
export async function getGmailProfile() {
  const gmail = getGmailClient();
  const res = await gmail.users.getProfile({ userId: 'me' });
  return res.data.emailAddress;
}

function encodeSubject(subject) {
  // RFC 2047 encoded-word, so a subject with non-ASCII characters (an
  // applicant's name, an emoji, whatever) survives the raw MIME message
  // intact instead of getting mangled.
  return `=?UTF-8?B?${Buffer.from(subject || '').toString('base64')}?=`;
}

function buildRawMessage({ to, bcc, subject, html }) {
  const headers = [
    `To: ${to}`,
    bcc && bcc.length ? `Bcc: ${bcc.join(', ')}` : null,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
  ]
    .filter(Boolean)
    .join('\r\n');
  const message = `${headers}\r\n\r\n${html}`;
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Sends one message. `to` is always a single, valid address (the test
// recipient, or the society's own address for a real BCC blast, see
// section 5.3 of the spec) — `bcc` carries the real recipient list for a
// bulk send, and is omitted entirely for a test send.
export async function sendGmailMessage({ to, bcc, subject, html }) {
  const gmail = getGmailClient();
  const raw = buildRawMessage({ to, bcc, subject, html });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data;
}
