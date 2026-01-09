"""
Detailed inspection of the social_welfare.db questions table.
"""

import sqlite3

DB_PATH = (
    "c:/Users/user/.gemini/social-worker-exam/social-welfare-app/social_welfare.db"
)


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all distinct categories
    print("=== Categories ===")
    cursor.execute("SELECT DISTINCT category FROM questions")
    categories = cursor.fetchall()
    for cat in categories:
        cursor.execute("SELECT COUNT(*) FROM questions WHERE category = ?", (cat[0],))
        count = cursor.fetchone()[0]
        print(f"  {cat[0]}: {count}")

    # Get all distinct exam_year
    print("\n=== Exam Years ===")
    cursor.execute("SELECT DISTINCT exam_year FROM questions")
    years = cursor.fetchall()
    for year in years:
        cursor.execute("SELECT COUNT(*) FROM questions WHERE exam_year = ?", (year[0],))
        count = cursor.fetchone()[0]
        print(f"  {year[0]}: {count}")

    # Get sample questions for each exam year (first 2)
    print("\n=== Sample Questions by Exam Year ===")
    for year in years:
        if year[0]:  # Skip None
            cursor.execute(
                "SELECT id, question_text, category, exam_year, correct_answer FROM questions WHERE exam_year = ? LIMIT 2",
                (year[0],),
            )
            rows = cursor.fetchall()
            print(f"\n{year[0]}:")
            for row in rows:
                print(f"  ID: {row[0]}")
                print(f"  Category: {row[2]}")
                print(f"  Text: {row[1][:60]}...")
                print(f"  Answer: {row[4]}")
                print()

    # Check for past exam specific patterns
    print("\n=== Past Exam Pattern Detection ===")
    cursor.execute(
        "SELECT id, question_text, category, exam_year FROM questions WHERE category LIKE '%過去%' OR exam_year LIKE '%令和%' OR exam_year LIKE '%第%' LIMIT 10"
    )
    rows = cursor.fetchall()
    print(f"Found {len(rows)} questions with past exam patterns")
    for row in rows:
        print(f"  ID: {row[0]}, Cat: {row[2]}, Year: {row[3]}")
        print(f"  Text: {row[1][:60]}...")

    conn.close()


if __name__ == "__main__":
    main()
