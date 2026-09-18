import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getTwinSessionId } from '@/lib/twinSession'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL OPERATING SYSTEM
   
   Single high-level metric for biological optimization progress.
   Maps each biomarker to its governing protocol, visualizes
   daily adherence as a trending score, and highlights which
   biological systems are being actively optimized.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceAlt: 'rgba(18,18,24,0.70)',
  elevated: 'rgba(22,22,30,0.90)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  blueMuted: 'rgba(59,130,246,0.08)',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  amber: '#FBBF24',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  supplement: { icon: '💊', label: 'Supplementation', color: '#A78BFA' },
  training: { icon: '🏋️', label: 'Training', color: '#F472B6' },
  biohacking: { icon: '🧬', label: 'Biohacking', color: '#34D399' },
  nutrition: { icon: '🥩', label: 'Nutrition', color: '#FB923C' },
  recovery: { icon: '😴', label: 'Recovery', color: '#60A5FA' },
  movement: { icon: '🚶', label: 'Movement', color: '#FBBF24' },
}

const STATUS_COLORS: Record<string, string> = {
  optimal: T.green,
  suboptimal: T.amber,
  critical: T.red,
  unknown: T.textTer,
}

/* ── Adherence Score Ring ── */
function AdherenceRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? T.green : score >= 50 ? T.amber : T.red
  const glowColor = score >= 80 ? 'rgba(0,220,130,0.3)' : score >= 50 ? 'rgba(251,191,36,0.3)' : 'rgba(255,107,107,0.3)'

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s', filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 800, fontFamily: 'monospace', color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
          ADHERENCE
        </span>
      </div>
    </div>
  )
}

/* ── 30-Day Trend Sparkline ── */
function AdherenceTrendChart({ data, width = 320, height = 100 }: {
  data: { dateKey: string; adherencePercent: number }[]
  width?: number
  height?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgW, setSvgW] = useState(width)

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setSvgW(e.contentRect.width)
    })
    obs.observe(el)
    setSvgW(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const padL = 28, padR = 8, padT = 8, padB = 20
  const maxVal = 100
  const toX = (i: number) => padL + (i / (data.length - 1)) * (svgW - padL - padR)
  const toY = (v: number) => padT + ((maxVal - v) / maxVal) * (height - padT - padB)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.adherencePercent)}`).join(' ')
  const areaPath = `${linePath} L${toX(data.length - 1)},${height - padB} L${padL},${height - padB} Z`

  // 80% threshold line
  const thresholdY = toY(80)

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%" height={height}
        style={{ display: 'block' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const idx = Math.round(((x - padL) / (svgW - padL - padR)) * (data.length - 1))
          setHovered(Math.max(0, Math.min(data.length - 1, idx)))
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={padL} y1={toY(v)} x2={svgW - padR} y2={toY(v)} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <text x={padL - 4} y={toY(v) + 3} textAnchor="end" fill={T.textTer} fontSize={7} fontFamily="monospace">{v}</text>
          </g>
        ))}

        {/* 80% threshold */}
        <line x1={padL} y1={thresholdY} x2={svgW - padR} y2={thresholdY}
          stroke={T.green} strokeWidth={1} strokeDasharray="4,4" opacity={0.3} />
        <text x={svgW - padR + 2} y={thresholdY + 3} fill={T.green} fontSize={6} fontFamily="monospace" opacity={0.5}>80%</text>

        {/* Area fill */}
        <defs>
          <linearGradient id="pos-adherence-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.blue} stopOpacity={0.2} />
            <stop offset="100%" stopColor={T.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#pos-adherence-grad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={T.blue} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${T.blue}50)` }}
        />

        {/* Data points for days with data */}
        {data.map((d, i) => d.adherencePercent > 0 ? (
          <circle key={i} cx={toX(i)} cy={toY(d.adherencePercent)} r={2}
            fill={d.adherencePercent >= 80 ? T.green : d.adherencePercent >= 50 ? T.amber : T.red}
            opacity={0.6}
          />
        ) : null)}

        {/* Hover */}
        {hovered !== null && (
          <g>
            <line x1={toX(hovered)} y1={padT} x2={toX(hovered)} y2={height - padB}
              stroke="rgba(59,130,246,0.3)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={toX(hovered)} cy={toY(data[hovered].adherencePercent)} r={4}
              fill={T.blue} stroke={T.bg} strokeWidth={2} />
          </g>
        )}

        {/* X-axis labels */}
        {data.filter((_, i) => i % 7 === 0 || i === data.length - 1).map((d) => {
          const idx = data.indexOf(d)
          const parts = d.dateKey.split('-')
          const label = `${parseInt(parts[1])}/${parseInt(parts[2])}`
          return (
            <text key={idx} x={toX(idx)} y={height - 4} textAnchor="middle"
              fill={T.textTer} fontSize={7} fontFamily="monospace">{label}</text>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered !== null && (
        <div style={{
          position: 'absolute', top: 4,
          left: Math.min(svgW - 100, Math.max(4, toX(hovered) - 45)),
          background: T.elevated, border: `1px solid ${T.borderBlue}`,
          borderRadius: 8, padding: '4px 8px', backdropFilter: 'blur(12px)',
          pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer }}>{data[hovered].dateKey}</div>
          <div style={{
            fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
            color: data[hovered].adherencePercent >= 80 ? T.green : data[hovered].adherencePercent >= 50 ? T.amber : T.red,
          }}>
            {data[hovered].adherencePercent}%
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Category Health Card ── */
function CategoryCard({ category, total, completed, adherence, biomarker, bioValue, bioUnit, bioOptimal, bioStatus }: {
  category: string; total: number; completed: number; adherence: number
  biomarker: string; bioValue: number | null; bioUnit: string; bioOptimal: string; bioStatus: string
}) {
  const meta = CATEGORY_META[category] ?? { icon: '📋', label: category, color: T.blue }
  const statusColor = STATUS_COLORS[bioStatus] ?? T.textTer

  return (
    <div style={{
      background: T.surfaceAlt, borderRadius: 14, padding: '10px 12px',
      border: `1px solid ${bioStatus === 'critical' ? 'rgba(255,107,107,0.2)' : bioStatus === 'suboptimal' ? 'rgba(251,191,36,0.15)' : T.border}`,
      transition: 'all 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: T.text, letterSpacing: '0.04em' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
            {completed}/{total} protocols
          </div>
        </div>
        {/* Adherence pill */}
        <div style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
          color: adherence >= 80 ? T.green : adherence >= 50 ? T.amber : T.red,
          background: adherence >= 80 ? 'rgba(0,220,130,0.1)' : adherence >= 50 ? 'rgba(251,191,36,0.1)' : 'rgba(255,107,107,0.1)',
          border: `1px solid ${adherence >= 80 ? 'rgba(0,220,130,0.2)' : adherence >= 50 ? 'rgba(251,191,36,0.2)' : 'rgba(255,107,107,0.2)'}`,
        }}>
          {adherence}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', marginBottom: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, width: `${adherence}%`,
          background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})`,
          transition: 'width 0.6s ease',
          boxShadow: `0 0 8px ${meta.color}40`,
        }} />
      </div>

      {/* Biomarker link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}60` }} />
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textSec }}>
          {biomarker}:
        </span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: statusColor }}>
          {bioValue !== null ? `${bioValue} ${bioUnit}` : 'No data'}
        </span>
        <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, marginLeft: 'auto' }}>
          optimal: {bioOptimal}
        </span>
      </div>
    </div>
  )
}

/* ── Main Protocol Operating System Component ── */
export default function ProtocolOperatingSystem() {
  const sessionId = getTwinSessionId()

  const bioMap = useQuery(api.protocols.getBiomarkerProtocolMap, { sessionId })
  const adherence30 = useQuery(api.protocols.getAdherenceHistory30d, { sessionId })
  const activeProtocols = useQuery(api.protocols.getActiveProtocols, { sessionId })
  const toggleCompletion = useMutation(api.mutations.toggleProtocolCompletion)
  const seedDefaults = useMutation(api.protocols.seedDefaults)

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const seededRef = useRef(false)

  // Auto-seed starter stack once when twin has zero protocols (personal log scaffolding — not clinical advice)
  useEffect(() => {
    if (seededRef.current || seeding) return
    if (activeProtocols === undefined) return
    if (Array.isArray(activeProtocols) && activeProtocols.length > 0) {
      seededRef.current = true
      return
    }
    seededRef.current = true
    setSeeding(true)
    seedDefaults({ sessionId })
      .catch(() => { /* ignore */ })
      .finally(() => setSeeding(false))
  }, [activeProtocols, sessionId, seedDefaults, seeding])

  const categories = useMemo(() => {
    const cats = bioMap?.categories ?? []
    return cats.map((c: any) => ({
      category: c.category,
      total: c.total ?? 0,
      completed: c.completed ?? 0,
      adherence: c.adherence ?? 0,
      biomarker: c.biomarker ?? c.category,
      bioValue: c.bioValue ?? null,
      bioUnit: c.bioUnit ?? '',
      bioOptimal: c.bioOptimal ?? '—',
      bioStatus: c.bioStatus ?? 'unknown',
    }))
  }, [bioMap])

  const protocols = useMemo(() => {
    const mappings = bioMap?.mappings ?? []
    if (mappings.length > 0) {
      return mappings.map((m: any) => ({
        _id: m.protocolId,
        name: m.protocolName,
        icon: m.protocolIcon ?? '•',
        category: m.category,
        completed: !!m.completed,
        timeOfDay: '',
      }))
    }
    // Fallback from active protocols list
    return (activeProtocols ?? []).map((p: any) => ({
      _id: p._id,
      name: p.name,
      icon: p.icon ?? '•',
      category: p.category,
      completed: false,
      timeOfDay: p.timeOfDay ?? '',
    }))
  }, [bioMap, activeProtocols])

  const protocolStatus = useMemo(() => ({
    done: categories.reduce((s: number, c: any) => s + c.completed, 0),
    total: categories.reduce((s: number, c: any) => s + c.total, 0),
  }), [categories])

  const todayScore = protocolStatus.total > 0
    ? Math.round((protocolStatus.done / protocolStatus.total) * 100)
    : (adherence30 as any)?.average ?? 0

  const avg30d = (adherence30 as any)?.average ?? 0
  const streak = (adherence30 as any)?.streak ?? 0
  const trendData: { dateKey: string; adherencePercent: number }[] =
    ((adherence30 as any)?.days ?? []).map((d: any) => ({
      dateKey: d.dateKey ?? d.date ?? '',
      adherencePercent: d.adherencePercent ?? d.completion ?? d.completionPercent ?? 0,
    }))

  const trendDir = useMemo(() => {
    if (trendData.length < 7) return 'flat'
    const recent = trendData.slice(-7).filter(d => d.adherencePercent > 0)
    const older = trendData.slice(-14, -7).filter(d => d.adherencePercent > 0)
    if (recent.length === 0 || older.length === 0) return 'flat'
    const recentAvg = recent.reduce((s, d) => s + d.adherencePercent, 0) / recent.length
    const olderAvg = older.reduce((s, d) => s + d.adherencePercent, 0) / older.length
    return recentAvg > olderAvg + 3 ? 'up' : recentAvg < olderAvg - 3 ? 'down' : 'flat'
  }, [trendData])

  const handleToggle = async (protocolId: string) => {
    try {
      await toggleCompletion({ sessionId, protocolItemId: protocolId })
    } catch { /* ignore */ }
  }

  const empty = !seeding && protocolStatus.total === 0 && activeProtocols !== undefined

  return (
    <div style={{ padding: '16px 16px 110px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{
        fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.14em',
        color: 'rgba(255,255,255,0.28)', marginBottom: 12, textTransform: 'uppercase' as const,
      }}>
        Personal twin log · Not medical advice · Track what you log
      </div>
      {seeding && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid rgba(0,255,204,0.15)', background: 'rgba(0,255,204,0.05)',
          fontSize: 10, fontFamily: 'monospace', color: 'rgba(0,255,204,0.8)',
        }}>
          Seeding starter protocol stack…
        </div>
      )}
      {empty && (
        <div style={{
          marginBottom: 12, padding: '12px 14px', borderRadius: 12,
          border: '1px solid rgba(196,164,108,0.2)', background: 'rgba(196,164,108,0.06)',
          fontSize: 11, fontFamily: 'monospace', color: 'rgba(232,224,216,0.75)', lineHeight: 1.5,
        }}>
          No protocols yet. Starter stack seeds automatically — pull to refresh or use Quick Log (V) to add items.
        </div>
      )}

      {/* ═══ HEADER: Adherence Score + Stats ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}
      >
        <AdherenceRing score={todayScore} size={110} />

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: T.text, marginBottom: 4 }}>
            Protocol OS
          </div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textSec, lineHeight: 1.5, marginBottom: 8 }}>
            {todayScore >= 80 ? 'All systems nominal — biological optimization on track.' :
             todayScore >= 50 ? 'Moderate adherence — complete remaining protocols to optimize.' :
             todayScore > 0 ? 'Low adherence — prioritize critical protocols now.' :
             'No protocols completed yet today.'}
          </div>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: '30d Avg', value: `${avg30d}%`, color: avg30d >= 80 ? T.green : avg30d >= 50 ? T.amber : T.red },
              { label: 'Streak', value: `${streak}d`, color: streak >= 7 ? T.green : streak >= 3 ? T.amber : T.textSec },
              { label: 'Trend', value: trendDir === 'up' ? '↑ Rising' : trendDir === 'down' ? '↓ Falling' : '→ Stable', color: trendDir === 'up' ? T.green : trendDir === 'down' ? T.red : T.textSec },
              { label: 'Today', value: `${protocolStatus?.done ?? 0}/${protocolStatus?.total ?? 0}`, color: T.blueBright },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '3px 8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4,
                background: T.surfaceAlt, border: `1px solid ${T.border}`,
              }}>
                <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══ 30-DAY TREND ═══ */}
      {trendData.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            background: T.surface, borderRadius: 14, border: `1px solid ${T.borderBlue}`,
            padding: '10px 8px 6px', marginBottom: 14, overflow: 'hidden', position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: '40%',
            background: `radial-gradient(ellipse, ${T.blueGlow}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '0 4px' }}>
            <span style={{ fontSize: 10 }}>📊</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: T.text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              30-Day Adherence Trend
            </span>
          </div>
          <AdherenceTrendChart data={trendData} height={90} />
        </motion.div>
      )}

      {/* ═══ BIOMARKER ↔ PROTOCOL MAP ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{ marginBottom: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
          <span style={{ fontSize: 10 }}>🧬</span>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: T.text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Biomarker ↔ Protocol Map
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer }}>
            {categories.filter((c: any) => c.bioStatus === 'optimal').length}/{categories.length} optimal
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map((cat: any) => (
            <div key={cat.category} onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)} style={{ cursor: 'pointer' }}>
              <CategoryCard
                category={cat.category}
                total={cat.total}
                completed={cat.completed}
                adherence={cat.adherence}
                biomarker={cat.biomarker}
                bioValue={cat.bioValue}
                bioUnit={cat.bioUnit}
                bioOptimal={cat.bioOptimal}
                bioStatus={cat.bioStatus}
              />

              {/* Expanded: show individual protocols */}
              <AnimatePresence>
                {expandedCategory === cat.category && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '6px 0 0 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {protocols.filter(p => p.category === cat.category).map((p) => (
                        <div
                          key={p._id}
                          onClick={(e) => { e.stopPropagation(); handleToggle(p._id) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 8px', borderRadius: 8,
                            background: p.completed ? 'rgba(0,220,130,0.06)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${p.completed ? 'rgba(0,220,130,0.15)' : T.border}`,
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: p.completed ? T.green : 'transparent',
                            border: `1.5px solid ${p.completed ? T.green : 'rgba(255,255,255,0.15)'}`,
                            fontSize: 9, color: '#fff', transition: 'all 0.2s',
                          }}>
                            {p.completed ? '✓' : ''}
                          </div>
                          <span style={{ fontSize: 11 }}>{p.icon}</span>
                          <span style={{
                            fontSize: 10, fontFamily: 'monospace', color: p.completed ? T.green : T.text,
                            textDecoration: p.completed ? 'line-through' : 'none',
                            opacity: p.completed ? 0.7 : 1,
                          }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, marginLeft: 'auto' }}>
                            {p.timeOfDay}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ═══ OPTIMIZATION INSIGHT ═══ */}
      {categories.some((c: any) => c.bioStatus === 'critical') && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: 'rgba(255,107,107,0.06)', borderRadius: 12,
            border: '1px solid rgba(255,107,107,0.15)', padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11 }}>⚠️</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: T.red, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Optimization Alert
            </span>
          </div>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: T.textSec, margin: 0, lineHeight: 1.5 }}>
            {(() => {
              const critical = categories.find((c: any) => c.bioStatus === 'critical')
              if (!critical) return ''
              const meta = CATEGORY_META[critical.category]
              return `${meta?.label ?? critical.category} logged marker looks off-range (${critical.biomarker}: ${critical.bioValue ?? 'N/A'} ${critical.bioUnit}). Review your ${meta?.label?.toLowerCase()} protocols and discuss with your clinician — Vive does not diagnose or prescribe.`
            })()}
          </p>
        </motion.div>
      )}
    </div>
  )
}
