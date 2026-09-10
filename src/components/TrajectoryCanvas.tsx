import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   TRAJECTORY CANVAS — 90-Day Biological Age Projection
   
   A high-performance, minimalist visualization showing:
   • Three scenario paths: Optimal / Projected / Decline
   • Proximity glow on active data points (mouse/touch)
   • Milestone markers with achievement/warning states
   • Component breakdown (HRV, Sleep, Adherence, Biomarkers)
   • Vitality Score projection with confidence band
   ═══════════════════════════════════════════════════════════════ */

/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceHover: 'rgba(22,22,30,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  textQuad: 'rgba(255,255,255,0.12)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.25)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.20)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.20)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.20)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.20)',
  gold: '#FFD700',
  purple: '#A78BFA',
  purpleGlow: 'rgba(167,139,250,0.20)',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Helpers ── */
function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id')
    if (!id) { id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('vive-session-id', id) }
    return id
  } catch { return 'guest-user' }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

/* ═══════════════════════════════════════════════════════════════
   PROXIMITY GLOW CANVAS — SVG-based trajectory with glow effect
   ═══════════════════════════════════════════════════════════════ */

interface TrajectoryPoint {
  day: number
  optimal: number
  projected: number
  decline: number
}

interface Milestone {
  day: number
  label: string
  type: 'achievement' | 'warning' | 'checkpoint'
}

function TrajectoryGraph({
  points,
  milestones,
  chronoAge,
  currentBioAge,
}: {
  points: TrajectoryPoint[]
  milestones: Milestone[]
  chronoAge: number
  currentBioAge: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const [dimensions, setDimensions] = useState({ w: 360, h: 220 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setDimensions({ w: Math.max(300, width), h: 220 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const PAD = { top: 28, right: 16, bottom: 32, left: 44 }
  const plotW = dimensions.w - PAD.left - PAD.right
  const plotH = dimensions.h - PAD.top - PAD.bottom

  const { minAge, maxAge, rangeAge } = useMemo(() => {
    const allVals = points.flatMap(p => [p.optimal, p.projected, p.decline])
    const mn = Math.floor(Math.min(...allVals) - 1)
    const mx = Math.ceil(Math.max(...allVals) + 1)
    return { minAge: mn, maxAge: mx, rangeAge: mx - mn || 1 }
  }, [points])

  const toX = useCallback((day: number) => PAD.left + (day / 90) * plotW, [plotW])
  const toY = useCallback((age: number) => PAD.top + plotH - ((age - minAge) / rangeAge) * plotH, [plotH, minAge, rangeAge])

  const pathStr = useCallback((key: 'optimal' | 'projected' | 'decline') => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.day).toFixed(1)},${toY(p[key]).toFixed(1)}`).join(' ')
  }, [points, toX, toY])

  /* Confidence band fill between optimal and decline */
  const bandPath = useMemo(() => {
    const top = points.map(p => `${toX(p.day).toFixed(1)},${toY(p.optimal).toFixed(1)}`)
    const bottom = [...points].reverse().map(p => `${toX(p.day).toFixed(1)},${toY(p.decline).toFixed(1)}`)
    return `M${top.join(' L')} L${bottom.join(' L')} Z`
  }, [points, toX, toY])

  /* Hover data */
  const hoverData = useMemo(() => {
    if (hoverDay === null) return null
    const idx = Math.max(0, Math.min(90, Math.round(hoverDay)))
    const p = points[idx]
    if (!p) return null
    return { ...p, x: toX(p.day), yOpt: toY(p.optimal), yProj: toY(p.projected), yDec: toY(p.decline) }
  }, [hoverDay, points, toX, toY])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const day = Math.round(((x - PAD.left) / plotW) * 90)
    setHoverDay(Math.max(0, Math.min(90, day)))
  }, [plotW])

  const handlePointerLeave = useCallback(() => setHoverDay(null), [])

  /* Chrono age reference line */
  const chronoY = toY(chronoAge)

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg
        width={dimensions.w}
        height={dimensions.h}
        viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
      >
        <defs>
          {/* Glow filters */}
          <filter id="tc-glow-green">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="tc-glow-blue">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="tc-glow-red">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="tc-proximity-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Band gradient */}
          <linearGradient id="tc-band-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.green} stopOpacity="0.06" />
            <stop offset="50%" stopColor={T.blue} stopOpacity="0.03" />
            <stop offset="100%" stopColor={T.red} stopOpacity="0.06" />
          </linearGradient>
          {/* Projected line gradient */}
          <linearGradient id="tc-proj-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={T.blueBright} />
            <stop offset="100%" stopColor={T.accent} />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 30, 60, 90].map(d => (
          <line key={`gx${d}`} x1={toX(d)} y1={PAD.top} x2={toX(d)} y2={PAD.top + plotH}
            stroke={T.border} strokeWidth="0.5" strokeDasharray="3,5" />
        ))}
        {Array.from({ length: 5 }, (_, i) => {
          const v = minAge + (rangeAge / 4) * i
          return (
            <g key={`gy${i}`}>
              <line x1={PAD.left} y1={toY(v)} x2={PAD.left + plotW} y2={toY(v)}
                stroke={T.border} strokeWidth="0.5" />
              <text x={PAD.left - 6} y={toY(v)} textAnchor="end" dominantBaseline="central"
                style={{ fontSize: 8, fill: T.textTer, fontFamily: 'monospace', fontWeight: 600 }}>
                {v.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {[0, 15, 30, 45, 60, 75, 90].map(d => (
          <text key={`xl${d}`} x={toX(d)} y={dimensions.h - 8} textAnchor="middle"
            style={{ fontSize: 7, fill: T.textTer, fontFamily: 'monospace', fontWeight: 600 }}>
            {d === 0 ? 'NOW' : `D${d}`}
          </text>
        ))}

        {/* Chronological age reference line */}
        <line x1={PAD.left} y1={chronoY} x2={PAD.left + plotW} y2={chronoY}
          stroke={T.orange} strokeWidth="1" strokeDasharray="6,4" opacity="0.4" />
        <text x={PAD.left + plotW + 2} y={chronoY} dominantBaseline="central"
          style={{ fontSize: 7, fill: T.orange, fontFamily: 'monospace', fontWeight: 700, opacity: 0.6 }}>
          CHRONO
        </text>

        {/* Confidence band */}
        <path d={bandPath} fill="url(#tc-band-grad)" />

        {/* Decline path */}
        <path d={pathStr('decline')} fill="none" stroke={T.red} strokeWidth="1.5"
          strokeDasharray="4,4" opacity="0.5" />

        {/* Optimal path */}
        <path d={pathStr('optimal')} fill="none" stroke={T.green} strokeWidth="1.5"
          strokeDasharray="6,3" opacity="0.6" filter="url(#tc-glow-green)" />

        {/* Projected path — primary, glowing */}
        <path d={pathStr('projected')} fill="none" stroke="url(#tc-proj-grad)" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" filter="url(#tc-glow-blue)" />

        {/* Milestone markers */}
        {milestones.map((m, i) => {
          const pt = points[m.day]
          if (!pt) return null
          const mx = toX(m.day)
          const my = toY(pt.projected)
          const mColor = m.type === 'achievement' ? T.accent : m.type === 'warning' ? T.orange : T.purple
          return (
            <g key={`ms${i}`}>
              <circle cx={mx} cy={my} r="5" fill={T.bg} stroke={mColor} strokeWidth="1.5" />
              <circle cx={mx} cy={my} r="2" fill={mColor}>
                <animate attributeName="r" values="2;3;2" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          )
        })}

        {/* Start marker */}
        <circle cx={toX(0)} cy={toY(currentBioAge)} r="4" fill={T.blueBright}
          stroke={T.bg} strokeWidth="2" filter="url(#tc-glow-blue)" />

        {/* ── PROXIMITY GLOW — hover interaction ── */}
        {hoverData && (
          <g>
            {/* Vertical scan line */}
            <line x1={hoverData.x} y1={PAD.top} x2={hoverData.x} y2={PAD.top + plotH}
              stroke={T.blueBright} strokeWidth="0.5" opacity="0.4" />

            {/* Proximity glow circles */}
            <circle cx={hoverData.x} cy={hoverData.yOpt} r="12"
              fill={T.green} opacity="0.08" filter="url(#tc-proximity-glow)" />
            <circle cx={hoverData.x} cy={hoverData.yProj} r="16"
              fill={T.blueBright} opacity="0.12" filter="url(#tc-proximity-glow)" />
            <circle cx={hoverData.x} cy={hoverData.yDec} r="10"
              fill={T.red} opacity="0.06" filter="url(#tc-proximity-glow)" />

            {/* Data dots */}
            <circle cx={hoverData.x} cy={hoverData.yOpt} r="3" fill={T.green} stroke={T.bg} strokeWidth="1.5" />
            <circle cx={hoverData.x} cy={hoverData.yProj} r="4" fill={T.blueBright} stroke={T.bg} strokeWidth="1.5" />
            <circle cx={hoverData.x} cy={hoverData.yDec} r="3" fill={T.red} stroke={T.bg} strokeWidth="1.5" />

            {/* Tooltip */}
            {(() => {
              const tooltipX = hoverData.x > dimensions.w / 2 ? hoverData.x - 110 : hoverData.x + 12
              const tooltipY = Math.max(PAD.top, Math.min(PAD.top + plotH - 70, hoverData.yProj - 35))
              return (
                <foreignObject x={tooltipX} y={tooltipY} width="100" height="72">
                  <div style={{
                    background: 'rgba(10,10,11,0.95)', border: `1px solid ${T.borderBlue}`,
                    borderRadius: 8, padding: '6px 8px', backdropFilter: 'blur(12px)',
                  }}>
                    <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, marginBottom: 4, fontWeight: 700, letterSpacing: '0.1em' }}>
                      DAY {hoverData.day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 8, color: T.green, fontFamily: 'monospace' }}>OPT</span>
                        <span style={{ fontSize: 10, color: T.green, fontFamily: 'monospace', fontWeight: 800 }}>{hoverData.optimal.toFixed(1)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 8, color: T.blueBright, fontFamily: 'monospace' }}>PROJ</span>
                        <span style={{ fontSize: 10, color: T.blueBright, fontFamily: 'monospace', fontWeight: 800 }}>{hoverData.projected.toFixed(1)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 8, color: T.red, fontFamily: 'monospace' }}>DEC</span>
                        <span style={{ fontSize: 10, color: T.red, fontFamily: 'monospace', fontWeight: 800 }}>{hoverData.decline.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </foreignObject>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT BREAKDOWN — Bio-Age Factor Cards
   ═══════════════════════════════════════════════════════════════ */

interface ComponentData {
  key: string
  label: string
  value: number
  unit: string
  adjustment: number
  weight: number
  status: 'optimal' | 'moderate' | 'low'
}

function ComponentBreakdown({ components }: { components: ComponentData[] }) {
  const statusMeta = {
    optimal: { color: T.green, glow: T.greenGlow, label: 'OPTIMAL', icon: '✦' },
    moderate: { color: T.orange, glow: T.orangeGlow, label: 'MODERATE', icon: '◆' },
    low: { color: T.red, glow: T.redGlow, label: 'LOW', icon: '▼' },
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
      {components.map((c, i) => {
        const meta = statusMeta[c.status]
        const adjSign = c.adjustment <= 0 ? '' : '+'
        const adjColor = c.adjustment <= 0 ? T.green : c.adjustment <= 0.5 ? T.orange : T.red
        return (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            style={{
              background: T.surface,
              border: `1px solid ${meta.color}15`,
              borderRadius: 12,
              padding: '10px 12px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Ambient glow */}
            <div style={{
              position: 'absolute', top: -20, right: -20, width: 60, height: 60,
              borderRadius: '50%', background: meta.glow, filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, position: 'relative' }}>
              <div>
                <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 2 }}>
                  {c.label.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  {c.value > 0 && (
                    <>
                      <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 900, color: meta.color }}>
                        {c.value}
                      </span>
                      <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
                        {c.unit}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 6px', borderRadius: 4,
                background: `${meta.color}12`, border: `1px solid ${meta.color}20`,
              }}>
                <span style={{ fontSize: 7, color: meta.color }}>{meta.icon}</span>
                <span style={{ fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: meta.color, letterSpacing: '0.08em' }}>
                  {meta.label}
                </span>
              </div>
            </div>

            {/* Weight bar */}
            <div style={{ height: 3, borderRadius: 2, background: T.border, marginBottom: 6, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${c.weight * 100}%` }}
                transition={{ delay: i * 0.06 + 0.3, duration: 0.6 }}
                style={{
                  height: '100%', borderRadius: 2,
                  background: `linear-gradient(90deg, ${meta.color}, ${meta.color}80)`,
                  boxShadow: `0 0 6px ${meta.glow}`,
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
                Weight: {(c.weight * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, color: adjColor }}>
                {adjSign}{c.adjustment}y
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BIO-AGE HERO — Central age display with delta
   ═══════════════════════════════════════════════════════════════ */

function BioAgeHero({
  chronoAge,
  bioAge,
  delta,
  confidence,
  adherence,
}: {
  chronoAge: number
  bioAge: number
  delta: number
  confidence: number
  adherence: number
}) {
  const deltaColor = delta <= -2 ? T.green : delta <= 0 ? T.accent : delta <= 2 ? T.orange : T.red
  const deltaGlow = delta <= -2 ? T.greenGlow : delta <= 0 ? T.accentGlow : delta <= 2 ? T.orangeGlow : T.redGlow
  const deltaSign = delta <= 0 ? '' : '+'
  const r = 52
  const c = 2 * Math.PI * r
  const confOffset = c - (confidence / 100) * c

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '16px 20px',
        background: T.surface,
        border: `1px solid ${deltaColor}15`,
        borderRadius: 16,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -30, left: -30, width: 120, height: 120,
        borderRadius: '50%', background: deltaGlow, filter: 'blur(40px)',
        pointerEvents: 'none', opacity: 0.5,
      }} />

      {/* Age Ring */}
      <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
        <svg width="112" height="112" viewBox="0 0 112 112">
          {/* Track */}
          <circle cx="56" cy="56" r={r} fill="none" stroke={T.border} strokeWidth="4" />
          {/* Confidence arc */}
          <circle cx="56" cy="56" r={r} fill="none" stroke={deltaColor} strokeWidth="4"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={confOffset}
            transform="rotate(-90 56 56)"
            style={{ filter: `drop-shadow(0 0 8px ${deltaGlow})`, transition: 'all 1s ease' }}
          />
          {/* Inner ring pulse */}
          <circle cx="56" cy="56" r={r - 8} fill="none" stroke={deltaColor} strokeWidth="1" opacity="0.15">
            <animate attributeName="r" values={`${r - 8};${r - 6};${r - 8}`} dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.25;0.15" dur="3s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 28, fontFamily: 'monospace', fontWeight: 900, color: T.text,
            lineHeight: 1, textShadow: `0 0 20px ${deltaGlow}`,
          }}>
            {bioAge.toFixed(1)}
          </span>
          <span style={{
            fontSize: 7, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2,
          }}>
            BIO-AGE
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 8, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.15em', fontWeight: 700,
          }}>
            BIOLOGICAL TRAJECTORY
          </span>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: T.green,
            boxShadow: `0 0 6px ${T.greenGlow}`,
            animation: 'tc-pulse 2s ease-in-out infinite',
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {/* Delta */}
          <div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>DELTA</div>
            <span style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 900, color: deltaColor, textShadow: `0 0 12px ${deltaGlow}` }}>
              {deltaSign}{delta.toFixed(1)}y
            </span>
          </div>
          {/* Chrono */}
          <div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>CHRONO</div>
            <span style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 900, color: T.textSec }}>
              {chronoAge}
            </span>
          </div>
          {/* Confidence */}
          <div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>CONFIDENCE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2, width: `${confidence}%`,
                  background: `linear-gradient(90deg, ${T.blue}, ${T.accent})`,
                  boxShadow: `0 0 6px ${T.blueGlow}`,
                  transition: 'width 1s ease',
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: T.blueBright }}>{confidence.toFixed(0)}%</span>
            </div>
          </div>
          {/* Adherence */}
          <div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>ADHERENCE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2, width: `${adherence}%`,
                  background: adherence >= 80 ? T.green : adherence >= 60 ? T.orange : T.red,
                  transition: 'width 1s ease',
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, color: adherence >= 80 ? T.green : adherence >= 60 ? T.orange : T.red }}>
                {adherence}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   90-DAY PROJECTION SUMMARY — End-state comparison
   ═══════════════════════════════════════════════════════════════ */

function ProjectionSummary({ points, chronoAge }: { points: TrajectoryPoint[]; chronoAge: number }) {
  const end = points[90]
  if (!end) return null

  const scenarios = [
    { label: 'OPTIMAL', age: end.optimal, color: T.green, glow: T.greenGlow, icon: '🏆', desc: '95%+ adherence' },
    { label: 'PROJECTED', age: end.projected, color: T.blueBright, glow: T.blueGlow, icon: '📈', desc: 'Current trajectory' },
    { label: 'DECLINE', age: end.decline, color: T.red, glow: T.redGlow, icon: '⚠️', desc: 'If protocols lapse' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {scenarios.map((s, i) => {
        const delta = s.age - chronoAge
        const deltaSign = delta <= 0 ? '' : '+'
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              background: T.surface,
              border: `1px solid ${s.color}15`,
              borderRadius: 12,
              padding: '12px 10px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', bottom: -15, left: '50%', transform: 'translateX(-50%)',
              width: 50, height: 50, borderRadius: '50%', background: s.glow,
              filter: 'blur(20px)', pointerEvents: 'none',
            }} />
            <div style={{ fontSize: 14, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 900, color: s.color, textShadow: `0 0 12px ${s.glow}`, lineHeight: 1 }}>
              {s.age.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: `${s.color}90`, marginTop: 2 }}>
              {deltaSign}{delta.toFixed(1)}y
            </div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textQuad, marginTop: 4 }}>
              {s.desc}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MOMENTUM INDICATOR — Adherence trend direction
   ═══════════════════════════════════════════════════════════════ */

function MomentumIndicator({ momentum, avgHrv, avgSleep }: { momentum: number; avgHrv: number; avgSleep: number }) {
  const direction = momentum > 0.05 ? 'accelerating' : momentum > -0.05 ? 'steady' : 'decelerating'
  const meta = {
    accelerating: { color: T.green, icon: '🚀', label: 'ACCELERATING', desc: 'Protocol adherence is improving — compounding biological gains' },
    steady: { color: T.blueBright, icon: '⚡', label: 'STEADY STATE', desc: 'Maintaining current trajectory — consistency is key' },
    decelerating: { color: T.orange, icon: '⏳', label: 'DECELERATING', desc: 'Adherence trending down — re-engage protocols to prevent drift' },
  }
  const m = meta[direction]

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: T.surface,
        border: `1px solid ${m.color}15`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${m.color}12`, border: `1px solid ${m.color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, color: m.color, letterSpacing: '0.1em' }}>
            {m.label}
          </span>
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
            HRV {avgHrv}ms · Sleep {avgSleep}
          </span>
        </div>
        <p style={{ fontSize: 9, fontFamily: 'monospace', color: T.textSec, lineHeight: 1.5, margin: 0 }}>
          {m.desc}
        </p>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LOADING STATE — Trajectory initialization animation
   ═══════════════════════════════════════════════════════════════ */

function TrajectoryLoader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 300, gap: 16,
    }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{
          width: 56, height: 56, border: `2px solid ${T.border}`,
          borderTopColor: T.blueBright, borderRadius: '50%',
          animation: 'tc-spin 0.8s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 10,
          border: `2px solid ${T.border}`,
          borderBottomColor: T.accent, borderRadius: '50%',
          animation: 'tc-spin-rev 1.2s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 20,
          border: `1px solid ${T.border}`,
          borderLeftColor: T.green, borderRadius: '50%',
          animation: 'tc-spin 2s linear infinite',
        }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: T.blueBright, letterSpacing: '0.18em', marginBottom: 4,
        }}>
          COMPUTING TRAJECTORY
        </div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
          Analyzing 90-day biological projection...
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TRAJECTORY CANVAS — Main Export
   ═══════════════════════════════════════════════════════════════ */

export default function TrajectoryCanvas() {
  const sessionId = useMemo(() => getSessionId(), [])
  const trajectory = useQuery(api.bioTrajectory.get90DayTrajectory, { sessionId })
  const [activeView, setActiveView] = useState<'graph' | 'components'>('graph')

  if (trajectory === undefined) return <TrajectoryLoader />

  if (!trajectory) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 300, gap: 12,
        padding: 24,
      }}>
        <div style={{ fontSize: 32 }}>🧬</div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: T.text }}>
          Trajectory Unavailable
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, textAlign: 'center', maxWidth: 260 }}>
          Seed biometric data to initialize your 90-day biological age projection.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 12px 24px', maxWidth: 480, margin: '0 auto' }}>
      <style>{`
        @keyframes tc-pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        @keyframes tc-spin-rev { to { transform: rotate(-360deg); } }
      `}</style>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${T.blue}12`, border: `1px solid ${T.borderBlue}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            🧬
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: T.text, letterSpacing: '0.02em' }}>
              Biological Trajectory
            </div>
            <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em' }}>
              90-DAY PROJECTION ENGINE
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div style={{
          display: 'flex', gap: 2, padding: 2, borderRadius: 8,
          background: T.border,
        }}>
          {(['graph', 'components'] as const).map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                letterSpacing: '0.08em', cursor: 'pointer',
                color: activeView === v ? T.text : T.textTer,
                background: activeView === v ? T.surface : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {v === 'graph' ? 'TRAJECTORY' : 'FACTORS'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Bio-Age Hero */}
      <BioAgeHero
        chronoAge={trajectory.chronologicalAge}
        bioAge={trajectory.currentBioAge}
        delta={trajectory.delta}
        confidence={trajectory.confidence}
        adherence={trajectory.avgAdherence}
      />

      <div style={{ height: 12 }} />

      {/* Momentum */}
      <MomentumIndicator
        momentum={trajectory.adherenceMomentum}
        avgHrv={trajectory.avgHrv}
        avgSleep={trajectory.avgSleep}
      />

      <div style={{ height: 12 }} />

      <AnimatePresence mode="wait">
        {activeView === 'graph' ? (
          <motion.div
            key="graph"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Trajectory Graph */}
            <div style={{
              background: T.surface,
              border: `1px solid ${T.borderBlue}`,
              borderRadius: 14,
              padding: '12px 4px 4px',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 12px 8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {[
                    { color: T.green, label: 'Optimal', dash: true },
                    { color: T.blueBright, label: 'Projected', dash: false },
                    { color: T.red, label: 'Decline', dash: true },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 12, height: 2, borderRadius: 1,
                        background: l.color,
                        boxShadow: l.dash ? 'none' : `0 0 4px ${l.color}`,
                        ...(l.dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${l.color} 0, ${l.color} 4px, transparent 4px, transparent 7px)`, background: 'none' } : {}),
                      }} />
                      <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, fontWeight: 600 }}>
                        {l.label}
                      </span>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textQuad }}>
                  Hover to inspect
                </span>
              </div>

              <TrajectoryGraph
                points={trajectory.trajectory}
                milestones={trajectory.milestones}
                chronoAge={trajectory.chronologicalAge}
                currentBioAge={trajectory.currentBioAge}
              />
            </div>

            <div style={{ height: 12 }} />

            {/* 90-Day End Projections */}
            <ProjectionSummary
              points={trajectory.trajectory}
              chronoAge={trajectory.chronologicalAge}
            />
          </motion.div>
        ) : (
          <motion.div
            key="components"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ComponentBreakdown components={trajectory.components} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
