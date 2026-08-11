'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { toast } from '@/lib/toast';

const EMPTY_FORM = { location: '', days: '', participantCount: '' };

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch('/api/trips')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setTrips(data.trips || []);
        setCanManage(!!data.canManage);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.location.trim() || !form.days || !form.participantCount) {
      setFormError('Location, Number of Days, and Total Participant Count are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFormError(data.error || 'Could not add this trip.');
      return;
    }
    toast('Trip added');
    setForm(EMPTY_FORM);
    setFormOpen(false);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Trip Itineraries</h1>
          <p className="mt-1 text-brand-500">Trips the club has run, with itinerary, seating plan, and photos.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
          >
            Add trip
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-brand-900">Add trip</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Location<span className="text-red-600"> Required</span>
              </label>
              <input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. Hunza"
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Number of Days<span className="text-red-600"> Required</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.days}
                onChange={(e) => setForm((prev) => ({ ...prev, days: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Total Participant Count<span className="text-red-600"> Required</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.participantCount}
                onChange={(e) => setForm((prev) => ({ ...prev, participantCount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add trip'}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-brand-400">
            Upload the Itinerary, Seating Plan, and Group Photo from the trip's page after it's added.
          </p>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : loadError ? (
          <p className="text-red-700">{loadError}</p>
        ) : trips.length === 0 ? (
          <p className="text-brand-400">No trips yet.</p>
        ) : (
          trips.map((t) => (
            <Link
              key={t.id}
              href={`/trips/${encodeURIComponent(t.id)}`}
              className="rounded-xl border border-brand-200 bg-white p-5 hover:border-brand-400"
            >
              {t.groupPhotoLink ? (
                <img src={t.groupPhotoLink} alt={t.location} className="h-32 w-full rounded-lg object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg bg-brand-100 text-sm text-brand-400">
                  No photo yet
                </div>
              )}
              <p className="mt-3 font-serif text-lg font-semibold text-brand-900">{t.location}</p>
              <p className="text-sm tabular-nums text-brand-500">
                {t.days} day{String(t.days) === '1' ? '' : 's'} · {t.participantCount} participants
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
