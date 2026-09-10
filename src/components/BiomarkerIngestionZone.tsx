import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   BIOMARKER INGESTION ZONE — Zero-Friction Lab Upload HUD
   
   Drop a Quest/Labcorp PDF or CSV → AI extracts biomarkers →
   BioVault updates → SomaticBodyMap glows amber for flagged markers →
   System Status suggests peptide/nutritional interventions.
   
   Designed as a collapsible HUD widget that lives in the main view.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceHover: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.12)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  amberBorder: 'rgba(245,158,11,0.25)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  accent: '#00FFCC',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Optimal ranges for client-side status display ── */
const OPTIMAL_RANGES: Record<string, { min: number; max: number; unit: string; label: string }> = {
  'Vitamin D': { min: 50, max: 80, unit: 'ng/mL', label: 'Vitamin D' },
  'CRP': { min: 0, max: 0.5, unit: 'mg/L', label: 'hs-CRP' },
  'HbA1c': { min: 4.0, max: 5.2, unit: '%', label: 'HbA1c' },
  'Testosterone': { min: 600, max: 900, unit: 'ng/dL', label: 'Testosterone' },
  'Ferritin': { min: 40, max: 150, unit: 'ng/mL', label: 'Ferritin' },
  'IGF-1': { min: 150, max: 250, unit: 'ng/mL', label: 'IGF-1' },
  'Glucose': { min: 75, max: 88, unit: 'mg/dL', label: 'Fasting Glucose' },
}

/* ── Intervention map for flagged markers ── */
const INTERVENTIONS: Record<string, { icon: string; protocol: string; color: string }> = {
  vitaminD: { icon: '☀️', protocol: 'Vitamin D3 5000IU + K2 MK-7 200mcg daily with fat-containing meal', color: T.amber },
  crp: { icon: '🧬', protocol: 'BPC-157 250mcg subQ + EPA-dominant omega-3 2g + 24h gut-rest protocol', color: T.red },
  hba1c: { icon: '📊', protocol: 'Berberine 500mg with meals + 16:8 time-restricted feeding window', color: T.amber },
  testosteroneTotal: { icon: '⚡', protocol: 'KSM-66 Ashwagandha 600mg + Tongkat Ali 400mg + optimize sleep >7.5h', color: T.amber },
  testosteroneFree: { icon: '⚡', protocol: 'Boron 10mg daily + reduce SHBG via low-glycemic nutrition', color: T.amber },
  ferritin: { icon: '🩸', protocol: 'Iron bisglycinate 25mg with vitamin C 500mg on empty stomach', color: T.red },
  igf1: { icon: '⚗️', protocol: 'Ipamorelin/CJC-1295 200mcg pre-sleep for GH secretagogue cascade', color: T.blue },
  fastingGlucose: { icon: '📊', protocol: 'Berberine 500mg + chromium picolinate 200mcg + post-meal walks', color: T.amber },
}

/* ── Somatic region mapping for body glow ── */
const MARKER_TO_REGION: Record<string, string> = {
  vitaminD: 'lower_back',
  crp: 'gut',
  hba1c: 'abdomen',
  testosteroneTotal: 'hips',
  testosteroneFree: 'hips',
  ferritin: 'chest',
  igf1: 'shoulders',
  fastingGlucose: 'abdomen',
}

interface ParsedBiomarker {
  name: string
  value: number
  unit: string
  refLow?: number
  refHigh?: number
  status: 'optimal' | 'warning' | 'critical'
  vaultKey?: string
}

interface IngestionResult {
  success: boolean
  error: string | null
  biomarkers: ParsedBiomarker[]
  bioVaultUpdates: Record<string, number>
  somaticUpdates: Array<{ region: string; system: string; severity: number; marker: string; value: number; unit: string }>
  interpretation: string | null
  markersFound?: number
  vaultFieldsUpdated?: number
  somaticRegionsAffected?: number
}

type Phase = 'idle' | 'reading' | 'parsing' | 'ingesting' | 'complete' | 'error'

/* ── PDF text extraction using browser FileReader ── */
async function extractTextFromFile(file: File): Promise<string> {
  if (file.name.endsWith('.csv') || file.type === 'text/csv') {
    return await file.text()
  }
  // For PDF: read as text (works for text-based PDFs)
  // Also try ArrayBuffer approach for binary PDFs
  const text = await file.text()
  // Clean up PDF binary artifacts, extract readable text
  const cleaned = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .trim()
  
  if (cleaned.length < 50) {
    // Fallback: try to extract from PDF stream objects
    const streamMatches = text.match(/stream\s*([\s\S]*?)endstream/g) || []
    const streamText = streamMatches
      .map(s => s.replace(/^stream\s*/, '').replace(/\s*endstream$/, ''))
      .join('\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .trim()
    if (streamText.length > cleaned.length) return streamText
  }
  return cleaned
}

export default function BiomarkerIngestionZone() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const parseAction = useAction(api.labParser.parseAndIngestLabResults)
  const labSummary = useQuery(api.labParser.getLatestLabSummary, { sessionId })

  const [isExpanded, setIsExpanded] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<IngestionResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setPhase('reading')
    setProgress(10)
    setResult(null)
    setErrorMsg('')

    try {
      // Step 1: Extract text
      setProgress(20)
      const rawText = await extractTextFromFile(file)

      if (rawText.length < 30) {
        setPhase('error')
        setErrorMsg('Could not extract text from this file. Try a text-based PDF or CSV export from your lab portal.')
        return
      }

      // Step 2: AI Parse
      setPhase('parsing')
      setProgress(40)

      const aiResult = await parseAction({
        sessionId,
        rawText: rawText.slice(0, 15000),
        fileName: file.name,
      })

      setProgress(80)

      if (!aiResult.success) {
        setPhase('error')
        setErrorMsg(aiResult.error || 'Failed to parse lab results')
        return
      }

      // Step 3: Process results
      setPhase('ingesting')
      setProgress(90)

      const processedMarkers: ParsedBiomarker[] = (aiResult.biomarkers || []).map((bm: any) => {
        const vaultKey = Object.entries(aiResult.bioVaultUpdates || {}).find(
          ([, v]) => v === bm.value
        )?.[0]

        let status: 'optimal' | 'warning' | 'critical' = 'optimal'
        if (bm.refLow !== undefined && bm.refHigh !== undefined) {
          if (bm.value < bm.refLow || bm.value > bm.refHigh) {
            const deviation = bm.value < bm.refLow
              ? (bm.refLow - bm.value) / bm.refLow
              : (bm.value - bm.refHigh) / bm.refHigh
            status = deviation > 0.3 ? 'critical' : 'warning'
          }
        }

        return { ...bm, status, vaultKey }
      })

      setResult({
        ...aiResult,
        biomarkers: processedMarkers,
      } as IngestionResult)

      setPhase('complete')
      setProgress(100)
    } catch (err: any) {
      setPhase('error')
      setErrorMsg(err?.message || 'Unexpected error during ingestion')
    }
  }, [parseAction, sessionId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.csv') || file.name.endsWith('.pdf'))) {
      processFile(file)
    } else {
      setPhase('error')
      setErrorMsg('Please upload a PDF or CSV file')
    }
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setProgress(0)
    setResult(null)
    setFileName('')
    setErrorMsg('')
  }, [])

  const flaggedMarkers = result?.biomarkers.filter(b => b.status !== 'optimal') || []
  const optimalMarkers = result?.biomarkers.filter(b => b.status === 'optimal') || []

  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      {/* ── Collapsed Header — always visible ── */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: labSummary?.flagged
            ? `linear-gradient(135deg, ${T.amberGlow}, rgba(14,14,18,0.92))`
            : T.surface,
          border: `1px solid ${labSummary?.flagged ? T.amberBorder : T.borderBlue}`,
          borderRadius: isExpanded ? '14px 14px 0 0' : 14,
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: labSummary?.flagged
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(59,130,246,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            🧪
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
              color: T.text, letterSpacing: '0.05em',
            }}>
              BIOMARKER INGESTION
            </div>
            <div style={{
              fontSize: 9, fontFamily: 'monospace',
              color: labSummary?.flagged ? T.amber : T.textTer,
              marginTop: 1,
            }}>
              {labSummary
                ? `${labSummary.totalMarkers} markers · ${labSummary.flagged} flagged · ${labSummary.optimal} optimal`
                : 'Upload Quest/Labcorp PDF or CSV'
              }
            </div>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          style={{ fontSize: 12, color: T.textTer }}
        >
          ▾
        </motion.div>
      </motion.button>

      {/* ── Expanded Panel ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: T.surface,
              border: `1px solid ${T.borderBlue}`,
              borderTop: 'none',
              borderRadius: '0 0 14px 14px',
              padding: 16,
            }}>
              {/* ── Upload Zone ── */}
              {(phase === 'idle' || phase === 'error') && (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? T.blue : 'rgba(59,130,246,0.15)'}`,
                      borderRadius: 12,
                      padding: '28px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragOver ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.02)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>
                      {dragOver ? '📥' : '🧬'}
                    </div>
                    <div style={{
                      fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                      color: T.blueBright, letterSpacing: '0.08em',
                      marginBottom: 4,
                    }}>
                      {dragOver ? 'DROP TO INGEST' : 'DROP LAB RESULTS HERE'}
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: 'monospace', color: T.textTer,
                    }}>
                      PDF or CSV from Quest Diagnostics, Labcorp, or any lab portal
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.csv"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {phase === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: 12, padding: '10px 14px',
                        background: 'rgba(255,107,107,0.06)',
                        border: '1px solid rgba(255,107,107,0.15)',
                        borderRadius: 10,
                        fontSize: 10, fontFamily: 'monospace',
                        color: T.red, lineHeight: 1.5,
                      }}
                    >
                      {errorMsg}
                      <button
                        onClick={handleReset}
                        style={{
                          display: 'block', marginTop: 8,
                          fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                          color: T.blueBright, background: 'none', border: 'none',
                          cursor: 'pointer', padding: 0, letterSpacing: '0.05em',
                        }}
                      >
                        ↻ TRY AGAIN
                      </button>
                    </motion.div>
                  )}
                </>
              )}

              {/* ── Processing State ── */}
              {(phase === 'reading' || phase === 'parsing' || phase === 'ingesting') && (
                <div style={{ padding: '20px 0' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginBottom: 16,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: '2px solid rgba(59,130,246,0.1)',
                      borderTopColor: T.blue,
                      animation: 'bio-spin 0.8s linear infinite',
                    }} />
                    <div>
                      <div style={{
                        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                        color: T.blueBright, letterSpacing: '0.08em',
                      }}>
                        {phase === 'reading' && 'EXTRACTING TEXT…'}
                        {phase === 'parsing' && 'AI PARSING BIOMARKERS…'}
                        {phase === 'ingesting' && 'UPDATING BIOVAULT…'}
                      </div>
                      <div style={{
                        fontSize: 9, fontFamily: 'monospace', color: T.textTer,
                        marginTop: 2,
                      }}>
                        {fileName}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 3, borderRadius: 2,
                    background: 'rgba(59,130,246,0.08)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: `linear-gradient(90deg, ${T.blue}, ${T.accent})`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ── Results Display ── */}
              {phase === 'complete' && result && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Summary header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: flaggedMarkers.length > 0 ? T.amberGlow : T.greenGlow,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14,
                      }}>
                        {flaggedMarkers.length > 0 ? '⚠️' : '✅'}
                      </div>
                      <div>
                        <div style={{
                          fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                          color: T.text, letterSpacing: '0.05em',
                        }}>
                          {result.biomarkers.length} MARKERS EXTRACTED
                        </div>
                        <div style={{
                          fontSize: 9, fontFamily: 'monospace',
                          color: flaggedMarkers.length > 0 ? T.amber : T.green,
                        }}>
                          {flaggedMarkers.length} flagged · {optimalMarkers.length} optimal · {result.vaultFieldsUpdated || 0} vault fields updated
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      style={{
                        fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                        color: T.textTer, background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                      }}
                    >
                      ↻ NEW
                    </button>
                  </div>

                  {/* Flagged markers — amber glow cards */}
                  {flaggedMarkers.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{
                        fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                        color: T.amber, letterSpacing: '0.15em',
                        marginBottom: 6, textTransform: 'uppercase',
                      }}>
                        ⚠ FLAGGED — INTERVENTION RECOMMENDED
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {flaggedMarkers.map((bm, i) => {
                          const intervention = bm.vaultKey ? INTERVENTIONS[bm.vaultKey] : null
                          const region = bm.vaultKey ? MARKER_TO_REGION[bm.vaultKey] : null
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08 }}
                              style={{
                                padding: '10px 12px',
                                background: bm.status === 'critical'
                                  ? 'rgba(255,107,107,0.06)'
                                  : 'rgba(245,158,11,0.06)',
                                border: `1px solid ${bm.status === 'critical'
                                  ? 'rgba(255,107,107,0.2)'
                                  : T.amberBorder}`,
                                borderRadius: 10,
                                // Amber glow effect
                                boxShadow: bm.status === 'critical'
                                  ? '0 0 20px rgba(255,107,107,0.08), inset 0 0 20px rgba(255,107,107,0.03)'
                                  : '0 0 20px rgba(245,158,11,0.08), inset 0 0 20px rgba(245,158,11,0.03)',
                              }}
                            >
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                marginBottom: 4,
                              }}>
                                <div style={{
                                  fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                                  color: bm.status === 'critical' ? T.red : T.amber,
                                }}>
                                  {intervention?.icon || '⚠️'} {bm.name}
                                </div>
                                <div style={{
                                  fontSize: 12, fontFamily: 'monospace', fontWeight: 800,
                                  color: bm.status === 'critical' ? T.red : T.amber,
                                }}>
                                  {bm.value} <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.7 }}>{bm.unit}</span>
                                </div>
                              </div>
                              {bm.refLow !== undefined && (
                                <div style={{
                                  fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                                  marginBottom: intervention ? 6 : 0,
                                }}>
                                  Reference: {bm.refLow}–{bm.refHigh} {bm.unit}
                                  {region && <span> · Somatic: {region.replace('_', ' ')}</span>}
                                </div>
                              )}
                              {intervention && (
                                <div style={{
                                  fontSize: 9, fontFamily: 'monospace',
                                  color: T.blueBright, lineHeight: 1.5,
                                  padding: '6px 8px',
                                  background: 'rgba(59,130,246,0.04)',
                                  borderRadius: 6,
                                  borderLeft: `2px solid ${T.blue}`,
                                }}>
                                  <span style={{ fontWeight: 700, fontSize: 8, letterSpacing: '0.1em', color: T.accent }}>
                                    RX:
                                  </span>{' '}
                                  {intervention.protocol}
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Optimal markers — compact list */}
                  {optimalMarkers.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{
                        fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                        color: T.green, letterSpacing: '0.15em',
                        marginBottom: 6, textTransform: 'uppercase',
                      }}>
                        ✓ WITHIN OPTIMAL RANGE
                      </div>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 4,
                      }}>
                        {optimalMarkers.slice(0, 12).map((bm, i) => (
                          <div key={i} style={{
                            padding: '6px 8px',
                            background: 'rgba(0,220,130,0.03)',
                            border: '1px solid rgba(0,220,130,0.08)',
                            borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <div style={{
                              fontSize: 8, fontFamily: 'monospace', color: T.textSec,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: '60%',
                            }}>
                              {bm.name}
                            </div>
                            <div style={{
                              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                              color: T.green,
                            }}>
                              {bm.value}
                            </div>
                          </div>
                        ))}
                        {optimalMarkers.length > 12 && (
                          <div style={{
                            padding: '6px 8px', fontSize: 8, fontFamily: 'monospace',
                            color: T.textTer, textAlign: 'center',
                          }}>
                            +{optimalMarkers.length - 12} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Interpretation */}
                  {result.interpretation && (
                    <div style={{
                      padding: '12px 14px',
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(0,255,204,0.03))',
                      border: `1px solid ${T.borderBlue}`,
                      borderRadius: 10,
                    }}>
                      <div style={{
                        fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                        color: T.accent, letterSpacing: '0.15em',
                        marginBottom: 6, textTransform: 'uppercase',
                      }}>
                        🧠 CLINICAL INTERPRETATION
                      </div>
                      <div style={{
                        fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif',
                        color: T.textSec, lineHeight: 1.6,
                      }}>
                        {result.interpretation}
                      </div>
                    </div>
                  )}

                  {/* Somatic regions affected */}
                  {result.somaticUpdates && result.somaticUpdates.length > 0 && (
                    <div style={{
                      marginTop: 10, padding: '8px 12px',
                      background: 'rgba(245,158,11,0.04)',
                      border: '1px solid rgba(245,158,11,0.1)',
                      borderRadius: 8,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{ fontSize: 14 }}>🫀</div>
                      <div style={{
                        fontSize: 9, fontFamily: 'monospace', color: T.amber,
                        lineHeight: 1.4,
                      }}>
                        <strong>SomaticBodyMap updated:</strong>{' '}
                        {result.somaticUpdates.map(s => s.region.replace('_', ' ')).join(', ')} regions now glowing amber
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes bio-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
