import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { week, shift = 'A' } = req.query;
  const rows = db.prepare(`
    SELECT h.*, l.name as line_name, l.operators
    FROM headcount h JOIN lines l ON h.line_id = l.id
    WHERE h.week = ? AND h.shift = ?
  `).all(week, shift);
  res.json(rows);
});

router.put('/:lineId', (req, res) => {
  const { lineId } = req.params;
  const { week, shift = 'A', total, absent } = req.body;
  db.prepare(`
    INSERT INTO headcount (line_id, week, shift, total, absent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(line_id, week, shift) DO UPDATE SET total=excluded.total, absent=excluded.absent
  `).run(lineId, week, shift, total, absent);
  res.json({ ok: true });
});

export default router;
