import { usePrefersReducedMotion } from '@/lib/motion';

// Tier 3 — drifting ambient glow for a dark chrome zone's margins. Two
// soft blurred orbs using existing brand/gold tokens only (spec section
// 4: no new hues). Always aria-hidden; unmounted entirely under reduced
// motion rather than just frozen, since a static blur still costs a
// layer without adding anything once it can't move.
export default function AmbientGlow({ className = '' }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="nxc-ambient-glow -left-24 -top-24 h-72 w-72"
        style={{ background: 'rgb(var(--brand-600) / 0.35)' }}
      />
      <div
        className="nxc-ambient-glow -right-20 top-1/3 h-64 w-64"
        style={{ background: 'rgb(185 149 79 / 0.28)', animationDelay: '-6s' }}
      />
    </div>
  );
}
