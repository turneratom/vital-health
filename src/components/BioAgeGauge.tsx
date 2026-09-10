import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Design Tokens ── */
const C = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.18)',
  accent: '#00FFCC',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Helpers ── */
function getStatusGradient(delta: number): [string, string, string] {
  if (delta <= -5) return [C.accent, 'rgba(0,255,204,0.25)', C.accent]
  if (delta <= -2) return [C.green, C.greenGlow, C.green]
  if (delta <= 0) return [C.blue, C.blueGlow, C.blueBright]
  if (delta <= 3) return [C.orange, C.orangeGlow, C.orange]
  return [C.red, C.redGlow, C.red]
}

function formatDelta(d: number): string {
  if (d <= 0) return `${Math.abs(d).toFixed(1)} yrs younger`
  return `${d.toFixed(1)} yrs older`
}

function getContributorIcon(key: string): string {
  const map: Record<string, string> = {
    hrv: '💓', biomarkers: '🧬', sleep: '🌙', adherence: '📋', fitness: '🏋️',
    crp: '🔬', hba1c: '🩸', vitaminD: '☀️', testosteroneTotal: '⚡',
    ferritin: '🧲', apoB: '❤️', homocysteine: '🧪', triglycerides: '💧',
    nmn: '💊', resveratrol: '🍇', coldPlunge: '🧊', sauna: '🔥',
    alcohol: '🍷', lateNight: '🌃', stress: '😰', sugar: '🍬',
  }
  return map[key] || '📊'
}

/* ── SVG Circular Gauge ── */
interface GaugeRingProps {
  bioAge: number
  chronoAge: number
  delta: number
  statusColor: string
  glowColor: string
  confidence: number
  fluctuation: number
}

function GaugeRing({ bioAge, chronoAge, delta, statusColor, glowColor, fluctuation }: GaugeRingProps) {
  const size = 260
  const cx = size / 2
  const cy = size / 2
  const radius = 105
  const strokeWidth = 10
  const trackStroke = 4

  // Arc: 270° sweep from 135° to 405° (bottom-left to bottom-right)
  const startAngle = 135
  const sweepAngle = 270

  // Map bio age to gauge position: younger = more filled (green), older = less filled
  // Range: chronoAge ± 15 years
  const minAge = chronoAge - 15
  const maxAge = chronoAge + 15
  const clampedAge = Math.max(minAge, Math.min(maxAge, bioAge + fluctuation))
  // Invert: younger = higher fill
  const fillPct = 1 - (clampedAge - minAge) / (maxAge - minAge)
  const fillAngle = sweepAngle * fillPct

  // Convert angle to SVG arc coordinates
  const polarToCartesian = (angle: number, r: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  // Track arc (full background)
  const trackStart = polarToCartesian(startAngle, radius)
  const trackEnd = polarToCartesian(startAngle + sweepAngle, radius)
  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`

  // Fill arc
  const fillEnd = polarToCartesian(startAngle + fillAngle, radius)
  const largeArc = fillAngle > 180 ? 1 : 0
  const fillPath = fillAngle > 0.5
    ? `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`
    : ''

  // Needle position at the end of the fill arc
  const needleAngle = startAngle + fillAngle
  const needleTip = polarToCartesian(needleAngle, radius + 14)
  const needleBase1 = polarToCartesian(needleAngle - 90, 4)
  const needleBase2 = polarToCartesian(needleAngle + 90, 4)

  // Tick marks
  const ticks = Array.from({ length: 28 }, (_, i) => {
    const angle = startAngle + (sweepAngle / 27) * i
    const inner = polarToCartesian(angle, radius - 16)
    const outer = polarToCartesian(angle, radius - 10)
    const isMajor = i % 9 === 0
    return { inner, outer, isMajor, angle }
  })

  const displayAge = (bioAge + fluctuation).toFixed(1)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <defs>
        {/* Glow filter */}
        <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor={statusColor} floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Needle glow */}
        <filter id="needleGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor={statusColor} floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Arc gradient */}
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={statusColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={statusColor} stopOpacity="0.5" />
        </linearGradient>
        {/* Radial glow behind center */}
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={statusColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={statusColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background radial glow */}
      <circle cx={cx} cy={cy} r={radius + 30} fill="url(#centerGlow)" />

      {/* Track (background arc) */}
      <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={trackStroke} strokeLinecap="round" />

      {/* Tick marks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.inner.x} y1={t.inner.y}
          x2={t.outer.x} y2={t.outer.y}
          stroke={t.isMajor ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
          strokeWidth={t.isMajor ? 1.5 : 0.8}
          strokeLinecap="round"
        />
      ))}

      {/* Fill arc with glow */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#gaugeGlow)"
        />
      )}

      {/* Needle */}
      {fillAngle > 0.5 && (
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${cx},${cy} ${needleBase2.x},${needleBase2.y}`}
          fill={statusColor}
          filter="url(#needleGlow)"
          opacity={0.9}
        />
      )}

      {/* Center hub */}
      <circle cx={cx} cy={cy} r={6} fill={C.surface} stroke={statusColor} strokeWidth={1.5} opacity={0.8} />

      {/* Center text: Bio Age */}
      <text x={cx} y={cy - 18} textAnchor="middle" fill={C.textTer} fontSize="9" fontFamily="monospace" fontWeight="600" letterSpacing="0.12em">
        BIOLOGICAL AGE
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={statusColor} fontSize="42" fontFamily="monospace" fontWeight="700">
        {displayAge}
      </text>
      <text x={cx} y={cy + 32} textAnchor="middle" fill={C.textSec} fontSize="10" fontFamily="monospace">
        Chrono: {chronoAge}
      </text>

      {/* Delta badge at bottom */}
      <text x={cx} y={cy + 52} textAnchor="middle" fill={delta <= 0 ? C.green : C.orange} fontSize="11" fontFamily="monospace" fontWeight="700">
        {delta <= 0 ? '▼' : '▲'} {formatDelta(delta)}
      </text>
    </svg>
  )
}

/* ── Contributor Card ── */
interface Contributor {
  key: string
  label: string
  impact: number // negative = younger, positive = older
  detail: string
  category: 'positive' | 'negative'
}

function ContributorRow({ item, index }: { item: Contributor; index: number }) {
  const isPositive = item.category === 'positive'
  const color = isPositive ? C.green : C.orange
  const bgColor = isPositive ? C.greenGlow : C.orangeGlow

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + index * 0.08, duration: 0.35 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 12,
        background: bgColor,
        border: `1px solid ${isPositive ? 'rgba(0,220,130,0.12)' : 'rgba(232,151,108,0.12)'}`,
      }}
    >
      <div style={{ fontSize: 18, flexShrink: 0 }}>{getContributorIcon(item.key)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.label}
        </div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.textSec, marginTop: 2 }}>
          {item.detail}
        </div>
      </div>
      <div style={{
        fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color,
        flexShrink: 0, textAlign: 'right',
      }}>
        {isPositive ? '-' : '+'}{Math.abs(item.impact).toFixed(1)} yr
      </div>
    </motion.div>
  )
}

/* ── 7-Day Sparkline ── */
function AgeTrendSparkline({ history }: { history: Array<{ date: string; viveAge: number; chronoAge: number }> }) {
  if (history.length < 2) return null

  const last7 = history.slice(-7)
  const ages = last7.map(h => h.viveAge)
  const min = Math.min(...ages) - 0.5
  const max = Math.max(...ages) + 0.5
  const range = max - min || 1
  const w = 200
  const h = 36

  const points = last7.map((d, i) => {
    const x = (i / (last7.length - 1)) * w
    const y = h - ((d.viveAge - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  const chronoY = h - ((last7[0].chronoAge - min) / range) * h

  // Trend direction
  const firstAge = ages[0]
  const lastAge = ages[ages.length - 1]
  const trending = lastAge < firstAge ? 'improving' : lastAge > firstAge ? 'declining' : 'stable'
  const trendColor = trending === 'improving' ? C.green : trending === 'declining' ? C.orange : C.blue

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          7-DAY TREND
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: trendColor,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {trending === 'improving' ? '↘' : trending === 'declining' ? '↗' : '→'} {trending}
        </span>
      </div>
      <svg width={w} height={h + 4} viewBox={`0 0 ${w} ${h + 4}`} style={{ display: 'block', width: '100%', height: 40 }}>
        {/* Chrono age reference line */}
        <line x1={0} y1={chronoY} x2={w} y2={chronoY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3,3" />
        {/* Trend line */}
        <polyline
          points={points}
          fill="none"
          stroke={trendColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {last7.map((d, i) => {
          const x = (i / (last7.length - 1)) * w
          const y = h - ((d.viveAge - min) / range) * h
          return (
            <circle key={i} cx={x} cy={y} r={i === last7.length - 1 ? 3.5 : 2}
              fill={i === last7.length - 1 ? trendColor : 'rgba(255,255,255,0.3)'}
              stroke={i === last7.length - 1 ? trendColor : 'none'}
              strokeWidth={1}
            />
          )
        })}
      </svg>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   BIO AGE GAUGE — Main Export
   Real-time fluctuating biological age with "What's Moving the Needle"
   ══════════════════════════════════════════════════════════════ */

export default function BioAgeGauge() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const viveAge = useQuery(api.bioAgeAlgorithm.computeViveAge, { sessionId })
  const snapshotMutation = useMutation(api.bioAgeAlgorithm.snapshotViveAge)

  // Real-time fluctuation: subtle ±0.1–0.3 year oscillation
  const [fluctuation, setFluctuation] = useState(0)
  const fluctRef = useRef(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    let active = true
    const animate = () => {
      if (!active) return
      const t = Date.now() / 1000
      // Multi-frequency oscillation for organic feel
      const f1 = Math.sin(t * 0.3) * 0.12
      const f2 = Math.sin(t * 0.7 + 1.2) * 0.08
      const f3 = Math.sin(t * 1.1 + 2.5) * 0.04
      fluctRef.current = f1 + f2 + f3
      setFluctuation(fluctRef.current)
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => { active = false; cancelAnimationFrame(frameRef.current) }
  }, [])

  // Auto-snapshot once per day
  const snapshotted = useRef(false)
  useEffect(() => {
    if (!viveAge || snapshotted.current) return
    snapshotted.current = true
    snapshotMutation({
      sessionId,
      viveAge: viveAge.viveAge,
      chronoAge: viveAge.chronologicalAge,
      delta: viveAge.delta,
      confidence: viveAge.confidence,
      hrvAdj: viveAge.components.hrv.adjustment,
      biomarkerAdj: viveAge.components.biomarkers.adjustment,
      sleepAdj: viveAge.components.sleep.adjustment,
      adherenceAdj: viveAge.components.adherence.adjustment,
      fitnessAdj: viveAge.components.fitness.adjustment,
    }).catch(() => {})
  }, [viveAge, sessionId, snapshotMutation])

  // Build "What's Moving the Needle" contributors
  const contributors = useMemo<Contributor[]>(() => {
    if (!viveAge) return []
    const items: Contributor[] = []
    const comp = viveAge.components

    // HRV
    if (comp.hrv.value > 0) {
      items.push({
        key: 'hrv',
        label: comp.hrv.adjustment <= 0 ? 'Strong HRV Recovery' : 'Low HRV Signal',
        impact: comp.hrv.adjustment,
        detail: `${comp.hrv.value}ms avg · ${(comp.hrv.weight * 100).toFixed(0)}% weight`,
        category: comp.hrv.adjustment <= 0 ? 'positive' : 'negative',
      })
    }

    // Sleep
    items.push({
      key: 'sleep',
      label: comp.sleep.adjustment <= 0 ? 'Quality Sleep Architecture' : 'Sleep Deficit Detected',
      impact: comp.sleep.adjustment,
      detail: `Score: ${comp.sleep.score}/100 · ${(comp.sleep.weight * 100).toFixed(0)}% weight`,
      category: comp.sleep.adjustment <= 0 ? 'positive' : 'negative',
    })

    // Protocol Adherence
    items.push({
      key: 'adherence',
      label: comp.adherence.adjustment <= -0.5 ? 'Consistent Protocol Execution' : comp.adherence.adjustment <= 0 ? 'Good Protocol Adherence' : 'Protocol Gaps Detected',
      impact: comp.adherence.adjustment,
      detail: `${comp.adherence.pct}% adherence · ${(comp.adherence.weight * 100).toFixed(0)}% weight`,
      category: comp.adherence.adjustment <= 0 ? 'positive' : 'negative',
    })

    // Fitness
    items.push({
      key: 'fitness',
      label: comp.fitness.adjustment <= -1 ? 'Elite Activity Volume' : comp.fitness.adjustment <= 0 ? 'Active Lifestyle' : 'Insufficient Movement',
      impact: comp.fitness.adjustment,
      detail: `${comp.fitness.weeklyMin}min/week · ${(comp.fitness.weight * 100).toFixed(0)}% weight`,
      category: comp.fitness.adjustment <= 0 ? 'positive' : 'negative',
    })

    // Biomarkers — show individual markers if available
    if (comp.biomarkers.breakdown && comp.biomarkers.breakdown.length > 0) {
      const markerLabels: Record<string, string> = {
        crp: 'CRP Inflammation', hba1c: 'HbA1c Glucose Control',
        vitaminD: 'Vitamin D Levels', testosteroneTotal: 'Testosterone',
        ferritin: 'Ferritin / Iron', apoB: 'ApoB Cardiovascular',
        homocysteine: 'Homocysteine', triglycerides: 'Triglycerides',
      }
      for (const m of comp.biomarkers.breakdown.slice(0, 3)) {
        items.push({
          key: m.key,
          label: markerLabels[m.key] || m.key,
          impact: m.impact,
          detail: `Value: ${m.value} · Score: ${(m.score * 100).toFixed(0)}%`,
          category: m.impact <= 0 ? 'positive' : 'negative',
        })
      }
    } else if (comp.biomarkers.count === 0) {
      items.push({
        key: 'biomarkers',
        label: 'No Lab Data Available',
        impact: 0,
        detail: 'Upload labs to unlock biomarker scoring',
        category: 'negative',
      })
    }

    // Sort: biggest positive impact first, then biggest negative
    items.sort((a, b) => a.impact - b.impact)

    return items
  }, [viveAge])

  // Top 3 positive + top 3 negative
  const topPositive = useMemo(() => contributors.filter(c => c.category === 'positive').slice(0, 3), [contributors])
  const topNegative = useMemo(() => contributors.filter(c => c.category === 'negative').slice(0, 3), [contributors])

  // Loading state
  if (!viveAge) {
    return (
      <div style={{
        padding: '24px 16px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(59,130,246,0.04)',
          border: '1px solid rgba(59,130,246,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 40, border: '2px solid rgba(59,130,246,0.08)',
            borderTopColor: C.blue, borderRadius: '50%',
            animation: 'bio-gauge-spin 0.8s linear infinite',
          }} />
        </div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.12em' }}>
          COMPUTING BIOLOGICAL AGE…
        </div>
        <style>{`@keyframes bio-gauge-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const [statusColor, glowColor] = getStatusGradient(viveAge.delta)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ padding: '20px 16px' }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, padding: '0 4px',
      }}>
        <div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: C.blueBright, letterSpacing: '0.15em', textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            VIVE AGE™
          </div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: C.text }}>
            Biological Age Index
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 8,
          background: `${glowColor}`,
          border: `1px solid ${statusColor}22`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: statusColor,
            boxShadow: `0 0 8px ${statusColor}`,
            animation: 'bio-pulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
            color: statusColor, letterSpacing: '0.05em',
          }}>
            {viveAge.status}
          </span>
        </div>
      </div>

      {/* Gauge Card */}
      <div style={{
        background: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.borderBlue}`,
        padding: '24px 16px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, ${statusColor}08 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Circular Gauge */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <GaugeRing
            bioAge={viveAge.viveAge}
            chronoAge={viveAge.chronologicalAge}
            delta={viveAge.delta}
            statusColor={statusColor}
            glowColor={glowColor}
            confidence={viveAge.confidence}
            fluctuation={fluctuation}
          />
        </div>

        {/* Confidence bar */}
        <div style={{ marginTop: 8, padding: '0 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.08em' }}>
              DATA CONFIDENCE
            </span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textSec, fontWeight: 600 }}>
              {viveAge.confidence}%
            </span>
          </div>
          <div style={{
            height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
            overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${viveAge.confidence}%` }}
              transition={{ duration: 1.2, delay: 0.3 }}
              style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`,
              }}
            />
          </div>
        </div>

        {/* 7-Day Sparkline */}
        {viveAge.history && viveAge.history.length >= 2 && (
          <div style={{ marginTop: 16, padding: '0 20px' }}>
            <AgeTrendSparkline history={viveAge.history} />
          </div>
        )}

        {/* Component weights mini-bar */}
        <div style={{
          display: 'flex', gap: 3, marginTop: 16, padding: '0 20px',
        }}>
          {[
            { label: 'HRV', w: 25, adj: viveAge.components.hrv.adjustment },
            { label: 'BIO', w: 25, adj: viveAge.components.biomarkers.adjustment },
            { label: 'SLP', w: 20, adj: viveAge.components.sleep.adjustment },
            { label: 'ADH', w: 15, adj: viveAge.components.adherence.adjustment },
            { label: 'FIT', w: 15, adj: viveAge.components.fitness.adjustment },
          ].map((seg) => {
            const segColor = seg.adj <= -1 ? C.green : seg.adj <= 0 ? C.blue : C.orange
            return (
              <div key={seg.label} style={{ flex: seg.w, textAlign: 'center' }}>
                <div style={{
                  height: 4, borderRadius: 2,
                  background: `${segColor}44`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: segColor,
                    opacity: 0.7,
                    borderRadius: 2,
                  }} />
                </div>
                <div style={{
                  fontSize: 7, fontFamily: 'monospace', color: C.textTer,
                  marginTop: 3, letterSpacing: '0.05em',
                }}>
                  {seg.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* What's Moving the Needle */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
          color: C.blueBright, letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 12, padding: '0 4px',
        }}>
          ⚡ WHAT&apos;S MOVING THE NEEDLE
        </div>

        {/* Positive contributors */}
        {topPositive.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', color: C.green,
              letterSpacing: '0.08em', marginBottom: 6, padding: '0 4px',
              fontWeight: 600,
            }}>
              ▼ MAKING YOU YOUNGER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topPositive.map((item, i) => (
                <ContributorRow key={item.key} item={item} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Negative contributors */}
        {topNegative.length > 0 && (
          <div>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', color: C.orange,
              letterSpacing: '0.08em', marginBottom: 6, padding: '0 4px',
              fontWeight: 600, marginTop: topPositive.length > 0 ? 10 : 0,
            }}>
              ▲ AGING YOU FASTER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topNegative.map((item, i) => (
                <ContributorRow key={item.key} item={item} index={i + topPositive.length} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {contributors.length === 0 && (
          <div style={{
            padding: '20px 16px', textAlign: 'center',
            background: 'rgba(59,130,246,0.04)', borderRadius: 12,
            border: '1px solid rgba(59,130,246,0.08)',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🧬</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.textSec }}>
              Log more data to unlock needle movers
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, marginTop: 4 }}>
              HRV · Sleep · Labs · Protocols · Activity
            </div>
          </div>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes bio-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </motion.div>
  )
}
