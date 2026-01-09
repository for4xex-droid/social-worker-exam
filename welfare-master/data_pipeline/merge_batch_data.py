"""
Merge batch_scraped.json data into master_database.json.
Since we don't have answer keys yet, we'll import questions without correct answers.
Answers can be added later.
"""

import json
from collections import Counter

BATCH_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/batch_scraped.json"
MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"
OUTPUT_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"


def main():
    print("Loading data...")

    with open(BATCH_FILE, "r", encoding="utf-8") as f:
        batch_data = json.load(f)

    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        master_data = json.load(f)

    print(f"Batch data: {len(batch_data)} questions")
    print(f"Master data: {len(master_data)} questions")

    # Count existing questions by group and year
    existing_counts = Counter()
    for q in master_data:
        key = f"{q.get('group')}|{q.get('year')}"
        existing_counts[key] += 1

    print("\nExisting data:")
    for key, count in sorted(existing_counts.items()):
        print(f"  {key}: {count}")

    # Identify what's in batch that isn't in master
    batch_counts = Counter()
    for q in batch_data:
        key = f"{q.get('group')}|{q.get('year')}"
        batch_counts[key] += 1

    print("\nBatch data to import:")
    for key, count in sorted(batch_counts.items()):
        existing = existing_counts.get(key, 0)
        print(f"  {key}: {count} (existing: {existing})")

    # Get max ID from master
    max_id = 0
    for q in master_data:
        try:
            qid = int(q["id"])
            if qid > max_id:
                max_id = qid
        except:
            pass

    print(f"\nMax existing ID: {max_id}")

    # Filter out duplicates - remove from master any group/year that's in batch
    # Then add all batch data with new IDs
    groups_years_to_replace = set()
    for q in batch_data:
        groups_years_to_replace.add((q.get("group"), q.get("year")))

    print(f"\nReplacing data for: {groups_years_to_replace}")

    # Filter master data
    filtered_master = [
        q
        for q in master_data
        if (q.get("group"), q.get("year")) not in groups_years_to_replace
    ]

    print(f"Filtered master: {len(filtered_master)} questions")

    # Convert batch data to master format and assign IDs
    new_id = max_id + 1
    new_items = []

    for item in batch_data:
        new_item = {
            "id": new_id,
            "question_text": item.get("question_text", ""),
            "options": item.get("options", []),
            "correct_answer": [],  # Empty for now, will add later
            "explanation": "",
            "group": item.get("group", ""),
            "year": item.get("year", ""),
            "category_label": item.get("category_label", ""),
            "source_url": item.get("source_url", ""),
            "question_number": item.get("questionNumber", 0),
        }
        new_items.append(new_item)
        new_id += 1

    # Merge
    merged_data = filtered_master + new_items

    print(f"\nMerged total: {len(merged_data)} questions")

    # Final counts
    final_counts = Counter()
    for q in merged_data:
        key = f"{q.get('group')}|{q.get('year')}"
        final_counts[key] += 1

    print("\nFinal data distribution:")
    for key, count in sorted(final_counts.items()):
        print(f"  {key}: {count}")

    # Save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
