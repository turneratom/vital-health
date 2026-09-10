import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ══════════════════════════════════════════════════════════════
   5-SECOND DAILY CHECK-IN
   
   Minimalist somatic feedback — two sliders + tappable body diagram.
   • Flow State (cognitive): 0–100
   • Physical Readiness (body): 0–100
   • Optional body-zone tap for pain/sensation flagging
   • Instant AI correlation with active protocols
   • Wired to TrajectoryCanvas for subjective ↔ objective overlay
   
   Design: Ultra-minimal, dark command-center aesthetic
   ══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceElevated: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  purple: '#A78BFA',
  cyan: '#06B6D4',
  border: 'rgba(255,255,255,0.06)',
}

/* ── Body Zone Definitions ── */
const BODY_ZONES = [
  { id: 'head', label: 'Head', cx: 50, cy: 12, rx: 8, ry: 9 },
  { id: 'neck', label: 'Neck/Shoulders', cx: 50, cy: 24, rx: 14, ry: 5 },
  { id: 'chest', label: 'Chest', cx: 50, cy: 35, rx: 12, ry: 8 },
  { id: 'gut', label: 'Gut/Core', cx: 50, cy: 48, rx: 10, ry: 7 },
  { id: 'hips', label: 'Hips/Lower Back', cx: 50, cy: 58, rx: 13, ry: 5 },
  { id: 'knees', label: 'Knees', cx: 50, cy: 72, rx: 12, ry: 5 },
  { id: 'feet', label: 'Feet/Ankles', cx: 50, cy: 88, rx: 10, ry: 6 },
] as const

type BodyZoneId = typeof BODY_ZONES[number]['id']

function getFlowLabel(v: number): string {
  if (v <= 15) return 'Brain Fog'
  if (v <= 30) return 'Scattered'
  if (v <= 45) return 'Warming Up'
  if (v <= 60) return 'Baseline'
  if (v <= 75) return 'Dialed In'
  if (v <= 90) return 'Deep Flow'
  return 'Peak State'
}

function getPhysicalLabel(v: number): string {
  if (v <= 15) return 'Broken'
  if (v <= 30) return 'Sore/Stiff'
  if (v <= 45) return 'Sluggish'
  if (v <= 60) return 'Baseline'
  if (v <= 75) return 'Solid'
  if (v <= 90) return 'Primed'
  return 'Peak Ready'
}

function getScoreColor(v: number): string {
  if (v <= 25) return CC.red
  if (v <= 45) return CC.orange
  if (v <= 65) return CC.textSec
  if (v <= 80) return CC.green
  return CC.accent
}

/* ── Minimalist Body Silhouette with Tappable Zones ── */
function BodyDiagram({
  activeZones,
  onToggleZone,
}: {
  activeZones: Set<BodyZoneId>
  onToggleZone: (id: BodyZoneId) => void
}) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 120, margin: '0 auto' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: 'auto' }}>
        {/* Body silhouette path */}
        <path
          d="M50 5 C56 5 60 9 60 14 C60 19 56 23 50 23 C44 23 40 19 40 14 C40 9 44 5 50 5 Z
             M38 25 L62 25 L66 28 L68 40 L65 55 L62 55 L60 45 L58 55 L56 65 L54 80 L56 95 L44 95 L46 80 L44 65 L42 55 L40 45 L38 55 L35 55 L32 40 L34 28 Z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />

        {/* Tappable zones */}
        {BODY_ZONES.map(zone => {
          const isActive = activeZones.has(zone.id)
          return (
            <g key={zone.id} onClick={() => onToggleZone(zone.id)} style={{ cursor: 'pointer' }}>
              <ellipse
                cx={zone.cx}
                cy={zone.cy}
                rx={zone.rx}
                ry={zone.ry}
                fill={isActive ? `${CC.red}30` : 'rgba(255,255,255,0.02)'}
                stroke={isActive ? CC.red : 'rgba(255,255,255,0.08)'}
                strokeWidth={isActive ? 1.2 : 0.5}
                strokeDasharray={isActive ? 'none' : '2,2'}
                style={{ transition: 'all 0.2s' }}
              />
              {isActive && (
                <>
                  <ellipse
                    cx={zone.cx}
                    cy={zone.cy}
                    rx={zone.rx + 3}
                    ry={zone.ry + 2}
                    fill="none"
                    stroke={CC.red}
                    strokeWidth="0.5"
                    opacity="0.3"
                  >
                    <animate attributeName="rx" values={`${zone.rx + 3};${zone.rx + 5};${zone.rx + 3}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                  </ellipse>
                  <circle cx={zone.cx} cy={zone.cy} r="2" fill={CC.red}>
                    <animate attributeName="r" values="2;3;2" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Arc Slider — Minimal Circular Gauge ── */
function ArcSlider({
  value,
  onChange,
  label,
  sublabel,
  color,
  icon,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  sublabel: string
  color: string
  icon: string
}) {
  const scoreColor = getScoreColor(value)

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <div>
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: CC.text,
          }}>
            {label.toUpperCase()}
          </div>
          <div style={{
            fontSize: 7,
            fontFamily: 'monospace',
            color: scoreColor,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            {sublabel}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 18,
          fontWeight: 900,
          fontFamily: 'monospace',
          color: scoreColor,
          textShadow: `0 0 12px ${scoreColor}40`,
        }}>
          {value}
        </span>
      </div>

      {/* Slider Track */}
      <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            height: 6,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: `linear-gradient(90deg, ${color}50 0%, ${color} ${value}%, rgba(255,255,255,0.06) ${value}%, rgba(255,255,255,0.06) 100%)`,
            borderRadius: 3,
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  )
}

/* ── Correlation Insight Card ── */
function CorrelationInsight({
  correlation,
}: {
  correlation: {
    overallCorrelation: number
    subjectiveFlow: number
    objectiveFlow: number
    subjectivePhysical: number
    objectivePhysical: number
    subjectiveBioAgeShift: number
    protocolFlags: Array<{
      protocolName: string
      channel: string
      daysOnProtocol: number
      currentSubjective: number
      isAligned: boolean
      suggestion: string
    }>
  }
}) {
  const { overallCorrelation, subjectiveBioAgeShift, protocolFlags } = correlation
  const misaligned = protocolFlags.filter(f => !f.isAligned && f.suggestion)
  const corrColor = overallCorrelation >= 70 ? CC.green : overallCorrelation >= 45 ? CC.orange : CC.red
  const shiftColor = subjectiveBioAgeShift <= -0.1 ? CC.green : subjectiveBioAgeShift >= 0.1 ? CC.red : CC.textSec
  const shiftSign = subjectiveBioAgeShift <= 0 ? '' : '+'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        padding: '10px 12px',
        background: `${corrColor}06`,
        borderRadius: 10,
        border: `1px solid ${corrColor}15`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: corrColor,
          boxShadow: `0 0 6px ${corrColor}40`,
        }} />
        <span style={{
          fontSize: 8,
          fontWeight: 800,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: corrColor,
        }}>
          SUBJECTIVE ↔ OBJECTIVE · {overallCorrelation}% ALIGNED
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          fontFamily: 'monospace',
          color: shiftColor,
        }}>
          {shiftSign}{subjectiveBioAgeShift.toFixed(1)}y
        </span>
      </div>

      {/* Correlation bars */}
      <div style={{ display: 'flex', gap: 8, marginBottom: misaligned.length > 0 ? 8 : 0 }}>
        {[
          { label: 'FLOW', subj: correlation.subjectiveFlow, obj: correlation.objectiveFlow, color: CC.purple },
          { label: 'PHYSICAL', subj: correlation.subjectivePhysical, obj: correlation.objectivePhysical, color: CC.cyan },
        ].map(item => (
          <div key={item.label} style={{ flex: 1 }}>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.08em', marginBottom: 3 }}>
              {item.label}
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: CC.border, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${item.subj}%`,
                  background: item.color,
                  borderRadius: 2,
                  opacity: 0.7,
                }} />
                <div style={{
                  position: 'absolute', left: `${item.obj}%`, top: -1, width: 2, height: 5,
                  background: CC.text,
                  borderRadius: 1,
                }} />
              </div>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: item.color, fontWeight: 700, minWidth: 20, textAlign: 'right' }}>
                {item.subj}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Protocol flags */}
      {misaligned.length > 0 && (
        <div style={{
          padding: '6px 8px',
          background: `${CC.red}08`,
          borderRadius: 6,
          borderLeft: `2px solid ${CC.red}40`,
        }}>
          {misaligned.slice(0, 2).map((flag, i) => (
            <div key={i} style={{
              fontSize: 8,
              fontFamily: 'monospace',
              color: CC.textSec,
              lineHeight: 1.5,
              marginBottom: i < misaligned.length - 1 ? 4 : 0,
            }}>
              <span style={{ color: CC.red, fontWeight: 800 }}>⚠ {flag.protocolName}</span>
              <span style={{ color: CC.textTer }}> · Day {flag.daysOnProtocol}</span>
              <br />
              <span style={{ color: CC.textTer }}>{flag.suggestion}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT — 5-Second Daily Check-In
   ══════════════════════════════════════════════════════════════ */

export default function SomaticFeedback({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) {
  const sessionId = useMemo(() => {
    try { return localStorage.getItem('vive-session-id') || 'guest-user' } catch { return 'guest-user' }
  }, [])

  // Queries
  const correlation = useQuery(
    api.somaticCorrelation.getSomaticBioCorrelation,
    sessionId ? { sessionId } : "skip"
  )
  const somaticHistory = useQuery(api.somaticLog.getSomaticHistory, sessionId ? { sessionId } : "skip")

  // Mutations
  const logBatch = useMutation(api.somaticLog.logSomaticBatch)

  // State
  const [flowState, setFlowState] = useState(50)
  const [physicalReadiness, setPhysicalReadiness] = useState(50)
  const [activeBodyZones, setActiveBodyZones] = useState<Set<BodyZoneId>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [phase, setPhase] = useState<'input' | 'insight'>('input')

  // Initialize from recent data
  useEffect(() => {
    if (!somaticHistory?.channelSummaries) return
    for (const summary of somaticHistory.channelSummaries) {
      if (summary.channel === 'flow_state' || summary.channel === 'neural_drive' || summary.channel === 'mental_clarity') {
        setFlowState(summary.avg)
      }
      if (summary.channel === 'physical_readiness' || summary.channel === 'joint_mobility' || summary.channel === 'energy_flux') {
        setPhysicalReadiness(summary.avg)
      }
    }
  }, [somaticHistory])

  const handleToggleZone = useCallback((id: BodyZoneId) => {
    setActiveBodyZones(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const entries = [
        { channel: 'flow_state', value: flowState, label: getFlowLabel(flowState) },
        { channel: 'physical_readiness', value: physicalReadiness, label: getPhysicalLabel(physicalReadiness) },
      ]

      // Add body zone pain flags as additional entries
      for (const zoneId of activeBodyZones) {
        const zone = BODY_ZONES.find(z => z.id === zoneId)
        if (zone) {
          entries.push({
            channel: `pain_${zoneId}`,
            value: 30, // pain flag = low readiness for that zone
            label: `${zone.label} discomfort`,
          })
        }
      }

      await logBatch({
        sessionId,
        entries,
        source: 'checkin',
        protocolContext: activeBodyZones.size > 0
          ? `Pain zones: ${Array.from(activeBodyZones).join(', ')}`
          : undefined,
      })

      setShowSuccess(true)
      setPhase('insight')
      setTimeout(() => setShowSuccess(false), 2000)
    } catch (e) {
      console.error('[SomaticCheckin] Submit failed:', e)
    } finally {
      setIsSubmitting(false)
    }
  }, [flowState, physicalReadiness, activeBodyZones, sessionId, logBatch])

  const compositeScore = Math.round((flowState + physicalReadiness) / 2)
  const compositeColor = getScoreColor(compositeScore)

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        style={{
          width: 340,
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          background: CC.surfaceElevated,
          borderRadius: 18,
          border: `1px solid ${CC.border}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          scrollbarWidth: 'none',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${CC.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'sticky',
          top: 0,
          background: CC.surfaceElevated,
          zIndex: 2,
          borderRadius: '18px 18px 0 0',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${compositeColor}15`,
            border: `1px solid ${compositeColor}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>
            ⚡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
              letterSpacing: '0.08em', color: CC.text,
            }}>
              5-SECOND CHECK-IN
            </div>
            <div style={{
              fontSize: 8, fontFamily: 'monospace',
              color: CC.textTer, letterSpacing: '0.04em',
            }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Composite Score */}
          <div style={{ textAlign: 'right', marginRight: 4 }}>
            <div style={{
              fontSize: 18, fontWeight: 900, fontFamily: 'monospace',
              color: compositeColor,
              textShadow: `0 0 12px ${compositeColor}30`,
              lineHeight: 1,
            }}>
              {compositeScore}
            </div>
            <div style={{ fontSize: 6, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em' }}>
              READINESS
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onClose}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${CC.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 10, color: CC.textTer,
            }}
          >
            ✕
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── Dual Sliders ── */}
              <div style={{ padding: '12px 14px 8px' }}>
                <ArcSlider
                  value={flowState}
                  onChange={setFlowState}
                  label="Flow State"
                  sublabel={getFlowLabel(flowState)}
                  color={CC.purple}
                  icon="🧠"
                />
                <div style={{ height: 10 }} />
                <ArcSlider
                  value={physicalReadiness}
                  onChange={setPhysicalReadiness}
                  label="Physical Readiness"
                  sublabel={getPhysicalLabel(physicalReadiness)}
                  color={CC.cyan}
                  icon="💪"
                />
              </div>

              {/* ── Body Diagram ── */}
              <div style={{
                padding: '4px 14px 8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ height: 1, flex: 1, background: CC.border }} />
                  <span style={{
                    fontSize: 7, fontFamily: 'monospace',
                    color: CC.textTer, letterSpacing: '0.1em',
                  }}>
                    TAP PAIN ZONES (OPTIONAL)
                  </span>
                  <div style={{ height: 1, flex: 1, background: CC.border }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <BodyDiagram
                    activeZones={activeBodyZones}
                    onToggleZone={handleToggleZone}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {activeBodyZones.size === 0 ? (
                      <div style={{
                        fontSize: 8, fontFamily: 'monospace',
                        color: CC.textTer, lineHeight: 1.6,
                        padding: '8px 0',
                      }}>
                        Tap body zones to flag discomfort areas. The AI Brain will correlate with your active protocols.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {Array.from(activeBodyZones).map(zoneId => {
                          const zone = BODY_ZONES.find(z => z.id === zoneId)
                          return zone ? (
                            <motion.div
                              key={zoneId}
                              initial={{ opacity: 0, x: 8 }}
                              animate={{ opacity: 1, x: 0 }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '4px 8px',
                                background: `${CC.red}08`,
                                borderRadius: 6,
                                border: `1px solid ${CC.red}15`,
                              }}
                            >
                              <div style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: CC.red,
                                boxShadow: `0 0 4px ${CC.red}40`,
                              }} />
                              <span style={{
                                fontSize: 8, fontFamily: 'monospace',
                                color: CC.red, fontWeight: 700,
                                letterSpacing: '0.04em',
                              }}>
                                {zone.label.toUpperCase()}
                              </span>
                              <div style={{ flex: 1 }} />
                              <button
                                onClick={() => handleToggleZone(zoneId)}
                                style={{
                                  background: 'none', border: 'none',
                                  color: CC.textTer, fontSize: 8,
                                  cursor: 'pointer', padding: 0,
                                }}
                              >
                                ✕
                              </button>
                            </motion.div>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Submit ── */}
              <div style={{ padding: '8px 14px 14px' }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 10,
                    background: showSuccess
                      ? `linear-gradient(135deg, ${CC.green}, ${CC.green}CC)`
                      : `linear-gradient(135deg, ${CC.electricBlue}, ${CC.purple})`,
                    border: 'none',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: isSubmitting ? 0.6 : 1,
                    boxShadow: showSuccess
                      ? `0 4px 20px ${CC.green}30`
                      : `0 4px 20px ${CC.electricBlue}20`,
                    transition: 'all 0.3s',
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    {showSuccess ? '✓' : '⚡'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                    letterSpacing: '0.1em', color: '#000',
                  }}>
                    {showSuccess ? 'LOGGED' : isSubmitting ? 'LOGGING...' : 'LOG CHECK-IN'}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="insight"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              style={{ padding: '12px 14px 14px' }}
            >
              {/* ── Insight Phase ── */}
              {correlation ? (
                <CorrelationInsight correlation={correlation} />
              ) : (
                <div style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🧬</div>
                  <div style={{
                    fontSize: 9, fontFamily: 'monospace',
                    color: CC.textTer, lineHeight: 1.5,
                  }}>
                    Add biomarkers to your BioVault to see how your subjective state correlates with objective data.
                  </div>
                </div>
              )}

              {/* Bio-Age Micro-Shift */}
              {correlation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    marginTop: 8,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 10,
                    border: `1px solid ${CC.border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${CC.electricBlue}12`,
                    border: `1px solid ${CC.electricBlue}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    📊
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 8, fontFamily: 'monospace',
                      color: CC.textTer, letterSpacing: '0.08em',
                      marginBottom: 2,
                    }}>
                      TRAJECTORY IMPACT
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: 'monospace',
                      color: CC.textSec, lineHeight: 1.5,
                    }}>
                      Today's check-in shifts your projected bio-age by{' '}
                      <span style={{
                        color: correlation.subjectiveBioAgeShift <= -0.05 ? CC.green : correlation.subjectiveBioAgeShift >= 0.05 ? CC.red : CC.textSec,
                        fontWeight: 800,
                      }}>
                        {correlation.subjectiveBioAgeShift <= 0 ? '' : '+'}{correlation.subjectiveBioAgeShift.toFixed(1)}y
                      </span>
                      . View on Trajectory Canvas for full projection.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Back / Done buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setPhase('input')}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CC.border}`,
                    cursor: 'pointer',
                    fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
                    letterSpacing: '0.06em', color: CC.textSec,
                  }}
                >
                  ← ADJUST
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    background: `linear-gradient(135deg, ${CC.green}, ${CC.green}CC)`,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 9, fontWeight: 800, fontFamily: 'monospace',
                    letterSpacing: '0.08em', color: '#000',
                  }}
                >
                  DONE ✓
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Data footer */}
        <div style={{
          textAlign: 'center', padding: '0 14px 10px',
          fontSize: 7, fontFamily: 'monospace', color: CC.textTer,
        }}>
          {somaticHistory?.totalEntries ?? 0} entries · {correlation?.totalCheckIns ?? 0} this week
          {correlation?.hasVaultData && ' · BioVault linked'}
        </div>

        {/* Custom slider styles */}
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #F0F0F4;
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 0 10px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          }
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #F0F0F4;
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 0 10px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  )
}
