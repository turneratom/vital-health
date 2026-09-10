import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   READINESS HEATMAP — 30-Day Protocol Completion Grid
   ═══════════════════════════════════════════════════════════════
   7-column calendar grid (Mon–Sun) where each cell's color
   intensity represents protocol completion % for that day.
   Matches the high-contrast Vive 4.0 dark aesthetic.
   ═══════════════════════════════════════════════════════════════ */

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Color ramp: empty → low → mid → high → perfect
function getHeatColor(pct: number, hasData: boolean): string {
  if (!hasData) return 'rgba(255,255,255,0.02)'
  if (pct === 0) return 'rgba(0,240,255,0.04)'
  if (pct < 25) return 'rgba(0,240,255,0.10)'
  if (pct < 50) return 'rgba(0,240,255,0.20)'
  if (pct < 70) return 'rgba(0,200,255,0.35)'
  if (pct < 85) return 'rgba(0,255,204,0.45)'
  if (pct < 100) return 'rgba(0,255,170,0.60)'
  return 'rgba(0,255,136,0.80)' // 100% — perfect day
}

function getHeatGlow(pct: number, hasData: boolean): string {
  if (!hasData || pct < 50) return 'none'
  if (pct < 70) return '0 0 4px rgba(0,200,255,0.15)'
  if (pct < 85) return '0 0 6px rgba(0,255,204,0.2)'
  if (pct < 100) return '0 0 8px rgba(0,255,170,0.25)'
  return '0 0 12px rgba(0,255,136,0.35)'
}

function getBorderColor(pct: number, hasData: boolean): string {
  if (!hasData) return 'rgba(255,255,255,0.03)'
  if (pct === 0) return 'rgba(0,240,255,0.06)'
  if (pct < 50) return 'rgba(0,240,255,0.10)'
  if (pct < 85) return 'rgba(0,255,204,0.15)'
  return 'rgba(0,255,170,0.20)'
}

function getReadinessLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'ELITE', color: '#00FF88' }
  if (score >= 70) return { label: 'OPTIMAL', color: '#00FFCC' }
  if (score >= 50) return { label: 'NOMINAL', color: '#00C8FF' }
  if (score >= 25) return { label: 'SUBOPTIMAL', color: '#FFB86B' }
  return { label: 'CRITICAL', color: '#FF6B6B' }
}

interface DayData {
  date: string
  dayOfWeek: number
  protocolsCompleted: number
  protocolsTotal: number
  completionPct: number
  eliteScore: number
  avgHrv: number
  sleepScore: number
  readinessScore: number
  hasData: boolean
}

interface TooltipData {
  day: DayData
  x: number
  y: number
}

export default function ReadinessHeatmap({ sessionId }: { sessionId: string }) {
  const data = useQuery(
    api.queries.getReadinessHeatmapData,
    sessionId ? { sessionId } : 'skip'
  )

  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [viewMode, setViewMode] = useState<'completion' | 'readiness'>('completion')

  // Build grid: rows = weeks, cols = Mon(0)–Sun(6)
  const grid = useMemo(() => {
    if (!data?.days) return []

    const rows: (DayData | null)[][] = []
    let currentRow: (DayData | null)[] = []

    // Pad the first week with nulls for days before the first data point
    const firstDay = data.days[0]
    if (firstDay) {
      // Convert JS dayOfWeek (0=Sun) to Mon-start (0=Mon)
      const monStart = firstDay.dayOfWeek === 0 ? 6 : firstDay.dayOfWeek - 1
      for (let i = 0; i < monStart; i++) {
        currentRow.push(null)
      }
    }

    for (const day of data.days) {
      currentRow.push(day)
      if (currentRow.length === 7) {
        rows.push(currentRow)
        currentRow = []
      }
    }

    // Pad the last row
    if (currentRow.length > 0) {
      while (currentRow.length < 7) {
        currentRow.push(null)
      }
      rows.push(currentRow)
    }

    return rows
  }, [data])

  const handleCellHover = useCallback((day: DayData | null, e: React.MouseEvent) => {
    if (!day || !day.hasData) {
      setTooltip(null)
      return
    }
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({
      day,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }, [])

  const handleCellLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  // Loading state
  if (!data) {
    return (
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, rgba(10,12,18,0.95) 0%, rgba(8,8,14,0.98) 100%)',
        border: '1px solid rgba(0,240,255,0.06)',
      }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-16 h-3 rounded bg-[rgba(0,240,255,0.06)] animate-pulse" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg animate-pulse"
              style={{ background: 'rgba(0,240,255,0.03)', animationDelay: `${i * 30}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const { summary } = data
  const getValue = (day: DayData) =>
    viewMode === 'completion' ? day.completionPct : day.readinessScore

  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(10,12,18,0.95) 0%, rgba(8,8,14,0.98) 100%)',
      border: '1px solid rgba(0,240,255,0.06)',
      boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)',
    }}>
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,255,204,0.03) 0%, transparent 70%)' }} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="rgba(0,240,255,0.5)" strokeWidth="2" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(0,240,255,0.3))' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="font-mono text-[10px] font-semibold tracking-widest"
            style={{ color: 'rgba(0,240,255,0.5)' }}>
            READINESS HEATMAP
          </span>
          <span className="font-mono text-[8px] tracking-wider"
            style={{ color: 'rgba(0,240,255,0.25)' }}>
            30D
          </span>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{
          border: '1px solid rgba(0,240,255,0.08)',
          background: 'rgba(0,0,0,0.3)',
        }}>
          <button
            onClick={() => setViewMode('completion')}
            className="px-2.5 py-1 font-mono text-[8px] tracking-wider transition-all duration-200"
            style={{
              color: viewMode === 'completion' ? '#00FFCC' : 'rgba(0,240,255,0.3)',
              background: viewMode === 'completion' ? 'rgba(0,255,204,0.08)' : 'transparent',
            }}
          >
            PROTOCOL
          </button>
          <button
            onClick={() => setViewMode('readiness')}
            className="px-2.5 py-1 font-mono text-[8px] tracking-wider transition-all duration-200"
            style={{
              color: viewMode === 'readiness' ? '#00FFCC' : 'rgba(0,240,255,0.3)',
              background: viewMode === 'readiness' ? 'rgba(0,255,204,0.08)' : 'transparent',
            }}
          >
            READINESS
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{
            background: summary.avgReadiness >= 70 ? '#00FFCC' : summary.avgReadiness >= 40 ? '#FFB86B' : '#FF6B6B',
            boxShadow: `0 0 6px ${summary.avgReadiness >= 70 ? 'rgba(0,255,204,0.5)' : summary.avgReadiness >= 40 ? 'rgba(255,184,107,0.5)' : 'rgba(255,107,107,0.5)'}`,
          }} />
          <span className="font-mono text-[10px] font-bold tabular-nums"
            style={{ color: summary.avgReadiness >= 70 ? '#00FFCC' : summary.avgReadiness >= 40 ? '#FFB86B' : '#FF6B6B' }}>
            {summary.avgReadiness}%
          </span>
          <span className="font-mono text-[8px]" style={{ color: 'rgba(0,240,255,0.3)' }}>AVG</span>
        </div>

        <div className="w-px h-3" style={{ background: 'rgba(0,240,255,0.08)' }} />

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: '#AF82FF' }}>
            {summary.streakDays}d
          </span>
          <span className="font-mono text-[8px]" style={{ color: 'rgba(0,240,255,0.3)' }}>STREAK</span>
        </div>

        <div className="w-px h-3" style={{ background: 'rgba(0,240,255,0.08)' }} />

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: '#00FF88' }}>
            {summary.perfectDays}
          </span>
          <span className="font-mono text-[8px]" style={{ color: 'rgba(0,240,255,0.3)' }}>PERFECT</span>
        </div>

        <div className="w-px h-3" style={{ background: 'rgba(0,240,255,0.08)' }} />

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: 'rgba(0,240,255,0.5)' }}>
            {summary.daysWithData}/{summary.totalDays}
          </span>
          <span className="font-mono text-[8px]" style={{ color: 'rgba(0,240,255,0.3)' }}>LOGGED</span>
        </div>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="flex items-center justify-center">
            <span className="font-mono text-[8px] font-semibold tracking-wider"
              style={{ color: 'rgba(0,240,255,0.25)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Heatmap Grid ── */}
      <div className="flex flex-col gap-1.5">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7 gap-1.5">
            {row.map((day, colIdx) => {
              if (!day) {
                return (
                  <div key={colIdx} className="aspect-square rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.01)' }} />
                )
              }

              const val = getValue(day)
              const isToday = day.date === new Date().toISOString().slice(0, 10)
              const isPerfect = day.completionPct === 100 && day.hasData

              return (
                <div
                  key={colIdx}
                  className="aspect-square rounded-lg relative cursor-pointer transition-all duration-200 hover:scale-110 hover:z-10"
                  style={{
                    background: getHeatColor(val, day.hasData),
                    border: isToday
                      ? '1.5px solid rgba(0,240,255,0.5)'
                      : `1px solid ${getBorderColor(val, day.hasData)}`,
                    boxShadow: isToday
                      ? '0 0 8px rgba(0,240,255,0.2), ' + getHeatGlow(val, day.hasData)
                      : getHeatGlow(val, day.hasData),
                  }}
                  onMouseEnter={(e) => handleCellHover(day, e)}
                  onMouseLeave={handleCellLeave}
                >
                  {/* Day number */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono tabular-nums" style={{
                      fontSize: 9,
                      fontWeight: isToday ? 700 : 500,
                      color: val >= 70
                        ? 'rgba(0,0,0,0.6)'
                        : isToday
                          ? 'rgba(0,240,255,0.7)'
                          : day.hasData
                            ? 'rgba(255,255,255,0.35)'
                            : 'rgba(255,255,255,0.1)',
                    }}>
                      {new Date(day.date + 'T12:00:00').getDate()}
                    </span>
                  </div>

                  {/* Perfect day indicator */}
                  {isPerfect && (
                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{
                        background: '#00FF88',
                        boxShadow: '0 0 4px rgba(0,255,136,0.6)',
                      }} />
                  )}

                  {/* Today ring pulse */}
                  {isToday && (
                    <div className="absolute inset-0 rounded-lg pointer-events-none"
                      style={{
                        border: '1px solid rgba(0,240,255,0.3)',
                        animation: 'heatmapTodayPulse 2s ease-in-out infinite',
                      }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Color Legend ── */}
      <div className="flex items-center justify-between mt-4 pt-3" style={{
        borderTop: '1px solid rgba(0,240,255,0.04)',
      }}>
        <span className="font-mono text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.25)' }}>
          {viewMode === 'completion' ? 'PROTOCOL COMPLETION' : 'READINESS SCORE'}
        </span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[7px]" style={{ color: 'rgba(0,240,255,0.2)' }}>0%</span>
          {[4, 10, 20, 35, 45, 60, 80].map((opacity, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{
              background: i < 2
                ? `rgba(0,240,255,${opacity / 100})`
                : i < 4
                  ? `rgba(0,200,255,${opacity / 100})`
                  : i < 6
                    ? `rgba(0,255,204,${opacity / 100})`
                    : `rgba(0,255,136,${opacity / 100})`,
            }} />
          ))}
          <span className="font-mono text-[7px]" style={{ color: 'rgba(0,240,255,0.2)' }}>100%</span>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="rounded-xl px-3.5 py-2.5 font-mono" style={{
            background: 'rgba(8,8,14,0.96)',
            border: '1px solid rgba(0,240,255,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,240,255,0.05)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}>
            {/* Date header */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {new Date(tooltip.day.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </span>
              {(() => {
                const r = getReadinessLabel(tooltip.day.readinessScore)
                return (
                  <span className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      color: r.color,
                      background: `${r.color}15`,
                      border: `1px solid ${r.color}30`,
                    }}>
                    {r.label}
                  </span>
                )
              })()}
            </div>

            {/* Metrics */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.4)' }}>
                  PROTOCOLS
                </span>
                <span className="text-[10px] font-bold tabular-nums" style={{
                  color: tooltip.day.completionPct >= 80 ? '#00FFCC' : tooltip.day.completionPct >= 50 ? '#FFB86B' : '#FF6B6B',
                }}>
                  {tooltip.day.protocolsCompleted}/{tooltip.day.protocolsTotal} ({tooltip.day.completionPct}%)
                </span>
              </div>

              {tooltip.day.eliteScore > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.4)' }}>
                    ELITE SCORE
                  </span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: '#AF82FF' }}>
                    {tooltip.day.eliteScore}
                  </span>
                </div>
              )}

              {tooltip.day.avgHrv > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.4)' }}>
                    HRV
                  </span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: '#6B8AFF' }}>
                    {tooltip.day.avgHrv}ms
                  </span>
                </div>
              )}

              {tooltip.day.sleepScore > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.4)' }}>
                    SLEEP
                  </span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: '#FFB86B' }}>
                    {tooltip.day.sleepScore}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-1" style={{
                borderTop: '1px solid rgba(0,240,255,0.06)',
              }}>
                <span className="text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.4)' }}>
                  READINESS
                </span>
                <span className="text-[10px] font-bold tabular-nums" style={{
                  color: getReadinessLabel(tooltip.day.readinessScore).color,
                }}>
                  {tooltip.day.readinessScore}%
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 -translate-x-1/2 rotate-45"
              style={{
                background: 'rgba(8,8,14,0.96)',
                borderRight: '1px solid rgba(0,240,255,0.15)',
                borderBottom: '1px solid rgba(0,240,255,0.15)',
              }} />
          </div>
        </div>
      )}

      {/* ── Animations ── */}
      <style>{`
        @keyframes heatmapTodayPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
