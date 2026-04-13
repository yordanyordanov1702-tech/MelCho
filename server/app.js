import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import productionRoutes from './routes/production.js';
import oeeRoutes from './routes/oee.js';
import headcountRoutes from './routes/headcount.js';
import certRoutes from './routes/certifications.js';
import importRoutes from './routes/import.js';
import liveRoutes from './routes/live.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const db = new Database(join(__dirname, '../database/planner.db'));
db.pragma('journal_mode = WAL');

// Migration: drop tables if shift column is missing
const hasShift = db.prepare("PRAGMA table_info(production_load)").all().some(c => c.name === 'shift');
if (!hasShift) {
  db.exec(`DROP TABLE IF EXISTS production_load; DROP TABLE IF EXISTS oee; DROP TABLE IF EXISTS headcount;`);
}

const schema = readFileSync(join(__dirname, '../database/schema.sql'), 'utf8');
db.exec(schema);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/production', productionRoutes);
app.use('/api/oee', oeeRoutes);
app.use('/api/headcount', headcountRoutes);
app.use('/api/certifications', certRoutes);
app.use('/api/import', importRoutes);
app.use('/api/live', liveRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
