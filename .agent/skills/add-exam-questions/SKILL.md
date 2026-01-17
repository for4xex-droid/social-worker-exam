---
name: add-exam-questions
description: Generate and merge new exam questions from PDF files into the Expo app database.
---

# Add Exam Questions Skill

This skill guides the AI agent through the process of adding new exam questions from PDF files, generating quizzes using AI, and merging them into the application's database.

## Prerequisites
- PDF files must be placed in `C:\Users\user\OneDrive\Desktop\精神保健福祉士専門` (or configured directory).
- Python environment with `google-generativeai` and `pypdf` installed.

## Workflow

### 1. Verification of PDF Files
- Check if there are new PDF files in the target directory (recursively).
- Use `data_pipeline/generate_mental_large.py` log output to verify discovery.

### 2. Generate Questions (AI)
- Execute the generation script:
  ```bash
  cd data_pipeline
  python generate_mental_large.py
  ```
- **Monitor the output**:
  - Ensure API keys are rotating if limits are hit.
  - Watch for "Processing: ..." logs.
  - Wait until all chunks are marked `DONE`.

### 3. Merge Data into Master Database
- **STOP GENERATION FIRST**: Ensure `generate_mental_large.py` is stopped (Ctrl+C) before merging to avoid file lock/race conditions.
- Execute the merge script:
  ```bash
  python merge_mental_v13.py
  ```
- This script will:
  - Load `mental_special_generated.json`.
  - Filter out invalid items (e.g., missing categoryLabel, "Book_..." prefixes).
  - Combine with existing master data.
  - Save to `app/assets/master_database_v13_rev2.json` (or newer version).

### 4. Database Reset & Seeding (The "Nuclear" Option)
- To force the app to pick up the new JSON, specifically update the database filename.
- **Edit `app/db/client.native.ts`**:
  - Update `DB_NAME` to a new version (e.g., `'welfare_master_v23_mental.db'`).
  - Ensure the `require` path points to the new JSON: `require("../assets/master_database_v13_rev2.json")`.
  - Set `const FORCE_RESET = true;` (optional if DB name changed, but good practice).
- **Run the App**:
  - `powershell -Command { $env:APP_VARIANT="mental"; npx expo start --clear --offline }`
  - Scan the new QR code.
- **Revert Reset Flag**:
  - `FORCE_RESET` can be set back to `false`.

### 5. Validation
- Open the app (Android/iOS Simulator or Expo Go).
- Navigate to "Specialized Subjects" (専門科目).
- Verify that new Categories (Books) appear and contain questions.

## Troubleshooting
- **Script Stalls**: If `generate_mental_large.py` stalls on "Invalid JSON", it usually retries. If it fails completely, check the PDF for text content or restart the script (it resumes progress).
- **App Not Updating / Zombie Data**: If old data persists despite `FORCE_RESET`:
  - **Rename the Database**: Change `DB_NAME` in `app/db/client.native.ts`. This is the most effective fix.
  - **Check Merge Logic**: Verify `merge_mental_v13.py` is filtering out junk data like "Book_0001".
  - **Refer to**: `troubleshoot-data-sync` skill.
