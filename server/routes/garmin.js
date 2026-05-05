import { Router }   from 'express';
import { execFile }  from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http  from 'http';
import { writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT    = join(__dirname, '..', 'garmin_fetch.py');
const PYTHON    = process.env.PYTHON_PATH || 'python3';

const SESSION_FILE = '/tmp/garmin_session.json';
const FRONTEND_URL = 'https://melcho.onrender.com';

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
  if (!hasAuth)
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
