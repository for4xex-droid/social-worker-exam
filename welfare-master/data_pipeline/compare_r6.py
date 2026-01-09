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

    # Sort by ID numerically
    r6_social.sort(key=lambda x: int(x.get("id", 0)))

    print(f"Total: {len(r6_social)}")
    print("\nFirst 5 questions in Social R6:")
    for i, q in enumerate(r6_social[:5]):
        print(f"#{i + 1} ID: {q.get('id')} Text: {q.get('question_text', '')[:20]}...")

    # Also check Kaigo R6 first 5
    r6_kaigo = [
        q
        for q in data
        if q.get("group") == "past_kaigo" and q.get("year") == "令和6年度"
    ]
    r6_kaigo.sort(key=lambda x: int(x.get("id", 0)))
    print(f"\nTotal Kaigo: {len(r6_kaigo)}")
    print("First 5 questions in Kaigo R6:")
    for i, q in enumerate(r6_kaigo[:5]):
        print(f"#{i + 1} ID: {q.get('id')} Text: {q.get('question_text', '')[:20]}...")

    # Check if 'Advocacy' exists in Kaigo R6 #2
    if len(r6_kaigo) > 1:
        if "アドボカシー" in r6_kaigo[1].get("question_text", ""):
            print("\n*** MATCH: Kaigo R6 #2 is Advocacy! ***")


if __name__ == "__main__":
    main()
