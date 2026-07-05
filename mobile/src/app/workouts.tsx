import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { LabeledInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type Workout } from '@/lib/api';

const CATEGORIES = ['strength', 'cardio', 'swimming', 'sports', 'other'] as const;

export default function WorkoutsScreen() {
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('strength');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setWorkouts(await api.getWorkouts());
    } catch {
      // Backend unreachable; keep current list.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async () => {
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

  const remove = (workout: Workout) => {
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
    Alert.alert('Delete workout', `Remove "${workout.name}" from your history?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const form = (
    <ThemedView style={styles.form}>
      <ThemedText type="subtitle">Workouts</ThemedText>

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

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <PrimaryButton title="Log Workout" onPress={submit} loading={submitting} />

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.historyTitle}>
        HISTORY
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          ListHeaderComponent={form}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText themeColor="textSecondary">No workouts logged yet.</ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.listRow}>
              <ThemedView style={styles.listRowText}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.category} · {item.duration_minutes} min
                  {item.calories_burned ? ` · ${item.calories_burned} kcal` : ''} ·{' '}
                  {new Date(item.logged_at).toLocaleDateString()}
                </ThemedText>
              </ThemedView>
              <Pressable onPress={() => remove(item)} hitSlop={Spacing.two}>
                <ThemedText type="small" style={styles.delete}>
                  Delete
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
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
  error: {
    color: '#EF4444',
  },
  delete: {
    color: '#EF4444',
  },
});
