import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

/* ══════════════════════════════════════════════ */
/* ── Warm Earth-Tone Palette (shared)          */
/* ══════════════════════════════════════════════ */
const WARM = {
  terra: "#E8976C",
  sage: "#7CB68E",
  sky: "#6BA3BE",
  gold: "#C4A46C",
  rose: "#D4847A",
  sand: "#E8E0D8",
  cardBg: "rgba(26,24,22,0.92)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
};

/* ══════════════════════════════════════════════ */
/* ── Metric Configuration                      */
/* ══════════════════════════════════════════════ */
interface MetricConfig {
  label: string;
  unit: string;
  icon: string;
  color: string;
  optimalRange: [number, number];
  generateData: () => { day: string; value: number; avg: number }[];
  correlations: { factor: string; impact: string; direction: "positive" | "negative" }[];
  analysisLabel: string;
}

function generateMetricSeries(base: number, variance: number): number[] {
  const vals: number[] = [];
  let v = base;
  for (let i = 0; i < 7; i++) {
    v += (Math.random() - 0.48) * variance;
    v = Math.max(base - variance * 2.5, Math.min(base + variance * 2.5, v));
    vals.push(Math.round(v * 10) / 10);
  }
  return vals;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const METRIC_CONFIGS: Record<string, MetricConfig> = {
  sleep: {
    label: "Sleep Quality",
    unit: "hrs",
    icon: "🌙",
    color: WARM.sky,
    optimalRange: [7, 9],
    generateData: () => {
      const vals = generateMetricSeries(7.6, 0.8);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: vals[i], avg: Math.round(avg * 10) / 10 }));
    },
    correlations: [
      { factor: "Late Caffeine (>2pm)", impact: "+22min Sleep Latency", direction: "negative" },
      { factor: "Evening Screen Time", impact: "-14% Deep Sleep", direction: "negative" },
      { factor: "Magnesium Glycinate", impact: "+18% Deep Sleep", direction: "positive" },
      { factor: "Cold Room (65°F)", impact: "+11% REM Duration", direction: "positive" },
    ],
    analysisLabel: "QUANTITATIVE SLEEP ARCHITECTURE",
  },
  heart: {
    label: "Heart Rate",
    unit: "BPM",
    icon: "💓",
    color: WARM.rose,
    optimalRange: [55, 72],
    generateData: () => {
      const vals = generateMetricSeries(68, 5);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "High-Intensity Training", impact: "+8 BPM Resting (24h)", direction: "negative" },
      { factor: "Meditation (20min)", impact: "-4 BPM Average", direction: "positive" },
      { factor: "Alcohol (>2 drinks)", impact: "+12 BPM Overnight", direction: "negative" },
      { factor: "Zone 2 Cardio", impact: "-3 BPM Baseline", direction: "positive" },
    ],
    analysisLabel: "CARDIAC RHYTHM ANALYSIS",
  },
  hrv: {
    label: "Heart Rhythm Variability",
    unit: "ms",
    icon: "📊",
    color: WARM.sage,
    optimalRange: [45, 120],
    generateData: () => {
      const vals = generateMetricSeries(58, 8);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "Heavy Alcohol", impact: "-12% HRV", direction: "negative" },
      { factor: "Cold Exposure (3min)", impact: "+9% HRV", direction: "positive" },
      { factor: "Sleep Debt (>2hrs)", impact: "-18% HRV", direction: "negative" },
      { factor: "Breathwork (Box)", impact: "+7ms Acute", direction: "positive" },
    ],
    analysisLabel: "AUTONOMIC NERVOUS SYSTEM",
  },
  recovery: {
    label: "Recovery Index",
    unit: "%",
    icon: "🔋",
    color: WARM.gold,
    optimalRange: [75, 100],
    generateData: () => {
      const vals = generateMetricSeries(72, 10);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "Overtraining (>90min)", impact: "-15% Recovery", direction: "negative" },
      { factor: "Sauna (20min)", impact: "+8% Recovery", direction: "positive" },
      { factor: "Protein Timing (<30min)", impact: "+12% Muscle Repair", direction: "positive" },
      { factor: "Late Caffeine", impact: "+20min Sleep Latency", direction: "negative" },
    ],
    analysisLabel: "QUANTITATIVE RECOVERY",
  },
  spo2: {
    label: "Blood Oxygen",
    unit: "%",
    icon: "🫁",
    color: WARM.sky,
    optimalRange: [97, 100],
    generateData: () => {
      const vals = generateMetricSeries(97.8, 0.6);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i] * 10) / 10, avg: Math.round(avg * 10) / 10 }));
    },
    correlations: [
      { factor: "Altitude Change", impact: "-1.2% SpO2", direction: "negative" },
      { factor: "Nasal Breathing", impact: "+0.8% SpO2", direction: "positive" },
      { factor: "Respiratory Infection", impact: "-3% SpO2", direction: "negative" },
      { factor: "Aerobic Fitness", impact: "+0.5% Baseline", direction: "positive" },
    ],
    analysisLabel: "OXYGENATION ANALYSIS",
  },
  steps: {
    label: "Daily Steps",
    unit: "",
    icon: "🚶",
    color: WARM.terra,
    optimalRange: [8000, 15000],
    generateData: () => {
      const vals = generateMetricSeries(8400, 2000);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "Walking Meetings", impact: "+2400 Steps/Day", direction: "positive" },
      { factor: "Sedentary Work (>6h)", impact: "-3200 Steps", direction: "negative" },
      { factor: "Morning Walk (30min)", impact: "+3800 Steps", direction: "positive" },
      { factor: "Rain/Cold Weather", impact: "-1800 Steps", direction: "negative" },
    ],
    analysisLabel: "LOCOMOTION METRICS",
  },
  respiratory: {
    label: "Breathing Rate",
    unit: "br/min",
    icon: "💨",
    color: WARM.sage,
    optimalRange: [12, 18],
    generateData: () => {
      const vals = generateMetricSeries(15, 1.5);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i] * 10) / 10, avg: Math.round(avg * 10) / 10 }));
    },
    correlations: [
      { factor: "Anxiety/Stress", impact: "+3 br/min", direction: "negative" },
      { factor: "Breathwork Practice", impact: "-2 br/min", direction: "positive" },
      { factor: "High Altitude", impact: "+2 br/min", direction: "negative" },
      { factor: "Meditation", impact: "-1.5 br/min", direction: "positive" },
    ],
    analysisLabel: "RESPIRATORY ANALYSIS",
  },
  temp: {
    label: "Body Temperature",
    unit: "°F",
    icon: "🌡️",
    color: WARM.gold,
    optimalRange: [97.5, 99],
    generateData: () => {
      const vals = generateMetricSeries(98.2, 0.3);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i] * 10) / 10, avg: Math.round(avg * 10) / 10 }));
    },
    correlations: [
      { factor: "Illness Onset", impact: "+1.2°F", direction: "negative" },
      { factor: "Cold Plunge", impact: "-0.5°F (transient)", direction: "positive" },
      { factor: "Ovulation Phase", impact: "+0.4°F Baseline", direction: "negative" },
      { factor: "Exercise Recovery", impact: "+0.3°F (2h)", direction: "negative" },
    ],
    analysisLabel: "THERMOREGULATION",
  },
  /* Mock insight IDs */
  "mock-sleep": {
    label: "Sleep Quality",
    unit: "%",
    icon: "🌙",
    color: WARM.sky,
    optimalRange: [80, 100],
    generateData: () => {
      const vals = generateMetricSeries(88, 6);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "Late Caffeine (>2pm)", impact: "+22min Sleep Latency", direction: "negative" },
      { factor: "Magnesium Glycinate", impact: "+18% Deep Sleep", direction: "positive" },
      { factor: "Cold Room (65°F)", impact: "+11% REM Duration", direction: "positive" },
    ],
    analysisLabel: "QUANTITATIVE SLEEP ARCHITECTURE",
  },
  "mock-bioage": {
    label: "Biological Age",
    unit: "yrs",
    icon: "🧬",
    color: WARM.sky,
    optimalRange: [28, 34],
    generateData: () => {
      const vals = generateMetricSeries(31.4, 0.3);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i] * 10) / 10, avg: Math.round(avg * 10) / 10 }));
    },
    correlations: [
      { factor: "Consistent Sleep (7-9h)", impact: "-0.4 yrs/quarter", direction: "positive" },
      { factor: "Chronic Stress", impact: "+1.2 yrs/year", direction: "negative" },
      { factor: "Zone 2 Cardio (150min/wk)", impact: "-0.6 yrs/quarter", direction: "positive" },
    ],
    analysisLabel: "EPIGENETIC AGE ANALYSIS",
  },
  "mock-fatigue": {
    label: "Muscle Fatigue",
    unit: "%",
    icon: "🦵",
    color: WARM.gold,
    optimalRange: [0, 40],
    generateData: () => {
      const vals = generateMetricSeries(42, 8);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "Overtraining (>90min)", impact: "+22% Fatigue", direction: "negative" },
      { factor: "Protein (>1.6g/kg)", impact: "-12% Recovery Time", direction: "positive" },
      { factor: "Sleep Debt (>2hrs)", impact: "+18% Fatigue", direction: "negative" },
    ],
    analysisLabel: "NEUROMUSCULAR FATIGUE INDEX",
  },
  "mock-hrv": {
    label: "HRV Coherence",
    unit: "ms",
    icon: "💓",
    color: WARM.sky,
    optimalRange: [50, 120],
    generateData: () => {
      const vals = generateMetricSeries(64, 7);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return DAYS.map((d, i) => ({ day: d, value: Math.round(vals[i]), avg: Math.round(avg) }));
    },
    correlations: [
      { factor: "Heavy Alcohol", impact: "-12% HRV", direction: "negative" },
      { factor: "Cold Exposure (3min)", impact: "+9% HRV", direction: "positive" },
      { factor: "Breathwork (Box)", impact: "+7ms Acute", direction: "positive" },
    ],
    analysisLabel: "AUTONOMIC COHERENCE",
  },
};

/* ══════════════════════════════════════════════ */
/* ── Decrypting Text Effect                    */
/* ══════════════════════════════════════════════ */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*";

function useDecryptText(target: string, active: boolean, speed: number = 30): string {
  const [display, setDisplay] = useState("");
  const frameRef = useRef<number>(0);
  const revealedRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }
    revealedRef.current = 0;
    setDisplay("");

    const interval = setInterval(() => {
      frameRef.current++;
      const revealed = Math.min(target.length, Math.floor(frameRef.current / 2));
      revealedRef.current = revealed;

      let result = "";
      for (let i = 0; i < target.length; i++) {
        if (i < revealed) {
          result += target[i];
        } else if (target[i] === " ") {
          result += " ";
        } else {
          result += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      setDisplay(result);

      if (revealed >= target.length) {
        clearInterval(interval);
        setDisplay(target);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [target, active, speed]);

  return display;
}

/* ══════════════════════════════════════════════ */
/* ── Custom Tooltip                            */
/* ══════════════════════════════════════════════ */
function DeepDiveTooltip({ active, payload, label, unit, color }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
  unit: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload.find((p) => p.dataKey === "value");
  const avg = payload.find((p) => p.dataKey === "avg");

  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[11px]"
      style={{
        background: "rgba(18,16,14,0.95)",
        border: `1px solid ${color}30`,
        backdropFilter: "blur(12px)",
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}10`,
      }}
    >
      <div className="font-bold mb-1" style={{ color: WARM.textSecondary }}>{label}</div>
      {val && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span style={{ color }}>{val.value} {unit}</span>
        </div>
      )}
      {avg && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: `${WARM.textDim}60` }} />
          <span style={{ color: WARM.textDim }}>avg {avg.value} {unit}</span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/* ── MAIN COMPONENT                            */
/* ══════════════════════════════════════════════ */
export interface MetricDeepDiveProps {
  metricId: string | null;
  onClose: () => void;
  ghostMode?: boolean;
}

export function MetricDeepDive({ metricId, onClose, ghostMode = false }: MetricDeepDiveProps) {
  const isOpen = metricId !== null;
  const config = metricId ? METRIC_CONFIGS[metricId] : null;
  const [decrypting, setDecrypting] = useState(false);

  // Generate chart data once per open
  const chartData = useMemo(() => {
    if (!config) return [];
    return config.generateData();
  }, [metricId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger decrypt animation on open
  useEffect(() => {
    if (isOpen) {
      setDecrypting(true);
      const t = setTimeout(() => setDecrypting(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isOpen, metricId]);

  const headerText = useDecryptText(
    config ? `ANALYSIS: ${config.analysisLabel}` : "ANALYSIS: LOADING",
    decrypting,
    25,
  );

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!config) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{ background: "rgba(5,5,3,0.6)" }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>
    );
  }

  // Compute stats
  const values = chartData.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = chartData.length > 0 ? chartData[0].avg : 0;
  const current = values[values.length - 1] ?? 0;
  const delta = avg > 0 ? ((current - avg) / avg * 100) : 0;
  const inOptimal = current >= config.optimalRange[0] && current <= config.optimalRange[1];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200]"
            style={{
              background: ghostMode ? "rgba(0,0,0,0.7)" : "rgba(5,5,3,0.6)",
              backdropFilter: "blur(8px)",
            }}
            onClick={handleBackdropClick}
          />

          {/* Slide-over drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-[201] max-h-[88vh] overflow-y-auto overscroll-contain"
            style={{
              background: ghostMode ? "rgba(12,12,12,0.97)" : "rgba(18,16,14,0.97)",
              borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : config.color + "20"}`,
              borderRadius: "20px 20px 0 0",
              backdropFilter: "blur(24px)",
              boxShadow: `0 -8px 40px rgba(0,0,0,0.5), 0 0 30px ${config.color}08`,
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: ghostMode ? "rgba(160,160,160,0.15)" : "rgba(232,224,216,0.15)" }}
              />
            </div>

            <div className="px-5 pb-8">
              {/* ── Header ── */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.06)" : `${config.color}0c`,
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${config.color}18`}`,
                    }}
                  >
                    <span style={{ fontSize: 20, filter: ghostMode ? "grayscale(1) opacity(0.4)" : "none" }}>
                      {config.icon}
                    </span>
                  </div>
                  <div>
                    <h2
                      className="text-base font-bold"
                      style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : WARM.textPrimary }}
                    >
                      {config.label}
                    </h2>
                    <p
                      className="text-[10px] font-mono tracking-wider uppercase"
                      style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : config.color }}
                    >
                      {headerText}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.06)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(232,224,216,0.08)"}`,
                  }}
                >
                  <span style={{ fontSize: 14, color: WARM.textDim }}>✕</span>
                </button>
              </div>

              {/* ── Quick Stats Row ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="grid grid-cols-4 gap-2 mb-5"
              >
                {[
                  { label: "CURRENT", value: String(current), accent: config.color },
                  { label: "7D AVG", value: String(avg), accent: WARM.textSecondary },
                  { label: "MIN", value: String(min), accent: WARM.textDim },
                  { label: "MAX", value: String(max), accent: WARM.textDim },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg px-2.5 py-2 text-center"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(232,224,216,0.03)",
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.06)"}`,
                    }}
                  >
                    <div
                      className="text-[8px] font-mono font-bold tracking-widest mb-1"
                      style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : WARM.textDim }}
                    >
                      {stat.label}
                    </div>
                    <div
                      className="text-sm font-bold tabular-nums"
                      style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : stat.accent }}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* ── Status Bar ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2 mb-4"
              >
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold tracking-wider"
                  style={{
                    color: inOptimal ? WARM.sage : WARM.gold,
                    background: `${inOptimal ? WARM.sage : WARM.gold}0c`,
                    border: `1px solid ${inOptimal ? WARM.sage : WARM.gold}20`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: inOptimal ? WARM.sage : WARM.gold,
                      boxShadow: `0 0 6px ${inOptimal ? WARM.sage : WARM.gold}60`,
                    }}
                  />
                  {inOptimal ? "IN OPTIMAL RANGE" : "OUTSIDE OPTIMAL"}
                </div>
                <div
                  className="px-2.5 py-1 rounded-full font-mono text-[9px] font-bold tracking-wider"
                  style={{
                    color: delta >= 0 ? WARM.sage : WARM.rose,
                    background: `${delta >= 0 ? WARM.sage : WARM.rose}0c`,
                    border: `1px solid ${delta >= 0 ? WARM.sage : WARM.rose}20`,
                  }}
                >
                  {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs AVG
                </div>
              </motion.div>

              {/* ── 7-Day Chart ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="rounded-xl overflow-hidden mb-5"
                style={{
                  background: ghostMode ? "rgba(12,12,12,0.5)" : "rgba(20,18,16,0.6)",
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : `${config.color}12`}`,
                }}
              >
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <span
                    className="text-[9px] font-mono font-bold tracking-widest uppercase"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : WARM.textDim }}
                  >
                    7-Day Trend
                  </span>
                  <span
                    className="text-[9px] font-mono"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.25)" : `${config.color}60` }}
                  >
                    {config.unit}
                  </span>
                </div>

                <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                      <defs>
                        <linearGradient id={`deepdive-grad-${metricId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={config.color} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={config.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={ghostMode ? "rgba(160,160,160,0.04)" : "rgba(232,224,216,0.04)"}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 9, fill: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim, fontFamily: "monospace" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: ghostMode ? "rgba(160,160,160,0.25)" : WARM.textDim, fontFamily: "monospace" }}
                        axisLine={false}
                        tickLine={false}
                        domain={["auto", "auto"]}
                      />
                      {/* Optimal range reference lines */}
                      <ReferenceLine
                        y={config.optimalRange[0]}
                        stroke={`${WARM.sage}30`}
                        strokeDasharray="4 4"
                      />
                      <ReferenceLine
                        y={config.optimalRange[1]}
                        stroke={`${WARM.sage}30`}
                        strokeDasharray="4 4"
                      />
                      {/* Average line */}
                      <Area
                        type="monotone"
                        dataKey="avg"
                        stroke={`${WARM.textDim}40`}
                        strokeDasharray="4 4"
                        fill="none"
                        strokeWidth={1}
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={800}
                      />
                      {/* Main metric area */}
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={config.color}
                        fill={`url(#deepdive-grad-${metricId})`}
                        strokeWidth={2}
                        dot={{
                          r: 3,
                          fill: config.color,
                          stroke: "rgba(18,16,14,0.8)",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 5,
                          fill: config.color,
                          stroke: "rgba(18,16,14,0.9)",
                          strokeWidth: 2,
                        }}
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                      <Tooltip
                        content={<DeepDiveTooltip unit={config.unit} color={config.color} />}
                        cursor={{ stroke: `${config.color}20`, strokeWidth: 1 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* ── Correlations ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.06)" : `${config.color}0a`,
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${config.color}15`}`,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>🔗</span>
                  </div>
                  <span
                    className="text-[10px] font-mono font-bold tracking-widest uppercase"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : WARM.textSecondary }}
                  >
                    Correlations
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {config.correlations.map((corr, i) => (
                    <CorrelationRow
                      key={i}
                      factor={corr.factor}
                      impact={corr.impact}
                      direction={corr.direction}
                      ghostMode={ghostMode}
                      index={i}
                      decrypting={decrypting}
                      accentColor={config.color}
                    />
                  ))}
                </div>
              </motion.div>

              {/* ── Optimal Range Footer ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-5 flex items-center justify-center"
              >
                <div
                  className="flex items-center gap-3 px-4 py-2.5 rounded-full font-mono text-[9px]"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(232,224,216,0.03)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.06)"}`,
                    color: ghostMode ? "rgba(160,160,160,0.35)" : WARM.textDim,
                  }}
                >
                  <span>OPTIMAL: {config.optimalRange[0]}–{config.optimalRange[1]} {config.unit}</span>
                  <span style={{ color: `${config.color}50` }}>|</span>
                  <span>PROTOCOL: ACTIVE</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════ */
/* ── Correlation Row                           */
/* ══════════════════════════════════════════════ */
function CorrelationRow({
  factor,
  impact,
  direction,
  ghostMode,
  index,
  decrypting,
  accentColor,
}: {
  factor: string;
  impact: string;
  direction: "positive" | "negative";
  ghostMode: boolean;
  index: number;
  decrypting: boolean;
  accentColor: string;
}) {
  const factorText = useDecryptText(factor, decrypting, 20 + index * 5);
  const impactText = useDecryptText(impact, decrypting, 25 + index * 5);
  const isPositive = direction === "positive";
  const dirColor = isPositive ? WARM.sage : WARM.rose;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 + index * 0.08, duration: 0.35 }}
      className="rounded-lg px-3.5 py-2.5 flex items-center justify-between"
      style={{
        background: ghostMode ? "rgba(160,160,160,0.02)" : "rgba(232,224,216,0.02)",
        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.05)" : `${accentColor}08`}`,
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="w-1.5 h-6 rounded-full flex-shrink-0"
          style={{
            background: ghostMode
              ? "rgba(160,160,160,0.15)"
              : `linear-gradient(180deg, ${dirColor}60, ${dirColor}15)`,
          }}
        />
        <span
          className="text-[11px] font-mono truncate"
          style={{ color: ghostMode ? "rgba(160,160,160,0.45)" : WARM.textSecondary }}
        >
          {factorText}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <span
          className="text-[9px] font-mono font-bold"
          style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : dirColor }}
        >
          {isPositive ? "▲" : "▼"}
        </span>
        <span
          className="text-[10px] font-mono font-semibold"
          style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : dirColor }}
        >
          {impactText}
        </span>
      </div>
    </motion.div>
  );
}

export default MetricDeepDive;
