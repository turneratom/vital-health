import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   BIO-LINK ONBOARDING — Terminal-Style Quick Calibration
   
   Minimalist 3-input dialog that fires on first visit:
   1. Current Focus: Longevity | Performance | Recovery
   2. Age (number)
   3. Primary Hardware: Oura | Whoop | Apple Watch | None
   
   Uses these inputs to generate estimated baselines for the
   SomaticBodyMap so the HUD looks "alive" immediately.
   ═══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  green: '#00DC82',
  border: 'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(0,255,204,0.15)',
}

type Focus = 'longevity' | 'performance' | 'recovery'
type Hardware = 'oura' | 'whoop' | 'apple_watch' | 'none'

interface BioLinkOnboardingProps {
  isOpen: boolean
  onComplete: () => void
}

const FOCUS_OPTIONS: { id: Focus; label: string; icon: string; desc: string }[] = [
  { id: 'longevity', label: 'Longevity', icon: '◆', desc: 'Optimize biological age' },
  { id: 'performance', label: 'Performance', icon: '▲', desc: 'Peak output & energy' },
  { id: 'recovery', label: 'Recovery', icon: '●', desc: 'Restore & rebuild' },
]

const HARDWARE_OPTIONS: { id: Hardware; label: string; icon: string }[] = [
  { id: 'oura', label: 'Oura Ring', icon: '◎' },
  { id: 'whoop', label: 'Whoop', icon: '◈' },
  { id: 'apple_watch', label: 'Apple Watch', icon: '◉' },
  { id: 'none', label: 'No Device', icon: '○' },
]

/* ── Baseline Generator ── */
function generateBaselines(focus: Focus, age: number, hardware: Hardware) {
  const ageFactor = Math.max(0, Math.min(1, (60 - age) / 40))
  const isFocusRecovery = focus === 'recovery'
  const isFocusPerformance = focus === 'performance'

  const hrvBase = Math.round(35 + ageFactor * 45 + (isFocusPerformance ? 8 : isFocusRecovery ? -5 : 3))
  const restingHR = Math.round(72 - ageFactor * 15 - (isFocusPerformance ? 5 : 0))
  const sleepScore = Math.round(65 + ageFactor * 15 + (isFocusRecovery ? 8 : 0))
  const sleepHours = +(6.5 + ageFactor * 1.2 + (isFocusRecovery ? 0.5 : 0)).toFixed(1)
  const recoveryScore = Math.round(55 + ageFactor * 25 + (isFocusRecovery ? 10 : isFocusPerformance ? -5 : 0))

  const bodyMapSystems: { system: string; region: string; score: number; status: string }[] = [
    { system: 'cardiovascular', region: 'chest', score: Math.round(60 + ageFactor * 25 + (isFocusPerformance ? 5 : 0)), status: ageFactor > 0.5 ? 'optimal' : 'suboptimal' },
    { system: 'nervous', region: 'head', score: Math.round(55 + ageFactor * 30), status: ageFactor > 0.4 ? 'optimal' : 'suboptimal' },
    { system: 'musculoskeletal', region: 'shoulders', score: Math.round(50 + ageFactor * 30 + (isFocusPerformance ? 8 : 0)), status: isFocusPerformance ? 'optimal' : 'suboptimal' },
    { system: 'metabolic', region: 'gut', score: Math.round(58 + ageFactor * 22), status: ageFactor > 0.45 ? 'optimal' : 'suboptimal' },
    { system: 'immune', region: 'chest', score: Math.round(62 + ageFactor * 20 + (isFocusRecovery ? 5 : 0)), status: 'suboptimal' },
    { system: 'endocrine', region: 'lower_back', score: Math.round(55 + ageFactor * 25), status: age < 35 ? 'optimal' : 'suboptimal' },
    { system: 'respiratory', region: 'chest', score: Math.round(70 + ageFactor * 15), status: 'optimal' },
    { system: 'digestive', region: 'gut', score: Math.round(60 + ageFactor * 18), status: ageFactor > 0.5 ? 'optimal' : 'suboptimal' },
  ]

  const hasDevice = hardware !== 'none'
  const dataConfidence = hasDevice ? 0.7 : 0.4

  return { hrvBase, restingHR, sleepScore, sleepHours, recoveryScore, bodyMapSystems, dataConfidence, hasDevice }
}

const BIOLINK_KEY = 'vive-biolink-completed'

export default function BioLinkOnboarding({ isOpen, onComplete }: BioLinkOnboardingProps) {
  const [step, setStep] = useState(0) // 0=focus, 1=age, 2=hardware, 3=processing, 4=done
  const [focus, setFocus] = useState<Focus | null>(null)
  const [age, setAge] = useState('')
  const [hardware, setHardware] = useState<Hardware | null>(null)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [calibrationPct, setCalibrationPct] = useState(0)

  const saveFirstSync = useMutation(api.firstSync.saveFirstSyncBiomarkers)
  const upsertPresence = useMutation(api.mutations.upsertPresence)

  const sessionId = getTwinSessionId()

  const addTerminalLine = useCallback((line: string) => {
    setTerminalLines(prev => [...prev, line])
  }, [])

  const handleComplete = useCallback(async () => {
    if (!focus || !age || !hardware) return
    setStep(3)

    const ageNum = parseInt(age) || 30
    const baselines = generateBaselines(focus, ageNum, hardware)

    // Terminal boot sequence
    const lines = [
      '> VIVE BIO-LINK v4.0 — Initializing...',
      `> Operator Profile: ${focus.toUpperCase()} | Age ${ageNum}`,
      `> Hardware: ${hardware === 'none' ? 'MANUAL MODE' : hardware.toUpperCase()}`,
      '> Calibrating somatic baselines...',
      `  ├─ HRV Baseline: ${baselines.hrvBase}ms`,
      `  ├─ Resting HR: ${baselines.restingHR} bpm`,
      `  ├─ Sleep Score: ${baselines.sleepScore}/100`,
      `  ├─ Recovery Index: ${baselines.recoveryScore}%`,
      `  └─ Data Confidence: ${Math.round(baselines.dataConfidence * 100)}%`,
      '> Mapping 8 biological subsystems...',
    ]

    for (let i = 0; i < lines.length; i++) {
      await new Promise(r => setTimeout(r, 120 + Math.random() * 80))
      addTerminalLine(lines[i])
      setCalibrationPct(Math.round(((i + 1) / (lines.length + 4)) * 100))
    }

    // Seed baselines into the database
    try {
      const sleepQuality = Math.round(baselines.sleepScore / 10)
      const inflammationLevel = focus === 'recovery' ? 5 : 3

      await saveFirstSync({
        sessionId,
        sleepQuality: Math.min(10, Math.max(1, sleepQuality)),
        hrvEstimate: baselines.hrvBase,
        inflammationLevel,
      })

      addTerminalLine('> ✓ Biomarkers seeded to SomaticBodyMap')
      setCalibrationPct(85)

      // Update presence with initial state
      await upsertPresence({
        sessionId,
        x: 0.5,
        y: 0.5,
        ghostMode: false,
        color: focus === 'longevity' ? '#00FFCC' : focus === 'performance' ? '#3B82F6' : '#F59E0B',
        lastSeen: Date.now(),
      })

      addTerminalLine('> ✓ Presence node activated')
      setCalibrationPct(92)
    } catch (err) {
      addTerminalLine('> ⚠ Partial sync — local baselines applied')
    }

    // Store focus + hardware in localStorage for protocol engine
    try {
      localStorage.setItem('vive-biolink-focus', focus)
      localStorage.setItem('vive-biolink-age', age)
      localStorage.setItem('vive-biolink-hardware', hardware)
      localStorage.setItem(BIOLINK_KEY, 'true')
    } catch {}

    addTerminalLine('> ✓ North Star locked: ' + focus.toUpperCase())
    addTerminalLine('')
    addTerminalLine('> BIOLOGICAL OS ONLINE. Welcome, Operator.')
    setCalibrationPct(100)

    await new Promise(r => setTimeout(r, 800))
    setStep(4)
  }, [focus, age, hardware, saveFirstSync, upsertPresence, sessionId, addTerminalLine])

  // Auto-advance from done
  useEffect(() => {
    if (step === 4) {
      const t = setTimeout(onComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [step, onComplete])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99990,
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: '100%', maxWidth: 420,
            background: CC.surface,
            border: `1px solid ${CC.borderAccent}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(0,255,204,0.06), 0 0 120px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px 12px',
            borderBottom: `1px solid ${CC.border}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: step === 3 ? CC.blue : step === 4 ? CC.green : CC.accent,
              boxShadow: `0 0 8px ${step === 4 ? CC.green : CC.accent}60`,
              animation: step === 3 ? 'biolink-pulse 1s ease infinite' : 'none',
            }} />
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: CC.textSec,
            }}>
              {step < 3 ? 'BIO-LINK CALIBRATION' : step === 3 ? 'INITIALIZING BASELINES' : 'SYSTEM ONLINE'}
            </span>
            {step < 3 && (
              <span style={{
                marginLeft: 'auto', fontSize: 9, fontFamily: 'monospace',
                color: CC.textTer,
              }}>
                {step + 1}/3
              </span>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: '20px 20px 24px', minHeight: 260 }}>
            <AnimatePresence mode="wait">
              {/* Step 0: Focus */}
              {step === 0 && (
                <motion.div
                  key="focus"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: CC.text,
                    marginBottom: 4,
                  }}>
                    What is your current focus?
                  </div>
                  <div style={{
                    fontSize: 11, color: CC.textTer, marginBottom: 16,
                    fontFamily: 'monospace',
                  }}>
                    This calibrates your biological priority vector.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {FOCUS_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setFocus(opt.id); setStep(1) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 16px',
                          background: focus === opt.id ? 'rgba(0,255,204,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${focus === opt.id ? CC.borderAccent : CC.border}`,
                          borderRadius: 10, cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          fontSize: 16, color: CC.accent,
                          width: 28, textAlign: 'center',
                        }}>
                          {opt.icon}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: CC.text }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 10, color: CC.textTer, fontFamily: 'monospace' }}>
                            {opt.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 1: Age */}
              {step === 1 && (
                <motion.div
                  key="age"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: CC.text,
                    marginBottom: 4,
                  }}>
                    Chronological age
                  </div>
                  <div style={{
                    fontSize: 11, color: CC.textTer, marginBottom: 20,
                    fontFamily: 'monospace',
                  }}>
                    Used to calibrate HRV, recovery, and metabolic baselines.
                  </div>
                  <div style={{ position: 'relative', marginBottom: 20 }}>
                    <input
                      type="number"
                      min={16}
                      max={90}
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && age && parseInt(age) >= 16) setStep(2)
                      }}
                      autoFocus
                      placeholder="30"
                      style={{
                        width: '100%', padding: '14px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${CC.borderAccent}`,
                        borderRadius: 10, color: CC.text,
                        fontSize: 24, fontFamily: 'monospace', fontWeight: 700,
                        textAlign: 'center', outline: 'none',
                        letterSpacing: '0.1em',
                      }}
                    />
                    <div style={{
                      position: 'absolute', right: 16, top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 10, fontFamily: 'monospace', color: CC.textTer,
                    }}>
                      years
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setStep(0)}
                      style={{
                        flex: 1, padding: '10px 0',
                        background: 'transparent',
                        border: `1px solid ${CC.border}`,
                        borderRadius: 8, color: CC.textSec,
                        fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => { if (age && parseInt(age) >= 16) setStep(2) }}
                      disabled={!age || parseInt(age) < 16}
                      style={{
                        flex: 2, padding: '10px 0',
                        background: age && parseInt(age) >= 16 ? 'rgba(0,255,204,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${age && parseInt(age) >= 16 ? CC.borderAccent : CC.border}`,
                        borderRadius: 8,
                        color: age && parseInt(age) >= 16 ? CC.accent : CC.textTer,
                        fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                        cursor: age && parseInt(age) >= 16 ? 'pointer' : 'not-allowed',
                        letterSpacing: '0.1em',
                      }}
                    >
                      CONTINUE →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Hardware */}
              {step === 2 && (
                <motion.div
                  key="hardware"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: CC.text,
                    marginBottom: 4,
                  }}>
                    Primary hardware
                  </div>
                  <div style={{
                    fontSize: 11, color: CC.textTer, marginBottom: 16,
                    fontFamily: 'monospace',
                  }}>
                    Select your wearable for data confidence calibration.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {HARDWARE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setHardware(opt.id)}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 6,
                          padding: '16px 12px',
                          background: hardware === opt.id ? 'rgba(0,255,204,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${hardware === opt.id ? CC.borderAccent : CC.border}`,
                          borderRadius: 10, cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span style={{
                          fontSize: 20,
                          color: hardware === opt.id ? CC.accent : CC.textSec,
                        }}>
                          {opt.icon}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: hardware === opt.id ? CC.text : CC.textSec,
                        }}>
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setStep(1)}
                      style={{
                        flex: 1, padding: '10px 0',
                        background: 'transparent',
                        border: `1px solid ${CC.border}`,
                        borderRadius: 8, color: CC.textSec,
                        fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={!hardware}
                      style={{
                        flex: 2, padding: '10px 0',
                        background: hardware ? 'rgba(0,255,204,0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${hardware ? CC.borderAccent : CC.border}`,
                        borderRadius: 8,
                        color: hardware ? CC.accent : CC.textTer,
                        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                        cursor: hardware ? 'pointer' : 'not-allowed',
                        letterSpacing: '0.15em',
                      }}
                    >
                      INITIALIZE OS
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Processing Terminal */}
              {step === 3 && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Progress bar */}
                  <div style={{
                    height: 2, background: CC.border,
                    borderRadius: 1, marginBottom: 16, overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${calibrationPct}%` }}
                      transition={{ duration: 0.3 }}
                      style={{
                        height: '100%',
                        background: `linear-gradient(90deg, ${CC.accent}, ${CC.blue})`,
                        borderRadius: 1,
                      }}
                    />
                  </div>

                  {/* Terminal output */}
                  <div style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${CC.border}`,
                    borderRadius: 8, padding: '12px 14px',
                    maxHeight: 220, overflowY: 'auto',
                    fontFamily: 'monospace', fontSize: 10,
                    lineHeight: 1.7,
                  }}>
                    {terminalLines.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          color: line.startsWith('> ✓') ? CC.green
                            : line.startsWith('> ⚠') ? '#F59E0B'
                            : line.startsWith('  ') ? CC.blueBright
                            : line === '' ? 'transparent'
                            : CC.textSec,
                        }}
                      >
                        {line || '\u00A0'}
                      </motion.div>
                    ))}
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{ color: CC.accent }}
                    >
                      █
                    </motion.span>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Done */}
              {step === 4 && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    minHeight: 200, gap: 16,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(0,255,204,0.1)',
                      border: `2px solid ${CC.accent}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 30px rgba(0,255,204,0.15)`,
                    }}
                  >
                    <span style={{ fontSize: 24, color: CC.accent }}>◆</span>
                  </motion.div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: CC.text,
                      marginBottom: 4,
                    }}>
                      Biological OS Calibrated
                    </div>
                    <div style={{
                      fontSize: 10, fontFamily: 'monospace', color: CC.textTer,
                      letterSpacing: '0.1em',
                    }}>
                      SomaticBodyMap baselines active
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <style>{`
          @keyframes biolink-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  )
}
