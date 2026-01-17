import os
import json
import time
import glob
import math
from PyPDF2 import PdfReader, PdfWriter
import google.generativeai as genai
from openai import OpenAI

from dotenv import load_dotenv

# Load .env explicitly
load_dotenv(dotenv_path=".env")

# --- CONFIG ---
# Resolve Project Root (../ from data_pipeline)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SOURCE_PDF = r"C:\Users\user\OneDrive\Desktop\社会福祉士専門\SW専7　ソーシャルワーク演習(社会専門)\ソーシャルワーク演習(社会専門).pdf"
OUTPUT_DIR = "temp_social_chunks"
OUTPUT_JSON = os.path.join(PROJECT_ROOT, "app", "assets", "social_spec_part7.json")
PAGES_PER_CHUNK = 20  # Adjust based on token limits
TARGET_QUESTIONS = 200

# API KEYS LIST (from legacy script)
API_KEYS = [
    "AIzaSyCryEPFUJe1K6Jh5hKNUYQdddxrVbXKaRQ",
    "AIzaSyAvNStGrrQEcxv3ODy_LVSVHIi56EoG2EE",
    "AIzaSyALdHdrjaJGXSRcxTNnxVLvXvxjeim-nso",
    "AIzaSyBTWYZ7OzVA9DrW4jI74CXffZER87X2C_c",
]
current_key_idx = 0


def get_next_key():
    global current_key_idx
    key = API_KEYS[current_key_idx]
    current_key_idx = (current_key_idx + 1) % len(API_KEYS)
    return key


# API KEYS
GEN_KEY = os.getenv("GEMINI_API_KEY")
OPEN_KEY = os.getenv("OPENAI_API_KEY")

if not GEN_KEY or not OPEN_KEY:
    print("Error: API Keys not found in .env")
    # Debug: Print loaded env keys (partially hidden)
    # print(f"Loaded Keys: Gemini={GEN_KEY[:5]}..., OpenAI={OPEN_KEY[:5]}...")

# Set env var for OpenAI client auto-detection
if OPEN_KEY:
    os.environ["OPENAI_API_KEY"] = OPEN_KEY

# Initialize with first key
genai.configure(api_key=API_KEYS[0])


def setup_dirs():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # Check PDF
    if not os.path.exists(SOURCE_PDF):
        print(f"Error: Source PDF not found at {SOURCE_PDF}")
        exit(1)


def split_pdf():
    print(f"Reading {SOURCE_PDF}...")
    reader = PdfReader(SOURCE_PDF)
    total_pages = len(reader.pages)
    print(f"Total Pages: {total_pages}")

    num_chunks = math.ceil(total_pages / PAGES_PER_CHUNK)
    chunk_paths = []

    for i in range(num_chunks):
        start = i * PAGES_PER_CHUNK
        end = min(start + PAGES_PER_CHUNK, total_pages)

        writer = PdfWriter()
        for p in range(start, end):
            writer.add_page(reader.pages[p])

        chunk_name = f"chunk_{i + 1:03d}.pdf"
        chunk_path = os.path.join(OUTPUT_DIR, chunk_name)
        with open(chunk_path, "wb") as f:
            writer.write(f)

        chunk_paths.append(chunk_path)
        print(f"  Created {chunk_name} (Pages {start + 1}-{end})")

    return chunk_paths


def ocr_with_gemini(pdf_path):
    print(f"  [Gemini OCR] Processing {os.path.basename(pdf_path)}...")

    # Retry with Key Rotation
    max_retries = len(API_KEYS) * 2
    for attempt in range(max_retries):
        try:
            # Refresh Key
            key = get_next_key()
            genai.configure(api_key=key)

            # Upload file to Gemini
            sample_file = genai.upload_file(
                path=pdf_path, display_name=os.path.basename(pdf_path)
            )

            # Wait for processing
            start_wait = time.time()
            while sample_file.state.name == "PROCESSING":
                if time.time() - start_wait > 60:
                    raise TimeoutError("File processing timed out")
                time.sleep(2)
                sample_file = genai.get_file(sample_file.name)

            if sample_file.state.name == "FAILED":
                print("  [Gemini OCR] Upload failed (State: FAILED). Retrying...")
                continue

            # Try multiple models (Updated based on API check)
            models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
            response = None
            for m_name in models:
                try:
                    model = genai.GenerativeModel(model_name=m_name)
                    response = model.generate_content(
                        [
                            sample_file,
                            "このPDFのテキストを忠実に抽出してマークダウン形式で出力してください。",
                        ]
                    )
                    if response:
                        break
                except Exception as e:
                    pass  # Try next model

            if response:
                print(f"  [Gemini OCR] Success! Extracted {len(response.text)} chars.")
                print(
                    f"  [Gemini OCR] Preview: {response.text[:100].replace(chr(10), ' ')}..."
                )
                return response.text
            else:
                print(
                    f"  [Gemini OCR] All models failed for key ending in ...{key[-4:]}"
                )

        except Exception as e:
            print(f"  [Gemini OCR] Attempt {attempt + 1} failed: {e}")
            time.sleep(2)

    print("  [Gemini OCR] Giving up on this chunk.")
    return ""


def generate_questions_openai(text_content, num_questions):
    # Iterative generation to ensure count
    BATCH_SIZE = 5
    num_batches = math.ceil(num_questions / BATCH_SIZE)
    print(
        f"  [OpenAI Gen] Generating {num_questions} questions in {num_batches} batches of {BATCH_SIZE}..."
    )

    combined_results = []
    client = OpenAI()

    for i in range(num_batches):
        print(f"    Batch {i + 1}/{num_batches}...")
        prompt = f"""
        あなたは社会福祉士国家試験の作成委員です。
        以下のテキスト資料に基づいて、試験対策用の「5肢択一問題」を【{BATCH_SIZE}問】作成してください。
        
        【要件】
        - 作成数: 正確に{BATCH_SIZE}問
        - カテゴリ: 「ソーシャルワーク演習（社会専門）」
        - 難易度: 国家試験レベル
        - 形式: JSON配列のみを出力
        
        【JSONフォーマット】
        [
          {{
            "questionVal": "問題文",
            "optionsVal": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
            "correctVal": ["正解の選択肢の文字列"], 
            "explanationVal": "詳しい解説"
          }}
        ]
        
        【テキスト資料】
        {text_content[:60000]} 
        """

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant designed to output JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            # Pre-validate/accumulate
            combined_results.append(content)
        except Exception as e:
            print(f"    Batch {i + 1} Error: {e}")

    # Combine results into a single list string for the cleaner
    # Rough combine: just join them. The cleaner needs to handle multiple lists or we parse here.
    # Better: Parse here and return list.
    final_list = []
    for res in combined_results:
        parsed = clean_json(res)
        if parsed and isinstance(parsed, list):
            final_list.extend(parsed)

    return json.dumps(final_list, ensure_ascii=False)


def clean_json(raw_json_str):
    try:
        # 1. Remove Markdown code blocks
        raw_json_str = raw_json_str.replace("```json", "").replace("```", "").strip()

        # 2. Try parsing entire string
        try:
            data = json.loads(raw_json_str)
        except:
            data = None

        if data is None:
            # 3. Try finding list structure
            start = raw_json_str.find("[")
            end = raw_json_str.rfind("]") + 1
            if start != -1 and end != -1:
                try:
                    json_str = raw_json_str[start:end]
                    data = json.loads(json_str)
                except:
                    pass

        # 4. Normalize structure
        if isinstance(data, dict):
            # Check common keys for wrapped list
            for k in ["questions", "quiz", "data", "items", "response"]:
                if k in data and isinstance(data[k], list):
                    return data[k]
            # If plain dict but looks like a single question, wrap in list
            if "questionVal" in data:
                return [data]
            return []  # Unknown dict structure

        if isinstance(data, list):
            return data

        return []
    except Exception as e:
        print(f"  [JSON Clean Error] {e}")
        return []


def main():
    setup_dirs()

    # 1. Split PDF
    chunks = split_pdf()

    # Calculate questions per chunk
    questions_per_chunk = math.ceil(TARGET_QUESTIONS / len(chunks))
    print(f"Target: {questions_per_chunk} questions per chunk.")

    all_questions = []

    # 2. Process Loop
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i + 1}/{len(chunks)}: {chunk}")
        try:
            # Step A: OCR
            ocr_text = ocr_with_gemini(chunk)
            if not ocr_text:
                continue

            # Step B: Generate
            json_output = generate_questions_openai(ocr_text, questions_per_chunk)

            # Step C: Parse & Collect
            print(f"  [DEBUG] OpenAI Raw: {json_output[:200]}...")
            data = clean_json(json_output)
            if data:
                for q in data:
                    if not isinstance(q, dict):
                        continue

                    # Normalize format to fit Master DB
                    try:
                        normalized = {
                            "id": str(int(time.time() * 1000))
                            + str(len(all_questions)),  # Temp ID
                            "question_text": q.get("questionVal"),
                            "options": q.get("optionsVal"),
                            "correct_answer": q.get("correctVal"),
                            "explanation": q.get("explanationVal"),
                            "category_label": "ソーシャルワーク演習（社会専門）",  # Correct Label
                            "group": "spec_social",
                            "subject_label": "ソーシャルワーク演習",
                        }
                        all_questions.append(normalized)
                    except Exception as e:
                        print(f"Skipping invalid item: {e}")
                print(f"  Generated {len(all_questions)} total questions so far.")

                # Save intermediate progress
                with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
                    json.dump(all_questions, f, indent=4, ensure_ascii=False)
            else:
                print("  Failed to parse JSON response.")
        except Exception as e:
            print(f"Error processing chunk {i + 1}: {e}")
            continue
        else:
            print("  Failed to parse JSON response.")

    print(f"Done. Saved {len(all_questions)} questions to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
