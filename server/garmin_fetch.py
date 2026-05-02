#!/usr/bin/env python3
"""Garmin Connect data fetcher — called by Node.js via child_process."""
import sys
import json
import os

TOKEN_DIR = '/tmp/garmin_tokens'

try:
    from garminconnect import Garmin
    import garth
except ImportError:
    print(json.dumps({"error": "garminconnect_not_installed"}))
    sys.exit(1)

email       = os.environ.get('GARMIN_EMAIL', '')
password    = os.environ.get('GARMIN_PASSWORD', '')
token_b64   = os.environ.get('GARMIN_TOKEN_BASE64', '')
command     = sys.argv[1] if len(sys.argv) > 1 else 'status'


def get_client():
    os.makedirs(TOKEN_DIR, exist_ok=True)

    # 1. Prefer base64 tokens from env var (no login flow needed)
    if token_b64:
        try:
            client = garth.Client()
            client.loads(token_b64)
            api = Garmin()
            api.garth = client
            return api
        except Exception as e:
            pass  # Fall through to other methods

    # 2. Try cached tokens from disk
    try:
        api = Garmin()
        api.garth.load(TOKEN_DIR)
        return api
    except Exception:
        pass

    # 3. Fresh login with credentials + browser User-Agent (bypasses Cloudflare)
    if not email or not password:
        raise Exception("Set GARMIN_EMAIL + GARMIN_PASSWORD or GARMIN_TOKEN_BASE64 on Render")

    api = Garmin(email, password)
    # Mimic a real browser to avoid Cloudflare 429 blocks
    api.garth.sess.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    })
    api.login()
    # Cache tokens to disk for next call
    try:
        api.garth.dump(TOKEN_DIR)
    except Exception:
        pass
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

    elif command == 'dump_tokens':
        # Generate base64 token string to save in Render env var
        token_str = api.garth.dumps()
        print(json.dumps({"token_base64": token_str}))

    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
