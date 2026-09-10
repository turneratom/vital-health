import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import type { MuscleRecoveryData } from "@/components/Dashboard/BioMap";
import { usePerformanceScore } from "@/features/dashboard/hooks/usePerformanceScore";
import {
  getMetricStatusEnhanced,
  calculateTrend,
  type TrendResult,
  type MetricStatusResult,
} from "@/lib/bioSyncLogic";
import { PhysicalTransformation } from "@/components/PhysicalTransformation";
import { BiometricAvatar } from "@/components/BiometricAvatar";
import { FreemiumGate } from "@/components/FreemiumGate";
import { MetricDeepDive } from "@/components/MetricDeepDive";

/* ══════════════════════════════════════════════ */
/* ── Warm Earth-Tone Palette ──                 */
/* ══════════════════════════════════════════════ */
const WARM = {
  terra: "#E8976C",
  sage: "#7CB68E",
  sky: "#6BA3BE",
  gold: "#C4A46C",
  rose: "#D4847A",
  sand: "#E8E0D8",
  sandFaint: "rgba(232,224,216,0.08)",
  cardBg: "rgba(26,24,22,0.7)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
};

/* ── Sparkline data generator (fallback) ── */
function generateSparkline(length: number, base: number, variance: number): number[] {
  const data: number[] = [];
  let val = base;
  for (let i = 0; i < length; i++) {
    val += (Math.random() - 0.48) * variance;
    val = Math.max(base - variance * 2, Math.min(base + variance * 2, val));
    data.push(Math.round(val * 100) / 100);
  }
  return data;
}

/* ── Workout-to-muscle-group mapping ── */
const WORKOUT_MUSCLE_MAP: Record<string, string[]> = {
  "bench press": ["chest", "shoulders", "triceps"],
  "push-ups": ["chest", "shoulders", "triceps"],
  "chest fly": ["chest"],
  "shoulder press": ["shoulders", "triceps", "traps"],
  "lateral raise": ["shoulders"],
  "bicep curl": ["biceps", "forearms"],
  "tricep extension": ["triceps"],
  "pull-ups": ["lats", "biceps", "upper_back"],
  "rows": ["lats", "upper_back", "biceps"],
  "deadlift": ["lower_back", "glutes", "hamstrings", "traps"],
  "squat": ["quads", "glutes", "hamstrings"],
  "leg press": ["quads", "glutes"],
  "leg curl": ["hamstrings"],
  "leg extension": ["quads"],
  "calf raise": ["calves"],
  "plank": ["abs", "obliques"],
  "crunch": ["abs"],
  "russian twist": ["obliques", "abs"],
  "lat pulldown": ["lats", "biceps"],
  "chest press": ["chest", "shoulders", "triceps"],
  "upper body": ["chest", "shoulders", "biceps", "triceps", "upper_back", "lats"],
  "lower body": ["quads", "hamstrings", "glutes", "calves"],
  "leg day": ["quads", "hamstrings", "glutes", "calves"],
  "push day": ["chest", "shoulders", "triceps"],
  "pull day": ["lats", "upper_back", "biceps", "forearms"],
  "full body": ["chest", "shoulders", "biceps", "triceps", "abs", "quads", "hamstrings", "glutes"],
  "core": ["abs", "obliques", "lower_back"],
  "back": ["upper_back", "lats", "lower_back"],
  "arms": ["biceps", "triceps", "forearms"],
  "running": ["quads", "hamstrings", "calves", "glutes"],
  "cycling": ["quads", "hamstrings", "calves"],
  "hiit": ["quads", "glutes", "abs", "shoulders"],
};

function mapWorkoutToRecovery(workouts: Array<{ name: string; muscleGroups: string[]; duration: number; intensity: string; loggedAt: number }>): MuscleRecoveryData[] {
  const results: MuscleRecoveryData[] = [];
  for (const w of workouts) {
    let muscles = [...w.muscleGroups];
    const nameKey = w.name.toLowerCase();
    for (const [key, groups] of Object.entries(WORKOUT_MUSCLE_MAP)) {
      if (nameKey.includes(key)) {
        muscles = [...muscles, ...groups];
      }
    }
    const uniqueMuscles = [...new Set(muscles)];
    const intensity: "light" | "moderate" | "heavy" = w.intensity === "heavy" ? "heavy" : w.intensity === "moderate" ? "moderate" : "light";
    for (const mg of uniqueMuscles) {
      results.push({
        muscleGroup: mg as MuscleRecoveryData["muscleGroup"],
        workedAt: w.loggedAt,
        intensity,
        workoutName: w.name,
      });
    }
  }
  return results;
}

/* ══════════════════════════════════════════════════════════════ */
/* ── VITALITY STREAM CARD — Single metric row ──               */
/* ══════════════════════════════════════════════════════════════ */

interface VitalityItem {
  id: string;
  icon: string;
  label: string;
  value: string;
  unit: string;
  status: MetricStatusResult;
  trend: TrendResult;
  insight: string;
}

function VitalityStreamCard({ item, ghostMode, index, onTap }: { item: VitalityItem; ghostMode: boolean; index: number; onTap?: () => void }) {
  const isAnomaly = item.status.level === "warning" || item.status.level === "critical";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-xl overflow-hidden cursor-pointer"
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      style={{
        background: ghostMode ? "rgba(12,12,12,0.5)" : WARM.cardBg,
        backdropFilter: "blur(20px)",
        border: `1px solid ${ghostMode
          ? "rgba(160,160,160,0.06)"
          : isAnomaly
            ? `${item.status.color}25`
            : WARM.cardBorder
        }`,
        boxShadow: isAnomaly && !ghostMode
          ? `0 0 20px ${item.status.color}08, 0 2px 8px rgba(0,0,0,0.15)`
          : "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.04)" : `${item.status.color}0a`,
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : `${item.status.color}15`}`,
          }}
        >
          <span style={{ fontSize: 18, filter: ghostMode ? "grayscale(1) opacity(0.4)" : "none" }}>
            {item.icon}
          </span>
        </div>

        {/* Label + insight */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-semibold"
              style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : WARM.textPrimary }}
            >
              {item.label}
            </span>
            {/* Status badge */}
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.status.shouldPulse && !ghostMode ? "vitals-badge-pulse" : ""}`}
              style={{
                color: ghostMode ? "rgba(160,160,160,0.4)" : item.status.color,
                background: ghostMode ? "rgba(160,160,160,0.04)" : `${item.status.color}10`,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : `${item.status.color}20`}`,
              }}
            >
              {item.status.label}
            </span>
          </div>
          <p
            className="text-[11px] mt-0.5 truncate"
            style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim }}
          >
            {item.insight}
          </p>
        </div>

        {/* Value + trend */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span
            className="text-xl font-semibold tabular-nums"
            style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : item.status.color }}
          >
            {item.value}
            {item.unit && (
              <span
                className="text-[10px] font-medium ml-0.5"
                style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : `${item.status.color}70` }}
              >
                {item.unit}
              </span>
            )}
          </span>
          {item.trend.direction !== "flat" && (
            <span
              className="text-[9px] font-bold mt-0.5"
              style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : item.trend.color }}
            >
              {item.trend.label}
            </span>
          )}
        </div>
      </div>

      {/* Anomaly accent bar */}
      {isAnomaly && !ghostMode && (
        <div
          className="h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${item.status.color}50, transparent)`,
          }}
        />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── FLOATING VAULT BUTTON — Sync & Upload FAB ──              */
/* ══════════════════════════════════════════════════════════════ */

function VaultFAB({ ghostMode, onOpenBioVault }: { ghostMode: boolean; onOpenBioVault?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { icon: "📋", label: "Health Records", action: "records" },
    { icon: "📄", label: "Lab Documents", action: "documents" },
    { icon: "➕", label: "Add New Entry", action: "add" },
    { icon: "🔄", label: "Sync Devices", action: "sync" },
  ];

  const handleAction = useCallback((_action: string) => {
    setIsOpen(false);
    if (onOpenBioVault) onOpenBioVault();
  }, [onOpenBioVault]);

  return (
    <div className="fixed bottom-24 right-5 z-50 flex flex-col items-end gap-2">
      {/* Action menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(5,5,3,0.4)", backdropFilter: "blur(4px)" }}
              onClick={() => setIsOpen(false)}
            />

            {/* Menu items */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative z-50 flex flex-col gap-1.5 mb-2"
            >
              {actions.map((a, i) => (
                <motion.button
                  key={a.action}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  onClick={() => handleAction(a.action)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: ghostMode ? "rgba(20,20,20,0.9)" : "rgba(26,24,22,0.95)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : WARM.cardBorder}`,
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    minWidth: 200,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.6)" : WARM.textPrimary }}
                  >
                    {a.label}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300"
        style={{
          background: ghostMode
            ? "rgba(60,60,60,0.8)"
            : `linear-gradient(135deg, ${WARM.terra}, ${WARM.gold})`,
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(255,255,255,0.15)"}`,
          boxShadow: ghostMode
            ? "0 4px 20px rgba(0,0,0,0.4)"
            : `0 4px 24px ${WARM.terra}40, 0 8px 32px rgba(0,0,0,0.3)`,
        }}
      >
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: 22, color: "#fff", lineHeight: 1 }}
        >
          {isOpen ? "✕" : "⬡"}
        </motion.span>
      </motion.button>

      {/* Label */}
      {!isOpen && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[9px] font-bold tracking-wider uppercase text-center"
          style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim }}
        >
          The Vault
        </motion.span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN COMPONENT — VitalsView (Refactored) ──               */
/* ══════════════════════════════════════════════════════════════ */
export function VitalsView({ mounted, onOpenBioVault }: { mounted?: boolean; onOpenBioVault?: () => void }) {
  const ghostMode = useGhostMode();
  const [deepDiveMetric, setDeepDiveMetric] = useState<string | null>(null);
  const sessionId = typeof window !== "undefined" ? localStorage.getItem("vive_session_id") || "" : "";
  const perf = usePerformanceScore(sessionId);

  const vitalsData = useQuery(
    api.vitalsData.getVitalsTimeSeries,
    sessionId ? { sessionId } : "skip"
  );

  const hasRealData = vitalsData?.hasData ?? false;

  /* ── Membership status — toggleable via localStorage ── */
  const [isElite, setIsElite] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("vive_mock_elite");
    // Default to true if never set, so content is visible on first visit
    if (stored === null) {
      localStorage.setItem("vive_mock_elite", "true");
      setIsElite(true);
    } else {
      setIsElite(stored === "true");
    }
  }, []);

  // Force mount log for debugging
  useEffect(() => {
    console.log("VitalsView Mounting...");
  }, []);

  /* ── Muscle recovery from real workout logs ── */
  const muscleRecoveryData = useMemo<MuscleRecoveryData[]>(() => {
    if (vitalsData?.workoutLogs && vitalsData.workoutLogs.length > 0) {
      return mapWorkoutToRecovery(vitalsData.workoutLogs);
    }
    const now = Date.now();
    return [
      { muscleGroup: "chest", workedAt: now - 4 * 3600000, intensity: "heavy", workoutName: "Bench Press" },
      { muscleGroup: "shoulders", workedAt: now - 4 * 3600000, intensity: "heavy", workoutName: "Bench Press" },
      { muscleGroup: "triceps", workedAt: now - 4 * 3600000, intensity: "moderate", workoutName: "Bench Press" },
      { muscleGroup: "quads", workedAt: now - 30 * 3600000, intensity: "heavy", workoutName: "Squat Day" },
      { muscleGroup: "glutes", workedAt: now - 30 * 3600000, intensity: "heavy", workoutName: "Squat Day" },
      { muscleGroup: "hamstrings", workedAt: now - 30 * 3600000, intensity: "moderate", workoutName: "Squat Day" },
      { muscleGroup: "biceps", workedAt: now - 42 * 3600000, intensity: "moderate", workoutName: "Pull Day" },
      { muscleGroup: "lats", workedAt: now - 60 * 3600000, intensity: "heavy", workoutName: "Pull Day" },
      { muscleGroup: "upper_back", workedAt: now - 42 * 3600000, intensity: "moderate", workoutName: "Pull Day" },
      { muscleGroup: "calves", workedAt: now - 25 * 3600000, intensity: "light", workoutName: "Squat Day" },
      { muscleGroup: "abs", workedAt: now - 49 * 3600000, intensity: "moderate", workoutName: "Core Circuit" },
      { muscleGroup: "forearms", workedAt: now - 25 * 3600000, intensity: "light", workoutName: "Pull Day" },
    ];
  }, [vitalsData?.workoutLogs]);

  /* ── Curated mock Insight cards for empty profiles ── */
  const MOCK_INSIGHTS: VitalityItem[] = [
    {
      id: "mock-sleep", icon: "🌙", label: "Sleep Quality", value: "88", unit: "%",
      status: { level: "optimal", label: "Optimal", color: "#7CB68E", glowColor: "rgba(124,182,142,0.3)", shouldPulse: false, shouldGlow: true },
      trend: { delta: 0, percentage: 0,  direction: "up" as const, label: "+4% this week", color: "#7CB68E", deltaPct: 4, deltaAbs: 3.5, isFavorable: true },
      insight: "Your recovery is peaking today. Deep sleep cycles were 22% above baseline.",
    },
    {
      id: "mock-bioage", icon: "🧬", label: "Biological Age", value: "31.4", unit: "yrs",
      status: { level: "optimal", label: "Excellent", color: "#6BA3BE", glowColor: "rgba(107,163,190,0.3)", shouldPulse: false, shouldGlow: true },
      trend: { delta: 0, percentage: 0,  direction: "down" as const, label: "-0.8 yrs", color: "#7CB68E", deltaPct: -2.3, deltaAbs: -0.8, isFavorable: true },
      insight: "Real age: 35. Longevity markers are trending positive across all biomarkers.",
    },
    {
      id: "mock-fatigue", icon: "🦵", label: "Muscle Fatigue", value: "42", unit: "%",
      status: { level: "warning", label: "Rebuilding", color: "#C4A46C", glowColor: "rgba(196,164,108,0.3)", shouldPulse: true, shouldGlow: false },
      trend: { delta: 0, percentage: 0,  direction: "down" as const, label: "Recovering", color: "#C4A46C", deltaPct: -12, deltaAbs: -8, isFavorable: true },
      insight: "Quads and Glutes need 12 more hours of rest before next heavy session.",
    },
    {
      id: "mock-hrv", icon: "💓", label: "HRV Coherence", value: "64", unit: "ms",
      status: { level: "good", label: "Above Avg", color: "#6BA3BE", glowColor: "rgba(107,163,190,0.3)", shouldPulse: false, shouldGlow: false },
      trend: { delta: 0, percentage: 0,  direction: "up" as const, label: "+8ms vs last week", color: "#7CB68E", deltaPct: 14.3, deltaAbs: 8, isFavorable: true },
      insight: "Autonomic balance is strong. Your nervous system is well-regulated today.",
    },
  ];

  /* ── Build Vitality Stream items ── */
  const vitalityItems = useMemo<VitalityItem[]>(() => {
    /* If no real data, show curated mock insights so the stream looks valuable */
    if (!hasRealData) {
      return MOCK_INSIGHTS;
    }

    const hrvValue = perf.currentHrv > 0 ? perf.currentHrv : 48;
    const hrvHistory = perf.hrvHistory7d.length >= 3 ? perf.hrvHistory7d : generateSparkline(7, hrvValue, 6);
    const stepsValue = 6420 + perf.activityLogCount * 1200;
    const recoveryValue = perf.recovery;
    const recoverySeries = vitalsData?.recoverySeries && vitalsData.recoverySeries.length >= 3
      ? vitalsData.recoverySeries.map((s: any) => s.value)
      : generateSparkline(7, recoveryValue, 8);

    const items: VitalityItem[] = [
      {
        id: "sleep", icon: "🌙", label: "Sleep", value: "7h 36m", unit: "",
        status: getMetricStatusEnhanced("sleep", 7.6),
        trend: calculateTrend(7.6, generateSparkline(7, 7.6, 0.6), true),
        insight: "Great night \u2014 95% of your goal",
      },
      {
        id: "heart", icon: "\uD83D\uDC93", label: "Heart Rate", value: String(perf.hr), unit: "BPM",
        status: getMetricStatusEnhanced("heart", perf.hr),
        trend: calculateTrend(perf.hr, generateSparkline(7, perf.hr, 4), false),
        insight: perf.hr < 70 ? "Nice and calm today" : "Steady \u2014 normal range",
      },
      {
        id: "hrv", icon: "\uD83D\uDCCA", label: "Heart Rhythm", value: String(hrvValue), unit: "ms",
        status: getMetricStatusEnhanced("hrv", hrvValue),
        trend: calculateTrend(hrvValue, hrvHistory, true),
        insight: hrvValue >= 50 ? "Better than your average!" : "A bit lower than usual",
      },
      {
        id: "recovery", icon: "\uD83D\uDD0B", label: "Recovery", value: String(recoveryValue), unit: "%",
        status: getMetricStatusEnhanced("recovery", recoveryValue),
        trend: calculateTrend(recoveryValue, recoverySeries, true),
        insight: recoveryValue >= 75 ? "Feeling recharged!" : recoveryValue >= 50 ? "Getting there" : "Your body needs rest",
      },
      {
        id: "spo2", icon: "\uD83E\uDEC1", label: "Blood Oxygen", value: String(perf.spo2), unit: "%",
        status: getMetricStatusEnhanced("spo2", perf.spo2),
        trend: calculateTrend(perf.spo2, generateSparkline(7, perf.spo2, 0.8), true),
        insight: perf.spo2 >= 97 ? "Healthy and normal" : "Keep an eye on this",
      },
      {
        id: "steps", icon: "\uD83D\uDEB6", label: "Steps", value: stepsValue.toLocaleString(), unit: "",
        status: getMetricStatusEnhanced("steps", stepsValue),
        trend: calculateTrend(stepsValue, generateSparkline(7, stepsValue, 800), true),
        insight: `${Math.round((stepsValue / 10000) * 100)}% of your daily goal`,
      },
      {
        id: "respiratory", icon: "\uD83D\uDCA8", label: "Breathing Rate", value: "15", unit: "br/min",
        status: getMetricStatusEnhanced("respiratory", 15),
        trend: calculateTrend(15, generateSparkline(7, 15, 1.5), false),
        insight: "Calm and steady",
      },
      {
        id: "temp", icon: "\uD83C\uDF21\uFE0F", label: "Body Temp", value: "98.2", unit: "\u00B0F",
        status: getMetricStatusEnhanced("temp", 98.2),
        trend: calculateTrend(98.2, generateSparkline(7, 98.2, 0.3), false),
        insight: "Normal \u2014 no changes",
      },
    ];

    // Sort: anomalies first, then optimal last
    const priority: Record<string, number> = { critical: 0, warning: 1, good: 2, optimal: 3 };
    return items.sort((a, b) => (priority[a.status.level] ?? 2) - (priority[b.status.level] ?? 2));
  }, [perf, vitalsData, hasRealData]);

  /* ── Count anomalies ── */
  const anomalyCount = useMemo(() =>
    vitalityItems.filter((i) => i.status.level === "warning" || i.status.level === "critical").length,
    [vitalityItems]
  );

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col pb-24 relative">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── TOP SECTION: Biometric Avatar (Digital Twin Hero) ── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <FreemiumGate isElite={isElite} featureLabel="Digital Twin" ghostMode={ghostMode}>
        <div className="relative z-10" style={{ minHeight: 350 }}>
          <BiometricAvatar muscleRecovery={muscleRecoveryData} ghostMode={ghostMode} />
        </div>
      </FreemiumGate>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── MIDDLE SECTION: Physical Transformation Polaroids ── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <FreemiumGate isElite={isElite} featureLabel="Body Transformation Tracker" ghostMode={ghostMode}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <PhysicalTransformation ghostMode={ghostMode} />
        </motion.div>
      </FreemiumGate>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── BOTTOM SECTION: Vitality Stream ──                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <FreemiumGate isElite={isElite} featureLabel="Vitality Stream" ghostMode={ghostMode}>
        <div className="mx-5 mt-1 mb-4">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: ghostMode ? "rgba(160,160,160,0.06)" : `${WARM.sky}10`,
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${WARM.sky}18`}`,
                }}
              >
                <span style={{ fontSize: 13 }}>⚡</span>
              </div>
              <div>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : WARM.textPrimary }}
                >
                  Vitality Stream
                </h3>
                <p
                  className="text-[10px]"
                  style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : WARM.textDim }}
                >
                  {anomalyCount > 0
                    ? `${anomalyCount} metric${anomalyCount > 1 ? "s" : ""} need${anomalyCount === 1 ? "s" : ""} attention`
                    : !hasRealData
                      ? "Sample insights \u2014 connect a device to see yours"
                      : "All systems looking good"
                  }
                </p>
              </div>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: hasRealData ? WARM.sage : WARM.gold,
                  boxShadow: `0 0 6px ${hasRealData ? WARM.sage : WARM.gold}80`,
                  animation: "statusDotPulse 2.5s ease-in-out infinite",
                }}
              />
              <span
                className="text-[9px] font-medium"
                style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : hasRealData ? `${WARM.sage}88` : `${WARM.gold}88` }}
              >
                {hasRealData ? "Live" : "Demo"}
              </span>
            </div>
          </motion.div>

          {/* Stream cards */}
          <div className="flex flex-col gap-2.5">
            {vitalityItems.map((item, i) => (
              <VitalityStreamCard
                key={item.id}
                item={item}
                ghostMode={ghostMode}
                index={i}
                onTap={() => setDeepDiveMetric(item.id)}
              />
            ))}
          </div>

          {/* Summary footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 flex items-center justify-center"
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-full"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(232,224,216,0.03)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.06)"}`,
              }}
            >
              {[
                { label: "Optimal", count: vitalityItems.filter((i) => i.status.level === "optimal").length, color: WARM.sage },
                { label: "Good", count: vitalityItems.filter((i) => i.status.level === "good").length, color: WARM.sky },
                { label: "Watch", count: vitalityItems.filter((i) => i.status.level === "warning").length, color: WARM.gold },
                { label: "Action", count: vitalityItems.filter((i) => i.status.level === "critical").length, color: WARM.rose },
              ].filter((s) => s.count > 0).map((s) => (
                <span
                  key={s.label}
                  className="flex items-center gap-1.5 text-[9px] font-medium"
                  style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : s.color }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : s.color }}
                  />
                  {s.count} {s.label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </FreemiumGate>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── THE VAULT — Floating Sync & Upload Button ──        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <VaultFAB ghostMode={ghostMode} onOpenBioVault={onOpenBioVault} />

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── METRIC DEEP DIVE — Slide-over Drawer ──             */}
      {/* ═══════════════════════════════════════════════════════ */}
      <MetricDeepDive
        metricId={deepDiveMetric}
        onClose={() => setDeepDiveMetric(null)}
        ghostMode={ghostMode}
      />
    </div>
  );
}

export default VitalsView;
