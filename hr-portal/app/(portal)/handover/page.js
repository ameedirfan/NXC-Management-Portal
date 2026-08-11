'use client';

import { useEffect, useState } from 'react';
import { toCSV, downloadCSV } from '@/lib/csv';

function formatMoney(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6">
      <h2 className="font-serif text-lg font-semibold text-brand-900">{title}</h2>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}

function DataTable({ columns, rows }) {
  if (rows.length === 0) return <p className="text-sm text-brand-400">Nothing on file.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-brand-100 text-brand-700">
        <tr>
          {columns.map((c) => (
            <th key={c.key} className="px-3 py-2">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-brand-100">
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2">
                {row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ROSTER_COLS = [
  { key: 'fullName', label: 'Name' },
  { key: 'cmsId', label: 'CMS ID' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'designation', label: 'Designation' },
  { key: 'contactNo', label: 'Contact' },
  { key: 'email', label: 'Email' },
];

const FINANCE_COLS = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount' },
  { key: 'type', label: 'Type' },
  { key: 'recordedBy', label: 'Recorded By' },
];

const ATTENDANCE_COLS = [
  { key: 'date', label: 'Date' },
  { key: 'scope', label: 'Scope' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'meetingStatus', label: 'Meeting Status' },
  { key: 'fullName', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'markedBy', label: 'Marked By' },
];

const TRIPS_COLS = [
  { key: 'location', label: 'Location' },
  { key: 'days', label: 'Days' },
  { key: 'participantCount', label: 'Participants' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'dateAdded', label: 'Date Added' },
];

export default function HandoverPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetch('/api/handover')
      .then(async (res) => {
        if (res.status === 403) {
          setAccessDenied(true);
          return;
        }
        const json = await res.json();
        if (json.error) {
          setLoadError(json.error);
          return;
        }
        setData(json);
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  function exportCSV() {
    if (!data) return;
    const sections = [
      ['Roster snapshot', ROSTER_COLS, data.roster],
      [
        'Finance summary',
        FINANCE_COLS,
        [
          ...data.finance.entries,
          {
            date: '',
            description: `Treasury Balance (opening ${formatMoney(data.finance.openingBalance)}, income ${formatMoney(
              data.finance.totalIncome
            )}, expense ${formatMoney(data.finance.totalExpense)})`,
            amount: data.finance.treasuryBalance,
            type: '',
            recordedBy: '',
          },
        ],
      ],
      ['Full attendance history', ATTENDANCE_COLS, data.attendanceHistory],
      ['Trip records', TRIPS_COLS, data.trips],
    ];

    const lines = [`Year-End Handover Export, generated ${new Date(data.generatedAt).toLocaleString()}`, ''];
    for (const [title, columns, rows] of sections) {
      lines.push(title);
      lines.push(
        toCSV(
          columns.map((c) => c.label),
          rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, r[c.key]])))
        )
      );
      lines.push('');
    }
    downloadCSV('nxc-handover-export.csv', lines.join('\n'));
  }

  if (accessDenied) {
    return <p className="text-red-700">Admin access required for the Year-End Handover Export.</p>;
  }

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-900">Year-End Handover Export</h1>
          <p className="mt-1 text-brand-500">
            Roster, Finance, full attendance history, and Trip records, in one bundle for the next exec.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
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

      {loading || !data ? (
        <p className={`mt-6 ${loadError ? 'text-red-700' : 'text-brand-400'}`}>
          {loading ? 'Loading…' : loadError || 'Could not load handover data.'}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-brand-200 bg-white p-6">
            <p className="text-xs uppercase tracking-wide text-brand-500">Treasury Balance</p>
            <p className="mt-1 font-serif text-3xl font-bold tabular-nums text-brand-900">
              {formatMoney(data.finance.treasuryBalance)}
            </p>
            <p className="mt-1 text-sm text-brand-500">
              Opening {formatMoney(data.finance.openingBalance)}, income {formatMoney(data.finance.totalIncome)},
              expense {formatMoney(data.finance.totalExpense)}
            </p>
          </div>

          <Section title={`Roster snapshot (${data.roster.length})`}>
            <DataTable columns={ROSTER_COLS} rows={data.roster} />
          </Section>

          <Section title={`Finance ledger (${data.finance.entries.length} entries)`}>
            <DataTable columns={FINANCE_COLS} rows={data.finance.entries} />
          </Section>

          <Section title={`Full attendance history (${data.attendanceHistory.length} records)`}>
            <DataTable columns={ATTENDANCE_COLS} rows={data.attendanceHistory} />
          </Section>

          <Section title={`Trip records (${data.trips.length})`}>
            <DataTable columns={TRIPS_COLS} rows={data.trips} />
          </Section>
        </div>
      )}
    </div>
  );
}
