import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import NavBar from '@/components/NavBar';

export default function PortalLayout({ children }) {
  const session = getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-brand-50">
      <NavBar session={session} />
      <main className="print-area mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
