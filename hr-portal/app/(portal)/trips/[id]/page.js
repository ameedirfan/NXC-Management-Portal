'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';
import ErrorRetry from '@/components/ui/ErrorRetry';
import { toast } from '@/lib/toast';

const SLOTS = [
  { key: 'itinerary', label: 'Itinerary', linkKey: 'itineraryLink', accept: 'application/pdf' },
  { key: 'seatingPlan', label: 'Seating Plan', linkKey: 'seatingPlanLink', accept: 'application/pdf' },
  { key: 'groupPhoto', label: 'Group Photo', linkKey: 'groupPhotoLink', accept: 'image/png,image/jpeg' },
];

function PreviewFor({ slot, url }) {
  if (!url) return <p className="text-sm text-brand-700">Not uploaded yet.</p>;
  if (slot.key === 'groupPhoto') {
    return <img src={url} alt={slot.label} className="w-full rounded-lg border border-brand-200" />;
  }
  return (
    <iframe
      src={url}
      title={slot.label}
      className="h-[480px] w-full rounded-lg border border-brand-200"
    />
  );
}

export default function TripDetailPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [loadError, setLoadError] = useState('');

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
        setCanManage(!!data.canManage);
        setTrip((data.trips || []).find((t) => t.id === id) || null);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(slotKey, file) {
    setUploadingSlot(slotKey);
    setUploadError('');
    const formData = new FormData();
    formData.append('slot', slotKey);
    formData.append('file', file);
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/files`, { method: 'POST', body: formData });
    const data = await res.json();
    setUploadingSlot(null);
    if (!res.ok) {
      setUploadError(data.error || 'Could not upload this file.');
      return;
    }
    toast('File uploaded');
    load();
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-brand-200 bg-brand-50 p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-3 h-48 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (loadError) return <ErrorRetry message={loadError} onRetry={load} />;
  if (!trip) return <p className="text-red-700">Trip not found.</p>;

  return (
    <div>
      <Link href="/trips" className="text-sm text-brand-700 hover:underline">
        Back to Trip Itineraries
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-900">{trip.location}</h1>
          <p className="mt-1 tabular-nums text-brand-700">
            {trip.days} day{String(trip.days) === '1' ? '' : 's'} · {trip.participantCount} participants
          </p>
        </div>
      </div>

      {uploadError && <p className="mt-4 text-sm text-red-700">{uploadError}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="rounded-xl border border-brand-200 bg-brand-50 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold text-brand-900">{slot.label}</h2>
              {canManage && (
                <label className="cursor-pointer text-sm font-medium text-brand-900 hover:underline">
                  {uploadingSlot === slot.key
                    ? 'Uploading…'
                    : trip[slot.linkKey]
                    ? 'Replace'
                    : 'Upload'}
                  <input
                    type="file"
                    accept={slot.accept}
                    className="hidden"
                    disabled={uploadingSlot === slot.key}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleUpload(slot.key, file);
                    }}
                  />
                </label>
              )}
            </div>
            <div className="mt-3">
              <PreviewFor slot={slot} url={trip[slot.linkKey]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
