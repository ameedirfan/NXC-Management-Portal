'use client';

import { useEffect, useState } from 'react';
import { onToast } from '@/lib/toast';

const AUTO_DISMISS_MS = 3200;

const TONE_CLASSES = {
  success: 'bg-brand-900 text-brand-50',
  error: 'bg-red-900 text-red-50',
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return onToast((entry) => {
      setToasts((prev) => [...prev, entry]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== entry.id));
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
          className={`nxc-toast-in max-w-sm rounded-full px-5 py-2.5 text-sm font-medium shadow-lg ${
            TONE_CLASSES[t.tone] || TONE_CLASSES.success
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
