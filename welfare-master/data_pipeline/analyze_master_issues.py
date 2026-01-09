"""
Analyze duplicates and year consistency in master_database.json
"""

import json
from collections import Counter

MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"


def main():
    print("Loading master database...")
    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total objects: {len(data)}")

    # --- Check for Duplicates (based on question text) ---
    print("\n=== Duplicate Check (Question Text) ===")
    seen_texts = {}
    duplicates = []

    for q in data:
        text = q.get("question_text", "").strip()
        qt_id = q.get("id")
        group = q.get("group")
        year = q.get("year")

        if len(text) < 10:
            continue  # Skip empty or too short

        key = (group, text)
        if key in seen_texts:
            duplicates.append(
                {
                    "original": seen_texts[key],
                    "duplicate": {"id": qt_id, "group": group, "year": year},
                }
            )
        else:
            seen_texts[key] = {"id": qt_id, "group": group, "year": year}

    print(
        f"Found {len(duplicates)} potential duplicates based on text within same group."
    )

    # Show specifics for past_kaigo R4
    print("\n=== past_kaigo R4 Analysis ===")
    kaigo_r4 = [
        q
        for q in data
        if q.get("group") == "past_kaigo" and q.get("year") == "令和4年度"
    ]
    print(f"Count: {len(kaigo_r4)}")

    # Check duplicate texts in kaigo R4
    kaigo_r4_texts = [q.get("question_text", "").strip() for q in kaigo_r4]
    text_counts = Counter(kaigo_r4_texts)
    dupe_texts = {t: c for t, c in text_counts.items() if c > 1}
    print(f"Questions with duplicate text in kaigo R4: {len(dupe_texts)}")
    if dupe_texts:
        print(
            f"Sample duplicate: {list(dupe_texts.keys())[0][:50]}... (Count: {list(dupe_texts.values())[0]})"
        )

    # --- Check past_mental Years ---
    print("\n=== past_mental Year Analysis ===")
    mental = [q for q in data if q.get("group") == "past_mental"]
    mental_years = Counter(q.get("year") for q in mental)
    for y, c in sorted(mental_years.items(), key=lambda x: str(x[0])):
        print(f"  {y}: {c}")

    # Check 'None' year content
    mental_none = [q for q in mental if q.get("year") is None]
    if mental_none:
        print(f"\nSample past_mental with None year (ID: {mental_none[0].get('id')}):")
        print(f"  Text: {mental_none[0].get('question_text', '')[:60]}...")

    # Check '令和7年度' content
    mental_r7 = [q for q in mental if q.get("year") == "令和7年度"]
    if mental_r7:
        print(f"\nSample past_mental R7 (ID: {mental_r7[0].get('id')}):")
        print(f"  Text: {mental_r7[0].get('question_text', '')[:60]}...")


if __name__ == "__main__":
    main()
