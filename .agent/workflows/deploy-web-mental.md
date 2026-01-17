---
description: Deploy the Mental Health Worker Web App with Scrolling Fixes (Build -> Patch -> Deploy)
---

# Mental Health Worker Web Deployment

This workflow ensures the web application is built, patched for scrolling issues, and deployed to Vercel correctly.

## Prerequisites
-   Terminal open in VS Code.
-   Vercel CLI authenticated.

## Execution Steps

1.  **Navigate to App Directory**
    ```powershell
    cd c:\Users\user\.gemini\social-worker-exam\welfare-master\app
    ```

2.  **Build for Web**
    Export the static files using the correct environment variant.
    ```powershell
    npx cross-env APP_VARIANT=mental expo export -p web
    ```

3.  **Patch Scrolling Issues** (CRITICAL STEP)
    Run the Python script to modify `dist/index.html` and enforce scrollbars.
    ```powershell
    python fix_web_scroll.py
    ```
    *Verify output says "Success".*

4.  **Deploy to Vercel**
    Deploy the patched `dist` folder directly to production.
    ```powershell
    npx vercel deploy dist --prod
    ```

## Troubleshooting
-   **White Screen**: Often due to `height: 0` or missing `minHeight`. Check `_layout.tsx`.
-   **No Scrollbars**: Ensure Step 3 was run *after* Step 2. If you rebuild, you must re-patch.
-   **Wrong URL**: Always use `npx vercel deploy dist` (deploying the folder) to maintain project linkage.
