import os
import json
import asyncio
import uuid
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
OUTPUT_JSON = "data_pipeline/additional_criminal.json"

SYSTEM_PROMPT = """
あなたは社会福祉士国家試験の熟練した作問委員です。
『刑事司法と福祉』科目の模擬問題を作成してください。

条件:
1. 国家試験レベルの難易度。
2. 5肢択一形式。
3. 正解番号(1-5)と詳細な解説を含める。
4. 出力はJSON形式。
{
    "questions": [
        {
            "question_text": "...",
            "options": ["...", "...", ...],
            "correct_answer": 1,
            "explanation": "..."
        }
    ]
}
"""

TOPICS = [
    "更生保護制度（保護観察所の役割）",
    "保護司の職務と法的地位",
    "仮釈放の要件とプロセス",
    "生活環境の調整（調整担当官）",
    "更生緊急保護の対象と内容",
    "少年法（処分決定プロセス）",
    "触法障害者支援（地域生活定着支援センター）",
    "心神喪失者等医療観察法",
    "刑事施設（刑務所・少年刑務所）における処遇",
    "司法ソーシャルワークの役割",
]


async def generate():
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    all_questions = []

    async def gen_topic(topic):
        prompt = f"トピック「{topic}」について、質の高い試験問題を4問作成してください。"
        try:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            res = json.loads(response.choices[0].message.content)
            return res.get("questions", [])
        except Exception as e:
            print(f"Error {topic}: {e}")
            return []

    # Run sequentially or parallel (Parallel is faster)
    tasks = [gen_topic(t) for t in TOPICS]
    results = await asyncio.gather(*tasks)

    for res in results:
        all_questions.extend(res)

    print(f"Generated {len(all_questions)} questions via Fallback Strategy.")

    formatted = []
    for q in all_questions:
        formatted.append(
            {
                "id": f"gen_criminal_fallback_{uuid.uuid4().hex[:8]}",
                "questionText": q.get("question_text") or q.get("questionText"),
                "options": q.get("options", [])[:5],
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
    print(f"Saved to {OUTPUT_JSON}")


if __name__ == "__main__":
    asyncio.run(generate())
