import json
import time
import os
import random
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
INPUT_FILE = "raw_kaigo_questions_clean.json"

# 出力ファイル名
OUTPUT_FILE = "master_database.json"

# カテゴリのマッピング設定
CATEGORY_MAPPING = {
    "共通": "common",
    "専門（社会）": "spec_social",
    "専門（精神）": "spec_mental",
    "過去問（社会）": "past_social",
    "過去問（精神）": "past_mental",
    "過去問（介護）": "past_kaigo",
}

# ==========================================
# システム初期化
# ==========================================

print(f"Loaded OpenAI API Key.")


def generate_cleaned_data(question_data, group_id):
    """
    カテゴリ(group_id)に応じて、最適なプロンプトでOpenAI (GPT-4o-mini) を呼び出す
    """

    # プロンプト作成
    if "past" in group_id:
        exam_type = (
            "介護福祉士" if "kaigo" in group_id else "社会福祉士・精神保健福祉士"
        )
        system_prompt = f"""
        あなたは{exam_type}国家試験の「解説作成のプロ」です。
        入力される「過去問データ」をもとに、アプリ掲載用の構造化データを作成してください。
        解説は学習者が理解しやすいように、あなたの言葉で丁寧に書き直してください。
        """
        user_prompt = f"""
        【入力データ】
        元の問題: {question_data.get("question", "")}
        元の解説: {question_data.get("explanation", "")}
        選択肢: {question_data.get("options", [])}
        正解: {question_data.get("correct_answer", "")}

        【指示】
        1. **問題文**: 過去問なので、原則として「原文のまま」出力してください。（明らかな誤字のみ修正可）
        2. **解説**: 元の解説を参考にしつつ、**完全に自分の言葉で、初心者にもわかるように**書き直してください。
           - 専門用語には簡単な補足をいれること。
           - **重要なキーワードやポイントは `**` で囲んで太字にしてください。**
           - **特に覚えたい専門用語は `【】` で囲んで強調してください。**
           - 文体は「〜です」「〜だよ」など、柔らかいトーンに統一すること。
           - **絶対に元の解説のコピペにならないようにすること。**
        
        【出力JSON形式】
        {{
            "question_text": "問題文(原文維持)...",
            "explanation": "AIオリジナルのわかりやすい解説...ここが**重要**です。これは【専門用語】です。",
            "options": ["選択肢1", "選択肢2"...],
            "correct_answer": ["正解選択肢"] (配列形式で)
        }}
        """
    else:
        system_prompt = """
        あなたは国家試験の「作問委員」です。
        入力されるテキストデータ（市販テキスト等の内容）をベースに、**著作権を侵害しないオリジナルの予想問題**を作成してください。
        """
        user_prompt = f"""
        【入力データ】
        元テキスト/問題: {question_data.get("question", "")}
        元の解説/知識: {question_data.get("explanation", "")}

        【指示】
        1. **著作権洗浄**: 元の文章表現は全て捨ててください。「問われている知識(Fact)」だけを抽出してください。
        2. **再構築**: その知識を問うための、**新しい「事例問題（Aさんは〜）」**を作成してください。
        3. **解説**: その事例に沿った、学習効果の高い解説を作成してください。
           - **重要なキーワードやポイントは `**` で囲んで太字にしてください。**
           - **特に覚えたい専門用語は `【】` で囲んで強調してください。**
        
        【出力JSON形式】
        {{
            "question_text": "Aさんは...(事例形式の新しい問題文)",
            "explanation": "正解は...。なぜなら...ここは**重要**です。これは【専門用語】です。",
            "options": ["新しい選択肢1", "選択肢2"...],
            "correct_answer": ["正解選択肢"] (配列形式で)
        }}
        """

    max_retries = 3
    base_wait = 2

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            # 共通フィールドの付与
            result["id"] = str(
                question_data.get("id", hash(result.get("question_text", "")))
            )
            result["group"] = group_id
            result["year"] = question_data.get("raw_year", None)
            result["category_label"] = question_data.get("raw_category", "一般")

            raw_year = result.get("year")
            if isinstance(raw_year, list):
                years_str = "".join(str(y) for y in raw_year)
            elif isinstance(raw_year, str):
                years_str = raw_year
            else:
                years_str = ""

            if "令和4" in years_str or "2022" in years_str:
                result["is_free"] = True
            else:
                result["is_free"] = False

            return result

        except Exception as e:
            error_msg = str(e)
            print(f"\n[Warning] Attempt {attempt + 1} failed: {error_msg}")

            wait_time = min(base_wait * (2**attempt), 30)
            time.sleep(wait_time)
            continue

    print(
        f"\n[Error] ID: {question_data.get('id')} Failed after {max_retries} attempts."
    )
    return None


# ==========================================
# メイン実行処理
# ==========================================


def main():
    # 1. データの読み込み
    if not os.path.exists(INPUT_FILE):
        print(f"エラー: {INPUT_FILE} が見つかりません。")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    print(f"読み込み完了: 全 {len(raw_data)} 問")
    print("データ精錬プロセスを開始します... (Engine: OpenAI GPT-4o-mini)\n")

    processed_data = []
    processed_ids = set()

    # 途中再開用のロジック
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                processed_data = json.load(f)
            # 既存データのIDをセットに格納（重複処理防止）
            processed_ids = {str(item["id"]) for item in processed_data}
            print(f"既存のデータ {len(processed_data)} 件をスキップします。")
        except Exception as e:
            print(f"[Warning] Failed to load existing data: {e}. Starting fresh.")
            processed_ids = set()

    # プログレスバー付きでループ処理
    for item in tqdm(raw_data, desc="Processing"):
        # すでに処理済みならスキップ
        if str(item.get("id")) in processed_ids:
            continue

        # カテゴリの判定
        raw_category = item.get("category_group")
        group_id = CATEGORY_MAPPING.get(raw_category, "common")

        # OpenAIによる生成
        cleaned_item = generate_cleaned_data(item, group_id)

        if cleaned_item:
            processed_data.append(cleaned_item)
            processed_ids.add(str(cleaned_item["id"]))

            # 安全のため、10問ごとにファイルに書き出す (OpenAIは安定しているので頻度少なめでOK)
            if len(processed_data) % 10 == 0:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(processed_data, f, ensure_ascii=False, indent=2)

        # OpenAIは高速なのでWaitは短めでOK
        time.sleep(0.1)

    # 最終保存
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(processed_data, f, ensure_ascii=False, indent=2)

    print(f"\n全処理完了！ {OUTPUT_FILE} に保存されました。")


if __name__ == "__main__":
    main()
