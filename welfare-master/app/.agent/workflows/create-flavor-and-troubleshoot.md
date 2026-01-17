---
description: 新しい資格アプリ（フレーバー）を作成・切り替えし、Expo Goで実機確認する際の手順とトラブルシューティング
---

# 新規フレーバー作成と実機デバッグの指針

社会福祉士版から、精神保健福祉士版・介護福祉士版へ開発を切り替える際の「成功パターン」を記録します。

## 1. フレーバーの定義 (app.config.ts)
コードベースは1つのまま、環境変数 `APP_VARIANT` によってアプリ名や識別子を切り替えます。

1.  `app.config.ts` を開き、`social`, `mental`, `care` に対応する設定（アプリ名、Slug、Scheme、Primary Color）が定義されているか確認する。
2.  `app.json` は使用せず、動的な `app.config.ts` が優先されるようにする。

## 2. 起動スクリプトの準備 (package.json)
Windows環境での環境変数設定とキャッシュクリアを確実に行うため、`scripts` に以下を追加します。

```json
"scripts": {
  // Web版（ポートを分ける）
  "web:care": "cross-env APP_VARIANT=care expo start --web --port 8088 --clear",
  // モバイル版
  "care": "cross-env APP_VARIANT=care expo start --clear"
}
```

## 3. 実機デバッグの障壁と突破法 (Opening project 問題)
ここが最大の難関です。Expo Go で QR コードを読み込んでも「Opening project...」で止まってしまう現象が多発します。

**原因:**
PC のファイアウォールが通信をブロックしている、または外部ネットワーク（Expo サーバー）との通信でタイムアウトしている。

**【解決策: 鉄板フロー】**

1.  **オフラインモードで起動する (最強の解決策)**
    外部サーバーへの接続をスキップし、LAN 内接続のみに集中させることで即座に解決します。
    ```bash
    npm run care -- --offline
    # 実体: cross-env APP_VARIANT=care expo start --clear --offline
    ```

2.  **ファイアウォールの穴あけ**
    Windows の「ファイアウォールとネットワーク保護」→「アプリにファイアウォール経由の通信を許可する」で `Node.js JavaScript Runtime` をプライベート/パブリック共に許可する。

3.  **ポートの変更**
    前のプロセスが残っている場合、「ポート 8081 が使われています」と出るので、素直に `Y` を押して 8082 等に変更する。

## 4. 介護福祉士版を作る時のチェックリスト
- [ ] `app.config.ts` に `care` の設定があるか確認。
- [ ] `package.json` に `care` 用のスクリプトがあるか確認。
- [ ] **初回は必ず `--offline` をつけて起動する**（トラブル防止）。
- [ ] スマホ側でサーバーが見つからない場合は、手動で `exp://[PC_IP]:[PORT]` を入力する。
