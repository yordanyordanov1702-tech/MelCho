import { Router } from 'express';
import { db } from '../app.js';

const router = Router();

router.get('/', (req, res) => {
  const { week } = req.query;
  const rows = db.prepare(`
    SELECT o.*, l.name as line_name, l.machines
    FROM oee o JOIN lines l ON o.line_id = l.id
    WHERE o.week = ?
  `).all(week);
  res.json(rows);
});

router.put('/:lineId', (req, res) => {
  const { lineId } = req.params;
  const { week, oee_percent, active_machines } = req.body;
  db.prepare(`
    INSERT INTO oee (line_id, week, oee_percent, active_machines)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(line_id, week) DO UPDATE SET oee_percent=excluded.oee_percent, active_machines=excluded.active_machines
  `).run(lineId, week, oee_percent, active_machines);
  res.json({ ok: true });
});

router.get('/trend/:lineId', (req, res) => {
  const rows = db.prepare(`
    SELECT week, oee_percent FROM oee
    WHERE line_id = ? ORDER BY week ASC LIMIT 8
  `).all(req.params.lineId);
  res.json(rows);
});

export default router;
