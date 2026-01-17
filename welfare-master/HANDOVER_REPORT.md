# Handover Report: Welfare Master Project

## 🚧 次に取り組むタスク（優先度: 高）
1.  **【収益化】課金プロバイダー統合**:
    *   RevenueCat または Expo IAP を導入し、実際の決済処理を実装する。
    *   `app/constants/premium.ts` の TODO コメントに従って各関数を更新。
2.  **【横展開】別資格への移植**:
    *   `MASTER_FLOW_GUIDE.md` に従い、介護福祉士・精神保健福祉士、あるいは宅建などへの横展開を計画する。

---

## 最新ステータス (2026-01-13)

### ✅【完了】プレミアム状態管理の一元化 & ロック解除機能

本日のセッションで、課金前のロック状態に加え、課金後のロック解除、および **フラッシュカード学習フローの大幅な改善** を完了しました。

### ✅【完了】Web版ホワイトスクリーン問題の解決

Web版 (`npm run web`) で発生していた深刻なホワイトスクリーン（起動不可）問題を解決しました。

#### 原因と対策:
1.  **Stack Navigator の Web 非互換**: `_layout.tsx` で使用していた `Stack` コンポーネントが、Web環境下で特定のスタイル設定（特にNativeWindとの兼ね合い）と競合し、レンダリングをブロックしていました。
    *   **対策**: `Platform.OS === 'web'` の場合のみ `Stack` ではなく `Slot` を使用する分岐を `_layout.tsx` に導入。さらに `maxWidth: 600` 等のレスポンシブ制約を追加。
2.  **DB初期化のトップレベル実行**: `client.web.ts` で `sql.js` や DBデータをロードする処理が、バンドル読み込み時に実行され、エラー発生時にアプリ全体をクラッシュさせていました。
    *   **対策**: `sql.js` を `await import` （動的インポート）に変更し、トップレベルでのモジュール依存を排除。初期化は `_layout.tsx` の `useEffect` 内で行うように変更。
3.  **UIライブラリの互換性**: `LinearGradient` など一部NativeコンポーネントがWebで正しく表示されていませんでした。
    *   **対策**: `onboarding.tsx` などをWeb互換のスタイル（View + CSS色指定）に修正。

現在、`http://localhost:8086` でWeb版が正常に起動・動作することを確認済みです。
（UIのレイアウト崩れ等は残タスクとして「Web版UI調整」フェーズで対応予定）

⚠️ **残課題 (Web版)**:
*   ホーム画面で「AI予想問題・0冊」と表示される（データが正しくカウントされていない）。`client.web.ts` でのデータ挿入と、`useBookshelf.ts` でのクエリ条件（`group_id`等）の突合が必要。現在はDB初期化タイミングのずれか、JSONデータのキーマッピング問題の可能性が高い。次のUI調整フェーズで最優先対応する。

### ✅【完了】フラッシュカード学習フローの改善

ユーザーフィードバックに基づき、学習体験を最適化しました。

#### 1. 「苦手克服」モードの仕様変更
*   **全範囲一括出題**: 特定の単語帳を選ぶのではなく、全単語帳から「学習済み かつ 苦手（proficiency < 3）」な問題を一括で出題するように変更。
*   **未学習の除外**: まだ一度も学習していない問題が「苦手」に含まれないようにクエリを厳格化。

#### 2. 学習ステータス判定の調整
*   **即マスター判定**: 「覚えた！」を選択した場合、SRS（分散学習）を待たずに即座に `isMastered = true` (proficiency=5) になるよう変更。「マスター復習」に即反映されます。
*   **ステータス反映の即時化**: `useFocusEffect` を導入し、学習画面から戻った直後にホーム画面の数値（未学習数、苦手数など）が更新されるように修正。ラグを解消しました。

### ✅【完了】プレミアム状態管理の一元化 & ロック解除機能

#### 達成事項:

1.  **`usePremium()` フックの実装 (`app/constants/premium.ts`)**:
    *   全画面で使用できる専用Reactフックを追加。
    *   画面フォーカス時に自動で状態を更新。
    *   購入完了時に全画面へ自動通知（カスタムサブスクライバーパターン）。
    *   React Native/Web両対応（Node.js EventEmitterの代わりに独自実装）。

2.  **各画面での `usePremium()` 採用**:
    *   `index.tsx` (ホーム) - 直接AsyncStorageアクセスから `usePremium()` に移行。
    *   `analytics.tsx` (分析) - 同様に `usePremium()` に移行。
    *   これにより購入後は全画面が自動的にロック解除状態に更新される。

3.  **ディープリンク対策（セキュリティ強化）**:
    *   `flashcards/index.tsx` - 非プレミアムユーザーは購入画面にリダイレクト。
    *   `analytics/details.tsx` - 同様に購入画面にリダイレクト。
    *   `folders/[group].tsx` - 共通科目・専門科目のみ制御（過去問は無料）。

4.  **状態変更通知の追加**:
    *   `unlockPremium()` - 購入成功時に全画面へ通知。
    *   `restorePurchases()` - 復元成功時に全画面へ通知。
    *   `resetPremiumStatus()` - リセット時に全画面へ通知。
    *   `setDebugPremiumStatus()` - デバッグ設定時に全画面へ通知。

#### 使い方:

```tsx
// 各画面でプレミアム状態を取得
import { usePremium } from '../../constants/premium';

function MyScreen() {
    const { isPremium, loading, refresh } = usePremium();
    
    if (loading) return <Loading />;
    if (!isPremium) return <LockedContent />;
    return <PremiumContent />;
}

// デバッグ用: プレミアム状態を切り替え
import { setDebugPremiumStatus, resetPremiumStatus } from './constants/premium';
await setDebugPremiumStatus(true);  // プレミアム有効化
await setDebugPremiumStatus(false); // プレミアム無効化
await resetPremiumStatus();         // 状態リセット
```

---

### 前回: ✅【完了】プレミアム機能ロック（ペイウォール）実装

1.  **ホーム画面 (`app/app/(tabs)/index.tsx`) のロック実装**:
    *   **共通科目**、**専門科目**、**頻出単語暗記カード** の3セクションにロック機能を追加。
    *   ロック時: アンバー（黄色）背景 + 「PREMIUM」バッジ + 中央に黒いロックバッジオーバーレイ。
    *   タップすると購入画面 (`/purchase`) に遷移。
    *   **過去問アーカイブ** は無料開放（ロックなし）。

2.  **分析画面 (`app/app/(tabs)/analytics.tsx`) のロック実装**:
    *   **苦手・得意分析**: ロック時はダミースケルトンUI + 「PREMIUM」バッジを表示。
    *   **AI指導教官**: ロック時はタイトル・アイコンは表示しつつ、中身はプレースホルダーメッセージ + 「プレミアムで解放」バッジ。
    *   両者ともタップで購入画面に遷移。

3.  **購入画面 (`app/app/purchase.tsx`) の改善**:
    *   新しいプレミアムモジュールを使用するようリファクタリング。
    *   `handlePurchase()` に課金統合ポイントのコメントを追加。
    *   「購入履歴を復元」ボタンを追加。

4.  **UIデザインの統一**:
    *   全てのロック対象セクションで統一されたロックバッジデザイン（黒カプセル + 鍵アイコン + 「PREMIUM」テキスト）。
    *   プレミアム機能は全てアンバー（黄色/オレンジ）系のデザインで統一。

---

#### 課金システム統合時の手順:

```
1. 課金プロバイダーをインストール
   - RevenueCat: npm install react-native-purchases
   - Expo IAP: expo install expo-in-app-purchases

2. app/constants/premium.ts を更新
   - PRODUCT_ID を実際の商品IDに変更
   - checkPremiumStatus() でプロバイダーから購入状態を取得
   - restorePurchases() でプロバイダーの復元APIを呼び出す

3. app/app/purchase.tsx の handlePurchase() を更新
   - プロバイダーの購入APIを呼び出す
   - 成功後に unlockPremium() を呼び出す

4. App Store / Google Play で商品を設定
   - 買い切り商品（Non-Consumable）として ¥500 で設定
```

---

#### ロック対象機能一覧:

| 機能 | 画面 | ロック時の表示 |
|------|------|----------------|
| 共通科目 | ホーム | アンバー背景 + PREMIUMバッジ + ロックオーバーレイ |
| 専門科目 | ホーム | アンバー背景 + PREMIUMバッジ + ロックオーバーレイ |
| 頻出単語暗記カード | ホーム | アンバー背景 + PREMIUMバッジ + ロックオーバーレイ |
| 苦手・得意分析 | 分析 | スケルトンダミー + 「PREMIUM」バッジ |
| AI指導教官 | 分析 | タイトル表示 + プレースホルダー + 「プレミアムで解放」バッジ |

#### 無料開放機能:
- 過去問アーカイブ（全年度）
- 今日のミッション（デイリークエスト）
- 苦手克服モード
- 基本統計（総解答数、正解率、連続学習日数、マスター済み）

---

## 最新ステータス (2026-01-11)

### ✅【完了】共通科目データ生成完了 & Audio Player 大幅改善
本日のセッションで、課題となっていた共通科目のデータ生成と、オーディオ機能の品質向上を達成しました。

*   **達成事項**:
    1.  **共通科目 (common_social) データ生成完了**:
        *   API制限解除後、スクリプトを実行し **1,864問** の生成に成功しました。
        *   カテゴリ名も `clean_common_labels_v2.py` により整形済み（例: `8障害福祉_part_9` -> `障害福祉`）。
    2.  **Audio Player (読み上げ機能) の完全リニューアル**:
        *   **UI刷新**: 曲再生風UIから、歌詞表示（プロンプター）風UIへ変更。現在のフェーズ（問題・選択肢・解答・解説）を可視化。
        *   **機能追加**: 読み上げ速度調整（0.75x ~ 1.5x）、解説読み上げのON/OFF設定。
        *   **バグ修正**:
            *   速度変更時のクラッシュおよび勝手なスキップ問題を、`Cycle ID` パターン導入による抜本的修正で解決。
            *   一時停止中の操作（次へ/前へ）での表示更新ラグを解消。
            *   `expo-speech` の競合による `SyntaxError` (LogBoxクラッシュ) を抑制。

## Current Status
- **Specialized Subjects (spec_social)**: Generation COMPLETE (approx. 7,000 questions).
- **Common Subjects (common_social)**: Generation COMPLETE (1,864 questions). Labels cleaned.
- **Legacy Common Data (group: 'common')**: Preserved for "Weakness Overcome" and "Daily Quests".
- **Audio Player**: Stable v2.0 release. Robust state management implemented.
- **Premium/Paywall**: COMPLETE. Lock UI implemented. Ready for payment provider integration.

## Priority Tasks (Next)
1.  **【課金統合】Payment Provider Integration**:
    *   RevenueCat or Expo IAP を導入し、実際の決済処理を実装。
    *   `app/constants/premium.ts` の TODO に従って更新。
2.  **【テスト】プレミアム解除後の動作確認**:
    *   購入後、全てのロックが正しく解除されることを確認。
    *   各画面の表示が正しく切り替わることを確認。
3.  **Audio Player V2 (Playlist Feature)**:
    *   **Goal**: Allow users to select specific content to play (e.g., "Year 2024" or "Psychology Subject").
4.  **【横展開】別資格への移植**:
    *   介護福祉士・精神保健福祉士版の作成。

## Technical Notes
- **Premium Management**: `app/constants/premium.ts` に全て集約。
- **AsyncStorage Key**: `is_premium` (値: `'true'` or `'false'`)
- **Scripts**:
    - `generate_quiz_common_v2.py`: Successfully generated common subjects.
    - `clean_common_labels_v2.py`: Used to clean generated labels.
- **App Logic**:
    - `audio-player.tsx`: Completely re-architected using Imperative Cycle Control (Ref-based).
    - `index.tsx`: Premium lock implemented with `isPremium` state and `handleLockedContent()`.
    - `analytics.tsx`: Conditional rendering for premium/free content.
    - `purchase.tsx`: Integrated with `premium.ts` module, restore button added.
