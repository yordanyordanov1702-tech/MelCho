import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI  = process.env.STRAVA_REDIRECT_URI  || 'http://localhost:3001/api/strava/callback';
const FRONTEND_URL  = process.env.STRAVA_FRONTEND_URL  || 'http://localhost:5173';

// ── Auto-seed from env vars on startup ───────────────────────────────────────
// If DB is empty but STRAVA_REFRESH_TOKEN env var is set, restore the connection
// automatically. This survives Render redeploys.
(async () => {
  const existing = db.prepare('SELECT id FROM strava_tokens WHERE id = 1').get();
  if (!existing && process.env.STRAVA_REFRESH_TOKEN) {
    console.log('[Strava] DB empty — seeding from STRAVA_REFRESH_TOKEN env var...');
    try {
      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: process.env.STRAVA_REFRESH_TOKEN,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        const athleteName = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ');
        db.prepare(`
          INSERT OR REPLACE INTO strava_tokens (id, access_token, refresh_token, expires_at, athlete_id, athlete_name, athlete_avatar)
          VALUES (1, ?, ?, ?, ?, ?, ?)
        `).run(
          data.access_token,
          data.refresh_token,
          data.expires_at,
          data.athlete?.id ?? null,
          athleteName || null,
          data.athlete?.profile_medium ?? null
        );
        console.log('[Strava] Seeded successfully. Athlete:', athleteName || '(unknown)');
      } else {
        console.warn('[Strava] Seed failed:', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[Strava] Seed error:', e.message);
    }
  }
})();

// ── Token refresh ─────────────────────────────────────────────────────────────
async function getValidToken() {
  const row = db.prepare('SELECT * FROM strava_tokens WHERE id = 1').get();
  if (!row) return null;

  if (Math.floor(Date.now() / 1000) > row.expires_at - 300) {
    try {
      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: row.refresh_token,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        db.prepare('UPDATE strava_tokens SET access_token=?, refresh_token=?, expires_at=? WHERE id=1')
          .run(data.access_token, data.refresh_token, data.expires_at);
        // Log new refresh token so it can be saved to env var
        console.log(`[Strava] Token refreshed. STRAVA_REFRESH_TOKEN=${data.refresh_token}`);
        return data.access_token;
      }
    } catch {
      return null;
    }
  }
  return row.access_token;
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/auth', (req, res) => {
  if (!CLIENT_ID) return res.status(500).json({ error: 'STRAVA_CLIENT_ID not configured' });
  // Support ?from= so Dan-Stra can redirect back to itself after OAuth
  if (req.query.from) {
    res.cookie('strava_from', req.query.from, { httpOnly: true, sameSite: 'lax', maxAge: 600000 });
  }
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('approval_prompt', 'force');
  url.searchParams.set('scope', 'read,activity:read_all');
  res.redirect(url.toString());
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const from = req.cookies?.strava_from || FRONTEND_URL;

  if (error || !code) return res.redirect(`${from}?strava_error=access_denied`);

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    const data = await response.json();

    if (!data.access_token) return res.redirect(`${from}?strava_error=token_failed`);

    const athleteName = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ');
    db.prepare(`
      INSERT OR REPLACE INTO strava_tokens (id, access_token, refresh_token, expires_at, athlete_id, athlete_name, athlete_avatar)
      VALUES (1, ?, ?, ?, ?, ?, ?)
    `).run(
      data.access_token,
      data.refresh_token,
      data.expires_at,
      data.athlete?.id ?? null,
      athleteName || null,
      data.athlete?.profile_medium ?? null
    );

    // Log refresh token — copy this to Render env var STRAVA_REFRESH_TOKEN for persistence
    console.log(`[Strava] Connected: ${athleteName}. STRAVA_REFRESH_TOKEN=${data.refresh_token}`);

    res.redirect(`${from}?strava=connected`);
  } catch {
    res.redirect(`${from}?strava_error=server_error`);
  }
});

router.get('/status', (req, res) => {
  const row = db.prepare('SELECT athlete_name, athlete_avatar, athlete_id FROM strava_tokens WHERE id = 1').get();
  res.json({ connected: !!row, athlete: row || null });
});

router.get('/activities', async (req, res) => {
  const token = await getValidToken();
  if (!token) return res.status(401).json({ error: 'not_connected' });
  const { page = 1, per_page = 20 } = req.query;
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${per_page}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  res.json(await response.json());
});

router.get('/stats', async (req, res) => {
  const row = db.prepare('SELECT athlete_id FROM strava_tokens WHERE id = 1').get();
  if (!row) return res.status(401).json({ error: 'not_connected' });
  const token = await getValidToken();
  if (!token) return res.status(401).json({ error: 'token_invalid' });
  const response = await fetch(
    `https://www.strava.com/api/v3/athletes/${row.athlete_id}/stats`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  res.json(await response.json());
});

router.delete('/disconnect', (req, res) => {
  db.prepare('DELETE FROM strava_tokens WHERE id = 1').run();
  res.json({ ok: true });
});

export default router;
