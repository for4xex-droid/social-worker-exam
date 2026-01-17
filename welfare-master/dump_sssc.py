import json
import os

path = "data_pipeline/sssc_official_questions.json"
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(json.dumps(data[0], indent=2, ensure_ascii=False))
except Exception as e:
    print(e)
