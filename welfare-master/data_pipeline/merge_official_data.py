"""
Merge official SSSC data into master_database.json.
Replaces old incorrect data with official SSSC data.
"""

import json
from collections import Counter

OFFICIAL_DATA = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/sssc_official_questions.json"
MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"


def main():
    print("Loading data...")

    with open(OFFICIAL_DATA, "r", encoding="utf-8") as f:
        official_data = json.load(f)

    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        master_data = json.load(f)

    print(f"Official SSSC data: {len(official_data)} questions")
    print(f"Master data: {len(master_data)} questions")

    # Count official data by year
    official_years = Counter(q["year"] for q in official_data)
    print(f"\nOfficial data by year: {dict(official_years)}")

    # Remove old past_social data for years that we have official data for
    official_year_set = set(official_years.keys())

    # Filter out old past_social data for these years
    filtered_master = []
    removed_count = 0
    for q in master_data:
        if q.get("group") == "past_social" and q.get("year") in official_year_set:
            removed_count += 1
            continue
        filtered_master.append(q)

    print(f"Removed {removed_count} old past_social questions")
    print(f"Remaining master data: {len(filtered_master)} questions")

    # Get max ID from filtered master
    max_id = 0
    for q in filtered_master:
        try:
            qid = int(q["id"])
            if qid > max_id:
                max_id = qid
        except:
            pass

    print(f"Max existing ID: {max_id}")

    # Add official data with new IDs
    new_id = max_id + 1
    for item in official_data:
        new_item = {
            "id": new_id,
            "question_text": item.get("question_text", ""),
            "options": item.get("options", []),
            "correct_answer": item.get("correct_answer", []),
            "explanation": "",
            "group": "past_social",
            "year": item.get("year", ""),
            "category_label": item.get("category_label", "社会福祉士"),
            "source_url": f"https://www.sssc.or.jp/shakai/past_exam/index.html",
            "question_number": item.get("question_number", 0),
            "exam_number": item.get("exam_number", ""),
        }
        filtered_master.append(new_item)
        new_id += 1

    print(f"\nTotal after merge: {len(filtered_master)} questions")

    # Final counts by group and year
    final_counts = Counter()
    for q in filtered_master:
        key = f"{q.get('group')}|{q.get('year')}"
        final_counts[key] += 1

    print("\nFinal data distribution:")
    for key in sorted(final_counts.keys()):
        if "past_social" in key:
            print(f"  {key}: {final_counts[key]}")

    # Save
    with open(MASTER_FILE, "w", encoding="utf-8") as f:
        json.dump(filtered_master, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to {MASTER_FILE}")


if __name__ == "__main__":
    main()
