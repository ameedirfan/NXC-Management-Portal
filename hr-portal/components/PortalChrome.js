'use client';

import NavBar from '@/components/NavBar';
import ToastHost from '@/components/ui/ToastHost';

// Everything global and interactive for a signed-in page lives here, one
// level below the server layout (which owns the session check). Also
// where the Command Palette, FAB, and dark mode toggle mount later.
export default function PortalChrome({ session, children }) {
  return (
    <div className="min-h-screen bg-brand-50">
      <NavBar session={session} />
      <main className="print-area mx-auto max-w-5xl px-4 py-8">{children}</main>
      <ToastHost />
    </div>
  );
}
