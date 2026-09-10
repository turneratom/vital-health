import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   BIOMARKER INGESTION — HUD Upload + Somatic Body Glow
   
   Upload Quest/Labcorp PDF or CSV → AI parses Vitamin D, CRP,
   HbA1c, Testosterone → Maps to SomaticBodyMap regions →
   Out-of-range markers glow amber on the 3D body silhouette →
   System Status updates with specific intervention protocols.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
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
  amberBright: '#FBBF24',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  accent: '#00FFCC',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Somatic body region coordinates for SVG silhouette ── */
const BODY_REGIONS: Record<string, { cx: number; cy: number; rx: number; ry: number; label: string }> = {
  head:        { cx: 100, cy: 28,  rx: 16, ry: 18, label: 'Head' },
  shoulders:   { cx: 100, cy: 72,  rx: 38, ry: 12, label: 'Shoulders' },
  chest:       { cx: 100, cy: 100, rx: 28, ry: 18, label: 'Chest' },
  abdomen:     { cx: 100, cy: 138, rx: 24, ry: 18, label: 'Abdomen' },
  gut:         { cx: 100, cy: 165, rx: 22, ry: 14, label: 'Gut' },
  hips:        { cx: 100, cy: 190, rx: 28, ry: 14, label: 'Hips' },
  lower_back:  { cx: 100, cy: 155, rx: 20, ry: 16, label: 'Lower Back' },
  upper_legs:  { cx: 100, cy: 225, rx: 22, ry: 22, label: 'Upper Legs' },
  lower_legs:  { cx: 100, cy: 275, rx: 16, ry: 22, label: 'Lower Legs' },
}

/* ── Marker → region + intervention mapping ── */
const MARKER_MAP: Record<string, {
  region: string
  system: string
  intervention: { icon: string; protocol: string }
}> = {
  vitaminD:         { region: 'lower_back', system: 'Musculoskeletal', intervention: { icon: '☀️', protocol: 'Vitamin D3 5000IU + K2 MK-7 200mcg daily with fat-containing meal' } },
  crp:              { region: 'gut',        system: 'Inflammatory',    intervention: { icon: '🧬', protocol: 'Inflammation elevated: BPC-157 250mcg subQ + Omega-3 EPA 2g + 24h gut-rest protocol' } },
  hba1c:            { region: 'abdomen',    system: 'Metabolic',       intervention: { icon: '📊', protocol: 'Metabolic drift: Berberine 500mg with meals + 16:8 time-restricted feeding' } },
  fastingGlucose:   { region: 'abdomen',    system: 'Metabolic',       intervention: { icon: '📊', protocol: 'Glucose elevated: Berberine 500mg + chromium picolinate 200mcg + post-meal walks' } },
  testosteroneTotal:{ region: 'hips',       system: 'Hormonal',        intervention: { icon: '⚡', protocol: 'Hormonal support: KSM-66 Ashwagandha 600mg + Tongkat Ali 400mg + sleep >7.5h' } },
  testosteroneFree: { region: 'hips',       system: 'Hormonal',        intervention: { icon: '⚡', protocol: 'Free T low: Boron 10mg daily + reduce SHBG via low-glycemic nutrition' } },
  ferritin:         { region: 'chest',      system: 'Hematologic',     intervention: { icon: '🩸', protocol: 'Iron stores low: Iron bisglycinate 25mg + Vitamin C 500mg on empty stomach' } },
  igf1:             { region: 'shoulders',  system: 'Hormonal',        intervention: { icon: '⚗️', protocol: 'GH axis: Ipamorelin/CJC-1295 200mcg pre-sleep for secretagogue cascade' } },
}

/* ── Optimal ranges for status classification ── */
const OPTIMAL: Record<string, { min: number; max: number; critLow?: number; critHigh?: number }> = {
  vitaminD:         { min: 50, max: 80, critLow: 20 },
  crp:              { min: 0, max: 0.5, critHigh: 3.0 },
  hba1c:            { min: 4.0, max: 5.2, critHigh: 5.7 },
  fastingGlucose:   { min: 75, max: 88, critHigh: 110 },
  testosteroneTotal:{ min: 600, max: 900, critLow: 250 },
  testosteroneFree: { min: 15, max: 25, critLow: 8 },
  ferritin:         { min: 40, max: 150, critLow: 12, critHigh: 300 },
  igf1:             { min: 150, max: 250 },
}

function getStatus(key: string, value: number): 'optimal' | 'warning' | 'critical' {
  const r = OPTIMAL[key]
  if (!r) return 'optimal'
  if (value >= r.min && value <= r.max) return 'optimal'
  if ((r.critLow !== undefined && value <= r.critLow) || (r.critHigh !== undefined && value >= r.critHigh)) return 'critical'
  return 'warning'
}

type Phase = 'idle' | 'reading' | 'parsing' | 'mapping' | 'complete' | 'error'

interface FlaggedRegion {
  region: string
  marker: string
  vaultKey: string
  value: number
  unit: string
  status: 'warning' | 'critical'
  intervention: { icon: string; protocol: string }
}

/* ── Extract text from PDF/CSV ── */
async function extractText(file: File): Promise<string> {
  if (file.name.endsWith('.csv') || file.type === 'text/csv') return file.text()
  const raw = await file.text()
  const cleaned = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .trim()
  if (cleaned.length < 50) {
    const streams = raw.match(/stream\s*([\s\S]*?)endstream/g) || []
    const streamText = streams
      .map(s => s.replace(/^stream\s*/, '').replace(/\s*endstream$/, ''))
      .join('\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .trim()
    if (streamText.length > cleaned.length) return streamText
  }
  return cleaned
}

export default function BiomarkerIngestion() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const parseAction = useAction(api.labParser.parseAndIngestLabResults)
  const labSummary = useQuery(api.labParser.getLatestLabSummary, { sessionId })

  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [flaggedRegions, setFlaggedRegions] = useState<FlaggedRegion[]>([])
  const [allMarkers, setAllMarkers] = useState<Array<{ name: string; value: number; unit: string; status: string }>>([])
  const [interpretation, setInterpretation] = useState<string | null>(null)
  const [systemStatusLine, setSystemStatusLine] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Pulse animation for amber glow regions
  const [pulsePhase, setPulsePhase] = useState(0)
  useEffect(() => {
    if (flaggedRegions.length === 0) return
    const iv = setInterval(() => setPulsePhase(p => (p + 1) % 60), 50)
    return () => clearInterval(iv)
  }, [flaggedRegions.length])

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setPhase('reading')
    setProgress(15)
    setFlaggedRegions([])
    setAllMarkers([])
    setInterpretation(null)
    setSystemStatusLine(null)
    setErrorMsg('')

    try {
      const rawText = await extractText(file)
      if (rawText.length < 30) {
        setPhase('error')
        setErrorMsg('Could not extract text. Try a text-based PDF or CSV export from your lab portal.')
        return
      }

      setPhase('parsing')
      setProgress(40)

      const result = await parseAction({
        sessionId,
        rawText: rawText.slice(0, 15000),
        fileName: file.name,
      })

      if (!result.success) {
        setPhase('error')
        setErrorMsg(result.error || 'Failed to parse lab results')
        return
      }

      setPhase('mapping')
      setProgress(80)

      // Map biomarkers to flagged regions
      const flagged: FlaggedRegion[] = []
      const markers: Array<{ name: string; value: number; unit: string; status: string }> = []
      const vaultUpdates = (result.bioVaultUpdates || {}) as Record<string, number>

      for (const bm of (result.biomarkers || [])) {
        // Find vault key for this biomarker
        let vaultKey: string | null = null
        for (const [k, v] of Object.entries(vaultUpdates)) {
          if (v === bm.value) { vaultKey = k; break }
        }

        const status = vaultKey ? getStatus(vaultKey, bm.value) : 'optimal'
        markers.push({ name: bm.name, value: bm.value, unit: bm.unit, status })

        if (vaultKey && status !== 'optimal' && MARKER_MAP[vaultKey]) {
          const mapping = MARKER_MAP[vaultKey]
          flagged.push({
            region: mapping.region,
            marker: bm.name,
            vaultKey,
            value: bm.value,
            unit: bm.unit,
            status,
            intervention: mapping.intervention,
          })
        }
      }

      setFlaggedRegions(flagged)
      setAllMarkers(markers)
      setInterpretation(result.interpretation || null)

      // Generate System Status line from flagged markers
      if (flagged.length > 0) {
        const topFlag = flagged.sort((a, b) => (a.status === 'critical' ? 0 : 1) - (b.status === 'critical' ? 0 : 1))[0]
        setSystemStatusLine(topFlag.intervention.protocol)
      } else {
        setSystemStatusLine('All key longevity markers within optimal range. Protocol adherence confirmed.')
      }

      setProgress(100)
      setPhase('complete')
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

  const handleReset = useCallback(() => {
    setPhase('idle')
    setProgress(0)
    setFlaggedRegions([])
    setAllMarkers([])
    setInterpretation(null)
    setSystemStatusLine(null)
    setFileName('')
    setErrorMsg('')
  }, [])

  const optimalCount = allMarkers.filter(m => m.status === 'optimal').length
  const flaggedCount = allMarkers.filter(m => m.status !== 'optimal').length

  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      {/* ── Collapsed Trigger Bar ── */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: flaggedRegions.length > 0
            ? `linear-gradient(135deg, ${T.amberGlow}, ${T.surface})`
            : T.surface,
          border: `1px solid ${flaggedRegions.length > 0 ? 'rgba(245,158,11,0.2)' : T.borderBlue}`,
          borderRadius: isOpen ? '12px 12px 0 0' : 12,
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: flaggedRegions.length > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>
            {flaggedRegions.length > 0 ? '⚠️' : '🧬'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              color: T.text, letterSpacing: '0.06em',
            }}>
              LAB INGESTION
            </div>
            <div style={{
              fontSize: 8, fontFamily: 'monospace',
              color: flaggedRegions.length > 0 ? T.amber : T.textTer,
              marginTop: 1,
            }}>
              {labSummary
                ? `${labSummary.totalMarkers} markers tracked · ${labSummary.flagged} flagged`
                : 'Upload PDF/CSV → Auto-map to SomaticBody'
              }
            </div>
          </div>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} style={{ fontSize: 11, color: T.textTer }}>▾</motion.div>
      </motion.button>

      {/* ── Expanded Panel ── */}
      <AnimatePresence>
        {isOpen && (
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
              borderRadius: '0 0 12px 12px',
              padding: 14,
            }}>
              {/* ── IDLE: Upload Zone ── */}
              {(phase === 'idle' || phase === 'error') && (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? T.blue : 'rgba(59,130,246,0.12)'}`,
                      borderRadius: 10,
                      padding: '24px 14px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragOver ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.02)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{dragOver ? '📥' : '🧪'}</div>
                    <div style={{
                      fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                      color: T.blueBright, letterSpacing: '0.08em', marginBottom: 3,
                    }}>
                      {dragOver ? 'DROP TO INGEST' : 'DROP LAB RESULTS'}
                    </div>
                    <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
                      Quest · Labcorp · Any lab PDF or CSV
                    </div>
                    <div style={{
                      marginTop: 8, fontSize: 7, fontFamily: 'monospace',
                      color: 'rgba(59,130,246,0.5)', letterSpacing: '0.1em',
                    }}>
                      VITAMIN D · CRP · HbA1c · TESTOSTERONE · FERRITIN · IGF-1
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf,.csv" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) processFile(f)
                    }} style={{ display: 'none' }} />
                  </div>
                  {phase === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: 10, padding: '8px 12px',
                        background: 'rgba(255,107,107,0.05)',
                        border: '1px solid rgba(255,107,107,0.12)',
                        borderRadius: 8, fontSize: 9, fontFamily: 'monospace',
                        color: T.red, lineHeight: 1.5,
                      }}
                    >
                      {errorMsg}
                      <button onClick={handleReset} style={{
                        display: 'block', marginTop: 6, fontSize: 8, fontFamily: 'monospace',
                        fontWeight: 700, color: T.blueBright, background: 'none', border: 'none',
                        cursor: 'pointer', padding: 0,
                      }}>↻ TRY AGAIN</button>
                    </motion.div>
                  )}
                </>
              )}

              {/* ── PROCESSING ── */}
              {(phase === 'reading' || phase === 'parsing' || phase === 'mapping') && (
                <div style={{ padding: '16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '2px solid rgba(59,130,246,0.08)',
                      borderTopColor: T.blue,
                      animation: 'bi-spin 0.8s linear infinite',
                    }} />
                    <div>
                      <div style={{
                        fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                        color: T.blueBright, letterSpacing: '0.08em',
                      }}>
                        {phase === 'reading' && 'EXTRACTING TEXT…'}
                        {phase === 'parsing' && 'AI PARSING BIOMARKERS…'}
                        {phase === 'mapping' && 'MAPPING TO SOMATIC BODY…'}
                      </div>
                      <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, marginTop: 1 }}>
                        {fileName}
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(59,130,246,0.06)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4 }}
                      style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${T.blue}, ${T.accent})` }}
                    />
                  </div>
                </div>
              )}

              {/* ── COMPLETE: Body Map + Results ── */}
              {phase === 'complete' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                  {/* Summary bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 7,
                        background: flaggedCount > 0 ? T.amberGlow : T.greenGlow,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13,
                      }}>
                        {flaggedCount > 0 ? '⚠️' : '✅'}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: T.text }}>
                          {allMarkers.length} MARKERS EXTRACTED
                        </div>
                        <div style={{
                          fontSize: 8, fontFamily: 'monospace',
                          color: flaggedCount > 0 ? T.amber : T.green,
                        }}>
                          {flaggedCount} flagged · {optimalCount} optimal
                        </div>
                      </div>
                    </div>
                    <button onClick={handleReset} style={{
                      fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                      color: T.textTer, background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    }}>↻ NEW</button>
                  </div>

                  {/* ── 3D Body Silhouette with Amber Glow ── */}
                  {flaggedRegions.length > 0 && (
                    <div style={{
                      position: 'relative',
                      background: 'rgba(10,10,14,0.6)',
                      border: '1px solid rgba(245,158,11,0.08)',
                      borderRadius: 12,
                      padding: '12px 8px',
                      marginBottom: 12,
                      overflow: 'hidden',
                    }}>
                      {/* Ambient amber glow background */}
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.04) 0%, transparent 70%)',
                      }} />

                      <div style={{
                        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                        color: T.amber, letterSpacing: '0.15em',
                        textTransform: 'uppercase', textAlign: 'center',
                        marginBottom: 8,
                      }}>
                        SOMATIC BODY MAP — {flaggedRegions.length} REGION{flaggedRegions.length > 1 ? 'S' : ''} FLAGGED
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {/* SVG Body Silhouette */}
                        <svg viewBox="0 0 200 310" style={{ width: 120, height: 186, flexShrink: 0 }}>
                          {/* Body outline — minimal human silhouette */}
                          <defs>
                            {flaggedRegions.map((fr, i) => {
                              const region = BODY_REGIONS[fr.region]
                              if (!region) return null
                              const isC = fr.status === 'critical'
                              return (
                                <radialGradient key={`glow-${i}`} id={`amber-glow-${i}`} cx="50%" cy="50%" r="50%">
                                  <stop offset="0%" stopColor={isC ? 'rgba(255,107,107,0.5)' : 'rgba(245,158,11,0.5)'} />
                                  <stop offset="50%" stopColor={isC ? 'rgba(255,107,107,0.2)' : 'rgba(245,158,11,0.2)'} />
                                  <stop offset="100%" stopColor="transparent" />
                                </radialGradient>
                              )
                            })}
                          </defs>

                          {/* Body silhouette path */}
                          <path
                            d="M100 10 C88 10 80 20 80 32 C80 44 88 52 100 52 C112 52 120 44 120 32 C120 20 112 10 100 10 Z
                               M100 55 L100 58 M72 72 L60 110 L66 112 L80 80 M128 72 L140 110 L134 112 L120 80
                               M80 65 C75 65 68 70 68 78 L68 130 C68 138 72 142 80 142 L120 142 C128 142 132 138 132 130 L132 78 C132 70 125 65 120 65 Z
                               M80 142 L78 190 L72 240 L68 290 L80 292 L88 250 L100 195 L112 250 L120 292 L132 290 L128 240 L122 190 L120 142"
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Baseline body fill — very subtle */}
                          <ellipse cx="100" cy="32" rx="18" ry="20" fill="rgba(59,130,246,0.03)" />
                          <ellipse cx="100" cy="105" rx="30" ry="35" fill="rgba(59,130,246,0.02)" />
                          <ellipse cx="100" cy="170" rx="24" ry="25" fill="rgba(59,130,246,0.02)" />

                          {/* Amber glow regions for flagged markers */}
                          {flaggedRegions.map((fr, i) => {
                            const region = BODY_REGIONS[fr.region]
                            if (!region) return null
                            const pulseOpacity = 0.4 + 0.3 * Math.sin((pulsePhase + i * 10) * 0.1)
                            const isC = fr.status === 'critical'
                            return (
                              <g key={`region-${i}`}>
                                {/* Outer glow */}
                                <ellipse
                                  cx={region.cx} cy={region.cy}
                                  rx={region.rx * 1.8} ry={region.ry * 1.8}
                                  fill={`url(#amber-glow-${i})`}
                                  opacity={pulseOpacity * 0.6}
                                />
                                {/* Inner glow */}
                                <ellipse
                                  cx={region.cx} cy={region.cy}
                                  rx={region.rx} ry={region.ry}
                                  fill={isC ? 'rgba(255,107,107,0.25)' : 'rgba(245,158,11,0.25)'}
                                  stroke={isC ? 'rgba(255,107,107,0.4)' : 'rgba(245,158,11,0.4)'}
                                  strokeWidth="1"
                                  opacity={pulseOpacity}
                                />
                                {/* Center hotspot */}
                                <circle
                                  cx={region.cx} cy={region.cy} r={4}
                                  fill={isC ? T.red : T.amber}
                                  opacity={pulseOpacity * 1.2}
                                />
                              </g>
                            )
                          })}
                        </svg>

                        {/* Region labels */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
                          {flaggedRegions.map((fr, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: 8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              style={{
                                padding: '6px 8px',
                                background: fr.status === 'critical' ? 'rgba(255,107,107,0.05)' : 'rgba(245,158,11,0.05)',
                                border: `1px solid ${fr.status === 'critical' ? 'rgba(255,107,107,0.15)' : 'rgba(245,158,11,0.15)'}`,
                                borderRadius: 7,
                                borderLeft: `3px solid ${fr.status === 'critical' ? T.red : T.amber}`,
                              }}
                            >
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              }}>
                                <div style={{
                                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                                  color: fr.status === 'critical' ? T.red : T.amber,
                                  textTransform: 'uppercase', letterSpacing: '0.08em',
                                }}>
                                  {fr.intervention.icon} {BODY_REGIONS[fr.region]?.label || fr.region}
                                </div>
                                <div style={{
                                  fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
                                  color: fr.status === 'critical' ? T.red : T.amberBright,
                                }}>
                                  {fr.value}
                                  <span style={{ fontSize: 7, fontWeight: 500, opacity: 0.6, marginLeft: 2 }}>{fr.unit}</span>
                                </div>
                              </div>
                              <div style={{
                                fontSize: 7, fontFamily: 'monospace',
                                color: T.textTer, marginTop: 2,
                              }}>
                                {fr.marker} · {MARKER_MAP[fr.vaultKey]?.system}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── System Status Intervention Line ── */}
                  {systemStatusLine && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{
                        padding: '10px 12px',
                        background: flaggedCount > 0
                          ? 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(59,130,246,0.03))'
                          : 'linear-gradient(135deg, rgba(0,220,130,0.04), rgba(59,130,246,0.03))',
                        border: `1px solid ${flaggedCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(0,220,130,0.1)'}`,
                        borderRadius: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{
                        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                        color: flaggedCount > 0 ? T.amber : T.green,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        marginBottom: 4,
                      }}>
                        {flaggedCount > 0 ? '⚡ SYSTEM STATUS — INTERVENTION REQUIRED' : '✓ SYSTEM STATUS — ALL CLEAR'}
                      </div>
                      <div style={{
                        fontSize: 9, fontFamily: 'monospace',
                        color: T.textSec, lineHeight: 1.5,
                      }}>
                        {systemStatusLine}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Intervention Protocol Cards ── */}
                  {flaggedRegions.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{
                        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                        color: T.accent, letterSpacing: '0.15em',
                        textTransform: 'uppercase', marginBottom: 6,
                      }}>
                        🧬 RECOMMENDED PROTOCOLS
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {flaggedRegions.map((fr, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }}
                            style={{
                              padding: '8px 10px',
                              background: 'rgba(59,130,246,0.03)',
                              border: '1px solid rgba(59,130,246,0.08)',
                              borderLeft: `2px solid ${T.blue}`,
                              borderRadius: 7,
                            }}
                          >
                            <div style={{
                              fontSize: 9, fontFamily: 'monospace',
                              color: T.blueBright, lineHeight: 1.5,
                            }}>
                              <span style={{
                                fontWeight: 800, fontSize: 7, letterSpacing: '0.12em',
                                color: T.accent,
                              }}>RX:</span>{' '}
                              {fr.intervention.protocol}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Optimal Markers Grid ── */}
                  {optimalCount > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{
                        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                        color: T.green, letterSpacing: '0.15em',
                        textTransform: 'uppercase', marginBottom: 5,
                      }}>
                        ✓ WITHIN OPTIMAL RANGE
                      </div>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: 3,
                      }}>
                        {allMarkers.filter(m => m.status === 'optimal').slice(0, 10).map((m, i) => (
                          <div key={i} style={{
                            padding: '4px 7px',
                            background: 'rgba(0,220,130,0.02)',
                            border: '1px solid rgba(0,220,130,0.06)',
                            borderRadius: 5,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <div style={{
                              fontSize: 7, fontFamily: 'monospace', color: T.textSec,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: '55%',
                            }}>{m.name}</div>
                            <div style={{
                              fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: T.green,
                            }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── AI Interpretation ── */}
                  {interpretation && (
                    <div style={{
                      padding: '10px 12px',
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.03), rgba(0,255,204,0.02))',
                      border: `1px solid ${T.borderBlue}`,
                      borderRadius: 9,
                    }}>
                      <div style={{
                        fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                        color: T.accent, letterSpacing: '0.15em',
                        textTransform: 'uppercase', marginBottom: 5,
                      }}>
                        🧠 CLINICAL INTERPRETATION
                      </div>
                      <div style={{
                        fontSize: 9, fontFamily: 'Inter, system-ui, sans-serif',
                        color: T.textSec, lineHeight: 1.6,
                      }}>
                        {interpretation}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes bi-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
