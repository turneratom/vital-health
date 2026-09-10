/* ═══════════════════════════════════════════════════════════════════
   LONGEVITY VELOCITY ENGINE
   
   Computes a single moving vector from three signal streams:
   1. Biological Age Delta — estimated bio-age vs chronological age
   2. Biomarker Trend Momentum — weighted slope of key markers over 30d
   3. Protocol Adherence Momentum — consistency × completeness score
   
   Output: A velocity vector with magnitude (-100 to +100), direction
   (forward/regressing/stalled), and UI mode (calm/alert/optimization).
   ═══════════════════════════════════════════════════════════════════ */

export interface BiomarkerSnapshot {
  key: string
  value: number
  previousValue?: number
  optimalLow: number
  optimalHigh: number
  lowerIsBetter: boolean
  weight: number
}

export interface AdherenceSnapshot {
  date: string
  completionPct: number // 0-100
  totalProtocols: number
  completedProtocols: number
}

export interface VelocityInput {
  chronologicalAge?: number
  estimatedBioAge?: number
  biomarkers: BiomarkerSnapshot[]
  adherenceHistory: AdherenceSnapshot[] // last 14-30 days
  sleepScores: number[]       // last 7 days, 0-100
  hrvReadings: number[]       // last 7 days, raw ms
  hrvBaseline?: number        // 30-day baseline
  recoveryScore?: number      // 0-100 from Somatic Mirror
}

export interface VelocityVector {
  magnitude: number           // -100 (rapid regression) to +100 (rapid forward)
  direction: 'forward' | 'stalled' | 'regressing'
  uiMode: 'calm' | 'alert' | 'optimization'
  
  // Component scores (each -1 to +1, normalized)
  bioAgeDelta: number         // negative = younger than chrono (good)
  biomarkerMomentum: number   // positive = improving
  adherenceMomentum: number   // positive = consistent
  recoverySignal: number      // positive = well-recovered
  
  // Human-readable
  label: string               // "Accelerating", "On Track", "Drifting", "Regressing"
  sublabel: string            // Contextual explanation
  velocityPerYear: number     // Estimated years gained/lost per year at current rate
  
  // Trend data for sparkline
  trend7d: number[]           // Last 7 daily velocity scores
  trendDirection: 'improving' | 'stable' | 'declining'
  
  // Alert triggers
  alerts: VelocityAlert[]
}

export interface VelocityAlert {
  type: 'biomarker_drift' | 'adherence_drop' | 'recovery_low' | 'sleep_deficit' | 'hrv_crash'
  severity: 'info' | 'warning' | 'critical'
  message: string
  actionLabel: string
}

/* ── Weights for composite score ── */
const W = {
  bioAge: 0.25,
  biomarkers: 0.30,
  adherence: 0.25,
  recovery: 0.20,
}

/* ── Biomarker optimal ranges (defaults) ── */
const DEFAULT_MARKERS: BiomarkerSnapshot[] = [
  { key: 'vitaminD', value: 0, optimalLow: 40, optimalHigh: 60, lowerIsBetter: false, weight: 0.12 },
  { key: 'crp', value: 0, optimalLow: 0, optimalHigh: 1.0, lowerIsBetter: true, weight: 0.18 },
  { key: 'hba1c', value: 0, optimalLow: 0, optimalHigh: 5.4, lowerIsBetter: true, weight: 0.18 },
  { key: 'apoB', value: 0, optimalLow: 0, optimalHigh: 80, lowerIsBetter: true, weight: 0.15 },
  { key: 'testosterone', value: 0, optimalLow: 500, optimalHigh: 900, lowerIsBetter: false, weight: 0.10 },
  { key: 'ferritin', value: 0, optimalLow: 40, optimalHigh: 150, lowerIsBetter: false, weight: 0.10 },
  { key: 'homocysteine', value: 0, optimalLow: 0, optimalHigh: 8, lowerIsBetter: true, weight: 0.08 },
  { key: 'triglycerides', value: 0, optimalLow: 0, optimalHigh: 100, lowerIsBetter: true, weight: 0.09 },
]

/**
 * Score a single biomarker on a -1 to +1 scale.
 * +1 = deep in optimal range, 0 = at boundary, -1 = far outside optimal.
 */
function scoreBiomarker(m: BiomarkerSnapshot): number {
  const range = m.optimalHigh - m.optimalLow
  if (range <= 0) return 0

  if (m.lowerIsBetter) {
    // For CRP, HbA1c etc: lower is better
    if (m.value <= m.optimalHigh) {
      // In optimal — score 0 to +1 based on how deep in range
      const depth = (m.optimalHigh - m.value) / m.optimalHigh
      return Math.min(1, depth)
    }
    // Above optimal — score 0 to -1
    const overshoot = (m.value - m.optimalHigh) / m.optimalHigh
    return Math.max(-1, -overshoot)
  } else {
    // For Vitamin D, Testosterone etc: higher is better (within range)
    if (m.value >= m.optimalLow && m.value <= m.optimalHigh) {
      // In optimal — score based on position within range
      const position = (m.value - m.optimalLow) / range
      return 0.3 + position * 0.7 // 0.3 to 1.0
    }
    if (m.value < m.optimalLow) {
      // Below optimal
      const deficit = (m.optimalLow - m.value) / m.optimalLow
      return Math.max(-1, -deficit)
    }
    // Above optimal (slightly penalize)
    const excess = (m.value - m.optimalHigh) / m.optimalHigh
    return Math.max(-0.5, 0.3 - excess * 0.5)
  }
}

/**
 * Compute biomarker momentum from current + previous values.
 * Returns -1 to +1 representing trend direction and strength.
 */
function computeBiomarkerMomentum(markers: BiomarkerSnapshot[]): number {
  const scored = markers.filter(m => m.value > 0)
  if (scored.length === 0) return 0

  let totalWeight = 0
  let weightedScore = 0

  for (const m of scored) {
    const currentScore = scoreBiomarker(m)
    let trendBonus = 0

    if (m.previousValue !== undefined && m.previousValue > 0) {
      const prev = { ...m, value: m.previousValue }
      const prevScore = scoreBiomarker(prev)
      trendBonus = (currentScore - prevScore) * 0.3 // Trend contributes 30%
    }

    weightedScore += (currentScore + trendBonus) * m.weight
    totalWeight += m.weight
  }

  return totalWeight > 0 ? clamp(weightedScore / totalWeight, -1, 1) : 0
}

/**
 * Compute adherence momentum from daily completion history.
 * Rewards consistency (streaks) and penalizes drops.
 */
function computeAdherenceMomentum(history: AdherenceSnapshot[]): number {
  if (history.length === 0) return 0

  // Sort by date descending (most recent first)
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))

  // Recent 7-day average
  const recent7 = sorted.slice(0, 7)
  const avg7 = recent7.reduce((s, d) => s + d.completionPct, 0) / recent7.length

  // Previous 7-day average (for trend)
  const prev7 = sorted.slice(7, 14)
  const avgPrev = prev7.length > 0
    ? prev7.reduce((s, d) => s + d.completionPct, 0) / prev7.length
    : avg7

  // Base score: 0-100 → -1 to +1
  const baseScore = (avg7 - 50) / 50

  // Trend bonus: improving adherence gets a boost
  const trendDelta = (avg7 - avgPrev) / 100
  const trendBonus = clamp(trendDelta * 0.5, -0.3, 0.3)

  // Streak bonus: consecutive days ≥80% completion
  let streak = 0
  for (const day of recent7) {
    if (day.completionPct >= 80) streak++
    else break
  }
  const streakBonus = Math.min(streak * 0.05, 0.2)

  return clamp(baseScore + trendBonus + streakBonus, -1, 1)
}

/**
 * Compute recovery signal from sleep + HRV data.
 */
function computeRecoverySignal(
  sleepScores: number[],
  hrvReadings: number[],
  hrvBaseline?: number,
  recoveryScore?: number,
): number {
  let signal = 0
  let components = 0

  // Sleep component (0-100 → -1 to +1)
  if (sleepScores.length > 0) {
    const avgSleep = sleepScores.reduce((s, v) => s + v, 0) / sleepScores.length
    signal += (avgSleep - 50) / 50
    components++
  }

  // HRV component (relative to baseline)
  if (hrvReadings.length > 0 && hrvBaseline && hrvBaseline > 0) {
    const avgHrv = hrvReadings.reduce((s, v) => s + v, 0) / hrvReadings.length
    const hrvRatio = avgHrv / hrvBaseline
    signal += clamp((hrvRatio - 0.85) / 0.3, -1, 1) // 0.85 baseline = -1, 1.15 = +1
    components++
  }

  // Direct recovery score if available
  if (recoveryScore !== undefined) {
    signal += (recoveryScore - 50) / 50
    components++
  }

  return components > 0 ? clamp(signal / components, -1, 1) : 0
}

/**
 * Compute biological age delta score.
 * Negative delta (younger than chrono) = positive score.
 */
function computeBioAgeDelta(chronoAge?: number, bioAge?: number): number {
  if (!chronoAge || !bioAge || chronoAge <= 0) return 0
  const delta = chronoAge - bioAge // positive = younger than chrono
  // Normalize: ±10 years maps to ±1
  return clamp(delta / 10, -1, 1)
}

/**
 * Generate velocity alerts based on component analysis.
 */
function generateAlerts(input: VelocityInput, components: {
  bioAgeDelta: number
  biomarkerMomentum: number
  adherenceMomentum: number
  recoverySignal: number
}): VelocityAlert[] {
  const alerts: VelocityAlert[] = []

  // HRV crash detection
  if (input.hrvReadings.length >= 3 && input.hrvBaseline) {
    const recent3 = input.hrvReadings.slice(-3)
    const avg3 = recent3.reduce((s, v) => s + v, 0) / recent3.length
    if (avg3 < input.hrvBaseline * 0.75) {
      alerts.push({
        type: 'hrv_crash',
        severity: avg3 < input.hrvBaseline * 0.6 ? 'critical' : 'warning',
        message: `HRV dropped ${Math.round((1 - avg3 / input.hrvBaseline) * 100)}% below baseline`,
        actionLabel: 'Recovery Protocol',
      })
    }
  }

  // Sleep deficit
  if (input.sleepScores.length >= 3) {
    const recent3 = input.sleepScores.slice(-3)
    const avg3 = recent3.reduce((s, v) => s + v, 0) / recent3.length
    if (avg3 < 55) {
      alerts.push({
        type: 'sleep_deficit',
        severity: avg3 < 40 ? 'critical' : 'warning',
        message: `Sleep quality averaging ${Math.round(avg3)}/100 — recovery compromised`,
        actionLabel: 'Sleep Optimization',
      })
    }
  }

  // Adherence drop
  if (components.adherenceMomentum < -0.3) {
    alerts.push({
      type: 'adherence_drop',
      severity: components.adherenceMomentum < -0.6 ? 'critical' : 'warning',
      message: 'Protocol adherence declining — longevity gains at risk',
      actionLabel: 'Review Stack',
    })
  }

  // Recovery low
  if (components.recoverySignal < -0.4) {
    alerts.push({
      type: 'recovery_low',
      severity: components.recoverySignal < -0.7 ? 'critical' : 'warning',
      message: 'Recovery signals below threshold — consider deload',
      actionLabel: 'Deload Protocol',
    })
  }

  // Biomarker drift
  if (components.biomarkerMomentum < -0.3) {
    alerts.push({
      type: 'biomarker_drift',
      severity: components.biomarkerMomentum < -0.6 ? 'critical' : 'warning',
      message: 'Key biomarkers trending outside optimal ranges',
      actionLabel: 'Review Biomarkers',
    })
  }

  return alerts.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 }
    return sev[a.severity] - sev[b.severity]
  })
}

/**
 * Determine human-readable label and sublabel for the velocity.
 */
function getVelocityLabel(magnitude: number, direction: string): { label: string; sublabel: string } {
  if (magnitude >= 60) return { label: 'Accelerating', sublabel: 'All systems optimized — biological age reversing' }
  if (magnitude >= 35) return { label: 'On Track', sublabel: 'Steady forward momentum — protocols working' }
  if (magnitude >= 15) return { label: 'Cruising', sublabel: 'Positive trajectory — minor optimizations available' }
  if (magnitude >= -10) return { label: 'Stalled', sublabel: 'Velocity near zero — review protocol adherence' }
  if (magnitude >= -30) return { label: 'Drifting', sublabel: 'Slight regression detected — intervention recommended' }
  if (magnitude >= -55) return { label: 'Regressing', sublabel: 'Multiple signals declining — optimization mode active' }
  return { label: 'Critical Drift', sublabel: 'Significant regression — immediate protocol adjustment needed' }
}

/**
 * Estimate years gained/lost per year at current velocity.
 * At +100 velocity, gaining ~2 years per year (aging at 0.5x).
 * At -100 velocity, losing ~1.5 years per year (aging at 2.5x).
 */
function estimateVelocityPerYear(magnitude: number): number {
  if (magnitude >= 0) {
    return +(magnitude / 50).toFixed(2) // 0 to +2 years gained/year
  }
  return +(magnitude / 66).toFixed(2) // 0 to -1.5 years lost/year
}

/**
 * Generate synthetic 7-day trend from available data.
 */
function generate7dTrend(
  adherenceHistory: AdherenceSnapshot[],
  sleepScores: number[],
  hrvReadings: number[],
  hrvBaseline?: number,
): number[] {
  const trend: number[] = []
  
  for (let i = 0; i < 7; i++) {
    let dayScore = 0
    let components = 0

    // Adherence for this day
    if (i < adherenceHistory.length) {
      dayScore += (adherenceHistory[i]?.completionPct ?? 50) / 100
      components++
    }

    // Sleep for this day
    if (i < sleepScores.length) {
      dayScore += (sleepScores[i] ?? 50) / 100
      components++
    }

    // HRV for this day
    if (i < hrvReadings.length && hrvBaseline && hrvBaseline > 0) {
      dayScore += Math.min(1, (hrvReadings[i] ?? hrvBaseline) / hrvBaseline)
      components++
    }

    if (components > 0) {
      // Normalize to -100 to +100 scale
      trend.push(Math.round(((dayScore / components) - 0.5) * 200))
    } else {
      trend.push(0)
    }
  }

  return trend
}

/* ── Utility ── */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT: computeLongevityVelocity
   ═══════════════════════════════════════════════════════════════════ */

export function computeLongevityVelocity(input: VelocityInput): VelocityVector {
  // 1. Compute component scores
  const bioAgeDelta = computeBioAgeDelta(input.chronologicalAge, input.estimatedBioAge)
  const biomarkerMomentum = computeBiomarkerMomentum(input.biomarkers)
  const adherenceMomentum = computeAdherenceMomentum(input.adherenceHistory)
  const recoverySignal = computeRecoverySignal(
    input.sleepScores,
    input.hrvReadings,
    input.hrvBaseline,
    input.recoveryScore,
  )

  // 2. Weighted composite magnitude (-100 to +100)
  const rawMagnitude = (
    bioAgeDelta * W.bioAge +
    biomarkerMomentum * W.biomarkers +
    adherenceMomentum * W.adherence +
    recoverySignal * W.recovery
  ) * 100

  const magnitude = Math.round(clamp(rawMagnitude, -100, 100))

  // 3. Direction classification
  let direction: 'forward' | 'stalled' | 'regressing'
  if (magnitude >= 10) direction = 'forward'
  else if (magnitude >= -15) direction = 'stalled'
  else direction = 'regressing'

  // 4. UI mode determination
  let uiMode: 'calm' | 'alert' | 'optimization'
  if (direction === 'forward' && magnitude >= 15) uiMode = 'calm'
  else if (direction === 'regressing' && magnitude <= -25) uiMode = 'optimization'
  else uiMode = 'alert'

  // 5. Generate alerts
  const alerts = generateAlerts(input, { bioAgeDelta, biomarkerMomentum, adherenceMomentum, recoverySignal })

  // Override to optimization mode if critical alerts exist
  if (alerts.some(a => a.severity === 'critical')) {
    uiMode = 'optimization'
  }

  // 6. Labels
  const { label, sublabel } = getVelocityLabel(magnitude, direction)

  // 7. Trend
  const trend7d = generate7dTrend(input.adherenceHistory, input.sleepScores, input.hrvReadings, input.hrvBaseline)
  const trendSlope = trend7d.length >= 2 ? trend7d[trend7d.length - 1] - trend7d[0] : 0
  const trendDirection: 'improving' | 'stable' | 'declining' =
    trendSlope > 10 ? 'improving' : trendSlope < -10 ? 'declining' : 'stable'

  // 8. Velocity per year
  const velocityPerYear = estimateVelocityPerYear(magnitude)

  return {
    magnitude,
    direction,
    uiMode,
    bioAgeDelta,
    biomarkerMomentum,
    adherenceMomentum,
    recoverySignal,
    label,
    sublabel,
    velocityPerYear,
    trend7d,
    trendDirection,
    alerts,
  }
}

/**
 * Build VelocityInput from raw Convex query data.
 * This adapter maps the existing bioVaultMetrics + correlationEngine data
 * into the format expected by computeLongevityVelocity.
 */
export function buildVelocityInputFromBioData(data: {
  vault?: any
  sleepHistory?: any[]
  hrvHistory?: any[]
  adherenceRecords?: any[]
  protocolLogs?: any[]
  labResults?: any[]
  chronologicalAge?: number
}): VelocityInput {
  const markers: BiomarkerSnapshot[] = []

  if (data.vault) {
    const v = data.vault
    if (v.vitaminD) markers.push({ key: 'vitaminD', value: v.vitaminD, optimalLow: 40, optimalHigh: 60, lowerIsBetter: false, weight: 0.12 })
    if (v.crp) markers.push({ key: 'crp', value: v.crp, optimalLow: 0, optimalHigh: 1.0, lowerIsBetter: true, weight: 0.18 })
    if (v.hba1c) markers.push({ key: 'hba1c', value: v.hba1c, optimalLow: 0, optimalHigh: 5.4, lowerIsBetter: true, weight: 0.18 })
    if (v.apoB) markers.push({ key: 'apoB', value: v.apoB, optimalLow: 0, optimalHigh: 80, lowerIsBetter: true, weight: 0.15 })
    if (v.testosteroneTotal) markers.push({ key: 'testosterone', value: v.testosteroneTotal, optimalLow: 500, optimalHigh: 900, lowerIsBetter: false, weight: 0.10 })
    if (v.ferritin) markers.push({ key: 'ferritin', value: v.ferritin, optimalLow: 40, optimalHigh: 150, lowerIsBetter: false, weight: 0.10 })
    if (v.homocysteine) markers.push({ key: 'homocysteine', value: v.homocysteine, optimalLow: 0, optimalHigh: 8, lowerIsBetter: true, weight: 0.08 })
    if (v.triglycerides) markers.push({ key: 'triglycerides', value: v.triglycerides, optimalLow: 0, optimalHigh: 100, lowerIsBetter: true, weight: 0.09 })
  }

  // Sleep scores from history
  const sleepScores = (data.sleepHistory || [])
    .slice(-7)
    .map((s: any) => s.score ?? s.sleepScore ?? 50)

  // HRV readings
  const hrvReadings = (data.hrvHistory || [])
    .slice(-7)
    .map((h: any) => h.value ?? 0)

  // Adherence history
  const adherenceHistory: AdherenceSnapshot[] = (data.adherenceRecords || [])
    .slice(-14)
    .map((a: any) => ({
      date: a.date ?? new Date(a.updatedAt ?? Date.now()).toISOString().slice(0, 10),
      completionPct: a.adherencePercent ?? a.completionPct ?? 50,
      totalProtocols: a.totalProtocols ?? 10,
      completedProtocols: a.completedProtocols ?? Math.round((a.adherencePercent ?? 50) / 10),
    }))

  // Estimate bio age from vault data if available
  let estimatedBioAge: number | undefined
  const chronoAge = data.chronologicalAge ?? 35
  if (data.vault) {
    // Simple bio-age estimation from available markers
    let ageModifier = 0
    let modCount = 0
    if (data.vault.crp) { ageModifier += data.vault.crp > 1 ? 2 : data.vault.crp > 0.5 ? 0 : -1; modCount++ }
    if (data.vault.hba1c) { ageModifier += data.vault.hba1c > 5.7 ? 3 : data.vault.hba1c > 5.2 ? 0 : -1; modCount++ }
    if (data.vault.vitaminD) { ageModifier += data.vault.vitaminD < 30 ? 2 : data.vault.vitaminD > 50 ? -1 : 0; modCount++ }
    if (data.vault.sleepScore) { ageModifier += data.vault.sleepScore < 60 ? 2 : data.vault.sleepScore > 80 ? -2 : 0; modCount++ }
    if (data.vault.hrvCurrent && data.vault.hrvBaseline) {
      const ratio = data.vault.hrvCurrent / data.vault.hrvBaseline
      ageModifier += ratio < 0.8 ? 2 : ratio > 1.1 ? -2 : 0
      modCount++
    }
    if (modCount > 0) {
      estimatedBioAge = chronoAge + Math.round(ageModifier / modCount * 2)
    }
  }

  return {
    chronologicalAge: chronoAge,
    estimatedBioAge,
    biomarkers: markers,
    adherenceHistory,
    sleepScores,
    hrvReadings,
    hrvBaseline: data.vault?.hrvBaseline,
    recoveryScore: data.vault?.sleepScore,
  }
}
