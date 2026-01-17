import os
import glob
import json
import time
import random
import concurrent.futures
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Load Environment
load_dotenv()

# Config
TARGET_DIR = r"C:\Users\user\OneDrive\Desktop\精神保健福祉士専門"
OUTPUT_FILE = "app/public/master_data.json"
GROUP_ID = "spec_mental"
START_ID = 40000

# Params
TARGET_QUESTIONS_PER_PDF = 210  # 30問 * 7回
QUESTIONS_PER_BATCH = 30
BATCHES_PER_PDF = 7

# API Keys Rotation
API_KEYS = [
    "AIzaSyCryEPFUJe1K6Jh5hKNUYQdddxrVbXKaRQ",
    "AIzaSyAvNStGrrQEcxv3ODy_LVSVHIi56EoG2EE",
    "AIzaSyALdHdrjaJGXSRcxTNnxVLvXvxjeim-nso",
]

current_key_index = 0


def get_next_key():
    global current_key_index
    key = API_KEYS[current_key_index]
    current_key_index = (current_key_index + 1) % len(API_KEYS)
    return key


# Model Config
# gemini-2.5-flash as requested by user
MODEL_NAME = "gemini-2.5-flash"

generation_config = {
    "temperature": 1.0,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    # "response_mime_type": "application/json", # Disable for 2.5-flash to avoid 400 error
}

safety_settings = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}


def configure_genai():
    key = get_next_key()
    genai.configure(api_key=key)
    print(f"  Switched to API Key ending in ...{key[-4:]}")


def upload_to_gemini(path, mime_type="application/pdf"):
    """Uploads with retry and key rotation."""
    retries = 3
    for attempt in range(retries):
        try:
            configure_genai()
            file = genai.upload_file(path, mime_type=mime_type)
            print(f"  Uploaded '{file.display_name}' ({file.uri})")
            return file
        except Exception as e:
            print(f"  Upload failed (Attempt {attempt + 1}/{retries}): {e}")
            time.sleep(5)
    return None


def wait_for_files_active(files):
    """Waits for processing."""
    print("  Waiting for file processing...", end="")
    for name in (file.name for file in files):
        file = genai.get_file(name)
        while file.state.name == "PROCESSING":
            print(".", end="", flush=True)
            time.sleep(5)
            file = genai.get_file(name)
        if file.state.name != "ACTIVE":
            raise Exception(f"File {file.name} failed to process: {file.state.name}")
    print("Ready")


def generate_batch(model, file_list, batch_index):
    """Generates a batch of questions."""

    parts = [
        "第1章〜第2章（総論、基礎概念、歴史）",
        "第3章〜第4章（制度の仕組み、法体系）",
        "第5章〜第6章（支援技術、アセスメント）",
        "第7章〜第8章（介入計画、モニタリング）",
        "第9章〜第10章（多職種連携、地域資源）",
        "第11章〜（権利擁護、倫理、最新動向）",
        "全体的な事例問題と応用",
    ]
    focus = parts[batch_index % len(parts)]

    prompt = f"""
    あなたは精神保健福祉士国家試験の問題作成委員会です。
    提供されたPDF（専門科目テキスト）の【{focus}】に該当する部分、または関連する内容から、
    国家試験レベルの「5肢択一問題」を{QUESTIONS_PER_BATCH}問作成してください。

    【重要事項】
    - 前のバッチと同じ問題を作成しないでください。
    - ページ範囲を指定できる場合は、資料の{batch_index + 1}/{BATCHES_PER_PDF}番目の部分を参照してください。
    - 具体的な症例、法律名、支援技法名を用いてください。
    - 出力は必ず以下のJSON形式（配列）のみにしてください。Markdownのコードブロック（```json）で囲んでください。

    Output JSON Format (Array of Objects):
    [
      {{
        "questionVal": "...",
        "optionsVal": ["...", "...", "...", "...", "..."],
        "correctVal": ["..."],
        "explanationVal": "..."
      }}
    ]
    """

    for attempt in range(3):
        try:
            response = model.generate_content(
                [prompt] + file_list,
                generation_config=generation_config,
                safety_settings=safety_settings,
            )
            # Clean Markdown
            text = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(text)
        except Exception as e:
            print(f"  Batch {batch_index + 1} failed (Attempt {attempt + 1}): {e}")
            # Rotate key and retry
            configure_genai()
            time.sleep(2)
    return []


def process_pdf(pdf_path, existing_data_count):
    filename = os.path.basename(pdf_path)
    clean_name = filename.replace(".pdf", "")
    print(f"Processing {clean_name}...")

    file_obj = upload_to_gemini(pdf_path)
    if not file_obj:
        print("  Skipping: Upload failed.")
        return []

    try:
        wait_for_files_active([file_obj])

        # Instantiate model with current config
        model = genai.GenerativeModel(model_name=MODEL_NAME)

        all_batch_questions = []

        print(
            f"  Target: {TARGET_QUESTIONS_PER_PDF} questions ({BATCHES_PER_PDF} batches x {QUESTIONS_PER_BATCH})"
        )

        for i in range(BATCHES_PER_PDF):
            print(f"    Batch {i + 1}/{BATCHES_PER_PDF} generating...")

            questions = generate_batch(model, [file_obj], i)

            valid_count = 0
            if questions:
                for q in questions:
                    if "questionVal" in q and "optionsVal" in q:
                        all_batch_questions.append(
                            {
                                "questionText": q["questionVal"],
                                "options": q["optionsVal"],
                                "correctAnswer": q["correctVal"],
                                "explanation": q.get("explanationVal", "解説なし"),
                                "categoryLabel": clean_name,
                            }
                        )
                        valid_count += 1

            print(f"      + Got {valid_count} valid questions.")
            time.sleep(3)  # Nice waiting

        # Clean delete
        try:
            genai.delete_file(file_obj.name)
        except:
            pass

        return all_batch_questions

    except Exception as e:
        print(f"  Processing failed: {e}")
        return []


def main():
    if not os.path.exists(TARGET_DIR):
        print(f"Directory not found: {TARGET_DIR}")
        return

    # Initialize Master Data
    master_data = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                master_data = json.load(f)
        except:
            print("  Warning: Could not load existing master_data.json")

    # ID Calculation
    max_id = 40000
    for q in master_data:
        try:
            if isinstance(q.get("id"), str) and q["id"].isdigit():
                if int(q["id"]) > max_id:
                    max_id = int(q["id"])
        except:
            pass

    current_id = max_id + 1
    print(f"Start ID: {current_id}")

    # File List
    pdfs = glob.glob(os.path.join(TARGET_DIR, "**/*.pdf"), recursive=True)
    print(f"Found {len(pdfs)} PDFs.")

    total_new = 0

    for pdf in pdfs:
        new_q_list = process_pdf(pdf, total_new)

        if new_q_list:
            for q in new_q_list:
                item = {
                    "id": str(current_id),
                    "question_text": q["questionText"],
                    "options": q["options"],
                    "correct_answer": q["correctAnswer"],
                    "explanation": q["explanation"],
                    "group_id": GROUP_ID,
                    "category_label": q["categoryLabel"],
                    "year": None,
                    "is_free": False,
                    "is_mastered": False,
                }
                master_data.append(item)
                current_id += 1

            total_new += len(new_q_list)

            # Incremental Save
            print(f"  Saving {total_new} total new questions...")
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(master_data, f, ensure_ascii=False, indent=2)

    print("Completed.")


if __name__ == "__main__":
    main()
