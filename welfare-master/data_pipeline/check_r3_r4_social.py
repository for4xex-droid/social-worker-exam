import json


def check_r3_r4():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    r4 = [
        q
        for q in db
        if q.get("year") == "令和4年度" and q.get("group") == "past_social"
    ]
    r3 = [
        q
        for q in db
        if q.get("year") == "令和3年度" and q.get("group") == "past_social"
    ]

    if r4:
        print(f"R4 Count: {len(r4)}")
        print(f"R4 Q1: {r4[0].get('question_text', '')[:50]}")
    else:
        print("No R4")

    if r3:
        print(f"R3 Count: {len(r3)}")
        print(f"R3 Q1: {r3[0].get('question_text', '')[:50]}")
    else:
        print("No R3")


if __name__ == "__main__":
    check_r3_r4()
