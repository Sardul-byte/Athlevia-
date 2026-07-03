from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User
from security import create_access_token, get_current_user, hash_password, verify_password

app = FastAPI(
    title="Athlevia API",
    description="Backend API for the Athlevia fitness & health tracking mobile application",
    version="0.1.0"
)

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

class WorkoutCreate(BaseModel):
    name: str
    category: str
    duration_minutes: int
    calories_burned: Optional[int] = None

class WorkoutResponse(WorkoutCreate):
    id: str
    user_id: str
    logged_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# Auth Endpoints
@app.post("/auth/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    new_user = User(email=user.email, password_hash=hash_password(user.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(user.id))

@app.get("/auth/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

# Workout Endpoints
@app.post("/workouts", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def log_workout(workout: WorkoutCreate):
    # TODO: Save workout log to database
    return {
        "id": "mock-workout-id",
        "user_id": "mock-user-id",
        "logged_at": datetime.utcnow(),
        **workout.model_dump()
    }

@app.get("/workouts", response_model=List[WorkoutResponse])
def get_workouts():
    # TODO: Query workout logs from database
    return []

# Health & Vitals Endpoints
@app.get("/health/status")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
