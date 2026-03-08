from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, default="default_player")
    streak = Column(Integer, default=0)
    sessions = Column(Integer, default=0)

class PlanItem(Base):
    __tablename__ = "plan_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    topic = Column(String)
    duration = Column(Integer)
    completed = Column(Integer, default=0)  # SQLite doesn't have native boolean, use 0/1 or Boolean type (SQLAlchemy handles it)

