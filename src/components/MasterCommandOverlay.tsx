import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   MASTER COMMAND OVERLAY
   
   Accessible via long-press on the Biological Twin.
   Shows a high-level Biological Drift summary with one
   "Critical Correction" button. Executing the correction
   triggers a full-screen "System Optimized" haptic visual.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.96)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.12)',
  accentGlow: 'rgba(0,255,204,0.30)',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.25)',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  gold: '#FFD700',
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

/* ── Correction Protocols by drift type ── */
const CORRECTIONS: Record<string, { command: string; dose: string; icon: string; color: string }> = {
  neural_drive: { command: 'Administer Creatine 5g + Lion\'s Mane 1g', dose: 'Restores prefrontal ATP + NGF production', icon: '⚡', color: '#A78BFA' },
  core_temp: { command: 'Initiate Thermoregulation Protocol', dose: 'Evening cool-down + thyroid axis support', icon: '🌡️', color: '#F97316' },
  gut_status: { command: 'Deploy Gut Barrier Repair Stack', dose: 'L-Glutamine 5g + BPC-157 250mcg', icon: '🫁', color: '#22C55E' },
  joint_mobility: { command: 'Activate Joint Recovery Protocol', dose: 'TB-500 500mcg + Omega-3 3g', icon: '🦴', color: '#06B6D4' },
  mental_clarity: { command: 'Execute Clarity Emergency Stack', dose: 'Alpha-GPC 600mg + 5min breathwork', icon: '🧠', color: '#3B82F6' },
  energy_flux: { command: 'Initiate Mitochondrial Energy Reset', dose: 'CoQ10 200mg + extra rest day', icon: '🔋', color: '#EAB308' },
  hrv: { command: 'Restore Vagal Tone Immediately', dose: 'Cold face immersion + gargling + sleep extension', icon: '💓', color: '#FF6B6B' },
  sleep: { command: 'Repair Sleep Architecture Tonight', dose: 'Mag Glycinate 400mg + 9pm screen-off', icon: '🌙', color: '#6B8AFF' },
  adherence: { command: 'Simplify Protocol Stack for 48h', dose: 'Reduce to top-3 highest-impact protocols', icon: '🎯', color: '#E8976C' },
  default: { command: 'Take 2g Taurine to Normalize Heart Rate', dose: 'Stabilizes cardiac rhythm + reduces cortisol', icon: '💊', color: T.accent },
}

/* ── System Optimized Full-Screen Visual ── */
function SystemOptimizedVisual({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3200)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[500] flex items-center justify-center"
      onClick={onComplete}
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(30px)' }}
    >
      {/* Expanding ring pulse */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 0.3, opacity: 0.8 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 2, delay: i * 0.4, ease: 'easeOut' }}
          style={{
            position: 'absolute', width: 120, height: 120, borderRadius: '50%',
            border: `2px solid ${T.accent}`,
            boxShadow: `0 0 40px ${T.accentGlow}, inset 0 0 20px ${T.accentGlow}`,
          }}
        />
      ))}

      {/* Central glow burst */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.8] }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.accentGlow} 0%, rgba(0,255,204,0.05) 50%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* Gold shimmer lines */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`line-${i}`}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 0], opacity: [0, 0.6, 0] }}
          transition={{ duration: 1.5, delay: 0.8 + i * 0.08, ease: 'easeInOut' }}
          style={{
            position: 'absolute', width: '80vw', height: 1,
            background: `linear-gradient(90deg, transparent, ${T.gold}80, transparent)`,
            transform: `rotate(${i * 22.5}deg)`,
            transformOrigin: 'center',
          }}
        />
      ))}

      {/* Central content */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}
      >
        {/* Checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
            background: `radial-gradient(circle, ${T.accent}20, transparent)`,
            border: `2px solid ${T.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 40px ${T.accentGlow}, 0 0 80px rgba(0,255,204,0.1)`,
          }}
        >
          <motion.svg
            width="32" height="32" viewBox="0 0 24 24" fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.0, duration: 0.6 }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke={T.accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            />
          </motion.svg>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          style={{
            fontSize: 11, fontFamily: 'monospace', fontWeight: 800,
            color: T.accent, letterSpacing: '0.25em',
            textTransform: 'uppercase', marginBottom: 8,
            textShadow: `0 0 20px ${T.accentGlow}`,
          }}
        >
          SYSTEM OPTIMIZED
        </motion.div>

        {/* Subtitle */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 500,
            color: T.textSec, letterSpacing: '0.05em',
            maxWidth: 260, margin: '0 auto', lineHeight: 1.5,
          }}
        >
          Critical correction deployed. Your biological vectors are recalibrating to optimal baseline.
        </motion.div>

        {/* Fade hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 0.5 }}
          style={{
            fontSize: 8, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.1em', marginTop: 24,
          }}
        >
          TAP TO DISMISS
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MASTER COMMAND OVERLAY — Main Component
   ═══════════════════════════════════════════════════════════════ */
interface MasterCommandOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export default function MasterCommandOverlay({ isOpen, onClose }: MasterCommandOverlayProps) {
  const sessionId = useMemo(() => getSessionId(), [])
  const driftData = useQuery(api.biologicalDrift.detectBiologicalDrift, isOpen ? { sessionId } : 'skip')
  const acceptIntervention = useMutation(api.biologicalDrift.acceptDriftIntervention)
  const [executing, setExecuting] = useState(false)
  const [showOptimized, setShowOptimized] = useState(false)

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) { setExecuting(false); setShowOptimized(false) }
  }, [isOpen])

  // Compute drift summary
  const driftPct = useMemo(() => {
    if (!driftData || driftData.totalDrifts === 0) return 0
    const avgDev = driftData.driftSignals.reduce((s, d) => s + d.deviationPct, 0) / driftData.driftSignals.length
    return Math.min(Math.round(avgDev), 30)
  }, [driftData])

  // Pick the most critical drift signal for the correction
  const primaryDrift = driftData?.driftSignals?.[0] ?? null
  const correction = primaryDrift
    ? (CORRECTIONS[primaryDrift.metric] ?? CORRECTIONS.default)
    : CORRECTIONS.default

  const handleExecuteCorrection = useCallback(async () => {
    if (executing) return
    setExecuting(true)

    try {
      if (primaryDrift) {
        await acceptIntervention({
          sessionId,
          driftMetric: primaryDrift.metric,
          interventionType: primaryDrift.intervention.type,
          title: primaryDrift.intervention.title,
          subtitle: primaryDrift.intervention.subtitle,
          description: primaryDrift.intervention.description,
          icon: primaryDrift.intervention.icon,
          durationMinutes: primaryDrift.intervention.durationMinutes,
          priority: primaryDrift.intervention.priority,
          accentColor: primaryDrift.intervention.accentColor,
          deviationPct: primaryDrift.deviationPct,
          currentValue: primaryDrift.currentValue,
          baselineValue: primaryDrift.baselineValue,
        })
      }
    } catch { /* proceed anyway */ }

    // Trigger System Optimized visual
    setShowOptimized(true)
  }, [executing, primaryDrift, acceptIntervention, sessionId])

  const handleOptimizedComplete = useCallback(() => {
    setShowOptimized(false)
    onClose()
  }, [onClose])

  if (!isOpen && !showOptimized) return null

  const isNominal = !driftData || driftData.totalDrifts === 0
  const severityColor = driftData?.hasCritical ? T.red : driftPct > 8 ? T.orange : T.accent
  const severityLabel = driftData?.hasCritical ? 'CRITICAL' : driftPct > 8 ? 'ELEVATED' : 'MINOR'

  return (
    <>
      {/* System Optimized full-screen visual */}
      <AnimatePresence>
        {showOptimized && (
          <SystemOptimizedVisual onComplete={handleOptimizedComplete} />
        )}
      </AnimatePresence>

      {/* Master Command Overlay */}
      <AnimatePresence>
        {isOpen && !showOptimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[400] flex items-end justify-center"
            onClick={onClose}
          >
            {/* Backdrop */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(24px)',
            }} />

            {/* Scanning ambient glow */}
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                width: 300, height: 300, borderRadius: '50%',
                background: `radial-gradient(circle, ${severityColor}15 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />

            {/* Content panel */}
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative', zIndex: 10, width: '100%', maxWidth: 420,
                margin: '0 16px 32px',
                background: T.surface,
                border: `1px solid ${T.borderBlue}`,
                borderRadius: 24, overflow: 'hidden',
              }}
            >
              {/* Header bar */}
              <div style={{
                padding: '16px 20px 12px',
                borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isNominal ? T.accent : severityColor,
                    boxShadow: `0 0 12px ${isNominal ? T.accentGlow : severityColor}40`,
                  }}
                />
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 800,
                  color: T.accent, letterSpacing: '0.2em',
                }}>
                  MASTER COMMAND
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                    fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                    color: T.textTer, letterSpacing: '0.08em',
                  }}
                >
                  ESC
                </button>
              </div>

              {/* Drift Summary */}
              <div style={{ padding: '20px 20px 16px' }}>
                {isNominal ? (
                  /* All systems nominal */
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{
                        fontSize: 40, marginBottom: 12,
                        filter: 'drop-shadow(0 0 12px rgba(0,255,204,0.3))',
                      }}
                    >
                      ✅
                    </motion.div>
                    <div style={{
                      fontSize: 12, fontFamily: 'monospace', fontWeight: 800,
                      color: T.accent, letterSpacing: '0.12em', marginBottom: 6,
                    }}>
                      ALL VECTORS NOMINAL
                    </div>
                    <div style={{
                      fontSize: 10, fontFamily: 'monospace', color: T.textSec,
                      lineHeight: 1.5, maxWidth: 280, margin: '0 auto',
                    }}>
                      No biological drift detected. Your protocol adherence is maintaining optimal baseline across all somatic channels.
                    </div>
                  </div>
                ) : (
                  /* Drift detected */
                  <>
                    {/* Big drift percentage */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          style={{
                            fontSize: 42, fontWeight: 900, fontFamily: 'monospace',
                            color: severityColor, lineHeight: 1,
                            textShadow: `0 0 20px ${severityColor}40`,
                          }}
                        >
                          {driftPct}%
                        </motion.div>
                        <div style={{
                          fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                          color: severityColor, letterSpacing: '0.15em', marginTop: 4,
                          opacity: 0.8,
                        }}>
                          OFF-PROTOCOL
                        </div>
                      </div>

                      <div style={{ width: 1, height: 52, background: T.borderBlue }} />

                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                          color: severityColor, letterSpacing: '0.12em', marginBottom: 6,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{
                            padding: '1px 6px', borderRadius: 4,
                            background: `${severityColor}15`,
                            border: `1px solid ${severityColor}30`,
                          }}>
                            {severityLabel}
                          </span>
                          {driftData!.totalDrifts} DRIFT{driftData!.totalDrifts > 1 ? 'S' : ''} DETECTED
                        </div>
                        <div style={{
                          fontSize: 9, fontFamily: 'monospace', color: T.textSec,
                          lineHeight: 1.5,
                        }}>
                          {driftData!.systemStatus}
                        </div>
                      </div>
                    </div>

                    {/* Drift signal list */}
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16,
                    }}>
                      {driftData!.driftSignals.slice(0, 3).map((signal, i) => (
                        <motion.div
                          key={signal.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 10,
                            background: `${signal.severity === 'critical' ? T.red : signal.severity === 'high' ? T.orange : T.blue}08`,
                            border: `1px solid ${signal.severity === 'critical' ? T.red : signal.severity === 'high' ? T.orange : T.blue}20`,
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{signal.intervention.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                              color: T.text, letterSpacing: '0.03em',
                            }}>
                              {signal.metricLabel}
                            </div>
                            <div style={{
                              fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                            }}>
                              {signal.currentValue} → {signal.baselineValue} baseline · {signal.consecutiveDays}d {signal.trend}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 11, fontFamily: 'monospace', fontWeight: 800,
                            color: signal.severity === 'critical' ? T.red : signal.severity === 'high' ? T.orange : T.blue,
                          }}>
                            -{signal.deviationPct}%
                          </span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Critical Correction Button */}
                    <motion.button
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6, duration: 0.4 }}
                      onClick={handleExecuteCorrection}
                      disabled={executing}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: 14,
                        background: executing
                          ? 'rgba(255,255,255,0.04)'
                          : `linear-gradient(135deg, ${correction.color}20, ${correction.color}08)`,
                        border: `1.5px solid ${executing ? T.border : correction.color}40`,
                        cursor: executing ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'all 0.2s',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {/* Shimmer on hover */}
                      {!executing && (
                        <motion.div
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                          style={{
                            position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
                            background: `linear-gradient(90deg, transparent, ${correction.color}10, transparent)`,
                            pointerEvents: 'none',
                          }}
                        />
                      )}

                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `${correction.color}15`,
                        border: `1px solid ${correction.color}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0,
                      }}>
                        {executing ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            style={{
                              width: 18, height: 18, borderRadius: '50%',
                              border: `2px solid ${correction.color}30`,
                              borderTopColor: correction.color,
                            }}
                          />
                        ) : correction.icon}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{
                          fontSize: 8, fontFamily: 'monospace', fontWeight: 800,
                          color: correction.color, letterSpacing: '0.12em',
                          marginBottom: 3,
                        }}>
                          CRITICAL CORRECTION
                        </div>
                        <div style={{
                          fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                          color: T.text, lineHeight: 1.3,
                        }}>
                          {correction.command}
                        </div>
                        <div style={{
                          fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                          marginTop: 2,
                        }}>
                          {correction.dose}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 16, color: executing ? T.textTer : correction.color,
                        flexShrink: 0,
                      }}>
                        {executing ? '⏳' : '→'}
                      </div>
                    </motion.button>
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 20px 16px',
                borderTop: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: T.textTer,
                }} />
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                  fontWeight: 600, letterSpacing: '0.08em',
                }}>
                  LONG-PRESS BIOLOGICAL TWIN TO ACCESS
                </span>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: T.textTer,
                }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
