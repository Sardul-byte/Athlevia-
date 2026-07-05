import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { LabeledInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { api, type NutritionLog, type VitalLog } from '@/lib/api';

const WATER_PRESETS = [250, 500, 750] as const;

function parseNum(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function bmi(vital: VitalLog | undefined): string | null {
  if (!vital?.weight_kg || !vital?.height_cm) return null;
  const meters = Number(vital.height_cm) / 100;
  return (Number(vital.weight_kg) / (meters * meters)).toFixed(1);
}

export default function HealthScreen() {
  const [vitals, setVitals] = useState<VitalLog[]>([]);
  const [nutrition, setNutrition] = useState<NutritionLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Vitals form
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [savingVitals, setSavingVitals] = useState(false);

  // Nutrition form
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [savingFood, setSavingFood] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, n] = await Promise.all([api.getVitals(), api.getNutrition()]);
      setVitals(v);
      setNutrition(n);
    } catch {
      // Backend unreachable; keep current data.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const latestVitals = vitals[0];
  const latestBmi = bmi(latestVitals);

  const saveVitals = async () => {
    const payload = {
      weight_kg: parseNum(weight),
      height_cm: parseNum(height),
      heart_rate_bpm: parseNum(heartRate),
      blood_pressure_sys: parseNum(bpSys),
      blood_pressure_dia: parseNum(bpDia),
    };
    if (Object.values(payload).every((v) => v === undefined)) {
      setError('Enter at least one vital measurement.');
      return;
    }
    setError(null);
    setSavingVitals(true);
    try {
      await api.logVitals(payload);
      setWeight('');
      setHeight('');
      setHeartRate('');
      setBpSys('');
      setBpDia('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save vitals');
    } finally {
      setSavingVitals(false);
    }
  };

  const saveFood = async () => {
    const kcal = parseNum(foodCalories);
    if (!foodName.trim() || kcal === undefined) {
      setError('Enter a food name and its calories.');
      return;
    }
    setError(null);
    setSavingFood(true);
    try {
      await api.logNutrition({ food_name: foodName.trim(), calories: Math.round(kcal) });
      setFoodName('');
      setFoodCalories('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save meal');
    } finally {
      setSavingFood(false);
    }
  };

  const addWater = async (ml: number) => {
    setError(null);
    try {
      await api.logNutrition({ food_name: 'Water', calories: 0, water_ml: ml });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log water');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="subtitle">Health Hub</ThemedText>

          {latestVitals && (
            <ThemedView type="backgroundElement" style={styles.summaryCard}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                LATEST VITALS · {new Date(latestVitals.logged_at).toLocaleDateString()}
              </ThemedText>
              <ThemedText>
                {latestVitals.weight_kg ? `${latestVitals.weight_kg} kg` : ''}
                {latestBmi ? ` · BMI ${latestBmi}` : ''}
                {latestVitals.heart_rate_bpm ? ` · ${latestVitals.heart_rate_bpm} bpm` : ''}
                {latestVitals.blood_pressure_sys && latestVitals.blood_pressure_dia
                  ? ` · BP ${latestVitals.blood_pressure_sys}/${latestVitals.blood_pressure_dia}`
                  : ''}
              </ThemedText>
            </ThemedView>
          )}

          <ThemedText type="smallBold" themeColor="textSecondary">
            LOG VITALS
          </ThemedText>
          <ThemedView style={styles.inlineFields}>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="72.5"
              />
            </ThemedView>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="Height (cm)"
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                placeholder="178"
              />
            </ThemedView>
          </ThemedView>
          <ThemedView style={styles.inlineFields}>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="Heart rate (bpm)"
                value={heartRate}
                onChangeText={setHeartRate}
                keyboardType="number-pad"
                placeholder="62"
              />
            </ThemedView>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="BP systolic"
                value={bpSys}
                onChangeText={setBpSys}
                keyboardType="number-pad"
                placeholder="120"
              />
            </ThemedView>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="BP diastolic"
                value={bpDia}
                onChangeText={setBpDia}
                keyboardType="number-pad"
                placeholder="80"
              />
            </ThemedView>
          </ThemedView>
          <PrimaryButton title="Save Vitals" onPress={saveVitals} loading={savingVitals} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            LOG A MEAL
          </ThemedText>
          <ThemedView style={styles.inlineFields}>
            <ThemedView style={styles.inlineFieldWide}>
              <LabeledInput
                label="Food"
                value={foodName}
                onChangeText={setFoodName}
                placeholder="e.g. Chicken salad"
              />
            </ThemedView>
            <ThemedView style={styles.inlineField}>
              <LabeledInput
                label="Calories"
                value={foodCalories}
                onChangeText={setFoodCalories}
                keyboardType="number-pad"
                placeholder="420"
              />
            </ThemedView>
          </ThemedView>
          <PrimaryButton title="Log Meal" onPress={saveFood} loading={savingFood} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            QUICK HYDRATION
          </ThemedText>
          <ThemedView style={styles.waterRow}>
            {WATER_PRESETS.map((ml) => (
              <Pressable key={ml} onPress={() => addWater(ml)} style={styles.waterButtonWrap}>
                <ThemedView type="backgroundElement" style={styles.waterButton}>
                  <ThemedText type="smallBold" themeColor="tint">
                    +{ml} ml
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            RECENT ENTRIES
          </ThemedText>
          {nutrition.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText themeColor="textSecondary">No meals or water logged yet.</ThemedText>
            </ThemedView>
          ) : (
            nutrition.slice(0, 8).map((n) => (
              <ThemedView key={n.id} type="backgroundElement" style={styles.listRow}>
                <ThemedText type="smallBold">{n.food_name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {n.water_ml > 0 ? `${n.water_ml} ml` : `${n.calories} kcal`} ·{' '}
                  {new Date(n.logged_at).toLocaleDateString()}
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  summaryCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inlineField: {
    flex: 1,
  },
  inlineFieldWide: {
    flex: 2,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  waterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  waterButtonWrap: {
    flex: 1,
  },
  waterButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
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
  error: {
    color: '#EF4444',
  },
});
