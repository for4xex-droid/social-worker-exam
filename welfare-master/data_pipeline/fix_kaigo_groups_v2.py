"""
Force fix Kaigo groups based on ID pattern 'K' or 'k'.
"""

import json
import shutil

ASSET_FILE = "../app/assets/master_data.json"


def main():
    print(f"Loading {ASSET_FILE}...")
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    fixed_count = 0
    k_ids = 0

    for q in data:
        qid = str(q.get("id", "")).strip()
        group = q.get("group", "")

        # Check if it starts with K (Kaigo ID pattern)
        if qid.lower().startswith("k"):
            k_ids += 1
            if group != "past_kaigo":
                print(
                    f"MISMATCH FOUND! ID: {qid}, Group: '{group}' -> Fix to 'past_kaigo'"
                )
                q["group"] = "past_kaigo"
                # Also ensure category label is correct
                q["category_label"] = "介護福祉士"
                fixed_count += 1

    print(f"\nTotal K-IDs: {k_ids}")
    print(f"Fixed: {fixed_count}")

    if fixed_count > 0:
        print("Saving fixes...")
        with open(ASSET_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Sync to master_database.json as well
        shutil.copy2(ASSET_FILE, "master_database.json")
        shutil.copy2(ASSET_FILE, "../app/assets/master_database.json")
        print(" synced.")
    else:
        print("No changes allowed.")


if __name__ == "__main__":
    main()
