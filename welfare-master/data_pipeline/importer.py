import json
import sqlite3
import os
import sys

# Get the absolute path to the data_pipeline directory
current_dir = os.path.dirname(os.path.abspath(__file__))
# Navigate up to the app directory to find the SQLite DB
db_path = os.path.join(current_dir, "..", "app", "sqlite.db")
json_path = os.path.join(current_dir, "master_database.json")

print(f"Target Database: {db_path}")
print(f"Source JSON: {json_path}")


def import_data():
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    # Check if DB needs to be initialized (handled by app, but good to check existence)
    # The app creates 'sqlite.db' in the project root or app folder depending on Expo config
    # We will assume standard Expo SQLite location logic or force a location.
    # For standalone script, we need to connect to the exact file.

    # NOTE: Expo SQLite on development often uses a separate folder or memory.
    # To reliably pre-seed data, we should ideally bundle the DB file or use this script
    # to generate a SQL seed file.
    # However, for local dev with 'expo-sqlite' on file system, we can try to write directly.
    # BETTER APPROACH: Generate a seed.sql file that can be executed or create a JSON import function in the APP.

    # Since we want to use this data IN THE APP, and we have `initializeDb` in `client.ts`,
    # the best way to get BULK data in is often to just REPLACE the seed file or
    # have the app fetch this JSON.

    # STRATEGY: We will update the `assets/master_data.json` in the APP folder,
    # and then the App's `initializeDb` function should load it on startup if DB is empty.

    app_data_path = os.path.join(current_dir, "..", "app", "assets", "master_data.json")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        print(f"Loaded {len(data)} questions from refinery.")

        # Transform data if necessary to match the App's expected format
        # The app expects:
        # { id, type, questionText, explanation, options (json string), correctAnswers (json string), ... }

        normalized_data = []
        for item in data:
            # Map refinery format to DB Schema format
            # Refinery: { "question_text", "options", "correct_answer" (list), "explanation", ... }
            # App Schema: { questionText, options (JSON-string), correctAnswer (JSON-string), ... }

            # Ensure correct_answer is list of strings
            c_ans = item.get("correct_answer", [])
            if isinstance(c_ans, str):
                c_ans = [c_ans]

            normalized_item = {
                "id": str(item.get("id")),
                "type": "multiple_choice",
                "group": item.get("group", "common"),
                "questionText": item.get("question_text"),
                "questionImage": item.get("question_image", None),
                "explanation": item.get("explanation"),
                "explanationImage": item.get("explanation_image", None),
                "options": item.get(
                    "options", []
                ),  # Keep as object, let app stringify or we stringify here?
                # App's `useBookshelf` usually expects parsed JSON, but DB stores string.
                # For a JSON asset, we play safe and keep as objects.
                "correctAnswer": c_ans,
                "isFree": item.get("is_free", False),
                "year": item.get("year", None),
                "categoryLabel": item.get("category_label", "General"),
            }
            normalized_data.append(normalized_item)

        print(f"Normalized {len(normalized_data)} items.")

        # Ensure assets dir exists
        os.makedirs(os.path.dirname(app_data_path), exist_ok=True)

        with open(app_data_path, "w", encoding="utf-8") as f:
            json.dump(normalized_data, f, ensure_ascii=False, indent=2)

        print(f"Successfully exported to App Asset: {app_data_path}")
        print(
            "Now, restart the app. The 'initializeDb' function should detect this file and populate the SQLite database."
        )

    except Exception as e:
        print(f"Error during import: {e}")


if __name__ == "__main__":
    import_data()
