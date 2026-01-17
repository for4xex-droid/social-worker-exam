import json
import os

targets = [
    "app/assets/master_database_v3.json",
    "app/assets/master_data.json",
    "app/assets/master_database_v13_mental.json",
]

for t in targets:
    if not os.path.exists(t):
        print(f"{t} not found")
        continue

    print(f"Scanning {t}...")
    try:
        with open(t, "r", encoding="utf-8") as f:
            data = json.load(f)

        sw_count = 0
        health_count = 0

        # Check first 5 items to see structure
        # print(json.dumps(data[:1], indent=2, ensure_ascii=False))

        for q in data:
            s = json.dumps(q, ensure_ascii=False)
            if "SW専" in s:
                sw_count += 1
            if "保健医療と福祉" in s:
                health_count += 1

        print(f"  Total: {len(data)}")
        print(f"  'SW専' hits: {sw_count}")
        print(f"  '保健医療と福祉' hits: {health_count}")
    except Exception as e:
        print(f"  Error: {e}")
