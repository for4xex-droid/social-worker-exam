# 社会福祉士アプリ 問題・データベース仕様書
**Status:** FIXED (2026-01-18)

本ドキュメントは、社会福祉士国家試験対策アプリ（`social` バリアント）における問題データの構造、管理フロー、およびアプリ内での出題ロジックの確定仕様をまとめたものである。

## 1. データベースアーキテクチャ

### 1-1. 技術スタック
| プラットフォーム | DBエンジン | ORM | 特徴 |
| :--- | :--- | :--- | :--- |
| **Native (iOS/Android)** | `expo-sqlite` | `drizzle-orm` | デバイスストレージに永続化。初回起動時にアセットからシード。 |
| **Web** | `sql.js` (WASM) | `drizzle-orm` | ブラウザメモリ上で動作。起動ごとに `public/` のJSONからロード。 |

### 1-2. テーブルスキーマ (`questions`)
主要なカラムのみ抜粋。
- `id` (TEXT): 一意の識別子。
- `group_id` (TEXT): 問題の分類コード。
- `question_text` (TEXT): 問題文。
- `correct_answer` (TEXT): 正解データ。
- `category_label` (TEXT): 科目名（例：「人体の構造と機能及び疾病」）。
- `year` (TEXT): 出題年度（例：「令和6年度」）。
- `is_mastered` (INTEGER): 習熟フラグ。

## 2. データパイプラインとアセット管理

### 2-1. マスターデータ
すべての問題データは `data_pipeline/master_database_v2_final.json` に集約されている。

### 2-2. アセット生成フロー (`update_native_assets.py`)
このスクリプトがマスターデータを処理し、Native/Web用のファイルを生成する。

1.  **カテゴリ名の正規化**
    *   旧カリキュラムの長い科目名を、新カリキュラム準拠の名称に統一（例：「児童や家庭に対する支援と児童・家庭福祉制度」→「児童・家庭福祉」）。

2.  **グループ分類と出力**
    | 分類 | グループ条件 | アセットファイル (Native) | アセットファイル (Web) | ノート |
    | :--- | :--- | :--- | :--- | :--- |
    | **共通科目** | `common`, `common_social` | `assets/separated_db/master_common.json` | `public/web_common.json` | 全員がアクセス可能。 |
    | **専門科目** | `spec_social` | `assets/separated_db/master_social.json` に統合 | `public/web_spec_social_v3.json` | 課金ロック対象。 |
    | **過去問** | `past_social` (年度別含む) | `assets/separated_db/master_social.json` に統合 | `public/web_past_social.json` | 過去3年分 (R4-R6)。 |

### 2-3. アプリケーションによるロード
*   **Native (`client.native.ts`):** `master_social.json`（専門＋過去問）と `master_common.json`（共通）の両方を読み込み、SQLiteにInsertする。
*   **Web (`client.web.ts`):** `web_common.json`, `web_spec_social_v3.json`, `web_past_social.json` を順次FetchしてInsertする。
*   **重複防止策:** Web用ファイル生成時に、過去問データが専門科目ファイルに混入しないよう厳密に分離されている。

## 3. アプリ内出題ロジック

### 3-1. デイリーミッション (Daily Quests)
*   **目的:** 毎日の学習習慣の定着。
*   **出題対象:** **共通科目 (`common` 系)** のみ。
    *   除外: 専門科目 (`spec_`), 過去問 (`past_`)。
*   **リセットタイミング:** 毎日 **AM 4:00 (JST)**。
    *   進捗判定ロジックにて、現在時刻から4時間を引いた日付を基準日として使用。

### 3-2. 模擬試験 (Mock Exams)
*   **対象:** 過去3年分（令和4〜令和6年度）の過去問すべて。
*   **表示:** `Folders` 画面にて、問数 (`questionCount`) と習熟数 (`masteredCount`) を表示。
*   **Web互換性:** 開始確認ダイアログにて、Nativeの `Alert` と Webの `window.confirm` を環境に応じて使い分ける。

### 3-3. 苦手克服 (Weakness)
*   間違えた問題（`user_progress` テーブル参照）から出題。

## 4. メンテナンス手順

### データの更新
1.  `data_pipeline/` 下のPythonスクリプトでデータを整備。
2.  `update_native_assets.py` を実行して JSON ファイル群を更新。
3.  Web版はデプロイで即反映。
4.  Native版はアプリのアップデートが必要（またはCodePush的な更新）。
    *   **DB強制リセット:** データ構成が大きく変わった場合、`client.native.ts` の `FORCE_RESET` フラグにてローカルDBを再構築可能。

---
**File Locations:**
- Logic: `app/app/(tabs)/index.tsx` (Daily Mission), `app/app/folders/[group].tsx` (Mock Exam)
- DB Client: `app/db/client.native.ts`, `app/db/client.web.ts`
- Pipeline: `data_pipeline/update_native_assets.py`
