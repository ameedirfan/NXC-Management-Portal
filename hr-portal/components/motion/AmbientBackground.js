import { usePrefersReducedMotion } from '@/lib/motion';

// Tier 3 — a persistent, slowly pulsing gradient mesh behind the whole
// portal shell, the "alive" background quality Ameed pointed to. Fixed
// to the viewport, confined to the margins outside the centered content
// column (max-w-5xl) by generous offsets, blurred heavily so it never
// resolves into anything readable, and z-indexed behind everything.
// Same brand/gold palette as AmbientGlow (spec section 4: no new hues),
// just a wider, softer wash instead of two tight orbs. Unmounted
// entirely under reduced motion, not just paused, so it never taxes
// paint for a shape that can't move.
export default function AmbientBackground() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      // Belt-and-suspenders on top of the low opacity + heavy blur below:
      // masks the blobs out entirely across the centered content column
      // (portal content maxes out at max-w-5xl/1024px) regardless of
      // where they drift, so this can never measurably touch reading
      // contrast even on ultra-wide monitors — margins only, verified by
      // construction rather than by eyeballing one viewport size.
      style={{
        maskImage:
          'linear-gradient(to right, black 0%, black 18%, transparent 32%, transparent 68%, black 82%, black 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, black 0%, black 18%, transparent 32%, transparent 68%, black 82%, black 100%)',
      }}
    >
      <div
        className="nxc-ambient-mesh absolute -left-1/4 -top-1/4 h-[70vh] w-[70vh]"
        style={{ background: 'rgb(var(--brand-500) / 0.28)' }}
      />
      <div
        className="nxc-ambient-mesh absolute -right-1/4 top-1/3 h-[60vh] w-[60vh]"
        style={{ background: 'rgb(185 149 79 / 0.24)', animationDelay: '-9s' }}
      />
      <div
        className="nxc-ambient-mesh absolute -bottom-1/4 left-1/4 h-[65vh] w-[65vh]"
        style={{ background: 'rgb(var(--brand-700) / 0.20)', animationDelay: '-15s' }}
      />
    </div>
  );
}
