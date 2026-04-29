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

// ── Garmin activity normaliser ─────────────────────────────────────────────
// Garmin field names differ from Strava — normalise to a common shape

function normalise(a) {
  const raw = (a.activityType?.typeKey || a.activityType || '').toLowerCase();
  return {
    id:           a.activityId,
    name:         a.activityName || 'Activity',
    startDate:    garminDateToISO(a.startTimeLocal || a.startTimeGmt),
    type:         raw,
    distance:     a.distance || 0,
    movingTime:   a.movingDuration || a.duration || 0,
    elev:         a.elevationGain || 0,
    hr:           a.averageHR || null,
    calories:     a.calories || 0,
    avgSpeed:     a.averageSpeed || 0,
    steps:        a.steps || null,
  };
}

function garminDateToISO(str) {
  if (!str) return null;
  // "2024-01-15 07:30:00" → "2024-01-15T07:30:00"
  return str.replace(' ', 'T');
}

// ── type config ────────────────────────────────────────────────────────────

function typeConfig(type) {
  if (!type) return { color: '#64748b', bg: '#64748b15', icon: '⚡', label: 'OTHER' };
  if (type.includes('run') || type === 'trail_running')
    return { color: '#20a4f3', bg: '#20a4f318', icon: '🏃', label: type === 'trail_running' ? 'TRAIL' : 'RUN' };
  if (type.includes('cycling') || type.includes('biking') || type.includes('bike'))
    return { color: '#3b82f6', bg: '#3b82f618', icon: '🚴', label: type.includes('mountain') ? 'MTB' : type.includes('indoor') ? 'INDOOR' : 'RIDE' };
  if (type.includes('swim'))
    return { color: '#06b6d4', bg: '#06b6d418', icon: '🏊', label: 'SWIM' };
  if (type === 'walking')
    return { color: '#22c55e', bg: '#22c55e18', icon: '🚶', label: 'WALK' };
  if (type === 'hiking')
    return { color: '#84cc16', bg: '#84cc1618', icon: '🥾', label: 'HIKE' };
  if (type.includes('strength') || type.includes('weight'))
    return { color: '#a855f7', bg: '#a855f718', icon: '🏋️', label: 'WEIGHTS' };
  if (type.includes('yoga'))
    return { color: '#ec4899', bg: '#ec489918', icon: '🧘', label: 'YOGA' };
  if (type.includes('row'))
    return { color: '#f59e0b', bg: '#f59e0b18', icon: '🚣', label: 'ROW' };
  if (type.includes('ski') || type.includes('snowboard'))
    return { color: '#67e8f9', bg: '#67e8f918', icon: '⛷️', label: 'SKI' };
  if (type.includes('tennis') || type.includes('sport') || type.includes('soccer') || type.includes('football'))
    return { color: '#f97316', bg: '#f9731618', icon: '⚽', label: type.toUpperCase().slice(0, 8) };
  return { color: '#8b5cf6', bg: '#8b5cf618', icon: '⚡', label: type.replace(/_/g, ' ').toUpperCase().slice(0, 8) };
}

// ── format helpers ─────────────────────────────────────────────────────────

const fmtDist = m => m ? (m / 1000).toFixed(2) : '0.00';

function fmtTime(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtPace(s, m) {
  if (!m || !s) return '—';
  const pps = s / (m / 1000);
  return `${Math.floor(pps / 60)}:${String(Math.round(pps % 60)).padStart(2, '0')}`;
}

const fmtDayShort = iso => iso
  ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
  : '—';

// ── Effort Score ───────────────────────────────────────────────────────────

function hrMultiplier(hr) {
  if (!hr) return 1.0;
  if (hr >= 175) return 2.0;
  if (hr >= 165) return 1.7;
  if (hr >= 155) return 1.4;
  if (hr >= 145) return 1.2;
  if (hr >= 135) return 1.0;
  return 0.8;
}

function calcEffort(a) {
  const km   = (a.distance || 0) / 1000;
  const elev = (a.elev || 0) / 100;
  const mul  = hrMultiplier(a.hr);
  return Math.round((km + elev) * mul * 10) / 10;
}

function effortLabel(score) {
  if (score >= 60) return { label: 'MAX',  color: '#ef4444' };
  if (score >= 30) return { label: 'HARD', color: '#f97316' };
  if (score >= 10) return { label: 'MOD',  color: '#f59e0b' };
  if (score >  0)  return { label: 'EASY', color: '#22c55e' };
  return               { label: '—',   color: '#334155' };
}

// ── Week Bar Chart ─────────────────────────────────────────────────────────

function WeekBarChart({ activities, monday }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().toISOString().slice(0, 10);
  const distPerDay = days.map(day =>
    activities.filter(a => (a.startDate || '').slice(0, 10) === day)
      .reduce((s, a) => s + (a.distance || 0), 0)
  );
  const max = Math.max(...distPerDay, 1);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, padding: '0 4px' }}>
      {distPerDay.map((dist, i) => {
        const isToday = days[i] === today;
        const hasAct  = dist > 0;
        const h = Math.max(dist / max, hasAct ? 0.06 : 0);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
              {hasAct && (
                <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 9, color: '#20a4f3', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {fmtDist(dist)}
                </div>
              )}
              <div style={{
                width: '100%', height: `${h * 100}%`,
                background: hasAct ? 'linear-gradient(to top, #20a4f3, #60c4f7)' : isToday ? '#1e2533' : '#0f1420',
                borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease',
                boxShadow: hasAct ? '0 0 8px #20a4f340' : 'none',
              }} />
            </div>
            <div style={{ fontSize: 8, color: isToday ? '#20a4f3' : '#334155',
              letterSpacing: '0.04em', fontWeight: isToday ? 700 : 400 }}>
              {dayLabels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Card ──────────────────────────────────────────────────────────

function ActivityCard({ activity: a }) {
  const cfg   = typeConfig(a.type);
  const isRun = a.type?.includes('run');
  const effort = calcEffort(a);
  const ef     = effortLabel(effort);

  return (
    <div style={{
      background: '#0f1420', border: `1px solid #1a2235`,
      borderLeft: `3px solid ${cfg.color}`, borderRadius: 8,
      padding: '1rem 1.25rem', display: 'grid',
      gridTemplateColumns: 'auto 1fr auto', gap: '1rem', alignItems: 'center',
      transition: 'transform 0.1s, box-shadow 0.1s', cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 20px ${cfg.color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 48 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {cfg.icon}
        </div>
        <span style={{ fontSize: 8, color: cfg.color, letterSpacing: '0.08em',
          fontWeight: 700, background: cfg.bg, padding: '1px 6px', borderRadius: 3 }}>
          {cfg.label}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 4, lineHeight: 1.2 }}>
          {a.name}
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>
          {fmtDayShort(a.startDate)}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {a.distance > 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              <span style={{ color: '#20a4f3', fontWeight: 600 }}>{fmtDist(a.distance)}</span>
              <span style={{ color: '#475569' }}> km</span>
            </span>
          )}
          {a.movingTime > 0 && (
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{fmtTime(a.movingTime)}</span>
          )}
          {isRun && a.distance > 0 && a.movingTime > 0 && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              {fmtPace(a.movingTime, a.distance)} <span style={{ fontSize: 9 }}>/km</span>
            </span>
          )}
          {a.elev > 0 && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>↑{Math.round(a.elev)}m</span>
          )}
          {a.steps > 0 && a.distance === 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.steps.toLocaleString()} steps</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {effort > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, color: ef.color, fontWeight: 800, lineHeight: 1 }}>{effort}</div>
            <div style={{ fontSize: 9, color: ef.color, opacity: 0.7, letterSpacing: '0.06em' }}>{ef.label}</div>
          </div>
        )}
        {a.hr && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: '#f87171', fontWeight: 700, lineHeight: 1 }}>{Math.round(a.hr)}</div>
            <div style={{ fontSize: 9, color: '#475569' }}>bpm</div>
          </div>
        )}
        {a.calories > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#ec4899', fontWeight: 600, lineHeight: 1 }}>{Math.round(a.calories)}</div>
            <div style={{ fontSize: 9, color: '#475569' }}>kcal</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color, icon, sub }) {
  return (
    <div style={{ background: '#0f1420', border: '1px solid #1a2235', borderRadius: 12,
      padding: '1.25rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(to right, ${color}, ${color}40)` }} />
      <div style={{ fontSize: 11, color: '#475569', letterSpacing: '0.1em', marginBottom: 8 }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
        {unit && <div style={{ fontSize: 12, color: '#475569' }}>{unit}</div>}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Month Week Rows ────────────────────────────────────────────────────────

function MonthWeekRows({ activities, onWeekClick }) {
  const weeks = [...new Set(activities.map(a => weekKey(a.startDate)))].sort();
  if (!weeks.length) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#334155', fontSize: 12, letterSpacing: '0.12em' }}>
        NO ACTIVITIES THIS MONTH
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {weeks.map(wk => {
        const wActs = activities.filter(a => weekKey(a.startDate) === wk);
        const dist  = wActs.reduce((s, a) => s + (a.distance || 0), 0);
        const time  = wActs.reduce((s, a) => s + (a.movingTime || 0), 0);
        const elev  = wActs.reduce((s, a) => s + (a.elev || 0), 0);
        const wl    = weekLabel(wk);
        const types = [...new Set(wActs.map(a => a.type))];
        return (
          <div key={wk} onClick={() => onWeekClick(wk)}
            style={{ background: '#0f1420', border: '1px solid #1a2235', borderRadius: 10,
              padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '70px 1fr auto',
              alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#20a4f340'; e.currentTarget.style.background = '#13192a'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2235'; e.currentTarget.style.background = '#0f1420'; }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>W{wl.week}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{wl.mon}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {types.slice(0, 5).map(t => {
                  const cfg = typeConfig(t);
                  return (
                    <span key={t} style={{ background: cfg.bg, color: cfg.color, padding: '2px 8px',
                      fontSize: 9, borderRadius: 4, fontWeight: 700, letterSpacing: '0.06em' }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  );
                })}
                {wActs.length > 1 && <span style={{ fontSize: 10, color: '#475569' }}>{wActs.length} acts</span>}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {dist > 0 && <span style={{ fontSize: 12, color: '#20a4f3', fontWeight: 600 }}>{fmtDist(dist)} km</span>}
                <span style={{ fontSize: 12, color: '#22c55e' }}>{fmtTime(time)}</span>
                {elev > 0 && <span style={{ fontSize: 12, color: '#f59e0b' }}>↑{Math.round(elev)}m</span>}
              </div>
            </div>
            <div style={{ color: '#334155', fontSize: 16 }}>›</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const TYPE_FILTERS = ['ALL', 'running', 'cycling', 'swimming', 'walking', 'hiking'];

export default function Garmin() {
  const [status, setStatus]             = useState(null);
  const [allActivities, setAllActivities] = useState([]);
  const [fetching, setFetching]         = useState(false);
  const [viewMode, setViewMode]         = useState('WEEK');
  const [selectedWeek, setSelectedWeek] = useState(currentWeekKey());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [typeFilter, setTypeFilter]     = useState('ALL');

  useEffect(() => {
    fetch(`${BASE}/garmin/status`)
      .then(r => r.json())
      .then(d => { setStatus(d); if (d.connected) loadAll(); })
      .catch(() => setStatus({ connected: false, reason: 'error' }));
  }, []);

  const loadAll = useCallback(async () => {
    setFetching(true);
    const all = [];
    for (let start = 0; ; start += 100) {
      const res = await fetch(`${BASE}/garmin/activities?start=${start}&limit=100`)
        .then(r => r.json()).catch(() => []);
      if (!Array.isArray(res) || !res.length) break;
      all.push(...res.map(normalise));
      if (res.length < 100) break;
    }
    setAllActivities(all);
    setFetching(false);
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!status) {
    return (
      <div style={styles.fullCenter}>
        <div style={styles.loader} />
        <div style={{ color: '#475569', fontSize: 11, letterSpacing: '0.1em', marginTop: 16 }}>LOADING</div>
      </div>
    );
  }

  // ── Not configured ────────────────────────────────────────────────────────
  if (!status.connected) {
    return (
      <div style={styles.fullCenter}>
        <div style={{ background: '#0f1420', border: '1px solid #1a2235', borderRadius: 20,
          padding: '3rem 2.5rem', textAlign: 'center', maxWidth: 380, width: '100%' }}>
          <div style={{ width: 72, height: 72, borderRadius: 18,
            background: 'linear-gradient(135deg, #20a4f3, #60c4f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 1.5rem', boxShadow: '0 8px 32px #20a4f340' }}>
            ⌚
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#20a4f3', letterSpacing: '-0.02em', marginBottom: 4 }}>
            GARMIN
          </div>
          <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.2em', marginBottom: '1.5rem' }}>
            ACTIVITY DASHBOARD
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
            {status.reason === 'no_credentials'
              ? 'Add GARMIN_EMAIL and GARMIN_PASSWORD\nto the Render environment variables.'
              : 'Could not connect to Garmin. Check credentials on Render.'}
          </div>
        </div>
      </div>
    );
  }

  // ── Filtered sets ─────────────────────────────────────────────────────────
  const weekActs  = allActivities.filter(a => a.startDate && weekKey(a.startDate) === selectedWeek);
  const monthActs = allActivities.filter(a => a.startDate && monthKey(a.startDate) === selectedMonth);
  const baseActs  = viewMode === 'WEEK' ? weekActs : monthActs;
  const filtered  = typeFilter === 'ALL' ? baseActs : baseActs.filter(a => a.type?.includes(typeFilter));

  const totalDist = baseActs.reduce((s, a) => s + (a.distance || 0), 0);
  const totalTime = baseActs.reduce((s, a) => s + (a.movingTime || 0), 0);
  const totalElev = baseActs.reduce((s, a) => s + (a.elev || 0), 0);
  const totalCal  = baseActs.reduce((s, a) => s + (a.calories || 0), 0);
  const totalEffort = baseActs.reduce((s, a) => s + calcEffort(a), 0);
  const ef        = effortLabel(totalEffort);
  const avgHR     = (() => {
    const hrs = baseActs.filter(a => a.hr);
    return hrs.length ? Math.round(hrs.reduce((s, a) => s + a.hr, 0) / hrs.length) : null;
  })();

  const wl = weekLabel(selectedWeek);
  const isCurrentWeek  = selectedWeek === currentWeekKey();
  const isCurrentMonth = selectedMonth === currentMonthKey();

  return (
    <div style={styles.page}>

      {/* ── Athlete Hero ──────────────────────────────────────────────────── */}
      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          {status.profileImageUrl ? (
            <div style={{ position: 'relative' }}>
              <img src={status.profileImageUrl} alt="" style={styles.avatar} />
              <div style={styles.onlineDot} />
            </div>
          ) : (
            <div style={{ ...styles.avatar, background: '#20a4f320', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>⌚</div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              {status.fullName || status.displayName || 'Athlete'}
            </div>
            <div style={{ fontSize: 10, color: '#22c55e', letterSpacing: '0.1em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              GARMIN CONNECTED
              {fetching && <span style={{ color: '#f59e0b', marginLeft: 8 }}>· SYNCING...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── View mode toggle ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#0f1420', border: '1px solid #2d3748',
        borderRadius: 14, padding: 4, marginBottom: '1.25rem', gap: 4 }}>
        {['WEEK', 'MONTH'].map(m => (
          <button key={m} onClick={() => setViewMode(m)} style={{
            flex: 1, border: viewMode === m ? 'none' : '1px solid #2d3748',
            padding: '0.8rem', cursor: 'pointer', fontSize: 14, fontWeight: 800,
            letterSpacing: '0.14em', fontFamily: 'inherit', borderRadius: 10,
            transition: 'all 0.2s',
            background: viewMode === m ? '#20a4f3' : '#1a2235',
            color: viewMode === m ? '#fff' : '#94a3b8',
            boxShadow: viewMode === m ? '0 2px 16px #20a4f350' : 'none',
          }}>{m}</button>
        ))}
      </div>

      {/* ── Navigator ────────────────────────────────────────────────────── */}
      {viewMode === 'WEEK' && (
        <div style={styles.navCard}>
          <button onClick={() => setSelectedWeek(prevWeekKey(selectedWeek))} style={styles.navArrow}>‹</button>
          <div style={{ flex: 1, display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
                {isCurrentWeek ? 'THIS WEEK' : `WEEK ${wl.week}`}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                {wl.mon} — {wl.sun} · {wl.year}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <WeekBarChart activities={weekActs} monday={wl.monday} />
            </div>
          </div>
          <button onClick={() => setSelectedWeek(nextWeekKey(selectedWeek))} disabled={isCurrentWeek}
            style={{ ...styles.navArrow, opacity: isCurrentWeek ? 0.2 : 1 }}>›</button>
        </div>
      )}

      {viewMode === 'MONTH' && (
        <div style={{ ...styles.navCard, paddingTop: '1rem', paddingBottom: '1rem' }}>
          <button onClick={() => setSelectedMonth(prevMonthKey(selectedMonth))} style={styles.navArrow}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
              {isCurrentMonth ? 'THIS MONTH' : monthLabel(selectedMonth).toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              {monthActs.length} {monthActs.length === 1 ? 'activity' : 'activities'}
            </div>
          </div>
          <button onClick={() => setSelectedMonth(nextMonthKey(selectedMonth))} disabled={isCurrentMonth}
            style={{ ...styles.navArrow, opacity: isCurrentMonth ? 0.2 : 1 }}>›</button>
        </div>
      )}

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div style={styles.statGrid}>
        <StatCard label="ACTIVITIES" value={baseActs.length} unit=""    color="#f1f5f9"  icon="📊" />
        <StatCard label="DISTANCE"   value={(totalDist / 1000).toFixed(1)} unit="km" color="#20a4f3" icon="📍" />
        <StatCard label="TIME"       value={fmtTime(totalTime)} unit=""  color="#22c55e"  icon="⏱" />
        <StatCard label="ELEVATION"  value={totalElev > 0 ? `+${Math.round(totalElev)}` : '—'} unit={totalElev > 0 ? 'm' : ''} color="#f59e0b" icon="⛰" />
        {totalCal  > 0 && <StatCard label="CALORIES" value={Math.round(totalCal)} unit="kcal" color="#ec4899" icon="🔥" />}
        {avgHR     && <StatCard label="AVG HR" value={avgHR} unit="bpm" color="#f87171" icon="❤️" />}
        {totalEffort > 0 && <StatCard label="EFFORT" value={Math.round(totalEffort)} unit={ef.label} color={ef.color} icon="⚡" />}
      </div>

      {/* ── MONTH: week rows ──────────────────────────────────────────────── */}
      {viewMode === 'MONTH' && (
        <MonthWeekRows
          activities={monthActs}
          onWeekClick={wk => { setSelectedWeek(wk); setViewMode('WEEK'); }}
        />
      )}

      {/* ── WEEK: type filters + activity cards ──────────────────────────── */}
      {viewMode === 'WEEK' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map(t => {
              const count = t === 'ALL' ? weekActs.length : weekActs.filter(a => a.type?.includes(t)).length;
              if (t !== 'ALL' && count === 0) return null;
              const cfg = typeConfig(t === 'ALL' ? null : t);
              const active = typeFilter === t;
              return (
                <button key={t} onClick={() => setTypeFilter(t)} style={{
                  background: active ? (t === 'ALL' ? '#1a2235' : cfg.bg) : 'transparent',
                  color: active ? (t === 'ALL' ? '#e2e8f0' : cfg.color) : '#475569',
                  border: `1px solid ${active ? (t === 'ALL' ? '#2d3748' : cfg.color + '60') : '#1a2235'}`,
                  padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: 11,
                  fontWeight: active ? 700 : 400, letterSpacing: '0.06em',
                  fontFamily: 'inherit', borderRadius: 20, transition: 'all 0.15s',
                }}>
                  {t === 'ALL' ? 'ALL' : `${cfg.icon} ${cfg.label}`}
                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#334155' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>😴</div>
              <div style={{ fontSize: 12, letterSpacing: '0.1em' }}>
                {fetching ? 'SYNCING ACTIVITIES...' : 'NO ACTIVITIES THIS WEEK'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(a => <ActivityCard key={a.id} activity={a} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh', background: '#080c14', color: '#94a3b8',
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
    padding: '1.5rem', maxWidth: 800, margin: '0 auto',
  },
  fullCenter: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#080c14', padding: '2rem',
  },
  loader: {
    width: 36, height: 36, border: '3px solid #1a2235',
    borderTop: '3px solid #20a4f3', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  hero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  heroLeft: { display: 'flex', alignItems: 'center', gap: '0.9rem' },
  avatar: { width: 48, height: 48, borderRadius: 14, border: '2px solid #20a4f340', display: 'block' },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12,
    borderRadius: '50%', background: '#22c55e', border: '2px solid #080c14' },
  navCard: { background: '#0f1420', border: '1px solid #1a2235', borderRadius: 14,
    padding: '1rem 1.25rem', marginBottom: '1.25rem',
    display: 'flex', alignItems: 'center', gap: '1rem' },
  navArrow: { background: '#20a4f3', border: 'none', color: '#fff', width: 42, height: 42,
    borderRadius: 10, cursor: 'pointer', fontSize: 22, fontWeight: 700, lineHeight: 1,
    fontFamily: 'inherit', boxShadow: '0 2px 10px #20a4f340',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 10, marginBottom: '1.5rem' },
};
