import json
import os
import re
import sys

# Logic to generate flashcards from master_database.json
# Strategy:
# 1. Load questions.
# 2. Filter for questions where correct_answer is short (likely a keyword/term).
# 3. Use the Explanation as the "Question" (Front side), but MASK the term.
# 4. The Term is the Answer (Back side).

INPUT_FILE = "./master_database.json"
OUTPUT_FILE = "../app/assets/flashcards.json"
LOG_FILE = "debug_log.txt"


def log(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")
    print(msg)


def generate_flashcards():
    if not os.path.exists(INPUT_FILE):
        log(f"Error: {INPUT_FILE} not found.")
        return

    try:
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        log(f"JSON Load Error: {e}")
        return

    flashcards = []

    # Statistics
    total_processed = 0
    generated_count = 0

    log(f"Processing {len(data)} questions...")

    for item in data:
        total_processed += 1

        # 1. Get Candidate Term (Correct Answer)
        correct_answers = item.get("correct_answer", [])
        if not correct_answers:
            continue

        term = correct_answers[0].strip()

        # --- Strict Filter 1: Term Quality ---
        # Must be short (Max 15 chars)
        if len(term) > 15:
            continue

        # Must NOT contain punctuation implying a sentence
        if any(char in term for char in ["。", "、", "，", "．", "「", "」"]):
            continue

        # Must NOT end with sentence-like particles (implying "It is ...")
        # e.g. "〜すること", "〜である", "〜ない", "〜だ", "〜的"
        if term.endswith(("こと", "ある", "ない", "した", "から", "ため")):
            continue

        # Filter 2: Explanation must exist
        explanation = item.get("explanation")
        if not explanation or len(explanation) < 10:
            continue

        # --- Strict Filter 3: Explanation quality (One Sentence Rule) ---
        # Logic:
        # 1. Split explanation into sentences.
        # 2. Find a sentence that contains the term.
        # 3. Avoid sentences starting with "正解は" (The answer is...) as they are trivial.

        sentences = re.split(r"(?<=。)", explanation)
        target_sentence = None

        for s in sentences:
            s = s.strip()
            if not s:
                continue

            # If term is in this sentence
            if term in s:
                # Check 1: Is this just "The answer is Term"?
                if s.startswith("正解は") and len(s) < len(term) + 15:
                    continue

                # Check 2: Length limit for Tempo (Max 60-80 chars before cleanup)
                if len(s) > 80:
                    continue

                target_sentence = s
                # Preference: If it starts with "なぜなら" or explains definition, it's better.
                if s.startswith("なぜなら"):
                    break

        if not target_sentence:
            continue

        # Final cleanup of the definition sentence
        # Remove "正解は...です。" prefix if it got mixed in
        definition = target_sentence
        definition = re.sub(r"^正解は.*?(です|ます)[。]?", "", definition).strip()
        definition = re.sub(r"^なぜなら、?", "", definition).strip()

        # If term is gone after cleanup or def is empty
        if not definition or term not in definition:
            continue

        # Length check again after cleanup (Strict < 70)
        if len(definition) > 70 or len(definition) < 10:
            continue

        # Create Cloze
        escaped_term = re.escape(term)
        front_text = re.sub(escaped_term, "【　？　】", definition)

        card = {
            "id": f"card_{item['id']}",
            "term": term,
            "definition": front_text,
            "group_id": item.get("group", "common"),
            "category_label": item.get("category_label", "未分類"),
            "source_question_id": item["id"],
            "original_explanation": explanation,
        }

        flashcards.append(card)
        generated_count += 1

    log(f"Generated {generated_count} flashcards from {total_processed} questions.")

    # Save to file
    try:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(flashcards, f, ensure_ascii=False, indent=2)
        log(f"Saved to {OUTPUT_FILE}")
    except Exception as e:
        log(f"Save Error: {e}")


if __name__ == "__main__":
    try:
        # Clear log
        with open(LOG_FILE, "w") as f:
            f.write("")
        generate_flashcards()
    except Exception as e:
        log(f"Main Error: {e}")
