import json


def check_file(path):
    print(f"Checking {path}...")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        groups = {}
        for item in data:
            grp = item.get("group") or item.get("group_id")
            groups[grp] = groups.get(grp, 0) + 1

        print(f"  Total: {len(data)}")
        for g, count in groups.items():
            print(f"  - {g}: {count}")

    except Exception as e:
        print(f"  Error: {e}")


base = ""
check_file("raw_questions.json")
check_file("master_database_v2_final.json")
