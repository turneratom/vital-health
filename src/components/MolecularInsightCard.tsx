import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Design Tokens ── */
const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.95)',
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
}

/* ── Pathway color mapping ── */
const PATHWAY_COLORS: Record<string, { color: string; glow: string; icon: string; label: string }> = {
  sirtuin: { color: '#A78BFA', glow: 'rgba(167,139,250,0.25)', icon: '🧬', label: 'Sirtuin Activation' },
  cellularRepair: { color: '#00FFCC', glow: 'rgba(0,255,204,0.25)', icon: '🔬', label: 'Cellular Repair' },
  mitochondrial: { color: '#3B82F6', glow: 'rgba(59,130,246,0.25)', icon: '⚡', label: 'Mitochondrial Function' },
  antiInflammatory: { color: '#00DC82', glow: 'rgba(0,220,130,0.25)', icon: '🛡️', label: 'Anti-Inflammatory' },
  gutMicrobiome: { color: '#E8976C', glow: 'rgba(232,151,108,0.25)', icon: '🦠', label: 'Gut Microbiome' },
}

interface MicroTotals {
  omega3mg?: number
  polyphenolsMg?: number
  sulforaphaneMcg?: number
  resveratrolMcg?: number
  quercetinMg?: number
  curcuminMg?: number
  vitaminCmg?: number
  vitaminEmg?: number
  seleniumMcg?: number
  zincMg?: number
  magnesiumMg?: number
  nad_precursorMg?: number
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

export interface MolecularInsightCardProps {
  insight: MolecularInsight
  microTotals?: MicroTotals
  fuelScore: number
  mealName: string
  onDismiss?: () => void
  isVisible: boolean
}

/* ── Animated Score Bar ── */
function PathwayBar({ 
  pathwayKey, score, drivers, delay 
}: { 
  pathwayKey: string; score: number; drivers: string[]; delay: number 
}) {
  const config = PATHWAY_COLORS[pathwayKey] || PATHWAY_COLORS.sirtuin
  const [expanded, setExpanded] = useState(false)
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1200
      const start = performance.now()
      const animate = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setAnimatedScore(Math.round(score * eased))
        if (progress < 1) requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }, delay)
    return () => clearTimeout(timer)
  }, [score, delay])

  const scoreLabel = score >= 70 ? 'EXCEPTIONAL' : score >= 45 ? 'STRONG' : score >= 20 ? 'MODERATE' : 'MINIMAL'
  const scoreLabelColor = score >= 70 ? CC.green : score >= 45 ? CC.electricBlueBright : score >= 20 ? CC.orange : CC.textTer

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4 }}
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: 'pointer', marginBottom: 6 }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>{config.icon}</span>
        <span style={{
          flex: 1, fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
          color: CC.text, letterSpacing: '0.04em',
        }}>
          {config.label}
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: scoreLabelColor, letterSpacing: '0.08em',
        }}>
          {scoreLabel}
        </span>
        <span style={{
          fontSize: 13, fontFamily: 'monospace', fontWeight: 800,
          color: config.color, minWidth: 28, textAlign: 'right',
        }}>
          {animatedScore}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden', position: 'relative',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${animatedScore}%` }}
          transition={{ delay: delay / 1000, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${config.color}88, ${config.color})`,
            boxShadow: `0 0 12px ${config.glow}`,
            position: 'relative',
          }}
        />
        {/* Glow pulse at tip */}
        {animatedScore > 5 && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: 'absolute', top: -2, right: `${100 - Math.min(animatedScore, 98)}%`,
              width: 8, height: 8, borderRadius: '50%',
              background: config.color,
              boxShadow: `0 0 8px ${config.glow}, 0 0 16px ${config.glow}`,
              transform: 'translateX(50%)',
            }}
          />
        )}
      </div>

      {/* Expanded Drivers */}
      <AnimatePresence>
        {expanded && drivers.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 6, paddingLeft: 21 }}>
              {drivers.map((d, i) => (
                <div key={i} style={{
                  fontSize: 9, fontFamily: 'monospace', color: CC.textSec,
                  lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ color: config.color, fontSize: 7, marginTop: 2 }}>●</span>
                  {d}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Micronutrient Pill ── */
function MicroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  if (!value || value <= 0) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: `${color}10`, border: `1px solid ${color}20`,
      fontSize: 9, fontFamily: 'monospace', color,
    }}>
      <span style={{ fontWeight: 700 }}>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}</span>
      <span style={{ opacity: 0.7 }}>{unit}</span>
      <span style={{ color: CC.textTer, fontSize: 8 }}>{label}</span>
    </div>
  )
}

/* ── Radial Score Gauge ── */
function RadialGauge({ score, label }: { score: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [animVal, setAnimVal] = useState(0)

  useEffect(() => {
    const duration = 1500
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setAnimVal(score * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [score])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 80
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2, r = 32
    const startAngle = Math.PI * 0.75
    const endAngle = Math.PI * 2.25
    const sweepAngle = endAngle - startAngle

    // Background arc
    ctx.clearRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()

    // Value arc
    const valAngle = startAngle + (animVal / 100) * sweepAngle
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    if (animVal >= 60) {
      gradient.addColorStop(0, '#00DC82')
      gradient.addColorStop(1, '#00FFCC')
    } else if (animVal >= 35) {
      gradient.addColorStop(0, '#3B82F6')
      gradient.addColorStop(1, '#60A5FA')
    } else {
      gradient.addColorStop(0, '#E8976C')
      gradient.addColorStop(1, '#FF6B6B')
    }

    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, valAngle)
    ctx.strokeStyle = gradient
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()

    // Glow
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, valAngle)
    ctx.strokeStyle = animVal >= 60 ? 'rgba(0,255,204,0.2)' : animVal >= 35 ? 'rgba(59,130,246,0.2)' : 'rgba(232,151,108,0.2)'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.stroke()
  }, [animVal])

  const displayScore = Math.round(animVal)
  const scoreColor = displayScore >= 60 ? CC.green : displayScore >= 35 ? CC.electricBlueBright : CC.orange

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', paddingTop: 4,
        }}>
          <span style={{
            fontSize: 20, fontFamily: 'monospace', fontWeight: 800,
            color: scoreColor, lineHeight: 1,
          }}>
            {displayScore}
          </span>
          <span style={{
            fontSize: 7, fontFamily: 'monospace', color: CC.textTer,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            / 100
          </span>
        </div>
      </div>
      <span style={{
        fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
        color: CC.textSec, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MOLECULAR INSIGHT CARD — Main Export
   ═══════════════════════════════════════════════════════════════ */
export default function MolecularInsightCard({
  insight, microTotals, fuelScore, mealName, onDismiss, isVisible,
}: MolecularInsightCardProps) {
  const [showDetail, setShowDetail] = useState(false)

  if (!isVisible || !insight) return null

  // Compute dominant pathway
  const pathways = [
    { key: 'sirtuin', score: insight.sirtuinActivation, drivers: insight.sirtuinDrivers },
    { key: 'cellularRepair', score: insight.cellularRepairScore, drivers: insight.cellularRepairDrivers },
    { key: 'mitochondrial', score: insight.mitochondrialScore, drivers: insight.mitochondrialDrivers },
    { key: 'antiInflammatory', score: insight.antiInflammatoryScore, drivers: insight.antiInflammatoryDrivers },
    { key: 'gutMicrobiome', score: insight.gutMicrobiomeScore, drivers: insight.gutMicrobiomeDrivers },
  ].sort((a, b) => b.score - a.score)

  const dominant = pathways[0]
  const dominantConfig = PATHWAY_COLORS[dominant.key]
  const avgScore = Math.round(pathways.reduce((s, p) => s + p.score, 0) / pathways.length)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: CC.surface,
          borderRadius: 16,
          border: `1px solid ${dominantConfig.color}18`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Glow Accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${dominantConfig.color}, transparent)`,
          opacity: 0.6,
        }} />

        {/* Ambient Glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 120, height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${dominantConfig.glow}, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ padding: '16px 14px', position: 'relative' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>🔬</span>
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: dominantConfig.color, letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>
                  MOLECULAR INSIGHT
                </span>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: dominantConfig.color,
                    boxShadow: `0 0 6px ${dominantConfig.glow}`,
                  }}
                />
              </div>

              {/* Headline */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  fontSize: 12, fontWeight: 600, color: CC.text,
                  lineHeight: 1.5, maxWidth: '90%',
                }}
              >
                {insight.headline}
              </motion.div>
            </div>

            {/* Radial Gauge */}
            <RadialGauge score={avgScore} label="Molecular" />
          </div>

          {/* Narrative */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
              lineHeight: 1.7, marginBottom: 14,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              borderLeft: `2px solid ${dominantConfig.color}40`,
            }}
          >
            {insight.narrative}
          </motion.div>

          {/* Pathway Scores */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: CC.textTer, letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              BIOLOGICAL PATHWAYS ACTIVATED
            </div>
            {pathways.map((p, i) => (
              <PathwayBar
                key={p.key}
                pathwayKey={p.key}
                score={p.score}
                drivers={p.drivers}
                delay={200 + i * 150}
              />
            ))}
          </div>

          {/* Micronutrient Pills */}
          {microTotals && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <div
                onClick={() => setShowDetail(!showDetail)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.textTer, letterSpacing: '0.15em', textTransform: 'uppercase',
                }}>
                  KEY MICRONUTRIENTS DETECTED
                </span>
                <span style={{
                  fontSize: 10, color: CC.textTer,
                  transform: showDetail ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}>
                  ▾
                </span>
              </div>

              <AnimatePresence>
                {showDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 8 }}>
                      <MicroPill label="Omega-3" value={microTotals.omega3mg || 0} unit="mg" color="#3B82F6" />
                      <MicroPill label="Polyphenols" value={microTotals.polyphenolsMg || 0} unit="mg" color="#A78BFA" />
                      <MicroPill label="Sulforaphane" value={microTotals.sulforaphaneMcg || 0} unit="mcg" color="#00FFCC" />
                      <MicroPill label="Resveratrol" value={microTotals.resveratrolMcg || 0} unit="mcg" color="#E879F9" />
                      <MicroPill label="Quercetin" value={microTotals.quercetinMg || 0} unit="mg" color="#F59E0B" />
                      <MicroPill label="Curcumin" value={microTotals.curcuminMg || 0} unit="mg" color="#E8976C" />
                      <MicroPill label="Vitamin C" value={microTotals.vitaminCmg || 0} unit="mg" color="#FBBF24" />
                      <MicroPill label="Vitamin E" value={microTotals.vitaminEmg || 0} unit="mg" color="#34D399" />
                      <MicroPill label="Selenium" value={microTotals.seleniumMcg || 0} unit="mcg" color="#6EE7B7" />
                      <MicroPill label="Zinc" value={microTotals.zincMg || 0} unit="mg" color="#93C5FD" />
                      <MicroPill label="Magnesium" value={microTotals.magnesiumMg || 0} unit="mg" color="#C4B5FD" />
                      <MicroPill label="NAD+" value={microTotals.nad_precursorMg || 0} unit="mg" color="#F472B6" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Dismiss */}
          {onDismiss && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={onDismiss}
              style={{
                width: '100%', padding: '10px 0', marginTop: 4,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${CC.border}`,
                borderRadius: 10, cursor: 'pointer',
                fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                color: CC.textSec, letterSpacing: '0.06em',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.color = CC.text
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.color = CC.textSec
              }}
            >
              Got it — Continue
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
