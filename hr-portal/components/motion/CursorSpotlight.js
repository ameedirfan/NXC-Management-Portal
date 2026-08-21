'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';

// Tier 3 — soft radial glow that follows the cursor. Confined to dark
// chrome zones (Dashboard header, hero) by whichever parent renders it
// with `position: relative; overflow: hidden`. Decorative only:
// aria-hidden, and the mousemove listener is never attached at all
// under reduced motion (not just visually suppressed — no listener, no
// per-frame style writes).
//
// Also follows touch while a finger is actually in contact with this
// zone — touch has no "hover" to fake, a finger only exists to the
// browser while touching, so this fades out on lift rather than
// pretending to track something that isn't there between touches.
export default function CursorSpotlight() {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    function moveTo(clientX, clientY) {
      const rect = parent.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${clientX - rect.left}px`);
      el.style.setProperty('--spot-y', `${clientY - rect.top}px`);
      el.style.setProperty('--spot-opacity', '1');
    }
    function fadeOut() {
      el.style.setProperty('--spot-opacity', '0');
    }

    function handleMouseMove(e) {
      moveTo(e.clientX, e.clientY);
    }
    function handleTouch(e) {
      const t = e.touches[0];
      if (t) moveTo(t.clientX, t.clientY);
    }

    parent.addEventListener('mousemove', handleMouseMove);
    parent.addEventListener('mouseleave', fadeOut);
    parent.addEventListener('touchstart', handleTouch, { passive: true });
    parent.addEventListener('touchmove', handleTouch, { passive: true });
    parent.addEventListener('touchend', fadeOut, { passive: true });
    parent.addEventListener('touchcancel', fadeOut, { passive: true });
    return () => {
      parent.removeEventListener('mousemove', handleMouseMove);
      parent.removeEventListener('mouseleave', fadeOut);
      parent.removeEventListener('touchstart', handleTouch);
      parent.removeEventListener('touchmove', handleTouch);
      parent.removeEventListener('touchend', fadeOut);
      parent.removeEventListener('touchcancel', fadeOut);
    };
  }, [reduced]);

  if (reduced) return null;
  return <div ref={ref} aria-hidden="true" className="nxc-spotlight" />;
}
