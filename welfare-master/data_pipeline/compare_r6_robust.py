import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Helper for sorting ID
    def sort_key(q):
        try:
            return (0, int(q.get("id")))
        except:
            return (1, str(q.get("id")))

    r6_social = [
        q
        for q in data
        if q.get("group") == "past_social" and q.get("year") == "令和6年度"
    ]
    r6_social.sort(key=sort_key)

    print(f"Total Social R6: {len(r6_social)}")
    print("\nFirst 5 questions in Social R6:")
    for i, q in enumerate(r6_social[:5]):
        print(f"#{i + 1} ID: {q.get('id')} Text: {q.get('question_text', '')[:20]}...")

    r6_kaigo = [
        q
        for q in data
        if q.get("group") == "past_kaigo" and q.get("year") == "令和6年度"
    ]
    r6_kaigo.sort(key=sort_key)

    print(f"\nTotal Kaigo R6: {len(r6_kaigo)}")
    print("First 5 questions in Kaigo R6:")
    for i, q in enumerate(r6_kaigo[:5]):
        print(f"#{i + 1} ID: {q.get('id')} Text: {q.get('question_text', '')[:20]}...")

    if len(r6_kaigo) > 1:
        q2 = r6_kaigo[1]
        print(f"\nKaigo #2 Full Text: {q2.get('question_text')}")


if __name__ == "__main__":
    main()
