import json


def check_overlap():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    r5_social = [
        q
        for q in db
        if q.get("year") == "令和5年度" and q.get("group") == "past_social"
    ]
    r5_mental = [
        q
        for q in db
        if q.get("year") == "令和5年度" and q.get("group") == "past_mental"
    ]

    social_texts = {q.get("question_text"): q.get("id") for q in r5_social}
    mental_texts = {q.get("question_text"): q.get("id") for q in r5_mental}

    overlap = set(social_texts.keys()) & set(mental_texts.keys())

    print(f"R5 Social count: {len(r5_social)}")
    print(f"R5 Mental count: {len(r5_mental)}")
    print(f"Overlap count: {len(overlap)}")

    # Also check for internal duplicates in social
    from collections import Counter

    text_counts = Counter([q.get("question_text") for q in r5_social])
    internal_dups = [t for t, c in text_counts.items() if c > 1]
    print(f"Internal Social Duplicates: {len(internal_dups)}")


if __name__ == "__main__":
    check_overlap()
