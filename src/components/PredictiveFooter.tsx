import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE FOOTER — "What's Next" Intelligence HUD
   
   Surfaces the AI Brain's next recommended action based on:
   • Current time of day (circadian window)
   • SomaticBodyMap tension state
   • HRV / Sleep / CRP signals
   • Protocol adherence + inventory
   
   Renders as a persistent footer above the bottom nav with
   expandable detail cards for each recommendation.
   ═══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceElevated: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  electricBlueGlow: 'rgba(59,130,246,0.15)',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  gold: '#F59E0B',
  border: 'rgba(255,255,255,0.06)',
  borderBlue: 'rgba(59,130,246,0.15)',
}

const priorityColors: Record<string, string> = {
  urgent: CC.red,
  recommended: CC.electricBlue,
  optimal: CC.green,
}

const priorityLabels: Record<string, string> = {
  urgent: 'URGENT',
  recommended: 'RECOMMENDED',
  optimal: 'OPTIMAL',
}

/* ── Ghost State Skeleton ── */
function GhostFooter() {
  return (
    <div style={{
      padding: '14px 16px',
      background: CC.surface,
      borderTop: `1px solid ${CC.border}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(59,130,246,0.08)',
          animation: 'ghost-pulse 1.8s ease-in-out infinite',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            width: '55%', height: 10, borderRadius: 5,
            background: 'rgba(59,130,246,0.08)',
            animation: 'ghost-pulse 1.8s ease-in-out infinite',
            marginBottom: 6,
          }} />
          <div style={{
            width: '80%', height: 8, borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            animation: 'ghost-pulse 1.8s ease-in-out infinite 0.2s',
          }} />
        </div>
      </div>
      <style>{`
        @keyframes ghost-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

/* ── Action Card (expanded detail) ── */
function ActionCard({ action, index, isExpanded, onToggle }: {
  action: any;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const priorityColor = priorityColors[action.priority] || CC.electricBlue
  const accentColor = action.accentColor || priorityColor

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      onClick={onToggle}
      style={{
        background: isExpanded ? CC.surfaceElevated : 'rgba(14,14,18,0.6)',
        borderRadius: 14,
        border: `1px solid ${isExpanded ? `${accentColor}22` : CC.border}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header row */}
      <div style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${accentColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
          boxShadow: isExpanded ? `0 0 12px ${accentColor}20` : 'none',
          transition: 'box-shadow 0.3s',
        }}>
          {action.icon}
        </div>

        {/* Title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: CC.text,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {action.title}
            </span>
            {action.isFutureBio && (
              <span style={{
                fontSize: 8, fontWeight: 700, fontFamily: 'monospace',
                color: '#EC4899', background: 'rgba(236,72,153,0.12)',
                padding: '1px 5px', borderRadius: 4,
                letterSpacing: '0.08em', flexShrink: 0,
              }}>
                FUTURE BIO
              </span>
            )}
          </div>
          <div style={{
            fontSize: 10, color: CC.textSec, fontFamily: 'monospace',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {action.dose} · {action.subtitle}
          </div>
        </div>

        {/* Priority badge */}
        <div style={{
          fontSize: 8, fontWeight: 800, fontFamily: 'monospace',
          color: priorityColor,
          background: `${priorityColor}12`,
          padding: '3px 7px', borderRadius: 6,
          letterSpacing: '0.1em', flexShrink: 0,
        }}>
          {priorityLabels[action.priority] || 'OPTIMAL'}
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: 10, color: CC.textTer, flexShrink: 0 }}
        >
          ▼
        </motion.div>
      </div>

      {/* Expanded detail */}
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
              borderTop: `1px solid ${CC.border}`,
              paddingTop: 12,
            }}>
              {/* Circadian rationale */}
              <div style={{
                fontSize: 11, lineHeight: 1.55, color: CC.text,
                marginBottom: 10, fontWeight: 500,
              }}>
                {action.circadianRationale}
              </div>

              {/* Mechanism */}
              <div style={{
                fontSize: 10, lineHeight: 1.5, color: CC.textSec,
                marginBottom: 10, fontFamily: 'monospace',
                padding: '8px 10px',
                background: 'rgba(59,130,246,0.04)',
                borderRadius: 8,
                borderLeft: `2px solid ${accentColor}40`,
              }}>
                <span style={{ color: accentColor, fontWeight: 700, fontSize: 9, letterSpacing: '0.08em' }}>
                  MECHANISM ·{' '}
                </span>
                {action.mechanism}
              </div>

              {/* Trigger signals */}
              {action.triggers && action.triggers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {action.triggers.map((t: string, i: number) => (
                    <span key={i} style={{
                      fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                      color: CC.textSec,
                      background: 'rgba(255,255,255,0.04)',
                      padding: '2px 7px', borderRadius: 5,
                      letterSpacing: '0.02em',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Confidence bar */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${action.confidence}%` }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    style={{
                      height: '100%', borderRadius: 2,
                      background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})`,
                    }}
                  />
                </div>
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.textTer, letterSpacing: '0.05em',
                }}>
                  {action.confidence}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PredictiveFooter() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const data = useQuery(api.predictiveNext.getWhatsNext, { sessionId })
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Auto-collapse after 30s of inactivity
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => setIsExpanded(false), 30000)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

  // Reset dismissed state when data changes (new window)
  useEffect(() => {
    if (data?.circadianWindow) setDismissed(false)
  }, [data?.circadianWindow])

  const topAction = data?.actions?.[0]

  if (!data || data.actions.length === 0 || dismissed) {
    if (!data) return <GhostFooter />
    return null
  }

  const topColor = topAction?.accentColor || CC.electricBlue

  return (
    <div style={{
      position: 'relative',
      zIndex: 50,
      marginBottom: 4,
    }}>
      {/* Collapsed bar — shows top recommendation */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            margin: '0 12px',
            background: CC.surface,
            borderRadius: 16,
            border: `1px solid ${CC.border}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            overflow: 'hidden',
          }}
        >
          {/* Top glow line */}
          <div style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${topColor}60, transparent)`,
          }} />

          <div
            onClick={() => setIsExpanded(true)}
            style={{
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer',
            }}
          >
            {/* Pulsing icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${topColor}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
              position: 'relative',
            }}>
              {topAction?.icon}
              {topAction?.priority === 'urgent' && (
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 8, height: 8, borderRadius: '50%',
                  background: CC.red,
                  boxShadow: `0 0 6px ${CC.red}80`,
                  animation: 'urgent-pulse 2s ease-in-out infinite',
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, fontFamily: 'monospace',
                  color: topColor, letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  WHAT'S NEXT
                </span>
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                  letterSpacing: '0.05em',
                }}>
                  · {data.windowLabel}
                </span>
                {topAction?.isFutureBio && (
                  <span style={{
                    fontSize: 7, fontWeight: 700, fontFamily: 'monospace',
                    color: '#EC4899', background: 'rgba(236,72,153,0.12)',
                    padding: '1px 4px', borderRadius: 3,
                    letterSpacing: '0.08em',
                  }}>
                    FUTURE BIO
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: CC.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {topAction?.title}
                <span style={{ color: CC.textSec, fontWeight: 400, fontSize: 11 }}>
                  {' '}· {topAction?.dose}
                </span>
              </div>
            </div>

            {/* Action count + expand */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
                color: CC.textSec, letterSpacing: '0.05em',
              }}>
                {data.actions.length}
              </div>
              <div style={{ fontSize: 8, color: CC.textTer }}>▲</div>
            </div>
          </div>

          {/* Context line */}
          <div style={{
            padding: '0 14px 10px',
            fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
            letterSpacing: '0.03em',
          }}>
            {data.contextLine}
          </div>
        </motion.div>
      )}

      {/* Expanded panel — all recommendations */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{
              margin: '0 12px',
              background: CC.surface,
              borderRadius: 18,
              border: `1px solid ${CC.borderBlue}`,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              overflow: 'hidden',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            {/* Header glow */}
            <div style={{
              height: 2,
              background: `linear-gradient(90deg, transparent, ${topColor}60, ${CC.accent}40, transparent)`,
            }} />

            {/* Header */}
            <div style={{
              padding: '14px 16px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                  color: topColor, letterSpacing: '0.15em',
                  textTransform: 'uppercase', marginBottom: 2,
                }}>
                  ◆ WHAT'S NEXT · {data.windowLabel.toUpperCase()}
                </div>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
                  letterSpacing: '0.03em',
                }}>
                  {data.contextLine}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setDismissed(true); setIsExpanded(false) }}
                  style={{
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                    color: CC.textTer, background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CC.border}`, borderRadius: 6,
                    padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
                  style={{
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                    color: CC.electricBlueBright, background: CC.electricBlueGlow,
                    border: `1px solid ${CC.borderBlue}`, borderRadius: 6,
                    padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  Collapse ▼
                </button>
              </div>
            </div>

            {/* Action cards */}
            <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.actions.map((action: any, i: number) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  index={i}
                  isExpanded={expandedCard === action.id}
                  onToggle={() => setExpandedCard(expandedCard === action.id ? null : action.id)}
                />
              ))}
            </div>

            {/* Data completeness */}
            <div style={{
              padding: '8px 16px 12px',
              borderTop: `1px solid ${CC.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
                letterSpacing: '0.04em',
              }}>
                Signal Coverage: {data.dataCompleteness}%
              </span>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                letterSpacing: '0.04em',
              }}>
                Circadian Engine v1.0
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes urgent-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
