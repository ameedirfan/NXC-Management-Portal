import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PortalChrome from '@/components/PortalChrome';

export default async function PortalLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return <PortalChrome session={session}>{children}</PortalChrome>;
}
