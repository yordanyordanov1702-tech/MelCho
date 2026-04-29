import React, { useState } from 'react';
import Layout from './components/Layout.jsx';
import LiveDashboard from './components/LiveDashboard.jsx';
import ProductionLoad from './components/ProductionLoad.jsx';
import OEETracking from './components/OEETracking.jsx';
import Headcount from './components/Headcount.jsx';
import Certifications from './components/Certifications.jsx';
import ImportExcel from './components/ImportExcel.jsx';
import Strava from './components/Strava.jsx';
import Garmin from './components/Garmin.jsx';

const TABS = [
  { id: 'live', label: '⬤ LIVE' },
  { id: 'production', label: 'PRODUCTION LOAD' },
  { id: 'oee', label: 'OEE' },
  { id: 'headcount', label: 'HEADCOUNT' },
  { id: 'certifications', label: 'CERTIFICATIONS' },
  { id: 'import', label: 'IMPORT' },
  { id: 'strava', label: 'STRAVA' },
  { id: 'garmin', label: 'GARMIN' },
];

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initTab = params.get('strava') || params.get('strava_error') ? 'strava' : 'live';
  const [tab, setTab] = useState(initTab);

  return (
    <Layout tab={tab} tabs={TABS} onTab={setTab}>
      {tab === 'live' && <LiveDashboard />}
      {tab === 'production' && <ProductionLoad />}
      {tab === 'oee' && <OEETracking />}
      {tab === 'headcount' && <Headcount />}
      {tab === 'certifications' && <Certifications />}
      {tab === 'import' && <ImportExcel />}
      {tab === 'strava' && <Strava />}
      {tab === 'garmin' && <Garmin />}
    </Layout>
  );
}
