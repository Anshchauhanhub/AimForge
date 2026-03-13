from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, default="")
    bio = Column(String, default="Consistently building and mastering new skills.")
    avatar_url = Column(String, default="https://avatars.githubusercontent.com/u/9919?s=200&v=4")
    streak = Column(Integer, default=0)
    sessions = Column(Integer, default=0)

    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")

class PlanItem(Base):
    __tablename__ = "plan_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    topic = Column(String)
    duration = Column(Integer)
    completed = Column(Integer, default=0)

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String, nullable=False)  # material, achievement, struggle - kept for DB compatibility
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    likes_count = Column(Integer, default=0)

    author = relationship("User", back_populates="posts")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")

class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)

    post = relationship("Post", back_populates="likes")

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_like"),
    )

