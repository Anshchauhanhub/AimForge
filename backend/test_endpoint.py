import requests
import os
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")

urls_to_test = [
    "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct/v1/chat/completions",
    "https://router.huggingface.co/hf-inference/models/Qwen/Qwen2.5-72B-Instruct/v1/chat/completions",
    "https://router.huggingface.co/hf-inference/v1/chat/completions"
]

headers = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json"
}

payload = {
    "model": "Qwen/Qwen2.5-72B-Instruct",
    "messages": [
        {"role": "user", "content": "hello"}
    ],
    "max_tokens": 10
}

for url in urls_to_test:
    print(f"Testing URL: {url}")
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 50)
