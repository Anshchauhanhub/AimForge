from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_TOKEN = os.getenv("HF_TOKEN")
# Using Qwen 2.5 72B Instruct via HF InferenceClient
client = InferenceClient(api_key=HF_TOKEN)

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
def chat(request: ChatRequest):
    if not HF_TOKEN or HF_TOKEN == "your_hugging_face_token_here":
        raise HTTPException(status_code=500, detail="Hugging Face token not configured in .env")
    
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    
    system_prompt = """You are a productivity AI coach. The user will tell you what they want to study or do. 
Respond ONLY with a valid JSON object matching this schema. Do NOT include markdown code blocks or any other text outside the JSON.
{
    "reply": "A short, motivational message acknowledging their goal",
    "plan": [
        {"topic": "Name of specific topic/activity 1", "duration": 25},
        {"topic": "Name of specific topic/activity 2", "duration": 25}
    ]
}"""

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message}
        ]
        
        response = client.chat.completions.create(
            model="Qwen/Qwen2.5-72B-Instruct",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        raw_content = response.choices[0].message.content
        
        # Clean up markdown formatting if the model still outputs it
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
            
        return json.loads(raw_content.strip())
        
    except Exception as e:
        print(f"Error parsing response: {e}")
        try:
            print(f"Raw content was: {raw_content}")
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
