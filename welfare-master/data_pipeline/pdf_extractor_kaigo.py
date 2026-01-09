import os
import json
import time
from pathlib import Path
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))


def upload_to_gemini(path, mime_type=None):
    """Uploads the given file to Gemini."""
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"Uploaded file '{file.display_name}' as: {file.uri}")
    return file


def process_year(year_dir):
    year_path = Path(year_dir)
    session_id = year_path.name  # e.g., no37

    # 1. Find PDFs
    all_pdfs = list(year_path.glob("*.pdf"))
    # Split AM and PM to avoid token limit and generic extraction issues
    am_pdfs = sorted([p for p in all_pdfs if "am" in p.name])
    pm_pdfs = sorted([p for p in all_pdfs if "pm" in p.name])
    answer_path = year_path / "k_kijun_seitou.pdf"

    extracted_data = []

    model = genai.GenerativeModel(model_name="gemini-2.0-flash")

    # Process AM and PM separately to stay within quota and improve quality
    for label, pdfs in [("AM", am_pdfs), ("PM", pm_pdfs)]:
        if not pdfs:
            continue

        print(f"Processing {session_id} {label}...")

        uploaded_files = []
        for p in pdfs:
            uploaded_files.append(upload_to_gemini(str(p), mime_type="application/pdf"))

        if answer_path.exists():
            uploaded_files.append(
                upload_to_gemini(str(answer_path), mime_type="application/pdf")
            )

        prompt = f"""
        あなたは介護福祉士国家試験の専門家です。
        提供されたPDF（問題用紙と正答表）から、{label}試験問題を正確に書き起こしてください。
        
        【出力形式】
        以下の構造を持つJSON配列で出力してください。
        [
          {{
            "id": "{session_id.replace("no", "")}_{label}_number",
            "question": "問題文...",
            "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
            "correct_answer": "正解の文字列（optionsの中から一つ）",
            "explanation": "",
            "raw_category": "科目名",
            "raw_year": "{session_id}"
          }}
        ]
        
        正答表を参考に、correct_answerを必ず埋めてください。
        """

        try:
            response = model.generate_content(
                [prompt] + uploaded_files,
                generation_config={"response_mime_type": "application/json"},
            )
            data = json.loads(response.text)
            for item in data:
                item["category_group"] = "過去問（介護）"
            extracted_data.extend(data)
            print(f"Done {label}: {len(data)} questions extracted.")
        except Exception as e:
            print(f"Failed {label} for {session_id}: {e}")

        # Be polite to the API
        time.sleep(10)

    return extracted_data


def main():
    base_dir = "source/kaigo_pdfs"
    target_sessions = ["no37", "no36", "no35", "no34", "no33"]
    output_file = "raw_kaigo_questions.json"

    # Load existing to resume
    if os.path.exists(output_file):
        with open(output_file, "r", encoding="utf-8") as f:
            all_extracted = json.load(f)
    else:
        all_extracted = []

    processed_years = {item.get("raw_year") for item in all_extracted}

    for session in target_sessions:
        if session in processed_years:
            print(f"Skipping {session} (already processed)")
            continue

        session_data = process_year(os.path.join(base_dir, session))
        if session_data:
            all_extracted.extend(session_data)
            # Save progress
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_extracted, f, ensure_ascii=False, indent=2)

        print(f"Current total questions: {len(all_extracted)}")
        time.sleep(20)  # Buffer between years

    print(f"\nFinal total: {len(all_extracted)} questions saved.")


if __name__ == "__main__":
    main()
