import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE TIMELINE — 90-Day Biomarker Projection Toggle
   
   When toggled ON, biomarker values shift from current to
   projected 90-day values based on protocol adherence.
   If System Stability trend is down, displays a red
   "Biological Age Drift" warning with AI-generated tactical fix.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  orange: '#E8976C',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.15)',
  border: 'rgba(255,255,255,0.05)',
}

function getSessionId(): string {
  try { return localStorage.getItem('vive-session-id') || 'guest-user' } catch { return 'guest-user' }
}

function scoreColor(score: number): string {
  if (score >= 85) return T.teal
  if (score >= 70) return T.green
  if (score >= 50) return T.amber
  if (score >= 30) return T.orange
  return T.red
}

interface PredictiveTimelineProps {
  isActive: boolean
  onToggle: (active: boolean) => void
}

export default function PredictiveTimeline({ isActive, onToggle }: PredictiveTimelineProps) {
  const sessionId = useMemo(() => getSessionId(), [])
  const [driftExpanded, setDriftExpanded] = useState(false)

  const projection = useQuery(
    api.bioForecast.get90DayProjection,
    isActive ? { sessionId } : 'skip'
  )

  const hasData = projection?.hasData ?? false
  const drift = projection?.driftWarning ?? null

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Toggle Switch ── */}
      <button
        onClick={() => onToggle(!isActive)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 10,
          background: isActive
            ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))'
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isActive ? 'rgba(59,130,246,0.25)' : T.border}`,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Toggle track */}
        <div style={{
          width: 32, height: 16, borderRadius: 8,
          background: isActive ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
          position: 'relative',
          transition: 'background 0.3s ease',
        }}>
          <motion.div
            animate={{ x: isActive ? 16 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              background: isActive ? T.blue : 'rgba(255,255,255,0.3)',
              position: 'absolute', top: 1, left: 1,
              boxShadow: isActive ? `0 0 8px ${T.blueGlow}` : 'none',
            }}
          />
        </div>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 8, fontWeight: 700,
          color: isActive ? T.blue : T.textTer,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          PREDICTIVE 90D
        </span>
        {isActive && drift?.active && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: drift.severity === 'critical' ? T.red : T.amber,
              boxShadow: `0 0 6px ${drift.severity === 'critical' ? T.redGlow : T.amberGlow}`,
            }}
          />
        )}
      </button>

      {/* ── Projected Values Panel ── */}
      <AnimatePresence>
        {isActive && hasData && projection && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* Drift Warning Banner */}
            {drift?.active && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '10px 12px', borderRadius: 12, marginBottom: 8,
                  background: drift.severity === 'critical'
                    ? 'linear-gradient(135deg, rgba(255,107,107,0.10), rgba(255,107,107,0.04))'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))',
                  border: `1px solid ${drift.severity === 'critical' ? 'rgba(255,107,107,0.20)' : 'rgba(245,158,11,0.20)'}`,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Pulsing background */}
                <motion.div
                  animate={{ opacity: [0, 0.08, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: drift.severity === 'critical'
                      ? 'radial-gradient(ellipse at 50% 50%, rgba(255,107,107,0.15), transparent 70%)'
                      : 'radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.15), transparent 70%)',
                  }}
                />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ fontSize: 12 }}
                    >
                      ⚠️
                    </motion.span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 9, fontWeight: 800,
                      color: drift.severity === 'critical' ? T.red : T.amber,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}>
                      BIOLOGICAL AGE DRIFT
                    </span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 7, fontWeight: 700,
                      color: drift.severity === 'critical' ? T.red : T.amber,
                      padding: '1px 5px', borderRadius: 4,
                      background: drift.severity === 'critical' ? 'rgba(255,107,107,0.12)' : 'rgba(245,158,11,0.12)',
                      opacity: 0.8,
                    }}>
                      {drift.severity.toUpperCase()}
                    </span>
                  </div>

                  {/* Message */}
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 9, color: T.textSec,
                    lineHeight: 1.5, marginBottom: 8,
                  }}>
                    {drift.message}
                  </div>

                  {/* Tactical Fix */}
                  <button
                    onClick={() => setDriftExpanded(!driftExpanded)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${T.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10 }}>🎯</span>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 8, fontWeight: 700,
                        color: T.teal, letterSpacing: '0.12em',
                      }}>
                        TACTICAL FIX
                      </span>
                      <motion.span
                        animate={{ rotate: driftExpanded ? 180 : 0 }}
                        style={{ marginLeft: 'auto', fontSize: 8, color: T.textTer }}
                      >
                        ▼
                      </motion.span>
                    </div>
                    <AnimatePresence>
                      {driftExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 9, color: T.text,
                            lineHeight: 1.6, marginTop: 6,
                            paddingTop: 6,
                            borderTop: `1px solid ${T.border}`,
                          }}>
                            {drift.tacticalFix}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Composite Score Delta */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${T.border}`,
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 7, fontWeight: 700,
                  color: T.textTer, letterSpacing: '0.15em',
                }}>
                  COMPOSITE
                </span>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 14, fontWeight: 800,
                  color: scoreColor(projection.currentComposite),
                }}>
                  {projection.currentComposite}
                </span>
                <span style={{ fontSize: 10, color: T.textTer }}>→</span>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 14, fontWeight: 800,
                  color: scoreColor(projection.projectedComposite),
                }}>
                  {projection.projectedComposite}
                </span>
              </div>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9, fontWeight: 700,
                color: projection.compositeDelta > 0 ? T.green : projection.compositeDelta < 0 ? T.red : T.textTer,
                padding: '2px 6px', borderRadius: 4,
                background: projection.compositeDelta > 0 ? T.greenGlow : projection.compositeDelta < 0 ? T.redGlow : 'transparent',
              }}>
                {projection.compositeDelta > 0 ? '▲' : projection.compositeDelta < 0 ? '▼' : '—'}{Math.abs(projection.compositeDelta)}
              </span>
            </div>

            {/* Marker Projections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {projection.projections.map((proj) => {
                const isImproving = proj.direction === 'improving'
                const isDeclining = proj.direction === 'declining'
                const color = isImproving ? T.green : isDeclining ? T.red : T.textSec

                return (
                  <motion.div
                    key={proj.key}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', borderRadius: 8,
                      background: isDeclining ? 'rgba(255,107,107,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isDeclining ? 'rgba(255,107,107,0.10)' : T.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: color,
                        boxShadow: `0 0 4px ${color}40`,
                      }} />
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 9, fontWeight: 600, color: T.text,
                      }}>
                        {proj.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 8, color: T.textTer,
                      }}>
                        {proj.current}
                      </span>
                      <span style={{ fontSize: 8, color: T.textTer }}>→</span>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 9, fontWeight: 700, color,
                      }}>
                        {proj.projected90d} {proj.unit}
                      </span>
                      {proj.deltaPct !== 0 && (
                        <span style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: 7, fontWeight: 700,
                          color: isImproving ? T.green : T.red,
                          padding: '1px 4px', borderRadius: 3,
                          background: isImproving ? T.greenGlow : T.redGlow,
                        }}>
                          {proj.deltaPct > 0 ? '+' : ''}{proj.deltaPct}%
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Adherence context */}
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 8, color: T.textTer,
              letterSpacing: '0.05em',
              textAlign: 'center',
            }}>
              PROJECTED @ {projection.adherenceRate}% ADHERENCE · {projection.stabilityTrend === 'up' ? '📈 IMPROVING' : projection.stabilityTrend === 'down' ? '📉 DECLINING' : '➡️ STABLE'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No data state */}
      <AnimatePresence>
        {isActive && !hasData && projection !== undefined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              marginTop: 10, padding: '12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${T.border}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>🧬</div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 9, color: T.textSec,
              lineHeight: 1.5,
            }}>
              Upload biomarker data to unlock 90-day predictive projections
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
