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
  const ctx = useContext(FabContext);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  useEffect(() => {
    if (!ctx || !label) return;
    ctx.setFab({ label, onAction: () => actionRef.current() });
    return () => ctx.setFab((prev) => (prev?.label === label ? null : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, label]);
}

export function useFab() {
  return useContext(FabContext)?.fab || null;
}
