'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { THEME_STORAGE_KEY } from '@/lib/themeScript';

// Manual override on top of the system-preference default the blocking
// script in <head> already applied before first paint. Persisted so the
// choice survives across visits — a personal display setting, not data,
// so it never touches the Google Sheet.
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Private browsing / storage disabled — the toggle still works for
      // this page load, it just won't persist across visits.
    }
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center rounded-lg border border-brand-300 bg-brand-50 p-1.5 text-brand-600 hover:bg-brand-100"
    >
      {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
    </button>
  );
}
