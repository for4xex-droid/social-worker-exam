---
name: database-management
description: Protocol for managing, separating, and verifying the Welfare Exam databases (Social, Mental, Care). Use this when updating data or troubleshooting missing/mixed questions.
---

# Database Management Protocol

## Overview
The database architecture has been shifted from a monolithic `master_data.json` to separated, variant-specific files located in `app/assets/separated_db/`:
- `master_social.json` (Social Worker + Common)
- `master_mental.json` (Mental Health Worker + Common)
- `master_care.json` (Care Worker + Common)

**CRITICAL RULE: Do NOT modify or rely on `app/assets/master_data.json` directly. It is a legacy artifact.**

## Standard Operational Procedures

### 1. Rebuild and Separate Databases (The Source of Truth)
When new raw data is added or categorization logic needs update, run the reorganization script. This script collects data from all sources (backups, new files), deduplicates it based on question text, and splits it into strict categories (Social/Mental/Care) based on folder naming conventions.

**Command:**
```bash
# Run from 'welfare-master' directory
node reorganize_database.js
```

**Key Logic:**
-   **Strict Tracing**: Prioritizes records with folder codes like `SW専` or `精神専`.
-   **Fallback**: Uses keywords only if no folder code is present.

### 2. Verify Separation integrity
Check for cross-contamination (e.g., Mental questions leaking into Social DB). This script performs a strict metadata check. **This MUST return 0 errors before proceeding.**

**Command:**
```bash
node verify_separation_strict.js
```

### 3. Generate Web Assets (For Web App)
Transform the separated master files into the filtered JSON format required by the Web App (`web_common.json`, `web_spec_*.json`, `web_past_*.json`).

**Command:**
```bash
# For Social Worker
# (Windows PowerShell)
$env:APP_VARIANT="social"; node data_pipeline/prepare_web_assets_node.js
# (Cmd)
set APP_VARIANT=social && node data_pipeline/prepare_web_assets_node.js

# For Mental Health Worker
$env:APP_VARIANT="mental"; node data_pipeline/prepare_web_assets_node.js
```

### 4. Deploy Updates (Web)
Run the build, patch, and deploy process.

**Command:**
```bash
cd app
npx cross-env APP_VARIANT=social expo export -p web --clear
cd ..
# Patch the index.html for scrolling issues (Node.js version)
node fix_web_scroll.js
cd app
npx vercel deploy dist --prod
# (For Mental, change APP_VARIANT to 'mental')
```

## How to Add New Data
To add new questions to the ecosystem:
1.  Place the raw JSON file in `app/assets/` or `data_pipeline/`.
2.  Add the absolute or relative path of the new file to the `INPUT_FILES` list in `reorganize_database.js`.
3.  Run the **Rebuild** procedure (Step 1).
4.  Run the **Verify** procedure (Step 2).

## Troubleshooting
-   **"Data missing in Native App (Expo Go)"**:
    -   Check `app/db/client.native.ts`. Ensure it imports the correct `separated_db/master_*.json` for the configured variant.
    -   Restart Metro Bundler with `--clear` to flush cache.
-   **"Contamination detected (Verify failed)"**:
    -   Check `reorganize_database.js`. Ensure the `SOCIAL_FOLDER_CODES` and `MENTAL_FOLDER_CODES` are strict enough.
    -   Exclude generic keywords (e.g., "医学", "支援") from the keyword lists if they cause false positives.
