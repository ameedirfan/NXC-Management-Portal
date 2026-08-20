'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';
import ErrorRetry from '@/components/ui/ErrorRetry';
import { toast } from '@/lib/toast';
import { useTier1Reveal, useTier2Flash } from '@/lib/motion';

const STATUSES = ['Pending', 'Interviewed', 'Reserve', 'Not Recommended', 'Selected'];
const RECOMMENDATIONS = ['Strong yes', 'Yes', 'Neutral', 'No', 'Strong no'];

export default function ApplicantPage() {
  const { cmsId } = useParams();

  const [applicant, setApplicant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recommendation, setRecommendation] = useState(RECOMMENDATIONS[0]);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const pageRef = useRef(null);
  const statusRowRef = useRef(null);
  const flash = useTier2Flash();
  // Tier 1: this page opens once per lookup, not forty times a session
  // (spec 6.4/7) — a real staggered reveal is fine here.
  useTier1Reveal(pageRef, { selector: '[data-tier1]' });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/applicants/${cmsId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load applicant.');
        setApplicant(data.applicant);
        setReviews(data.reviews);
        setStatusHistory(data.statusHistory || []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [cmsId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(status) {
    setStatusSaving(true);
    await fetch(`/api/applicants/${cmsId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setStatusSaving(false);
    flash(statusRowRef.current); // Tier 2: instant feedback, not a reveal
    toast('Status updated');
    load();
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmsId, recommendation, reviewText }),
    });
    setReviewText('');
    setSubmitting(false);
    toast('Review submitted');
    load();
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-9 w-64" />
        <div className="mt-6 grid gap-4 rounded-xl border border-brand-200 bg-brand-50 p-6 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorRetry message={error} onRetry={load} />;
  if (!applicant) return null;

  return (
    <div ref={pageRef}>
      <Link href="/recruitment" className="text-sm text-brand-700 hover:underline">
        Back to Recruitment
      </Link>

      <div
        ref={statusRowRef}
        data-tier1
        className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg"
      >
        <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-900">{applicant.fullName}</h1>
        <select
          value={applicant.status || ''}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={statusSaving}
          className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 font-medium"
        >
          <option value="">No status yet</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div data-tier1 className="mt-6 grid gap-4 rounded-xl border border-brand-200 bg-brand-50 p-6 sm:grid-cols-2">
        <InfoRow label="CMS ID" value={applicant.cmsId} />
        <InfoRow label="Contact Number" value={applicant.contactNo} />
        <InfoRow label="Email" value={applicant.email} />
        <InfoRow label="Batch" value={applicant.batch} />
        <InfoRow label="School" value={applicant.school} />
        <InfoRow label="Portfolio" value={applicant.portfolio} />
        <InfoRow
          label="Last emailed"
          value={applicant.lastEmailedAt ? new Date(applicant.lastEmailedAt).toLocaleString() : ''}
        />
        {applicant.extraFields.map(([key, value]) => (
          <InfoRow key={key} label={key} value={value} />
        ))}
      </div>

      <div data-tier1 className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-brand-900">Status history</h2>
        <div className="mt-3 space-y-2">
          {statusHistory.length === 0 && (
            <p className="text-sm text-brand-700">No status changes recorded yet.</p>
          )}
          {statusHistory.map((h, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-100 px-4 py-2 text-sm"
            >
              <span className="text-brand-700">
                <span className="font-medium">{h.changedBy}</span> moved this from{' '}
                <span className="font-medium">{h.fromStatus}</span> to{' '}
                <span className="font-medium">{h.toStatus}</span>
              </span>
              <span className="text-brand-700">
                {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div data-tier1 className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-brand-900">Reviews ({reviews.length})</h2>
        <div className="mt-3 space-y-3">
          {reviews.map((r, i) => (
            <div key={i} className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-brand-900">{r.reviewer}</span>
                <span className="text-sm text-brand-700">
                  {r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-brand-700">{r.recommendation}</p>
              {r.reviewText && <p className="mt-1 text-sm text-brand-600">{r.reviewText}</p>}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmitReview} className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h3 className="font-medium text-brand-900">Add a review</h3>
          <div className="mt-3">
            <label className="block text-sm font-medium text-brand-800">Recommendation</label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
            >
              {RECOMMENDATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-brand-800">Notes</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Submit review'}
          </button>
        </form>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-brand-700">{label}</p>
      <p className="mt-0.5 text-brand-900">{value || 'Not provided'}</p>
    </div>
  );
}
