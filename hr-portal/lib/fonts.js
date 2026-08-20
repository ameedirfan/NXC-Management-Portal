import { Fraunces } from 'next/font/google';
import localFont from 'next/font/local';

// Display / headings / wordmark / large numerals. Self-hosted at build
// time via next/font/google — no runtime request to fonts.googleapis.com
// ever leaves the browser. A free variable serif with real optical-size
// and "soft" axes, chosen over Inter/Poppins/Roboto/system-ui precisely
// because those are the default every AI-assisted build reaches for.
export const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Body / UI / table data / form labels / buttons. Self-hosted from a
// locally bundled variable woff2 (public/fonts/general-sans/), never a
// Fontshare CDN link — the direct fix for a real failure where a CDN
// script 403'd and silently broke an entire page's animation.
// Fontshare's ITF Free Font License explicitly permits self-hosting;
// see public/fonts/general-sans/LICENSE.txt.
export const generalSans = localFont({
  src: [
    {
      path: '../public/fonts/general-sans/GeneralSans-Variable.woff2',
      weight: '200 700',
      style: 'normal',
    },
    {
      path: '../public/fonts/general-sans/GeneralSans-VariableItalic.woff2',
      weight: '200 700',
      style: 'italic',
    },
  ],
  variable: '--font-general-sans',
  display: 'swap',
});
