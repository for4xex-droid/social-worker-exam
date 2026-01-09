"""
Fix group assignment in master_database.json based on ID patterns.
- ID starts with 'K': Force group to 'past_kaigo'
- ID is numeric (and in social range): Ensure group is correct (though numeric collision is less likely locally)
"""

import json

MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"


def main():
    print("Loading master database...")
    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    fixed_count = 0

    for q in data:
        qid = str(q.get("id"))
        current_group = q.get("group")

        # Rule 1: ID starts with 'K' -> past_kaigo
        if qid.startswith("K") or qid.startswith("k"):
            if current_group != "past_kaigo":
                print(f"Fixing ID {qid}: {current_group} -> past_kaigo")
                q["group"] = "past_kaigo"
                # Also ensure year format is consistent? K IDs seem to be like K37...
                # Leave year as is for now if it's correct (R6 etc)
                fixed_count += 1

    print(f"\nFixed {fixed_count} misclassified questions.")

    # Save
    if fixed_count > 0:
        print("Saving fixed master database...")
        with open(MASTER_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Sync to app
        import shutil

        shutil.copy2(MASTER_FILE, "../app/assets/master_data.json")
        shutil.copy2(MASTER_FILE, "../app/assets/master_database.json")
        print("Synced to app assets.")
    else:
        print("No changes needed.")


if __name__ == "__main__":
    main()
