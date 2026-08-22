'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { MapPinned } from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorRetry from '@/components/ui/ErrorRetry';
import { toast } from '@/lib/toast';
import { useFabAction } from '@/components/FabProvider';
import { useTier1Reveal, playTier1Success } from '@/lib/motion';
import ChromeHeader, { chromeHeaderPrimaryButtonClass } from '@/components/motion/ChromeHeader';

const EMPTY_FORM = { location: '', days: '', participantCount: '' };

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const contentRef = useRef(null);
  const gridRef = useRef(null);
  useTier1Reveal(contentRef, { selector: '[data-tier1]', deps: [loading] });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
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

  useFabAction(canManage ? '+ Trip' : undefined, () => setFormOpen(true));

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!form.location.trim()) errors.location = 'Location is required.';
    if (!form.days) errors.days = 'Number of Days is required.';
    if (!form.participantCount) errors.participantCount = 'Total Participant Count is required.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setFieldErrors({});
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFieldErrors({ form: data.error || 'Could not add this trip.' });
      return;
    }
    toast('Trip added');
    setForm(EMPTY_FORM);
    setFormOpen(false);
    load();
    requestAnimationFrame(() => playTier1Success(gridRef.current));
  }

  return (
    <div ref={contentRef}>
      <ChromeHeader
        title="Trip Itineraries"
        subtitle="Trips the club has run, with itinerary, seating plan, and photos."
        actions={
          canManage && (
            <button onClick={() => setFormOpen((v) => !v)} className={chromeHeaderPrimaryButtonClass}>
              Add trip
            </button>
          )
        }
      />

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
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
                aria-invalid={!!fieldErrors.location}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.location ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.location && <p className="mt-1 text-xs text-red-700">{fieldErrors.location}</p>}
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
                aria-invalid={!!fieldErrors.days}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.days ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.days && <p className="mt-1 text-xs text-red-700">{fieldErrors.days}</p>}
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
                aria-invalid={!!fieldErrors.participantCount}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.participantCount ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.participantCount && <p className="mt-1 text-xs text-red-700">{fieldErrors.participantCount}</p>}
            </div>
          </div>
          {fieldErrors.form && <p className="mt-3 text-sm text-red-700">{fieldErrors.form}</p>}
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
          <p className="mt-2 text-xs text-brand-700">
            Upload the Itinerary, Seating Plan, and Group Photo from the trip's page after it's added.
          </p>
        </form>
      )}

      <div ref={gridRef} data-tier1 className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : loadError ? (
          <ErrorRetry className="col-span-full" message={loadError} onRetry={load} />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={MapPinned}
            title="No trips yet"
            description={
              canManage
                ? "Add the club's first trip to start building the itinerary archive."
                : 'Trips will show up here once an admin adds one.'
            }
            actionLabel={canManage ? 'Add your first trip' : undefined}
            onAction={canManage ? () => setFormOpen(true) : undefined}
          />
        ) : (
          trips.map((t) => (
            <Link
              key={t.id}
              href={`/trips/${encodeURIComponent(t.id)}`}
              className="rounded-xl border border-brand-200 bg-brand-50 p-5 hover:border-brand-400"
            >
              {t.groupPhotoLink ? (
                <img src={t.groupPhotoLink} alt={t.location} className="h-32 w-full rounded-lg object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg bg-brand-100 text-sm text-brand-700">
                  No photo yet
                </div>
              )}
              <p className="mt-3 font-serif text-lg font-semibold text-brand-900">{t.location}</p>
              <p className="text-sm tabular-nums text-brand-700">
                {t.days} day{String(t.days) === '1' ? '' : 's'} · {t.participantCount} participants
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
