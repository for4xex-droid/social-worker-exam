---
name: check-gemini-models
description: Fetch and list available Gemini models from the Google Generative AI API to ensure compatibility.
---

# Check Gemini Models Skill

This skill allows the agent to verify which Gemini models are currently available and supported by the API key being used. Use this when encountering "404 Not Found" or model version mismatch errors.

## Usage

1. **Run the script**:
   Navigate to the skill directory or run the script directly:
   ```bash
   python .agent/skills/check-gemini-models/list_models.py
   ```

2. **Analyze Output**:
   The script updates the list of available models. Look for models like `gemini-1.5-flash`, `gemini-1.5-pro` etc.

3. **Update Code**:
   If the code uses a deprecated model (e.g., `gemini-pro`), update the `model_name` in the Python scripts based on the output of this skill.

## Resources
- `list_models.py`: Python script to hit the `models.list_models()` API.
