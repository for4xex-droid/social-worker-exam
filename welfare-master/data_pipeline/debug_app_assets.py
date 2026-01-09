"""
Debug the master_data.json in app assets to see exactly what data is being loaded.
"""

import json
import os

ASSET_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/app/assets/master_data.json"


def main():
    print(f"File: {ASSET_FILE}")
    print(f"File size: {os.path.getsize(ASSET_FILE)} bytes")
    print()

    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total questions: {len(data)}")

    # Group by group and year
    from collections import Counter

    groups = Counter(f"{q.get('group')}|{q.get('year')}" for q in data)

    print("\n=== past_social questions ===")
    for key in sorted(groups.keys()):
        if "past_social" in key:
            print(f"  {key}: {groups[key]}")

    # Get first 3 R6 questions
    r6_questions = [
        q
        for q in data
        if q.get("group") == "past_social" and q.get("year") == "令和6年度"
    ]
    print(f"\n=== 令和6年度 first 3 questions ===")
    for i, q in enumerate(r6_questions[:3]):
        print(f"\nQuestion {i + 1}:")
        print(f"  ID: {q.get('id')}")
        print(f"  question_number: {q.get('question_number')}")
        print(f"  question_text: {q.get('question_text', '')[:80]}...")
        print(f"  options count: {len(q.get('options', []))}")
        print(f"  correct_answer: {q.get('correct_answer')}")

    # Check for ID patterns
    all_ids = [str(q.get("id")) for q in data]
    k_ids = [i for i in all_ids if str(i).startswith("K")]
    print(f"\n=== ID Analysis ===")
    print(f"Total IDs: {len(all_ids)}")
    print(f"K-prefixed IDs: {len(k_ids)}")
    if k_ids:
        print(f"  Sample: {k_ids[:5]}")


if __name__ == "__main__":
    main()
