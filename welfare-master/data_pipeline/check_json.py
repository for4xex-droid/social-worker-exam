import json
import os
from collections import Counter

file_path = "master_database.json"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total items: {len(data)}")

    year_counter = Counter()
    missing_year_groups = Counter()

    for item in data:
        year = item.get("year")
        if year:
            year_counter[str(year)] += 1
        else:
            year_counter["None"] += 1
            group = item.get("group", "unknown")
            missing_year_groups[group] += 1

    print("\n--- Year Distribution ---")
    for year, count in year_counter.items():
        print(f"Year: {year}, Count: {count}")

    print("\n--- Group Distribution for '全年度' ---")
    all_year_groups = Counter()
    for item in data:
        if item.get("year") == "全年度":
            all_year_groups[item.get("group", "unknown")] += 1

    for group, count in all_year_groups.items():
        print(f"Group: {group}, Count: {count}")

except Exception as e:
    print(f"Error: {e}")
