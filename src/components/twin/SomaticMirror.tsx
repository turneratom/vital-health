/* ══════════════════════════════════════════════════════════════════
   SOMATIC MIRROR — Digital Twin Body Visualization
   
   Renders a simplified SVG human silhouette with body regions
   mapped to protocol categories. When critical protocols are
   overdue, the corresponding body region glows with an amber
   warning pulse — visualizing "biological debt" in real time.
   
   Category → Body Region Mapping:
   • training / movement → Musculature (arms, legs, core)
   • supplement          → Metabolic Core (gut, liver)
   • recovery            → Nervous System (spine, brain stem)
   • biohacking          → Neural (brain, head)
   • nutrition           → Digestive (stomach, intestines)
   ══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  getBiologicalWindow,
  isCriticalOverdue,
  OVERDUE_AMBER,
  type WindowInfo,
} from '@/lib/utils'

/* ── Design Tokens ── */
const T = {
  bg: 'rgba(10,10,12,0.6)',
  silhouette: 'rgba(255,255,255,0.04)',
  silhouetteStroke: 'rgba(255,255,255,0.08)',
  optimal: '#00FFCC',
  optimalGlow: 'rgba(0,255,204,',
  amber: OVERDUE_AMBER.color,
  amberGlow: OVERDUE_AMBER.glow,
  text: '#E8E8EC',
  muted: 'rgba(255,255,255,0.4)',
  dim: 'rgba(255,255,255,0.2)',
}

/* ── Body Region Definitions ── */
interface BodyRegion {
  id: string
  label: string
  categories: string[]
  /** SVG path for the region highlight zone */
  path: string
  /** Center point for glow origin */
  cx: number
  cy: number
  /** Glow radius */
  r: number
}

const BODY_REGIONS: BodyRegion[] = [
  {
    id: 'neural',
    label: 'Neural',
    categories: ['biohacking'],
    path: 'M48,18 C48,10 52,6 60,6 C68,6 72,10 72,18 C72,26 68,30 60,30 C52,30 48,26 48,18 Z',
    cx: 60, cy: 18, r: 16,
  },
  {
    id: 'nervous',
    label: 'Nervous System',
    categories: ['recovery'],
    path: 'M56,30 L64,30 L64,52 L60,54 L56,52 Z',
    cx: 60, cy: 42, r: 14,
  },
  {
    id: 'metabolic',
    label: 'Metabolic Core',
    categories: ['supplement'],
    path: 'M46,52 L74,52 L76,72 L44,72 Z',
    cx: 60, cy: 62, r: 18,
  },
  {
    id: 'digestive',
    label: 'Digestive',
    categories: ['nutrition'],
    path: 'M48,72 L72,72 L70,88 L50,88 Z',
    cx: 60, cy: 80, r: 14,
  },
  {
    id: 'musculature',
    label: 'Musculature',
    categories: ['training', 'movement'],
    path: 'M30,42 L46,52 L44,72 L32,72 L24,56 Z M74,52 L90,42 L96,56 L88,72 L76,72 Z M48,88 L52,120 L44,120 L40,92 Z M68,88 L76,92 L72,120 L68,120 Z',
    cx: 60, cy: 96, r: 22,
  },
]

/* ── Silhouette SVG Path — simplified human form ── */
const SILHOUETTE_PATH = `
  M60,4 C66,4 71,8 72,14 C73,20 71,26 68,30
  L72,30 C78,32 82,36 86,40 L94,48 C96,50 96,54 94,56
  L88,62 C86,64 84,64 82,62 L76,56
  L78,72 L80,88 C80,92 78,96 76,98
  L74,120 C74,122 72,124 70,124
  L66,124 C64,124 62,122 62,120
  L60,100
  L58,120 C58,122 56,124 54,124
  L50,124 C48,124 46,122 46,120
  L44,98 C42,96 40,92 40,88
  L42,72 L44,56
  L38,62 C36,64 34,64 32,62
  L26,56 C24,54 24,50 26,48
  L34,40 C38,36 42,32 48,30
  L52,30 C49,26 47,20 48,14
  C49,8 54,4 60,4 Z
`

/* ── Helper: get session ID ── */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = localStorage.getItem('vive-session-id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('vive-session-id', id) }
  return id
}

/* ── Region Glow Component ── */
function RegionGlow({
  region,
  isOverdue,
  overdueCount,
  isOptimal,
}: {
  region: BodyRegion
  isOverdue: boolean
  overdueCount: number
  isOptimal: boolean
}) {
  const color = isOverdue ? T.amber : T.optimal
  const glowBase = isOverdue ? T.amberGlow : T.optimalGlow
  const intensity = isOverdue ? Math.min(0.35, 0.15 + overdueCount * 0.08) : 0.08

  return (
    <g>
      {/* Radial glow */}
      <circle
        cx={region.cx}
        cy={region.cy}
        r={region.r}
        fill={`${glowBase}${intensity})`}
        style={{
          animation: isOverdue
            ? 'sm-amberPulse 2.5s ease-in-out infinite'
            : isOptimal
              ? 'sm-optimalPulse 4s ease-in-out infinite'
              : 'none',
          transition: 'fill 0.8s ease',
        }}
      />
      {/* Inner bright core */}
      {(isOverdue || isOptimal) && (
        <circle
          cx={region.cx}
          cy={region.cy}
          r={region.r * 0.4}
          fill={`${glowBase}${isOverdue ? 0.2 : 0.06})`}
          style={{
            animation: isOverdue
              ? 'sm-corePulse 2s ease-in-out infinite'
              : 'sm-coreGlow 5s ease-in-out infinite',
          }}
        />
      )}
      {/* Region outline on overdue */}
      {isOverdue && (
        <path
          d={region.path}
          fill="none"
          stroke={`${glowBase}0.3)`}
          strokeWidth="0.8"
          style={{
            animation: 'sm-outlinePulse 2.5s ease-in-out infinite',
          }}
        />
      )}
    </g>
  )
}

/* ── Debt Score Indicator ── */
function DebtScore({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const color = pct === 0 ? T.optimal : pct <= 30 ? '#6B8AFF' : pct <= 60 ? T.amber : '#FF6B6B'
  const label = pct === 0 ? 'CLEAR' : pct <= 30 ? 'LOW' : pct <= 60 ? 'MODERATE' : 'HIGH'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <span style={{
        fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: T.dim,
      }}>
        Bio Debt
      </span>
      <span style={{
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: 18, fontWeight: 700,
        color, letterSpacing: '-0.02em',
        textShadow: `0 0 12px ${color}40`,
        transition: 'color 0.6s ease',
      }}>
        {pct}%
      </span>
      <span style={{
        fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: `${color}CC`,
        padding: '1px 6px', borderRadius: 4,
        background: `${color}10`, border: `1px solid ${color}20`,
      }}>
        {label}
      </span>
    </div>
  )
}

/* ── Region Legend Item ── */
function RegionLegend({
  region,
  isOverdue,
  overdueCount,
  isOptimal,
}: {
  region: BodyRegion
  isOverdue: boolean
  overdueCount: number
  isOptimal: boolean
}) {
  const color = isOverdue ? T.amber : isOptimal ? T.optimal : T.dim

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 0',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color,
        boxShadow: isOverdue ? `0 0 6px ${T.amberGlow}0.4)` : isOptimal ? `0 0 4px ${T.optimalGlow}0.3)` : 'none',
        transition: 'all 0.4s ease',
      }} />
      <span style={{
        fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.06em',
        color: isOverdue ? `${T.amber}DD` : T.muted,
        transition: 'color 0.4s ease',
      }}>
        {region.label}
        {isOverdue && (
          <span style={{ color: `${T.amber}88`, marginLeft: 4 }}>
            {overdueCount} overdue
          </span>
        )}
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   SOMATIC MIRROR — Main Export
   ══════════════════════════════════════════════════════════════════ */

export default function SomaticMirror() {
  const sessionId = getSessionId()
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId })

  const [windowInfo, setWindowInfo] = useState<WindowInfo>(() => getBiologicalWindow())
  useEffect(() => {
    const tick = () => setWindowInfo(getBiologicalWindow())
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [])

  /* ── Compute overdue protocols per body region ── */
  const regionAnalysis = useMemo(() => {
    const items = protocolStatus?.items ?? []
    const analysis = new Map<string, { overdueCount: number; totalCount: number; completedCount: number }>()

    // Initialize all regions
    for (const region of BODY_REGIONS) {
      analysis.set(region.id, { overdueCount: 0, totalCount: 0, completedCount: 0 })
    }

    // Map each protocol to its body region
    for (const item of items) {
      const matchedRegion = BODY_REGIONS.find(r => r.categories.includes(item.category))
      if (!matchedRegion) continue

      const entry = analysis.get(matchedRegion.id)!
      entry.totalCount++
      if (item.completed) {
        entry.completedCount++
      } else if (isCriticalOverdue(item.name, item.category, item.timeOfDay, item.completed, windowInfo)) {
        entry.overdueCount++
      }
    }

    return analysis
  }, [protocolStatus, windowInfo])

  const totalOverdue = useMemo(() => {
    let count = 0
    regionAnalysis.forEach(v => { count += v.overdueCount })
    return count
  }, [regionAnalysis])

  const totalProtocols = protocolStatus?.total ?? 0
  const completedProtocols = protocolStatus?.done ?? 0

  /* ── Meridian lines — energy flow paths ── */
  const meridianOpacity = totalOverdue > 0 ? 0.06 : 0.03

  return (
    <div style={{
      position: 'relative',
      borderRadius: 20,
      background: T.bg,
      border: `1px solid ${totalOverdue > 0 ? `${T.amberGlow}0.12)` : 'rgba(255,255,255,0.04)'}`,
      backdropFilter: 'blur(24px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
      padding: '16px 12px',
      overflow: 'hidden',
      transition: 'border-color 0.8s ease',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: totalOverdue > 0
          ? `linear-gradient(90deg, transparent, ${T.amberGlow}0.25), transparent)`
          : `linear-gradient(90deg, transparent, ${T.optimalGlow}0.12), transparent)`,
        transition: 'background 0.8s ease',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: totalOverdue > 0 ? T.amber : T.optimal,
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'color 0.6s ease',
          }}>
            <span style={{ fontSize: 10 }}>◎</span>
            Somatic Mirror
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 7, color: T.dim,
            letterSpacing: '0.06em', marginTop: 2,
          }}>
            {totalOverdue > 0
              ? `${totalOverdue} region${totalOverdue > 1 ? 's' : ''} under biological debt`
              : completedProtocols === totalProtocols && totalProtocols > 0
                ? 'All systems nominal'
                : 'Monitoring biological state'}
          </div>
        </div>
        <DebtScore score={totalOverdue} total={BODY_REGIONS.length} />
      </div>

      {/* SVG Body Visualization */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative',
      }}>
        <svg
          viewBox="0 0 120 130"
          style={{
            width: '100%',
            maxWidth: 200,
            height: 'auto',
            filter: totalOverdue > 0
              ? `drop-shadow(0 0 20px ${T.amberGlow}0.08))`
              : `drop-shadow(0 0 12px ${T.optimalGlow}0.04))`,
            transition: 'filter 0.8s ease',
          }}
        >
          <defs>
            {/* Amber glow filter */}
            <filter id="sm-amber-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
            </filter>
            {/* Optimal glow filter */}
            <filter id="sm-optimal-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
          </defs>

          {/* Meridian energy lines */}
          <g opacity={meridianOpacity}>
            {/* Central meridian */}
            <line x1="60" y1="6" x2="60" y2="120" stroke="rgba(255,255,255,0.5)" strokeWidth="0.3" strokeDasharray="2 4" />
            {/* Cross meridians */}
            <line x1="30" y1="50" x2="90" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" strokeDasharray="2 4" />
            <line x1="40" y1="80" x2="80" y2="80" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" strokeDasharray="2 4" />
          </g>

          {/* Region glow layers (rendered behind silhouette) */}
          {BODY_REGIONS.map(region => {
            const data = regionAnalysis.get(region.id)
            const isOverdue = (data?.overdueCount ?? 0) > 0
            const isOptimal = (data?.completedCount ?? 0) === (data?.totalCount ?? 0) && (data?.totalCount ?? 0) > 0
            return (
              <RegionGlow
                key={region.id}
                region={region}
                isOverdue={isOverdue}
                overdueCount={data?.overdueCount ?? 0}
                isOptimal={isOptimal}
              />
            )
          })}

          {/* Main silhouette */}
          <path
            d={SILHOUETTE_PATH}
            fill={T.silhouette}
            stroke={T.silhouetteStroke}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />

          {/* Chakra / node points along spine */}
          {[18, 36, 50, 64, 80].map((y, i) => {
            const regionForNode = BODY_REGIONS[i]
            const data = regionForNode ? regionAnalysis.get(regionForNode.id) : undefined
            const isOverdue = (data?.overdueCount ?? 0) > 0
            const isOptimal = (data?.completedCount ?? 0) === (data?.totalCount ?? 0) && (data?.totalCount ?? 0) > 0
            const color = isOverdue ? T.amber : isOptimal ? T.optimal : 'rgba(255,255,255,0.12)'
            return (
              <g key={y}>
                <circle
                  cx={60} cy={y} r={2}
                  fill={color}
                  style={{
                    animation: isOverdue ? 'sm-nodePulse 2s ease-in-out infinite' : 'none',
                    transition: 'fill 0.6s ease',
                  }}
                />
                {isOverdue && (
                  <circle
                    cx={60} cy={y} r={5}
                    fill="none"
                    stroke={`${T.amberGlow}0.3)`}
                    strokeWidth="0.5"
                    style={{ animation: 'sm-ringExpand 2.5s ease-in-out infinite' }}
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Region Legend */}
      <div style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2px 12px',
      }}>
        {BODY_REGIONS.map(region => {
          const data = regionAnalysis.get(region.id)
          const isOverdue = (data?.overdueCount ?? 0) > 0
          const isOptimal = (data?.completedCount ?? 0) === (data?.totalCount ?? 0) && (data?.totalCount ?? 0) > 0
          return (
            <RegionLegend
              key={region.id}
              region={region}
              isOverdue={isOverdue}
              overdueCount={data?.overdueCount ?? 0}
              isOptimal={isOptimal}
            />
          )
        })}
      </div>

      {/* Overdue advisory */}
      {totalOverdue > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 10,
          background: `${T.amberGlow}0.04)`,
          border: `1px solid ${T.amberGlow}0.12)`,
        }}>
          <div style={{
            fontFamily: 'monospace', fontSize: 7, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: `${T.amber}CC`, marginBottom: 3,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 8 }}>⚡</span>
            Biological Debt Advisory
          </div>
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 9,
            color: T.muted, lineHeight: 1.5,
          }}>
            {totalOverdue === 1
              ? 'One body region is accumulating biological debt from a missed protocol. Complete or reschedule to restore equilibrium.'
              : `${totalOverdue} body regions are under stress from missed protocols. Prioritize recovery to prevent compounding debt.`}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{
        marginTop: 8, textAlign: 'center',
        fontFamily: 'monospace', fontSize: 7, color: T.dim,
        letterSpacing: '0.06em',
      }}>
        somatic mirror {'\u00B7'} {windowInfo.label.toLowerCase()} window {'\u00B7'} {completedProtocols}/{totalProtocols} protocols
      </div>

      {/* Animations */}
      <style>{`
        @keyframes sm-amberPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes sm-corePulse {
          0%, 100% { opacity: 0.4; transform-origin: center; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
        @keyframes sm-coreGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes sm-optimalPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes sm-outlinePulse {
          0%, 100% { opacity: 0.3; stroke-width: 0.6; }
          50% { opacity: 0.8; stroke-width: 1.2; }
        }
        @keyframes sm-nodePulse {
          0%, 100% { opacity: 0.6; r: 2; }
          50% { opacity: 1; r: 3; }
        }
        @keyframes sm-ringExpand {
          0% { opacity: 0.5; r: 3; }
          100% { opacity: 0; r: 10; }
        }
      `}</style>
    </div>
  )
}
