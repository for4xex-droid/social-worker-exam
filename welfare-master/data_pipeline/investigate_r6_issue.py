"""
Investigate the specific issues reported by usage:
1. Identify the first question of past_social R6 (verify if broken).
2. Search for "advocacy" (アドボカシー) in past_social R6 to see if it's actually a Care Worker question.
"""

import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    print(f"Loading {ASSET_FILE}...")
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Filter for past_social R6
    r6_social = [
        q
        for q in data
        if q.get("group") == "past_social" and q.get("year") == "令和6年度"
    ]
    print(f"\nTotal past_social R6 questions: {len(r6_social)}")

    # Sort by ID to find the "first" and "second" questions as the app would likely query them
    # Ensure IDs are integers for sorting
    try:
        r6_social.sort(key=lambda x: int(x.get("id", 0)))
    except:
        r6_social.sort(key=lambda x: str(x.get("id", "")))

    if not r6_social:
        print("No R6 social questions found!")
        return

    # 1. Investigate First Question
    q1 = r6_social[0]
    print("\n=== 1st Question (Potential Blank) ===")
    print(f"ID: {q1.get('id')}")
    print(f"Text: {q1.get('question_text')}")
    print(f"Options: {q1.get('options')}")
    print(f"Correct: {q1.get('correct_answer')}")

    # 2. Investigate Second Question
    if len(r6_social) > 1:
        q2 = r6_social[1]
        print("\n=== 2nd Question (Potential Advocacy) ===")
        print(f"ID: {q2.get('id')}")
        print(f"Text: {q2.get('question_text')}")

    # 3. Search for Advocacy
    print("\n=== Advocacy Search in R6 Social ===")
    advocacy = [q for q in r6_social if "アドボカシー" in str(q)]
    for q in advocacy:
        print(f"found: ID={q.get('id')} Text={q.get('question_text', '')[:50]}...")

    # 4. Compare with Care Worker (Kaigo) Data
    print("\n=== Look for typical Kaigo questions in Social data ===")
    # Kaigo typically starts with "人間の尊厳と自立"
    尊厳 = [q for q in r6_social if "尊厳" in str(q.get("question_text"))]
    if 尊厳:
        print(f"Found 'Dignity' (Kaigo keyword?) in Social: {len(尊厳)} questions")
        print(f"Sample: {尊厳[0].get('question_text')[:50]}")


if __name__ == "__main__":
    main()
