import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import {
  detectMetricDeviation,
  generateBiologicalInsights,
  type DailyMetricEntry,
  type BiologicalInsight,
} from "@/lib/analyticsUtils";

/* ═══════════════════════════════════════════════════════════════
   ██  BIOLOGICAL INSIGHTS — Actionable coaching from raw data
   ═══════════════════════════════════════════════════════════════ */

interface BiologicalInsightsProps {
  /** Current steps today */
  currentSteps: number;
  /** Current sleep hours (last night) */
  currentSleepHours: number;
  /** Historical steps data for 7-day rolling average */
  stepsHistory: DailyMetricEntry[] | null;
  /** Historical sleep data for 7-day rolling average */
  sleepHistory: DailyMetricEntry[] | null;
  /** Ghost mode for privacy */
  ghostMode: boolean;
}

/* ── Simulated baseline insights for new users ── */
const SIMULATED_INSIGHTS: BiologicalInsight[] = [
  {
    id: "sim-hrv-baseline",
    type: "positive",
    severity: "info",
    icon: "💓",
    title: "HRV Baseline: 72ms",
    message: "System is establishing your heart rate variability baseline. Continue wearing your device overnight for more accurate readings.",
    color: "#C4A46C",
    ghostColor: "rgba(160,160,160,0.6)",
    deviation: undefined,
  },
  {
    id: "sim-sleep-window",
    type: "positive",
    severity: "info",
    icon: "🌙",
    title: "Optimized Window: 10pm – 6am",
    message: "Based on initial circadian signals, your ideal sleep window appears to be 10:00 PM to 6:00 AM. More data will refine this estimate.",
    color: "#8B9A6B",
    ghostColor: "rgba(160,160,160,0.6)",
    deviation: undefined,
  },
];

/* ── Single Insight Card ── */
function InsightCard({
  insight,
  ghostMode,
  index,
  isSimulated,
}: {
  insight: BiologicalInsight;
  ghostMode: boolean;
  index: number;
  isSimulated?: boolean;
}) {
  const isAlert = insight.type === "alert";
  const isCritical = insight.severity === "critical";

  const cardBg = ghostMode
    ? "rgba(200,200,200,0.04)"
    : isSimulated
      ? "rgba(196,164,108,0.03)"
      : isAlert
        ? isCritical
          ? "rgba(255,69,58,0.04)"
          : "rgba(255,159,10,0.04)"
        : "rgba(48,209,88,0.04)";

  const cardBorder = ghostMode
    ? "rgba(160,160,160,0.1)"
    : isSimulated
      ? "rgba(196,164,108,0.1)"
      : isAlert
        ? isCritical
          ? "rgba(255,69,58,0.15)"
          : "rgba(255,159,10,0.15)"
        : "rgba(48,209,88,0.12)";

  const accentColor = ghostMode ? insight.ghostColor : insight.color;
  const titleColor = ghostMode ? "rgba(220,220,220,0.85)" : "rgba(224,224,224,0.9)";
  const messageColor = ghostMode ? "rgba(160,160,160,0.6)" : "rgba(180,180,200,0.6)";

  // Deviation bar data
  const deviation = insight.deviation;
  const showBar = deviation !== null && deviation !== undefined;
  const barPercent = showBar
    ? Math.min(100, Math.abs(deviation.deviationPercent))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
        delay: index * 0.08,
      }}
      className="flex flex-col gap-2.5 rounded-2xl px-4 py-3.5 transition-all duration-300"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      {/* Top row: icon + title + badge */}
      <div className="flex items-start gap-3">
        {/* Icon circle */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: ghostMode
              ? "rgba(160,160,160,0.06)"
              : `${insight.color}12`,
          }}
        >
          <span className="text-base leading-none">{insight.icon}</span>
        </div>

        {/* Title + message */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold leading-snug"
              style={{
                fontSize: "13.5px",
                color: titleColor,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {insight.title}
            </span>

            {/* Severity or Establishing pill */}
            {isSimulated ? (
              <span
                className="shrink-0 px-2 py-0.5 rounded-full font-semibold uppercase"
                style={{
                  fontSize: "8px",
                  letterSpacing: "0.08em",
                  color: "rgba(196,164,108,0.7)",
                  background: "rgba(196,164,108,0.06)",
                  border: "1px solid rgba(196,164,108,0.12)",
                }}
              >
                Establishing
              </span>
            ) : isAlert ? (
              <span
                className="shrink-0 px-2 py-0.5 rounded-full font-semibold uppercase"
                style={{
                  fontSize: "8.5px",
                  letterSpacing: "0.08em",
                  color: accentColor,
                  background: ghostMode
                    ? "rgba(160,160,160,0.06)"
                    : `${insight.color}10`,
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : `${insight.color}20`}`,
                }}
              >
                {isCritical ? "Attention" : "Notice"}
              </span>
            ) : null}
          </div>

          <p
            className="mt-1 leading-relaxed"
            style={{
              fontSize: "12px",
              color: messageColor,
              fontFamily: "Inter, system-ui, sans-serif",
              lineHeight: "1.55",
            }}
          >
            {insight.message}
          </p>
        </div>
      </div>

      {/* Deviation bar (only for metrics with deviation data) */}
      {showBar && (
        <div className="flex items-center gap-3 pl-12">
          <span
            className="shrink-0 font-mono tabular-nums"
            style={{
              fontSize: "10px",
              color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(100,100,120,0.5)",
            }}
          >
            7d avg
          </span>

          <div className="flex-1 relative">
            <div
              className="h-[5px] rounded-full overflow-hidden"
              style={{
                background: ghostMode
                  ? "rgba(160,160,160,0.06)"
                  : "rgba(255,255,255,0.04)",
              }}
            >
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${barPercent}%` }}
                transition={{
                  duration: 0.7,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.3 + index * 0.1,
                }}
                style={{ background: accentColor }}
              />
            </div>

            <div
              className="absolute top-0 h-[5px] w-px"
              style={{
                left: "20%",
                background: ghostMode
                  ? "rgba(160,160,160,0.15)"
                  : "rgba(255,255,255,0.08)",
              }}
            />
          </div>

          <span
            className="shrink-0 font-mono font-semibold tabular-nums"
            style={{
              fontSize: "11px",
              color: accentColor,
              minWidth: "40px",
              textAlign: "right",
            }}
          >
            {deviation.direction === "above" ? "+" : ""}
            {deviation.deviationPercent.toFixed(0)}%
          </span>
        </div>
      )}
    </motion.div>
  );
}

/* ── Main Component ── */
export function BiologicalInsights({
  currentSteps,
  currentSleepHours,
  stepsHistory,
  sleepHistory,
  ghostMode,
}: BiologicalInsightsProps) {
  const hasRealData =
    (stepsHistory && stepsHistory.length >= 3) ||
    (sleepHistory && sleepHistory.length >= 3);

  const realInsights = useMemo(() => {
    if (!hasRealData) return [];
    const stepsDeviation = detectMetricDeviation("steps", currentSteps, stepsHistory);
    const sleepDeviation = detectMetricDeviation("sleep", currentSleepHours, sleepHistory);
    return generateBiologicalInsights(stepsDeviation, sleepDeviation);
  }, [currentSteps, currentSleepHours, stepsHistory, sleepHistory, hasRealData]);

  const isSimulated = !hasRealData || realInsights.length === 0;
  const insights = isSimulated ? SIMULATED_INSIGHTS : realInsights;

  const headerColor = ghostMode ? "rgba(200,200,200,0.8)" : "rgba(224,224,224,0.9)";
  const subColor = ghostMode ? "rgba(160,160,160,0.45)" : "rgba(180,180,200,0.5)";
  const hasAlerts = !isSimulated && insights.some((i) => i.type === "alert");

  /* Pulse indicator for active alerts */
  const pulseIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12h4l3-9 4 18 3-9h4"
        stroke={
          ghostMode
            ? "rgba(160,160,160,0.5)"
            : isSimulated
              ? "rgba(196,164,108,0.6)"
              : hasAlerts
                ? "#FF9F0A"
                : "#30D158"
        }
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col gap-3"
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center relative"
            style={{
              background: ghostMode
                ? "rgba(160,160,160,0.06)"
                : isSimulated
                  ? "rgba(196,164,108,0.06)"
                  : hasAlerts
                    ? "rgba(255,159,10,0.08)"
                    : "rgba(48,209,88,0.08)",
            }}
          >
            {pulseIcon}
            {/* Pulse dot for alerts (not shown in simulated mode) */}
            {hasAlerts && !ghostMode && !isSimulated && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ background: "#FF9F0A" }}
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
          <div className="flex flex-col">
            <span
              className="font-bold tracking-tight"
              style={{
                fontSize: "14px",
                color: headerColor,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Biological Insights
            </span>
            <span
              className="mt-0.5"
              style={{
                fontSize: "10.5px",
                color: subColor,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {isSimulated
                ? "System baseline establishing — connect more data"
                : hasAlerts
                  ? "Deviations detected from your 7-day baseline"
                  : "All metrics within normal range"}
            </span>
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {insights.map((insight, i) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              ghostMode={ghostMode}
              index={i}
              isSimulated={isSimulated}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
