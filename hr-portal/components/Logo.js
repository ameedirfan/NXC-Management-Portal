import Image from 'next/image';

/**
 * Single source of truth for every logo placement in the portal.
 *
 * The app's dark mode inverts every brand token in lockstep (brand-50
 * flips dark, brand-900 flips light under .dark — see globals.css), and
 * every current placement (NavBar, login card, check-in card) sits on a
 * brand-50-family surface. That surface is light in light theme and dark
 * in dark theme, so a single CSS-only swap covers every case correctly:
 * light theme gets the dark-ink mark with a backing plate (measured
 * 8.18:1 on brand-50 even without the plate; the plate is a polish
 * choice, not a contrast fix), dark theme gets the light-ink variant
 * with no plate (measured 9.33:1 on brand-900). No theme-detection JS —
 * `dark:` classes already resolve through the same .dark ancestor toggle
 * the rest of the app uses.
 */
export default function Logo({ size = 40, className = '' }) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full bg-brand-200/70 ring-1 ring-brand-300/40 dark:hidden" />
      <Image
        src="/logo_clean.png"
        alt="NXC"
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full object-contain p-[12%] dark:hidden"
        priority
      />
      <Image
        src="/logo_clean_dark.png"
        alt="NXC"
        width={size}
        height={size}
        className="absolute inset-0 hidden h-full w-full object-contain dark:block"
        priority
      />
    </span>
  );
}
