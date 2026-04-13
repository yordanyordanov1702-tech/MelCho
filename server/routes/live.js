import { Router } from 'express';
import { db } from '../app.js';

const router = Router();

// Simulate live fluctuation: ±variance% around base value
function fluctuate(base, variance = 0.04) {
  const delta = (Math.random() * 2 - 1) * variance;
  return Math.max(0, Math.round(base * (1 + delta)));
}

function fluctuateF(base, variance = 0.03) {
  const delta = (Math.random() * 2 - 1) * variance;
  return Math.max(0, +(base * (1 + delta)).toFixed(1));
}

// Shift-aware production rate multiplier (0-24h)
function shiftMultiplier() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 1.0;   // day shift
  if (h >= 14 && h < 22) return 0.95; // afternoon shift
  return 0.7;                          // night shift
}

function currentWeek() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

// GET /api/live — real-time simulated metrics for all lines
router.get('/', (req, res) => {
  const week = currentWeek();
  const lines = db.prepare('SELECT * FROM lines').all();
  const prodRows = db.prepare('SELECT * FROM production_load WHERE week = ?').all(week);
  const oeeRows = db.prepare('SELECT * FROM oee WHERE week = ?').all(week);
  const headRows = db.prepare('SELECT * FROM headcount WHERE week = ?').all(week);
  const mult = shiftMultiplier();

  const metrics = lines.map(line => {
    const prod = prodRows.find(r => r.line_id === line.id);
    const oee = oeeRows.find(r => r.line_id === line.id);
    const head = headRows.find(r => r.line_id === line.id);

    const baseOee = oee?.oee_percent || 75;
    const basePlanned = prod?.planned || 0;
    const capacity = prod?.capacity || 1000;
    const activeMachines = oee?.active_machines || line.machines;

    const liveOee = fluctuateF(baseOee);
    const liveOutput = fluctuate(Math.round((basePlanned / 8) * mult)); // units/hour
    const liveMachines = Math.min(line.machines, fluctuate(activeMachines, 0.02));
    const presentOps = (head?.total || line.operators) - (head?.absent || 0);
    const liveOps = Math.min(head?.total || line.operators, fluctuate(presentOps, 0.03));

    return {
      id: line.id,
      name: line.name,
      oee: liveOee,
      output_per_hour: liveOutput,
      capacity_per_hour: Math.round(capacity / 8),
      active_machines: liveMachines,
      total_machines: line.machines,
      operators_present: liveOps,
      total_operators: head?.total || line.operators,
      shift: mult === 1.0 ? 'DAY' : mult === 0.95 ? 'AFTERNOON' : 'NIGHT',
    };
  });

  res.json({ ts: new Date().toISOString(), week, metrics });
});

export default router;
