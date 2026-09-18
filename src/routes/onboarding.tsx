import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { classifyAllMarkers, extractTextFromFile, type ClassifiedMarker } from '@/lib/LabResultParser'
import { useRapidIntake, type RapidIntakeStatus } from '@/hooks/useRapidIntake'

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════
   RAPID BIO-ONBOARDING — Universal Sync + Rapid Intake
   
   Two modes:
   1. RAPID INTAKE (default) — Single text area + voice-to-text
      → AI Brain parses instantly → HUD populated in 30 seconds
   2. FULL SYNC — Connect wearables + Upload blood work
   
   Zero forms. Immediate value. Medical-grade aesthetic.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#06060A',
  surface: 'rgba(12,12,18,0.88)',
  elevated: 'rgba(18,18,26,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  cyan: '#00F0FF',
  cyanDim: 'rgba(0,240,255,0.12)',
  cyanGlow: 'rgba(0,240,255,0.06)',
  green: '#00FFCC',
  greenDim: 'rgba(0,255,204,0.12)',
  greenGlow: 'rgba(0,255,204,0.06)',
  orange: '#FF8C00',
  orangeDim: 'rgba(255,140,0,0.12)',
  red: '#FF6B6B',
  redDim: 'rgba(255,107,107,0.12)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.12)',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,240,255,0.25)',
}

/* ── Types ── */
type Phase = 'rapid' | 'sync' | 'processing' | 'reveal'

interface WearableProvider {
  id: string
  name: string
  icon: string
  color: string
  status: 'idle' | 'connecting' | 'connected' | 'error'
  description: string
}

interface BioAgeResult {
  chronoAge: number
  bioAge: number
  delta: number
  status: string
  statusColor: string
  confidence: number
  markersAnalyzed: number
  classifiedMarkers: ClassifiedMarker[]
  northStar: { goal: string; confidence: number; reason: string }
  topInsights: string[]
  supplements?: string[]
}

/* ── Wearable Providers ── */
const WEARABLE_PROVIDERS: WearableProvider[] = [
  { id: 'apple_health', name: 'Apple Health', icon: '🍎', color: '#FF2D55', status: 'idle', description: 'HRV, Sleep, Activity, Heart Rate' },
  { id: 'oura', name: 'Oura Ring', icon: '💍', color: '#D4AF37', status: 'idle', description: 'Sleep Stages, Readiness, Temperature' },
  { id: 'whoop', name: 'WHOOP', icon: '⌚', color: '#00DC82', status: 'idle', description: 'Strain, Recovery, HRV Trends' },
  { id: 'garmin', name: 'Garmin', icon: '🏃', color: '#007CC3', status: 'idle', description: 'VO2 Max, Body Battery, Stress' },
  { id: 'fitbit', name: 'Fitbit', icon: '📱', color: '#00B0B9', status: 'idle', description: 'SpO2, Sleep Score, Active Zone' },
  { id: 'eight_sleep', name: 'Eight Sleep', icon: '🛏️', color: '#6366F1', status: 'idle', description: 'Sleep Fitness, HRV, Temperature' },
]

/* ── Animated DNA Helix ── */
function DNAHelix({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <defs>
        <linearGradient id="dna-grad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={T.cyan} stopOpacity="0.8" />
          <stop offset="100%" stopColor={T.green} stopOpacity="0.6" />
        </linearGradient>
        <filter id="dna-glow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <circle cx="40" cy="40" r="36" stroke="url(#dna-grad)" strokeWidth="1" strokeDasharray="4 6" opacity="0.3">
        <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="20s" repeatCount="indefinite" />
      </circle>
      <circle cx="40" cy="40" r="24" stroke={T.cyan} strokeWidth="0.5" strokeDasharray="2 4" opacity="0.2">
        <animateTransform attributeName="transform" type="rotate" from="360 40 40" to="0 40 40" dur="15s" repeatCount="indefinite" />
      </circle>
      <path d="M20 15 Q40 30 60 15 Q40 0 20 15" stroke={T.cyan} strokeWidth="1.5" fill="none" opacity="0.6">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,50; 0,0" dur="4s" repeatCount="indefinite" />
      </path>
      <path d="M20 15 Q40 0 60 15 Q40 30 20 15" stroke={T.green} strokeWidth="1.5" fill="none" opacity="0.6">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,50; 0,0" dur="4s" repeatCount="indefinite" />
      </path>
      {[18, 30, 42, 54].map((y, i) => (
        <line key={i} x1="28" y1={y} x2="52" y2={y} stroke={T.cyan} strokeWidth="0.8" opacity="0.25">
          <animate attributeName="opacity" values="0.1;0.4;0.1" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
        </line>
      ))}
      <circle cx="40" cy="40" r="12" fill={T.cyan} opacity="0.04" filter="url(#dna-glow)" />
    </svg>
  )
}

/* ── Processing Spinner ── */
function ProcessingSpinner() {
  const [dots, setDots] = useState('')
  const [stage, setStage] = useState(0)
  const stages = [
    'Extracting biomarker values',
    'Cross-referencing longevity ranges',
    'Computing biological age signals',
    'Generating cellular profile',
    'Calibrating Vive Age algorithm',
  ]

  useEffect(() => {
    const dotTimer = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    const stageTimer = setInterval(() => setStage(s => (s + 1) % stages.length), 2200)
    return () => { clearInterval(dotTimer); clearInterval(stageTimer) }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '60px 20px' }}
    >
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${T.cyanDim}`, borderTopColor: T.cyan,
          animation: 'onb-spin 1s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 12, borderRadius: '50%',
          border: `2px solid ${T.greenDim}`, borderBottomColor: T.green,
          animation: 'onb-spin-rev 1.5s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 24, borderRadius: '50%',
          border: `1px solid rgba(255,255,255,0.04)`, borderLeftColor: T.orange,
          animation: 'onb-spin 2s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 32 }}>🧬</span>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
          color: T.cyan, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          AI BRAIN ANALYZING
        </div>
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          style={{ fontSize: 13, color: T.textSec, fontFamily: 'monospace', minHeight: 20 }}
        >
          {stages[stage]}{dots}
        </motion.div>
      </div>

      <div style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: ['0%', '100%'] }}
            transition={{ duration: 8, ease: 'linear' }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${T.cyan}, ${T.green})` }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   RAPID INTAKE — Single Text Area + Voice-to-Text
   ══════════════════════════════════════════════════════════════ */

function RapidIntakePanel({ onComplete, onSwitchToFull }: {
  onComplete: (result: BioAgeResult) => void
  onSwitchToFull: () => void
}) {
  const {
    status, error, result, parseStages,
    inputText, setInputText, placeholder,
    isListening, startListening, stopListening,
    parseInput, reset,
  } = useRapidIntake()
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When parsing completes, build the BioAgeResult and pass to parent
  useEffect(() => {
    if (status === 'complete' && result) {
      const isYounger = result.delta < 0
      const statusColor = isYounger
        ? (result.delta <= -5 ? T.green : result.delta <= -2 ? '#00DC82' : T.cyan)
        : (result.delta <= 3 ? T.orange : T.red)

      onComplete({
        chronoAge: result.chronoAge,
        bioAge: result.bioAge,
        delta: result.delta,
        status: result.status,
        statusColor,
        confidence: result.confidence,
        markersAnalyzed: result.markersAnalyzed,
        classifiedMarkers: result.classifiedMarkers,
        northStar: result.northStar,
        topInsights: result.topInsights,
        supplements: result.supplements,
      })
    }
  }, [status, result, onComplete])

  const canSubmit = inputText.trim().length >= 10

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      style={{ position: 'relative', zIndex: 1, paddingBottom: 120 }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '48px 20px 28px' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <DNAHelix size={64} />
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: T.cyan, letterSpacing: '0.3em', textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            RAPID INTAKE
          </div>
          <h1 style={{
            fontSize: 24, fontWeight: 800, color: T.text,
            lineHeight: 1.2, margin: '0 0 8px',
          }}>
            Tell Us About You
          </h1>
          <p style={{ fontSize: 13, color: T.textSec, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
            Describe yourself in plain language. Age, weight, supplements, lab values — anything you know. Our AI Brain handles the rest.
          </p>
        </motion.div>
      </div>

      {/* Main Input Area */}
      <div style={{ padding: '0 16px', maxWidth: 520, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          {/* ── IDLE / LISTENING: Show text area ── */}
          {(status === 'idle' || status === 'listening') && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {/* Voice + Text input container */}
              <div style={{
                background: T.surface,
                border: `1px solid ${isListening ? T.cyan + '50' : T.border}`,
                borderRadius: 18,
                overflow: 'hidden',
                transition: 'border-color 0.3s',
                boxShadow: isListening ? `0 0 30px ${T.cyanGlow}, inset 0 0 20px ${T.cyanGlow}` : 'none',
              }}>
                {/* Listening indicator */}
                {isListening && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    style={{
                      padding: '10px 16px',
                      background: T.cyanGlow,
                      borderBottom: `1px solid ${T.cyan}20`,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {/* Audio waveform bars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <motion.div
                          key={i}
                          animate={{ height: [4, 12 + Math.random() * 4, 4] }}
                          transition={{ duration: 0.4 + i * 0.1, repeat: Infinity, repeatType: 'reverse' }}
                          style={{ width: 2, borderRadius: 1, background: T.cyan }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.cyan, fontWeight: 700, letterSpacing: '0.15em' }}>
                      LISTENING — SPEAK NATURALLY
                    </span>
                    <button
                      onClick={stopListening}
                      style={{
                        marginLeft: 'auto', background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${T.cyan}30`, borderRadius: 6,
                        padding: '3px 8px', cursor: 'pointer',
                        fontSize: 9, fontFamily: 'monospace', color: T.cyan,
                      }}
                    >
                      STOP
                    </button>
                  </motion.div>
                )}

                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={placeholder}
                  rows={5}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'transparent', border: 'none',
                    color: T.text, fontSize: 13, fontFamily: 'monospace',
                    resize: 'vertical', outline: 'none', lineHeight: 1.7,
                    minHeight: 120, boxSizing: 'border-box',
                  }}
                />

                {/* Bottom toolbar */}
                <div style={{
                  padding: '8px 12px',
                  borderTop: `1px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  {/* Voice button */}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={isListening ? stopListening : startListening}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8,
                      background: isListening ? T.cyanDim : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isListening ? T.cyan + '30' : T.border}`,
                      cursor: 'pointer', color: isListening ? T.cyan : T.textSec,
                      fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    {isListening ? 'Listening...' : 'Voice Input'}
                  </motion.button>

                  {/* Character count */}
                  <span style={{
                    fontSize: 9, fontFamily: 'monospace',
                    color: inputText.length >= 10 ? T.green : T.textTer,
                  }}>
                    {inputText.length} chars
                  </span>
                </div>
              </div>

              {/* Quick-fill examples */}
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', color: T.textTer,
                  letterSpacing: '0.15em', marginBottom: 8,
                }}>
                  QUICK EXAMPLES — TAP TO FILL
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: '💊 Supplement Stack', text: "I'm 32, male, 175lbs. I take Creatine 5g, NMN 250mg, Vitamin D 5000IU, Magnesium Glycinate 400mg, and Omega-3 2g daily." },
                    { label: '🔬 Lab Results', text: "34 year old male, 180lbs. Recent labs: Vitamin D 42 ng/mL, HbA1c 5.4%, Total Testosterone 650 ng/dL, Ferritin 85 ng/mL, hs-CRP 0.8 mg/L, Fasting Glucose 88 mg/dL." },
                    { label: '🏃 Fitness Focus', text: "28, female, 135lbs. Training 5x/week, sleep 7.5hrs. Taking Ashwagandha 600mg, B-Complex, Iron 18mg. Goal: peak performance and recovery optimization." },
                  ].map((ex, i) => (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setInputText(ex.text)}
                      style={{
                        padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${T.border}`,
                        cursor: 'pointer', color: T.textSec,
                        fontSize: 10, fontFamily: 'monospace',
                        transition: 'all 0.2s',
                      }}
                    >
                      {ex.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '10px 14px', borderRadius: 10, marginTop: 12,
                    background: T.redDim, border: `1px solid ${T.red}20`,
                    fontSize: 11, color: T.red,
                  }}
                >
                  {error}
                </motion.div>
              )}

              {/* Switch to full sync */}
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={onSwitchToFull}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: T.textTer, fontFamily: 'monospace',
                    padding: '8px 16px',
                    display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
                  }}
                >
                  <span>⌚</span>
                  <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Or connect wearables & upload blood work
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PARSING: Show animated stages ── */}
          {(status === 'parsing' || status === 'populating') && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 24, padding: '40px 0',
              }}
            >
              {/* Orbital spinner */}
              <div style={{ position: 'relative', width: 100, height: 100 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${T.cyanDim}`, borderTopColor: T.cyan,
                  animation: 'onb-spin 1s linear infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 10, borderRadius: '50%',
                  border: `2px solid ${T.greenDim}`, borderBottomColor: T.green,
                  animation: 'onb-spin-rev 1.5s linear infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 28 }}>🧬</span>
                </div>
              </div>

              <div style={{
                fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                color: T.cyan, letterSpacing: '0.2em',
              }}>
                {status === 'populating' ? 'POPULATING HUD TILES' : 'AI BRAIN ANALYZING'}
              </div>

              {/* Parse stages */}
              <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parseStages.map((stage, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 10,
                      background: stage.complete ? T.greenGlow : stage.active ? T.cyanGlow : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${stage.complete ? T.green + '20' : stage.active ? T.cyan + '20' : T.border}`,
                      transition: 'all 0.4s',
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>
                      {stage.complete ? '✓' : stage.icon}
                    </span>
                    <span style={{
                      fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                      color: stage.complete ? T.green : stage.active ? T.cyan : T.textTer,
                      flex: 1,
                    }}>
                      {stage.label}
                    </span>
                    {stage.active && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{ width: 12, height: 12 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <circle cx="6" cy="6" r="4" fill="none" stroke={T.cyan} strokeWidth="1.5" strokeDasharray="8 16" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    )}
                    {stage.complete && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}60` }} />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ width: '100%', maxWidth: 320 }}>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: status === 'populating' ? '100%' : '85%' }}
                    transition={{ duration: status === 'populating' ? 0.5 : 6, ease: 'linear' }}
                    style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${T.cyan}, ${T.green})` }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Analyze Button */}
      {(status === 'idle' || status === 'listening') && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(transparent, rgba(6,6,10,0.95) 30%)',
          zIndex: 10,
        }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => parseInput()}
            disabled={!canSubmit}
            style={{
              width: '100%', maxWidth: 520, margin: '0 auto', display: 'block',
              padding: '16px 24px', borderRadius: 16,
              background: canSubmit
                ? `linear-gradient(135deg, ${T.cyan}, ${T.green})`
                : 'rgba(255,255,255,0.06)',
              border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
              color: canSubmit ? '#000' : T.textTer,
              boxShadow: canSubmit ? `0 4px 24px ${T.cyan}30` : 'none',
              transition: 'all 0.3s',
            }}
          >
            {canSubmit ? '⚡ Instant Analyze' : 'Describe yourself above to begin'}
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}

/* ── Bio Age Reveal Card ── */
function BioAgeRevealCard({ result }: { result: BioAgeResult }) {
  const [showDetails, setShowDetails] = useState(false)
  const [animatedAge, setAnimatedAge] = useState(result.chronoAge)

  useEffect(() => {
    let frame = 0
    const totalFrames = 60
    const start = result.chronoAge
    const end = result.bioAge
    const timer = setInterval(() => {
      frame++
      const progress = frame / totalFrames
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedAge(Math.round((start + (end - start) * eased) * 10) / 10)
      if (frame >= totalFrames) clearInterval(timer)
    }, 25)
    return () => clearInterval(timer)
  }, [result.bioAge, result.chronoAge])

  const isYounger = result.delta < 0
  const statusColor = isYounger
    ? (result.delta <= -5 ? T.green : result.delta <= -2 ? '#00DC82' : T.cyan)
    : (result.delta <= 3 ? T.orange : T.red)
  const statusGlow = statusColor + '20'

  const goalLabels: Record<string, string> = {
    'longevity': '🧬 Longevity Optimization',
    'peak-output': '⚡ Peak Performance',
    'recovery': '🛡️ Recovery & Resilience',
    'body-recomp': '💪 Body Recomposition',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: '0 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}
    >
      <div style={{
        background: T.surface, borderRadius: 24,
        border: `1px solid ${statusColor}20`,
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${statusGlow}, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ padding: '28px 24px 0', textAlign: 'center', position: 'relative' }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: statusColor, letterSpacing: '0.25em', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            VIVE BIOLOGICAL AGE
          </div>
          <div style={{ fontSize: 10, color: T.textTer, fontFamily: 'monospace', marginBottom: 20 }}>
            {result.markersAnalyzed} biomarkers analyzed &bull; {result.confidence}% confidence
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', marginBottom: 4 }}>
                CHRONOLOGICAL
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', lineHeight: 1 }}>
                {result.chronoAge}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 20 }}>&rarr;</div>
              <div style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: statusColor, letterSpacing: '0.1em',
                padding: '2px 8px', borderRadius: 6,
                background: statusColor + '15',
              }}>
                {isYounger ? `${Math.abs(result.delta).toFixed(1)}yr \u2193` : `+${result.delta.toFixed(1)}yr \u2191`}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: statusColor, letterSpacing: '0.1em', marginBottom: 4 }}>
                BIOLOGICAL
              </div>
              <div style={{
                fontSize: 48, fontWeight: 900, color: statusColor,
                fontFamily: 'monospace', lineHeight: 1,
                textShadow: `0 0 30px ${statusColor}40`,
              }}>
                {animatedAge.toFixed(1)}
              </div>
            </div>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: statusColor + '12', border: `1px solid ${statusColor}25`,
            marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}60` }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: statusColor, letterSpacing: '0.08em' }}>
              {result.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Detected Supplements */}
        {result.supplements && result.supplements.length > 0 && (
          <div style={{
            margin: '0 16px 12px', padding: '12px 16px', borderRadius: 14,
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em', marginBottom: 8 }}>
              DETECTED SUPPLEMENT STACK
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {result.supplements.map((s, i) => (
                <span key={i} style={{
                  fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                  padding: '3px 8px', borderRadius: 6,
                  background: T.cyanDim, color: T.cyan,
                  border: `1px solid ${T.cyan}15`,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* North Star Goal */}
        <div style={{
          margin: '0 16px 16px', padding: '12px 16px', borderRadius: 14,
          background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em', marginBottom: 6 }}>
            AI-INFERRED OPTIMIZATION PATH
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            {goalLabels[result.northStar.goal] || result.northStar.goal}
          </div>
          <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5 }}>
            {result.northStar.reason}
          </div>
        </div>

        {/* Top Insights */}
        {result.topInsights.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em', marginBottom: 8 }}>
              PRIORITY LONGEVITY INSIGHTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.topInsights.slice(0, 3).map((insight, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '8px 12px', borderRadius: 10,
                  background: i === 0 ? T.redDim : i === 1 ? T.orangeDim : T.blueDim,
                  border: `1px solid ${i === 0 ? T.red : i === 1 ? T.orange : T.blue}15`,
                }}>
                  <span style={{ fontSize: 10, marginTop: 1 }}>{i === 0 ? '🔴' : i === 1 ? '🟠' : '🔵'}</span>
                  <span style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5, flex: 1 }}>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expand Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            width: '100%', padding: '12px 16px',
            background: 'rgba(255,255,255,0.02)',
            borderTop: `1px solid ${T.border}`,
            border: 'none', borderTopStyle: 'solid',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em' }}>
            {showDetails ? 'HIDE' : 'VIEW'} BIOMARKER BREAKDOWN
          </span>
          <span style={{ fontSize: 12, color: T.textTer, transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
            ▼
          </span>
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 16px 16px' }}>
                {result.classifiedMarkers.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 0',
                    borderBottom: i < result.classifiedMarkers.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: m.severity === 'green' ? T.green : m.severity === 'amber' ? T.orange : T.red,
                      boxShadow: `0 0 6px ${m.severity === 'green' ? T.green : m.severity === 'amber' ? T.orange : T.red}40`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{m.label}</span>
                        <span style={{
                          fontSize: 13, fontWeight: 800, fontFamily: 'monospace',
                          color: m.severity === 'green' ? T.green : m.severity === 'amber' ? T.orange : T.red,
                        }}>
                          {m.value} <span style={{ fontSize: 9, fontWeight: 400, color: T.textTer }}>{m.unit}</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            position: 'absolute', left: '20%', right: '20%', top: 0, bottom: 0,
                            background: T.greenDim, borderRadius: 2,
                          }} />
                          <div style={{
                            position: 'absolute', top: -1, width: 5, height: 5, borderRadius: '50%',
                            background: m.severity === 'green' ? T.green : m.severity === 'amber' ? T.orange : T.red,
                            left: `${Math.min(95, Math.max(5, 50))}%`, transform: 'translateX(-50%)',
                          }} />
                        </div>
                        <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, whiteSpace: 'nowrap' }}>
                          opt: {m.optimalRange}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em',
                          padding: '1px 6px', borderRadius: 4,
                          color: m.severity === 'green' ? T.green : m.severity === 'amber' ? T.orange : T.red,
                          background: m.severity === 'green' ? T.greenDim : m.severity === 'amber' ? T.orangeDim : T.redDim,
                        }}>
                          {m.classification === 'optimal' ? 'OPTIMAL' : m.classification === 'clinically-normal' ? 'SUB-OPTIMAL' : 'OUT OF RANGE'}
                        </span>
                        {m.delta && (
                          <span style={{ fontSize: 9, color: T.textTer, fontFamily: 'monospace' }}>{m.delta}</span>
                        )}
                      </div>
                      {m.classification !== 'optimal' && (
                        <div style={{ fontSize: 10, color: T.textSec, lineHeight: 1.5, marginTop: 4 }}>
                          {m.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN ONBOARDING PAGE
   ══════════════════════════════════════════════════════════════ */

function RapidBioOnboarding() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('rapid')
  const [providers, setProviders] = useState<WearableProvider[]>(WEARABLE_PROVIDERS)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [bioAgeResult, setBioAgeResult] = useState<BioAgeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const instantParse = useAction(api.instantOnboard.instantParse)
  const saveBioVault = useMutation(api.mutations.upsertBioVault)
  const saveVitals = useMutation(api.mutations.upsertUserVitals)

  const connectedCount = providers.filter(p => p.status === 'connected').length
  const hasData = uploadedFile !== null || pastedText.trim().length > 20 || connectedCount > 0

  /* ── Rapid Intake complete handler ── */
  const handleRapidComplete = useCallback((result: BioAgeResult) => {
    setBioAgeResult(result)
    setPhase('reveal')
  }, [])

  /* ── Wearable Connection (simulated) ── */
  const handleConnectWearable = useCallback((providerId: string) => {
    setProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, status: 'connecting' as const } : p
    ))
    setTimeout(() => {
      setProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, status: 'connected' as const } : p
      ))
    }, 1500 + Math.random() * 1000)
  }, [])

  /* ── File Upload ── */
  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv']
    if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      setError('Please upload a PDF, image, or text file of your blood work.')
      return
    }
    setUploadedFile(file)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  /* ── Process Everything (Full Sync mode) ── */
  const handleAnalyze = useCallback(async () => {
    setPhase('processing')
    setError(null)

    try {
      const sessionId = getTwinSessionId()
      let rawText = pastedText

      if (uploadedFile) {
        try {
          rawText = await extractTextFromFile(uploadedFile)
        } catch {
          rawText = pastedText || 'No readable text extracted from file.'
        }
      }

      const connectedProviders = providers.filter(p => p.status === 'connected').map(p => p.name)
      if (connectedProviders.length > 0) {
        rawText += `\n\nConnected wearables: ${connectedProviders.join(', ')}. Wearable data will sync automatically.`
      }

      if (!rawText.trim() || rawText.trim().length < 10) {
        rawText = `User connected ${connectedProviders.join(', ')}. Generate a baseline biological profile for a health-conscious individual. Age: 35, Gender: male, Weight: 175 lbs.`
      }

      const inputType = uploadedFile ? 'lab_report' : pastedText ? 'free_text' : 'mixed'
      const result = await instantParse({ rawText, inputType })

      if (!result.success) {
        setError('Failed to analyze data. Please try again.')
        setPhase('sync')
        return
      }

      const data = result.data
      const biomarkers = data.biomarkers || {}
      try {
        await saveBioVault({
          sessionId,
          vitaminD: biomarkers.vitaminD ?? undefined,
          testosteroneFree: biomarkers.testosteroneFree ?? undefined,
          testosteroneTotal: biomarkers.testosteroneTotal ?? undefined,
          ferritin: biomarkers.ferritin ?? undefined,
          crp: biomarkers.crp ?? undefined,
          hba1c: biomarkers.hba1c ?? undefined,
          fastingGlucose: biomarkers.fastingGlucose ?? undefined,
          mthfrVariant: data.geneticFlags?.mthfrVariant ?? false,
          apoe4: data.geneticFlags?.apoe4 ?? false,
          caffeineSensitivity: data.geneticFlags?.caffeineSensitivity ?? false,
          preferredProteins: data.diet?.preferredProteins ?? 'chicken, fish, eggs',
          dietaryRestrictions: data.diet?.dietaryRestrictions ?? 'none',
        })
      } catch (e) {
        console.warn('[Onboard] BioVault save failed:', e)
      }

      const vitals = data.vitals || {}
      if (vitals.age) {
        try {
          await saveVitals({
            sessionId,
            age: vitals.age,
            gender: vitals.gender || 'male',
            weight: vitals.weight || 170,
            unit: vitals.weightUnit === 'kg' ? 'kg' : 'lbs',
          })
        } catch (e) {
          console.warn('[Onboard] Vitals save failed:', e)
        }
      }

      const allBiomarkers: Record<string, number | null> = { ...biomarkers }
      if (data.additionalBiomarkers) {
        for (const ab of data.additionalBiomarkers) {
          const key = ab.name.toLowerCase().replace(/[\s\-()]/g, '')
          allBiomarkers[key] = ab.value
        }
      }

      const classified = classifyAllMarkers(allBiomarkers)
      const chronoAge = vitals.age || 35

      let bioAgeOffset = 0
      let markerCount = 0
      for (const m of classified.all) {
        if (m.classification === 'optimal') { bioAgeOffset -= 0.5; markerCount++ }
        else if (m.classification === 'clinically-normal') { bioAgeOffset += 0.8; markerCount++ }
        else if (m.classification === 'out-of-range') { bioAgeOffset += 2.0; markerCount++ }
      }
      if (markerCount > 0) bioAgeOffset = bioAgeOffset / Math.sqrt(markerCount)
      bioAgeOffset -= connectedCount * 0.3

      const bioAge = Math.round((chronoAge + bioAgeOffset) * 10) / 10
      const delta = Math.round((bioAge - chronoAge) * 10) / 10

      const topInsights: string[] = []
      for (const m of classified.outOfRange.slice(0, 2)) {
        topInsights.push(m.suggestion)
      }
      for (const m of classified.subOptimal.slice(0, 3 - topInsights.length)) {
        topInsights.push(m.suggestion)
      }

      let status: string
      if (delta <= -5) status = 'Exceptional'
      else if (delta <= -2) status = 'Optimized'
      else if (delta <= 0) status = 'On Track'
      else if (delta <= 3) status = 'Needs Attention'
      else status = 'Accelerated Aging'

      const confidence = Math.min(95, Math.max(30, 40 + markerCount * 5 + connectedCount * 8))

      setBioAgeResult({
        chronoAge,
        bioAge,
        delta,
        status,
        statusColor: delta <= -2 ? T.green : delta <= 0 ? T.cyan : delta <= 3 ? T.orange : T.red,
        confidence,
        markersAnalyzed: markerCount,
        classifiedMarkers: classified.all,
        northStar: data.northStar || { goal: 'longevity', confidence: 0.5, reason: 'Default optimization path.' },
        topInsights,
      })

      setTimeout(() => setPhase('reveal'), 1500)
    } catch (err: any) {
      console.error('[Onboard] Analysis failed:', err)
      setError(err?.message || 'Analysis failed. Please try again.')
      setPhase('sync')
    }
  }, [uploadedFile, pastedText, providers, instantParse, saveBioVault, saveVitals])

  /* ── Enter Dashboard ── */
  const handleEnterDashboard = useCallback(() => {
    try { localStorage.setItem('vive-onboarded', 'true') } catch {}
    navigate({ to: '/' })
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background ambient */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${T.cyanGlow}, transparent 60%)`,
      }} />

      <style>{`
        @keyframes onb-spin { to { transform: rotate(360deg); } }
        @keyframes onb-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes onb-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes onb-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      <AnimatePresence mode="wait">
        {/* ═══ PHASE: RAPID INTAKE (default) ═══ */}
        {phase === 'rapid' && (
          <RapidIntakePanel
            key="rapid"
            onComplete={handleRapidComplete}
            onSwitchToFull={() => setPhase('sync')}
          />
        )}

        {/* ═══ PHASE: FULL SYNC ═══ */}
        {phase === 'sync' && (
          <motion.div
            key="sync"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'relative', zIndex: 1, paddingBottom: 120 }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', padding: '48px 20px 32px' }}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                <DNAHelix size={72} />
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: T.cyan, letterSpacing: '0.3em', textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  UNIVERSAL SYNC
                </div>
                <h1 style={{
                  fontSize: 26, fontWeight: 800, color: T.text,
                  lineHeight: 1.2, margin: '0 0 8px',
                }}>
                  Your Biology, Decoded
                </h1>
                <p style={{ fontSize: 14, color: T.textSec, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
                  Connect your wearables and upload your latest blood work. Our AI Brain will compute your biological age in seconds.
                </p>
              </motion.div>
            </div>

            <div style={{ padding: '0 16px', maxWidth: 480, margin: '0 auto' }}>
              {/* Back to Rapid Intake */}
              <button
                onClick={() => setPhase('rapid')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: T.cyan, fontFamily: 'monospace',
                  padding: '0 0 16px', marginBottom: 0,
                }}
              >
                <span>&larr;</span>
                <span>Back to Rapid Intake</span>
              </button>

              {/* Wearable Connections */}
              <div style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: T.textTer, letterSpacing: '0.2em', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⌚ WEARABLE SYNC</span>
                {connectedCount > 0 && (
                  <span style={{
                    fontSize: 8, padding: '1px 6px', borderRadius: 4,
                    background: T.greenDim, color: T.green,
                  }}>
                    {connectedCount} CONNECTED
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28 }}>
                {providers.map((p, i) => (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    onClick={() => p.status === 'idle' && handleConnectWearable(p.id)}
                    disabled={p.status === 'connecting'}
                    style={{
                      background: p.status === 'connected' ? `${p.color}08` : T.surface,
                      border: `1px solid ${p.status === 'connected' ? p.color + '30' : T.border}`,
                      borderRadius: 14, padding: '14px 12px',
                      cursor: p.status === 'idle' ? 'pointer' : 'default',
                      textAlign: 'left', transition: 'all 0.3s',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {p.status === 'connected' && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 16, height: 16, borderRadius: '50%',
                        background: T.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 9, color: T.green }}>✓</span>
                      </div>
                    )}
                    {p.status === 'connecting' && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${T.border}`, borderTopColor: p.color,
                        animation: 'onb-spin 0.8s linear infinite',
                      }} />
                    )}
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: T.textTer, lineHeight: 1.4 }}>{p.description}</div>
                  </motion.button>
                ))}
              </div>

              {/* Blood Work Upload */}
              <div style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: T.textTer, letterSpacing: '0.2em', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>🔬 BLOOD WORK</span>
                {uploadedFile && (
                  <span style={{
                    fontSize: 8, padding: '1px 6px', borderRadius: 4,
                    background: T.greenDim, color: T.green,
                  }}>
                    UPLOADED
                  </span>
                )}
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? T.cyan : uploadedFile ? T.green + '40' : T.border}`,
                  borderRadius: 16, padding: uploadedFile ? '16px' : '28px 16px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? T.cyanGlow : uploadedFile ? T.greenGlow : 'transparent',
                  transition: 'all 0.3s',
                  marginBottom: 12,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                {uploadedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>📄</span>
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {uploadedFile.name}
                      </div>
                      <div style={{ fontSize: 10, color: T.textTer }}>
                        {(uploadedFile.size / 1024).toFixed(0)} KB &bull; Ready to analyze
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadedFile(null) }}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
                        padding: '4px 8px', cursor: 'pointer', color: T.textTer, fontSize: 10,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8, animation: 'onb-float 3s ease-in-out infinite' }}>📋</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                      Drop your blood work here
                    </div>
                    <div style={{ fontSize: 11, color: T.textTer }}>
                      PDF, photo, or text file
                    </div>
                  </>
                )}
              </div>

              {/* Or paste text */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em' }}>OR PASTE LAB VALUES</span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => { setPastedText(e.target.value); setError(null) }}
                  placeholder="Paste lab results here..."
                  style={{
                    width: '100%', minHeight: 80, padding: '12px 14px',
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 12, color: T.text, fontSize: 12,
                    fontFamily: 'monospace', resize: 'vertical',
                    outline: 'none', lineHeight: 1.6,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: T.redDim, border: `1px solid ${T.red}20`,
                    fontSize: 11, color: T.red, marginBottom: 16,
                  }}
                >
                  {error}
                </motion.div>
              )}

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  onClick={() => {
                    try { localStorage.setItem('vive-onboarded', 'true') } catch {}
                    navigate({ to: '/' })
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: T.textTer, fontFamily: 'monospace',
                    padding: '8px 16px', textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Skip for now
                </button>
              </div>
            </div>

            {/* Floating Analyze Button */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
              background: 'linear-gradient(transparent, rgba(6,6,10,0.95) 30%)',
              zIndex: 10,
            }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAnalyze}
                disabled={!hasData}
                style={{
                  width: '100%', maxWidth: 480, margin: '0 auto', display: 'block',
                  padding: '16px 24px', borderRadius: 16,
                  background: hasData
                    ? `linear-gradient(135deg, ${T.cyan}, ${T.green})`
                    : 'rgba(255,255,255,0.06)',
                  border: 'none', cursor: hasData ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
                  color: hasData ? '#000' : T.textTer,
                  boxShadow: hasData ? `0 4px 24px ${T.cyan}30` : 'none',
                  transition: 'all 0.3s',
                }}
              >
                {hasData ? '🧬 Analyze My Biology' : 'Connect a device or upload blood work'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══ PHASE: PROCESSING ═══ */}
        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ProcessingSpinner />
          </motion.div>
        )}

        {/* ═══ PHASE: REVEAL ═══ */}
        {phase === 'reveal' && bioAgeResult && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'relative', zIndex: 1, paddingBottom: 120 }}
          >
            <div style={{ textAlign: 'center', padding: '40px 20px 24px' }}>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                style={{ fontSize: 40, marginBottom: 12 }}
              >
                🧬
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: T.cyan, letterSpacing: '0.3em', textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  ANALYSIS COMPLETE
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 4px' }}>
                  Your Biological Profile
                </h1>
                <p style={{ fontSize: 12, color: T.textSec }}>
                  Powered by the Vive AI Brain
                </p>
              </motion.div>
            </div>

            <BioAgeRevealCard result={bioAgeResult} />

            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
              background: 'linear-gradient(transparent, rgba(6,6,10,0.95) 30%)',
              zIndex: 10,
            }}>
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleEnterDashboard}
                style={{
                  width: '100%', maxWidth: 480, margin: '0 auto', display: 'block',
                  padding: '16px 24px', borderRadius: 16,
                  background: `linear-gradient(135deg, ${T.cyan}, ${T.green})`,
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
                  color: '#000',
                  boxShadow: `0 4px 24px ${T.cyan}30`,
                }}
              >
                Enter Your Dashboard &rarr;
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const Route = createFileRoute('/onboarding')({
  component: RapidBioOnboarding,
})
