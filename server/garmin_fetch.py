#!/usr/bin/env python3
"""Garmin Connect data fetcher — called by Node.js via child_process."""
import sys, json, os, urllib.request, urllib.error

TOKEN_DIR = '/tmp/garmin_tokens'

# Add garmin_lib to path for garminconnect / garth
_base = os.path.dirname(os.path.abspath(__file__))
_garmin_lib = os.path.join(_base, 'garmin_lib')
if os.path.isdir(_garmin_lib):
    sys.path.insert(0, _garmin_lib)

email     = os.environ.get('GARMIN_EMAIL', '')
token_b64 = os.environ.get('GARMIN_TOKEN_BASE64', '')
cookies   = os.environ.get('GARMIN_COOKIES', '')   # browser session cookies
command   = sys.argv[1] if len(sys.argv) > 1 else 'status'

# ── Cookie-based client (no OAuth needed) ────────────────────────────────────

def cookie_request(path):
    """Make a Garmin Connect API call using browser session cookies."""
    url = f'https://connect.garmin.com{path}'
    req = urllib.request.Request(url, headers={
        'Cookie': cookies,
        'NK': 'NT',  # required header for Garmin Connect API
        'X-app-ver': '4.70.2.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def get_profile_via_cookies():
    data = cookie_request('/modern/proxy/userprofile-service/userprofile/personal-information')
    name = (data.get('displayName') or data.get('userName') or
            data.get('userInfo', {}).get('displayName') or 'Athlete')
    return name


def get_activities_via_cookies(start=0, limit=100):
    path = f'/modern/proxy/activitylist-service/activities/search/activities?start={start}&limit={limit}'
    return cookie_request(path)


# ── garth/garminconnect client ────────────────────────────────────────────────

def get_garth_client():
    try:
        import garth
        from garminconnect import Garmin
    except ImportError as e:
        raise Exception(f"garminconnect_not_installed: {e}")

    os.makedirs(TOKEN_DIR, exist_ok=True)

    if token_b64:
        try:
            garth.configure(domain="garmin.com")
            garth.client.loads(token_b64)
            api = Garmin()
            api.garth = garth
            return api
        except Exception:
            pass

    try:
        garth.configure(domain="garmin.com")
        garth.load(TOKEN_DIR)
        api = Garmin()
        api.garth = garth
        return api
    except Exception:
        pass

    raise Exception("no_token")


# ── Main ──────────────────────────────────────────────────────────────────────

try:
    if command == 'status':
        # Try cookie-based first (most reliable)
        if cookies:
            try:
                display_name = get_profile_via_cookies()
                print(json.dumps({"connected": True, "displayName": display_name, "fullName": display_name}))
                sys.exit(0)
            except Exception:
                pass

        # Fall back to garth
        api = get_garth_client()
        try:
            profile      = api.get_user_profile()
            display_name = profile.get('displayName') or profile.get('userName') or 'Athlete'
        except Exception:
            display_name = email.split('@')[0] if email else 'Athlete'
        print(json.dumps({"connected": True, "displayName": display_name, "fullName": display_name}))

    elif command == 'activities':
        start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 100

        # Try cookie-based first
        if cookies:
            try:
                activities = get_activities_via_cookies(start, limit)
                print(json.dumps(activities))
                sys.exit(0)
            except Exception:
                pass

        # Fall back to garth
        api = get_garth_client()
        activities = api.get_activities(start, limit)
        print(json.dumps(activities))

    elif command == 'dump_tokens':
        api = get_garth_client()
        print(json.dumps({"token_base64": api.garth.client.dumps()}))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
