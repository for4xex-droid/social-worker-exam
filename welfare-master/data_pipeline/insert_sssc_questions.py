"""
Insert official SSSC questions into social_welfare.db.
The previous script deleted old questions but failed to insert new ones.
This script adds the new official questions.
"""

import sqlite3
import json

DB_PATH = (
    "c:/Users/user/.gemini/social-worker-exam/social-welfare-app/social_welfare.db"
)
OFFICIAL_DATA = "c:/Users/user/.gemini/social-worker-exam/welfare-master/data_pipeline/sssc_official_questions.json"


def main():
    # Load official SSSC data
    print("Loading official SSSC data...")
    with open(OFFICIAL_DATA, "r", encoding="utf-8") as f:
        official_data = json.load(f)

    print(f"Loaded {len(official_data)} official questions")

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get current max ID
    cursor.execute("SELECT MAX(id) FROM questions")
    max_id = cursor.fetchone()[0] or 0
    print(f"Current max ID in database: {max_id}")

    # Current state
    cursor.execute("SELECT COUNT(*) FROM questions")
    current_count = cursor.fetchone()[0]
    print(f"Current question count: {current_count}")

    # Insert new questions
    print("\nInserting new official questions...")

    new_id = max_id + 1
    inserted = 0
    errors = 0

    for q in official_data:
        try:
            # Convert options to JSON string
            options_json = json.dumps(q.get("options", []), ensure_ascii=False)
            # Convert correct_answer to JSON string
            correct_answer_json = json.dumps(
                q.get("correct_answer", []), ensure_ascii=False
            )

            cursor.execute(
                """
                INSERT INTO questions (
                    id, question_text, options, correct_answer, explanation,
                    source_file, status, next_review_at, correct_streak,
                    last_reviewed_at, category, exam_year
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    new_id,
                    q.get("question_text", ""),
                    options_json,
                    correct_answer_json,
                    "",  # explanation
                    "sssc_official",  # source_file
                    "new",  # status
                    None,  # next_review_at
                    0,  # correct_streak
                    None,  # last_reviewed_at
                    "社会福祉士",  # category
                    q.get("year", ""),
                ),
            )
            inserted += 1
            new_id += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"Error inserting question: {e}")
                print(f"  Question: {q.get('question_text', '')[:50]}...")

    conn.commit()

    print(f"\nInserted: {inserted} questions")
    print(f"Errors: {errors}")

    # Verify
    cursor.execute("SELECT COUNT(*) FROM questions")
    new_count = cursor.fetchone()[0]
    print(f"\nNew total question count: {new_count}")

    # Show breakdown by year
    print("\nQuestions by exam_year:")
    cursor.execute("SELECT DISTINCT exam_year FROM questions")
    years = cursor.fetchall()
    for year in years:
        cursor.execute("SELECT COUNT(*) FROM questions WHERE exam_year = ?", (year[0],))
        count = cursor.fetchone()[0]
        print(f"  {year[0]}: {count}")

    # Show sample
    print("\nSample of new SSSC questions:")
    cursor.execute(
        "SELECT id, question_text, exam_year, correct_answer FROM questions WHERE source_file = 'sssc_official' LIMIT 3"
    )
    rows = cursor.fetchall()
    for row in rows:
        print(f"  ID: {row[0]}, Year: {row[2]}")
        print(f"  Text: {row[1][:60]}...")
        print(f"  Answer: {row[3]}")

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
