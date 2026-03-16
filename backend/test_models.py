#!/usr/bin/env python3
"""
Test script to check available Gemini models for Live API
"""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not found in environment")
    exit(1)

print(f"✓ API Key loaded: {GEMINI_API_KEY[:20]}...")

try:
    # Initialize client
    client = genai.Client(api_key=GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})
    
    print("\n📋 Listing available models...")
    
    # List models
    models = client.models.list()
    
    print("\n🎯 Models that support bidiGenerateContent (Live API):\n")
    
    for model in models:
        # Check if model supports the required method
        if hasattr(model, 'supported_generation_methods'):
            methods = model.supported_generation_methods
            if 'bidiGenerateContent' in methods or 'generateContent' in methods:
                print(f"  ✓ {model.name}")
                if hasattr(model, 'display_name'):
                    print(f"    Display: {model.display_name}")
                if hasattr(model, 'description'):
                    print(f"    Description: {model.description[:100]}...")
                print()
    
    print("\n💡 Recommended models for Live API:")
    print("  - gemini-2.0-flash-exp")
    print("  - gemini-1.5-flash")
    print("  - gemini-1.5-pro")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nTrying alternative method...")
    
    try:
        import requests
        
        url = f"https://generativelanguage.googleapis.com/v1alpha/models?key={GEMINI_API_KEY}"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print("\n📋 Available models:")
            for model in data.get('models', []):
                print(f"  - {model.get('name')}")
        else:
            print(f"❌ API request failed: {response.status_code}")
            print(response.text)
    except Exception as e2:
        print(f"❌ Alternative method also failed: {e2}")

print("\n" + "="*60)
print("If you see errors, your API key might not have access to")
print("the Live API models. Try:")
print("1. Generate a new API key at https://makersuite.google.com/app/apikey")
print("2. Ensure you're using the correct Google Cloud project")
print("3. Check if Live API is available in your region")
print("="*60)
