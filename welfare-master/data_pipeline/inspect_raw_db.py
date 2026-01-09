import sqlite3
import os

db_path = "social_welfare.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    print("Tables:", cursor.fetchall())

    # Check a sample question to see columns and if ID matches 1382
    cursor.execute("SELECT * FROM questions WHERE id=1382")
    row = cursor.fetchone()
    if row:
        print("\nRow 1382:", row)
        # Get column names
        names = [description[0] for description in cursor.description]
        print("Columns:", names)
    else:
        print("\nRow 1382 not found.")

    conn.close()

except Exception as e:
    print(f"Error: {e}")
