"""
Debug: Check the structure of R6 social worker questions to understand
how to match them with the answer key.
"""

import json

MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"
ANSWER_KEY_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/answer_key_r6.json"

with open(MASTER_FILE, "r", encoding="utf-8") as f:
    master_data = json.load(f)

with open(ANSWER_KEY_FILE, "r", encoding="utf-8") as f:
    answer_key = json.load(f)

# Find R6 social questions
r6_social = [
    q
    for q in master_data
    if q.get("group") == "past_social" and q.get("year") == "令和6年度"
]

print(f"Found {len(r6_social)} R6 social questions")
print(f"Answer key has {len(answer_key)} entries")

# Show first 5 questions
print("\nFirst 5 R6 social questions:")
for i, q in enumerate(r6_social[:5]):
    print(f"  ID: {q.get('id')}")
    print(f"  question_number: {q.get('question_number')}")
    print(f"  correct_answer: {q.get('correct_answer')}")
    print(f"  text: {q.get('question_text', '')[:80]}...")
    print()

# Show last 5 questions
print("\nLast 5 R6 social questions:")
for i, q in enumerate(r6_social[-5:]):
    print(f"  ID: {q.get('id')}")
    print(f"  question_number: {q.get('question_number')}")
    print(f"  correct_answer: {q.get('correct_answer')}")
    print(f"  text: {q.get('question_text', '')[:80]}...")
    print()

# Show answer key sample
print("\nAnswer key sample:")
for k in list(answer_key.keys())[:5]:
    print(f"  Question {k}: {answer_key[k]}")
