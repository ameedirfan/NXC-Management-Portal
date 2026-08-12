// Runs blocking, before first paint, via a raw <script> tag in the root
// layout's <head> — the only way to set the .dark class before hydration
// without a flash of the wrong theme. Kept as a plain string (not a
// function stringified at runtime) so it survives minification untouched.
export const THEME_STORAGE_KEY = 'nxc-theme';

export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
