'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { toCSV, downloadCSV } from '@/lib/csv';
import { Skeleton } from '@/components/ui/Skeleton';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import ErrorRetry from '@/components/ui/ErrorRetry';
import TiltCard, { glassCardClass } from '@/components/motion/TiltCard';
import ChromeHeader, { chromeHeaderButtonClass } from '@/components/motion/ChromeHeader';
import { useTier1Reveal } from '@/lib/motion';

const VIEWS = [
  { key: 'individual', label: 'Individual' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'council', label: 'Council-wide' },
];

// Tier 1: bars grow in once, staggered, when the data first arrives —
// starts at 0 width and transitions to the real width on the next paint.
// Re-renders with the same data don't replay this (the width just stays
// put, nothing to transition from/to), only a genuinely new dataset does.
function BarChart({ data, labelKey, valueKey, unit = '', color = 'rgb(var(--brand-900))' }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    setGrown(false);
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, [data]);

  return (
    <div className="mt-4 space-y-2">
      {data.length === 0 && <p className="text-sm text-brand-700">No data yet.</p>}
      {data.map((d, i) => (
        <div key={d[labelKey]} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-brand-700" title={d[labelKey]}>
            {d[labelKey]}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-brand-100">
            <div
              className="h-full rounded-sm transition-[width] duration-700"
              style={{
                width: grown ? `${(d[valueKey] / max) * 100}%` : '0%',
                backgroundColor: color,
                transitionTimingFunction: 'var(--ease-out)',
                transitionDelay: `${Math.min(i, 10) * 40}ms`,
              }}
            />
          </div>
          <span className="w-14 shrink-0 text-right tabular-nums text-brand-700">
            {d[valueKey]}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

const TILE_GRID_CLASSES = { 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' };

// Used inside a view that already has its own card border + heading —
// just the tiles-and-bars shape.
function StatBlockSkeleton({ tiles = 3 }) {
  return (
    <div className="mt-4">
      <div className={`grid gap-3 ${TILE_GRID_CLASSES[tiles] || TILE_GRID_CLASSES[3]}`}>
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

// Used at the top level, before any card exists yet — a full card shape.
function DashboardCardSkeleton({ tiles = 3 }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <StatBlockSkeleton tiles={tiles} />
    </div>
  );
}

// Tier 1: summary/stat tiles get the dimensional tilt treatment (spec
// 3.1) — never used on dense table rows, only these once-glanced-at
// cards.
function StatTile({ label, value, suffix = '' }) {
  return (
    <TiltCard className={`rounded-lg px-4 py-3 ${glassCardClass}`}>
      <p className="text-xs uppercase tracking-wide text-brand-700">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-brand-900">
        <AnimatedNumber value={value} />
        {suffix}
      </p>
    </TiltCard>
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
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-brand-900">Individual attendance</h2>
        <select
          value={cmsId}
          onChange={(e) => setCmsId(e.target.value)}
          className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm"
        >
          {rosterMembers.map((m) => (
            <option key={m.cmsId} value={m.cmsId}>
              {m.fullName}
            </option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <StatBlockSkeleton tiles={4} />
      ) : data.error ? (
        <p className="mt-4 text-sm text-red-700">{data.error}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-brand-700">
            {data.person.fullName}, {data.person.portfolio}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Present" value={data.counts.present} />
            <StatTile label="Absent" value={data.counts.absent} />
            <StatTile label="Leave" value={data.counts.leave} />
            <StatTile label="Attendance %" value={data.percentage} suffix="%" />
          </div>
          <h3 className="mt-6 text-sm font-medium text-brand-700">Trend, cumulative percent present</h3>
          <BarChart data={data.trend} labelKey="date" valueKey="presentPct" unit="%" color="rgb(var(--brand-500))" />
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
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-brand-900">Portfolio attendance</h2>
        <select
          value={portfolio}
          onChange={(e) => setPortfolio(e.target.value)}
          className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm"
        >
          {portfolios.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <StatBlockSkeleton tiles={3} />
      ) : data.error ? (
        <p className="mt-4 text-sm text-red-700">{data.error}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile label="Present" value={data.overall.present} />
            <StatTile label="Absent" value={data.overall.absent} />
            <StatTile label="Attendance %" value={data.overall.percentage} suffix="%" />
          </div>
          <h3 className="mt-6 text-sm font-medium text-brand-700">Trend, percent present per meeting date</h3>
          <BarChart data={data.trend} labelKey="date" valueKey="presentPct" unit="%" color="rgb(var(--brand-500))" />

          <h3 className="mt-6 text-sm font-medium text-brand-700">Member by member</h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-brand-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-100 text-xs font-medium uppercase tracking-wide text-brand-700">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Present</th>
                  <th className="px-3 py-2">Absent</th>
                  <th className="px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.cmsId} className="border-t border-brand-100 hover:bg-brand-50">
                    <td className="px-3 py-2">{m.fullName}</td>
                    <td className="px-3 py-2 tabular-nums">{m.present}</td>
                    <td className="px-3 py-2 tabular-nums">{m.absent}</td>
                    <td className="px-3 py-2 tabular-nums">{m.percentage}%</td>
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
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <h2 className="font-serif text-lg font-semibold text-brand-900">Council-wide attendance</h2>
      <p className="text-sm text-brand-700">Every meeting on file, every portfolio, rolled up.</p>

      {loading || !data ? (
        <StatBlockSkeleton tiles={3} />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile label="Present" value={data.overall.present} />
            <StatTile label="Absent" value={data.overall.absent} />
            <StatTile label="Attendance %" value={data.overall.percentage} suffix="%" />
          </div>
          <h3 className="mt-6 text-sm font-medium text-brand-700">Trend, percent present per meeting date</h3>
          <BarChart data={data.trend} labelKey="date" valueKey="presentPct" unit="%" color="rgb(var(--brand-500))" />

          <h3 className="mt-6 text-sm font-medium text-brand-700">By portfolio, plus Council Meets</h3>
          <BarChart data={data.byPortfolio} labelKey="label" valueKey="percentage" unit="%" color="rgb(var(--brand-700))" />
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState('council');
  const [role, setRole] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [rosterMembers, setRosterMembers] = useState([]);
  const [applicants, setApplicants] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [councilData, setCouncilData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState('');
  const contentRef = useRef(null);
  // Tier 1: cards stagger in once when the page's data finishes loading
  // — this ref/selector pair re-fires each time the content section
  // remounts (loading -> loaded), not on every unrelated re-render.
  useTier1Reveal(contentRef, { selector: '[data-tier1]', deps: [loading] });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
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
        const firstError = dash.error || dq.error || rosterData.error || council.error;
        if (firstError) {
          setLoadError(firstError);
          return;
        }
        setPortfolios(dash.portfolios || []);
        setApplicants(dash.applicants || null);
        setDataQuality(dq);
        setRosterMembers(rosterData.members || []);
        setRole(rosterData.role || null);
        setCouncilData(council);
        setAccessDenied(false);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
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
    return <AccessDenied message="The Dashboard is for managers and admins." />;
  }

  return (
    <div>
      <ChromeHeader
        title="Dashboard"
        subtitle="Attendance across three views, and the recruitment funnel."
        actions={
          <>
            {role === 'admin' && (
              <Link href="/handover" className={chromeHeaderButtonClass}>
                Year-End Handover Export
              </Link>
            )}
            <button onClick={exportAllCSV} disabled={!applicants} className={chromeHeaderButtonClass}>
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={!applicants}
              className={chromeHeaderButtonClass}
              title="Uses your browser's print dialog. Choose Save as PDF as the destination."
            >
              Export PDF
            </button>
          </>
        }
      />

      {loading || !applicants ? (
        loadError ? (
          <ErrorRetry className="mt-6" message={loadError} onRetry={load} />
        ) : (
          <div className="mt-6 space-y-6">
            <DashboardCardSkeleton tiles={3} />
            <DashboardCardSkeleton tiles={3} />
          </div>
        )
      ) : (
        <div ref={contentRef} className="mt-6 space-y-6">
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

          <div key={viewMode} data-tier1 className="nxc-page-in">
            {viewMode === 'individual' && <IndividualView rosterMembers={rosterMembers} />}
            {viewMode === 'portfolio' && <PortfolioView portfolios={portfolios} />}
            {viewMode === 'council' && <CouncilView data={councilData} loading={loading} />}
          </div>

          <div data-tier1 className="rounded-xl border border-brand-200 bg-brand-50 p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicant funnel</h2>
            <p className="text-sm text-brand-700">Every applicant, across every portfolio, grouped by status.</p>
            <BarChart data={applicants.funnel} labelKey="status" valueKey="count" color="rgb(var(--brand-600))" />
          </div>

          {/* Deliberately its own card, not merged into the funnel above:
              "where they are in the process" and "have we contacted them"
              are different questions, see spec section 3 and 6. */}
          <div data-tier1 className="rounded-xl border border-brand-200 bg-brand-50 p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicants emailed</h2>
            <p className="text-sm text-brand-700">How many applicants have received at least one email.</p>
            <div className="mt-4 flex items-center gap-4">
              <p className="font-serif text-3xl font-bold tabular-nums text-brand-900">
                <AnimatedNumber value={applicants.emailedCount} /> of{' '}
                <AnimatedNumber value={applicants.total} />
              </p>
              <div className="h-3 flex-1 max-w-xs overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-brand-700"
                  style={{
                    width: `${applicants.total ? (applicants.emailedCount / applicants.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div data-tier1 className="rounded-xl border border-brand-200 bg-brand-50 p-6">
            <h2 className="font-serif text-lg font-semibold text-brand-900">Applicants by portfolio</h2>
            <BarChart data={applicants.byPortfolio} labelKey="portfolio" valueKey="total" color="rgb(var(--brand-400))" />
          </div>

          <div data-tier1>
            <DataQualitySection dataQuality={dataQuality} />
          </div>
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
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <h2 className="font-serif text-lg font-semibold text-brand-900">Data quality</h2>
      <p className="text-sm text-brand-700">Housekeeping checks across Roster, Logins, and Applicants.</p>

      {issueCount === 0 ? (
        <p className="mt-4 text-sm text-brand-700">No issues found.</p>
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
      <ul className="mt-2 space-y-1 text-sm text-brand-700">
        {items.map((item, i) => (
          <li key={i}>{render(item)}</li>
        ))}
      </ul>
    </div>
  );
}
