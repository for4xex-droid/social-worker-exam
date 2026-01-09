import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Inspect ID 4859 (Social Q1)
    q1_list = [q for q in data if str(q.get("id")) == "4859"]
    print(f"Found {len(q1_list)} questions with ID 4859")
    for q in q1_list:
        print(f"  Group: {q.get('group')}")
        print(f"  Options: {q.get('options')}")
        print(f"  Text: {q.get('question_text')}")

    # 2. Inspect ID 4860 (Social Q2?)
    q2_list = [q for q in data if str(q.get("id")) == "4860"]
    print(f"\nFound {len(q2_list)} questions with ID 4860")
    for q in q2_list:
        print(f"  Group: {q.get('group')}")
        print(f"  Text: {q.get('question_text')}")
        if "アドボカシー" in str(q.get("question_text")):
            print("  *** THIS IS AN ADVOCACY QUESTION ***")

    # 3. Check for Duplicate IDs in general
    print("\n=== Duplicate IDs Check ===")
    ids = [str(q.get("id")) for q in data]
    from collections import Counter

    dupes = [id for id, count in Counter(ids).items() if count > 1]
    print(f"Total duplicate IDs: {len(dupes)}")
    if dupes:
        print(f"Sample duplicates: {dupes[:5]}")


if __name__ == "__main__":
    main()
