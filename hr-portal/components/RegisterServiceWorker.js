'use client';

import { useEffect } from 'react';

// Registers the service worker that lets the portal be added to the home
// screen and open full screen without a browser error if opened with no
// signal. It only caches the static app shell (see public/sw.js), every
// page still needs a live connection to actually load data from Sheets,
// this just avoids a blank screen on the way there.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal, the app works fine without an installed service
      // worker, this only affects the works offline for the shell nicety.
    });
  }, []);

  return null;
}
