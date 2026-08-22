'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { renderAnnouncementHtml } from '@/lib/markdown';
import Pill from '@/components/ui/Pill';
import { toast } from '@/lib/toast';
import { Megaphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorRetry from '@/components/ui/ErrorRetry';
import { useFabAction } from '@/components/FabProvider';
import { playTier1Success } from '@/lib/motion';
import ChromeHeader, { chromeHeaderPrimaryButtonClass } from '@/components/motion/ChromeHeader';
import { motion, AnimatePresence } from 'motion/react';

const AUDIENCES = ['All', 'Members', 'Managers', 'Admins'];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ComposePanel({ initial, onClose, onSent, onSendConfirmed, onSendFailed }) {
  const [message, setMessage] = useState(initial?.message || '');
  const [audience, setAudience] = useState(initial?.audience || 'All');
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState('entering');
  const textareaRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setModalState('visible'));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function requestClose() {
    setModalState('exiting');
    setTimeout(onClose, 250); // matches .nxc-modal-panel's transition duration
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') requestClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function wrapSelection(before, after = before) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = message.slice(start, end) || 'text';
    const next = message.slice(0, start) + before + selected + after + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = message.slice(start, end) || 'link text';
    const next = `${message.slice(0, start)}[${selected}](${url})${message.slice(end)}`;
    setMessage(next);
  }

  // Optimistic: close and confirm immediately, the network round trip
  // happens after. Only if it genuinely fails do we reopen this panel
  // with the draft intact and explain via toast.
  function handleSend() {
    if (!message.trim()) {
      setError('Message is required.');
      return;
    }
    setError('');
    const isEdit = !!initial;
    const draft = { id: initial?.id, message, audience };
    onSent(draft);

    fetch(isEdit ? `/api/announcements/${initial.id}` : '/api/announcements', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, audience }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          onSendFailed(draft, data.error || 'Could not save this announcement.');
        } else {
          onSendConfirmed();
        }
      })
      .catch(() => onSendFailed(draft, 'Could not reach the server.'));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? 'Edit announcement' : 'New announcement'}
      data-state={modalState === 'visible' ? undefined : modalState}
      className="nxc-modal-backdrop fixed inset-0 z-50 flex items-end justify-end bg-brand-950/25 backdrop-blur-xs p-4 sm:items-center sm:justify-center"
    >
      <div
        data-state={modalState === 'visible' ? undefined : modalState}
        className="nxc-modal-panel flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/50 border-t-white/80 bg-brand-50/70 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="flex items-center justify-between border-b border-brand-200 px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            {initial ? 'Edit announcement' : 'New announcement'}
          </h2>
          <button onClick={requestClose} className="text-sm text-brand-700 hover:underline">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2">
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
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="ml-auto rounded-lg border border-brand-300 bg-brand-50 px-2 py-1 text-sm"
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Write your announcement…"
            className="mt-3 w-full rounded-lg border border-brand-300 px-3 py-2 font-mono text-sm"
          />

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-brand-700">Preview</p>
          <div
            className="mt-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900"
            dangerouslySetInnerHTML={{ __html: renderAnnouncementHtml(message) || '<span class="text-brand-700">Nothing yet.</span>' }}
          />

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-brand-200 px-5 py-3">
          <button
            onClick={handleSend}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
          >
            {initial ? 'Save changes' : 'Send'}
          </button>
          <button
            onClick={requestClose}
            className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch('/api/announcements')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setAnnouncements(data.announcements || []);
        setCanManage(!!data.canManage);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFabAction(canManage ? 'Announcement' : undefined, () => openCompose());

  function openCompose() {
    setEditing(null);
    setComposeOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setComposeOpen(true);
  }

  // Optimistic: close and confirm the moment Send is clicked. On genuine
  // success, quietly reconcile with the server (picks up the real ID,
  // timestamp, and author). On genuine failure, reopen the compose panel
  // with the draft intact and explain via toast.
  function handleSent(draft) {
    setComposeOpen(false);
    setEditing(null);
    toast(draft.id ? 'Announcement updated' : 'Announcement sent');
  }

  function handleSendConfirmed() {
    load();
    // Tier 1 success confirmation (spec 3.1: "sending an announcement")
    // — fires on genuine server confirmation, not the optimistic close.
    requestAnimationFrame(() => playTier1Success(listRef.current));
  }

  function handleSendFailed(draft, message) {
    toast(`Couldn't send — ${message}`, 'error');
    setEditing(draft.id ? draft : { message: draft.message, audience: draft.audience });
    setComposeOpen(true);
  }

  async function handleDelete(id) {
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    setDeleteConfirmId(null);
    load();
  }

  return (
    <div>
      <ChromeHeader
        title="Announcements"
        subtitle="Only what's relevant to your role shows up here."
        actions={
          canManage && (
            <button onClick={openCompose} className={chromeHeaderPrimaryButtonClass}>
              New Announcement
            </button>
          )
        }
      />

      <div ref={listRef} className="mt-6 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-brand-200 bg-brand-50 p-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
              <Skeleton className="mt-4 h-3 w-40" />
            </div>
          ))
        ) : loadError ? (
          <ErrorRetry message={loadError} onRetry={load} />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description={
              canManage
                ? 'Send the first announcement to your members.'
                : 'Announcements aimed at you will show up here.'
            }
            actionLabel={canManage ? 'Write the first announcement' : undefined}
            onAction={canManage ? openCompose : undefined}
          />
        ) : (
          <AnimatePresence initial={false}>
            {announcements.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-xl border border-brand-200 bg-brand-50 p-5"
              >
              <div
                className="text-brand-900"
                dangerouslySetInnerHTML={{ __html: renderAnnouncementHtml(a.message) }}
              />
              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-brand-700">
                <span>
                  Posted by {a.author} — {formatDate(a.timestamp)}
                </span>
                {a.audience !== 'All' && <Pill tone="muted">{a.audience}</Pill>}
              </p>
              {canManage && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-sm font-medium text-brand-900 hover:underline"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === a.id ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-brand-700">Delete this announcement?</span>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(a.id)}
                      className="text-sm font-medium text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {composeOpen && (
        <ComposePanel
          initial={editing}
          onClose={() => setComposeOpen(false)}
          onSent={handleSent}
          onSendConfirmed={handleSendConfirmed}
          onSendFailed={handleSendFailed}
        />
      )}
    </div>
  );
}
