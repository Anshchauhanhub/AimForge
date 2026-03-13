import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env FIRST before any other imports
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import json
from huggingface_hub import InferenceClient

import models
from database import engine, get_db
from auth import hash_password, verify_password, create_access_token, get_current_user

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_TOKEN = os.getenv("HF_TOKEN")
client = InferenceClient(api_key=HF_TOKEN)

# ==================
# Schemas
# ==================

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class PlanItemBase(BaseModel):
    topic: str
    duration: int

class StatsUpdate(BaseModel):
    streak_add: int = 0
    sessions_add: int = 0

class PostCreate(BaseModel):
    category: str  # material, achievement, struggle
    title: str
    content: str

# ==================
# Auth Endpoints
# ==================

@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check existing email
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Check existing username
    if db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        email=req.email,
        username=req.username,
        hashed_password=hash_password(req.password),
        display_name=req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id})
    return {"token": token, "username": user.username}


@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(data={"sub": user.id})
    return {"token": token, "username": user.username}


# ==================
# Profile Endpoints
# ==================

@app.get("/api/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "streak": current_user.streak,
        "sessions": current_user.sessions
    }


@app.get("/api/me/profile")
def get_profile(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "display_name": current_user.display_name or current_user.username,
        "bio": current_user.bio or "",
        "avatar_url": current_user.avatar_url or "",
        "streak": current_user.streak,
        "sessions": current_user.sessions,
    }


@app.put("/api/me/profile")
def update_profile(profile: ProfileUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if profile.display_name is not None:
        current_user.display_name = profile.display_name
    if profile.bio is not None:
        current_user.bio = profile.bio
    if profile.avatar_url is not None:
        current_user.avatar_url = profile.avatar_url
    db.commit()
    db.refresh(current_user)
    return {"status": "updated"}


@app.post("/api/me/stats")
def update_stats(stats: StatsUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if stats.streak_add > 0:
        current_user.streak += stats.streak_add
    if stats.sessions_add > 0:
        current_user.sessions += stats.sessions_add
    db.commit()
    db.refresh(current_user)
    return {"streak": current_user.streak, "sessions": current_user.sessions}


# ==================
# Plan Endpoints
# ==================

@app.get("/api/plan")
def get_plan(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(models.PlanItem).filter(models.PlanItem.user_id == current_user.id).all()
    return [{"id": item.id, "topic": item.topic, "duration": item.duration, "completed": bool(item.completed)} for item in items]


@app.post("/api/plan")
def save_plan(items: list[PlanItemBase], current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
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
def complete_plan_item(item_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(models.PlanItem).filter(models.PlanItem.id == item_id, models.PlanItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.completed = 1
    db.commit()
    return {"id": item.id, "completed": True}


# ==================
# Chat Endpoint
# ==================

@app.post("/api/chat")
def chat(request: ChatRequest, current_user: models.User = Depends(get_current_user)):
    if not HF_TOKEN or HF_TOKEN == "your_hugging_face_token_here":
        raise HTTPException(status_code=500, detail="Hugging Face token not configured in .env")

    system_prompt = """You are Jovi, a premium AI instructor and teacher powered by Vivo. The user will tell you their ultimate aim or specific goal for today. 
As Jovi, your personality should be dynamic, professional, encouraging, and highly structured—like an elite personal tutor pushing a student to excel.
Respond ONLY with a valid JSON object matching this schema. Do NOT include markdown code blocks or any other text outside the JSON.
{
    "reply": "A concise, motivating, and authoritative message from Jovi acknowledging their aim and explaining the lesson plan.",
    "plan": [
        {"topic": "Name of specific sub-topic or milestone 1", "duration": 30},
        {"topic": "Name of specific sub-topic or milestone 2", "duration": 45}
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


# ==================
# Social / Community Endpoints
# ==================

@app.post("/api/posts")
def create_post(post: PostCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if post.category not in ("material", "achievement", "struggle"):
        raise HTTPException(status_code=400, detail="Category must be material, achievement, or struggle")
    if not post.title.strip() or not post.content.strip():
        raise HTTPException(status_code=400, detail="Title and content are required")

    db_post = models.Post(
        user_id=current_user.id,
        category=post.category,
        title=post.title.strip(),
        content=post.content.strip(),
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    return {
        "id": db_post.id,
        "category": db_post.category,
        "title": db_post.title,
        "content": db_post.content,
        "created_at": db_post.created_at.isoformat() if db_post.created_at else None,
        "likes_count": 0,
        "liked_by_me": False,
        "author": {
            "id": current_user.id,
            "username": current_user.username,
            "display_name": current_user.display_name or current_user.username,
            "avatar_url": current_user.avatar_url or "",
        }
    }


@app.get("/api/posts")
def get_posts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    posts = db.query(models.Post).order_by(models.Post.created_at.desc()).limit(50).all()

    result = []
    for p in posts:
        author = db.query(models.User).filter(models.User.id == p.user_id).first()
        liked = db.query(models.PostLike).filter(
            models.PostLike.post_id == p.id,
            models.PostLike.user_id == current_user.id
        ).first() is not None

        result.append({
            "id": p.id,
            "category": p.category,
            "title": p.title,
            "content": p.content,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "likes_count": p.likes_count,
            "liked_by_me": liked,
            "is_mine": p.user_id == current_user.id,
            "author": {
                "id": author.id,
                "username": author.username,
                "display_name": author.display_name or author.username,
                "avatar_url": author.avatar_url or "",
            } if author else None,
        })

    return result


@app.post("/api/posts/{post_id}/like")
def toggle_like(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == current_user.id
    ).first()

    if existing:
        db.delete(existing)
        post.likes_count = max(0, post.likes_count - 1)
        db.commit()
        return {"liked": False, "likes_count": post.likes_count}
    else:
        like = models.PostLike(user_id=current_user.id, post_id=post_id)
        db.add(like)
        post.likes_count += 1
        db.commit()
        return {"liked": True, "likes_count": post.likes_count}


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's post")

    db.delete(post)
    db.commit()
    return {"status": "deleted"}


# ==================
# Debug endpoint
# ==================
@app.get("/api/debug/ping")
def ping():
    from auth import SECRET_KEY as sk
    return {"status": "ok", "secret_key_prefix": sk[:10]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
