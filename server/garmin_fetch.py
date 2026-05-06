#!/usr/bin/env python3
"""Garmin Connect data fetcher — called by Node.js via child_process.
Uses garth directly (no garminconnect wrapper) to avoid 'Not authenticated' error."""
import sys, json, os, urllib.request, urllib.error

TOKEN_DIR    = '/tmp/garmin_tokens'
SESSION_FILE = '/tmp/garmin_session.json'

# Add garmin_lib to path for garth
_base = os.path.dirname(os.path.abspath(__file__))
_garmin_lib = os.path.join(_base, 'garmin_lib')
if os.path.isdir(_garmin_lib):
    sys.path.insert(0, _garmin_lib)

email     = os.environ.get('GARMIN_EMAIL', '')
token_b64 = os.environ.get('GARMIN_TOKEN_BASE64', '')
cookies   = os.environ.get('GARMIN_COOKIES', '')   # browser session cookies (env var)
command   = sys.argv[1] if len(sys.argv) > 1 else 'status'

# ── Load session cookies from file (set by SSO callback) ─────────────────────

def load_session_cookies():
    try:
        if not os.path.exists(SESSION_FILE):
            return ''
        with open(SESSION_FILE, 'r') as f:
            data = json.load(f)
        return data.get('cookieString', '')
    except Exception:
        return ''

session_cookies = load_session_cookies()

# ── Cookie-based API call helper ──────────────────────────────────────────────

def cookie_request(path, cookie_str):
    url = f'https://connect.garmin.com{path}'
    req = urllib.request.Request(url, headers={
        'Cookie': cookie_str,
        'NK': 'NT',
        'X-app-ver': '4.70.2.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def _effective_cookies():
    return cookies or session_cookies

def get_profile_via_cookies():
    ck = _effective_cookies()
    if not ck:
        raise Exception('no_cookies')
    # Try both old and new path
    for path in ['/app/proxy/userprofile-service/userprofile/personal-information',
                 '/modern/proxy/userprofile-service/userprofile/personal-information']:
        try:
            data = cookie_request(path, ck)
            name = (data.get('displayName') or data.get('userName') or
                    data.get('userInfo', {}).get('displayName') or 'Athlete')
            return name
        except Exception:
            continue
    raise Exception('cookie_profile_failed')

def get_activities_via_cookies(start=0, limit=100):
    ck = _effective_cookies()
    if not ck:
        raise Exception('no_cookies')
    for path_prefix in ['/app/proxy', '/modern/proxy']:
        try:
            path = f'{path_prefix}/activitylist-service/activities/search/activities?start={start}&limit={limit}'
            return cookie_request(path, ck)
        except Exception:
            continue
    raise Exception('cookie_activities_failed')


# ── garth direct client (no garminconnect wrapper) ────────────────────────────

def get_garth():
    """Load garth with token, return garth module ready to use."""
    try:
        import garth
    except ImportError as e:
        raise Exception(f"garth_not_installed: {e}")

    garth.configure(domain="garmin.com")

    if token_b64:
        try:
            garth.client.loads(token_b64)
            return garth
        except Exception as e:
            pass  # fall through to directory load

    try:
        garth.load(TOKEN_DIR)
        return garth
    except Exception:
        pass

    raise Exception("no_token")


def garth_get_profile(g):
    """Fetch display name via garth.connectapi, trying multiple paths."""
    errors = []
    for path in [
        '/userprofile-service/socialProfile',
        '/userprofile-service/userprofile/personal-information',
    ]:
        try:
            data = g.connectapi(path)
            name = (data.get('displayName') or data.get('userName') or
                    data.get('userInfo', {}).get('displayName') or 'Athlete')
            return name
        except Exception as e:
            detail = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    detail += f' | body: {e.response.text[:200]}'
                except Exception:
                    pass
            errors.append(f"{path}: {detail}")
    raise Exception(f"profile_failed: {'; '.join(errors)}")


def garth_get_activities(g, start, limit):
    """Fetch activities via garth.connectapi."""
    errors = []
    for path in [
        f'/activitylist-service/activities/search/activities?start={start}&limit={limit}',
    ]:
        try:
            data = g.connectapi(path)
            return data
        except Exception as e:
            # Capture response body if available (garth raises GarthHTTPError with .response)
            detail = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    detail += f' | body: {e.response.text[:300]}'
                except Exception:
                    pass
            errors.append(f"{path}: {detail}")
    raise Exception(f"activities_failed: {'; '.join(errors)}")


# ── Main ──────────────────────────────────────────────────────────────────────

try:
    if command == 'status':
        # Try cookie-based first
        if cookies or session_cookies:
            try:
                display_name = get_profile_via_cookies()
                print(json.dumps({"connected": True, "displayName": display_name, "fullName": display_name}))
                sys.exit(0)
            except Exception:
                pass

        # Use garth directly
        g = get_garth()
        try:
            display_name = garth_get_profile(g)
        except Exception:
            # Garth loaded token but profile call failed — still report connected
            raw_email = email.strip()
            # Clean up env var noise like "GARMIN_EMAIL     = yordan-vd"
            if '=' in raw_email:
                raw_email = raw_email.split('=', 1)[1].strip()
            display_name = raw_email.split('@')[0] if raw_email else 'Athlete'
        print(json.dumps({"connected": True, "displayName": display_name, "fullName": display_name}))

    elif command == 'activities':
        start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 100

        # Try cookie-based first
        if cookies or session_cookies:
            try:
                activities = get_activities_via_cookies(start, limit)
                print(json.dumps(activities))
                sys.exit(0)
            except Exception:
                pass

        # Use garth directly
        g = get_garth()
        activities = garth_get_activities(g, start, limit)
        print(json.dumps(activities))

    elif command == 'dump_tokens':
        g = get_garth()
        print(json.dumps({"token_base64": g.client.dumps()}))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
