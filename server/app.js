import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { execFile } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import productionRoutes from './routes/production.js';
import oeeRoutes from './routes/oee.js';
import headcountRoutes from './routes/headcount.js';
import certRoutes from './routes/certifications.js';
import importRoutes from './routes/import.js';
import liveRoutes from './routes/live.js';
import stravaRoutes from './routes/strava.js';
import garminRoutes from './routes/garmin.js';

export { db };

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));

app.use('/api/production', productionRoutes);
app.use('/api/oee', oeeRoutes);
app.use('/api/headcount', headcountRoutes);
app.use('/api/certifications', certRoutes);
app.use('/api/import', importRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/garmin', garminRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Debug endpoint — remove after diagnosis
app.get('/api/debug/python', (_, res) => {
  const garminLib  = join(__dirname, 'garmin_lib');
  const pythonDeps = join(__dirname, 'python_deps');
  const script     = join(__dirname, 'garmin_fetch.py');
  const info = {
    garmin_lib_exists:   existsSync(garminLib),
    garmin_lib_files:    existsSync(garminLib)  ? readdirSync(garminLib).slice(0, 15)  : [],
    script_exists:       existsSync(script),
    __dirname:           __dirname,
  };
  // Test 1: import with PYTHONPATH (as debug does)
  const PYTHONPATH = [garminLib, pythonDeps].join(':');
  execFile('python3', ['-c',
    `import sys; sys.path.insert(0,'${garminLib}'); import garminconnect; print("OK")`
  ], { env: process.env }, (err, stdout, stderr) => {
    info.test_syspath = { stdout: stdout.trim(), stderr: stderr.trim(), error: err?.message };
    // Test 2: run garmin_fetch.py diagnose to inspect token/exchange state
    execFile('python3', [script, 'diagnose'], { timeout: 40000, env: process.env }, (err2, out2, err2s) => {
      try { info.diagnose = JSON.parse(out2.trim()); } catch { info.diagnose_raw = out2.trim(); }
      info.diagnose_stderr = err2s.trim();
      res.json(info);
    });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
