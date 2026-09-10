import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   SOMATIC HISTORY SLIDER — 30-Day Time-Travel for the HUD
   
   A cinematic timeline slider at the bottom of the main HUD.
   When the user drags backward in time, the BiologicalTwin
   morphs to reflect past states — inflammation glow, coherence
   ripples, and color shifts based on actual logged data.
   
   Emits a custom event 'vive-history-day' with the selected
   day's snapshot data so BiologicalTwin can react.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  textQuad: 'rgba(255,255,255,0.12)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.25)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.12)',
  accentGlow: 'rgba(0,255,204,0.30)',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  gold: '#FFD700',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

export interface HistoryDaySnapshot {
  dayOffset: number // 0 = today, -1 = yesterday, etc.
  date: string
  dayLabel: string
  vitalityScore: number
  avgHrv: number
  sleepScore: number
  adherencePct: number
  inflammationLevel: number // 0-100 (derived from CRP, somatic tension)
  coherenceLevel: number   // 0-100 (derived from HRV + adherence + sleep)
  tensionRegions: string[]
  workoutMinutes: number
  hasData: boolean
}

function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id')
    if (!id) { id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('vive-session-id', id) }
    return id
  } catch { return 'guest-user' }
}

/** Compute inflammation & coherence from raw day data */
function computeDerivedMetrics(day: {
  vitalityScore: number
  avgHrv: number
  sleepScore: number
  adherencePct: number
  tensionRegions: string[]
}): { inflammationLevel: number; coherenceLevel: number } {
  // Inflammation: inverse of vitality + tension count
  const tensionPenalty = Math.min(40, day.tensionRegions.length * 12)
  const vitalityInverse = Math.max(0, 100 - day.vitalityScore)
  const inflammationLevel = Math.min(100, Math.round(vitalityInverse * 0.5 + tensionPenalty + (day.avgHrv < 40 ? 20 : 0)))

  // Coherence: blend of HRV quality + adherence + sleep
  const hrvNorm = Math.min(100, Math.round((day.avgHrv / 80) * 100))
  const coherenceLevel = Math.min(100, Math.round(
    hrvNorm * 0.35 + day.adherencePct * 0.35 + day.sleepScore * 0.30
  ))

  return { inflammationLevel, coherenceLevel }
}

/** Color for a day dot based on vitality score */
function getDayColor(score: number, hasData: boolean): string {
  if (!hasData) return T.textQuad
  if (score >= 80) return T.accent
  if (score >= 65) return T.green
  if (score >= 50) return T.blue
  if (score >= 35) return T.orange
  return T.red
}

/** Ghost shimmer for loading state */
function SliderGhost() {
  return (
    <div style={{
      margin: '0 16px', borderRadius: 16, overflow: 'hidden',
      background: T.surface, border: `1px solid ${T.borderBlue}`,
      padding: '12px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: T.accentDim }}
        />
        <motion.div
          animate={{ opacity: [0.1, 0.28, 0.1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{ width: 120, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 32 }}>
        {Array.from({ length: 30 }, (_, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.08, 0.2, 0.08] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.03 }}
            style={{
              flex: 1, height: 8 + Math.random() * 16, borderRadius: 2,
              background: 'rgba(0,255,204,0.08)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function SomaticHistorySlider({
  onDaySelect,
}: {
  onDaySelect?: (snapshot: HistoryDaySnapshot | null) => void
}) {
  const sessionId = useMemo(() => getSessionId(), [])
  const [selectedDay, setSelectedDay] = useState<number>(0) // 0 = today
  const [isDragging, setIsDragging] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  // Fetch 30-day data from existing queries
  const readinessData = useQuery(api.queries.getReadinessHeatmapData, { sessionId })
  const bioResumeData = useQuery(api.queries.getBioResumeData, { sessionId })

  // Build 30-day snapshot array
  const days: HistoryDaySnapshot[] = useMemo(() => {
    if (!readinessData?.days) return []

    return readinessData.days.map((day, i) => {
      const offset = i - 29 // -29 = oldest, 0 = today
      const d = new Date(day.date)
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

      // Get tension regions from bio resume if available
      const tensionRegions: string[] = []
      if (bioResumeData?.summary?.tensionRegions && offset >= -6) {
        tensionRegions.push(...bioResumeData.summary.tensionRegions)
      }

      const base = {
        vitalityScore: day.eliteScore || day.readinessScore,
        avgHrv: day.avgHrv,
        sleepScore: day.sleepScore,
        adherencePct: day.completionPct,
        tensionRegions,
        workoutMinutes: 0,
        hasData: day.hasData,
      }

      const derived = computeDerivedMetrics(base)

      return {
        dayOffset: offset,
        date: day.date,
        dayLabel,
        ...base,
        ...derived,
      }
    })
  }, [readinessData, bioResumeData])

  // Current selected snapshot
  const currentSnapshot = useMemo(() => {
    if (days.length === 0) return null
    const idx = 29 + selectedDay // selectedDay is negative offset
    return days[Math.max(0, Math.min(days.length - 1, idx))] ?? null
  }, [days, selectedDay])

  // Emit event when selection changes
  useEffect(() => {
    onDaySelect?.(currentSnapshot)

    // Also emit custom event for BiologicalTwin
    if (currentSnapshot) {
      window.dispatchEvent(new CustomEvent('vive-history-day', {
        detail: currentSnapshot,
      }))
    }
  }, [currentSnapshot, onDaySelect])

  // Handle pointer interaction on the track
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPointer(e.clientX)
  }, [days.length])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    updateFromPointer(e.clientX)
  }, [isDragging, days.length])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const updateFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track || days.length === 0) return
    const rect = track.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const dayIdx = Math.round(pct * 29)
    const offset = dayIdx - 29
    setSelectedDay(offset)
  }, [days.length])

  // Reset to today
  const resetToToday = useCallback(() => {
    setSelectedDay(0)
  }, [])

  if (!readinessData) return <SliderGhost />
  if (days.length === 0) return null

  const isViewingPast = selectedDay < 0
  const selectedIdx = 29 + selectedDay

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: '0 16px', borderRadius: 16, overflow: 'hidden',
        background: T.surface,
        border: `1px solid ${isViewingPast ? 'rgba(0,255,204,0.2)' : T.borderBlue}`,
        position: 'relative',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Ambient glow when viewing past */}
      <AnimatePresence>
        {isViewingPast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(ellipse at ${((selectedIdx / 29) * 100)}% 50%, ${T.accentGlow} 0%, transparent 60%)`,
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{
        padding: '10px 14px 0', display: 'flex', alignItems: 'center', gap: 8,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isViewingPast ? T.accent : T.blue,
          boxShadow: isViewingPast ? `0 0 8px ${T.accentGlow}` : 'none',
          transition: 'all 0.3s',
        }} />
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: isViewingPast ? T.accent : T.textTer,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          transition: 'color 0.3s',
        }}>
          SOMATIC HISTORY
        </span>
        <div style={{ flex: 1 }} />

        {/* Date label */}
        <AnimatePresence mode="wait">
          <motion.span
            key={currentSnapshot?.date ?? 'today'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
              color: isViewingPast ? T.accent : T.textSec,
              letterSpacing: '0.05em',
            }}
          >
            {isViewingPast ? currentSnapshot?.dayLabel : 'TODAY'}
          </motion.span>
        </AnimatePresence>

        {/* Reset button */}
        {isViewingPast && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={resetToToday}
            style={{
              padding: '2px 8px', borderRadius: 6,
              background: 'rgba(0,255,204,0.08)',
              border: `1px solid ${T.accentDim}`,
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: T.accent, cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            ↻ NOW
          </motion.button>
        )}
      </div>

      {/* Timeline Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          padding: '8px 14px 6px', position: 'relative', zIndex: 1,
          cursor: 'pointer', touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Bar chart visualization */}
        <div style={{
          display: 'flex', gap: 2, alignItems: 'flex-end', height: 36,
          marginBottom: 4,
        }}>
          {days.map((day, i) => {
            const isSelected = i === selectedIdx
            const score = day.vitalityScore || day.coherenceLevel * 0.8
            const barH = Math.max(4, (score / 100) * 32)
            const color = getDayColor(score, day.hasData)

            return (
              <motion.div
                key={day.date}
                animate={{
                  height: barH,
                  opacity: isSelected ? 1 : isDragging ? 0.5 : 0.7,
                  scale: isSelected ? 1.15 : 1,
                }}
                transition={{ duration: 0.15 }}
                style={{
                  flex: 1, borderRadius: 2,
                  background: isSelected
                    ? `linear-gradient(180deg, ${color}, ${color}88)`
                    : day.hasData ? `${color}44` : 'rgba(255,255,255,0.03)',
                  boxShadow: isSelected ? `0 0 8px ${color}40` : 'none',
                  position: 'relative',
                  minWidth: 0,
                }}
              >
                {/* Inflammation overlay — red glow on high-inflammation days */}
                {day.inflammationLevel > 50 && day.hasData && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 2,
                    background: `rgba(255,107,107,${(day.inflammationLevel - 50) / 200})`,
                  }} />
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Scrubber line */}
        <div style={{
          position: 'relative', height: 2, borderRadius: 1,
          background: 'rgba(255,255,255,0.04)',
        }}>
          <motion.div
            animate={{ left: `${(selectedIdx / 29) * 100}%` }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'absolute', top: -4, width: 10, height: 10,
              borderRadius: '50%', transform: 'translateX(-50%)',
              background: isViewingPast ? T.accent : T.blue,
              boxShadow: `0 0 12px ${isViewingPast ? T.accentGlow : T.blueGlow}`,
              border: '2px solid rgba(255,255,255,0.9)',
              zIndex: 2,
            }}
          />
          {/* Progress fill */}
          <motion.div
            animate={{ width: `${(selectedIdx / 29) * 100}%` }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              height: '100%', borderRadius: 1,
              background: `linear-gradient(90deg, ${T.blue}40, ${isViewingPast ? T.accent : T.blue}80)`,
            }}
          />
        </div>

        {/* Week markers */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '4px 0 0', position: 'relative',
        }}>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
            30d ago
          </span>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
            3w
          </span>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
            2w
          </span>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
            1w
          </span>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: isViewingPast ? T.textTer : T.textSec, fontWeight: 700 }}>
            NOW
          </span>
        </div>
      </div>

      {/* Expanded detail card */}
      <AnimatePresence>
        {(isViewingPast || isExpanded) && currentSnapshot && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '6px 14px 10px',
              borderTop: `1px solid ${T.border}`,
            }}>
              {/* Metric pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <MetricPill
                  label="VITALITY"
                  value={currentSnapshot.vitalityScore}
                  suffix=""
                  color={currentSnapshot.vitalityScore >= 70 ? T.accent : currentSnapshot.vitalityScore >= 50 ? T.blue : T.orange}
                />
                <MetricPill
                  label="HRV"
                  value={currentSnapshot.avgHrv}
                  suffix="ms"
                  color={currentSnapshot.avgHrv >= 60 ? T.green : currentSnapshot.avgHrv >= 40 ? T.blue : T.orange}
                />
                <MetricPill
                  label="SLEEP"
                  value={currentSnapshot.sleepScore}
                  suffix=""
                  color={currentSnapshot.sleepScore >= 80 ? T.accent : currentSnapshot.sleepScore >= 60 ? T.blue : T.orange}
                />
                <MetricPill
                  label="ADHERENCE"
                  value={currentSnapshot.adherencePct}
                  suffix="%"
                  color={currentSnapshot.adherencePct >= 80 ? T.green : currentSnapshot.adherencePct >= 50 ? T.blue : T.red}
                />
              </div>

              {/* Inflammation / Coherence bars */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                    color: T.textTer, letterSpacing: '0.1em', marginBottom: 3,
                  }}>
                    INFLAMMATION
                  </div>
                  <div style={{
                    height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentSnapshot.inflammationLevel}%` }}
                      transition={{ duration: 0.4 }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: currentSnapshot.inflammationLevel > 60
                          ? `linear-gradient(90deg, ${T.orange}, ${T.red})`
                          : currentSnapshot.inflammationLevel > 30
                            ? `linear-gradient(90deg, ${T.blue}, ${T.orange})`
                            : `linear-gradient(90deg, ${T.green}, ${T.blue})`,
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                    color: T.textTer, letterSpacing: '0.1em', marginBottom: 3,
                  }}>
                    COHERENCE
                  </div>
                  <div style={{
                    height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentSnapshot.coherenceLevel}%` }}
                      transition={{ duration: 0.4 }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: currentSnapshot.coherenceLevel >= 70
                          ? `linear-gradient(90deg, ${T.accent}88, ${T.accent})`
                          : currentSnapshot.coherenceLevel >= 45
                            ? `linear-gradient(90deg, ${T.blue}88, ${T.blue})`
                            : `linear-gradient(90deg, ${T.orange}88, ${T.orange})`,
                        boxShadow: currentSnapshot.coherenceLevel >= 70
                          ? `0 0 6px ${T.accentGlow}` : 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Tension regions */}
              {currentSnapshot.tensionRegions.length > 0 && (
                <div style={{
                  marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                    color: T.red, letterSpacing: '0.08em',
                  }}>
                    TENSION:
                  </span>
                  {currentSnapshot.tensionRegions.slice(0, 4).map(r => (
                    <span key={r} style={{
                      fontSize: 7, fontFamily: 'monospace', fontWeight: 600,
                      color: T.orange, padding: '1px 5px', borderRadius: 4,
                      background: 'rgba(232,151,108,0.08)',
                      border: '1px solid rgba(232,151,108,0.15)',
                    }}>
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand toggle */}
      {!isViewingPast && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, width: '100%', padding: '5px 0',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <span style={{
            fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
            color: T.textQuad, letterSpacing: '0.12em',
          }}>
            {isExpanded ? 'COLLAPSE' : 'EXPAND METRICS'}
          </span>
          <span style={{
            fontSize: 8, color: T.textQuad,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s',
          }}>
            ▼
          </span>
        </button>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes sh-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </motion.div>
  )
}

/* ── Metric Pill ── */
function MetricPill({ label, value, suffix, color }: {
  label: string; value: number; suffix: string; color: string
}) {
  return (
    <div style={{
      padding: '3px 8px', borderRadius: 6,
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${color}20`,
      display: 'flex', alignItems: 'baseline', gap: 4,
    }}>
      <span style={{
        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
        color: T.textTer, letterSpacing: '0.08em',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontFamily: 'monospace', fontWeight: 800,
        color,
      }}>
        {value > 0 ? value : '—'}{value > 0 ? suffix : ''}
      </span>
    </div>
  )
}
