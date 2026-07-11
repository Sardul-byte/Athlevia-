import os

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID

from database import get_db
from models import NutritionLog, User, VitalLog, Workout, UserProfile, BloodReport
from security import create_access_token, get_current_user, hash_password, verify_password

app = FastAPI(
    title="Athlevia API",
    description="Backend API for the Athlevia fitness & health tracking mobile application",
    version="0.1.0"
)

# Allow the Expo dev client (web) to call the API from another origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:8081").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
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
    id: UUID
    user_id: UUID
    logged_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfileUpdate(BaseModel):
    daily_calorie_goal: Optional[int] = None
    daily_water_goal_ml: Optional[int] = None

class UserProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    daily_calorie_goal: int
    daily_water_goal_ml: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

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

# User Profile Endpoints
@app.get("/profiles/me", response_model=UserProfileResponse)
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id, daily_calorie_goal=2000, daily_water_goal_ml=2000)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@app.put("/profiles/me", response_model=UserProfileResponse)
def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id, daily_calorie_goal=2000, daily_water_goal_ml=2000)
        db.add(profile)

    update_data = profile_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    db.commit()
    db.refresh(profile)
    return profile

class VitalLogCreate(BaseModel):
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    blood_pressure_sys: Optional[int] = None
    blood_pressure_dia: Optional[int] = None
    heart_rate_bpm: Optional[int] = None

class VitalLogResponse(VitalLogCreate):
    id: UUID
    user_id: UUID
    logged_at: datetime

    class Config:
        from_attributes = True

class NutritionLogCreate(BaseModel):
    food_name: str
    calories: int
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    water_ml: int = 0

class NutritionLogResponse(NutritionLogCreate):
    id: UUID
    user_id: UUID
    logged_at: datetime

    class Config:
        from_attributes = True

class BloodReportCreate(BaseModel):
    vitamin_d: Optional[float] = None
    vitamin_b12: Optional[float] = None
    cholesterol_ldl: Optional[float] = None
    cholesterol_hdl: Optional[float] = None
    thyroid_tsh: Optional[float] = None
    test_date: date

class BloodReportResponse(BloodReportCreate):
    id: UUID
    user_id: UUID
    logged_at: datetime

    class Config:
        from_attributes = True

# Workout Endpoints
@app.post("/workouts", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def log_workout(
    workout: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = Workout(user_id=current_user.id, **workout.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/workouts", response_model=List[WorkoutResponse])
def get_workouts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Workout)
        .filter(Workout.user_id == current_user.id)
        .order_by(Workout.logged_at.desc())
        .all()
    )

@app.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(Workout)
        .filter(Workout.id == workout_id, Workout.user_id == current_user.id)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    db.delete(record)
    db.commit()

# Vitals Endpoints
@app.post("/vitals", response_model=VitalLogResponse, status_code=status.HTTP_201_CREATED)
def log_vitals(
    vitals: VitalLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = VitalLog(user_id=current_user.id, **vitals.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/vitals", response_model=List[VitalLogResponse])
def get_vitals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(VitalLog)
        .filter(VitalLog.user_id == current_user.id)
        .order_by(VitalLog.logged_at.desc())
        .all()
    )

# Nutrition Endpoints
@app.post("/nutrition", response_model=NutritionLogResponse, status_code=status.HTTP_201_CREATED)
def log_nutrition(
    entry: NutritionLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = NutritionLog(user_id=current_user.id, **entry.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/nutrition", response_model=List[NutritionLogResponse])
def get_nutrition(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == current_user.id)
        .order_by(NutritionLog.logged_at.desc())
        .all()
    )

# Health & Vitals Endpoints
@app.get("/health/status")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Blood Report Endpoints
@app.post("/blood-reports", response_model=BloodReportResponse, status_code=status.HTTP_201_CREATED)
def log_blood_report(
    report: BloodReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = BloodReport(user_id=current_user.id, **report.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/blood-reports", response_model=List[BloodReportResponse])
def get_blood_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(BloodReport)
        .filter(BloodReport.user_id == current_user.id)
        .order_by(BloodReport.test_date.desc(), BloodReport.logged_at.desc())
        .all()
    )

@app.delete("/blood-reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blood_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(BloodReport)
        .filter(BloodReport.id == report_id, BloodReport.user_id == current_user.id)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blood report not found")
    db.delete(record)
    db.commit()
