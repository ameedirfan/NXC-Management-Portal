'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion';

const BASE_SIZE = 38;
const MAX_SIZE = 58;
const MAGNIFY_RANGE = 140; // px of mouse distance before an icon is back to base size

// A single dock icon. Tracks its own distance from the shared mouseX
// motion value and maps that to a size — GPU-cheap since it's just a
// transform, no per-frame React re-render (useTransform/useSpring
// update the DOM directly, bypassing React's render cycle).
function DockIcon({ mouseX, href, label, Icon, active, onClick }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return Infinity;
    return val - (rect.left + rect.width / 2);
  });
  const sizeTarget = useTransform(distance, [-MAGNIFY_RANGE, 0, MAGNIFY_RANGE], [BASE_SIZE, MAX_SIZE, BASE_SIZE]);
  const size = useSpring(sizeTarget, { mass: 0.15, stiffness: 200, damping: 14 });

  return (
    <Link
      href={href}
      onClick={onClick}
      // aria-label carries the name to screen readers/no-JS regardless
      // of the floating tooltip below, which is purely a sighted-mouse
      // (and keyboard-focus) affordance.
      aria-label={label}
      className="relative flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {(hovered || focused) && (
        <motion.span
          initial={{ opacity: 0, y: 4, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-lg bg-brand-900 px-2.5 py-1 text-xs font-medium text-brand-50 shadow-lg"
        >
          {label}
        </motion.span>
      )}
      <motion.div
        ref={ref}
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl transition-colors active:scale-[0.94] ${
          active ? 'bg-brand-900 text-brand-50' : 'text-brand-700 hover:bg-brand-100'
        }`}
      >
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </motion.div>
    </Link>
  );
}

// Mac-dock-style tab bar: icons magnify toward the cursor as it moves
// across, with a small floating label. Mouse-only by nature — there's
// no continuous hover on touch, so mobile/touch just gets the icons at
// base size, still fully tappable (see PortalCursorSpotlight.js for the
// same reasoning applied to the cursor glow). Unmounts the magnify
// tracking under reduced motion; icons stay static at base size, still
// fully functional.
export default function DockNav({ tabs, navIcons, pathname, onNavClick }) {
  const mouseX = useMotionValue(Infinity);
  const reduced = usePrefersReducedMotion();

  return (
    <nav
      className="flex flex-wrap items-end gap-1"
      onMouseMove={(e) => {
        if (!reduced) mouseX.set(e.pageX);
      }}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      {tabs.map((t) => {
        const Icon = navIcons[t.href];
        if (!Icon) return null;
        return (
          <DockIcon
            key={t.href}
            mouseX={mouseX}
            href={t.href}
            label={t.label}
            Icon={Icon}
            active={pathname?.startsWith(t.href)}
            onClick={(e) => onNavClick(e, t.href)}
          />
        );
      })}
    </nav>
  );
}
