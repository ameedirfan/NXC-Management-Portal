'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toCSV, downloadCSV } from '@/lib/csv';

export default function RecruitmentPage() {
  const [portfolios, setPortfolios] = useState([]);
  const [role, setRole] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [portfolio, setPortfolio] = useState(undefined);
  const [search, setSearch] = useState('');
  const [cmsLookup, setCmsLookup] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);

  const canView = role === 'admin' || role === 'manager';

  useEffect(() => {
    fetch('/api/roster')
      .then((res) => res.json())
      .then((data) => {
        setPortfolios(data.portfolios || []);
        setRole(data.role || 'member');
        const isManagerOrAdmin = data.role === 'admin' || data.role === 'manager';
        const preferred =
          data.defaultPortfolio && data.portfolios?.includes(data.defaultPortfolio)
            ? data.defaultPortfolio
            : isManagerOrAdmin
            ? ''
            : data.portfolios?.[0] || '';
        setPortfolio(preferred);
      });
  }, []);

  const loadApplicants = useCallback(() => {
    if (portfolio === undefined || !canView) return;
    setLoading(true);
    const params = new URLSearchParams({ portfolio, search });
    fetch(`/api/applicants?${params}`)
      .then(async (res) => {
        if (res.status === 403) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setApplicants(data.applicants || []);
        setLoading(false);
      });
  }, [portfolio, search, canView]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  function handleCmsLookup(e) {
    e.preventDefault();
    if (cmsLookup.trim()) window.location.href = `/recruitment/${cmsLookup.trim()}`;
  }

  function exportCSV() {
    const csv = toCSV(
      ['Full Name', 'CMS ID', 'Portfolio', '1st Preference', '2nd Preference', 'Status'],
      applicants.map((a) => ({
        'Full Name': a.fullName,
        'CMS ID': a.cmsId,
        Portfolio: a.portfolio,
        '1st Preference': a.firstPreference,
        '2nd Preference': a.secondPreference,
        Status: a.status || '',
      }))
    );
    downloadCSV(`applicants-${portfolio || 'all-portfolios'}.csv`, csv);
  }

  const showPortfolioColumn = canView && !portfolio;

  if (role !== null && !canView) {
    return <p className="text-red-700">Manager or Admin access required to view Recruitment.</p>;
  }
  if (accessDenied) {
    return <p className="text-red-700">Manager or Admin access required to view Recruitment.</p>;
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-brand-900">Recruitment</h1>
      <p className="mt-1 text-brand-500">
        Look up applicants, review interviews, and browse portfolio applications.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-brand-800">Portfolio</label>
        <select
          value={portfolio ?? ''}
          onChange={(e) => setPortfolio(e.target.value)}
          className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 sm:max-w-xs"
        >
          <option value="">All portfolios</option>
          {portfolios.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
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

      <div className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-brand-900">Applicants</h2>
          <button
            onClick={exportCSV}
            disabled={applicants.length === 0}
            className="rounded-lg border border-brand-300 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            Export CSV
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or CMS ID"
          className="mt-3 w-full rounded-lg border border-brand-300 px-3 py-2"
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-brand-700">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">CMS ID</th>
                {showPortfolioColumn && <th className="py-2 pr-4">Portfolio</th>}
                <th className="py-2 pr-4">1st preference</th>
                <th className="py-2 pr-4">2nd preference</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showPortfolioColumn ? 6 : 5} className="py-6 text-center text-brand-400">
                    Loading…
                  </td>
                </tr>
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={showPortfolioColumn ? 6 : 5} className="py-6 text-center text-brand-400">
                    No applicants found.
                  </td>
                </tr>
              ) : (
                applicants.map((a) => (
                  <tr key={a.cmsId} className="border-t border-brand-100">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/recruitment/${a.cmsId}`}
                        className="font-medium text-brand-900 hover:underline"
                      >
                        {a.fullName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-brand-500">{a.cmsId}</td>
                    {showPortfolioColumn && <td className="py-2 pr-4">{a.portfolio}</td>}
                    <td className="py-2 pr-4">{a.firstPreference}</td>
                    <td className="py-2 pr-4">{a.secondPreference}</td>
                    <td className="py-2 pr-4">{a.status || 'None yet'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
