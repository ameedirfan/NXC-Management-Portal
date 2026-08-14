import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/authz';
import { getOAuth2Client, GMAIL_SEND_SCOPE } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

// One-time setup route: admin only, run manually, once, signed in as the
// NXC society Gmail account when Google's consent screen appears (not
// whatever Google account happens to be logged into the browser). See
// README section 5 for the full walkthrough.
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const redirectUri = new URL('/api/gmail-auth/callback', request.url).toString();

  let authUrl;
  try {
    const oauth2Client = getOAuth2Client(redirectUri);
    authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // forces Google to hand back a refresh_token even on a repeat run
      scope: [GMAIL_SEND_SCOPE],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.redirect(authUrl);
}
