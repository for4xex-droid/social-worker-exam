import json
import re
import os


def clean_text(text):
    if not isinstance(text, str):
        return text

    # Remove (cid:xxxxx) patterns
    text = re.sub(r"\(cid:\d+\)", "", text)

    # Remove standalone numbers at the end of the text (likely page numbers)
    # Matches: Space/Tab/FullWidthSpace + digits + optional whitespace at end of string
    # Try to match "text 48" or "text　48"
    text = re.sub(r"[\s　]+[0-9]+[\s　]*$", "", text)

    # Remove specific noise reported
    text = text.replace("(cid12719)", "")
    text = text.replace("(cid:12719)", "")

    return text.strip()


def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    print(f"Cleaning {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    cleaned_count = 0
    for item in data:
        original_q = item.get("question_text") or item.get("questionText") or ""
        cleaned_q = clean_text(original_q)

        if original_q != cleaned_q:
            if "question_text" in item:
                item["question_text"] = cleaned_q
            if "questionText" in item:
                item["questionText"] = cleaned_q
            cleaned_count += 1

        # Clean options
        if "options" in item:
            opts = item["options"]
            if isinstance(opts, list):
                new_opts = []
                opt_changed = False
                for opt in opts:
                    c_opt = clean_text(opt)
                    new_opts.append(c_opt)
                    if c_opt != opt:
                        opt_changed = True
                if opt_changed:
                    item["options"] = new_opts
                    cleaned_count += 1

    # Save back
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Cleaned {cleaned_count} questions in {filepath}")


# Target files
files_to_clean = [
    "c:\\Users\\user\\.gemini\\social-worker-exam\\welfare-master\\data_pipeline\\master_database_v2_final.json",
    "c:\\Users\\user\\.gemini\\social-worker-exam\\welfare-master\\app\\assets\\separated_db\\master_social.json",
    "c:\\Users\\user\\.gemini\\social-worker-exam\\welfare-master\\app\\public\\web_past_social.json",
]

for f in files_to_clean:
    process_file(f)
