import { Router } from 'express';
import { db } from '../app.js';

const router = Router();

router.get('/', (req, res) => {
  const { week, shift = 'A' } = req.query;
  const rows = db.prepare(`
    SELECT pl.*, l.name as line_name, l.machines, l.operators
    FROM production_load pl
    JOIN lines l ON pl.line_id = l.id
    WHERE pl.week = ? AND pl.shift = ?
  `).all(week, shift);
  res.json(rows);
});

router.get('/weeks', (_, res) => {
  const rows = db.prepare(`SELECT DISTINCT week FROM production_load ORDER BY week DESC LIMIT 12`).all();
  res.json(rows.map(r => r.week));
});

router.put('/:lineId', (req, res) => {
  const { lineId } = req.params;
  const { week, shift = 'A', planned, capacity } = req.body;
  db.prepare(`
    INSERT INTO production_load (line_id, week, shift, planned, capacity)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(line_id, week, shift) DO UPDATE SET planned=excluded.planned, capacity=excluded.capacity
  `).run(lineId, week, shift, planned, capacity);
  res.json({ ok: true });
});

router.get('/trend/:lineId', (req, res) => {
  const { shift = 'A' } = req.query;
  const rows = db.prepare(`
    SELECT week, planned, capacity FROM production_load
    WHERE line_id = ? AND shift = ? ORDER BY week ASC LIMIT 8
  `).all(req.params.lineId, shift);
  res.json(rows);
});

export default router;
