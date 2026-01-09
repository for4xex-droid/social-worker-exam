import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    r6_social = [
        q
        for q in data
        if q.get("group") == "past_social" and q.get("year") == "令和6年度"
    ]
    try:
        r6_social.sort(key=lambda x: int(x.get("id", 0)))
    except:
        r6_social.sort(key=lambda x: str(x.get("id", "")))

    if not r6_social:
        return

    q1 = r6_social[0]
    print(f"Q1 ID: {q1.get('id')}")
    print(f"Q1 Text: '{q1.get('question_text')}'")
    print(f"Q1 Options: {q1.get('options')}")

    if len(r6_social) > 1:
        q2 = r6_social[1]
        print(f"Q2 ID: {q2.get('id')}")
        print(f"Q2 Text: '{q2.get('question_text')}'")

    # Check for Advocacy
    for q in r6_social:
        if "アドボカシー" in str(q.get("question_text", "")) or "アドボカシー" in str(
            q.get("options", "")
        ):
            print(f"Advocacy found in ID: {q.get('id')}")
            print(f"Text: {q.get('question_text')}")


if __name__ == "__main__":
    main()
