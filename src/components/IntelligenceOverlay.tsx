/* ══════════════════════════════════════════════════════════════════
   IntelligenceOverlay v2 — Proximity Glow + Dark Glassmorphism
   
   Premium longevity tool aesthetic: warm natural palette,
   glass panels, high-contrast typography, and Proximity Glow
   pulses when biomarkers change in the AI Brain.
   ══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Warm Natural Design Tokens ── */
const DT = {
  bg: '#0F0E0D',
  surface: 'rgba(26, 24, 22, 0.82)',
  card: 'rgba(26, 24, 22, 0.65)',
  border: 'rgba(232, 151, 108, 0.06)',
  borderHover: 'rgba(232, 151, 108, 0.15)',
  text: '#F2EDE8',
  muted: 'rgba(232, 224, 216, 0.55)',
  dim: 'rgba(232, 224, 216, 0.28)',
  terra: '#E8976C',
  terraGlow: 'rgba(232, 151, 108,',
  sage: '#7CB68E',
  sageGlow: 'rgba(124, 182, 142,',
  sky: '#6BA3BE',
  gold: '#C4A46C',
  rose: '#D4847A',
  glass: 'blur(32px) saturate(1.5)',
}

const SEVERITY_CONFIG: Record<string, {
  bg: string; border: string; text: string; glow: string;
  glowClass: string; icon: string;
}> = {
  critical: {
    bg: 'rgba(212, 132, 122, 0.06)',
    border: 'rgba(212, 132, 122, 0.12)',
    text: '#D4847A',
    glow: 'rgba(212, 132, 122, 0.25)',
    glowClass: 'proximity-glow-rose',
    icon: '⚠',
  },
  warning: {
    bg: 'rgba(196, 164, 108, 0.06)',
    border: 'rgba(196, 164, 108, 0.12)',
    text: '#C4A46C',
    glow: 'rgba(196, 164, 108, 0.25)',
    glowClass: 'proximity-glow-gold',
    icon: '◈',
  },
  info: {
    bg: 'rgba(124, 182, 142, 0.04)',
    border: 'rgba(124, 182, 142, 0.1)',
    text: '#7CB68E',
    glow: 'rgba(124, 182, 142, 0.2)',
    glowClass: 'proximity-glow-sage',
    icon: '◉',
  },
}

interface Insight {
  id: string
  label: string
  category: string
  icon: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  protocolFix: string
  timestamp: number
}

interface IntelligenceOverlayProps {
  sessionId: string
  protocolsDone?: number
  protocolsTotal?: number
}

export default function IntelligenceOverlay({ sessionId, protocolsDone = 0, protocolsTotal = 0 }: IntelligenceOverlayProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [lastFetched, setLastFetched] = useState(0)
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set())
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevInsightCountRef = useRef(0)

  const generateInsights = useAction(api.aiBrain.generateInsights)

  const fetchInsights = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const result = await generateInsights({ sessionId })
      const newInsights = result.insights as Insight[]
      
      // Detect NEW insights for Proximity Glow pulse
      const existingIds = new Set(insights.map(i => i.id))
      const newIds = new Set<string>()
      newInsights.forEach(i => {
        if (!existingIds.has(i.id)) newIds.add(i.id)
      })
      
      if (newIds.size > 0) {
        setPulsingIds(newIds)
        setTimeout(() => setPulsingIds(new Set()), 2000)
      }
      
      setInsights(newInsights)
      setLastFetched(Date.now())
      setActiveIndex(0)
      prevInsightCountRef.current = newInsights.length
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [generateInsights, sessionId, loading, insights])

  useEffect(() => {
    const stale = Date.now() - lastFetched > 180_000
    if (insights.length === 0 || stale) {
      fetchInsights()
    }
  }, [protocolsDone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (expanded || visibleInsights.length <= 1) {
      if (cycleRef.current) clearInterval(cycleRef.current)
      return
    }
    cycleRef.current = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % visibleInsights.length)
    }, 8000)
    return () => { if (cycleRef.current) clearInterval(cycleRef.current) }
  }, [expanded, insights.length, dismissed.size])

  const visibleInsights = insights.filter(i => !dismissed.has(i.id))
  const activeInsight = visibleInsights[activeIndex % Math.max(visibleInsights.length, 1)]

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id))
    if (activeIndex >= visibleInsights.length - 1) setActiveIndex(0)
  }

  if (visibleInsights.length === 0 && !loading) return null

  const criticalCount = visibleInsights.filter(i => i.severity === 'critical').length
  const warningCount = visibleInsights.filter(i => i.severity === 'warning').length

  return (
    <div className="glass-panel-elevated" style={{
      padding: 0,
      transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Top accent gradient line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: activeInsight
          ? `linear-gradient(90deg, transparent, ${SEVERITY_CONFIG[activeInsight.severity].glow}, transparent)`
          : `linear-gradient(90deg, transparent, ${DT.terraGlow}0.12), transparent)`,
        zIndex: 2,
      }} />

      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Brain icon with ambient glow */}
          <div style={{
            width: 28, height: 28, borderRadius: 9,
            background: `${DT.terraGlow}0.08)`,
            border: `1px solid ${DT.terraGlow}0.12)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
            boxShadow: `0 0 12px ${DT.terraGlow}0.06)`,
          }}>
            🧠
          </div>
          <div>
            <div className="hct-label" style={{ fontSize: 9, letterSpacing: '0.1em' }}>
              Intelligence Overlay
            </div>
            <div style={{
              fontSize: 9, color: DT.dim,
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {visibleInsights.length} insight{visibleInsights.length !== 1 ? 's' : ''} · Cross-Domain
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {criticalCount > 0 && (
            <span style={{
              fontSize: 8, fontWeight: 700,
              padding: '2px 6px', borderRadius: 5,
              background: 'rgba(212, 132, 122, 0.12)',
              color: DT.rose,
              letterSpacing: '0.08em',
              animation: 'biomarkerCriticalPulse 2s ease-in-out infinite',
            }}>
              {criticalCount} CRITICAL
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              fontSize: 8, fontWeight: 700,
              padding: '2px 6px', borderRadius: 5,
              background: 'rgba(196, 164, 108, 0.1)',
              color: DT.gold,
              letterSpacing: '0.08em',
            }}>
              {warningCount} WARN
            </span>
          )}
          <span style={{
            fontSize: 11, color: DT.dim,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            display: 'inline-block',
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* Loading state */}
      {loading && visibleInsights.length === 0 && (
        <div style={{
          padding: '6px 16px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: DT.terra,
              opacity: 0.5,
              animation: `ioaPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
          <span style={{ fontSize: 9, color: DT.dim, letterSpacing: '0.04em' }}>
            Analyzing cross-domain correlations...
          </span>
        </div>
      )}

      {/* Collapsed: Single active insight ticker */}
      {!expanded && activeInsight && (
        <div style={{ padding: '0 16px 12px' }}>
          <InsightTicker
            insight={activeInsight}
            index={activeIndex}
            total={visibleInsights.length}
            isPulsing={pulsingIds.has(activeInsight.id)}
          />
        </div>
      )}

      {/* Expanded: Full insight list */}
      {expanded && (
        <div style={{
          padding: '0 16px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: 380,
          overflowY: 'auto',
        }}>
          {visibleInsights.map((insight, idx) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={() => handleDismiss(insight.id)}
              isActive={idx === activeIndex}
              isPulsing={pulsingIds.has(insight.id)}
              delay={idx * 60}
            />
          ))}

          <button
            onClick={(e) => { e.stopPropagation(); fetchInsights() }}
            disabled={loading}
            className="glass-inset"
            style={{
              padding: '8px 12px',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.25s',
              marginTop: 4,
              border: `1px solid ${DT.border}`,
            }}
          >
            <span style={{
              fontSize: 11,
              animation: loading ? 'ioaSpin 1s linear infinite' : 'none',
              display: 'inline-block',
              color: DT.terra,
            }}>↻</span>
            <span className="hct-sublabel" style={{ fontSize: 9 }}>
              {loading ? 'Re-analyzing' : 'Re-analyze Correlations'}
            </span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes ioaPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes ioaSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ── Insight Ticker (collapsed view) ── */
function InsightTicker({ insight, index, total, isPulsing }: {
  insight: Insight; index: number; total: number; isPulsing: boolean;
}) {
  const cfg = SEVERITY_CONFIG[insight.severity]
  return (
    <div
      className={isPulsing ? `${cfg.glowClass} proximity-ripple` : ''}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px',
        borderRadius: 14,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        animation: isPulsing ? undefined : 'insightFadeUp 0.4s ease forwards',
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        background: `${cfg.text}12`,
        border: `1px solid ${cfg.text}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, flexShrink: 0,
        boxShadow: isPulsing ? `0 0 12px ${cfg.glow}` : 'none',
        transition: 'box-shadow 0.4s',
      }}>
        {insight.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span className="hct-label" style={{
            fontSize: 8, color: cfg.text,
          }}>
            {insight.label}
          </span>
          <span style={{
            fontSize: 7, color: DT.dim,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {index + 1}/{total}
          </span>
        </div>
        <p style={{
          fontSize: 10, lineHeight: 1.55, color: DT.muted,
          margin: 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as any,
        }}>
          {insight.message}
        </p>
      </div>
    </div>
  )
}

/* ── Full Insight Card (expanded view) ── */
function InsightCard({ insight, onDismiss, isActive, isPulsing, delay }: {
  insight: Insight; onDismiss: () => void; isActive: boolean; isPulsing: boolean; delay: number;
}) {
  const [showFix, setShowFix] = useState(false)
  const cfg = SEVERITY_CONFIG[insight.severity]

  return (
    <div
      className={isPulsing ? `${cfg.glowClass} proximity-ripple` : 'insight-fade-up'}
      style={{
        borderRadius: 14,
        background: cfg.bg,
        border: `1px solid ${isActive ? cfg.text + '25' : cfg.border}`,
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        animationDelay: `${delay}ms`,
        opacity: 0,
        animationFillMode: 'forwards',
      }}
    >
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 7px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `${cfg.text}10`,
            border: `1px solid ${cfg.text}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
            boxShadow: isPulsing ? `0 0 10px ${cfg.glow}` : 'none',
          }}>
            {insight.icon}
          </div>
          <span className="hct-label" style={{ fontSize: 9, color: cfg.text }}>
            {insight.label}
          </span>
          <span style={{
            fontSize: 7, fontWeight: 700,
            padding: '1px 5px', borderRadius: 4,
            background: cfg.text + '12',
            color: cfg.text,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}>
            {insight.severity}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: DT.dim, padding: '2px 4px',
            borderRadius: 4,
            transition: 'color 0.2s',
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Message */}
      <div style={{ padding: '0 12px 10px' }}>
        <p style={{
          fontSize: 10.5, lineHeight: 1.6, color: DT.muted,
          margin: 0,
        }}>
          {insight.message}
        </p>
      </div>

      {/* Protocol Fix toggle */}
      <div style={{
        borderTop: `1px solid ${cfg.border}`,
        padding: '7px 12px',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowFix(!showFix) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: 0,
          }}
        >
          <span style={{
            fontSize: 8, color: cfg.text,
            transform: showFix ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            display: 'inline-block',
          }}>▶</span>
          <span className="hct-label" style={{ fontSize: 8, color: cfg.text }}>
            Protocol Adjustment
          </span>
        </button>

        {showFix && (
          <div className="glass-inset" style={{
            marginTop: 8, padding: '8px 10px',
            animation: 'insightFadeUp 0.25s ease forwards',
          }}>
            <p style={{
              fontSize: 10, lineHeight: 1.55,
              color: DT.terra,
              margin: 0,
              opacity: 0.85,
            }}>
              {insight.protocolFix}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
