'use client';

import { useEffect, useRef, useState } from 'react';
import { renderAnnouncementHtml } from '@/lib/markdown';
import { toast } from '@/lib/toast';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

// Matches the Announcements composer's glass/backdrop-blur treatment and
// Bold/Italic/Link toolbar exactly, per spec section 4.3 and 4.6 — this
// is the second of the three places in the portal that pattern is used.
// Two internal steps: 'compose' (subject/body/toolbar/preview/test-send)
// and 'confirm' (recipient count, skipped list, resend nudge, optional
// bulk status update), per spec sections 4.3 and 4.4.
export default function ComposePanel({ recipients, skipped, statuses, onClose, onSendComplete }) {
  const [step, setStep] = useState('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [sending, setSending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && !sending) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, sending]);

  async function handleFinalSend() {
    setConfirmError('');
    setSending(true);
    try {
      const res = await fetch('/api/recruitment/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmsIds: recipients.map((r) => r.cmsId),
          subject,
          body,
          bulkStatus: bulkStatus || undefined,
          skipped,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmError(data.error || 'Could not send.');
        setSending(false);
        return;
      }
      toast(`Sent to ${data.recipientCount} recipient${data.recipientCount === 1 ? '' : 's'}`);
      onSendComplete();
    } catch {
      setConfirmError('Could not reach the server. Nothing was sent.');
      setSending(false);
    }
  }

  function wrapSelection(before, after = before) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || 'text';
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    const el = bodyRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || 'link text';
    const next = `${body.slice(0, start)}[${selected}](${url})${body.slice(end)}`;
    setBody(next);
  }

  async function handleTestSend() {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are both required before sending a test copy.');
      return;
    }
    setError('');
    setTestSending(true);
    try {
      const res = await fetch('/api/recruitment/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(`Couldn't send test — ${data.error}`, 'error');
      } else {
        toast(`Test copy sent to ${data.sentTo}`);
      }
    } catch {
      toast("Couldn't reach the server.", 'error');
    } finally {
      setTestSending(false);
    }
  }

  function handleReviewAndSend() {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are both required.');
      return;
    }
    if (recipients.length === 0) {
      setError('Select at least one recipient before sending.');
      return;
    }
    setError('');
    setStep('confirm');
  }

  if (step === 'confirm') {
    const alreadyEmailed = recipients.filter((r) => r.lastEmailedAt);
    const mostRecent = alreadyEmailed
      .map((r) => r.lastEmailedAt)
      .sort()
      .at(-1);

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm send"
        className="fixed inset-0 z-50 flex items-end justify-end bg-brand-950/25 backdrop-blur-xs p-4 sm:items-center sm:justify-center"
      >
        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/50 bg-brand-50/70 shadow-2xl backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-center justify-between border-b border-brand-200 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Confirm send</h2>
            <button
              onClick={onClose}
              disabled={sending}
              className="text-sm text-brand-500 hover:underline disabled:opacity-60"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-brand-900">
              <strong>{recipients.length}</strong> will be emailed.
            </p>

            {skipped.length > 0 && (
              <p className="mt-2 text-sm text-brand-600">
                {skipped.length} skipped, no email on file:{' '}
                {skipped.map((a) => a.fullName || a.cmsId).join(', ')}.
              </p>
            )}

            {alreadyEmailed.length > 0 && (
              <p className="mt-2 rounded-lg bg-brand-100 px-3 py-2 text-sm text-brand-700">
                {alreadyEmailed.length} of these {recipients.length} were already emailed, most
                recently on {formatDate(mostRecent)}. Send anyway?
              </p>
            )}

            <label className="mt-4 block text-sm font-medium text-brand-800">
              Also set these recipients to (optional)
            </label>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 sm:max-w-xs"
            >
              <option value="">Leave status unchanged</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-500">Subject</p>
              <p className="mt-1 text-sm text-brand-900">{subject}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-brand-500">Body</p>
              <div
                className="mt-1 text-sm text-brand-900"
                dangerouslySetInnerHTML={{ __html: renderAnnouncementHtml(body) }}
              />
            </div>

            {confirmError && <p className="mt-3 text-sm text-red-700">{confirmError}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-brand-200 px-5 py-3">
            <button
              onClick={() => setStep('compose')}
              disabled={sending}
              className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
            >
              Back to draft
            </button>
            <button
              onClick={handleFinalSend}
              disabled={sending}
              className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draft recruitment email"
      className="fixed inset-0 z-50 flex items-end justify-end bg-brand-950/25 backdrop-blur-xs p-4 sm:items-center sm:justify-center"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/50 bg-brand-50/70 shadow-2xl backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center justify-between border-b border-brand-200 px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-brand-900">Draft email</h2>
          <button onClick={onClose} className="text-sm text-brand-500 hover:underline">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-brand-600">
            {recipients.length} recipient{recipients.length === 1 ? '' : 's'} selected.
          </p>

          <label className="mt-4 block text-sm font-medium text-brand-800">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
          />

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => wrapSelection('**')}
              className="rounded-sm border border-brand-300 px-2 py-1 text-sm font-bold hover:bg-brand-100"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('*')}
              className="rounded-sm border border-brand-300 px-2 py-1 text-sm italic hover:bg-brand-100"
            >
              i
            </button>
            <button
              type="button"
              onClick={insertLink}
              className="rounded-sm border border-brand-300 px-2 py-1 text-sm hover:bg-brand-100"
            >
              Link
            </button>
          </div>

          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write the email…"
            className="mt-3 w-full rounded-lg border border-brand-300 px-3 py-2 font-mono text-sm"
          />

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-brand-500">Preview</p>
          <div
            className="mt-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900"
            dangerouslySetInnerHTML={{
              __html: renderAnnouncementHtml(body) || '<span class="text-brand-400">Nothing yet.</span>',
            }}
          />

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-brand-200 px-5 py-3">
          <button
            onClick={handleReviewAndSend}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
          >
            Send
          </button>
          <button
            onClick={handleTestSend}
            disabled={testSending}
            className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            {testSending ? 'Sending test…' : 'Send Test Copy to Myself'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
