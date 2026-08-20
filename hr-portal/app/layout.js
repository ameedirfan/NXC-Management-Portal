import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
import { THEME_INIT_SCRIPT } from '@/lib/themeScript';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const crest = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-crest',
  display: 'swap',
});

export const metadata = {
  title: 'NXC Management Portal',
  description: 'The home base for NUST Excursion Club attendance, recruitment, and roster management.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'NXC Portal',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#3a2814',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={crest.variable} suppressHydrationWarning>
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
      <body className={`${inter.className} bg-brand-50 text-brand-950 antialiased`}>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
