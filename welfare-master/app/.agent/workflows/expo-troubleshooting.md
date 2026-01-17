---
description: Expo Go で「白くるくる（Opening project でフリーズ）」が発生した場合のトラブルシューティング手順
---

# Expo Go 白画面トラブルシューティング ゴールデンルール

## 🚨 症状
- スマホの Expo Go で QR コードをスキャンしても「Opening project」で止まる
- PC のブラウザでは動くのにスマホでは動かない
- 赤いエラー画面が一瞬出て消える
- ポートを切り替えようとするとコマンドが通らずシステムが固まる

---

## 🔍 チェックリスト（上から順に確認）

### 1. SDK バージョンの確認（最重要）
```bash
# Expo Go アプリを開いて「Supported SDKs」を確認
# 例: SDK 54 のみサポートの場合、プロジェクトも SDK 54 にする必要がある
```

**確認方法:**
1. スマホの Expo Go アプリを開く
2. トップ画面に「Supported SDKs: XX」と表示される
3. `app.config.ts` に `sdkVersion` を明示的に設定:
```typescript
export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    sdkVersion: "54.0.0",  // Expo Go がサポートするバージョンに合わせる
    // ...
});
```

4. `package.json` の `expo` バージョンも合わせる:
```bash
npx expo install expo@~54.0.0 --fix
```

### 2. 必須依存関係の確認
SDK 54 の場合、以下が必須:
```bash
npx expo install react-native-web react-dom @expo/metro-runtime react-native-svg
```

**注意**: 依存関係エラーでインストールできない場合（npm error ERESOLVE など）、`--legacy-peer-deps` を試す:
```bash
npm install @expo/metro-runtime --legacy-peer-deps
```
特に `@expo/metro-runtime` が `package.json` に含まれていないと、SDK 54 ではWeb/Metro関連で黙って失敗することがある。

Reanimated を使う場合:
```bash
npm install react-native-worklets --legacy-peer-deps
```

### 3. ネイティブモジュールの Web 互換性
`expo-sqlite` などのネイティブモジュールは Web 環境で動かない。
**解決策**: 動的ロードで Web を除外する:
```typescript
import { Platform } from 'react-native';

const getDb = () => {
    if (Platform.OS === 'web') return null;
    
    try {
        const { openDatabaseSync } = require('expo-sqlite');
        const { drizzle } = require('drizzle-orm/expo-sqlite');
        // ...
    } catch (e) {
        console.error("Failed to load native module:", e);
        return null;
    }
};
```

### 4. データベーステーブルの作成
SQLite を使う場合、テーブル作成を初期化時に行う:
```typescript
const createTables = async () => {
    if (!expoDb) return;
    await expoDb.execAsync(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY NOT NULL,
        -- ...
      );
    `);
};

export const initializeDb = async () => {
    await createTables();  // クエリ前にテーブル作成
    // ...
};
```

### 5. Reanimated/Worklets バージョン不一致
**エラー**: `Mismatch between JavaScript part and native part of Worklets`

**原因**: Expo Go に組み込まれている Worklets のバージョンと、プロジェクトのバージョンが異なる

**一時的な解決策**: `babel.config.js` で Reanimated を無効化:
```javascript
module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
        ],
        plugins: [
            // "react-native-reanimated/plugin",  // 一時的に無効化
        ],
    };
};
```

### 6. expo-dev-client の削除
Expo Go を使う場合、`expo-dev-client` は不要であり、競合の原因になる:
```bash
npm uninstall expo-dev-client
```

`app.config.ts` の `plugins` からも削除する。

### 7. ネットワーク接続の確認
スマホのブラウザで `http://[PC_IP]:8081` を開いてみる:
- **表示される**: ネットワークは OK、アプリのビルドに問題がある
- **表示されない**: ファイアウォールまたはネットワーク設定の問題

**Windows Firewall の設定**:
1. `Windows セキュリティ` → `ファイアウォールとネットワーク保護`
2. `アプリにファイアウォール経由の通信を許可する`
3. `Node.js JavaScript Runtime` にプライベート/パブリックの両方でチェック

### 8. Expo ログインプロンプトの回避
`--offline` フラグを使用:
```bash
npx expo start --clear --offline
```

---

## 🛠️ トラブルシューティングの順序

1. **ターミナルのログを確認**: `Bundling` が始まっているか？
2. **PC ブラウザで確認**: `http://localhost:8081` が表示されるか？
3. **スマホのブラウザで確認**: `http://[PC_IP]:8081` が表示されるか？
4. **エラーメッセージを読む**: 赤画面のエラーは重要な手がかり
5. **SDK バージョンを確認**: Expo Go のサポート SDK と一致しているか？

---

## 📋 よく使うコマンド

```bash
# キャッシュクリアして起動（オフラインモード）
npx cross-env APP_VARIANT=social npx expo start --clear --offline

# 依存関係を SDK に合わせて修正
npx expo install --fix

# 特定バージョンの Expo をインストール
npx expo install expo@~54.0.0

# Node プロセスを強制終了（Windows）
taskkill /F /IM node.exe
```

---

## 🎯 ゴールデンルール

1. **Expo Go の SDK バージョンを最初に確認する**
2. **ネイティブモジュールは動的ロードで Web を除外する**
3. **データベースはテーブル作成を初期化時に行う**
4. **エラーが出たら PC ブラウザのコンソールを確認する**
5. **ネットワーク問題は `--offline` + LAN で回避する**
