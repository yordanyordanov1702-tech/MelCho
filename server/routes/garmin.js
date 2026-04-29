import { Router } from 'express';
import { GarminConnect } from 'garmin-connect';

const router = Router();

let client = null;
let loginPromise = null;

async function getClient() {
  const email    = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) return null;

  if (client) return client;
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      const gc = new GarminConnect({ username: email, password });
      await gc.login(email, password);
      client = gc;
      console.log('[Garmin] Logged in successfully');
      return gc;
    } catch (e) {
      console.warn('[Garmin] Login failed:', e.message);
      loginPromise = null;
      return null;
    }
  })();

  return loginPromise;
}

// Re-login on session expiry
async function withRetry(fn) {
  try {
    const gc = await getClient();
    if (!gc) return null;
    return await fn(gc);
  } catch (e) {
    if (e.message?.includes('401') || e.message?.includes('session') || e.message?.toLowerCase().includes('unauthorized')) {
      client = null;
      loginPromise = null;
      const gc = await getClient();
      if (!gc) return null;
      return await fn(gc);
    }
    throw e;
  }
}

router.get('/status', async (req, res) => {
  const email = process.env.GARMIN_EMAIL;
  if (!email || !process.env.GARMIN_PASSWORD) {
    return res.json({ connected: false, reason: 'no_credentials' });
  }
  try {
    const result = await withRetry(gc => gc.getUserProfile());
    if (!result) return res.json({ connected: false, reason: 'login_failed' });
    res.json({
      connected: true,
      displayName: result.displayName || result.userName || email.split('@')[0],
      fullName: [result.firstName, result.lastName].filter(Boolean).join(' ') || null,
      profileImageUrl: result.profileImageUrlMedium || null,
    });
  } catch (e) {
    res.json({ connected: false, reason: e.message });
  }
});

router.get('/activities', async (req, res) => {
  const start = parseInt(req.query.start || '0', 10);
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 100);
  try {
    const activities = await withRetry(gc => gc.getActivities(start, limit));
    if (!activities) return res.status(401).json({ error: 'not_connected' });
    res.json(activities);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Warm up on startup
getClient().catch(() => {});

export default router;
