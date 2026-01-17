import os
import json
import re
import time
import random
from pypdf import PdfReader, PdfWriter
import google.generativeai as genai
from dotenv import load_dotenv

# --- CONFIGURATION ---
PDF_FOLDER = r"C:\Users\user\OneDrive\Desktop\共通"
OUTPUT_FILE = "app/assets/master_database_v3.json"
PROGRESS_FILE = "data_pipeline/gen_progress_common_v2.json"
GROUP_ID = "common_social"
TARGET_PER_CATEGORY = 200
PAGES_PER_CHUNK = 15  # A bit larger for better context

load_dotenv()
# API Keys Setup
API_KEYS = [os.getenv("GEMINI_API_KEY"), os.getenv("GEMINI_API_KEY_2")]
# Filter out None/Empty keys
API_KEYS = [k for k in API_KEYS if k]
current_key_index = 0


def configure_genai(index):
    if not API_KEYS:
        print("No API Keys found!")
        return False
    key = API_KEYS[index % len(API_KEYS)]
    genai.configure(api_key=key)
    print(f"--> Switched to API Key #{(index % len(API_KEYS)) + 1}")
    return True


# Initialize with the first key
configure_genai(0)
model = genai.GenerativeModel("gemini-2.0-flash-exp")


def generate_quiz_from_text(text):
    global current_key_index
    prompt = f"""
    You are an expert exam question generator for the Japanese Social Worker Exam (社会福祉士国家試験).
    Based on the provided text, generate 3-5 multiple-choice questions.

    Rules:
    1. Language: Japanese.
    2. Format: JSON array of objects.
    3. JSON Structure:
       [{{
         "question": "Question text here",
         "options": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
         "answer": "Correct Option Text (must match one of the options exactly)",
         "explanation": "Detailed explanation of why the answer is correct."
       }}]
    4. Options: Must have exactly 5 options.
    5. Content: Focus on key concepts, laws, history, and definitions found in the text.
    
    Text to generate from:
    {text[:8000]}
    """

    max_retries = len(API_KEYS) * 2  # Try cycling through keys twice
    attempts = 0

    while attempts < max_retries:
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            error_str = str(e)
            print(
                f"API Error (Attempt {attempts + 1}): {error_str.splitlines()[0] if error_str else 'Unknown'}"
            )

            # Check for quota/rate limit errors
            # 429: Too Many Requests
            # ResourceExhausted: Quota exceeded
            if (
                "429" in error_str
                or "ResourceExhausted" in error_str
                or "Quota" in error_str
            ):
                print("Rate limit reached. Switching API key...")
                current_key_index += 1
                if configure_genai(current_key_index):
                    time.sleep(2)  # Wait a bit before retry
                    attempts += 1
                    continue
                else:
                    break  # Key switch failed
            else:
                # Other errors (e.g. content safety), wait and retry or skip
                print("Non-quota error. Waiting 10s...")
                time.sleep(10)
                attempts += 1

    return None


def get_clean_name(filename):
    name = os.path.splitext(filename)[0]
    # Remove numbers at start
    name = re.sub(r"^\d+\s*", "", name)
    # Remove parentheses
    name = re.sub(r"[\(（].*?[\)）]", "", name)
    name = name.replace(" 表紙", "").strip()

    # Mapping for consistency with merged DB
    if "障害" in name and "福祉" in name:
        return "障害者福祉"
    if "心理" in name:
        return "心理学と心理的支援"
    if "社会学" in name:
        return "社会学と社会システム"
    if "原理" in name:
        return "社会福祉の原理と政策"
    if "調査" in name:
        return "社会福祉調査の基礎"
    if "地域" in name:
        return "地域福祉と包括的支援体制"
    if "刑事" in name:
        return "刑事司法と福祉"
    if "権利" in name:
        return "権利擁護を支える法制度"
    if "基盤" in name:
        return "ソーシャルワークの基盤と専門職"
    if "理論" in name:
        return "ソーシャルワークの理論と方法"
    if "演習" in name:
        return "ソーシャルワーク演習"

    return name


def natural_sort_key(s):
    return [
        int(text) if text.isdigit() else text.lower()
        for text in re.split("([0-9]+)", s)
    ]


def get_current_counts(db_data=None):
    if db_data is None:
        if not os.path.exists(OUTPUT_FILE):
            return {}
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = db_data

    counts = {}
    for item in data:
        if (
            item.get("group_id") == GROUP_ID
        ):  # Fix key name from group to group_id if needed, but schema says 'group'. Let's check schema.
            # Schema says 'group', python script might use 'group_id' or 'group'.
            # Looking at previous code, it used item.get("group") == GROUP_ID.
            # Wait, let's stick to the original key used in the script.
            pass

    # Re-reading the original code:
    # if item.get("group") == GROUP_ID:

    for item in data:
        # Check both 'group' and 'group_id' to be safe, or just stick to what was working.
        # The script defines question dict with 'group_id': GROUP_ID
        if item.get("group_id") == GROUP_ID or item.get("group") == GROUP_ID:
            label = item.get("category_label") or item.get("categoryLabel") or "未分類"
            counts[label] = counts.get(label, 0) + 1
    return counts


def split_pdf(file_path):
    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    chunks = []
    for i in range(0, total_pages, PAGES_PER_CHUNK):
        writer = PdfWriter()
        end = min(i + PAGES_PER_CHUNK, total_pages)
        for page_num in range(i, end):
            writer.add_page(reader.pages[page_num])
        chunk_filename = f"temp_v2_{i}.pdf"
        with open(chunk_filename, "wb") as f:
            writer.write(f)
        chunks.append(chunk_filename)
    return chunks


def generate_quiz(pdf_path, category_label, count_needed):
    sample_file = genai.upload_file(path=pdf_path)

    prompt = f"""
    教材「{category_label}」のPDF内容から、重要ポイントを5択クイズ形式で作成してください。
    今回はあと約{count_needed}問必要です。このPDFページから、重複せず、かつ質の高い問題を可能な限り（最大15問程度）作成してください。
    
    フォーマット:
    [
      {{
        "questionVal": "...",
        "optionsVal": ["...", "...", "...", "...", "..."],
        "correctVal": "...",
        "explanationVal": "..."
      }}
    ]
    """

    try:
        response = model.generate_content([prompt, sample_file])
        json_match = re.search(r"\[.*\]", response.text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return []
    finally:
        genai.delete_file(sample_file.name)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def main():
    print("Starting Smart Generator V2...")

    pdf_files = sorted(
        [f for f in os.listdir(PDF_FOLDER) if f.lower().endswith(".pdf")],
        key=natural_sort_key,
    )
    # user request: prioritize coverage over order. Shuffle to ensure we hit different categories.
    random.shuffle(pdf_files)

    # Load the database once at the beginning
    db = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            db = json.load(f)

    for i, filename in enumerate(pdf_files):
        current_counts = get_current_counts(
            db
        )  # Get counts from the current state of db
        label = get_clean_name(filename)
        current = current_counts.get(label, 0)

        print(f"[{i + 1}/{len(pdf_files)}] Checking {label}... (Current: {current})")

        if current >= TARGET_PER_CATEGORY:
            print(f"  -> Skipping {label} (Already has {current} questions)")
            continue

        needed = TARGET_PER_CATEGORY - current
        print(f"  -> Processing {filename} for {label}... Need {needed} more...")

        chunks = split_pdf(os.path.join(PDF_FOLDER, filename))

        for chunk_path in chunks:
            if current >= TARGET_PER_CATEGORY:
                break

            print(
                f"  Analysing chunk... (Target remaining: {TARGET_PER_CATEGORY - current})"
            )
            new_qs = generate_quiz(chunk_path, label, TARGET_PER_CATEGORY - current)

            max_id = max(
                [int(q.get("id", 0)) for q in db if str(q.get("id", "0")).isdigit()]
                + [0]
            )
            for q_data in new_qs:
                max_id += 1
                db.append(
                    {
                        "id": str(max_id),
                        "question_text": q_data.get("questionVal"),
                        "options": q_data.get("optionsVal"),
                        "correct_answer": q_data.get("correctVal"),
                        "explanation": q_data.get("explanationVal"),
                        "group": GROUP_ID,
                        "categoryLabel": label,
                        "category_label": label,
                    }
                )
                current += 1
                if current >= TARGET_PER_CATEGORY:
                    break

            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(db, f, ensure_ascii=False, indent=2)

            print(f"    Added {len(new_qs)} questions. Total for {label}: {current}")
            time.sleep(5)

    print("Smart Generation Complete!")


if __name__ == "__main__":
    main()
