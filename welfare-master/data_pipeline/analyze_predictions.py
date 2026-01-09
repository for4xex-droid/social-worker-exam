"""
Analyze AI Predicted Questions (Non-Past Exam Data).
Categories to check:
- common (共通科目)
- spec_social (社会専門AI予想)
- spec_mental (精神専門AI予想)
- spec_care (介護専門AI予想)

Output:
- Count per category
- ID ranges
- Sample questions (Text snippet)
- Quality check (Length of question, Number of options)
"""

import json
from collections import Counter

ASSET_FILE = "../app/assets/master_data.json"


def main():
    print(f"Loading {ASSET_FILE}...")
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Target groups
    target_groups = ["common", "spec_social", "spec_mental", "spec_care"]

    # Bucket data
    buckets = {g: [] for g in target_groups}
    unknown_groups = []

    for q in data:
        g = q.get("group", "unknown")
        if g in buckets:
            buckets[g].append(q)
        elif not g.startswith("past_"):
            unknown_groups.append(g)

    # Report
    print(f"\nTotal Questions in DB: {len(data)}")

    for group in target_groups:
        qs = buckets[group]
        print(f"\n=== {group} ({len(qs)} questions) ===")
        if not qs:
            continue

        # ID Analysis
        ids = [str(q.get("id")) for q in qs]
        numeric_ids = [int(i) for i in ids if i.isdigit()]
        non_numeric = [i for i in ids if not i.isdigit()]

        if numeric_ids:
            print(f"  Numeric ID Range: {min(numeric_ids)} - {max(numeric_ids)}")
        if non_numeric:
            print(f"  Non-numeric IDs: {len(non_numeric)} (Sample: {non_numeric[:3]})")

        # Quality Analysis
        avg_len = sum(len(q.get("question_text", "")) for q in qs) / len(qs)
        print(f"  Avg Text Length: {avg_len:.1f} chars")

        # Options check
        opt_counts = Counter(len(q.get("options", [])) for q in qs)
        print(f"  Options Count Dist: {dict(opt_counts)}")

        # Sample
        print("  Sample Question:")
        sample = qs[0]
        print(f"    ID: {sample.get('id')}")
        print(f"    Text: {sample.get('question_text', '')[:60]}...")
        if len(qs) > 10:
            middle = qs[10]
            print(f"    Mid Sample: {middle.get('question_text', '')[:60]}...")

    if unknown_groups:
        print(f"\nOther non-past groups found: {set(unknown_groups)}")


if __name__ == "__main__":
    main()
