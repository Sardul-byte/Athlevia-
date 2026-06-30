from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

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

# Auth Endpoints
@app.post("/auth/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate):
    # TODO: Implement database user registration & password hashing
    return {
        "id": "mock-user-id",
        "email": user.email,
        "created_at": datetime.utcnow()
    }

@app.post("/auth/login")
def login(user: UserCreate):
    # TODO: Validate user and return JWT access token
    return {"access_token": "mock-jwt-token", "token_type": "bearer"}

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
