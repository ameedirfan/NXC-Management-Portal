import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isManagerOrAdmin } from '@/lib/authz';
import { readSheet, TABS } from '@/lib/sheets';
import { sendGmailMessage } from '@/lib/gmail';
import { renderAnnouncementHtml } from '@/lib/markdown';
import { friendlyReadError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// Sends the drafted email to the signed-in admin/manager's own address,
// so Gmail sending can be verified before it ever touches a real
// applicant. Deliberately does not write to the Email Log or stamp
// anyone's Last Emailed At, it isn't a real send, see spec section 4.3
// and 8.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: 'Manager or Admin access required.' }, { status: 403 });
  }

  const { subject, body } = await request.json();
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Subject and body are both required.' }, { status: 400 });
  }

  let roster;
  try {
    ({ records: roster } = await readSheet(TABS.roster));
  } catch (err) {
    return NextResponse.json({ error: friendlyReadError(err) }, { status: 500 });
  }

  const me = roster.find((r) => r['CMS ID'] === session.cmsId);
  const myEmail = me?.['Email Address'];
  if (!myEmail) {
    return NextResponse.json(
      {
        error:
          'No email on file for your account on the Roster. Ask an admin to add one there before test-sending.',
      },
      { status: 400 }
    );
  }

  try {
    await sendGmailMessage({
      to: myEmail,
      subject: `[Test] ${subject}`,
      html: renderAnnouncementHtml(body),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not send the test email.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: myEmail });
}
