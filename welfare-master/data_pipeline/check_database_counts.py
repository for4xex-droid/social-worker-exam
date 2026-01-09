import json
from collections import Counter


def check_counts():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    groups = ["past_social", "past_mental", "past_kaigo"]

    for g in groups:
        print(f"\n--- {g} ---")
        items = [str(q.get("year", "None")) for q in db if q.get("group") == g]
        counts = Counter(items)
        for y, c in sorted(counts.items()):
            print(f"  {y}: {c}")


if __name__ == "__main__":
    check_counts()
