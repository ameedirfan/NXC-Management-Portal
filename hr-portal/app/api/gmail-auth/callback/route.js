import { NextResponse } from 'next/server';
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

  // Deliberately does not call gmail.users.getProfile to "verify" the
  // account: that call needs a broader scope than gmail.send alone, and
  // requesting it just for a cosmetic check isn't worth widening what
  // this app can do with your Gmail account. The account you just
  // authorized as, on Google's own consent screen, is the account this
  // token sends as — no further check needed.
  return htmlPage(`
    <h1 class="ok">Gmail authorization succeeded</h1>
    <p class="warn">Double check you signed into Google's consent screen just now as the NXC society Gmail account, not a personal one — that's the account this token will send as, from now on, silently.</p>
    <h2>Refresh token (shown once, copy it now)</h2>
    <pre>${tokens.refresh_token}</pre>
    <p>Add this as <code>GOOGLE_GMAIL_REFRESH_TOKEN</code> in Vercel's environment variables (and <code>.env.local</code> for local dev). It is not stored anywhere by the app itself, this page is the only place it's shown.</p>
    <p>This page cannot be reloaded to show the token again, if you lose it, just run <code>/api/gmail-auth/start</code> again.</p>
  `);
}
