import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   BIOLOGICAL TWIN — Lifetime Trajectory Visualization
   
   Two divergent aging curves projected across decades:
   • Chronological Aging (standard population decline)
   • Optimized Aging (Vive Protocol trajectory)
   
   The gap = "Projected Longevity Extension"
   Makes the invisible benefits of longevity work visible.
   
   v2: Ghost State skeleton loaders, mobile perf optimizations,
       persistent Critical AI alerts
   ═══════════════════════════════════════════════════════════════ */

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
  accentDim: 'rgba(0,255,204,0.12)',
  accentGlow: 'rgba(0,255,204,0.30)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  gold: '#FFD700',
  purple: '#A78BFA',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id')
    if (!id) { id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('vive-session-id', id) }
    return id
  } catch { return 'guest-user' }
}

/* ═══════════════════════════════════════════════════════════════
   GHOST STATE — HUD-Aesthetic Skeleton Loaders
   
   Shimmering placeholders that match the dark HUD aesthetic
   while Convex fetches Bio-Pings / Protocol Drift data.
   ═══════════════════════════════════════════════════════════════ */

function GhostBar({ width, height = 4, delay = 0 }: { width: string; height?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.15 }}
      animate={{ opacity: [0.15, 0.35, 0.15] }}
      transition={{ duration: 2, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        width, height, borderRadius: height / 2,
        background: `linear-gradient(90deg, rgba(59,130,246,0.08) 0%, rgba(0,255,204,0.15) 50%, rgba(59,130,246,0.08) 100%)`,
        backgroundSize: '200% 100%',
      }}
    />
  )
}

function GhostCircle({ size = 36, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.12 }}
      animate={{ opacity: [0.12, 0.3, 0.12] }}
      transition={{ duration: 2.2, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(0,255,204,0.12) 0%, rgba(59,130,246,0.06) 70%, transparent 100%)`,
        border: `1px solid rgba(0,255,204,0.06)`,
      }}
    />
  )
}

function GhostText({ width, fontSize = 10, delay = 0 }: { width: string; fontSize?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.1 }}
      animate={{ opacity: [0.1, 0.28, 0.1] }}
      transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        width, height: fontSize + 2, borderRadius: 3,
        background: 'rgba(255,255,255,0.06)',
      }}
    />
  )
}

/** Full Ghost State skeleton matching the BiologicalTwin layout */
function BiologicalTwinGhost() {
  return (
    <div style={{
      margin: '0 16px', borderRadius: 20, overflow: 'hidden',
      background: T.surface, border: `1px solid ${T.borderBlue}`,
      position: 'relative',
    }}>
      {/* Ambient shimmer */}
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: -60, right: -40, width: 200, height: 200,
          background: `radial-gradient(circle, ${T.accentGlow} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header ghost */}
      <div style={{ padding: '16px 16px 0', position: 'relative', zIndex: 1 }}>
        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <GhostCircle size={6} />
          <GhostText width="120px" fontSize={9} />
          <div style={{ flex: 1 }} />
          <GhostText width="80px" fontSize={8} delay={0.3} />
        </div>

        {/* Hero metrics ghost */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          {/* Big number */}
          <div style={{ textAlign: 'center' }}>
            <GhostCircle size={52} delay={0.1} />
            <div style={{ marginTop: 4 }}>
              <GhostText width="60px" fontSize={8} delay={0.2} />
            </div>
          </div>

          {/* Divider */}
          <motion.div
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 1, height: 48, background: T.borderBlue }}
          />

          {/* Stats ghost */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <GhostText width="180px" fontSize={9} delay={0.15} />
            <div style={{ display: 'flex', gap: 12 }}>
              <GhostText width="55px" fontSize={13} delay={0.25} />
              <GhostText width="50px" fontSize={13} delay={0.35} />
              <GhostText width="55px" fontSize={13} delay={0.45} />
            </div>
            <GhostText width="100%" fontSize={8} delay={0.5} />
            <GhostText width="85%" fontSize={8} delay={0.6} />
          </div>
        </div>
      </div>

      {/* Chart ghost — SVG-shaped shimmer */}
      <div style={{ padding: '0 8px', height: 240, position: 'relative', overflow: 'hidden' }}>
        {/* Fake grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.03, 0.08, 0.03] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            style={{
              position: 'absolute', left: 44, right: 16,
              top: 24 + i * 45, height: 1,
              background: 'rgba(255,255,255,0.06)',
            }}
          />
        ))}

        {/* Fake curve paths */}
        <svg width="100%" height="100%" viewBox="0 0 360 240" style={{ position: 'absolute', top: 0, left: 0 }}>
          <motion.path
            d="M44,180 C100,175 160,160 220,140 S300,100 344,80"
            fill="none" stroke={T.red} strokeWidth="2" strokeDasharray="6,3"
            initial={{ opacity: 0.1 }}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M44,180 C100,178 160,172 220,162 S300,145 344,130"
            fill="none" stroke={T.accent} strokeWidth="2.5"
            initial={{ opacity: 0.1 }}
            animate={{ opacity: [0.1, 0.35, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3, ease: 'easeInOut' }}
          />
          {/* Gap fill ghost */}
          <motion.path
            d="M44,180 C100,175 160,160 220,140 S300,100 344,80 L344,130 C300,145 220,162 160,172 S100,178 44,180 Z"
            fill="rgba(0,255,204,0.03)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>

        {/* Scanning line */}
        <motion.div
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', top: 24, bottom: 36,
            width: 2, background: `linear-gradient(180deg, transparent, ${T.accent}40, transparent)`,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Legend ghost */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '8px 16px' }}>
        <GhostBar width="80px" height={2} delay={0.4} />
        <GhostBar width="80px" height={2} delay={0.6} />
      </div>

      {/* Expand button ghost */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 0', borderTop: `1px solid ${T.border}`,
      }}>
        <GhostText width="100px" fontSize={8} delay={0.7} />
      </div>

      {/* Scanning status */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 2,
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 12, height: 12, borderRadius: '50%',
            border: `1.5px solid ${T.borderBlue}`, borderTopColor: T.accent,
          }}
        />
        <span style={{
          fontSize: 8, fontFamily: 'monospace', color: T.textTer,
          fontWeight: 600, letterSpacing: '0.12em',
        }}>
          COMPUTING BIOLOGICAL TWIN…
        </span>
      </div>
    </div>
  )
}

/* ── Animated Counter ── */
function AnimatedNumber({ value, decimals = 1, prefix = '', suffix = '' }: {
  value: number; decimals?: number; prefix?: string; suffix?: string
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>(0)

  useEffect(() => {
    const start = ref.current
    const diff = value - start
    const duration = 1200
    const startTime = performance.now()
    let raf: number
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + diff * eased
      setDisplay(current)
      ref.current = current
      if (progress < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span>{prefix}{display.toFixed(decimals)}{suffix}</span>
}

/* ── Pillar Bar ── */
function PillarBar({ pillar, index }: {
  pillar: {
    key: string; label: string; icon: string; score: number;
    impact: number; yearsGained: number;
    status: 'optimal' | 'moderate' | 'needs-work';
  };
  index: number;
}) {
  const color = pillar.status === 'optimal' ? T.accent
    : pillar.status === 'moderate' ? T.blue : T.orange
  const glow = pillar.status === 'optimal' ? T.accentGlow
    : pillar.status === 'moderate' ? T.blueGlow : T.orangeGlow

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${pillar.status === 'optimal' ? T.accentDim : T.border}`,
      }}
    >
      <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{pillar.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
            color: T.text, letterSpacing: '0.02em',
          }}>
            {pillar.label}
          </span>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
            color, letterSpacing: '0.05em',
          }}>
            +{pillar.yearsGained} yr
          </span>
        </div>
        <div style={{
          height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
          overflow: 'hidden', position: 'relative',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pillar.score}%` }}
            transition={{ delay: 1.0 + index * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, ${color}88, ${color})`,
              boxShadow: `0 0 8px ${glow}`,
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TWIN CHART — SVG Lifetime Trajectory (Mobile-Optimized)
   ═══════════════════════════════════════════════════════════════ */
function TwinChart({
  chronoLine,
  optimizedLine,
  chronoAge,
  baseLifespan,
  longevityExtension,
  inflectionPoints,
}: {
  chronoLine: Array<{ year: number; chronoAge: number; bioAge: number }>;
  optimizedLine: Array<{ year: number; chronoAge: number; bioAge: number }>;
  chronoAge: number;
  baseLifespan: number;
  longevityExtension: number;
  inflectionPoints: Array<{ year: number; chronoAge: number; gap: number; label: string }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 360, h: 240 })
  const [hoverYear, setHoverYear] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setDims({ w: Math.max(300, width), h: 240 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const PAD = { top: 24, right: 16, bottom: 36, left: 44 }
  const plotW = dims.w - PAD.left - PAD.right
  const plotH = dims.h - PAD.top - PAD.bottom

  // Sample every N years for performance (show ~50 points max)
  const step = Math.max(1, Math.floor(chronoLine.length / 50))
  const sampledChrono = useMemo(() => chronoLine.filter((_, i) => i % step === 0 || i === chronoLine.length - 1), [chronoLine, step])
  const sampledOpt = useMemo(() => optimizedLine.filter((_, i) => i % step === 0 || i === optimizedLine.length - 1), [optimizedLine, step])

  const maxYear = chronoLine.length > 0 ? chronoLine[chronoLine.length - 1].year : 50
  const allBioAges = useMemo(() => [...chronoLine.map(p => p.bioAge), ...optimizedLine.map(p => p.bioAge)], [chronoLine, optimizedLine])
  const minAge = Math.floor(Math.min(...allBioAges) - 2)
  const maxAge = Math.ceil(Math.max(...allBioAges) + 2)
  const rangeAge = maxAge - minAge || 1

  const toX = useCallback((year: number) => PAD.left + (year / maxYear) * plotW, [maxYear, plotW])
  const toY = useCallback((age: number) => PAD.top + plotH - ((age - minAge) / rangeAge) * plotH, [plotH, minAge, rangeAge])

  const chronoPath = useMemo(() =>
    sampledChrono.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.year).toFixed(1)},${toY(p.bioAge).toFixed(1)}`).join(' '),
    [sampledChrono, toX, toY]
  )
  const optPath = useMemo(() =>
    sampledOpt.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.year).toFixed(1)},${toY(p.bioAge).toFixed(1)}`).join(' '),
    [sampledOpt, toX, toY]
  )

  // Gap fill between the two lines
  const gapFill = useMemo(() => {
    const top = sampledChrono.map(p => `${toX(p.year).toFixed(1)},${toY(p.bioAge).toFixed(1)}`)
    const bottom = [...sampledOpt].reverse().map(p => `${toX(p.year).toFixed(1)},${toY(p.bioAge).toFixed(1)}`)
    return `M${top.join(' L')} L${bottom.join(' L')} Z`
  }, [sampledChrono, sampledOpt, toX, toY])

  // Hover data
  const hoverData = useMemo(() => {
    if (hoverYear === null) return null
    const idx = Math.max(0, Math.min(chronoLine.length - 1, Math.round(hoverYear)))
    const c = chronoLine[idx]
    const o = optimizedLine[idx]
    if (!c || !o) return null
    return {
      year: idx,
      chronoAge: c.chronoAge,
      standardBio: c.bioAge,
      optimizedBio: o.bioAge,
      gap: +(c.bioAge - o.bioAge).toFixed(1),
      x: toX(idx),
      yStd: toY(c.bioAge),
      yOpt: toY(o.bioAge),
    }
  }, [hoverYear, chronoLine, optimizedLine, toX, toY])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const year = Math.round(((x - PAD.left) / plotW) * maxYear)
    setHoverYear(Math.max(0, Math.min(maxYear, year)))
  }, [plotW, maxYear])

  // Lifespan marker
  const lifespanYear = baseLifespan - chronoAge
  const extendedYear = lifespanYear + longevityExtension

  // Y-axis labels
  const yTicks = useMemo(() => {
    const count = 5
    return Array.from({ length: count }, (_, i) => {
      const val = minAge + (rangeAge / (count - 1)) * i
      return { val, y: toY(val) }
    })
  }, [minAge, rangeAge, toY])

  // X-axis labels (every 10 years)
  const xTicks = useMemo(() => {
    const ticks: number[] = []
    for (let y = 0; y <= maxYear; y += 10) ticks.push(y)
    return ticks
  }, [maxYear])

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverYear(null)}
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
      >
        <defs>
          <linearGradient id="bt-gap-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={T.accent} stopOpacity="0.03" />
            <stop offset="50%" stopColor={T.accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={T.accent} stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="bt-opt-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={T.accent} />
            <stop offset="100%" stopColor={T.green} />
          </linearGradient>
          <filter id="bt-glow-accent">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="bt-glow-red">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {xTicks.map(y => (
          <line key={`gx${y}`} x1={toX(y)} y1={PAD.top} x2={toX(y)} y2={PAD.top + plotH}
            stroke={T.border} strokeWidth="0.5" strokeDasharray="3,5" />
        ))}
        {yTicks.map((t, i) => (
          <g key={`gy${i}`}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + plotW} y2={t.y}
              stroke={T.border} strokeWidth="0.5" />
            <text x={PAD.left - 6} y={t.y} textAnchor="end" dominantBaseline="central"
              style={{ fontSize: 7, fill: T.textTer, fontFamily: 'monospace', fontWeight: 600 }}>
              {t.val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map(y => (
          <text key={`xl${y}`} x={toX(y)} y={dims.h - 8} textAnchor="middle"
            style={{ fontSize: 7, fill: T.textTer, fontFamily: 'monospace', fontWeight: 600 }}>
            {y === 0 ? 'Now' : `+${y}y`}
          </text>
        ))}

        {/* Gap fill between curves */}
        <path d={gapFill} fill="url(#bt-gap-grad)" />

        {/* Lifespan marker line */}
        {lifespanYear > 0 && lifespanYear <= maxYear && (
          <g>
            <line x1={toX(lifespanYear)} y1={PAD.top} x2={toX(lifespanYear)} y2={PAD.top + plotH}
              stroke={T.red} strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
            <text x={toX(lifespanYear)} y={PAD.top - 6} textAnchor="middle"
              style={{ fontSize: 7, fill: T.red, fontFamily: 'monospace', fontWeight: 700, opacity: 0.7 }}>
              AVG LIFESPAN
            </text>
          </g>
        )}

        {/* Extended lifespan marker */}
        {extendedYear > 0 && extendedYear <= maxYear && (
          <g>
            <line x1={toX(extendedYear)} y1={PAD.top} x2={toX(extendedYear)} y2={PAD.top + plotH}
              stroke={T.accent} strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
            <text x={toX(extendedYear)} y={PAD.top - 6} textAnchor="middle"
              style={{ fontSize: 7, fill: T.accent, fontFamily: 'monospace', fontWeight: 700, opacity: 0.8 }}>
              VIVE EXTENSION
            </text>
          </g>
        )}

        {/* Chronological line (standard aging — red/orange) */}
        <path d={chronoPath} fill="none" stroke={T.red} strokeWidth="2" opacity="0.6"
          strokeDasharray="6,3" />

        {/* Optimized line (Vive Protocol — accent/green with glow) */}
        <path d={optPath} fill="none" stroke="url(#bt-opt-grad)" strokeWidth="2.5"
          filter="url(#bt-glow-accent)" />

        {/* Inflection point markers */}
        {inflectionPoints.map((ip, i) => (
          <g key={`ip${i}`}>
            <circle cx={toX(ip.year)} cy={toY(optimizedLine[ip.year]?.bioAge ?? 0)}
              r="4" fill={T.accent} opacity="0.7" filter="url(#bt-glow-accent)" />
            <circle cx={toX(ip.year)} cy={toY(optimizedLine[ip.year]?.bioAge ?? 0)}
              r="2" fill="#fff" opacity="0.9" />
          </g>
        ))}

        {/* Start dot */}
        <circle cx={toX(0)} cy={toY(optimizedLine[0]?.bioAge ?? 0)}
          r="4" fill={T.accent} filter="url(#bt-glow-accent)" />
        <circle cx={toX(0)} cy={toY(chronoLine[0]?.bioAge ?? 0)}
          r="3" fill={T.red} opacity="0.7" />

        {/* Hover crosshair */}
        {hoverData && (
          <g>
            <line x1={hoverData.x} y1={PAD.top} x2={hoverData.x} y2={PAD.top + plotH}
              stroke={T.textTer} strokeWidth="0.5" />
            <line x1={hoverData.x} y1={hoverData.yStd} x2={hoverData.x} y2={hoverData.yOpt}
              stroke={T.accent} strokeWidth="1.5" opacity="0.5" strokeDasharray="2,2" />
            <circle cx={hoverData.x} cy={hoverData.yStd} r="4" fill={T.red} opacity="0.8" />
            <circle cx={hoverData.x} cy={hoverData.yOpt} r="5" fill={T.accent}
              filter="url(#bt-glow-accent)" />
            <circle cx={hoverData.x} cy={hoverData.yOpt} r="2.5" fill="#fff" />
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoverData && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: Math.min(hoverData.x - 70, dims.w - 160),
              top: Math.min(hoverData.yOpt - 72, dims.h - 80),
              background: 'rgba(10,10,11,0.95)',
              border: `1px solid ${T.borderBlue}`,
              borderRadius: 8, padding: '6px 10px',
              backdropFilter: 'blur(12px)',
              pointerEvents: 'none', zIndex: 10,
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, marginBottom: 3, fontWeight: 700, letterSpacing: '0.1em' }}>
              AGE {hoverData.chronoAge} · +{hoverData.year}Y
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.red }}>
                Standard: {hoverData.standardBio.toFixed(1)}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.accent, fontWeight: 700 }}>
                Vive: {hoverData.optimizedBio.toFixed(1)}
              </span>
            </div>
            <div style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
              color: T.accent, textAlign: 'center', marginTop: 2,
            }}>
              {hoverData.gap > 0 ? `${hoverData.gap} yr younger` : 'Converging'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 20, marginTop: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 16, height: 2, background: T.red, opacity: 0.6, borderRadius: 1 }} />
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, fontWeight: 600 }}>
            STANDARD AGING
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 16, height: 2.5, background: `linear-gradient(90deg, ${T.accent}, ${T.green})`, borderRadius: 1 }} />
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, fontWeight: 600 }}>
            VIVE PROTOCOL
          </span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PERSISTENT CRITICAL ALERTS — AI Brain Alerts
   
   Critical alerts from the AI Brain persist on screen until
   explicitly dismissed by the user. Stored in localStorage
   to survive page refreshes.
   ═══════════════════════════════════════════════════════════════ */

const CRITICAL_ALERTS_KEY = 'vive-critical-alerts'

interface CriticalAlert {
  id: string
  message: string
  severity: 'critical' | 'warning'
  source: string
  timestamp: number
  dismissed: boolean
}

function loadCriticalAlerts(): CriticalAlert[] {
  try {
    const raw = localStorage.getItem(CRITICAL_ALERTS_KEY)
    if (!raw) return []
    const alerts = JSON.parse(raw) as CriticalAlert[]
    // Prune alerts older than 48 hours
    const cutoff = Date.now() - 48 * 60 * 60 * 1000
    return alerts.filter(a => !a.dismissed && a.timestamp > cutoff)
  } catch { return [] }
}

function saveCriticalAlerts(alerts: CriticalAlert[]) {
  try { localStorage.setItem(CRITICAL_ALERTS_KEY, JSON.stringify(alerts)) } catch { /* noop */ }
}

function PersistentCriticalAlerts() {
  const [alerts, setAlerts] = useState<CriticalAlert[]>(() => loadCriticalAlerts())

  // Listen for new critical alerts from AI Brain
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.message) return
      const newAlert: CriticalAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        message: detail.message,
        severity: detail.severity || 'critical',
        source: detail.source || 'AI Brain',
        timestamp: Date.now(),
        dismissed: false,
      }
      setAlerts(prev => {
        const updated = [...prev, newAlert]
        saveCriticalAlerts(updated)
        return updated
      })
    }
    window.addEventListener('vive-critical-alert', handler)
    return () => window.removeEventListener('vive-critical-alert', handler)
  }, [])

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, dismissed: true } : a).filter(a => !a.dismissed)
      saveCriticalAlerts(updated)
      return updated
    })
  }, [])

  const active = alerts.filter(a => !a.dismissed)
  if (active.length === 0) return null

  return (
    <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {active.map(alert => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          style={{
            padding: '8px 12px', borderRadius: 10,
            background: alert.severity === 'critical'
              ? 'rgba(255,59,59,0.08)' : 'rgba(232,151,108,0.08)',
            border: `1px solid ${alert.severity === 'critical'
              ? 'rgba(255,59,59,0.25)' : 'rgba(232,151,108,0.2)'}`,
            display: 'flex', alignItems: 'flex-start', gap: 8,
            position: 'relative',
          }}
        >
          {/* Pulsing indicator */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 2, flexShrink: 0,
              background: alert.severity === 'critical' ? T.red : T.orange,
              boxShadow: `0 0 8px ${alert.severity === 'critical' ? T.redGlow : T.orangeGlow}`,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: alert.severity === 'critical' ? T.red : T.orange,
              letterSpacing: '0.1em', marginBottom: 2,
            }}>
              {alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING'} · {alert.source.toUpperCase()}
            </div>
            <div style={{
              fontSize: 10, fontFamily: 'monospace', color: T.text,
              lineHeight: 1.4, fontWeight: 500,
            }}>
              {alert.message}
            </div>
            <div style={{
              fontSize: 7, fontFamily: 'monospace', color: T.textTer,
              marginTop: 3,
            }}>
              {new Date(alert.timestamp).toLocaleTimeString()} · Persists until dismissed
            </div>
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: T.textSec, letterSpacing: '0.05em',
              flexShrink: 0,
            }}
          >
            DISMISS
          </button>
        </motion.div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — BiologicalTwin
   ═══════════════════════════════════════════════════════════════ */
export default function BiologicalTwin() {
  const sessionId = useMemo(() => getSessionId(), [])
  const data = useQuery(api.biologicalTwin.getBiologicalTwin, { sessionId })
  const [expanded, setExpanded] = useState(false)

  /* ── Somatic History Morphing ── */
  const [historyState, setHistoryState] = useState<{
    active: boolean
    inflammationLevel: number
    coherenceLevel: number
    vitalityScore: number
    dayLabel: string
    dayOffset: number
  } | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (!d) { setHistoryState(null); return }
      if (d.dayOffset === 0) { setHistoryState(null); return }
      setHistoryState({
        active: true,
        inflammationLevel: d.inflammationLevel ?? 0,
        coherenceLevel: d.coherenceLevel ?? 0,
        vitalityScore: d.vitalityScore ?? 0,
        dayLabel: d.dayLabel ?? '',
        dayOffset: d.dayOffset ?? 0,
      })
    }
    window.addEventListener('vive-history-day', handler)
    return () => window.removeEventListener('vive-history-day', handler)
  }, [])

  // Derived morph colors
  const morphGlow = useMemo(() => {
    if (!historyState?.active) return null
    const inf = historyState.inflammationLevel
    const coh = historyState.coherenceLevel
    // High inflammation → red/orange aura
    if (inf > 60) return { color: T.red, glow: T.redGlow, label: 'HIGH INFLAMMATION', opacity: 0.3 + (inf - 60) / 100 }
    if (inf > 35) return { color: T.orange, glow: T.orangeGlow, label: 'MODERATE INFLAMMATION', opacity: 0.2 + (inf - 35) / 130 }
    // High coherence → accent/green aura
    if (coh > 70) return { color: T.accent, glow: T.accentGlow, label: 'HIGH COHERENCE', opacity: 0.25 + (coh - 70) / 120 }
    if (coh > 45) return { color: T.blue, glow: T.blueGlow, label: 'MODERATE COHERENCE', opacity: 0.15 }
    return { color: T.textTer, glow: 'rgba(255,255,255,0.05)', label: 'LOW SIGNAL', opacity: 0.1 }
  }, [historyState])

  // Show Ghost State skeleton while loading
  if (!data) {
    return <BiologicalTwinGhost />
  }

  const {
    chronologicalAge, currentBioAge, currentDelta, baseLifespan,
    longevityExtension, chronologicalLine, optimizedLine,
    inflectionPoints, pillarImpact, confidence,
  } = data

  const isYounger = currentDelta < 0
  const statusColor = isYounger ? T.accent : currentDelta < 2 ? T.blue : T.orange

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: '0 16px', borderRadius: 20, overflow: 'hidden',
        background: T.surface,
        border: `1px solid ${T.borderBlue}`,
        position: 'relative',
      }}
    >
      {/* Ambient glow — morphs based on history state */}
      <div style={{
        position: 'absolute', top: -60, right: -40, width: 200, height: 200,
        background: `radial-gradient(circle, ${morphGlow?.glow ?? T.accentGlow} 0%, transparent 70%)`,
        pointerEvents: 'none', opacity: morphGlow?.opacity ?? 0.4,
        transition: 'all 0.6s ease-out',
      }} />

      {/* History morph overlay — inflammation/coherence aura */}
      {morphGlow && historyState?.active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            borderRadius: 20, overflow: 'hidden',
          }}
        >
          {/* Pulsing aura ring */}
          <motion.div
            animate={{
              boxShadow: [
                `inset 0 0 30px ${morphGlow.glow}`,
                `inset 0 0 50px ${morphGlow.color}30`,
                `inset 0 0 30px ${morphGlow.glow}`,
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: 20 }}
          />
          {/* Coherence ripples — concentric rings for high coherence */}
          {historyState.coherenceLevel > 60 && (
            <>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [0.3, 1.2],
                    opacity: [0.3, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 1,
                    ease: 'easeOut',
                  }}
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    width: 120, height: 120,
                    marginTop: -60, marginLeft: -60,
                    borderRadius: '50%',
                    border: `1px solid ${morphGlow.color}40`,
                    pointerEvents: 'none',
                  }}
                />
              ))}
            </>
          )}
          {/* Time-travel badge */}
          <div style={{
            position: 'absolute', top: 8, right: 12,
            padding: '3px 8px', borderRadius: 6,
            background: `${morphGlow.color}15`,
            border: `1px solid ${morphGlow.color}30`,
            display: 'flex', alignItems: 'center', gap: 5,
            zIndex: 3,
          }}>
            <motion.div
              animate={{ rotate: [0, -15, 0, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 10 }}
            >
              ⏳
            </motion.div>
            <span style={{
              fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
              color: morphGlow.color, letterSpacing: '0.1em',
            }}>
              {historyState.dayLabel} · {morphGlow.label}
            </span>
          </div>
        </motion.div>
      )}

      {/* Persistent Critical Alerts */}
      <PersistentCriticalAlerts />

      {/* Header */}
      <div style={{ padding: '16px 16px 0', position: 'relative', zIndex: 1 }}>
        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: T.accent, boxShadow: `0 0 8px ${T.accentGlow}`,
          }} />
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: T.accent, letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            BIOLOGICAL TWIN
          </span>
          <div style={{ flex: 1 }} />
          <div style={{
            fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
            color: T.textTer, letterSpacing: '0.08em',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${T.border}`,
          }}>
            {confidence}% CONFIDENCE
          </div>
        </div>

        {/* Longevity Extension Hero */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
        }}>
          {/* Extension number */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 36, fontWeight: 800, fontFamily: 'monospace',
              color: T.accent, lineHeight: 1,
              textShadow: `0 0 20px ${T.accentGlow}`,
            }}>
              <AnimatedNumber value={longevityExtension} prefix="+" suffix="" />
            </div>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              color: T.accentDim, letterSpacing: '0.12em', marginTop: 2,
              textTransform: 'uppercase',
            }}>
              YEARS GAINED
            </div>
          </div>

          {/* Divider */}
          <div style={{
            width: 1, height: 48, background: T.borderBlue,
          }} />

          {/* Current state */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', color: T.textTer,
              fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4,
            }}>
              PROJECTED LONGEVITY EXTENSION
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
                  BIO AGE{' '}
                </span>
                <span style={{
                  fontSize: 13, fontFamily: 'monospace', fontWeight: 800,
                  color: statusColor,
                }}>
                  {currentBioAge.toFixed(1)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
                  CHRONO{' '}
                </span>
                <span style={{
                  fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
                  color: T.textSec,
                }}>
                  {chronologicalAge}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textQuad, fontWeight: 600 }}>
                  DELTA{' '}
                </span>
                <span style={{
                  fontSize: 13, fontFamily: 'monospace', fontWeight: 800,
                  color: statusColor,
                }}>
                  {isYounger ? '' : '+'}{currentDelta.toFixed(1)}y
                </span>
              </div>
            </div>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', color: T.textTer,
              marginTop: 4, lineHeight: 1.4,
            }}>
              Based on avg lifespan of {baseLifespan}, your Vive Protocol trajectory
              projects {longevityExtension.toFixed(1)} additional years of healthspan.
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '0 8px' }}>
        <TwinChart
          chronoLine={chronologicalLine}
          optimizedLine={optimizedLine}
          chronoAge={chronologicalAge}
          baseLifespan={baseLifespan}
          longevityExtension={longevityExtension}
          inflectionPoints={inflectionPoints}
        />
      </div>

      {/* Inflection Points */}
      {inflectionPoints.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto',
        }}>
          {inflectionPoints.map((ip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              style={{
                flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                background: 'rgba(0,255,204,0.04)',
                border: `1px solid ${T.accentDim}`,
              }}
            >
              <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, fontWeight: 600, letterSpacing: '0.08em' }}>
                AGE {ip.chronoAge}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: T.accent, fontWeight: 800 }}>
                {ip.gap}yr gap
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, width: '100%', padding: '8px 0',
          background: 'transparent', border: 'none', cursor: 'pointer',
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <span style={{
          fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
          color: T.textTer, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {expanded ? 'COLLAPSE PILLARS' : 'PILLAR BREAKDOWN'}
        </span>
        <span style={{
          fontSize: 10, color: T.textTer,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s',
        }}>
          ▼
        </span>
      </button>

      {/* Pillar Breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '4px 16px 16px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{
                fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                fontWeight: 600, letterSpacing: '0.1em', marginBottom: 4,
              }}>
                YEARS GAINED BY PILLAR
              </div>
              {pillarImpact.map((p, i) => (
                <PillarBar key={p.key} pillar={p} index={i} />
              ))}

              {/* Compounding note */}
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(0,255,204,0.03)',
                border: `1px solid ${T.accentDim}`,
              }}>
                <div style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  color: T.accent, letterSpacing: '0.1em', marginBottom: 3,
                }}>
                  ⚡ COMPOUNDING EFFECT
                </div>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', color: T.textSec,
                  lineHeight: 1.5,
                }}>
                  Your protocol consistency compounds over time. Each year of adherence
                  slightly improves your future aging rate. Current consistency multiplier:{' '}
                  <span style={{ color: T.accent, fontWeight: 700 }}>
                    {data.consistencyMultiplier}x
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
