import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const LINES = [
  { id: 1, name: 'Backend', operators: 42 },
  { id: 2, name: 'T&F', operators: 28 },
  { id: 3, name: 'SPEA', operators: 35 },
  { id: 4, name: 'FT', operators: 22 },
  { id: 5, name: 'Small FT', operators: 18 },
];

function currentWeek() {
  const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function absenceColor(pct) {
  if (pct < 5) return '#22c55e';
  if (pct < 10) return '#eab308';
  if (pct < 15) return '#f97316';
  return '#ef4444';
}

function HeadcountCard({ line, week }) {
  const [total, setTotal] = useState(line.operators);
  const [absent, setAbsent] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/headcount?week=${week}`).then(r => r.json()).then(rows => {
      const row = rows.find(r => r.line_id === line.id);
      if (row) { setTotal(row.total); setAbsent(row.absent); }
    });
  }, [week, line.id]);

  const pct = total > 0 ? Math.round((absent / total) * 100) : 0;
  const color = absenceColor(pct);

  const save = async () => {
    await api(`/api/headcount/${line.id}`, 'PUT', { week, total: +total, absent: +absent });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ background: '#12161f', border: '1px solid #1e2533', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.06em' }}>{line.name}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 500, color, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>ABSENCE RATE</div>
        </div>
      </div>
      <div style={{ height: 6, background: '#1e2533', marginBottom: '0.75rem' }}>
        <div style={{ width: Math.min(pct, 100) + '%', height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ color: '#4a5568', fontSize: 11, width: 70 }}>TOTAL OPS</span>
        <input style={{ background: '#0f1117', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.25rem 0.5rem', width: 70, fontSize: 13 }} type="number" value={total} onChange={e => setTotal(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ color: '#4a5568', fontSize: 11, width: 70 }}>ABSENT</span>
        <input style={{ background: '#0f1117', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.25rem 0.5rem', width: 70, fontSize: 13 }} type="number" value={absent} onChange={e => setAbsent(e.target.value)} />
        <span style={{ color, fontSize: 11 }}>{absent} / {total} operators</span>
      </div>
      <button onClick={save} style={{ background: saved ? '#22c55e' : '#1e2533', color: saved ? '#0f1117' : '#e2e8f0', border: 'none', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em' }}>
        {saved ? 'SAVED ✓' : 'SAVE'}
      </button>
    </div>
  );
}

export default function Headcount() {
  const [week, setWeek] = useState(currentWeek());
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568' }}>HEADCOUNT & ABSENCE</h2>
        <input type="week" value={week} onChange={e => setWeek(e.target.value)} style={{ background: '#12161f', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.35rem 0.75rem', fontSize: 13 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {LINES.map(line => <HeadcountCard key={line.id} line={line} week={week} />)}
      </div>
    </div>
  );
}
