import CursorSpotlight from '@/components/motion/CursorSpotlight';
import AmbientGlow from '@/components/motion/AmbientGlow';

// Shared dark chrome zone (spec 3.1/6.2), now used on every portal page
// header, not just Dashboard — a deliberate identity choice made after
// the first pass shipped it Dashboard-only and it read as inconsistent.
// Fixed colors (not the theme-flipping bg-brand-900 utility): this needs
// to stay reliably dark regardless of the light/dark toggle, same
// reasoning as Logo.js and the Dashboard header before it.
export default function ChromeHeader({ title, subtitle, actions, noPrint = true, className = '' }) {
  return (
    <div
      className={`${noPrint ? 'no-print ' : ''}relative isolate flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl px-6 py-6 ${className}`}
      style={{ background: 'linear-gradient(135deg, #3A2814, #241809)' }}
    >
      <AmbientGlow />
      <CursorSpotlight />
      <div className="relative">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#F9F4E8]">{title}</h1>
        {subtitle && <p className="mt-1 text-[#E6D3AB]">{subtitle}</p>}
      </div>
      {actions && <div className="relative flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// Shared button classes for actions placed inside a ChromeHeader, so
// every page's header buttons read consistently against the dark
// background instead of each page inventing its own dark-safe colors.
export const chromeHeaderButtonClass =
  'rounded-lg border border-[#7D5A2C] px-4 py-2 text-sm font-medium text-[#F2E9D3] hover:bg-white/10 disabled:opacity-60';
// text-black, not the brand-950 tone used elsewhere — measured 6.18:1
// against this gold, under the 7:1 floor. True black clears it at
// 7.47:1 without changing the gold itself.
export const chromeHeaderPrimaryButtonClass =
  'rounded-lg bg-[#B9954F] px-4 py-2 text-sm font-medium text-black hover:bg-[#CDA968]';
