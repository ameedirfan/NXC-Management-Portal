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
      {/* Light theme's page canvas is brand-100, not brand-50 — brand-50
          (#F9F4E8) is only marginally off pure white and read as harsh,
          especially now that the ambient background needs a visible
          surface to show against. brand-100 (#F2E9D3) is a full step
          warmer, still from the existing palette (no new hue), and
          research-backed as easier on the eyes than near-white. Dark
          theme is untouched (still brand-50's dark value) — explicitly
          confirmed as already working. Cards/inputs elsewhere still use
          brand-50, so this also gives cards a gentle "lifted" look
          against the slightly deeper page background. */}
      <body className="font-sans bg-brand-100 dark:bg-brand-50 text-brand-950 antialiased">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
