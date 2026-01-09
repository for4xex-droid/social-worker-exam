"""
Analyze the raw_questions_backup.json to understand the original data structure.
"""

import json
from collections import Counter

with open("raw_questions_backup.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total questions: {len(data)}")

# Group by group_id/group
groups = Counter()
for q in data:
    group = q.get("group_id") or q.get("group") or "unknown"
    groups[group] += 1

print("\n=== Groups ===")
for g, c in sorted(groups.items()):
    print(f"  {g}: {c}")

# For past_social, show year distribution
print("\n=== past_social years ===")
years = Counter()
for q in data:
    group = q.get("group_id") or q.get("group")
    if group == "past_social":
        year = q.get("year") or q.get("exam_year") or "None"
        years[year] += 1

for y, c in sorted(years.items()):
    print(f"  {y}: {c}")

# For past_mental, show year distribution
print("\n=== past_mental years ===")
years = Counter()
for q in data:
    group = q.get("group_id") or q.get("group")
    if group == "past_mental":
        year = q.get("year") or q.get("exam_year") or "None"
        years[year] += 1

for y, c in sorted(years.items()):
    print(f"  {y}: {c}")

# For past_kaigo, show year distribution
print("\n=== past_kaigo years ===")
years = Counter()
for q in data:
    group = q.get("group_id") or q.get("group")
    if group == "past_kaigo":
        year = q.get("year") or q.get("exam_year") or "None"
        years[year] += 1

for y, c in sorted(years.items()):
    print(f"  {y}: {c}")
