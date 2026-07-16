import os

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID

from database import get_db
from models import NutritionLog, User, VitalLog, Workout, UserProfile, BloodReport, WorkoutSession, WorkoutSet, Supplement, SupplementLog
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

class WorkoutSessionCreate(BaseModel):
    name: str

class WorkoutSetCreate(BaseModel):
    exercise_name: str
    set_number: int
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    completed: Optional[int] = 0

class WorkoutSetResponse(WorkoutSetCreate):
    id: UUID
    session_id: UUID
    logged_at: datetime

    class Config:
        from_attributes = True

class WorkoutSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_minutes: int
    calories_burned: int
    sets: List[WorkoutSetResponse] = []

    class Config:
        from_attributes = True

class WorkoutSessionFinish(BaseModel):
    duration_minutes: int
    calories_burned: int
    category: str

class SupplementCreate(BaseModel):
    name: str
    dosage: Optional[str] = None
    schedule_time: Optional[str] = None

class SupplementResponse(SupplementCreate):
    id: UUID
    user_id: UUID
    active: int
    created_at: datetime

    class Config:
        from_attributes = True

class SupplementLogResponse(BaseModel):
    id: UUID
    supplement_id: UUID
    logged_date: date
    taken: int

    class Config:
        from_attributes = True

class SupplementTodayResponse(BaseModel):
    id: UUID
    name: str
    dosage: Optional[str] = None
    schedule_time: Optional[str] = None
    taken: bool = False
    log_id: Optional[UUID] = None



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

# Workout Session Endpoints
@app.get("/workouts/sessions/active", response_model=Optional[WorkoutSessionResponse])
def get_active_workout_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == current_user.id, WorkoutSession.status == "active")
        .first()
    )

@app.post("/workouts/sessions/start", response_model=WorkoutSessionResponse, status_code=status.HTTP_201_CREATED)
def start_workout_session(
    session_data: WorkoutSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == current_user.id, WorkoutSession.status == "active")
        .first()
    )
    if active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active workout session. Finish or cancel it first.",
        )
    
    new_session = WorkoutSession(user_id=current_user.id, name=session_data.name)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.post("/workouts/sessions/{session_id}/sets", response_model=WorkoutSetResponse, status_code=status.HTTP_201_CREATED)
def add_workout_set(
    session_id: UUID,
    set_data: WorkoutSetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.id == session_id, WorkoutSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout session not found")
    if session.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add sets to a completed session")
    
    new_set = WorkoutSet(session_id=session_id, **set_data.model_dump())
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return new_set

@app.delete("/workouts/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout_set(
    set_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(WorkoutSet)
        .join(WorkoutSession)
        .filter(WorkoutSet.id == set_id, WorkoutSession.user_id == current_user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout set not found")
    
    db.delete(record)
    db.commit()

@app.post("/workouts/sessions/{session_id}/finish", response_model=WorkoutSessionResponse)
def finish_workout_session(
    session_id: UUID,
    finish_data: WorkoutSessionFinish,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.id == session_id, WorkoutSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout session not found")
    if session.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is already finished")
    
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    session.duration_minutes = finish_data.duration_minutes
    session.calories_burned = finish_data.calories_burned
    
    workout_log = Workout(
        user_id=current_user.id,
        name=session.name,
        category=finish_data.category,
        duration_minutes=finish_data.duration_minutes,
        calories_burned=finish_data.calories_burned,
        logged_at=session.completed_at
    )
    db.add(workout_log)
    db.commit()
    db.refresh(session)
    return session

# Supplement Endpoints
@app.get("/supplements", response_model=List[SupplementResponse])
def get_supplements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Supplement)
        .filter(Supplement.user_id == current_user.id, Supplement.active == 1)
        .order_by(Supplement.created_at.desc())
        .all()
    )

@app.post("/supplements", response_model=SupplementResponse, status_code=status.HTTP_201_CREATED)
def create_supplement(
    supplement: SupplementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = Supplement(user_id=current_user.id, **supplement.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.delete("/supplements/{supplement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplement(
    supplement_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(Supplement)
        .filter(Supplement.id == supplement_id, Supplement.user_id == current_user.id)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplement not found")
    
    record.active = 0
    db.commit()

@app.get("/supplements/today", response_model=List[SupplementTodayResponse])
def get_today_supplements_checklist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    active_supps = (
        db.query(Supplement)
        .filter(Supplement.user_id == current_user.id, Supplement.active == 1)
        .all()
    )
    today_logs = (
        db.query(SupplementLog)
        .filter(SupplementLog.user_id == current_user.id, SupplementLog.logged_date == today)
        .all()
    )
    log_map = {log.supplement_id: log for log in today_logs}
    
    results = []
    for s in active_supps:
        log = log_map.get(s.id)
        results.append(
            SupplementTodayResponse(
                id=s.id,
                name=s.name,
                dosage=s.dosage,
                schedule_time=s.schedule_time,
                taken=log.taken == 1 if log else False,
                log_id=log.id if log else None
            )
        )
    return results

@app.post("/supplements/{supplement_id}/toggle", response_model=SupplementTodayResponse)
def toggle_supplement_status(
    supplement_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    supplement = (
        db.query(Supplement)
        .filter(Supplement.id == supplement_id, Supplement.user_id == current_user.id)
        .first()
    )
    if not supplement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplement not found")
        
    log = (
        db.query(SupplementLog)
        .filter(SupplementLog.supplement_id == supplement_id, SupplementLog.logged_date == today)
        .first()
    )
    
    if log:
        log.taken = 1 if log.taken == 0 else 0
        db.commit()
        db.refresh(log)
    else:
        log = SupplementLog(
            supplement_id=supplement_id,
            user_id=current_user.id,
            logged_date=today,
            taken=1
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        
    return SupplementTodayResponse(
        id=supplement.id,
        name=supplement.name,
        dosage=supplement.dosage,
        schedule_time=supplement.schedule_time,
        taken=log.taken == 1,
        log_id=log.id
    )

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
