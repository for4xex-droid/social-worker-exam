"""
Generate explanations for past exam questions using OpenAI GPT-4o-mini.
This script processes questions that are missing explanations and saves progress incrementally.
"""

import json
import os
import time
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

# Configuration
TARGET_FILE = (
    Path(__file__).parent.parent / "app" / "assets" / "past_social_complete.json"
)
PROGRESS_FILE = Path(__file__).parent / "explanation_progress.json"
MODEL = "gpt-4o-mini"
MAX_RETRIES = 3
DELAY_BETWEEN_CALLS = 1.0  # seconds

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("FATAL: OPENAI_API_KEY not found in .env")
    exit(1)

client = AsyncOpenAI(api_key=api_key)

SYSTEM_PROMPT = """あなたは社会福祉士国家試験の専門講師です。
受験生が理解しやすいように、問題の解説を作成してください。

解説の作成ルール：
1. まず正解の選択肢を明示する
2. なぜその選択肢が正解なのかを説明する
3. 他の選択肢が不正解である理由も簡潔に説明する
4. 関連する法律や制度があれば言及する
5. 受験生が覚えやすいポイントを最後にまとめる
6. 200〜400文字程度で簡潔にまとめる
"""


async def generate_explanation(question: dict) -> str:
    """Generate explanation for a single question."""

    # Build the question text
    q_text = question.get("question_text", "")
    options = question.get("options", [])
    correct = question.get("correct_answer", [])

    # Format options
    options_text = "\n".join([f"{i + 1}. {opt}" for i, opt in enumerate(options)])

    # Format correct answer
    if isinstance(correct, list):
        correct_str = ", ".join([str(c) for c in correct])
    else:
        correct_str = str(correct)

    user_prompt = f"""以下の問題の解説を作成してください。

【問題】
{q_text}

【選択肢】
{options_text}

【正解】
{correct_str}

解説を作成してください。"""

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=500,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"  Error (attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(2**attempt)

    return ""


async def main():
    print("Loading questions...")

    with open(TARGET_FILE, "r", encoding="utf-8") as f:
        questions = json.load(f)

    # Find questions without explanations
    to_process = []
    for i, q in enumerate(questions):
        expl = q.get("explanation", "")
        if not expl or len(expl) <= 30 or "準備中" in expl:
            to_process.append((i, q))

    print(f"Found {len(to_process)} questions without explanations.")

    if not to_process:
        print("All questions have explanations. Nothing to do.")
        return

    # Load progress
    processed_ids = set()
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            processed_ids = set(json.load(f))
        print(f"Resuming from previous progress: {len(processed_ids)} already done.")

    # Filter out already processed
    to_process = [(i, q) for i, q in to_process if q.get("id") not in processed_ids]
    print(f"Remaining to process: {len(to_process)}")

    # Process
    for idx, (orig_idx, q) in enumerate(to_process):
        q_id = q.get("id", f"idx_{orig_idx}")
        print(f"[{idx + 1}/{len(to_process)}] Generating explanation for {q_id}...")

        explanation = await generate_explanation(q)

        if explanation:
            questions[orig_idx]["explanation"] = explanation
            processed_ids.add(q_id)
            print(f"  ✓ Generated ({len(explanation)} chars)")
        else:
            print(f"  ✗ Failed")

        # Save progress every 5 questions
        if (idx + 1) % 5 == 0:
            with open(TARGET_FILE, "w", encoding="utf-8") as f:
                json.dump(questions, f, ensure_ascii=False)
            with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
                json.dump(list(processed_ids), f)
            print(f"  [Progress saved: {len(processed_ids)} done]")

        await asyncio.sleep(DELAY_BETWEEN_CALLS)

    # Final save
    with open(TARGET_FILE, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(list(processed_ids), f)

    print(f"\nComplete! Generated explanations for {len(processed_ids)} questions.")
    print(f"Output saved to: {TARGET_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
