/**
 * Your Progress Calculator
 *
 * Analyzes the last 14 days of readiness scores to determine the rate
 * and direction of health improvement. Returns a friendly, conversational
 * string like "You're doing great" or "Let's get back on track".
 *
 * The algorithm computes:
 * 1. Week-over-week delta (week 2 avg vs week 1 avg)
 * 2. Rate of change (improving vs declining)
 * 3. Progress classification (friendly tiers)
 */

export interface VelocityResult {
  /** Human-readable label, e.g. "You're doing great" */
  label: string;
  /** Raw percentage change (positive = improving) */
  delta: number;
  /** Progress tier for styling */
  tier: "surge" | "acceleration" | "cruising" | "stalling" | "deceleration" | "freefall";
  /** Accent color for the tier */
  color: string;
  /** Ghost-mode safe color */
  ghostColor: string;
  /** Emoji icon for the tier */
  icon: string;
}

export function calculateBiologicalVelocity(
  vitalityScores: Array<{ overallScore: number; calculatedAt: number }> | null | undefined,
): VelocityResult {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const scores = (vitalityScores || [])
    .filter((s) => now - s.calculatedAt < 14 * DAY)
    .sort((a, b) => a.calculatedAt - b.calculatedAt);

  // Split into two 7-day windows
  const week1 = scores.filter(
    (s) => now - s.calculatedAt >= 7 * DAY && now - s.calculatedAt < 14 * DAY,
  );
  const week2 = scores.filter((s) => now - s.calculatedAt < 7 * DAY);

  const avg1 =
    week1.length > 0
      ? week1.reduce((sum, s) => sum + s.overallScore, 0) / week1.length
      : 0;
  const avg2 =
    week2.length > 0
      ? week2.reduce((sum, s) => sum + s.overallScore, 0) / week2.length
      : 0;

  // Calculate percentage delta
  let delta: number;
  if (avg1 > 0) {
    delta = Math.round(((avg2 - avg1) / avg1) * 100);
  } else if (avg2 > 0) {
    delta = 100; // From zero to something = max positive
  } else {
    delta = 0;
  }

  // Also compute intra-week momentum (is week2 itself accelerating?)
  let intraWeekSlope = 0;
  if (week2.length >= 3) {
    const firstHalf = week2.slice(0, Math.floor(week2.length / 2));
    const secondHalf = week2.slice(Math.floor(week2.length / 2));
    const avgFirst =
      firstHalf.reduce((s, v) => s + v.overallScore, 0) / firstHalf.length;
    const avgSecond =
      secondHalf.reduce((s, v) => s + v.overallScore, 0) / secondHalf.length;
    intraWeekSlope = avgSecond - avgFirst;
  }

  // Classify momentum tier
  let tier: VelocityResult["tier"];
  let label: string;
  let color: string;
  let icon: string;

  if (delta >= 15 || (delta >= 10 && intraWeekSlope > 3)) {
    tier = "surge";
    label = "You're on fire!";
    color = "#30D158";
    icon = "\u26A1";
  } else if (delta >= 5) {
    tier = "acceleration";
    label = "You're doing great";
    color = "#30D158";
    icon = "\uD83D\uDE80";
  } else if (delta >= 0 && delta < 5) {
    tier = "cruising";
    label = "Holding steady";
    color = "#FFD60A";
    icon = "\u2192";
  } else if (delta >= -5) {
    tier = "stalling";
    label = "Room to improve";
    color = "#FFD60A";
    icon = "\u23F8\uFE0F";
  } else if (delta >= -15) {
    tier = "deceleration";
    label = "Let's get back on track";
    color = "#FF453A";
    icon = "\uD83D\uDCC9";
  } else {
    tier = "freefall";
    label = "Time to reset and recover";
    color = "#FF453A";
    icon = "\u26A0\uFE0F";
  }

  // Handle insufficient data
  if (scores.length < 3) {
    return {
      label: "Getting to know you\u2026",
      delta: 0,
      tier: "cruising",
      color: "#FFD60A",
      ghostColor: "rgba(160,160,160,0.4)",
      icon: "\uD83D\uDD2C",
    };
  }

  return {
    label,
    delta,
    tier,
    color,
    ghostColor: "rgba(160,160,160,0.5)",
    icon,
  };
}

/* ═══════════════════════════════════════════════════════════════
   ██  7-DAY ROLLING AVERAGE & BIOLOGICAL INSIGHT DETECTION
   ═══════════════════════════════════════════════════════════════ */

export interface DailyMetricEntry {
  value: number;
  /** Unix timestamp (ms) */
  timestamp: number;
}

/**
 * Computes the 7-day rolling average from an array of daily metric entries.
 * Groups entries by calendar day, averages within each day, then averages
 * the most recent 7 days that have data.
 */
export function calculate7DayRollingAverage(
  entries: DailyMetricEntry[] | null | undefined,
): number | null {
  if (!entries || entries.length === 0) return null;

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff = now - 7 * DAY;

  // Filter to last 7 days
  const recent = entries.filter((e) => e.timestamp >= cutoff);
  if (recent.length === 0) return null;

  // Group by day key (YYYY-MM-DD)
  const byDay = new Map<string, number[]>();
  for (const entry of recent) {
    const d = new Date(entry.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const existing = byDay.get(key) || [];
    existing.push(entry.value);
    byDay.set(key, existing);
  }

  // Average each day, then average across days
  const dailyAverages: number[] = [];
  for (const values of byDay.values()) {
    dailyAverages.push(values.reduce((s, v) => s + v, 0) / values.length);
  }

  if (dailyAverages.length === 0) return null;
  return dailyAverages.reduce((s, v) => s + v, 0) / dailyAverages.length;
}

/**
 * Deviation result for a single metric.
 */
export interface MetricDeviation {
  /** Metric name */
  metric: "steps" | "sleep";
  /** Current value (today) */
  current: number;
  /** 7-day rolling average */
  average: number;
  /** Percentage deviation from average (positive = above, negative = below) */
  deviationPercent: number;
  /** Absolute deviation */
  deviationAbs: number;
  /** Whether deviation exceeds the 20% threshold */
  isSignificant: boolean;
  /** Direction of deviation */
  direction: "above" | "below" | "stable";
}

/**
 * Detects whether a current metric value deviates by more than a threshold
 * (default 20%) from its 7-day rolling average.
 */
export function detectMetricDeviation(
  metric: "steps" | "sleep",
  currentValue: number,
  history: DailyMetricEntry[] | null | undefined,
  thresholdPercent: number = 20,
): MetricDeviation | null {
  const avg = calculate7DayRollingAverage(history);
  if (avg === null || avg === 0) return null;

  const deviationAbs = currentValue - avg;
  const deviationPercent = (deviationAbs / avg) * 100;
  const isSignificant = Math.abs(deviationPercent) > thresholdPercent;

  let direction: MetricDeviation["direction"];
  if (deviationPercent > thresholdPercent) direction = "above";
  else if (deviationPercent < -thresholdPercent) direction = "below";
  else direction = "stable";

  return {
    metric,
    current: currentValue,
    average: Math.round(avg * 10) / 10,
    deviationPercent: Math.round(deviationPercent * 10) / 10,
    deviationAbs: Math.round(deviationAbs * 10) / 10,
    isSignificant,
    direction,
  };
}

export interface BiologicalInsight {
  /** Unique key for React rendering */
  id: string;
  /** "alert" for deviations, "positive" for stable */
  type: "alert" | "positive";
  /** Severity: info (stable), warning (moderate deviation), critical (large deviation) */
  severity: "info" | "warning" | "critical";
  /** Icon emoji */
  icon: string;
  /** Short title */
  title: string;
  /** Coaching message */
  message: string;
  /** Accent color */
  color: string;
  /** Ghost-mode color */
  ghostColor: string;
  /** Related metric */
  metric?: "steps" | "sleep";
  /** Deviation data if applicable */
  deviation?: MetricDeviation;
}

/**
 * Generates actionable biological insights from Steps and Sleep deviations.
 * Returns an array of insight objects for rendering in the dashboard.
 */
export function generateBiologicalInsights(
  stepsDeviation: MetricDeviation | null,
  sleepDeviation: MetricDeviation | null,
): BiologicalInsight[] {
  const insights: BiologicalInsight[] = [];

  // ── Steps insights ──
  if (stepsDeviation?.isSignificant) {
    if (stepsDeviation.direction === "below") {
      const severity = Math.abs(stepsDeviation.deviationPercent) > 35 ? "critical" : "warning";
      insights.push({
        id: "steps-low",
        type: "alert",
        severity,
        icon: "\uD83D\uDC5F",
        title: "Steps below baseline",
        message: `You're at ${stepsDeviation.current.toLocaleString()} steps today \u2014 ${Math.abs(stepsDeviation.deviationPercent).toFixed(0)}% below your 7-day average of ${stepsDeviation.average.toLocaleString()}. A short walk could close the gap.`,
        color: severity === "critical" ? "#FF453A" : "#FF9F0A",
        ghostColor: "rgba(160,160,160,0.5)",
        metric: "steps",
        deviation: stepsDeviation,
      });
    } else if (stepsDeviation.direction === "above") {
      insights.push({
        id: "steps-high",
        type: "positive",
        severity: "info",
        icon: "\uD83D\uDE80",
        title: "Steps exceeding baseline",
        message: `Great momentum \u2014 ${stepsDeviation.current.toLocaleString()} steps today is ${stepsDeviation.deviationPercent.toFixed(0)}% above your 7-day average. Keep it up!`,
        color: "#30D158",
        ghostColor: "rgba(160,160,160,0.5)",
        metric: "steps",
        deviation: stepsDeviation,
      });
    }
  }

  // ── Sleep insights ──
  if (sleepDeviation?.isSignificant) {
    if (sleepDeviation.direction === "below") {
      const severity = Math.abs(sleepDeviation.deviationPercent) > 35 ? "critical" : "warning";
      insights.push({
        id: "sleep-low",
        type: "alert",
        severity,
        icon: "\uD83D\uDE34",
        title: "Sleep deficit detected",
        message: `${sleepDeviation.current.toFixed(1)}h last night is ${Math.abs(sleepDeviation.deviationPercent).toFixed(0)}% below your 7-day average of ${sleepDeviation.average.toFixed(1)}h. Consider an earlier wind-down tonight.`,
        color: severity === "critical" ? "#FF453A" : "#FF9F0A",
        ghostColor: "rgba(160,160,160,0.5)",
        metric: "sleep",
        deviation: sleepDeviation,
      });
    } else if (sleepDeviation.direction === "above") {
      insights.push({
        id: "sleep-high",
        type: "positive",
        severity: "info",
        icon: "\uD83C\uDF1F",
        title: "Sleep surplus",
        message: `${sleepDeviation.current.toFixed(1)}h is ${sleepDeviation.deviationPercent.toFixed(0)}% above your average. Your recovery capacity is elevated today.`,
        color: "#30D158",
        ghostColor: "rgba(160,160,160,0.5)",
        metric: "sleep",
        deviation: sleepDeviation,
      });
    }
  }

  // ── All stable: positive reinforcement ──
  if (insights.length === 0) {
    const hasAnyData = stepsDeviation !== null || sleepDeviation !== null;
    if (hasAnyData) {
      insights.push({
        id: "stable",
        type: "positive",
        severity: "info",
        icon: "\u2705",
        title: "Physiology is stable",
        message: "All metrics are within normal range \u2014 proceed with planned protocols.",
        color: "#30D158",
        ghostColor: "rgba(160,160,160,0.5)",
      });
    }
  }

  return insights;
}
