import React, { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getSessionId } from '@/components/Presence/usePresenceState'

/* ── HUD Design Tokens ── */
const H = {
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
  gold: '#FFD700',
  purple: '#A78BFA',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Tier Config ── */
const TIER_CONFIG: Record<string, { color: string; glow: string; label: string; icon: string }> = {
  apex: { color: H.gold, glow: 'rgba(255,215,0,0.25)', label: 'APEX', icon: '◆' },
  titan: { color: H.blue, glow: 'rgba(59,130,246,0.20)', label: 'TITAN', icon: '▲' },
  sentinel: { color: H.purple, glow: 'rgba(167,139,250,0.20)', label: 'SENTINEL', icon: '●' },
  vanguard: { color: H.textSec, glow: 'rgba(255,255,255,0.08)', label: 'VANGUARD', icon: '○' },
}

/* ── Grade Colors ── */
const GRADE_COLORS: Record<string, string> = {
  S: H.gold,
  A: H.accent,
  B: H.blue,
  C: H.orange,
  D: H.red,
}

/* ── P:R Ratio Ring — SVG circular gauge ── */
function PRRatioRing({ ratio, grade, size = 44 }: { ratio: number; grade: string; size?: number }) {
  const r = (size - 6) / 2
  const circumference = 2 * Math.PI * r
  const progress = (ratio / 100) * circumference
  const color = GRADE_COLORS[grade] || H.blue

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3} />
        {/* Progress */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}60)`, transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color, lineHeight: 1 }}>
          {grade}
        </span>
        <span style={{ fontSize: 7, fontFamily: 'monospace', color: H.textTer, lineHeight: 1, marginTop: 1 }}>
          {ratio}
        </span>
      </div>
    </div>
  )
}

/* ── Trend Arrow ── */
function TrendArrow({ direction }: { direction: 'up' | 'down' | 'stable' }) {
  const color = direction === 'up' ? H.green : direction === 'down' ? H.red : H.textTer
  const symbol = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'
  return (
    <span style={{
      fontSize: 10, color, fontWeight: 700, fontFamily: 'monospace',
      filter: direction !== 'stable' ? `drop-shadow(0 0 3px ${color}60)` : 'none',
    }}>
      {symbol}
    </span>
  )
}

/* ── Squad Stats Bar ── */
function SquadStatsBar({ stats }: { stats: {
  avgPrRatio: number; avgRecovery: number; avgStrain: number;
  avgHrv: number; avgAdherence: number; activeCount: number;
  totalMembers: number; squadGrade: string;
} }) {
  const metrics = [
    { label: 'SQUAD P:R', value: `${stats.avgPrRatio}`, color: GRADE_COLORS[stats.squadGrade] || H.blue },
    { label: 'AVG REC', value: `${stats.avgRecovery}%`, color: H.green },
    { label: 'AVG STRAIN', value: `${stats.avgStrain}`, color: H.orange },
    { label: 'AVG HRV', value: `${stats.avgHrv}ms`, color: H.blueBright },
    { label: 'ONLINE', value: `${stats.activeCount}/${stats.totalMembers}`, color: H.accent },
  ]

  return (
    <div style={{
      display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12,
      padding: '8px 10px', borderRadius: 10,
      background: 'rgba(59,130,246,0.04)',
      border: `1px solid ${H.borderBlue}`,
    }}>
      {metrics.map(m => (
        <div key={m.label} style={{
          flex: '1 1 auto', minWidth: 52, textAlign: 'center',
          padding: '3px 4px',
        }}>
          <div style={{ fontSize: 6, fontFamily: 'monospace', color: H.textTer, letterSpacing: '0.1em', marginBottom: 2 }}>
            {m.label}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: m.color }}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Metric Micro-Bar ── */
function MicroBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 6, fontFamily: 'monospace', color: H.textTer, letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 7, fontFamily: 'monospace', color, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, background: color,
          width: `${pct}%`, transition: 'width 0.6s ease',
          boxShadow: `0 0 6px ${color}40`,
        }} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SQUAD-SYNC LEADERBOARD — Main Component
   ══════════════════════════════════════════════════════════════ */

export default function SquadLeaderboard() {
  const data = useQuery(api.leaderboard.getSquadSyncLeaderboard)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'ratio' | 'adherence' | 'recovery' | 'hrv'>('ratio')
  const currentSessionId = useMemo(() => {
    try { return getSessionId() } catch { return '' }
  }, [])

  const entries = useMemo(() => {
    if (!data?.entries) return []
    const sorted = [...data.entries]
    switch (sortBy) {
      case 'adherence': sorted.sort((a, b) => b.avgAdherence - a.avgAdherence); break
      case 'recovery': sorted.sort((a, b) => b.recovery - a.recovery); break
      case 'hrv': sorted.sort((a, b) => b.hrv - a.hrv); break
      default: sorted.sort((a, b) => b.prRatio - a.prRatio); break
    }
    sorted.forEach((e, i) => (e.rank = i + 1))
    return sorted
  }, [data?.entries, sortBy])

  if (!data) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, margin: '0 auto 8px',
          border: '2px solid rgba(59,130,246,0.12)', borderTopColor: H.blue,
          borderRadius: '50%', animation: 'sq-spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: H.textTer }}>
          Syncing squad data…
        </span>
        <style>{`@keyframes sq-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const squadStats = data.squadStats

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: H.textTer, letterSpacing: '0.12em' }}>
            PERFORMANCE : RECOVERY RATIO
          </span>
        </div>
        {!data.hasPeers && (
          <div style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 6,
            fontFamily: 'monospace', color: H.orange, letterSpacing: '0.1em',
            background: 'rgba(232,151,108,0.08)', border: '1px solid rgba(232,151,108,0.15)',
          }}>
            BENCHMARKS
          </div>
        )}
      </div>

      {/* Squad Stats */}
      <SquadStatsBar stats={squadStats} />

      {/* Sort Controls */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {([
          { key: 'ratio', label: 'P:R Ratio' },
          { key: 'adherence', label: 'Adherence' },
          { key: 'recovery', label: 'Recovery' },
          { key: 'hrv', label: 'HRV' },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key)} style={{
            flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 7, fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.06em',
            background: sortBy === s.key ? H.blueMuted : 'transparent',
            color: sortBy === s.key ? H.blueBright : H.textTer,
            transition: 'all 0.2s',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((entry) => {
          const tier = TIER_CONFIG[entry.tier] || TIER_CONFIG.vanguard
          const isYou = entry.anonId === currentSessionId
          const isExpanded = expandedId === entry.anonId
          const isTop3 = entry.rank <= 3

          return (
            <div
              key={entry.anonId}
              onClick={() => setExpandedId(isExpanded ? null : entry.anonId)}
              style={{
                padding: isExpanded ? '10px 10px 12px' : '8px 10px',
                borderRadius: 12,
                background: isYou
                  ? 'rgba(59,130,246,0.08)'
                  : isTop3
                    ? `linear-gradient(135deg, ${tier.glow}, transparent 70%)`
                    : H.surfaceAlt,
                border: `1px solid ${isYou ? 'rgba(59,130,246,0.20)' : isTop3 ? `${tier.color}15` : H.border}`,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Rank glow for top 3 */}
              {isTop3 && (
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 60, height: 60,
                  background: `radial-gradient(circle, ${tier.color}10, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Main Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                {/* Rank */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: isTop3 ? `${tier.color}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isTop3 ? `${tier.color}25` : 'rgba(255,255,255,0.04)'}`,
                }}>
                  <span style={{
                    fontSize: isTop3 ? 10 : 9, fontFamily: 'monospace', fontWeight: 800,
                    color: isTop3 ? tier.color : H.textTer,
                  }}>
                    {entry.rank}
                  </span>
                </div>

                {/* P:R Ring */}
                <PRRatioRing ratio={entry.prRatio} grade={entry.prGrade} size={38} />

                {/* Name + Efficiency */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                      color: isYou ? H.blueBright : H.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {isYou ? 'You' : entry.anonLabel}
                    </span>
                    {isYou && (
                      <span style={{
                        fontSize: 6, fontFamily: 'monospace', padding: '1px 4px',
                        borderRadius: 3, background: 'rgba(59,130,246,0.15)',
                        color: H.blueBright, letterSpacing: '0.1em', fontWeight: 600,
                      }}>
                        YOU
                      </span>
                    )}
                    {entry.isActive && !entry.isBenchmark && (
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: H.green, boxShadow: `0 0 6px ${H.green}60`,
                        animation: 'sq-pulse 2s ease-in-out infinite',
                      }} />
                    )}
                    <TrendArrow direction={entry.trendDirection} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 7, fontFamily: 'monospace', color: tier.color,
                      letterSpacing: '0.08em', fontWeight: 600,
                    }}>
                      {tier.icon} {tier.label}
                    </span>
                    <span style={{ fontSize: 7, fontFamily: 'monospace', color: H.textTer }}>
                      {entry.prEfficiency}
                    </span>
                  </div>
                </div>

                {/* Key Metric */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 14, fontFamily: 'monospace', fontWeight: 800,
                    color: GRADE_COLORS[entry.prGrade] || H.blue,
                    lineHeight: 1,
                    filter: `drop-shadow(0 0 4px ${GRADE_COLORS[entry.prGrade] || H.blue}30)`,
                  }}>
                    {entry.prRatio}
                  </div>
                  <div style={{ fontSize: 6, fontFamily: 'monospace', color: H.textTer, letterSpacing: '0.1em', marginTop: 1 }}>
                    P:R RATIO
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div style={{
                  marginTop: 10, paddingTop: 10,
                  borderTop: `1px solid ${H.border}`,
                }}>
                  {/* Micro-bars */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <MicroBar value={entry.avgAdherence} max={100} color={H.accent} label="ADHERENCE" />
                    <MicroBar value={entry.recovery} max={100} color={H.green} label="RECOVERY" />
                    <MicroBar value={entry.hrv} max={100} color={H.blueBright} label="HRV" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <MicroBar value={entry.sleepScore} max={100} color={H.purple} label="SLEEP" />
                    <MicroBar value={entry.strain} max={21} color={H.orange} label="STRAIN" />
                    <MicroBar value={entry.streak} max={30} color={H.gold} label="STREAK" />
                  </div>

                  {/* Status Row */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {entry.inSession && (
                      <div style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 7,
                        fontFamily: 'monospace', color: H.accent,
                        background: 'rgba(0,255,204,0.06)', border: '1px solid rgba(0,255,204,0.12)',
                      }}>
                        ⚡ {entry.inSession}
                      </div>
                    )}
                    <div style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 7,
                      fontFamily: 'monospace', color: H.textTer,
                      background: 'rgba(255,255,255,0.03)',
                    }}>
                      {entry.daysTracked}d tracked
                    </div>
                    {entry.streak > 0 && (
                      <div style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 7,
                        fontFamily: 'monospace', color: H.gold,
                        background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)',
                      }}>
                        🔥 {entry.streak}d streak
                      </div>
                    )}
                    {entry.isBenchmark && (
                      <div style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 7,
                        fontFamily: 'monospace', color: H.orange,
                        background: 'rgba(232,151,108,0.06)',
                      }}>
                        📊 Benchmark
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${H.border}`,
      }}>
        <div style={{ fontSize: 7, fontFamily: 'monospace', color: H.textTer, letterSpacing: '0.08em', marginBottom: 6 }}>
          P:R RATIO = (Recovery × Adherence × HRV × Sleep) / Strain
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 8, color: cfg.color }}>{cfg.icon}</span>
              <span style={{ fontSize: 7, fontFamily: 'monospace', color: cfg.color, letterSpacing: '0.06em' }}>
                {cfg.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes sq-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
