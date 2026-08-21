'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';

// Tier 3 — the cursor glow extended portal-wide (not just the dark
// ChromeHeader zones), per Ameed's explicit "regardless of any rule,
// what looks better" call. Tuned way down from the header version:
// this sits behind everything (-z-10, same layer as AmbientBackground)
// so it can only ever brighten the ambient wash back there, never sit
// over text or reduce contrast on the light page body. No listener at
// all under reduced motion.
export default function PortalCursorSpotlight() {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    function handleMove(e) {
      el.style.setProperty('--portal-spot-x', `${e.clientX}px`);
      el.style.setProperty('--portal-spot-y', `${e.clientY}px`);
      el.style.setProperty('--portal-spot-opacity', '1');
    }
    function handleLeave() {
      el.style.setProperty('--portal-spot-opacity', '0');
    }

    window.addEventListener('mousemove', handleMove);
    document.documentElement.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.documentElement.removeEventListener('mouseleave', handleLeave);
    };
  }, [reduced]);

  if (reduced) return null;
  return <div ref={ref} aria-hidden="true" className="nxc-portal-spotlight" />;
}
