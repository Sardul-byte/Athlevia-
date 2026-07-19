import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'atlevia:cache:';

export type CacheKey =
  | 'workouts'
  | 'nutrition'
  | 'vitals'
  | 'profile'
  | 'blood_reports'
  | 'unlocked_themes'
  | 'selected_theme'
  | 'active_session'
  | 'supplements_today';

export async function readCache<T>(key: CacheKey): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache(key: CacheKey, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Caching is best-effort; the app still works from the network.
  }
}

/** Remove all cached API data (called on sign-out so users never see each other's data). */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    // Best-effort.
  }
}
