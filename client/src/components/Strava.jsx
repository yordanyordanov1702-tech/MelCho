import React, { useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_URL || '/api';

function fmtDist(m) {
  if (!m) return '0.00 km';
  return (m / 1000).toFixed(2) + ' km';
}

function fmtTime(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

function fmtPace(s, m) {
  if (!m || !s) return '—';
  const paceSecPerKm = s / (m / 1000);
  const pm = Math.floor(paceSecPerKm / 60);
  const ps = Math.round(paceSecPerKm % 60);
  return `${pm}:${ps.toString().padStart(2, '0')} /km`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function typeColor(type) {
  if (!type) return '#4a5568';
  if (type.includes('Run')) return '#ef4444';
  if (type.includes('Ride')) return '#3b82f6';
  if (type.includes('Swim')) return '#06b6d4';
  if (type === 'Walk' || type === 'Hike') return '#22c55e';
  return '#4a5568';
}

function typeLabel(type) {
  if (!type) return '—';
  const labels = {
    Run: 'RUN', VirtualRun: 'V-RUN', TrailRun: 'TRAIL',
    Ride: 'RIDE', VirtualRide: 'V-RIDE', EBikeRide: 'E-RIDE', MountainBikeRide: 'MTB',
    Swim: 'SWIM', Walk: 'WALK', Hike: 'HIKE',
    WeightTraining: 'WEIGHTS', Workout: 'WORKOUT',
    Yoga: 'YOGA', Rowing: 'ROW', Crossfit: 'CROSSFIT', Kayaking: 'KAYAK',
  };
  return labels[type] || type.replace(/([A-Z])/g, ' $1').trim().toUpperCase().slice(0, 8);
}

const TYPE_FILTERS = ['ALL', 'Run', 'Ride', 'Swim', 'Walk', 'Hike'];

export default function Strava() {
  const [status, setStatus] = useState(null);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava') === 'connected' || params.get('strava_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('strava_error')) {
      setError('Strava connection failed. Please try again.');
    }

    fetch(`${BASE}/strava/status`)
      .then(r => r.json())
      .then(d => {
        setStatus(d);
        if (d.connected) {
          loadActivities(1);
          loadStats();
        }
      })
      .catch(() => setStatus({ connected: false, athlete: null }));
  }, []);

  function loadActivities(p) {
    setLoading(true);
    fetch(`${BASE}/strava/activities?page=${p}&per_page=20`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActivities(prev => p === 1 ? data : [...prev, ...data]);
          setHasMore(data.length === 20);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  function loadStats() {
    fetch(`${BASE}/strava/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }

  function connect() {
    window.location.href = `${BASE}/strava/auth`;
  }

  function disconnect() {
    fetch(`${BASE}/strava/disconnect`, { method: 'DELETE' })
      .then(() => {
        setStatus({ connected: false, athlete: null });
        setActivities([]);
        setStats(null);
        setPage(1);
      });
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    loadActivities(next);
  }

  if (!status) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#4a5568', fontSize: 12, letterSpacing: '0.08em' }}>
        LOADING...
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div>
        <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568', marginBottom: '1.5rem' }}>STRAVA INTEGRATION</h2>
        {error && (
          <div style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', padding: '0.75rem 1rem', fontSize: 12, marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        <div style={{ background: '#12161f', border: '1px solid #1e2533', padding: '3rem 2rem', textAlign: 'center', maxWidth: 420, margin: '4rem auto' }}>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#fc4c02', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>STRAVA</div>
          <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.12em', marginBottom: '1.5rem' }}>ACTIVITY TRACKING</div>
          <div style={{ fontSize: 12, color: '#4a5568', marginBottom: '2rem', lineHeight: 1.7 }}>
            Connect your Strava account to view runs,<br />rides, and workout statistics.
          </div>
          <button
            onClick={connect}
            style={{
              background: '#fc4c02',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 2.5rem',
              cursor: 'pointer',
              fontSize: 12,
              letterSpacing: '0.12em',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            CONNECT WITH STRAVA
          </button>
        </div>
      </div>
    );
  }

  const filtered = typeFilter === 'ALL'
    ? activities
    : activities.filter(a => (a.sport_type || a.type) === typeFilter);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568', margin: 0 }}>STRAVA</h2>
        {status.athlete?.athlete_avatar && (
          <img
            src={status.athlete.athlete_avatar}
            alt=""
            style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #1e2533' }}
          />
        )}
        <span style={{ fontSize: 12, color: '#e2e8f0' }}>{status.athlete?.athlete_name}</span>
        <span style={{ fontSize: 10, color: '#22c55e', letterSpacing: '0.08em' }}>CONNECTED</span>
        <button
          onClick={disconnect}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid #1e2533',
            color: '#4a5568',
            padding: '0.3rem 0.75rem',
            cursor: 'pointer',
            fontSize: 10,
            letterSpacing: '0.06em',
            fontFamily: 'inherit',
          }}
        >
          DISCONNECT
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{ display: 'flex', gap: '1px', marginBottom: '1.5rem', background: '#1e2533', flexWrap: 'wrap' }}>
          {[
            { label: 'YTD RUNS', count: stats.ytd_run_totals?.count ?? 0, dist: stats.ytd_run_totals?.distance ?? 0, color: '#ef4444' },
            { label: 'YTD RIDES', count: stats.ytd_ride_totals?.count ?? 0, dist: stats.ytd_ride_totals?.distance ?? 0, color: '#3b82f6' },
            { label: 'YTD SWIMS', count: stats.ytd_swim_totals?.count ?? 0, dist: stats.ytd_swim_totals?.distance ?? 0, color: '#06b6d4' },
            { label: 'ALL RUNS', count: stats.all_run_totals?.count ?? 0, dist: stats.all_run_totals?.distance ?? 0, color: '#ef4444' },
            { label: 'ALL RIDES', count: stats.all_ride_totals?.count ?? 0, dist: stats.all_ride_totals?.distance ?? 0, color: '#3b82f6' },
          ].map(k => (
            <div key={k.label} style={{ flex: '1 1 110px', background: '#12161f', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: k.color, lineHeight: 1 }}>{k.count}</div>
              <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>{fmtDist(k.dist)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Type filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TYPE_FILTERS.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              background: typeFilter === t ? '#1e2533' : 'none',
              border: '1px solid #1e2533',
              color: typeFilter === t ? '#e2e8f0' : '#4a5568',
              padding: '0.3rem 0.75rem',
              cursor: 'pointer',
              fontSize: 11,
              letterSpacing: '0.06em',
              fontFamily: 'inherit',
            }}
          >
            {t === 'ALL' ? 'ALL' : typeLabel(t)}
          </button>
        ))}
      </div>

      {/* Activities table */}
      <div style={{ background: '#12161f', border: '1px solid #1e2533' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e2533' }}>
              {['TYPE', 'NAME', 'DATE', 'DISTANCE', 'TIME', 'PACE', 'ELEV'].map(h => (
                <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: 10, color: '#4a5568', letterSpacing: '0.1em', fontWeight: 400 }}>{h}</th>
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
                  <td style={{ padding: '0.6rem 1rem' }}>
                    <span style={{ background: color + '22', color, padding: '0.15rem 0.5rem', fontSize: 10, letterSpacing: '0.06em' }}>
                      {typeLabel(type)}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: 12, color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: 11, color: '#4a5568', whiteSpace: 'nowrap' }}>
                    {fmtDate(a.start_date_local)}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDist(a.distance)}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtTime(a.moving_time)}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: 12, color: '#4a5568', whiteSpace: 'nowrap' }}>
                    {isRun ? fmtPace(a.moving_time, a.distance) : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontSize: 12, color: '#4a5568', whiteSpace: 'nowrap' }}>
                    {a.total_elevation_gain > 0 ? `+${Math.round(a.total_elevation_gain)}m` : '—'}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#4a5568', fontSize: 12, letterSpacing: '0.08em' }}>
                  {loading ? 'LOADING ACTIVITIES...' : 'NO ACTIVITIES FOUND'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && activities.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              background: '#1e2533',
              border: '1px solid #1e2533',
              color: loading ? '#4a5568' : '#e2e8f0',
              padding: '0.5rem 2rem',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 11,
              letterSpacing: '0.08em',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'LOADING...' : 'LOAD MORE'}
          </button>
        </div>
      )}
    </div>
  );
}
