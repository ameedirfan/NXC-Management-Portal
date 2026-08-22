'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion';

// motion-based replacement for the GSAP useTier1Reveal pattern, used on
// page-level card/section entrances. Kept separate from the
// AnimatePresence+layout usage in Contacts/Trips (those need real
// mount/unmount tracking for add/remove; this is a simpler one-shot
// stagger-in that doesn't need GSAP's imperative DOM-selector approach.
//
// Still Tier 1 only — wrap page sections/cards, never a dense table's
// individual rows. Pass `replayKey` (e.g. a `loading` flag, or a
// selected id) so the stagger replays when the real content actually
// mounts, not on every unrelated re-render — same reasoning as
// useTier1Reveal's `deps` option.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
};

export function Tier1Group({ children, className, replayKey }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div key={replayKey} className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function Tier1Item({ children, className, ...props }) {
  return (
    <motion.div className={className} variants={item} {...props}>
      {children}
    </motion.div>
  );
}
