'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { toCSV, downloadCSV } from '@/lib/csv';
import Pill from '@/components/ui/Pill';
import { toast } from '@/lib/toast';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import ErrorRetry from '@/components/ui/ErrorRetry';

// Leaflet touches the DOM on init, so it can't be part of the server
// render — see components/VenueMap.js.
const VenueMap = dynamic(() => import('@/components/VenueMap'), {
  ssr: false,
  loading: () => <p className="mt-3 text-sm text-brand-500">Loading map…</p>,
});

const STATUSES = ['Present', 'Absent', 'Leave'];

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function qrImageUrl(data, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function meetingLabel(m) {
  if (!m) return '';
  return m.scope === 'Council' ? 'Council Meet' : `Portfolio Meet — ${m.portfolio}`;
}

function CreateMeetingSection({ portfolios, date, onCreated }) {
  const [scope, setScope] = useState('Council');
  const [portfolio, setPortfolio] = useState(portfolios[0] || '');
  const [geoRestricted, setGeoRestricted] = useState(true);
  const [venue, setVenue] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [previewCount, setPreviewCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!portfolio && portfolios.length > 0) setPortfolio(portfolios[0]);
  }, [portfolios, portfolio]);

  async function startConfirm() {
    if (scope === 'Portfolio' && !portfolio) {
      setError('Choose a portfolio first.');
      return;
    }
    if (geoRestricted && !venue) {
      setError('Pin the meeting\'s venue on the map first, or turn off "Require members to be at this location."');
      return;
    }
    setError('');
    setBusy(true);
    const params = new URLSearchParams({ scope, portfolio: scope === 'Portfolio' ? portfolio : '' });
    const res = await fetch(`/api/meetings/preview?${params}`);
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Could not preview this meeting.');
      return;
    }
    setPreviewCount(data.count);
    setConfirming(true);
  }

  async function confirmCreate() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        scope,
        portfolio: scope === 'Portfolio' ? portfolio : '',
        geoRestricted,
        venueLat: geoRestricted ? venue.lat : null,
        venueLng: geoRestricted ? venue.lng : null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Could not create this meeting.');
      return;
    }
    setConfirming(false);
    onCreated(data.meeting.id);
  }

  return (
    <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
      <h2 className="font-serif text-lg font-semibold text-brand-900">Create a meeting</h2>
      <p className="text-sm text-brand-500">
        Creates an Absent record for everyone in scope right away, marking a specific person
        Present happens afterwards, on this page or via the QR code.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-800">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="mt-1 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
          >
            <option value="Council">Council Meet, every member</option>
            <option value="Portfolio">Portfolio Meet, one portfolio</option>
          </select>
        </div>
        {scope === 'Portfolio' && (
          <div>
            <label className="block text-sm font-medium text-brand-800">Portfolio</label>
            <select
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              className="mt-1 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
            >
              {portfolios.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-800">
        <input
          type="checkbox"
          checked={geoRestricted}
          onChange={(e) => setGeoRestricted(e.target.checked)}
        />
        Require members to be at this location to check in
      </label>

      {geoRestricted && <VenueMap value={venue} onChange={setVenue} className="mt-3 max-w-xl" />}

      <button
        onClick={startConfirm}
        disabled={busy}
        className="mt-4 rounded-lg bg-brand-900 px-5 py-2.5 font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
      >
        Create meeting
      </button>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {confirming && (
        <div className="mt-4 rounded-lg border border-brand-300 bg-brand-50 p-4">
          <p className="text-brand-800">
            This will create an Absent record for all <span className="tabular-nums">{previewCount}</span>{' '}
            {scope === 'Council' ? 'roster members' : `${portfolio} members`}, for {date}.
            {geoRestricted
              ? ' Check in for this meeting will require being within 1 km of the pinned venue.'
              : ' Check in for this meeting has no location requirement.'}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={confirmCreate}
              disabled={busy}
              className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-brand-50 hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Confirm & create'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckinQrSection({ meeting }) {
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
      body: JSON.stringify({ meetingId: meeting.id }),
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
    <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-brand-900">Meeting check in QR</h2>
          <p className="text-sm text-brand-500">
            Members scan this to mark themselves Present for {meetingLabel(meeting)}, {meeting.date}.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={meeting.status === 'Voided' || state === 'generating'}
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
              Valid for 15 minutes, until {new Date(expiresAt).toLocaleTimeString()}.
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
  const [date, setDate] = useState(todayISO());
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [meeting, setMeeting] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidConfirming, setVoidConfirming] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetch('/api/roster')
      .then((res) => res.json())
      .then((data) => {
        setRole(data.role || 'member');
        setPortfolios(data.portfolios || []);
      });
  }, []);

  const canMark = role === 'admin' || role === 'manager';
  const canCreateMeeting = role === 'admin' || role === 'manager';
  const canGenerateQr = role === 'admin' || role === 'manager';
  const canVoid = role === 'admin';

  const loadMeetings = useCallback(() => {
    if (!canMark || !date) return;
    setMeetingsLoading(true);
    setLoadError('');
    fetch(`/api/meetings?date=${date}`)
      .then(async (res) => {
        const data = await res.json();
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        const list = data.meetings || [];
        setMeetings(list);
        setSelectedMeetingId(list.length === 1 ? list[0].id : '');
      })
      .catch(() => setLoadError('Could not reach the server. Try again.'))
      .finally(() => setMeetingsLoading(false));
  }, [canMark, date]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const loadAttendance = useCallback(() => {
    if (!canMark || !selectedMeetingId) {
      setPeople([]);
      setMeeting(null);
      return;
    }
    setLoading(true);
    fetch(`/api/attendance?meetingId=${encodeURIComponent(selectedMeetingId)}`)
      .then((res) => res.json())
      .then((data) => {
        setPeople(data.people || []);
        setMeeting(data.meeting || null);
      })
      .finally(() => setLoading(false));
  }, [canMark, selectedMeetingId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  function handleMeetingCreated(newMeetingId) {
    toast('Meeting created');
    loadMeetings();
    setSelectedMeetingId(newMeetingId);
  }

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
    downloadCSV(`attendance-${meetingLabel(meeting)}-${date}.csv`, csv);
  }

  // Optimistic: the radios already update `people` instantly (pure local
  // state), so the only round trip left is this Save. Confirm it right
  // away instead of making someone watch a spinner, and only correct
  // course — reload the real saved state, tell them via toast — if the
  // write genuinely failed.
  async function handleSave() {
    setSaving(true);
    setMessage('Attendance saved.');
    toast('Attendance saved');
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: selectedMeetingId, records: people }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage('');
      toast("Couldn't save — reverted to the last saved state.", 'error');
      loadAttendance();
    }
  }

  // Optimistic: flip the meeting to Voided in the UI immediately, roll
  // back and explain via toast only if the write genuinely fails.
  async function handleVoid() {
    const previousMeeting = meeting;
    setMeeting((prev) => ({ ...prev, status: 'Voided' }));
    setVoidConfirming(false);
    toast('Meeting voided');
    setVoidBusy(true);
    const res = await fetch(`/api/meetings/${encodeURIComponent(selectedMeetingId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Voided' }),
    });
    setVoidBusy(false);
    if (res.ok) {
      loadMeetings();
    } else {
      setMeeting(previousMeeting);
      toast("Couldn't void this meeting — try again.", 'error');
    }
  }

  if (role !== null && !canMark) {
    return (
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-900">Attendance</h1>
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <p className="text-brand-700">
            Ask your portfolio's Manager or Admin to show the meeting's check in QR code. Scan it
            with your phone's camera to mark yourself Present.
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
      <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-900">Attendance</h1>
      <p className="mt-1 text-brand-500">Pick a date, then a meeting, to mark attendance.</p>

      <div className="mt-6 max-w-xs">
        <label className="block text-sm font-medium text-brand-800">Meeting date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
        />
      </div>

      {loadError && <ErrorRetry className="mt-6" message={loadError} onRetry={loadMeetings} />}

      {!loadError && !meetingsLoading && meetings.length > 1 && (
        <div className="mt-4 max-w-md">
          <label className="block text-sm font-medium text-brand-800">Meeting</label>
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2"
          >
            <option value="" disabled>
              Choose a meeting
            </option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {meetingLabel(m)}
                {m.status === 'Voided' ? ' (Voided)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!loadError && canCreateMeeting && (
        <CreateMeetingSection portfolios={portfolios} date={date} onCreated={handleMeetingCreated} />
      )}

      {!loadError && !meetingsLoading && meetings.length === 0 && !canCreateMeeting && (
        <p className="mt-6 text-brand-400">No meeting exists for this date yet. Ask a Manager or Admin to create one.</p>
      )}

      {meeting && (
        <>
          {meeting.status === 'Voided' && (
            <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              This meeting has been voided. Its attendance is excluded from percentage
              calculations.
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex flex-wrap items-center gap-2 font-serif text-lg font-semibold text-brand-900">
              {meetingLabel(meeting)}, {meeting.date}
              {meeting.status === 'Voided' && <Pill tone="voided">Voided</Pill>}
              {meeting.geoRestricted && <Pill tone="muted">Geo restricted, 1 km</Pill>}
            </h2>
            <div className="flex items-center gap-4">
              <a
                href={`/api/meetings/${encodeURIComponent(meeting.id)}/minutes`}
                className="text-sm font-medium text-brand-900 hover:underline"
              >
                Generate minute sheet (.docx)
              </a>
              {canVoid && meeting.status !== 'Voided' && (
              <div>
                {voidConfirming ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-brand-700">Void this meeting?</span>
                    <button
                      onClick={handleVoid}
                      disabled={voidBusy}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {voidBusy ? 'Voiding…' : 'Confirm void'}
                    </button>
                    <button
                      onClick={() => setVoidConfirming(false)}
                      className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setVoidConfirming(true)}
                    className="text-sm font-medium text-red-700 hover:underline"
                  >
                    Void meeting
                  </button>
                )}
              </div>
              )}
            </div>
          </div>

          {canGenerateQr && <CheckinQrSection meeting={meeting} />}

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
              <thead className="bg-brand-100 text-xs font-medium uppercase tracking-wide text-brand-700">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonTableRows rows={5} columns={3} widths={['w-2/3', 'w-1/2', 'w-24']} />
                ) : people.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-brand-400">
                      No one on this meeting yet.
                    </td>
                  </tr>
                ) : (
                  people.map((p) => (
                    <tr key={p.cmsId} className="border-t border-brand-100 hover:bg-brand-50">
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
        </>
      )}
    </div>
  );
}
