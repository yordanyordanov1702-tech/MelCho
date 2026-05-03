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
app.use(express.json());

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
  const info = {
    garmin_lib_exists:   existsSync(garminLib),
    garmin_lib_files:    existsSync(garminLib)  ? readdirSync(garminLib).slice(0, 15)  : [],
    python_deps_exists:  existsSync(pythonDeps),
    python_deps_files:   existsSync(pythonDeps) ? readdirSync(pythonDeps).slice(0, 5) : [],
  };
  const PYTHONPATH = [garminLib, pythonDeps].join(':');
  execFile('python3', ['-c',
    'import sys; print(sys.version); ' +
    'import garminconnect; print("garminconnect OK")'
  ], { env: { ...process.env, PYTHONPATH } }, (err, stdout, stderr) => {
    res.json({ ...info, stdout: stdout.trim(), stderr: stderr.trim(), error: err?.message });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
