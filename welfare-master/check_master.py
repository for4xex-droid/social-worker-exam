import json
import os
import sys

try:
    path = "app/assets/master_data.json"
    print(f"Checking {path}...")
    if not os.path.exists(path):
        print("File not found")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        print("File opened. Loading JSON...")
        data = json.load(f)
        print("JSON loaded.")

    print(f"Total: {len(data)}")

    # Simple check
    groups = {}
    for item in data:
        g = item.get("group_id") or item.get("group")
        groups[g] = groups.get(g, 0) + 1

    print("Groups found:")
    print(groups)

except Exception as e:
    print(f"Error: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)
