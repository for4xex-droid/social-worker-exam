import json


def debug_r5():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    r5 = [
        q
        for q in db
        if q.get("year") == "令和5年度" and q.get("group") == "past_social"
    ]
    print(f"R5 Social count: {len(r5)}")

    for i in range(145, 155):
        if i < len(r5):
            q = r5[i]
            print(f"[{i}] ID {q.get('id')}: {q.get('question_text', '')[:50]}")


if __name__ == "__main__":
    debug_r5()
