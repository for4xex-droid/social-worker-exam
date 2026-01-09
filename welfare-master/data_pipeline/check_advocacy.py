import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Filter for past_social R6
    r6_social = [
        q
        for q in data
        if q.get("group") == "past_social" and q.get("year") == "令和6年度"
    ]

    print(f"Total past_social R6: {len(r6_social)}")

    advocacy_qs = [q for q in r6_social if "アドボカシー" in q.get("question_text", "")]

    if advocacy_qs:
        print("\n!!! ALARM: Found 'Advocacy' in past_social R6 !!!")
        for q in advocacy_qs:
            print(f"ID: {q.get('id')}")
            print(f"Text: {q.get('question_text')}")
    else:
        print("\nNo 'Advocacy' found in past_social R6 question text.")

    # Check options too
    advocacy_opts = [
        q for q in r6_social if any("アドボカシー" in o for o in q.get("options", []))
    ]
    if advocacy_opts:
        print("\n!!! ALARM: Found 'Advocacy' in past_social R6 options !!!")
        for q in advocacy_opts:
            print(f"ID: {q.get('id')}")
            print(f"Text: {q.get('question_text')}")


if __name__ == "__main__":
    main()
