"""
Apply answer keys to questions in master_database.json.
This script reads answer key JSON files and updates the correct_answer field
for matching questions.
"""

import json
import re

MASTER_FILE = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/master_database.json"

# Answer key files - mapping (group, year) to answer key file and exam info
ANSWER_KEYS = {
    ("past_social", "令和6年度"): {
        "file": "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/answer_key_r6.json",
        "exam_number": 37,  # 第37回
    },
    ("past_social", "令和5年度"): {
        "file": "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/answer_key_social_r5.json",
        "exam_number": 36,  # 第36回
    },
    ("past_social", "令和4年度"): {
        "file": "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/answer_key_social_r4.json",
        "exam_number": 35,  # 第35回
    },
    ("past_social", "令和3年度"): {
        "file": "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/answer_key_social_r3.json",
        "exam_number": 34,  # 第34回
    },
    ("past_mental", "令和6年度"): {
        "file": "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/answer_key_mental_r6.json",
        "exam_number": 27,  # 第27回
    },
    # Add more answer keys here as they become available
}


def parse_answer(answer_str):
    """Convert answer string like '1,2' to list ['1', '2']."""
    if not answer_str:
        return []
    return [a.strip() for a in str(answer_str).replace(" ", "").split(",")]


def main():
    print("Loading master database...")
    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        master_data = json.load(f)

    print(f"Loaded {len(master_data)} questions")

    updates_made = 0

    for (group, year), key_info in ANSWER_KEYS.items():
        print(f"\nProcessing answer key for {group} {year}...")

        try:
            with open(key_info["file"], "r", encoding="utf-8") as f:
                answer_key = json.load(f)
            print(f"  Loaded {len(answer_key)} answers")
        except FileNotFoundError:
            print(f"  Answer key file not found: {key_info['file']}")
            continue

        # Find matching questions and update
        for q in master_data:
            if q.get("group") == group and q.get("year") == year:
                # Get question number
                q_num = q.get("question_number")
                if not q_num:
                    # Try to extract from id or other fields
                    q_id = str(q.get("id", ""))
                    match = re.search(r"(\d+)$", q_id)
                    if match:
                        q_num = int(match.group(1))

                if q_num:
                    q_num_str = str(q_num)
                    if q_num_str in answer_key:
                        answer = parse_answer(answer_key[q_num_str])
                        if q.get("correct_answer") != answer:
                            q["correct_answer"] = answer
                            updates_made += 1

    print(f"\nTotal updates made: {updates_made}")

    if updates_made > 0:
        print("Saving updated master database...")
        with open(MASTER_FILE, "w", encoding="utf-8") as f:
            json.dump(master_data, f, ensure_ascii=False, indent=2)
        print("Saved.")

    # Summary of correct_answer status
    has_answer = 0
    no_answer = 0
    for q in master_data:
        if q.get("correct_answer") and len(q["correct_answer"]) > 0:
            has_answer += 1
        else:
            no_answer += 1

    print(f"\nQuestions with answers: {has_answer}")
    print(f"Questions without answers: {no_answer}")


if __name__ == "__main__":
    main()
