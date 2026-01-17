import os
import time
import json
import uuid
import traceback
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PDF_PATH = "data_pipeline/10刑事司法と福祉.pdf"
OUTPUT_JSON = "data_pipeline/additional_criminal.json"
DEBUG_LOG = "data_pipeline/gemini_response_debug.txt"


def generate():
    if not os.path.exists(PDF_PATH):
        print(f"PDF not found: {PDF_PATH}")
        return

    print("Uploading PDF to Gemini...")
    sample_file = genai.upload_file(path=PDF_PATH, display_name="Criminal Justice PDF")
    print(f"Uploaded file: {sample_file.name}")

    while sample_file.state.name == "PROCESSING":
        print(".", end="", flush=True)
        time.sleep(2)
        sample_file = genai.get_file(sample_file.name)

    if sample_file.state.name == "FAILED":
        print("\nFile processing failed")
        return

    print("\nFile processed. Generating content...")

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash-exp",
        system_instruction="あなたは社会福祉士国家試験の作問委員です。",
    )

    prompt = """
    このPDFの内容に基づいて、社会福祉士国家試験レベルの『刑事司法と福祉』に関する模擬問題を40問作成してください。
    
    出力形式: JSONリスト
    [
      {
        "question_text": "...",
        "options": ["...", "...", "...", "...", "..."],
        "correct_answer": 1,
        "explanation": "..."
      }
    ]
    
    条件:
    1. 選択肢は必ず5つ。
    2. 正解は1-5の番号。
    3. 解説は論理的に。
    4. 日本語で出力。
    """

    try:
        response = model.generate_content(
            [sample_file, prompt],
            generation_config={"response_mime_type": "application/json"},
        )

        print(f"Response received. Text Length: {len(response.text)}")

        # Save raw for debug
        with open(DEBUG_LOG, "w", encoding="utf-8") as f:
            f.write(response.text)

        text = response.text.strip()
        # Cleanup markdown
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        data = json.loads(text)

        formatted = []
        for q in data:
            formatted.append(
                {
                    "id": f"gen_criminal_{uuid.uuid4().hex[:8]}",
                    "questionText": q.get("question_text") or q.get("questionText"),
                    "options": q.get("options", []),
                    "correctAnswer": str(q.get("correct_answer")),
                    "explanation": q.get("explanation"),
                    "group": "common_social",
                    "categoryLabel": "刑事司法と福祉",
                    "year": "2025_prediction",
                    "type": "prediction",
                    "isMastered": False,
                    "quality_score": 5,
                }
            )

        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(formatted, f, ensure_ascii=False, indent=2)

        print(f"Generated {len(formatted)} questions.")

    except Exception as e:
        print(f"Generation Error: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    generate()
