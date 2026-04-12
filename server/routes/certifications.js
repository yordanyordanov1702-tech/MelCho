import { Router } from 'express';
import { db } from '../app.js';

const router = Router();

router.get('/', (req, res) => {
  const { filter, line_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const warn30 = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];
  const warn14 = new Date(Date.now() + 14*86400000).toISOString().split('T')[0];

  let sql = `SELECT o.*, l.name as line_name FROM operators o JOIN lines l ON o.line_id = l.id WHERE 1=1`;
  const params = [];

  if (line_id) { sql += ' AND o.line_id = ?'; params.push(line_id); }
  if (filter === 'EXPIRED') { sql += ' AND cert_expiry < ?'; params.push(today); }
  else if (filter === 'EXPIRING') { sql += ' AND cert_expiry BETWEEN ? AND ?'; params.push(today, warn14); }

  const rows = db.prepare(sql + ' ORDER BY cert_expiry ASC').all(...params);

  const result = rows.map(op => {
    let status = 'VALID';
    if (!op.cert_expiry) { status = 'VALID'; }
    else if (op.cert_expiry < today) { status = 'EXPIRED'; }
    else if (op.cert_expiry <= warn14) { status = 'EXPIRING'; }
    else if (op.cert_expiry <= warn30) { status = 'WARNING'; }
    return { ...op, status };
  });

  res.json(result);
});

router.get('/summary', (_, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`
    SELECT l.id, l.name,
      COUNT(o.id) as total,
      SUM(CASE WHEN o.cert_expiry < ? THEN 1 ELSE 0 END) as expired
    FROM lines l LEFT JOIN operators o ON o.line_id = l.id
    GROUP BY l.id
  `).all(today);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, line_id, cert_expiry } = req.body;
  const result = db.prepare(`INSERT INTO operators (name, line_id, cert_expiry) VALUES (?,?,?)`).run(name, line_id, cert_expiry);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, line_id, cert_expiry } = req.body;
  db.prepare(`UPDATE operators SET name=?, line_id=?, cert_expiry=? WHERE id=?`).run(name, line_id, cert_expiry, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM operators WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

export default router;
