import json
import os
from collections import Counter

path = "app/assets/master_data.json"
if not os.path.exists(path):
    print(f"{path} not found")
    exit()

try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    groups = [item.get("group_id", item.get("group", "unknown")) for item in data]
    print(Counter(groups))
except Exception as e:
    print(e)
