'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';

// Tier 3 — soft radial glow that follows the cursor. Confined to dark
// chrome zones (Dashboard header, hero) by whichever parent renders it
// with `position: relative; overflow: hidden`. Decorative only:
// aria-hidden, and the mousemove listener is never attached at all
// under reduced motion (not just visually suppressed — no listener, no
// per-frame style writes).
export default function CursorSpotlight() {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    function handleMove(e) {
      const rect = parent.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
      el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
      el.style.setProperty('--spot-opacity', '1');
    }
    function handleLeave() {
      el.style.setProperty('--spot-opacity', '0');
    }

    parent.addEventListener('mousemove', handleMove);
    parent.addEventListener('mouseleave', handleLeave);
    return () => {
      parent.removeEventListener('mousemove', handleMove);
      parent.removeEventListener('mouseleave', handleLeave);
    };
  }, [reduced]);

  if (reduced) return null;
  return <div ref={ref} aria-hidden="true" className="nxc-spotlight" />;
}
