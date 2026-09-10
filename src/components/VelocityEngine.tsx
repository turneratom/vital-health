import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  computeLongevityVelocity,
  buildVelocityInputFromBioData,
  type VelocityVector,
  type VelocityAlert,
} from '@/utils/LongevityVelocity'

/* ── HUD Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceElevated: 'rgba(18,18,24,0.96)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  blueMuted: 'rgba(59,130,246,0.08)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.12)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  gold: '#FFD700',
  purple: '#A78BFA',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id')
    if (!id) { id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('vive-session-id', id) }
    return id
  } catch { return 'guest-user' }
}

/* ═══════════════════════════════════════════════════════════════
   VELOCITY GAUGE — Animated arc gauge with vector arrow
   ═══════════════════════════════════════════════════════════════ */

function VelocityGauge({ magnitude, direction, uiMode }: {
  magnitude: number
  direction: string
  uiMode: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const currentAngle = useRef(0)

  const getColor = useCallback(() => {
    if (uiMode === 'optimization') return T.red
    if (uiMode === 'alert') return T.orange
    if (magnitude >= 50) return T.accent
    if (magnitude >= 20) return T.green
    return T.blue
  }, [magnitude, uiMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 180
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = 72
    const startAngle = Math.PI * 0.75
    const endAngle = Math.PI * 2.25
    const totalArc = endAngle - startAngle

    // Target angle based on magnitude (-100 to +100 → 0 to 1)
    const normalizedMag = (magnitude + 100) / 200
    const targetAngle = startAngle + totalArc * normalizedMag

    const color = getColor()

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, size, size)

      // Ease toward target
      currentAngle.current += (targetAngle - currentAngle.current) * 0.06

      // Background arc
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.stroke()

      // Tick marks
      for (let i = 0; i <= 20; i++) {
        const angle = startAngle + (totalArc * i) / 20
        const innerR = i % 5 === 0 ? radius - 14 : radius - 8
        const outerR = radius - 4
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR)
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'
        ctx.lineWidth = i % 5 === 0 ? 1.5 : 0.8
        ctx.stroke()
      }

      // Active arc with gradient
      const grad = ctx.createLinearGradient(
        cx + Math.cos(startAngle) * radius,
        cy + Math.sin(startAngle) * radius,
        cx + Math.cos(currentAngle.current) * radius,
        cy + Math.sin(currentAngle.current) * radius,
      )
      grad.addColorStop(0, 'rgba(59,130,246,0.3)')
      grad.addColorStop(1, color)

      ctx.beginPath()
      const arcEnd = Math.max(startAngle, Math.min(endAngle, currentAngle.current))
      ctx.arc(cx, cy, radius, startAngle, arcEnd)
      ctx.strokeStyle = grad
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.stroke()

      // Glow on active arc tip
      const tipX = cx + Math.cos(arcEnd) * radius
      const tipY = cy + Math.sin(arcEnd) * radius
      const glow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 16)
      glow.addColorStop(0, color + '60')
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(tipX - 16, tipY - 16, 32, 32)

      // Needle
      const needleLen = radius - 20
      const needleX = cx + Math.cos(currentAngle.current) * needleLen
      const needleY = cy + Math.sin(currentAngle.current) * needleLen
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(needleX, needleY)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.stroke()

      // Center dot
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      // Inner glow
      const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40)
      innerGlow.addColorStop(0, color + '15')
      innerGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = innerGlow
      ctx.beginPath()
      ctx.arc(cx, cy, 40, 0, Math.PI * 2)
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [magnitude, getColor])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

/* ═══════════════════════════════════════════════════════════════
   VELOCITY SPARKLINE — 7-day trend mini chart
   ═══════════════════════════════════════════════════════════════ */

function VelocitySparkline({ data, color, width = 120, height = 32 }: {
  data: number[]
  color: string
  width?: number
  height?: number
}) {
  if (data.length < 2) return null

  const min = Math.min(...data, -10)
  const max = Math.max(...data, 10)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  const zeroY = height - padding - ((0 - min) / range) * (height - padding * 2)

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Zero line */}
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY}
        stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="2,2" />
      {/* Fill area */}
      <polygon
        points={`${padding},${zeroY} ${points.join(' ')} ${width - padding},${zeroY}`}
        fill={color + '10'}
      />
      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (() => {
        const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)
        const lastY = height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)
        return <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
      })()}
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT SIGNAL BAR — Individual signal strength indicator
   ═══════════════════════════════════════════════════════════════ */

function SignalBar({ label, value, icon }: {
  label: string
  value: number // -1 to +1
  icon: string
}) {
  const pct = Math.round((value + 1) / 2 * 100)
  const color = value >= 0.3 ? T.green : value >= -0.1 ? T.blue : value >= -0.4 ? T.orange : T.red

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span style={{ fontSize: 11, width: 16, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 3,
        }}>
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
            color: T.textSec, letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>{label}</span>
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color, letterSpacing: '0.02em',
          }}>
            {value >= 0 ? '+' : ''}{(value * 100).toFixed(0)}
          </span>
        </div>
        <div style={{
          height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', borderRadius: 2, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ALERT CARD — Velocity alert with action button
   ═══════════════════════════════════════════════════════════════ */

function AlertCard({ alert, onAction }: {
  alert: VelocityAlert
  onAction?: () => void
}) {
  const severityConfig = {
    critical: { color: T.red, glow: T.redGlow, icon: '🔴', bg: 'rgba(255,107,107,0.06)' },
    warning: { color: T.orange, glow: T.orangeGlow, icon: '🟡', bg: 'rgba(232,151,108,0.06)' },
    info: { color: T.blue, glow: T.blueGlow, icon: '🔵', bg: 'rgba(59,130,246,0.06)' },
  }
  const cfg = severityConfig[alert.severity]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '10px 12px',
        background: cfg.bg,
        border: `1px solid ${cfg.color}15`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ fontSize: 10 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
          color: cfg.color, lineHeight: 1.4,
        }}>{alert.message}</div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          style={{
            padding: '4px 10px', fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
            color: cfg.color, background: cfg.color + '15',
            border: `1px solid ${cfg.color}25`, borderRadius: 6,
            cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >{alert.actionLabel}</button>
      )}
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   OPTIMIZATION MODE OVERLAY — High-alert layout shift
   ═══════════════════════════════════════════════════════════════ */

function OptimizationOverlay({ velocity, onDismiss }: {
  velocity: VelocityVector
  onDismiss: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(10,10,11,0.85)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Pulsing border */}
      <motion.div
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: 'absolute', inset: 0,
          border: `2px solid ${T.red}30`,
          borderRadius: 0, pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          maxWidth: 400, width: '100%',
          background: T.surfaceElevated,
          border: `1px solid ${T.red}20`,
          borderRadius: 20, padding: 28,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ fontSize: 28, marginBottom: 8 }}
          >⚡</motion.div>
          <div style={{
            fontSize: 11, fontFamily: 'monospace', fontWeight: 800,
            color: T.red, letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 4,
          }}>OPTIMIZATION MODE</div>
          <div style={{
            fontSize: 10, fontFamily: 'monospace', color: T.textSec,
            lineHeight: 1.5,
          }}>{velocity.sublabel}</div>
        </div>

        {/* Velocity reading */}
        <div style={{
          textAlign: 'center', padding: '16px 0',
          borderTop: `1px solid ${T.border}`,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{
            fontSize: 40, fontFamily: 'monospace', fontWeight: 800,
            color: T.red, lineHeight: 1,
          }}>
            {velocity.magnitude}
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.1em', marginTop: 4,
          }}>VELOCITY VECTOR</div>
        </div>

        {/* Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {velocity.alerts.slice(0, 3).map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>

        {/* Estimated impact */}
        <div style={{
          padding: '12px 16px', background: 'rgba(255,107,107,0.04)',
          borderRadius: 10, border: `1px solid ${T.red}10`,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
          }}>PROJECTED AGING RATE</div>
          <div style={{
            fontSize: 16, fontFamily: 'monospace', fontWeight: 800,
            color: velocity.velocityPerYear < 0 ? T.red : T.green,
          }}>
            {velocity.velocityPerYear >= 0 ? '+' : ''}{velocity.velocityPerYear} yrs/yr
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: T.textTer, marginTop: 2,
          }}>
            {velocity.velocityPerYear < 0
              ? 'Aging faster than chronological rate'
              : 'Aging slower than chronological rate'}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            padding: '10px 20px', fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
            color: T.text, background: T.red + '20',
            border: `1px solid ${T.red}30`, borderRadius: 10,
            cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
        >
          Acknowledge & Begin Recovery
        </button>
      </motion.div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT: VelocityEngine Component
   
   High-fidelity hero metric that combines biological age,
   biomarker trends, and protocol adherence into one moving vector.
   ═══════════════════════════════════════════════════════════════ */

export default function VelocityEngine({ compact = false }: { compact?: boolean }) {
  const sessionId = useMemo(() => getSessionId(), [])
  const [showOptimization, setShowOptimization] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Fetch bio data
  const bioMetrics = useQuery(api.bioVaultMetrics.getBioMetrics, { sessionId })
  const weeklyDebrief = useQuery(api.bioVaultMetrics.getWeeklyDebrief, { sessionId })

  // Compute velocity
  const velocity = useMemo<VelocityVector>(() => {
    const input = buildVelocityInputFromBioData({
      vault: bioMetrics?.vault ? {
        ...bioMetrics.vault,
        // Map additional fields from weekly debrief
        ...(weeklyDebrief?.blood?.markers || {}),
      } : undefined,
      sleepHistory: bioMetrics?.sleepHistory,
      hrvHistory: bioMetrics?.hrvHistory,
      adherenceRecords: weeklyDebrief?.missions ? [{
        adherencePercent: weeklyDebrief.missions.avgAdherence ?? 50,
        updatedAt: Date.now(),
      }] : [],
    })
    return computeLongevityVelocity(input)
  }, [bioMetrics, weeklyDebrief])

  // Trigger optimization mode on regression
  useEffect(() => {
    if (velocity.uiMode === 'optimization' && !dismissed) {
      const timer = setTimeout(() => setShowOptimization(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [velocity.uiMode, dismissed])

  const handleDismissOptimization = useCallback(() => {
    setShowOptimization(false)
    setDismissed(true)
  }, [])

  // Color based on mode
  const primaryColor = velocity.uiMode === 'optimization' ? T.red
    : velocity.uiMode === 'alert' ? T.orange
    : velocity.magnitude >= 50 ? T.accent
    : velocity.magnitude >= 20 ? T.green
    : T.blue

  const directionIcon = velocity.direction === 'forward' ? '↗' : velocity.direction === 'stalled' ? '→' : '↘'

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setExpanded(!expanded)}
        style={{
          background: T.surface,
          border: `1px solid ${primaryColor}15`,
          borderRadius: 14, padding: '12px 16px',
          cursor: 'pointer', transition: 'all 0.3s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Velocity number */}
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: primaryColor + '10',
            border: `1px solid ${primaryColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <span style={{
              fontSize: 16, fontFamily: 'monospace', fontWeight: 800,
              color: primaryColor, lineHeight: 1,
            }}>{velocity.magnitude > 0 ? '+' : ''}{velocity.magnitude}</span>
            <span style={{ fontSize: 7, color: T.textTer, fontFamily: 'monospace' }}>V</span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                color: primaryColor, letterSpacing: '0.08em',
              }}>{velocity.label.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: primaryColor }}>{directionIcon}</span>
            </div>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', color: T.textTer,
              marginTop: 2,
            }}>
              {velocity.velocityPerYear >= 0 ? '+' : ''}{velocity.velocityPerYear} yrs/yr
            </div>
          </div>

          <VelocitySparkline data={velocity.trend7d} color={primaryColor} width={64} height={24} />
        </div>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', marginTop: 12 }}
            >
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                <SignalBar label="Bio-Age" value={velocity.bioAgeDelta} icon="🧬" />
                <SignalBar label="Biomarkers" value={velocity.biomarkerMomentum} icon="🩸" />
                <SignalBar label="Adherence" value={velocity.adherenceMomentum} icon="✅" />
                <SignalBar label="Recovery" value={velocity.recoverySignal} icon="💚" />
              </div>
              {velocity.alerts.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {velocity.alerts.slice(0, 2).map((a, i) => (
                    <AlertCard key={i} alert={a} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // Full hero metric view
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: T.surface,
          border: `1px solid ${primaryColor}12`,
          borderRadius: 20,
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: `radial-gradient(circle, ${primaryColor}08 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚡</span>
            <span style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 800,
              color: T.textSec, letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>LONGEVITY VELOCITY</span>
          </div>
          <div style={{
            padding: '3px 8px', borderRadius: 6,
            background: primaryColor + '12',
            border: `1px solid ${primaryColor}20`,
          }}>
            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: primaryColor, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{velocity.uiMode === 'optimization' ? '⚠ OPTIMIZE' : velocity.uiMode === 'alert' ? 'ALERT' : 'NOMINAL'}</span>
          </div>
        </div>

        {/* Gauge + Stats */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {/* Gauge */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <VelocityGauge
              magnitude={velocity.magnitude}
              direction={velocity.direction}
              uiMode={velocity.uiMode}
            />
            {/* Center overlay */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -40%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <motion.div
                key={velocity.magnitude}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  fontSize: 28, fontFamily: 'monospace', fontWeight: 900,
                  color: primaryColor, lineHeight: 1,
                }}
              >
                {velocity.magnitude > 0 ? '+' : ''}{velocity.magnitude}
              </motion.div>
              <div style={{
                fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                letterSpacing: '0.15em', marginTop: 2,
              }}>VECTOR</div>
            </div>
          </div>

          {/* Right stats */}
          <div style={{ flex: 1, minWidth: 160 }}>
            {/* Label */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 14, fontFamily: 'monospace', fontWeight: 800,
                color: primaryColor, letterSpacing: '0.02em',
              }}>
                {directionIcon} {velocity.label}
              </div>
              <div style={{
                fontSize: 10, fontFamily: 'monospace', color: T.textSec,
                lineHeight: 1.5, marginTop: 4,
              }}>{velocity.sublabel}</div>
            </div>

            {/* Aging rate */}
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              background: primaryColor + '06',
              border: `1px solid ${primaryColor}10`,
              marginBottom: 12,
            }}>
              <div style={{
                fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2,
              }}>AGING RATE</div>
              <div style={{
                fontSize: 18, fontFamily: 'monospace', fontWeight: 800,
                color: velocity.velocityPerYear >= 0 ? T.green : T.red,
              }}>
                {velocity.velocityPerYear >= 0 ? '+' : ''}{velocity.velocityPerYear}
                <span style={{ fontSize: 10, color: T.textTer, marginLeft: 4 }}>yrs/yr</span>
              </div>
            </div>

            {/* 7-day trend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <VelocitySparkline data={velocity.trend7d} color={primaryColor} width={100} height={28} />
              <span style={{
                fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                letterSpacing: '0.05em',
              }}>7D TREND</span>
            </div>
          </div>
        </div>

        {/* Signal bars */}
        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: `1px solid ${T.border}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
        }}>
          <SignalBar label="Bio-Age Delta" value={velocity.bioAgeDelta} icon="🧬" />
          <SignalBar label="Biomarker Trend" value={velocity.biomarkerMomentum} icon="🩸" />
          <SignalBar label="Stack Adherence" value={velocity.adherenceMomentum} icon="✅" />
          <SignalBar label="Recovery Signal" value={velocity.recoverySignal} icon="💚" />
        </div>

        {/* Alerts */}
        {velocity.alerts.length > 0 && (
          <div style={{
            marginTop: 16, paddingTop: 16,
            borderTop: `1px solid ${T.border}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              color: T.textTer, letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 4,
            }}>ACTIVE ALERTS</div>
            {velocity.alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Optimization Mode Overlay */}
      <AnimatePresence>
        {showOptimization && (
          <OptimizationOverlay
            velocity={velocity}
            onDismiss={handleDismissOptimization}
          />
        )}
      </AnimatePresence>
    </>
  )
}
