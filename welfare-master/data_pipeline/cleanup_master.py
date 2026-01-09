"""
Clean up the master_database.json by:
1. Removing all past_kaigo data with only 1 question (clearly errors)
2. Keeping only valid past_social data (R3-R6)
3. Keeping only valid past_mental data
4. Keeping all common/spec data
"""

import json
from collections import Counter

MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"


def main():
    print("Loading master database...")
    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total questions: {len(data)}")

    # Analyze current state
    print("\n=== Current state ===")
    groups = Counter(q.get("group") for q in data)
    for g, c in sorted(groups.items()):
        print(f"  {g}: {c}")

    # Count by group and year
    print("\n=== past_kaigo by year ===")
    kaigo_years = Counter()
    for q in data:
        if q.get("group") == "past_kaigo":
            kaigo_years[q.get("year")] += 1
    for y, c in sorted(kaigo_years.items()):
        print(f"  {y}: {c}")

    # Identify years to remove (only 1-2 questions = error data)
    years_to_remove = {y for y, c in kaigo_years.items() if c <= 2}
    print(f"\nYears to remove from past_kaigo: {years_to_remove}")

    # Clean the data
    cleaned = []
    removed = Counter()

    for q in data:
        group = q.get("group")
        year = q.get("year")

        # Remove past_kaigo with only 1-2 questions
        if group == "past_kaigo" and year in years_to_remove:
            removed["past_kaigo_junk"] += 1
            continue

        cleaned.append(q)

    print(f"\n=== Removed ===")
    for reason, count in removed.items():
        print(f"  {reason}: {count}")

    print(f"\n=== After cleaning ===")
    print(f"Total questions: {len(cleaned)}")

    # Final counts
    groups = Counter(q.get("group") for q in cleaned)
    for g, c in sorted(groups.items()):
        print(f"  {g}: {c}")

    # Check past_kaigo
    print("\n=== past_kaigo by year (after cleaning) ===")
    kaigo_years = Counter()
    for q in cleaned:
        if q.get("group") == "past_kaigo":
            kaigo_years[q.get("year")] += 1
    for y, c in sorted(kaigo_years.items()):
        print(f"  {y}: {c}")

    # Save
    print("\nSaving cleaned data...")
    with open(MASTER_FILE, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print("Done!")


if __name__ == "__main__":
    main()
