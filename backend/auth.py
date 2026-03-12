import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv

# Load .env from project root IMMEDIATELY so SECRET_KEY is available
_env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=_env_path)

from fastapi import Depends, HTTPException, status, Header
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
from database import get_db

# Secret key - uses a hardcoded default if nothing in .env
SECRET_KEY = os.getenv("SECRET_KEY", "aimforge-dev-secret-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    # IMPORTANT: 'sub' must be a string for python-jose
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"[AUTH DEBUG] Created token for sub={to_encode.get('sub')}")
    return encoded


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not authorization or not authorization.startswith("Bearer "):
        print(f"[AUTH DEBUG] No valid Authorization header. Got: {authorization}")
        raise credentials_exception

    token = authorization.split(" ", 1)[1]
    print(f"[AUTH DEBUG] Verifying token with SECRET_KEY='{SECRET_KEY[:10]}...'")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        print(f"[AUTH DEBUG] Token decoded OK. user_id={user_id_str}")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError) as e:
        print(f"[AUTH DEBUG] JWT decode FAILED: {e}")
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        print(f"[AUTH DEBUG] User with id={user_id} not found in DB")
        raise credentials_exception

    print(f"[AUTH DEBUG] Auth OK for user: {user.username}")
    return user
