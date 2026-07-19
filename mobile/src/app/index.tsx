import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { LabeledInput, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type NutritionLog, type Workout, type UserProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { readCache, writeCache } from '@/lib/cache';
import { useCustomTheme, type ThemeName } from '@/lib/theme-context';

const SHOP_ITEMS = [
  { 
    id: 'cyberpunk', 
    name: 'Cyberpunk Neon 💜', 
    cost: 100, 
    description: 'Vibrant neon purple background with pink accents',
    colors: { bg: '#1A002C', tint: '#FF007F' } 
  },
  { 
    id: 'emerald', 
    name: 'Emerald Forest 💚', 
    cost: 150, 
    description: 'Classy dark emerald green styling',
    colors: { bg: '#022C22', tint: '#10B981' } 
  },
  { 
    id: 'rosegold', 
    name: 'Rose Gold 🍑', 
    cost: 200, 
    description: 'Warm dark maroon and peach palette',
    colors: { bg: '#2D1B1B', tint: '#FCA5A5' } 
  },
];

const CATEGORY_EMOJIS = {
  strength: '🏋️‍♂️',
  cardio: '🏃‍♂️',
  swimming: '🏊‍♂️',
  sports: '⚽',
  other: '👟',
};

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
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.statCard, { borderColor: theme.backgroundSelected }]}
    >
      <ThemedText type="subtitle" themeColor="tint" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statUnit}>
        {unit}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.statLabel}>{label}</ThemedText>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const { themeName, setThemeName } = useCustomTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [nutrition, setNutrition] = useState<NutritionLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Profile states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [calorieGoalInput, setCalorieGoalInput] = useState('');
  const [waterGoalInput, setWaterGoalInput] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);

  // Store / Themes state
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(['dark', 'light']);

  const applyProfile = useCallback((p: UserProfile) => {
    setProfile(p);
    setCalorieGoalInput(p.daily_calorie_goal.toString());
    setWaterGoalInput(p.daily_water_goal_ml.toString());
  }, []);

  const load = useCallback(async () => {
    try {
      const [w, n, p] = await Promise.all([
        api.getWorkouts(),
        api.getNutrition(),
        api.getProfile(),
      ]);
      setWorkouts(w);
      setNutrition(n);
      applyProfile(p);
      writeCache('workouts', w);
      writeCache('nutrition', n);
      writeCache('profile', p);
    } catch {
      // Backend unreachable; fall back to the last cached snapshot.
      const [w, n, p] = await Promise.all([
        readCache<Workout[]>('workouts'),
        readCache<NutritionLog[]>('nutrition'),
        readCache<UserProfile>('profile'),
      ]);
      if (w) setWorkouts(w);
      if (n) setNutrition(n);
      if (p) applyProfile(p);
    }
  }, [applyProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Load unlocked themes cache
  useEffect(() => {
    (async () => {
      const saved = await readCache<string[]>('unlocked_themes');
      if (saved) setUnlockedThemes(saved);
      else writeCache('unlocked_themes', ['dark', 'light']);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const saveGoals = async () => {
    const cal = parseInt(calorieGoalInput, 10);
    const wat = parseInt(waterGoalInput, 10);
    if (!Number.isFinite(cal) || cal <= 0 || !Number.isFinite(wat) || wat <= 0) {
      return;
    }
    setSavingGoals(true);
    try {
      const updatedProfile = await api.updateProfile({
        daily_calorie_goal: cal,
        daily_water_goal_ml: wat,
      });
      setProfile(updatedProfile);
      setIsEditingGoals(false);
    } catch {
      // Keep existing values
    } finally {
      setSavingGoals(false);
    }
  };

  const buyTheme = async (id: string, cost: number) => {
    if (!profile) return;
    try {
      const updatedProfile = await api.redeemReward(cost, id);
      setProfile(updatedProfile);
      const list = [...unlockedThemes, id];
      setUnlockedThemes(list);
      writeCache('unlocked_themes', list);
      Alert.alert('Success 🎉', `You have unlocked the ${id.toUpperCase()} theme!`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not redeem reward');
    }
  };

  const applyTheme = (id: ThemeName) => {
    setThemeName(id);
  };

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
            <ThemedView style={{ backgroundColor: 'transparent' }}>
              <ThemedText type="subtitle" style={styles.welcomeText}>Dashboard</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emailText}>
                {user?.email}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.headerActions}>
              {profile && (
                <ThemedView type="backgroundSelected" style={styles.headerBadge}>
                  <ThemedText type="smallBold" themeColor="tint">
                    ✨ {profile.points} Pts
                  </ThemedText>
                </ThemedView>
              )}
              <Pressable onPress={() => setIsEditingGoals(!isEditingGoals)} style={styles.editGoalsButton}>
                <ThemedText type="link" themeColor="tint" style={styles.headerLinkText}>
                  {isEditingGoals ? 'Close Goals' : 'Goals'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={signOut} style={styles.signoutBtn}>
                <ThemedText type="link" themeColor="textSecondary" style={styles.headerLinkText}>
                  Sign out
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {isEditingGoals && (
            <ThemedView type="backgroundElement" style={[styles.goalsForm, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" style={{ fontSize: 12, letterSpacing: 0.5 }}>UPDATE DAILY GOALS</ThemedText>
              <ThemedView style={styles.inlineFields}>
                <ThemedView style={styles.inlineField}>
                  <LabeledInput
                    label="Calorie Goal (kcal)"
                    value={calorieGoalInput}
                    onChangeText={setCalorieGoalInput}
                    keyboardType="number-pad"
                    placeholder="2000"
                  />
                </ThemedView>
                <ThemedView style={styles.inlineField}>
                  <LabeledInput
                    label="Water Goal (ml)"
                    value={waterGoalInput}
                    onChangeText={setWaterGoalInput}
                    keyboardType="number-pad"
                    placeholder="2000"
                  />
                </ThemedView>
              </ThemedView>
              <PrimaryButton title="Save Goals" onPress={saveGoals} loading={savingGoals} />
            </ThemedView>
          )}

          <ThemedView style={styles.statsGrid}>
            <StatCard label="Workouts" value={todayWorkouts.length} unit="sessions" />
            <StatCard label="Active" value={activeMinutes} unit="minutes" />
            <StatCard label="Burned" value={caloriesBurned} unit="kcal" />
            <StatCard label="Eaten" value={caloriesEaten} unit="kcal" />
            <StatCard label="Water" value={waterMl} unit="ml" />
            <StatCard label="Meals" value={todayNutrition.length} unit="logged" />
          </ThemedView>

          {profile && (
            <ThemedView type="backgroundElement" style={[styles.goalsProgressCard, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                TODAY'S GOAL PROGRESS
              </ThemedText>

              <ThemedView style={styles.goalRow}>
                <ThemedView style={styles.goalInfo}>
                  <ThemedText type="smallBold">Calories</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {caloriesEaten} / {profile.daily_calorie_goal} kcal ({profile.daily_calorie_goal > 0 ? Math.round((caloriesEaten / profile.daily_calorie_goal) * 100) : 0}%)
                  </ThemedText>
                </ThemedView>
                <ThemedView style={[styles.progressBarBg, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedView
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${profile.daily_calorie_goal > 0 ? Math.min(100, (caloriesEaten / profile.daily_calorie_goal) * 100) : 0}%`,
                        backgroundColor: theme.tint
                      }
                    ]}
                  />
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.goalRow}>
                <ThemedView style={styles.goalInfo}>
                  <ThemedText type="smallBold">Water Intake</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {waterMl} / {profile.daily_water_goal_ml} ml ({profile.daily_water_goal_ml > 0 ? Math.round((waterMl / profile.daily_water_goal_ml) * 100) : 0}%)
                  </ThemedText>
                </ThemedView>
                <ThemedView style={[styles.progressBarBg, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedView
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${profile.daily_water_goal_ml > 0 ? Math.min(100, (waterMl / profile.daily_water_goal_ml) * 100) : 0}%`,
                        backgroundColor: '#3B82F6'
                      }
                    ]}
                  />
                </ThemedView>
              </ThemedView>
            </ThemedView>
          )}

          {/* Gamified Points Status */}
          {profile && (
            <ThemedView type="backgroundElement" style={[styles.pointsCard, { borderColor: theme.backgroundSelected }]}>
              <ThemedView style={styles.pointsHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                  GAMIFIED REWARDS
                </ThemedText>
                <ThemedText type="smallBold" themeColor="tint" style={{ fontSize: 14 }}>
                  🔥 {profile.streak_days || 1} Day Streak
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.pointsBodyRow}>
                <ThemedText type="title" themeColor="tint" style={styles.pointsHighlight}>
                  {profile.points}
                </ThemedText>
                <ThemedView style={styles.pointsBodyTextCol}>
                  <ThemedText type="smallBold" themeColor="text">Total Points Accumulated</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                    Earn points: Workouts (+50), Active (+100), Vitals (+20), Meals (+15), Hydration (+5), Supplements (+10).
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          )}

          {/* Perks Shop */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            REDEEM PERKS & THEMES SHOP
          </ThemedText>
          <ThemedView type="backgroundElement" style={[styles.shopCard, { borderColor: theme.backgroundSelected }]}>
            {SHOP_ITEMS.map((item) => {
              const isUnlocked = unlockedThemes.includes(item.id);
              const isApplied = themeName === item.id;
              const canAfford = profile ? profile.points >= item.cost : false;

              return (
                <ThemedView key={item.id} style={styles.shopItemRow}>
                  {/* Overlapping theme visual previews */}
                  <ThemedView style={styles.themePreviewWrap}>
                    <ThemedView style={[styles.colorBubbleBg, { backgroundColor: item.colors.bg }]}>
                      <ThemedView style={[styles.colorBubbleTint, { backgroundColor: item.colors.tint }]} />
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={{ backgroundColor: 'transparent', flex: 1, gap: 2, marginLeft: Spacing.two }}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                      {item.description}
                    </ThemedText>
                  </ThemedView>

                  {isUnlocked ? (
                    <Pressable
                      onPress={() => applyTheme(item.id as ThemeName)}
                      style={[
                        styles.shopButton,
                        { backgroundColor: isApplied ? theme.backgroundSelected : theme.tint }
                      ]}>
                      <ThemedText type="smallBold" style={{ color: isApplied ? theme.text : '#fff', fontSize: 12 }}>
                        {isApplied ? 'Applied' : 'Apply'}
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => buyTheme(item.id, item.cost)}
                      disabled={!canAfford}
                      style={[
                        styles.shopButton,
                        { backgroundColor: canAfford ? '#10B981' : theme.backgroundSelected }
                      ]}>
                      <ThemedText type="smallBold" style={{ color: canAfford ? '#fff' : theme.textSecondary, fontSize: 12 }}>
                        Redeem {item.cost}
                      </ThemedText>
                    </Pressable>
                  )}
                </ThemedView>
              );
            })}
            
            {/* Standard theme toggles */}
            <ThemedView style={styles.standardThemesRow}>
              <ThemedText type="smallBold" themeColor="textSecondary">Default Themes:</ThemedText>
              <ThemedView style={styles.standardThemesButtons}>
                <Pressable 
                  onPress={() => applyTheme('dark')} 
                  style={[
                    styles.standardThemeBtn, 
                    { borderColor: themeName === 'dark' ? theme.tint : theme.backgroundSelected }
                  ]}>
                  <ThemedView style={[styles.colorDot, { backgroundColor: '#000000', borderColor: '#2DD4BF', borderWidth: 1 }]} />
                  <ThemedText type="small" style={{ fontWeight: themeName === 'dark' ? 'bold' : '500' }}>Dark</ThemedText>
                </Pressable>
                <Pressable 
                  onPress={() => applyTheme('light')} 
                  style={[
                    styles.standardThemeBtn, 
                    { borderColor: themeName === 'light' ? theme.tint : theme.backgroundSelected }
                  ]}>
                  <ThemedView style={[styles.colorDot, { backgroundColor: '#ffffff', borderColor: '#0D9488', borderWidth: 1 }]} />
                  <ThemedText type="small" style={{ fontWeight: themeName === 'light' ? 'bold' : '500' }}>Light</ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
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
            workouts.slice(0, 5).map((w) => {
              const emoji = CATEGORY_EMOJIS[w.category as keyof typeof CATEGORY_EMOJIS] || '💪';
              return (
                <ThemedView key={w.id} type="backgroundElement" style={styles.listRow}>
                  <ThemedView style={styles.listRowText}>
                    <ThemedText type="smallBold">{emoji} {w.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {w.category.toUpperCase()} · {w.duration_minutes} min
                      {w.calories_burned ? ` · ${w.calories_burned} kcal` : ''}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(w.logged_at).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
              );
            })
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
    marginBottom: Spacing.one,
  },
  welcomeText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 'bold',
  },
  emailText: {
    fontSize: 12,
    opacity: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBadge: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: Spacing.two,
  },
  editGoalsButton: {
    marginRight: Spacing.three,
  },
  signoutBtn: {
    marginLeft: Spacing.one,
  },
  headerLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  goalsForm: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inlineField: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '28%',
    borderRadius: 14,
    padding: Spacing.three - 2,
    gap: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 'bold',
  },
  statUnit: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: Spacing.two,
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
  goalsProgressCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  goalRow: {
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  goalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  // Gamification & Shop Styles
  pointsCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pointsBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  pointsHighlight: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
  },
  pointsBodyTextCol: {
    flex: 1,
    backgroundColor: 'transparent',
    gap: 2,
  },
  shopCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  shopItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: Spacing.two,
    backgroundColor: 'transparent',
  },
  themePreviewWrap: {
    marginRight: Spacing.one,
    backgroundColor: 'transparent',
  },
  colorBubbleBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorBubbleTint: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  shopButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardThemesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: Spacing.one,
  },
  standardThemesButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  standardThemeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
