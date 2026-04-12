import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const LINES = [
  { id: 1, name: 'Backend' }, { id: 2, name: 'T&F' }, { id: 3, name: 'SPEA' },
  { id: 4, name: 'FT' }, { id: 5, name: 'Small FT' },
];

const STATUS_COLORS = {
  EXPIRED: '#ef4444', EXPIRING: '#f97316', WARNING: '#eab308', VALID: '#22c55e'
};

export default function Certifications() {
  const [ops, setOps] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [lineFilter, setLineFilter] = useState('');
  const [form, setForm] = useState({ name: '', line_id: '1', cert_expiry: '' });
  const [editing, setEditing] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (filter !== 'ALL') params.set('filter', filter);
    if (lineFilter) params.set('line_id', lineFilter);
    fetch(`/api/certifications?${params}`).then(r => r.json()).then(setOps);
    fetch('/api/certifications/summary').then(r => r.json()).then(setSummary);
  };

  useEffect(load, [filter, lineFilter]);

  const save = async () => {
    if (editing) { await api(`/api/certifications/${editing}`, 'PUT', form); setEditing(null); }
    else { await api('/api/certifications', 'POST', form); }
    setForm({ name: '', line_id: '1', cert_expiry: '' });
    load();
  };

  const del = async (id) => { await api(`/api/certifications/${id}`, 'DELETE'); load(); };

  const inputStyle = { background: '#0f1117', border: '1px solid #1e2533', color: '#e2e8f0', padding: '0.4rem 0.75rem', fontSize: 12 };

  return (
    <div>
      <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568', marginBottom: '1.5rem' }}>OPERATOR CERTIFICATION TRACKING</h2>

      {/* Summary per line */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {summary.map(s => (
          <div key={s.id} style={{ background: '#12161f', border: `1px solid ${s.expired > 0 ? '#ef4444' : '#1e2533'}`, padding: '0.75rem 1.25rem', minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#4a5568', letterSpacing: '0.06em', marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: s.expired > 0 ? '#ef4444' : '#22c55e' }}>{s.expired}</div>
            <div style={{ fontSize: 10, color: '#4a5568' }}>EXPIRED / {s.total} TOTAL</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'EXPIRED', 'EXPIRING'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? '#1e2533' : 'none', border: '1px solid #1e2533', color: filter === f ? '#e2e8f0' : '#4a5568', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em' }}>{f}</button>
        ))}
        <select value={lineFilter} onChange={e => setLineFilter(e.target.value)} style={{ ...inputStyle, marginLeft: '1rem' }}>
          <option value="">ALL LINES</option>
          {LINES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Add / Edit form */}
      <div style={{ background: '#12161f', border: '1px solid #1e2533', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 4 }}>OPERATOR NAME</div>
          <input style={{ ...inputStyle, width: 180 }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name..." />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 4 }}>LINE</div>
          <select style={inputStyle} value={form.line_id} onChange={e => setForm({ ...form, line_id: e.target.value })}>
            {LINES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 4 }}>CERT EXPIRY</div>
          <input style={inputStyle} type="date" value={form.cert_expiry} onChange={e => setForm({ ...form, cert_expiry: e.target.value })} />
        </div>
        <button onClick={save} style={{ background: '#3b82f6', color: '#0f1117', border: 'none', padding: '0.4rem 1.25rem', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
          {editing ? 'UPDATE' : 'ADD OPERATOR'}
        </button>
        {editing && <button onClick={() => { setEditing(null); setForm({ name: '', line_id: '1', cert_expiry: '' }); }} style={{ background: '#1e2533', color: '#e2e8f0', border: 'none', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: 11 }}>CANCEL</button>}
      </div>

      {/* Operators table */}
      <div style={{ background: '#12161f', border: '1px solid #1e2533' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e2533' }}>
              {['OPERATOR', 'LINE', 'CERT EXPIRY', 'STATUS', 'ACTIONS'].map(h => (
                <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: 10, color: '#4a5568', letterSpacing: '0.1em', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ops.map(op => (
              <tr key={op.id} style={{ borderBottom: '1px solid #1e2533' }}>
                <td style={{ padding: '0.6rem 1rem', fontSize: 13 }}>{op.name}</td>
                <td style={{ padding: '0.6rem 1rem', fontSize: 12, color: '#4a5568' }}>{op.line_name}</td>
                <td style={{ padding: '0.6rem 1rem', fontSize: 12 }}>{op.cert_expiry || '—'}</td>
                <td style={{ padding: '0.6rem 1rem' }}>
                  <span style={{ background: STATUS_COLORS[op.status] + '22', color: STATUS_COLORS[op.status], padding: '0.15rem 0.5rem', fontSize: 10, letterSpacing: '0.08em' }}>{op.status}</span>
                </td>
                <td style={{ padding: '0.6rem 1rem' }}>
                  <button onClick={() => { setEditing(op.id); setForm({ name: op.name, line_id: String(op.line_id), cert_expiry: op.cert_expiry || '' }); }} style={{ background: 'none', border: '1px solid #1e2533', color: '#4a5568', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: 10, marginRight: 6 }}>EDIT</button>
                  <button onClick={() => del(op.id)} style={{ background: 'none', border: '1px solid #ef444433', color: '#ef4444', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: 10 }}>DEL</button>
                </td>
              </tr>
            ))}
            {ops.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#4a5568', fontSize: 12 }}>No operators found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
