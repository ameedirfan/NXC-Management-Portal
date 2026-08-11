'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import ToastHost from '@/components/ui/ToastHost';

// Everything global and interactive for a signed-in page lives here, one
// level below the server layout (which owns the session check). Also
// where the Command Palette, FAB, and dark mode toggle mount later.
export default function PortalChrome({ session, children }) {
  const pathname = usePathname();
  // Checked client-side only (matches server's false on first paint, then
  // updates), so NavBar knows whether to wrap navigation in the native
  // View Transitions API or leave Links alone for the CSS fallback below.
  const [supportsViewTransitions, setSupportsViewTransitions] = useState(false);

  useEffect(() => {
    setSupportsViewTransitions(typeof document !== 'undefined' && typeof document.startViewTransition === 'function');
  }, []);

  return (
    <div className="min-h-screen bg-brand-50">
      <NavBar session={session} supportsViewTransitions={supportsViewTransitions} />
      <main
        key={supportsViewTransitions ? undefined : pathname}
        className={`print-area mx-auto max-w-5xl px-4 py-8 ${supportsViewTransitions ? '' : 'nxc-page-in'}`}
      >
        {children}
      </main>
      <ToastHost />
    </div>
  );
}
