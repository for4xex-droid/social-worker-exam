import json

with open("../app/assets/master_data.json", "r", encoding="utf-8") as f:
    d = json.load(f)

r6 = [q for q in d if q.get("group") == "past_social" and q.get("year") == "令和6年度"]
print(f"past_social R6 Count: {len(r6)}")
for q in r6[:5]:
    print(f"ID: {q.get('id')}")
    print(f"Text: {q.get('question_text', '')[:70]}")
    print()
