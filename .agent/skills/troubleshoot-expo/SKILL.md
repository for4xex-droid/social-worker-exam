---
name: troubleshoot-expo
description: Diagnose and fix common Expo Go and Metro Bundler issues (freezing, connection errors).
---

# Troubleshoot Expo Skill

This skill provides a systematic approach to resolving common issues when running the Expo app, specifically focusing on the "Opening project..." freeze, connection timeouts, and dependency conflicts.

## Common Symptoms
- Expo Go app freezes on "Opening project...".
- Metro Bundler does not load.
- `ERESOLVE` or `peer dependency` errors during install.
- Command not found for `cross-env` or `expo`.

## Golden Rules (Critical)
1. **Match SDK Versions**: Ensure `package.json` (expo) and `app.config.ts` (sdkVersion) match the Expo Go app version (e.g., SDK 54).
2. **Handle Dependencies Aggressively**: If `npm install` fails, use `--legacy-peer-deps`.
3. **Use Offline Mode for Stability**: If network is flaky or "Opening project" stalls, try `--offline`.

## Solution Workflow

### Step 1: Clean Restart (Basic)
1. Stop the server (Ctrl+C).
2. Kill lingering node processes (Windows):
   ```powershell
   taskkill /F /IM node.exe
   ```
3. Run with clear cache:
   ```bash
   npx expo start --clear
   ```

### Step 2: Fix Dependencies (Deep Clean)
If Step 1 fails or errors occur during start:
1. **Delete node_modules**:
   ```powershell
   if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
   if (Test-Path package-lock.json) { Remove-Item -Force package-lock.json }
   ```
2. **Reinstall with Legacy Peer Deps** (Crucial for beta SDKs/React 19):
   ```bash
   npm install --legacy-peer-deps
   ```
3. **Verify Installation**: Check if `node_modules` exists and contains `expo`.

### Step 3: Launch Strategies
If standard launch fails, try these variations:

**A. Offline Mode (Avoiding Firewall/Network issues)**
```powershell
$env:APP_VARIANT="mental"; npx expo start --clear --offline
```

**B. Tunnel Mode (Internet via ngrok)**
```powershell
$env:APP_VARIANT="mental"; npx expo start --clear --tunnel
```

**C. Powershell Env Var (If cross-env fails)**
Instead of `npx cross-env APP_VARIANT=...`, use:
```powershell
$env:APP_VARIANT="mental"; npx expo start --clear
```

### Step 4: Native Module Checks (Web Compatibility)
- If building for Web, ensure native modules like `expo-sqlite` are dynamically imported or guarded by `Platform.OS`.
- Error `Mismatch between JavaScript part and native part of Worklets`: Check `react-native-reanimated` version or disable plugin in `babel.config.js`.

## Auto-Fix Command (Full Reset)
Run this if nothing else works (takes time):
```powershell
taskkill /F /IM node.exe; if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }; npm install --legacy-peer-deps; $env:APP_VARIANT="mental"; npx expo start --clear --offline
```
