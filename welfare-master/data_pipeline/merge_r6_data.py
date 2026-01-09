import json
import re

SOCIAL_R6_FILE = "social_r6.json"
ANSWER_KEY_FILE = "answer_key_r6.json"
MASTER_DB_FILE = "master_database.json"


def main():
    print("Loading data...")
    try:
        with open(SOCIAL_R6_FILE, "r", encoding="utf-8") as f:
            scraped_data = json.load(f)

        with open(ANSWER_KEY_FILE, "r", encoding="utf-8") as f:
            answer_key = json.load(f)

        with open(MASTER_DB_FILE, "r", encoding="utf-8") as f:
            master_db = json.load(f)

    except Exception as e:
        print(f"Error loading files: {e}")
        return

    # 1. Deduplicate
    master_db = [
        q
        for q in master_db
        if not (q.get("group") == "past_social" and q.get("year") == "令和6年度")
    ]

    max_id = 0
    for q in master_db:
        try:
            qid = int(q["id"])
            if qid > max_id:
                max_id = qid
        except:
            pass

    print(f"Base Max ID: {max_id}. Adding R6 items starting from {max_id + 1}")

    # 2. Process Scraped Items
    new_items = []
    count_new_id = max_id + 1

    for i, item in enumerate(scraped_data):
        q_num = str(i + 1)

        # Process Answer
        mapped_answer = []
        if q_num in answer_key:
            ans_str = str(answer_key[q_num])
            if "," in ans_str:
                mapped_answer = [p.strip() for p in ans_str.split(",")]
            else:
                mapped_answer = [ans_str.strip()]

        # Use snake_case to match existing master_database.json format
        new_record = {
            "id": str(count_new_id),
            "question_text": item.get("questionText", ""),
            "options": item["options"],
            "correct_answer": mapped_answer,
            "explanation": item.get("explanation", ""),
            "group": "past_social",
            "year": "令和6年度",
            "category_label": "社会福祉士",
        }

        new_items.append(new_record)
        count_new_id += 1

    # 3. Append and Save
    print(f"Adding {len(new_items)} new R6 questions to database.")
    master_db.extend(new_items)

    with open(MASTER_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(master_db, f, ensure_ascii=False, indent=2)

    print("Database updated successfully.")


if __name__ == "__main__":
    main()
