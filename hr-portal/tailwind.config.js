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
    },
  },
  plugins: [],
};
