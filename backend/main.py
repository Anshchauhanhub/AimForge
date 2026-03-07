from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import os
import json
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

import models
from database import engine, get_db
import auth

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

@app.post("/api/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.username == user.username).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_password = auth.get_password_hash(user.password)
        new_user = models.User(username=user.username, hashed_password=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"message": "User created successfully"}
    except Exception as e:
        import traceback
        print("Exception in register:")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/chat")
def chat(request: ChatRequest, current_user: models.User = Depends(auth.get_current_user)):
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
