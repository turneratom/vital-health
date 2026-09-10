import { useQuery } from 'convex/react';
import { useMemo, useRef, useState, useEffect } from 'react';
import { api } from '../../../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════ */
/*  usePerformanceScore — Reactive Elite Score & Recovery Hook   */
/*  Calculates scores from real Convex data (last 24h window)   */
/* ══════════════════════════════════════════════════════════════ */

export interface PerformanceData {
  /** Elite Score 0–100 */
  eliteScore: number;
  /** Recovery percentage 0–100 */
  recovery: number;
  /** Simulated heart rate (until wearable integration) */
  hr: number;
  /** SpO2 */
  spo2: number;
  /** Stress level 0–100 */
  stress: number;

  /** Score breakdown */
  fuelingPoints: number;
  movementPoints: number;
  hrvPoints: number;
  basePoints: number;

  /** Goal tracking */
  foodLogCount: number;
  activityLogCount: number;
  supplementCount: number;

  /** Macros */
  totalCaloriesIn: number;
  totalCaloriesOut: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalDuration: number;

  /** HRV data for gauge */
  currentHrv: number;
  hrvHistory7d: number[];

  /** Journal */
  journalEventCount: number;
  lastLogTimestamp: number;

  /** Loading state */
  isLoading: boolean;
}

/* ── HRV points calculation ── */
function calculateHrvPoints(currentHrv: number, hrvHistory7d: number[]): number {
  if (currentHrv <= 0) return 0;
  const safeHistory = hrvHistory7d.filter((v) => v > 0);
  const avg = safeHistory.length > 0
    ? safeHistory.reduce((s, v) => s + v, 0) / safeHistory.length
    : currentHrv;
  if (avg <= 0) return 0;
  const ratio = (currentHrv - avg) / avg;
  return Math.max(-20, Math.min(20, Math.round(ratio * 100)));
}

/* ── Recovery calculation ── */
function calculateRecovery(
  hoursSinceWorkout: number,
  recentWorkoutCount: number,
  foodLogCount: number,
  supplementCount: number,
): number {
  // Base recovery from time since last workout
  let base: number;
  if (hoursSinceWorkout >= 48) base = 92;
  else if (hoursSinceWorkout >= 24) base = 75 + (hoursSinceWorkout - 24) * 0.7;
  else if (hoursSinceWorkout >= 12) base = 55 + (hoursSinceWorkout - 12) * 1.67;
  else base = 35 + hoursSinceWorkout * 1.67;

  // Nutrition bonus: eating well aids recovery
  const nutritionBonus = Math.min(8, foodLogCount * 2.5);

  // Supplement bonus
  const supplementBonus = Math.min(5, supplementCount * 1.5);

  // Overtraining penalty: too many workouts in 72h
  const overtrainingPenalty = recentWorkoutCount > 3 ? (recentWorkoutCount - 3) * 4 : 0;

  return Math.max(20, Math.min(100, Math.round(base + nutritionBonus + supplementBonus - overtrainingPenalty)));
}

/* ── Simulated biometrics (until wearable API) ── */
function useSimulatedBiometrics(recovery: number) {
  const [hr, setHr] = useState(68);
  const [spo2, setSpo2] = useState(97);
  const [stress, setStress] = useState(28);

  useEffect(() => {
    // Seed initial values based on recovery
    const baseHr = recovery >= 75 ? 62 : recovery >= 50 ? 70 : 78;
    const baseStress = recovery >= 75 ? 22 : recovery >= 50 ? 45 : 65;
    setHr(baseHr);
    setStress(baseStress);
  }, [recovery]);

  useEffect(() => {
    const iv = setInterval(() => {
      setHr((p) => Math.max(55, Math.min(105, p + (Math.random() - 0.48) * 3)));
      setSpo2((p) => Math.max(95, Math.min(100, p + (Math.random() - 0.5) * 0.4)));
      setStress((p) => Math.max(8, Math.min(85, p + (Math.random() - 0.5) * 4)));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  return {
    hr: Math.round(hr),
    spo2: Math.round(spo2),
    stress: Math.round(stress),
  };
}

/* ── Smooth transition hook ── */
function useSmoothValue(target: number, duration = 800): number {
  const [value, setValue] = useState(target);
  const rafRef = useRef(0);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ══════════════════════════════════════════════════════════════ */
/*  Main Hook                                                    */
/* ══════════════════════════════════════════════════════════════ */

export function usePerformanceScore(sessionId: string): PerformanceData {
  const rawData = useQuery(
    api.dashboardData.getLast24hDashboardData,
    sessionId ? { sessionId } : 'skip'
  );

  const isLoading = false; // Never block — show defaults until real data arrives

  // Calculate elite score from real data
  const { eliteScore, fuelingPoints, movementPoints, hrvPoints, basePoints } = useMemo(() => {
    if (!rawData) return { eliteScore: 0, fuelingPoints: 0, movementPoints: 0, hrvPoints: 0, basePoints: 50 };

    const base = 50;
    const fueling = Math.min(30, (rawData.foodLogCount ?? 0) * 10);
    const movement = (rawData.activityLogCount ?? 0) > 0 ? 20 : 0;
    const hrv = calculateHrvPoints(rawData.currentHrv ?? 0, rawData.hrvHistory7d ?? []);
    const total = Math.max(1, Math.min(100, base + fueling + movement + hrv));

    return { eliteScore: total, fuelingPoints: fueling, movementPoints: movement, hrvPoints: hrv, basePoints: base };
  }, [rawData]);

  // Calculate recovery from real data
  const recoveryRaw = useMemo(() => {
    if (!rawData) return 75;
    return calculateRecovery(
      rawData.hoursSinceWorkout ?? 48,
      rawData.recentWorkoutCount ?? 0,
      rawData.foodLogCount ?? 0,
      rawData.supplementCount ?? 0,
    );
  }, [rawData]);

  // Smooth transitions for score and recovery
  const smoothScore = useSmoothValue(eliteScore, 1200);
  const smoothRecovery = useSmoothValue(recoveryRaw, 1000);

  // Simulated biometrics seeded by recovery
  const { hr, spo2, stress } = useSimulatedBiometrics(smoothRecovery);

  return {
    eliteScore: smoothScore,
    recovery: smoothRecovery,
    hr,
    spo2,
    stress,

    fuelingPoints,
    movementPoints,
    hrvPoints,
    basePoints,

    foodLogCount: rawData?.todayFoodLogCount ?? 0,
    activityLogCount: rawData?.todayActivityLogCount ?? 0,
    supplementCount: rawData?.supplementCount ?? 0,

    totalCaloriesIn: rawData?.totalCaloriesIn ?? 0,
    totalCaloriesOut: rawData?.totalCaloriesOut ?? 0,
    totalProtein: rawData?.totalProtein ?? 0,
    totalCarbs: rawData?.totalCarbs ?? 0,
    totalFat: rawData?.totalFat ?? 0,
    totalDuration: rawData?.totalDuration ?? 0,

    currentHrv: rawData?.currentHrv ?? 82,
    hrvHistory7d: rawData?.hrvHistory7d ?? [68, 72, 65, 78, 70, 75, 80],

    journalEventCount: rawData?.journalEventCount ?? 0,
    lastLogTimestamp: rawData?.lastLogTimestamp ?? 0,

    isLoading,
  };
}
