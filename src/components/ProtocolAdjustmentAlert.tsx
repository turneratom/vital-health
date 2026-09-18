import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceElevated: 'rgba(18,18,24,0.92)',
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

const SEVERITY_CONFIG = {
  early_warning: {
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.2)',
    bgGrad: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)',
    pulseColor: 'rgba(245,158,11,0.08)',
    label: 'EARLY WARNING',
  },
  accelerating: {
    color: '#E8976C',
    glow: 'rgba(232,151,108,0.2)',
    border: 'rgba(232,151,108,0.25)',
    bgGrad: 'linear-gradient(135deg, rgba(232,151,108,0.08) 0%, rgba(232,151,108,0.02) 100%)',
    pulseColor: 'rgba(232,151,108,0.1)',
    label: 'ACCELERATING DECLINE',
  },
  critical_decline: {
    color: '#FF6B6B',
    glow: 'rgba(255,107,107,0.25)',
    border: 'rgba(255,107,107,0.3)',
    bgGrad: 'linear-gradient(135deg, rgba(255,107,107,0.1) 0%, rgba(255,107,107,0.03) 100%)',
    pulseColor: 'rgba(255,107,107,0.12)',
    label: 'CRITICAL DECLINE',
  },
  nominal: {
    color: CC.accent,
    glow: 'rgba(0,255,204,0.1)',
    border: 'rgba(0,255,204,0.15)',
    bgGrad: 'linear-gradient(135deg, rgba(0,255,204,0.04) 0%, transparent 100%)',
    pulseColor: 'rgba(0,255,204,0.05)',
    label: 'NOMINAL',
  },
}

/* ── Trend Sparkline ── */
function TrendSparkline({ dataPoints, color, metric }: {
  dataPoints: Array<{ date: string; value: number }>;
  color: string;
  metric: string;
}) {
  if (dataPoints.length < 2) return null

  const width = 120
  const height = 36
  const padding = 4
  const values = dataPoints.map((d) => d.value)
  const min = Math.min(...values) * 0.9
  const max = Math.max(...values) * 1.1
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`
  const areaD = `${pathD} L ${padding + ((values.length - 1) / (values.length - 1)) * (width - padding * 2)},${height - padding} L ${padding},${height - padding} Z`

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`trend-fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#trend-fill-${metric})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* End dot */}
        {values.length > 0 && (
          <circle
            cx={padding + ((values.length - 1) / (values.length - 1)) * (width - padding * 2)}
            cy={height - padding - ((values[values.length - 1] - min) / range) * (height - padding * 2)}
            r={3}
            fill={color}
          />
        )}
      </svg>
    </div>
  )
}

/* ── Intervention Card ── */
function InterventionCard({ intervention, index, onAccept }: {
  intervention: {
    id: string; category: string; title: string; description: string;
    timing: string; duration?: string; dosage?: string;
    priority: string; icon: string; accentColor: string; evidenceBasis: string;
  };
  index: number;
  onAccept: (id: string, title: string, category: string) => void;
}) {
  const [accepted, setAccepted] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)

  const priorityBadge = {
    immediate: { label: 'NOW', color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
    tonight: { label: 'TONIGHT', color: '#AF82FF', bg: 'rgba(175,130,255,0.12)' },
    tomorrow: { label: 'TOMORROW', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  }[intervention.priority] || { label: 'SUGGESTED', color: CC.textSec, bg: 'rgba(255,255,255,0.05)' }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
      style={{
        background: accepted ? 'rgba(0,220,130,0.06)' : CC.surfaceElevated,
        border: `1px solid ${accepted ? 'rgba(0,220,130,0.2)' : `${intervention.accentColor}15`}`,
        borderRadius: 14,
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent line */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: accepted ? CC.green : intervention.accentColor,
        borderRadius: '3px 0 0 3px',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${intervention.accentColor}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {accepted ? '✅' : intervention.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
              color: accepted ? CC.green : CC.text,
              letterSpacing: '0.02em',
              textDecoration: accepted ? 'line-through' : 'none',
              opacity: accepted ? 0.7 : 1,
            }}>
              {intervention.title}
            </span>
          </div>

          {/* Priority + timing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: priorityBadge.color, background: priorityBadge.bg,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.1em',
            }}>
              {priorityBadge.label}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer }}>
              {intervention.timing}
            </span>
            {intervention.dosage && (
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.accent, background: 'rgba(0,255,204,0.08)',
                padding: '2px 6px', borderRadius: 4,
              }}>
                {intervention.dosage}
              </span>
            )}
            {intervention.duration && (
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.electricBlueBright, background: 'rgba(59,130,246,0.08)',
                padding: '2px 6px', borderRadius: 4,
              }}>
                {intervention.duration}
              </span>
            )}
          </div>

          {/* Description */}
          <p style={{
            fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
            lineHeight: 1.5, margin: 0, marginBottom: 8,
          }}>
            {intervention.description}
          </p>

          {/* Evidence toggle */}
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
              padding: 0, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 7 }}>📚</span>
            {showEvidence ? 'HIDE EVIDENCE' : 'VIEW EVIDENCE'}
          </button>

          <AnimatePresence>
            {showEvidence && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: 6, padding: '6px 8px', borderRadius: 6,
                  background: 'rgba(59,130,246,0.04)',
                  border: '1px solid rgba(59,130,246,0.08)',
                }}>
                  <p style={{
                    fontSize: 9, fontFamily: 'monospace', color: CC.electricBlueBright,
                    lineHeight: 1.4, margin: 0, fontStyle: 'italic',
                  }}>
                    {intervention.evidenceBasis}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accept button */}
        {!accepted && (
          <button
            onClick={() => {
              setAccepted(true)
              onAccept(intervention.id, intervention.title, intervention.category)
            }}
            style={{
              background: `${intervention.accentColor}15`,
              border: `1px solid ${intervention.accentColor}30`,
              borderRadius: 8, padding: '6px 10px',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${intervention.accentColor}25`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${intervention.accentColor}15`
            }}
          >
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: intervention.accentColor, letterSpacing: '0.05em' }}>
              ACCEPT
            </span>
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PROTOCOL ADJUSTMENT ALERT
   
   Proactive "Operating System" alert that appears on the home
   screen when 3+ days of declining HRV or sleep are detected.
   Shows trend sparklines, AI-generated interventions, and
   projected recovery timeline.
   ══════════════════════════════════════════════════════════════ */

export default function ProtocolAdjustmentAlert() {
  const sessionId = getTwinSessionId()

  const alert = useQuery(api.predictiveRecovery.getPredictiveRecoveryAlert, { sessionId })
  const dismissAlert = useMutation(api.predictiveRecovery.dismissPredictiveAlert)
  const acceptInterventionMut = useMutation(api.predictiveRecovery.acceptIntervention)

  const [isDismissed, setIsDismissed] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [acceptedCount, setAcceptedCount] = useState(0)

  if (!alert || !alert.active || isDismissed) return null

  const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.nominal

  const handleDismiss = async () => {
    setIsDismissed(true)
    try {
      await dismissAlert({ sessionId })
    } catch { /* silent */ }
  }

  const handleAcceptIntervention = async (id: string, title: string, category: string) => {
    setAcceptedCount((c) => c + 1)
    try {
      await acceptInterventionMut({ sessionId, interventionId: id, interventionTitle: title, category })
    } catch { /* silent */ }
  }

  const hrvTrend = alert.trends.find((t: any) => t.metric === 'hrv')
  const sleepTrend = alert.trends.find((t: any) => t.metric === 'sleep')

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{
        margin: '16px 16px 0',
        borderRadius: 20,
        background: sev.bgGrad,
        border: `1px solid ${sev.border}`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Animated pulse background */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 20% 30%, ${sev.pulseColor} 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '16px 18px 12px',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            {/* Severity badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: sev.color,
                  boxShadow: `0 0 8px ${sev.glow}`,
                }}
              />
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                color: sev.color, letterSpacing: '0.15em',
              }}>
                {sev.label} • PROTOCOL ADJUSTMENT
              </span>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.textTer, letterSpacing: '0.05em',
              }}>
                {alert.interventions.length} INTERVENTIONS
              </span>
            </div>

            {/* Headline */}
            <h3 style={{
              fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
              color: CC.text, margin: 0, marginBottom: 4,
              letterSpacing: '-0.01em',
            }}>
              {alert.headline}
            </h3>

            {/* Subheadline */}
            <p style={{
              fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
              margin: 0, lineHeight: 1.5, maxWidth: 340,
            }}>
              {alert.subheadline}
            </p>
          </div>

          {/* Dismiss / Collapse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); handleDismiss() }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 12, color: CC.textTer,
              }}
              title="Dismiss for 12 hours"
            >
              ✕
            </motion.button>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: CC.textTer,
              }}
            >
              ▼
            </motion.div>
          </div>
        </div>

        {/* Trend sparklines row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          {hrvTrend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>
                  HRV • {hrvTrend.consecutiveDays}d DECLINE
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: sev.color }}>
                    {hrvTrend.latestValue}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.red }}>
                    ↓{hrvTrend.totalDeclinePercent}%
                  </span>
                </div>
              </div>
              <TrendSparkline dataPoints={hrvTrend.dataPoints} color={sev.color} metric="hrv" />
            </div>
          )}
          {sleepTrend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>
                  SLEEP • {sleepTrend.consecutiveDays}d DECLINE
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: '#818CF8' }}>
                    {sleepTrend.latestValue}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.red }}>
                    ↓{sleepTrend.totalDeclinePercent}%
                  </span>
                </div>
              </div>
              <TrendSparkline dataPoints={sleepTrend.dataPoints} color="#818CF8" metric="sleep" />
            </div>
          )}

          {/* Recovery projection */}
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>
              EST. RECOVERY
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: CC.accent }}>
                {alert.projectedRecoveryDays}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer }}>
                days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded interventions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* Divider */}
            <div style={{
              height: 1, margin: '0 18px',
              background: `linear-gradient(90deg, transparent, ${sev.border}, transparent)`,
            }} />

            {/* AI attribution */}
            <div style={{
              padding: '10px 18px 6px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: 12 }}
              >
                🧠
              </motion.div>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                color: CC.electricBlueBright, letterSpacing: '0.05em',
              }}>
                AI BRAIN — AUTO-GENERATED PROTOCOL ADJUSTMENTS
              </span>
              {acceptedCount > 0 && (
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.green, background: 'rgba(0,220,130,0.1)',
                  padding: '2px 6px', borderRadius: 4, marginLeft: 'auto',
                }}>
                  {acceptedCount}/{alert.interventions.length} ACCEPTED
                </span>
              )}
            </div>

            {/* Intervention cards */}
            <div style={{ padding: '6px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alert.interventions.map((intervention: any, i: number) => (
                <InterventionCard
                  key={intervention.id}
                  intervention={intervention}
                  index={i}
                  onAccept={handleAcceptIntervention}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 18px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                letterSpacing: '0.05em',
              }}>
                Auto-dismissed in 12h • Based on {alert.trends.reduce((s: number, t: any) => s + t.consecutiveDays, 0)} days of data
              </span>
              <button
                onClick={handleDismiss}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8, padding: '5px 12px',
                  cursor: 'pointer',
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  color: CC.textSec, letterSpacing: '0.05em',
                }}
              >
                DISMISS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyframe for pulse */}
      <style>{`
        @keyframes pa-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </motion.div>
  )
}
