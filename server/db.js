import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
