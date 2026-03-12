from sqlalchemy import Column, Integer, String
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

class PlanItem(Base):
    __tablename__ = "plan_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    topic = Column(String)
    duration = Column(Integer)
    completed = Column(Integer, default=0)
