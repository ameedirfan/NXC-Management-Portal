'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toCSV, downloadCSV } from '@/lib/csv';
import Pill from '@/components/ui/Pill';
import { Skeleton, SkeletonTableRows } from '@/components/ui/Skeleton';
import ErrorRetry from '@/components/ui/ErrorRetry';
import AccessDenied from '@/components/ui/AccessDenied';
import { toast } from '@/lib/toast';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { useFabAction } from '@/components/FabProvider';
import { useTier1Reveal, playTier1Success } from '@/lib/motion';
import ChromeHeader, { chromeHeaderButtonClass, chromeHeaderPrimaryButtonClass } from '@/components/motion/ChromeHeader';

const EMPTY_FORM = { date: '', description: '', amount: '', type: '' };

function formatMoney(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinancePage() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState('');
  const contentRef = useRef(null);
  const ledgerRef = useRef(null);
  useTier1Reveal(contentRef, { selector: '[data-tier1]', deps: [loading] });
  const [formOpen, setFormOpen] = useState(false);
  const [modalState, setModalState] = useState('entering');
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Tier 1 modal open/close (spec 6.7/8) — same enter+exit transition
  // pattern as the Announcements composer, the app's one other glass
  // surface. Escape closes it; the actual unmount is delayed to let the
  // exit transition play instead of cutting it off.
  useEffect(() => {
    if (!formOpen) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setModalState('visible'));
    });
    return () => cancelAnimationFrame(raf);
  }, [formOpen]);

  useEffect(() => {
    if (!formOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') closeForm();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch('/api/finance')
      .then(async (res) => {
        if (res.status === 403) {
          setAccessDenied(true);
          return;
        }
        const data = await res.json();
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setEntries(data.entries || []);
        setSummary(data);
        setAccessDenied(false);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFabAction(!accessDenied ? '+ Row' : undefined, () => openAddForm());

  function openAddForm() {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModalState('entering');
    setFormOpen(true);
  }

  function openEditForm(entry) {
    setEditingRow(entry.row);
    setForm({
      date: entry.date,
      description: entry.description,
      amount: String(entry.amount),
      type: entry.type,
    });
    setFieldErrors({});
    setModalState('entering');
    setFormOpen(true);
  }

  function closeForm() {
    setModalState('exiting');
    setTimeout(() => {
      setFormOpen(false);
      setFieldErrors({});
    }, 250); // matches .nxc-modal-panel's transition duration
  }

  function validate() {
    const errors = {};
    if (!form.date) errors.date = 'Date is required.';
    if (!form.description.trim()) errors.description = 'Description is required.';
    if (!form.amount) {
      errors.amount = 'Amount is required.';
    } else if (Number.isNaN(Number(form.amount))) {
      errors.amount = 'Amount must be a number.';
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setFieldErrors({});

    const isEdit = editingRow !== null;
    const res = await fetch(isEdit ? `/api/finance/${editingRow}` : '/api/finance', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFieldErrors({ form: data.error || 'Could not save this entry.' });
      return;
    }
    toast(isEdit ? 'Entry updated' : 'Entry added');
    closeForm();
    load();
    // Tier 1 success confirmation on the ledger, not the ledger's own
    // row-level Tier 2 discipline — this is the deliberate once-off
    // "your entry was recorded" moment (spec 6.7).
    requestAnimationFrame(() => playTier1Success(ledgerRef.current));
  }

  function exportCSV() {
    const csv = toCSV(
      ['Date', 'Description', 'Amount', 'Type', 'Recorded By'],
      entries.map((e) => ({
        Date: e.date,
        Description: e.description,
        Amount: e.amount,
        Type: e.type,
        'Recorded By': e.recordedBy,
      }))
    );
    downloadCSV('finance.csv', csv);
  }

  if (accessDenied) {
    return <AccessDenied message="Finance is admin only." />;
  }

  return (
    <div ref={contentRef}>
      <ChromeHeader
        title="Finance"
        subtitle="Income and expenses. The Google Sheet remains the record of truth."
        actions={
          <>
            <button onClick={openAddForm} className={chromeHeaderPrimaryButtonClass}>
              Add entry
            </button>
            <button onClick={exportCSV} disabled={entries.length === 0} className={chromeHeaderButtonClass}>
              Export CSV
            </button>
          </>
        }
      />

      {loadError && <ErrorRetry className="mt-6" message={loadError} onRetry={load} />}

      {loading && !summary && !loadError && (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-10 w-48" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
        </div>
      )}

      {summary && (
        <div data-tier1 className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-700">Treasury Balance</p>
          <p className="mt-1 font-serif text-4xl font-bold tabular-nums text-brand-900">
            <AnimatedNumber value={summary.treasuryBalance} format={formatMoney} />
          </p>
          <p className="mt-2 text-sm text-brand-700">
            Opening balance <span className="tabular-nums">{formatMoney(summary.openingBalance)}</span>, plus{' '}
            <span className="tabular-nums">{formatMoney(summary.totalIncome)}</span> income, minus{' '}
            <span className="tabular-nums">{formatMoney(summary.totalExpense)}</span> expense.
          </p>
          <p className="mt-2 text-xs text-brand-700">
            To set the opening balance, add a row directly in the Finance sheet with Type = "Opening
            Balance" and Amount = the starting figure. There's no app-side field for it on purpose,
            whatever's in that row is what every calculation starts from.
          </p>
        </div>
      )}

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingRow !== null ? 'Edit entry' : 'Add entry'}
          data-state={modalState === 'visible' ? undefined : modalState}
          className="nxc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-brand-950/25 backdrop-blur-xs p-4"
        >
        <form
          onSubmit={handleSubmit}
          data-state={modalState === 'visible' ? undefined : modalState}
          className="nxc-modal-panel w-full max-w-lg rounded-xl border border-white/50 border-t-white/80 bg-brand-50/70 p-6 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
        >
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            {editingRow !== null ? 'Edit entry' : 'Add entry'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Date<span className="text-red-600"> Required</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                aria-invalid={!!fieldErrors.date}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.date ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.date && <p className="mt-1 text-xs text-red-700">{fieldErrors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Description<span className="text-red-600"> Required</span>
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                aria-invalid={!!fieldErrors.description}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.description ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.description && <p className="mt-1 text-xs text-red-700">{fieldErrors.description}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Amount<span className="text-red-600"> Required</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="Positive for income, negative for expense"
                aria-invalid={!!fieldErrors.amount}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${fieldErrors.amount ? 'border-red-400' : 'border-brand-300'}`}
              />
              {fieldErrors.amount && <p className="mt-1 text-xs text-red-700">{fieldErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
              >
                <option value="">Infer from amount's sign</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>
          {fieldErrors.form && <p className="mt-3 text-sm text-red-700">{fieldErrors.form}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingRow !== null ? 'Save changes' : 'Add entry'}
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
        </div>
      )}

      {!loadError && (
      <div ref={ledgerRef} data-tier1 className="mt-6 overflow-x-auto rounded-xl border border-brand-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-100 text-xs font-medium uppercase tracking-wide text-brand-700">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Recorded By</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows
                rows={5}
                columns={6}
                widths={['w-16', 'w-2/3', 'w-16', 'w-14', 'w-24', 'w-8']}
              />
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-brand-700">
                  No entries yet.{' '}
                  <button onClick={openAddForm} className="font-medium text-brand-900 hover:underline">
                    Add the first one
                  </button>
                  .
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.row} className="border-t border-brand-100 hover:bg-brand-50">
                  <td className="px-4 py-3 tabular-nums text-brand-700">{e.date}</td>
                  <td className="px-4 py-3 font-medium text-brand-900">{e.description}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <Pill tone={e.amount < 0 ? 'expense' : 'income'}>
                      {e.amount >= 0 ? '+' : ''}
                      {formatMoney(e.amount)}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={e.amount < 0 ? 'expense' : 'income'}>{e.type}</Pill>
                  </td>
                  <td className="px-4 py-3 text-brand-700">{e.recordedBy}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(e)}
                      className="text-sm font-medium text-brand-900 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
