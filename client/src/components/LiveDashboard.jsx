import React, { useState, useEffect, useRef } from 'react';

function oeeColor(v) {
  if (v >= 80) return '#22c55e';
  if (v >= 60) return '#f97316';
  return '#ef4444';
}

function Sparkline({ values, color }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80; const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseDot({ color }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'pulse 1.4s ease-in-out infinite', opacity: 0.5 }} />
      <span style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: color }} />
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(2.2);opacity:0} }`}</style>
    </span>
  );
}

export default function LiveDashboard() {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  const [countdown, setCountdown] = useState(30);
  const history = useRef({});

  const fetchLive = () => {
    fetch('/api/live').then(r => r.json()).then(d => {
      setData(d);
      setTick(t => t + 1);
      setCountdown(30);
      d.metrics.forEach(m => {
        if (!history.current[m.id]) history.current[m.id] = [];
        history.current[m.id].push(m.oee);
        if (history.current[m.id].length > 20) history.current[m.id].shift();
      });
    }).catch(() => {});
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#4a5568', fontSize: 12 }}>
      CONNECTING TO LIVE FEED...
    </div>
  );

  const shift = data.metrics[0]?.shift || 'DAY';
  const avgOee = (data.metrics.reduce((s, m) => s + m.oee, 0) / data.metrics.length).toFixed(1);
  const totalOutput = data.metrics.reduce((s, m) => s + m.output_per_hour, 0);
  const totalMachines = data.metrics.reduce((s, m) => s + m.active_machines, 0);
  const totalMachinesMax = data.metrics.reduce((s, m) => s + m.total_machines, 0);

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 13, letterSpacing: '0.12em', color: '#4a5568', margin: 0 }}>LIVE FLOOR STATUS</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PulseDot color="#22c55e" />
          <span style={{ fontSize: 10, color: '#22c55e', letterSpacing: '0.1em' }}>LIVE</span>
        </div>
        <span style={{ fontSize: 10, color: '#4a5568' }}>REFRESH IN {countdown}s</span>
        <span style={{ fontSize: 10, color: '#4a5568', marginLeft: 'auto' }}>SHIFT: {shift} &nbsp;|&nbsp; {new Date(data.ts).toLocaleTimeString('en-GB')}</span>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: '1px', marginBottom: '1.5rem', background: '#1e2533' }}>
        {[
          { label: 'FLOOR OEE', value: avgOee + '%', color: oeeColor(+avgOee) },
          { label: 'OUTPUT / HR', value: totalOutput.toLocaleString() + ' u', color: '#e2e8f0' },
          { label: 'MACHINES ON', value: `${totalMachines} / ${totalMachinesMax}`, color: '#e2e8f0' },
          { label: 'WEEK', value: data.week, color: '#e2e8f0' },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: '#12161f', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Line cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: '#1e2533' }}>
        {data.metrics.map(m => {
          const color = oeeColor(m.oee);
          const machinePct = Math.round((m.active_machines / m.total_machines) * 100);
          const opPct = Math.round((m.operators_present / m.total_operators) * 100);
          const hist = history.current[m.id] || [];

          return (
            <div key={m.id} style={{ background: '#12161f', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.06em' }}>{m.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PulseDot color={color} />
                  <span style={{ fontSize: 20, fontWeight: 500, color, lineHeight: 1 }}>{m.oee}%</span>
                </div>
              </div>

              {/* OEE bar */}
              <div style={{ height: 4, background: '#1e2533', marginBottom: '0.75rem' }}>
                <div style={{ width: Math.min(m.oee, 100) + '%', height: '100%', background: color, transition: 'width 0.8s ease' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ background: '#0f1117', padding: '0.5rem 0.75rem' }}>
                  <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 2 }}>OUTPUT / HR</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#e2e8f0' }}>{m.output_per_hour.toLocaleString()}</div>
                </div>
                <div style={{ background: '#0f1117', padding: '0.5rem 0.75rem' }}>
                  <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 2 }}>MACHINES</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#e2e8f0' }}>{m.active_machines}<span style={{ fontSize: 11, color: '#4a5568' }}>/{m.total_machines}</span></div>
                </div>
              </div>

              {/* Machine dots */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: '0.5rem' }}>
                {Array.from({ length: Math.min(m.total_machines, 30) }).map((_, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: i < Math.round((m.active_machines / m.total_machines) * Math.min(m.total_machines, 30)) ? color : '#1e2533' }} />
                ))}
                {m.total_machines > 30 && <span style={{ color: '#4a5568', fontSize: 9 }}>+{m.total_machines - 30}</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#4a5568' }}>OPS {m.operators_present}/{m.total_operators} PRESENT</span>
                <Sparkline values={hist} color={color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
