import { Router }   from 'express';
import { execFile }  from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http  from 'http';
import { writeFileSync, existsSync } from 'fs';
import { db } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT    = join(__dirname, '..', 'garmin_fetch.py');
const PYTHON    = process.env.PYTHON_PATH || 'python3';

const SESSION_FILE = '/tmp/garmin_session.json';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mel-cho.vercel.app';

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

// ── Follow redirects and collect cookies ───────────────────────────────────

function followRedirects(urlStr, cookieJar = [], maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(cookieJar.length ? { 'Cookie': cookieJar.join('; ') } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      // Collect Set-Cookie headers
      const setCookies = res.headers['set-cookie'] || [];
      for (const c of setCookies) {
        const nameVal = c.split(';')[0].trim();
        cookieJar.push(nameVal);
      }

      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let location = res.headers.location;
        // Handle relative redirects
        if (!location.startsWith('http')) {
          location = `${parsed.protocol}//${parsed.host}${location}`;
        }
        res.resume(); // discard body
        return resolve(followRedirects(location, cookieJar, maxRedirects - 1));
      }

      // Consume body to free socket
      res.resume();
      resolve({ statusCode: res.statusCode, cookies: cookieJar });
    });

    req.on('error', reject);
    req.end();
  });
}

// ── Simple in-memory cache ─────────────────────────────────────────────────

let statusCache        = null;
let statusCacheAt      = 0;
let activitiesCache    = null;
let activitiesCacheAt  = 0;
const STATUS_TTL       = 5  * 60 * 1000;   // 5 min
const ACTIVITIES_TTL   = 10 * 60 * 1000;   // 10 min

function hasSessionFile() {
  try { return existsSync(SESSION_FILE); } catch { return false; }
}

function clearCaches() {
  statusCache = null;
  statusCacheAt = 0;
  activitiesCache = null;
  activitiesCacheAt = 0;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// ── GET /api/garmin/connect — redirect browser to Garmin SSO ──────────────
router.get('/connect', (req, res) => {
  const callbackUrl = encodeURIComponent(`${FRONTEND_URL}/api/garmin/callback`);
  const ssoUrl = [
    'https://sso.garmin.com/sso/signin',
    `?service=${callbackUrl}`,
    '&clientId=GarminConnect',
    '&gauthHost=https://sso.garmin.com/sso',
    '&webhost=https://connect.garmin.com',
    '&source=https://connect.garmin.com/signin',
    `&redirectAfterAccountLoginUrl=${callbackUrl}`,
    `&redirectAfterAccountCreationUrl=${callbackUrl}`,
  ].join('');
  res.redirect(ssoUrl);
});

// ── GET /api/garmin/callback — exchange SSO ticket for session cookies ─────
router.get('/callback', async (req, res) => {
  const { ticket } = req.query;
  if (!ticket) {
    return res.status(400).send('Missing ticket parameter from Garmin SSO.');
  }

  try {
    const exchangeUrl = `https://connect.garmin.com/modern?ticket=${encodeURIComponent(ticket)}`;
    const { cookies } = await followRedirects(exchangeUrl);

    // Extract the important cookies
    const wantedKeys = ['JWT_WEB', 'SESSION', 'SESSIONID', 'GARMIN-SSO-CUST-GUID'];
    const collected = {};
    for (const c of cookies) {
      const [name] = c.split('=');
      if (wantedKeys.includes(name)) {
        collected[name] = c; // store as "NAME=value"
      }
    }

    if (!Object.keys(collected).length) {
      return res.status(502).send('Could not extract Garmin session cookies. The ticket may have expired — please try again.');
    }

    const cookieString = Object.values(collected).join('; ');
    writeFileSync(SESSION_FILE, JSON.stringify({ cookieString, at: Date.now() }), 'utf8');

    // Clear caches so next request re-fetches with new cookies
    clearCaches();

    res.redirect(`${FRONTEND_URL}/?tab=garmin&auth=success`);
  } catch (err) {
    console.error('[garmin/callback]', err);
    res.status(502).send(`Failed to exchange Garmin SSO ticket: ${err.message}`);
  }
});

router.get('/status', async (req, res) => {
  const hasAuth = process.env.GARMIN_COOKIES || process.env.GARMIN_TOKEN_BASE64 ||
                  (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) ||
                  hasSessionFile();

  // If we have synced data in DB, report connected even without live auth
  try {
    const meta = db.prepare('SELECT * FROM garmin_meta WHERE id = 1').get();
    if (meta && meta.count > 0) {
      const now = Date.now();
      if (statusCache && now - statusCacheAt < STATUS_TTL) return res.json(statusCache);
      return res.json({
        connected: true,
        displayName: 'Yordan',
        fullName: 'Yordan',
        syncedAt: meta.synced_at,
        activityCount: meta.count,
        source: 'db',
      });
    }
  } catch (e) { /* DB not ready */ }

  if (!hasAuth)
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
  const hasAuth = process.env.GARMIN_COOKIES || process.env.GARMIN_TOKEN_BASE64 ||
                  (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) ||
                  hasSessionFile();
  // Allow if we have any auth OR if the DB has cached activities
  const dbCount = db.prepare('SELECT count FROM garmin_meta WHERE id = 1').get();
  if (!hasAuth && !(dbCount && dbCount.count > 0))
    return res.status(401).json({ error: 'not_connected' });

  const start = parseInt(req.query.start || '0', 10);
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const now   = Date.now();

  // 1. Try cached DB activities first
  try {
    const rows = db.prepare(
      'SELECT data FROM garmin_activities ORDER BY activity_id DESC LIMIT ? OFFSET ?'
    ).all(limit, start);
    if (rows.length > 0) {
      const acts = rows.map(r => JSON.parse(r.data));
      return res.json(acts);
    }
  } catch (e) { /* DB not ready yet */ }

  // 2. No DB data — try live (will likely fail from Render, but worth trying)
  if (!hasAuth) return res.status(401).json({ error: 'no_data_synced_yet' });

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

// ── POST /api/garmin/sync — receive activities from local sync script ──────
router.post('/sync', (req, res) => {
  const secret = process.env.GARMIN_SYNC_SECRET || 'garmin-sync-2026';
  const auth   = req.headers['x-sync-secret'] || req.headers['authorization'] || '';
  if (auth !== secret && auth !== `Bearer ${secret}`)
    return res.status(401).json({ error: 'invalid_secret' });

  const { activities, displayName } = req.body;
  if (!Array.isArray(activities))
    return res.status(400).json({ error: 'activities must be an array' });

  try {
    const insert = db.prepare(
      'INSERT OR REPLACE INTO garmin_activities (activity_id, data, synced_at) VALUES (?, ?, ?)'
    );
    const now = Math.floor(Date.now() / 1000);
    const upsert = db.transaction((acts) => {
      for (const a of acts) {
        const id = a.activityId || a.id;
        if (id) insert.run(id, JSON.stringify(a), now);
      }
    });
    upsert(activities);

    db.prepare(
      'INSERT OR REPLACE INTO garmin_meta (id, synced_at, count) VALUES (1, ?, ?)'
    ).run(now, activities.length);

    // Clear in-memory caches
    clearCaches();
    if (displayName) {
      statusCache = { connected: true, displayName, fullName: displayName, syncedAt: now };
      statusCacheAt = Date.now();
    }

    res.json({ ok: true, saved: activities.length, synced_at: now });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/garmin/sync-status — when was last sync ──────────────────────
router.get('/sync-status', (req, res) => {
  try {
    const meta = db.prepare('SELECT * FROM garmin_meta WHERE id = 1').get();
    res.json(meta || { synced_at: 0, count: 0 });
  } catch (e) {
    res.json({ synced_at: 0, count: 0 });
  }
});

export default router;
