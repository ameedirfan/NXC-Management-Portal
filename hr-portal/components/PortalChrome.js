'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import ToastHost from '@/components/ui/ToastHost';
import CommandPalette from '@/components/CommandPalette';
import { FabProvider } from '@/components/FabProvider';
import Fab from '@/components/ui/Fab';
import { RosterInfoProvider } from '@/components/RosterInfoProvider';
import AmbientBackground from '@/components/motion/AmbientBackground';
import PortalCursorSpotlight from '@/components/motion/PortalCursorSpotlight';
import WelcomeIntro from '@/components/WelcomeIntro';

// Everything global and interactive for a signed-in page lives here, one
// level below the server layout (which owns the session check).
export default function PortalChrome({ session, showWelcome = false, children }) {
  const pathname = usePathname();
  // Checked client-side only (matches server's false on first paint, then
  // updates), so NavBar knows whether to wrap navigation in the native
  // View Transitions API or leave Links alone for the CSS fallback below.
  const [supportsViewTransitions, setSupportsViewTransitions] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Every portal route is fully dynamic (this layout reads the session
  // cookie), so there's a real gap between clicking a nav link and the
  // destination rendering — this bar is the instant "your click
  // registered" signal for that gap; app/(portal)/loading.js covers the
  // next one. Cleared the moment the URL actually changes.
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setSupportsViewTransitions(typeof document !== 'undefined' && typeof document.startViewTransition === 'function');
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const anchor = e.target.closest('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      // Only same-app page navigations: skip hashes, external links, and
      // /api/* links (those are downloads — minute sheets, CSV — not page
      // navigations, and never update the pathname to clear the bar).
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('/api/')) return;
      if (href !== pathname) setNavigating(true);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pathname]);

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
      {/* Outside <main>'s remount boundary on purpose — <main> below gets a
          fresh `key` per pathname when View Transitions isn't supported,
          which would remount (and re-fetch) this provider on every single
          navigation, exactly the per-navigation refetch this exists to
          avoid. */}
      <RosterInfoProvider>
        {/* No bg-brand-50 here — <body> (layout.js) already supplies the
            page's base color as the true canvas background. Duplicating
            it on this wrapper would paint as a normal in-flow box, which
            sits ABOVE the ambient layer's negative z-index in the
            stacking order and hid it completely. */}
        <div className="min-h-screen">
          <AmbientBackground />
          <PortalCursorSpotlight />
          {navigating && <div className="nxc-progress-bar no-print" aria-hidden="true" />}
          <a href="#main-content" className="nxc-skip-link no-print">
            Skip to content
          </a>
          <NavBar
            session={session}
            supportsViewTransitions={supportsViewTransitions}
            onOpenPalette={() => setPaletteOpen(true)}
          />
          <main
            id="main-content"
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
            onNavigate={() => setNavigating(true)}
          />
        </div>
      </RosterInfoProvider>
    </FabProvider>
  );
}
