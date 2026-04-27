import React, { useState } from 'react';
import Layout from './components/Layout.jsx';
import LiveDashboard from './components/LiveDashboard.jsx';
import ProductionLoad from './components/ProductionLoad.jsx';
import OEETracking from './components/OEETracking.jsx';
import Headcount from './components/Headcount.jsx';
import Certifications from './components/Certifications.jsx';
import ImportExcel from './components/ImportExcel.jsx';
import Strava from './components/Strava.jsx';

const TABS = [
  { id: 'live', label: '⬤ LIVE' },
  { id: 'production', label: 'PRODUCTION LOAD' },
  { id: 'oee', label: 'OEE' },
  { id: 'headcount', label: 'HEADCOUNT' },
  { id: 'certifications', label: 'CERTIFICATIONS' },
  { id: 'import', label: 'IMPORT' },
  { id: 'strava', label: 'STRAVA' },
];

export default function App() {
  const [tab, setTab] = useState('live');

  return (
    <Layout tab={tab} tabs={TABS} onTab={setTab}>
      {tab === 'live' && <LiveDashboard />}
      {tab === 'production' && <ProductionLoad />}
      {tab === 'oee' && <OEETracking />}
      {tab === 'headcount' && <Headcount />}
      {tab === 'certifications' && <Certifications />}
      {tab === 'import' && <ImportExcel />}
      {tab === 'strava' && <Strava />}
    </Layout>
  );
}
