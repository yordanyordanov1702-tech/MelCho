import { Router } from 'express';
import { db } from '../app.js';

const router = Router();

router.get('/', (req, res) => {
  const { week } = req.query;
  const rows = db.prepare(`
    SELECT h.*, l.name as line_name, l.operators
    FROM headcount h JOIN lines l ON h.line_id = l.id
    WHERE h.week = ?
  `).all(week);
  res.json(rows);
});

router.put('/:lineId', (req, res) => {
  const { lineId } = req.params;
  const { week, total, absent } = req.body;
  db.prepare(`
    INSERT INTO headcount (line_id, week, total, absent)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(line_id, week) DO UPDATE SET total=excluded.total, absent=excluded.absent
  `).run(lineId, week, total, absent);
  res.json({ ok: true });
});

export default router;
