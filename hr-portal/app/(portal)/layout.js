import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PortalChrome from '@/components/PortalChrome';

export default function PortalLayout({ children }) {
  const session = getSession();
  if (!session) redirect('/login');

  return <PortalChrome session={session}>{children}</PortalChrome>;
}
