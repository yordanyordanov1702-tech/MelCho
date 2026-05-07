#!/usr/bin/env python3
"""
Garmin auto-sync — runs non-interactively via launchd.
Credentials stored in ~/.garmin_sync.conf (chmod 600).
Logs to ~/garmin_sync.log.
Only fetches recent activities (last 200) for efficiency.
"""
import sys, os, json, getpass, re, time, urllib.request
from pathlib import Path
from datetime import datetime

# Install deps only if missing (avoids crash in launchd context)
try:
    from curl_cffi import requests as cffi_requests
    from bs4 import BeautifulSoup
    import garth
except ImportError:
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'curl_cffi', 'garth', 'beautifulsoup4', '-q'],
                   capture_output=True)
    from curl_cffi import requests as cffi_requests
    from bs4 import BeautifulSoup
    import garth

RENDER_API  = 'https://melcho.onrender.com/api/garmin'
SYNC_SECRET = 'garmin-sync-2026'
CONF_FILE   = Path.home() / '.garmin_sync.conf'
TOKEN_FILE  = Path.home() / '.garmin_token.json'
LOG_FILE    = Path.home() / 'garmin_sync.log'

# ── Logging ────────────────────────────────────────────────────────────────

def log(msg):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(line + '\n')
    except Exception:
        pass

# ── Load credentials ───────────────────────────────────────────────────────

if not CONF_FILE.exists():
    log("No credentials file — creating it now (one-time setup)")
    email    = input("Garmin email: ").strip()
    password = getpass.getpass("Garmin password: ")
    CONF_FILE.write_text(json.dumps({'email': email, 'password': password}))
    os.chmod(CONF_FILE, 0o600)
    log(f"Saved to {CONF_FILE}")
else:
    creds    = json.loads(CONF_FILE.read_text())
    email    = creds['email']
    password = creds['password']

log(f"Starting Garmin sync for {email}")

# ── Try saved token ────────────────────────────────────────────────────────

token_valid = False
if TOKEN_FILE.exists():
    try:
        garth.configure(domain="garmin.com")
        garth.client.loads(TOKEN_FILE.read_text())
        oauth2 = garth.client.oauth2_token
        expires_at = getattr(oauth2, 'expires_at', 0)
        # expires_at may be stored as int unix timestamp
        if isinstance(expires_at, int):
            remaining = expires_at - int(time.time())
        else:
            remaining = -1
        if remaining > 300:
            token_valid = True
            log(f"Saved token valid for {remaining//3600}h {(remaining%3600)//60}m — skipping login")
    except Exception as e:
        log(f"Token load failed ({e}) — will re-login")

# ── SSO login (if token missing/expired) ──────────────────────────────────

if not token_valid:
    log("Logging in via SSO...")
    sess = cffi_requests.Session(impersonate="chrome120")
    sess.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    })

    SSO = "https://sso.garmin.com/sso"
    SSO_EMBED_PARAMS = dict(id="gauth-widget", embedWidget="true", gauthHost=SSO)
    SIGNIN_PARAMS = {**SSO_EMBED_PARAMS,
        "gauthHost": f"{SSO}/embed",
        "service":   f"{SSO}/embed",
        "source":    f"{SSO}/embed",
        "redirectAfterAccountLoginUrl":    f"{SSO}/embed",
        "redirectAfterAccountCreationUrl": f"{SSO}/embed",
    }

    sess.get(f"{SSO}/embed", params=SSO_EMBED_PARAMS)
    r2 = sess.get(f"{SSO}/signin", params=SIGNIN_PARAMS, headers={'Referer': f"{SSO}/embed"})
    soup = BeautifulSoup(r2.text, 'html.parser')
    form_data = {i.get('name',''): i.get('value','') for i in soup.find_all('input') if i.get('name')}
    form_data['username'] = email
    form_data['password'] = password
    form_data['embed']    = 'true'

    r3 = sess.post(f"{SSO}/signin", params=SIGNIN_PARAMS, data=form_data,
                   headers={'Referer': r2.url, 'Origin': 'https://sso.garmin.com'})

    if r3.status_code == 429:
        log("❌ Rate limited (429). Sync aborted.")
        sys.exit(1)

    ticket = re.search(r'embed\?ticket=([^"&\s]+)', r3.text)
    if not ticket:
        log("❌ No SSO ticket — wrong password or MFA required.")
        sys.exit(1)

    ticket_val = ticket.group(1)
    log(f"SSO ticket obtained: {ticket_val[:20]}...")

    garth.configure(domain="garmin.com")
    from garth.sso import get_oauth1_token, exchange
    oauth1 = get_oauth1_token(ticket_val, garth.client)
    oauth2 = exchange(oauth1, garth.client)
    garth.client.oauth1_token = oauth1
    garth.client.oauth2_token = oauth2

    # Save token for next run
    TOKEN_FILE.write_text(garth.client.dumps())
    os.chmod(TOKEN_FILE, 0o600)
    log("Token saved for next run")

# ── Check if Render DB is empty (needs full resync) ───────────────────────

try:
    with urllib.request.urlopen(f'{RENDER_API}/sync-status', timeout=10) as r:
        meta = json.loads(r.read().decode())
    db_empty = meta.get('count', 0) == 0
except Exception:
    db_empty = True  # assume empty if can't reach

if db_empty:
    log("Render DB is empty — fetching ALL activities for full resync...")
else:
    log("Render DB has data — fetching recent 200 activities...")

# ── Fetch activities ───────────────────────────────────────────────────────

activities = []
start = 0
FETCH_LIMIT = None if db_empty else 200  # all if empty, else last 200

while True:
    batch = garth.connectapi(
        f'/activitylist-service/activities/search/activities?start={start}&limit=100'
    )
    if not batch:
        break
    activities.extend(batch)
    log(f"  Fetched {len(activities)}...")
    if len(batch) < 100:
        break
    if FETCH_LIMIT and len(activities) >= FETCH_LIMIT:
        break
    start += 100

log(f"Got {len(activities)} activities")

# ── Get display name ───────────────────────────────────────────────────────

try:
    profile      = garth.connectapi('/userprofile-service/socialProfile')
    display_name = profile.get('displayName') or profile.get('userName') or email.split('@')[0]
except Exception:
    display_name = activities[0].get('ownerFullName') if activities else email.split('@')[0]

# Fix UUID display names
if display_name and re.match(r'^[0-9a-f-]{30,}$', display_name, re.I):
    display_name = activities[0].get('ownerFullName', email.split('@')[0]) if activities else email.split('@')[0]

# ── Sync to Render ─────────────────────────────────────────────────────────

log(f"Syncing {len(activities)} activities to Render as '{display_name}'...")
BATCH = 100
total_saved = 0

for i in range(0, len(activities), BATCH):
    batch   = activities[i:i+BATCH]
    payload = json.dumps({'activities': batch, 'displayName': display_name}).encode()
    req = urllib.request.Request(
        f'{RENDER_API}/sync',
        data=payload, method='POST',
        headers={'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read().decode())
        total_saved += result.get('saved', len(batch))
        log(f"  Batch {i//BATCH + 1}: {total_saved}/{len(activities)} synced")
    except Exception as e:
        log(f"  ❌ Batch {i//BATCH + 1} failed: {e}")
        sys.exit(1)

log(f"✅ Sync complete — {total_saved} activities synced")

# ── Fetch wellness data (sleep + training readiness) ──────────────────────

log("Fetching wellness data...")
dates = sorted(set(
    a.get('startTimeLocal', '')[:10]
    for a in activities
    if a.get('startTimeLocal', '')[:10]
), reverse=True)[:30]  # last 30 unique activity dates

wellness = []
for date in dates:
    w = {'date': date}
    # Sleep
    try:
        sleep_resp = garth.connectapi(
            f'/wellness-service/wellness/dailySleepData/{display_name}',
            params={'date': date, 'nonSleepBufferMinutes': 60}
        )
        dto = sleep_resp.get('dailySleepDTO') or sleep_resp.get('dailySleepDTOList', [{}])[0] if sleep_resp else {}
        scores = dto.get('sleepScores', {}) or {}
        overall = scores.get('overall') or {}
        w['sleepScore']   = overall.get('value') if isinstance(overall, dict) else overall
        w['sleepSeconds'] = (dto.get('deepSleepSeconds', 0) or 0) + (dto.get('lightSleepSeconds', 0) or 0) + (dto.get('remSleepSeconds', 0) or 0)
        w['deepSeconds']  = dto.get('deepSleepSeconds', 0) or 0
        w['remSeconds']   = dto.get('remSleepSeconds', 0) or 0
        w['sleepQuality'] = overall.get('qualifierKey', '') if isinstance(overall, dict) else ''
    except Exception as e:
        log(f"  Sleep {date}: {e}")

    # Training Readiness (only if watch supports it — silently skip 404)
    try:
        tr_resp = garth.connectapi(f'/metrics-service/metrics/trainingReadiness/{date}')
        tr = (tr_resp or [{}])[0] if isinstance(tr_resp, list) else (tr_resp or {})
        if tr.get('score'):
            w['readinessScore'] = tr.get('score')
            s = tr['score']
            w['readinessLevel'] = (tr.get('levelMap', {}) or {}).get('overall', {}).get('level', '') \
                or ('EXCELLENT' if s >= 80 else 'GOOD' if s >= 60 else 'FAIR' if s >= 40 else 'POOR')
    except Exception:
        pass  # Not supported by this watch model

    if w.get('sleepScore') or w.get('readinessScore'):
        wellness.append(w)

log(f"Got wellness data for {len(wellness)} dates")

# Sync wellness to Render
if wellness:
    payload = json.dumps({'wellness': wellness}).encode()
    req = urllib.request.Request(
        f'{RENDER_API}/wellness-sync',
        data=payload, method='POST',
        headers={'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read().decode())
        log(f"✅ Wellness sync: {result.get('saved', 0)} dates saved")
    except Exception as e:
        log(f"⚠️ Wellness sync failed: {e}")
