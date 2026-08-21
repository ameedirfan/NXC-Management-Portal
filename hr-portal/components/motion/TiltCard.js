'use client';

import { useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion';

// Tier 1 — dimensional tilt for summary/stat cards only (Dashboard
// stats, Roster portfolio strip). Never wrap a dense table row in this —
// the 3D tilt reads as a considered, once-in-a-while flourish on a card
// someone glances at; on a row someone clicks forty times a session it
// would just be lag. Plain JS transform on mousemove, no library, no
// listener attached under reduced motion.
const MAX_TILT_DEG = 6;

// Shared glass recipe for feature/summary cards — same frosted-glass
// language as the Announcements/Recruitment/Finance modals (spec's one
// other glass surface family), extended to cards per Ameed's read of
// the 2026 trend notes ("deployed strategically for navigation, modals,
// AND feature cards"). Deliberately not used on dense table/list rows —
// see ChromeHeader.js and lib/motion.js's Tier 2 primitives for those.
// Opacity tuned to 78%, not the modal's 70% — modals sit over a dimmed
// backdrop with large text; these cards sit over the ambient background
// (which can show through at up to ~0.28 alpha at a blob's core) with
// small uppercase label text, which needs more headroom. Verified worst
// case (card directly over the most saturated point of the ambient
// glow): 7.62:1 for label text at 78%, vs only 7.10:1 (uncomfortably
// close to the 7:1 floor) at the modal's 70%.
export const glassCardClass =
  'border border-white/50 border-t-white/80 bg-brand-50/78 shadow-lg backdrop-blur-xl backdrop-saturate-150';

export default function TiltCard({ as: Tag = 'div', className = '', children, ...props }) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  function handleMouseMove(e) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform =
      `perspective(800px) rotateX(${(-py * MAX_TILT_DEG).toFixed(2)}deg) rotateY(${(px * MAX_TILT_DEG).toFixed(2)}deg)`;
  }

  function handleMouseLeave() {
    if (!ref.current) return;
    ref.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
  }

  return (
    <Tag
      ref={ref}
      className={`will-change-transform transition-transform duration-300 ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Tag>
  );
}
