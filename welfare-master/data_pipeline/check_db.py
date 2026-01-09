import sqlite3
import os

# Path to the database
db_path = os.path.join("..", "app", "sqlite.db")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("--- Year Distribution ---")
    cursor.execute("SELECT year, COUNT(*) FROM questions GROUP BY year")
    rows = cursor.fetchall()
    for row in rows:
        print(f"Year: {row[0]}, Count: {row[1]}")

    print("\n--- Group Distribution for Null Year ---")
    cursor.execute(
        "SELECT group_id, COUNT(*) FROM questions WHERE year IS NULL OR year = '' GROUP BY group_id"
    )
    rows = cursor.fetchall()
    for row in rows:
        print(f"Group: {row[0]}, Count: {row[1]}")

    conn.close()

except Exception as e:
    print(f"Error: {e}")
