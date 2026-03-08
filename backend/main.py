from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import json
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

import models
from database import engine, get_db

# Create DB tables
models.Base.metadata.create_all(bind=engine)

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

class UserCreate(BaseModel):
    username: str
    password: str

class PlanItemBase(BaseModel):
    topic: str
    duration: int

class PlanItemResponse(PlanItemBase):
    id: int
    completed: bool

class StatsUpdate(BaseModel):
    streak_add: int = 0
    sessions_add: int = 0

def get_global_user(db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == 1).first()
    if not user:
        user = models.User(username="default_player")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

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

@app.get("/api/me")
def get_me(current_user: models.User = Depends(get_global_user)):
    return {
        "username": current_user.username,
        "streak": current_user.streak,
        "sessions": current_user.sessions
    }

@app.post("/api/me/stats")
def update_stats(stats: StatsUpdate, current_user: models.User = Depends(get_global_user), db: Session = Depends(get_db)):
    if stats.streak_add > 0:
        current_user.streak += stats.streak_add
    if stats.sessions_add > 0:
        current_user.sessions += stats.sessions_add
    db.commit()
    db.refresh(current_user)
    return {"streak": current_user.streak, "sessions": current_user.sessions}

@app.get("/api/plan")
def get_plan(current_user: models.User = Depends(get_global_user), db: Session = Depends(get_db)):
    items = db.query(models.PlanItem).filter(models.PlanItem.user_id == current_user.id).all()
    return [{"id": item.id, "topic": item.topic, "duration": item.duration, "completed": bool(item.completed)} for item in items]

@app.post("/api/plan")
def save_plan(items: list[PlanItemBase], current_user: models.User = Depends(get_global_user), db: Session = Depends(get_db)):
    # Clear old incomplete plan items (optional, but good for fresh plans)
    db.query(models.PlanItem).filter(models.PlanItem.user_id == current_user.id, models.PlanItem.completed == 0).delete()
    db.commit()
    
    saved_items = []
    for item in items:
        db_item = models.PlanItem(user_id=current_user.id, topic=item.topic, duration=item.duration, completed=0)
        db.add(db_item)
        saved_items.append(db_item)
    db.commit()
    for db_item in saved_items:
        db.refresh(db_item)
        
    return [{"id": item.id, "topic": item.topic, "duration": item.duration, "completed": bool(item.completed)} for item in saved_items]

@app.put("/api/plan/{item_id}")
def complete_plan_item(item_id: int, current_user: models.User = Depends(get_global_user), db: Session = Depends(get_db)):
    item = db.query(models.PlanItem).filter(models.PlanItem.id == item_id, models.PlanItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.completed = 1
    db.commit()
    return {"id": item.id, "completed": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
