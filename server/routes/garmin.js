import { Router }   from 'express';
import { execFile }  from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT    = join(__dirname, '..', 'garmin_fetch.py');
const PYTHON    = process.env.PYTHON_PATH || 'python3';

const router = Router();

// ── Run Python script ──────────────────────────────────────────────────────

function runPython(args, timeout = 40000) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [SCRIPT, ...args], { timeout, env: process.env }, (err, stdout, stderr) => {
      const raw = (stdout || '').trim();
      try {
        const parsed = JSON.parse(raw);
        if (err && !parsed.error) parsed.error = stderr || err.message;
        return resolve(parsed);
      } catch {
        reject(new Error(stderr || err?.message || `Bad output: ${raw.slice(0, 200)}`));
      }
    });
  });
}

// ── Simple in-memory cache ─────────────────────────────────────────────────

let statusCache        = null;
let statusCacheAt      = 0;
let activitiesCache    = null;
let activitiesCacheAt  = 0;
const STATUS_TTL       = 5  * 60 * 1000;   // 5 min
const ACTIVITIES_TTL   = 10 * 60 * 1000;   // 10 min

// ── Routes ─────────────────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD)
    return res.json({ connected: false, reason: 'no_credentials' });

  const now = Date.now();
  if (statusCache && now - statusCacheAt < STATUS_TTL)
    return res.json(statusCache);

  try {
    const result = await runPython(['status']);
    if (result.error) return res.json({ connected: false, reason: result.error });
    statusCache   = result;
    statusCacheAt = now;
    res.json(result);
  } catch (e) {
    res.json({ connected: false, reason: e.message });
  }
});

router.get('/activities', async (req, res) => {
  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD)
    return res.status(401).json({ error: 'not_connected' });

  const start = parseInt(req.query.start || '0', 10);
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 100);
  const now   = Date.now();

  if (start === 0 && activitiesCache && now - activitiesCacheAt < ACTIVITIES_TTL)
    return res.json(activitiesCache.slice(0, limit));

  try {
    const result = await runPython(['activities', String(start), String(limit)], 60000);
    if (!Array.isArray(result)) return res.status(500).json({ error: result?.error || 'bad_response' });
    if (start === 0) { activitiesCache = result; activitiesCacheAt = now; }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
