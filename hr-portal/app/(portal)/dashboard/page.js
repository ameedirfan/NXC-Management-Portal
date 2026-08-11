'use client';

import { useEffect, useState, useCallback } from 'react';
import { toCSV, downloadCSV } from '@/lib/csv';

const VIEWS = [
  { key: 'individual', label: 'Individual' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'council', label: 'Council-wide' },
];

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

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-brand-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-brand-900">{value}</p>
    </div>
  );
}

function IndividualView({ rosterMembers }) {
  const [cmsId, setCmsId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cmsId && rosterMembers.length > 0) setCmsId(rosterMembers[0].cmsId);
  }, [rosterMembers, cmsId]);

  useEffect(() => {
    if (!cmsId) return;
    setLoading(true);
    fetch(`/api/dashboard/attendance?view=individual&cmsId=${encodeURIComponent(cmsId)}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [cmsId]);

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-brand-900">Individual attendance</h2>
        <select
          value={cmsId}
          onChange={(e) => setCmsId(e.target.value)}
          className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm"
        >
          {rosterMembers.map((m) => (
            <option key={m.cmsId} value={m.cmsId}>
              {m.fullName}
            </option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <p className="mt-4 text-sm text-brand-400">Loading…</p>
      ) : data.error ? (
        <p className="mt-4 text-sm text-red-700">{data.error}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-brand-500">
            {data.person.fullName}, {data.person.portfolio}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Present" value={data.counts.present} />
            <StatTile label="Absent" value={data.counts.absent} />
            <StatTile label="Leave" value={data.counts.leave} />
            <StatTile label="Attendance %" value={`${data.percentage}%`} />
          </div>
          <h3 className="mt-6 text-sm font-medium text-brand-700">Trend, cumulative percent present</h3>
          <BarChart data={data.trend} labelKey="date" valueKey="presentPct" unit="%" color="#9c7539" />
        </>
      )}
    </div>
  );
}

function PortfolioView({ portfolios }) {
  const [portfolio, setPortfolio] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!portfolio && portfolios.length > 0) setPortfolio(portfolios[0]);
  }, [portfolios, portfolio]);

  useEffect(() => {
    if (!portfolio) return;
    setLoading(true);
    fetch(`/api/dashboard/attendance?view=portfolio&portfolio=${encodeURIComponent(portfolio)}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [portfolio]);

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-brand-900">Portfolio attendance</h2>
        <select
          value={portfolio}
          onChange={(e) => setPortfolio(e.target.value)}
          className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm"
        >
          {portfolios.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <p className="mt-4 text-sm text-brand-400">Loading…</p>
      ) : data.error ? (
        <p className="mt-4 text-sm text-red-700">{data.error}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile label="Present" value={data.overall.present} />
            <StatTile label="Absent" value={data.overall.absent} />
            <StatTile label="Attendance %" value={`${data.overall.percentage}%`} />
          </div>
          <h3 className="mt-6 text-sm font-medium text-brand-700">Trend, percent present per meeting date</h3>
          <BarChart data={data.trend} labelKey="date" valueKey="presentPct" unit="%" color="#9c7539" />

          <h3 className="mt-6 text-sm font-medium text-brand-700">Member by member</h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-brand-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-100 text-brand-700">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Present</th>
                  <th className="px-3 py-2">Absent</th>
                  <th className="px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.cmsId} className="border-t border-brand-100">
                    <td className="px-3 py-2">{m.fullName}</td>
                    <td className="px-3 py-2">{m.present}</td>
                    <td className="px-3 py-2">{m.absent}</td>
                    <td className="px-3 py-2">{m.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CouncilView({ data, loading }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6">
      <h2 className="font-serif text-lg font-semibold text-brand-900">Council-wide attendance</h2>
      <p className="text-sm text-brand-500">Every meeting on file, every portfolio, rolled up.</p>

      {loading || !data ? (
        <p className="mt-4 text-sm text-brand-400">Loading…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile label="Present" value={data.overall.present} />
            <StatTile label="Absent" value={data.overall.absent} />
            <StatTile label="Attendance %" value={`${data.overall.percentage}%`} />
          </div>
          <h3 className="mt-6 text-sm font-medium text-brand-700">Trend, percent present per meeting date</h3>
          <BarChart data={data.trend} labelKey="date" valueKey="presentPct" unit="%" color="#9c7539" />

          <h3 className="mt-6 text-sm font-medium text-brand-700">By portfolio, plus Council Meets</h3>
          <BarChart data={data.byPortfolio} labelKey="label" valueKey="percentage" unit="%" color="#5f4322" />
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState('council');
  const [portfolios, setPortfolios] = useState([]);
  const [rosterMembers, setRosterMembers] = useState([]);
  const [applicants, setApplicants] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [councilData, setCouncilData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/dashboard/data-quality'),
      fetch('/api/roster?view=full'),
      fetch('/api/dashboard/attendance?view=council'),
    ])
      .then(async ([dashRes, dqRes, rosterRes, councilRes]) => {
        if (dashRes.status === 403 || dqRes.status === 403 || rosterRes.status === 403) {
          setAccessDenied(true);
          return;
        }
        const [dash, dq, rosterData, council] = await Promise.all([
          dashRes.json(),
          dqRes.json(),
          rosterRes.json(),
          councilRes.json(),
        ]);
        setPortfolios(dash.portfolios || []);
        setApplicants(dash.applicants || null);
        setDataQuality(dq);
        setRosterMembers(rosterData.members || []);
        setCouncilData(council);
        setAccessDenied(false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function exportAllCSV() {
    if (!applicants) return;
    const sections = [
      ['Applicant funnel', ['Status', 'Count'], applicants.funnel.map((r) => [r.status, r.count])],
      ['Applicants by portfolio', ['Portfolio', 'Total'], applicants.byPortfolio.map((r) => [r.portfolio, r.total])],
    ];
    if (councilData) {
      sections.unshift([
        'Council-wide attendance by portfolio',
        ['Portfolio', 'Percent present'],
        councilData.byPortfolio.map((r) => [r.label, r.percentage]),
      ]);
    }
    const lines = [];
    for (const [title, headers, rows] of sections) {
      lines.push(title);
      lines.push(toCSV(headers, rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])))));
      lines.push('');
    }
    downloadCSV('dashboard-export.csv', lines.join('\n'));
  }

  if (accessDenied) {
    return <p className="text-red-700">Manager or Admin access required to view the dashboard.</p>;
  }

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Dashboard</h1>
          <p className="mt-1 text-brand-500">Attendance across three views, and the recruitment funnel.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAllCSV}
            disabled={!applicants}
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!applicants}
            className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
            title="Uses your browser's print dialog. Choose Save as PDF as the destination."
          >
            Export PDF
          </button>
        </div>
      </div>

      {loading && !applicants ? (
        <p className="mt-6 text-brand-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="no-print flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  viewMode === v.key
                    ? 'bg-brand-900 text-brand-50'
                    : 'border border-brand-300 text-brand-700 hover:bg-brand-100'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {viewMode === 'individual' && <IndividualView rosterMembers={rosterMembers} />}
          {viewMode === 'portfolio' && <PortfolioView portfolios={portfolios} />}
          {viewMode === 'council' && <CouncilView data={councilData} loading={loading} />}

          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicant funnel</h2>
            <p className="text-sm text-brand-500">Every applicant, across every portfolio, grouped by status.</p>
            <BarChart data={applicants.funnel} labelKey="status" valueKey="count" color="#7d5a2c" />
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicants by portfolio</h2>
            <BarChart data={applicants.byPortfolio} labelKey="portfolio" valueKey="total" color="#b9954f" />
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
