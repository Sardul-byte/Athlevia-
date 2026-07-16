"""SQLAlchemy ORM models mirroring schema.sql."""

import uuid

from sqlalchemy import (
    DECIMAL,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    vital_logs = relationship("VitalLog", back_populates="user", cascade="all, delete-orphan")
    nutrition_logs = relationship(
        "NutritionLog", back_populates="user", cascade="all, delete-orphan"
    )
    profile = relationship("UserProfile", uselist=False, back_populates="user", cascade="all, delete-orphan")
    blood_reports = relationship("BloodReport", back_populates="user", cascade="all, delete-orphan")
    workout_sessions = relationship("WorkoutSession", back_populates="user", cascade="all, delete-orphan")
    supplements = relationship("Supplement", back_populates="user", cascade="all, delete-orphan")
    supplement_logs = relationship("SupplementLog", back_populates="user", cascade="all, delete-orphan")




class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    calories_burned = Column(Integer)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="workouts")


class VitalLog(Base):
    __tablename__ = "vital_logs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    weight_kg = Column(DECIMAL(5, 2))
    height_cm = Column(DECIMAL(5, 2))
    blood_pressure_sys = Column(Integer)
    blood_pressure_dia = Column(Integer)
    heart_rate_bpm = Column(Integer)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="vital_logs")


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    food_name = Column(String(255), nullable=False)
    calories = Column(Integer, nullable=False)
    protein_g = Column(DECIMAL(5, 2))
    carbs_g = Column(DECIMAL(5, 2))
    fat_g = Column(DECIMAL(5, 2))
    water_ml = Column(Integer, default=0)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="nutrition_logs")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    daily_calorie_goal = Column(Integer, default=2000, nullable=False)
    daily_water_goal_ml = Column(Integer, default=2000, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="profile")


class BloodReport(Base):
    __tablename__ = "blood_reports"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    vitamin_d = Column(DECIMAL(6, 2))
    vitamin_b12 = Column(DECIMAL(6, 2))
    cholesterol_ldl = Column(DECIMAL(6, 2))
    cholesterol_hdl = Column(DECIMAL(6, 2))
    thyroid_tsh = Column(DECIMAL(6, 2))
    test_date = Column(Date, nullable=False)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="blood_reports")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="active", nullable=False)  # 'active', 'completed'
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, default=0, nullable=False)
    calories_burned = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="workout_sessions")
    sets = relationship("WorkoutSet", back_populates="session", cascade="all, delete-orphan")


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False)
    exercise_name = Column(String(255), nullable=False)
    set_number = Column(Integer, nullable=False)
    weight_kg = Column(DECIMAL(6, 2), nullable=True)
    reps = Column(Integer, nullable=True)
    completed = Column(Integer, default=0, nullable=False)  # SQLite compatibility (0=no, 1=yes)
    logged_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("WorkoutSession", back_populates="sets")


class Supplement(Base):
    __tablename__ = "supplements"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=True)  # e.g., "5g", "1 capsule"
    schedule_time = Column(String(50), nullable=True)  # e.g., "08:00", "Morning"
    active = Column(Integer, default=1, nullable=False)  # 1=active, 0=inactive
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="supplements")
    logs = relationship("SupplementLog", back_populates="supplement", cascade="all, delete-orphan")


class SupplementLog(Base):
    __tablename__ = "supplement_logs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    supplement_id = Column(Uuid, ForeignKey("supplements.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    logged_date = Column(Date, nullable=False)
    taken = Column(Integer, default=1, nullable=False)  # 1=taken, 0=untaken

    supplement = relationship("Supplement", back_populates="logs")
    user = relationship("User", back_populates="supplement_logs")


