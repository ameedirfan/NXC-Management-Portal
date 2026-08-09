'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { dedupePortfolios } from '@/lib/portfolio';
import { toCSV, downloadCSV } from '@/lib/csv';

const CUSTOM_OPTION = '__custom__';
const ROLES = ['member', 'manager', 'admin'];
const EMPTY_FORM = {
  username: '',
  password: '',
  fullName: '',
  cmsId: '',
  portfolio: '',
  role: 'member',
};

export default function LoginsPage() {
  const [logins, setLogins] = useState([]);
  const [rosterMembers, setRosterMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState(null);
  const [linkedCmsId, setLinkedCmsId] = useState(CUSTOM_OPTION);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkRole, setBulkRole] = useState('member');
  const [bulkStrategy, setBulkStrategy] = useState('name');
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkCreated, setBulkCreated] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/logins').then((res) => (res.status === 403 ? null : res.json())),
      fetch('/api/roster?view=full').then((res) => (res.status === 403 ? null : res.json())),
    ])
      .then(([loginsData, rosterData]) => {
        if (!loginsData || !rosterData) {
          setAccessDenied(true);
          return;
        }
        setLogins(loginsData.logins || []);
        setRosterMembers(rosterData.members || []);
        setAccessDenied(false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rosterByCmsId = useMemo(
    () => Object.fromEntries(rosterMembers.map((m) => [m.cmsId, m])),
    [rosterMembers]
  );
  const portfolioOptions = useMemo(
    () => dedupePortfolios(rosterMembers.map((m) => m.portfolio)),
    [rosterMembers]
  );

  const loginCmsIds = useMemo(() => new Set(logins.map((l) => l.cmsId).filter(Boolean)), [logins]);
  const rosterWithoutLogin = useMemo(
    () => rosterMembers.filter((m) => m.cmsId && !loginCmsIds.has(m.cmsId)),
    [rosterMembers, loginCmsIds]
  );
  const bulkFiltered = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    if (!q) return rosterMembers;
    return rosterMembers.filter(
      (m) =>
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.cmsId || '').toLowerCase().includes(q) ||
        (m.portfolio || '').toLowerCase().includes(q)
    );
  }, [rosterMembers, bulkSearch]);

  function openAddForm() {
    setEditingUsername(null);
    setForm(EMPTY_FORM);
    setLinkedCmsId(CUSTOM_OPTION);
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(login) {
    setEditingUsername(login.username);
    setForm({ ...EMPTY_FORM, ...login, password: '' });
    setLinkedCmsId(login.cmsId && rosterByCmsId[login.cmsId] ? login.cmsId : CUSTOM_OPTION);
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError('');
  }

  function openBulk() {
    setBulkOpen(true);
    setBulkSelected(new Set());
    setBulkSearch('');
    setBulkRole('member');
    setBulkStrategy('name');
    setBulkPreview(null);
    setBulkCreated(null);
    setBulkError('');
  }

  function closeBulk() {
    setBulkOpen(false);
  }

  function toggleBulkMember(cmsId) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cmsId)) next.delete(cmsId);
      else next.add(cmsId);
      return next;
    });
  }

  function selectAllWithoutLogin() {
    setBulkSelected(new Set(rosterWithoutLogin.map((m) => m.cmsId)));
  }

  function clearBulkSelection() {
    setBulkSelected(new Set());
  }

  async function handleBulkPreview() {
    if (bulkSelected.size === 0) {
      setBulkError('Select at least one roster member.');
      return;
    }
    setBulkBusy(true);
    setBulkError('');
    const res = await fetch('/api/logins/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmsIds: [...bulkSelected],
        role: bulkRole,
        usernameStrategy: bulkStrategy,
      }),
    });
    const data = await res.json();
    setBulkBusy(false);
    if (!res.ok) {
      setBulkError(data.error || 'Could not preview these logins.');
      return;
    }
    setBulkPreview(data);
  }

  async function handleBulkConfirm() {
    const entries = bulkPreview.results
      .filter((r) => r.ok)
      .map((r) => ({ cmsId: r.cmsId, username: r.username, password: r.password, role: r.role }));
    setBulkBusy(true);
    setBulkError('');
    const res = await fetch('/api/logins/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, dryRun: false }),
    });
    const data = await res.json();
    setBulkBusy(false);
    if (!res.ok) {
      setBulkError(data.error || 'Could not create these logins.');
      return;
    }
    setBulkCreated(data);
    load();
  }

  function exportBulkCredentialsCSV() {
    const created = bulkCreated.results.filter((r) => r.ok);
    const csv = toCSV(
      ['Full Name', 'CMS ID', 'Username', 'Password', 'Role'],
      created.map((r) => ({
        'Full Name': r.fullName,
        'CMS ID': r.cmsId,
        Username: r.username,
        Password: r.password,
        Role: r.role,
      }))
    );
    downloadCSV('new-logins.csv', csv);
  }

  function handlePickRosterMember(cmsId) {
    setLinkedCmsId(cmsId);
    if (cmsId === CUSTOM_OPTION) return;
    const member = rosterByCmsId[cmsId];
    if (!member) return;
    setForm((prev) => ({
      ...prev,
      fullName: member.fullName,
      cmsId: member.cmsId,
      portfolio: member.portfolio,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const isEdit = editingUsername !== null;

    if (!form.username.trim()) return setFormError('Username is required.');
    if (!isEdit && !form.password.trim()) return setFormError('Password is required.');
    if (!form.fullName.trim()) return setFormError('Full name is required.');
    if (form.role !== 'admin' && !form.portfolio.trim()) {
      return setFormError('A portfolio is required for manager and member accounts.');
    }

    setSaving(true);
    setFormError('');

    const body = { ...form };
    if (isEdit && !body.password.trim()) delete body.password;

    const res = await fetch(
      isEdit ? `/api/logins/${encodeURIComponent(editingUsername)}` : '/api/logins',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFormError(data.error || 'Could not save this login.');
      return;
    }
    setFormOpen(false);
    load();
  }

  if (accessDenied) {
    return <p className="text-red-700">Admin access required to manage logins.</p>;
  }

  return (
    <div>
      <Link href="/roster" className="text-sm text-brand-500 hover:underline">
        Back to roster
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Logins</h1>
          <p className="mt-1 text-brand-500">
            Who can sign in, and with which role. Passwords are hashed before they ever touch
            the sheet.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openBulk}
            className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
          >
            Bulk create logins
          </button>
          <button
            onClick={openAddForm}
            className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
          >
            Add login
          </button>
        </div>
      </div>

      {bulkOpen && (
        <div className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Bulk create logins</h2>
            <button onClick={closeBulk} className="text-sm text-brand-500 hover:underline">
              Close
            </button>
          </div>

          {bulkCreated ? (
            <div className="mt-4">
              <p className="text-brand-700">
                Created {bulkCreated.created} login{bulkCreated.created === 1 ? '' : 's'}.
                {bulkCreated.skipped > 0 && ` ${bulkCreated.skipped} were skipped.`}
              </p>
              <p className="mt-1 text-sm font-medium text-red-700">
                These passwords are shown once and are not stored anywhere in plain text. Copy
                or export them now.
              </p>
              <div className="mt-3 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-brand-700">
                    <tr>
                      <th className="py-1 pr-4">Name</th>
                      <th className="py-1 pr-4">Username</th>
                      <th className="py-1 pr-4">Password</th>
                      <th className="py-1 pr-4">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkCreated.results.map((r) => (
                      <tr key={r.cmsId} className="border-t border-brand-100">
                        <td className="py-1 pr-4">{r.fullName || r.cmsId}</td>
                        {r.ok ? (
                          <>
                            <td className="py-1 pr-4 font-mono">{r.username}</td>
                            <td className="py-1 pr-4 font-mono">{r.password}</td>
                            <td className="py-1 pr-4 capitalize">{r.role}</td>
                          </>
                        ) : (
                          <td className="py-1 pr-4 text-red-700" colSpan={3}>
                            {r.errors.join('. ')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={exportBulkCredentialsCSV}
                  className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800"
                >
                  Export CSV
                </button>
                <button
                  onClick={closeBulk}
                  className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
                >
                  Done
                </button>
              </div>
            </div>
          ) : bulkPreview ? (
            <div className="mt-4">
              <p className="text-brand-700">
                {bulkPreview.validCount} of {bulkPreview.totalCount} will get a login. Usernames
                and passwords below are final, they will not change if you go back.
              </p>
              <div className="mt-3 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-brand-700">
                    <tr>
                      <th className="py-1 pr-4">Name</th>
                      <th className="py-1 pr-4">Username</th>
                      <th className="py-1 pr-4">Password</th>
                      <th className="py-1 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.results.map((r) => (
                      <tr key={r.cmsId} className="border-t border-brand-100">
                        <td className="py-1 pr-4">{r.fullName || r.cmsId}</td>
                        {r.ok ? (
                          <>
                            <td className="py-1 pr-4 font-mono">{r.username}</td>
                            <td className="py-1 pr-4 font-mono">{r.password}</td>
                            <td className="py-1 pr-4 text-emerald-700">Ready</td>
                          </>
                        ) : (
                          <td className="py-1 pr-4 text-red-700" colSpan={3}>
                            {r.errors.join('. ')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bulkError && <p className="mt-3 text-sm text-red-700">{bulkError}</p>}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleBulkConfirm}
                  disabled={bulkBusy || bulkPreview.validCount === 0}
                  className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
                >
                  {bulkBusy ? 'Creating…' : `Create ${bulkPreview.validCount} logins`}
                </button>
                <button
                  onClick={() => setBulkPreview(null)}
                  className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-brand-800">Role for everyone selected</label>
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r === 'admin' ? 'Admin' : r === 'manager' ? 'Manager' : 'Member'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-brand-400">
                    Each person keeps their own portfolio from the roster, this only sets the role.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-800">Username style</label>
                  <select
                    value={bulkStrategy}
                    onChange={(e) => setBulkStrategy(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
                  >
                    <option value="name">First name dot last name, for example ali.khan</option>
                    <option value="cmsId">CMS ID as the username</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  placeholder="Search by name, CMS ID, or portfolio"
                  className="flex-1 rounded-lg border border-brand-300 px-3 py-2 sm:max-w-xs"
                />
                <button
                  onClick={selectAllWithoutLogin}
                  className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  Select everyone without a login ({rosterWithoutLogin.length})
                </button>
                <button
                  onClick={clearBulkSelection}
                  className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  Clear selection
                </button>
                <span className="ml-auto text-sm text-brand-500">{bulkSelected.size} selected</span>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-brand-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-brand-100 text-brand-700">
                    <tr>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">CMS ID</th>
                      <th className="px-3 py-2">Portfolio</th>
                      <th className="px-3 py-2">Has login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkFiltered.map((m) => (
                      <tr key={m.cmsId} className="border-t border-brand-100">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={bulkSelected.has(m.cmsId)}
                            onChange={() => toggleBulkMember(m.cmsId)}
                          />
                        </td>
                        <td className="px-3 py-2">{m.fullName}</td>
                        <td className="px-3 py-2 text-brand-500">{m.cmsId}</td>
                        <td className="px-3 py-2">{m.portfolio}</td>
                        <td className="px-3 py-2">{loginCmsIds.has(m.cmsId) ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {bulkError && <p className="mt-3 text-sm text-red-700">{bulkError}</p>}
              <div className="mt-4">
                <button
                  onClick={handleBulkPreview}
                  disabled={bulkBusy || bulkSelected.size === 0}
                  className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
                >
                  {bulkBusy ? 'Working…' : `Preview ${bulkSelected.size} logins`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-brand-200 bg-white p-6"
        >
          <h2 className="font-serif text-lg font-semibold text-brand-900">
            {editingUsername !== null ? `Edit ${form.username}` : 'Add login'}
          </h2>

          <div className="mt-4">
            <label className="block text-sm font-medium text-brand-800">Link to roster member</label>
            <select
              value={linkedCmsId}
              onChange={(e) => handlePickRosterMember(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
            >
              <option value={CUSTOM_OPTION}>Not on roster, enter manually</option>
              {rosterMembers.map((m) => (
                <option key={m.cmsId} value={m.cmsId}>
                  {m.fullName}, {m.cmsId}, {m.portfolio}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-brand-800">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                {editingUsername !== null ? 'New password, leave blank to keep current' : 'Password'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">Full Name</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                disabled={linkedCmsId !== CUSTOM_OPTION}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 disabled:bg-brand-100 disabled:text-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">CMS ID</label>
              <input
                value={form.cmsId}
                onChange={(e) => setForm((p) => ({ ...p, cmsId: e.target.value }))}
                disabled={linkedCmsId !== CUSTOM_OPTION}
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 disabled:bg-brand-100 disabled:text-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">
                Portfolio {form.role !== 'admin' && <span className="text-red-600">Required</span>}
              </label>
              <input
                value={form.portfolio}
                onChange={(e) => setForm((p) => ({ ...p, portfolio: e.target.value }))}
                disabled={linkedCmsId !== CUSTOM_OPTION}
                list="login-portfolio-options"
                className="mt-1 w-full rounded-lg border border-brand-300 px-3 py-2 disabled:bg-brand-100 disabled:text-brand-400"
              />
              <datalist id="login-portfolio-options">
                {portfolioOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-800">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === 'admin'
                      ? 'Admin, everything'
                      : r === 'manager'
                      ? 'Manager, Roster and Recruitment and attendance, all portfolios'
                      : 'Member, self check in only'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingUsername !== null ? 'Save changes' : 'Add login'}
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
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">CMS ID</th>
              <th className="px-4 py-3">Portfolio</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-400">
                  Loading…
                </td>
              </tr>
            ) : logins.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-400">
                  No logins found.
                </td>
              </tr>
            ) : (
              logins.map((l) => (
                <tr key={l.username} className="border-t border-brand-100">
                  <td className="px-4 py-3 font-medium text-brand-900">{l.username}</td>
                  <td className="px-4 py-3">{l.fullName}</td>
                  <td className="px-4 py-3 text-brand-500">{l.cmsId}</td>
                  <td className="px-4 py-3">{l.portfolio}</td>
                  <td className="px-4 py-3 capitalize">{l.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(l)}
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
