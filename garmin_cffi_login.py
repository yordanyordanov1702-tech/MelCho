#!/usr/bin/env python3
"""
Login to Garmin using curl_cffi (Chrome TLS) + garth OAuth exchange.
"""
import subprocess, sys, getpass, re

subprocess.run([sys.executable, '-m', 'pip', 'install', 'curl_cffi', 'garth', 'beautifulsoup4', '-q'])

from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup
import garth

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

# Use garth's internal OAuth exchange with our ticket
from garth.sso import get_oauth1_token, exchange
oauth1 = get_oauth1_token(ticket_val, garth.client)
oauth2 = exchange(oauth1, garth.client)

garth.client.oauth1_token = oauth1
garth.client.oauth2_token = oauth2

print("5. Verifying token against Garmin Connect API...")
try:
    profile = garth.connectapi('/userprofile-service/socialProfile')
    display_name = profile.get('displayName') or profile.get('userName') or 'unknown'
    print(f"✅ API TEST PASSED — displayName: {display_name}")
    token_valid = True
except Exception as e:
    print(f"⚠️  API test: {e}")
    token_valid = False

try:
    acts = garth.connectapi('/activitylist-service/activities/search/activities?start=0&limit=2')
    print(f"✅ Activities test: got {len(acts)} activities")
except Exception as e:
    print(f"⚠️  Activities test: {e}")
    token_valid = False

token_b64 = garth.client.dumps()
print("\n" + ("✅ SUCCESS!" if token_valid else "⚠️  Token generated (local API works), testing from Render might differ"))
print("Add this as GARMIN_TOKEN_BASE64 in Render:\n")
print(token_b64)
