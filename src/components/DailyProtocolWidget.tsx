import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════════
   DAILY PROTOCOL WIDGET — Baseline-Driven Checklist
   
   Pulls daily tasks from computedBaselines (BioLogic.ts):
   • Hydration Goal — based on weight-derived daily target
   • Morning Sun — circadian rhythm protocol
   • Supplements — driven by BMR/TDEE caloric targets
   • Breathwork — driven by HRV target range
   • Movement — driven by TDEE activity level
   
   Completion toggle triggers a proximity-style glow ripple effect.
   Daily Adherence % displayed at the top.
   ══════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBiometricSync } from '@/hooks/useBiometricSync'
import {
  computeAllBaselines,
  type ComputedBaselines,
  type PhysicalProfile,
} from '@/lib/intelligence/BioLogic'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Design Tokens ── */
const W = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  card: 'rgba(255,255,255,0.03)',
  cardDone: 'rgba(0,220,130,0.04)',
  border: 'rgba(255,255,255,0.06)',
  borderDone: 'rgba(0,220,130,0.20)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  green: '#00DC82',
  greenDim: 'rgba(0,220,130,0.12)',
  greenGlow: 'rgba(0,220,130,0.35)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.08)',
  accentGlow: 'rgba(0,255,204,0.30)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.10)',
  blueGlow: 'rgba(59,130,246,0.30)',
  orange: '#E8976C',
  orangeDim: 'rgba(232,151,108,0.10)',
  orangeGlow: 'rgba(232,151,108,0.30)',
  purple: '#AF82FF',
  purpleDim: 'rgba(175,130,255,0.10)',
  purpleGlow: 'rgba(175,130,255,0.30)',
  cyan: '#00D4FF',
  cyanDim: 'rgba(0,212,255,0.10)',
  cyanGlow: 'rgba(0,212,255,0.30)',
}

/* ── Types ── */
interface ProtocolTask {
  id: string
  icon: string
  title: string
  subtitle: string
  reason: string
  accentColor: string
  accentDim: string
  accentGlow: string
  /** Source metric from baselines */
  sourceMetric?: string
  sourceValue?: string
}

/* ── Task Generation from Baselines ── */

function generateBaselineTasks(
  baselines: ComputedBaselines,
  vitals: ReturnType<typeof useBiometricSync>['vitals'],
): ProtocolTask[] {
  const { hydration, bmr, hrv, caffeine } = baselines

  const tasks: ProtocolTask[] = []

  // 1. Hydration Goal
  const liters = (hydration.baseMl / 1000).toFixed(1)
  tasks.push({
    id: 'baseline-hydration',
    icon: '💧',
    title: `Hydration Goal: ${liters}L`,
    subtitle: `${hydration.baseOz} oz · weight-calibrated intake`,
    reason: `Based on your ${baselines.profile.weightKg}kg body weight, your optimal daily water intake is ${liters}L. Active days require ${(hydration.activeMl / 1000).toFixed(1)}L.`,
    accentColor: W.cyan,
    accentDim: W.cyanDim,
    accentGlow: W.cyanGlow,
    sourceMetric: 'Hydration',
    sourceValue: `${liters}L`,
  })

  // 2. Morning Sun Exposure
  tasks.push({
    id: 'baseline-morning-sun',
    icon: '☀️',
    title: 'Morning Sun: 10min',
    subtitle: 'First 30min after waking · no sunglasses',
    reason: `Morning light exposure within 30 minutes of waking sets your circadian clock, boosting cortisol at the right time and improving sleep onset by 30-45 minutes.`,
    accentColor: W.orange,
    accentDim: W.orangeDim,
    accentGlow: W.orangeGlow,
    sourceMetric: 'Circadian',
    sourceValue: '10min',
  })

  // 3. Supplement Protocol (driven by BMR/caloric targets)
  const tdee = bmr.tdeeModerate
  tasks.push({
    id: 'baseline-supplements',
    icon: '💊',
    title: 'Daily Supplements',
    subtitle: `Calibrated to ${tdee.toLocaleString()} kcal TDEE`,
    reason: `Your estimated BMR is ${bmr.bmrKcal.toLocaleString()} kcal/day (Mifflin-St Jeor). At moderate activity, TDEE is ${tdee.toLocaleString()} kcal. Micronutrient needs scale with metabolic output.`,
    accentColor: W.green,
    accentDim: W.greenDim,
    accentGlow: W.greenGlow,
    sourceMetric: 'BMR',
    sourceValue: `${bmr.bmrKcal.toLocaleString()} kcal`,
  })

  // 4. Breathwork / HRV Training
  const hrvBelow = vitals.hrv < hrv.median
  tasks.push({
    id: 'baseline-breathwork',
    icon: '🫁',
    title: hrvBelow ? 'HRV Recovery Breathwork' : 'Vagal Tone Maintenance',
    subtitle: hrvBelow
      ? `HRV ${Math.round(vitals.hrv)}ms < target ${hrv.median}ms · 5min box breathing`
      : `HRV on track · 3min coherence breathing`,
    reason: `Your target HRV range is ${hrv.low}–${hrv.high}ms (${hrv.cohort}). ${hrvBelow ? `Current HRV ${Math.round(vitals.hrv)}ms is below median. Box breathing (4-4-4-4) directly stimulates vagal tone.` : `Maintaining parasympathetic tone with daily coherence breathing prevents HRV decline.`}`,
    accentColor: W.purple,
    accentDim: W.purpleDim,
    accentGlow: W.purpleGlow,
    sourceMetric: 'HRV Target',
    sourceValue: `${hrv.median}ms`,
  })

  // 5. Movement / Activity
  const recoveryLow = vitals.recovery < 60
  tasks.push({
    id: 'baseline-movement',
    icon: recoveryLow ? '🧘' : '🏃',
    title: recoveryLow ? 'Active Recovery Walk' : 'Zone 2 Movement',
    subtitle: recoveryLow
      ? '20min easy walk · recovery at ' + Math.round(vitals.recovery) + '%'
      : '15min nasal breathing · HR 120-140bpm',
    reason: recoveryLow
      ? `Recovery at ${Math.round(vitals.recovery)}% suggests autonomic fatigue. Light walking promotes parasympathetic rebound without adding strain.`
      : `With adequate recovery (${Math.round(vitals.recovery)}%), Zone 2 cardio builds mitochondrial density. Your TDEE at high activity is ${bmr.tdeeHigh.toLocaleString()} kcal.`,
    accentColor: W.blue,
    accentDim: W.blueDim,
    accentGlow: W.blueGlow,
    sourceMetric: 'TDEE High',
    sourceValue: `${bmr.tdeeHigh.toLocaleString()} kcal`,
  })

  return tasks
}

/* ── Glow Ripple Effect ── */

function GlowRipple({ color, active }: { color: string; active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0.8 }}
          animate={{ scale: 2.5, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: 16,
            background: `radial-gradient(circle, ${color}, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
    </AnimatePresence>
  )
}

/* ── Task Card with Glow Toggle ── */

function TaskCard({
  task,
  isCompleted,
  isAnimating,
  onToggle,
  index,
}: {
  task: ProtocolTask
  isCompleted: boolean
  isAnimating: boolean
  onToggle: () => void
  index: number
}) {
  const [showReason, setShowReason] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      style={{
        position: 'relative',
        background: isCompleted ? W.cardDone : W.card,
        border: `1px solid ${isCompleted ? W.borderDone : W.border}`,
        borderRadius: 14,
        padding: '12px 14px',
        overflow: 'hidden',
        transition: 'all 0.4s ease',
      }}
    >
      {/* Glow ripple on completion */}
      <GlowRipple color={task.accentGlow} active={isAnimating} />

      {/* Left accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 3, height: '100%',
        background: isCompleted
          ? `linear-gradient(180deg, ${W.green}, ${W.green}40)`
          : `linear-gradient(180deg, ${task.accentColor}, ${task.accentColor}40)`,
        borderRadius: '14px 0 0 14px',
        transition: 'background 0.4s ease',
      }} />

      {/* Completed glow overlay */}
      {isCompleted && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          background: `radial-gradient(ellipse at 30% 50%, ${task.accentGlow}, transparent 70%)`,
          opacity: 0.15, pointerEvents: 'none',
          transition: 'opacity 0.6s ease',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingLeft: 6, position: 'relative', zIndex: 1 }}>
        {/* Toggle button */}
        <button
          onClick={onToggle}
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            border: `1.5px solid ${isCompleted ? W.green : 'rgba(255,255,255,0.15)'}`,
            background: isCompleted ? `${W.green}15` : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.25s ease',
            boxShadow: isCompleted ? `0 0 12px ${W.greenGlow}` : 'none',
          }}
        >
          {isCompleted && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              width="12" height="12" viewBox="0 0 14 14" fill="none"
            >
              <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke={W.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13 }}>{task.icon}</span>
            <span style={{
              fontSize: 12, fontWeight: 600, lineHeight: 1.3,
              color: isCompleted ? W.green : W.text,
              textDecoration: isCompleted ? 'line-through' : 'none',
              opacity: isCompleted ? 0.7 : 1,
              transition: 'all 0.3s ease',
            }}>
              {task.title}
            </span>
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: 10, color: W.textTer, fontFamily: 'monospace',
            marginBottom: 5, lineHeight: 1.4,
          }}>
            {task.subtitle}
          </div>

          {/* Source metric badge + expand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {task.sourceMetric && task.sourceValue && (
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: task.accentColor, background: task.accentDim,
                padding: '2px 6px', borderRadius: 4,
              }}>
                {task.sourceMetric}: {task.sourceValue}
              </span>
            )}

            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: W.accent, background: W.accentDim,
              padding: '2px 6px', borderRadius: 4,
            }}>
              AI-ESTIMATED
            </span>

            <button
              onClick={() => setShowReason(!showReason)}
              style={{
                marginLeft: 'auto', fontSize: 8, fontFamily: 'monospace',
                color: W.textTer, background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 4px',
              }}
            >
              {showReason ? '▲ Less' : '▼ Why'}
            </button>
          </div>

          {/* Expanded reason */}
          <AnimatePresence>
            {showReason && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: 6, padding: '6px 8px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                  border: `1px solid ${W.border}`,
                }}>
                  <div style={{
                    fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                    letterSpacing: '0.08em', color: task.accentColor,
                    textTransform: 'uppercase', marginBottom: 3,
                  }}>
                    Baseline Logic
                  </div>
                  <div style={{ fontSize: 10, color: W.textSec, lineHeight: 1.5 }}>
                    {task.reason}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Done badge */}
        {isCompleted && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              letterSpacing: '0.1em', color: W.green,
              textTransform: 'uppercase', opacity: 0.6,
              position: 'absolute', top: 2, right: 4,
            }}
          >
            ✓
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

/* ── Adherence Ring ── */

function AdherenceRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const circumference = 2 * Math.PI * 18
  const dashArray = `${(pct / 100) * circumference} ${circumference}`

  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r="18" fill="none"
          stroke={pct === 100 ? W.green : pct > 0 ? W.accent : 'rgba(255,255,255,0.1)'}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={dashArray}
          transform="rotate(-90 22 22)"
          style={{
            transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease',
            filter: pct === 100 ? `drop-shadow(0 0 6px ${W.greenGlow})` : 'none',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
        color: pct === 100 ? W.green : W.text,
      }}>
        {pct}%
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   DAILY PROTOCOL WIDGET — Main Export
   ══════════════════════════════════════════════════════════════════ */

export default function DailyProtocolWidget() {
  const { vitals } = useBiometricSync()

  // Try to load physical baseline from Convex
  const sessionId = getTwinSessionId()

  const physicalBaseline = useQuery(api.queries.getPhysicalBaseline, { sessionId })

  // Compute baselines from profile (or use defaults)
  const baselines = useMemo<ComputedBaselines>(() => {
    if (physicalBaseline?.sex && physicalBaseline?.dateOfBirth && physicalBaseline?.heightCm && physicalBaseline?.weightKg) {
      const dob = physicalBaseline.dateOfBirth
      const birth = new Date(dob)
      const now = new Date()
      let age = now.getFullYear() - birth.getFullYear()
      const md = now.getMonth() - birth.getMonth()
      if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--

      const profile: PhysicalProfile = {
        sex: (['male', 'female', 'intersex', 'prefer_not'].includes(physicalBaseline.sex)
          ? physicalBaseline.sex : 'prefer_not') as PhysicalProfile['sex'],
        age: Math.max(18, age),
        heightCm: physicalBaseline.heightCm,
        weightKg: physicalBaseline.weightKg,
      }
      return computeAllBaselines(profile)
    }

    // Default profile if no baseline captured
    return computeAllBaselines({
      sex: 'male',
      age: 30,
      heightCm: 178,
      weightKg: 80,
    })
  }, [physicalBaseline])

  // Generate tasks from baselines + current vitals
  const tasks = useMemo(
    () => generateBaselineTasks(baselines, vitals),
    [baselines, vitals.hrv, vitals.recovery]
  )

  // Completion state (daily reset via localStorage)
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('vive-baseline-protocol-completed')
      const dateKey = new Date().toISOString().slice(0, 10)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.date === dateKey) return new Set(parsed.ids)
      }
    } catch {}
    return new Set()
  })

  // Track which card is currently animating its glow
  const [animatingId, setAnimatingId] = useState<string | null>(null)

  // Persist completions
  useEffect(() => {
    const dateKey = new Date().toISOString().slice(0, 10)
    try {
      localStorage.setItem('vive-baseline-protocol-completed', JSON.stringify({
        date: dateKey,
        ids: Array.from(completedIds),
      }))
    } catch {}
  }, [completedIds])

  // Log to Convex
  const logToProtocolLogs = useMutation(api.mutations.logProtocolCompletionToLogs)

  const handleToggle = useCallback(async (task: ProtocolTask) => {
    const isNowCompleted = !completedIds.has(task.id)

    // Optimistic update
    setCompletedIds(prev => {
      const next = new Set(prev)
      if (isNowCompleted) next.add(task.id)
      else next.delete(task.id)
      return next
    })

    // Trigger glow animation on completion
    if (isNowCompleted) {
      setAnimatingId(task.id)
      setTimeout(() => setAnimatingId(null), 900)

      // Log to DB
      try {
        await logToProtocolLogs({
          sessionId,
          protocolId: task.id,
          protocolName: task.title,
          category: 'nutrition',
          completedAt: Date.now(),
          status: 'completed',
        })
      } catch (err) {
        console.error('[DailyProtocolWidget] Log failed:', err)
      }
    }
  }, [completedIds, logToProtocolLogs, sessionId])

  const completedCount = tasks.filter(t => completedIds.has(t.id)).length
  const allDone = completedCount === tasks.length && tasks.length > 0

  return (
    <div>
      {/* Header with adherence */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            letterSpacing: '0.12em', color: W.accent,
            textTransform: 'uppercase', marginBottom: 2,
          }}>
            Daily Adherence
          </div>
          <div style={{ fontSize: 11, color: W.textSec, fontFamily: 'monospace' }}>
            {completedCount}/{tasks.length} protocols · baseline-driven
          </div>
        </div>
        <AdherenceRing completed={completedCount} total={tasks.length} />
      </div>

      {/* Profile context pill */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10,
      }}>
        {[
          { label: baselines.profile.sex === 'male' ? '♂' : baselines.profile.sex === 'female' ? '♀' : '⚥', value: `${baselines.profile.age}y` },
          { label: '📏', value: `${baselines.profile.heightCm}cm` },
          { label: '⚖️', value: `${baselines.profile.weightKg}kg` },
          { label: '🔥', value: `${baselines.bmr.bmrKcal} kcal` },
        ].map((p, i) => (
          <div key={i} style={{
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${W.border}`,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 10 }}>{p.label}</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: W.textSec, fontWeight: 600 }}>
              {p.value}
            </span>
          </div>
        ))}
        {!physicalBaseline?.sex && (
          <div style={{
            padding: '3px 8px', borderRadius: 6,
            background: W.orangeDim,
            border: `1px solid rgba(232,151,108,0.25)`,
            fontSize: 8, fontFamily: 'monospace', color: W.orange,
            fontWeight: 600, letterSpacing: '0.06em',
          }}>
            USING DEFAULTS
          </div>
        )}
      </div>

      {/* Task Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            task={task}
            isCompleted={completedIds.has(task.id)}
            isAnimating={animatingId === task.id}
            onToggle={() => handleToggle(task)}
            index={i}
          />
        ))}
      </div>

      {/* All-done celebration */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              marginTop: 8, padding: '8px 10px',
              background: W.greenDim, border: `1px solid ${W.borderDone}`,
              borderRadius: 10, textAlign: 'center',
              boxShadow: `0 0 20px ${W.greenGlow}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: W.green, marginBottom: 2 }}>
              ✅ All baseline protocols completed
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: W.textSec }}>
              100% adherence logged · AI baselines calibrated
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div style={{
        marginTop: 8, fontSize: 8, fontFamily: 'monospace',
        color: W.textTer, textAlign: 'center', letterSpacing: '0.04em',
      }}>
        Derived from BioLogic.ts · computedBaselines · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
