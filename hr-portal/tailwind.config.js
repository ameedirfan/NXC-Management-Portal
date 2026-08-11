/** @type {import('tailwindcss').Config} */
module.exports = {
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
          50: '#f9f4e8',
          100: '#f2e9d3',
          200: '#e6d3ab',
          300: '#d4b878',
          400: '#b9954f',
          500: '#9c7539',
          600: '#7d5a2c',
          700: '#5f4322',
          800: '#4a3319',
          900: '#3a2814',
          950: '#241809',
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
