import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { api, type NutritionLog, type Workout } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function isToday(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.statCard}>
      <ThemedText type="subtitle" themeColor="tint">
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {unit}
      </ThemedText>
      <ThemedText type="smallBold">{label}</ThemedText>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [nutrition, setNutrition] = useState<NutritionLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, n] = await Promise.all([api.getWorkouts(), api.getNutrition()]);
      setWorkouts(w);
      setNutrition(n);
    } catch {
      // Backend unreachable; keep whatever we had.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const todayWorkouts = workouts.filter((w) => isToday(w.logged_at));
  const todayNutrition = nutrition.filter((n) => isToday(n.logged_at));
  const activeMinutes = todayWorkouts.reduce((sum, w) => sum + w.duration_minutes, 0);
  const caloriesBurned = todayWorkouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const caloriesEaten = todayNutrition.reduce((sum, n) => sum + n.calories, 0);
  const waterMl = todayNutrition.reduce((sum, n) => sum + n.water_ml, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <ThemedView style={styles.header}>
            <ThemedView>
              <ThemedText type="subtitle">Today</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user?.email}
              </ThemedText>
            </ThemedView>
            <Pressable onPress={signOut}>
              <ThemedText type="link" themeColor="tint">
                Sign out
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.statsGrid}>
            <StatCard label="Workouts" value={todayWorkouts.length} unit="sessions" />
            <StatCard label="Active" value={activeMinutes} unit="minutes" />
            <StatCard label="Burned" value={caloriesBurned} unit="kcal" />
            <StatCard label="Eaten" value={caloriesEaten} unit="kcal" />
            <StatCard label="Water" value={waterMl} unit="ml" />
            <StatCard label="Meals" value={todayNutrition.length} unit="logged" />
          </ThemedView>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            RECENT WORKOUTS
          </ThemedText>
          {workouts.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText themeColor="textSecondary">
                No workouts yet — log your first one from the Workouts tab.
              </ThemedText>
            </ThemedView>
          ) : (
            workouts.slice(0, 5).map((w) => (
              <ThemedView key={w.id} type="backgroundElement" style={styles.listRow}>
                <ThemedView style={styles.listRowText}>
                  <ThemedText type="smallBold">{w.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {w.category} · {w.duration_minutes} min
                    {w.calories_burned ? ` · ${w.calories_burned} kcal` : ''}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(w.logged_at).toLocaleDateString()}
                </ThemedText>
              </ThemedView>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: TopTabInset + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  emptyCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  listRow: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  listRowText: {
    backgroundColor: 'transparent',
    gap: Spacing.half,
    flexShrink: 1,
  },
});
