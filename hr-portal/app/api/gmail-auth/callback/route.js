import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/authz';
import { getOAuth2Client } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

function htmlPage(bodyHtml) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Gmail setup</title>
    <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;line-height:1.5;color:#1a1a1a}
    code,pre{background:#f2f2f2;padding:2px 6px;border-radius:4px;word-break:break-all}
    pre{padding:12px;white-space:pre-wrap}h1{font-size:1.3rem}.warn{color:#a15c00}.ok{color:#0a7a2f}</style>
    </head><body>${bodyHtml}</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');

  if (oauthError) {
    return htmlPage(`<h1 class="warn">Google returned an error</h1><p><code>${oauthError}</code></p>
      <p>Common cause: the NXC Gmail account isn't listed as a test user yet on the OAuth consent screen. Add it, then try again from <code>/api/gmail-auth/start</code>.</p>`);
  }
  if (!code) {
    return htmlPage(`<h1 class="warn">Missing authorization code</h1><p>Start the flow from <code>/api/gmail-auth/start</code> instead of opening this URL directly.</p>`);
  }

  const redirectUri = new URL('/api/gmail-auth/callback', request.url).toString();

  let tokens;
  try {
    const oauth2Client = getOAuth2Client(redirectUri);
    ({ tokens } = await oauth2Client.getToken(code));
  } catch (err) {
    return htmlPage(`<h1 class="warn">Token exchange failed</h1><p>${err.message}</p>`);
  }

  if (!tokens.refresh_token) {
    return htmlPage(`<h1 class="warn">No refresh token returned</h1>
      <p>Google only issues a refresh token the first time an app is authorized (or when <code>prompt=consent</code> forces re-consent, which this flow already sets). This usually means a refresh token was already issued to this OAuth client for this account previously.</p>
      <p>Fix: go to <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a> while signed in as the NXC account, remove access for this app, then run <code>/api/gmail-auth/start</code> again.</p>`);
  }

  let emailAddress = null;
  let profileError = null;
  try {
    const oauth2Client = getOAuth2Client(redirectUri);
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.getProfile({ userId: 'me' });
    emailAddress = res.data.emailAddress;
  } catch (err) {
    profileError = err.message;
  }

  return htmlPage(`
    <h1 class="ok">Gmail authorization succeeded</h1>
    ${
      emailAddress
        ? `<p>Authorized to send as: <strong>${emailAddress}</strong></p>
           <p class="warn">Double check that's really the NXC society Gmail address, not a personal one you happened to be signed into when you clicked through consent.</p>`
        : `<p class="warn">Could not verify the account (${profileError}). The refresh token below was still issued — double check it's for the right account before using it.</p>`
    }
    <h2>Refresh token (shown once, copy it now)</h2>
    <pre>${tokens.refresh_token}</pre>
    <p>Add this as <code>GOOGLE_GMAIL_REFRESH_TOKEN</code> in <code>.env.local</code> (and later in Vercel's environment variables). It is not stored anywhere by the app itself, this page is the only place it's shown.</p>
    <p>This page cannot be reloaded to show the token again, if you lose it, just run <code>/api/gmail-auth/start</code> again.</p>
  `);
}
