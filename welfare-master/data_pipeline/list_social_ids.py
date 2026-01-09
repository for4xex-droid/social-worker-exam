import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Filter strictly
    r6_social = [
        q
        for q in data
        if q.get("group") == "past_social" and q.get("year") == "令和6年度"
    ]

    # Sort by ID string to be safe
    r6_social.sort(key=lambda x: str(x.get("id")))

    print(f"Total Social R6: {len(r6_social)}")
    print("IDs:")
    ids = [str(q.get("id")) for q in r6_social]
    print(ids)

    # Check for K
    k_in_social = [i for i in ids if i.lower().startswith("k")]
    print(f"\nK-IDs in Social R6: {len(k_in_social)}")
    if k_in_social:
        print(k_in_social)


if __name__ == "__main__":
    main()
