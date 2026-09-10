/* ═══════════════════════════════════════════════════════════════
   BIO-SYNC LOGIC — Real-Time Biomarker vs Weekly Average Engine
   
   Centralized comparison logic that powers the DailyProtocol's
   adaptive reshuffling. Compares current biomarker readings against
   rolling 7-day averages and determines protocol adjustments.
   ═══════════════════════════════════════════════════════════════ */

export interface TrendResult {
  direction: 'up' | 'down' | 'stable' | 'flat'
  delta: number
  percentage: number
  label: string
  color: string
  deltaPct: number
  deltaAbs: number
  isFavorable: boolean
}

export interface BiomarkerComparison {
  metric: string
  current: number
  average7d: number
  deltaPercent: number
  status: 'below' | 'at' | 'above'
  severity: 'critical' | 'warning' | 'normal' | 'optimal'
  icon: string
  unit: string
  recommendation: string
}

export interface ReadinessDecision {
  shouldReshuffle: boolean
  readinessScore: number
  readinessLevel: 'peak' | 'good' | 'moderate' | 'low' | 'critical'
  demoteHighIntensity: boolean
  promoteRecovery: boolean
  isUrgentRecovery: boolean
  comparisons: BiomarkerComparison[]
  swapSuggestions: SwapSuggestion[]
  adaptiveReason: string
}

export interface SwapSuggestion {
  originalName: string
  originalCategory: string
  replacementName: string
  replacementIcon: string
  replacementDescription: string
  replacementCategory: string
  reason: string
}

/* ── Thresholds ── */
const THRESHOLDS = {
  SLEEP_DROP_TRIGGER: 0.12,
  HRV_DROP_TRIGGER: 0.10,
  DEMOTE_INTENSITY: 65,
  URGENT_RECOVERY: 45,
} as const

/* ── Swap Replacement Map ── */
const INTENSITY_REPLACEMENTS: Array<{
  pattern: RegExp
  replacement: SwapSuggestion
}> = [
  {
    pattern: /resistance training|heavy lift|compound lift|deadlift|squat heavy|bench press/i,
    replacement: {
      originalName: '',
      originalCategory: 'training',
      replacementName: 'Active Recovery — Mobility Flow',
      replacementIcon: '🧘',
      replacementDescription: '20 min dynamic stretching + foam rolling — joint health focus',
      replacementCategory: 'recovery',
      reason: 'Biomarkers indicate insufficient recovery for heavy loading. Mobility preserves movement quality.',
    },
  },
  {
    pattern: /hiit|high intensity|sprint|crossfit|max effort|zone 5|zone 4/i,
    replacement: {
      originalName: '',
      originalCategory: 'training',
      replacementName: 'Zone 2 Recovery Cardio',
      replacementIcon: '🚶',
      replacementDescription: '30 min at conversational pace (120-140 BPM) — aerobic base',
      replacementCategory: 'training',
      reason: 'HRV/Sleep below baseline. Zone 2 maintains cardiovascular stimulus without cortisol spike.',
    },
  },
  {
    pattern: /pr attempt|1rm|test|max/i,
    replacement: {
      originalName: '',
      originalCategory: 'training',
      replacementName: 'Technique Work — 60% Load',
      replacementIcon: '🎯',
      replacementDescription: 'Practice movement patterns at reduced intensity',
      replacementCategory: 'training',
      reason: 'CNS not recovered for maximal output. Technique work at sub-max loads builds motor patterns safely.',
    },
  },
]

const DEFAULT_REPLACEMENT: Omit<SwapSuggestion, 'originalName' | 'originalCategory'> = {
  replacementName: 'Active Recovery Walk',
  replacementIcon: '🚶',
  replacementDescription: '30 min brisk walk outdoors — low-impact movement',
  replacementCategory: 'movement',
  reason: 'Biomarkers below baseline. Walking maintains movement streak without taxing recovery systems.',
}

const TREND_NEUTRAL = '#C4A46C'
const TREND_FAVORABLE = '#7CB68E'
const TREND_UNFAVORABLE = '#D4847A'

function buildTrendResult(
  direction: TrendResult['direction'],
  delta: number,
  percentage: number,
  label: string,
  higherIsBetter: boolean,
): TrendResult {
  const isFlat = direction === 'stable' || direction === 'flat'
  const isFavorable = isFlat
    ? true
    : higherIsBetter
      ? direction === 'up'
      : direction === 'down'
  const color = isFlat ? TREND_NEUTRAL : isFavorable ? TREND_FAVORABLE : TREND_UNFAVORABLE
  return {
    direction,
    delta,
    percentage,
    label,
    color,
    deltaPct: percentage,
    deltaAbs: delta,
    isFavorable,
  }
}

/** Calculate trend from an array of numeric values (oldest → newest) */
export function calculateTrend(values: number[]): TrendResult
/** Legacy UI call shape: current value + history + higher-is-better flag */
export function calculateTrend(current: number, history: number[], higherIsBetter?: boolean): TrendResult
export function calculateTrend(
  a: number | number[],
  b?: number[],
  higherIsBetter: boolean = true,
): TrendResult {
  const values = Array.isArray(a) ? a : [...(b ?? []), a]
  if (!values || values.length < 2) {
    return buildTrendResult('flat', 0, 0, 'Stable', higherIsBetter)
  }

  const recent = values.slice(-3)
  const older = values.slice(0, Math.max(1, values.length - 3))

  const recentAvg = recent.reduce((sum, n) => sum + n, 0) / recent.length
  const olderAvg = older.reduce((sum, n) => sum + n, 0) / older.length

  const delta = recentAvg - olderAvg
  const percentage = olderAvg !== 0 ? Math.round((delta / olderAvg) * 100) : 0
  const roundedDelta = Math.round(delta * 10) / 10

  if (Math.abs(percentage) < 3) {
    return buildTrendResult('flat', roundedDelta, percentage, 'Stable', higherIsBetter)
  }

  const direction: TrendResult['direction'] = delta > 0 ? 'up' : 'down'
  const label = delta > 0 ? 'Improving' : 'Declining'
  return buildTrendResult(direction, roundedDelta, percentage, label, higherIsBetter)
}

/** Compare a single biomarker against its 7-day average */
export function compareBiomarker(
  metric: string,
  current: number,
  average7d: number,
  unit: string,
  icon: string,
  dropThreshold: number = 0.10,
): BiomarkerComparison {
  const deltaPercent = average7d > 0 ? Math.round(((current - average7d) / average7d) * 100) : 0
  const dropRatio = average7d > 0 ? (current - average7d) / average7d : 0

  let status: 'below' | 'at' | 'above' = 'at'
  if (dropRatio < -dropThreshold) status = 'below'
  else if (dropRatio > 0.05) status = 'above'

  let severity: 'critical' | 'warning' | 'normal' | 'optimal' = 'normal'
  if (dropRatio < -0.20) severity = 'critical'
  else if (dropRatio < -dropThreshold) severity = 'warning'
  else if (dropRatio > 0.05) severity = 'optimal'

  let recommendation = 'Within normal range.'
  if (severity === 'critical') {
    recommendation = `${metric} critically low. Prioritize recovery protocols immediately.`
  } else if (severity === 'warning') {
    recommendation = `${metric} below baseline. Consider reducing training intensity.`
  } else if (severity === 'optimal') {
    recommendation = `${metric} above average. Full intensity cleared.`
  }

  return { metric, current, average7d, deltaPercent, status, severity, icon, unit, recommendation }
}

/** Generate swap suggestions for demoted high-intensity items */
export function getSwapSuggestion(protocolName: string, category: string): SwapSuggestion {
  for (const entry of INTENSITY_REPLACEMENTS) {
    if (entry.pattern.test(protocolName)) {
      return {
        ...entry.replacement,
        originalName: protocolName,
        originalCategory: category,
      }
    }
  }

  return {
    originalName: protocolName,
    originalCategory: category,
    ...DEFAULT_REPLACEMENT,
  }
}

/** Full readiness decision from sleep + HRV data */
export function computeReadinessDecision(
  sleepScore: number,
  sleepAvg7d: number,
  hrvCurrent: number,
  hrvAvg7d: number,
  sleepHours: number,
  demotedProtocolNames: Array<{ name: string; category: string }>,
): ReadinessDecision {
  const sleepDelta = sleepAvg7d > 0 ? (sleepScore - sleepAvg7d) / sleepAvg7d : 0
  const hrvDelta = hrvAvg7d > 0 ? (hrvCurrent - hrvAvg7d) / hrvAvg7d : 0

  const sleepBelowAvg = sleepDelta < -THRESHOLDS.SLEEP_DROP_TRIGGER
  const hrvBelowAvg = hrvDelta < -THRESHOLDS.HRV_DROP_TRIGGER

  // Compute readiness score
  const sleepNorm = Math.min(100, Math.max(0, sleepScore))
  const hrvNorm = hrvCurrent > 0 ? Math.min(100, Math.max(0, (hrvCurrent / 80) * 100)) : 50
  const hoursNorm = Math.min(100, Math.max(0, (sleepHours / 8) * 100))
  const readinessScore = Math.round(sleepNorm * 0.50 + hrvNorm * 0.35 + hoursNorm * 0.15)

  const shouldReshuffle = sleepBelowAvg || hrvBelowAvg || readinessScore < THRESHOLDS.DEMOTE_INTENSITY
  const isUrgentRecovery = readinessScore < THRESHOLDS.URGENT_RECOVERY

  let readinessLevel: ReadinessDecision['readinessLevel'] = 'good'
  if (readinessScore >= 85) readinessLevel = 'peak'
  else if (readinessScore >= 70) readinessLevel = 'good'
  else if (readinessScore >= 55) readinessLevel = 'moderate'
  else if (readinessScore >= 40) readinessLevel = 'low'
  else readinessLevel = 'critical'

  // Build comparisons
  const comparisons: BiomarkerComparison[] = [
    compareBiomarker('Sleep Quality', sleepScore, sleepAvg7d, '/100', '🌙', THRESHOLDS.SLEEP_DROP_TRIGGER),
  ]
  if (hrvCurrent > 0) {
    comparisons.push(
      compareBiomarker('HRV', hrvCurrent, hrvAvg7d, 'ms', '💓', THRESHOLDS.HRV_DROP_TRIGGER),
    )
  }

  // Generate swap suggestions for demoted items
  const swapSuggestions = shouldReshuffle
    ? demotedProtocolNames.map(p => getSwapSuggestion(p.name, p.category))
    : []

  // Build adaptive reason
  let adaptiveReason = ''
  if (shouldReshuffle) {
    const triggers: string[] = []
    if (sleepBelowAvg) triggers.push(`Sleep ${Math.round(sleepScore)}/100 (${Math.abs(Math.round(sleepDelta * 100))}% below avg)`)
    if (hrvBelowAvg) triggers.push(`HRV ${Math.round(hrvCurrent)}ms (${Math.abs(Math.round(hrvDelta * 100))}% below baseline)`)
    if (readinessScore < THRESHOLDS.DEMOTE_INTENSITY && !sleepBelowAvg && !hrvBelowAvg) {
      triggers.push(`Readiness ${readinessScore}/100 (below threshold)`)
    }
    adaptiveReason = `Bio-Sync detected: ${triggers.join(' · ')}. Protocol auto-adjusted.`
  }

  return {
    shouldReshuffle,
    readinessScore,
    readinessLevel,
    demoteHighIntensity: shouldReshuffle,
    promoteRecovery: shouldReshuffle,
    isUrgentRecovery,
    comparisons,
    swapSuggestions,
    adaptiveReason,
  }
}

/** Score a single biomarker value against optimal/suboptimal ranges */
function scoreMarker(value: number, optimalMin: number, optimalMax: number): number {
  if (value >= optimalMin && value <= optimalMax) return 100
  const mid = (optimalMin + optimalMax) / 2
  const range = (optimalMax - optimalMin) / 2
  const dist = Math.abs(value - mid)
  return Math.max(0, Math.round(100 - (dist / range) * 30))
}

/** Calculate a composite lab score from available biomarkers */
export function calculateLabComposite(markers: {
  vitaminD?: number
  ferritin?: number
  crp?: number
  hba1c?: number
  testosteroneTotal?: number
  igf1?: number
  fastingGlucose?: number
}): { score: number; grade: string; breakdown: Array<{ name: string; score: number }> } {
  const breakdown: Array<{ name: string; score: number }> = []

  if (markers.vitaminD != null) breakdown.push({ name: 'Vitamin D', score: scoreMarker(markers.vitaminD, 40, 80) })
  if (markers.ferritin != null) breakdown.push({ name: 'Ferritin', score: scoreMarker(markers.ferritin, 40, 200) })
  if (markers.crp != null) breakdown.push({ name: 'CRP', score: scoreMarker(markers.crp, 0, 1) })
  if (markers.hba1c != null) breakdown.push({ name: 'HbA1c', score: scoreMarker(markers.hba1c, 4.0, 5.4) })
  if (markers.testosteroneTotal != null) breakdown.push({ name: 'Testosterone', score: scoreMarker(markers.testosteroneTotal, 400, 900) })
  if (markers.igf1 != null) breakdown.push({ name: 'IGF-1', score: scoreMarker(markers.igf1, 100, 250) })
  if (markers.fastingGlucose != null) breakdown.push({ name: 'Fasting Glucose', score: scoreMarker(markers.fastingGlucose, 70, 100) })

  if (breakdown.length === 0) {
    return { score: 0, grade: 'N/A', breakdown: [] }
  }

  const score = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length)
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D'

  return { score, grade, breakdown }
}

/* ── Compatibility shims (export surface expected by UI; no invented clinical math) ── */
/* Missing from Shipper export; recovered as UI-safe stubs only. */

export interface MetricStatusResult {
  level: 'optimal' | 'good' | 'warning' | 'critical'
  label: string
  color: string
  glowColor: string
  shouldPulse: boolean
  shouldGlow: boolean
}

/** Neutral status shell — no metric thresholds invented. */
export function getMetricStatusEnhanced(_metric: string, _value: number): MetricStatusResult {
  return {
    level: 'good',
    label: 'OK',
    color: '#6BA3BE',
    glowColor: 'rgba(107,163,190,0.3)',
    shouldPulse: false,
    shouldGlow: false,
  }
}

/** Passthrough for ms values; no invented HRV scoring. */
export function normalizeHrvScore(v: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, v)
}

/**
 * Sleep display helper. Values already in score range (>24) pass through.
 * Hour inputs return 0 — do not invent hours→score clinical conversion.
 */
export function normalizeSleepScore(v: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  if (v > 24) return Math.min(100, Math.max(0, v))
  return 0
}

export interface BioAgeResult {
  chronologicalAge: number
  biologicalAge: number
  offset: number
  absOffset: number
  direction: 'younger' | 'older' | 'aligned'
  color: string
  glowColor: string
  label: string
  confidence: 'insufficient' | 'low' | 'moderate' | 'high' | string
  markersTotal: number
  markersUsed: number
}

export interface BioAgeOffsetInput {
  chronologicalAge: number
  biomarkers?: Record<string, number | null | undefined>
  lifestyle?: Record<string, number | null | undefined>
}

/**
 * UI-safe stub: chrono == bio, confidence insufficient.
 * Hides Elite performance badge; no biological-age algorithm invented.
 */
export function calculateBiologicalAgeOffset(input: BioAgeOffsetInput): BioAgeResult {
  const chrono = typeof input?.chronologicalAge === 'number' && Number.isFinite(input.chronologicalAge)
    ? input.chronologicalAge
    : 0
  return {
    chronologicalAge: chrono,
    biologicalAge: chrono,
    offset: 0,
    absOffset: 0,
    direction: 'aligned',
    color: '#C4A46C',
    glowColor: 'rgba(196,164,108,0.3)',
    label: '±0.0 yrs',
    confidence: 'insufficient',
    markersTotal: 0,
    markersUsed: 0,
  }
}
