import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { LabeledInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type Workout, type WorkoutSession, type WorkoutSet } from '@/lib/api';
import { readCache, writeCache } from '@/lib/cache';

const CATEGORIES = ['strength', 'cardio', 'swimming', 'sports', 'other'] as const;

const CATEGORY_EMOJIS = {
  strength: '🏋️‍♂️',
  cardio: '🏃‍♂️',
  swimming: '🏊‍♂️',
  sports: '⚽',
  other: '👟',
};

export default function WorkoutsScreen() {
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  
  // Quick Log form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('strength');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active Session states
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [sessionNameInput, setSessionNameInput] = useState('');
  const [startingSession, setStartingSession] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [setInputWeight, setSetInputWeight] = useState<{ [exName: string]: string }>({});
  const [setInputReps, setSetInputReps] = useState<{ [exName: string]: string }>({});
  const [savingSet, setSavingSet] = useState<{ [exName: string]: boolean }>({});
  const [finishCategory, setFinishCategory] = useState<'strength' | 'cardio' | 'swimming' | 'sports'>('strength');
  const [finishCalories, setFinishCalories] = useState('');
  const [finishingSession, setFinishingSession] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [freshWorkouts, active] = await Promise.all([
        api.getWorkouts(),
        api.getActiveWorkoutSession(),
      ]);
      setWorkouts(freshWorkouts);
      setActiveSession(active);
      writeCache('workouts', freshWorkouts);
      if (active) writeCache('active_session', active);
    } catch {
      const cachedWorkouts = await readCache<Workout[]>('workouts');
      const cachedActive = await readCache<WorkoutSession>('active_session');
      if (cachedWorkouts) setWorkouts(cachedWorkouts);
      if (cachedActive) setActiveSession(cachedActive);
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

  // Live Timer Effect
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      const start = new Date(activeSession.started_at).getTime();
      const elapsedMs = Date.now() - start;
      const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
      const h = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
      const m = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
      const s = (elapsedSec % 60).toString().padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Quick Log Past Workout Submit
  const submitQuickLog = async () => {
    const minutes = parseInt(duration, 10);
    if (!name.trim() || !Number.isFinite(minutes) || minutes <= 0) {
      setError('Enter a workout name and a duration in minutes.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const kcal = parseInt(calories, 10);
      await api.logWorkout({
        name: name.trim(),
        category,
        duration_minutes: minutes,
        ...(Number.isFinite(kcal) && kcal > 0 ? { calories_burned: kcal } : {}),
      });
      setName('');
      setDuration('');
      setCalories('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save workout');
    } finally {
      setSubmitting(false);
    }
  };

  // Active Session Actions
  const startSession = async () => {
    const sName = sessionNameInput.trim() || 'Daily Gym Session';
    setError(null);
    setStartingSession(true);
    try {
      const session = await api.startWorkoutSession(sName);
      setActiveSession(session);
      setSessionNameInput('');
      writeCache('active_session', session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session');
    } finally {
      setStartingSession(false);
    }
  };

  const addSet = async (exName: string) => {
    if (!activeSession) return;
    const wt = parseFloat(setInputWeight[exName] || '');
    const reps = parseInt(setInputReps[exName] || '', 10);
    if (!exName.trim() || !Number.isFinite(reps) || reps <= 0) {
      setError('Enter valid reps to add a set.');
      return;
    }
    setError(null);
    setSavingSet((prev) => ({ ...prev, [exName]: true }));
    try {
      const existingSets = activeSession.sets.filter((s) => s.exercise_name === exName);
      const setNum = existingSets.length + 1;
      await api.addWorkoutSet(activeSession.id, {
        exercise_name: exName,
        set_number: setNum,
        weight_kg: Number.isFinite(wt) ? wt : undefined,
        reps,
      });
      
      setSetInputWeight((prev) => ({ ...prev, [exName]: '' }));
      setSetInputReps((prev) => ({ ...prev, [exName]: '' }));
      
      const refreshed = await api.getActiveWorkoutSession();
      setActiveSession(refreshed);
      if (refreshed) writeCache('active_session', refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save set');
    } finally {
      setSavingSet((prev) => ({ ...prev, [exName]: false }));
    }
  };

  const deleteSet = async (setId: string) => {
    setError(null);
    try {
      await api.deleteWorkoutSet(setId);
      const refreshed = await api.getActiveWorkoutSession();
      setActiveSession(refreshed);
      if (refreshed) writeCache('active_session', refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete set');
    }
  };

  const finishSession = async () => {
    if (!activeSession) return;
    setFinishingSession(true);
    setError(null);
    try {
      const start = new Date(activeSession.started_at).getTime();
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - start) / 60000));
      const kcal = parseInt(finishCalories, 10) || elapsedMinutes * 6; // default 6 kcal/min

      await api.finishWorkoutSession(activeSession.id, {
        duration_minutes: elapsedMinutes,
        calories_burned: kcal,
        category: finishCategory,
      });

      setActiveSession(null);
      setFinishCalories('');
      writeCache('active_session', null);
      await load();
      Alert.alert('Success', 'Workout completed! You earned +100 Points! 🎉');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish workout session');
    } finally {
      setFinishingSession(false);
    }
  };

  const removeWorkout = (workout: Workout) => {
    const doDelete = async () => {
      try {
        await api.deleteWorkout(workout.id);
        setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete workout');
      }
    };
    if (Platform.OS === 'web') {
      doDelete();
      return;
    }
    Alert.alert('Delete workout', `Remove "${workout.name}" from history?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  // Group active session sets by exercise name
  const groupedSets: { [name: string]: WorkoutSet[] } = {};
  const exerciseNames: string[] = [];
  if (activeSession) {
    for (const set of activeSession.sets) {
      if (!groupedSets[set.exercise_name]) {
        groupedSets[set.exercise_name] = [];
        exerciseNames.push(set.exercise_name);
      }
      groupedSets[set.exercise_name].push(set);
    }
  }

  const handleAddNewExercise = () => {
    const name = newExerciseName.trim();
    if (!name) return;
    if (!exerciseNames.includes(name)) {
      groupedSets[name] = [];
      exerciseNames.push(name);
    }
    setNewExerciseName('');
  };

  // Header/Form layout
  const headerContent = (
    <ThemedView style={styles.formContainer}>
      <ThemedText type="subtitle">Fitness Workouts</ThemedText>
      {/* Active Workout Session Section */}
      {activeSession ? (
        <ThemedView type="backgroundElement" style={[styles.activeSessionCard, { borderColor: theme.backgroundSelected }]}>
          <ThemedView style={styles.activeHeader}>
            <ThemedView style={styles.activeTitleRow}>
              <ThemedView style={styles.pulseDot} />
              <ThemedText type="smallBold" themeColor="tint" style={{ letterSpacing: 0.5 }}>ACTIVE WORKOUT</ThemedText>
            </ThemedView>
            <ThemedText type="subtitle" style={styles.timerText}>{elapsedTime}</ThemedText>
          </ThemedView>
          
          <ThemedText type="smallBold" style={styles.sessionNameLabel}>
            Session: {activeSession.name}
          </ThemedText>

          {/* Exercise Log list */}
          {exerciseNames.length === 0 ? (
            <ThemedView style={styles.activeSessionEmpty}>
              <ThemedText type="small" themeColor="textSecondary">
                No exercises added yet. Type an exercise name below to start tracking.
              </ThemedText>
            </ThemedView>
          ) : (
            exerciseNames.map((exName) => (
              <ThemedView key={exName} type="backgroundSelected" style={[styles.exerciseCard, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="tint" style={{ fontSize: 15, textTransform: 'uppercase' }}>{exName}</ThemedText>
                
                {/* Sets listed in a clean table format */}
                {groupedSets[exName].length > 0 && (
                  <ThemedView style={styles.setsTable}>
                    <ThemedView style={styles.tableHeader}>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colHeader}>SET</ThemedText>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.colHeader, { flex: 2 }]}>WEIGHT</ThemedText>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.colHeader, { flex: 2 }]}>REPS</ThemedText>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.colHeader, { textAlign: 'right' }]}>ACTION</ThemedText>
                    </ThemedView>
                    {groupedSets[exName].map((s) => (
                      <ThemedView key={s.id} style={styles.setTableRow}>
                        <ThemedView style={styles.setNumBadge}>
                          <ThemedText type="smallBold" style={styles.setNumText}>{s.set_number}</ThemedText>
                        </ThemedView>
                        <ThemedText type="small" style={{ flex: 2 }}>{s.weight_kg ? `${s.weight_kg} kg` : '—'}</ThemedText>
                        <ThemedText type="small" style={{ flex: 2 }}>{s.reps} reps</ThemedText>
                        <Pressable onPress={() => deleteSet(s.id)} style={styles.removeSetBtn}>
                          <ThemedText type="smallBold" style={{ color: '#EF4444', fontSize: 12 }}>Remove</ThemedText>
                        </Pressable>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                {/* Add new set inputs */}
                <ThemedView style={styles.setInputsRow}>
                  <ThemedView style={{ flex: 1 }}>
                    <LabeledInput
                      label="Weight (kg)"
                      value={setInputWeight[exName] || ''}
                      onChangeText={(val) => setSetInputWeight((prev) => ({ ...prev, [exName]: val }))}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                    />
                  </ThemedView>
                  <ThemedView style={{ flex: 1 }}>
                    <LabeledInput
                      label="Reps"
                      value={setInputReps[exName] || ''}
                      onChangeText={(val) => setSetInputReps((prev) => ({ ...prev, [exName]: val }))}
                      keyboardType="number-pad"
                      placeholder="10"
                    />
                  </ThemedView>
                  <Pressable 
                    onPress={() => addSet(exName)} 
                    style={[styles.addSetButton, { backgroundColor: theme.tint }]}>
                    <ThemedText type="smallBold" style={{ color: '#fff' }}>+ Set</ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>
            ))
          )}

          {/* Add New Exercise control */}
          <ThemedView style={styles.addExerciseRow}>
            <ThemedView style={{ flex: 1 }}>
              <LabeledInput
                label="New Exercise Name"
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                placeholder="e.g. Bench Press, Squat"
              />
            </ThemedView>
            <Pressable 
              onPress={handleAddNewExercise} 
              style={[styles.addExerciseButton, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="text">+ Add</ThemedText>
            </Pressable>
          </ThemedView>

          {/* Finish Workout Section */}
          <ThemedView style={styles.finishSection}>
            <ThemedText type="smallBold">FINISH SESSION</ThemedText>
            <ThemedView style={styles.categoryRow}>
              {(['strength', 'cardio', 'swimming', 'sports'] as const).map((c) => (
                <Pressable key={c} onPress={() => setFinishCategory(c)}>
                  <ThemedView
                    type={finishCategory === c ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.chip, finishCategory === c && { borderColor: theme.tint, borderWidth: 1 }]}>
                    <ThemedText type="small">{c}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
            <LabeledInput
              label="Calories Burned (Estimated)"
              value={finishCalories}
              onChangeText={setFinishCalories}
              keyboardType="number-pad"
              placeholder="e.g. 350"
            />
            <PrimaryButton title="Complete Workout & Claim 100 Pts" onPress={finishSession} loading={finishingSession} />
          </ThemedView>
        </ThemedView>
      ) : (
        <ThemedView type="backgroundElement" style={[styles.sessionStartCard, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" style={{ fontSize: 12, letterSpacing: 0.5 }}>START WORKOUT SESSION</ThemedText>
          <ThemedView style={styles.sessionStartInputRow}>
            <ThemedView style={{ flex: 1 }}>
              <LabeledInput
                label="Session Name"
                value={sessionNameInput}
                onChangeText={setSessionNameInput}
                placeholder="e.g. Legs Day, Afternoon Run"
              />
            </ThemedView>
            <Pressable 
              onPress={startSession} 
              style={[styles.startSessionButton, { backgroundColor: theme.tint }]}>
              <ThemedText type="smallBold" style={{ color: '#fff' }}>Start Session</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>
      )}

      {/* Manual log form (Quick log) */}
      {!activeSession && (
        <ThemedView type="backgroundElement" style={styles.quickLogCard}>
          <ThemedText type="smallBold">QUICK LOG PAST WORKOUT</ThemedText>
          <LabeledInput
            label="Workout name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push day, 5k run"
          />

          <ThemedView style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)}>
                <ThemedView
                  type={category === c ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, category === c && { borderColor: theme.tint, borderWidth: 1 }]}>
                  <ThemedText type="small">{c}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.inlineFields}>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="Duration (min)"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="45"
              />
            </ThemedView>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="Calories (optional)"
                value={calories}
                onChangeText={setCalories}
                keyboardType="number-pad"
                placeholder="300"
              />
            </ThemedView>
          </ThemedView>

          <PrimaryButton title="Log Workout (+50 Pts)" onPress={submitQuickLog} loading={submitting} />
        </ThemedView>
      )}

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.historyTitle}>
        WORKOUT HISTORY
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          ListHeaderComponent={headerContent}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText themeColor="textSecondary">No workouts logged yet.</ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => {
            const emoji = CATEGORY_EMOJIS[item.category as keyof typeof CATEGORY_EMOJIS] || '💪';
            return (
              <ThemedView type="backgroundElement" style={styles.listRow}>
                <ThemedView style={styles.listRowText}>
                  <ThemedText type="smallBold">{emoji} {item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.category.toUpperCase()} · {item.duration_minutes} min
                    {item.calories_burned ? ` · ${item.calories_burned} kcal` : ''} ·{' '}
                    {new Date(item.logged_at).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
                <Pressable onPress={() => removeWorkout(item)} hitSlop={Spacing.two}>
                  <ThemedText type="small" style={styles.delete}>
                    Delete
                  </ThemedText>
                </Pressable>
              </ThemedView>
            );
          }}
        />
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
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: TopTabInset + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  formContainer: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
    backgroundColor: 'transparent',
  },
  quickLogCard: {
    padding: Spacing.three,
    borderRadius: 14,
    gap: Spacing.three,
  },
  activeSessionCard: {
    padding: Spacing.three,
    borderRadius: 14,
    gap: Spacing.three,
    borderWidth: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Spacing.two,
  },
  activeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  timerText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
    fontSize: 20,
    letterSpacing: 1,
  },
  sessionNameLabel: {
    marginBottom: Spacing.one,
    fontSize: 15,
  },
  activeSessionEmpty: {
    padding: Spacing.three,
    alignItems: 'center',
  },
  exerciseCard: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  setsTable: {
    gap: 4,
    paddingVertical: Spacing.one,
    backgroundColor: 'transparent',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.5,
  },
  setTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    backgroundColor: 'transparent',
  },
  setNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  setNumText: {
    fontSize: 11,
  },
  removeSetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  setInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  addSetButton: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.four,
    marginBottom: 2,
  },
  addExerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  addExerciseButton: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.four,
    marginBottom: 2,
  },
  finishSection: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: Spacing.three,
  },
  sessionStartCard: {
    padding: Spacing.three,
    borderRadius: 14,
    gap: Spacing.two,
    borderWidth: 1,
  },
  sessionStartInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  startSessionButton: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.four,
    marginBottom: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inlineField: {
    flex: 1,
  },
  historyTitle: {
    marginTop: Spacing.three,
  },
  emptyCard: {
    borderRadius: 14,
    padding: Spacing.four,
  },
  listRow: {
    borderRadius: 14,
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
  delete: {
    color: '#EF4444',
  },
  error: {
    color: '#EF4444',
    marginTop: Spacing.one,
  },
});
