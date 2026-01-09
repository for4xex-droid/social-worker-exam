import json
import os
from collections import defaultdict

json_path = "master_database.json"

try:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Structure: stats[category][year] = count
    stats = defaultdict(lambda: defaultdict(int))

    for item in data:
        # Determine category based on group or context
        group = item.get("group", "")
        cat_label = item.get("category_label", "Unknown")
        year = item.get("year", "Unknown Year")

        # Mapping group to likely category if label is generic
        real_cat = cat_label
        if not real_cat or real_cat == "Unknown":
            if "social" in group:
                real_cat = "Social Worker"
            elif "mental" in group:
                real_cat = "Mental Health SW"
            elif "kaigo" in group:
                real_cat = "Care Worker"
            else:
                real_cat = "Common/Other"

        stats[real_cat][str(year)] += 1

    print("--- Internal Data Counts ---")
    for cat, year_data in stats.items():
        print(f"\nCategory: {cat}")
        # Sort years for easier reading
        sorted_years = sorted(year_data.keys())
        for y in sorted_years:
            print(f"  Year: {y:<10} Count: {year_data[y]}")

except Exception as e:
    print(f"Error: {e}")
