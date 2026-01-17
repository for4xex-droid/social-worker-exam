import os
import json
import time
from pathlib import Path
from pypdf import PdfReader
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def extract_text_pypdf(pdf_path):
    """Extract text from PDF using pypdf."""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
        return ""


def process_year_openai(year_dir):
    year_path = Path(year_dir)
    session_id = year_path.name  # e.g., no37

    all_pdfs = list(year_path.glob("*.pdf"))
    am_pdfs = sorted([p for p in all_pdfs if "am" in p.name])
    pm_pdfs = sorted([p for p in all_pdfs if "pm" in p.name])
    answer_path = year_path / "k_kijun_seitou.pdf"

    extracted_data = []

    # Process AM and PM separately
    for label, pdfs in [("AM", am_pdfs), ("PM", pm_pdfs)]:
        if not pdfs:
            continue

        print(f"Processing {session_id} {label} with OpenAI...")

        combined_text = ""
        for p in pdfs:
            print(f"Reading {p.name}...")
            combined_text += f"\n--- File: {p.name} ---\n"
            combined_text += extract_text_pypdf(p)

        answer_text = ""
        if answer_path.exists():
            print(f"Reading {answer_path.name}...")
            answer_text = extract_text_pypdf(answer_path)

        prompt = f"""
        あなたは介護福祉士国家試験の専門家です。
        提供されたテキストデータ（問題用紙PDFからの抜粋）と正答表の内容から、{label}試験問題を正確に抽出し、構造化データを作成してください。
        
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
        
        正答表のテキスト:
        {answer_text}
        
        問題用紙のテキスト:
        {combined_text[:120000]} # Keep it within context limits if needed
        """

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional exam data extractor.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            # The model might return a key like "questions" or just the array.
            # We'll try to find the array.
            data_json = json.loads(content)
            if isinstance(data_json, dict):
                # Look for a list value
                for val in data_json.values():
                    if isinstance(val, list):
                        data = val
                        break
                else:
                    data = []
            elif isinstance(data_json, list):
                data = data_json
            else:
                data = []

            for item in data:
                item["category_group"] = "過去問（介護）"

            extracted_data.extend(data)
            print(f"Done {label}: {len(data)} questions extracted via OpenAI.")
        except Exception as e:
            print(f"Failed OpenAI {label} for {session_id}: {e}")

        time.sleep(2)

    return extracted_data


def main():
    base_dir = "source/kaigo_pdfs"
    target_sessions = ["no37", "no36", "no35", "no34", "no33"]
    output_file = "raw_kaigo_questions_openai.json"

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

        session_data = process_year_openai(os.path.join(base_dir, session))
        if session_data:
            all_extracted.extend(session_data)
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_extracted, f, ensure_ascii=False, indent=2)

        print(f"Current total (OpenAI): {len(all_extracted)}")
        time.sleep(1)

    print(f"\nFinal total: {len(all_extracted)} questions saved to {output_file}")


if __name__ == "__main__":
    main()
