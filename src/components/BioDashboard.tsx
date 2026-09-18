import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useBioContext } from '@/hooks/useBioContext'
import { motion, AnimatePresence } from 'framer-motion'

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const C = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceElevated: 'rgba(18,18,24,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.12)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.12)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Session ID ── */
/* ═══════════════════════════════════════════════════════════════
   ANIMATED RING — SVG arc with glow + animated stroke
   ═══════════════════════════════════════════════════════════════ */
function AnimatedRing({
  value, max = 100, size = 140, strokeWidth = 6,
  color, glowColor, label, sublabel, icon,
  children,
}: {
  value: number; max?: number; size?: number; strokeWidth?: number;
  color: string; glowColor: string; label: string; sublabel: string; icon: string;
  children?: React.ReactNode;
}) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(1, animatedValue / max)
  const offset = circumference * (1 - progress)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Glow backdrop */}
        <div style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          opacity: progress > 0.5 ? 0.6 : 0.3,
          transition: 'opacity 1s ease',
        }} />

        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)',
              filter: `drop-shadow(0 0 6px ${color}60)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}>
          <span style={{ fontSize: 20, marginBottom: 2 }}>{icon}</span>
          <span style={{
            fontSize: 24, fontWeight: 800, color, fontFamily: 'monospace',
            lineHeight: 1, letterSpacing: '-0.02em',
          }}>
            {Math.round(animatedValue)}%
          </span>
        </div>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.text,
          letterSpacing: '0.04em', lineHeight: 1.2,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 9, color: C.textSec, marginTop: 2,
          fontFamily: 'monospace', letterSpacing: '0.02em',
        }}>
          {sublabel}
        </div>
      </div>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   QUICK ACTION BUTTON — Dynamic CTA based on critical need
   ═══════════════════════════════════════════════════════════════ */
function QuickActionButton({ action, onTap }: {
  action: {
    type: string; label: string; sublabel: string;
    icon: string; accentColor: string;
  };
  onTap: () => void;
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <motion.button
      onClick={onTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      animate={{ scale: pressed ? 0.97 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        background: C.surfaceElevated,
        border: `1px solid ${action.accentColor}25`,
        borderRadius: 16,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent glow */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: action.accentColor,
        boxShadow: `0 0 12px ${action.accentColor}60`,
        borderRadius: '0 2px 2px 0',
      }} />

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${action.accentColor}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {action.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.text,
          lineHeight: 1.3,
        }}>
          {action.label}
        </div>
        <div style={{
          fontSize: 10, color: C.textSec, marginTop: 2,
          lineHeight: 1.3,
        }}>
          {action.sublabel}
        </div>
      </div>

      {/* Arrow */}
      <div style={{
        fontSize: 14, color: action.accentColor, fontWeight: 700,
        opacity: 0.7,
      }}>
        →
      </div>
    </motion.button>
  )
}

/* ═══════════════════════════════════════════════════════════════
   INSIGHT CARD — Cross-system intelligence from useBioContext
   ═══════════════════════════════════════════════════════════════ */
function InsightCard({ insight }: {
  insight: {
    id: string; priority: string; title: string; action: string;
    sources: Array<{ system: string; detail: string }>;
    correlationScore: number;
  };
}) {
  const [expanded, setExpanded] = useState(false)
  const priorityColor = insight.priority === 'critical' ? C.red
    : insight.priority === 'high' ? C.orange : C.blue

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 14px',
        background: C.surfaceElevated,
        border: `1px solid ${priorityColor}20`,
        borderRadius: 14,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Priority indicator */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', marginTop: 4,
          background: priorityColor, flexShrink: 0,
          boxShadow: `0 0 8px ${priorityColor}50`,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.text,
            lineHeight: 1.3, marginBottom: 4,
          }}>
            {insight.title}
          </div>

          {/* Source badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: expanded ? 8 : 0 }}>
            {insight.sources.map((s, i) => (
              <span key={i} style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                padding: '2px 6px', borderRadius: 4,
                background: s.system === 'somatic' ? 'rgba(59,130,246,0.1)'
                  : s.system === 'inventory' ? 'rgba(232,151,108,0.1)'
                  : s.system === 'drift' ? 'rgba(255,107,107,0.1)'
                  : 'rgba(0,220,130,0.1)',
                color: s.system === 'somatic' ? C.blueBright
                  : s.system === 'inventory' ? C.orange
                  : s.system === 'drift' ? C.red
                  : C.green,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {s.system}
              </span>
            ))}
            <span style={{
              fontSize: 8, fontFamily: 'monospace', color: C.textTer,
              padding: '2px 4px',
            }}>
              {insight.correlationScore}% corr
            </span>
          </div>

          {/* Expanded: action recommendation */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  fontSize: 10, color: C.textSec, lineHeight: 1.5,
                  padding: '8px 0 4px',
                  borderTop: `1px solid ${C.border}`,
                }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: priorityColor,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    display: 'block', marginBottom: 4,
                  }}>
                    RECOMMENDED ACTION
                  </span>
                  {insight.action}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MINI STAT ROW — Compact metric display
   ═══════════════════════════════════════════════════════════════ */
function MiniStat({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 10,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: C.textTer, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BIO-DASHBOARD — Three-Ring Home Screen
   ═══════════════════════════════════════════════════════════════ */
export default function BioDashboard() {
  const sessionId = useMemo(() => getTwinSessionId(), [])
  const rings = useQuery(api.bioDashboard.getDashboardRings, { sessionId })
  const bioContext = useBioContext()
  const [pulseFrame, setPulseFrame] = useState(0)

  // Breathing animation
  useEffect(() => {
    const interval = setInterval(() => setPulseFrame(f => (f + 1) % 360), 50)
    return () => clearInterval(interval)
  }, [])

  const breathe = 0.7 + 0.3 * Math.sin((pulseFrame / 360) * Math.PI * 2)

  const handleQuickAction = useCallback(() => {
    if (!rings?.quickAction) return
    // Dispatch navigation or modal based on action type
    const type = rings.quickAction.type
    if (type === 'order' && rings.quickAction.metadata?.reorderUrl) {
      window.open(rings.quickAction.metadata.reorderUrl, '_blank')
    }
    // Other actions could trigger modals/navigation
  }, [rings?.quickAction])

  // Loading state
  if (!rings) {
    return (
      <div style={{
        padding: '32px 16px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16,
      }}>
        <div style={{ position: 'relative', width: 48, height: 48 }}>
          <div style={{
            width: 48, height: 48, border: '2px solid rgba(59,130,246,0.08)',
            borderTopColor: C.blue, borderRadius: '50%',
            animation: 'bd-spin 0.8s linear infinite',
          }} />
        </div>
        <div style={{
          fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
          color: C.blueBright, letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          INITIALIZING BIO-DASHBOARD
        </div>
        <style>{`@keyframes bd-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Ring colors based on values
  const adherenceColor = rings.adherence.percent >= 80 ? C.accent
    : rings.adherence.percent >= 50 ? C.blueBright : C.orange
  const resilienceColor = rings.resilience.percent >= 80 ? C.green
    : rings.resilience.percent >= 60 ? C.blueBright
    : rings.resilience.percent >= 40 ? C.orange : C.red
  const inventoryColor = rings.inventory.percent >= 80 ? C.accent
    : rings.inventory.percent >= 50 ? C.orange : C.red

  return (
    <div style={{ padding: '20px 16px 32px' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 6,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: bioContext.integrityColor,
            boxShadow: `0 0 ${8 * breathe}px ${bioContext.integrityColor}60`,
            transition: 'all 0.5s',
          }} />
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: bioContext.integrityColor, letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            {bioContext.integrityLabel} · {bioContext.systemStatus.overallIntegrity}% INTEGRITY
          </span>
        </div>
        <h1 style={{
          fontSize: 20, fontWeight: 800, color: C.text,
          letterSpacing: '-0.02em', margin: 0,
        }}>
          Bio-Dashboard
        </h1>
        <div style={{
          fontSize: 10, color: C.textTer, fontFamily: 'monospace',
          marginTop: 4,
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* ── Three Rings ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 12,
        marginBottom: 28, flexWrap: 'wrap',
      }}>
        <AnimatedRing
          value={rings.adherence.percent}
          color={adherenceColor}
          glowColor={rings.adherence.percent >= 80 ? C.accentGlow : C.blueGlow}
          icon="⚡"
          label="Protocol Adherence"
          sublabel={`${rings.adherence.completed}/${rings.adherence.total} today`}
        />
        <AnimatedRing
          value={rings.resilience.percent}
          color={resilienceColor}
          glowColor={rings.resilience.percent >= 80 ? C.greenGlow : C.orangeGlow}
          icon="💎"
          label="System Resilience"
          sublabel={rings.resilience.status.charAt(0).toUpperCase() + rings.resilience.status.slice(1)}
        />
        <AnimatedRing
          value={rings.inventory.percent}
          color={inventoryColor}
          glowColor={rings.inventory.percent >= 80 ? C.accentGlow : C.redGlow}
          icon="🧬"
          label="Inventory Coverage"
          sublabel={`${rings.inventory.covered}/${rings.inventory.totalTracked} stocked`}
        />
      </div>

      {/* ── Quick Action ── */}
      {rings.quickAction && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: C.textTer, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 8, paddingLeft: 4,
          }}>
            PRIORITY ACTION
          </div>
          <QuickActionButton action={rings.quickAction} onTap={handleQuickAction} />
        </div>
      )}

      {/* ── Resilience Breakdown ── */}
      <div style={{
        marginBottom: 20, padding: '14px 14px 10px',
        background: C.surfaceElevated, borderRadius: 16,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: C.blueBright, letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          RESILIENCE BREAKDOWN
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MiniStat
            icon="💓" label="HRV"
            value={rings.resilience.hrv > 0 ? `${rings.resilience.hrv}ms` : '—'}
            color={rings.resilience.hrv >= 60 ? C.green : rings.resilience.hrv >= 40 ? C.orange : C.red}
          />
          <MiniStat
            icon="😴" label="Sleep Score"
            value={rings.resilience.sleepScore > 0 ? `${rings.resilience.sleepScore}` : '—'}
            color={rings.resilience.sleepScore >= 80 ? C.green : rings.resilience.sleepScore >= 60 ? C.orange : C.red}
          />
          <MiniStat
            icon="🔄" label="Recovery"
            value={`${rings.resilience.recoveryScore}%`}
            color={rings.resilience.recoveryScore >= 80 ? C.green : rings.resilience.recoveryScore >= 60 ? C.orange : C.red}
          />
        </div>
      </div>

      {/* ── Low Supply Alerts ── */}
      {rings.inventory.lowSupply.length > 0 && (
        <div style={{
          marginBottom: 20, padding: '14px 14px 10px',
          background: C.surfaceElevated, borderRadius: 16,
          border: `1px solid ${C.orange}15`,
        }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: C.orange, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            LOW SUPPLY · {rings.inventory.lowSupply.length} ITEM{rings.inventory.lowSupply.length !== 1 ? 'S' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rings.inventory.lowSupply.map((item: any) => (
              <MiniStat
                key={item.id}
                icon={item.icon || '💊'}
                label={item.name}
                value={item.daysRemaining <= 0 ? 'DEPLETED' : `${item.daysRemaining}d left`}
                color={item.daysRemaining <= 0 ? C.red : item.daysRemaining <= 3 ? C.orange : C.blueBright}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Synthesized Insights from useBioContext ── */}
      {bioContext.insights.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: C.textTer, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 10, paddingLeft: 4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>DEEP INTELLIGENCE</span>
            {bioContext.hasCritical && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: C.red, display: 'inline-block',
                boxShadow: `0 0 6px ${C.red}60`,
                animation: 'bd-pulse 2s ease-in-out infinite',
              }} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bioContext.insights.slice(0, 3).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* ── Secondary Actions ── */}
      {rings.allActions.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: C.textTer, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 10, paddingLeft: 4,
          }}>
            OTHER ACTIONS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rings.allActions.slice(1, 4).map((action: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 16 }}>{action.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{action.label}</div>
                  <div style={{ fontSize: 9, color: C.textTer }}>{action.sublabel}</div>
                </div>
                <span style={{ fontSize: 12, color: C.textTer }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── System Status Footer ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 16,
        padding: '12px 0', borderTop: `1px solid ${C.border}`,
        marginTop: 8,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
            {rings.activeDriftCount}
          </div>
          <div style={{ fontSize: 8, color: C.textTer, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            DRIFTS
          </div>
        </div>
        <div style={{ width: 1, background: C.border }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
            {rings.somaticSignals}
          </div>
          <div style={{ fontSize: 8, color: C.textTer, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            SOMATIC
          </div>
        </div>
        <div style={{ width: 1, background: C.border }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
            {bioContext.systemStatus.overallIntegrity}%
          </div>
          <div style={{ fontSize: 8, color: C.textTer, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            INTEGRITY
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bd-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
