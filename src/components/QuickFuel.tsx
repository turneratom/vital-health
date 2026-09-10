import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import CellularImpactCard from './CellularImpactCard'
import { getSessionId } from '@/components/Presence/usePresenceState'

/* ── Design Tokens ── */
const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceLight: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  purple: '#A78BFA',
  border: 'rgba(255,255,255,0.06)',
  borderBlue: 'rgba(59,130,246,0.15)',
  sage: '#7CB68E',
  terra: '#E8976C',
  sky: '#6BA3BE',
}

interface ParsedItem {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  isLongevityBooster: boolean
  longevityNote: string | null
}

interface MicroTotals {
  omega3mg: number
  polyphenolsMg: number
  sulforaphaneMcg: number
  resveratrolMcg: number
  quercetinMg: number
  curcuminMg: number
  vitaminCmg: number
  vitaminEmg: number
  seleniumMcg: number
  zincMg: number
  magnesiumMg: number
  nad_precursorMg: number
}

interface MolecularInsight {
  sirtuinActivation: number
  sirtuinDrivers: string[]
  cellularRepairScore: number
  cellularRepairDrivers: string[]
  mitochondrialScore: number
  mitochondrialDrivers: string[]
  antiInflammatoryScore: number
  antiInflammatoryDrivers: string[]
  gutMicrobiomeScore: number
  gutMicrobiomeDrivers: string[]
  headline: string
  narrative: string
}

interface ParsedMeal {
  mealName: string
  items: ParsedItem[]
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  microTotals?: MicroTotals
  molecularInsight?: MolecularInsight
  longevityHighlights: string[]
  fuelScore: number
}

interface BioProjection {
  peakBioAgeDelta: number
  peakHour: number
  recoveryHour: number
  personalizedInsight: string
  inflammationSpike: {
    severity: string
    peakCRP: number
  }
  bioAgeShift: {
    immediate: number
    peak: number
    at24h: number
    netEffect: string
  }
  hourlyProjection: Array<{
    hour: number
    cumulativeDelta: number
  }>
}

type QuickFuelState = 'idle' | 'input' | 'parsing' | 'review' | 'editing' | 'projecting' | 'projected' | 'logged'

export default function QuickFuel() {
  const [state, setState] = useState<QuickFuelState>('idle')
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParsedMeal | null>(null)
  const [bioProjection, setBioProjection] = useState<BioProjection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  const parseAction = useAction(api.quickFuelAI.parseQuickFuel)
  const logMeal = useMutation(api.quickFuelAI.logQuickFuelMeal)
  const projectBioImpact = useAction(api.mealBioProjection.projectMealBioImpact)

  const sessionId = getSessionId()

  useEffect(() => {
    if (state === 'input' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [state])

  /* ── Voice Recognition ── */
  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setVoiceTranscript(transcript)
      setInput(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error)
      setIsListening(false)
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Enable it in browser settings.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopVoice()
    } else {
      startVoice()
    }
  }, [isListening, startVoice, stopVoice])

  const handleParse = useCallback(async () => {
    if (!input.trim()) return
    setState('parsing')
    setError(null)
    stopVoice()
    try {
      const result = await parseAction({ input: input.trim(), sessionId })
      if (result.success && result.parsed) {
        setParsed(result.parsed)
        setState('review')
      } else {
        setError('Could not parse meal. Try being more specific.')
        setState('input')
      }
    } catch (err: any) {
      setError(err?.message || 'Parse failed')
      setState('input')
    }
  }, [input, parseAction, sessionId, stopVoice])

  /* ── Bio-Projection after approval ── */
  const runBioProjection = useCallback(async (meal: ParsedMeal) => {
    setState('projecting')
    try {
      const items = meal.items.map(item => ({
        name: item.name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        inflammatoryIndex: item.isLongevityBooster ? -2 : 1,
      }))

      const result = await projectBioImpact({
        sessionId,
        items,
        totals: meal.totals,
        inflammationScore: meal.fuelScore >= 7 ? -1 : meal.fuelScore >= 4 ? 0.5 : 2,
        projectedCRPDelta: meal.fuelScore >= 7 ? -0.05 : meal.fuelScore >= 4 ? 0.02 : 0.1,
      })

      if (result.success) {
        setBioProjection(result as BioProjection)
        setState('projected')
      } else {
        setState('logged')
      }
    } catch {
      // Bio projection is optional — still show logged state
      setState('logged')
    }
  }, [projectBioImpact, sessionId])

  const handleApprove = useCallback(async () => {
    if (!parsed) return
    try {
      const pending = (parsed as any).analysisStatus === 'pending'
        || (parsed.totals.calories === 0 && parsed.totals.protein === 0 && parsed.fuelScore === 0)
      await logMeal({
        sessionId,
        name: parsed.mealName,
        calories: parsed.totals.calories,
        protein: parsed.totals.protein,
        carbs: parsed.totals.carbs,
        fat: parsed.totals.fat,
        fiber: parsed.totals.fiber,
        fuelScore: pending ? undefined : parsed.fuelScore,
        items: JSON.stringify(parsed.items),
        analysisStatus: pending ? 'pending' : 'analyzed',
      })
      if (pending) {
        setState('logged')
        return
      }
      // Run bio-projection after logging (analyzed only)
      await runBioProjection(parsed)
    } catch (err: any) {
      setError(err?.message || 'Log failed')
    }
  }, [parsed, logMeal, sessionId, runBioProjection])

  const handleClose = useCallback(() => {
    setState('idle')
    setInput('')
    setParsed(null)
    setBioProjection(null)
    setError(null)
    setVoiceTranscript('')
    stopVoice()
  }, [stopVoice])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) handleParse()
  }, [input, handleParse])

  /* ── Fuel Score Color ── */
  const fuelColor = (score: number) => {
    if (score >= 8) return CC.green
    if (score >= 6) return CC.electricBlueBright
    if (score >= 4) return CC.orange
    return CC.red
  }

  /* ── Mini Bio-Age Spark Chart (SVG) ── */
  const BioSparkChart = ({ data }: { data: Array<{ hour: number; cumulativeDelta: number }> }) => {
    if (!data || data.length < 2) return null
    const w = 200, h = 40, pad = 4
    const vals = data.map(d => d.cumulativeDelta)
    const minV = Math.min(...vals, -0.01)
    const maxV = Math.max(...vals, 0.01)
    const range = maxV - minV || 0.01

    const points = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2)
      const y = h - pad - ((d.cumulativeDelta - minV) / range) * (h - pad * 2)
      return `${x},${y}`
    }).join(' ')

    const zeroY = h - pad - ((0 - minV) / range) * (h - pad * 2)
    const isPositive = vals.some(v => v > 0.01)
    const isNegative = vals.some(v => v < -0.01)
    const strokeColor = isNegative && !isPositive ? CC.green : isPositive && !isNegative ? CC.red : CC.sky

    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,3" />
        <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  /* ── FAB Button ── */
  if (state === 'idle') {
    return (
      <motion.button
        onClick={() => setState('input')}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        style={{
          position: 'fixed', bottom: 90, right: 16, zIndex: 9990,
          width: 56, height: 56, borderRadius: '50%',
          background: `linear-gradient(135deg, ${CC.green}, ${CC.accent})`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 20px rgba(0,220,130,0.35), 0 0 40px rgba(0,255,204,0.15)`,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>⚡</span>
      </motion.button>
    )
  }

  /* ── Drawer Overlay ── */
  return (
    <AnimatePresence>
      <motion.div
        key="qf-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        }}
      />
      <motion.div
        key="qf-drawer"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          maxHeight: '88vh', overflowY: 'auto',
          background: CC.surfaceLight,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${CC.border}`,
          borderBottom: 'none',
          padding: '20px 16px 32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{
              fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
              color: CC.accent, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Quick Fuel
            </span>
            {isListening && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.red, background: 'rgba(255,107,107,0.12)',
                  padding: '2px 6px', borderRadius: 4, letterSpacing: '0.1em',
                }}
              >
                ● LISTENING
              </motion.span>
            )}
          </div>
          <button onClick={handleClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: CC.textSec, cursor: 'pointer', fontSize: 16,
          }}>✕</button>
        </div>

        {/* ═══ Input State ═══ */}
        {(state === 'input' || state === 'parsing') && (
          <div>
            <div style={{
              fontSize: 11, fontFamily: 'monospace', color: CC.textSec,
              marginBottom: 10, lineHeight: 1.5,
            }}>
              Type or dictate what you ate — natural language, no dropdowns.
            </div>

            {/* Input Row with Voice Button */}
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${isListening ? CC.red : state === 'parsing' ? CC.accent : CC.borderBlue}`,
              borderRadius: 12, padding: '4px 4px 4px 14px',
              transition: 'border-color 0.2s',
            }}>
              {/* Mic Button */}
              <button
                onClick={toggleVoice}
                disabled={state === 'parsing'}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: isListening ? 'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.06)',
                  color: isListening ? CC.red : CC.textSec,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, transition: 'all 0.2s',
                }}
              >
                {isListening ? (
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    🔴
                  </motion.span>
                ) : '🎤'}
              </button>

              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening...' : '3 eggs, avocado, black coffee...'}
                disabled={state === 'parsing'}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: CC.text, fontSize: 14, fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleParse}
                disabled={!input.trim() || state === 'parsing'}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: input.trim() ? `linear-gradient(135deg, ${CC.green}, ${CC.accent})` : 'rgba(255,255,255,0.06)',
                  color: input.trim() ? '#000' : CC.textTer,
                  fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                  cursor: input.trim() ? 'pointer' : 'default',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  opacity: state === 'parsing' ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {state === 'parsing' ? '⏳ Parsing…' : 'Parse'}
              </button>
            </div>

            {/* Voice transcript indicator */}
            {voiceTranscript && isListening && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 8, padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.12)',
                  fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
                }}
              >
                <span style={{ color: CC.red, marginRight: 6 }}>●</span>
                {voiceTranscript}
              </motion.div>
            )}

            {/* Example chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {['4 eggs + avocado toast', 'salmon bowl with rice', 'protein shake + berries', 'collagen coffee + nuts'].map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setInput(ex); setTimeout(() => inputRef.current?.focus(), 50) }}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: `1px solid ${CC.border}`,
                    background: 'rgba(255,255,255,0.03)', color: CC.textSec,
                    fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = CC.borderBlue; e.currentTarget.style.color = CC.electricBlueBright }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = CC.border; e.currentTarget.style.color = CC.textSec }}
                >
                  {ex}
                </button>
              ))}
            </div>

            {error && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                color: CC.red, fontSize: 11, fontFamily: 'monospace',
              }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* ═══ Review State — Parsed Summary Card ═══ */}
        {(state === 'review' || state === 'editing') && parsed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {((parsed as any).analysisStatus === 'pending' || (parsed as any).pendingMessage) && (
              <div style={{
                marginBottom: 12, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)',
                fontSize: 11, fontFamily: 'monospace', color: '#FBBF24', lineHeight: 1.5,
              }}>
                {(parsed as any).pendingMessage || 'Pending analysis — AI unavailable. No macros estimated. Save text or enter macros later.'}
              </div>
            )}

            {/* Meal Name + Fuel Score */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: CC.text, marginBottom: 2 }}>
                  {parsed.mealName}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: CC.textTer }}>
                  {((parsed as any).analysisStatus === 'pending')
                    ? 'Text only — pending analysis'
                    : `${parsed.items.length} item${parsed.items.length !== 1 ? 's' : ''} detected`}
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 12px', borderRadius: 10,
                background: `${fuelColor(parsed.fuelScore)}15`,
                border: `1px solid ${fuelColor(parsed.fuelScore)}30`,
              }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: fuelColor(parsed.fuelScore), fontFamily: 'monospace' }}>
                  {parsed.fuelScore}
                </span>
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  FUEL
                </span>
              </div>
            </div>

            {/* Macro Totals Bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
              padding: 12, borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${CC.border}`,
              marginBottom: 14,
            }}>
              {[
                { label: 'CAL', value: parsed.totals.calories, unit: '', color: CC.text },
                { label: 'PRO', value: parsed.totals.protein, unit: 'g', color: CC.electricBlueBright },
                { label: 'CARB', value: parsed.totals.carbs, unit: 'g', color: CC.orange },
                { label: 'FAT', value: parsed.totals.fat, unit: 'g', color: CC.purple },
                { label: 'FIBER', value: parsed.totals.fiber, unit: 'g', color: CC.green },
              ].map((m) => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: 'monospace' }}>
                    {Math.round(m.value)}<span style={{ fontSize: 9, color: CC.textTer }}>{m.unit}</span>
                  </div>
                  <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em', marginTop: 2 }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Item Breakdown */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
              }}>
                ITEM BREAKDOWN
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parsed.items.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10,
                    background: item.isLongevityBooster ? 'rgba(0,220,130,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.isLongevityBooster ? 'rgba(0,220,130,0.15)' : CC.border}`,
                  }}>
                    <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>
                      {item.isLongevityBooster ? '🌿' : '🍽️'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: CC.text }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: 9, color: CC.textTer, fontFamily: 'monospace' }}>
                          {item.quantity}
                        </span>
                        {item.isLongevityBooster && (
                          <span style={{
                            fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                            color: CC.green, background: 'rgba(0,220,130,0.12)',
                            padding: '1px 5px', borderRadius: 4, letterSpacing: '0.05em',
                          }}>
                            LONGEVITY+
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec }}>
                          {item.calories}cal
                        </span>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.electricBlueBright }}>
                          {item.protein}g P
                        </span>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.orange }}>
                          {item.carbs}g C
                        </span>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.purple }}>
                          {item.fat}g F
                        </span>
                      </div>
                      {item.longevityNote && (
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.green, marginTop: 3, opacity: 0.8 }}>
                          ↳ {item.longevityNote}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cellular Impact Card — Longevity-First Molecular Insight */}
            {parsed.molecularInsight && (
              <div style={{ marginBottom: 16 }}>
                <CellularImpactCard
                  molecularInsight={parsed.molecularInsight}
                  microTotals={parsed.microTotals}
                  fuelScore={parsed.fuelScore}
                  longevityHighlights={parsed.longevityHighlights}
                />
              </div>
            )}

            {/* Fallback Longevity Highlights (when no molecular insight) */}
            {!parsed.molecularInsight && parsed.longevityHighlights.length > 0 && (
              <div style={{
                padding: 10, borderRadius: 10,
                background: 'rgba(0,255,204,0.04)',
                border: `1px solid rgba(0,255,204,0.1)`,
                marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', color: CC.accent,
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700,
                }}>
                  🧬 LONGEVITY INTEL
                </div>
                {parsed.longevityHighlights.map((h, i) => (
                  <div key={i} style={{
                    fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
                    lineHeight: 1.5, paddingLeft: 8,
                    borderLeft: `2px solid rgba(0,255,204,0.2)`,
                    marginBottom: i < parsed.longevityHighlights.length - 1 ? 4 : 0,
                  }}>
                    {h}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons — "Looks Right" / "Edit" */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setState('input'); setError(null) }}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${CC.border}`,
                  color: CC.textSec, fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '0.03em',
                }}
              >
                ✏️ Edit
              </button>
              <button
                onClick={handleApprove}
                style={{
                  flex: 2, padding: '12px 16px', borderRadius: 12,
                  background: `linear-gradient(135deg, ${CC.green}, ${CC.accent})`,
                  border: 'none',
                  color: '#000', fontSize: 12, fontFamily: 'monospace', fontWeight: 800,
                  cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
                  boxShadow: `0 4px 16px rgba(0,220,130,0.3)`,
                }}
              >
                {((parsed as any).analysisStatus === 'pending')
                  ? '✓ Save text (pending analysis)'
                  : '✓ Looks Right — Log It'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ Projecting State ═══ */}
        {state === 'projecting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '32px 0' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                border: `2px solid ${CC.border}`,
                borderTopColor: CC.sky,
                margin: '0 auto 16px',
              }}
            />
            <div style={{
              fontSize: 11, fontFamily: 'monospace', color: CC.sky,
              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
            }}>
              Computing Bio-Impact...
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer, marginTop: 6 }}>
              Analyzing CRP trajectory, glucose response, and bio-age shift
            </div>
          </motion.div>
        )}

        {/* ═══ Projected State — Bio-Forecast Card ═══ */}
        {state === 'projected' && bioProjection && parsed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Success Banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(0,220,130,0.08)',
              border: '1px solid rgba(0,220,130,0.15)',
            }}>
              <span style={{ fontSize: 20 }}>{'✅'}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: CC.green, fontFamily: 'monospace' }}>
                  Meal Logged to BioVault
                </div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec }}>
                  {parsed.totals.calories} cal {'•'} {parsed.totals.protein}g protein {'•'} Fuel Score {parsed.fuelScore}/10
                </div>
              </div>
            </div>

            {/* Cellular Impact Card in projected state */}
            {parsed.molecularInsight && (
              <div style={{ marginBottom: 14 }}>
                <CellularImpactCard
                  molecularInsight={parsed.molecularInsight}
                  microTotals={parsed.microTotals}
                  fuelScore={parsed.fuelScore}
                  longevityHighlights={parsed.longevityHighlights}
                />
              </div>
            )}

            {/* Bio-Age Impact Card */}
            <div style={{
              padding: 14, borderRadius: 14,
              background: 'rgba(107,163,190,0.06)',
              border: `1px solid rgba(107,163,190,0.15)`,
              marginBottom: 14,
            }}>
              <div style={{
                fontSize: 9, fontFamily: 'monospace', color: CC.sky,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700,
              }}>
                📊 24-HOUR BIO-AGE PROJECTION
              </div>

              {/* Peak Impact */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: CC.textSec }}>
                    Peak Impact
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
                    color: bioProjection.peakBioAgeDelta > 0.02 ? CC.red
                      : bioProjection.peakBioAgeDelta < -0.02 ? CC.green
                      : CC.textSec,
                  }}>
                    {bioProjection.peakBioAgeDelta > 0 ? '+' : ''}{bioProjection.peakBioAgeDelta.toFixed(2)}
                    <span style={{ fontSize: 10, color: CC.textTer }}> yr</span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer }}>
                    at hour {bioProjection.peakHour} • recovers by hour {bioProjection.recoveryHour}
                  </div>
                </div>

                {/* Inflammation Badge */}
                <div style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: bioProjection.inflammationSpike.severity === 'minimal' ? 'rgba(0,220,130,0.08)'
                    : bioProjection.inflammationSpike.severity === 'mild' ? 'rgba(107,163,190,0.08)'
                    : 'rgba(255,107,107,0.08)',
                  border: `1px solid ${
                    bioProjection.inflammationSpike.severity === 'minimal' ? 'rgba(0,220,130,0.2)'
                    : bioProjection.inflammationSpike.severity === 'mild' ? 'rgba(107,163,190,0.2)'
                    : 'rgba(255,107,107,0.2)'
                  }`,
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: bioProjection.inflammationSpike.severity === 'minimal' ? CC.green
                      : bioProjection.inflammationSpike.severity === 'mild' ? CC.sky
                      : CC.red,
                  }}>
                    {bioProjection.inflammationSpike.severity}
                  </div>
                  <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>
                    CRP Impact
                  </div>
                </div>
              </div>

              {/* Spark Chart */}
              <div style={{
                padding: '8px 0', borderTop: `1px solid ${CC.border}`,
                marginBottom: 8,
              }}>
                <BioSparkChart data={bioProjection.hourlyProjection} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>0h</span>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>12h</span>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>24h</span>
                </div>
              </div>

              {/* Personalized Insight */}
              <div style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${CC.border}`,
              }}>
                <div style={{
                  fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
                  lineHeight: 1.6,
                }}>
                  {bioProjection.personalizedInsight}
                </div>
              </div>
            </div>

            {/* Bio-Age Shift Summary */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              marginBottom: 16,
            }}>
              {[
                { label: 'IMMEDIATE', value: bioProjection.bioAgeShift.immediate, unit: 'yr' },
                { label: 'PEAK', value: bioProjection.bioAgeShift.peak, unit: 'yr' },
                { label: 'AT 24H', value: bioProjection.bioAgeShift.at24h, unit: 'yr' },
              ].map((s) => (
                <div key={s.label} style={{
                  padding: '8px 6px', borderRadius: 10, textAlign: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${CC.border}`,
                }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
                    color: s.value > 0.01 ? CC.terra : s.value < -0.01 ? CC.sage : CC.textSec,
                  }}>
                    {s.value > 0 ? '+' : ''}{s.value.toFixed(3)}
                  </div>
                  <div style={{ fontSize: 7, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em', marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Done Button */}
            <button
              onClick={handleClose}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${CC.border}`,
                color: CC.text, fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
                transition: 'all 0.2s',
              }}
            >
              Done — Return to Dashboard
            </button>
          </motion.div>
        )}

        {/* ═══ Logged State (no bio-projection available) ═══ */}
        {state === 'logged' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center', padding: '24px 0' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{
              fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
              color: CC.green, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Meal Logged
            </div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: CC.textSec, marginTop: 6 }}>
              {(parsed as any)?.analysisStatus === 'pending' || (parsed?.totals.calories === 0 && parsed?.fuelScore === 0)
                ? 'Saved as pending analysis — no macros claimed'
                : `${parsed?.totals.calories} cal • ${parsed?.totals.protein}g protein logged to BioVault`}
            </div>
            <button
              onClick={handleClose}
              style={{
                marginTop: 16, padding: '10px 24px', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${CC.border}`,
                color: CC.textSec, fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              Done
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
