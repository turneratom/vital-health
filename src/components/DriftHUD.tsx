import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ══════════════════════════════════════════════════════════════
   DRIFT HUD — Urgent Intervention Mini-Module
   
   Compact, high-visibility module that surfaces Biological Drift
   alerts directly on the dashboard. Shows:
   • Active drift signals with severity + consecutive-day count
   • Mini sparkline showing the declining trajectory
   • One-tap Accept/Dismiss for each intervention
   • Proximity glow effect that intensifies with severity
   
   Design: Matches Vive 4.0 command-center aesthetic — dark glass
   surfaces, monospace data, pulsing severity indicators.
   ══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceElevated: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  purple: '#A78BFA',
  blue: '#3B82F6',
  border: 'rgba(255,255,255,0.06)',
}

const SEVERITY_STYLES = {
  critical: { color: '#FF6B6B', glow: 'rgba(255,107,107,0.3)', bg: 'rgba(255,107,107,0.08)', label: 'CRITICAL', pulse: 1.2 },
  high: { color: '#E8976C', glow: 'rgba(232,151,108,0.2)', bg: 'rgba(232,151,108,0.06)', label: 'HIGH', pulse: 1.8 },
  moderate: { color: '#3B82F6', glow: 'rgba(59,130,246,0.15)', bg: 'rgba(59,130,246,0.05)', label: 'MODERATE', pulse: 2.5 },
} as const

type Severity = keyof typeof SEVERITY_STYLES

/* ── Mini Sparkline — shows declining trajectory ── */
function MiniSparkline({ dataPoints, color, width = 80, height = 28 }: {
  dataPoints: Array<{ value: number; timestamp: number }>
  color: string
  width?: number
  height?: number
}) {
  if (dataPoints.length < 2) return null

  const sorted = [...dataPoints].sort((a, b) => a.timestamp - b.timestamp)
  const values = sorted.map((d) => d.value)
  const min = Math.min(...values) - 5
  const max = Math.max(...values) + 5
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest point dot */}
      {values.length > 0 && (
        <circle
          cx={width}
          cy={height - ((values[values.length - 1] - min) / range) * height}
          r="2.5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
    </svg>
  )
}

/* ── Drift Signal Card ── */
function DriftSignalCard({
  signal,
  onAccept,
  onDismiss,
  isProcessing,
}: {
  signal: {
    id: string
    metric: string
    metricLabel: string
    currentValue: number
    baselineValue: number
    deviationPct: number
    consecutiveDays: number
    severity: string
    trend: string
    intervention: {
      type: string
      title: string
      subtitle: string
      description: string
      icon: string
      durationMinutes: number
      accentColor: string
      priority: string
    }
    dataPoints: Array<{ value: number; timestamp: number }>
  }
  onAccept: () => void
  onDismiss: () => void
  isProcessing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY_STYLES[(signal.severity as Severity)] ?? SEVERITY_STYLES.moderate
  const inv = signal.intervention

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      style={{
        background: CC.surfaceElevated,
        borderRadius: 14,
        border: `1px solid ${sev.color}20`,
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'relative',
      }}
    >
      {/* Severity accent bar */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, ${sev.color}, ${sev.color}00)`,
      }} />

      {/* Proximity glow overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        background: `radial-gradient(ellipse at top left, ${sev.glow}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          position: 'relative',
        }}
      >
        {/* Pulsing severity dot */}
        <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: sev.pulse, repeat: Infinity }}
            style={{
              position: 'absolute',
              inset: -3,
              borderRadius: '50%',
              border: `1.5px solid ${sev.color}`,
            }}
          />
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: sev.bg,
            border: `1px solid ${sev.color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}>
            {inv.icon}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{
              fontSize: 8,
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: sev.color,
              background: `${sev.color}15`,
              padding: '1px 5px',
              borderRadius: 3,
            }}>
              {sev.label}
            </span>
            <span style={{
              fontSize: 8,
              fontFamily: 'monospace',
              color: CC.textTer,
              letterSpacing: '0.05em',
            }}>
              {signal.consecutiveDays}d DRIFT
            </span>
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: CC.text,
            lineHeight: 1.2,
            marginBottom: 1,
          }}>
            {signal.metricLabel}
          </div>
          <div style={{
            fontSize: 9,
            color: CC.textSec,
            fontFamily: 'monospace',
          }}>
            {signal.currentValue} → was {signal.baselineValue} ({signal.trend})
          </div>
        </div>

        {/* Sparkline */}
        <div style={{ flexShrink: 0 }}>
          <MiniSparkline
            dataPoints={signal.dataPoints}
            color={sev.color}
            width={60}
            height={24}
          />
        </div>

        {/* Deviation badge */}
        <div style={{
          flexShrink: 0,
          textAlign: 'center',
          padding: '4px 8px',
          borderRadius: 8,
          background: `${sev.color}10`,
          border: `1px solid ${sev.color}20`,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            fontFamily: 'monospace',
            color: sev.color,
            lineHeight: 1,
          }}>
            ↓{signal.deviationPct}%
          </div>
          <div style={{
            fontSize: 7,
            color: CC.textTer,
            fontFamily: 'monospace',
            marginTop: 1,
          }}>
            DEVIATION
          </div>
        </div>
      </div>

      {/* Expanded intervention detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 12px 12px',
              borderTop: `1px solid ${CC.border}`,
              marginTop: 0,
              paddingTop: 10,
            }}>
              {/* Intervention title */}
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: inv.accentColor,
                marginBottom: 4,
              }}>
                {inv.title}
              </div>
              <div style={{
                fontSize: 9,
                color: CC.textSec,
                marginBottom: 6,
                fontFamily: 'monospace',
              }}>
                {inv.subtitle}
              </div>
              <div style={{
                fontSize: 10,
                color: CC.textSec,
                lineHeight: 1.5,
                marginBottom: 10,
              }}>
                {inv.description}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); onAccept(); }}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: `linear-gradient(135deg, ${inv.accentColor}, ${inv.accentColor}CC)`,
                    color: '#000',
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                >
                  {isProcessing ? 'ACTIVATING...' : `ACCEPT · ${inv.durationMinutes >= 1440 ? `${Math.round(inv.durationMinutes / 1440)}d` : `${inv.durationMinutes}min`}`}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  disabled={isProcessing}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${CC.border}`,
                    background: 'transparent',
                    color: CC.textTer,
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                  }}
                >
                  DISMISS
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DRIFT HUD — Main Export
   ═══════════════════════════════════════════════════════════════ */

export default function DriftHUD({ sessionId }: { sessionId: string }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [processingId, setProcessingId] = useState<string | null>(null)

  const driftData = useQuery(api.biologicalDrift.detectBiologicalDrift, { sessionId })
  const acceptIntervention = useMutation(api.biologicalDrift.acceptDriftIntervention)
  const dismissDrift = useMutation(api.biologicalDrift.dismissDriftSignal)

  const activeSignals = (driftData?.driftSignals ?? []).filter(
    (s) => !dismissedIds.has(s.id)
  )

  const handleAccept = useCallback(async (signal: typeof activeSignals[0]) => {
    setProcessingId(signal.id)
    try {
      await acceptIntervention({
        sessionId,
        driftMetric: signal.metric,
        interventionType: signal.intervention.type,
        title: signal.intervention.title,
        subtitle: signal.intervention.subtitle,
        description: signal.intervention.description,
        icon: signal.intervention.icon,
        durationMinutes: signal.intervention.durationMinutes,
        priority: signal.intervention.priority,
        accentColor: signal.intervention.accentColor,
        deviationPct: signal.deviationPct,
        currentValue: signal.currentValue,
        baselineValue: signal.baselineValue,
      })
      setDismissedIds((prev) => new Set([...prev, signal.id]))
    } catch (err) {
      console.error('[DriftHUD] Accept failed:', err)
    } finally {
      setProcessingId(null)
    }
  }, [sessionId, acceptIntervention])

  const handleDismiss = useCallback(async (signal: typeof activeSignals[0]) => {
    setProcessingId(signal.id)
    try {
      await dismissDrift({ sessionId, driftMetric: signal.metric })
      setDismissedIds((prev) => new Set([...prev, signal.id]))
    } catch (err) {
      console.error('[DriftHUD] Dismiss failed:', err)
    } finally {
      setProcessingId(null)
    }
  }, [sessionId, dismissDrift])

  if (!driftData || activeSignals.length === 0) return null

  const worstSev = SEVERITY_STYLES[(driftData.worstSeverity as Severity)] ?? SEVERITY_STYLES.moderate

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: CC.surface,
        borderRadius: 18,
        border: `1px solid ${worstSev.color}15`,
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        position: 'relative',
      }}
    >
      {/* Top glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        background: `radial-gradient(ellipse at top center, ${worstSev.glow}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Pulsing beacon */}
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <motion.div
              animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: worstSev.pulse, repeat: Infinity }}
              style={{
                position: 'absolute',
                inset: -3,
                borderRadius: '50%',
                background: worstSev.color,
              }}
            />
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: worstSev.color,
              boxShadow: `0 0 8px ${worstSev.glow}`,
            }} />
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.12em',
            color: worstSev.color,
          }}>
            BIOLOGICAL DRIFT
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            fontSize: 8,
            fontFamily: 'monospace',
            color: CC.textTer,
            letterSpacing: '0.05em',
          }}>
            {activeSignals.length} SIGNAL{activeSignals.length > 1 ? 'S' : ''}
          </span>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: `${worstSev.color}15`,
            border: `1px solid ${worstSev.color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            fontFamily: 'monospace',
            color: worstSev.color,
          }}>
            {activeSignals.length}
          </div>
        </div>
      </div>

      {/* System status line */}
      <div style={{
        padding: '0 16px 8px',
        fontSize: 9,
        color: CC.textSec,
        fontFamily: 'monospace',
        lineHeight: 1.4,
      }}>
        {driftData.systemStatus}
      </div>

      {/* Drift signal cards */}
      <div style={{
        padding: '0 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <AnimatePresence mode="popLayout">
          {activeSignals.map((signal) => (
            <DriftSignalCard
              key={signal.id}
              signal={signal}
              onAccept={() => handleAccept(signal)}
              onDismiss={() => handleDismiss(signal)}
              isProcessing={processingId === signal.id}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom scan timestamp */}
      <div style={{
        padding: '6px 16px 10px',
        borderTop: `1px solid ${CC.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          color: CC.textTer,
          letterSpacing: '0.05em',
        }}>
          LAST SCAN {new Date(driftData.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          color: CC.textTer,
        }}>
          VIVE DRIFT ENGINE v4.0
        </span>
      </div>
    </motion.div>
  )
}
