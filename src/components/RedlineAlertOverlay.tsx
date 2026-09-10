import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   REDLINE ALERT OVERLAY — Critical Threshold HUD Alert
   
   When biomarkers hit redline zones, this overlay:
   • Pulses the screen border red (subtle but unmissable)
   • Shows a high-priority alert card with metric details
   • Displays an AI-generated "Counter-Measure" tactical fix
   • Auto-dismisses after acknowledgment
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  red: '#FF4444',
  redBright: '#FF6B6B',
  redGlow: 'rgba(255,68,68,0.15)',
  redDeep: 'rgba(255,68,68,0.08)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.12)',
  green: '#00DC82',
  teal: '#00FFCC',
}

interface RedlineAlertOverlayProps {
  sessionId: string
}

export default function RedlineAlertOverlay({ sessionId }: RedlineAlertOverlayProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const redlineData = useQuery(api.redlineAlerts.getMyRedlineAlerts, { sessionId })
  const dismissAlert = useMutation(api.redlineAlerts.dismissSquadAlert)

  // Filter out dismissed alerts
  const activeAlerts = redlineData?.alerts.filter(a => !dismissed.has(a._id)) ?? []
  const hasCritical = activeAlerts.some(a => a.severity === 'critical')
  const hasAny = activeAlerts.length > 0

  const handleDismiss = useCallback(async (alertId: string) => {
    setDismissed(prev => new Set(prev).add(alertId))
    try {
      await dismissAlert({ alertId: alertId as any })
    } catch { /* silent */ }
  }, [dismissAlert])

  const handleDismissAll = useCallback(() => {
    for (const a of activeAlerts) {
      handleDismiss(a._id)
    }
  }, [activeAlerts, handleDismiss])

  // Auto-expand the most critical alert
  useEffect(() => {
    if (activeAlerts.length > 0 && !expandedAlert) {
      const critical = activeAlerts.find(a => a.severity === 'critical')
      setExpandedAlert(critical?._id ?? activeAlerts[0]._id)
    }
  }, [activeAlerts, expandedAlert])

  if (!hasAny) return null

  return (
    <>
      {/* ── Screen-edge red pulse (always visible when alerts active) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          pointerEvents: 'none',
        }}
      >
        {/* Vignette red pulse on all edges */}
        <motion.div
          animate={{
            opacity: hasCritical ? [0.15, 0.35, 0.15] : [0.08, 0.18, 0.08],
          }}
          transition={{
            duration: hasCritical ? 1.2 : 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute', inset: 0,
            boxShadow: hasCritical
              ? 'inset 0 0 80px rgba(255,68,68,0.4), inset 0 0 160px rgba(255,68,68,0.15)'
              : 'inset 0 0 60px rgba(245,158,11,0.25), inset 0 0 120px rgba(245,158,11,0.08)',
            borderRadius: 0,
          }}
        />
        {/* Top edge glow line */}
        <motion.div
          animate={{ opacity: hasCritical ? [0.4, 0.8, 0.4] : [0.2, 0.5, 0.2] }}
          transition={{ duration: hasCritical ? 1.2 : 2, repeat: Infinity }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: hasCritical
              ? 'linear-gradient(90deg, transparent, #FF4444, transparent)'
              : 'linear-gradient(90deg, transparent, #F59E0B, transparent)',
          }}
        />
      </motion.div>

      {/* ── Alert Card Stack ── */}
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9998, width: 'min(380px, calc(100vw - 32px))',
        pointerEvents: 'auto',
      }}>
        <AnimatePresence mode="popLayout">
          {activeAlerts.slice(0, 3).map((alert, idx) => {
            const isCritical = alert.severity === 'critical'
            const isExpanded = expandedAlert === alert._id
            const accentColor = isCritical ? T.red : T.amber
            const accentGlow = isCritical ? T.redGlow : T.amberGlow
            const timeSince = Math.round((Date.now() - alert.triggeredAt) / 60000)
            const timeLabel = timeSince < 1 ? 'JUST NOW' : timeSince < 60 ? `${timeSince}m AGO` : `${Math.round(timeSince / 60)}h AGO`

            return (
              <motion.div
                key={alert._id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: idx * 0.05 }}
                onClick={() => setExpandedAlert(isExpanded ? null : alert._id)}
                style={{
                  marginBottom: 8,
                  borderRadius: 16,
                  background: T.surface,
                  border: `1px solid ${accentColor}30`,
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 40px ${accentGlow}`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {/* Pulsing top accent line */}
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: isCritical ? 1 : 2, repeat: Infinity }}
                  style={{
                    height: 2,
                    background: `linear-gradient(90deg, transparent 5%, ${accentColor} 50%, transparent 95%)`,
                  }}
                />

                {/* Header row */}
                <div style={{
                  padding: '10px 14px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Pulsing severity dot */}
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: isCritical ? 0.8 : 1.5, repeat: Infinity }}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: accentColor,
                        boxShadow: `0 0 8px ${accentColor}80, 0 0 16px ${accentGlow}`,
                      }}
                    />
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, fontWeight: 800,
                      color: accentColor,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                    }}>
                      {isCritical ? '🚨 CRITICAL THRESHOLD' : '⚠️ WARNING THRESHOLD'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 7, color: T.textTer, letterSpacing: '0.1em',
                    }}>
                      {timeLabel}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDismiss(alert._id) }}
                      style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: T.textTer, fontSize: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Metric display */}
                <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: `${accentColor}10`,
                    border: `1px solid ${accentColor}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {alert.metricIcon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 13, fontWeight: 700, color: T.text,
                      letterSpacing: '-0.01em',
                    }}>
                      {alert.metricLabel}
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 10, color: T.textSec, marginTop: 2,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ color: accentColor, fontWeight: 700 }}>
                        {alert.currentValue}
                      </span>
                      <span style={{ color: T.textTer }}>
                        {alert.direction === 'above' ? '↑' : '↓'} {alert.thresholdPercent}% from baseline
                      </span>
                      <span style={{ color: T.textTer, opacity: 0.5 }}>
                        (base: {alert.baselineValue})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded: Counter-Measure */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{
                        padding: '0 14px 14px',
                        borderTop: `1px solid ${accentColor}15`,
                        paddingTop: 10,
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                        }}>
                          <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            style={{
                              width: 14, height: 14,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <circle cx="6" cy="6" r="5" stroke={T.teal} strokeWidth="1" strokeDasharray="8 4" strokeLinecap="round" opacity="0.6" />
                            </svg>
                          </motion.div>
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 8, fontWeight: 800,
                            color: T.teal, letterSpacing: '0.2em',
                          }}>
                            COUNTER-MEASURE
                          </span>
                        </div>
                        <div style={{
                          fontFamily: '"Inter", system-ui, sans-serif',
                          fontSize: 11, lineHeight: 1.6,
                          color: T.textSec,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: 'rgba(0,255,204,0.03)',
                          border: '1px solid rgba(0,255,204,0.08)',
                        }}>
                          {alert.localCounterMeasure}
                        </div>
                        <div style={{
                          display: 'flex', gap: 6, marginTop: 8,
                        }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDismiss(alert._id) }}
                            style={{
                              flex: 1, padding: '6px 0', borderRadius: 8,
                              background: `${accentColor}12`,
                              border: `1px solid ${accentColor}25`,
                              color: accentColor,
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: 8, fontWeight: 700,
                              letterSpacing: '0.15em',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            ACKNOWLEDGE
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Dismiss all button when multiple alerts */}
        {activeAlerts.length > 1 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleDismissAll}
            style={{
              width: '100%', padding: '6px 0', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: T.textTer,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 8, fontWeight: 600,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            DISMISS ALL ({activeAlerts.length})
          </motion.button>
        )}
      </div>
    </>
  )
}
