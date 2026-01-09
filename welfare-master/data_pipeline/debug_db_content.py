import sqlite3
import os

db_path = os.path.join("..", "app", "sqlite.db")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("--- Group x Year Analysis ---")
    cursor.execute(
        "SELECT group_id, year, count(*) FROM questions GROUP BY group_id, year"
    )
    rows = cursor.fetchall()
    for row in rows:
        print(f"Group: {row[0]}, Year: {row[1]}, Count: {row[2]}")

    conn.close()

except Exception as e:
    print(f"Error: {e}")
