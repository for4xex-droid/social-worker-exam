import os
import glob
import json
import time
import shutil
import math
import traceback
from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter
import google.generativeai as genai

# Load env from subdirectory explicitly
load_dotenv()
load_dotenv("data_pipeline/.env")

# --- CONFIG ---
TARGET_DIR = r"C:\Users\user\OneDrive\Desktop\社会福祉士専門"
OUTPUT_FILE = "app/assets/master_database_v3.json"
PROGRESS_FILE = "data_pipeline/gen_progress.json"
TEMP_DIR = "temp_pdf_chunks"

PAGES_PER_CHUNK = 10
QUESTIONS_PER_CHUNK = 8

# --- API KEYS ---
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_KEY:
    print("Error: GEMINI_API_KEY required.")
    exit(1)

genai.configure(api_key=GEMINI_KEY)


# --- PROGRESS TRACKING ---
def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_progress(progress_data):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress_data, f, indent=2)


# --- MODEL ---
def get_model():
    # Attempt to pick best available model
    try:
        models = list(genai.list_models())
        names = [
            m.name
            for m in models
            if "generateContent" in m.supported_generation_methods
        ]

        candidates = [
            "models/gemini-2.0-flash-exp",
            "models/gemini-1.5-flash-latest",
            "models/gemini-1.5-flash",
            "models/gemini-1.5-pro",
        ]

        for c in candidates:
            if c in names:
                return genai.GenerativeModel(c)

        # Fallback
        return genai.GenerativeModel("models/gemini-1.5-flash")
    except:
        return genai.GenerativeModel("gemini-1.5-flash")


def upload_to_gemini(path):
    print(f"    Submitting {os.path.basename(path)}...", end="", flush=True)
    try:
        file = genai.upload_file(path, mime_type="application/pdf")
        print(" OK")
        return file
    except Exception as e:
        print(f" Failed: {e}")
        return None


def clean_response(text):
    text = text.replace("```json", "").replace("```", "").strip()
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    return json.loads(text)


def generate_questions_for_chunk(file_obj, chunk_name):
    model = get_model()

    prompt = f"""
    あなたは社会福祉士国家試験の作成委員です。
    提供された教科書の一部（約{PAGES_PER_CHUNK}ページ分）から、本番試験レベルの「5肢択一問題」を【{QUESTIONS_PER_CHUNK}問】作成してください。

    【重要】
    - 必ずJSON形式のリストで出力してください。
    - 難易度は「合格率30%」の試験に合わせて高く設定してください。
    - 単純な知識問題だけでなく、事例問題も含めてください。

    JSONフォーマット:
    [
      {{
        "questionVal": "問題文...",
        "optionsVal": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
        "correctVal": ["正解の選択肢（文字列）"], 
        "explanationVal": "解説..."
      }}
    ]
    """

    retry_count = 0
    max_retries = 8

    while retry_count < max_retries:
        try:
            response = model.generate_content([prompt, file_obj])
            return clean_response(response.text)
        except Exception as e:
            err_str = str(e)
            # Stop immediately on Auth/Bad Request errors
            if "401" in err_str or "unauthorized" in err_str.lower():
                print(f"    ! CRITICAL AUTH ERROR: {e}. Stopping script.")
                exit(1)
            if "400" in err_str and "resource exhausted" not in err_str.lower():
                print(f"    ! Bad Request (400): {e}. Skipping chunk.")
                return []

            wait = (2**retry_count) * 5  # 5, 10, 20, 40, ...
            wait = min(wait, 300)  # Cap at 5 mins

            print(f"\n    ! Error generating {chunk_name}: {e}")
            print(
                f"      Retrying in {wait}s... (Attempt {retry_count + 1}/{max_retries})",
                flush=True,
            )
            time.sleep(wait)
            retry_count += 1

    print(f"    x Gave up on {chunk_name} after {max_retries} retries.")
    return []


def split_and_process(pdf_path, existing_data, progress):
    filename = os.path.basename(pdf_path)
    clean_name = filename.replace(".pdf", "")

    # Check if fully done
    if progress.get(filename, {}).get("status") == "DONE":
        print(f"Skipping {filename} (Already DONE)")
        return []

    print(f"Processing Category: {clean_name}")

    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
    except Exception as e:
        print(f"  Error reading PDF header: {e}")
        return []

    print(f"  Total Pages: {total_pages}")

    if total_pages < 5:
        print("  Skipping (too few pages)")
        return []

    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except:
            pass
    os.makedirs(TEMP_DIR, exist_ok=True)

    chunk_questions = []

    num_chunks = math.ceil(total_pages / PAGES_PER_CHUNK)
    print(f"  Splitting into {num_chunks} chunks...")

    # Get last processed chunk index
    last_chunk_idx = progress.get(filename, {}).get("last_chunk_idx", -1)

    for i in range(num_chunks):
        if i <= last_chunk_idx:
            continue  # Resume logic

        start_page = i * PAGES_PER_CHUNK
        end_page = min((i + 1) * PAGES_PER_CHUNK, total_pages)

        chunk_name = f"chunk_{i + 1:03d}.pdf"
        chunk_path = os.path.join(TEMP_DIR, chunk_name)

        writer = PdfWriter()
        for p in range(start_page, end_page):
            writer.add_page(reader.pages[p])

        with open(chunk_path, "wb") as f:
            writer.write(f)

        # Upload & Generate
        file_obj = upload_to_gemini(chunk_path)
        if file_obj:
            quizzes = generate_questions_for_chunk(file_obj, chunk_name)

            # Save IMMEDIATELY to master DB (append mode approach)
            # But we are passing existing_data list...
            # We need to append to list, then dump file.

            # Find current max ID dynamically (slow but safe)
            current_max_id = 0
            # Optimization: pass max_id around
            # But for simplicity, we just look at tail of existing_data? No.
            # We rely on existing_data being up to date.

            # Assign clean_name based on filename
            # This clean_name is already defined at the top of the function.
            # The instruction implies a re-calculation, but it's redundant here.
            # We'll use the existing `clean_name` from the function scope.
            print(f"DEBUG: Processing {filename} -> Label: {clean_name}")

            new_for_chunk = []
            for q in quizzes:
                # Ensure options is list, correct_answer is list
                ops = q.get("optionsVal", [])  # Use 'optionsVal' from prompt
                ans = q.get("correctVal", [])  # Use 'correctVal' from prompt
                if isinstance(ans, str):
                    ans = [ans]

                new_item = {
                    "question_text": q.get(
                        "questionVal"
                    ),  # Use 'questionVal' from prompt
                    "explanation": q.get(
                        "explanationVal"
                    ),  # Use 'explanationVal' from prompt
                    "options": ops,
                    "correct_answer": ans,
                    "group": "spec_social",  # FORCE SPECIAL SOCIAL
                    "year": None,
                    "categoryLabel": clean_name,  # Use camelCase for consistency
                    "is_free": False,
                }
                new_for_chunk.append(new_item)

            # Assign IDs
            if existing_data:
                try:
                    last_id = int(existing_data[-1]["id"])
                except:
                    last_id = 30000
            else:
                last_id = 30000

            for item in new_for_chunk:
                last_id += 1
                item["id"] = str(last_id)
                existing_data.append(item)

            chunk_questions.extend(new_for_chunk)

            print(f" -> +{len(new_for_chunk)} Qs (Total in list: {len(existing_data)})")

            # Save DB File
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, ensure_ascii=False, indent=2)

            # Update Progress
            progress[filename] = {"last_chunk_idx": i, "status": "IN_PROGRESS"}
            save_progress(progress)

            time.sleep(2)

    # Mark file as done
    progress[filename] = {"last_chunk_idx": num_chunks, "status": "DONE"}
    save_progress(progress)

    return chunk_questions


def main():
    if not os.path.exists(TARGET_DIR):
        print(f"Error: {TARGET_DIR} not found.")
        return

    progress = load_progress()

    full_data = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            full_data = json.load(f)

    pdfs = glob.glob(os.path.join(TARGET_DIR, "**/*.pdf"), recursive=True)
    print(f"Found {len(pdfs)} PDFs. Resuming safe generation mode...")

    for pdf in pdfs:
        try:
            split_and_process(pdf, full_data, progress)
        except Exception as e:
            print(f"CRITICAL ERROR processing {pdf}: {e}")
            traceback.print_exc()
            time.sleep(10)  # Wait and continue to next PDF

    print("All done!")


if __name__ == "__main__":
    main()
