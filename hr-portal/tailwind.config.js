/** @type {import('tailwindcss').Config} */

// Each step resolves through a CSS custom property (defined for both
// :root and .dark in globals.css) instead of a fixed hex, so dark mode
// is a value swap on the same tokens, not a second set of classes.
// Standard Tailwind "CSS variables with opacity support" pattern.
function withOpacity(varName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined ? `rgb(var(${varName}) / ${opacityValue})` : `rgb(var(${varName}))`;
}

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sampled from the NXC compass mark: deep brown emblem on a warm
        // parchment ground. brand-900 is the darkest ray brown; brand-50
        // is the badge's cream. This scale is used everywhere the old
        // navy/slate scale used to be, so the whole portal reads as one
        // piece with the crest instead of a generic admin panel.
        brand: {
          50: withOpacity('--brand-50'),
          100: withOpacity('--brand-100'),
          200: withOpacity('--brand-200'),
          300: withOpacity('--brand-300'),
          400: withOpacity('--brand-400'),
          500: withOpacity('--brand-500'),
          600: withOpacity('--brand-600'),
          700: withOpacity('--brand-700'),
          800: withOpacity('--brand-800'),
          900: withOpacity('--brand-900'),
          950: withOpacity('--brand-950'),
        },
      },
      fontFamily: {
        serif: ['var(--font-crest)', 'Georgia', 'serif'],
      },
      // Type scale, codified so every component pulls from the same
      // sizes instead of picking ad hoc px values. Convention (weight
      // is chosen per use, Tailwind fontSize doesn't carry it):
      //   xs   12/16  — metadata, timestamps, helper text
      //   sm   13/20  — table cells, form labels, nav items, buttons
      //   base 15/24  — body copy
      //   lg   18/28  — card/section headings (font-serif, semibold)
      //   xl   20/28  — sub-page headings
      //   2xl  24/32  — stat tile values (font-serif, bold)
      //   3xl  30/36  — page titles (font-serif, bold)
      //   4xl  36/40  — hero stat numbers, e.g. Treasury Balance
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
};
