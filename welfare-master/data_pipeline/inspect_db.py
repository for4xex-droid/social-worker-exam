"""
Inspect the social_welfare.db SQLite database structure and content.
"""

import sqlite3
import json

DB_PATH = (
    "c:/Users/user/.gemini/social-worker-exam/social-welfare-app/social_welfare.db"
)


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in database:")
    for table in tables:
        print(f"  - {table[0]}")

    # For each table, get structure and count
    for table in tables:
        table_name = table[0]
        print(f"\n=== {table_name} ===")

        # Get columns
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        print("Columns:")
        for col in columns:
            print(f"  {col[1]} ({col[2]})")

        # Get count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"Row count: {count}")

        # Get sample data
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
        rows = cursor.fetchall()
        if rows:
            print("Sample rows:")
            for row in rows:
                print(f"  {row}")

    # Check for past exam questions specifically
    print("\n\n=== Past Exam Data Analysis ===")

    # Look for questions with 'past' in group or similar
    try:
        cursor.execute("SELECT DISTINCT group_id FROM questions")
        groups = cursor.fetchall()
        print("Distinct groups:")
        for g in groups:
            cursor.execute(
                f"SELECT COUNT(*) FROM questions WHERE group_id = ?", (g[0],)
            )
            count = cursor.fetchone()[0]
            print(f"  {g[0]}: {count} questions")
    except Exception as e:
        print(f"Error: {e}")

    # Check for year distribution in past_social
    try:
        cursor.execute(
            "SELECT DISTINCT year FROM questions WHERE group_id = 'past_social'"
        )
        years = cursor.fetchall()
        print("\nYears in past_social:")
        for y in years:
            cursor.execute(
                f"SELECT COUNT(*) FROM questions WHERE group_id = 'past_social' AND year = ?",
                (y[0],),
            )
            count = cursor.fetchone()[0]
            print(f"  {y[0]}: {count} questions")
    except Exception as e:
        print(f"Error: {e}")

    # Get sample past_social question
    try:
        cursor.execute(
            "SELECT id, question_text, year FROM questions WHERE group_id = 'past_social' LIMIT 5"
        )
        rows = cursor.fetchall()
        print("\nSample past_social questions:")
        for row in rows:
            print(f"  ID: {row[0]}")
            print(f"  Year: {row[2]}")
            print(f"  Text: {row[1][:80]}...")
            print()
    except Exception as e:
        print(f"Error: {e}")

    conn.close()


if __name__ == "__main__":
    main()
