import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getSwapSuggestion } from '../lib/bioSyncLogic'

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════
   DAILY PROTOCOL — Readiness-Reactive Medical OS Checklist
   
   Connected to the Readiness Engine: Sleep Quality & HRV are
   compared against 7-day averages. When below baseline:
   • High-Intensity Training → demoted to "Optional"
   • Recovery / NSDR → promoted to top priority
   • Visual indicators show WHY each item was reshuffled
   ══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceHover: 'rgba(20,20,26,0.92)',
  surfaceActive: 'rgba(24,24,32,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  electricBlueGlow: 'rgba(59,130,246,0.15)',
  accent: '#00FFCC',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.2)',
  greenBright: '#34D399',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  gold: '#C4A46C',
  goldGlow: 'rgba(196,164,108,0.15)',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
  purple: '#A78BFA',
  purpleGlow: 'rgba(167,139,250,0.15)',
}

const CATEGORY_COLORS: Record<string, string> = {
  supplement: '#C4A46C',
  training: '#E8976C',
  biohacking: '#6BA3BE',
  nutrition: '#7CB68E',
  recovery: '#D4847A',
  movement: '#E8976C',
}

const CATEGORY_ICONS: Record<string, string> = {
  supplement: '💊',
  training: '🏋️',
  biohacking: '🧬',
  nutrition: '🥩',
  recovery: '😴',
  movement: '🚶',
}

const WINDOW_STYLES: Record<string, {
  label: string
  icon: string
  accentColor: string
  glowColor: string
  gradient: string
}> = {
  morning: {
    label: 'MORNING ACTIVATION',
    icon: '☀️',
    accentColor: '#E8976C',
    glowColor: 'rgba(232,151,108,0.12)',
    gradient: 'linear-gradient(135deg, rgba(232,151,108,0.08), rgba(232,151,108,0.02))',
  },
  performance: {
    label: 'PERFORMANCE WINDOW',
    icon: '⚡',
    accentColor: '#3B82F6',
    glowColor: 'rgba(59,130,246,0.12)',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
  },
  recovery: {
    label: 'RECOVERY PROTOCOL',
    icon: '🌙',
    accentColor: '#7CB68E',
    glowColor: 'rgba(124,182,142,0.12)',
    gradient: 'linear-gradient(135deg, rgba(124,182,142,0.08), rgba(124,182,142,0.02))',
  },
}

const PRIORITY_TIER_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}> = {
  critical: {
    label: 'CRITICAL',
    color: CC.red,
    bgColor: `${CC.red}15`,
    borderColor: `${CC.red}30`,
    icon: '🔴',
  },
  recommended: {
    label: 'RECOMMENDED',
    color: CC.green,
    bgColor: `${CC.green}10`,
    borderColor: `${CC.green}20`,
    icon: '🟢',
  },
  optional: {
    label: 'OPTIONAL',
    color: CC.gold,
    bgColor: `${CC.gold}10`,
    borderColor: `${CC.gold}20`,
    icon: '🟡',
  },
  demoted: {
    label: 'DEFERRED',
    color: CC.textTer,
    bgColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    icon: '⬇️',
  },
}

const READINESS_LEVEL_CONFIG: Record<string, {
  color: string
  bgGradient: string
  borderColor: string
  icon: string
  label: string
}> = {
  peak: {
    color: CC.green,
    bgGradient: `linear-gradient(135deg, ${CC.green}12, ${CC.green}04)`,
    borderColor: `${CC.green}25`,
    icon: '🟢',
    label: 'PEAK READINESS',
  },
  good: {
    color: CC.electricBlueBright,
    bgGradient: `linear-gradient(135deg, ${CC.electricBlue}12, ${CC.electricBlue}04)`,
    borderColor: `${CC.electricBlue}25`,
    icon: '🔵',
    label: 'GOOD READINESS',
  },
  moderate: {
    color: CC.gold,
    bgGradient: `linear-gradient(135deg, ${CC.gold}12, ${CC.gold}04)`,
    borderColor: `${CC.gold}25`,
    icon: '🟡',
    label: 'MODERATE',
  },
  low: {
    color: CC.orange,
    bgGradient: `linear-gradient(135deg, ${CC.orange}12, ${CC.orange}04)`,
    borderColor: `${CC.orange}25`,
    icon: '🟠',
    label: 'LOW READINESS',
  },
  critical: {
    color: CC.red,
    bgGradient: `linear-gradient(135deg, ${CC.red}12, ${CC.red}04)`,
    borderColor: `${CC.red}25`,
    icon: '🔴',
    label: 'CRITICAL',
  },
}

/* ── Readiness Signal Pill ── */
function SignalPill({ signal }: {
  signal: {
    metric: string
    current: number
    average: number
    delta: number
    unit: string
    status: 'below' | 'at' | 'above'
    icon: string
  }
}) {
  const statusColor = signal.status === 'below' ? CC.red
    : signal.status === 'above' ? CC.green : CC.textSec
  const deltaStr = signal.delta > 0 ? `+${signal.delta}%` : `${signal.delta}%`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', borderRadius: 8,
      background: `${statusColor}08`,
      border: `1px solid ${statusColor}15`,
    }}>
      <span style={{ fontSize: 11 }}>{signal.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {signal.metric}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{
            fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
            color: statusColor,
          }}>
            {signal.current}
          </span>
          <span style={{
            fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
          }}>
            {signal.unit}
          </span>
          {signal.status !== 'at' && (
            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: statusColor, marginLeft: 2,
            }}>
              {deltaStr}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Readiness Banner ── */
function ReadinessBanner({
  readinessScore,
  readinessLevel,
  readinessSummary,
  needsReshuffle,
  signals,
  promotedCount,
  demotedCount,
  sleepData,
  hrvData,
}: {
  readinessScore: number
  readinessLevel: string
  readinessSummary: string
  needsReshuffle: boolean
  signals: Array<{
    metric: string; current: number; average: number;
    delta: number; unit: string; status: 'below' | 'at' | 'above'; icon: string
  }>
  promotedCount: number
  demotedCount: number
  sleepData: { todayScore: number; avg7d: number; delta: number; belowAvg: boolean }
  hrvData: { latest: number; avg7d: number; delta: number; belowAvg: boolean }
}) {
  const [expanded, setExpanded] = useState(false)
  const levelConfig = READINESS_LEVEL_CONFIG[readinessLevel] || READINESS_LEVEL_CONFIG.good

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 14, overflow: 'hidden', marginBottom: 14,
        border: `1px solid ${levelConfig.borderColor}`,
        background: levelConfig.bgGradient,
      }}
    >
      {/* Header — always visible */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%', padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Readiness score ring */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${levelConfig.color}12`,
            border: `2px solid ${levelConfig.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{
              fontSize: 13, fontFamily: 'monospace', fontWeight: 800,
              color: levelConfig.color,
            }}>
              {readinessScore}
            </span>
            {needsReshuffle && (
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  position: 'absolute', inset: -3, borderRadius: '50%',
                  border: `1px solid ${levelConfig.color}30`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: levelConfig.color, letterSpacing: '0.12em',
              }}>
                {levelConfig.label}
              </span>
              {needsReshuffle && (
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  style={{
                    fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                    color: CC.orange, letterSpacing: '0.1em',
                    padding: '1px 5px', borderRadius: 3,
                    background: `${CC.orange}12`, border: `1px solid ${CC.orange}18`,
                  }}
                >
                  RESHUFFLED
                </motion.span>
              )}
            </div>
            <span style={{
              fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
              lineHeight: 1.3,
            }}>
              {readinessSummary}
            </span>
          </div>
        </div>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: 10, color: CC.textTer }}
        >
          ▼
        </motion.span>
      </motion.button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 12px' }}>
              {/* Biomarker signals */}
              <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10,
              }}>
                {signals.map((s, i) => (
                  <SignalPill key={i} signal={s} />
                ))}
              </div>

              {/* Reshuffle impact */}
              {needsReshuffle && (promotedCount > 0 || demotedCount > 0) && (
                <div style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${CC.border}`,
                }}>
                  <div style={{
                    fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                    color: CC.textSec, letterSpacing: '0.12em',
                    marginBottom: 6,
                  }}>
                    PROTOCOL ADJUSTMENTS
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {promotedCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>⬆️</span>
                        <span style={{
                          fontSize: 10, fontFamily: 'monospace', color: CC.green,
                          fontWeight: 600,
                        }}>
                          {promotedCount} promoted
                        </span>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                        }}>
                          (recovery prioritized)
                        </span>
                      </div>
                    )}
                    {demotedCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>⬇️</span>
                        <span style={{
                          fontSize: 10, fontFamily: 'monospace', color: CC.orange,
                          fontWeight: 600,
                        }}>
                          {demotedCount} deferred
                        </span>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                        }}>
                          (intensity reduced)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Specific triggers */}
                  <div style={{
                    marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {sleepData.belowAvg && (
                      <div style={{
                        fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ color: CC.red, fontSize: 6 }}>●</span>
                        Sleep {sleepData.todayScore}/100 is {Math.abs(sleepData.delta)}% below 7-day avg ({sleepData.avg7d})
                      </div>
                    )}
                    {hrvData.belowAvg && hrvData.latest > 0 && (
                      <div style={{
                        fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ color: CC.red, fontSize: 6 }}>●</span>
                        HRV {hrvData.latest}ms is {Math.abs(hrvData.delta)}% below baseline ({hrvData.avg7d}ms)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Priority Tier Badge ── */
function PriorityBadge({ tier, promoted, demoted }: {
  tier: string
  promoted: boolean
  demoted: boolean
}) {
  if (!promoted && !demoted) return null
  const config = PRIORITY_TIER_CONFIG[tier] || PRIORITY_TIER_CONFIG.recommended

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 6px', borderRadius: 4,
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      {promoted && (
        <motion.span
          animate={{ y: [0, -1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ fontSize: 7 }}
        >
          ▲
        </motion.span>
      )}
      {demoted && (
        <span style={{ fontSize: 7, color: config.color }}>▼</span>
      )}
      <span style={{
        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
        color: config.color, letterSpacing: '0.1em',
      }}>
        {config.label}
      </span>
    </motion.div>
  )
}

/* ── Adaptive Badge — Shows the system is responding to biology ── */
function AdaptiveBadge({ reason, swapSuggestion }: {
  reason?: string
  swapSuggestion?: {
    replacementName: string
    replacementIcon: string
    reason: string
  } | null
}) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <motion.button
        onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail) }}
        whileTap={{ scale: 0.9 }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 6,
          background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(59,130,246,0.10))',
          border: '1px solid rgba(167,139,250,0.25)',
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Scanning line animation */}
        <motion.div
          animate={{ x: [-30, 80] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', top: 0, bottom: 0, width: 20,
            background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.15), transparent)',
            pointerEvents: 'none',
          }}
        />
        <motion.span
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 8, zIndex: 1 }}
        >
          🧬
        </motion.span>
        <span style={{
          fontSize: 7, fontFamily: 'monospace', fontWeight: 800,
          background: 'linear-gradient(90deg, #A78BFA, #60A5FA)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '0.12em', zIndex: 1,
        }}>
          ADAPTIVE
        </span>
      </motion.button>

      {/* Detail popover */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 6,
              width: 260, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(24,24,32,0.97)',
              border: '1px solid rgba(167,139,250,0.20)',
              zIndex: 100,
              boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 16px rgba(167,139,250,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
            }}>
              <span style={{ fontSize: 10 }}>🧬</span>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 800,
                color: '#A78BFA', letterSpacing: '0.15em',
              }}>
                BIO-SYNC ADJUSTMENT
              </span>
            </div>
            {reason && (
              <div style={{
                fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.5, marginBottom: swapSuggestion ? 8 : 0,
              }}>
                {reason}
              </div>
            )}
            {swapSuggestion && (
              <div style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(0,220,130,0.06)',
                border: '1px solid rgba(0,220,130,0.15)',
              }}>
                <div style={{
                  fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                  color: '#00DC82', letterSpacing: '0.12em', marginBottom: 4,
                }}>
                  SUGGESTED SWAP
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 14 }}>{swapSuggestion.replacementIcon}</span>
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: '#F0F0F4',
                    }}>
                      {swapSuggestion.replacementName}
                    </div>
                    <div style={{
                      fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)',
                      marginTop: 1,
                    }}>
                      {swapSuggestion.reason}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetail(false) }}
              style={{
                marginTop: 8, fontSize: 8, fontFamily: 'monospace',
                color: 'rgba(255,255,255,0.28)', background: 'transparent', border: 'none',
                cursor: 'pointer', letterSpacing: '0.08em',
              }}
            >
              DISMISS
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Swap Indicator — Shows what high-intensity was replaced with ── */
function SwapIndicator({ originalName, swap }: {
  originalName: string
  swap: {
    replacementName: string
    replacementIcon: string
    replacementDescription: string
    reason: string
  }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      style={{
        marginTop: 6, padding: '6px 10px', borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(0,220,130,0.05), rgba(167,139,250,0.04))',
        border: '1px solid rgba(0,220,130,0.12)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)',
      }}>
        <span style={{ textDecoration: 'line-through' }}>{originalName}</span>
        <motion.span
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ color: '#00DC82', fontSize: 10 }}
        >
          →
        </motion.span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12 }}>{swap.replacementIcon}</span>
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
          color: '#00DC82',
        }}>
          {swap.replacementName}
        </span>
      </div>
    </motion.div>
  )
}

/* ── Readiness Note Tooltip ── */
function ReadinessNote({ note, tier }: { note: string; tier: string }) {
  const [show, setShow] = useState(false)
  const config = PRIORITY_TIER_CONFIG[tier] || PRIORITY_TIER_CONFIG.recommended

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShow(!show)}
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: `${config.color}12`,
          border: `1px solid ${config.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 8, color: config.color, fontWeight: 700 }}>?</span>
      </motion.button>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              width: 240, padding: '8px 10px', borderRadius: 10,
              background: CC.surfaceActive,
              border: `1px solid ${config.color}20`,
              zIndex: 50,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 12px ${config.color}08`,
            }}
          >
            <div style={{
              fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
              lineHeight: 1.5,
            }}>
              {note}
            </div>
            <button
              onClick={() => setShow(false)}
              style={{
                marginTop: 6, fontSize: 8, fontFamily: 'monospace',
                color: CC.textTer, background: 'transparent', border: 'none',
                cursor: 'pointer', letterSpacing: '0.08em',
              }}
            >
              DISMISS
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Swipe-to-Complete Protocol Item (Readiness-Aware) ── */
function SwipeProtocolItem({
  item,
  onComplete,
  accentColor,
}: {
  item: {
    _id: string
    name: string
    icon: string
    category: string
    description: string
    timeOfDay: string
    completed: boolean
    completedAt: number | null
    priorityTier?: string
    readinessNote?: string | null
    promoted?: boolean
    demoted?: boolean
  }
  onComplete: (id: string) => void
  accentColor: string
}) {
  const x = useMotionValue(0)
  const [swiping, setSwiping] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const catColor = CATEGORY_COLORS[item.category] || accentColor
  const isDemoted = item.demoted === true
  const isPromoted = item.promoted === true

  // Swipe reveal background
  const bgOpacity = useTransform(x, [0, 80, 140], [0, 0.5, 1])
  const checkScale = useTransform(x, [0, 80, 140], [0.3, 0.7, 1])
  const checkOpacity = useTransform(x, [0, 60, 140], [0, 0.5, 1])

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    setSwiping(false)
    if (info.offset.x > 120 && !item.completed) {
      setJustCompleted(true)
      onComplete(item._id)
      setTimeout(() => setJustCompleted(false), 1200)
    }
  }, [item._id, item.completed, onComplete])

  const handleTap = useCallback(() => {
    if (!item.completed) {
      setJustCompleted(true)
      onComplete(item._id)
      setTimeout(() => setJustCompleted(false), 1200)
    } else {
      onComplete(item._id)
    }
  }, [item._id, item.completed, onComplete])

  const completedTime = item.completedAt
    ? new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  // Determine card styling based on priority tier
  const cardBorder = item.completed
    ? `${CC.green}20`
    : isPromoted
      ? `${PRIORITY_TIER_CONFIG[item.priorityTier || 'recommended']?.color || CC.green}25`
      : isDemoted
        ? `rgba(255,255,255,0.03)`
        : CC.border

  const cardBg = item.completed
    ? `linear-gradient(135deg, ${CC.green}08, ${CC.green}03)`
    : justCompleted
      ? `linear-gradient(135deg, ${CC.green}12, ${CC.green}06)`
      : isPromoted
        ? `linear-gradient(135deg, ${PRIORITY_TIER_CONFIG[item.priorityTier || 'recommended']?.color || CC.green}06, transparent)`
        : isDemoted
          ? 'rgba(255,255,255,0.02)'
          : CC.surface

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
      {/* Promoted glow effect */}
      {isPromoted && !item.completed && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            background: `linear-gradient(135deg, ${PRIORITY_TIER_CONFIG[item.priorityTier || 'recommended']?.color || CC.green}08, transparent)`,
            pointerEvents: 'none', zIndex: 1,
          }}
        />
      )}

      {/* Swipe reveal background */}
      {!item.completed && (
        <motion.div
          style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            background: `linear-gradient(90deg, ${CC.green}22, ${CC.green}44)`,
            display: 'flex', alignItems: 'center', paddingLeft: 20,
            opacity: bgOpacity,
          }}
        >
          <motion.div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: CC.green, display: 'flex', alignItems: 'center',
            justifyContent: 'center', scale: checkScale, opacity: checkOpacity,
          }}>
            <span style={{ fontSize: 16, color: '#fff' }}>✓</span>
          </motion.div>
          <motion.span style={{
            marginLeft: 10, fontSize: 11, fontFamily: 'monospace',
            fontWeight: 700, color: CC.green, letterSpacing: '0.1em',
            opacity: checkOpacity,
          }}>
            VERIFIED
          </motion.span>
        </motion.div>
      )}

      {/* Main card — draggable */}
      <motion.div
        style={{
          x: item.completed ? 0 : x,
          background: cardBg,
          borderRadius: 14,
          padding: '14px 16px',
          border: `1px solid ${cardBorder}`,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 2,
          touchAction: 'pan-y',
          opacity: isDemoted && !item.completed ? 0.55 : 1,
        }}
        drag={item.completed ? false : "x"}
        dragConstraints={{ left: 0, right: 160 }}
        dragElastic={0.1}
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleDragEnd}
        onTap={swiping ? undefined : handleTap}
        whileTap={item.completed ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Status indicator */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: item.completed
              ? `linear-gradient(135deg, ${CC.green}30, ${CC.green}15)`
              : `linear-gradient(135deg, ${catColor}18, ${catColor}08)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${item.completed ? `${CC.green}30` : `${catColor}20`}`,
            flexShrink: 0,
            position: 'relative',
          }}>
            {item.completed ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                <span style={{ fontSize: 16 }}>✓</span>
              </motion.div>
            ) : (
              <span style={{ fontSize: 18 }}>{item.icon}</span>
            )}
            {/* Completion glow */}
            {(item.completed || justCompleted) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0.6, 0], scale: [1, 2] }}
                transition={{ duration: 0.8 }}
                style={{
                  position: 'absolute', inset: -4, borderRadius: 14,
                  background: CC.greenGlow, pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: item.completed ? CC.textSec : isDemoted ? CC.textTer : CC.text,
                textDecoration: item.completed ? 'line-through' : isDemoted ? 'line-through' : 'none',
                textDecorationColor: item.completed ? `${CC.green}40` : `${CC.textTer}40`,
                letterSpacing: '0.01em',
              }}>
                {item.name}
              </span>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                color: catColor, letterSpacing: '0.1em',
                textTransform: 'uppercase', opacity: 0.7,
                padding: '1px 5px', borderRadius: 4,
                background: `${catColor}10`,
              }}>
                {item.category}
              </span>
              {/* Priority tier badge */}
              <PriorityBadge
                tier={item.priorityTier || 'recommended'}
                promoted={item.promoted || false}
                demoted={item.demoted || false}
              />
              {/* Adaptive badge — shows bio-sync is active */}
              {(item.promoted || item.demoted) && !item.completed && (
                <AdaptiveBadge
                  reason={item.readinessNote || undefined}
                  swapSuggestion={item.demoted ? (() => {
                    const s = getSwapSuggestion(item.name, item.category)
                    return { replacementName: s.replacementName, replacementIcon: s.replacementIcon, reason: s.reason }
                  })() : null}
                />
              )}
            </div>
            <div style={{
              fontSize: 10, color: CC.textTer, marginTop: 2,
              fontFamily: 'monospace', lineHeight: 1.4,
            }}>
              {isDemoted && !item.completed
                ? '⚠️ Deferred — biomarkers indicate recovery needed first'
                : item.description}
            {/* Swap indicator for demoted high-intensity items */}
            {isDemoted && !item.completed && (() => {
              const swap = getSwapSuggestion(item.name, item.category)
              return (
                <SwapIndicator
                  originalName={item.name}
                  swap={swap}
                />
              )
            })()}
            </div>
          </div>

          {/* Right side — readiness note or time */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.readinessNote && !item.completed && (
              <ReadinessNote note={item.readinessNote} tier={item.priorityTier || 'recommended'} />
            )}
            {item.completed && completedTime ? (
              <div style={{
                fontSize: 9, fontFamily: 'monospace', color: CC.green,
                fontWeight: 600, letterSpacing: '0.05em',
              }}>
                {completedTime}
              </div>
            ) : !item.completed ? (
              <div style={{
                fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                letterSpacing: '0.08em',
              }}>
                SWIPE →
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ── AI Correction Notification Card ── */
function CorrectionCard({
  correction,
  onAccept,
  onDismiss,
}: {
  correction: {
    _id: string
    name: string
    icon: string
    category: string
    hoursOverdue: number
    suggestedWindow: string
    correctionMessage: string
  }
  onAccept: (id: string, window: string) => void
  onDismiss: (id: string) => void
}) {
  const catColor = CATEGORY_COLORS[correction.category] || CC.orange

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      style={{
        background: `linear-gradient(135deg, ${CC.orange}10, ${CC.red}06)`,
        border: `1px solid ${CC.orange}25`,
        borderRadius: 14, padding: '14px 16px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: 'absolute', top: -20, right: -20, width: 80, height: 80,
          borderRadius: '50%', background: `${CC.orange}08`, filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${CC.orange}15`, border: `1px solid ${CC.orange}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: CC.orange, letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              CORRECTION AVAILABLE
            </span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>
              {correction.hoursOverdue}h overdue
            </span>
          </div>

          <div style={{
            fontSize: 12, fontWeight: 600, color: CC.text,
            marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{correction.icon}</span>
            <span>{correction.name}</span>
          </div>

          <div style={{
            fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
            lineHeight: 1.5, marginBottom: 10,
          }}>
            {correction.correctionMessage}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onAccept(correction._id, correction.suggestedWindow)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: `linear-gradient(135deg, ${CC.green}20, ${CC.green}10)`,
                border: `1px solid ${CC.green}30`,
                color: CC.green, fontSize: 10, fontFamily: 'monospace',
                fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer',
              }}
            >
              RESCHEDULE → {correction.suggestedWindow.toUpperCase()}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onDismiss(correction._id)}
              style={{
                padding: '6px 12px', borderRadius: 8,
                background: 'transparent', border: `1px solid ${CC.border}`,
                color: CC.textTer, fontSize: 10, fontFamily: 'monospace',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              SKIP
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Progress Ring ── */
function ProgressRing({ percentage, size = 56 }: { percentage: number; size?: number }) {
  const strokeW = 3
  const radius = (size - strokeW * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percentage / 100)
  const color = percentage >= 80 ? CC.green : percentage >= 50 ? CC.gold : CC.orange

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={`${color}12`} strokeWidth={strokeW} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{
          fontSize: 14, fontWeight: 700, color,
          fontFamily: 'monospace', lineHeight: 1,
        }}>
          {percentage}
        </span>
        <span style={{
          fontSize: 7, color: CC.textTer, fontFamily: 'monospace',
          letterSpacing: '0.1em',
        }}>
          %
        </span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DAILY PROTOCOL — Main Component (Readiness-Connected)
   ══════════════════════════════════════════════════════════════ */

export default function DailyProtocol({ onProtocolComplete }: { onProtocolComplete?: () => void } = {}) {
  const sessionId = useMemo(() => getTwinSessionId(), [])
  const [dismissedCorrections, setDismissedCorrections] = useState<Set<string>>(new Set())
  const [expandedWindow, setExpandedWindow] = useState<string | null>(null)

  // ── PRIMARY QUERY: Readiness-adjusted protocols ──
  // This replaces the basic getProtocolsByBiologicalWindow query.
  // The readiness engine compares Sleep Quality & HRV against 7-day
  // averages and reshuffles the protocol list dynamically.
  const readinessData = useQuery(api.readinessEngine.getReadinessAdjustedProtocols, { sessionId })

  // Fallback to basic query if readiness engine has no data yet
  const basicWindowData = useQuery(api.protocols.getProtocolsByBiologicalWindow, { sessionId })

  // Use readiness data when available, fall back to basic
  const hasReadinessData = readinessData && readinessData.totalItems > 0
  const windowData = hasReadinessData ? readinessData : basicWindowData

  const corrections = useQuery(api.protocolCorrections.getMissedProtocols, { sessionId })

  // Mutations
  const oneTapVerify = useMutation(api.protocols.oneTapVerify)
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore)
  const acceptCorrection = useMutation(api.protocolCorrections.acceptCorrection)
  const dismissCorrection = useMutation(api.protocolCorrections.dismissCorrection)
  const seedDefaults = useMutation(api.protocols.seedDefaults)

  // Auto-seed protocols if none exist
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (windowData && windowData.totalItems === 0 && !seeded) {
      setSeeded(true)
      seedDefaults({ sessionId }).catch(() => {})
    }
  }, [windowData, seeded, sessionId, seedDefaults])

  // Auto-expand current biological window
  useEffect(() => {
    if (windowData && !expandedWindow) {
      setExpandedWindow(windowData.activeWindow)
    }
  }, [windowData, expandedWindow])

  const handleComplete = useCallback(async (protocolId: string) => {
    try {
      await oneTapVerify({ sessionId, protocolId: protocolId as any })
      await updateAdherence({ sessionId })
      onProtocolComplete?.()
    } catch (err) {
      console.error('[DailyProtocol] Complete failed:', err)
    }
  }, [sessionId, oneTapVerify, updateAdherence])

  const handleAcceptCorrection = useCallback(async (protocolId: string, window: string) => {
    setDismissedCorrections(prev => new Set(prev).add(protocolId))
    try {
      await acceptCorrection({ sessionId, protocolId: protocolId as any, correctionWindow: window })
    } catch (err) {
      console.error('[DailyProtocol] Accept correction failed:', err)
    }
  }, [sessionId, acceptCorrection])

  const handleDismissCorrection = useCallback(async (protocolId: string) => {
    setDismissedCorrections(prev => new Set(prev).add(protocolId))
    try {
      await dismissCorrection({ sessionId, protocolId: protocolId as any })
    } catch (err) {
      console.error('[DailyProtocol] Dismiss correction failed:', err)
    }
  }, [sessionId, dismissCorrection])

  // Filter visible corrections
  const visibleCorrections = useMemo(() => {
    if (!corrections?.missed) return []
    return corrections.missed.filter(c => !dismissedCorrections.has(c._id))
  }, [corrections, dismissedCorrections])

  if (!windowData) {
    return (
      <div style={{
        padding: '24px 16px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, border: `2px solid ${CC.borderBlue}`,
          borderTopColor: CC.electricBlue, borderRadius: '50%',
          animation: 'dp-spin 0.8s linear infinite',
        }} />
        <span style={{
          fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          ANALYZING READINESS
        </span>
        <style>{`@keyframes dp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const { windows, activeWindow, totalItems, totalDone, percentage } = windowData
  const windowOrder = ['morning', 'performance', 'recovery'] as const

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* ── Readiness Banner (only when readiness engine is active) ── */}
      {hasReadinessData && readinessData && (
        <ReadinessBanner
          readinessScore={readinessData.readinessScore}
          readinessLevel={readinessData.readinessLevel}
          readinessSummary={readinessData.readinessSummary}
          needsReshuffle={readinessData.needsReshuffle}
          signals={readinessData.signals}
          promotedCount={readinessData.promotedCount}
          demotedCount={readinessData.demotedCount}
          sleepData={readinessData.sleepData}
          hrvData={readinessData.hrvData}
        />
      )}

      {/* Section Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
              color: CC.electricBlueBright, letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              DAILY PROTOCOL
            </span>
            {hasReadinessData && readinessData?.needsReshuffle && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.orange, letterSpacing: '0.1em',
                  padding: '2px 6px', borderRadius: 4,
                  background: `${CC.orange}12`, border: `1px solid ${CC.orange}18`,
                }}
              >
                BIOMARKER-ADJUSTED
              </motion.span>
            )}
            {visibleCorrections.length > 0 && (
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.orange, letterSpacing: '0.1em',
                  padding: '2px 6px', borderRadius: 4,
                  background: `${CC.orange}15`, border: `1px solid ${CC.orange}20`,
                }}
              >
                {visibleCorrections.length} CORRECTION{visibleCorrections.length > 1 ? 'S' : ''}
              </motion.span>
            )}
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
            marginTop: 2, letterSpacing: '0.05em',
          }}>
            {totalDone}/{totalItems} verified · {windowData.dateKey || new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        <ProgressRing percentage={percentage} />
      </div>

      {/* AI Correction Notifications */}
      <AnimatePresence>
        {visibleCorrections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}
          >
            {visibleCorrections.map(c => (
              <CorrectionCard
                key={c._id}
                correction={c}
                onAccept={handleAcceptCorrection}
                onDismiss={handleDismissCorrection}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Biological Windows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {windowOrder.map(windowKey => {
          const win = windows[windowKey]
          if (!win || win.items.length === 0) return null
          const style = WINDOW_STYLES[windowKey]
          const isExpanded = expandedWindow === windowKey
          const isActive = activeWindow === windowKey
          const windowDone = win.items.filter((i: any) => i.completed).length
          const windowTotal = win.items.length
          const windowPct = windowTotal > 0 ? Math.round((windowDone / windowTotal) * 100) : 0

          // Check if this window has promoted/demoted items (readiness-aware)
          const hasPromoted = hasReadinessData && win.items.some((i: any) => i.promoted)
          const hasDemoted = hasReadinessData && win.items.some((i: any) => i.demoted)

          return (
            <motion.div
              key={windowKey}
              layout
              style={{
                borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${
                  hasPromoted ? `${CC.green}20`
                  : hasDemoted ? `${CC.orange}12`
                  : isActive ? `${style.accentColor}20`
                  : CC.border
                }`,
                background: isExpanded ? style.gradient : CC.surface,
              }}
            >
              {/* Window Header — tap to expand */}
              <motion.button
                onClick={() => setExpandedWindow(isExpanded ? null : windowKey)}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{style.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                        color: isActive ? style.accentColor : CC.textSec,
                        letterSpacing: '0.15em',
                      }}>
                        {style.label}
                      </span>
                      {hasPromoted && (
                        <span style={{
                          fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                          color: CC.green, letterSpacing: '0.08em',
                          padding: '1px 4px', borderRadius: 3,
                          background: `${CC.green}10`,
                        }}>
                          ▲ PRIORITY
                        </span>
                      )}
                      {hasDemoted && !hasPromoted && (
                        <span style={{
                          fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                          color: CC.orange, letterSpacing: '0.08em',
                          padding: '1px 4px', borderRadius: 3,
                          background: `${CC.orange}10`,
                        }}>
                          ▼ DEFERRED
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
                      marginTop: 1,
                    }}>
                      {windowDone}/{windowTotal} complete
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Mini progress bar */}
                  <div style={{
                    width: 48, height: 3, borderRadius: 2,
                    background: `${style.accentColor}12`,
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${windowPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: windowPct === 100 ? CC.green : style.accentColor,
                      }}
                    />
                  </div>

                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ fontSize: 10, color: CC.textTer, display: 'inline-block' }}
                  >
                    ▼
                  </motion.span>
                </div>
              </motion.button>

              {/* Expanded items */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      padding: '0 12px 12px',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {win.items.map((item: any) => (
                        <SwipeProtocolItem
                          key={item._id}
                          item={item}
                          onComplete={handleComplete}
                          accentColor={style.accentColor}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Completion celebration */}
      <AnimatePresence>
        {percentage === 100 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              marginTop: 16, padding: '14px 16px', borderRadius: 14,
              background: `linear-gradient(135deg, ${CC.green}10, ${CC.accent}06)`,
              border: `1px solid ${CC.green}20`,
              textAlign: 'center',
            }}
          >
            <div style={{
              fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
              color: CC.green, letterSpacing: '0.12em',
              marginBottom: 4,
            }}>
              ✦ ALL PROTOCOLS VERIFIED ✦
            </div>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
            }}>
              Full adherence logged. Biological systems optimized for today.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
