import json
import os

path = "../app/assets/separated_db/master_social.json"

if os.path.exists(path):
    print(f"Checking {path}...")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total items: {len(data)}")

    # Check groups
    groups = {}
    for item in data:
        g = item.get("group") or "None"
        groups[g] = groups.get(g, 0) + 1

    for g, c in groups.items():
        print(f"  - {g}: {c}")

else:
    print("File not found.")
