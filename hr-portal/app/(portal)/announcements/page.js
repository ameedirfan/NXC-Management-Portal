'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { renderAnnouncementHtml } from '@/lib/markdown';

const AUDIENCES = ['All', 'Members', 'Managers', 'Admins'];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ComposePanel({ initial, onClose, onSaved }) {
  const [message, setMessage] = useState(initial?.message || '');
  const [audience, setAudience] = useState(initial?.audience || 'All');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

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

  async function handleSend() {
    if (!message.trim()) {
      setError('Message is required.');
      return;
    }
    setSaving(true);
    setError('');
    const isEdit = !!initial;
    const res = await fetch(isEdit ? `/api/announcements/${initial.id}` : '/api/announcements', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, audience }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Could not save this announcement.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4 sm:items-center sm:justify-center">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-brand-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-brand-200 px-5 py-3">
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            {initial ? 'Edit announcement' : 'New announcement'}
          </h2>
          <button onClick={onClose} className="text-sm text-brand-500 hover:underline">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => wrapSelection('**')}
              className="rounded border border-brand-300 px-2 py-1 text-sm font-bold hover:bg-brand-100"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('*')}
              className="rounded border border-brand-300 px-2 py-1 text-sm italic hover:bg-brand-100"
            >
              i
            </button>
            <button
              type="button"
              onClick={insertLink}
              className="rounded border border-brand-300 px-2 py-1 text-sm hover:bg-brand-100"
            >
              Link
            </button>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="ml-auto rounded-lg border border-brand-300 bg-white px-2 py-1 text-sm"
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

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-brand-500">Preview</p>
          <div
            className="mt-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900"
            dangerouslySetInnerHTML={{ __html: renderAnnouncementHtml(message) || '<span class="text-brand-400">Nothing yet.</span>' }}
          />

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-brand-200 px-5 py-3">
          <button
            onClick={handleSend}
            disabled={saving}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? 'Sending…' : initial ? 'Save changes' : 'Send'}
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

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/announcements')
      .then((res) => res.json())
      .then((data) => {
        setAnnouncements(data.announcements || []);
        setCanManage(!!data.canManage);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCompose() {
    setEditing(null);
    setComposeOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setComposeOpen(true);
  }

  function handleSaved() {
    setComposeOpen(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    setDeleteConfirmId(null);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Announcements</h1>
          <p className="mt-1 text-brand-500">Only what's relevant to your role shows up here.</p>
        </div>
        {canManage && (
          <button
            onClick={openCompose}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
          >
            New Announcement
          </button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-brand-400">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="text-brand-400">No announcements yet.</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="rounded-xl border border-brand-200 bg-white p-5">
              <div
                className="text-brand-900"
                dangerouslySetInnerHTML={{ __html: renderAnnouncementHtml(a.message) }}
              />
              <p className="mt-3 text-xs text-brand-500">
                Posted by {a.author} — {formatDate(a.timestamp)}
                {a.audience !== 'All' && ` · ${a.audience}`}
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
                      <button onClick={() => handleDelete(a.id)} className="font-medium text-red-700 hover:underline">
                        Confirm
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)} className="text-brand-500 hover:underline">
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
            </div>
          ))
        )}
      </div>

      {composeOpen && (
        <ComposePanel initial={editing} onClose={() => setComposeOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
