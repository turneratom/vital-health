import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   DAILY VECTOR — AI-Powered Status + Action Orbits
   
   Single-glance intelligence layer replacing traditional dashboards.
   • One primary Status verdict with AI-generated message
   • Three Action Orbits — the top 3 critical actions for today
   • Deep, dark, premium aesthetic with orbital animations
   ═══════════════════════════════════════════════════════════════ */

const V = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceElevated: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  textQuad: 'rgba(255,255,255,0.12)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.20)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.15)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
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

const urgencyMeta = {
  critical: { color: V.red, glow: V.redGlow, label: 'CRITICAL', ring: '#FF6B6B' },
  high: { color: V.orange, glow: V.orangeGlow, label: 'HIGH', ring: '#E8976C' },
  moderate: { color: V.blue, glow: V.blueGlow, label: 'MODERATE', ring: '#3B82F6' },
}

/* ── Status Pulse Ring ── */
function StatusPulseRing({ color, score }: { color: string; score: number | null }) {
  const r = 44
  const c = 2 * Math.PI * r
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0
  const offset = c - (pct / 100) * c

  return (
    <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <filter id="dv-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke={V.border} strokeWidth="3" />
        {/* Score arc */}
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 50 50)" filter="url(#dv-glow)"
          style={{ transition: 'stroke-dashoffset 1.5s ease, stroke 0.5s ease' }}
        />
        {/* Inner pulse */}
        <circle cx="50" cy="50" r={r - 8} fill="none" stroke={color} strokeWidth="0.5" opacity="0.2">
          <animate attributeName="r" values={`${r - 8};${r - 6};${r - 8}`} dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.35;0.2" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Outer pulse */}
        <circle cx="50" cy="50" r={r + 4} fill="none" stroke={color} strokeWidth="0.3" opacity="0.1">
          <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0.05;0.1" dur="4s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {score != null ? (
          <>
            <span style={{
              fontSize: 24, fontFamily: 'monospace', fontWeight: 900, color: V.text,
              lineHeight: 1, textShadow: `0 0 16px ${color}40`,
            }}>
              {score}
            </span>
            <span style={{
              fontSize: 6, fontFamily: 'monospace', color: V.textTer,
              letterSpacing: '0.2em', marginTop: 2,
            }}>
              VITALITY
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 16, opacity: 0.4 }}>◉</span>
            <span style={{
              fontSize: 6, fontFamily: 'monospace', color: V.textTer,
              letterSpacing: '0.15em', marginTop: 1,
            }}>
              SYNCING
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Single Action Orbit Card ── */
function OrbitCard({
  orbit,
  index,
  onExecute,
}: {
  orbit: { id: string; icon: string; category: string; title: string; detail: string; urgency: 'critical' | 'high' | 'moderate'; reason: string }
  index: number
  onExecute?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = urgencyMeta[orbit.urgency]

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={() => setExpanded(!expanded)}
      style={{
        background: V.surface,
        border: `1px solid ${meta.color}18`,
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -20, left: -10, width: 80, height: 80,
        borderRadius: '50%', background: meta.glow, filter: 'blur(30px)',
        pointerEvents: 'none', opacity: 0.6,
      }} />

      {/* Orbit number ring */}
      <div style={{
        position: 'absolute', top: 12, right: 14,
        width: 22, height: 22, borderRadius: '50%',
        border: `1.5px solid ${meta.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 900, color: meta.color,
        }}>
          {index + 1}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${meta.color}10`, border: `1px solid ${meta.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {orbit.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
          {/* Urgency badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '1px 6px', borderRadius: 4, marginBottom: 4,
            background: `${meta.color}12`, border: `1px solid ${meta.color}20`,
          }}>
            <div style={{
              width: 4, height: 4, borderRadius: '50%', background: meta.color,
              boxShadow: `0 0 4px ${meta.color}`,
            }} />
            <span style={{
              fontSize: 7, fontFamily: 'monospace', fontWeight: 800,
              color: meta.color, letterSpacing: '0.1em',
            }}>
              {meta.label}
            </span>
          </div>

          {/* Title */}
          <div style={{
            fontSize: 12, fontFamily: 'monospace', fontWeight: 800,
            color: V.text, lineHeight: 1.3, marginBottom: 4,
          }}>
            {orbit.title}
          </div>

          {/* Detail */}
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: V.textSec,
            lineHeight: 1.5,
          }}>
            {orbit.detail}
          </div>

          {/* Expanded: reason + execute */}
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
                  marginTop: 8, paddingTop: 8,
                  borderTop: `1px solid ${V.border}`,
                }}>
                  <div style={{
                    fontSize: 8, fontFamily: 'monospace', color: V.textTer,
                    lineHeight: 1.5, marginBottom: 8,
                  }}>
                    ⚡ {orbit.reason}
                  </div>
                  {onExecute && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onExecute(orbit.id) }}
                      style={{
                        padding: '5px 14px', borderRadius: 8, border: `1px solid ${meta.color}40`,
                        background: `${meta.color}12`, color: meta.color,
                        fontSize: 9, fontFamily: 'monospace', fontWeight: 800,
                        letterSpacing: '0.08em', cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      EXECUTE →
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Biomarker Micro-Flags ── */
function BiomarkerFlags({ flags }: { flags: Array<{ key: string; label: string; value: number; status: string }> }) {
  if (flags.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {flags.map((f) => {
        const color = f.status === 'critical' ? V.red : f.status === 'suboptimal' ? V.orange : V.green
        return (
          <div key={f.key} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6,
            background: `${color}08`, border: `1px solid ${color}15`,
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
            <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: V.textSec }}>
              {f.label}
            </span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 900, color }}>
              {f.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Signal Strength Indicator ── */
function SignalStrength({ signals }: { signals: number }) {
  const bars = Math.min(5, Math.max(1, Math.ceil(signals / 6)))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{
          width: 3, height: 4 + i * 2.5, borderRadius: 1,
          background: i < bars ? V.accent : V.border,
          transition: 'background 0.3s',
          boxShadow: i < bars ? `0 0 3px ${V.accentGlow}` : 'none',
        }} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DAILY VECTOR — Main Export
   ═══════════════════════════════════════════════════════════════ */

export default function DailyVector() {
  const sessionId = useMemo(() => getSessionId(), [])
  const vector = useQuery(api.dailyVector.getDailyVector, { sessionId })
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const generateAI = useAction(api.dailyVector.generateAIStatus)

  // Auto-generate AI status on mount
  useEffect(() => {
    if (vector && !aiStatus && !aiLoading) {
      setAiLoading(true)
      generateAI({ sessionId }).then((res) => {
        setAiStatus(res.aiStatus)
      }).catch(() => {}).finally(() => setAiLoading(false))
    }
  }, [vector, sessionId])

  const handleExecute = useCallback((orbitId: string) => {
    // Dispatch to ProtocolMasterHUD via custom event
    window.dispatchEvent(new CustomEvent('vive:execute-orbit', { detail: { orbitId } }))
  }, [])

  if (vector === undefined) {
    return <DailyVectorLoader />
  }

  if (!vector) {
    return (
      <div style={{
        padding: '24px 12px', maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 200, gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>🧬</div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: V.text }}>
          Daily Vector Unavailable
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: V.textTer, textAlign: 'center', maxWidth: 260 }}>
          Seed biometric data to initialize your Daily Vector intelligence.
        </div>
      </div>
    )
  }

  const displayStatus = aiStatus || vector.statusDetail

  return (
    <div style={{ padding: '0 12px', maxWidth: 480, margin: '0 auto' }}>
      <style>{`
        @keyframes dv-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes dv-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dv-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 0 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${vector.statusColor}12`, border: `1px solid ${vector.statusColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            ◉
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: V.text, letterSpacing: '0.02em' }}>
              Daily Vector
            </div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: V.textTer, letterSpacing: '0.1em' }}>
              INTELLIGENCE LAYER
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SignalStrength signals={vector.dataSignals} />
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: V.textTer }}>
            {vector.dataSignals} signals
          </span>
        </div>
      </motion.div>

      {/* ── Status Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          background: V.surface,
          border: `1px solid ${vector.statusColor}15`,
          borderRadius: 16,
          padding: '18px 18px 16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', background: `${vector.statusColor}08`,
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          <StatusPulseRing color={vector.statusColor} score={vector.vitalityScore} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Status badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 6, marginBottom: 8,
              background: `${vector.statusColor}12`, border: `1px solid ${vector.statusColor}25`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: vector.statusColor,
                boxShadow: `0 0 8px ${vector.statusColor}`,
                animation: 'dv-pulse 2s ease-in-out infinite',
              }} />
              <span style={{
                fontSize: 10, fontFamily: 'monospace', fontWeight: 900,
                color: vector.statusColor, letterSpacing: '0.1em',
              }}>
                {vector.status.toUpperCase()}
              </span>
            </div>

            {/* AI Status Message */}
            <div style={{
              fontSize: 11, fontFamily: 'monospace', color: V.text,
              lineHeight: 1.6, fontWeight: 500,
              ...(aiLoading ? {
                background: `linear-gradient(90deg, ${V.textSec}, ${V.text}, ${V.textSec})`,
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'dv-shimmer 2s linear infinite',
              } : {}),
            }}>
              {aiLoading ? 'Analyzing biological state...' : displayStatus}
            </div>

            {/* Micro stats */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {vector.hrvCurrent != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 8, color: V.textTer, fontFamily: 'monospace' }}>HRV</span>
                  <span style={{
                    fontSize: 10, fontFamily: 'monospace', fontWeight: 900,
                    color: vector.hrvCurrent >= 50 ? V.green : vector.hrvCurrent >= 35 ? V.orange : V.red,
                  }}>
                    {vector.hrvCurrent}ms
                  </span>
                </div>
              )}
              {vector.sleepHours != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 8, color: V.textTer, fontFamily: 'monospace' }}>SLEEP</span>
                  <span style={{
                    fontSize: 10, fontFamily: 'monospace', fontWeight: 900,
                    color: vector.sleepHours >= 7.5 ? V.green : vector.sleepHours >= 6.5 ? V.orange : V.red,
                  }}>
                    {vector.sleepHours.toFixed(1)}h
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 8, color: V.textTer, fontFamily: 'monospace' }}>ADHERENCE</span>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', fontWeight: 900,
                  color: vector.protocolAdherence.rate >= 0.8 ? V.green : vector.protocolAdherence.rate >= 0.5 ? V.orange : V.red,
                }}>
                  {Math.round(vector.protocolAdherence.rate * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Biomarker Flags ── */}
      {vector.biomarkerFlags.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: 10 }}
        >
          <BiomarkerFlags flags={vector.biomarkerFlags} />
        </motion.div>
      )}

      {/* ── Action Orbits ── */}
      {vector.actionOrbits.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 5,
              border: `1px solid ${V.borderBlue}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                border: `1px solid ${V.accent}40`,
                animation: 'dv-orbit 8s linear infinite',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 3, height: 3, borderRadius: '50%', background: V.accent,
                }} />
              </div>
            </div>
            <span style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 800,
              color: V.textSec, letterSpacing: '0.12em',
            }}>
              ACTION ORBITS
            </span>
            <span style={{
              fontSize: 7, fontFamily: 'monospace', color: V.textTer,
            }}>
              Top {vector.actionOrbits.length} priorities
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vector.actionOrbits.map((orbit, i) => (
              <OrbitCard
                key={orbit.id}
                orbit={orbit}
                index={i}
                onExecute={handleExecute}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty Orbits State ── */}
      {vector.actionOrbits.length === 0 && vector.dataSignals >= 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            marginTop: 14, padding: '20px 16px',
            background: V.surface, border: `1px solid ${V.green}15`,
            borderRadius: 14, textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
          <div style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
            color: V.green, letterSpacing: '0.08em', marginBottom: 4,
          }}>
            ALL SYSTEMS NOMINAL
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: V.textTer,
            lineHeight: 1.5,
          }}>
            No critical actions required — maintain current protocol cadence
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ── Loading State ── */
function DailyVectorLoader() {
  return (
    <div style={{
      padding: '24px 12px', maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 200, gap: 16,
    }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{
          width: 56, height: 56, border: `2px solid ${V.border}`,
          borderTopColor: V.accent, borderRadius: '50%',
          animation: 'dv-orbit 0.8s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 10,
          border: `2px solid ${V.border}`,
          borderBottomColor: V.blue, borderRadius: '50%',
          animation: 'dv-orbit 1.2s linear infinite reverse',
        }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: V.accent, letterSpacing: '0.18em', marginBottom: 4,
        }}>
          COMPUTING DAILY VECTOR
        </div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: V.textTer }}>
          Aggregating biological signals...
        </div>
      </div>
    </div>
  )
}
