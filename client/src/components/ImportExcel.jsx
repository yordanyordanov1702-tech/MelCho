import React, { useState } from 'react';

export default function ImportExcel() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/import/excel', { method: 'POST', body: form });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568', marginBottom: '1.5rem' }}>IMPORT EXCEL DATA</h2>

      <div style={{ background: '#12161f', border: '1px solid #1e2533', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, color: '#4a5568', marginBottom: '1rem', letterSpacing: '0.06em' }}>EXPECTED SHEETS IN EXCEL FILE:</div>
        {[
          ['Production', 'line_name, week, planned, capacity'],
          ['OEE', 'line_name, week, oee_percent, active_machines'],
          ['Operators', 'name, line_name, cert_expiry'],
        ].map(([sheet, cols]) => (
          <div key={sheet} style={{ marginBottom: '0.75rem' }}>
            <span style={{ color: '#3b82f6', fontSize: 12 }}>{sheet}</span>
            <span style={{ color: '#4a5568', fontSize: 11, marginLeft: 12 }}>{cols}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#4a5568', marginTop: '1rem' }}>
          Line names must match exactly: <span style={{ color: '#e2e8f0' }}>Backend, T&amp;F, SPEA, FT, Small FT</span>
        </div>
      </div>

      <div style={{ border: '2px dashed #1e2533', padding: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
        <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} id="file-input" />
        <label htmlFor="file-input" style={{ cursor: 'pointer', color: '#3b82f6', fontSize: 12, letterSpacing: '0.06em' }}>
          {file ? file.name : 'CLICK TO SELECT .XLSX FILE'}
        </label>
      </div>

      <button onClick={upload} disabled={!file || loading} style={{ background: file ? '#3b82f6' : '#1e2533', color: file ? '#0f1117' : '#4a5568', border: 'none', padding: '0.6rem 1.5rem', cursor: file ? 'pointer' : 'not-allowed', fontSize: 12, letterSpacing: '0.06em', fontWeight: 500 }}>
        {loading ? 'IMPORTING...' : 'IMPORT'}
      </button>

      {result && (
        <div style={{ marginTop: '1.5rem', background: '#12161f', border: `1px solid ${result.errors?.length ? '#ef4444' : '#22c55e'}`, padding: '1rem' }}>
          <div style={{ color: '#22c55e', fontSize: 12, marginBottom: '0.5rem' }}>✓ {result.imported} rows imported</div>
          {result.errors?.map((e, i) => <div key={i} style={{ color: '#ef4444', fontSize: 11 }}>✗ {e}</div>)}
        </div>
      )}
    </div>
  );
}
