'use client';

import { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/lib/toast';

const EMPTY_FORM = { fullName: '', position: '', phone: '', email: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch('/api/contacts')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setContacts(data.contacts || []);
        setCanManage(!!data.canManage);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAddForm() {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(contact) {
    setEditingRow(contact.row);
    setForm({
      fullName: contact.fullName,
      position: contact.position,
      phone: contact.phone,
      email: contact.email,
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.position.trim()) {
      setFormError('Full Name and Position are required.');
      return;
    }
    setSaving(true);
    setFormError('');

    const isEdit = editingRow !== null;
    const res = await fetch(isEdit ? `/api/contacts/${editingRow}` : '/api/contacts', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFormError(data.error || 'Could not save this contact.');
      return;
    }
    toast(isEdit ? 'Contact updated' : 'Contact added');
    setFormOpen(false);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Contact Us</h1>
          <p className="mt-1 text-brand-500">Who to reach, and how.</p>
        </div>
        {canManage && (
          <button
            onClick={openAddForm}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
          >
            Add contact
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            {editingRow !== null ? 'Edit contact' : 'Add contact'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Full Name<span className="text-red-600"> Required</span>
              </label>
              <input
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Position<span className="text-red-600"> Required</span>
              </label>
              <input
                value={form.position}
                onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
                placeholder="e.g. President, Director HR"
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
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
              {saving ? 'Saving…' : editingRow !== null ? 'Save changes' : 'Add contact'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-white p-4">
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))
        ) : loadError ? (
          <p className="text-red-700">{loadError}</p>
        ) : contacts.length === 0 ? (
          <p className="text-brand-400">No contacts yet.</p>
        ) : (
          contacts.map((c) => (
            <div
              key={c.row}
              className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-white p-4"
            >
              <div>
                <p className="font-semibold text-brand-900">{c.fullName}</p>
                <p className="text-sm text-brand-500">{c.position}</p>
                {c.email && <p className="mt-1 text-sm text-brand-500">{c.email}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-right font-medium text-brand-800">{c.phone}</p>
                {canManage && (
                  <button
                    onClick={() => openEditForm(c)}
                    className="text-sm font-medium text-brand-900 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
