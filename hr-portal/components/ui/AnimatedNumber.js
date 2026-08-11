'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 700;

// Counts from whatever it last displayed up to `value` (so this covers
// both the "count up from 0 on page load" case and later re-fetches
// animating from the old figure to the new one). Respects
// prefers-reduced-motion by jumping straight to the final value.
export default function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString() }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    const numericValue = Number(value) || 0;
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplay(numericValue);
      prevValue.current = numericValue;
      hasMounted.current = true;
      return;
    }

    const start = hasMounted.current ? prevValue.current : 0;
    const delta = numericValue - start;
    let raf;
    let startTime;

    function step(t) {
      if (!startTime) startTime = t;
      const progress = Math.min(1, (t - startTime) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + delta * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevValue.current = numericValue;
        hasMounted.current = true;
      }
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="tabular-nums">{format(display)}</span>;
}
