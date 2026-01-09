"""
Scan ALL data for K-IDs and force them to be 'past_kaigo'.
Also check common/spec groups.
"""

import json
import shutil

ASSET_FILE = "../app/assets/master_data.json"


def main():
    print(f"Loading {ASSET_FILE}...")
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    fixed_count = 0
    k_in_social_context = 0

    for q in data:
        qid = str(q.get("id", "")).strip()
        group = q.get("group", "")

        # Check if ID implies Kaigo
        if qid.lower().startswith("k"):
            if group != "past_kaigo":
                print(
                    f"MISMATCH: ID {qid} is in group '{group}' -> Fix to 'past_kaigo'"
                )
                q["group"] = "past_kaigo"
                q["category_label"] = "介護福祉士"
                fixed_count += 1

                if group in ["past_social", "common", "spec_social"]:
                    k_in_social_context += 1

    print(f"\nTotal fixed: {fixed_count}")
    print(f"K-IDs removed from Social context: {k_in_social_context}")

    if fixed_count > 0:
        print("Saving fixes...")
        with open(ASSET_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.copy2(ASSET_FILE, "../app/assets/master_database.json")
        print("Synced.")


if __name__ == "__main__":
    main()
