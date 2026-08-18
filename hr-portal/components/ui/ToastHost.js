'use client';

import { useEffect, useState } from 'react';
import { onToast } from '@/lib/toast';

const AUTO_DISMISS_MS = 3200;
const EXIT_MS = 250; // matches .nxc-toast's transition duration

const TONE_CLASSES = {
  success: 'bg-brand-900 text-brand-50',
  error: 'bg-red-900 text-red-50',
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return onToast((entry) => {
      // Mounts in the "entering" state, then flips to visible on the next
      // frame so the transition actually has a starting point to animate
      // from (mounting straight into the resting state skips the enter).
      setToasts((prev) => [...prev, { ...entry, state: 'entering' }]);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setToasts((prev) => prev.map((t) => (t.id === entry.id ? { ...t, state: 'visible' } : t)));
        });
      });

      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === entry.id ? { ...t, state: 'exiting' } : t)));
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== entry.id));
        }, EXIT_MS);
      }, AUTO_DISMISS_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed inset-x-0 bottom-5 z-200 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-state={t.state === 'visible' ? undefined : t.state}
          className={`nxc-toast max-w-sm rounded-full px-5 py-2.5 text-sm font-medium shadow-lg ${
            TONE_CLASSES[t.tone] || TONE_CLASSES.success
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
