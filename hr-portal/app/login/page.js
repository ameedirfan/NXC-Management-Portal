'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Sign in failed.');
        setLoading(false);
        return;
      }

      // Bounces back to wherever the person was headed (e.g. a QR check
      // in link) if one was given, only ever a relative path, never an
      // external URL, so this cannot be used as an open redirect.
      const next = searchParams.get('next');
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/attendance';
      router.push(dest);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-brand-50 p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <Logo size={88} />
          <h1 className="mt-3 font-serif text-2xl font-bold text-brand-900">NXC Management Portal</h1>
          <p className="mt-1 text-sm text-brand-700">Sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-800">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 focus:border-brand-700 focus:outline-hidden focus:ring-1 focus:ring-brand-700"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-800">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 focus:border-brand-700 focus:outline-hidden focus:ring-1 focus:ring-brand-700"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-900 py-2.5 font-medium text-brand-50 transition hover:bg-brand-800 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
