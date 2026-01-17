---
name: expo-development-rules
description: Expo development rules, CLI usage standards, and Windows specific troubleshooting protocols (Vibe Coding Golden Rules).
---

# Vibe Coding Golden Rules (Expo/Windows Edition)

These rules define the development process, environment management, and AI interaction protocols for the project.

## Rule 1: Version Control belongs to "CLI", not "AI"
AI suggestions for versions are often outdated. Always rely on the Expo CLI.

- 🚫 **PROHIBITED**: Manually editing `package.json` versions or asking AI to "fix versions".
- ✅ **REQUIRED**: Use `npx expo install <package-name>` to install libraries.
  - **Reason**: This ensures compatibility with the current Expo SDK (e.g., SDK 54).

## Rule 2: Cumulative Environment Building
Do not copy-paste complex code instantly. Build the environment layer by layer.

1. `npx create-expo-app` -> Confirm "Hello World".
2. Install `NativeWind` -> Confirm styling works.
3. Install `Reanimated` -> Confirm animations work.
4. **Only then**, start coding business logic.

## Rule 3: The Windows "Exorcism" Protocol (Important)
Windows file locking and caching are aggressive. If unexplained errors occur:

**Execute this PowerShell sequence immediately:**
```powershell
# Kill processes, remove trash, force clean install
taskkill /IM node.exe /F
Remove-Item -Recurse -Force node_modules
npm cache clean --force
npm install
$env:APP_VARIANT="mental"; npx expo start --clear
```

## Rule 4: The "30-Minute" Rule (Cut Loss)
If an environment error (Red Screen, Build Error) takes >30 mins to solve:
- **Abandon the folder**.
- Create a fresh project with `npx create-expo-app`.
- Port the `app/` source code.

## Rule 5: AI Prompt Standardization
When starting a new session or context, the AI must be aware of these constraints.

**AI Context Template:**
> "You are an expert in React Native (Expo) on Windows 11 / SDK 54.
> **Constraints**:
> 1. Always use `npx expo install`. Never manual versioning.
> 2. No manual `package.json` edits for version fixing.
> 3. Use NativeWind v2 syntax (check config).
> 4. Use `Remove-Item` for deletion (Windows PowerShell).
> 5. Prioritize Expo CLI solutions over AI guesses."

## Workflow Image
1. **Start**: `npx create-expo-app`
2. **Config**: Apply AI Context.
3. **Install**: One by one with verification.
4. **Code**: Business logic.
5. **Error**: If stuck > 30m -> Recreate.

## Rule 6: Server Verification Protocol (The "Port-Check" Gate)
Before attempting to verify any web functionality via browser:

1. **Mandatory Port Check**: You MUST verify the server uses an open port.
   - **Command**: `powershell -Command "Test-NetConnection -ComputerName localhost -Port <PORT>"`
   - **Condition**: Proceed ONLY if `TcpTestSucceeded : True`.
2. **No "Blind" Verification**:
   - If the port check fails, DO NOT open the browser.
   - Instead: Kill the process (`taskkill /F /IM node.exe`), Restart the server, and **Repeat Step 1**.
3. **Evidence First**:
   - You must have a "SUCCESS" result from the port check in your context before calling any browser tool.
