#!/usr/bin/env python3
"""
Login to Garmin using curl_cffi (Chrome TLS) + garth OAuth exchange.
After successful login, syncs ALL activities to Render's database so
the web dashboard works even though Garmin blocks server-side API calls.
"""
import subprocess, sys, getpass, re, json, urllib.request

subprocess.run([sys.executable, '-m', 'pip', 'install', 'curl_cffi', 'garth', 'beautifulsoup4', '-q'])

from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup
import garth

RENDER_API     = 'https://melcho.onrender.com/api/garmin'
SYNC_SECRET    = 'garmin-sync-2026'   # must match GARMIN_SYNC_SECRET on Render

print("=== Garmin Login (Chrome TLS + garth OAuth) ===")
email    = input("Email: ").strip()
password = getpass.getpass("Password (hidden): ")

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
    "redirectAfterAccountLoginUrl":   f"{SSO}/embed",
    "redirectAfterAccountCreationUrl": f"{SSO}/embed",
}

print("\n1. Setting embed cookies...")
sess.get(f"{SSO}/embed", params=SSO_EMBED_PARAMS)

print("2. Getting CSRF token...")
r2 = sess.get(f"{SSO}/signin", params=SIGNIN_PARAMS, headers={'Referer': f"{SSO}/embed"})
soup = BeautifulSoup(r2.text, 'html.parser')
form_data = {i.get('name',''): i.get('value','') for i in soup.find_all('input') if i.get('name')}
form_data['username'] = email
form_data['password'] = password
form_data['embed']    = 'true'

print("3. Posting credentials...")
r3 = sess.post(f"{SSO}/signin", params=SIGNIN_PARAMS, data=form_data,
               headers={'Referer': r2.url, 'Origin': 'https://sso.garmin.com'})

title = re.search(r"<title>(.+?)</title>", r3.text)
title = title.group(1) if title else ''
print(f"   Title: {title}")

if r3.status_code == 429:
    print("❌ Rate limited. Try from phone hotspot.")
    sys.exit(1)

ticket = re.search(r'embed\?ticket=([^"&\s]+)', r3.text)
if not ticket:
    print("❌ No ticket. Wrong password or MFA needed.")
    sys.exit(1)

ticket_val = ticket.group(1)
print(f"✅ Ticket: {ticket_val[:30]}...")

print("4. Exchanging ticket via garth...")
garth.configure(domain="garmin.com")

from garth.sso import get_oauth1_token, exchange
oauth1 = get_oauth1_token(ticket_val, garth.client)
oauth2 = exchange(oauth1, garth.client)

garth.client.oauth1_token = oauth1
garth.client.oauth2_token = oauth2

token_b64 = garth.client.dumps()

print("5. Fetching ALL activities from Garmin...")
all_activities = []
start = 0
while True:
    batch = garth.connectapi(
        f'/activitylist-service/activities/search/activities?start={start}&limit=100'
    )
    if not batch:
        break
    all_activities.extend(batch)
    print(f"   Fetched {len(all_activities)} activities so far...")
    if len(batch) < 100:
        break
    start += 100

print(f"✅ Total: {len(all_activities)} activities")

# Get display name
try:
    profile = garth.connectapi('/userprofile-service/socialProfile')
    display_name = profile.get('displayName') or profile.get('userName') or email.split('@')[0]
except Exception:
    display_name = email.split('@')[0]

print(f"6. Syncing to Render ({RENDER_API}/sync) in batches...")
BATCH = 100
total_saved = 0
sync_ok = True
for i in range(0, len(all_activities), BATCH):
    batch = all_activities[i:i+BATCH]
    payload = json.dumps({
        'activities': batch,
        'displayName': display_name,
    }).encode()
    req = urllib.request.Request(
        f'{RENDER_API}/sync',
        data=payload,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'x-sync-secret': SYNC_SECRET,
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read().decode())
        total_saved += result.get('saved', len(batch))
        print(f"   Batch {i//BATCH + 1}: {total_saved} / {len(all_activities)} synced")
    except Exception as e:
        print(f"⚠️  Batch {i//BATCH + 1} failed: {e}")
        sync_ok = False
        break

if sync_ok:
    print(f"✅ All {total_saved} activities synced to Render!")
else:
    print("⚠️  Partial sync. Run the script again to retry.")

print("\n✅ SUCCESS!")
print("New GARMIN_TOKEN_BASE64 for Render (update if needed):\n")
print(token_b64)
print("\n🔄 Run this script again whenever you want to refresh your Garmin data.")
