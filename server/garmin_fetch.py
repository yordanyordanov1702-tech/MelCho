#!/usr/bin/env python3
"""Garmin Connect data fetcher — called by Node.js via child_process."""
import sys
import json
import os

TOKEN_DIR = '/tmp/garmin_tokens'

try:
    from garminconnect import Garmin
except ImportError:
    print(json.dumps({"error": "garminconnect_not_installed"}))
    sys.exit(1)

email    = os.environ.get('GARMIN_EMAIL', '')
password = os.environ.get('GARMIN_PASSWORD', '')
command  = sys.argv[1] if len(sys.argv) > 1 else 'status'


def get_client():
    os.makedirs(TOKEN_DIR, exist_ok=True)

    # Try cached OAuth tokens first (no Cloudflare challenge)
    try:
        api = Garmin(tokenstore=TOKEN_DIR)
        api.login()
        return api
    except Exception:
        pass

    # Fresh login with credentials
    if not email or not password:
        raise Exception("GARMIN_EMAIL / GARMIN_PASSWORD not set")

    api = Garmin(email, password, tokenstore=TOKEN_DIR)
    api.login()
    return api


try:
    api = get_client()

    if command == 'status':
        full_name    = api.get_full_name()
        display_name = api.get_display_name()
        print(json.dumps({
            "connected":   True,
            "displayName": display_name or (email.split('@')[0] if email else 'Athlete'),
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
