import json
import os
import sys
import time
import concurrent.futures
from openai import OpenAI
from dotenv import load_dotenv

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding="utf-8")

# --- PATH & CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
TARGET_FILE = os.path.join(
    PROJECT_ROOT, "app", "public", "mental_special_generated.json"
)

# Load Env
# Try multiple locations for .env
env_locations = [
    os.path.join(BASE_DIR, ".env"),
    os.path.join(PROJECT_ROOT, ".env"),
    os.path.join(PROJECT_ROOT, "data_pipeline", ".env"),
]

api_key = None
for env_path in env_locations:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            print(f"Loaded API key from {env_path}")
            break

if not api_key:
    # Fallback to process env if already set
    api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("FATAL: OPENAI_API_KEY not found. Please check your .env file.")
    sys.exit(1)

client = OpenAI(api_key=api_key)


def generate_explanation(question):
    q_text = question.get("question_text", "")
    options = question.get("options", [])
    correct = question.get("correct_answer", [])

    # Skip if barely any content
    if len(q_text) < 5:
        return None

    options_str = "\n".join([f"- {opt}" for opt in options])
    correct_str = ", ".join(correct) if isinstance(correct, list) else str(correct)

    prompt = f"""
あなたは精神保健福祉士国家試験専門のAI講師です。
以下の問題に対する「わかりやすい解説」を作成してください。

【問題】
{q_text}

【選択肢】
{options_str}

【正解】
{correct_str}

【指示】
- 正解の根拠と、他の選択肢がなぜ間違いなのかを簡潔に説明してください。
- 冒頭に「解説:」などのラベルは不要です。
- 文字数は300文字以内。
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful tutor."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenAI Error: {e}")
        return None


def main():
    print(f"Loading {TARGET_FILE}...")
    if not os.path.exists(TARGET_FILE):
        print("Target file not found.")
        return

    with open(TARGET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Filter target questions
    targets = []
    for q in data:
        gid = q.get("group_id", "")
        exp = q.get("explanation", "")
        # 条件: spec_mental グループかつ、解説がない(または短い)
        if gid == "spec_mental" and (not exp or len(exp) < 10 or exp == "解説なし"):
            targets.append(q)

    total = len(targets)
    print(f"Found {total} questions needing explanation.")

    if total == 0:
        print("All done!")
        return

    # Process in parallel (GPT-4o-mini is fast, so 8 threads should be fine)
    print("Generating explanations with OpenAI (Parallel=8)...")
    completed = 0
    save_interval = 20

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        future_map = {executor.submit(generate_explanation, q): q for q in targets}

        for future in concurrent.futures.as_completed(future_map):
            q = future_map[future]
            try:
                result = future.result()
                if result:
                    q["explanation"] = result
                    completed += 1
                else:
                    print(f"Failed to gen for {q.get('id')}")
            except Exception as e:
                print(f"Error for {q.get('id')}: {e}")

            if completed % 10 == 0:
                print(f" Progress: {completed}/{total}")

            if completed % save_interval == 0 and completed > 0:
                with open(TARGET_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

    # Final save
    with open(TARGET_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Done! Updated {completed} explanations.")


if __name__ == "__main__":
    main()
