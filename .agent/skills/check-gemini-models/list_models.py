import google.generativeai as genai
import os
from dotenv import load_dotenv

# Try to load env from data_pipeline directory relative to project root
# Assuming this script is run from project root or its own dir
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
env_path = os.path.join(project_root, "welfare-master", "data_pipeline", ".env")

load_dotenv(env_path)

api_key = os.getenv("GOOGLE_API_KEY")

# Fallback: Hardcoded key from generate_mental_large.py (for immediate utility)
# Note: Ideally this should always come from env
if not api_key:
    # Use one of the keys we know works
    api_key = "AIzaSyCryEPFUJe1K6Jh5hKNUYQdddxrVbXKaRQ"

try:
    genai.configure(api_key=api_key)

    print(f"Checking models with API Key ending in ...{api_key[-4:]}")
    print("-" * 30)

    for m in genai.list_models():
        if "generateContent" in m.supported_generation_methods:
            print(f"- {m.name}")

    print("-" * 30)
    print("Done. Use one of these model names in your scripts.")

except Exception as e:
    print(f"Error fetching models: {e}")
