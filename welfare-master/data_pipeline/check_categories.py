import json
import os
from collections import Counter

# Checking web_spec_social_v3.json as it represents the latest spec questions
path = "../app/public/web_spec_social_v3.json"

if os.path.exists(path):
    print(f"Checking {path}...")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cats = Counter([d.get("categoryLabel") or d.get("category_label") for d in data])

    print("\n--- Categories ---")
    for c, count in cats.most_common():
        print(f"{c}: {count}")


path2 = "../app/public/web_past_social.json"
if os.path.exists(path2):
    print(f"\nChecking {path2}...")
    with open(path2, "r", encoding="utf-8") as f:
        data = json.load(f)
    cats = Counter([d.get("categoryLabel") or d.get("category_label") for d in data])
    for c, count in cats.most_common():
        print(f"{c}: {count}")
