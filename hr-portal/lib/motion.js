'use client';

import { useEffect, useRef, useState } from 'react';

// Frequency-Aware Motion (UI system spec section 3) — the single shared
// utility every later stage imports from, instead of hand-rolling
// tier-specific animation per page.
//
//   Tier 1  — once per visit. Page load, route change, modal open,
//             success confirmation, QR generation. Full cinematic
//             treatment lives here: GSAP stagger/reveal, glow, bounce.
//   Tier 2  — repeated many times per session (marking attendance rows,
//             ticking a status, filtering a table). Fast, light,
//             CSS-only. Never GSAP — see section 8: Tier 2 must not
//             depend on GSAP at all, so it never waits on a JS
//             animation library to feel instant.
//   Tier 3  — continuous/ambient (cursor spotlight, drifting glow).
//             Chrome and margins only, aria-hidden, always disabled
//             under reduced motion.
//
// prefers-reduced-motion is enforced twice, deliberately: the wildcard
// `@media (prefers-reduced-motion: reduce)` block in globals.css already
// zeroes every CSS animation/transition duration site-wide, which is
// enough for Tier 2 and any CSS-keyframe Tier 1/3 effect. GSAP timelines
// and JS-driven effects (mousemove listeners) live outside CSS's reach,
// so those get an explicit check here too — belt and suspenders, not
// duplicated coverage.

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Matches the --ease-out CSS token (cubic-bezier(0.23, 1, 0.32, 1)) so
// GSAP timelines and CSS transitions read as the same motion system
// rather than two slightly-different curves. Registered once, lazily,
// only on the client (GSAP/CustomEase touch the DOM at import time).
let gsapReady = null;
export async function initGsap() {
  if (typeof window === 'undefined') return null;
  if (gsapReady) return gsapReady;

  gsapReady = (async () => {
    const [{ gsap }, { ScrollTrigger }, { CustomEase }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/CustomEase'),
    ]);
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    if (!CustomEase.get('nxcEaseOut')) {
      CustomEase.create('nxcEaseOut', '0.23, 1, 0.32, 1');
    }
    return { gsap, ScrollTrigger };
  })();

  return gsapReady;
}

// Tier 1 — once-per-visit entrance for a group of elements (stat cards,
// chart bars, a stagger-revealed list). Reduced motion jumps straight to
// the resting state — content is never hidden or half-transformed
// waiting on a library, per spec section 7's "survive its own dependency
// failing" requirement.
export function useTier1Reveal(containerRef, {
  selector = '[data-tier1]',
  y = 16,
  stagger = 0.06,
  duration = 0.6,
  delay = 0,
} = {}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targets = selector ? container.querySelectorAll(selector) : [container];
    if (!targets.length) return;

    if (reduced) {
      targets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    let cancelled = false;
    let ctx;
    initGsap().then((mod) => {
      if (cancelled || !mod) return;
      const { gsap } = mod;
      ctx = gsap.context(() => {
        gsap.fromTo(
          targets,
          { opacity: 0, y },
          { opacity: 1, y: 0, duration, stagger, delay, ease: 'nxcEaseOut' }
        );
      }, container);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
}

// Tier 1 — a one-off scale-bounce confirmation (QR generated, announcement
// sent). Call imperatively from an event handler, not on every render.
export async function playTier1Success(el) {
  if (!el || prefersReducedMotion()) return;
  const mod = await initGsap();
  if (!mod) return;
  mod.gsap.fromTo(
    el,
    { scale: 0.92, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.5, ease: 'nxcEaseOut' }
  );
}

// Tier 2 — instant colour swap + sub-150ms scale pulse for a single row
// changing state (attendance mark, recruitment status tick). Pure CSS
// (.nxc-tier2-flash in globals.css), no GSAP, no per-row sequencing:
// call flash() for every row in a bulk action and every row pulses in
// the same frame, not one after another.
export function useTier2Flash() {
  const timeouts = useRef(new Map());

  function flash(el) {
    if (!el) return;
    el.classList.remove('nxc-tier2-flash');
    // Force reflow so re-adding the class restarts the animation even
    // if the same row is flashed twice in quick succession.
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add('nxc-tier2-flash');
    const key = el;
    clearTimeout(timeouts.current.get(key));
    const t = setTimeout(() => el.classList.remove('nxc-tier2-flash'), 200);
    timeouts.current.set(key, t);
  }

  useEffect(() => {
    const map = timeouts.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return flash;
}
