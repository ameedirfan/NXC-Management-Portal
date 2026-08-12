'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { NAV_ICONS, tabsForRole } from '@/components/NavBar';

// Restrained glass effect: this overlay is one of exactly two places in
// the app it's used (the other is the Announcement compose panel) — a
// genuinely floating layer sitting on top of page content, so the blur
// does real work separating it from the background.
export default function CommandPalette({ open, onClose, role, supportsViewTransitions }) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const tabs = tabsForRole(role);
  const filtered = tabs.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function go(href) {
    onClose();
    if (supportsViewTransitions) {
      document.startViewTransition(() => router.push(href));
    } else {
      router.push(href);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-100 flex justify-center px-4 pt-24"
    >
      <div onClick={onClose} className="fixed inset-0 bg-brand-950/30 backdrop-blur-xs" />
      <div className="relative h-fit w-full max-w-lg overflow-hidden rounded-2xl border border-white/50 bg-brand-50/70 shadow-2xl backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center gap-2 border-b border-brand-200/70 px-4 py-3">
          <Search size={16} className="shrink-0 text-brand-500" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a tab…"
            className="min-w-0 flex-1 bg-transparent text-sm text-brand-900 outline-hidden placeholder:text-brand-400"
          />
          <span className="shrink-0 rounded-sm border border-brand-300 px-1.5 py-0.5 text-[10px] font-medium text-brand-500">
            ESC
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-brand-400">No matches.</p>}
          {filtered.map((t) => {
            const Icon = NAV_ICONS[t.href];
            return (
              <button
                key={t.href}
                onClick={() => go(t.href)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-brand-800 hover:bg-brand-50/60"
              >
                {Icon && <Icon size={15} aria-hidden="true" />}
                Go to {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
