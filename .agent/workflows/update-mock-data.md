---
description: 模擬試験・過去問データの更新と反映
---

# Mock Exam Data Update Workflow

このワークフローは、模擬試験や過去問データ（JSON）を更新・クリーニングし、Web版とアプリ版の両方に反映させる手順です。

## 手順

1. **データ準備**:
   - 元データ（`master_database_v2_final.json` または `raw_questions.json`）が `welfare-master/data_pipeline` にあることを確認する。
   - 必要であれば新しいデータをそこに配置する。

2. **更新スクリプト実行**:
   - 以下のコマンドを実行して、データのクリーニングと各アセットフォルダへの配布を行う。

```powershell
cd c:\Users\user\.gemini\social-worker-exam\welfare-master\data_pipeline
py update_and_deploy_data.py
```

3. **確認**:
   - Web版: ブラウザをリロードする。
   - アプリ版: Expo Go をリロードまたは再起動する。
