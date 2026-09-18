import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactiveOverrideResult, RecoveryCommand } from '../../convex/reactiveOverride'

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
  sans: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
}

/* ── Severity Pulse Ring ── */
function SeverityPulse({ color, glowColor }: { color: string; glowColor: string }) {
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      {/* Outer pulse */}
      <div style={{
        position: 'absolute', inset: -8,
        borderRadius: '50%',
        background: glowColor,
        animation: 'rpb-pulse 2s ease-in-out infinite',
      }} />
      {/* Ring */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
      }} />
      {/* Inner icon */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        ⚡
      </div>
      <style>{`
        @keyframes rpb-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/* ── Signal Chip ── */
function SignalChip({ signal }: { signal: ReactiveOverrideResult['signals'][0] }) {
  const statusColors = {
    critical: { bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.25)', text: '#FF6B6B' },
    warning: { bg: 'rgba(232,151,108,0.10)', border: 'rgba(232,151,108,0.20)', text: '#E8976C' },
    info: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  }
  const c = statusColors[signal.status]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
      }}
    >
      <span style={{ fontSize: 14 }}>{signal.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 9, fontFamily: T.mono, fontWeight: 700,
          color: c.text, letterSpacing: '0.1em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {signal.label}
        </div>
        <div style={{
          fontSize: 11, fontFamily: T.mono, color: T.textSec,
          marginTop: 1,
        }}>
          {signal.value}
        </div>
      </div>
      {signal.status === 'critical' && (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#FF6B6B',
          animation: 'rpb-blink 1s ease-in-out infinite',
        }} />
      )}
    </motion.div>
  )
}

/* ── Recovery Command Card ── */
function CommandCard({ cmd, index }: { cmd: RecoveryCommand; index: number }) {
  const [expanded, setExpanded] = useState(false)

  const categoryColors: Record<string, string> = {
    immediate: '#FF6B6B',
    morning: '#E8976C',
    midday: '#F59E0B',
    evening: '#8B5CF6',
  }
  const catColor = categoryColors[cmd.category] || '#60A5FA'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onClick={() => setExpanded(!expanded)}
      style={{
        position: 'relative',
        padding: '12px 14px',
        background: T.surface,
        border: `1px solid rgba(255,255,255,0.04)`,
        borderRadius: 14,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Timeline dot */}
      <div style={{
        position: 'absolute', left: -20, top: 18,
        width: 8, height: 8, borderRadius: '50%',
        background: catColor,
        boxShadow: `0 0 8px ${catColor}40`,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{cmd.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 13, fontFamily: T.sans, fontWeight: 600,
              color: T.text, lineHeight: 1.3,
            }}>
              {cmd.name}
            </span>
            <span style={{
              fontSize: 9, fontFamily: T.mono, fontWeight: 600,
              color: catColor, letterSpacing: '0.08em',
              padding: '2px 6px',
              background: `${catColor}15`,
              borderRadius: 4,
              textTransform: 'uppercase',
            }}>
              {cmd.timing}
            </span>
          </div>

          <div style={{
            fontSize: 12, fontFamily: T.sans, color: T.textSec,
            lineHeight: 1.5, marginTop: 4,
          }}>
            {cmd.instruction}
          </div>

          {/* Replaces badge */}
          {cmd.replaces && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 6, padding: '2px 8px',
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.15)',
              borderRadius: 6,
            }}>
              <span style={{ fontSize: 9, color: '#FF6B6B' }}>↻</span>
              <span style={{
                fontSize: 9, fontFamily: T.mono, fontWeight: 600,
                color: '#FF6B6B', letterSpacing: '0.05em',
              }}>
                REPLACES: {cmd.replaces}
              </span>
            </div>
          )}

          {/* Mechanism — expandable */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: 8, padding: '8px 10px',
                  background: 'rgba(59,130,246,0.04)',
                  border: '1px solid rgba(59,130,246,0.08)',
                  borderRadius: 8,
                }}>
                  <div style={{
                    fontSize: 8, fontFamily: T.mono, fontWeight: 700,
                    color: '#60A5FA', letterSpacing: '0.12em',
                    textTransform: 'uppercase', marginBottom: 4,
                  }}>
                    BIOLOGICAL MECHANISM
                  </div>
                  <div style={{
                    fontSize: 11, fontFamily: T.sans, color: T.textSec,
                    lineHeight: 1.5, fontStyle: 'italic',
                  }}>
                    {cmd.mechanism}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Suppressed Protocols ── */
function SuppressedList({ protocols }: { protocols: string[] }) {
  if (!protocols.length) return null
  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(255,107,107,0.04)',
      border: '1px solid rgba(255,107,107,0.10)',
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 8, fontFamily: T.mono, fontWeight: 700,
        color: '#FF6B6B', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 8,
      }}>
        ⛔ SUPPRESSED TODAY
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {protocols.map(p => (
          <span key={p} style={{
            fontSize: 10, fontFamily: T.mono, fontWeight: 600,
            color: 'rgba(255,107,107,0.6)',
            padding: '3px 8px',
            background: 'rgba(255,107,107,0.06)',
            border: '1px solid rgba(255,107,107,0.12)',
            borderRadius: 6,
            textDecoration: 'line-through',
            textDecorationColor: 'rgba(255,107,107,0.3)',
          }}>
            {p}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Metrics Bar ── */
function MetricsBar({ metrics }: { metrics: ReactiveOverrideResult['metrics'] }) {
  const items = useMemo(() => {
    const list: { label: string; value: string; color: string }[] = []
    if (metrics.hrvCurrent != null) {
      list.push({
        label: 'HRV',
        value: `${metrics.hrvCurrent}ms`,
        color: (metrics.hrvDeviationPct ?? 0) > 15 ? '#FF6B6B' : '#E8976C',
      })
    }
    if (metrics.sleepHours != null) {
      list.push({
        label: 'SLEEP',
        value: `${metrics.sleepHours.toFixed(1)}h`,
        color: metrics.sleepHours < 6 ? '#FF6B6B' : '#E8976C',
      })
    }
    if (metrics.recoveryScore != null) {
      list.push({
        label: 'RECOVERY',
        value: `${metrics.recoveryScore}%`,
        color: metrics.recoveryScore < 50 ? '#FF6B6B' : metrics.recoveryScore < 70 ? '#E8976C' : '#7CB68E',
      })
    }
    if (metrics.crp != null) {
      list.push({
        label: 'CRP',
        value: `${metrics.crp} mg/L`,
        color: metrics.crp > 3 ? '#FF6B6B' : metrics.crp > 1 ? '#E8976C' : '#7CB68E',
      })
    }
    return list
  }, [metrics])

  return (
    <div style={{
      display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      {items.map(item => (
        <div key={item.label} style={{
          flex: 1, padding: '8px 6px', textAlign: 'center',
          background: T.surface,
        }}>
          <div style={{
            fontSize: 8, fontFamily: T.mono, fontWeight: 700,
            color: T.textTer, letterSpacing: '0.1em',
          }}>
            {item.label}
          </div>
          <div style={{
            fontSize: 14, fontFamily: T.mono, fontWeight: 700,
            color: item.color, marginTop: 2,
          }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Confidence Bar ── */
function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0',
    }}>
      <span style={{
        fontSize: 8, fontFamily: T.mono, fontWeight: 700,
        color: T.textTer, letterSpacing: '0.1em',
      }}>
        CONFIDENCE
      </span>
      <div style={{
        flex: 1, height: 3, borderRadius: 2,
        background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 2,
            background: confidence > 70
              ? 'linear-gradient(90deg, #7CB68E, #60A5FA)'
              : 'linear-gradient(90deg, #E8976C, #F59E0B)',
          }}
        />
      </div>
      <span style={{
        fontSize: 10, fontFamily: T.mono, fontWeight: 700,
        color: T.textSec,
      }}>
        {confidence}%
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   RECOVERY PRIORITY BLOCK — Main Export
   
   Proactive dashboard override that appears at the top of the
   dashboard when the user's biology is compromised. Subscribes
   to the reactive override query and renders the full recovery
   command interface when active.
   ══════════════════════════════════════════════════════════════════ */

export default function RecoveryPriorityBlock() {
  const sessionId = getTwinSessionId()

  const override = useQuery(api.reactiveOverride.getReactiveOverride, { sessionId })

  const [dismissed, setDismissed] = useState(false)
  const [showNarrative, setShowNarrative] = useState(false)
  const [showAllCommands, setShowAllCommands] = useState(false)

  // Reset dismissed state when severity changes
  useEffect(() => {
    if (override?.severity) setDismissed(false)
  }, [override?.severity])

  if (!override || !override.isActive || dismissed) return null

  const {
    severity, color, glowColor, bgGradient, borderColor,
    headline, subheadline, narrative,
    signals, commands, suppressedProtocols,
    confidence, metrics,
  } = override

  const visibleCommands = showAllCommands ? commands : commands.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: '12px 16px 0',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Ambient glow background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: bgGradient,
        borderRadius: 20,
      }} />

      {/* Border */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 20,
        border: `1px solid ${borderColor}`,
        pointerEvents: 'none',
      }} />

      {/* Top severity glow line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%',
        height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: 0.6,
      }} />

      <div style={{ position: 'relative', padding: '16px 16px 14px' }}>
        {/* Header Row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <SeverityPulse color={color} glowColor={glowColor} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Severity badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px',
              background: `${color}15`,
              border: `1px solid ${color}30`,
              borderRadius: 6,
              marginBottom: 6,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: color,
                animation: severity === 'critical' ? 'rpb-blink 1s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontSize: 8, fontFamily: T.mono, fontWeight: 800,
                color, letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}>
                {severity === 'critical' ? 'CRITICAL OVERRIDE' :
                 severity === 'alert' ? 'PROTOCOL OVERRIDE' : 'ADVISORY'}
              </span>
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: 17, fontFamily: T.sans, fontWeight: 700,
              color: T.text, lineHeight: 1.25,
              margin: 0,
            }}>
              {headline}
            </h2>

            {/* Subheadline */}
            <p style={{
              fontSize: 12, fontFamily: T.sans, color: T.textSec,
              lineHeight: 1.5, margin: '6px 0 0',
            }}>
              {subheadline}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: T.textTer, fontSize: 14,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            aria-label="Dismiss override"
          >
            ✕
          </button>
        </div>

        {/* Metrics Bar */}
        <div style={{ marginTop: 14 }}>
          <MetricsBar metrics={metrics} />
        </div>

        {/* Signal Chips */}
        {signals.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: signals.length > 2 ? 'repeat(2, 1fr)' : `repeat(${signals.length}, 1fr)`,
            gap: 6,
            marginTop: 12,
          }}>
            {signals.map(s => <SignalChip key={s.id} signal={s} />)}
          </div>
        )}

        {/* Biological Narrative — expandable */}
        {narrative && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setShowNarrative(!showNarrative)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0,
              }}
            >
              <span style={{
                fontSize: 8, fontFamily: T.mono, fontWeight: 700,
                color: '#60A5FA', letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                {showNarrative ? '▾' : '▸'} BIOLOGICAL NARRATIVE
              </span>
            </button>
            <AnimatePresence>
              {showNarrative && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: 8, padding: '10px 12px',
                    background: 'rgba(59,130,246,0.04)',
                    border: '1px solid rgba(59,130,246,0.08)',
                    borderRadius: 10,
                  }}>
                    <p style={{
                      fontSize: 12, fontFamily: T.sans, color: T.textSec,
                      lineHeight: 1.65, margin: 0, fontStyle: 'italic',
                    }}>
                      {narrative}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Recovery Commands Timeline */}
        {commands.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 9, fontFamily: T.mono, fontWeight: 700,
              color, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 10,
            }}>
              🎯 RECOVERY PROTOCOL — {commands.length} COMMANDS
            </div>

            {/* Timeline line */}
            <div style={{ position: 'relative', paddingLeft: 16 }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 3, top: 8, bottom: 8,
                width: 1,
                background: `linear-gradient(to bottom, ${color}40, ${color}10)`,
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleCommands.map((cmd, i) => (
                  <CommandCard key={cmd.id} cmd={cmd} index={i} />
                ))}
              </div>

              {/* Show more */}
              {commands.length > 3 && !showAllCommands && (
                <button
                  onClick={() => setShowAllCommands(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', padding: '8px 0', marginTop: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontSize: 10, fontFamily: T.mono, fontWeight: 600,
                    color: '#60A5FA', letterSpacing: '0.05em',
                  }}>
                    + {commands.length - 3} more commands
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Suppressed Protocols */}
        {suppressedProtocols.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SuppressedList protocols={suppressedProtocols} />
          </div>
        )}

        {/* Confidence + timestamp */}
        <div style={{ marginTop: 12 }}>
          <ConfidenceBar confidence={confidence} />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 4,
        }}>
          <span style={{
            fontSize: 8, fontFamily: T.mono, color: T.textTer,
            letterSpacing: '0.08em',
          }}>
            VIVE OS • REACTIVE OVERRIDE ENGINE
          </span>
          <span style={{
            fontSize: 8, fontFamily: T.mono, color: T.textTer,
          }}>
            {new Date(override.lastDataAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes rpb-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </motion.div>
  )
}
