import { getTwinSessionId } from '@/lib/twinSession'
/* DEPRECATED — see App.old.tsx history. Not imported anywhere.
   Legacy Digital Twin View
   
   Integrates SomaticMirror + BioProjection side-by-side with
   a live Intelligence Overlay powered by the AI Brain.
   Protocol completions from CommandBar instantly update both
   panels via Convex real-time subscriptions.
   
   Responsive: SomaticBodyMap stays centered, panels stack on mobile.
   Toggle HUD: Press 'H' or use the eye button to hide all overlays.
   ══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../convex/_generated/api'
import SomaticMirror from '@/components/twin/SomaticMirror'
import BioProjection from '@/components/analytics/BioProjection'

/* ── Design Tokens ── */
const DT = {
  bg: '#060608',
  surface: 'rgba(12,12,16,0.80)',
  card: 'rgba(14,14,20,0.65)',
  border: 'rgba(255,255,255,0.04)',
  borderActive: 'rgba(0,255,204,0.12)',
  text: '#E8E8EC',
  muted: 'rgba(255,255,255,0.45)',
  dim: 'rgba(255,255,255,0.22)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,',
  blue: '#6B8AFF',
  amber: '#FFB86B',
  red: '#FF6B6B',
  glass: 'blur(24px) saturate(1.3)',
}

/* ── Session helper ── */
/* ── Responsive hook ── */
function useBreakpoint() {
  const [width, setWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    width,
  }
}

/* ── Intelligence Brief Card ── */
function IntelligenceBrief({
  sessionId,
  protocolsDone,
  protocolsTotal,
}: {
  sessionId: string
  protocolsDone: number
  protocolsTotal: number
}) {
  const [brief, setBrief] = useState<{
    brief: string
    positiveTrend: string
    requiredAdjustment: string
    source: 'llm' | 'local'
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState(0)

  const generateBrief = useAction(api.aiBrain.generateContextualBrief)

  const fetchBrief = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const result = await generateBrief({ sessionId })
      setBrief(result)
      setLastFetched(Date.now())
    } catch {
      setBrief({
        brief: 'Analyzing your biological data to generate insights. Complete more protocols to improve data resolution.',
        positiveTrend: 'System monitoring active',
        requiredAdjustment: 'Continue protocol adherence for deeper analysis',
        source: 'local',
      })
    } finally {
      setLoading(false)
    }
  }, [generateBrief, sessionId, loading])

  useEffect(() => {
    const stale = Date.now() - lastFetched > 120_000
    if (!brief || stale) {
      fetchBrief()
    }
  }, [protocolsDone]) // eslint-disable-line react-hooks/exhaustive-deps

  const completionPct = protocolsTotal > 0 ? Math.round((protocolsDone / protocolsTotal) * 100) : 0
  const pctColor = completionPct >= 80 ? DT.accent : completionPct >= 50 ? DT.blue : completionPct >= 25 ? DT.amber : DT.red

  return (
    <div style={{
      borderRadius: 16,
      background: DT.card,
      border: `1px solid ${DT.border}`,
      backdropFilter: DT.glass,
      WebkitBackdropFilter: DT.glass,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${DT.accentGlow}0.2), transparent)`,
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${DT.accentGlow}0.08)`,
            border: `1px solid ${DT.accentGlow}0.15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            🧬
          </div>
          <div>
            <div style={{
              fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              color: DT.accent,
            }}>
              Intelligence Overlay
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 7, color: DT.dim,
              letterSpacing: '0.06em',
            }}>
              {brief?.source === 'llm' ? 'AI-Powered Analysis' : 'Local Analysis'} · Live
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchBrief}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '4px 8px',
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.2s',
          }}
        >
          <span style={{
            fontSize: 10,
            animation: loading ? 'dtSpin 1s linear infinite' : 'none',
            display: 'inline-block',
          }}>
            ↻
          </span>
          <span style={{
            fontFamily: 'monospace', fontSize: 7, color: DT.muted,
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
          }}>
            {loading ? 'Analyzing' : 'Refresh'}
          </span>
        </button>
      </div>

      {/* Protocol completion bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 7, color: DT.dim,
            letterSpacing: '0.1em', textTransform: 'uppercase' as const,
          }}>
            Protocol Adherence
          </span>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
            color: pctColor, letterSpacing: '-0.02em',
          }}>
            {protocolsDone}/{protocolsTotal} · {completionPct}%
          </span>
        </div>
        <div style={{
          height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${completionPct}%`,
            background: `linear-gradient(90deg, ${pctColor}80, ${pctColor})`,
            boxShadow: `0 0 8px ${pctColor}30`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      </div>

      {/* Brief text */}
      {brief ? (
        <div style={{ marginBottom: 10 }}>
          <p style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11, lineHeight: 1.6, color: DT.muted,
            margin: 0,
          }}>
            {brief.brief}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 0',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: `${DT.accentGlow}0.4)`,
              animation: `dtPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
          <span style={{
            fontFamily: 'monospace', fontSize: 8, color: DT.dim,
          }}>
            Generating contextual brief...
          </span>
        </div>
      )}

      {/* Trend cards */}
      {brief && (
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Positive Trend */}
          <div style={{
            flex: 1, padding: '8px 10px', borderRadius: 10,
            background: `${DT.accentGlow}0.04)`,
            border: `1px solid ${DT.accentGlow}0.10)`,
          }}>
            <div style={{
              fontFamily: 'monospace', fontSize: 7, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              color: `${DT.accent}CC`, marginBottom: 3,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontSize: 8 }}>▲</span> Positive Trend
            </div>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 9, color: DT.muted, lineHeight: 1.45,
            }}>
              {brief.positiveTrend}
            </div>
          </div>

          {/* Required Adjustment */}
          <div style={{
            flex: 1, padding: '8px 10px', borderRadius: 10,
            background: 'rgba(255,184,107,0.04)',
            border: '1px solid rgba(255,184,107,0.10)',
          }}>
            <div style={{
              fontFamily: 'monospace', fontSize: 7, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              color: 'rgba(255,184,107,0.8)', marginBottom: 3,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontSize: 8 }}>◆</span> Adjustment
            </div>
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 9, color: DT.muted, lineHeight: 1.45,
            }}>
              {brief.requiredAdjustment}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Live Pulse Indicator ── */
function LivePulse() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: DT.accent,
        boxShadow: `0 0 6px ${DT.accentGlow}0.5)`,
        animation: 'dtLivePulse 2s ease-in-out infinite',
      }} />
      <span style={{
        fontFamily: 'monospace', fontSize: 8, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase' as const,
        color: `${DT.accent}CC`,
      }}>
        Live
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT — Digital Twin Single-Pane View (Responsive)
   ══════════════════════════════════════════════════════════════════ */

export default function App() {
  const sessionId = getTwinSessionId()
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId })
  const { isMobile, isTablet, isDesktop } = useBreakpoint()

  const protocolsDone = protocolStatus?.done ?? 0
  const protocolsTotal = protocolStatus?.total ?? 0

  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  // Responsive grid layout
  const gridStyle = useMemo(() => {
    if (isDesktop) {
      return {
        display: 'grid' as const,
        gridTemplateColumns: '320px 1fr',
        gap: 16,
        padding: 16,
        maxWidth: 1400,
        margin: '0 auto',
        minHeight: 'calc(100vh - 60px)',
      }
    }
    if (isTablet) {
      return {
        display: 'grid' as const,
        gridTemplateColumns: '1fr',
        gap: 14,
        padding: 14,
        maxWidth: 720,
        margin: '0 auto',
        minHeight: 'calc(100vh - 60px)',
      }
    }
    // Mobile
    return {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      gap: 12,
      padding: '12px 10px',
      maxWidth: 480,
      margin: '0 auto',
      minHeight: 'calc(100vh - 56px)',
    }
  }, [isDesktop, isTablet])

  return (
    <div style={{
      minHeight: '100vh',
      background: DT.bg,
      color: DT.text,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '10px 14px' : '12px 20px',
        borderBottom: `1px solid ${DT.border}`,
        background: DT.surface,
        backdropFilter: DT.glass,
        WebkitBackdropFilter: DT.glass,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10 }}>
          <div style={{
            width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: isMobile ? 8 : 10,
            background: `linear-gradient(135deg, ${DT.accentGlow}0.15), rgba(107,138,255,0.10))`,
            border: `1px solid ${DT.accentGlow}0.20)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 13 : 15,
          }}>
            ◎
          </div>
          <div>
            <div style={{
              fontSize: isMobile ? 12 : 13, fontWeight: 700, letterSpacing: '-0.02em',
              color: DT.text,
            }}>
              Digital Twin
            </div>
            {!isMobile && (
              <div style={{
                fontFamily: 'monospace', fontSize: 8, color: DT.dim,
                letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              }}>
                Single-Pane Biological View
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
          <LivePulse />
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'monospace', fontSize: isMobile ? 11 : 13, fontWeight: 600,
              color: DT.text, letterSpacing: '-0.02em',
            }}>
              {timeStr}
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: isMobile ? 7 : 8, color: DT.dim,
              letterSpacing: '0.06em',
            }}>
              {dateStr}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content — Responsive Layout ── */}
      <div style={gridStyle}>
        {/* ── Left Column / Top on mobile — Somatic Mirror (always centered) ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 12,
          ...(isTablet ? { maxWidth: 400, margin: '0 auto', width: '100%' } : {}),
          ...(isMobile ? { alignItems: 'center' } : {}),
        }}>
          {/* Somatic Mirror — centered on all breakpoints */}
          <div style={{
            borderRadius: isMobile ? 16 : 20,
            overflow: 'hidden',
            border: `1px solid ${DT.border}`,
            transition: 'border-color 0.6s ease',
            width: '100%',
            maxWidth: isMobile ? 320 : isTablet ? 380 : undefined,
            margin: isMobile || isTablet ? '0 auto' : undefined,
          }}>
            <SomaticMirror />
          </div>

          {/* Intelligence Brief */}
          <div style={{
            width: '100%',
            maxWidth: isMobile ? 320 : isTablet ? 380 : undefined,
            margin: isMobile || isTablet ? '0 auto' : undefined,
          }}>
            <IntelligenceBrief
              sessionId={sessionId}
              protocolsDone={protocolsDone}
              protocolsTotal={protocolsTotal}
            />
          </div>

          {/* System Status Footer */}
          <div style={{
            padding: '10px 14px', borderRadius: 12,
            background: DT.card,
            border: `1px solid ${DT.border}`,
            backdropFilter: DT.glass,
            WebkitBackdropFilter: DT.glass,
            width: '100%',
            maxWidth: isMobile ? 320 : isTablet ? 380 : undefined,
            margin: isMobile || isTablet ? '0 auto' : undefined,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{
                fontFamily: 'monospace', fontSize: 7, color: DT.dim,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              }}>
                Twin Sync Status
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: DT.accent,
                  boxShadow: `0 0 4px ${DT.accentGlow}0.4)`,
                }} />
                <span style={{
                  fontFamily: 'monospace', fontSize: 7, color: `${DT.accent}AA`,
                  letterSpacing: '0.08em',
                }}>
                  SYNCED
                </span>
              </div>
            </div>
            <div style={{
              marginTop: 6,
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              {[
                { label: 'Mirror', status: 'Active', icon: '◎' },
                { label: 'Projection', status: 'Active', icon: '📈' },
                { label: 'AI Brain', status: 'Online', icon: '🧬' },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 9 }}>{s.icon}</span>
                  <div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 7, color: DT.muted,
                      letterSpacing: '0.06em',
                    }}>
                      {s.label}
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 7, color: `${DT.accent}88`,
                      letterSpacing: '0.06em',
                    }}>
                      {s.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Column / Bottom on mobile — BioProjection ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 12,
        }}>
          {/* BioProjection Chart */}
          <BioProjection
            sessionId={sessionId}
            className="flex-1"
          />

          {/* Reactive Status Bar */}
          <div style={{
            padding: isMobile ? '10px 12px' : '12px 16px',
            borderRadius: isMobile ? 12 : 14,
            background: DT.card,
            border: `1px solid ${DT.border}`,
            backdropFilter: DT.glass,
            WebkitBackdropFilter: DT.glass,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            gap: isMobile ? 6 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'monospace', fontSize: isMobile ? 7 : 8, color: DT.dim,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                flexShrink: 0,
              }}>
                Reactive Feed
              </div>
              {!isMobile && (
                <div style={{
                  width: 1, height: 14, background: 'rgba(255,255,255,0.06)',
                  flexShrink: 0,
                }} />
              )}
              <div style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: isMobile ? 9 : 10, color: DT.muted,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {protocolsDone === protocolsTotal && protocolsTotal > 0
                  ? '✓ All protocols complete — twin fully synchronized'
                  : protocolsDone > 0
                    ? `${protocolsDone} protocol${protocolsDone > 1 ? 's' : ''} logged — mirror updating in real-time`
                    : 'Awaiting protocol completions to calibrate twin state'}
              </div>
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: isMobile ? 7 : 8, color: DT.dim,
              letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {timeStr}
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes dtSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dtPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes dtLivePulse {
          0%, 100% { opacity: 0.6; box-shadow: 0 0 4px ${DT.accentGlow}0.3); }
          50% { opacity: 1; box-shadow: 0 0 10px ${DT.accentGlow}0.6); }
        }
      `}</style>
    </div>
  )
}
