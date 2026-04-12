import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db } from '../app.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/excel', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const results = { imported: 0, errors: [] };

  // Sheet: Production (columns: line_name, week, planned, capacity)
  if (workbook.SheetNames.includes('Production')) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Production']);
    rows.forEach(row => {
      const line = db.prepare(`SELECT id FROM lines WHERE name = ?`).get(row.line_name || row.Line);
      if (!line) { results.errors.push(`Unknown line: ${row.line_name}`); return; }
      db.prepare(`INSERT INTO production_load (line_id, week, planned, capacity) VALUES (?,?,?,?)
        ON CONFLICT(line_id, week) DO UPDATE SET planned=excluded.planned, capacity=excluded.capacity`)
        .run(line.id, row.week || row.Week, row.planned || row.Planned, row.capacity || row.Capacity);
      results.imported++;
    });
  }

  // Sheet: OEE (columns: line_name, week, oee_percent, active_machines)
  if (workbook.SheetNames.includes('OEE')) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['OEE']);
    rows.forEach(row => {
      const line = db.prepare(`SELECT id FROM lines WHERE name = ?`).get(row.line_name || row.Line);
      if (!line) { results.errors.push(`Unknown line: ${row.line_name}`); return; }
      db.prepare(`INSERT INTO oee (line_id, week, oee_percent, active_machines) VALUES (?,?,?,?)
        ON CONFLICT(line_id, week) DO UPDATE SET oee_percent=excluded.oee_percent, active_machines=excluded.active_machines`)
        .run(line.id, row.week || row.Week, row.oee_percent || row.OEE, row.active_machines || row.ActiveMachines);
      results.imported++;
    });
  }

  // Sheet: Operators (columns: name, line_name, cert_expiry)
  if (workbook.SheetNames.includes('Operators')) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Operators'], { cellDates: true });
    rows.forEach(row => {
      const line = db.prepare(`SELECT id FROM lines WHERE name = ?`).get(row.line_name || row.Line);
      if (!line) { results.errors.push(`Unknown line: ${row.line_name}`); return; }
      const expiry = row.cert_expiry instanceof Date
        ? row.cert_expiry.toISOString().split('T')[0]
        : row.cert_expiry || row.CertExpiry;
      db.prepare(`INSERT INTO operators (name, line_id, cert_expiry) VALUES (?,?,?)`)
        .run(row.name || row.Name, line.id, expiry);
      results.imported++;
    });
  }

  res.json(results);
});

export default router;
