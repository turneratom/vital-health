import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  generateDailyProtocol,
  type ProtocolSupplement,
  type ProtocolIntervention,
} from '../../convex/supplementLogic'
import type { BioVaultData, SystemVitals } from '../../convex/supplementLogic'

/* ═══════════════════════════════════════════════════════════════
   BIO-VAULT MODAL — Medical Dossier Interface
   
   Maps biomarker deficiencies → interventions:
   • Supplements (dose, timing, linked marker)
   • Lifestyle changes (cold plunge, sauna, breathwork)
   • Clinical tests (recommended follow-ups)
   
   Styled as a high-tech classified dossier with:
   • Slide-in from right
   • Scanline overlay
   • Terminal-style headers
   • Color-coded severity tiers
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: 'rgba(6,6,8,0.97)',
  surface: 'rgba(14,14,18,0.92)',
  card: 'rgba(18,18,24,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.15)',
  purple: '#A855F7',
  purpleGlow: 'rgba(168,85,247,0.15)',
  border: 'rgba(255,255,255,0.05)',
}

/* ── Biomarker Definitions ── */

interface BiomarkerDef {
  id: string
  label: string
  icon: string
  unit: string
  optimalRange: string
  optimalLow: number
  optimalHigh: number
  getValue: (vault: any) => number | null
  getStatus: (val: number) => 'optimal' | 'sub-optimal' | 'deficient' | 'critical'
  getInterventions: (val: number, vault: any) => Intervention[]
  clinicalTests: string[]
}

interface Intervention {
  type: 'supplement' | 'lifestyle' | 'clinical'
  name: string
  detail: string
  icon: string
  priority: 'critical' | 'recommended' | 'optional'
  timing?: string
}

const BIOMARKERS: BiomarkerDef[] = [
  {
    id: 'vitaminD',
    label: 'Vitamin D',
    icon: '☀️',
    unit: 'ng/mL',
    optimalRange: '40–60',
    optimalLow: 40,
    optimalHigh: 60,
    getValue: (v) => v?.vitaminD ?? null,
    getStatus: (val) => val >= 40 ? 'optimal' : val >= 30 ? 'sub-optimal' : val >= 20 ? 'deficient' : 'critical',
    getInterventions: (val) => {
      const items: Intervention[] = []
      if (val < 20) {
        items.push({ type: 'supplement', name: 'Vitamin D3 + K2 (High Dose)', detail: '10,000 IU daily with fat-containing meal for 8 weeks, then retest', icon: '💊', priority: 'critical', timing: 'AM · With food' })
        items.push({ type: 'clinical', name: 'Retest in 8 weeks', detail: 'Severe deficiency requires monitoring — recheck 25(OH)D levels', icon: '🔬', priority: 'critical' })
      } else if (val < 30) {
        items.push({ type: 'supplement', name: 'Vitamin D3 + K2', detail: '5,000 IU daily — K2 MK-7 ensures calcium goes to bones, not arteries', icon: '💊', priority: 'recommended', timing: 'AM · With food' })
      } else if (val < 40) {
        items.push({ type: 'supplement', name: 'Vitamin D3 + K2', detail: '2,000–5,000 IU daily to reach optimal 40–60 ng/mL range', icon: '💊', priority: 'recommended', timing: 'AM · With food' })
      }
      items.push({ type: 'lifestyle', name: '15–20 min midday sun exposure', detail: 'UVB exposure on arms/face without sunscreen — most efficient natural D synthesis', icon: '🌤️', priority: 'optional' })
      return items
    },
    clinicalTests: ['25-Hydroxyvitamin D', 'Calcium (serum)', 'PTH (Parathyroid Hormone)'],
  },
  {
    id: 'ferritin',
    label: 'Ferritin',
    icon: '🩸',
    unit: 'ng/mL',
    optimalRange: '50–150',
    optimalLow: 50,
    optimalHigh: 150,
    getValue: (v) => v?.ferritin ?? null,
    getStatus: (val) => val >= 50 && val <= 150 ? 'optimal' : val >= 30 ? 'sub-optimal' : val >= 15 ? 'deficient' : 'critical',
    getInterventions: (val) => {
      const items: Intervention[] = []
      if (val < 20) {
        items.push({ type: 'supplement', name: 'Iron Bisglycinate + Vitamin C', detail: '36mg chelated iron with 500mg Vitamin C on empty stomach — enhances absorption 3×', icon: '💊', priority: 'critical', timing: 'AM · Empty stomach' })
        items.push({ type: 'clinical', name: 'CBC + Iron Panel', detail: 'Rule out iron-deficiency anemia — check hemoglobin, TIBC, transferrin saturation', icon: '🔬', priority: 'critical' })
      } else if (val < 50) {
        items.push({ type: 'supplement', name: 'Iron Bisglycinate + Vitamin C', detail: '18mg chelated iron — bisglycinate form minimizes GI side effects', icon: '💊', priority: 'recommended', timing: 'AM · Empty stomach' })
      }
      items.push({ type: 'lifestyle', name: 'Iron-rich foods with Vitamin C', detail: 'Pair red meat, liver, or spinach with citrus — avoid coffee/tea within 1hr of iron-rich meals', icon: '🥩', priority: 'optional' })
      return items
    },
    clinicalTests: ['Ferritin', 'Serum Iron', 'TIBC', 'Transferrin Saturation', 'CBC'],
  },
  {
    id: 'crp',
    label: 'CRP (Inflammation)',
    icon: '🔥',
    unit: 'mg/L',
    optimalRange: '<1.0',
    optimalLow: 0,
    optimalHigh: 1.0,
    getValue: (v) => v?.crp ?? null,
    getStatus: (val) => val <= 1.0 ? 'optimal' : val <= 2.0 ? 'sub-optimal' : val <= 3.0 ? 'deficient' : 'critical',
    getInterventions: (val) => {
      const items: Intervention[] = []
      if (val > 3.0) {
        items.push({ type: 'supplement', name: 'Omega-3 (High EPA) 4,000mg', detail: 'EPA targets ALOX5 inflammatory cascade — high dose for elevated CRP', icon: '🐟', priority: 'critical', timing: 'AM · With food' })
        items.push({ type: 'supplement', name: 'Curcumin + Piperine 1,000mg', detail: 'Modulates NF-kB transcription factor — dual-pathway with EPA is 3× more effective', icon: '🌿', priority: 'recommended', timing: 'PM · With food' })
        items.push({ type: 'clinical', name: 'hs-CRP + ESR Panel', detail: 'Elevated CRP warrants investigation — rule out chronic infection or autoimmune process', icon: '🔬', priority: 'critical' })
      } else if (val > 1.0) {
        items.push({ type: 'supplement', name: 'Omega-3 (High EPA) 2,000mg', detail: 'EPA resolves inflammation via specialized pro-resolving mediators (SPMs)', icon: '🐟', priority: 'recommended', timing: 'AM · With food' })
      }
      items.push({ type: 'lifestyle', name: 'Cold exposure protocol', detail: '2–3 min cold plunge at 50°F — norepinephrine surge reduces systemic inflammation', icon: '🧊', priority: val > 2.0 ? 'recommended' : 'optional' })
      items.push({ type: 'lifestyle', name: 'Eliminate seed oils & processed sugar', detail: 'Omega-6 excess drives inflammatory prostaglandins — switch to olive oil, avocado oil', icon: '🥑', priority: 'recommended' })
      return items
    },
    clinicalTests: ['hs-CRP', 'ESR', 'IL-6', 'Homocysteine', 'Fibrinogen'],
  },
  {
    id: 'hba1c',
    label: 'HbA1c (Glucose)',
    icon: '🍬',
    unit: '%',
    optimalRange: '<5.4',
    optimalLow: 0,
    optimalHigh: 5.4,
    getValue: (v) => v?.hba1c ?? null,
    getStatus: (val) => val <= 5.4 ? 'optimal' : val <= 5.7 ? 'sub-optimal' : val <= 6.4 ? 'deficient' : 'critical',
    getInterventions: (val) => {
      const items: Intervention[] = []
      if (val > 5.7) {
        items.push({ type: 'supplement', name: 'Berberine HCl 1,500mg (3×500mg)', detail: 'Activates AMPK pathway — comparable to metformin for glucose regulation', icon: '🌿', priority: 'critical', timing: '3× daily · With meals' })
        items.push({ type: 'supplement', name: 'Chromium Picolinate 200mcg', detail: 'Enhances insulin receptor sensitivity — cofactor for glucose transporter GLUT4', icon: '⚙️', priority: 'recommended', timing: 'With meals' })
        items.push({ type: 'clinical', name: 'Fasting Insulin + HOMA-IR', detail: 'Pre-diabetic range — assess insulin resistance with HOMA-IR calculation', icon: '🔬', priority: 'critical' })
      } else if (val > 5.4) {
        items.push({ type: 'supplement', name: 'Berberine HCl 500mg', detail: 'Mild glucose dysregulation — berberine activates AMPK for metabolic optimization', icon: '🌿', priority: 'recommended', timing: 'PM · With dinner' })
      }
      items.push({ type: 'lifestyle', name: '15-min post-meal walk', detail: 'Walking within 30 min of eating reduces glucose spike by 30–50% — most impactful single habit', icon: '🚶', priority: val > 5.4 ? 'recommended' : 'optional' })
      items.push({ type: 'lifestyle', name: 'CGM monitoring (2 weeks)', detail: 'Continuous glucose monitor reveals personal glycemic responses to specific foods', icon: '📊', priority: 'optional' })
      return items
    },
    clinicalTests: ['HbA1c', 'Fasting Glucose', 'Fasting Insulin', 'HOMA-IR', 'C-Peptide'],
  },
  {
    id: 'testosterone',
    label: 'Testosterone',
    icon: '💪',
    unit: 'ng/dL',
    optimalRange: '500–900',
    optimalLow: 500,
    optimalHigh: 900,
    getValue: (v) => v?.testosteroneTotal ?? null,
    getStatus: (val) => val >= 500 ? 'optimal' : val >= 350 ? 'sub-optimal' : val >= 200 ? 'deficient' : 'critical',
    getInterventions: (val, vault) => {
      const items: Intervention[] = []
      if (val < 350) {
        items.push({ type: 'supplement', name: 'Tongkat Ali (Eurycoma) 400mg', detail: 'Modulates SHBG binding — increases free testosterone by reducing sex hormone binding', icon: '💪', priority: 'critical', timing: 'AM · Empty stomach' })
        items.push({ type: 'supplement', name: 'Zinc Picolinate 30mg', detail: 'Essential cofactor for testosterone synthesis via 5α-reductase pathway', icon: '🛡️', priority: 'recommended', timing: 'PM · With dinner' })
        items.push({ type: 'clinical', name: 'Full Hormone Panel', detail: 'Check Free T, SHBG, LH, FSH, Estradiol, Prolactin — identify root cause', icon: '🔬', priority: 'critical' })
      } else if (val < 500) {
        items.push({ type: 'supplement', name: 'Tongkat Ali 400mg', detail: 'Supports endogenous production via AR gene modulation', icon: '💪', priority: 'recommended', timing: 'AM · Empty stomach' })
        items.push({ type: 'supplement', name: 'Zinc Picolinate 30mg', detail: 'Cofactor for testosterone synthesis and immune function', icon: '🛡️', priority: 'optional', timing: 'PM' })
      }
      items.push({ type: 'lifestyle', name: 'Resistance training 3–4×/week', detail: 'Compound lifts (squat, deadlift, bench) trigger acute testosterone release — most potent natural stimulus', icon: '🏋️', priority: 'recommended' })
      items.push({ type: 'lifestyle', name: '7–9 hours sleep', detail: 'Testosterone synthesized during deep sleep — each hour below 7h reduces T by ~15%', icon: '😴', priority: 'recommended' })
      return items
    },
    clinicalTests: ['Total Testosterone', 'Free Testosterone', 'SHBG', 'LH', 'FSH', 'Estradiol'],
  },
  {
    id: 'sleep',
    label: 'Sleep Quality',
    icon: '🌙',
    unit: 'score',
    optimalRange: '80–100',
    optimalLow: 80,
    optimalHigh: 100,
    getValue: (v) => v?.sleepScore ?? null,
    getStatus: (val) => val >= 80 ? 'optimal' : val >= 65 ? 'sub-optimal' : val >= 50 ? 'deficient' : 'critical',
    getInterventions: (val) => {
      const items: Intervention[] = []
      if (val < 50) {
        items.push({ type: 'supplement', name: 'Magnesium L-Threonate 400mg', detail: 'Crosses BBB via TRPM7 channels — restores synaptic magnesium for deep sleep architecture', icon: '🧲', priority: 'critical', timing: 'PM · 1hr before bed' })
        items.push({ type: 'supplement', name: 'Apigenin 50mg + Glycine 3g', detail: 'Apigenin activates GABA receptors, Glycine lowers core temp 0.5°C for sleep onset', icon: '🌙', priority: 'critical', timing: 'PM · 30min before bed' })
      } else if (val < 65) {
        items.push({ type: 'supplement', name: 'Magnesium Glycinate 300mg', detail: 'Muscle relaxation and parasympathetic activation for improved sleep quality', icon: '🧲', priority: 'recommended', timing: 'PM · Before bed' })
      }
      items.push({ type: 'lifestyle', name: 'NSDR / Yoga Nidra (20 min)', detail: 'Non-sleep deep rest replenishes dopamine reserves and restores focus without caffeine', icon: '🧘', priority: val < 65 ? 'recommended' : 'optional' })
      items.push({ type: 'lifestyle', name: 'Room temp 65–67°F, blackout curtains', detail: 'Core body temperature drop is the #1 trigger for melatonin release and sleep onset', icon: '❄️', priority: 'recommended' })
      return items
    },
    clinicalTests: ['Sleep Study (Polysomnography)', 'Cortisol Awakening Response', 'Melatonin (salivary)'],
  },
  {
    id: 'hrv',
    label: 'HRV (Recovery)',
    icon: '💓',
    unit: 'ms',
    optimalRange: '>60',
    optimalLow: 60,
    optimalHigh: 120,
    getValue: (v) => v?.hrvCurrent ?? null,
    getStatus: (val) => val >= 60 ? 'optimal' : val >= 45 ? 'sub-optimal' : val >= 30 ? 'deficient' : 'critical',
    getInterventions: (val) => {
      const items: Intervention[] = []
      if (val < 30) {
        items.push({ type: 'supplement', name: 'Magnesium L-Threonate 400mg', detail: 'HRV critically low — Mg-Threonate supports parasympathetic nervous system recovery', icon: '🧲', priority: 'critical', timing: 'PM · Before bed' })
        items.push({ type: 'supplement', name: 'Ashwagandha KSM-66 600mg', detail: 'Modulates cortisol via 11β-HSD1 enzyme — reduces catabolic stress response', icon: '🧘', priority: 'critical', timing: 'PM · With dinner' })
      } else if (val < 45) {
        items.push({ type: 'supplement', name: 'Ashwagandha KSM-66 600mg', detail: 'Adaptogenic support for HRV recovery — reduces cortisol by 23% in clinical trials', icon: '🧘', priority: 'recommended', timing: 'PM · With dinner' })
      }
      items.push({ type: 'lifestyle', name: 'Box Breathing (4-4-4-4) × 5 min', detail: 'Activates vagal tone — immediate parasympathetic shift measurable on HRV within 2 min', icon: '🌬️', priority: val < 45 ? 'recommended' : 'optional' })
      items.push({ type: 'lifestyle', name: 'Cold face immersion (30 sec)', detail: 'Triggers mammalian dive reflex — instant vagal activation and HRV boost', icon: '🧊', priority: 'optional' })
      return items
    },
    clinicalTests: ['Cortisol (AM/PM)', 'DHEA-S', 'Thyroid Panel (TSH, Free T3/T4)'],
  },
]

const STATUS_COLORS: Record<string, { color: string; glow: string; bg: string; label: string }> = {
  optimal:       { color: T.teal,  glow: T.tealGlow,  bg: 'rgba(0,255,204,0.06)',   label: 'OPTIMAL' },
  'sub-optimal': { color: T.amber, glow: T.amberGlow,  bg: 'rgba(245,158,11,0.06)',  label: 'SUB-OPTIMAL' },
  deficient:     { color: '#E8976C', glow: 'rgba(232,151,108,0.15)', bg: 'rgba(232,151,108,0.06)', label: 'DEFICIENT' },
  critical:      { color: T.red,   glow: T.redGlow,    bg: 'rgba(255,107,107,0.06)', label: 'CRITICAL' },
}

const PRIORITY_COLORS: Record<string, { color: string; bg: string }> = {
  critical:    { color: T.red,   bg: T.redGlow },
  recommended: { color: T.amber, bg: T.amberGlow },
  optional:    { color: T.textSec, bg: 'rgba(255,255,255,0.04)' },
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  supplement: { label: 'SUPPLEMENT', color: T.teal },
  lifestyle:  { label: 'LIFESTYLE',  color: T.green },
  clinical:   { label: 'CLINICAL',   color: T.purple },
}

function getSessionId(): string {
  try { return localStorage.getItem('vive-session-id') || 'guest-user' } catch { return 'guest-user' }
}

/* ── Main Component ── */

interface BioVaultModalProps {
  isOpen: boolean
  onClose: () => void
  initialMarkerId?: string | null
}

export default function BioVaultModal({ isOpen, onClose, initialMarkerId }: BioVaultModalProps) {
  const sessionId = useMemo(() => getSessionId(), [])
  const [selectedMarker, setSelectedMarker] = useState<string | null>(initialMarkerId ?? null)

  const bioVault = useQuery(api.queries.getBioVaultBySession, isOpen ? { sessionId } : 'skip')

  // Reset selected marker when initialMarkerId changes
  useMemo(() => {
    if (initialMarkerId) setSelectedMarker(initialMarkerId)
  }, [initialMarkerId])

  const markerData = useMemo(() => {
    if (!bioVault) return []
    return BIOMARKERS.map(bm => {
      const val = bm.getValue(bioVault)
      const status = val !== null ? bm.getStatus(val) : null
      const interventions = val !== null ? bm.getInterventions(val, bioVault) : []
      return { ...bm, value: val, status, interventions }
    })
  }, [bioVault])

  const activeMarker = useMemo(() => {
    return markerData.find(m => m.id === selectedMarker) ?? null
  }, [markerData, selectedMarker])

  const deficientCount = markerData.filter(m => m.status && m.status !== 'optimal').length
  const criticalCount = markerData.filter(m => m.status === 'critical').length

  const handleClose = useCallback(() => {
    setSelectedMarker(null)
    onClose()
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10003,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'flex-end',
          }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%', maxWidth: 420, height: '100%',
              background: T.bg,
              borderLeft: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden', position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Scanline */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,204,0.01) 3px, rgba(0,255,204,0.01) 6px)',
            }} />

            {/* Header */}
            <div style={{
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${T.border}`, position: 'relative', zIndex: 1,
            }}>
              <div>
                <div style={{
                  fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                  color: T.purple, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 2,
                }}>
                  CLASSIFIED // BIO-VAULT DOSSIER
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
                    Biomarker Intelligence
                  </span>
                  {deficientCount > 0 && (
                    <span style={{
                      fontSize: 8, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                      color: criticalCount > 0 ? T.red : T.amber,
                      padding: '2px 6px', borderRadius: 4,
                      background: criticalCount > 0 ? T.redGlow : T.amberGlow,
                      letterSpacing: '0.08em',
                    }}>
                      {deficientCount} FLAG{deficientCount > 1 ? 'S' : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  color: T.textSec, fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{
              flex: 1, overflow: 'auto', position: 'relative', zIndex: 1,
              padding: '16px 16px 24px',
            }}>
              {/* ── Marker Grid (when no marker selected) ── */}
              <AnimatePresence mode="wait">
                {!activeMarker ? (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div style={{
                      fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                      color: T.textTer, letterSpacing: '0.15em', marginBottom: 12,
                    }}>
                      SELECT BIOMARKER FOR INTERVENTION MAP
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {markerData.map((m, i) => {
                        const sc = m.status ? STATUS_COLORS[m.status] : null
                        return (
                          <motion.button
                            key={m.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => setSelectedMarker(m.id)}
                            style={{
                              width: '100%', padding: '14px 16px', borderRadius: 14,
                              background: sc ? sc.bg : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${sc ? `${sc.color}20` : T.border}`,
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', textAlign: 'left',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 22 }}>{m.icon}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.label}</div>
                                <div style={{
                                  fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
                                  color: T.textSec, marginTop: 2,
                                }}>
                                  {m.value !== null ? `${m.value} ${m.unit}` : 'No data'} · Optimal: {m.optimalRange} {m.unit}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {sc && (
                                <span style={{
                                  fontSize: 7, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                                  color: sc.color, padding: '2px 6px', borderRadius: 4,
                                  background: sc.bg, border: `1px solid ${sc.color}20`,
                                  letterSpacing: '0.1em',
                                }}>
                                  {sc.label}
                                </span>
                              )}
                              <span style={{ fontSize: 12, color: T.textTer }}>›</span>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* No data state */}
                    {markerData.every(m => m.value === null) && (
                      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🧬</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                          No Biomarker Data
                        </div>
                        <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.6 }}>
                          Upload lab results via the Biomarker Ingestion zone to unlock personalized intervention mapping.
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  /* ── Marker Detail View ── */
                  <motion.div
                    key={`detail-${activeMarker.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Back button */}
                    <button
                      onClick={() => setSelectedMarker(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 10, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
                        color: T.purple, background: 'none', border: 'none',
                        cursor: 'pointer', padding: '4px 0', marginBottom: 16,
                        letterSpacing: '0.08em',
                      }}
                    >
                      ‹ ALL BIOMARKERS
                    </button>

                    {/* Marker Header Card */}
                    {(() => {
                      const sc = activeMarker.status ? STATUS_COLORS[activeMarker.status] : STATUS_COLORS.optimal
                      return (
                        <div style={{
                          padding: '20px', borderRadius: 16,
                          background: sc.bg, border: `1px solid ${sc.color}20`,
                          marginBottom: 20, position: 'relative', overflow: 'hidden',
                        }}>
                          <div style={{
                            position: 'absolute', top: -20, right: -20, width: 100, height: 100,
                            borderRadius: '50%', background: `${sc.color}08`, filter: 'blur(30px)',
                            pointerEvents: 'none',
                          }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <span style={{ fontSize: 32 }}>{activeMarker.icon}</span>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{activeMarker.label}</div>
                              <span style={{
                                fontSize: 8, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                                color: sc.color, padding: '2px 8px', borderRadius: 4,
                                background: `${sc.color}15`, letterSpacing: '0.12em',
                              }}>
                                {sc.label}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 24 }}>
                            <div>
                              <div style={{
                                fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
                                color: T.textTer, letterSpacing: '0.1em', marginBottom: 4,
                              }}>
                                CURRENT
                              </div>
                              <div style={{
                                fontSize: 28, fontWeight: 800, fontFamily: '"JetBrains Mono", monospace',
                                color: sc.color, lineHeight: 1,
                              }}>
                                {activeMarker.value !== null ? activeMarker.value : '—'}
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginLeft: 4 }}>
                                  {activeMarker.unit}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div style={{
                                fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
                                color: T.textTer, letterSpacing: '0.1em', marginBottom: 4,
                              }}>
                                OPTIMAL
                              </div>
                              <div style={{
                                fontSize: 28, fontWeight: 800, fontFamily: '"JetBrains Mono", monospace',
                                color: T.teal, lineHeight: 1, opacity: 0.6,
                              }}>
                                {activeMarker.optimalRange}
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginLeft: 4 }}>
                                  {activeMarker.unit}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Interventions */}
                    {activeMarker.interventions.length > 0 && (
                      <>
                        <div style={{
                          fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                          color: T.textTer, letterSpacing: '0.15em', marginBottom: 10,
                        }}>
                          RECOMMENDED INTERVENTIONS ({activeMarker.interventions.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                          {activeMarker.interventions.map((intv, i) => {
                            const pc = PRIORITY_COLORS[intv.priority]
                            const tl = TYPE_LABELS[intv.type]
                            return (
                              <motion.div
                                key={`${intv.name}-${i}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                style={{
                                  padding: '14px 16px', borderRadius: 14,
                                  background: T.card,
                                  border: `1px solid ${T.border}`,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 18 }}>{intv.icon}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{intv.name}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <span style={{
                                      fontSize: 7, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                                      color: tl.color, padding: '2px 5px', borderRadius: 3,
                                      background: `${tl.color}15`, letterSpacing: '0.08em',
                                    }}>
                                      {tl.label}
                                    </span>
                                    <span style={{
                                      fontSize: 7, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                                      color: pc.color, padding: '2px 5px', borderRadius: 3,
                                      background: pc.bg, letterSpacing: '0.08em',
                                    }}>
                                      {intv.priority.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: 11, color: T.textSec, lineHeight: 1.6,
                                }}>
                                  {intv.detail}
                                </div>
                                {intv.timing && (
                                  <div style={{
                                    marginTop: 8, fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
                                    color: T.teal, letterSpacing: '0.06em',
                                    padding: '3px 8px', borderRadius: 6,
                                    background: 'rgba(0,255,204,0.06)',
                                    display: 'inline-block',
                                  }}>
                                    ⏱ {intv.timing}
                                  </div>
                                )}
                              </motion.div>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {/* Clinical Tests */}
                    <div style={{
                      fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                      color: T.textTer, letterSpacing: '0.15em', marginBottom: 10,
                    }}>
                      RECOMMENDED CLINICAL TESTS
                    </div>
                    <div style={{
                      padding: '14px 16px', borderRadius: 14,
                      background: 'rgba(168,85,247,0.04)',
                      border: `1px solid rgba(168,85,247,0.12)`,
                    }}>
                      {activeMarker.clinicalTests.map((test, i) => (
                        <div key={test} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 0',
                          borderBottom: i < activeMarker.clinicalTests.length - 1 ? `1px solid ${T.border}` : 'none',
                        }}>
                          <div style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: T.purple, boxShadow: `0 0 6px ${T.purpleGlow}`,
                          }} />
                          <span style={{
                            fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
                            color: T.text, fontWeight: 500,
                          }}>
                            {test}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 20px', borderTop: `1px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'relative', zIndex: 1,
            }}>
              <span style={{
                fontSize: 8, fontFamily: '"JetBrains Mono", monospace',
                color: T.textTer, letterSpacing: '0.12em',
              }}>
                VIVE 4.0 // BIO-VAULT INTELLIGENCE
              </span>
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: T.purple,
                  boxShadow: `0 0 8px ${T.purpleGlow}`,
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
