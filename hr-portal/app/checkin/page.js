'use client';

import { useCallback, useEffect, useState } from 'react';
import Confetti from '@/components/ui/Confetti';
import Logo from '@/components/Logo';

// Reads the token synchronously on first render rather than via
// useSearchParams() — that hook forces this page behind a Suspense
// boundary, and with a null fallback the page rendered completely
// blank until JS loaded (confirmed via raw SSR output: Next bails to
// BAILOUT_TO_CLIENT_SIDE_RENDERING). Safe from a hydration mismatch:
// `window` is undefined during SSR so this returns '' there, and the
// only JSX that reads `token` (the "Sign in" link's href) is behind a
// status branch that never renders on the first paint either way.
function readTokenFromLocation() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('token') || '';
}

// Reads the token's unsigned body just to peek at geoRestricted, purely
// a UI hint for whether to request location before submitting. Never
// trusted for anything that matters — the server always re-verifies the
// signature and re-reads the meeting's real Geo Restricted flag before
// enforcing anything, see app/api/attendance/checkin/route.js.
function peekGeoRestricted(token) {
  try {
    const [body] = token.split('.');
    const base64 = body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    return !!payload.geoRestricted;
  } catch {
    return false;
  }
}

// Deliberately outside the (portal) route group, that layout does a
// blanket server side redirect to /login for anyone signed out, which
// would drop the token from the URL. This page handles its own sign in
// prompt instead, preserving the token through a login round trip.
function CheckinContent() {
  const [token] = useState(readTokenFromLocation);
  // checking, needs-login, requesting-location, location-blocked,
  // out-of-range, success, error. location-blocked and out-of-range are
  // the two "blocked, Try Again" states from spec section 4 — neither
  // ever falls through to a present-but-unverified status.
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [confettiKey, setConfettiKey] = useState(0);

  const submitCheckin = useCallback(
    (coords) => {
      fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, lat: coords?.lat, lng: coords?.lng }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.status === 401) {
            setStatus('needs-login');
            return;
          }
          if (!res.ok) {
            if (data.reason === 'out_of_range') {
              setStatus('out-of-range');
              setMessage(data.error);
            } else if (data.reason === 'location_required') {
              // Shouldn't normally happen (the client only gets here
              // after a successful location read), but fails the same
              // way as a denied permission if it ever does.
              setStatus('location-blocked');
              setMessage(data.error);
            } else {
              setStatus('error');
              setMessage(data.error || 'Could not check you in.');
            }
            return;
          }
          setStatus('success');
          const label = data.scope === 'Council' ? 'the Council Meet' : `${data.portfolio}`;
          setMessage(`You are marked Present for ${label}, ${data.date}.`);
          setConfettiKey((k) => k + 1);
        })
        .catch(() => {
          setStatus('error');
          setMessage('Could not reach the server. Try again.');
        });
    },
    [token]
  );

  const requestLocation = useCallback(() => {
    setStatus('requesting-location');
    if (!navigator.geolocation) {
      setStatus('location-blocked');
      setMessage('Your browser does not support location access. Try a different browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => submitCheckin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        setStatus('location-blocked');
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is required to check in to this meeting.'
            : 'Could not get your location. Make sure location services are on and try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [submitCheckin]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its check in code.');
      return;
    }
    if (peekGeoRestricted(token)) {
      requestLocation();
    } else {
      submitCheckin(null);
    }
    // Runs once per token, requestLocation/submitCheckin are stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loginHref = `/login?next=${encodeURIComponent(`/checkin?token=${token}`)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-950 px-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-brand-50 p-8 text-center shadow-xl">
        <Confetti burstKey={confettiKey} />
        <div className="mx-auto">
          <Logo size={64} />
        </div>
        <h1 className="mt-3 font-serif text-xl font-bold text-brand-900">Meeting check in</h1>

        {status === 'checking' && <p className="mt-4 text-brand-700">Checking you in…</p>}

        {status === 'requesting-location' && (
          <p className="mt-4 text-brand-700">Getting your location…</p>
        )}

        {status === 'needs-login' && (
          <>
            <p className="mt-4 text-brand-700">Sign in to check yourself in.</p>
            <a
              href={loginHref}
              className="mt-4 inline-block w-full rounded-lg bg-brand-900 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
            >
              Sign in
            </a>
          </>
        )}

        {(status === 'location-blocked' || status === 'out-of-range') && (
          <>
            <p className="mt-4 text-2xl">📍</p>
            <p className="mt-2 nxc-error-text">{message}</p>
            <button
              onClick={requestLocation}
              className="mt-4 inline-block w-full rounded-lg bg-brand-900 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
            >
              Try Again
            </button>
          </>
        )}

        {status === 'success' && (
          <>
            <p className="mt-4 text-2xl">✅</p>
            <p className="mt-2 text-brand-800">{message}</p>
            <p className="mt-4 text-sm text-brand-700">You can close this page now.</p>
            <div
              className="nxc-toast-in fixed inset-x-0 bottom-5 z-200 flex justify-center px-4"
              aria-live="polite"
            >
              <div className="rounded-full bg-brand-900 px-5 py-2.5 text-sm font-medium text-brand-50 shadow-lg">
                Checked in — see you there
              </div>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="mt-4 text-2xl">⚠️</p>
            <p className="mt-2 nxc-error-text">{message}</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function CheckinPage() {
  return <CheckinContent />;
}
