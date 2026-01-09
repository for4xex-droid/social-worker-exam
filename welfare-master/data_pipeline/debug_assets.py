import json

# Check master_data.json in app assets
with open("../app/assets/master_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Filter by group and year
social_r6 = [
    q for q in data if q.get("group") == "past_social" and q.get("year") == "令和6年度"
]
social_r5 = [
    q for q in data if q.get("group") == "past_social" and q.get("year") == "令和5年度"
]
social_r4 = [
    q for q in data if q.get("group") == "past_social" and q.get("year") == "令和4年度"
]

print(f"Total questions: {len(data)}")
print(f"\nR6 (令和6年度): {len(social_r6)} questions")
print(f"R5 (令和5年度): {len(social_r5)} questions")
print(f"R4 (令和4年度): {len(social_r4)} questions")

print("\n=== R6 First 3 questions ===")
for q in social_r6[:3]:
    print(f"  ID: {q.get('id')}")
    print(f"  Q#: {q.get('question_number')}")
    print(f"  Text: {str(q.get('question_text', ''))[:60]}...")
    print()

print("\n=== R5 First 3 questions ===")
for q in social_r5[:3]:
    print(f"  ID: {q.get('id')}")
    print(f"  Q#: {q.get('question_number')}")
    print(f"  Text: {str(q.get('question_text', ''))[:60]}...")
    print()

print("\n=== R4 First 3 questions ===")
for q in social_r4[:3]:
    print(f"  ID: {q.get('id')}")
    print(f"  Q#: {q.get('question_number')}")
    print(f"  Text: {str(q.get('question_text', ''))[:60]}...")
    print()

# Check for ID patterns
all_ids = [str(q.get("id")) for q in data if q.get("group") == "past_social"]
k_ids = [i for i in all_ids if i.startswith("K")]
numeric_ids = [i for i in all_ids if i.isdigit()]
other_ids = [i for i in all_ids if not i.startswith("K") and not i.isdigit()]

print(f"\n=== ID Patterns in past_social ===")
print(f"K-prefixed IDs: {len(k_ids)}")
print(f"Numeric IDs: {len(numeric_ids)}")
print(f"Other IDs: {len(other_ids)}")
if k_ids:
    print(f"  Sample K IDs: {k_ids[:5]}")
