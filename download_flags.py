import urllib.request
import json
import os
import sys
import time

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

print("=" * 50)
print("FLAG DOWNLOADER STARTING")
print("=" * 50)
print(f"Working directory: {os.getcwd()}")

os.makedirs("assets", exist_ok=True)
print(f"Assets folder created/verified")

# Fetch country codes from flagcdn
print("Fetching country codes from flagcdn.com...")
try:
    with urllib.request.urlopen("https://flagcdn.com/en/codes.json", timeout=10) as response:
        codes = json.loads(response.read().decode())
    print(f"SUCCESS: Got {len(codes)} total codes")
except Exception as e:
    print(f"FAILED to fetch codes: {e}")
    sys.exit(1)

# Filter out US states and sub-regions (keep only 2-letter codes)
countries = {k: v for k, v in codes.items() if len(k) == 2 and k not in ["aq", "bv", "hm", "um", "eu", "un"]}
print(f"Filtered to {len(countries)} country flags")

print("=" * 50)
print("STARTING DOWNLOADS")
print("=" * 50)

success = 0
failed = 0
for i, (code, name) in enumerate(countries.items()):
    url = f"https://flagcdn.com/w80/{code}.png"
    filepath = f"assets/{code}.png"
    try:
        start = time.time()
        urllib.request.urlretrieve(url, filepath)
        elapsed = time.time() - start
        success += 1
        print(f"[{i+1}/{len(countries)}] OK ({elapsed:.1f}s) - {code}.png - {name}")
    except Exception as e:
        failed += 1
        print(f"[{i+1}/{len(countries)}] FAIL - {code}.png - {e}")

print("=" * 50)
print(f"DOWNLOADS COMPLETE: {success} success, {failed} failed")
print("=" * 50)

# Save country data as JSON for the game
print("Saving countries.json...")
with open("assets/countries.json", "w", encoding="utf-8") as f:
    json.dump(countries, f, ensure_ascii=False, indent=2)

print("ALL DONE!")
print(f"Check assets folder: {os.path.abspath('assets')}")
