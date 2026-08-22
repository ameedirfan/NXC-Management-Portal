'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePrefersReducedMotion, initGsap } from '@/lib/motion';
import { tabsForRole } from '@/components/NavBar';
import { WELCOME_COOKIE } from '@/lib/welcome';

// Re-exported for existing importers; the definition lives in
// lib/welcome.js so the server layout can read it as a real string
// rather than a client reference.
export { WELCOME_COOKIE };

function roleLine(session) {
  if (session.role === 'admin') return 'Admin';
  if (session.role === 'manager') return `Manager · ${session.portfolio || 'Council'}`;
  return session.portfolio || 'Member';
}

// The once-per-app-open front door. This is deliberately the most
// heavily animated surface in the portal, and that's consistent rather
// than indulgent: the spec's Frequency-Aware Motion rule puts the full
// cinematic treatment exactly here, on something seen once per session,
// and keeps it away from the rows people touch forty times an hour.
//
// Choreographed with a GSAP timeline rather than motion's declarative
// variants — this is a multi-stage sequence with overlapping offsets and
// a character-level text split, which is what GSAP timelines are
// genuinely better at (and what SplitText was installed for).
//
// Dismissal is an explicit Continue, not a timer, and the button only
// arrives once the sequence has played — Ameed's call that people should
// pass through the transition rather than skip past it. Reduced motion
// is the one exception: it lands on the finished state immediately,
// button included, since there is no animation there to sit through.
export default function WelcomeIntro({ session }) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const rootRef = useRef(null);
  const markRef = useRef(null);
  const eyebrowRef = useRef(null);
  const ruleRef = useRef(null);
  const headingRef = useRef(null);
  const metaRef = useRef(null);
  const buttonRef = useRef(null);
  const ringsRef = useRef(null);
  const timelineRef = useRef(null);
  const splitRef = useRef(null);

  const reduced = usePrefersReducedMotion();

  const tabCount = tabsForRole(session.role).length;
  const firstName = (session.fullName || session.username || '').trim().split(/\s+/)[0];
  const heading = firstName ? `Welcome back ${firstName}` : 'Welcome back';

  function handleContinue() {
    // Session cookie (no Max-Age/Expires) — clears when the browser
    // closes, which is what makes this "once per app open" rather than
    // once ever.
    document.cookie = `${WELCOME_COOKIE}=1; path=/; SameSite=Lax`;

    if (reduced || !timelineRef.current) {
      setDismissed(true);
      return;
    }

    // Exit reads as moving *through* the portal rather than the panel
    // sliding away: everything scales up past the camera and blurs out,
    // revealing the app already sitting behind it.
    initGsap().then((mod) => {
      if (!mod) return setDismissed(true);
      mod.gsap
        .timeline({ onComplete: () => setDismissed(true) })
        .to(rootRef.current?.querySelector('[data-stage]'), {
          scale: 1.35,
          opacity: 0,
          filter: 'blur(14px)',
          duration: 0.75,
          ease: 'power2.in',
        })
        .to(rootRef.current, { opacity: 0, duration: 0.5, ease: 'none' }, '-=0.45');
    });
  }

  // Build and play the entrance timeline.
  useEffect(() => {
    if (reduced) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let bailed = false;
    let ctx;

    // Safety net for the spec's "must survive its own dependency
    // failing" rule: if GSAP never resolves, reveal everything anyway
    // rather than leaving a person staring at an empty dark screen with
    // no way forward.
    const failsafe = setTimeout(() => {
      if (cancelled) return;
      bailed = true;
      const root = rootRef.current;
      if (!root) return;
      root.querySelectorAll('[data-cinematic]').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      setReady(true);
    }, 2600);

    initGsap().then((mod) => {
      // `bailed` matters on a slow connection: if the failsafe already
      // revealed everything, starting the timeline now would yank it all
      // back to hidden and replay from the top, which looks like a bug.
      if (cancelled || bailed || !mod || !rootRef.current) return;
      clearTimeout(failsafe);
      const { gsap, SplitText } = mod;

      ctx = gsap.context(() => {
        // Character split for the heading — the one place in this build
        // where per-character motion is worth its cost.
        let headingTargets = headingRef.current;
        if (SplitText && headingRef.current) {
          // 'chars,words', not just 'chars': per-character divs alone
          // are independently wrappable, so a long name broke mid-word
          // ("Welcome back, Amee / d."). Splitting words too keeps each
          // word an unbreakable unit while still animating per char.
          splitRef.current = new SplitText(headingRef.current, { type: 'chars,words' });
          headingTargets = splitRef.current.chars;
          gsap.set(headingRef.current, { opacity: 1 });
        }

        const tl = gsap.timeline({ onComplete: () => setReady(true) });
        timelineRef.current = tl;

        // Four acts, roughly six seconds. Absolute start times (the
        // trailing number on each call) rather than relative offsets, so
        // the choreography stays readable and retunable — you can see
        // the whole score at a glance instead of tracing a chain of
        // "-=0.3"s.
        tl
          // ── Act 1 · the compass wakes ─────────────────────────────
          // Rings bloom open from nothing, slowly. Nothing else moves
          // yet; the empty beat at the top is what makes it read as a
          // cold open rather than a page simply appearing.
          .fromTo(
            ringsRef.current,
            { opacity: 0, scale: 0.35, rotate: -25 },
            { opacity: 1, scale: 1, rotate: 0, duration: 2.4, ease: 'nxcEaseOut' },
            0.25
          )
          // The mark resolves out of blur, unwinding a slight rotation
          // as it lands — a compass needle settling.
          .fromTo(
            markRef.current,
            { opacity: 0, scale: 0.45, rotate: -14, filter: 'blur(22px)' },
            {
              opacity: 1,
              scale: 1,
              rotate: 0,
              filter: 'blur(0px)',
              duration: 2.0,
              ease: 'nxcEaseOut',
            },
            0.5
          )

          // ── Act 2 · the club names itself ─────────────────────────
          // Hairline rule draws out from the centre.
          .fromTo(
            ruleRef.current,
            { opacity: 0, scaleX: 0 },
            { opacity: 1, scaleX: 1, duration: 1.3, ease: 'nxcEaseOut' },
            2.1
          )
          // Wordmark tracks from tight to wide as it fades up.
          .fromTo(
            eyebrowRef.current,
            { opacity: 0, letterSpacing: '0.01em' },
            { opacity: 1, letterSpacing: '0.24em', duration: 1.5, ease: 'nxcEaseOut' },
            2.35
          )

          // ── Act 3 · the greeting ──────────────────────────────────
          // Character by character, each one tipping up off its own
          // baseline in 3D. The slow stagger is the centrepiece.
          .fromTo(
            headingTargets,
            { opacity: 0, yPercent: 130, rotateX: -75 },
            {
              opacity: 1,
              yPercent: 0,
              rotateX: 0,
              duration: 1.25,
              ease: 'nxcEaseOut',
              stagger: 0.038,
            },
            3.5
          )

          // ── Act 4 · the door ──────────────────────────────────────
          .fromTo(
            metaRef.current,
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 1.0, ease: 'nxcEaseOut' },
            5.0
          )
          // Button arrives last — the sequence has to have played before
          // there is anything to press.
          .fromTo(
            buttonRef.current,
            { opacity: 0, scale: 0.86, y: 14 },
            { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'back.out(1.9)' },
            5.5
          );

        // Deliberately its own tween rather than a timeline child: an
        // infinite repeat inside the timeline would mean the timeline
        // never completes, so onComplete (and therefore the button
        // becoming usable) would never fire. Kept in the same gsap
        // context so it's still reverted on unmount.
        gsap.to(markRef.current, {
          scale: 1.035,
          duration: 3.2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: 2.6,
        });
      }, rootRef);
    });

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      splitRef.current?.revert?.();
      ctx?.revert();
    };
  }, [reduced]);

  // Focus the button the moment it becomes usable, so keyboard users
  // land on it without hunting.
  useEffect(() => {
    if (ready) buttonRef.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (dismissed) return;
    function onKeyDown(e) {
      // Only once the sequence has finished — this is a keyboard route
      // through the same door, not a way to jump the queue.
      if (!ready) return;
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        handleContinue();
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, ready]);

  if (dismissed) return null;


  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      className="no-print fixed inset-0 z-[400] flex items-center justify-center overflow-hidden px-6"
      style={{ background: 'linear-gradient(140deg, #3A2814, #241809 55%, #150F08)' }}
    >
      {!reduced && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="nxc-ambient-mesh absolute -left-1/4 -top-1/3 h-[85vh] w-[85vh]"
              style={{ background: 'rgb(var(--brand-500) / 0.32)' }}
            />
            <div
              className="nxc-ambient-mesh absolute -bottom-1/3 -right-1/4 h-[75vh] w-[75vh]"
              style={{ background: 'rgb(185 149 79 / 0.28)', animationDelay: '-7s' }}
            />
          </div>
          <div aria-hidden="true" className="nxc-cinema-sweep" />
          <div aria-hidden="true" className="nxc-cinema-sweep nxc-cinema-sweep-late" />
          <div aria-hidden="true" className="nxc-cinema-vignette" />
        </>
      )}

      <div
        data-stage
        className="relative flex w-full max-w-xl flex-col items-center text-center"
        style={{ perspective: 800 }}
      >
        <div className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          {!reduced && (
            <div ref={ringsRef} data-cinematic aria-hidden="true"  className="nxc-cinematic-hidden absolute inset-0">
              <div className="nxc-compass-ring" />
              <div className="nxc-compass-ring-inner" />
            </div>
          )}
          <div ref={markRef} data-cinematic  className="nxc-cinematic-hidden relative">
            <Image
              src="/logo_clean_dark.png"
              alt=""
              width={168}
              height={168}
              priority
              className="h-28 w-28 object-contain sm:h-36 sm:w-36"
            />
          </div>
        </div>

        <div
          ref={ruleRef}
          data-cinematic
          aria-hidden="true"
                    className="nxc-cinematic-hidden mt-8 h-px w-40 bg-gradient-to-r from-transparent via-[#B9954F] to-transparent"
        />

        <p
          ref={eyebrowRef}
          data-cinematic
                    className="nxc-cinematic-hidden mt-6 text-xs uppercase tracking-[0.24em] text-[#D4B878]"
        >
          NUST Excursion Club
        </p>

        <h1
          ref={headingRef}
          data-cinematic
                    className="nxc-cinematic-hidden mt-4 font-serif text-4xl font-bold tracking-tight text-[#F9F4E8] sm:text-6xl"
        >
          {heading}
        </h1>

        <p ref={metaRef} data-cinematic  className="nxc-cinematic-hidden mt-5 text-[#E6D3AB]">
          Signed in as {roleLine(session)} — {tabCount} sections open to you.
        </p>

        <button
          ref={buttonRef}
          data-cinematic
                    onClick={handleContinue}
          className="nxc-cinematic-hidden nxc-btn-sweep mt-10 rounded-xl bg-[#B9954F] px-10 py-3.5 text-lg font-medium text-black shadow-2xl hover:bg-[#CDA968]"
        >
          Enter the portal
        </button>

        {/* Rides in with the button rather than taking its own timeline
            slot — plain CSS opacity keyed off `ready`, so it can't fight
            the GSAP-driven elements above for control of the same
            property. */}
        {/* Keyboard-shortcut hint is hidden on phones — there's no Ctrl
            key to press there, so it's just noise on the smallest
            screen. */}
        <p
          className={`mt-5 hidden text-xs text-[#B9954F] transition-opacity duration-700 sm:block ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Press Ctrl + K anywhere to jump between sections.
        </p>
      </div>
    </div>
  );
}
