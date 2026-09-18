import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   PERFORMANCE LEADERBOARD — Elite Score Rankings
   Ranks squad members by Elite Performance Score (0-100).
   "Slightly Competitive" mode highlights the gap to the person
   immediately above you in the rankings.
   ═══════════════════════════════════════════════════════════════ */

// ── Tier config ──
const TIERS: Record<string, { label: string; color: string; glow: string; icon: string }> = {
  apex:     { label: 'APEX',     color: '#00FFCC', glow: 'rgba(0,255,204,0.4)',  icon: '◆' },
  titan:    { label: 'TITAN',    color: '#AF82FF', glow: 'rgba(175,130,255,0.4)', icon: '▲' },
  vanguard: { label: 'VANGUARD', color: '#6B8AFF', glow: 'rgba(107,138,255,0.4)', icon: '●' },
}

function getTier(score: number) {
  if (score >= 90) return TIERS.apex
  if (score >= 70) return TIERS.titan
  return TIERS.vanguard
}

// ── Stable anonymous label from sessionId ──
function operatorLabel(sessionId: string): string {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
  }
  return `Operator #${(Math.abs(hash) % 900) + 100}`
}

// ── Animated score counter ──
function AnimatedScore({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>(0)

  useEffect(() => {
    const start = ref.current
    const diff = value - start
    if (diff === 0) return
    const duration = 800
    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + diff * eased)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(animate)
      else ref.current = value
    }
    requestAnimationFrame(animate)
  }, [value])

  return (
    <span style={{
      color,
      fontFamily: 'monospace',
      fontWeight: 700,
      fontSize: 22,
      textShadow: `0 0 12px ${color}44`,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {display}
    </span>
  )
}

// ── Mini score bar ──
function ScoreBar({ score, color, glow, animated }: { score: number; color: string; glow: string; animated?: boolean }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 50)
    return () => clearTimeout(t)
  }, [score])

  return (
    <div style={{
      width: '100%',
      height: 4,
      borderRadius: 2,
      background: 'rgba(255,255,255,0.04)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        width: `${width}%`,
        height: '100%',
        borderRadius: 2,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 8px ${glow}`,
        transition: animated !== false ? 'width 1s cubic-bezier(0.4,0,0.2,1)' : 'none',
      }} />
    </div>
  )
}

// ── Gap indicator (Slightly Competitive mode) ──
function GapIndicator({ gap, isAbove }: { gap: number; isAbove: boolean }) {
  if (gap === 0) return null
  const color = isAbove ? '#00FFCC' : '#FF6B6B'
  const arrow = isAbove ? '▲' : '▼'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '2px 8px',
      borderRadius: 6,
      background: `${color}11`,
      border: `1px solid ${color}22`,
    }}>
      <span style={{ color, fontSize: 8 }}>{arrow}</span>
      <span style={{
        color,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {gap} pts
      </span>
    </div>
  )
}

// ── Rank badge ──
function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32']
  const color = isTop3 ? colors[rank - 1] : 'rgba(255,255,255,0.25)'
  const glow = isTop3 ? `${color}44` : 'transparent'

  return (
    <div style={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isTop3
        ? `radial-gradient(circle, ${color}22, transparent)`
        : 'rgba(255,255,255,0.03)',
      border: `1.5px solid ${isTop3 ? `${color}55` : 'rgba(255,255,255,0.06)'}`,
      boxShadow: isTop3 ? `0 0 10px ${glow}` : 'none',
      flexShrink: 0,
    }}>
      <span style={{
        color,
        fontSize: isTop3 ? 12 : 10,
        fontFamily: 'monospace',
        fontWeight: 700,
      }}>
        {rank}
      </span>
    </div>
  )
}

// ── Leaderboard row ──
interface RowData {
  rank: number
  label: string
  score: number
  tier: string
  streak: number
  isYou: boolean
  isBenchmark: boolean
  isActive: boolean
  gapToAbove: number | null
}

function LeaderboardRow({ data, competitive, index }: { data: RowData; competitive: boolean; index: number }) {
  const tierInfo = getTier(data.score)
  const isYou = data.isYou

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 14,
        background: isYou
          ? 'linear-gradient(135deg, rgba(0,240,255,0.06) 0%, rgba(175,130,255,0.04) 100%)'
          : 'rgba(255,255,255,0.015)',
        border: isYou
          ? '1px solid rgba(0,240,255,0.15)'
          : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isYou
          ? '0 0 20px rgba(0,240,255,0.06), inset 0 1px 0 rgba(255,255,255,0.03)'
          : 'inset 0 1px 0 rgba(255,255,255,0.01)',
        position: 'relative',
        overflow: 'hidden',
        opacity: data.isBenchmark ? 0.6 : 1,
        animation: `leaderRowSlide 0.4s ease both ${index * 0.05}s`,
      }}
    >
      {/* You indicator glow */}
      {isYou && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 3,
          height: '100%',
          background: 'linear-gradient(180deg, #00FFCC, #AF82FF)',
          borderRadius: '3px 0 0 3px',
          boxShadow: '0 0 8px rgba(0,255,204,0.4)',
        }} />
      )}

      {/* Rank */}
      <RankBadge rank={data.rank} />

      {/* Avatar + Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {/* Avatar circle */}
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: data.isBenchmark
              ? 'rgba(255,255,255,0.05)'
              : `linear-gradient(135deg, ${tierInfo.color}33, ${tierInfo.color}11)`,
            border: `1px solid ${data.isBenchmark ? 'rgba(255,255,255,0.08)' : `${tierInfo.color}33`}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}>
            <span style={{ fontSize: 9, color: tierInfo.color }}>{tierInfo.icon}</span>
            {/* Active dot */}
            {data.isActive && !data.isBenchmark && (
              <div style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00FF88',
                border: '1.5px solid #050505',
                boxShadow: '0 0 6px rgba(0,255,136,0.6)',
              }} />
            )}
          </div>

          {/* Name */}
          <span style={{
            color: isYou ? '#e0e0e0' : 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: isYou ? 700 : 500,
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {data.label}
            {isYou && (
              <span style={{ color: 'rgba(0,240,255,0.5)', fontSize: 9, marginLeft: 6 }}>YOU</span>
            )}
          </span>

          {/* Benchmark tag */}
          {data.isBenchmark && (
            <span style={{
              fontSize: 7,
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.04)',
              padding: '1px 5px',
              borderRadius: 4,
              letterSpacing: '0.08em',
            }}>
              BENCHMARK
            </span>
          )}
        </div>

        {/* Score bar + streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <ScoreBar score={data.score} color={tierInfo.color} glow={tierInfo.glow} />
          </div>
          {data.streak > 0 && (
            <span style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: 'rgba(255,184,107,0.7)',
              whiteSpace: 'nowrap',
            }}>
              🔥{data.streak}d
            </span>
          )}
        </div>
      </div>

      {/* Score + Gap */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{
            color: tierInfo.color,
            fontSize: 18,
            fontFamily: 'monospace',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 10px ${tierInfo.glow}`,
            lineHeight: 1,
          }}>
            {data.score}
          </span>
          <span style={{
            fontSize: 8,
            fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.05em',
          }}>
            EPS
          </span>
        </div>

        {/* Competitive gap indicator */}
        {competitive && data.gapToAbove !== null && data.gapToAbove !== 0 && !data.isBenchmark && (
          <GapIndicator gap={Math.abs(data.gapToAbove)} isAbove={data.gapToAbove > 0} />
        )}
      </div>
    </div>
  )
}

// ── Competitive toggle ──
function CompetitiveToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 8,
        background: active ? 'rgba(255,107,107,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.06)'}`,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
    >
      <span style={{ fontSize: 12 }}>{active ? '🔥' : '😌'}</span>
      <span style={{
        fontSize: 9,
        fontFamily: 'monospace',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: active ? '#FF6B6B' : 'rgba(255,255,255,0.35)',
        transition: 'color 0.3s',
      }}>
        {active ? 'COMPETITIVE' : 'CHILL MODE'}
      </span>
      {/* Toggle track */}
      <div style={{
        width: 28,
        height: 14,
        borderRadius: 7,
        background: active ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.06)',
        position: 'relative',
        transition: 'background 0.3s',
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: active ? '#FF6B6B' : 'rgba(255,255,255,0.2)',
          position: 'absolute',
          top: 2,
          left: active ? 16 : 2,
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: active ? '0 0 6px rgba(255,107,107,0.5)' : 'none',
        }} />
      </div>
    </button>
  )
}

// ── Your position card (competitive mode) ──
function YourPositionCard({ yourData, aboveData }: { yourData: RowData; aboveData: RowData | null }) {
  const tier = getTier(yourData.score)
  const gap = aboveData ? aboveData.score - yourData.score : 0

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(255,107,107,0.06) 0%, rgba(255,184,107,0.04) 100%)',
      border: '1px solid rgba(255,107,107,0.12)',
      boxShadow: '0 0 24px rgba(255,107,107,0.04)',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontSize: 9,
          fontFamily: 'monospace',
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(255,107,107,0.7)',
        }}>
          🎯 YOUR CHALLENGE
        </span>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.06em',
        }}>
          RANK #{yourData.rank}
        </span>
      </div>

      {aboveData && gap > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 4,
            }}>
              Close the gap to <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{aboveData.label}</span>
            </div>
            {/* Gap visualization */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 20,
            }}>
              <div style={{
                flex: yourData.score,
                height: 6,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${tier.color}66, ${tier.color})`,
                boxShadow: `0 0 6px ${tier.glow}`,
                minWidth: 4,
              }} />
              <div style={{
                width: 'auto',
                padding: '0 6px',
                height: 16,
                borderRadius: 4,
                background: 'rgba(255,107,107,0.15)',
                border: '1px solid rgba(255,107,107,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#FF6B6B',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  -{gap}
                </span>
              </div>
              <div style={{
                flex: gap,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,107,107,0.15)',
                border: '1px dashed rgba(255,107,107,0.2)',
                minWidth: 4,
              }} />
            </div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '6px 10px',
            borderRadius: 10,
            background: 'rgba(255,107,107,0.08)',
          }}>
            <span style={{
              fontSize: 20,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#FF6B6B',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {gap}
            </span>
            <span style={{
              fontSize: 7,
              fontFamily: 'monospace',
              color: 'rgba(255,107,107,0.6)',
              letterSpacing: '0.08em',
            }}>
              PTS GAP
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#00FFCC',
          textAlign: 'center',
          padding: '4px 0',
        }}>
          👑 You are leading the squad!
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function PerformanceLeaderboard() {
  const [competitive, setCompetitive] = useState(false)
  const sessionId = getTwinSessionId()

  // Fetch real data from Convex
  const eliteScores = useQuery(api.eliteScore.listAll) ?? []
  const peerLeaderboard = useQuery(api.leaderboard.getPeerLeaderboard) ?? []

  // Merge elite scores with peer leaderboard data
  const rows: RowData[] = useMemo(() => {
    // Build a map of elite scores by sessionId
    const scoreMap = new Map<string, number>()
    for (const es of eliteScores) {
      scoreMap.set(es.sessionId, es.score)
    }

    // Build rows from peer leaderboard (has richer data: streak, presence, tier)
    const merged: RowData[] = []

    for (const peer of peerLeaderboard) {
      const eliteScore = scoreMap.get(peer.anonId) ?? peer.avgAdherence
      const isYou = peer.anonId === sessionId

      merged.push({
        rank: 0,
        label: isYou ? 'You' : (peer.anonLabel || operatorLabel(peer.anonId)),
        score: Math.min(100, Math.max(0, Math.round(eliteScore))),
        tier: peer.tier,
        streak: peer.streak ?? 0,
        isYou,
        isBenchmark: peer.isBenchmark ?? false,
        isActive: peer.isActive ?? false,
        gapToAbove: null,
      })
    }

    // Add any elite scores not in peer leaderboard
    for (const es of eliteScores) {
      if (!merged.some(m => m.label === 'You' && es.sessionId === sessionId) &&
          !peerLeaderboard.some(p => p.anonId === es.sessionId)) {
        const isYou = es.sessionId === sessionId
        merged.push({
          rank: 0,
          label: isYou ? 'You' : operatorLabel(es.sessionId),
          score: Math.min(100, Math.max(0, es.score)),
          tier: es.score >= 90 ? 'apex' : es.score >= 70 ? 'titan' : 'vanguard',
          streak: 0,
          isYou,
          isBenchmark: false,
          isActive: false,
          gapToAbove: null,
        })
      }
    }

    // Ensure current user exists
    if (!merged.some(m => m.isYou)) {
      merged.push({
        rank: 0,
        label: 'You',
        score: eliteScores.find(e => e.sessionId === sessionId)?.score ?? 0,
        tier: 'vanguard',
        streak: 0,
        isYou: true,
        isBenchmark: false,
        isActive: true,
        gapToAbove: null,
      })
    }

    // Sort by score descending, then streak
    merged.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.streak - a.streak
    })

    // Assign ranks and compute gaps
    merged.forEach((row, i) => {
      row.rank = i + 1
      if (i > 0) {
        row.gapToAbove = merged[i - 1].score - row.score
      }
    })

    return merged
  }, [eliteScores, peerLeaderboard, sessionId])

  const yourRow = rows.find(r => r.isYou) ?? null
  const aboveYou = yourRow && yourRow.rank > 1 ? rows[yourRow.rank - 2] : null

  // Summary stats
  const avgScore = rows.length > 0
    ? Math.round(rows.filter(r => !r.isBenchmark).reduce((s, r) => s + r.score, 0) / Math.max(1, rows.filter(r => !r.isBenchmark).length))
    : 0
  const activeCount = rows.filter(r => r.isActive && !r.isBenchmark).length

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(10,12,18,0.95) 0%, rgba(5,5,5,0.98) 100%)',
      borderRadius: 20,
      border: '1px solid rgba(0,240,255,0.08)',
      boxShadow: '0 4px 32px rgba(0,0,0,0.4), 0 0 60px rgba(0,240,255,0.02)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 200,
        height: 120,
        background: 'radial-gradient(ellipse, rgba(0,240,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#00FFCC',
              boxShadow: '0 0 8px rgba(0,255,204,0.6)',
              animation: 'lbPulse 2.5s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: 'rgba(0,240,255,0.5)',
            }}>
              PERFORMANCE LEADERBOARD
            </span>
          </div>
          <CompetitiveToggle active={competitive} onToggle={() => setCompetitive(c => !c)} />
        </div>

        {/* Summary strip */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 14,
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: 16,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: yourRow ? getTier(yourRow.score).color : 'rgba(255,255,255,0.3)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {yourRow ? <AnimatedScore value={yourRow.score} color={getTier(yourRow.score).color} /> : '—'}
            </div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(0,240,255,0.35)', letterSpacing: '0.1em' }}>
              YOUR EPS
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: 16,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.6)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              #{yourRow?.rank ?? '—'}
            </div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(0,240,255,0.35)', letterSpacing: '0.1em' }}>
              YOUR RANK
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: 16,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'rgba(175,130,255,0.7)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {avgScore}
            </div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(0,240,255,0.35)', letterSpacing: '0.1em' }}>
              SQUAD AVG
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: 16,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: activeCount > 0 ? '#00FF88' : 'rgba(255,255,255,0.2)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {activeCount}
            </div>
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(0,240,255,0.35)', letterSpacing: '0.1em' }}>
              ONLINE
            </div>
          </div>
        </div>
      </div>

      {/* Competitive challenge card */}
      {competitive && yourRow && (
        <div style={{ padding: '0 16px' }}>
          <YourPositionCard yourData={yourRow} aboveData={aboveYou} />
        </div>
      )}

      {/* Leaderboard rows */}
      <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row, i) => (
          <LeaderboardRow
            key={`${row.label}-${row.rank}`}
            data={row}
            competitive={competitive}
            index={i}
          />
        ))}

        {rows.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            color: 'rgba(255,255,255,0.25)',
            fontSize: 11,
            fontFamily: 'monospace',
          }}>
            No performance data yet. Complete protocols to appear on the leaderboard.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          color: 'rgba(0,240,255,0.25)',
          letterSpacing: '0.1em',
        }}>
          ELITE PERFORMANCE SCORE • 7-DAY ROLLING • UPDATED LIVE
        </span>
      </div>

      <style>{`
        @keyframes lbPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes leaderRowSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
