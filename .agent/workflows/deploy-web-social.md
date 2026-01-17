---
description: Deploy the Social Worker Web App (Data Gen -> Build -> Patch -> Deploy)
---

# Social Worker Web Deployment

This workflow sets up data and deploys the **Social Worker** version of the web app.

## Prerequisites
-   Terminal open in VS Code.
-   Vercel CLI authenticated.

## Execution Steps

1.  **Generate Web Assets** (Crucial for Social Worker Data)
    Navigate to the pipeline directory and generate the JSON data files (`web_past_social.json`, `web_spec_social.json`).
    ```powershell
    cd c:\Users\user\.gemini\social-worker-exam\welfare-master\data_pipeline
    python prepare_web_assets.py
    ```

2.  **Navigate to App Directory**
    ```powershell
    cd ../app
    ```

3.  **Build for Web (Social Variant)**
    Clear cache and export static files for the **Social** variant.
    ```powershell
    npx cross-env APP_VARIANT=social expo export -p web --clear
    ```

4.  **Patch Scrolling Issues**
    Run the patch script to fix `index.html`.
    ```powershell
    python fix_web_scroll.py
    ```

5.  **Deploy to Vercel**
    Deploy the `dist` folder.
    *Note: If asked to link to a project, ensure you link to 'social-worker-web' (or whatever name you chose), NOT the mental health project.*
    ```powershell
    npx vercel deploy dist --prod
    ```

## Troubleshooting
-   **No Content**: Ensure Step 1 was successful and `web_past_social.json` exists in `app/public`.
-   **Wrong App Name/Color**: Ensure you used `--clear` in Step 3 to remove cached Mental Health config.
-   **Scrolling Issues**: Re-run Step 4.
