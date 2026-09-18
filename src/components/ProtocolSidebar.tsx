import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════
   PROTOCOL SIDEBAR — "What Do I Do Today?" Command Panel
   
   A slide-out sidebar that transforms the HUD into a proactive
   longevity coach. Based on AiContextEngine logic, it generates
   a time-aware checklist grouped by Biological Windows.
   
   When a user checks an item, a "System Synced" ripple animation
   propagates across the FluidCanvas background.
   
   Features:
   • AI-generated checklist from protocols + biomarker context
   • Biological Window grouping (Morning / Performance / Recovery)
   • Swipe-to-verify gesture on each item
   • "System Synced" canvas ripple on completion
   • Auto-collapse completed windows
   • Progress ring with real-time percentage
   ══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceHover: 'rgba(20,20,26,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  electricBlueGlow: 'rgba(59,130,246,0.15)',
  accent: '#00FFCC',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.25)',
  greenBright: '#34D399',
  orange: '#E8976C',
  red: '#FF6B6B',
  gold: '#C4A46C',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

const CATEGORY_COLORS: Record<string, string> = {
  supplement: '#C4A46C',
  training: '#E8976C',
  biohacking: '#6BA3BE',
  nutrition: '#7CB68E',
  recovery: '#D4847A',
  movement: '#E8976C',
}

const WINDOW_CONFIG: Record<string, {
  label: string
  icon: string
  accentColor: string
  glowColor: string
  timeRange: string
}> = {
  morning: {
    label: 'MORNING ACTIVATION',
    icon: '☀️',
    accentColor: '#E8976C',
    glowColor: 'rgba(232,151,108,0.12)',
    timeRange: '5:00 — 11:59',
  },
  performance: {
    label: 'PERFORMANCE WINDOW',
    icon: '⚡',
    accentColor: '#3B82F6',
    glowColor: 'rgba(59,130,246,0.12)',
    timeRange: '12:00 — 17:59',
  },
  recovery: {
    label: 'RECOVERY PROTOCOL',
    icon: '🌙',
    accentColor: '#7CB68E',
    glowColor: 'rgba(124,182,142,0.12)',
    timeRange: '18:00 — 22:00',
  },
}

/* ── System Synced Ripple — Full-screen canvas animation ── */
function SystemSyncedRipple({ trigger, onComplete }: { trigger: number; onComplete: () => void }) {
  if (!trigger) return null

  return (
    <motion.div
      key={trigger}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={onComplete}
      style={{
        position: 'fixed', inset: 0, zIndex: 99990,
        pointerEvents: 'none', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Expanding ring */}
      <motion.div
        initial={{ width: 40, height: 40, opacity: 0.8, borderRadius: '50%' }}
        animate={{
          width: [40, 300, 600],
          height: [40, 300, 600],
          opacity: [0.8, 0.3, 0],
          borderRadius: '50%',
        }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          border: `2px solid ${CC.green}`,
          boxShadow: `0 0 40px ${CC.greenGlow}, inset 0 0 40px ${CC.greenGlow}`,
        }}
      />

      {/* Inner pulse */}
      <motion.div
        initial={{ width: 20, height: 20, opacity: 1 }}
        animate={{
          width: [20, 160, 400],
          height: [20, 160, 400],
          opacity: [1, 0.4, 0],
        }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
        style={{
          position: 'absolute', borderRadius: '50%',
          background: `radial-gradient(circle, ${CC.green}20, transparent 70%)`,
        }}
      />

      {/* "SYSTEM SYNCED" text */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -4], scale: [0.9, 1, 1, 0.95] }}
        transition={{ duration: 1.6, times: [0, 0.2, 0.7, 1] }}
        style={{
          position: 'absolute',
          fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
          color: CC.green, letterSpacing: '0.25em',
          textTransform: 'uppercase',
          textShadow: `0 0 20px ${CC.greenGlow}`,
        }}
      >
        ✦ SYSTEM SYNCED
      </motion.div>
    </motion.div>
  )
}

/* ── Sidebar Protocol Item with swipe ── */
function SidebarProtocolItem({
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
    source: string
  }
  onComplete: (id: string) => void
  accentColor: string
}) {
  const x = useMotionValue(0)
  const [swiping, setSwiping] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const catColor = CATEGORY_COLORS[item.category] || accentColor

  const bgOpacity = useTransform(x, [0, 60, 120], [0, 0.5, 1])
  const checkScale = useTransform(x, [0, 60, 120], [0.3, 0.7, 1])

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    setSwiping(false)
    if (info.offset.x > 100 && !item.completed) {
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

  const isAISuggested = item.source === 'ai' || item.source === 'system'

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {/* Swipe reveal */}
      {!item.completed && (
        <motion.div
          style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: `linear-gradient(90deg, ${CC.green}18, ${CC.green}35)`,
            display: 'flex', alignItems: 'center', paddingLeft: 14,
            opacity: bgOpacity,
          }}
        >
          <motion.div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: CC.green, display: 'flex', alignItems: 'center',
            justifyContent: 'center', scale: checkScale,
          }}>
            <span style={{ fontSize: 13, color: '#fff' }}>✓</span>
          </motion.div>
          <span style={{
            marginLeft: 8, fontSize: 9, fontFamily: 'monospace',
            fontWeight: 700, color: CC.green, letterSpacing: '0.1em',
          }}>
            VERIFY
          </span>
        </motion.div>
      )}

      {/* Main card */}
      <motion.div
        style={{
          x: item.completed ? 0 : x,
          background: item.completed
            ? `linear-gradient(135deg, ${CC.green}06, ${CC.green}02)`
            : justCompleted
              ? `linear-gradient(135deg, ${CC.green}10, ${CC.green}04)`
              : 'rgba(18,18,24,0.7)',
          borderRadius: 12,
          padding: '10px 12px',
          border: `1px solid ${item.completed ? `${CC.green}18` : justCompleted ? `${CC.green}25` : 'rgba(255,255,255,0.03)'}`,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 2,
          touchAction: 'pan-y',
        }}
        drag={item.completed ? false : 'x'}
        dragConstraints={{ left: 0, right: 140 }}
        dragElastic={0.1}
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleDragEnd}
        onTap={swiping ? undefined : handleTap}
        whileTap={item.completed ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Icon */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: item.completed
              ? `linear-gradient(135deg, ${CC.green}25, ${CC.green}10)`
              : `linear-gradient(135deg, ${catColor}14, ${catColor}06)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${item.completed ? `${CC.green}25` : `${catColor}15`}`,
            flexShrink: 0, position: 'relative',
          }}>
            {item.completed ? (
              <motion.span
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                style={{ fontSize: 14, color: CC.green }}
              >
                ✓
              </motion.span>
            ) : (
              <span style={{ fontSize: 15 }}>{item.icon}</span>
            )}
            {/* Completion glow */}
            {justCompleted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0.6, 0], scale: [1, 2] }}
                transition={{ duration: 0.8 }}
                style={{
                  position: 'absolute', inset: -4, borderRadius: 12,
                  background: CC.greenGlow, pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: item.completed ? CC.textSec : CC.text,
                textDecoration: item.completed ? 'line-through' : 'none',
                textDecorationColor: `${CC.green}35`,
                letterSpacing: '0.01em', lineHeight: 1.3,
              }}>
                {item.name}
              </span>
              {isAISuggested && !item.completed && (
                <span style={{
                  fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.electricBlueBright, letterSpacing: '0.1em',
                  padding: '1px 4px', borderRadius: 3,
                  background: `${CC.electricBlue}12`,
                  border: `1px solid ${CC.electricBlue}15`,
                }}>
                  AI
                </span>
              )}
            </div>
            <div style={{
              fontSize: 9, color: CC.textTer, marginTop: 1,
              fontFamily: 'monospace', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.description}
            </div>
          </div>

          {/* Right side */}
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            {item.completed && completedTime ? (
              <div style={{
                fontSize: 8, fontFamily: 'monospace', color: CC.green,
                fontWeight: 600, letterSpacing: '0.05em',
              }}>
                {completedTime}
              </div>
            ) : (
              <div style={{
                fontSize: 7, fontFamily: 'monospace', color: CC.textTer,
                letterSpacing: '0.08em',
              }}>
                SWIPE →
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ── Mini Progress Ring ── */
function MiniProgressRing({ percentage, size = 44 }: { percentage: number; size?: number }) {
  const strokeW = 2.5
  const radius = (size - strokeW * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percentage / 100)
  const color = percentage >= 80 ? CC.green : percentage >= 50 ? CC.gold : CC.orange

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={`${color}10`} strokeWidth={strokeW} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color,
          fontFamily: 'monospace', lineHeight: 1,
        }}>
          {percentage}
        </span>
        <span style={{
          fontSize: 6, color: CC.textTer, fontFamily: 'monospace',
          letterSpacing: '0.1em',
        }}>
          %
        </span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PROTOCOL SIDEBAR — Main Export
   ══════════════════════════════════════════════════════════════ */

export default function ProtocolSidebar() {
  const sessionId = useMemo(() => getTwinSessionId(), [])
  const [isOpen, setIsOpen] = useState(false)
  const [expandedWindow, setExpandedWindow] = useState<string | null>(null)
  const [syncTrigger, setSyncTrigger] = useState(0)
  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Queries
  const windowData = useQuery(api.protocols.getProtocolsByBiologicalWindow, { sessionId })
  const aiSuggestions = useQuery(api.protocols.getAISuggestions, { sessionId })

  // Mutations
  const oneTapVerify = useMutation(api.protocols.oneTapVerify)
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore)
  const seedDefaults = useMutation(api.protocols.seedDefaults)

  // Auto-seed protocols if none exist
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (windowData && windowData.totalItems === 0 && !seeded) {
      setSeeded(true)
      seedDefaults({ sessionId }).catch(() => {})
    }
  }, [windowData, seeded, sessionId, seedDefaults])

  // Auto-expand active window
  useEffect(() => {
    if (windowData && !expandedWindow) {
      setExpandedWindow(windowData.activeWindow)
    }
  }, [windowData, expandedWindow])

  // Close sidebar on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  const handleComplete = useCallback(async (protocolId: string) => {
    try {
      const result = await oneTapVerify({ sessionId, protocolId: protocolId as any })
      await updateAdherence({ sessionId })
      if (result.completed) {
        setSyncTrigger(Date.now())
        setRecentlyCompleted(result.protocolName)
        setTimeout(() => setRecentlyCompleted(null), 2000)
      }
    } catch (err) {
      console.error('[ProtocolSidebar] Complete failed:', err)
    }
  }, [sessionId, oneTapVerify, updateAdherence])

  const percentage = windowData?.percentage ?? 0
  const totalDone = windowData?.totalDone ?? 0
  const totalItems = windowData?.totalItems ?? 0
  const windowOrder = ['morning', 'performance', 'recovery'] as const

  // Determine current time-of-day greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const timePhase = hour < 12 ? 'morning' : hour < 18 ? 'performance' : 'recovery'

  // Count AI suggestions not yet in protocols
  const aiCount = aiSuggestions?.length ?? 0

  return (
    <>
      {/* ── Floating Toggle Button ── */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        style={{
          position: 'fixed',
          bottom: 24,
          left: 16,
          zIndex: 9998,
          width: 52,
          height: 52,
          borderRadius: 16,
          background: isOpen
            ? `linear-gradient(135deg, ${CC.electricBlue}30, ${CC.accent}15)`
            : `linear-gradient(135deg, rgba(14,14,18,0.95), rgba(20,20,28,0.9))`,
          border: `1px solid ${isOpen ? `${CC.electricBlue}35` : CC.borderBlue}`,
          backdropFilter: 'blur(20px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          boxShadow: isOpen
            ? `0 0 30px ${CC.electricBlueGlow}, 0 8px 32px rgba(0,0,0,0.4)`
            : '0 4px 20px rgba(0,0,0,0.3)',
          padding: 0,
        }}
      >
        {/* Protocol icon with progress indicator */}
        <div style={{ position: 'relative' }}>
          <span style={{ fontSize: 20 }}>📋</span>
          {totalItems > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -8,
              width: 16, height: 16, borderRadius: '50%',
              background: percentage === 100 ? CC.green : CC.electricBlue,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#fff',
              fontFamily: 'monospace',
              boxShadow: `0 0 8px ${percentage === 100 ? CC.greenGlow : CC.electricBlueGlow}`,
            }}>
              {totalDone}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 6, fontFamily: 'monospace', fontWeight: 700,
          color: isOpen ? CC.electricBlueBright : CC.textTer,
          letterSpacing: '0.12em',
        }}>
          TODAY
        </span>

        {/* AI suggestion badge */}
        {aiCount > 0 && !isOpen && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: 'absolute', top: -3, left: -3,
              width: 10, height: 10, borderRadius: '50%',
              background: CC.accent,
              boxShadow: `0 0 8px ${CC.accent}40`,
            }}
          />
        )}
      </motion.button>

      {/* ── Backdrop ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={sidebarRef}
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 'min(340px, 85vw)',
              zIndex: 10000,
              background: 'linear-gradient(180deg, rgba(10,10,11,0.98), rgba(8,8,12,0.99))',
              borderRight: `1px solid ${CC.borderBlue}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '8px 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              padding: 'max(env(safe-area-inset-top, 16px), 16px) 16px 12px',
              borderBottom: `1px solid ${CC.border}`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{
                    fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                    color: CC.electricBlueBright, letterSpacing: '0.18em',
                    textTransform: 'uppercase', marginBottom: 2,
                  }}>
                    DAILY PROTOCOL
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: CC.text,
                    letterSpacing: '-0.01em',
                  }}>
                    {greeting}. Here is your stack.
                  </div>
                </div>
                <MiniProgressRing percentage={percentage} />
              </div>

              {/* Status bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 10,
                background: percentage === 100
                  ? `linear-gradient(135deg, ${CC.green}08, ${CC.green}03)`
                  : `linear-gradient(135deg, ${CC.electricBlue}06, transparent)`,
                border: `1px solid ${percentage === 100 ? `${CC.green}15` : CC.border}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: percentage === 100 ? CC.green : CC.electricBlue,
                  boxShadow: `0 0 8px ${percentage === 100 ? CC.greenGlow : CC.electricBlueGlow}`,
                }} />
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
                  letterSpacing: '0.05em',
                }}>
                  {totalDone}/{totalItems} verified · {percentage}% adherence
                </span>
                {recentlyCompleted && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      fontSize: 8, fontFamily: 'monospace', color: CC.green,
                      fontWeight: 700, marginLeft: 'auto',
                    }}
                  >
                    ✓ {recentlyCompleted}
                  </motion.span>
                )}
              </div>
            </div>

            {/* ── Scrollable Content ── */}
            <div style={{
              flex: 1, overflowY: 'auto', overflowX: 'hidden',
              padding: '12px 12px',
              paddingBottom: 'max(env(safe-area-inset-bottom, 24px), 24px)',
              WebkitOverflowScrolling: 'touch',
            }}>
              {/* Loading state */}
              {!windowData && (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 10, padding: '40px 0',
                }}>
                  <div style={{
                    width: 28, height: 28,
                    border: `2px solid ${CC.borderBlue}`,
                    borderTopColor: CC.electricBlue,
                    borderRadius: '50%',
                    animation: 'ps-spin 0.8s linear infinite',
                  }} />
                  <span style={{
                    fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
                    letterSpacing: '0.15em',
                  }}>
                    LOADING PROTOCOLS
                  </span>
                  <style>{`@keyframes ps-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Biological Windows */}
              {windowData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {windowOrder.map(windowKey => {
                    const win = windowData.windows[windowKey]
                    if (!win || win.items.length === 0) return null
                    const config = WINDOW_CONFIG[windowKey]
                    const isExpanded = expandedWindow === windowKey
                    const isActive = windowData.activeWindow === windowKey
                    const windowDone = win.items.filter((i: any) => i.completed).length
                    const windowTotal = win.items.length
                    const windowPct = windowTotal > 0 ? Math.round((windowDone / windowTotal) * 100) : 0
                    const allDone = windowPct === 100

                    return (
                      <motion.div
                        key={windowKey}
                        layout
                        style={{
                          borderRadius: 14, overflow: 'hidden',
                          border: `1px solid ${isActive ? `${config.accentColor}18` : CC.border}`,
                          background: isExpanded
                            ? `linear-gradient(135deg, ${config.accentColor}06, transparent)`
                            : 'rgba(14,14,18,0.5)',
                        }}
                      >
                        {/* Window Header */}
                        <motion.button
                          onClick={() => setExpandedWindow(isExpanded ? null : windowKey)}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            width: '100%', padding: '10px 14px',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13 }}>{config.icon}</span>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{
                                fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                                color: isActive ? config.accentColor : CC.textSec,
                                letterSpacing: '0.15em',
                              }}>
                                {config.label}
                                {isActive && (
                                  <span style={{
                                    marginLeft: 6, fontSize: 7,
                                    color: CC.accent, letterSpacing: '0.1em',
                                  }}>
                                    NOW
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontSize: 8, fontFamily: 'monospace', color: CC.textTer,
                                marginTop: 1,
                              }}>
                                {allDone ? '✓ All verified' : `${windowDone}/${windowTotal} complete`}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Mini progress bar */}
                            <div style={{
                              width: 36, height: 2.5, borderRadius: 2,
                              background: `${config.accentColor}10`,
                              overflow: 'hidden',
                            }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${windowPct}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                style={{
                                  height: '100%', borderRadius: 2,
                                  background: allDone ? CC.green : config.accentColor,
                                }}
                              />
                            </div>
                            <motion.span
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ fontSize: 9, color: CC.textTer }}
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
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{
                                padding: '0 10px 10px',
                                display: 'flex', flexDirection: 'column', gap: 5,
                              }}>
                                {win.items.map((item: any) => (
                                  <SidebarProtocolItem
                                    key={item._id}
                                    item={item}
                                    onComplete={handleComplete}
                                    accentColor={config.accentColor}
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
              )}

              {/* ── AI Suggestions Section ── */}
              {aiSuggestions && aiSuggestions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 8, padding: '0 2px',
                  }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: CC.accent,
                      boxShadow: `0 0 6px ${CC.accent}40`,
                    }} />
                    <span style={{
                      fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                      color: CC.accent, letterSpacing: '0.15em',
                    }}>
                      AI RECOMMENDATIONS
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {aiSuggestions.map((suggestion, idx) => (
                      <motion.div
                        key={`ai-${idx}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        style={{
                          padding: '10px 12px', borderRadius: 12,
                          background: `linear-gradient(135deg, ${CC.accent}06, ${CC.electricBlue}04)`,
                          border: `1px solid ${CC.accent}12`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                            {suggestion.icon}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 600, color: CC.text,
                              }}>
                                {suggestion.name}
                              </span>
                              <span style={{
                                fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                                color: suggestion.priority === 'high' ? CC.orange : CC.textSec,
                                letterSpacing: '0.1em',
                                padding: '1px 4px', borderRadius: 3,
                                background: suggestion.priority === 'high'
                                  ? `${CC.orange}12` : `${CC.textSec}08`,
                              }}>
                                {suggestion.priority.toUpperCase()}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
                              marginTop: 2, lineHeight: 1.4,
                            }}>
                              {suggestion.description}
                            </div>
                            <div style={{
                              fontSize: 8, fontFamily: 'monospace', color: CC.textSec,
                              marginTop: 4, lineHeight: 1.5,
                              padding: '4px 6px', borderRadius: 6,
                              background: 'rgba(255,255,255,0.02)',
                            }}>
                              💡 {suggestion.reason}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── All Complete Celebration ── */}
              <AnimatePresence>
                {percentage === 100 && windowData && windowData.totalItems > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      marginTop: 16, padding: '14px 14px', borderRadius: 14,
                      background: `linear-gradient(135deg, ${CC.green}08, ${CC.accent}04)`,
                      border: `1px solid ${CC.green}18`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                      color: CC.green, letterSpacing: '0.12em', marginBottom: 4,
                    }}>
                      ✦ ALL PROTOCOLS VERIFIED ✦
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
                      lineHeight: 1.5,
                    }}>
                      Full adherence logged. Biological systems optimized.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '10px 16px',
              paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
              borderTop: `1px solid ${CC.border}`,
              flexShrink: 0,
            }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsOpen(false)}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  background: `linear-gradient(135deg, ${CC.electricBlue}12, ${CC.electricBlue}06)`,
                  border: `1px solid ${CC.borderBlue}`,
                  color: CC.electricBlueBright, fontSize: 10,
                  fontFamily: 'monospace', fontWeight: 700,
                  letterSpacing: '0.1em', cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                CLOSE PROTOCOL PANEL
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── System Synced Ripple Animation ── */}
      <AnimatePresence>
        <SystemSyncedRipple
          trigger={syncTrigger}
          onComplete={() => setSyncTrigger(0)}
        />
      </AnimatePresence>
    </>
  )
}
