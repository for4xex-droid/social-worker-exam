---
name: start-expo-offline
description: Force restart Expo in offline mode to bypass login issues and white screen freezing.
---

# Start Expo Offline (Anti-Freeze Protocol)

This skill automates the process of forcefully restarting the Expo server in **Offline Mode**. This is effective for resolving the "White Spinning Wheel" (Opening project... freeze) issue caused by login checks or network timeouts.

## When to Use
- When Expo Go gets stuck on "Opening project...".
- When you are asked to log in to Expo CLI and want to skip it.
- When you simply want a clean, fast start without external network dependency.

## Steps Performed
1. **Kill Processes**: Forcefully terminates all running `node.exe` processes to kill zombie servers.
2. **Clear Cache**: Deletes the `.expo` directory to remove corrupted cache.
3. **Start Offline**: Launches Expo with `--offline` and `--clear` flags.
   - `--offline`: Skips Expo login interaction and external network checks.
   - `--clear`: Clears the Metro bundler cache.

## Command
The agent will execute the following (PowerShell):

```powershell
taskkill /F /IM node.exe
if (Test-Path .expo) { Remove-Item -Recurse -Force .expo }
npx cross-env APP_VARIANT=mental npx expo start --offline --clear
```

> **Note**: The `APP_VARIANT=mental` is set by default tailored for the current project. If you need to switch flavors, ask the agent to modify the command.

## Post-Execution
- Scan the QR code displayed in the terminal.
- Ensure your phone and PC are on the **same Wi-Fi network**.
