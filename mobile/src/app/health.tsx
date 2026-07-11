import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { LabeledInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { api, type NutritionLog, type VitalLog, type BloodReport } from '@/lib/api';
import { readCache, writeCache } from '@/lib/cache';

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
  const [refreshing, setRefreshing] = useState(false);

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

  // Blood reports state
  const [bloodReports, setBloodReports] = useState<BloodReport[]>([]);
  const [vitD, setVitD] = useState('');
  const [vitB12, setVitB12] = useState('');
  const [ldl, setLdl] = useState('');
  const [hdl, setHdl] = useState('');
  const [tsh, setTsh] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingReport, setSavingReport] = useState(false);
  const [isAddingReport, setIsAddingReport] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, n, b] = await Promise.all([
        api.getVitals(),
        api.getNutrition(),
        api.getBloodReports(),
      ]);
      setVitals(v);
      setNutrition(n);
      setBloodReports(b);
      writeCache('vitals', v);
      writeCache('nutrition', n);
      writeCache('blood_reports', b);
    } catch {
      // Backend unreachable; fall back to the last cached snapshot.
      const [v, n, b] = await Promise.all([
        readCache<VitalLog[]>('vitals'),
        readCache<NutritionLog[]>('nutrition'),
        readCache<BloodReport[]>('blood_reports'),
      ]);
      if (v) setVitals(v);
      if (n) setNutrition(n);
      if (b) setBloodReports(b);
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

  const saveReport = async () => {
    const dVal = parseNum(vitD);
    const bVal = parseNum(vitB12);
    const ldlVal = parseNum(ldl);
    const hdlVal = parseNum(hdl);
    const tshVal = parseNum(tsh);

    if (!testDate.trim()) {
      setError('Please enter a valid test date.');
      return;
    }
    if (dVal === undefined && bVal === undefined && ldlVal === undefined && hdlVal === undefined && tshVal === undefined) {
      setError('Enter at least one biomarker value.');
      return;
    }

    setError(null);
    setSavingReport(true);
    try {
      await api.logBloodReport({
        vitamin_d: dVal,
        vitamin_b12: bVal,
        cholesterol_ldl: ldlVal,
        cholesterol_hdl: hdlVal,
        thyroid_tsh: tshVal,
        test_date: testDate,
      });
      setVitD('');
      setVitB12('');
      setLdl('');
      setHdl('');
      setTsh('');
      setIsAddingReport(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save blood report');
    } finally {
      setSavingReport(false);
    }
  };

  const deleteReport = async (id: string) => {
    setError(null);
    try {
      await api.deleteBloodReport(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete blood report');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            BLOOD REPORTS & BIOMARKERS
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.summaryCard}>
            <Pressable onPress={() => setIsAddingReport(!isAddingReport)} style={styles.headerPressable}>
              <ThemedText type="smallBold" themeColor="tint">
                {isAddingReport ? 'Close Log Form' : '+ Log Lab Blood Report'}
              </ThemedText>
            </Pressable>

            {isAddingReport && (
              <ThemedView style={styles.reportForm}>
                <ThemedView style={styles.inlineFields}>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="Vit D (ng/mL)"
                      value={vitD}
                      onChangeText={setVitD}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 32"
                    />
                  </ThemedView>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="Vit B12 (pg/mL)"
                      value={vitB12}
                      onChangeText={setVitB12}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 350"
                    />
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.inlineFields}>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="LDL Chol. (mg/dL)"
                      value={ldl}
                      onChangeText={setLdl}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 95"
                    />
                  </ThemedView>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="HDL Chol. (mg/dL)"
                      value={hdl}
                      onChangeText={setHdl}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 50"
                    />
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.inlineFields}>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="Thyroid TSH (uIU/mL)"
                      value={tsh}
                      onChangeText={setTsh}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 1.8"
                    />
                  </ThemedView>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="Test Date (YYYY-MM-DD)"
                      value={testDate}
                      onChangeText={setTestDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </ThemedView>
                </ThemedView>

                <PrimaryButton title="Save Report" onPress={saveReport} loading={savingReport} />
              </ThemedView>
            )}
          </ThemedView>

          {bloodReports.length > 0 && (
            <ThemedView style={styles.reportsList}>
              {bloodReports.slice(0, 5).map((r) => (
                <ThemedView key={r.id} type="backgroundElement" style={styles.reportCard}>
                  <ThemedView style={styles.reportCardHeader}>
                    <ThemedText type="smallBold">Lab Report · {r.test_date}</ThemedText>
                    <Pressable onPress={() => deleteReport(r.id)}>
                      <ThemedText type="smallBold" style={{ color: '#EF4444' }}>Delete</ThemedText>
                    </Pressable>
                  </ThemedView>
                  <ThemedView style={styles.biomarkerGrid}>
                    {r.vitamin_d !== null && (
                      <ThemedText type="small" style={styles.biomarkerText}>
                        Vit D: {r.vitamin_d} ng/mL
                      </ThemedText>
                    )}
                    {r.vitamin_b12 !== null && (
                      <ThemedText type="small" style={styles.biomarkerText}>
                        Vit B12: {r.vitamin_b12} pg/mL
                      </ThemedText>
                    )}
                    {r.cholesterol_ldl !== null && (
                      <ThemedText type="small" style={styles.biomarkerText}>
                        LDL: {r.cholesterol_ldl} mg/dL
                      </ThemedText>
                    )}
                    {r.cholesterol_hdl !== null && (
                      <ThemedText type="small" style={styles.biomarkerText}>
                        HDL: {r.cholesterol_hdl} mg/dL
                      </ThemedText>
                    )}
                    {r.thyroid_tsh !== null && (
                      <ThemedText type="small" style={styles.biomarkerText}>
                        TSH: {r.thyroid_tsh} uIU/mL
                      </ThemedText>
                    )}
                  </ThemedView>
                </ThemedView>
              ))}
            </ThemedView>
          )}

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
    paddingTop: TopTabInset + Spacing.four,
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
  headerPressable: {
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },
  reportForm: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  reportsList: {
    gap: Spacing.two,
  },
  reportCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: Spacing.one,
  },
  biomarkerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  biomarkerText: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
  },
});
