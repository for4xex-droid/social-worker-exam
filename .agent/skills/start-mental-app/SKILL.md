---
name: start-mental-app
description: Launch the Mental Health Worker app in Expo Go with cache cleared.
---

# Start Mental Health App Skill

This skill automates the process of launching the Mental Health Worker variant of the application. It handles directory navigation and sets the necessary environment variables.

## Usage
Simply ask the agent to "start the app" or "launch the mental app".

## Steps Performed
1. Navigate to `welfare-master/app`.
2. Execute the Expo start command with the `mental` variant and `--clear` flag to ensure fresh data loading.

## Command
The agent will execute:
```powershell
npx cross-env APP_VARIANT=mental npx expo start --clear
```
(User approval may be required depending on settings, but directory context is handled automatically via the `Cwd` parameter.)

## Post-Execution
- The terminal will display the QR code.
- Scan it with your Android device (Expo Go) or Camera app (iOS).
- To stop the server later, press `Ctrl+C` in the terminal or ask the agent to stop it.
