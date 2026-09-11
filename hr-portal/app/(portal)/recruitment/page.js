'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toCSV, downloadCSV } from '@/lib/csv';
import { isSendableEmail } from '@/lib/email';
import { dedupePortfolios } from '@/lib/portfolio';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import ErrorRetry from '@/components/ui/ErrorRetry';
import AccessDenied from '@/components/ui/AccessDenied';
import ComposePanel from './ComposePanel';
import { useRosterInfo } from '@/components/RosterInfoProvider';
import { Tier1Group, Tier1Item } from '@/components/motion/Tier1Group';
import { useTier2Flash } from '@/lib/motion';
import { toast } from '@/lib/toast';
import ChromeHeader, { chromeHeaderButtonClass, chromeHeaderPrimaryButtonClass } from '@/components/motion/ChromeHeader';

const STATUSES = ['Pending', 'Interviewed', 'Reserve', 'Not Recommended', 'Selected'];

function formatLastEmailed(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export default function RecruitmentPage() {
  // The Applicants sheet isn't linked to the Roster (spec section 1), so
  // a portfolio can exist in one but not the other — the dropdown is the
  // union of both, deduped case-insensitively, not just Roster's list.
  // role/portfolios/defaultPortfolio come from context (fetched once per
  // session in PortalChrome), not a fetch local to this page — this page
  // used to re-hit /api/roster on every single navigation into it.
  const { role, portfolios: rosterPortfolios, defaultPortfolio, loading: rosterInfoLoading } = useRosterInfo();
  const [applicantPortfolios, setApplicantPortfolios] = useState([]);
  const portfolios = useMemo(
    () => dedupePortfolios([...rosterPortfolios, ...applicantPortfolios]),
    [rosterPortfolios, applicantPortfolios]
  );
  const [accessDenied, setAccessDenied] = useState(false);
  const [portfolio, setPortfolio] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState('');
  const [emailedFilter, setEmailedFilter] = useState(''); // '' | 'never' | 'already'
  const [search, setSearch] = useState('');
  const [cmsLookup, setCmsLookup] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // 'email' and 'status' are both "pick some applicants and act on them",
  // so they share one selection rather than each owning a parallel copy.
  // They differ in exactly one place: an applicant with no usable email
  // cannot be a recipient, but can absolutely have their status changed.
  const [mode, setMode] = useState(null); // null | 'email' | 'status'
  const sendMode = mode === 'email';
  const statusMode = mode === 'status';
  const selectMode = mode !== null;
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const flashBulk = useTier2Flash();
  // Map, not Set: keyed by CMS ID but storing the full applicant object at
  // the moment it was selected, so someone selected while a search term
  // was narrower still counts once the term changes or the compose panel
  // opens, search alone deliberately doesn't clear selection (only the
  // Portfolio/Status filters do, see handlePortfolioChange below).
  const [selected, setSelected] = useState(new Map());
  const [composeOpen, setComposeOpen] = useState(false);

  const canView = role === 'admin' || role === 'manager';

  useEffect(() => {
    if (rosterInfoLoading) return;
    const isManagerOrAdmin = role === 'admin' || role === 'manager';
    const preferred =
      defaultPortfolio && rosterPortfolios.includes(defaultPortfolio)
        ? defaultPortfolio
        : isManagerOrAdmin
        ? ''
        : rosterPortfolios[0] || '';
    setPortfolio(preferred);
  }, [rosterInfoLoading, role, defaultPortfolio, rosterPortfolios]);

  const loadApplicants = useCallback(() => {
    if (portfolio === undefined || !canView) return;
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams({ portfolio, search, status: statusFilter, emailed: emailedFilter });
    fetch(`/api/applicants?${params}`)
      .then(async (res) => {
        if (res.status === 403) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.error) {
          setLoadError(data.error);
          setLoading(false);
          return;
        }
        setApplicants(data.applicants || []);
        setApplicantPortfolios(data.portfolios || []);
        setLoading(false);
      })
      .catch(() => {
        setLoadError('Could not reach the server. Try again.');
        setLoading(false);
      });
  }, [portfolio, search, statusFilter, emailedFilter, canView]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  function handleCmsLookup(e) {
    e.preventDefault();
    if (cmsLookup.trim()) window.location.href = `/recruitment/${cmsLookup.trim()}`;
  }

  function exportCSV() {
    const csv = toCSV(
      ['Name', 'CMS ID', 'Portfolio', 'Status'],
      applicants.map((a) => ({
        Name: a.fullName,
        'CMS ID': a.cmsId,
        Portfolio: a.portfolio,
        Status: a.status || '',
      }))
    );
    downloadCSV(`applicants-${portfolio || 'all-portfolios'}.csv`, csv);
  }

  // Switching either filter while in send mode clears the current
  // selection, so nobody stays ticked who's no longer even visible under
  // the new filter (spec section 8).
  function handlePortfolioChange(value) {
    setPortfolio(value);
    if (selectMode) setSelected(new Map());
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    if (selectMode) setSelected(new Map());
  }

  function handleEmailedFilterChange(value) {
    setEmailedFilter(value);
    if (selectMode) setSelected(new Map());
  }

  function switchMode(next) {
    setMode((prev) => (prev === next ? null : next));
    setSelected(new Map());
    setBulkStatus('');
  }

  function toggleRecipient(applicant, checked) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(applicant.cmsId, applicant);
      else next.delete(applicant.cmsId);
      return next;
    });
  }

  const sendableApplicants = applicants.filter((a) => isSendableEmail(a.email));
  const skippedApplicants = applicants.filter((a) => !isSendableEmail(a.email));
  // Status mode can act on everyone on screen; email mode only on the
  // people who actually have an address.
  const selectableApplicants = statusMode ? applicants : sendableApplicants;
  const allVisibleSelected =
    selectableApplicants.length > 0 && selectableApplicants.every((a) => selected.has(a.cmsId));

  function toggleSelectAll(checked) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) {
        selectableApplicants.forEach((a) => next.set(a.cmsId, a));
      } else {
        applicants.forEach((a) => next.delete(a.cmsId));
      }
      return next;
    });
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    setBulkSaving(true);
    let data = {};
    try {
      const res = await fetch('/api/applicants/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmsIds: [...selected.keys()], status: bulkStatus }),
      });
      data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Could not update the status.');
        setBulkSaving(false);
        return;
      }
    } catch {
      toast('Could not reach the server.');
      setBulkSaving(false);
      return;
    }

    // Bulk action: every affected row pulses in the same frame via the
    // Tier 2 primitive, never the richer single-row sweep in a loop.
    document
      .querySelectorAll('[data-applicant-row]')
      .forEach((row) => selected.has(row.dataset.applicantRow) && flashBulk(row));

    const parts = [`${data.updated} updated`];
    if (data.unchanged) parts.push(`${data.unchanged} already ${bulkStatus}`);
    if (data.notFound) parts.push(`${data.notFound} no longer in the sheet`);
    toast(parts.join(', '));

    setBulkSaving(false);
    setSelected(new Map());
    loadApplicants();
  }

  const showPortfolioColumn = canView && !portfolio;
  const columnCount = (showPortfolioColumn ? 4 : 3) + (selectMode ? 1 : 0) + (sendMode ? 1 : 0);

  if (role !== null && !canView) {
    return <AccessDenied message="Recruitment is for managers and admins." />;
  }
  if (accessDenied) {
    return <AccessDenied message="Recruitment is for managers and admins." />;
  }

  return (
    <Tier1Group replayKey={loading}>
      <ChromeHeader
        title="Recruitment"
        subtitle="Look up applicants, review interviews, and browse portfolio applications."
        actions={
          <>
            <button
              onClick={() => switchMode('status')}
              className={chromeHeaderButtonClass}
              disabled={sendMode}
            >
              {statusMode ? 'Cancel' : 'Set Status'}
            </button>
            <button
              onClick={() => switchMode('email')}
              className={sendMode ? chromeHeaderButtonClass : chromeHeaderPrimaryButtonClass}
              disabled={statusMode}
            >
              {sendMode ? 'Cancel' : 'Send Email'}
            </button>
          </>
        }
      />

      <Tier1Item className="mt-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-brand-800">Portfolio</label>
          <select
            value={portfolio ?? ''}
            onChange={(e) => handlePortfolioChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 sm:max-w-xs"
          >
            <option value="">All portfolios</option>
            {portfolios.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        {sendMode && (
          <div>
            <label className="block text-sm font-medium text-brand-800">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 sm:max-w-xs"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        {sendMode && (
          <div>
            <label className="block text-sm font-medium text-brand-800">Emailed</label>
            <select
              value={emailedFilter}
              onChange={(e) => handleEmailedFilterChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 sm:max-w-xs"
            >
              <option value="">All</option>
              <option value="never">Never emailed</option>
              <option value="already">Already emailed</option>
            </select>
          </div>
        )}
      </Tier1Item>

      {!sendMode && (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h2 className="font-serif text-lg font-semibold text-brand-900">CMS ID lookup</h2>
          <form onSubmit={handleCmsLookup} className="mt-3 flex gap-3">
            <input
              value={cmsLookup}
              onChange={(e) => setCmsLookup(e.target.value)}
              placeholder="Enter CMS ID"
              className="flex-1 rounded-lg border border-brand-300 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-900 px-5 py-2 font-medium text-brand-50 hover:bg-brand-800"
            >
              Search
            </button>
          </form>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-brand-900">Applicants</h2>
          {!sendMode && (
            <button
              onClick={exportCSV}
              disabled={applicants.length === 0}
              className="rounded-lg border border-brand-300 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
            >
              Export CSV
            </button>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or CMS ID"
          className="mt-3 w-full rounded-lg border border-brand-300 px-3 py-2"
        />

        {statusMode && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-brand-700">
              {selected.size} applicant{selected.size === 1 ? '' : 's'} selected.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                aria-label="Status to set"
                className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm"
              >
                <option value="">Choose a status</option>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <button
                onClick={applyBulkStatus}
                disabled={selected.size === 0 || !bulkStatus || bulkSaving}
                className="rounded-lg bg-brand-900 px-4 py-1.5 text-sm font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
              >
                {bulkSaving ? 'Updating…' : 'Set status'}
              </button>
            </div>
          </div>
        )}

        {sendMode && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-brand-700">
              {selected.size} recipient{selected.size === 1 ? '' : 's'} selected.
            </p>
            <button
              onClick={() => setComposeOpen(true)}
              disabled={selected.size === 0}
              className="rounded-lg bg-brand-900 px-4 py-1.5 text-sm font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              Draft Email
            </button>
          </div>
        )}

        <Tier1Item className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-medium uppercase tracking-wide text-brand-700">
              <tr>
                {selectMode && (
                  <th className="py-2 pr-4">
                    <label className="inline-flex h-6 w-6 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        disabled={selectableApplicants.length === 0}
                      />
                    </label>
                  </th>
                )}
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">CMS ID</th>
                {showPortfolioColumn && <th className="py-2 pr-4">Portfolio</th>}
                <th className="py-2 pr-4">Status</th>
                {sendMode && <th className="py-2 pr-4">Last emailed</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={5} columns={columnCount} cellClassName="py-2 pr-4" />
              ) : loadError ? (
                <tr>
                  <td colSpan={columnCount} className="py-6">
                    <ErrorRetry message={loadError} onRetry={loadApplicants} />
                  </td>
                </tr>
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="py-6 text-center text-brand-700">
                    No applicants found.
                  </td>
                </tr>
              ) : (
                applicants.map((a) => {
                  const sendable = isSendableEmail(a.email);
                  return (
                    <tr
                      key={a.cmsId}
                      data-applicant-row={a.cmsId}
                      className="nxc-glass-row border-t border-brand-100/50"
                    >
                      {selectMode && (
                        <td className="py-2 pr-4">
                          <label className="inline-flex h-6 w-6 cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${a.fullName}`}
                              checked={selected.has(a.cmsId)}
                              disabled={sendMode && !sendable}
                              onChange={(e) => toggleRecipient(a, e.target.checked)}
                            />
                          </label>
                          {sendMode && !sendable && (
                            <span className="ml-2 text-xs text-brand-700">no email</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-4">
                        <Link
                          href={`/recruitment/${a.cmsId}`}
                          className="font-medium text-brand-900 hover:underline"
                        >
                          {a.fullName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-brand-700">{a.cmsId}</td>
                      {showPortfolioColumn && <td className="py-2 pr-4">{a.portfolio}</td>}
                      <td className="py-2 pr-4">{a.status || 'None yet'}</td>
                      {sendMode && (
                        <td className="py-2 pr-4 text-brand-700">{formatLastEmailed(a.lastEmailedAt)}</td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Tier1Item>
      </div>

      {composeOpen && (
        <ComposePanel
          recipients={Array.from(selected.values())}
          skipped={skippedApplicants}
          statuses={STATUSES}
          onClose={() => setComposeOpen(false)}
          onSendComplete={() => {
            setComposeOpen(false);
            setMode(null);
            setSelected(new Map());
            loadApplicants();
          }}
        />
      )}
    </Tier1Group>
  );
}
