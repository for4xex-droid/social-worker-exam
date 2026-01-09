import json
from collections import Counter

with open("../app/assets/master_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("Current App Assets Data:")
c = Counter(
    f"{q.get('group')}|{q.get('year')}" for q in data if "past" in q.get("group")
)
for k, v in sorted(c.items()):
    print(f"  {k}: {v}")
