import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════
   PROTOCOL MASTER — Execution HUD
   
   High-performance "Active Stack" replacing flat task lists.
   Protocols grouped by Biological Windows (Morning / Performance / Recovery).
   One-tap batch signing per window. Real-time Vitality Score recalc
   on every sign-off with proximity glow effects.
   ══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceHover: 'rgba(20,20,26,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  electricBlueGlow: 'rgba(59,130,246,0.15)',
  accent: '#00FFCC',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.2)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
  gold: '#C4A46C',
  goldGlow: 'rgba(196,164,108,0.15)',
}

const WINDOW_CONFIG: Record<string, {
  gradient: string
  glowColor: string
  accentHex: string
  bgGlow: string
}> = {
  morning: {
    gradient: 'linear-gradient(135deg, rgba(232,151,108,0.12), rgba(232,151,108,0.03))',
    glowColor: 'rgba(232,151,108,0.25)',
    accentHex: '#E8976C',
    bgGlow: 'radial-gradient(ellipse at 30% 20%, rgba(232,151,108,0.06) 0%, transparent 70%)',
  },
  performance: {
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.03))',
    glowColor: 'rgba(59,130,246,0.25)',
    accentHex: '#3B82F6',
    bgGlow: 'radial-gradient(ellipse at 50% 20%, rgba(59,130,246,0.06) 0%, transparent 70%)',
  },
  recovery: {
    gradient: 'linear-gradient(135deg, rgba(124,182,142,0.12), rgba(124,182,142,0.03))',
    glowColor: 'rgba(124,182,142,0.25)',
    accentHex: '#7CB68E',
    bgGlow: 'radial-gradient(ellipse at 70% 20%, rgba(124,182,142,0.06) 0%, transparent 70%)',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  supplement: '#C4A46C',
  training: '#E8976C',
  biohacking: '#6BA3BE',
  nutrition: '#7CB68E',
  recovery: '#D4847A',
  movement: '#E8976C',
}

/* ── Vitality Score Ring ── */
function VitalityScoreRing({ percentage, label }: { percentage: number; label: string }) {
  const size = 72
  const strokeW = 4
  const radius = (size - strokeW * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percentage / 100)

  const color = percentage >= 80 ? CC.green : percentage >= 50 ? CC.gold : CC.orange
  const glowColor = percentage >= 80 ? CC.greenGlow : percentage >= 50 ? CC.goldGlow : CC.orangeGlow

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeW}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <motion.span
            key={percentage}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: 'monospace', fontSize: 20, fontWeight: 800,
              color, lineHeight: 1,
            }}
          >
            {percentage}
          </motion.span>
          <span style={{
            fontFamily: 'monospace', fontSize: 7, fontWeight: 600,
            color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginTop: 2,
          }}>
            %
          </span>
        </div>
      </div>
      <span style={{
        fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
        color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

/* ── Protocol Item Row ── */
function ProtocolItem({
  item,
  accentColor,
  onToggle,
  isAnimating,
}: {
  item: {
    _id: string
    name: string
    category: string
    icon: string
    description: string
    completed: boolean
    completedAt: number | null
  }
  accentColor: string
  onToggle: (id: string) => void
  isAnimating: boolean
}) {
  const catColor = CATEGORY_COLORS[item.category] || accentColor
  const [hovered, setHovered] = useState(false)
  const [justSigned, setJustSigned] = useState(false)

  const handleClick = () => {
    if (!item.completed) {
      setJustSigned(true)
      setTimeout(() => setJustSigned(false), 800)
    }
    onToggle(item._id)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: isAnimating ? [1, 1.02, 1] : 1,
      }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        cursor: 'pointer',
        background: item.completed
          ? 'rgba(0,220,130,0.04)'
          : hovered
            ? 'rgba(255,255,255,0.03)'
            : 'transparent',
        border: `1px solid ${item.completed ? 'rgba(0,220,130,0.12)' : hovered ? 'rgba(255,255,255,0.06)' : 'transparent'}`,
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Proximity glow on hover */}
      {hovered && !item.completed && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle at 20px 50%, ${catColor}11 0%, transparent 70%)`,
        }} />
      )}

      {/* Sign-off pulse */}
      <AnimatePresence>
        {justSigned && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0.8 }}
            animate={{ opacity: 0, scale: 2.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
              width: 24, height: 24, borderRadius: '50%',
              background: CC.green, pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Checkbox */}
      <div style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
        border: `2px solid ${item.completed ? CC.green : 'rgba(255,255,255,0.12)'}`,
        background: item.completed ? 'rgba(0,220,130,0.15)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.25s',
        boxShadow: item.completed ? `0 0 8px ${CC.greenGlow}` : 'none',
      }}>
        {item.completed && (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            width="12" height="12" viewBox="0 0 12 12"
          >
            <path d="M2.5 6.5L5 9L9.5 3.5" fill="none" stroke={CC.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </div>

      {/* Icon */}
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
          color: item.completed ? 'rgba(255,255,255,0.35)' : CC.text,
          textDecoration: item.completed ? 'line-through' : 'none',
          textDecorationColor: 'rgba(255,255,255,0.15)',
          transition: 'all 0.3s',
          lineHeight: 1.3,
        }}>
          {item.name}
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 9, fontWeight: 500,
          color: item.completed ? 'rgba(255,255,255,0.18)' : CC.textTer,
          marginTop: 2, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.description}
        </div>
      </div>

      {/* Category badge */}
      <div style={{
        padding: '2px 8px', borderRadius: 6,
        background: `${catColor}15`,
        border: `1px solid ${catColor}20`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
          color: catColor, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {item.category}
        </span>
      </div>

      {/* Completion timestamp */}
      {item.completed && item.completedAt && (
        <span style={{
          fontFamily: 'monospace', fontSize: 8, fontWeight: 600,
          color: 'rgba(0,220,130,0.4)', flexShrink: 0,
        }}>
          {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </motion.div>
  )
}

/* ── Biological Window Card ── */
function BiologicalWindowCard({
  windowKey,
  windowData,
  isActive,
  isExpanded,
  onToggleExpand,
  onToggleItem,
  onBatchSign,
  batchSigningWindow,
}: {
  windowKey: string
  windowData: {
    label: string
    icon: string
    timeRange: string
    accentColor: string
    items: Array<{
      _id: string; name: string; category: string; icon: string
      description: string; timeOfDay: string; sortOrder: number
      source: string; completed: boolean; completedAt: number | null
    }>
  }
  isActive: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleItem: (id: string) => void
  onBatchSign: () => void
  batchSigningWindow: string | null
}) {
  const config = WINDOW_CONFIG[windowKey] || WINDOW_CONFIG.performance
  const done = windowData.items.filter(i => i.completed).length
  const total = windowData.items.length
  const allDone = done === total && total > 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const incompleteCount = total - done
  const isBatchSigning = batchSigningWindow === windowKey

  if (total === 0) return null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      style={{
        borderRadius: 16,
        border: `1px solid ${isActive ? `${config.accentHex}20` : CC.border}`,
        background: isActive ? config.gradient : CC.surface,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background glow for active window */}
      {isActive && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: config.bgGlow, opacity: 0.5,
        }} />
      )}

      {/* Header */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Window icon + label */}
        <span style={{ fontSize: 20, lineHeight: 1 }}>{windowData.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
              color: CC.text, letterSpacing: '0.02em',
            }}>
              {windowData.label}
            </span>
            {isActive && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: config.accentHex,
                  boxShadow: `0 0 8px ${config.glowColor}`,
                }}
              />
            )}
          </div>
          <span style={{
            fontFamily: 'monospace', fontSize: 8, fontWeight: 600,
            color: CC.textTer, letterSpacing: '0.08em',
          }}>
            {windowData.timeRange}
          </span>
        </div>

        {/* Progress pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            padding: '3px 10px', borderRadius: 8,
            background: allDone ? 'rgba(0,220,130,0.12)' : `${config.accentHex}10`,
            border: `1px solid ${allDone ? 'rgba(0,220,130,0.2)' : `${config.accentHex}15`}`,
          }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 10, fontWeight: 800,
              color: allDone ? CC.green : config.accentHex,
            }}>
              {done}/{total}
            </span>
          </div>

          {/* Expand chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: CC.textTer, fontSize: 14, lineHeight: 1 }}
          >
            ▾
          </motion.div>
        </div>
      </div>

      {/* Mini progress bar */}
      <div style={{
        height: 2, margin: '0 16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 1, overflow: 'hidden',
      }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%', borderRadius: 1,
            background: allDone ? CC.green : config.accentHex,
            boxShadow: `0 0 8px ${allDone ? CC.greenGlow : config.glowColor}`,
          }}
        />
      </div>

      {/* Expanded items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 8px 12px' }}>
              {windowData.items.map((item) => (
                <ProtocolItem
                  key={item._id}
                  item={item}
                  accentColor={config.accentHex}
                  onToggle={onToggleItem}
                  isAnimating={isBatchSigning}
                />
              ))}

              {/* Batch Sign Button */}
              {incompleteCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.stopPropagation(); onBatchSign() }}
                  disabled={isBatchSigning}
                  style={{
                    width: '100%', marginTop: 8,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: `1px solid ${config.accentHex}25`,
                    background: `linear-gradient(135deg, ${config.accentHex}12, ${config.accentHex}06)`,
                    cursor: isBatchSigning ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: isBatchSigning ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>
                    {isBatchSigning ? '⏳' : '⚡'}
                  </span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 10, fontWeight: 800,
                    color: config.accentHex, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {isBatchSigning ? 'Signing...' : `Batch Sign ${incompleteCount} Item${incompleteCount > 1 ? 's' : ''}`}
                  </span>
                </motion.button>
              )}

              {/* All done state */}
              {allDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    textAlign: 'center', padding: '12px 0 4px',
                  }}
                >
                  <span style={{
                    fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
                    color: CC.green, letterSpacing: '0.15em', textTransform: 'uppercase',
                  }}>
                    ✓ WINDOW COMPLETE
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PROTOCOL MASTER HUD — Main Export
   ══════════════════════════════════════════════════════════════ */

export default function ProtocolMasterHUD() {
  const sessionId = useMemo(() => getTwinSessionId(), [])
  const windowData = useQuery(api.protocols.getProtocolsByBiologicalWindow, { sessionId })
  const adherence = useQuery(api.protocols.getAdherenceScore, { sessionId })
  const streak = useQuery(api.eliteScore.getAdherenceStreak, { sessionId })

  const toggleCompletion = useMutation(api.protocols.oneTapVerify)
  const batchSign = useMutation(api.protocols.batchSignWindow)
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore)

  const [expandedWindows, setExpandedWindows] = useState<Set<string>>(new Set())
  const [batchSigningWindow, setBatchSigningWindow] = useState<string | null>(null)
  const [vitalityPulse, setVitalityPulse] = useState(false)

  // Auto-expand active window on load
  useEffect(() => {
    if (windowData?.activeWindow && expandedWindows.size === 0) {
      setExpandedWindows(new Set([windowData.activeWindow]))
    }
  }, [windowData?.activeWindow])

  const toggleExpand = useCallback((key: string) => {
    setExpandedWindows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleToggleItem = useCallback(async (protocolId: string) => {
    try {
      await toggleCompletion({ sessionId, protocolId: protocolId as any })
      setVitalityPulse(true)
      setTimeout(() => setVitalityPulse(false), 600)
      // Recalculate adherence score in background
      await updateAdherence({ sessionId })
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }, [sessionId, toggleCompletion, updateAdherence])

  const handleBatchSign = useCallback(async (windowKey: string) => {
    if (!windowData?.windows) return
    const win = (windowData.windows as any)[windowKey]
    if (!win) return

    const incompleteIds = win.items
      .filter((i: any) => !i.completed)
      .map((i: any) => i._id)

    if (incompleteIds.length === 0) return

    setBatchSigningWindow(windowKey)
    try {
      await batchSign({ sessionId, protocolIds: incompleteIds })
      setVitalityPulse(true)
      setTimeout(() => setVitalityPulse(false), 800)
      await updateAdherence({ sessionId })
    } catch (err) {
      console.error('Batch sign failed:', err)
    } finally {
      setTimeout(() => setBatchSigningWindow(null), 400)
    }
  }, [sessionId, windowData, batchSign, updateAdherence])

  if (!windowData) return null

  const { windows, activeWindow, totalItems, totalDone, percentage } = windowData
  const windowKeys = ['morning', 'performance', 'recovery']
  const streakCount = streak?.streak ?? 0

  return (
    <div style={{
      padding: '24px 16px 32px',
      position: 'relative',
    }}>
      {/* Section Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, padding: '0 4px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
              color: CC.electricBlueBright, letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              Protocol Master
            </span>
            <div style={{
              width: 20, height: 1,
              background: 'linear-gradient(90deg, rgba(59,130,246,0.3), transparent)',
            }} />
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 14, fontWeight: 800,
            color: CC.text, marginTop: 4, letterSpacing: '-0.02em',
          }}>
            Active Stack
          </div>
        </div>

        {/* Vitality Score + Streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Streak badge */}
          {streakCount > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 10, fontWeight: 800,
                color: CC.orange,
              }}>
                {streakCount}d
              </span>
              <span style={{
                fontFamily: 'monospace', fontSize: 7, fontWeight: 600,
                color: CC.textTer, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Streak
              </span>
            </div>
          )}

          {/* Vitality Score Ring */}
          <motion.div
            animate={vitalityPulse ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            <VitalityScoreRing percentage={percentage} label="Vitality" />
          </motion.div>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', marginBottom: 16,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${CC.border}`,
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
            color: CC.textTer, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Today
          </span>
          <span style={{
            fontFamily: 'monospace', fontSize: 12, fontWeight: 800,
            color: totalDone === totalItems && totalItems > 0 ? CC.green : CC.text,
          }}>
            {totalDone}/{totalItems}
          </span>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
            color: CC.textTer,
          }}>
            signed
          </span>
        </div>

        {/* Window indicators */}
        <div style={{ display: 'flex', gap: 4 }}>
          {windowKeys.map(key => {
            const win = (windows as any)[key]
            if (!win || win.items.length === 0) return null
            const winDone = win.items.filter((i: any) => i.completed).length
            const winTotal = win.items.length
            const winComplete = winDone === winTotal
            const cfg = WINDOW_CONFIG[key]
            return (
              <div
                key={key}
                style={{
                  width: 8, height: 8, borderRadius: 3,
                  background: winComplete ? CC.green : `${cfg.accentHex}40`,
                  boxShadow: winComplete ? `0 0 6px ${CC.greenGlow}` : 'none',
                  transition: 'all 0.3s',
                }}
                title={`${win.label}: ${winDone}/${winTotal}`}
              />
            )
          })}
        </div>
      </div>

      {/* Biological Window Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {windowKeys.map(key => {
          const win = (windows as any)[key]
          if (!win) return null
          return (
            <BiologicalWindowCard
              key={key}
              windowKey={key}
              windowData={win}
              isActive={activeWindow === key}
              isExpanded={expandedWindows.has(key)}
              onToggleExpand={() => toggleExpand(key)}
              onToggleItem={handleToggleItem}
              onBatchSign={() => handleBatchSign(key)}
              batchSigningWindow={batchSigningWindow}
            />
          )
        })}
      </div>

      {/* All Complete Celebration */}
      <AnimatePresence>
        {totalDone === totalItems && totalItems > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{
              marginTop: 16, padding: '16px 20px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(0,220,130,0.08), rgba(0,255,204,0.04))',
              border: '1px solid rgba(0,220,130,0.15)',
              textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(0,220,130,0.08) 0%, transparent 70%)',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🏆</div>
              <div style={{
                fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                color: CC.green, letterSpacing: '0.12em', textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                ALL PROTOCOLS EXECUTED
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
                color: CC.textSec,
              }}>
                Full biological optimization achieved for today.
                {streakCount > 0 && ` ${streakCount}-day streak active.`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyframe animations */}
      <style>{`
        @keyframes pmhud-glow-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
