import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi, api } from '../hooks/useApi.js';

const LINES = [
  { id: 1, name: 'Danube', capacity: 340 },
  { id: 2, name: 'Maritsa', capacity: 168 },
  { id: 3, name: 'Iskar', capacity: 68 },
  { id: 4, name: 'Rhine', capacity: 1000 },
  { id: 5, name: 'Main', capacity: 268 },
];

const SHIFTS = ['A', 'B', 'C', 'D'];
const SHIFT_HOURS = { A: '06-14', B: '14-22', C: '22-06', D: 'MAINT' };

function getStatus(pct) {
  if (pct < 60) return { label: 'LOW', color: '#3b82f6' };
  if (pct < 85) return { label: 'NORMAL', color: '#22c55e' };
  if (pct < 100) return { label: 'CRITICAL', color: '#f97316' };
  return { label: 'OVERLOAD', color: '#ef4444' };
}

function currentWeek() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

const c = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' },
  card: { background: '#12161f', border: '1px solid #1e2533', padding: '1.25rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  lineName: { fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', color: '#e2e8f0' },
  badge: (color) => ({ background: color + '22', color, padding: '0.15rem 0.5rem', fontSize: 10, letterSpacing: '0.1em' }),
  bar: { height: 6, background: '#1e2533', marginBottom: '0.75rem', position: 'relative' },
  barFill: (pct, color) => ({ width: Math.min(pct, 100) + '%', height: '100%', background: color, transition: 'width 0.3s' }),
  row: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' },
  label: { color: '#4a5568', fontSize: 11, letterSpacing: '0.06em', width: 70 },
  input: { background: '#0f1117', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.25rem 0.5rem', width: 80, fontSize: 13 },
  weekPicker: { background: '#12161f', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.35rem 0.75rem', fontSize: 13 },
  shiftBtn: (active) => ({ background: active ? '#3b82f6' : '#1e2533', color: active ? '#0f1117' : '#4a5568', border: 'none', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }),
};

function LoadCard({ line, week, shift }) {
  const [planned, setPlanned] = useState('');
  const [capacity, setCapacity] = useState(line.capacity);
  const [trend, setTrend] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/production?week=${week}&shift=${shift}`)
      .then(r => r.json())
      .then(rows => {
        const row = rows.find(r => r.line_id === line.id);
        if (row) { setPlanned(row.planned); setCapacity(row.capacity); }
        else { setPlanned(''); setCapacity(line.capacity); }
      });
    fetch(`/api/production/trend/${line.id}?shift=${shift}`)
      .then(r => r.json()).then(setTrend);
  }, [week, shift, line.id]);

  const pct = capacity > 0 ? Math.round((planned / capacity) * 100) : 0;
  const { label, color } = getStatus(pct);

  const save = async () => {
    await api(`/api/production/${line.id}`, 'PUT', { week, shift, planned: +planned, capacity: +capacity });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={c.card}>
      <div style={c.header}>
        <span style={c.lineName}>{line.name}</span>
        <span style={c.badge(color)}>{label}</span>
      </div>
      <div style={c.bar}><div style={c.barFill(pct, color)} /></div>
      <div style={{ color: '#4a5568', fontSize: 11, marginBottom: '0.75rem' }}>{pct}% of capacity</div>
      <div style={c.row}>
        <span style={c.label}>PLANNED</span>
        <input style={c.input} type="number" value={planned} onChange={e => setPlanned(e.target.value)} />
        <span style={{ color: '#4a5568', fontSize: 11 }}>units/shift</span>
      </div>
      <div style={c.row}>
        <span style={c.label}>CAPACITY</span>
        <input style={c.input} type="number" value={capacity} onChange={e => setCapacity(e.target.value)} />
        <span style={{ color: '#4a5568', fontSize: 11 }}>units/shift</span>
      </div>
      <button onClick={save} style={{ background: saved ? '#22c55e' : '#1e2533', color: saved ? '#0f1117' : '#e2e8f0', border: 'none', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em', marginTop: '0.5rem' }}>
        {saved ? 'SAVED ✓' : 'SAVE'}
      </button>
      {trend.length > 1 && (
        <ResponsiveContainer width="100%" height={60} style={{ marginTop: '1rem' }}>
          <LineChart data={trend}>
            <Line type="monotone" dataKey="planned" stroke={color} dot={false} strokeWidth={2} />
            <XAxis dataKey="week" hide />
            <YAxis hide />
            <Tooltip contentStyle={{ background: '#12161f', border: '1px solid #1e2533', fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function ProductionLoad() {
  const [week, setWeek] = useState(currentWeek());
  const [shift, setShift] = useState('A');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568' }}>PRODUCTION LOAD MONITOR</h2>
        <input type="week" value={week} onChange={e => setWeek(e.target.value)} style={c.weekPicker} />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {SHIFTS.map(s => (
            <button key={s} onClick={() => setShift(s)} style={c.shiftBtn(shift === s)}>{s}</button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#4a5568' }}>SHIFT {shift} · {SHIFT_HOURS[shift]}</span>
      </div>
      <div style={c.grid}>
        {LINES.map(line => <LoadCard key={`${line.id}-${shift}`} line={line} week={week} shift={shift} />)}
      </div>
    </div>
  );
}
