import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Design Tokens ── */
const C = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.95)',
  surfaceLight: 'rgba(20,20,28,0.9)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.25)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.2)',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.2)',
  border: 'rgba(255,255,255,0.06)',
  borderBlue: 'rgba(59,130,246,0.15)',
}

/* ── Types ── */
interface AnalysisResult {
  analysis: {
    sentiment: { score: number; label: string }
    physicalStress: { score: number; label: string }
    regions: Array<{ region: string; severity: number; description: string }>
    mentalState: string
  }
  patterns: Array<{
    region: string
    consecutiveDays: number
    avgSeverity: number
    isEscalating: boolean
  }>
  interventions: Array<{
    id: string
    title: string
    description: string
    duration: string
    type: string
    icon: string
    reason: string
    priority: 'high' | 'medium' | 'low'
  }>
  source: string
}

/* ── Body Map SVG ── */
const REGION_POSITIONS: Record<string, { x: number; y: number }> = {
  head: { x: 50, y: 8 },
  neck: { x: 50, y: 16 },
  left_shoulder: { x: 30, y: 22 },
  right_shoulder: { x: 70, y: 22 },
  chest: { x: 50, y: 28 },
  upper_back: { x: 50, y: 26 },
  left_elbow: { x: 20, y: 38 },
  right_elbow: { x: 80, y: 38 },
  abdomen: { x: 50, y: 40 },
  left_wrist: { x: 15, y: 50 },
  right_wrist: { x: 85, y: 50 },
  lower_back: { x: 50, y: 48 },
  left_hip: { x: 38, y: 55 },
  right_hip: { x: 62, y: 55 },
  left_knee: { x: 38, y: 72 },
  right_knee: { x: 62, y: 72 },
  left_ankle: { x: 38, y: 88 },
  right_ankle: { x: 62, y: 88 },
}

function BodyMapMini({ regions }: { regions: Array<{ region: string; severity: number }> }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: 120, height: 120 }}>
      {/* Body silhouette */}
      <ellipse cx="50" cy="10" rx="8" ry="9" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      <rect x="40" y="18" width="20" height="30" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <rect x="20" y="20" width="12" height="32" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" transform="rotate(-8 26 36)" />
      <rect x="68" y="20" width="12" height="32" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" transform="rotate(8 74 36)" />
      <rect x="36" y="48" width="12" height="36" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" transform="rotate(-2 42 66)" />
      <rect x="52" y="48" width="12" height="36" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" transform="rotate(2 58 66)" />
      {/* Pain hotspots */}
      {regions.map((r, i) => {
        const pos = REGION_POSITIONS[r.region]
        if (!pos) return null
        const color = r.severity >= 60 ? C.red : r.severity >= 30 ? C.orange : C.blue
        const radius = 3 + (r.severity / 100) * 4
        return (
          <g key={i}>
            <circle cx={pos.x} cy={pos.y} r={radius + 3} fill={color} opacity={0.15}>
              <animate attributeName="r" values={`${radius + 2};${radius + 5};${radius + 2}`} dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={pos.x} cy={pos.y} r={radius} fill={color} opacity={0.7} />
          </g>
        )
      })}
    </svg>
  )
}

/* ── Waveform Visualizer ── */
function WaveformVisualizer({ isRecording }: { isRecording: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, justifyContent: 'center' }}>
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            width: 2, borderRadius: 1,
            background: `linear-gradient(180deg, ${C.accent}, ${C.blue})`,
          }}
          animate={isRecording ? {
            height: [4, 8 + Math.random() * 20, 4],
            opacity: [0.4, 0.9, 0.4],
          } : { height: 4, opacity: 0.2 }}
          transition={{
            duration: 0.3 + Math.random() * 0.4,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: i * 0.03,
          }}
        />
      ))}
    </div>
  )
}

/* ── Main Component ── */
export default function QuickCheckInFAB() {
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('vive-session-id') || 'guest-user' : 'guest-user'

  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'recording' | 'analyzing' | 'results'>('idle')
  const [transcript, setTranscript] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [textInput, setTextInput] = useState('')

  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)

  const analyzeBrief = useAction(api.somaticCheckIn.analyzeSomaticBrief)
  const patterns = useQuery(api.somaticCheckIn.getMultiDayPatterns, { sessionId })

  const hasActivePatterns = (patterns ?? []).some(p => p.consecutiveDays >= 3)

  /* ── Speech Recognition ── */
  const startRecording = useCallback(() => {
    setPhase('recording')
    setRecordingTime(0)
    setTranscript('')

    recordTimerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 20) {
          stopRecording()
          return 20
        }
        return prev + 1
      })
    }, 1000)

    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SR) {
        const recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (event: any) => {
          let t = ''
          for (let i = 0; i < event.results.length; i++) {
            t += event.results[i][0].transcript
          }
          setTranscript(t)
        }
        recognition.onerror = () => { /* fallback to text */ }
        recognition.start()
        recognitionRef.current = recognition
      }
    } catch { /* text fallback */ }
  }, [])

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    setPhase('idle')
  }, [])

  const submitBrief = useCallback(async (text: string) => {
    if (!text.trim()) return
    setPhase('analyzing')
    try {
      const res = await analyzeBrief({
        sessionId,
        transcript: text.trim(),
        durationSeconds: recordingTime || 5,
      })
      setResult(res as AnalysisResult)
      setPhase('results')
    } catch (err) {
      console.error('Analysis failed:', err)
      setPhase('idle')
    }
  }, [analyzeBrief, sessionId, recordingTime])

  /* ── Hold-to-talk handlers ── */
  const handleHoldStart = useCallback(() => {
    setHoldProgress(0)
    holdTimerRef.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          if (holdTimerRef.current) clearInterval(holdTimerRef.current)
          startRecording()
          return 100
        }
        return prev + 10
      })
    }, 50)
  }, [startRecording])

  const handleHoldEnd = useCallback(() => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    if (phase === 'recording') {
      stopRecording()
      if (transcript.trim()) {
        submitBrief(transcript)
      }
    } else {
      setHoldProgress(0)
    }
  }, [phase, transcript, stopRecording, submitBrief])

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (recognitionRef.current) try { recognitionRef.current.stop() } catch {}
    }
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setPhase('idle')
    setResult(null)
    setTranscript('')
    setTextInput('')
    setHoldProgress(0)
    setRecordingTime(0)
  }, [])

  const priorityColor = (p: string) => p === 'high' ? C.red : p === 'medium' ? C.orange : C.blue
  const typeIcon = (t: string) => t === 'mobility' ? '🧘' : t === 'peptide' ? '💉' : t === 'supplement' ? '💊' : t === 'breathwork' ? '🫁' : '🧊'

  return (
    <>
      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: 90, left: 16, zIndex: 9998,
          width: 52, height: 52, borderRadius: '50%',
          background: hasActivePatterns
            ? `linear-gradient(135deg, ${C.red}, ${C.orange})`
            : `linear-gradient(135deg, ${C.blue}, ${C.accent})`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hasActivePatterns
            ? `0 0 20px ${C.redGlow}, 0 4px 16px rgba(0,0,0,0.5)`
            : `0 0 20px ${C.blueGlow}, 0 4px 16px rgba(0,0,0,0.5)`,
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={hasActivePatterns ? { scale: [1, 1.05, 1] } : {}}
        transition={hasActivePatterns ? { duration: 2, repeat: Infinity } : {}}
      >
        <span style={{ fontSize: 22 }}>🎙️</span>
        {hasActivePatterns && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 14, height: 14, borderRadius: '50%',
            background: C.red, border: `2px solid ${C.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 7, color: '#fff', fontWeight: 800 }}>!</span>
          </div>
        )}
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              padding: '0 0 20px',
            }}
            onClick={handleClose}
          >
            <motion.div
              initial={{ y: 400, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 420, maxHeight: '85vh',
                background: C.surface, borderRadius: 24,
                border: `1px solid ${C.border}`,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    SOMATIC CHECK-IN
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.textTer, marginTop: 2 }}>
                    {phase === 'recording' ? `Recording… ${recordingTime}s / 20s` : phase === 'analyzing' ? 'AI Brain analyzing…' : phase === 'results' ? 'Analysis Complete' : 'Hold to talk or type below'}
                  </div>
                </div>
                <button onClick={handleClose} style={{ background: 'none', border: 'none', color: C.textSec, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
              </div>

              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {/* Multi-day pattern alert banner */}
                {(patterns ?? []).filter(p => p.consecutiveDays >= 3).length > 0 && phase !== 'results' && (
                  <div style={{
                    background: `linear-gradient(135deg, rgba(255,107,107,0.1), rgba(232,151,108,0.08))`,
                    border: `1px solid rgba(255,107,107,0.2)`,
                    borderRadius: 12, padding: '10px 14px', marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>⚠️</span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: C.red, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        RECURRING PATTERN DETECTED
                      </span>
                    </div>
                    {(patterns ?? []).filter(p => p.consecutiveDays >= 3).map((p, i) => (
                      <div key={i} style={{ fontSize: 11, color: C.textSec, fontFamily: 'monospace', marginTop: 4 }}>
                        {p.region.replace(/_/g, ' ')} — {p.consecutiveDays} consecutive days
                        {p.isEscalating && <span style={{ color: C.red, marginLeft: 6 }}>↑ ESCALATING</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Idle / Recording Phase */}
                {(phase === 'idle' || phase === 'recording') && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    {/* Hold-to-talk button */}
                    <div style={{ position: 'relative', width: 120, height: 120 }}>
                      <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, position: 'absolute', top: 0, left: 0 }}>
                        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                        <circle
                          cx="60" cy="60" r="54" fill="none"
                          stroke={phase === 'recording' ? C.accent : C.blue}
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 54}`}
                          strokeDashoffset={`${2 * Math.PI * 54 * (1 - (phase === 'recording' ? recordingTime / 20 : holdProgress / 100))}`}
                          transform="rotate(-90 60 60)"
                          style={{ transition: 'stroke-dashoffset 0.3s' }}
                        />
                      </svg>
                      <button
                        onPointerDown={handleHoldStart}
                        onPointerUp={handleHoldEnd}
                        onPointerLeave={handleHoldEnd}
                        style={{
                          position: 'absolute', top: 6, left: 6, width: 108, height: 108,
                          borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: phase === 'recording'
                            ? `radial-gradient(circle, rgba(0,255,204,0.15), rgba(0,255,204,0.05))`
                            : `radial-gradient(circle, rgba(59,130,246,0.12), rgba(59,130,246,0.04))`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 28 }}>{phase === 'recording' ? '🔴' : '🎙️'}</span>
                        <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: phase === 'recording' ? C.accent : C.textSec, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {phase === 'recording' ? 'RELEASE' : 'HOLD'}
                        </span>
                      </button>
                    </div>

                    {/* Waveform */}
                    {phase === 'recording' && <WaveformVisualizer isRecording={true} />}

                    {/* Live transcript */}
                    {transcript && (
                      <div style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(0,255,204,0.04)', border: `1px solid rgba(0,255,204,0.1)`,
                        fontSize: 12, color: C.text, fontFamily: 'monospace', lineHeight: 1.5,
                        maxHeight: 80, overflowY: 'auto',
                      }}>
                        {transcript}
                      </div>
                    )}

                    {/* Divider */}
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.1em' }}>OR TYPE</span>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                    </div>

                    {/* Text input */}
                    <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                      <input
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && textInput.trim()) submitBrief(textInput) }}
                        placeholder="Lower back stiff, felt lethargic…"
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10,
                          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 12, fontFamily: 'monospace',
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => textInput.trim() && submitBrief(textInput)}
                        disabled={!textInput.trim()}
                        style={{
                          padding: '10px 16px', borderRadius: 10, border: 'none',
                          background: textInput.trim() ? C.blue : 'rgba(255,255,255,0.04)',
                          color: textInput.trim() ? '#fff' : C.textTer,
                          fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                          cursor: textInput.trim() ? 'pointer' : 'default',
                          letterSpacing: '0.05em',
                        }}
                      >
                        SEND
                      </button>
                    </div>
                  </div>
                )}

                {/* Analyzing Phase */}
                {phase === 'analyzing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
                    <div style={{ position: 'relative', width: 64, height: 64 }}>
                      <div style={{
                        width: 64, height: 64, border: `2px solid ${C.borderBlue}`,
                        borderTopColor: C.blue, borderRadius: '50%',
                        animation: 'qci-spin 0.8s linear infinite',
                      }} />
                      <div style={{
                        position: 'absolute', inset: 10,
                        border: `2px solid rgba(0,255,204,0.08)`,
                        borderBottomColor: C.accent, borderRadius: '50%',
                        animation: 'qci-spin-rev 1.2s linear infinite',
                      }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: C.blueBright, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        AI BRAIN ANALYZING
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.textTer, marginTop: 4 }}>
                        Parsing somatic signals + checking patterns…
                      </div>
                    </div>
                    <style>{`
                      @keyframes qci-spin { to { transform: rotate(360deg); } }
                      @keyframes qci-spin-rev { to { transform: rotate(-360deg); } }
                    `}</style>
                  </div>
                )}

                {/* Results Phase */}
                {phase === 'results' && result && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Sentiment + Stress Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>SENTIMENT</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: result.analysis.sentiment.score >= 60 ? C.green : result.analysis.sentiment.score >= 40 ? C.orange : C.red }}>
                            {result.analysis.sentiment.score}
                          </span>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.textSec }}>{result.analysis.sentiment.label}</span>
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>PHYSICAL STRESS</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: result.analysis.physicalStress.score <= 30 ? C.green : result.analysis.physicalStress.score <= 60 ? C.orange : C.red }}>
                            {result.analysis.physicalStress.score}
                          </span>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.textSec }}>{result.analysis.physicalStress.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mental State */}
                    <div style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(59,130,246,0.04)', border: `1px solid ${C.borderBlue}`,
                      fontSize: 11, fontFamily: 'monospace', color: C.textSec, lineHeight: 1.5,
                    }}>
                      🧠 {result.analysis.mentalState}
                    </div>

                    {/* Body Map + Regions */}
                    {result.analysis.regions.length > 0 && (
                      <div style={{
                        padding: '14px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                      }}>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                          BODY MAP — TAGGED REGIONS
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                          <BodyMapMini regions={result.analysis.regions} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {result.analysis.regions.map((r, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 6, height: 6, borderRadius: '50%',
                                  background: r.severity >= 60 ? C.red : r.severity >= 30 ? C.orange : C.blue,
                                  boxShadow: `0 0 6px ${r.severity >= 60 ? C.redGlow : r.severity >= 30 ? 'rgba(232,151,108,0.3)' : C.blueGlow}`,
                                }} />
                                <div>
                                  <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
                                    {r.region.replace(/_/g, ' ')}
                                    <span style={{ color: C.textTer, fontWeight: 400, marginLeft: 6 }}>{r.severity}%</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Multi-day Patterns */}
                    {result.patterns.length > 0 && (
                      <div style={{
                        padding: '14px', borderRadius: 14,
                        background: `linear-gradient(135deg, rgba(255,107,107,0.06), rgba(232,151,108,0.04))`,
                        border: `1px solid rgba(255,107,107,0.15)`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 13 }}>🔁</span>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: C.orange, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            MULTI-DAY PATTERNS
                          </span>
                        </div>
                        {result.patterns.map((p, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
                          }}>
                            <div>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
                                {p.region.replace(/_/g, ' ')}
                              </span>
                              <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.textTer, marginLeft: 8 }}>
                                avg {p.avgSeverity}%
                              </span>
                            </div>
                            <div style={{
                              padding: '2px 8px', borderRadius: 6,
                              background: p.consecutiveDays >= 3 ? 'rgba(255,107,107,0.15)' : 'rgba(232,151,108,0.1)',
                              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                              color: p.consecutiveDays >= 3 ? C.red : C.orange,
                            }}>
                              {p.consecutiveDays}d {p.isEscalating ? '↑' : '→'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Interventions */}
                    {result.interventions.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                          RECOMMENDED INTERVENTIONS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {result.interventions.map((int, i) => (
                            <div key={i} style={{
                              padding: '12px 14px', borderRadius: 12,
                              background: 'rgba(255,255,255,0.02)',
                              border: `1px solid ${int.priority === 'high' ? 'rgba(255,107,107,0.15)' : C.border}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 16 }}>{int.icon}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
                                    {int.title}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                    <span style={{
                                      fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                                      padding: '1px 6px', borderRadius: 4,
                                      background: `${priorityColor(int.priority)}15`,
                                      color: priorityColor(int.priority),
                                      textTransform: 'uppercase', letterSpacing: '0.08em',
                                    }}>
                                      {int.priority}
                                    </span>
                                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer }}>{int.duration}</span>
                                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, textTransform: 'capitalize' }}>{int.type}</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.textSec, lineHeight: 1.5 }}>
                                {int.description}
                              </div>
                              <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, marginTop: 4, fontStyle: 'italic' }}>
                                ↳ {int.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recovery Score Impact */}
                    <div style={{
                      padding: '12px 14px', borderRadius: 12,
                      background: 'rgba(0,255,204,0.04)', border: `1px solid rgba(0,255,204,0.1)`,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textTer, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        RECOVERY SCORE UPDATED
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.accent }}>
                        Somatic data integrated into today's Recovery Index
                      </div>
                    </div>

                    {/* New Check-in Button */}
                    <button
                      onClick={() => { setPhase('idle'); setResult(null); setTranscript(''); setTextInput('') }}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 12,
                        background: 'rgba(59,130,246,0.08)', border: `1px solid ${C.borderBlue}`,
                        color: C.blueBright, fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                        cursor: 'pointer', letterSpacing: '0.05em',
                      }}
                    >
                      NEW CHECK-IN
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
