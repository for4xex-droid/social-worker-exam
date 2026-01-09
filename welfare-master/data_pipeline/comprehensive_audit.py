import json


def audit():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    targets = [
        ("past_social", "令和3年度"),
        ("past_social", "令和4年度"),
        ("past_social", "令和5年度"),
        ("past_social", "令和6年度"),
        ("past_mental", "令和6年度"),
    ]

    for g, y in targets:
        items = [q for q in db if q.get("group") == g and q.get("year") == y]
        print(f"\n[{g}] {y}")
        print(f"  Count: {len(items)}")
        if items:
            print(
                f"  Q1: {items[0].get('question_text', items[0].get('text', ''))[:100]}"
            )


if __name__ == "__main__":
    audit()
