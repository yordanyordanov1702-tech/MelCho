import React, { useRef } from 'react';

const s = {
  shell: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f1117' },
  header: {
    background: '#12161f', borderBottom: '1px solid #1e2533',
    padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem', height: 56
  },
  logo: { color: '#3b82f6', fontWeight: 500, fontSize: 15, letterSpacing: '0.08em', whiteSpace: 'nowrap' },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 6 },
  navWrap: { display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 2 },
  scrollBtn: {
    background: '#1e2533', border: '1px solid #2d3748', color: '#94a3b8', cursor: 'pointer',
    fontSize: 18, padding: '0 8px', flexShrink: 0, lineHeight: '28px', borderRadius: 4,
    transition: 'color 0.15s', userSelect: 'none'
  },
  nav: { display: 'flex', gap: '0.25rem', flex: 1, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' },
  tab: (active) => ({
    padding: '0 0.65rem', height: 56, border: 'none', background: 'none', cursor: 'pointer',
    color: active ? '#e2e8f0' : '#4a5568', fontSize: 11, letterSpacing: '0.08em', whiteSpace: 'nowrap',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    transition: 'all 0.15s'
  }),
  main: { flex: 1, padding: '2rem', overflowX: 'auto' },
  badge: {
    marginLeft: 'auto', background: '#1e2533', color: '#4a5568',
    padding: '0.25rem 0.75rem', fontSize: 11, letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0
  }
};

export default function Layout({ children, tabs, tab, onTab }) {
  const navRef = useRef(null);
  const scroll = (dir) => {
    if (navRef.current) navRef.current.scrollBy({ left: dir * 120, behavior: 'smooth' });
  };

  return (
    <div style={s.shell}>
      <header style={s.header}>
        <div style={s.logo}><span style={s.dot} />Dan-Stra</div>
        <div style={s.navWrap}>
          <button style={s.scrollBtn} onClick={() => scroll(-1)}>&#8249;</button>
          <nav ref={navRef} style={s.nav}>
            {tabs.map(t => (
              <button key={t.id} style={s.tab(tab === t.id)} onClick={() => onTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <button style={s.scrollBtn} onClick={() => scroll(1)}>&#8250;</button>
        </div>
        <div style={s.badge}>PRODUCTION PLANNER v1.0</div>
      </header>
      <main style={s.main}>{children}</main>
    </div>
  );
}
