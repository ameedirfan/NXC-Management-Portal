'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import ToastHost from '@/components/ui/ToastHost';
import CommandPalette from '@/components/CommandPalette';
import { FabProvider } from '@/components/FabProvider';
import Fab from '@/components/ui/Fab';

// Everything global and interactive for a signed-in page lives here, one
// level below the server layout (which owns the session check).
export default function PortalChrome({ session, children }) {
  const pathname = usePathname();
  // Checked client-side only (matches server's false on first paint, then
  // updates), so NavBar knows whether to wrap navigation in the native
  // View Transitions API or leave Links alone for the CSS fallback below.
  const [supportsViewTransitions, setSupportsViewTransitions] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setSupportsViewTransitions(typeof document !== 'undefined' && typeof document.startViewTransition === 'function');
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <FabProvider>
      <div className="min-h-screen bg-brand-50">
        <NavBar
          session={session}
          supportsViewTransitions={supportsViewTransitions}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main
          key={supportsViewTransitions ? undefined : pathname}
          className={`print-area mx-auto max-w-5xl px-4 py-8 ${supportsViewTransitions ? '' : 'nxc-page-in'}`}
        >
          {children}
        </main>
        <ToastHost />
        <Fab />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          role={session.role}
          supportsViewTransitions={supportsViewTransitions}
        />
      </div>
    </FabProvider>
  );
}
