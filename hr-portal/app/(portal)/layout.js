import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import PortalChrome from '@/components/PortalChrome';
import { WELCOME_COOKIE } from '@/lib/welcome';

export default async function PortalLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Decided here, on the server, rather than from sessionStorage on the
  // client: the overlay then ships in the initial HTML for people who
  // should see it, and is simply absent for people who already
  // continued this session — no flash of a welcome screen appearing and
  // then vanishing once React hydrates.
  const cookieStore = await cookies();
  const showWelcome = !cookieStore.get(WELCOME_COOKIE);

  return (
    <PortalChrome session={session} showWelcome={showWelcome}>
      {children}
    </PortalChrome>
  );
}
