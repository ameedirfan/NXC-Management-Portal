import './globals.css';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
import { THEME_INIT_SCRIPT } from '@/lib/themeScript';
import { fraunces, generalSans } from '@/lib/fonts';

export const metadata = {
  title: 'NXC Management Portal',
  description: 'The home base for NUST Excursion Club attendance, recruitment, and roster management.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'NXC Portal',
    statusBarStyle: 'default',
  },
  // Favicon and Apple touch icon come from app/icon.png and
  // app/apple-icon.png via Next's file-convention metadata — generated
  // fresh from the real logo cutout (centered, padded, no clipping),
  // not the old cropped-screenshot version. No manual `icons` override
  // needed here; the PWA install icons in manifest.json were the same fix.
};

export const viewport = {
  themeColor: '#3a2814',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${generalSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking, runs before paint: sets .dark before hydration so
            there's no flash of the wrong theme on load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Every portal route is fully dynamic (session-cookie dependent),
            so tab-to-tab navigation always pays a real server round trip —
            this tells supporting browsers (Chromium; Safari/Firefox just
            ignore the tag, pure progressive enhancement) to start that
            round trip on pointerdown/hover instead of waiting for the
            click to complete. Excludes /checkin (auto-submits a location
            based check-in on mount — must never fire speculatively),
            /login, and /api/* (not pages). No analytics/ads in this app,
            so there's nothing that needs to be gated on prerenderingchange. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  where: {
                    and: [
                      { href_matches: '/*' },
                      { not: { href_matches: '/checkin*' } },
                      { not: { href_matches: '/login*' } },
                      { not: { href_matches: '/api/*' } },
                    ],
                  },
                  eagerness: 'conservative',
                },
              ],
            }),
          }}
        />
      </head>
      {/* Light theme's page canvas, #EFE4C9 — warmer than brand-100
          (#F2E9D3) per Ameed's follow-up ask, but deliberately NOT the
          next full palette step, brand-200 (#E6D3AB): that would drop
          text-brand-700 (used pervasively for secondary text across the
          app, just fixed to clear the 7:1 floor) to 6.17:1, undoing that
          fix. This is a calculated point ~25% of the way from brand-100
          toward brand-200 — verified at 7.18:1 for brand-700 text, real
          margin instead of a coin-flip. Dark theme is untouched (still
          brand-50's dark value) — explicitly confirmed as already
          working. Cards/inputs elsewhere still use brand-50, so they
          keep reading as gently "lifted" off the page. */}
      <body className="font-sans bg-[#EFE4C9] dark:bg-brand-50 text-brand-950 antialiased">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
