#!/usr/bin/env python3
"""Garmin Connect data fetcher — called by Node.js via child_process.
   Works with garminconnect 0.3.x (no garth dependency).
"""
import sys
import json
import os

# Add locally vendored packages to path
_base = os.path.dirname(os.path.abspath(__file__))
for _d in ('garmin_lib', 'python_deps'):
    _p = os.path.join(_base, _d)
    if os.path.isdir(_p):
        sys.path.insert(0, _p)

TOKEN_DIR = '/tmp/garmin_tokens'

try:
    from garminconnect import Garmin
except ImportError as _e:
    print(json.dumps({"error": "garminconnect_not_installed", "detail": str(_e)}))
    sys.exit(1)

email    = os.environ.get('GARMIN_EMAIL', '')
password = os.environ.get('GARMIN_PASSWORD', '')
command  = sys.argv[1] if len(sys.argv) > 1 else 'status'


def get_client():
    os.makedirs(TOKEN_DIR, exist_ok=True)

    # Try loading saved tokens first (avoids re-login)
    token_file = os.path.join(TOKEN_DIR, 'oauth2_token.json')
    if os.path.exists(token_file):
        try:
            api = Garmin()
            api.login(tokenstore=TOKEN_DIR)
            return api
        except Exception:
            pass  # Token expired — fall through to fresh login

    if not email or not password:
        raise Exception("Set GARMIN_EMAIL + GARMIN_PASSWORD on Render")

    api = Garmin(email=email, password=password)
    api.login()

    # Cache tokens for next call
    try:
        api.garth.dump(TOKEN_DIR)
    except Exception:
        pass

    return api


try:
    api = get_client()

    if command == 'status':
        try:
            profile = api.get_user_profile()
            full_name    = profile.get('displayName') or profile.get('userName') or ''
            display_name = profile.get('userName') or (email.split('@')[0] if email else 'Athlete')
        except Exception:
            full_name    = email.split('@')[0] if email else 'Athlete'
            display_name = full_name
        print(json.dumps({
            "connected":   True,
            "displayName": display_name,
            "fullName":    full_name or None,
        }))

    elif command == 'activities':
        start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 100
        activities = api.get_activities(start, limit)
        print(json.dumps(activities))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
