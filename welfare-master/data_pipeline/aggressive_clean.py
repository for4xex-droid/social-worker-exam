"""
Aggressively clean the master database.
1. Remove past_social/past_mental questions with ID < 2000 (Dummy data).
2. Remove questions with placeholder text like "問題文" or "選1".
3. Verify what remains.
"""

import json
import shutil

MASTER_FILE = "master_database.json"


def main():
    print(f"Loading {MASTER_FILE}...")
    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    initial_count = len(data)
    cleaned_data = []

    removed_counts = {"id_low": 0, "placeholder": 0, "kaigo_dummy": 0}

    for q in data:
        qid_str = str(q.get("id", ""))
        group = q.get("group", "")
        text = q.get("question_text", "")

        # Check specific placeholders
        if "人間の尊厳と自立に関する問題文" in text or "選1" in str(
            q.get("options", [])
        ):
            removed_counts["kaigo_dummy"] += 1
            print(f"Removing placeholder: {qid_str} ({group})")
            continue

        # Check Social/Mental numeric IDs
        if group in ["past_social", "past_mental"]:
            try:
                qid_val = int(qid_str)
                if qid_val < 3000:  # Assuming official IDs are 4000+
                    removed_counts["id_low"] += 1
                    # print(f"Removing low ID: {qid_str} ({group})")
                    continue
            except ValueError:
                # Non-numeric ID in social/mental -> likely junk or old format
                removed_counts["id_low"] += 1
                print(f"Removing non-numeric ID from {group}: {qid_str}")
                continue

        # Check Kaigo IDs
        if group == "past_kaigo":
            # Remove the known bad pattern K34_no34_1 etc if they are placeholders
            # But we already checked text content above.
            pass

        cleaned_data.append(q)

    print(f"\nTotal removed: {initial_count - len(cleaned_data)}")
    print(f"Breakdown: {removed_counts}")
    print(f"Remaining: {len(cleaned_data)}")

    # Analyze remaining data
    from collections import Counter

    c = Counter(
        f"{q.get('group')}|{q.get('year')}"
        for q in cleaned_data
        if "past" in q.get("group", "")
    )
    print("\nRemaining Data Structure:")
    for k, v in sorted(c.items()):
        print(f"{k}: {v}")

    # Save
    with open(MASTER_FILE, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=2)

    # Sync to app assets
    shutil.copy2(MASTER_FILE, "../app/assets/master_data.json")
    shutil.copy2(MASTER_FILE, "../app/assets/master_database.json")
    print("\nSynced to app assets.")


if __name__ == "__main__":
    main()
