import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getTwinSessionId } from '@/lib/twinSession'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AnimatePresence, motion } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   MORNING BRIEF — High-end medical briefing modal
   
   Triggers on first login of the day. Shows:
   1. Top 3 critical Daily Script items (with check-off)
   2. Current rank in Elite Cohort leaderboard
   3. One Priority Marker with trend insight
   
   Monochromatic layout — warm earth tones on deep black.
   Mobile-first: full-height sheet on small screens, centered
   card on desktop. Uses -webkit-overflow-scrolling for Safari.
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ── */
interface MorningBriefProps {
  isOpen: boolean
  onClose: () => void
}

/* ── Micro Sparkline ── */
function MiniSparkline({ data, color, width = 64, height = 20 }: {
  data: number[]
  color: string
  width?: number
  height?: number
}) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      {data.length > 0 && (() => {
        const lastX = width
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2
        return <circle cx={lastX} cy={lastY} r="2" fill={color} />
      })()}
    </svg>
  )
}

/* ── Priority Marker Logic ── */
interface PriorityMarker {
  name: string
  value: number | null
  unit: string
  trend: number
  trendLabel: string
  trendDirection: 'up' | 'down' | 'flat'
  isFavorable: boolean
  color: string
  protocol: string
  sparkData: number[]
}

const DEFAULT_MARKER: PriorityMarker = {
  name: 'HRV',
  value: 72,
  unit: 'ms',
  trend: 4.2,
  trendLabel: '+4.2%',
  trendDirection: 'up',
  isFavorable: true,
  color: '#7CB68E',
  protocol: 'Box Breathing 4-4-4-4 + Magnesium Glycinate 400mg PM',
  sparkData: [62, 65, 68, 70, 72],
}

function safeDelta(val: number, history: number[]): number {
  if (!history || history.length <= 1) return 0
  const prev = history.slice(0, -1)
  const sum = prev.reduce((s, v) => s + v, 0)
  const avg = prev.length > 0 ? sum / prev.length : 0
  if (avg === 0) return 0
  return ((val - avg) / avg) * 100
}

function derivePriorityMarker(
  dashData: any,
  bioVault: any,
): PriorityMarker {
  const markers: PriorityMarker[] = []

  if (bioVault?.testosteroneTotal) {
    const val = bioVault.testosteroneTotal
    const history = bioVault.testosteroneHistory || [val * 0.92, val * 0.95, val * 0.97, val]
    const delta = safeDelta(val, history)
    markers.push({
      name: 'Total Testosterone',
      value: val,
      unit: 'ng/dL',
      trend: delta,
      trendLabel: delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`,
      trendDirection: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
      isFavorable: delta >= 0,
      color: '#7CB68E',
      protocol: 'Zinc Picolinate 30mg + D3 5000 IU + Strength Training',
      sparkData: history,
    })
  }

  if (bioVault?.vitaminD) {
    const val = bioVault.vitaminD
    const history = bioVault.vitaminDHistory || [val * 0.88, val * 0.93, val * 0.96, val]
    const delta = safeDelta(val, history)
    markers.push({
      name: 'Vitamin D3',
      value: val,
      unit: 'ng/mL',
      trend: delta,
      trendLabel: delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`,
      trendDirection: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
      isFavorable: delta >= 0,
      color: '#C4A46C',
      protocol: '7am Sunlight Protocol + D3 5000 IU / K2 MK-7',
      sparkData: history,
    })
  }

  if (bioVault?.crp) {
    const val = bioVault.crp
    const history = bioVault.crpHistory || [val * 1.15, val * 1.08, val * 1.03, val]
    const delta = safeDelta(val, history)
    markers.push({
      name: 'hs-CRP',
      value: val,
      unit: 'mg/L',
      trend: delta,
      trendLabel: delta < 0 ? `${delta.toFixed(1)}%` : `+${delta.toFixed(1)}%`,
      trendDirection: delta < -1 ? 'down' : delta > 1 ? 'up' : 'flat',
      isFavorable: delta <= 0,
      color: delta <= 0 ? '#7CB68E' : '#D4847A',
      protocol: 'Omega-3 3g EPA/DHA + Curcumin 500mg + Cold Exposure',
      sparkData: history,
    })
  }

  if (dashData?.currentHrv && dashData.currentHrv > 0) {
    const val = dashData.currentHrv
    const history = dashData.hrvHistory7d?.length > 1 ? dashData.hrvHistory7d : [val * 0.9, val * 0.93, val * 0.97, val]
    const delta = safeDelta(val, history)
    markers.push({
      name: 'HRV',
      value: Math.round(val),
      unit: 'ms',
      trend: delta,
      trendLabel: delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`,
      trendDirection: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
      isFavorable: delta >= 0,
      color: '#6BA3BE',
      protocol: 'Box Breathing 4-4-4-4 + Magnesium Glycinate 400mg PM',
      sparkData: history,
    })
  }

  if (markers.length === 0) {
    return DEFAULT_MARKER
  }

  const favorable = markers.filter(m => m.isFavorable)
  if (favorable.length > 0) {
    return favorable.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))[0]
  }
  return markers.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))[0]
}

/* ── Script Item Priorities ── */
interface ScriptItem {
  name: string
  time: string
  icon: string
  category: string
  priority: 'critical' | 'high' | 'standard'
  reason: string
}

const FALLBACK_SCRIPT_ITEMS: ScriptItem[] = [
  {
    name: '7am Sunlight Exposure',
    time: '7:00 AM',
    icon: '\u2600\uFE0F',
    category: 'circadian',
    priority: 'critical',
    reason: 'Cortisol curve reset \u2014 affects 3 biomarkers',
  },
  {
    name: 'Zinc Picolinate 30mg',
    time: '8:00 AM',
    icon: '\uD83D\uDC8A',
    category: 'supplement',
    priority: 'high',
    reason: 'Testosterone synthesis support',
  },
  {
    name: 'Zone 2 Cardio 30min',
    time: '6:30 PM',
    icon: '\uD83C\uDFC3',
    category: 'movement',
    priority: 'high',
    reason: 'Mitochondrial density + hs-CRP reduction',
  },
]

function deriveTopScriptItems(protocolStatus: any): ScriptItem[] {
  if (!protocolStatus?.items || !Array.isArray(protocolStatus.items) || protocolStatus.items.length === 0) {
    return FALLBACK_SCRIPT_ITEMS
  }

  const timeOrder: Record<string, number> = {
    morning: 0, am: 0, afternoon: 1, pm: 1, evening: 2, night: 3,
  }

  const priorityMap: Record<string, 'critical' | 'high' | 'standard'> = {
    circadian: 'critical',
    sleep: 'critical',
    supplement: 'high',
    movement: 'high',
    recovery: 'high',
    nutrition: 'standard',
    mindfulness: 'standard',
  }

  const reasonMap: Record<string, string> = {
    circadian: 'Cortisol curve reset \u2014 affects 3 biomarkers',
    sleep: 'Recovery optimization \u2014 HRV + testosterone synthesis',
    supplement: 'Micronutrient protocol \u2014 targets active deficiencies',
    movement: 'Mitochondrial density + inflammatory marker reduction',
    recovery: 'Parasympathetic activation \u2014 HRV improvement',
    nutrition: 'Metabolic fuel timing \u2014 HbA1c optimization',
    mindfulness: 'Cortisol modulation \u2014 systemic inflammation control',
  }

  const scored = protocolStatus.items
    .filter((item: any) => item && !item.completed)
    .map((item: any) => ({
      name: item.name || 'Protocol Item',
      time: item.timeOfDay || 'Morning',
      icon: item.icon || '\u26A1',
      category: item.category || 'supplement',
      priority: priorityMap[item.category] || 'standard',
      reason: reasonMap[item.category] || 'Protocol adherence \u2014 Elite Score contribution',
      sortKey: timeOrder[item.timeOfDay?.toLowerCase()] ?? 0,
    }))
    .sort((a: any, b: any) => {
      const pOrder = { critical: 0, high: 1, standard: 2 }
      const pDiff = (pOrder[a.priority as keyof typeof pOrder] ?? 2) - (pOrder[b.priority as keyof typeof pOrder] ?? 2)
      if (pDiff !== 0) return pDiff
      return a.sortKey - b.sortKey
    })

  return scored.length > 0 ? scored.slice(0, 3) : FALLBACK_SCRIPT_ITEMS
}

/* ── Cohort Rank Logic ── */
interface CohortRank {
  rank: number
  total: number
  tier: string
  tierColor: string
  adherence: number
  label: string
}

const DEFAULT_COHORT_RANK: CohortRank = {
  rank: 1,
  total: 1,
  tier: 'Apex',
  tierColor: '#E8976C',
  adherence: 88,
  label: '#1 of 1',
}

function deriveCohortRank(leaderboard: any[], sessionId: string): CohortRank & { isBenchmarkOnly: boolean } {
  if (!leaderboard || !Array.isArray(leaderboard) || leaderboard.length === 0) {
    return { ...DEFAULT_COHORT_RANK, isBenchmarkOnly: true }
  }

  const allBenchmark = leaderboard.every(e => e?.isBenchmark === true)
  const realEntries = leaderboard.filter(e => !e?.isBenchmark)

  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
  }
  const opId = (Math.abs(hash) % 900) + 100

  const myEntry = leaderboard.find(e => e?.anonLabel === `Operator #${opId}`)
  const rank = myEntry?.rank || Math.min(leaderboard.length, 3)
  const adherence = myEntry?.avgAdherence ?? 88
  const tier = adherence >= 90 ? 'Apex' : adherence >= 70 ? 'Titan' : 'Vanguard'
  const tierColor = adherence >= 90 ? '#E8976C' : adherence >= 70 ? '#C4A46C' : '#6BA3BE'

  return {
    rank: allBenchmark ? 0 : rank,
    total: allBenchmark ? leaderboard.length : leaderboard.length,
    tier,
    tierColor,
    adherence: allBenchmark ? 0 : adherence,
    label: allBenchmark ? 'vs Benchmarks' : `#${rank} of ${realEntries.length > 0 ? realEntries.length : leaderboard.length}`,
    isBenchmarkOnly: allBenchmark,
  }
}

/* ── Smart Insight Engine ── */
interface SmartInsight {
  icon: string
  message: string
  color: string
  tag: string
}

function deriveSmartInsight(
  dashData: any,
  bioVault: any,
  protocolStatus: any,
): SmartInsight {
  const insights: (SmartInsight & { weight: number })[] = []

  // HRV analysis — low HRV is a strong recovery signal
  if (dashData?.currentHrv && dashData.currentHrv > 0) {
    const hrv = dashData.currentHrv
    if (hrv < 35) {
      insights.push({
        icon: '\uD83E\uDEC0',
        message: 'HRV critically low \u2014 prioritize zone 2 recovery today, skip high-intensity work.',
        color: '#D4847A',
        tag: 'RECOVERY',
        weight: 100,
      })
    } else if (hrv < 50) {
      insights.push({
        icon: '\uD83E\uDEC0',
        message: 'HRV below baseline \u2014 swap strength for a 30-min walk and add 10 min box breathing.',
        color: '#C4A46C',
        tag: 'RECOVERY',
        weight: 85,
      })
    } else if (hrv >= 80) {
      insights.push({
        icon: '\u26A1',
        message: 'HRV elevated \u2014 your nervous system is primed. Push intensity today if schedule allows.',
        color: '#7CB68E',
        tag: 'PERFORMANCE',
        weight: 60,
      })
    }
  }

  // Sleep analysis from dashboard data
  if (dashData?.sleepScore != null) {
    const sleep = dashData.sleepScore
    if (sleep < 50) {
      insights.push({
        icon: '\uD83D\uDE34',
        message: 'Sleep score critically low \u2014 hydration focus: +1L before noon, no caffeine after 12pm.',
        color: '#D4847A',
        tag: 'SLEEP DEBT',
        weight: 95,
      })
    } else if (sleep < 70) {
      insights.push({
        icon: '\uD83C\uDF19',
        message: 'Sleep below threshold \u2014 take 200mg L-theanine at 8pm and dim screens by 9pm tonight.',
        color: '#C4A46C',
        tag: 'SLEEP',
        weight: 80,
      })
    }
  }

  // CRP — inflammation marker
  if (bioVault?.crp != null) {
    const crp = bioVault.crp
    if (crp >= 3.0) {
      insights.push({
        icon: '\uD83D\uDD25',
        message: 'hs-CRP elevated \u2014 add 3g EPA/DHA omega-3 and 15 min cold exposure to blunt inflammation.',
        color: '#D4847A',
        tag: 'INFLAMMATION',
        weight: 90,
      })
    } else if (crp >= 1.0) {
      insights.push({
        icon: '\uD83E\uDDCA',
        message: 'Mild inflammation detected \u2014 consider curcumin 500mg with black pepper and an evening walk.',
        color: '#C4A46C',
        tag: 'INFLAMMATION',
        weight: 65,
      })
    }
  }

  // Vitamin D
  if (bioVault?.vitaminD != null) {
    const vd = bioVault.vitaminD
    if (vd < 30) {
      insights.push({
        icon: '\u2600\uFE0F',
        message: 'Vitamin D deficient \u2014 get 15 min morning sunlight and supplement D3 5000 IU + K2 MK-7.',
        color: '#D4847A',
        tag: 'DEFICIENCY',
        weight: 88,
      })
    } else if (vd < 40) {
      insights.push({
        icon: '\u2600\uFE0F',
        message: 'Vitamin D suboptimal \u2014 maintain 7am sunlight protocol and consider increasing D3 to 5000 IU.',
        color: '#C4A46C',
        tag: 'OPTIMIZATION',
        weight: 55,
      })
    }
  }

  // Testosterone
  if (bioVault?.testosteroneTotal != null) {
    const t = bioVault.testosteroneTotal
    if (t < 400) {
      insights.push({
        icon: '\uD83D\uDCAA',
        message: 'Testosterone low \u2014 prioritize compound lifts, zinc 30mg, and 7+ hours sleep tonight.',
        color: '#D4847A',
        tag: 'HORMONAL',
        weight: 82,
      })
    }
  }

  // Protocol adherence
  if (protocolStatus && typeof protocolStatus.done === 'number' && typeof protocolStatus.total === 'number') {
    const pct = protocolStatus.total > 0 ? (protocolStatus.done / protocolStatus.total) * 100 : 0
    if (protocolStatus.total > 0 && pct < 30) {
      insights.push({
        icon: '\uD83D\uDCCB',
        message: 'Protocol adherence is lagging \u2014 focus on completing your top 3 critical items first.',
        color: '#C4A46C',
        tag: 'DISCIPLINE',
        weight: 70,
      })
    }
  }

  // Recovery from dashboard
  if (dashData?.recoveryScore != null && dashData.recoveryScore < 50) {
    insights.push({
      icon: '\uD83E\uDDD8',
      message: 'Recovery score low \u2014 add 10 min parasympathetic breathing and consider magnesium glycinate 400mg PM.',
      color: '#C4A46C',
      tag: 'RECOVERY',
      weight: 75,
    })
  }

  // Sort by weight (highest priority first) and return top insight
  if (insights.length > 0) {
    insights.sort((a, b) => b.weight - a.weight)
    return insights[0]
  }

  // Default positive insight when everything looks good
  return {
    icon: '\u2705',
    message: 'All markers within range \u2014 maintain current protocols and stay consistent today.',
    color: '#7CB68E',
    tag: 'ON TRACK',
  }
}

/* ── Smart Insight Card ── */
function SmartInsightCard({ insight }: { insight: SmartInsight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="mb-insight-card"
      style={{
        background: `linear-gradient(135deg, ${insight.color}08, ${insight.color}03)`,
        border: `1px solid ${insight.color}18`,
      }}
    >
      <div className="mb-insight-header">
        <span className="mb-insight-icon">{insight.icon}</span>
        <span className="mb-insight-tag" style={{ color: insight.color, background: `${insight.color}15` }}>
          {insight.tag}
        </span>
      </div>
      <div className="mb-insight-message">
        {insight.message}
      </div>
      <div className="mb-insight-source">
        \u2699 Derived from current biometric state
      </div>
    </motion.div>
  )
}

/* ── Script Item Key Generator ── */
function scriptItemKey(item: ScriptItem): string {
  return `script:${item.name.toLowerCase().replace(/\s+/g, '-')}`
}

/* ── Checkable Script Item ── */
function CheckableScriptItem({ item, index, isCompleted, onToggle, priorityColor, priorityLabel }: {
  item: ScriptItem
  index: number
  isCompleted: boolean
  onToggle: () => void
  priorityColor: string
  priorityLabel: string
}) {
  const [justToggled, setJustToggled] = useState(false)

  const handleClick = useCallback(() => {
    setJustToggled(true)
    onToggle()
    setTimeout(() => setJustToggled(false), 800)
  }, [onToggle])

  return (
    <motion.div
      key={`${item.name}-${index}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
      className={`mb-script-item mb-script-item--checkable ${isCompleted ? 'mb-script-item--completed' : ''} ${justToggled && isCompleted ? 'mb-script-item--glow' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
    >
      {/* Priority accent bar */}
      <div style={{
        position: 'absolute', top: 10, left: 0,
        width: 2, height: 20,
        background: isCompleted ? '#7CB68E' : priorityColor,
        borderRadius: 2, opacity: 0.7,
        transition: 'background 0.4s ease',
      }} />

      {/* Check circle */}
      <div className={`mb-script-check ${isCompleted ? 'mb-script-check--done' : ''}`}>
        <motion.div
          initial={false}
          animate={{
            scale: isCompleted ? 1 : 0,
            opacity: isCompleted ? 1 : 0,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="mb-script-check-inner"
        >
          \u2713
        </motion.div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 2, gap: 6,
        }}>
          <div className={`mb-script-name ${isCompleted ? 'mb-script-name--struck' : ''}`}>
            {item.name}
            {/* Strike-through line overlay for smooth animation */}
            <span className={`mb-script-strike ${isCompleted ? 'mb-script-strike--active' : ''}`} />
          </div>
          <span className="mb-script-priority" style={{
            color: isCompleted ? '#7CB68E' : priorityColor,
            transition: 'color 0.4s ease',
          }}>
            {isCompleted ? 'DONE' : priorityLabel}
          </span>
        </div>
        <div className={`mb-script-reason ${isCompleted ? 'mb-script-reason--faded' : ''}`}>
          {item.reason}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Loading Skeleton ── */
function BriefSkeleton() {
  return (
    <div className="mb-section-pad">
      <div className="mb-section-label" style={{ marginBottom: 12 }}>
        Compiling briefing...
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 48,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 10,
          marginBottom: 8,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  )
}

/* ── Welcome Fallback (no data yet) ── */
function WelcomeFallback({ currentDate, currentTime, onClose }: {
  currentDate: string
  currentTime: string
  onClose: () => void
}) {
  return (
    <>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        position: 'relative',
        flexShrink: 0,
      }} className="mb-header-pad">
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.4), transparent)',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mb-section-label" style={{ marginBottom: 6 }}>
              Morning Brief
            </div>
            <div className="mb-date-text">
              {currentDate}
            </div>
            <div className="mb-time-text" style={{ marginTop: 4 }}>
              {currentTime}
            </div>
          </div>
          <button onClick={onClose} className="mb-close-btn">
            \u2715
          </button>
        </div>
      </div>

      {/* Welcome content */}
      <div className="mb-section-pad" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>\u2600\uFE0F</div>
        <div style={{
          fontWeight: 700, color: 'rgba(255,255,255,0.9)',
          marginBottom: 8,
        }} className="mb-welcome-title">
          Starting Your Day
        </div>
        <div className="mb-welcome-desc">
          Your briefing data is being compiled. Complete your first day of protocols to unlock personalized insights and cohort ranking.
        </div>

        {/* Fallback script items */}
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          <div className="mb-section-label" style={{ marginBottom: 12 }}>
            \u25B7 Recommended Start
          </div>
          {FALLBACK_SCRIPT_ITEMS.map((item, i) => (
            <div key={i} className="mb-script-item">
              <span className="mb-script-icon">{item.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mb-script-name">
                  {item.name}
                </div>
                <div className="mb-script-reason">
                  {item.reason}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — sticky at bottom */}
      <div className="mb-cta-pad">
        <button onClick={onClose} className="mb-cta-btn">
          Begin Protocol \u2192
        </button>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function MorningBriefModal({ isOpen, onClose }: MorningBriefProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering')
  const [currentTime] = useState(() => {
    const d = new Date()
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  })
  const [currentDate] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  })

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : 'ssr'

  // Fetch data — all queries may return undefined (loading) or empty results
  const dashData = useQuery(api.dashboardData.getLast24hDashboardData, { sessionId })
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId })
  const leaderboard = useQuery(api.leaderboard.getPeerLeaderboard)
  const bioVault = useQuery(api.queries.getBioVaultBySession, { sessionId })
  const todayCompletions = useQuery(api.queries.getTodayCompletions, { sessionId })

  // Mutation for toggling script item completion
  const toggleCompletion = useMutation(api.mutations.toggleProtocolCompletion)

  // Build a set of completed script item keys for fast lookup
  const completedKeys = useMemo(() => {
    if (!todayCompletions || !Array.isArray(todayCompletions)) return new Set<string>()
    return new Set(
      todayCompletions
        .filter((c: any) => c.completed && c.protocolItemId?.startsWith('script:'))
        .map((c: any) => c.protocolItemId)
    )
  }, [todayCompletions])

  // Determine loading state — undefined means still loading
  const isLoading = dashData === undefined && protocolStatus === undefined && leaderboard === undefined && bioVault === undefined

  // Determine if we have ANY meaningful data to show a full briefing
  const hasData = !!(
    (dashData && (dashData.currentHrv)) ||
    bioVault ||
    (protocolStatus?.items && protocolStatus.items.length > 0) ||
    (leaderboard && Array.isArray(leaderboard) && leaderboard.length > 0)
  )

  // Derived data — safe even with null/undefined inputs
  const scriptItems = useMemo(() => deriveTopScriptItems(protocolStatus), [protocolStatus])
  const priorityMarker = useMemo(() => derivePriorityMarker(dashData, bioVault), [dashData, bioVault])
  const smartInsight = useMemo(() => deriveSmartInsight(dashData, bioVault, protocolStatus), [dashData, bioVault, protocolStatus])

  const cohortRank = useMemo(() => deriveCohortRank(
    Array.isArray(leaderboard) ? leaderboard : [],
    sessionId
  ), [leaderboard, sessionId])

  // Count completed script items for the counter
  const scriptCompletedCount = useMemo(() => {
    return scriptItems.filter(item => completedKeys.has(scriptItemKey(item))).length
  }, [scriptItems, completedKeys])

  // Handle script item toggle
  const handleToggleScript = useCallback(async (item: ScriptItem) => {
    const key = scriptItemKey(item)
    try {
      await toggleCompletion({ sessionId, protocolItemId: key })
    } catch (err) {
      console.error('Failed to toggle script completion:', err)
    }
  }, [toggleCompletion, sessionId])

  // Lock body scroll on mobile Safari when modal is open
  useEffect(() => {
    if (!isOpen) return
    const origOverflow = document.body.style.overflow
    const origPosition = document.body.style.position
    const origWidth = document.body.style.width
    const origTop = document.body.style.top
    const scrollY = window.scrollY

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = `-${scrollY}px`

    return () => {
      document.body.style.overflow = origOverflow
      document.body.style.position = origPosition
      document.body.style.width = origWidth
      document.body.style.top = origTop
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setPhase('entering')
      const t = setTimeout(() => setPhase('visible'), 100)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setPhase('exiting')
    setTimeout(onClose, 400)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const priorityColor: Record<string, string> = {
    critical: '#D4847A',
    high: '#C4A46C',
    standard: 'rgba(255,255,255,0.4)',
  }

  const priorityLabelMap: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    standard: 'STANDARD',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }} />

          {/* Modal — bottom-sheet on mobile, centered card on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="morning-brief-modal"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              background: '#0A0A0A',
              border: '1px solid rgba(232,151,108,0.12)',
              boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 80px rgba(232,151,108,0.04)',
              borderRadius: '20px 20px 0 0',
              maxHeight: '92dvh',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle for mobile */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 10,
              paddingBottom: 2,
              flexShrink: 0,
            }}>
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.12)',
              }} />
            </div>

            {/* Scrollable content area — critical for mobile Safari */}
            <div
              className="mb-scroll-area"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                minHeight: 0,
                WebkitOverflowScrolling: 'touch' as any,
                overscrollBehavior: 'contain',
              }}
            >
              {/* ── Loading state ── */}
              {isLoading ? (
                <BriefSkeleton />
              ) : !hasData ? (
                <WelcomeFallback
                  currentDate={currentDate}
                  currentTime={currentTime}
                  onClose={handleClose}
                />
              ) : (
                /* ── Full briefing ── */
                <>
                  {/* ── Header ── */}
                  <div className="mb-header-pad" style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, height: 1,
                      background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.4), transparent)',
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="mb-section-label" style={{ marginBottom: 5 }}>
                          Morning Brief
                        </div>
                        <div className="mb-date-text">
                          {currentDate}
                        </div>
                        <div className="mb-time-text" style={{ marginTop: 3 }}>
                          {currentTime} \u00B7 Briefing #{Math.floor(Date.now() / 86400000) % 1000}
                        </div>
                      </div>

                      <button
                        onClick={handleClose}
                        className="mb-close-btn"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
                        }}
                      >
                        \u2715
                      </button>
                    </div>
                  </div>

                  {/* ── Section 1: Priority Marker ── */}
                  <div className="mb-section-pad" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="mb-section-label" style={{ marginBottom: 12 }}>
                      \u25C9 Priority Marker
                    </div>

                    <div className="mb-marker-card" style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${priorityMarker.color}15`,
                      borderRadius: 14,
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, width: 3,
                        height: '100%', background: priorityMarker.color,
                        borderRadius: '3px 0 0 3px', opacity: 0.6,
                      }} />

                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', flexWrap: 'wrap', gap: 8,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mb-marker-name">
                            {priorityMarker.name}
                          </div>
                          <div className="mb-marker-value-row">
                            <span className="mb-marker-value">
                              {priorityMarker.value ?? '\u2014'}
                            </span>
                            <span className="mb-marker-unit">
                              {priorityMarker.unit}
                            </span>
                            <span className="mb-marker-trend" style={{
                              color: priorityMarker.color,
                              background: `${priorityMarker.color}15`,
                            }}>
                              {priorityMarker.trendDirection === 'up' ? '\u2191' : priorityMarker.trendDirection === 'down' ? '\u2193' : '\u2192'} {priorityMarker.trendLabel}
                            </span>
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          <MiniSparkline
                            data={priorityMarker.sparkData}
                            color={priorityMarker.color}
                            width={64}
                            height={24}
                          />
                        </div>
                      </div>

                      <div className="mb-marker-protocol">
                        <span style={{ color: priorityMarker.color, fontWeight: 600 }}>Script:</span>{' '}
                        {priorityMarker.protocol}
                      </div>
                    </div>
                  </div>

                  {/* ── Smart Insight ── */}
                  <div className="mb-section-pad" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="mb-section-label" style={{ marginBottom: 10 }}>
                      \u25C8 Smart Insight
                    </div>
                    <SmartInsightCard insight={smartInsight} />
                  </div>

                  {/* ── Section 2: Today's Script (Top 3) — with check-off ── */}
                  <div className="mb-section-pad mb-script-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 12,
                    }}>
                      <div className="mb-section-label">
                        \u25B7 Critical Script Items
                      </div>
                      <div className="mb-script-counter">
                        {scriptCompletedCount}/{scriptItems.length} done
                      </div>
                    </div>

                    {/* Script items — scrollable on very short viewports */}
                    <div className="mb-script-list">
                      {scriptItems.map((item, i) => (
                        <CheckableScriptItem
                          key={`${item.name}-${i}`}
                          item={item}
                          index={i}
                          isCompleted={completedKeys.has(scriptItemKey(item))}
                          onToggle={() => handleToggleScript(item)}
                          priorityColor={priorityColor[item.priority] || 'rgba(255,255,255,0.4)'}
                          priorityLabel={priorityLabelMap[item.priority] || 'STANDARD'}
                        />
                      ))}
                    </div>

                    {/* All-done celebration micro-state */}
                    <AnimatePresence>
                      {scriptCompletedCount === scriptItems.length && scriptItems.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                          className="mb-script-alldone"
                        >
                          \u2728 All critical items complete \u2014 protocol adherence locked.
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Section 3: Elite Cohort Rank ── */}
                  <div className="mb-section-pad">
                    <div className="mb-section-label" style={{ marginBottom: 12 }}>
                      {cohortRank.isBenchmarkOnly ? '\u25CB System Benchmarks' : '\u25CB Cohort Standing'}
                    </div>

                    {cohortRank.isBenchmarkOnly ? (
                      <div style={{
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: 14, padding: '14px', overflow: 'hidden',
                      }}>
                        <div className="mb-benchmark-desc">
                          No peer data yet. Here are protocol adherence benchmarks from the VIVE research cohort to track against:
                        </div>
                        {(Array.isArray(leaderboard) ? leaderboard : []).slice(0, 5).map((entry: any, i: number) => {
                          const tierColor = entry.tier === 'apex' ? '#E8976C' : entry.tier === 'titan' ? '#C4A46C' : '#6BA3BE'
                          return (
                            <div key={entry.anonId || i} className="mb-benchmark-row" style={{
                              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                            }}>
                              <span className="mb-benchmark-rank">
                                {entry.rank}
                              </span>
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: tierColor, opacity: 0.6, flexShrink: 0,
                              }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="mb-benchmark-label">
                                  {entry.anonLabel}
                                </div>
                              </div>
                              <span className="mb-benchmark-pct" style={{ color: tierColor }}>
                                {entry.avgAdherence}%
                              </span>
                              {entry.streak > 0 && (
                                <span className="mb-benchmark-streak">
                                  {entry.streak}d
                                </span>
                              )}
                            </div>
                          )
                        })}
                        <div style={{
                          marginTop: 10, padding: '8px 10px',
                          background: 'rgba(232,151,108,0.04)',
                          border: '1px solid rgba(232,151,108,0.1)',
                          borderRadius: 8,
                        }}>
                          <div className="mb-benchmark-hint">
                            Complete your first week of protocols to see your rank against real peers.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-cohort-card">
                        <div className="mb-cohort-rank-circle" style={{
                          border: `2px solid ${cohortRank.tierColor}30`,
                        }}>
                          <div style={{
                            position: 'absolute', inset: -4, borderRadius: '50%',
                            background: `radial-gradient(circle, ${cohortRank.tierColor}08, transparent 70%)`,
                          }} />
                          <span className="mb-cohort-rank-num" style={{ color: cohortRank.tierColor }}>
                            #{cohortRank.rank}
                          </span>
                          <span className="mb-cohort-rank-of">
                            of {cohortRank.total}
                          </span>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            marginBottom: 4, flexWrap: 'wrap',
                          }}>
                            <span className="mb-cohort-tier">
                              {cohortRank.tier} Tier
                            </span>
                            <span className="mb-cohort-adh" style={{
                              color: cohortRank.tierColor,
                              background: `${cohortRank.tierColor}12`,
                            }}>
                              {cohortRank.adherence}% ADH
                            </span>
                          </div>
                          <div className="mb-cohort-desc">
                            7-day protocol adherence across the Elite Cohort
                          </div>

                          <div style={{
                            marginTop: 8, height: 3,
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 2, overflow: 'hidden',
                          }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${cohortRank.adherence}%` }}
                              transition={{ delay: 0.6, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                              style={{
                                height: '100%',
                                background: `linear-gradient(90deg, ${cohortRank.tierColor}60, ${cohortRank.tierColor})`,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Dismiss CTA — inside scroll area so it's always reachable ── */}
                  <div className="mb-cta-pad">
                    <button
                      onClick={handleClose}
                      className="mb-cta-btn"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(232,151,108,0.12)'
                        e.currentTarget.style.borderColor = 'rgba(232,151,108,0.35)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(232,151,108,0.06)'
                        e.currentTarget.style.borderColor = 'rgba(232,151,108,0.2)'
                      }}
                    >
                      Begin Protocol \u2192
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bottom accent line */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.2), transparent)',
              pointerEvents: 'none',
            }} />
          </motion.div>

          {/* ── Responsive overrides ── */}
          <style>{`
            /* ── Morning Brief responsive classes ── */

            /* Padding helpers — mobile-first compact, scale up */
            .mb-header-pad { padding: 16px 16px 14px; }
            .mb-section-pad { padding: 14px 16px; }
            .mb-cta-pad { padding: 8px 16px 16px; padding-bottom: max(16px, env(safe-area-inset-bottom, 16px)); }
            .mb-marker-card { padding: 12px 12px; }

            /* Section label — monospace uppercase */
            .mb-section-label {
              font-size: 9px;
              font-family: monospace;
              font-weight: 600;
              letter-spacing: 0.2em;
              color: rgba(255,255,255,0.25);
              text-transform: uppercase;
            }

            /* Date text — scales down on mobile */
            .mb-date-text {
              font-size: 17px;
              font-weight: 700;
              color: rgba(255,255,255,0.95);
              letter-spacing: -0.02em;
              line-height: 1.2;
            }

            /* Time text */
            .mb-time-text {
              font-size: 11px;
              color: rgba(255,255,255,0.3);
              font-family: monospace;
            }

            /* Close button */
            .mb-close-btn {
              width: 32px;
              height: 32px;
              border-radius: 10px;
              border: 1px solid rgba(255,255,255,0.06);
              background: rgba(255,255,255,0.03);
              color: rgba(255,255,255,0.3);
              font-size: 16px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              margin-left: 12px;
              transition: all 0.2s;
            }

            /* Welcome fallback */
            .mb-welcome-title { font-size: 16px; }
            .mb-welcome-desc {
              font-size: 12px;
              color: rgba(255,255,255,0.4);
              line-height: 1.6;
              max-width: 280px;
              margin: 0 auto;
            }

            /* ── Priority Marker ── */
            .mb-marker-name {
              font-size: 12px;
              font-weight: 600;
              color: rgba(255,255,255,0.85);
              margin-bottom: 4px;
            }
            .mb-marker-value-row {
              display: flex;
              align-items: baseline;
              gap: 5px;
              flex-wrap: wrap;
              margin-bottom: 6px;
            }
            .mb-marker-value {
              font-size: 22px;
              font-weight: 700;
              color: rgba(255,255,255,0.95);
              font-family: monospace;
              letter-spacing: -0.03em;
            }
            .mb-marker-unit {
              font-size: 10px;
              color: rgba(255,255,255,0.3);
              font-family: monospace;
            }
            .mb-marker-trend {
              font-size: 10px;
              font-weight: 600;
              font-family: monospace;
              padding: 2px 6px;
              border-radius: 6px;
              white-space: nowrap;
            }
            .mb-marker-protocol {
              font-size: 10px;
              color: rgba(255,255,255,0.4);
              line-height: 1.5;
              padding-top: 8px;
              border-top: 1px solid rgba(255,255,255,0.04);
              word-break: break-word;
            }

            /* ── Script Items ── */
            .mb-script-counter {
              font-size: 10px;
              font-family: monospace;
              color: rgba(232,151,108,0.5);
              flex-shrink: 0;
            }
            .mb-script-list {
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .mb-script-item {
              display: flex;
              align-items: flex-start;
              gap: 8px;
              padding: 8px 10px;
              background: rgba(255,255,255,0.015);
              border: 1px solid rgba(255,255,255,0.04);
              border-radius: 10px;
              position: relative;
              overflow: visible;
            }

            /* ── Checkable Script Item Styles ── */
            .mb-script-item--checkable {
              cursor: pointer;
              user-select: none;
              -webkit-user-select: none;
              transition: background 0.4s ease, border-color 0.4s ease, box-shadow 0.6s ease;
            }
            .mb-script-item--checkable:hover {
              background: rgba(255,255,255,0.025);
              border-color: rgba(255,255,255,0.08);
            }
            .mb-script-item--checkable:active {
              transform: scale(0.985);
            }
            .mb-script-item--completed {
              background: rgba(124,182,142,0.04) !important;
              border-color: rgba(124,182,142,0.12) !important;
            }
            .mb-script-item--completed:hover {
              background: rgba(124,182,142,0.06) !important;
              border-color: rgba(124,182,142,0.18) !important;
            }

            /* Glow effect on completion */
            @keyframes scriptGlow {
              0% { box-shadow: 0 0 0 0 rgba(124,182,142,0); }
              30% { box-shadow: 0 0 16px 4px rgba(124,182,142,0.25), 0 0 32px 8px rgba(124,182,142,0.08); }
              100% { box-shadow: 0 0 0 0 rgba(124,182,142,0); }
            }
            .mb-script-item--glow {
              animation: scriptGlow 0.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
            }

            /* Check circle */
            .mb-script-check {
              width: 30px;
              height: 30px;
              border-radius: 8px;
              background: rgba(255,255,255,0.03);
              border: 1.5px solid rgba(255,255,255,0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
              position: relative;
              overflow: hidden;
            }
            .mb-script-check--done {
              background: rgba(124,182,142,0.15);
              border-color: rgba(124,182,142,0.4);
            }
            .mb-script-check-inner {
              font-size: 14px;
              font-weight: 700;
              color: #7CB68E;
              line-height: 1;
            }

            /* Script name with strike-through */
            .mb-script-name {
              font-size: 12px;
              font-weight: 600;
              color: rgba(255,255,255,0.85);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              min-width: 0;
              flex: 1;
              position: relative;
              transition: color 0.4s ease;
            }
            .mb-script-name--struck {
              color: rgba(255,255,255,0.35);
            }

            /* Animated strike-through line */
            .mb-script-strike {
              position: absolute;
              left: 0;
              top: 50%;
              height: 1.5px;
              background: rgba(124,182,142,0.6);
              width: 0;
              transition: width 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
              pointer-events: none;
            }
            .mb-script-strike--active {
              width: 100%;
            }

            .mb-script-icon-box {
              width: 30px;
              height: 30px;
              border-radius: 8px;
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.06);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              flex-shrink: 0;
            }
            .mb-script-icon {
              font-size: 14px;
              flex-shrink: 0;
            }
            .mb-script-priority {
              font-size: 7px;
              font-family: monospace;
              font-weight: 700;
              letter-spacing: 0.1em;
              opacity: 0.8;
              flex-shrink: 0;
              transition: color 0.4s ease;
            }
            .mb-script-reason {
              font-size: 10px;
              color: rgba(255,255,255,0.35);
              line-height: 1.4;
              word-break: break-word;
              transition: opacity 0.4s ease;
            }
            .mb-script-reason--faded {
              opacity: 0.5;
            }

            /* All-done celebration */
            .mb-script-alldone {
              margin-top: 10px;
              padding: 8px 12px;
              background: rgba(124,182,142,0.06);
              border: 1px solid rgba(124,182,142,0.15);
              border-radius: 8px;
              font-size: 10px;
              font-family: monospace;
              color: rgba(124,182,142,0.8);
              text-align: center;
              letter-spacing: 0.02em;
              overflow: hidden;
            }

            /* ── Cohort / Benchmark ── */
            .mb-benchmark-desc {
              font-size: 10px;
              color: rgba(255,255,255,0.5);
              line-height: 1.5;
              margin-bottom: 12px;
            }
            .mb-benchmark-row {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 7px 0;
            }
            .mb-benchmark-rank {
              font-size: 10px;
              font-family: monospace;
              font-weight: 700;
              color: rgba(255,255,255,0.25);
              width: 18px;
              text-align: right;
              flex-shrink: 0;
            }
            .mb-benchmark-label {
              font-size: 11px;
              font-weight: 600;
              color: rgba(255,255,255,0.7);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .mb-benchmark-pct {
              font-size: 10px;
              font-family: monospace;
              font-weight: 700;
              flex-shrink: 0;
            }
            .mb-benchmark-streak {
              font-size: 9px;
              font-family: monospace;
              color: rgba(255,255,255,0.25);
              flex-shrink: 0;
            }
            .mb-benchmark-hint {
              font-size: 10px;
              color: rgba(232,151,108,0.7);
              font-family: monospace;
              line-height: 1.5;
            }

            /* Cohort rank card */
            .mb-cohort-card {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px;
              background: rgba(255,255,255,0.015);
              border: 1px solid rgba(255,255,255,0.04);
              border-radius: 14px;
            }
            .mb-cohort-rank-circle {
              width: 44px;
              height: 44px;
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              position: relative;
            }
            .mb-cohort-rank-num {
              font-size: 16px;
              font-weight: 800;
              font-family: monospace;
              line-height: 1;
            }
            .mb-cohort-rank-of {
              font-size: 7px;
              font-family: monospace;
              color: rgba(255,255,255,0.3);
              margin-top: 1px;
            }
            .mb-cohort-tier {
              font-size: 13px;
              font-weight: 700;
              color: rgba(255,255,255,0.9);
            }
            .mb-cohort-adh {
              font-size: 9px;
              font-family: monospace;
              font-weight: 600;
              letter-spacing: 0.1em;
              padding: 2px 8px;
              border-radius: 4px;
              white-space: nowrap;
            }
            .mb-cohort-desc {
              font-size: 10px;
              color: rgba(255,255,255,0.35);
              line-height: 1.4;
            }

            /* ── Smart Insight ── */
            .mb-insight-card {
              border-radius: 12px;
              padding: 12px;
              position: relative;
              overflow: hidden;
            }
            .mb-insight-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
            }
            .mb-insight-icon {
              font-size: 16px;
              line-height: 1;
            }
            .mb-insight-tag {
              font-size: 8px;
              font-family: monospace;
              font-weight: 700;
              letter-spacing: 0.15em;
              padding: 2px 8px;
              border-radius: 4px;
              text-transform: uppercase;
            }
            .mb-insight-message {
              font-size: 12px;
              font-weight: 500;
              color: rgba(255,255,255,0.82);
              line-height: 1.6;
              letter-spacing: -0.01em;
            }
            .mb-insight-source {
              font-size: 9px;
              font-family: monospace;
              color: rgba(255,255,255,0.18);
              margin-top: 8px;
              letter-spacing: 0.03em;
            }

            /* CTA button */
            .mb-cta-btn {
              width: 100%;
              padding: 12px;
              border-radius: 12px;
              border: 1px solid rgba(232,151,108,0.2);
              background: rgba(232,151,108,0.06);
              color: #E8976C;
              font-size: 13px;
              font-weight: 600;
              font-family: monospace;
              letter-spacing: 0.05em;
              cursor: pointer;
              transition: all 0.2s;
            }

            /* ── Desktop breakpoint (480px+) ── */
            @media (min-width: 480px) {
              .morning-brief-modal {
                border-radius: 20px !important;
                max-height: 90vh !important;
                margin: 16px !important;
                align-self: center !important;
              }
            }

            /* ── Tablet+ breakpoint (640px+) — scale up text ── */
            @media (min-width: 640px) {
              .mb-header-pad { padding: 24px 20px 18px; }
              .mb-section-pad { padding: 16px 20px; }
              .mb-cta-pad { padding: 8px 20px 20px; padding-bottom: max(20px, env(safe-area-inset-bottom, 20px)); }
              .mb-marker-card { padding: 14px 14px; }

              .mb-date-text { font-size: 20px; }
              .mb-time-text { font-size: 12px; }
              .mb-welcome-title { font-size: 18px; }
              .mb-welcome-desc { font-size: 13px; }

              .mb-marker-name { font-size: 13px; }
              .mb-marker-value { font-size: 26px; }
              .mb-marker-unit { font-size: 11px; }
              .mb-marker-trend { font-size: 11px; padding: 2px 7px; }
              .mb-marker-protocol { font-size: 11px; }

              .mb-script-item { gap: 10px; padding: 10px 12px; border-radius: 12px; }
              .mb-script-check { width: 34px; height: 34px; border-radius: 9px; }
              .mb-script-check-inner { font-size: 16px; }
              .mb-script-icon-box { width: 34px; height: 34px; border-radius: 9px; font-size: 15px; }
              .mb-script-name { font-size: 13px; }
              .mb-script-priority { font-size: 8px; }
              .mb-script-reason { font-size: 11px; }

              .mb-benchmark-desc { font-size: 11px; }
              .mb-benchmark-row { gap: 10px; padding: 8px 0; }
              .mb-benchmark-label { font-size: 12px; }
              .mb-benchmark-pct { font-size: 11px; }

              .mb-cohort-card { gap: 14px; padding: 14px; }
              .mb-cohort-rank-circle { width: 50px; height: 50px; }
              .mb-cohort-rank-num { font-size: 18px; }
              .mb-cohort-rank-of { font-size: 8px; }
              .mb-cohort-tier { font-size: 14px; }
              .mb-cohort-adh { font-size: 9px; }
              .mb-cohort-desc { font-size: 11px; }

              .mb-cta-btn { padding: 14px; }

              .mb-insight-card { padding: 14px; border-radius: 14px; }
              .mb-insight-icon { font-size: 18px; }
              .mb-insight-tag { font-size: 9px; padding: 3px 9px; }
              .mb-insight-message { font-size: 13px; }
              .mb-insight-source { font-size: 10px; }
            }

            /* ── Very short viewport — make script list scrollable ── */
            @media (max-height: 600px) {
              .morning-brief-modal {
                max-height: 98dvh !important;
              }
              .mb-script-section {
                max-height: none;
              }
              .mb-script-list {
                max-height: 180px;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                overscroll-behavior: contain;
                padding-right: 4px;
              }
              .mb-script-list::-webkit-scrollbar {
                width: 3px;
              }
              .mb-script-list::-webkit-scrollbar-track {
                background: transparent;
              }
              .mb-script-list::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.08);
                border-radius: 3px;
              }
              .mb-header-pad { padding: 12px 14px 10px; }
              .mb-section-pad { padding: 10px 14px; }
              .mb-cta-pad { padding: 6px 14px 12px; }
              .mb-date-text { font-size: 16px; }
              .mb-marker-value { font-size: 20px; }
              .mb-cohort-rank-circle { width: 40px; height: 40px; }
              .mb-cohort-rank-num { font-size: 14px; }
              .mb-cta-btn { padding: 10px; font-size: 12px; }
              .mb-insight-card { padding: 10px; }
              .mb-insight-message { font-size: 11px; }
              .mb-insight-source { font-size: 8px; margin-top: 6px; }
            }

            /* ── Tiny screens (< 360px) — extra compact ── */
            @media (max-width: 359px) {
              .mb-header-pad { padding: 12px 12px 10px; }
              .mb-section-pad { padding: 10px 12px; }
              .mb-cta-pad { padding: 6px 12px 14px; }
              .mb-marker-card { padding: 10px 10px; }
              .mb-date-text { font-size: 15px; }
              .mb-marker-value { font-size: 20px; }
              .mb-marker-name { font-size: 11px; }
              .mb-script-item { gap: 6px; padding: 7px 8px; }
              .mb-script-check { width: 26px; height: 26px; border-radius: 6px; }
              .mb-script-check-inner { font-size: 12px; }
              .mb-script-icon-box { width: 26px; height: 26px; font-size: 12px; border-radius: 6px; }
              .mb-script-name { font-size: 11px; }
              .mb-script-reason { font-size: 9px; }
              .mb-cohort-card { gap: 10px; padding: 10px; }
              .mb-cohort-rank-circle { width: 38px; height: 38px; }
              .mb-cohort-rank-num { font-size: 14px; }
              .mb-benchmark-row { gap: 6px; }
              .mb-benchmark-label { font-size: 10px; }
              .mb-insight-card { padding: 10px; border-radius: 10px; }
              .mb-insight-icon { font-size: 14px; }
              .mb-insight-tag { font-size: 7px; padding: 2px 6px; }
              .mb-insight-message { font-size: 11px; }
              .mb-insight-source { font-size: 8px; margin-top: 6px; }
            }

            /* Scroll area thin scrollbar */
            .mb-scroll-area::-webkit-scrollbar { width: 3px; }
            .mb-scroll-area::-webkit-scrollbar-track { background: transparent; }
            .mb-scroll-area::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.06);
              border-radius: 3px;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
