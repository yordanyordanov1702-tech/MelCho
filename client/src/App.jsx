import React, { useState } from 'react';
import Layout from './components/Layout.jsx';
import ProductionLoad from './components/ProductionLoad.jsx';
import OEETracking from './components/OEETracking.jsx';
import Headcount from './components/Headcount.jsx';
import Certifications from './components/Certifications.jsx';
import ImportExcel from './components/ImportExcel.jsx';

const TABS = [
  { id: 'production', label: 'PRODUCTION LOAD' },
  { id: 'oee', label: 'OEE' },
  { id: 'headcount', label: 'HEADCOUNT' },
  { id: 'certifications', label: 'CERTIFICATIONS' },
  { id: 'import', label: 'IMPORT' },
];

export default function App() {
  const [tab, setTab] = useState('production');

  return (
    <Layout tab={tab} tabs={TABS} onTab={setTab}>
      {tab === 'production' && <ProductionLoad />}
      {tab === 'oee' && <OEETracking />}
      {tab === 'headcount' && <Headcount />}
      {tab === 'certifications' && <Certifications />}
      {tab === 'import' && <ImportExcel />}
    </Layout>
  );
}
