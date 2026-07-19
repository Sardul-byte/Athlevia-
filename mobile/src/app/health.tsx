import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { LabeledInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type NutritionLog, type VitalLog, type BloodReport, type SupplementToday } from '@/lib/api';
import { readCache, writeCache } from '@/lib/cache';

const WATER_PRESETS = [250, 500, 750] as const;

type OptimalStatus = { status: 'Optimal' | 'Suboptimal' | 'Low' | 'High'; color: string };

const BIOMARKERS_INFO = {
  vitamin_d: { label: 'Vitamin D', unit: 'ng/mL', ref: '30 - 100 ng/mL' },
  vitamin_b12: { label: 'Vitamin B12', unit: 'pg/mL', ref: '200 - 900 pg/mL' },
  cholesterol_ldl: { label: 'LDL Cholesterol', unit: 'mg/dL', ref: '< 100 mg/dL' },
  cholesterol_hdl: { label: 'HDL Cholesterol', unit: 'mg/dL', ref: '> 40 mg/dL' },
  thyroid_tsh: { label: 'Thyroid TSH', unit: 'uIU/mL', ref: '0.4 - 4.0 uIU/mL' },
} as const;


function parseNum(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function bmi(vital: VitalLog | undefined): string | null {
  if (!vital?.weight_kg || !vital?.height_cm) return null;
  const meters = Number(vital.height_cm) / 100;
  return (Number(vital.weight_kg) / (meters * meters)).toFixed(1);
}

function getBiomarkerStatus(
  key: 'vitamin_d' | 'vitamin_b12' | 'cholesterol_ldl' | 'cholesterol_hdl' | 'thyroid_tsh',
  val: number,
): OptimalStatus {
  if (key === 'vitamin_d') {
    if (val < 30) return { status: 'Low', color: '#EF4444' };
    if (val <= 100) return { status: 'Optimal', color: '#10B981' };
    return { status: 'High', color: '#EF4444' };
  }
  if (key === 'vitamin_b12') {
    if (val < 200) return { status: 'Low', color: '#EF4444' };
    if (val <= 900) return { status: 'Optimal', color: '#10B981' };
    return { status: 'High', color: '#EF4444' };
  }
  if (key === 'cholesterol_ldl') {
    if (val < 100) return { status: 'Optimal', color: '#10B981' };
    if (val < 130) return { status: 'Suboptimal', color: '#F59E0B' };
    return { status: 'High', color: '#EF4444' };
  }
  if (key === 'cholesterol_hdl') {
    if (val < 40) return { status: 'Low', color: '#EF4444' };
    return { status: 'Optimal', color: '#10B981' };
  }
  if (key === 'thyroid_tsh') {
    if (val < 0.4) return { status: 'Low', color: '#EF4444' };
    if (val <= 4.0) return { status: 'Optimal', color: '#10B981' };
    return { status: 'High', color: '#EF4444' };
  }
  return { status: 'Optimal', color: '#10B981' };
}

export default function HealthScreen() {
  const theme = useTheme();
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

  // Supplements state
  const [supplements, setSupplements] = useState<SupplementToday[]>([]);
  const [isManagingSupps, setIsManagingSupps] = useState(false);
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppDosage, setNewSuppDosage] = useState('');
  const [newSuppTime, setNewSuppTime] = useState('');
  const [savingSupp, setSavingSupp] = useState(false);

  // Biomarkers chart state
  const [selectedBiomarker, setSelectedBiomarker] = useState<keyof typeof BIOMARKERS_INFO>('vitamin_d');

  const reportsWithBiomarker = bloodReports
    .filter((r) => r[selectedBiomarker] !== null)
    .sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime());
  const maxVal = Math.max(...reportsWithBiomarker.map((r) => Number(r[selectedBiomarker])), 1);


  const load = useCallback(async () => {
    try {
      const [v, n, b, s] = await Promise.all([
        api.getVitals(),
        api.getNutrition(),
        api.getBloodReports(),
        api.getTodaySupplements(),
      ]);
      setVitals(v);
      setNutrition(n);
      setBloodReports(b);
      setSupplements(s);
      writeCache('vitals', v);
      writeCache('nutrition', n);
      writeCache('blood_reports', b);
      writeCache('supplements_today', s);
    } catch {
      // Backend unreachable; fall back to the last cached snapshot.
      const [v, n, b, s] = await Promise.all([
        readCache<VitalLog[]>('vitals'),
        readCache<NutritionLog[]>('nutrition'),
        readCache<BloodReport[]>('blood_reports'),
        readCache<SupplementToday[]>('supplements_today'),
      ]);
      if (v) setVitals(v);
      if (n) setNutrition(n);
      if (b) setBloodReports(b);
      if (s) setSupplements(s);
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

  // Supplements handlers
  const handleToggleSupplement = async (id: string) => {
    setError(null);
    try {
      const updated = await api.toggleSupplement(id);
      setSupplements((prev) => prev.map((item) => (item.id === id ? updated : item)));
      if (updated.taken) {
        Alert.alert('Success', 'Supplement logged! You earned +10 Points! 💊');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not toggle supplement');
    }
  };

  const handleAddSupplement = async () => {
    if (!newSuppName.trim()) {
      setError('Supplement name is required.');
      return;
    }
    setError(null);
    setSavingSupp(true);
    try {
      await api.addSupplement({
        name: newSuppName.trim(),
        dosage: newSuppDosage.trim() || undefined,
        schedule_time: newSuppTime.trim() || undefined,
      });
      setNewSuppName('');
      setNewSuppDosage('');
      setNewSuppTime('');
      const s = await api.getTodaySupplements();
      setSupplements(s);
      writeCache('supplements_today', s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add supplement');
    } finally {
      setSavingSupp(false);
    }
  };

  const handleDeleteSupplement = async (id: string) => {
    setError(null);
    try {
      await api.deleteSupplement(id);
      const s = await api.getTodaySupplements();
      setSupplements(s);
      writeCache('supplements_today', s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete supplement');
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
          <PrimaryButton title="Save Vitals (+20 Pts)" onPress={saveVitals} loading={savingVitals} />

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
          <PrimaryButton title="Log Meal (+15 Pts)" onPress={saveFood} loading={savingFood} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            QUICK HYDRATION
          </ThemedText>
          <ThemedView style={styles.waterRow}>
            {WATER_PRESETS.map((ml) => (
              <Pressable key={ml} onPress={() => addWater(ml)} style={styles.waterButtonWrap}>
                <ThemedView type="backgroundElement" style={styles.waterButton}>
                  <ThemedText type="smallBold" themeColor="tint">
                    +{ml} ml (+5 Pts)
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          {/* Supplements checklist */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            DAILY SUPPLEMENTS CHECKLIST
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.summaryCard}>
            {supplements.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: Spacing.two }}>
                No supplements scheduled. Tap "Manage Supplements" below to add some.
              </ThemedText>
            ) : (
              <ThemedView style={styles.suppsList}>
                {supplements.map((item) => (
                  <Pressable key={item.id} onPress={() => handleToggleSupplement(item.id)} style={styles.suppRow}>
                    <ThemedView style={styles.suppCheckCol}>
                      <ThemedView style={[
                        styles.checkbox,
                        { borderColor: theme.tint },
                        item.taken && { backgroundColor: theme.tint }
                      ]}>
                        {item.taken && <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</ThemedText>}
                      </ThemedView>
                      <ThemedView style={{ backgroundColor: 'transparent' }}>
                        <ThemedText type="smallBold" style={[item.taken && { textDecorationLine: 'line-through', opacity: 0.5 }]}>
                          {item.name}
                        </ThemedText>
                        {(item.dosage || item.schedule_time) && (
                          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                            {item.dosage} {item.schedule_time ? `· ${item.schedule_time}` : ''}
                          </ThemedText>
                        )}
                      </ThemedView>
                    </ThemedView>
                    <ThemedText type="smallBold" themeColor="tint" style={{ fontSize: 13 }}>{item.taken ? 'Taken ✓' : 'Log'}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            )}

            <Pressable onPress={() => setIsManagingSupps(!isManagingSupps)} style={styles.manageSuppsBtn}>
              <ThemedText type="smallBold" themeColor="tint">
                {isManagingSupps ? 'Close Panel' : '⚙ Manage Supplements Schedule'}
              </ThemedText>
            </Pressable>

            {isManagingSupps && (
              <ThemedView style={styles.manageSuppsPanel}>
                <ThemedText type="smallBold">ADD SUPPLEMENT</ThemedText>
                <LabeledInput
                  label="Supplement Name"
                  value={newSuppName}
                  onChangeText={setNewSuppName}
                  placeholder="e.g. Omega 3, Vitamin D3"
                />
                <ThemedView style={styles.inlineFields}>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="Dosage"
                      value={newSuppDosage}
                      onChangeText={setNewSuppDosage}
                      placeholder="e.g. 1 capsule, 5g"
                    />
                  </ThemedView>
                  <ThemedView style={styles.inlineField}>
                    <LabeledInput
                      label="Schedule Time"
                      value={newSuppTime}
                      onChangeText={setNewSuppTime}
                      placeholder="e.g. Morning, 08:00 AM"
                    />
                  </ThemedView>
                </ThemedView>
                <PrimaryButton title="Add Supplement" onPress={handleAddSupplement} loading={savingSupp} />

                {supplements.length > 0 && (
                  <ThemedView style={{ marginTop: Spacing.two, gap: Spacing.one }}>
                    <ThemedText type="smallBold" themeColor="textSecondary">SCHEDULED LIST</ThemedText>
                    {supplements.map((s) => (
                      <ThemedView key={s.id} type="backgroundSelected" style={styles.suppManageRow}>
                        <ThemedView style={{ backgroundColor: 'transparent' }}>
                          <ThemedText type="smallBold">{s.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {s.dosage} {s.schedule_time ? `· ${s.schedule_time}` : ''}
                          </ThemedText>
                        </ThemedView>
                        <Pressable onPress={() => handleDeleteSupplement(s.id)}>
                          <ThemedText type="small" style={{ color: '#EF4444' }}>Delete</ThemedText>
                        </Pressable>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>
            )}
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

          {/* Biomarker Trend Charts */}
          {bloodReports.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.chartCard}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                BIOMARKER TRENDS
              </ThemedText>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.biomarkerSelector}>
                {(Object.keys(BIOMARKERS_INFO) as Array<keyof typeof BIOMARKERS_INFO>).map((key) => (
                  <Pressable key={key} onPress={() => setSelectedBiomarker(key)}>
                    <ThemedView
                      type={selectedBiomarker === key ? 'backgroundSelected' : 'background'}
                      style={[styles.biomarkerChip, selectedBiomarker === key && { borderColor: theme.tint, borderWidth: 1 }]}>
                      <ThemedText type="small" style={selectedBiomarker === key && { fontWeight: 'bold' }}>
                        {BIOMARKERS_INFO[key].label}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ScrollView>

              {reportsWithBiomarker.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: Spacing.four }}>
                  No logged data points for {BIOMARKERS_INFO[selectedBiomarker].label}.
                </ThemedText>
              ) : (
                <ThemedView style={styles.chartContainer}>
                  {/* Grid Lines Background */}
                  <ThemedView style={styles.chartGridLines}>
                    <ThemedView style={[styles.gridLine, { borderColor: theme.backgroundSelected }]} />
                    <ThemedView style={[styles.gridLine, { borderColor: theme.backgroundSelected }]} />
                    <ThemedView style={[styles.gridLine, { borderColor: theme.backgroundSelected }]} />
                  </ThemedView>

                  <ThemedView style={styles.chartYAxis}>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 9 }}>Max: {maxVal.toFixed(0)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 9 }}>Ref: {BIOMARKERS_INFO[selectedBiomarker].ref}</ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.chartBars}>
                    {reportsWithBiomarker.slice(-5).map((r) => {
                      const val = Number(r[selectedBiomarker]);
                      const barHeight = Math.max(15, Math.round((val / maxVal) * 100));
                      const status = getBiomarkerStatus(selectedBiomarker, val);
                      return (
                        <ThemedView key={r.id} style={styles.chartCol}>
                          <ThemedText type="smallBold" style={{ color: status.color, fontSize: 10 }}>
                            {val}
                          </ThemedText>
                          <ThemedView style={[
                            styles.chartBarFill, 
                            { 
                              height: barHeight, 
                              backgroundColor: status.color,
                              opacity: 0.85
                            }
                          ]}>
                            <ThemedView style={styles.chartGlowDot} />
                          </ThemedView>
                          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 9 }}>
                            {r.test_date.substring(5)}
                          </ThemedText>
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          )}

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
                      <ThemedView style={[styles.biomarkerBadge, { backgroundColor: getBiomarkerStatus('vitamin_d', Number(r.vitamin_d)).color + '15', borderColor: getBiomarkerStatus('vitamin_d', Number(r.vitamin_d)).color }]}>
                        <ThemedText type="small" style={{ color: theme.text }}>Vit D: <ThemedText type="smallBold" style={{ color: getBiomarkerStatus('vitamin_d', Number(r.vitamin_d)).color }}>{r.vitamin_d}</ThemedText> {BIOMARKERS_INFO.vitamin_d.unit}</ThemedText>
                      </ThemedView>
                    )}
                    {r.vitamin_b12 !== null && (
                      <ThemedView style={[styles.biomarkerBadge, { backgroundColor: getBiomarkerStatus('vitamin_b12', Number(r.vitamin_b12)).color + '15', borderColor: getBiomarkerStatus('vitamin_b12', Number(r.vitamin_b12)).color }]}>
                        <ThemedText type="small" style={{ color: theme.text }}>Vit B12: <ThemedText type="smallBold" style={{ color: getBiomarkerStatus('vitamin_b12', Number(r.vitamin_b12)).color }}>{r.vitamin_b12}</ThemedText> {BIOMARKERS_INFO.vitamin_b12.unit}</ThemedText>
                      </ThemedView>
                    )}
                    {r.cholesterol_ldl !== null && (
                      <ThemedView style={[styles.biomarkerBadge, { backgroundColor: getBiomarkerStatus('cholesterol_ldl', Number(r.cholesterol_ldl)).color + '15', borderColor: getBiomarkerStatus('cholesterol_ldl', Number(r.cholesterol_ldl)).color }]}>
                        <ThemedText type="small" style={{ color: theme.text }}>LDL: <ThemedText type="smallBold" style={{ color: getBiomarkerStatus('cholesterol_ldl', Number(r.cholesterol_ldl)).color }}>{r.cholesterol_ldl}</ThemedText> {BIOMARKERS_INFO.cholesterol_ldl.unit}</ThemedText>
                      </ThemedView>
                    )}
                    {r.cholesterol_hdl !== null && (
                      <ThemedView style={[styles.biomarkerBadge, { backgroundColor: getBiomarkerStatus('cholesterol_hdl', Number(r.cholesterol_hdl)).color + '15', borderColor: getBiomarkerStatus('cholesterol_hdl', Number(r.cholesterol_hdl)).color }]}>
                        <ThemedText type="small" style={{ color: theme.text }}>HDL: <ThemedText type="smallBold" style={{ color: getBiomarkerStatus('cholesterol_hdl', Number(r.cholesterol_hdl)).color }}>{r.cholesterol_hdl}</ThemedText> {BIOMARKERS_INFO.cholesterol_hdl.unit}</ThemedText>
                      </ThemedView>
                    )}
                    {r.thyroid_tsh !== null && (
                      <ThemedView style={[styles.biomarkerBadge, { backgroundColor: getBiomarkerStatus('thyroid_tsh', Number(r.thyroid_tsh)).color + '15', borderColor: getBiomarkerStatus('thyroid_tsh', Number(r.thyroid_tsh)).color }]}>
                        <ThemedText type="small" style={{ color: theme.text }}>TSH: <ThemedText type="smallBold" style={{ color: getBiomarkerStatus('thyroid_tsh', Number(r.thyroid_tsh)).color }}>{r.thyroid_tsh}</ThemedText> {BIOMARKERS_INFO.thyroid_tsh.unit}</ThemedText>
                      </ThemedView>
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
  biomarkerBadge: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Supplements elements styles
  suppsList: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  suppRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suppCheckCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  manageSuppsBtn: {
    paddingTop: Spacing.two,
    alignItems: 'center',
  },
  manageSuppsPanel: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: Spacing.three,
  },
  suppManageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  chartCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
  },
  biomarkerSelector: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  biomarkerChip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chartContainer: {
    flexDirection: 'row',
    height: 170,
    marginTop: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
  },
  chartGridLines: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: Spacing.three,
    bottom: Spacing.three + 10,
    justifyContent: 'space-between',
    zIndex: 0,
    backgroundColor: 'transparent',
  },
  gridLine: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 0.5,
    width: '100%',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    height: '100%',
    paddingRight: Spacing.two,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingLeft: Spacing.two,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  chartCol: {
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  chartBarFill: {
    width: 24,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  chartGlowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginTop: 2,
    opacity: 0.6,
  },
});
