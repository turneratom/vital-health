import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════════
   PROTOCOL STACK — Time-Aware + Recovery-Aware + Overdue-Aware
   Horizontal Icon Drawer with Hold-to-Confirm + Intelligence Overlay
   
   OVERDUE DETECTION: If a critical protocol's timeOfDay window
   has passed without completion, an amber glow + advisor tooltip
   nudges the user. Feels like an advisor, not a nag.
   
   INTELLIGENCE OVERLAY: When overdue protocols are detected, a
   subtle toast suggests the next available recovery slot with a
   one-tap "Reschedule" action that updates the protocol's target
   time in Convex — keeping the daily streak alive.
   ══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  getBiologicalWindow,
  getProtocolTimePriority,
  isCriticalOverdue,
  isCriticalProtocol,
  isProtocolOverdue,
  OVERDUE_AMBER,
  type WindowInfo,
} from '@/lib/utils'
import { useBiometricSync } from '@/hooks/useBiometricSync'
import { detectRecoveryState, type RecoveryState } from '@/components/SidebarInsights'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/* ── Design Tokens ── */
const S = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,',
  recovery: '#00D4FF',
  recoveryGlow: 'rgba(0,212,255,',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

const HOLD_DURATION = 600

function getCategoryColor(category: string, isRecoveryBoosted?: boolean): { color: string; glow: string } {
  if (isRecoveryBoosted && category === 'recovery') return { color: S.recovery, glow: S.recoveryGlow }
  switch (category) {
    case 'supplement': return { color: '#00DC82', glow: 'rgba(0,220,130,' }
    case 'training': return { color: '#3B82F6', glow: 'rgba(59,130,246,' }
    case 'biohacking': return { color: '#AF82FF', glow: 'rgba(175,130,255,' }
    case 'nutrition': return { color: '#E8976C', glow: 'rgba(232,151,108,' }
    case 'recovery': return { color: '#00D4FF', glow: 'rgba(0,212,255,' }
    case 'movement': return { color: '#60A5FA', glow: 'rgba(96,165,250,' }
    default: return { color: S.accent, glow: S.accentGlow }
  }
}

function getWindowAccent(w: WindowInfo, isRecovery: boolean): { color: string; glow: string } {
  if (isRecovery) return { color: S.recovery, glow: S.recoveryGlow }
  switch (w.window) {
    case 'early-morning': return { color: '#FFB86B', glow: 'rgba(255,184,107,' }
    case 'morning': return { color: '#00FFCC', glow: 'rgba(0,255,204,' }
    case 'midday': return { color: '#6B8AFF', glow: 'rgba(107,138,255,' }
    case 'afternoon': return { color: '#3B82F6', glow: 'rgba(59,130,246,' }
    case 'evening': return { color: '#AF82FF', glow: 'rgba(175,130,255,' }
    case 'night': return { color: '#4B5563', glow: 'rgba(75,85,99,' }
  }
}

const RECOVERY_BOOST_PATTERNS = [
  'breathwork', 'breath', 'zone 2', 'magnesium', 'mag threonate',
  'magtein', 'recovery', 'mobility', 'stretch', 'yoga', 'sauna',
  'cold', 'meditation', 'sleep', 'rest', 'hydration', 'water',
  'ashwagandha', 'glycine', 'apigenin', 'walk', 'gentle',
]

function isRecoveryProtocol(name: string, category: string): boolean {
  const lower = name.toLowerCase()
  if (category === 'recovery') return true
  return RECOVERY_BOOST_PATTERNS.some(p => lower.includes(p))
}

function dispatchBioPulse(color: string) {
  let r = 0, g = 255, b = 204
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) { r = parseInt(rgbaMatch[1]); g = parseInt(rgbaMatch[2]); b = parseInt(rgbaMatch[3]) }
  else if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    r = parseInt(hex.slice(0, 2), 16) || 0; g = parseInt(hex.slice(2, 4), 16) || 0; b = parseInt(hex.slice(4, 6), 16) || 0
  }
  window.dispatchEvent(new CustomEvent('optimizationPulse', { detail: { r, g, b, duration: 1200 } }))
}

/* ══════════════════════════════════════════════════════════════════
   INTELLIGENCE OVERLAY — Smart Reschedule Suggestion Engine
   
   Computes the next available time slot for an overdue protocol
   and presents a non-intrusive toast with a one-tap reschedule.
   ══════════════════════════════════════════════════════════════════ */

interface RescheduleSuggestion {
  protocolId: string
  protocolName: string
  icon: string
  category: string
  oldTimeOfDay: string
  suggestedTimeOfDay: string
  suggestedLabel: string
  suggestedTime: string
}

/** Compute a human-readable suggested time for the next available slot */
function getSuggestedSlot(windowInfo: WindowInfo): { slot: string; label: string; time: string } {
  const h = windowInfo.hour
  // Suggest the next natural window
  if (h < 14) return { slot: 'afternoon', label: 'Afternoon', time: '2:00 PM' }
  if (h < 18) return { slot: 'evening', label: 'Evening', time: '6:00 PM' }
  // Late evening — suggest tomorrow morning
  return { slot: 'morning', label: 'Tomorrow AM', time: '7:00 AM' }
}

/** Build reschedule suggestions for overdue protocols */
function buildRescheduleSuggestions(
  items: Array<{ _id: string; name: string; icon: string; category: string; timeOfDay: string; completed: boolean }>,
  overdueIds: Set<string>,
  windowInfo: WindowInfo,
): RescheduleSuggestion[] {
  const { slot, label, time } = getSuggestedSlot(windowInfo)
  return items
    .filter(i => overdueIds.has(i._id) && !i.completed)
    .slice(0, 2) // Show max 2 suggestions at a time
    .map(i => ({
      protocolId: i._id,
      protocolName: i.name,
      icon: i.icon,
      category: i.category,
      oldTimeOfDay: i.timeOfDay,
      suggestedTimeOfDay: slot,
      suggestedLabel: label,
      suggestedTime: time,
    }))
}

/* ── Intelligence Overlay Toast ── */
function IntelligenceOverlayToast({
  suggestions,
  onReschedule,
  onDismiss,
}: {
  suggestions: RescheduleSuggestion[]
  onReschedule: (protocolId: string, newTimeOfDay: string) => void
  onDismiss: (protocolId: string) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <AnimatePresence>
      {suggestions.map((s, idx) => (
        <motion.div
          key={s.protocolId}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.35, delay: idx * 0.1, ease: [0.4, 0, 0.2, 1] }}
          style={{
            marginTop: idx === 0 ? 10 : 6,
            padding: '10px 14px',
            borderRadius: 14,
            background: 'rgba(20, 18, 14, 0.92)',
            border: `1px solid ${OVERDUE_AMBER.border}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: `0 4px 24px ${OVERDUE_AMBER.glow}0.1), 0 0 48px ${OVERDUE_AMBER.glow}0.04), 0 1px 3px rgba(0,0,0,0.3)`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient amber edge glow */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: `linear-gradient(180deg, ${OVERDUE_AMBER.glow}0.5), ${OVERDUE_AMBER.glow}0.15))`,
            borderRadius: '14px 0 0 14px',
          }} />

          {/* Protocol icon */}
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${OVERDUE_AMBER.glow}0.08)`,
            border: `1px solid ${OVERDUE_AMBER.glow}0.15)`,
            fontSize: 14,
          }}>
            {s.icon}
          </div>

          {/* Message */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: OVERDUE_AMBER.color, marginBottom: 2,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 8, opacity: 0.7 }}>⚡</span>
              Intelligence Overlay
            </div>
            <div style={{
              fontSize: 10, fontFamily: "'Inter', system-ui, sans-serif",
              color: 'rgba(255,255,255,0.7)', lineHeight: 1.45,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{s.protocolName}</span>
              {' '}window missed. System suggests{' '}
              <span style={{ color: OVERDUE_AMBER.color, fontWeight: 600 }}>{s.suggestedTime}</span>
              {' '}recovery slot.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => onReschedule(s.protocolId, s.suggestedTimeOfDay)}
              style={{
                padding: '5px 12px', borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, ${OVERDUE_AMBER.glow}0.2), ${OVERDUE_AMBER.glow}0.08))`,
                color: OVERDUE_AMBER.color, fontSize: 9, fontFamily: 'monospace',
                fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: `0 0 12px ${OVERDUE_AMBER.glow}0.1)`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${OVERDUE_AMBER.glow}0.35), ${OVERDUE_AMBER.glow}0.15))`
                e.currentTarget.style.boxShadow = `0 0 20px ${OVERDUE_AMBER.glow}0.2)`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${OVERDUE_AMBER.glow}0.2), ${OVERDUE_AMBER.glow}0.08))`
                e.currentTarget.style.boxShadow = `0 0 12px ${OVERDUE_AMBER.glow}0.1)`
              }}
            >
              Reschedule
            </button>
            <button
              onClick={() => onDismiss(s.protocolId)}
              style={{
                padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)',
                fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              ✕
            </button>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

/* ── Reschedule Success Toast ── */
function RescheduleConfirmToast({
  protocolName,
  newTime,
  onDone,
}: {
  protocolName: string
  newTime: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        marginTop: 10, padding: '8px 14px', borderRadius: 12,
        background: 'rgba(0, 220, 130, 0.06)',
        border: '1px solid rgba(0, 220, 130, 0.2)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0, 220, 130, 0.08)',
      }}
    >
      <span style={{ fontSize: 12 }}>✓</span>
      <span style={{
        fontSize: 10, fontFamily: "'Inter', system-ui, sans-serif",
        color: 'rgba(0, 220, 130, 0.9)', fontWeight: 500,
      }}>
        <span style={{ fontWeight: 700 }}>{protocolName}</span> moved to {newTime}. Streak preserved.
      </span>
    </motion.div>
  )
}

/* ── Merge Glow Particle ── */
function MergeGlow({ color, onDone }: { color: string; onDone: () => void }) {
  return (
    <motion.div
      initial={{ scale: 1, opacity: 0.9, y: 0 }}
      animate={{ scale: [1, 1.8, 0.3], opacity: [0.9, 0.6, 0], y: [0, -30, -60], filter: ['blur(0px)', 'blur(4px)', 'blur(12px)'] }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={onDone}
      style={{ position: 'absolute', inset: -6, borderRadius: '50%', background: `radial-gradient(circle, ${color}, transparent 70%)`, pointerEvents: 'none', zIndex: 20 }}
    />
  )
}

/* ── Time-of-Day Badge ── */
function TimeSlotBadge({ timeOfDay, windowInfo }: { timeOfDay: string; windowInfo: WindowInfo }) {
  const isActive = timeOfDay === 'all-day' || windowInfo.activeSlots.includes(timeOfDay)
  if (isActive) return null
  const isPast = windowInfo.pastSlots.includes(timeOfDay)
  const labels: Record<string, string> = { morning: 'AM', afternoon: 'PM', evening: 'EVE', 'all-day': '24H' }
  return (
    <div style={{
      position: 'absolute', top: -3, right: -3, fontSize: 6, fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: '0.05em', padding: '1px 3px', borderRadius: 4,
      background: isPast ? 'rgba(255,255,255,0.04)' : 'rgba(107,138,255,0.12)',
      color: isPast ? 'rgba(255,255,255,0.2)' : 'rgba(107,138,255,0.7)',
      border: `1px solid ${isPast ? 'rgba(255,255,255,0.04)' : 'rgba(107,138,255,0.15)'}`,
      zIndex: 5, lineHeight: 1,
    }}>
      {labels[timeOfDay] ?? timeOfDay.slice(0, 3).toUpperCase()}
    </div>
  )
}

/* ── Recovery Boost Badge ── */
function RecoveryBoostBadge() {
  return (
    <div style={{
      position: 'absolute', top: -3, left: -3, fontSize: 6, fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: '0.05em', padding: '1px 4px', borderRadius: 4,
      background: 'rgba(0, 212, 255, 0.12)', color: 'rgba(0, 212, 255, 0.8)',
      border: '1px solid rgba(0, 212, 255, 0.18)', zIndex: 5, lineHeight: 1,
      animation: 'ps-recoveryBadgePulse 3s ease-in-out infinite',
    }}>
      REC
    </div>
  )
}

/* ── Overdue Amber Badge ── */
function OverdueBadge() {
  return (
    <div style={{
      position: 'absolute', top: -3, left: -3, fontSize: 6, fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: '0.05em', padding: '1px 4px', borderRadius: 4,
      background: OVERDUE_AMBER.bg, color: OVERDUE_AMBER.color,
      border: `1px solid ${OVERDUE_AMBER.border}`, zIndex: 5, lineHeight: 1,
      animation: 'ps-amberPulse 2.5s ease-in-out infinite',
    }}>
      DUE
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   HOLD-TO-CONFIRM PROTOCOL ICON — with Overdue Amber Glow
   ══════════════════════════════════════════════════════════════════ */

function ProtocolIcon({
  icon, name, category, timeOfDay, completed, isMerging,
  isActiveWindow, isRecoveryBoosted, isOverdue, windowInfo, onCommit,
}: {
  icon: string; name: string; category: string; timeOfDay: string
  completed: boolean; isMerging: boolean; isActiveWindow: boolean
  isRecoveryBoosted: boolean; isOverdue: boolean; windowInfo: WindowInfo
  onCommit: () => void
}) {
  const { color, glow } = isOverdue
    ? { color: OVERDUE_AMBER.color, glow: OVERDUE_AMBER.glow }
    : getCategoryColor(category, isRecoveryBoosted)

  const [showMerge, setShowMerge] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [justCommitted, setJustCommitted] = useState(false)
  const holdStartRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const committedRef = useRef(false)
  const prevCompleted = useRef(completed)

  useEffect(() => {
    if (completed && !prevCompleted.current) setShowMerge(true)
    prevCompleted.current = completed
  }, [completed])

  const animateHold = useCallback(() => {
    const elapsed = Date.now() - holdStartRef.current
    const progress = Math.min(1, elapsed / HOLD_DURATION)
    setHoldProgress(progress)
    if (progress >= 1 && !committedRef.current) {
      committedRef.current = true; setJustCommitted(true); setIsHolding(false); setHoldProgress(0)
      if (navigator.vibrate) navigator.vibrate(30)
      onCommit(); dispatchBioPulse(glow)
      setTimeout(() => setJustCommitted(false), 800)
      return
    }
    if (progress < 1) rafRef.current = requestAnimationFrame(animateHold)
  }, [onCommit, glow])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (completed) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    holdStartRef.current = Date.now(); committedRef.current = false
    setIsHolding(true); setHoldProgress(0)
    rafRef.current = requestAnimationFrame(animateHold)
  }, [completed, animateHold])

  const handlePointerUp = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setIsHolding(false); if (!committedRef.current) setHoldProgress(0)
  }, [])

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setIsHolding(false); if (!committedRef.current) setHoldProgress(0)
  }, [])

  useEffect(() => { return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) } }, [])

  const isPastWindow = !completed && windowInfo.pastSlots.includes(timeOfDay) && timeOfDay !== 'all-day'
  const isHighlighted = isActiveWindow || isRecoveryBoosted

  const SIZE = 52, STROKE = 3, RADIUS = (SIZE - STROKE) / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const dashOffset = CIRCUMFERENCE - holdProgress * CIRCUMFERENCE

  const iconContent = (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <AnimatePresence>
        {(showMerge || isMerging || justCommitted) && (
          <MergeGlow color={`${glow}0.5)`} onDone={() => { setShowMerge(false); setJustCommitted(false) }} />
        )}
      </AnimatePresence>

      <TimeSlotBadge timeOfDay={timeOfDay} windowInfo={windowInfo} />
      {isOverdue && !completed && <OverdueBadge />}
      {isRecoveryBoosted && !completed && !isOverdue && <RecoveryBoostBadge />}

      {/* Active window / recovery / overdue pulse ring */}
      {(isHighlighted || isOverdue) && !completed && !isHolding && (
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 16,
          border: `1.5px solid ${isOverdue ? `${OVERDUE_AMBER.glow}0.3)` : `${glow}0.2)`}`,
          animation: isOverdue
            ? 'ps-amberGlowPulse 2s ease-in-out infinite'
            : isRecoveryBoosted
              ? 'ps-recoveryPulse 2.5s ease-in-out infinite'
              : 'ps-windowPulse 3s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}

      {/* Overdue ambient outer glow */}
      {isOverdue && !completed && (
        <div style={{
          position: 'absolute', inset: -6, borderRadius: 20, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(circle, ${OVERDUE_AMBER.glow}0.12), transparent 70%)`,
          animation: 'ps-amberAura 3s ease-in-out infinite',
        }} />
      )}

      <div
        style={{ position: 'relative', width: SIZE, height: SIZE }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{
            position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', transform: 'rotate(-90deg)',
            opacity: isHolding || holdProgress > 0 ? 1 : 0, transition: 'opacity 0.15s ease',
          }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={color} strokeWidth={STROKE}
            strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: holdProgress === 0 ? 'stroke-dashoffset 0.15s ease' : 'none' }} />
        </svg>

        {isHolding && (
          <div style={{
            position: 'absolute', inset: -4 - holdProgress * 8, borderRadius: '50%',
            background: `radial-gradient(circle, ${glow}${(holdProgress * 0.25).toFixed(2)}), transparent 70%)`,
            pointerEvents: 'none', zIndex: 2, transition: 'inset 0.05s linear',
          }} />
        )}

        <motion.button
          animate={{ scale: isHolding ? 0.9 : completed ? 0.92 : 1, opacity: completed ? 0.45 : isPastWindow && !isOverdue ? 0.55 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{
            width: SIZE - 4, height: SIZE - 4, margin: 2, borderRadius: 14,
            border: `1.5px solid ${
              isOverdue && !isHolding && !completed
                ? `${OVERDUE_AMBER.glow}0.4)`
                : isHolding ? `${color}80`
                : completed ? `${glow}0.12)`
                : isHighlighted ? `${glow}0.4)` : `${glow}0.2)`
            }`,
            background: completed
              ? `linear-gradient(135deg, ${glow}0.03), rgba(0,220,130,0.02))`
              : isOverdue
                ? `linear-gradient(135deg, ${OVERDUE_AMBER.glow}0.1), rgba(14,14,18,0.92))`
                : isHolding
                  ? `linear-gradient(135deg, ${glow}0.18), rgba(14,14,18,0.95))`
                  : isHighlighted
                    ? `linear-gradient(135deg, ${glow}0.12), rgba(14,14,18,0.9))`
                    : `linear-gradient(135deg, ${glow}0.06), rgba(14,14,18,0.9))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: completed ? 'default' : 'pointer', position: 'relative', overflow: 'hidden',
            transition: 'border-color 0.2s, background 0.2s',
            boxShadow: isOverdue && !completed
              ? `0 0 20px ${OVERDUE_AMBER.glow}0.2), 0 0 40px ${OVERDUE_AMBER.glow}0.08), 0 2px 8px rgba(0,0,0,0.3)`
              : isHolding
                ? `0 0 24px ${glow}0.25), 0 0 48px ${glow}0.1), 0 2px 8px rgba(0,0,0,0.3)`
                : completed ? 'none'
                : isRecoveryBoosted ? `0 0 20px ${glow}0.15), 0 2px 8px rgba(0,0,0,0.3)`
                : isActiveWindow ? `0 0 16px ${glow}0.12), 0 2px 8px rgba(0,0,0,0.3)`
                : `0 0 8px ${glow}0.05), 0 2px 8px rgba(0,0,0,0.3)`,
            touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          }}
        >
          {!completed && (
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at 50% 50%, ${isOverdue ? OVERDUE_AMBER.glow : glow}${isHolding ? '0.2' : isOverdue ? '0.15' : isHighlighted ? '0.15' : '0.08'}), transparent 70%)`,
              pointerEvents: 'none',
            }} />
          )}
          <span style={{
            fontSize: 20, position: 'relative', zIndex: 1,
            filter: completed ? 'grayscale(0.8) opacity(0.4)' : isPastWindow && !isOverdue ? 'grayscale(0.3) opacity(0.7)' : 'none',
            transition: 'filter 0.4s ease, transform 0.2s ease',
            transform: isHolding ? `scale(${0.85 + holdProgress * 0.15})` : 'scale(1)',
          }}>
            {completed ? '\u2713' : icon}
          </span>
          {completed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ position: 'absolute', inset: 0, borderRadius: 14, background: `linear-gradient(135deg, ${glow}0.04), transparent)`, pointerEvents: 'none' }} />
          )}
        </motion.button>

        {!completed && !isHolding && holdProgress === 0 && (
          <div style={{
            position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
            fontSize: 5, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.15)', whiteSpace: 'nowrap',
            pointerEvents: 'none', zIndex: 16,
          }}>
            hold
          </div>
        )}
      </div>

      <span style={{
        fontSize: 8, fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.04em',
        color: completed ? S.textTer : isOverdue ? `${OVERDUE_AMBER.color}CC` : isRecoveryBoosted ? 'rgba(0,212,255,0.7)' : isActiveWindow ? S.textSec : 'rgba(255,255,255,0.35)',
        textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', textDecoration: completed ? 'line-through' : 'none', transition: 'color 0.3s',
      }}>
        {name}
      </span>
    </div>
  )

  // Wrap overdue icons in a tooltip with the advisor nudge
  if (isOverdue && !completed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {iconContent}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[200px] text-center"
          style={{
            background: 'rgba(20,18,14,0.95)',
            border: `1px solid ${OVERDUE_AMBER.border}`,
            color: OVERDUE_AMBER.color,
            fontSize: 10,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 500,
            lineHeight: 1.5,
            padding: '8px 12px',
            borderRadius: 10,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 4px 20px ${OVERDUE_AMBER.glow}0.15), 0 0 40px ${OVERDUE_AMBER.glow}0.06)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>⚡</span>
            <span>{OVERDUE_AMBER.nudgeText}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  return iconContent
}

/* ── Adherence Mini-Ring ── */
function MiniAdherenceRing({ done, total, isRecovery }: { done: number; total: number; isRecovery: boolean }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const r = 12, c = 2 * Math.PI * r
  const dash = `${(pct / 100) * c} ${c}`
  const color = pct === 100 ? S.green : isRecovery ? S.recovery : pct > 0 ? S.accent : 'rgba(255,255,255,0.1)'
  return (
    <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
        <circle cx="15" cy="15" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={dash} transform="rotate(-90 15 15)"
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s', filter: pct === 100 ? `drop-shadow(0 0 4px ${S.greenGlow}0.5))` : 'none' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: pct === 100 ? S.green : S.text,
      }}>{pct}</div>
    </div>
  )
}

/* ── Window Indicator ── */
function WindowIndicator({ windowInfo, isRecovery, overdueCount }: { windowInfo: WindowInfo; isRecovery: boolean; overdueCount: number }) {
  const { color, glow } = getWindowAccent(windowInfo, isRecovery)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 8,
        background: `${glow}0.06)`, border: `1px solid ${glow}0.12)`,
        transition: 'background 0.6s ease, border-color 0.6s ease',
      }}>
        <span style={{ fontSize: 10 }}>{isRecovery ? '\uD83D\uDD04' : windowInfo.icon}</span>
        <span style={{
          fontSize: 8, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: `${color}CC`, transition: 'color 0.6s ease',
        }}>
          {isRecovery ? 'Recovery' : windowInfo.label}
        </span>
      </div>
      {overdueCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 8,
          background: OVERDUE_AMBER.bg, border: `1px solid ${OVERDUE_AMBER.border}`,
          animation: 'ps-amberPulse 2.5s ease-in-out infinite',
        }}>
          <span style={{ fontSize: 8 }}>⚡</span>
          <span style={{
            fontSize: 8, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: `${OVERDUE_AMBER.color}CC`,
          }}>
            {overdueCount} overdue
          </span>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   PROTOCOL STACK — Main Export
   ══════════════════════════════════════════════════════════════════ */

export default function ProtocolStack() {
  const sessionId = getTwinSessionId()
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId })
  const toggleMutation = useMutation(api.protocols.oneTapVerify)
  const rescheduleMutation = useMutation(api.protocols.rescheduleProtocolTime)
  const seedMutation = useMutation(api.protocols.seedDefaults)
  const [mergingId, setMergingId] = useState<string | null>(null)

  // Intelligence Overlay state
  const [dismissedOverlays, setDismissedOverlays] = useState<Set<string>>(new Set())
  const [rescheduleConfirm, setRescheduleConfirm] = useState<{ name: string; time: string } | null>(null)
  const [overlayShownOnce, setOverlayShownOnce] = useState(false)

  const [windowInfo, setWindowInfo] = useState<WindowInfo>(() => getBiologicalWindow())
  useEffect(() => {
    const tick = () => setWindowInfo(getBiologicalWindow())
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [])

  const { vitals } = useBiometricSync()
  const recoveryState = useMemo<RecoveryState>(() => {
    return detectRecoveryState({
      hrv: vitals.hrv, sleepScore: vitals.sleepScore, sleepHours: vitals.sleepHours,
      recovery: vitals.recovery, sleepDeepPct: vitals.sleepDeepPct, bodyBattery: vitals.bodyBattery,
    })
  }, [vitals.hrv, vitals.sleepScore, vitals.sleepHours, vitals.recovery, vitals.sleepDeepPct, vitals.bodyBattery])

  const [hasSeeded, setHasSeeded] = useState(false)
  useEffect(() => {
    if (protocolStatus && protocolStatus.total === 0 && !hasSeeded) {
      setHasSeeded(true); seedMutation({ sessionId }).catch(() => {})
    }
  }, [protocolStatus, hasSeeded, seedMutation, sessionId])

  const handleCommit = useCallback(async (protocolId: string) => {
    setMergingId(protocolId); setTimeout(() => setMergingId(null), 800)
    // If this protocol was in the overlay, dismiss it
    setDismissedOverlays(prev => new Set([...prev, protocolId]))
    try { await toggleMutation({ sessionId, protocolId: protocolId as Id<'protocols'> }) }
    catch (err) { console.error('[ProtocolStack] Toggle failed:', err) }
  }, [toggleMutation, sessionId])

  const handleReschedule = useCallback(async (protocolId: string, newTimeOfDay: string) => {
    setDismissedOverlays(prev => new Set([...prev, protocolId]))
    try {
      const result = await rescheduleMutation({
        sessionId,
        protocolId: protocolId as Id<'protocols'>,
        newTimeOfDay,
      })
      if (result) {
        const { slot, label, time } = getSuggestedSlot(windowInfo)
        setRescheduleConfirm({ name: result.protocolName, time })
        // Dispatch a green pulse to FluidCanvas for "System Updated"
        dispatchBioPulse('#00DC82')
      }
    } catch (err) {
      console.error('[ProtocolStack] Reschedule failed:', err)
    }
  }, [rescheduleMutation, sessionId, windowInfo])

  const handleDismissOverlay = useCallback((protocolId: string) => {
    setDismissedOverlays(prev => new Set([...prev, protocolId]))
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current; if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const obs = new ResizeObserver(checkScroll); obs.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); obs.disconnect() }
  }, [checkScroll, protocolStatus])

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current; if (!el) return
    el.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }, [])

  // RECOVERY-AWARE + TIME-OF-DAY + OVERDUE SORTING
  const items = useMemo(() => {
    if (!protocolStatus?.items) return []
    return [...protocolStatus.items].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1

      // Overdue critical protocols get elevated priority
      const aOverdue = isCriticalOverdue(a.name, a.category, a.timeOfDay, a.completed, windowInfo)
      const bOverdue = isCriticalOverdue(b.name, b.category, b.timeOfDay, b.completed, windowInfo)
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

      if (recoveryState.isRecoveryMode) {
        const aIsRecovery = isRecoveryProtocol(a.name, a.category)
        const bIsRecovery = isRecoveryProtocol(b.name, b.category)
        if (aIsRecovery !== bIsRecovery) return aIsRecovery ? -1 : 1
        if (aIsRecovery && bIsRecovery) {
          const aCat = a.category === 'recovery' ? 0 : 1
          const bCat = b.category === 'recovery' ? 0 : 1
          if (aCat !== bCat) return aCat - bCat
        }
      }

      const aPriority = getProtocolTimePriority(a.timeOfDay, a.completed, windowInfo)
      const bPriority = getProtocolTimePriority(b.timeOfDay, b.completed, windowInfo)
      if (aPriority !== bPriority) return aPriority - bPriority
      return a.sortOrder - b.sortOrder
    })
  }, [protocolStatus, windowInfo, recoveryState])

  const overdueIds = useMemo(() => {
    return new Set(
      items.filter(i => isCriticalOverdue(i.name, i.category, i.timeOfDay, i.completed, windowInfo)).map(i => i._id)
    )
  }, [items, windowInfo])

  // Intelligence Overlay suggestions (filtered by dismissed)
  const overlaySuggestions = useMemo(() => {
    const suggestions = buildRescheduleSuggestions(items, overdueIds, windowInfo)
    return suggestions.filter(s => !dismissedOverlays.has(s.protocolId))
  }, [items, overdueIds, windowInfo, dismissedOverlays])

  // Auto-show overlay after a brief delay when overdue protocols appear
  useEffect(() => {
    if (overdueIds.size > 0 && !overlayShownOnce) {
      const t = setTimeout(() => setOverlayShownOnce(true), 2000)
      return () => clearTimeout(t)
    }
  }, [overdueIds.size, overlayShownOnce])

  const recoveryBoostedIds = useMemo(() => {
    if (!recoveryState.isRecoveryMode) return new Set<string>()
    return new Set(items.filter(i => !i.completed && isRecoveryProtocol(i.name, i.category)).map(i => i._id))
  }, [items, recoveryState.isRecoveryMode])

  const activeWindowCount = useMemo(() => {
    if (recoveryState.isRecoveryMode) return items.filter(i => !i.completed && isRecoveryProtocol(i.name, i.category)).length
    return items.filter(i => !i.completed && (i.timeOfDay === 'all-day' || windowInfo.activeSlots.includes(i.timeOfDay))).length
  }, [items, windowInfo, recoveryState])

  const done = protocolStatus?.done ?? 0
  const total = protocolStatus?.total ?? 0
  const allDone = done === total && total > 0

  if (!protocolStatus) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: 8 }}>
        <div style={{ width: 16, height: 16, border: '2px solid rgba(59,130,246,0.12)', borderTopColor: S.blue, borderRadius: '50%', animation: 'ps-spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: S.textTer }}>Loading stack...</span>
        <style>{`@keyframes ps-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 10, fontFamily: 'monospace', color: S.textTer }}>
        Seeding your protocol stack...
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MiniAdherenceRing done={done} total={total} isRecovery={recoveryState.isRecoveryMode} />
            <div>
              <div style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: allDone ? S.green : overdueIds.size > 0 ? OVERDUE_AMBER.color : recoveryState.isRecoveryMode ? S.recovery : S.accent,
                transition: 'color 0.6s ease',
              }}>
                {allDone ? 'Stack Complete' : overdueIds.size > 0 ? 'Friction Detected' : recoveryState.isRecoveryMode ? 'Recovery Stack' : 'Daily Stack'}
              </div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: S.textTer }}>
                {done}/{total}
                {overdueIds.size > 0 && !allDone
                  ? ` \u00B7 ${overdueIds.size} need attention`
                  : activeWindowCount > 0 && !allDone
                    ? recoveryState.isRecoveryMode ? ` \u00B7 ${activeWindowCount} recovery` : ` \u00B7 ${activeWindowCount} ready now`
                    : ' \u00B7 hold to commit'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WindowIndicator windowInfo={windowInfo} isRecovery={recoveryState.isRecoveryMode} overdueCount={overdueIds.size} />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {['supplement', 'training', 'biohacking', 'nutrition', 'recovery'].map(cat => {
                const { color: catColor } = getCategoryColor(cat)
                const count = items.filter(i => i.category === cat).length
                if (count === 0) return null
                return <div key={cat} style={{ width: 5, height: 5, borderRadius: '50%', background: catColor, boxShadow: `0 0 4px ${catColor}40`, opacity: 0.7 }} />
              })}
            </div>
          </div>
        </div>

        {/* Horizontal scrollable icon drawer */}
        <div style={{ position: 'relative' }}>
          {canScrollLeft && (
            <button onClick={() => scroll('left')} style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(90deg, rgba(10,10,11,0.95), transparent)',
              border: 'none', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: S.textTer, fontSize: 12,
            }}>{'\u2039'}</button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll('right')} style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(270deg, rgba(10,10,11,0.95), transparent)',
              border: 'none', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: S.textTer, fontSize: 12,
            }}>{'\u203A'}</button>
          )}

          <div ref={scrollRef} className="ps-scroll" style={{
            display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden', padding: '4px 2px 8px',
            scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch',
          }}>
            {items.map((item) => {
              const isActiveWin = item.timeOfDay === 'all-day' || windowInfo.activeSlots.includes(item.timeOfDay)
              const isRecBoosted = recoveryBoostedIds.has(item._id)
              const isOverdue = overdueIds.has(item._id)
              return (
                <ProtocolIcon
                  key={item._id} icon={item.icon} name={item.name} category={item.category}
                  timeOfDay={item.timeOfDay} completed={item.completed} isMerging={mergingId === item._id}
                  isActiveWindow={isActiveWin} isRecoveryBoosted={isRecBoosted} isOverdue={isOverdue}
                  windowInfo={windowInfo} onCommit={() => handleCommit(item._id)}
                />
              )
            })}
          </div>
        </div>

        {/* ═══ INTELLIGENCE OVERLAY — Reschedule Toast ═══ */}
        <AnimatePresence>
          {overlayShownOnce && overlaySuggestions.length > 0 && !allDone && (
            <IntelligenceOverlayToast
              suggestions={overlaySuggestions}
              onReschedule={handleReschedule}
              onDismiss={handleDismissOverlay}
            />
          )}
        </AnimatePresence>

        {/* ═══ Reschedule Confirmation Toast ═══ */}
        <AnimatePresence>
          {rescheduleConfirm && (
            <RescheduleConfirmToast
              protocolName={rescheduleConfirm.name}
              newTime={rescheduleConfirm.time}
              onDone={() => setRescheduleConfirm(null)}
            />
          )}
        </AnimatePresence>

        {/* All-done ambient glow bar */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0.3 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{
                marginTop: 6, height: 2, borderRadius: 1,
                background: `linear-gradient(90deg, transparent, ${S.green}, ${S.accent}, ${S.green}, transparent)`,
                boxShadow: `0 0 12px ${S.greenGlow}0.3)`, transformOrigin: 'center',
              }}
            />
          )}
        </AnimatePresence>

        {/* Timestamp + context */}
        <div style={{
          marginTop: 6, fontSize: 7, fontFamily: 'monospace', color: S.textTer,
          textAlign: 'center', letterSpacing: '0.06em',
        }}>
          protocols {'\u00B7'} {protocolStatus.dateKey}
          {overdueIds.size > 0 ? ` \u00B7 ${overdueIds.size} overdue` : recoveryState.isRecoveryMode ? ' \u00B7 recovery priority' : ` \u00B7 ${windowInfo.label.toLowerCase()} window`}
          {' \u00B7 hold to commit'}
        </div>

        {/* Animations */}
        <style>{`
          .ps-scroll::-webkit-scrollbar { display: none; }
          @keyframes ps-windowPulse {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.04); }
          }
          @keyframes ps-recoveryPulse {
            0%, 100% { opacity: 0.3; transform: scale(1); box-shadow: 0 0 0 0 rgba(0,212,255,0); }
            50% { opacity: 0.9; transform: scale(1.06); box-shadow: 0 0 12px 2px rgba(0,212,255,0.15); }
          }
          @keyframes ps-recoveryBadgePulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          @keyframes ps-amberPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          @keyframes ps-amberGlowPulse {
            0%, 100% { opacity: 0.3; transform: scale(1); box-shadow: 0 0 0 0 rgba(255,184,107,0); }
            50% { opacity: 0.85; transform: scale(1.05); box-shadow: 0 0 14px 3px rgba(255,184,107,0.18); }
          }
          @keyframes ps-amberAura {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>
    </TooltipProvider>
  )
}
