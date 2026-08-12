'use client';

import { Plus } from 'lucide-react';
import { useFab } from '@/components/FabProvider';

// Persistent, thumb-reachable, contextual per tab. Renders nothing on
// pages that haven't registered an action via useFabAction.
export default function Fab() {
  const fab = useFab();
  if (!fab) return null;

  return (
    <button
      onClick={fab.onAction}
      className="no-print fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-full bg-brand-900 px-5 py-3 text-sm font-medium text-brand-50 shadow-lg transition hover:bg-brand-800"
    >
      <Plus size={16} aria-hidden="true" />
      {fab.label}
    </button>
  );
}
