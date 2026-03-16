import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

print("Looking for models supporting bidiGenerateContent...")
for model in client.models.list():
    if getattr(model, "supported_actions", None) and "bidiGenerateContent" in model.supported_actions:
        print(f"Supported model: {model.name}")
