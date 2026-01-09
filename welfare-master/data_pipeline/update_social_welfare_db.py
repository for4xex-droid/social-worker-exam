"""
Update past exam questions in social_welfare.db with official SSSC data.
This script:
1. Deletes old past exam questions for the years we have official data for
2. Inserts new official questions from SSSC
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

    # Group by year
    by_year = {}
    for q in official_data:
        year = q.get("year", "")
        if year not in by_year:
            by_year[year] = []
        by_year[year].append(q)

    print("Official data by year:")
    for year, questions in by_year.items():
        print(f"  {year}: {len(questions)}")

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get current max ID
    cursor.execute("SELECT MAX(id) FROM questions")
    max_id = cursor.fetchone()[0] or 0
    print(f"\nCurrent max ID in database: {max_id}")

    # Check current state
    print("\nCurrent past exam data in database:")
    for year in by_year.keys():
        cursor.execute("SELECT COUNT(*) FROM questions WHERE exam_year = ?", (year,))
        count = cursor.fetchone()[0]
        print(f"  {year}: {count} questions")

    # Delete old questions for years we have official data for
    years_to_update = list(by_year.keys())
    print(f"\nDeleting old questions for years: {years_to_update}")

    for year in years_to_update:
        cursor.execute("DELETE FROM questions WHERE exam_year = ?", (year,))
        print(f"  Deleted questions for {year}")

    conn.commit()

    # Prepare new questions for insertion
    print("\nInserting new official questions...")

    new_id = max_id + 1
    for q in official_data:
        # Convert options to JSON string
        options_json = json.dumps(q.get("options", []), ensure_ascii=False)
        # Convert correct_answer to JSON string
        correct_answer_json = json.dumps(
            q.get("correct_answer", []), ensure_ascii=False
        )

        # Determine category based on category_label
        category = "社会福祉士"  # All SSSC data is for social worker

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
                category,
                q.get("year", ""),
            ),
        )
        new_id += 1

    conn.commit()

    # Verify
    print("\nVerification - new data in database:")
    for year in years_to_update:
        cursor.execute("SELECT COUNT(*) FROM questions WHERE exam_year = ?", (year,))
        count = cursor.fetchone()[0]
        print(f"  {year}: {count} questions")

    # Show sample of new questions
    print("\nSample of new questions:")
    cursor.execute(
        "SELECT id, question_text, exam_year, correct_answer FROM questions WHERE source_file = 'sssc_official' LIMIT 3"
    )
    rows = cursor.fetchall()
    for row in rows:
        print(f"  ID: {row[0]}, Year: {row[2]}")
        print(f"  Text: {row[1][:60]}...")
        print(f"  Answer: {row[3]}")
        print()

    cursor.execute("SELECT COUNT(*) FROM questions")
    total = cursor.fetchone()[0]
    print(f"\nTotal questions in database: {total}")

    conn.close()
    print("\nDatabase updated successfully!")


if __name__ == "__main__":
    main()
