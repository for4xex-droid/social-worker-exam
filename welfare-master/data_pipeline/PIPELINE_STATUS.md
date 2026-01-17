# データパイプライン 作業サマリー

## 現在のステータス: � 停止中 (11:00 AM 確認)

### 実行中のプロセス
- **スクリプト**: `data_pipeline/generate_mental_large.py`
- **目的**: PDF教科書（精神保健福祉士専門）からAIを使って問題（約1600問想定）を自動生成する。
- **保存先**: `app/public/mental_special_generated.json`
- **進捗管理**: `data_pipeline/mental_gen_progress.json`

### 最新の成果
- **共通科目**: 生成済み、アプリ実装済み (`common_social`)
- **精神専門**: 現在生成中。
    - PDFを15ページごとに分割し、Gemini 2.5/1.5 FlashでOCR・問題生成。
    - 「選択X」形式の正答データの自動補正ロジック実装済み。

## 次のステップ (生成完了後)
1. 生成された `mental_special_generated.json` の内容を最終確認する。
2. `master_data.json` に正式にマージする（現在は追記モードで書かれているため、そのまま使える可能性が高いが、重複IDチェックなどを行う）。
3. アプリを再起動 (`FORCE_RESET=true`) し、問題が表示されるか確認する。

## ファイル構成
- `generate_mental_large.py`: メイン生成スクリプト（リトライ・復帰機能付き）
- `inspect_special_generated.py`: 生成データの品質検査ツール
- `mental_gen_progress.json`: 生成進捗ログ

## メンテナンスメモ
- スクリプトが停止した場合でも、再度実行すれば `mental_gen_progress.json` を読み込んで途中から再開される。
- 生成データは `app/public/mental_special_generated.json` に逐次保存される。
