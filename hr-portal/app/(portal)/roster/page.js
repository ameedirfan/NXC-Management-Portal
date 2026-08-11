'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toCSV, downloadCSV, parseCSV } from '@/lib/csv';
import { dedupePortfolios } from '@/lib/portfolio';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import ErrorRetry from '@/components/ui/ErrorRetry';
import AccessDenied from '@/components/ui/AccessDenied';
import { toast } from '@/lib/toast';

const NEW_PORTFOLIO_OPTION = '__new_portfolio__';

const FIELDS = [
  { key: 'cmsId', label: 'CMS ID', required: true },
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'portfolio', label: 'Portfolio', required: true },
  { key: 'designation', label: 'Designation', required: true, suggest: true },
  { key: 'wing', label: 'Wing', suggest: true },
  { key: 'gender', label: 'Gender' },
  { key: 'contactNo', label: 'Contact No.' },
  { key: 'email', label: 'Email Address' },
  { key: 'batch', label: 'Batch', suggest: true },
  { key: 'department', label: 'Department', suggest: true },
  { key: 'residentialStatus', label: 'Residential Status', suggest: true },
  { key: 'hostel', label: 'Hostel', suggest: true },
];

const LABEL_TO_KEY = Object.fromEntries(FIELDS.map((f) => [f.label, f.key]));

function csvRowToFields(row) {
  const out = {};
  for (const [label, value] of Object.entries(row)) {
    const key = LABEL_TO_KEY[label];
    if (key) out[key] = value;
  }
  return out;
}

const EMPTY_FORM = Object.fromEntries(FIELDS.map((f) => [f.key, '']));

export default function RosterPage() {
  const [members, setMembers] = useState([]);
  const [portfolioStats, setPortfolioStats] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCmsId, setEditingCmsId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [portfolioCustom, setPortfolioCustom] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch('/api/roster?view=full')
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
        setMembers(data.members || []);
        setPortfolioStats(data.portfolioStats || []);
        setRole(data.role || null);
        setAccessDenied(false);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const suggestions = useMemo(() => {
    const out = {};
    for (const f of FIELDS) {
      if (!f.suggest) continue;
      out[f.key] = [...new Set(members.map((m) => m[f.key]).filter(Boolean))].sort();
    }
    return out;
  }, [members]);

  const portfolioOptions = useMemo(
    () => dedupePortfolios(members.map((m) => m.portfolio)),
    [members]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.cmsId || '').toLowerCase().includes(q) ||
        (m.portfolio || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  function openAddForm() {
    setEditingCmsId(null);
    setForm(EMPTY_FORM);
    setPortfolioCustom(portfolioOptions.length === 0);
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(member) {
    setEditingCmsId(member.cmsId);
    setForm({ ...EMPTY_FORM, ...member });
    setPortfolioCustom(!portfolioOptions.includes(member.portfolio));
    setFormError('');
    setFormOpen(true);
  }

  function handlePortfolioSelect(value) {
    if (value === NEW_PORTFOLIO_OPTION) {
      setPortfolioCustom(true);
      setForm((prev) => ({ ...prev, portfolio: '' }));
    } else {
      setForm((prev) => ({ ...prev, portfolio: value }));
    }
  }

  function closeForm() {
    setFormOpen(false);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    for (const f of FIELDS) {
      if (f.required && !form[f.key].trim()) {
        setFormError(`${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    setFormError('');

    const isEdit = editingCmsId !== null;
    const res = await fetch(isEdit ? `/api/roster/${encodeURIComponent(editingCmsId)}` : '/api/roster', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFormError(data.error || 'Could not save this member.');
      return;
    }
    toast(isEdit ? 'Member updated' : 'Member added');
    setFormOpen(false);
    load();
  }

  function exportCSV() {
    const csv = toCSV(
      FIELDS.map((f) => f.label),
      filtered.map((m) => Object.fromEntries(FIELDS.map((f) => [f.label, m[f.key]])))
    );
    downloadCSV('roster.csv', csv);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError('');
    const reader = new FileReader();
    reader.onload = async () => {
      const parsed = parseCSV(String(reader.result)).map(csvRowToFields);
      if (parsed.length === 0) {
        setImportError('No rows found in that file.');
        return;
      }
      setImportRows(parsed);
      setImporting(true);
      const res = await fetch('/api/roster/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed, dryRun: true }),
      });
      const data = await res.json();
      setImporting(false);
      if (!res.ok) {
        setImportError(data.error || 'Could not read this file.');
        return;
      }
      setImportPreview(data);
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    setImporting(true);
    setImportError('');
    const res = await fetch('/api/roster/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: importRows, dryRun: false }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportError(data.error || 'Could not import.');
      return;
    }
    toast(`Imported ${data.imported ?? importRows.length} member${data.imported === 1 ? '' : 's'}`);
    setImportPreview(null);
    setImportRows(null);
    load();
  }

  function cancelImport() {
    setImportPreview(null);
    setImportRows(null);
    setImportError('');
  }

  if (accessDenied) {
    return <AccessDenied message="Roster management is for managers and admins." />;
  }
  if (loadError && !loading) {
    return <ErrorRetry message={loadError} onRetry={load} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Roster</h1>
          <p className="mt-1 text-brand-500">
            Add and edit members here. The Google Sheet stays fully in sync and remains the
            record of truth, nothing here replaces it.
          </p>
        </div>
        {(role === 'admin' || role === 'manager') && (
          <Link href="/roster/logins" className="text-sm font-medium text-brand-900 hover:underline">
            Manage logins
          </Link>
        )}
      </div>

      {portfolioStats.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {portfolioStats.map((p) => (
            <div key={p.portfolio} className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
              <p className="text-sm font-medium text-brand-900">{p.portfolio}</p>
              <p className="text-xs tabular-nums text-brand-500">
                {p.headcount} member{p.headcount === 1 ? '' : 's'} · {p.percentage}% attendance
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={openAddForm}
          className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
        >
          Add member
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, CMS ID, or portfolio"
          className="flex-1 rounded-lg border border-brand-300 px-3 py-2 sm:max-w-xs"
        />
        <label className="ml-auto cursor-pointer rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100">
          Import CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" />
        </label>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          Export CSV
        </button>
      </div>

      {importError && <p className="mt-3 text-sm text-red-700">{importError}</p>}

      {importPreview && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            Import preview. {importPreview.validCount} of {importPreview.totalCount} rows valid
          </h2>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-brand-700">
                <tr>
                  <th className="py-1 pr-4">Row</th>
                  <th className="py-1 pr-4">Name</th>
                  <th className="py-1 pr-4">CMS ID</th>
                  <th className="py-1 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.results.map((r) => (
                  <tr key={r.row} className="border-t border-brand-100">
                    <td className="py-1 pr-4 text-brand-400">{r.row}</td>
                    <td className="py-1 pr-4">{r.fullName || 'None'}</td>
                    <td className="py-1 pr-4 text-brand-500">{r.cmsId || 'None'}</td>
                    <td className={`py-1 pr-4 ${r.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                      {r.ok ? 'OK' : r.errors.join('. ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleConfirmImport}
              disabled={importing || importPreview.validCount === 0}
              className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {importing ? 'Importing…' : `Import ${importPreview.validCount} valid rows`}
            </button>
            <button
              onClick={cancelImport}
              className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
            >
              Cancel
            </button>
            {importPreview.totalCount - importPreview.validCount > 0 && (
              <span className="text-sm text-brand-400">
                {importPreview.totalCount - importPreview.validCount} rows will be skipped.
              </span>
            )}
          </div>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-brand-200 bg-white p-6"
        >
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            {editingCmsId !== null ? `Edit ${form.fullName || 'member'}` : 'Add roster member'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) =>
              f.key === 'portfolio' ? (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-brand-800">
                    {f.label}
                    <span className="text-red-600"> Required</span>
                  </label>
                  {portfolioCustom ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        value={form.portfolio}
                        onChange={(e) => setForm((prev) => ({ ...prev, portfolio: e.target.value }))}
                        placeholder="New portfolio name"
                        className="w-full rounded-lg border border-brand-300 px-3 py-2"
                      />
                      {portfolioOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPortfolioCustom(false)}
                          className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-900 hover:underline"
                        >
                          Choose existing
                        </button>
                      )}
                    </div>
                  ) : (
                    <select
                      value={form.portfolio}
                      onChange={(e) => handlePortfolioSelect(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
                    >
                      <option value="" disabled>
                        Select a portfolio
                      </option>
                      {portfolioOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value={NEW_PORTFOLIO_OPTION}>Add new portfolio</option>
                    </select>
                  )}
                </div>
              ) : (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-brand-800">
                    {f.label}
                    {f.required && <span className="text-red-600"> Required</span>}
                  </label>
                  <input
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    disabled={f.key === 'cmsId' && editingCmsId !== null}
                    list={f.suggest ? `${f.key}-options` : undefined}
                    className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 disabled:bg-brand-100 disabled:text-brand-400"
                  />
                  {f.suggest && (
                    <datalist id={`${f.key}-options`}>
                      {suggestions[f.key]?.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  )}
                </div>
              )
            )}
          </div>
          {editingCmsId !== null && (
            <p className="mt-2 text-xs text-brand-400">
              CMS ID can't be changed here. It's how attendance, applications, and logins are
              linked to this person. Fix a wrong CMS ID directly in the Roster tab.
            </p>
          )}
          {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingCmsId !== null ? 'Save changes' : 'Add member'}
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

      <div className="mt-6 overflow-x-auto rounded-xl border border-brand-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-100 text-brand-700">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">CMS ID</th>
              <th className="px-4 py-3">Portfolio</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Wing</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows
                rows={6}
                columns={7}
                widths={['w-2/3', 'w-16', 'w-20', 'w-20', 'w-12', 'w-24', 'w-10']}
              />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-brand-400">
                  No members found.
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.cmsId} className="border-t border-brand-100">
                  <td className="px-4 py-3 font-medium text-brand-900">{m.fullName}</td>
                  <td className="px-4 py-3 text-brand-500">{m.cmsId}</td>
                  <td className="px-4 py-3">{m.portfolio}</td>
                  <td className="px-4 py-3">{m.designation}</td>
                  <td className="px-4 py-3">{m.wing}</td>
                  <td className="px-4 py-3 text-brand-500">{m.contactNo}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(m)}
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
    </div>
  );
}
