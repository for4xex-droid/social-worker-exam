import json
from collections import Counter

file_path = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/batch_scraped.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

counts = Counter()
for q in data:
    key = f"{q.get('group')} {q.get('year')}"
    counts[key] += 1

for key, count in counts.items():
    print(f"{key}: {count}")
