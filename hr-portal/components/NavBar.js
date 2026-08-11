'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Members' only attendance action is scanning a meeting's QR code (self
// check in), the Attendance tab still shows for them so the nav is not
// empty, the page itself explains what to do.
const MEMBER_TABS = [
  { href: '/attendance', label: 'Attendance' },
  { href: '/contacts', label: 'Contact Us' },
  { href: '/announcements', label: 'Announcements' },
];

const MANAGER_TABS = [
  { href: '/attendance', label: 'Attendance' },
  { href: '/recruitment', label: 'Recruitment' },
  { href: '/roster', label: 'Roster' },
  { href: '/contacts', label: 'Contact Us' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/dashboard', label: 'Dashboard' },
];

// Finance is admin only, the one nav item managers don't get.
const ADMIN_TABS = [...MANAGER_TABS, { href: '/finance', label: 'Finance' }];

function tabsForRole(role) {
  if (role === 'admin') return ADMIN_TABS;
  if (role === 'manager') return MANAGER_TABS;
  return MEMBER_TABS;
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return null;
}

export default function NavBar({ session }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = tabsForRole(session.role);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="no-print border-b border-brand-200 bg-brand-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="NXC" width={40} height={40} className="h-10 w-10 object-contain" />
          <div>
            <p className="font-serif text-lg font-bold leading-tight text-brand-900">NXC Portal</p>
            <p className="text-xs uppercase tracking-wide text-brand-500">Management Portal</p>
            <p className="text-xs font-medium text-brand-600">Portal made by Ameed Irfan</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                pathname?.startsWith(t.href)
                  ? 'bg-brand-900 text-brand-50'
                  : 'text-brand-700 hover:bg-brand-100'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <p className="text-sm text-brand-600">
            {session.fullName || session.username} · {roleLabel(session.role) || session.portfolio}
          </p>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
