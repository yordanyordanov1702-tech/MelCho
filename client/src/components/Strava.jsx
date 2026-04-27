import React, { useState, useEffect, useCallback } from 'react';

const BASE = 'https://melcho.onrender.com/api';

// ── date / week helpers ────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
}

function weekKey(dateStr) {
  const { year, week } = getISOWeek(new Date(dateStr));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentWeekKey() { return weekKey(new Date().toISOString()); }
function currentMonthKey() { return monthKey(new Date().toISOString()); }

function weekLabel(key) {
  const [year, wPart] = key.split('-W');
  const week = parseInt(wPart, 10);
  const jan4 = new Date(Date.UTC(parseInt(year, 10), 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return { mon: fmt(monday), sun: fmt(sunday), week, year: parseInt(year, 10), monday };
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function prevWeekKey(key) {
  const [year, wPart] = key.split('-W');
  let w = parseInt(wPart, 10) - 1, y = parseInt(year, 10);
  if (w < 1) { y -= 1; w = getISOWeek(new Date(Date.UTC(y, 11, 28))).week; }
  return `${y}-W${String(w).padStart(2, '0')}`;
}

function nextWeekKey(key) {
  const [year, wPart] = key.split('-W');
  let w = parseInt(wPart, 10) + 1, y = parseInt(year, 10);
  const last = getISOWeek(new Date(Date.UTC(y, 11, 28))).week;
  if (w > last) { y += 1; w = 1; }
  return `${y}-W${String(w).padStart(2, '0')}`;
}

function prevMonthKey(key) {
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthKey(key) {
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── format helpers ─────────────────────────────────────────────────────────

const fmtDist = m => m ? (m / 1000).toFixed(2) + ' km' : '0.00 km';

function fmtTime(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtPace(s, m) {
  if (!m || !s) return '—';
  const pps = s / (m / 1000);
  return `${Math.floor(pps / 60)}:${String(Math.round(pps % 60)).padStart(2, '0')} /km`;
}

const fmtDate = iso => iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })
  : '—';

const fmtCal = c => c ? `${Math.round(c)} kcal` : '—';

function typeColor(type) {
  if (!type) return '#4a5568';
  if (type.includes('Run')) return '#ef4444';
  if (type.includes('Ride')) return '#3b82f6';
  if (type.includes('Swim')) return '#06b6d4';
  if (type === 'Walk' || type === 'Hike') return '#22c55e';
  return '#8b5cf6';
}

function typeLabel(type) {
  const labels = {
    Run: 'RUN', VirtualRun: 'V-RUN', TrailRun: 'TRAIL',
    Ride: 'RIDE', VirtualRide: 'V-RIDE', EBikeRide: 'E-RIDE', MountainBikeRide: 'MTB',
    Swim: 'SWIM', Walk: 'WALK', Hike: 'HIKE',
    WeightTraining: 'WEIGHTS', Workout: 'WORKOUT',
    Yoga: 'YOGA', Rowing: 'ROW', Crossfit: 'CROSSFIT', Kayaking: 'KAYAK',
  };
  return labels[type] || (type || '—').replace(/([A-Z])/g, ' $1').trim().toUpperCase().slice(0, 8);
}

// ── mini bar chart (daily distance) ────────────────────────────────────────

function WeekBarChart({ activities, monday }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const distPerDay = days.map(day =>
    activities
      .filter(a => (a.start_date_local || '').slice(0, 10) === day)
      .reduce((s, a) => s + (a.distance || 0), 0)
  );

  const max = Math.max(...distPerDay, 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, padding: '0 4px' }}>
      {distPerDay.map((dist, i) => {
        const heightPct = dist / max;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              title={dist ? fmtDist(dist) : ''}
              style={{
                width: '100%',
                height: 36,
                display: 'flex',
                alignItems: 'flex-end',
              }}
            >
              <div style={{
                width: '100%',
                height: `${Math.max(heightPct * 100, dist > 0 ? 8 : 0)}%`,
                background: dist > 0 ? '#3b82f6' : '#1e2533',
                borderRadius: 2,
              }} />
            </div>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: '0.04em' }}>{dayLabels[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── monthly week summary rows ───────────────────────────────────────────────

function MonthWeekRows({ activities, onWeekClick }) {
  const weeks = [...new Set(activities.map(a => weekKey(a.start_date_local)))].sort();

  if (!weeks.length) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#4a5568', fontSize: 12 }}>NO ACTIVITIES THIS MONTH</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#1e2533' }}>
      {weeks.map(wk => {
        const wActs = activities.filter(a => weekKey(a.start_date_local) === wk);
        const dist = wActs.reduce((s, a) => s + (a.distance || 0), 0);
        const time = wActs.reduce((s, a) => s + (a.moving_time || 0), 0);
        const cal = wActs.reduce((s, a) => s + (a.calories || 0), 0);
        const elev = wActs.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
        const wl = weekLabel(wk);

        return (
          <div
            key={wk}
            onClick={() => onWeekClick(wk)}
            style={{
              background: '#12161f',
              padding: '0.75rem 1rem',
              display: 'grid',
              gridTemplateColumns: '80px 1fr 90px 90px 70px 80px',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#161b27'}
            onMouseLeave={e => e.currentTarget.style.background = '#12161f'}
          >
            <div>
              <div style={{ fontSize: 11, color: '#e2e8f0', letterSpacing: '0.06em' }}>W{wl.week}</div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>{wl.mon}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {wActs.slice(0, 6).map(a => {
                const t = a.sport_type || a.type;
                return (
                  <span key={a.id} style={{ background: typeColor(t) + '22', color: typeColor(t), padding: '0.1rem 0.4rem', fontSize: 9, letterSpacing: '0.04em' }}>
                    {typeLabel(t)}
                  </span>
                );
              })}
              {wActs.length > 6 && <span style={{ fontSize: 9, color: '#4a5568' }}>+{wActs.length - 6}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#3b82f6', textAlign: 'right' }}>{fmtDist(dist)}</div>
            <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'right' }}>{fmtTime(time)}</div>
            <div style={{ fontSize: 12, color: '#f59e0b', textAlign: 'right' }}>
              {elev > 0 ? `+${Math.round(elev)}m` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#ec4899', textAlign: 'right' }}>
              {cal > 0 ? `${Math.round(cal)} kcal` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

const VIEW_MODES = ['WEEK', 'MONTH'];
const TYPE_FILTERS = ['ALL', 'Run', 'Ride', 'Swim', 'Walk', 'Hike'];

export default function Strava() {
  const [status, setStatus] = useState(null);
  const [allActivities, setAllActivities] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('WEEK');
  const [selectedWeek, setSelectedWeek] = useState(currentWeekKey());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava_error')) setError('Strava connection failed. Please try again.');
    if (params.get('strava') || params.get('strava_error'))
      window.history.replaceState({}, '', window.location.pathname);

    fetch(`${BASE}/strava/status`)
      .then(r => r.json())
      .then(d => { setStatus(d); if (d.connected) loadAllActivities(); })
      .catch(() => setStatus({ connected: false, athlete: null }));
  }, []);

  const loadAllActivities = useCallback(async () => {
    setFetching(true);
    const all = [];
    for (let page = 1; ; page++) {
      const res = await fetch(`${BASE}/strava/activities?page=${page}&per_page=100`)
        .then(r => r.json()).catch(() => []);
      if (!Array.isArray(res) || !res.length) break;
      all.push(...res);
      if (res.length < 100) break;
    }
    setAllActivities(all);
    setFetching(false);
  }, []);

  const connect = () => { window.location.href = `${BASE}/strava/auth`; };
  const disconnect = () => {
    fetch(`${BASE}/strava/disconnect`, { method: 'DELETE' }).then(() => {
      setStatus({ connected: false, athlete: null });
      setAllActivities([]);
    });
  };

  if (!status) return <div style={s.center}>LOADING...</div>;

  if (!status.connected) {
    return (
      <div>
        <h2 style={s.heading}>STRAVA INTEGRATION</h2>
        {error && <div style={s.error}>{error}</div>}
        <div style={s.connectBox}>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#fc4c02', letterSpacing: '0.06em', marginBottom: 4 }}>STRAVA</div>
          <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.12em', marginBottom: '1.5rem' }}>ACTIVITY TRACKING</div>
          <div style={{ fontSize: 12, color: '#4a5568', marginBottom: '2rem', lineHeight: 1.7 }}>
            Connect your Strava account to view runs,<br />rides, and workout statistics.
          </div>
          <button onClick={connect} style={s.connectBtn}>CONNECT WITH STRAVA</button>
        </div>
      </div>
    );
  }

  // ── filtered sets ────────────────────────────────────────────────────────

  const weekActs = allActivities.filter(a => weekKey(a.start_date_local) === selectedWeek);
  const monthActs = allActivities.filter(a => monthKey(a.start_date_local) === selectedMonth);

  const baseActs = viewMode === 'WEEK' ? weekActs : monthActs;
  const filtered = typeFilter === 'ALL' ? baseActs : baseActs.filter(a => (a.sport_type || a.type) === typeFilter);

  // ── totals ────────────────────────────────────────────────────────────────

  const totalDist = baseActs.reduce((s, a) => s + (a.distance || 0), 0);
  const totalTime = baseActs.reduce((s, a) => s + (a.moving_time || 0), 0);
  const totalElev = baseActs.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
  const totalCal  = baseActs.reduce((s, a) => s + (a.calories || 0), 0);
  const avgHR     = (() => {
    const hrs = baseActs.filter(a => a.average_heartrate);
    return hrs.length ? Math.round(hrs.reduce((s, a) => s + a.average_heartrate, 0) / hrs.length) : null;
  })();

  const wl = weekLabel(selectedWeek);
  const isCurrentWeek = selectedWeek === currentWeekKey();
  const isCurrentMonth = selectedMonth === currentMonthKey();

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={s.heading}>STRAVA</h2>
        {status.athlete?.athlete_avatar && (
          <img src={status.athlete.athlete_avatar} alt="" style={s.avatar} />
        )}
        <span style={{ fontSize: 12, color: '#e2e8f0' }}>{status.athlete?.athlete_name}</span>
        <span style={{ fontSize: 10, color: '#22c55e', letterSpacing: '0.08em' }}>● CONNECTED</span>
        {fetching && <span style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '0.08em' }}>SYNCING...</span>}

        {/* View mode toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
          {VIEW_MODES.map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              ...s.ghostBtn,
              background: viewMode === m ? '#1e2533' : 'none',
              color: viewMode === m ? '#e2e8f0' : '#4a5568',
            }}>{m}</button>
          ))}
        </div>

        <button onClick={disconnect} style={s.ghostBtn}>DISCONNECT</button>
      </div>

      {/* ── WEEK navigator ─────────────────────────────────────────── */}
      {viewMode === 'WEEK' && (
        <div style={s.navBar}>
          <button onClick={() => setSelectedWeek(prevWeekKey(selectedWeek))} style={s.navBtn}>◀</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#e2e8f0', letterSpacing: '0.08em', fontWeight: 500 }}>
              {isCurrentWeek ? 'THIS WEEK' : `WEEK ${wl.week}`}
              <span style={{ fontSize: 10, color: '#4a5568', marginLeft: 8 }}>{wl.year}</span>
            </div>
            <div style={{ fontSize: 11, color: '#4a5568' }}>{wl.mon} — {wl.sun}</div>
          </div>

          {/* mini bar chart */}
          <div style={{ width: 120 }}>
            <WeekBarChart activities={weekActs} monday={wl.monday} />
          </div>

          <button
            onClick={() => setSelectedWeek(nextWeekKey(selectedWeek))}
            disabled={isCurrentWeek}
            style={{ ...s.navBtn, opacity: isCurrentWeek ? 0.3 : 1 }}
          >▶</button>
        </div>
      )}

      {/* ── MONTH navigator ────────────────────────────────────────── */}
      {viewMode === 'MONTH' && (
        <div style={s.navBar}>
          <button onClick={() => setSelectedMonth(prevMonthKey(selectedMonth))} style={s.navBtn}>◀</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#e2e8f0', letterSpacing: '0.08em', fontWeight: 500 }}>
              {isCurrentMonth ? 'THIS MONTH' : monthLabel(selectedMonth).toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#4a5568' }}>{monthActs.length} ACTIVITIES</div>
          </div>
          <button
            onClick={() => setSelectedMonth(nextMonthKey(selectedMonth))}
            disabled={isCurrentMonth}
            style={{ ...s.navBtn, opacity: isCurrentMonth ? 0.3 : 1 }}
          >▶</button>
        </div>
      )}

      {/* Summary strip */}
      <div style={s.strip}>
        {[
          { label: 'ACTIVITIES', value: baseActs.length, color: '#e2e8f0', unit: '' },
          { label: 'DISTANCE',   value: (totalDist / 1000).toFixed(1), color: '#3b82f6', unit: ' km' },
          { label: 'TIME',       value: fmtTime(totalTime), color: '#22c55e', unit: '' },
          { label: 'ELEVATION',  value: totalElev > 0 ? `+${Math.round(totalElev)}` : '—', color: '#f59e0b', unit: totalElev > 0 ? 'm' : '' },
          { label: 'CALORIES',   value: totalCal > 0 ? Math.round(totalCal) : '—', color: '#ec4899', unit: totalCal > 0 ? ' kcal' : '' },
          ...(avgHR ? [{ label: 'AVG HR', value: avgHR, color: '#f87171', unit: ' bpm' }] : []),
        ].map(({ label, value, color, unit }) => (
          <div key={label} style={s.statCard}>
            <div style={s.statLabel}>{label}</div>
            <div style={{ ...s.statValue, color }}>{value}<span style={{ fontSize: 12, fontWeight: 400 }}>{unit}</span></div>
          </div>
        ))}
      </div>

      {/* ── MONTH view: week rows ──────────────────────────────────── */}
      {viewMode === 'MONTH' && (
        <>
          {/* column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 70px 80px', padding: '0.4rem 1rem', marginBottom: 1 }}>
            {['WEEK', 'ACTIVITIES', 'DIST', 'TIME', 'ELEV', 'CALORIES'].map(h => (
              <div key={h} style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', textAlign: h === 'WEEK' || h === 'ACTIVITIES' ? 'left' : 'right' }}>{h}</div>
            ))}
          </div>
          <MonthWeekRows
            activities={monthActs}
            onWeekClick={wk => { setSelectedWeek(wk); setViewMode('WEEK'); }}
          />
        </>
      )}

      {/* ── WEEK view: activity table ──────────────────────────────── */}
      {viewMode === 'WEEK' && (
        <>
          {/* Type filters */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map(t => {
              const count = t === 'ALL' ? weekActs.length : weekActs.filter(a => (a.sport_type || a.type) === t).length;
              if (t !== 'ALL' && count === 0) return null;
              return (
                <button key={t} onClick={() => setTypeFilter(t)} style={{
                  ...s.filterBtn,
                  background: typeFilter === t ? '#1e2533' : 'none',
                  color: typeFilter === t ? '#e2e8f0' : '#4a5568',
                }}>
                  {t === 'ALL' ? 'ALL' : typeLabel(t)}
                  <span style={{ marginLeft: 4, fontSize: 10, color: typeFilter === t ? '#e2e8f0' : '#4a5568' }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{ background: '#12161f', border: '1px solid #1e2533' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2533' }}>
                  {['TYPE', 'NAME', 'DATE', 'DIST', 'TIME', 'PACE', 'ELEV', 'HR', 'CALORIES'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const type = a.sport_type || a.type;
                  const color = typeColor(type);
                  const isRun = type?.includes('Run');
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #1e2533' }}>
                      <td style={s.td}>
                        <span style={{ background: color + '22', color, padding: '0.15rem 0.5rem', fontSize: 10, letterSpacing: '0.06em' }}>
                          {typeLabel(type)}
                        </span>
                      </td>
                      <td style={{ ...s.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e2e8f0' }}>
                        {a.name}
                      </td>
                      <td style={{ ...s.td, color: '#4a5568', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(a.start_date_local)}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmtDist(a.distance)}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmtTime(a.moving_time)}</td>
                      <td style={{ ...s.td, color: '#4a5568', whiteSpace: 'nowrap' }}>{isRun ? fmtPace(a.moving_time, a.distance) : '—'}</td>
                      <td style={{ ...s.td, color: '#f59e0b', whiteSpace: 'nowrap' }}>
                        {a.total_elevation_gain > 0 ? `+${Math.round(a.total_elevation_gain)}m` : '—'}
                      </td>
                      <td style={{ ...s.td, color: '#f87171', whiteSpace: 'nowrap' }}>
                        {a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '—'}
                      </td>
                      <td style={{ ...s.td, color: '#ec4899', whiteSpace: 'nowrap' }}>
                        {fmtCal(a.calories)}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#4a5568', fontSize: 12, letterSpacing: '0.08em' }}>
                      {fetching ? 'SYNCING ACTIVITIES...' : 'NO ACTIVITIES THIS WEEK'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const s = {
  center:     { textAlign: 'center', padding: '4rem', color: '#4a5568', fontSize: 12, letterSpacing: '0.08em' },
  heading:    { fontSize: 13, letterSpacing: '0.12em', color: '#4a5568', margin: 0 },
  error:      { background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', padding: '0.75rem 1rem', fontSize: 12, marginBottom: '1rem' },
  connectBox: { background: '#12161f', border: '1px solid #1e2533', padding: '3rem 2rem', textAlign: 'center', maxWidth: 420, margin: '4rem auto' },
  connectBtn: { background: '#fc4c02', color: '#fff', border: 'none', padding: '0.75rem 2.5rem', cursor: 'pointer', fontSize: 12, letterSpacing: '0.12em', fontFamily: 'inherit', fontWeight: 500 },
  avatar:     { width: 26, height: 26, borderRadius: '50%', border: '1px solid #1e2533' },
  ghostBtn:   { background: 'none', border: '1px solid #1e2533', color: '#4a5568', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: 10, letterSpacing: '0.06em', fontFamily: 'inherit' },
  navBar:     { display: 'flex', alignItems: 'center', gap: '1rem', background: '#12161f', border: '1px solid #1e2533', padding: '0.75rem 1rem', marginBottom: '1rem' },
  navBtn:     { background: 'none', border: '1px solid #1e2533', color: '#e2e8f0', width: 32, height: 32, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  strip:      { display: 'flex', gap: '1px', marginBottom: '1rem', background: '#1e2533', flexWrap: 'wrap' },
  statCard:   { flex: '1 1 100px', background: '#12161f', padding: '0.85rem 1rem' },
  statLabel:  { fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', marginBottom: 4 },
  statValue:  { fontSize: 22, fontWeight: 500, lineHeight: 1 },
  filterBtn:  { border: '1px solid #1e2533', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em', fontFamily: 'inherit' },
  th:         { padding: '0.6rem 1rem', textAlign: 'left', fontSize: 10, color: '#4a5568', letterSpacing: '0.1em', fontWeight: 400 },
  td:         { padding: '0.6rem 1rem', fontSize: 12 },
};
