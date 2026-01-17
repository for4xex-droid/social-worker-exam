import json
from collections import Counter
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding="utf-8")

target = "app/public/web_spec_social.json"
print(f"Checking {target}...")

try:
    with open(target, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Total Questions: {len(data)}")

    cats = Counter([d.get("category_label", "Unknown") for d in data])
    print("\n--- Category Breakdown ---")
    for k, v in cats.most_common():
        print(f"{k}: {v}")

except Exception as e:
    print(f"Error: {e}")
