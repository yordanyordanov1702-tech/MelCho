#!/usr/bin/env python3
"""Garmin Connect data fetcher — called by Node.js via child_process."""
import sys, json, os

# Add garmin_lib to path — NOT python_deps (wrong Python version)
_base = os.path.dirname(os.path.abspath(__file__))
_garmin_lib = os.path.join(_base, 'garmin_lib')
if os.path.isdir(_garmin_lib):
    sys.path.insert(0, _garmin_lib)

TOKEN_DIR = '/tmp/garmin_tokens'

try:
    from garminconnect import Garmin
    import garth
except ImportError as _e:
    print(json.dumps({"error": "garminconnect_not_installed", "detail": str(_e)}))
    sys.exit(1)

email     = os.environ.get('GARMIN_EMAIL', '')
password  = os.environ.get('GARMIN_PASSWORD', '')
token_b64 = os.environ.get('GARMIN_TOKEN_BASE64', '')
command   = sys.argv[1] if len(sys.argv) > 1 else 'status'


def get_client():
    os.makedirs(TOKEN_DIR, exist_ok=True)

    # 1. Prefer base64 token from env var (bypasses IP rate limit)
    if token_b64:
        try:
            garth.configure(domain="garmin.com")
            garth.loads(token_b64)
            api = Garmin()
            api.garth = garth
            return api
        except Exception:
            pass

    # 2. Try cached tokens from disk
    try:
        garth.configure(domain="garmin.com")
        garth.load(TOKEN_DIR)
        api = Garmin()
        api.garth = garth
        return api
    except Exception:
        pass

    # 3. Fresh login (will fail on Render if IP is blocked — use GARMIN_TOKEN_BASE64)
    if not email or not password:
        raise Exception("no_credentials")

    api = Garmin(email=email, password=password)
    api.login()
    try:
        api.garth.dump(TOKEN_DIR)
    except Exception:
        pass
    return api


try:
    api = get_client()

    if command == 'status':
        try:
            profile      = api.get_user_profile()
            full_name    = profile.get('displayName') or profile.get('userName') or ''
            display_name = profile.get('userName') or (email.split('@')[0] if email else 'Athlete')
        except Exception:
            full_name    = email.split('@')[0] if email else 'Athlete'
            display_name = full_name
        print(json.dumps({"connected": True, "displayName": display_name, "fullName": full_name or None}))

    elif command == 'activities':
        start      = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        limit      = int(sys.argv[3]) if len(sys.argv) > 3 else 100
        activities = api.get_activities(start, limit)
        print(json.dumps(activities))

    elif command == 'dump_tokens':
        print(json.dumps({"token_base64": api.garth.dumps()}))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
