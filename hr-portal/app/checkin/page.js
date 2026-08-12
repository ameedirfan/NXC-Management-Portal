'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Confetti from '@/components/ui/Confetti';

// Deliberately outside the (portal) route group, that layout does a
// blanket server side redirect to /login for anyone signed out, which
// would drop the token from the URL. This page handles its own sign in
// prompt instead, preserving the token through a login round trip.
function CheckinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('checking'); // checking, needs-login, success, error
  const [message, setMessage] = useState('');
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its check in code.');
      return;
    }
    fetch('/api/attendance/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) {
          setStatus('needs-login');
          return;
        }
        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || 'Could not check you in.');
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
  }, [token]);

  const loginHref = `/login?next=${encodeURIComponent(`/checkin?token=${token}`)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-brand-50 p-8 text-center shadow-xl">
        <Confetti burstKey={confettiKey} />
        <Image
          src="/logo.png"
          alt="NXC"
          width={64}
          height={64}
          className="mx-auto h-16 w-16 object-contain"
        />
        <h1 className="mt-3 font-serif text-xl font-bold text-brand-900">Meeting check in</h1>

        {status === 'checking' && <p className="mt-4 text-brand-500">Checking you in…</p>}

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

        {status === 'success' && (
          <>
            <p className="mt-4 text-2xl">✅</p>
            <p className="mt-2 text-brand-800">{message}</p>
            <p className="mt-4 text-sm text-brand-500">You can close this page now.</p>
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
            <p className="mt-2 text-red-700">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinContent />
    </Suspense>
  );
}
