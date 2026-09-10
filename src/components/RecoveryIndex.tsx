import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Design Tokens ── */
const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  purple: '#AF82FF',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

function getTier(score: number) {
  if (score >= 80) return { label: 'PEAK', color: CC.accent, glow: 'rgba(0,255,204,0.35)', bg: 'rgba(0,255,204,0.06)' }
  if (score >= 60) return { label: 'READY', color: CC.electricBlue, glow: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.06)' }
  if (score >= 40) return { label: 'MODERATE', color: CC.orange, glow: 'rgba(232,151,108,0.25)', bg: 'rgba(232,151,108,0.06)' }
  return { label: 'DEPLETED', color: CC.red, glow: 'rgba(255,107,107,0.25)', bg: 'rgba(255,107,107,0.06)' }
}

function useCountUp(target: number, duration = 1600, delay = 300): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef(0)
  useEffect(() => {
    const startTime = performance.now() + delay
    function tick(now: number) {
      if (now < startTime) { rafRef.current = requestAnimationFrame(tick); return }
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, delay, duration])
  return value
}

function RecoveryRing({ score, size = 180 }: { score: number; size?: number }) {
  const displayScore = useCountUp(score)
  const tier = getTier(displayScore)
  const finalTier = getTier(score)
  const center = size / 2
  const strokeWidth = 8
  const r = (size - 48) / 2
  const circumference = 2 * Math.PI * r
  const arcSpan = 270
  const startAngle = 135
  const arcLength = circumference * (arcSpan / 360)
  const gapLength = circumference - arcLength
  const pct = Math.min(displayScore / 100, 1)
  const filledLength = arcLength * pct
  const unfilledLength = arcLength - filledLength + gapLength

  const ticks = useMemo(() => {
    const count = 60
    return Array.from({ length: count + 1 }, (_, i) => {
      const angle = startAngle + (i / count) * arcSpan
      const rad = (angle * Math.PI) / 180
      const isMajor = i % 10 === 0
      const tickLen = isMajor ? 10 : 4
      const outerR = r + 14
      const innerR = outerR - tickLen
      return {
        x1: center + innerR * Math.cos(rad), y1: center + innerR * Math.sin(rad),
        x2: center + outerR * Math.cos(rad), y2: center + outerR * Math.sin(rad),
        isMajor, isLit: (i / count) <= pct,
      }
    })
  }, [center, r, pct])

  const endAngle = startAngle + pct * arcSpan
  const endRad = (endAngle * Math.PI) / 180
  const dotX = center + r * Math.cos(endRad)
  const dotY = center + r * Math.sin(endRad)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute rounded-full"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ inset: '15%', background: `radial-gradient(circle, ${finalTier.glow} 0%, transparent 70%)`, filter: 'blur(25px)' }}
      />
      <svg width={size} height={size} className="relative z-10" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="recoveryArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={finalTier.color} />
            <stop offset="50%" stopColor={CC.accent} />
            <stop offset="100%" stopColor={finalTier.color} />
          </linearGradient>
          <filter id="recoveryGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isLit ? (t.isMajor ? finalTier.color : `${finalTier.color}88`) : 'rgba(255,255,255,0.06)'}
            strokeWidth={t.isMajor ? 1.5 : 0.8} strokeLinecap="round" />
        ))}
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth} strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={-circumference * (startAngle / 360)} strokeLinecap="round" />
        <circle cx={center} cy={center} r={r} fill="none" stroke="url(#recoveryArcGrad)"
          strokeWidth={strokeWidth} strokeDasharray={`${filledLength} ${unfilledLength}`}
          strokeDashoffset={-circumference * (startAngle / 360)} strokeLinecap="round"
          filter="url(#recoveryGlow)" style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        {pct > 0.02 && <circle cx={dotX} cy={dotY} r={5} fill={finalTier.color} filter="url(#recoveryGlow)" />}
        <text x={center} y={center - 12} textAnchor="middle" dominantBaseline="central"
          fill={CC.text} fontSize={42} fontWeight={700} fontFamily="monospace" style={{ letterSpacing: '-0.02em' }}>
          {displayScore}
        </text>
        <text x={center} y={center + 20} textAnchor="middle" dominantBaseline="central"
          fill={tier.color} fontSize={10} fontWeight={700} fontFamily="monospace" style={{ letterSpacing: '0.2em' }}>
          {tier.label}
        </text>
        <text x={center} y={center + 36} textAnchor="middle" dominantBaseline="central"
          fill={CC.textTer} fontSize={8} fontFamily="monospace" style={{ letterSpacing: '0.1em' }}>
          RECOVERY INDEX
        </text>
      </svg>
    </div>
  )
}

function BreakdownBar({ label, value, weight, color, icon }: {
  label: string; value: number; weight: string; color: string; icon: string;
}) {
  const displayVal = useCountUp(value, 1200, 500)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: CC.text, letterSpacing: '0.05em' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color }}>{displayVal}</span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>{weight}</span>
          </div>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${displayVal}%` }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
            style={{ height: '100%', borderRadius: 2, background: color }} />
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ rec, index }: {
  rec: { icon: string; title: string; description: string; priority: string; accentColor: string }; index: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.8 + index * 0.15 }}
      style={{
        background: 'rgba(14,14,18,0.7)', border: `1px solid ${rec.accentColor}18`,
        borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
        backdropFilter: 'blur(12px)',
      }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: `${rec.accentColor}12`,
        border: `1px solid ${rec.accentColor}20`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 15, flexShrink: 0,
      }}>{rec.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: rec.accentColor, letterSpacing: '0.03em', marginBottom: 3 }}>
          {rec.title}
        </div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: CC.textSec, lineHeight: 1.5 }}>
          {rec.description}
        </div>
      </div>
      {rec.priority === 'high' && (
        <div style={{
          fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: CC.red,
          letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4,
          background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.15)',
          flexShrink: 0, marginTop: 2,
        }}>URGENT</div>
      )}
    </motion.div>
  )
}

export default function RecoveryIndex() {
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('vive-session-id') || 'guest-user' : 'guest-user'
  const data = useQuery(api.recoveryIndex.getRecoveryIndex, { sessionId })
  const [expanded, setExpanded] = useState(false)

  const score = data?.score ?? 0
  const tierColor = data?.tierColor ?? CC.electricBlue
  const breakdown = data?.breakdown
  const recommendations = data?.recommendations ?? []

  if (data === undefined) {
    return (
      <div style={{ background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 16, padding: 24, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(59,130,246,0.08)', borderTopColor: CC.electricBlue, borderRadius: '50%', animation: 'ri-spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: CC.electricBlueBright, letterSpacing: '0.15em', textTransform: 'uppercase' }}>CALCULATING RECOVERY</div>
        <style>{`@keyframes ri-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{ background: CC.surface, border: `1px solid ${tierColor}12`, borderRadius: 16, overflow: 'hidden', backdropFilter: 'blur(24px)' }}>
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierColor, boxShadow: `0 0 8px ${tierColor}60` }} />
          <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: CC.text, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Recovery Index</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{
          fontSize: 8, fontFamily: 'monospace', fontWeight: 600, color: CC.electricBlueBright,
          letterSpacing: '0.1em', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)',
          borderRadius: 6, padding: '3px 8px', cursor: 'pointer', textTransform: 'uppercase',
        }}>{expanded ? 'COLLAPSE' : 'DETAILS'}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
        <RecoveryRing score={score} size={180} />
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 18px 12px' }}>
              <div style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: CC.textTer, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>COMPONENT BREAKDOWN</div>
              <BreakdownBar label="Sleep Quality" value={breakdown?.sleepScore ?? 0} weight="40%" color={CC.purple} icon="😴" />
              <BreakdownBar label="HRV Trend" value={breakdown?.hrvScore ?? 0} weight="25%" color={CC.electricBlue} icon="💓" />
              <BreakdownBar label="Protocol Adherence" value={breakdown?.adherenceScore ?? 0} weight="20%" color={CC.green} icon="📋" />
              <BreakdownBar label="Somatic Feedback" value={breakdown?.somaticScore ?? 0} weight="15%" color={CC.orange} icon="🧠" />
              {breakdown?.hrvTrend && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px',
                  background: breakdown.hrvTrend === 'improving' ? 'rgba(0,220,130,0.06)' : breakdown.hrvTrend === 'declining' ? 'rgba(255,107,107,0.06)' : 'rgba(59,130,246,0.06)',
                  border: `1px solid ${breakdown.hrvTrend === 'improving' ? 'rgba(0,220,130,0.12)' : breakdown.hrvTrend === 'declining' ? 'rgba(255,107,107,0.12)' : 'rgba(59,130,246,0.12)'}`,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12 }}>{breakdown.hrvTrend === 'improving' ? '📈' : breakdown.hrvTrend === 'declining' ? '📉' : '➡️'}</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: breakdown.hrvTrend === 'improving' ? CC.green : breakdown.hrvTrend === 'declining' ? CC.red : CC.electricBlueBright, letterSpacing: '0.08em' }}>
                    HRV {breakdown.hrvTrend.toUpperCase()}{breakdown.hrvRaw !== null && ` — ${breakdown.hrvRaw}ms`}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: CC.textTer, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0 4px' }}>TACTICAL RECOMMENDATIONS</div>
        {recommendations.map((rec, i) => <RecommendationCard key={i} rec={rec} index={i} />)}
      </div>
    </motion.div>
  )
}
