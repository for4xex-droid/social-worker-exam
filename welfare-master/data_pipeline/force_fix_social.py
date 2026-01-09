import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("Checking for K-ID questions in past_social...")

    count = 0
    for q in data:
        if q.get("group") == "past_social":
            qid = str(q.get("id"))
            if "K" in qid or "k" in qid:
                print(f"FOUND: ID={qid}, Group={q.get('group')}, Year={q.get('year')}")
                count += 1

                # Fix it in memory
                q["group"] = "past_kaigo"

    print(f"Found {count} misclassified items.")

    if count > 0:
        print("Saving fixes...")
        with open(ASSET_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        import shutil

        shutil.copy2(ASSET_FILE, "master_database.json")
        import shutil

        shutil.copy2(ASSET_FILE, "../app/assets/master_database.json")


if __name__ == "__main__":
    main()
