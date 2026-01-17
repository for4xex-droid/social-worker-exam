import os
import json
import asyncio
import uuid
from openai import AsyncOpenAI
from pypdf import PdfReader
from dotenv import load_dotenv

load_dotenv()

PDF_PATH = "data_pipeline/criminal_justice.pdf"
OUTPUT_JSON = "data_pipeline/additional_criminal.json"

SYSTEM_PROMPT = """
あなたは社会福祉士国家試験の熟練した作問委員です。
提供された『刑事司法と福祉』のテキストに基づいて、試験問題（5肢択一）を作成してください。

条件:
1.  **難易度**: 国家試験レベル（知識の正確な理解を問う）
2.  **形式**: 
    - 問題文
    - 選択肢（5つ）
    - 正解（1〜5の番号）
    - 解説（なぜその選択肢が正解で、他が間違いか）
3.  **出力**: JSON形式
    {
      "questions": [
        {
            "question_text": "...",
            "options": ["...", "...", "...", "...", "..."],
            "correct_answer": 1,
            "explanation": "..."
        }
      ]
    }
4.  **内容**: 少年法、更生保護、矯正施設、保護観察など、テキストに含まれる重要キーワードを使ってください。
"""


async def generate():
    if not os.path.exists(PDF_PATH):
        print(f"PDF not found: {PDF_PATH}")
        return

    # Extract Text
    try:
        reader = PdfReader(PDF_PATH)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
    except Exception as e:
        print(f"PDF Read Error: {e}")
        return

    print(f"Extracted {len(text)} chars from PDF.")
    print(f"Preview: {text[:500]}")

    # Split text if too long (approx 4000 chars per chunk to get more questions)
    # Smaller chunks = more specific questions
    chunk_size = 4000
    chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
    print(f"Split into {len(chunks)} chunks.")

    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    questions = []

    semaphore = asyncio.Semaphore(10)  # Concurrency

    async def process_chunk(chunk, idx):
        if len(chunk) < 500:
            return []
        async with semaphore:
            try:
                # Ask for 3 questions per small chunk -> Total should cover 40 easily
                prompt = f"以下のテキスト範囲から、社会福祉士国家試験レベルの問題を3問作成してください。\n\nテキスト:\n{chunk}"
                response = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7,
                )
                res_json = json.loads(response.choices[0].message.content)
                qs = res_json.get("questions", [])
                print(f"Chunk {idx}: Generated {len(qs)}")
                return qs
            except Exception as e:
                print(f"Chunk {idx} Error: {e}")
                return []

    tasks = [process_chunk(chunk, i) for i, chunk in enumerate(chunks)]
    results = await asyncio.gather(*tasks)

    for res in results:
        questions.extend(res)

    print(f"Total Generated: {len(questions)}")

    # Limit to ~50 if too many, or keep all
    formatted = []

    for q in questions:
        # Validate options
        opts = q.get("options", [])
        if len(opts) != 5:
            # Try to fix or skip
            if len(opts) < 5:
                continue
            opts = opts[:5]

        formatted.append(
            {
                "id": f"gen_criminal_{uuid.uuid4().hex[:8]}",
                "questionText": q.get("question_text") or q.get("questionText"),
                "options": opts,
                "correctAnswer": str(q.get("correct_answer")),
                "explanation": q.get("explanation"),
                "group": "common_social",
                "categoryLabel": "刑事司法と福祉",
                "year": "2025_prediction",
                "type": "prediction",
                "isMastered": False,
                "quality_score": 4,  # Assume high quality from GPT-4o
            }
        )

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(formatted, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(formatted)} questions to {OUTPUT_JSON}")


if __name__ == "__main__":
    asyncio.run(generate())
