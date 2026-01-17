import os
import glob
import json
import time
import random
import re
from dotenv import load_dotenv
import pdfplumber
import google.generativeai as genai
from openai import OpenAI

# Load environment variables
load_dotenv()
load_dotenv(
    "data_pipeline/.env"
)  # Explicitly load from subdirectory if missing in root

# Configuration
TARGET_DIR = r"C:\Users\user\OneDrive\Desktop\社会福祉士専門"
OUTPUT_FILE = "app/assets/master_database_v3.json"
MAX_QUESTIONS_PER_PDF = 10

# --- API KEY MANAGEMENT ---
GEMINI_KEYS = []
if os.environ.get("GEMINI_API_KEY"):
    GEMINI_KEYS.append(os.environ.get("GEMINI_API_KEY"))
for i in range(1, 10):
    k = os.environ.get(f"GEMINI_API_KEY_{i}")
    if k:
        GEMINI_KEYS.append(k)

OPENAI_KEY = os.environ.get("OPENAI_API_KEY")

print(
    f"Loaded {len(GEMINI_KEYS)} Gemini Keys and {'1' if OPENAI_KEY else '0'} OpenAI Key."
)

if not GEMINI_KEYS and not OPENAI_KEY:
    print(
        "Error: No API keys found. Please set GEMINI_API_KEY or OPENAI_API_KEY in .env"
    )
    exit(1)

gemini_key_index = 0


def get_gemini_model():
    global gemini_key_index
    if not GEMINI_KEYS:
        return None
    api_key = GEMINI_KEYS[gemini_key_index]
    gemini_key_index = (gemini_key_index + 1) % len(GEMINI_KEYS)
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-1.5-flash")


def get_openai_client():
    if not OPENAI_KEY:
        return None
    return OpenAI(api_key=OPENAI_KEY)


# --- GENERATION LOGIC ---
PROMPT_TEMPLATE = """
あなたは社会福祉士国家試験の専門家です。
以下のテキスト（教科書の一部）から、試験に出題されそうな「予想問題」を3問作成してください。

テキスト:
{text}

制約:
- 5肢択一形式
- 出力は以下のJSONリスト形式のみ（Markdown不要）

Format:
[
  {{
    "questionVal": "問題文",
    "optionsVal": ["選択1", "選択2", "選択3", "選択4", "選択5"],
    "correctVal": ["正解の選択肢文字列"], 
    "explanationVal": "詳しい解説"
  }}
]
"""


def generate_with_gemini(text):
    model = get_gemini_model()
    if not model:
        raise Exception("No Gemini keys")
    response = model.generate_content(PROMPT_TEMPLATE.format(text=text[:8000]))
    return clean_response(response.text)


def generate_with_openai(text):
    client = get_openai_client()
    if not client:
        raise Exception("No OpenAI key")
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # Cost-effective model
        messages=[
            {
                "role": "system",
                "content": "You are a quiz generator. Output JSON only.",
            },
            {"role": "user", "content": PROMPT_TEMPLATE.format(text=text[:8000])},
        ],
        temperature=0.7,
    )
    return clean_response(response.choices[0].message.content)


def clean_response(content):
    content = content.replace("```json", "").replace("```", "").strip()
    return json.loads(content)


def generate_hybrid(text, filename):
    # Strategy: Randomly pick one, fallback to the other
    # Bias slightly towards Gemini if we have many keys, to save OpenAI cost
    providers = []
    if GEMINI_KEYS:
        providers.append("gemini")
    if OPENAI_KEY:
        providers.append("openai")

    if not providers:
        return []

    # Priority: Gemini first (cheaper/free), then OpenAI
    # But to distribute rate limit, we can randomize if both available
    primary = random.choice(providers)

    try:
        if primary == "gemini":
            print(f"  [Gemini] Generating for {filename}...")
            return generate_with_gemini(text)
        else:
            print(f"  [OpenAI] Generating for {filename}...")
            return generate_with_openai(text)
    except Exception as e:
        print(f"  ! {primary.capitalize()} failed ({e}). Switching provider...")
        try:
            fallback = "openai" if primary == "gemini" else "gemini"
            if fallback == "gemini":
                return generate_with_gemini(text)
            else:
                return generate_with_openai(text)
        except Exception as e2:
            print(f"  !! Both providers failed for {filename}: {e2}")
            return []


def upload_to_gemini(path, mime_type="application/pdf"):
    print(f"  Uploading {os.path.basename(path)} to Gemini...")
    file = genai.upload_file(path, mime_type=mime_type)
    return file


def generate_from_file_with_gemini(file_obj, filename):
    model = get_gemini_model()
    if not model:
        return []

    prompt = f"""
    あなたは社会福祉士国家試験の専門家です。
    このドキュメント（教科書の一部）から、試験に出題されそうな「予想問題」を3問作成してください。

    制約:
    - 5肢択一形式
    - 出力はJSONリスト形式のみ
    - 画像や図表が含まれる場合はそれも参考にしてください。
    
    Format example:
    [
      {{
        "questionVal": "...", 
        "optionsVal": ["..."], 
        "correctVal": ["..."], 
        "explanationVal": "..."
      }}
    ]
    """

    try:
        response = model.generate_content([prompt, file_obj])
        return clean_response(response.text)
    except Exception as e:
        print(f"  Gemini File API failed: {e}")
        return []


def main():
    if not os.path.exists(TARGET_DIR):
        print(f"Error: Directory not found: {TARGET_DIR}")
        return

    # Load existing to find ID
    start_id = 20000
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Simple max ID find
            ids = [int(x["id"]) for x in data if str(x["id"]).isdigit()]
            if ids:
                start_id = max(ids)
    else:
        data = []

    # Recursive search for PDFs in subdirectories
    pdfs = glob.glob(os.path.join(TARGET_DIR, "**/*.pdf"), recursive=True)
    print(
        f"Found {len(pdfs)} PDFs in {TARGET_DIR} (recursive). Starting hybrid generation..."
    )

    new_questions = []
    id_counter = start_id

    for pdf_path in pdfs:
        filename = os.path.basename(pdf_path)
        clean_name = filename.replace(".pdf", "")

        # 1. Try Text Extraction first (Cheaper/Faster if regular PDF)
        full_text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Check first 3 pages
                for page in pdf.pages[:3]:
                    t = page.extract_text()
                    if t:
                        full_text += t
        except:
            pass

        quizzes = []

        # 2. If text found, use Hybrid Text Generation
        if len(full_text) > 200:
            print(f"Processing {filename} (Text Mode)...")
            quizzes = generate_hybrid(full_text, filename)
        else:
            # 3. If no text, use Gemini File API (OCR/Vision)
            print(f"Processing {filename} (Vision/File Mode) - No text extracted...")
            try:
                # Need Gemini key for this
                if GEMINI_KEYS:
                    # Configure with current key before upload
                    get_gemini_model()
                    file_obj = upload_to_gemini(pdf_path)
                    quizzes = generate_from_file_with_gemini(file_obj, filename)
                else:
                    print("  Skipping (No Gemini key for Vision mode)")
            except Exception as e:
                print(f"  Vision mode failed: {e}")

        # Process results
        for q in quizzes:
            id_counter += 1
            new_item = {
                "id": str(id_counter),
                "questionText": q["questionVal"],
                "options": q["optionsVal"],
                "correctAnswer": q["correctVal"],
                "explanation": q["explanationVal"],
                "group": "spec_social",
                "categoryLabel": clean_name,
                "year": None,
                "isFree": False,
                "isMastered": False,
            }
            new_questions.append(new_item)
            data.append(new_item)
            print(f"  + Generated: {q['questionVal'][:20]}...")

        time.sleep(1)  # Gentle wait

    if new_questions:
        print(f"Saving {len(new_questions)} new questions...")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Done! Restart app to see changes.")
    else:
        print("No questions generated.")


if __name__ == "__main__":
    main()
