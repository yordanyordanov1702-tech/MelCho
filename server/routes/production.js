import { Router } from 'express';
import { db } from '../app.js';

const router = Router();

router.get('/', (req, res) => {
  const { week } = req.query;
  const rows = db.prepare(`
    SELECT pl.*, l.name as line_name, l.machines, l.operators
    FROM production_load pl
    JOIN lines l ON pl.line_id = l.id
    WHERE pl.week = ?
  `).all(week);
  res.json(rows);
});

router.get('/weeks', (_, res) => {
  const rows = db.prepare(`SELECT DISTINCT week FROM production_load ORDER BY week DESC LIMIT 12`).all();
  res.json(rows.map(r => r.week));
});

router.put('/:lineId', (req, res) => {
  const { lineId } = req.params;
  const { week, planned, capacity } = req.body;
  db.prepare(`
    INSERT INTO production_load (line_id, week, planned, capacity)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(line_id, week) DO UPDATE SET planned=excluded.planned, capacity=excluded.capacity
  `).run(lineId, week, planned, capacity);
  res.json({ ok: true });
});

router.get('/trend/:lineId', (req, res) => {
  const rows = db.prepare(`
    SELECT week, planned, capacity FROM production_load
    WHERE line_id = ? ORDER BY week ASC LIMIT 8
  `).all(req.params.lineId);
  res.json(rows);
});

export default router;
