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


# ── curl_cffi Chrome-TLS API call (bypasses Garmin IP/TLS fingerprint checks) ─

def cffi_connectapi(path, access_token):
    """Call connectapi.garmin.com using curl_cffi Chrome TLS impersonation.
    This bypasses Garmin's TLS fingerprint checks that cause 401 from standard
    Python HTTP clients on cloud server IPs."""
    from curl_cffi import requests as cffi_requests
    url = f'https://connectapi.garmin.com{path}'
    sess = cffi_requests.Session(impersonate="chrome120")
    resp = sess.get(url, headers={
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'di-backend': 'connectapi.garmin.com',
        'NK': 'NT',
        'X-app-ver': '4.70.2.0',
    }, timeout=20)
    resp.raise_for_status()
    return resp.json()

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

import time as _time

def _oauth2_expired(oauth2_token):
    """Return True if the OAuth2 access_token has expired (or we can't tell)."""
    try:
        ea = oauth2_token.expires_at
        # expires_at may be a datetime or a float unix timestamp
        ts = ea.timestamp() if hasattr(ea, 'timestamp') else float(ea)
        return ts < _time.time() + 30  # 30-second buffer
    except Exception:
        return True  # assume expired if we can't determine


def get_garth():
    """Load garth with token, return garth module ready to use.
    Auto-refreshes the OAuth2 access_token using the long-lived OAuth1 token
    when expired. Caches refreshed tokens in TOKEN_DIR to avoid re-refreshing
    on every call within the same process/dyno lifetime."""
    try:
        import garth
    except ImportError as e:
        raise Exception(f"garth_not_installed: {e}")

    garth.configure(domain="garmin.com")
    os.makedirs(TOKEN_DIR, exist_ok=True)

    # Try TOKEN_DIR first — may have a freshly-exchanged token from a recent call
    dir_loaded = False
    try:
        garth.load(TOKEN_DIR)
        dir_loaded = True
    except Exception:
        pass

    # If TOKEN_DIR token is fresh, use it directly
    if dir_loaded and not _oauth2_expired(garth.client.oauth2_token):
        return garth

    # TOKEN_DIR token is absent/expired — load base token from env var
    if token_b64:
        try:
            garth.client.loads(token_b64)
        except Exception as e:
            if not dir_loaded:
                raise Exception(f"token_load_failed: {e}")
    elif not dir_loaded:
        raise Exception("no_token")

    # Access token is expired — try multiple refresh strategies.
    _refresh_errors = []

    # Strategy 1: garth.sso.exchange (OAuth1 → OAuth2)
    try:
        from garth.sso import exchange
        garth.client.oauth2_token = exchange(garth.client.oauth1_token, garth.client)
        garth.save(TOKEN_DIR)
        garth._refresh_strategy = 'exchange'
        return garth
    except Exception as ex:
        _refresh_errors.append(f"exchange: {ex}")

    # Strategy 2: standard OAuth2 refresh_token grant
    # Uses the refresh_token from the existing oauth2 token + consumer credentials
    try:
        import base64
        import urllib.request, urllib.parse
        # Get consumer credentials (garth fetches these from S3)
        try:
            from garth.sso import OAUTH_CONSUMER, OAUTH_CONSUMER_URL
        except ImportError:
            OAUTH_CONSUMER, OAUTH_CONSUMER_URL = {}, "https://thegarth.s3.amazonaws.com/oauth_consumer.json"
        if not OAUTH_CONSUMER:
            with urllib.request.urlopen(OAUTH_CONSUMER_URL, timeout=10) as r:
                OAUTH_CONSUMER.update(json.loads(r.read().decode()))
        consumer_key    = OAUTH_CONSUMER['consumer_key']
        consumer_secret = OAUTH_CONSUMER['consumer_secret']
        refresh_token   = garth.client.oauth2_token.refresh_token
        creds_b64 = base64.b64encode(f'{consumer_key}:{consumer_secret}'.encode()).decode()
        body = urllib.parse.urlencode({
            'grant_type':    'refresh_token',
            'refresh_token': refresh_token,
        }).encode()
        req = urllib.request.Request(
            'https://connectapi.garmin.com/oauth-service/oauth/token',
            data=body,
            headers={
                'Authorization': f'Basic {creds_b64}',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'com.garmin.android.apps.connectmobile',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            token_data = json.loads(r.read().decode())
        # Update oauth2_token fields
        o2 = garth.client.oauth2_token
        garth.client.oauth2_token = type(o2)(
            scope=getattr(o2, 'scope', ''),
            jti=getattr(o2, 'jti', ''),
            token_type=token_data.get('token_type', 'Bearer'),
            refresh_token=token_data.get('refresh_token', o2.refresh_token),
            access_token=token_data['access_token'],
            expires_in=token_data.get('expires_in', 3600),
        )
        garth.save(TOKEN_DIR)
        garth._refresh_strategy = 'oauth2_refresh'
        return garth
    except Exception as ex:
        _refresh_errors.append(f"oauth2_refresh: {ex}")

    # All refresh strategies failed — proceed with potentially-expired token
    garth._refresh_errors = _refresh_errors
    garth._refresh_strategy = 'none'

    return garth


def garth_get_profile(g):
    """Fetch display name via garth.connectapi, falling back to curl_cffi on 401."""
    errors = []
    access_token = g.client.oauth2_token.access_token if g.client.oauth2_token else None

    for path in [
        '/userprofile-service/socialProfile',
        '/userprofile-service/userprofile/personal-information',
    ]:
        # Try garth first
        try:
            data = g.connectapi(path)
            name = (data.get('displayName') or data.get('userName') or
                    data.get('userInfo', {}).get('displayName') or 'Athlete')
            return name
        except Exception as e:
            detail = str(e)
            errors.append(f"garth {path}: {detail}")

        # Try curl_cffi (Chrome TLS) as fallback
        if access_token:
            try:
                data = cffi_connectapi(path, access_token)
                name = (data.get('displayName') or data.get('userName') or
                        data.get('userInfo', {}).get('displayName') or 'Athlete')
                return name
            except Exception as e:
                errors.append(f"cffi {path}: {e}")

    raise Exception(f"profile_failed: {'; '.join(errors)}")


def garth_get_activities(g, start, limit):
    """Fetch activities via garth.connectapi, falling back to curl_cffi on 401."""
    path = f'/activitylist-service/activities/search/activities?start={start}&limit={limit}'
    access_token = g.client.oauth2_token.access_token if g.client.oauth2_token else None
    errors = []

    # Try garth first
    try:
        return g.connectapi(path)
    except Exception as e:
        detail = str(e)
        if hasattr(e, 'response') and e.response is not None:
            try:
                detail += f' | body: {e.response.text[:200]}'
            except Exception:
                pass
        errors.append(f"garth: {detail}")

    # Try curl_cffi (Chrome TLS impersonation) as fallback
    if access_token:
        try:
            return cffi_connectapi(path, access_token)
        except Exception as e:
            errors.append(f"cffi: {e}")

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

    elif command == 'diagnose':
        import base64
        info = {}
        try:
            import garth as _g
            _g.configure(domain="garmin.com")
            if token_b64:
                _g.client.loads(token_b64)
            else:
                _g.load(TOKEN_DIR)
            o2 = _g.client.oauth2_token
            o1 = _g.client.oauth1_token
            info['token_loaded'] = True
            info['oauth2_expires_at'] = str(getattr(o2, 'expires_at', 'unknown'))
            info['oauth2_expired'] = _oauth2_expired(o2)
            info['oauth1_has_token'] = bool(getattr(o1, 'oauth_token', None))
            info['access_token_prefix'] = (o2.access_token or '')[:20] if o2 else None
            # Try full refresh flow (same as get_garth)
            _g.client.oauth2_token = o2  # reload original for test
            try:
                g_full = get_garth()
                info['refresh_strategy'] = getattr(g_full, '_refresh_strategy', 'unknown')
                info['refresh_errors'] = getattr(g_full, '_refresh_errors', [])
                info['new_access_token_prefix'] = (g_full.client.oauth2_token.access_token or '')[:20]
            except Exception as ex:
                info['refresh_error'] = str(ex)[:300]
            # Try connectapi via garth
            try:
                data = _g.connectapi('/userprofile-service/socialProfile')
                info['connectapi_success'] = True
                info['displayName'] = data.get('displayName', 'unknown')
            except Exception as ex:
                info['connectapi_success'] = False
                info['connectapi_error'] = str(ex)[:300]
            # Try connectapi via curl_cffi
            try:
                at = _g.client.oauth2_token.access_token
                data2 = cffi_connectapi('/userprofile-service/socialProfile', at)
                info['cffi_success'] = True
                info['cffi_displayName'] = data2.get('displayName', 'unknown')
            except Exception as ex:
                info['cffi_success'] = False
                info['cffi_error'] = str(ex)[:300]
        except Exception as ex:
            info['token_loaded'] = False
            info['load_error'] = str(ex)[:200]
        print(json.dumps(info))

    elif command == 'dump_tokens':
        g = get_garth()
        print(json.dumps({"token_base64": g.client.dumps()}))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
