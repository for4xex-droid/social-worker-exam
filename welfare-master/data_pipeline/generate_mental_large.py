import os
import glob
import json
import time
import shutil
import math
import traceback
import random
import re
from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Load env
load_dotenv()
load_dotenv("data_pipeline/.env")

# --- CONFIG ---
TARGET_DIR = r"C:\Users\user\OneDrive\Desktop\精神保健福祉士専門"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
OUTPUT_FILE = os.path.join(
    PROJECT_ROOT, "app", "public", "mental_special_generated.json"
)
PROGRESS_FILE = os.path.join(BASE_DIR, "mental_gen_progress.json")
TEMP_DIR = os.path.join(BASE_DIR, "mental_temp_pdf_chunks")

PAGES_PER_CHUNK = 5
QUESTIONS_PER_CHUNK = 15

GROUP_ID = "spec_mental"
ID_PREFIX = "nm"

# API Keys
API_KEYS = [
    "AIzaSyCryEPFUJe1K6Jh5hKNUYQdddxrVbXKaRQ",
    "AIzaSyAvNStGrrQEcxv3ODy_LVSVHIi56EoG2EE",
    "AIzaSyALdHdrjaJGXSRcxTNnxVLvXvxjeim-nso",
    "AIzaSyBTWYZ7OzVA9DrW4jI74CXffZER87X2C_c",
]
current_key_idx = 0


def get_api_key():
    global current_key_idx
    key = API_KEYS[current_key_idx]
    current_key_idx = (current_key_idx + 1) % len(API_KEYS)
    return key


def configure_genai():
    key = get_api_key()
    genai.configure(api_key=key)
    print(f"  [API Key Switch] ...{key[-4:]}")


# Initial config
configure_genai()


def get_model():
    candidates = [
        "gemini-2.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash",
    ]
    for c in candidates:
        return genai.GenerativeModel(c)


safety_settings = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}


# --- PROGRESS ---
def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_progress(progress_data):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress_data, f, indent=2)


# --- UTILS ---
def clean_response(text):
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```", "", text)
    text = text.strip()
    try:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            candidate = text[start : end + 1]
            return json.loads(candidate)
    except:
        pass
    try:
        text = re.sub(r"//.*", "", text)
        return json.loads(text)
    except:
        pass
    return []


def upload_to_gemini(path):
    print(f"    Submitting {os.path.basename(path)}...", end="", flush=True)
    for _ in range(3):
        try:
            file = genai.upload_file(path, mime_type="application/pdf")
            while file.state.name == "PROCESSING":
                time.sleep(2)
                file = genai.get_file(file.name)
            if file.state.name != "ACTIVE":
                print(f" (State: {file.state.name})", end="")
                continue
            print(" OK")
            return file
        except Exception as e:
            print(f".", end="")
            configure_genai()
            time.sleep(2)
    print(" Failed upload.")
    return None


def generate_questions_for_chunk(file_obj, chunk_name):
    model = get_model()
    prompt = f"""
    あなたは精神保健福祉士国家試験の作成委員です。
    提供された資料（約{PAGES_PER_CHUNK}ページ）から、試験レベルの「5肢択一問題」を【{QUESTIONS_PER_CHUNK}問】作成してください。
    【出力形式】
    以下のJSON形式のリストのみを出力してください。解説や前置きは不要です。
    [
      {{
        "questionVal": "問題文",
        "optionsVal": ["選択1", "選択2", "選択3", "選択4", "選択5"],
        "correctVal": ["正解"], 
        "explanationVal": "解説"
      }}
    ]
    """
    retry_count = 0
    max_retries = 5
    while retry_count < max_retries:
        try:
            response = model.generate_content(
                [prompt, file_obj],
                safety_settings=safety_settings,
                generation_config={"temperature": 1.0, "max_output_tokens": 8192},
            )
            data = clean_response(response.text)
            if data:
                return data
            print(
                f"    ! Empty/Invalid JSON for {chunk_name} (Attempt {retry_count + 1})"
            )
        except Exception as e:
            print(f"    ! Error for {chunk_name}: {e}")
        configure_genai()
        time.sleep(5)
        retry_count += 1
    print(f"    x Gave up on {chunk_name} after {max_retries} attempts. SKIPPING.")
    return []  # Return empty list to allow the loop to continue to the next chunk


def split_and_process(pdf_path, existing_data, progress_data):
    # Determine Relative Path (Unique Key) and Category Label
    try:
        rel_path = os.path.relpath(pdf_path, TARGET_DIR)
    except ValueError:
        rel_path = os.path.basename(pdf_path)

    file_key = rel_path

    parent_dir = os.path.basename(os.path.dirname(pdf_path))
    filename_only = os.path.basename(pdf_path)

    if parent_dir and parent_dir != os.path.basename(TARGET_DIR):
        category_label = parent_dir
    else:
        category_label = os.path.splitext(filename_only)[0]

    print(f"\nProcessing: {file_key} (Category: {category_label})")

    if progress_data.get(file_key, {}).get("status") == "DONE":
        print(f"Skipping {file_key} (Already DONE)")
        return []

    progress_data.setdefault(file_key, {"last_chunk_idx": -1, "status": "IN_PROGRESS"})

    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
    except Exception as e:
        print(f"  Error reading PDF: {e}")
        return []

    print(f"  Total Pages: {total_pages}")
    if total_pages < 2:
        return []

    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
    os.makedirs(TEMP_DIR, exist_ok=True)

    num_chunks = math.ceil(total_pages / PAGES_PER_CHUNK)

    # Use file_key (rel_path) for progress tracking, NOT just filename
    chunk_progress = progress_data[file_key]
    last_chunk_idx = chunk_progress.get("last_chunk_idx", -1)

    current_max_id = 40000
    # Determine max ID from existing
    for item in existing_data:
        try:
            # Basic int check, ignore ID like "mental_corrected_..."
            if str(item.get("id", "")).isdigit():
                val = int(item["id"])
                if val > current_max_id and val < 90000:  # Safe range
                    current_max_id = val
        except:
            pass

    for i in range(num_chunks):
        if i <= last_chunk_idx:
            continue

        start_page = i * PAGES_PER_CHUNK
        end_page = min((i + 1) * PAGES_PER_CHUNK, total_pages)

        print(f"  Chunk {i + 1}/{num_chunks} (p{start_page}-{end_page})...")

        chunk_name = f"chunk_{i + 1:03d}.pdf"
        chunk_path = os.path.join(TEMP_DIR, chunk_name)

        writer = PdfWriter()
        has_pages = False
        for p in range(start_page, end_page):
            try:
                writer.add_page(reader.pages[p])
                has_pages = True
            except:
                pass

        if not has_pages:
            continue

        with open(chunk_path, "wb") as f:
            writer.write(f)

        file_obj = upload_to_gemini(chunk_path)
        if file_obj:
            quizzes = generate_questions_for_chunk(file_obj, chunk_name)

            # Cleanup remote file
            try:
                genai.delete_file(file_obj.name)
            except:
                pass

            if quizzes:
                new_for_chunk = []
                for q in quizzes:
                    if not q.get("questionVal"):
                        continue

                    ops = q.get("optionsVal", [])
                    ans = q.get("correctVal", [])

                    if isinstance(ans, str):
                        ans = [ans]

                    # Normalize Option Index
                    fixed_ans = []
                    for a in ans:
                        # Try to match "選択1" format
                        match = re.search(r"選択(\d+)", str(a))
                        if match:
                            idx = int(match.group(1)) - 1
                            if 0 <= idx < len(ops):
                                fixed_ans.append(ops[idx])
                            else:
                                fixed_ans.append(a)
                        else:
                            # Try to match integer string "1"
                            if str(a).isdigit():
                                idx = int(a) - 1
                                if 0 <= idx < len(ops):
                                    fixed_ans.append(ops[idx])
                                else:
                                    fixed_ans.append(a)
                            else:
                                fixed_ans.append(a)

                    ans = fixed_ans

                    current_max_id += 1

                    new_item = {
                        "id": str(current_max_id),
                        "question_text": q.get("questionVal"),
                        "explanation": q.get("explanationVal", "解説なし"),
                        "options": ops,
                        "correct_answer": ans,
                        "group_id": GROUP_ID,
                        "group": GROUP_ID,  # Compat
                        "categoryLabel": category_label,  # Use derived label
                        # Old keys for safety
                        "category_label": category_label,
                        "year": None,
                        "is_free": False,
                        "is_mastered": False,
                    }
                    new_for_chunk.append(new_item)

                existing_data.extend(new_for_chunk)
                print(f" -> +{len(new_for_chunk)} Qs")

                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(existing_data, f, ensure_ascii=False, indent=2)

            # Update Progress
            chunk_progress["last_chunk_idx"] = i
            chunk_progress["status"] = "IN_PROGRESS"
            save_progress(progress_data)

            time.sleep(3)

    # Mark File Done
    chunk_progress["last_chunk_idx"] = num_chunks
    chunk_progress["status"] = "DONE"
    save_progress(progress_data)

    return []


def main():
    if not os.path.exists(TARGET_DIR):
        return
    progress = load_progress()
    full_data = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                full_data = json.load(f)
        except:
            pass
    elif os.path.exists("app/public/master_data.json"):
        try:
            with open("app/public/master_data.json", "r", encoding="utf-8") as f:
                full_data = json.load(f)
        except:
            pass
    pdfs = glob.glob(os.path.join(TARGET_DIR, "**/*.pdf"), recursive=True)
    print(f"Found {len(pdfs)} PDFs in {TARGET_DIR}")

    TARGET_FILTERS = [
        "現代の精神保健の課題と支援",
        "精神障害リハビリテーション",
        "精神保健福祉制度論",
    ]

    for pdf in pdfs:
        # Check if any filter matches path components
        is_target = False
        for f in TARGET_FILTERS:
            if f in pdf:
                is_target = True
                break

        if not is_target:
            continue

        print(f"Target Match: {pdf}")
        try:
            split_and_process(pdf, full_data, progress)
        except Exception as e:
            print(f"CRITICAL ERROR {pdf}: {e}")
            traceback.print_exc()


if __name__ == "__main__":
    main()
