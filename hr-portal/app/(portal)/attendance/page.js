'use client';

import { useEffect, useState, useCallback } from 'react';
import { toCSV, downloadCSV } from '@/lib/csv';

const STATUSES = ['Present', 'Absent', 'Leave'];

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function qrImageUrl(data, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function CheckinQrSection({ portfolio, date }) {
  const [state, setState] = useState('idle');
  const [checkinUrl, setCheckinUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [error, setError] = useState('');

  async function generate() {
    setState('generating');
    setError('');
    const res = await fetch('/api/attendance/checkin-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio, date }),
    });
    const data = await res.json();
    if (!res.ok) {
      setState('error');
      setError(data.error || 'Could not generate a check in code.');
      return;
    }
    setCheckinUrl(`${window.location.origin}/checkin?token=${data.token}`);
    setExpiresAt(Date.now() + data.expiresInSeconds * 1000);
    setState('ready');
  }

  return (
    <div className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-brand-900">Meeting check in QR</h2>
          <p className="text-sm text-brand-500">
            Members scan this to mark themselves Present for {portfolio || 'this portfolio'}, {date}.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={!portfolio || state === 'generating'}
          className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          {state === 'ready' ? 'Generate new code' : 'Generate check in QR'}
        </button>
      </div>

      {state === 'error' && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {state === 'ready' && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <img
            src={qrImageUrl(checkinUrl)}
            alt="Meeting check in QR code"
            width={200}
            height={200}
            className="rounded-lg border border-brand-200"
          />
          <div className="text-sm">
            <p className="text-brand-500">
              Valid for 30 minutes, until {new Date(expiresAt).toLocaleTimeString()}.
            </p>
            <p className="mt-2 break-all text-xs text-brand-400">{checkinUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const [role, setRole] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [portfolio, setPortfolio] = useState('');
  const [date, setDate] = useState(todayISO());
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/roster')
      .then((res) => res.json())
      .then((data) => {
        setRole(data.role || 'member');
        setPortfolios(data.portfolios || []);
        const preferred =
          data.defaultPortfolio && data.portfolios?.includes(data.defaultPortfolio)
            ? data.defaultPortfolio
            : data.portfolios?.[0];
        if (preferred) setPortfolio(preferred);
      });
  }, []);

  const canMark = role === 'admin' || role === 'manager';
  const canGenerateQr = role === 'admin';

  const loadAttendance = useCallback(() => {
    if (!canMark || !portfolio || !date) return;
    setLoading(true);
    fetch(`/api/attendance?portfolio=${encodeURIComponent(portfolio)}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setPeople(data.people || []);
        setLoading(false);
      });
  }, [canMark, portfolio, date]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  function setStatus(cmsId, status) {
    setPeople((prev) => prev.map((p) => (p.cmsId === cmsId ? { ...p, status } : p)));
  }

  function markAll(status) {
    setPeople((prev) => prev.map((p) => ({ ...p, status })));
  }

  function exportCSV() {
    const csv = toCSV(
      ['Full Name', 'Designation', 'Status'],
      people.map((p) => ({ 'Full Name': p.fullName, Designation: p.designation, Status: p.status || '' }))
    );
    downloadCSV(`attendance-${portfolio}-${date}.csv`, csv);
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, portfolio, records: people }),
    });
    setSaving(false);
    setMessage(res.ok ? 'Attendance saved.' : 'Could not save attendance.');
  }

  if (role !== null && !canMark) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-bold text-brand-900">Attendance</h1>
        <div className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
          <p className="text-brand-700">
            Ask your portfolio's Admin to show the meeting's check in QR code. Scan it with
            your phone's camera to mark yourself Present.
          </p>
          <p className="mt-2 text-sm text-brand-400">
            If something looks wrong with your record, ask your portfolio's Manager or Admin
            to correct it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-brand-900">Attendance</h1>
      <p className="mt-1 text-brand-500">Mark meeting attendance for any portfolio's roster.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-brand-800">Portfolio</label>
          <select
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
          >
            {portfolios.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-800">Meeting date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2"
          />
        </div>
      </div>

      {canGenerateQr && <CheckinQrSection portfolio={portfolio} date={date} />}

      {people.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-brand-500">Mark everyone:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => markAll(s)}
              className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-brand-200">
        <table className="w-full text-left">
          <thead className="bg-brand-100 text-sm text-brand-700">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-brand-400">
                  Loading…
                </td>
              </tr>
            ) : people.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-brand-400">
                  No one on this roster yet.
                </td>
              </tr>
            ) : (
              people.map((p) => (
                <tr key={p.cmsId} className="border-t border-brand-100">
                  <td className="px-4 py-3">{p.fullName}</td>
                  <td className="px-4 py-3 text-brand-500">{p.designation}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-4">
                      {STATUSES.map((s) => (
                        <label key={s} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="radio"
                            name={`status-${p.cmsId}`}
                            checked={p.status === s}
                            onChange={() => setStatus(p.cmsId, s)}
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || loading || people.length === 0}
          className="rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save attendance'}
        </button>
        <button
          onClick={exportCSV}
          disabled={people.length === 0}
          className="rounded-lg border border-brand-300 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          Export CSV
        </button>
        {message && <span className="text-sm text-brand-500">{message}</span>}
      </div>
    </div>
  );
}
