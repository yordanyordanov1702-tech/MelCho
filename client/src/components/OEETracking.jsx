import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../hooks/useApi.js';

const LINES = [
  { id: 1, name: 'Danube', machines: 55 },
  { id: 2, name: 'Maritsa', machines: 10 },
  { id: 3, name: 'Iskar', machines: 2 },
  { id: 4, name: 'Rhine', machines: 160 },
  { id: 5, name: 'Main', machines: 15 },
];

const SHIFTS = ['A', 'B', 'C', 'D'];
const SHIFT_HOURS = { A: '06-14', B: '14-22', C: '22-06', D: 'MAINT' };

function currentWeek() {
  const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function oeeColor(oee) {
  if (oee >= 80) return '#22c55e';
  if (oee >= 60) return '#f97316';
  return '#ef4444';
}

function ArcGauge({ value, color }) {
  const r = 40; const cx = 60; const cy = 55;
  const angle = (value / 100) * 180;
  const rad = (angle - 180) * (Math.PI / 180);
  const x2 = cx + r * Math.cos(rad); const y2 = cy + r * Math.sin(rad);
  return (
    <svg width={120} height={65}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1e2533" strokeWidth={8} />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize={16} fontFamily="DM Mono">{value}%</text>
    </svg>
  );
}

function MachineGrid({ total, active }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: '0.5rem' }}>
      {Array.from({ length: Math.min(total, 40) }).map((_, i) => (
        <div key={i} style={{ width: 8, height: 8, background: i < Math.round((active / total) * Math.min(total, 40)) ? '#22c55e' : '#1e2533' }} />
      ))}
      {total > 40 && <span style={{ color: '#4a5568', fontSize: 10 }}>+{total - 40}</span>}
    </div>
  );
}

function OEECard({ line, week, shift }) {
  const [oee, setOee] = useState('');
  const [activeMachines, setActiveMachines] = useState(line.machines);
  const [trend, setTrend] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/oee?week=${week}&shift=${shift}`).then(r => r.json()).then(rows => {
      const row = rows.find(r => r.line_id === line.id);
      if (row) { setOee(row.oee_percent); setActiveMachines(row.active_machines); }
      else { setOee(''); setActiveMachines(line.machines); }
    });
    fetch(`/api/oee/trend/${line.id}?shift=${shift}`).then(r => r.json()).then(setTrend);
  }, [week, shift, line.id]);

  const color = oeeColor(+oee || 0);

  const save = async () => {
    await api(`/api/oee/${line.id}`, 'PUT', { week, shift, oee_percent: +oee, active_machines: +activeMachines });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ background: '#12161f', border: '1px solid #1e2533', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.06em' }}>{line.name}</span>
        <ArcGauge value={+oee || 0} color={color} />
      </div>
      <MachineGrid total={line.machines} active={+activeMachines} />
      <div style={{ color: '#4a5568', fontSize: 10, marginTop: 4 }}>{activeMachines}/{line.machines} MACHINES ACTIVE</div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center' }}>
        <span style={{ color: '#4a5568', fontSize: 11, width: 60 }}>OEE %</span>
        <input style={{ background: '#0f1117', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.25rem 0.5rem', width: 60, fontSize: 13 }} type="number" min="0" max="100" value={oee} onChange={e => setOee(e.target.value)} />
        <span style={{ color: '#4a5568', fontSize: 11, width: 70 }}>ACTIVE M.</span>
        <input style={{ background: '#0f1117', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.25rem 0.5rem', width: 55, fontSize: 13 }} type="number" value={activeMachines} onChange={e => setActiveMachines(e.target.value)} />
        <button onClick={save} style={{ background: saved ? '#22c55e' : '#1e2533', color: saved ? '#0f1117' : '#e2e8f0', border: 'none', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: 10 }}>
          {saved ? '✓' : 'SAVE'}
        </button>
      </div>
      {trend.length > 1 && (
        <ResponsiveContainer width="100%" height={55} style={{ marginTop: '0.75rem' }}>
          <LineChart data={trend}>
            <Line type="monotone" dataKey="oee_percent" stroke={color} dot={false} strokeWidth={2} />
            <XAxis dataKey="week" hide /><YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#12161f', border: '1px solid #1e2533', fontSize: 11 }} formatter={v => v + '%'} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function OEETracking() {
  const [week, setWeek] = useState(currentWeek());
  const [shift, setShift] = useState('A');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568' }}>OEE TRACKING</h2>
        <input type="week" value={week} onChange={e => setWeek(e.target.value)} style={{ background: '#12161f', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.35rem 0.75rem', fontSize: 13 }} />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {SHIFTS.map(s => (
            <button key={s} onClick={() => setShift(s)} style={{ background: shift === s ? '#3b82f6' : '#1e2533', color: shift === s ? '#0f1117' : '#4a5568', border: 'none', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{s}</button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#4a5568' }}>SHIFT {shift} · {SHIFT_HOURS[shift]}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {LINES.map(line => <OEECard key={`${line.id}-${shift}`} line={line} week={week} shift={shift} />)}
      </div>
    </div>
  );
}
