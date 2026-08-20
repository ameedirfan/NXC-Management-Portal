'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const RosterInfoContext = createContext(null);

// Fetched once per portal session (mounted in PortalChrome, which persists
// across client-side navigations between tabs) instead of on every page
// that needs role/portfolios. Attendance and Recruitment each used to
// independently re-fetch /api/roster — a live Google Sheets read — on
// every single navigation into them, even navigating back to a tab
// visited moments earlier. This fetches it exactly once per tab/session.
export function RosterInfoProvider({ children }) {
  const [state, setState] = useState({ role: null, portfolios: [], defaultPortfolio: '', loading: true });

  useEffect(() => {
    fetch('/api/roster')
      .then((res) => res.json())
      .then((data) => {
        setState({
          role: data.role || 'member',
          portfolios: data.portfolios || [],
          defaultPortfolio: data.defaultPortfolio || '',
          loading: false,
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  return <RosterInfoContext.Provider value={state}>{children}</RosterInfoContext.Provider>;
}

export function useRosterInfo() {
  const ctx = useContext(RosterInfoContext);
  if (!ctx) throw new Error('useRosterInfo must be used within RosterInfoProvider');
  return ctx;
}
