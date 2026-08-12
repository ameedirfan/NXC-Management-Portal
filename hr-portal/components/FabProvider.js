'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

// A page registers itself as "the thing the FAB does here" via
// useFabAction(label, onAction). Pages that have nothing for the FAB to
// do (Dashboard, Handover, Recruitment) simply never call it, so the FAB
// doesn't render there. Only re-registers when the label itself changes
// (e.g. a role check flips it from undefined to a string), the callback
// is always read fresh off a ref so callers don't need useCallback.

const FabContext = createContext(null);

export function FabProvider({ children }) {
  const [fab, setFab] = useState(null);
  return <FabContext.Provider value={{ fab, setFab }}>{children}</FabContext.Provider>;
}

export function useFabAction(label, onAction) {
  // Depend on setFab (React guarantees this dispatcher's identity is
  // stable across renders), never on the context object itself — that
  // object is a fresh {fab, setFab} literal every time FabProvider
  // re-renders, and depending on it here would re-run this effect on
  // every fab update, which calls setFab again, which re-renders
  // FabProvider again: an infinite loop the instant any page registers
  // a FAB action.
  const { setFab } = useContext(FabContext) || {};
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  useEffect(() => {
    if (!setFab || !label) return;
    setFab({ label, onAction: () => actionRef.current() });
    return () => setFab((prev) => (prev?.label === label ? null : prev));
  }, [setFab, label]);
}

export function useFab() {
  return useContext(FabContext)?.fab || null;
}
