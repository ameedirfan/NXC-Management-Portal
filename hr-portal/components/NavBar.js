'use client';

import Logo from '@/components/Logo';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardList,
  UserPlus,
  Users,
  Phone,
  Megaphone,
  MapPinned,
  LayoutDashboard,
  Wallet,
  Command,
} from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import DockNav from '@/components/DockNav';

// One outline icon per tab, never mixed styles. Exported so the Command
// Palette can render the same icons for the same destinations.
export const NAV_ICONS = {
  '/attendance': ClipboardList,
  '/recruitment': UserPlus,
  '/roster': Users,
  '/contacts': Phone,
  '/announcements': Megaphone,
  '/trips': MapPinned,
  '/dashboard': LayoutDashboard,
  '/finance': Wallet,
};

// Fixed tab order, left to right, for every role that has more than one
// tab: Announcements, Roster, Attendance, Recruitment, Dashboard, Trip
// Itineraries, Finance, Contact Us. Each role's list below is that same
// order with whatever tabs it doesn't have filtered out, not a
// separately maintained order per role.
//
// Members' only attendance action is scanning a meeting's QR code (self
// check in), the Attendance tab still shows for them so the nav is not
// empty, the page itself explains what to do.
const MEMBER_TABS = [
  { href: '/announcements', label: 'Announcements' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/trips', label: 'Trip Itineraries' },
  { href: '/contacts', label: 'Contact Us' },
];

const MANAGER_TABS = [
  { href: '/announcements', label: 'Announcements' },
  { href: '/roster', label: 'Roster' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/recruitment', label: 'Recruitment' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trips', label: 'Trip Itineraries' },
  { href: '/contacts', label: 'Contact Us' },
];

// Finance is admin only, the one nav item managers don't get, inserted
// in its place in the fixed order rather than appended at the end.
const ADMIN_TABS = [
  { href: '/announcements', label: 'Announcements' },
  { href: '/roster', label: 'Roster' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/recruitment', label: 'Recruitment' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trips', label: 'Trip Itineraries' },
  { href: '/finance', label: 'Finance' },
  { href: '/contacts', label: 'Contact Us' },
];

export function tabsForRole(role) {
  if (role === 'admin') return ADMIN_TABS;
  if (role === 'manager') return MANAGER_TABS;
  return MEMBER_TABS;
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return null;
}

export default function NavBar({ session, supportsViewTransitions = false, onOpenPalette }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = tabsForRole(session.role);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  // Progressive enhancement: plain Link navigation always works. Where
  // the browser supports it, wrap the same navigation in the native View
  // Transitions API for a soft crossfade instead of a hard cut. Left
  // untouched (mid-click, new-tab, etc. all fall through to the default
  // <a> behavior) if a modifier key or non-primary button is used.
  function handleNavClick(e, href) {
    if (!supportsViewTransitions) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    document.startViewTransition(() => router.push(href));
  }

  return (
    <header className="no-print border-b border-brand-200 bg-brand-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <p className="font-serif text-lg font-bold leading-tight text-brand-900">NXC Portal</p>
            <p className="text-xs uppercase tracking-wide text-brand-700">Management Portal</p>
            <p className="text-xs font-medium text-brand-700">Portal made by Ameed Irfan</p>
          </div>
        </div>

        <DockNav tabs={tabs} navIcons={NAV_ICONS} pathname={pathname} onNavClick={handleNavClick} />

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPalette}
            title="Search (Ctrl+K)"
            aria-label="Open command palette"
            className="flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Command size={16} aria-hidden="true" />K
          </button>
          <ThemeToggle />
          <p className="text-sm text-brand-700">
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
