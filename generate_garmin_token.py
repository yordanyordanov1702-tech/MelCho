#!/usr/bin/env python3
"""
Run this ONCE locally to generate a Garmin token for Render.
Usage: python3 generate_garmin_token.py
"""
import getpass, json

try:
    import garth
    from garminconnect import Garmin
except ImportError:
    print("Installing garminconnect...")
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "pip", "install", "garminconnect", "garth", "-q"])
    import garth
    from garminconnect import Garmin

email    = input("Garmin email: ").strip()
password = getpass.getpass("Garmin password: ")

print("\nLogging in to Garmin Connect...")
try:
    api = Garmin(email=email, password=password)
    api.login()
    token_b64 = api.garth.dumps()
    print("\n✅ Success! Copy the token below and add it to Render as:\n")
    print("   Variable name:  GARMIN_TOKEN_BASE64")
    print("   Variable value: (the long string below)\n")
    print(token_b64)
    print("\nIn Render: MelCho → Environment → Add Variable")
except Exception as e:
    print(f"\n❌ Login failed: {e}")
