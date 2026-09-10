/* ═══════════════════════════════════════════════════════════════
   BIO CALCULATIONS — Moving averages, deviation detection,
   and anomaly classification for biomarker trend analysis.
   ═══════════════════════════════════════════════════════════════ */

export interface DataPoint {
  value: number;
  timestamp: number;
}

export interface AnomalyResult {
  index: number;
  value: number;
  timestamp: number;
  movingAvg: number;
  deviationPct: number;
  direction: 'above' | 'below';
  severity: 'warning' | 'critical';
}

/**
 * Compute a simple moving average over a window of `windowSize` points.
 * Returns an array the same length as `points`, with null for indices
 * where insufficient history exists.
 */
export function movingAverage(points: DataPoint[], windowSize: number): (number | null)[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const result: (number | null)[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      sum += sorted[j].value;
    }
    result.push(sum / windowSize);
  }

  return result;
}

/**
 * Compute exponential moving average for smoother trend detection.
 * Alpha controls smoothing: higher = more responsive, lower = smoother.
 */
export function exponentialMovingAverage(points: DataPoint[], alpha: number = 0.3): number[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const ema: number[] = [sorted[0].value];

  for (let i = 1; i < sorted.length; i++) {
    ema.push(alpha * sorted[i].value + (1 - alpha) * ema[i - 1]);
  }

  return ema;
}

/**
 * Detect anomalies where a biomarker deviates more than `thresholdPct`
 * from its moving average. Uses a window of `windowSize` data points.
 *
 * @param points - Time-series data points
 * @param thresholdPct - Deviation threshold as a decimal (0.15 = 15%)
 * @param windowSize - Number of points for the moving average window
 * @returns Array of detected anomalies with severity classification
 */
export function detectAnomalies(
  points: DataPoint[],
  thresholdPct: number = 0.15,
  windowSize: number = 5,
): AnomalyResult[] {
  if (points.length < windowSize) return [];

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const ma = movingAverage(sorted, windowSize);
  const anomalies: AnomalyResult[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const avg = ma[i];
    if (avg === null || avg === 0) continue;

    const deviation = (sorted[i].value - avg) / Math.abs(avg);
    const absDev = Math.abs(deviation);

    if (absDev >= thresholdPct) {
      anomalies.push({
        index: i,
        value: sorted[i].value,
        timestamp: sorted[i].timestamp,
        movingAvg: avg,
        deviationPct: deviation * 100,
        direction: deviation > 0 ? 'above' : 'below',
        severity: absDev >= thresholdPct * 2 ? 'critical' : 'warning',
      });
    }
  }

  return anomalies;
}

/**
 * Compute percentage change between two values.
 */
export function percentageChange(from: number, to: number): number {
  if (from === 0) return to > 0 ? 100 : to < 0 ? -100 : 0;
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * Determine if a marker's direction is "lower is better" (e.g., CRP, HbA1c).
 */
export function isLowerBetter(marker: string): boolean {
  const lowerBetterMarkers = ['CRP', 'hs-CRP', 'HbA1c', 'ApoB', 'LDL', 'Triglycerides', 'Cortisol', 'Homocysteine', 'Fasting Glucose'];
  return lowerBetterMarkers.some(m => marker.toLowerCase().includes(m.toLowerCase()));
}

/**
 * Classify whether a deviation is "bad" for the user based on marker type.
 * For "lower is better" markers, going above average is bad.
 * For "higher is better" markers, going below average is bad.
 */
export function isNegativeDeviation(marker: string, direction: 'above' | 'below'): boolean {
  if (isLowerBetter(marker)) {
    return direction === 'above'; // Higher CRP = bad
  }
  return direction === 'below'; // Lower HRV = bad
}

/**
 * Format a deviation percentage for display.
 */
export function formatDeviation(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/* ── Vitals-based metabolic score (UI shape; no new clinical component math) ── */
export interface VitalsInput {
  age?: number | string | null;
  gender?: string | null;
  weight?: number | string | null;
  goalWeight?: number | string | null;
  unit?: string | null;
}

export interface MetabolicScoreResult {
  score: number;
  color: string;
  glowColor: string;
  grade: string;
  insight: string;
  components: {
    bmrEfficiency: number;
    bodyComposition: number;
    metabolicFlexibility: number;
    vitalityFactor: number;
  };
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function scoreColor(s: number): string {
  if (s >= 80) return '#7CB68E';
  if (s >= 60) return '#E8976C';
  if (s >= 40) return '#C4A46C';
  return '#D4847A';
}

/**
 * Returns rich UI result for personalize.tsx.
 * Component bars mirror the single existing aggregate score (no invented BMR/flex formulas).
 */
export function calculateMetabolicScoreFromVitals(v: VitalsInput | null | undefined): MetabolicScoreResult {
  let score = 50;
  if (v) {
    const age = toNum(v.age);
    const weight = toNum(v.weight);
    const goalWeight = toNum(v.goalWeight);
    if (age != null) {
      if (age < 30) score += 20;
      else if (age < 45) score += 12;
      else if (age < 60) score += 6;
    }
    if (weight != null && goalWeight != null && goalWeight > 0) {
      const delta = Math.abs(weight - goalWeight) / goalWeight;
      if (delta < 0.03) score += 25;
      else if (delta < 0.08) score += 15;
      else if (delta < 0.15) score += 7;
    }
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const color = scoreColor(score);
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
  const c = score;
  return {
    score,
    color,
    glowColor: color,
    grade,
    insight: 'Profile ready from the vitals you entered.',
    components: {
      bmrEfficiency: c,
      bodyComposition: c,
      metabolicFlexibility: c,
      vitalityFactor: c,
    },
  };
}

export interface ScoreRingProps {
  score: number;
  color: string;
  label: string;
  circumference: number;
  strokeDashoffset: number;
}

export function getScoreRingProps(score: number, radius: number = 54): ScoreRingProps {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  let color = '#D4847A';
  let label = 'BUILDING';
  if (s >= 80) { color = '#7CB68E'; label = 'OPTIMAL'; }
  else if (s >= 60) { color = '#E8976C'; label = 'STRONG'; }
  else if (s >= 40) { color = '#C4A46C'; label = 'DEVELOPING'; }
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - s / 100);
  return { score: s, color, label, circumference, strokeDashoffset };
}
