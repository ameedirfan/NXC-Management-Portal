'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorRetry from '@/components/ui/ErrorRetry';
import { toast } from '@/lib/toast';
import { useFabAction } from '@/components/FabProvider';
import { useTier1Reveal, playTier1Success } from '@/lib/motion';
import ChromeHeader, { chromeHeaderPrimaryButtonClass } from '@/components/motion/ChromeHeader';

const EMPTY_FORM = { fullName: '', position: '', phone: '', email: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);
  const gridRef = useRef(null);
  useTier1Reveal(contentRef, { selector: '[data-tier1]', deps: [loading] });
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
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

  useFabAction(canManage ? '+ Contact' : undefined, () => openAddForm());

  function openAddForm() {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
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
    setFieldErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFieldErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Full Name is required.';
    if (!form.position.trim()) errors.position = 'Position is required.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setFieldErrors({});

    const isEdit = editingRow !== null;
    const res = await fetch(isEdit ? `/api/contacts/${editingRow}` : '/api/contacts', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFieldErrors({ form: data.error || 'Could not save this contact.' });
      return;
    }
    toast(isEdit ? 'Contact updated' : 'Contact added');
    setFormOpen(false);
    load();
    requestAnimationFrame(() => playTier1Success(gridRef.current));
  }

  return (
    <div ref={contentRef}>
      <ChromeHeader
        title="Contact Us"
        subtitle="Who to reach, and how."
        actions={
          canManage && (
            <button onClick={openAddForm} className={chromeHeaderPrimaryButtonClass}>
              Add contact
            </button>
          )
        }
      />

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
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
                aria-invalid={!!fieldErrors.fullName}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.fullName ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs text-red-700">{fieldErrors.fullName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Position<span className="text-red-600"> Required</span>
              </label>
              <input
                value={form.position}
                onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
                placeholder="e.g. President, Director HR"
                aria-invalid={!!fieldErrors.position}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.position ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.position && <p className="mt-1 text-xs text-red-700">{fieldErrors.position}</p>}
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
          {fieldErrors.form && <p className="mt-3 text-sm text-red-700">{fieldErrors.form}</p>}
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

      <div ref={gridRef} data-tier1 className="mt-6 grid gap-3 sm:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))
        ) : loadError ? (
          <ErrorRetry className="col-span-full" message={loadError} onRetry={load} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No contacts yet"
            description={
              canManage
                ? 'Add the exec team so members know who to reach.'
                : 'Contact details will show up here once added.'
            }
            actionLabel={canManage ? 'Add the first contact' : undefined}
            onAction={canManage ? openAddForm : undefined}
          />
        ) : (
          contacts.map((c) => (
            <div
              key={c.row}
              className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4"
            >
              <div>
                <p className="font-semibold text-brand-900">{c.fullName}</p>
                <p className="text-sm text-brand-700">{c.position}</p>
                {c.email && <p className="mt-1 text-sm text-brand-700">{c.email}</p>}
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
