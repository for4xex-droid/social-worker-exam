import json
import time
import os
from tqdm import tqdm
from dotenv import load_dotenv
from openai import OpenAI

# .envファイルの読み込み
load_dotenv()

# ==========================================
# 設定エリア
# ==========================================

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("Error: OPENAI_API_KEY environment variable is not set.")
    exit(1)

client = OpenAI(api_key=OPENAI_API_KEY)

# 入力ファイル名
INPUT_FILE = "raw_questions.json"

# 出力ファイル名
OUTPUT_FILE = "master_database.json"

# カテゴリのマッピング設定
CATEGORY_MAPPING = {
    "共通": "common",
    "専門（社会）": "spec_social",
    "専門（精神）": "spec_mental",
    "過去問（社会）": "past_social",
    "過去問（精神）": "past_mental",
}

# ==========================================
# データ精錬ロジック (gpt-4oを使用)
# ==========================================


def generate_cleaned_data_high_quality(question_data, group_id):
    """
    gpt-4o を使用して、失敗した問題を確実に高精度で処理する
    """

    if "past" in group_id:
        system_prompt = """
        あなたは社会福祉士・精神保健福祉士国家試験の「解説作成のトッププロ」です。
        入力される過去問データをもとに、アプリ掲載用の最高品質な構造化データを作成してください。
        解説は学習者が非常に理解しやすいように、あなたの言葉で丁寧に書き直してください。
        """
        user_prompt = f"""
        【入力データ】
        元の問題: {question_data.get("question", "")}
        元の解説: {question_data.get("explanation", "")}
        選択肢: {question_data.get("options", [])}
        正解: {question_data.get("correct_answer", "")}

        【指示】
        1. **問題文**: 過去問なので、原則として「原文のまま」出力してください。
        2. **解説**: 元の解説を参考にしつつ、完全に自分の言葉で書き直してください。
           - **重要なキーワードやポイントは `**` で囲んで太字にしてください。**
           - **特に覚えたい専門用語は `【】` で囲んで強調してください。**
           - 文体は「〜です」「〜だよ」など、柔らかいトーンに統一してください。
        
        【出力JSON形式】
        {{
            "question_text": "問題文(原文維持)...",
            "explanation": "AIオリジナルのわかりやすい解説...",
            "options": ["選択肢1", "選択肢2"...],
            "correct_answer": ["正解選択肢"]
        }}
        """
    else:
        system_prompt = """
        あなたは国家試験の「主任作問委員」です。
        入力されるテキストデータをベースに、著作権を完全にクリアした高品質な「事例問題」を作成してください。
        """
        user_prompt = f"""
        【入力データ】
        元テキスト/問題: {question_data.get("question", "")}
        元の解説/知識: {question_data.get("explanation", "")}

        【指示】
        1. **著作権洗浄**: 内容(知識)のみを抽出し、全く新しい「事例問題（Aさんは〜）」を作成してください。
        2. **解説**: 学習効果の高い解説を作成してください。
           - **重要なキーワードは `**` 、専門用語は `【】` を使用してください。**
        
        【出力JSON形式】
        {{
            "question_text": "事例形式の新しい問題文...",
            "explanation": "解説文...",
            "options": ["選択肢1", "選択肢2"...],
            "correct_answer": ["正解選択肢"]
        }}
        """

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-4o",  # 強力なモデルを使用
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            # メタデータの付与
            result["id"] = str(question_data.get("id"))
            result["group"] = group_id
            result["year"] = question_data.get("raw_year", None)
            result["category_label"] = question_data.get("raw_category", "一般")

            # 無料フラグの判定 (令和4年/2022年なら無料)
            raw_year = str(result.get("year", ""))
            result["is_free"] = "令和4" in raw_year or "2022" in raw_year

            return result

        except Exception as e:
            print(
                f"[Warning] ID:{question_data.get('id')} Attempt {attempt + 1} failed: {e}"
            )
            time.sleep(5)
    return None


def main():
    if not os.path.exists(INPUT_FILE) or not os.path.exists(OUTPUT_FILE):
        print("エラー: 入出力ファイルが足りません。")
        return

    # 1. 現状の把握
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw_rows = json.load(f)
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        master_rows = json.load(f)

    master_ids = {str(item["id"]) for item in master_rows}
    missing_items = [item for item in raw_rows if str(item.get("id")) not in master_ids]

    if not missing_items:
        print("敗者は見つかりませんでした。全てのデータは精錬済みです。")
        return

    print(f"敗者復活戦を開始します。対象: {len(missing_items)} 問 (Model: gpt-4o)")

    revived_count = 0
    for item in tqdm(missing_items):
        raw_category = item.get("category_group")
        group_id = CATEGORY_MAPPING.get(raw_category, "common")

        # gpt-4oで叩く
        cleaned = generate_cleaned_data_high_quality(item, group_id)

        if cleaned:
            master_rows.append(cleaned)
            revived_count += 1
            # 1問ごとにこまめに保存
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(master_rows, f, ensure_ascii=False, indent=2)

        time.sleep(0.5)

    print(f"\n敗者復活戦 完了！ {revived_count} 問が救済されました。")
    print(f"最終 master_database.json 件数: {len(master_rows)}")


if __name__ == "__main__":
    main()
