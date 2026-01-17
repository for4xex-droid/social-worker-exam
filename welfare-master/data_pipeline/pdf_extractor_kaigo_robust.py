import os
import json
import time
from pathlib import Path
import google.generativeai as genai
from pypdf import PdfReader
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Configure APIs
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def extract_text_pypdf(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
        return ""


def upload_to_gemini(path, mime_type=None):
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"Uploaded to Gemini: {file.display_name}")
    return file


def extract_via_gemini_vision(pdfs, answer_path, session_id, label):
    print(f"Attempting Gemini Vision for {session_id} {label}...")
    model = genai.GenerativeModel(model_name="gemini-2.0-flash")

    uploaded_files = [
        upload_to_gemini(str(p), mime_type="application/pdf") for p in pdfs
    ]
    if answer_path.exists():
        uploaded_files.append(
            upload_to_gemini(str(answer_path), mime_type="application/pdf")
        )

    prompt = f"""
    あなたは介護福祉士国家試験の専門家です。
    提供されたPDF（問題用紙と正答表）から、{label}試験問題を正確に抽出してください。
    正答表を参考に、各問題のcorrect_answerを必ず埋めてください。
    
    【出力形式: JSON配列】
    [
      {{
        "id": "{session_id.replace("no", "")}_{label}_number",
        "question": "問題文",
        "options": ["選1", "選2", "選3", "選4", "選5"],
        "correct_answer": "正解の文字列",
        "raw_category": "科目名",
        "raw_year": "{session_id}"
      }}
    ]
    """

    response = model.generate_content(
        [prompt] + uploaded_files,
        generation_config={"response_mime_type": "application/json"},
    )
    return json.loads(response.text)


def extract_via_openai(pdfs, answer_path, session_id, label):
    print(f"Attempting OpenAI Fallback for {session_id} {label}...")

    combined_text = "".join([f"\n- {p.name} -\n" + extract_text_pypdf(p) for p in pdfs])
    answer_text = extract_text_pypdf(answer_path) if answer_path.exists() else ""

    prompt = f"""
    あなたは介護福祉士国家試験の専門家です。以下の抜粋テキストから、{label}試験問題をJSON形式で抽出してください。
    
    正答テキスト: {answer_text}
    問題テキスト: {combined_text[:120000]}
    
    【出力形式: JSON配列】
    [
      {{
        "id": "{session_id.replace("no", "")}_{label}_number",
        "question": "問題文",
        "options": ["選1", "選2", "選3", "選4", "選5"],
        "correct_answer": "正解の文字列",
        "raw_category": "科目名",
        "raw_year": "{session_id}"
      }}
    ]
    """

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    data_json = json.loads(response.choices[0].message.content)
    # Extract list if wrapped
    if isinstance(data_json, dict):
        for v in data_json.values():
            if isinstance(v, list):
                return v
    return data_json if isinstance(data_json, list) else []


def process_year(year_dir):
    year_path = Path(year_dir)
    session_id = year_path.name
    all_pdfs = list(year_path.glob("*.pdf"))
    am_pdfs = sorted([p for p in all_pdfs if "am" in p.name])
    pm_pdfs = sorted([p for p in all_pdfs if "pm" in p.name])
    answer_path = year_path / "k_kijun_seitou.pdf"

    # Process each PDF individually to ensure we stay within output limits and don't get truncated JSON
    for label, pdfs in [("AM", am_pdfs), ("PM", pm_pdfs)]:
        if not pdfs:
            continue

        for p in pdfs:
            print(f"--- Processing {p.name} ---")
            part_data = []
            try:
                # 1. Try Gemini Vision
                uploaded = [upload_to_gemini(str(p), mime_type="application/pdf")]
                if answer_path.exists():
                    uploaded.append(
                        upload_to_gemini(str(answer_path), mime_type="application/pdf")
                    )

                model = genai.GenerativeModel(model_name="gemini-2.0-flash")
                prompt = f"""
                あなたは介護福祉士国家試験の専門家です。
                提供されたPDF（問題用紙 {p.name} と正答表）から、試験問題を正確に抽出してください。
                正答表を参考に、各問題のcorrect_answerを必ず埋めてください。
                
                【出力形式: JSON配列】
                [
                  {{
                    "id": "{session_id.replace("no", "")}_{p.name.replace(".pdf", "")}_number",
                    "question": "問題文",
                    "options": ["選1", "選2", "選3", "選4", "選5"],
                    "correct_answer": "正解の文字列",
                    "raw_category": "科目名",
                    "raw_year": "{session_id}"
                  }}
                ]
                """

                response = model.generate_content(
                    [prompt] + uploaded,
                    generation_config={"response_mime_type": "application/json"},
                )
                part_data = json.loads(response.text)
                if isinstance(part_data, dict):
                    for v in part_data.values():
                        if isinstance(v, list):
                            part_data = v
                            break

                print(f"Success with Gemini for {p.name} ({len(part_data)} questions)")
            except Exception as e:
                print(
                    f"Gemini failed for {p.name}: {e}. Switching to OpenAI fallback..."
                )
                try:
                    part_data = extract_via_openai([p], answer_path, session_id, label)
                    print(
                        f"Success with OpenAI for {p.name} ({len(part_data)} questions)"
                    )
                except Exception as e2:
                    print(f"OpenAI also failed: {e2}")

            if part_data:
                part_data = [i for i in part_data if isinstance(i, dict)]
                yield part_data

            time.sleep(10)  # Heavy delay to avoid 429


def main():
    base_dir = "source/kaigo_pdfs"
    target_sessions = ["no37", "no36", "no35", "no34", "no33"]
    output_file = "raw_kaigo_questions.json"

    all_extracted = []
    if os.path.exists(output_file):
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                all_extracted = json.load(f)
        except Exception:
            pass

    processed_ids = {item.get("id") for item in all_extracted}

    for session in target_sessions:
        print(f"\n=== Processing Year: {session} ===")

        # Use generator to save after each part
        for part_data in process_year(os.path.join(base_dir, session)):
            # Filter duplicates just in case
            for item in part_data:
                if item.get("id") not in processed_ids:
                    all_extracted.append(item)
                    processed_ids.add(item.get("id"))

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_extracted, f, ensure_ascii=False, indent=2)
            print(f"Saved progress. Total questions: {len(all_extracted)}")

        time.sleep(5)

    print(f"\nExtraction Task Complete. Total: {len(all_extracted)}")


if __name__ == "__main__":
    main()
