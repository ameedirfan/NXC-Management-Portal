'use client';

import { useEffect, useState, useCallback } from 'react';
import { toCSV, downloadCSV } from '@/lib/csv';

function BarChart({ data, labelKey, valueKey, unit = '', color = '#3a2814' }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="mt-4 space-y-2">
      {data.length === 0 && <p className="text-sm text-brand-400">No data yet.</p>}
      {data.map((d) => (
        <div key={d[labelKey]} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-brand-700" title={d[labelKey]}>
            {d[labelKey]}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-brand-100">
            <div
              className="h-full rounded"
              style={{ width: `${(d[valueKey] / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-brand-500">
            {d[valueKey]}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [portfolios, setPortfolios] = useState([]);
  const [trendPortfolio, setTrendPortfolio] = useState('');
  const [data, setData] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams(trendPortfolio ? { portfolio: trendPortfolio } : {});
    Promise.all([
      fetch(`/api/dashboard?${params}`),
      fetch('/api/dashboard/data-quality'),
    ])
      .then(async ([dashRes, dqRes]) => {
        if (dashRes.status === 403 || dqRes.status === 403) {
          setAccessDenied(true);
          return;
        }
        const [json, dq] = await Promise.all([dashRes.json(), dqRes.json()]);
        setData(json);
        setPortfolios(json.portfolios || []);
        setDataQuality(dq);
        setAccessDenied(false);
      })
      .finally(() => setLoading(false));
  }, [trendPortfolio]);

  useEffect(() => {
    load();
  }, [load]);

  function exportAllCSV() {
    if (!data) return;
    const sections = [
      ['Attendance by portfolio', ['Portfolio', 'Meetings held', 'Avg percent present'],
        data.attendance.byPortfolio.map((r) => [r.portfolio, r.meetingsHeld, r.avgPresentPct])],
      [`Attendance trend, ${trendPortfolio || 'all portfolios'}`, ['Date', 'Percent present'],
        data.attendance.trend.map((r) => [r.date, r.presentPct])],
      ['Applicant funnel', ['Status', 'Count'], data.applicants.funnel.map((r) => [r.status, r.count])],
      ['Applicants by portfolio', ['Portfolio', 'Total'],
        data.applicants.byPortfolio.map((r) => [r.portfolio, r.total])],
    ];
    const lines = [];
    for (const [title, headers, rows] of sections) {
      lines.push(title);
      lines.push(toCSV(headers, rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])))));
      lines.push('');
    }
    downloadCSV('dashboard-export.csv', lines.join('\n'));
  }

  if (accessDenied) {
    return <p className="text-red-700">Admin access required to view the dashboard.</p>;
  }

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Dashboard</h1>
          <p className="mt-1 text-brand-500">Attendance trends and the recruitment funnel, at a glance.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAllCSV}
            disabled={!data}
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!data}
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
            title="Uses your browser's print dialog. Choose Save as PDF as the destination."
          >
            Export PDF
          </button>
        </div>
      </div>

      {!data ? (
        <p className="mt-6 text-brand-400">{loading ? 'Loading…' : 'Could not load dashboard data.'}</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Average attendance by portfolio</h2>
            <p className="text-sm text-brand-500">Percent of marked attendance that was Present, across every meeting on file.</p>
            <BarChart data={data.attendance.byPortfolio} labelKey="portfolio" valueKey="avgPresentPct" unit="%" color="#5f4322" />
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <div className="no-print flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold text-brand-900">Attendance trend</h2>
              <select
                value={trendPortfolio}
                onChange={(e) => setTrendPortfolio(e.target.value)}
                className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All portfolios</option>
                {portfolios.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-brand-500">
              Percent present per meeting date{trendPortfolio ? `, ${trendPortfolio}` : ', all portfolios combined'}
              , most recent {data.attendance.trend.length} meetings.
            </p>
            <BarChart data={data.attendance.trend} labelKey="date" valueKey="presentPct" unit="%" color="#9c7539" />
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicant funnel</h2>
            <p className="text-sm text-brand-500">Every applicant, across every portfolio, grouped by status.</p>
            <BarChart data={data.applicants.funnel} labelKey="status" valueKey="count" color="#7d5a2c" />
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicants by portfolio</h2>
            <BarChart data={data.applicants.byPortfolio} labelKey="portfolio" valueKey="total" color="#b9954f" />
          </div>

          <DataQualitySection dataQuality={dataQuality} />
        </div>
      )}
    </div>
  );
}

function DataQualitySection({ dataQuality }) {
  if (!dataQuality) return null;

  const issueCount =
    dataQuality.duplicateCmsIds.length +
    dataQuality.orphanedLogins.length +
    dataQuality.rosterWithoutLogin.length +
    dataQuality.applicantsBadPortfolio.length;

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6">
      <h2 className="font-serif text-lg font-semibold text-brand-900">Data quality</h2>
      <p className="text-sm text-brand-500">Housekeeping checks across Roster, Logins, and Applicants.</p>

      {issueCount === 0 ? (
        <p className="mt-4 text-sm text-brand-400">No issues found.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <IssueList
            title="Duplicate CMS IDs in Roster"
            items={dataQuality.duplicateCmsIds}
            render={(i) => `${i.cmsId}, ${i.names.join(', ')}`}
          />
          <IssueList
            title="Logins pointing at a CMS ID no longer on the roster"
            items={dataQuality.orphanedLogins}
            render={(i) => `${i.username} points to CMS ID ${i.cmsId}`}
            linkFor={() => `/roster/logins`}
            linkLabel="Fix in Logins"
          />
          <IssueList
            title="Roster members with no login"
            items={dataQuality.rosterWithoutLogin}
            render={(i) => `${i.fullName}, ${i.cmsId}, ${i.portfolio}`}
            linkFor={() => `/roster/logins`}
            linkLabel="Add a login"
          />
          <IssueList
            title="Applicants with a missing or unrecognized portfolio"
            items={dataQuality.applicantsBadPortfolio}
            render={(i) => `${i.fullName}, ${i.cmsId}, listed as ${i.portfolio}`}
          />
        </div>
      )}
    </div>
  );
}

function IssueList({ title, items, render, linkFor, linkLabel }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-brand-700">
          {title} ({items.length})
        </h3>
        {linkFor && (
          <a href={linkFor(items[0])} className="no-print text-sm font-medium text-brand-900 hover:underline">
            {linkLabel}
          </a>
        )}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-brand-500">
        {items.map((item, i) => (
          <li key={i}>{render(item)}</li>
        ))}
      </ul>
    </div>
  );
}
