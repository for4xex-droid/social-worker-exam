import json
import os

path = "master_database_v2_final.json"

if os.path.exists(path):
    print(f"Loading {path}...")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # App Logic Simulation
    # return g === 'common' || g.startsWith('common') || g.startsWith('past');

    targets = []
    excluded = []

    for q in data:
        g = str(q.get("group") or "")
        if g == "common" or g.startswith("common") or g.startswith("past"):
            targets.append(q)
        else:
            excluded.append(q)

    print(f"\nTotal Questions in DB: {len(data)}")
    print(f"Daily Mission Targets: {len(targets)}")

    # Break down of targets
    from collections import Counter

    target_groups = Counter([t.get("group") for t in targets])
    print("\nTarget Breakdown:")
    for g, c in target_groups.items():
        print(f"  - {g}: {c}")

    # Break down of excluded
    excluded_groups = Counter([e.get("group") for e in excluded])
    print("\nExcluded Breakdown:")
    for g, c in excluded_groups.items():
        print(f"  - {g}: {c}")

else:
    print("File not found.")
