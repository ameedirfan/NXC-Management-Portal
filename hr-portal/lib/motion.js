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

function useClassPulse(className, durationMs) {
  const timeouts = useRef(new Map());

  function pulse(el) {
    if (!el) return;
    el.classList.remove(className);
    // Force reflow so re-adding the class restarts the animation even
    // if the same element is pulsed twice in quick succession.
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add(className);
    clearTimeout(timeouts.current.get(el));
    const t = setTimeout(() => el.classList.remove(className), durationMs);
    timeouts.current.set(el, t);
  }

  useEffect(() => {
    const map = timeouts.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return pulse;
}

// Tier 2 — instant colour swap + sub-150ms scale pulse. Pure CSS
// (.nxc-tier2-flash in globals.css), no GSAP, no per-row sequencing:
// call flash() for every row in a bulk action and every row pulses in
// the same frame, not one after another. This is the ONLY primitive
// bulk actions should ever call — see useRowUpdateFlash below for the
// richer single-row version, which must never be used in a loop.
export function useTier2Flash() {
  return useClassPulse('nxc-tier2-flash', 200);
}

// A single row changed because of one direct click on that row, not a
// bulk action — gets a fuller flash (real background-colour sweep +a
// bigger scale bounce, ~450ms) than the bulk pulse above. Still pure
// CSS, still instant to trigger, but visually richer since a single
// click only ever pays this cost once, not forty times in a row. Never
// call this inside a loop/bulk handler — that's exactly the "costs
// real, measured seconds" failure mode the Tier 2 rule protects
// against; bulk actions must keep using useTier2Flash.
export function useRowUpdateFlash() {
  return useClassPulse('nxc-row-update', 500);
}
