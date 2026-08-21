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
//
// Touch has no equivalent of "hover" — a finger only exists to the
// browser while it's making contact, there's nothing to track between
// touches the way a mouse can drift over the page unclicked. So the
// mobile version follows the finger only while it's actually touching
// (touchstart/touchmove), and fades out on lift, instead of trying to
// fake a persistent idle glow that has no real input to follow.
export default function PortalCursorSpotlight() {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    function moveTo(x, y) {
      el.style.setProperty('--portal-spot-x', `${x}px`);
      el.style.setProperty('--portal-spot-y', `${y}px`);
      el.style.setProperty('--portal-spot-opacity', '1');
    }
    function fadeOut() {
      el.style.setProperty('--portal-spot-opacity', '0');
    }

    function handleMouseMove(e) {
      moveTo(e.clientX, e.clientY);
    }
    function handleTouchMove(e) {
      const t = e.touches[0];
      if (t) moveTo(t.clientX, t.clientY);
    }
    function handleTouchStart(e) {
      const t = e.touches[0];
      if (t) moveTo(t.clientX, t.clientY);
    }

    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', fadeOut);
    // passive: true — this never calls preventDefault, so it can't
    // block or jank scrolling/gestures.
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', fadeOut, { passive: true });
    window.addEventListener('touchcancel', fadeOut, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', fadeOut);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', fadeOut);
      window.removeEventListener('touchcancel', fadeOut);
    };
  }, [reduced]);

  if (reduced) return null;
  return <div ref={ref} aria-hidden="true" className="nxc-portal-spotlight" />;
}
