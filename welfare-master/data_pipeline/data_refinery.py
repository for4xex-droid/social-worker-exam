import json
import time
import os
import google.generativeai as genai
from tqdm import tqdm
from dotenv import load_dotenv

# .envファイルの読み込み
load_dotenv()

# ==========================================
# 設定エリア
# ==========================================

# Gemini APIキー
API_KEY = os.environ.get("GEMINI_API_KEY")

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
# システム初期化
# ==========================================

if not API_KEY:
    print("Error: GEMINI_API_KEY environment variable is not set.")
    exit(1)

genai.configure(api_key=API_KEY)
# コストと速度のバランスが良い Flash モデルを指定
model = genai.GenerativeModel("gemini-2.0-flash-exp")


def generate_cleaned_data(question_data, group_id):
    """
    カテゴリ(group_id)に応じて、最適なプロンプトでGeminiを呼び出す
    """

    # -------------------------------------------------------
    # パターンA: 過去問の場合 (past_social, past_mental)
    # 戦略: 問題文は維持(精度優先)、解説はフルリライト(権利回避 & 初心者向け)
    # -------------------------------------------------------
    if "past" in group_id:
        prompt = f"""
        あなたは社会福祉士・精神保健福祉士国家試験の「解説作成のプロ」です。
        以下の「過去問データ」をもとに、アプリ掲載用のデータを作成してください。

        【入力データ】
        元の問題: {question_data.get("question", "")}
        元の解説: {question_data.get("explanation", "")}
        選択肢: {question_data.get("options", [])}
        正解: {question_data.get("correct_answer", "")}

        【指示】
        1. **問題文**: 過去問なので、原則として「原文のまま」出力してください。（明らかな誤字のみ修正可）
        2. **解説**: 元の解説を参考にしつつ、**完全に自分の言葉で、初心者にもわかるように**書き直してください。
           - 専門用語には簡単な補足をいれること。
           - 文体は「〜です」「〜だよ」など、柔らかいトーンに統一すること。
           - **絶対に元の解説のコピペにならないようにすること。**
        
        【出力JSON形式】
        {{
            "question_text": "問題文(原文維持)...",
            "explanation": "AIオリジナルのわかりやすい解説...",
            "options": ["選択肢1", "選択肢2"...],
            "correct_answer": ["正解選択肢"] (配列形式で)
        }}
        """

    # -------------------------------------------------------
    # パターンB: 予想問題の場合 (common, spec_social, spec_mental)
    # 戦略: 全てをリライト・事例化して「オリジナル問題」に変換する
    # -------------------------------------------------------
    else:
        prompt = f"""
        あなたは国家試験の「作問委員」です。
        以下のテキストデータ（市販テキスト等の内容）をベースに、**著作権を侵害しないオリジナルの予想問題**を作成してください。

        【入力データ】
        元テキスト/問題: {question_data.get("question", "")}
        元の解説/知識: {question_data.get("explanation", "")}

        【指示】
        1. **著作権洗浄**: 元の文章表現は全て捨ててください。「問われている知識(Fact)」だけを抽出してください。
        2. **再構築**: その知識を問うための、**新しい「事例問題（Aさんは〜）」**を作成してください。
        3. **解説**: その事例に沿った、学習効果の高い解説を作成してください。
        
        【出力JSON形式】
        {{
            "question_text": "Aさんは...(事例形式の新しい問題文)",
            "explanation": "正解は...。なぜなら...(新しい解説)",
            "options": ["新しい選択肢1", "選択肢2"...],
            "correct_answer": ["正解選択肢"] (配列形式で)
        }}
        """

    # API呼び出し
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                prompt, generation_config={"response_mime_type": "application/json"}
            )
            result = json.loads(response.text)

            # 共通フィールドの付与
            result["id"] = str(
                question_data.get("id", hash(result["question_text"]))
            )  # ID維持または生成
            result["group"] = group_id
            result["year"] = question_data.get("raw_year", None)  # 年度がなければnull
            result["category_label"] = question_data.get(
                "raw_category", "一般"
            )  # 元の細かい科目名

            # is_free フラグの設定ロジック (例: 令和4年度のみ無料)
            # yearの文字列に "令和4年度" が含まれていれば無料とするサンプル
            years = result["year"] if result["year"] else ""
            if (
                "令和4" in years or "2022" in years
            ):  # Adjust based on your actual year string format
                result["is_free"] = True
            else:
                result["is_free"] = False

            return result

        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2)  # Wait before retry
                continue
            print(f"\n[Error] ID: {question_data.get('id')} の処理中にエラー: {e}")
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
    print("データ精錬プロセスを開始します...\n")

    processed_data = []

    # 途中再開用のロジック
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                processed_data = json.load(f)
            # 既存データのIDをセットに格納（重複処理防止）
            processed_ids = {str(item["id"]) for item in processed_data}
            print(f"既存のデータ {len(processed_data)} 件をスキップします。")
        except:
            processed_ids = set()
    else:
        processed_ids = set()

    # プログレスバー付きでループ処理
    for item in tqdm(raw_data, desc="Processing"):
        # すでに処理済みならスキップ
        if str(item.get("id")) in processed_ids:
            continue

        # カテゴリの判定
        raw_category = item.get("category_group")

        # マッピング（辞書にないカテゴリは 'common' 扱い）
        group_id = CATEGORY_MAPPING.get(raw_category, "common")

        # Geminiによる生成
        cleaned_item = generate_cleaned_data(item, group_id)

        if cleaned_item:
            processed_data.append(cleaned_item)
            processed_ids.add(str(cleaned_item["id"]))  # 処理済みIDに追加

            # 安全のため、10問ごとにファイルに書き出す
            if len(processed_data) % 10 == 0:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(processed_data, f, ensure_ascii=False, indent=2)

        time.sleep(1.2)

    # 最終保存
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(processed_data, f, ensure_ascii=False, indent=2)

    print(f"\n全処理完了！ {OUTPUT_FILE} に保存されました。")


if __name__ == "__main__":
    main()
