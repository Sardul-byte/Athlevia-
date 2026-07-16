import { Platform } from 'react-native';

import { getToken } from '@/lib/token-storage';

// Android emulators reach the host machine via 10.0.2.2.
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_HOST;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// --- Types mirroring the FastAPI response models ---

export type User = { id: string; email: string; created_at: string };
export type TokenResponse = { access_token: string; token_type: string };

export type Workout = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  duration_minutes: number;
  calories_burned: number | null;
  logged_at: string;
};

export type VitalLog = {
  id: string;
  user_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  heart_rate_bpm: number | null;
  logged_at: string;
};

export type NutritionLog = {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number;
  logged_at: string;
};

export type UserProfile = {
  id: string;
  user_id: string;
  daily_calorie_goal: number;
  daily_water_goal_ml: number;
  points: number;
  streak_days: number;
  created_at: string;
  updated_at: string;
};

export type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: number;
  logged_at: string;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number;
  calories_burned: number;
  sets: WorkoutSet[];
};

export type Supplement = {
  id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  schedule_time: string | null;
  active: number;
  created_at: string;
};

export type SupplementToday = {
  id: string;
  name: string;
  dosage: string | null;
  schedule_time: string | null;
  taken: boolean;
  log_id: string | null;
};


export type BloodReport = {
  id: string;
  user_id: string;
  vitamin_d: number | null;
  vitamin_b12: number | null;
  cholesterol_ldl: number | null;
  cholesterol_hdl: number | null;
  thyroid_tsh: number | null;
  test_date: string;
  logged_at: string;
};


// --- Endpoints ---

export const api = {
  signup: (email: string, password: string) =>
    request<User>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/auth/me'),

  getWorkouts: () => request<Workout[]>('/workouts'),
  logWorkout: (workout: {
    name: string;
    category: string;
    duration_minutes: number;
    calories_burned?: number;
  }) => request<Workout>('/workouts', { method: 'POST', body: JSON.stringify(workout) }),
  deleteWorkout: (id: string) => request<void>(`/workouts/${id}`, { method: 'DELETE' }),

  getVitals: () => request<VitalLog[]>('/vitals'),
  logVitals: (vitals: Partial<Omit<VitalLog, 'id' | 'user_id' | 'logged_at'>>) =>
    request<VitalLog>('/vitals', { method: 'POST', body: JSON.stringify(vitals) }),

  getNutrition: () => request<NutritionLog[]>('/nutrition'),
  logNutrition: (entry: {
    food_name: string;
    calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    water_ml?: number;
  }) => request<NutritionLog>('/nutrition', { method: 'POST', body: JSON.stringify(entry) }),
  getProfile: () => request<UserProfile>('/profiles/me'),
  updateProfile: (profile: Partial<Pick<UserProfile, 'daily_calorie_goal' | 'daily_water_goal_ml'>>) =>
    request<UserProfile>('/profiles/me', { method: 'PUT', body: JSON.stringify(profile) }),

  getBloodReports: () => request<BloodReport[]>('/blood-reports'),
  logBloodReport: (report: {
    vitamin_d?: number;
    vitamin_b12?: number;
    cholesterol_ldl?: number;
    cholesterol_hdl?: number;
    thyroid_tsh?: number;
    test_date: string;
  }) => request<BloodReport>('/blood-reports', { method: 'POST', body: JSON.stringify(report) }),
  deleteBloodReport: (id: string) => request<void>(`/blood-reports/${id}`, { method: 'DELETE' }),

  getActiveWorkoutSession: () => request<WorkoutSession | null>('/workouts/sessions/active'),
  startWorkoutSession: (name: string) =>
    request<WorkoutSession>('/workouts/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  addWorkoutSet: (sessionId: string, set: { exercise_name: string; set_number: number; weight_kg?: number; reps?: number }) =>
    request<WorkoutSet>(`/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      body: JSON.stringify(set),
    }),
  deleteWorkoutSet: (setId: string) => request<void>(`/workouts/sets/${setId}`, { method: 'DELETE' }),
  finishWorkoutSession: (sessionId: string, finish: { duration_minutes: number; calories_burned: number; category: string }) =>
    request<WorkoutSession>(`/workouts/sessions/${sessionId}/finish`, {
      method: 'POST',
      body: JSON.stringify(finish),
    }),

  getSupplements: () => request<Supplement[]>('/supplements'),
  addSupplement: (supplement: { name: string; dosage?: string; schedule_time?: string }) =>
    request<Supplement>('/supplements', { method: 'POST', body: JSON.stringify(supplement) }),
  deleteSupplement: (id: string) => request<void>(`/supplements/${id}`, { method: 'DELETE' }),
  getTodaySupplements: () => request<SupplementToday[]>('/supplements/today'),
  toggleSupplement: (id: string) => request<SupplementToday>(`/supplements/${id}/toggle`, { method: 'POST' }),

  claimPoints: (amount: number, reason: string) =>
    request<UserProfile>('/profiles/me/claim-points', {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),
  redeemReward: (points: number, reward_id: string) =>
    request<UserProfile>('/profiles/me/redeem-reward', {
      method: 'POST',
      body: JSON.stringify({ points, reward_id }),
    }),
};
