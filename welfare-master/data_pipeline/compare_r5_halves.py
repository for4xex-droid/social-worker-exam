import json


def compare_r5_halves():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    r5 = [
        q
        for q in db
        if q.get("year") == "令和5年度" and q.get("group") == "past_social"
    ]
    if len(r5) != 300:
        print(f"Count is {len(r5)}, not 300.")
        return

    first_half = r5[:150]
    second_half = r5[150:]

    from difflib import SequenceMatcher

    print("Comparing first items...")
    print(f"1st: {first_half[0]['question_text'][:50]}")
    print(f"2nd: {second_half[0]['question_text'][:50]}")

    overlap = 0
    for q1 in first_half:
        for q2 in second_half:
            if q1["question_text"] == q2["question_text"]:
                overlap += 1
                break

    print(f"Overlap between halves: {overlap}")


if __name__ == "__main__":
    compare_r5_halves()
