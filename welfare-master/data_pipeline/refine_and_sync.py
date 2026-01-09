"""
Refine master_database.json based on analysis.
1. Move past_mental / None -> spec_mental (Prediction questions)
2. Move past_mental / 令和7年度 -> spec_mental (Prediction questions)
3. Move past_kaigo / None (if any) -> spec_care
"""

import json

MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"


def main():
    print("Loading master database...")
    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total objects: {len(data)}")

    refined_count = 0

    for q in data:
        group = q.get("group")
        year = q.get("year")

        # 1. past_mental with None or R7 -> spec_mental
        if group == "past_mental":
            if year is None or year == "None" or year == "令和7年度":
                q["group"] = "spec_mental"
                q["year"] = None  # Clear confusing year
                q["category_label"] = "精神専門（予想）"
                refined_count += 1

        # 2. past_kaigo with None -> spec_care
        if group == "past_kaigo":
            if year is None or year == "None":
                q["group"] = "spec_care"
                q["year"] = None
                q["category_label"] = "介護専門（予想）"
                refined_count += 1

    print(f"\nRefined {refined_count} questions.")

    # Save
    print("Saving refined master database...")
    with open(MASTER_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Copy to app assets immediately
    import shutil

    shutil.copy2(MASTER_FILE, "../app/assets/master_data.json")
    shutil.copy2(MASTER_FILE, "../app/assets/master_database.json")
    print("Copied to app assets.")

    # Final Verification
    from collections import Counter

    final_groups = Counter(f"{q.get('group')}|{q.get('year')}" for q in data)
    print("\n=== Final Data Structure ===")
    for k, v in sorted(final_groups.items()):
        if "past" in k:  # Only show past exams to check years
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
