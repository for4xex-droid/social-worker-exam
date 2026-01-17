import os
import json
import re
import time
from pypdf import PdfReader, PdfWriter
import google.generativeai as genai
from dotenv import load_dotenv

# --- CONFIGURATION ---
PDF_FOLDER = r"C:\Users\user\OneDrive\Desktop\共通"
OUTPUT_FILE = "app/assets/master_database_v3.json"
PROGRESS_FILE = "data_pipeline/gen_progress_common.json"
GROUP_ID = "common_social"
QUESTIONS_PER_CHUNK = 20  # Approximately per 10 pages
PAGES_PER_CHUNK = 10

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash-exp")


def get_clean_name(filename):
    name = os.path.splitext(filename)[0]
    return re.sub(r"[\(（].*?[\)）]", "", name).strip()


def split_pdf(file_path):
    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    chunks = []

    for i in range(0, total_pages, PAGES_PER_CHUNK):
        writer = PdfWriter()
        end = min(i + PAGES_PER_CHUNK, total_pages)
        for page_num in range(i, end):
            writer.add_page(reader.pages[page_num])

        chunk_filename = f"temp_chunk_{i}.pdf"
        with open(chunk_filename, "wb") as f:
            writer.write(f)
        chunks.append(chunk_filename)

    return chunks, total_pages


def generate_quiz_for_chunk(pdf_path, category_label):
    sample_file = genai.upload_file(path=pdf_path, display_name="chunk_common")

    prompt = f"""
    このPDFは社会福祉士等の試験対策テキストの「{category_label}」に関するページです。
    この内容に基づいて、試験に出題されそうな重要ポイントを5択のクイズ形式で20問程度作成してください。
    
    以下のJSONフォーマットの配列で出力してください。解説は詳しく、学習の助けになるようにしてください。
    [
      {{
        "questionVal": "問題文...",
        "optionsVal": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
        "correctVal": "正解の選択肢（文字列そのもの）",
        "explanationVal": "詳しい解説..."
      }}
    ]
    JSON以外のテキストは一切含めないでください。
    """

    try:
        response = model.generate_content([prompt, sample_file])
        text = response.text
        # Extract JSON block
        json_match = re.search(r"\[.*\]", text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return []
    finally:
        genai.delete_file(sample_file.name)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def main():
    if not os.path.exists(PROGRESS_FILE):
        progress = {}
    else:
        with open(PROGRESS_FILE, "r") as f:
            progress = json.load(f)

    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        master_database = json.load(f)

    pdf_files = [f for f in os.listdir(PDF_FOLDER) if f.lower().endswith(".pdf")]
    print(f"Found {len(pdf_files)} PDF files in {PDF_FOLDER}")

    for filename in pdf_files:
        if filename in progress and progress[filename].get("completed"):
            continue

        file_path = os.path.join(PDF_FOLDER, filename)
        category_label = get_clean_name(filename)
        print(f"Processing: {filename} -> Label: {category_label}")

        chunks, total_pages = split_pdf(file_path)
        if filename not in progress:
            progress[filename] = {
                "total_pages": total_pages,
                "chunks_done": 0,
                "completed": False,
            }

        for idx, chunk_path in enumerate(chunks):
            if idx < progress[filename]["chunks_done"]:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
                continue

            print(f"  Chunk {idx + 1}/{len(chunks)}...")
            try:
                new_questions = generate_quiz_for_chunk(chunk_path, category_label)

                # Format for database
                current_max_id = max(
                    [
                        int(q.get("id", 0))
                        for q in master_database
                        if str(q.get("id", "0")).isdigit()
                    ]
                    + [0]
                )
                for q_data in new_questions:
                    current_max_id += 1
                    new_item = {
                        "id": str(current_max_id),
                        "question_text": q_data.get("questionVal"),
                        "options": q_data.get("optionsVal"),
                        "correct_answer": q_data.get("correctVal"),
                        "explanation": q_data.get("explanationVal"),
                        "group": GROUP_ID,
                        "categoryLabel": category_label,
                        "category_label": category_label,
                        "is_free": False,
                    }
                    master_database.append(new_item)

                # Save progress and DB
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(master_database, f, ensure_ascii=False, indent=2)

                progress[filename]["chunks_done"] = idx + 1
                if progress[filename]["chunks_done"] == len(chunks):
                    progress[filename]["completed"] = True

                with open(PROGRESS_FILE, "w") as f:
                    json.dump(progress, f)

                print(f"    -> Added {len(new_questions)} questions.")
                time.sleep(2)  # Prevent rate limiting

            except Exception as e:
                print(f"    Error in chunk {idx}: {e}")
                time.sleep(10)

    print("All categorized common subjects generated!")


if __name__ == "__main__":
    main()
