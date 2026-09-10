import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useBiometricSync } from '@/hooks/useBiometricSync'
import {
  runBioIntelligence,
  type BioIntelligenceReport,
} from '@/lib/BioIntelligence'
import type { BiometricInputs } from '@/lib/IntelligenceEngine'
import { useProductRecommendations } from '@/lib/RecommendationEngine'
import SomaticMirror from '@/components/SomaticMirror'

/* ── HUD Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceHover: 'rgba(22,22,30,0.95)',
  surfaceElevated: 'rgba(18,18,24,0.96)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  textQuad: 'rgba(255,255,255,0.15)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  blueMuted: 'rgba(59,130,246,0.08)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.12)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  gold: '#FFD700',
  goldGlow: 'rgba(255,215,0,0.12)',
  purple: '#A78BFA',
  purpleGlow: 'rgba(167,139,250,0.12)',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
  borderAccent: 'rgba(0,255,204,0.12)',
}

/* ── Timeline Node Types ── */
type NodeType = 'vitals' | 'protocol' | 'alert' | 'win' | 'projection' | 'intervention' | 'milestone' | 'insight' | 'body-scan' | 'micro-chart' | 'section-header'

interface TimelineNode {
  id: string
  type: NodeType
  timestamp: number
  title: string
  subtitle: string
  icon: string
  accentColor: string
  glowColor: string
  data: Record<string, any>
  priority: number
  actionable?: boolean
  actionLabel?: string
  completed?: boolean
  section?: 'morning' | 'afternoon' | 'evening' | 'future'
}

/* ── Helpers ── */
function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id')
    if (!id) { id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('vive-session-id', id) }
    return id
  } catch { return 'guest-user' }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - ts
  if (diffMs < 60000) return 'Just now'
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
  if (diffMs < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  if (diffMs < 172800000) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFutureTime(ts: number): string {
  const diffMs = ts - Date.now()
  if (diffMs < 3600000) return `in ${Math.ceil(diffMs / 60000)}m`
  if (diffMs < 86400000) return `in ${Math.ceil(diffMs / 3600000)}h`
  return `in ${Math.ceil(diffMs / 86400000)}d`
}

function getTimeSection(ts: number): 'morning' | 'afternoon' | 'evening' | 'future' {
  if (ts > Date.now()) return 'future'
  const h = new Date(ts).getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const SECTION_META: Record<string, { label: string; icon: string; color: string }> = {
  morning: { label: 'MORNING', icon: '🌅', color: T.orange },
  afternoon: { label: 'AFTERNOON', icon: '☀️', color: T.gold },
  evening: { label: 'EVENING', icon: '🌙', color: T.purple },
  future: { label: 'BIO-PROJECTION', icon: '🔮', color: T.blueBright },
}

/* ═══════════════════════════════════════════════════════════════
   LIVE VITALS HEADER — Immersive real-time vitals strip
   ═══════════════════════════════════════════════════════════════ */

function LiveVitalsHeader({ vitals, score }: { vitals: any; score: number }) {
  const [pulsePhase, setPulsePhase] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setPulsePhase(p => (p + 1) % 100), 80)
    return () => clearInterval(iv)
  }, [])

  const scoreColor = score >= 75 ? T.green : score >= 50 ? T.orange : T.red

  const metrics = useMemo(() => [
    { key: 'hr', label: 'HR', value: Math.round(vitals.heartRate), unit: 'bpm', color: vitals.heartRate > 80 ? T.red : vitals.heartRate < 55 ? T.blue : T.green, icon: '❤️' },
    { key: 'hrv', label: 'HRV', value: Math.round(vitals.hrv), unit: 'ms', color: vitals.hrv >= 55 ? T.green : vitals.hrv >= 40 ? T.orange : T.red, icon: '💓' },
    { key: 'recovery', label: 'REC', value: Math.round(vitals.recovery), unit: '%', color: vitals.recovery >= 70 ? T.green : vitals.recovery >= 50 ? T.orange : T.red, icon: '⚡' },
    { key: 'sleep', label: 'SLP', value: Math.round(vitals.sleepScore), unit: '', color: vitals.sleepScore >= 80 ? T.green : vitals.sleepScore >= 60 ? T.orange : T.red, icon: '🌙' },
    { key: 'strain', label: 'STR', value: vitals.strain.toFixed(1), unit: '', color: vitals.strain > 14 ? T.red : vitals.strain > 8 ? T.orange : T.green, icon: '🏋️' },
    { key: 'spo2', label: 'O₂', value: vitals.spo2.toFixed(1), unit: '%', color: vitals.spo2 >= 96 ? T.green : T.red, icon: '🫁' },
  ], [vitals])

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient backdrop */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16,
        background: `radial-gradient(ellipse at 30% 50%, ${scoreColor}08, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Composite Score Ring */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px 10px', position: 'relative',
      }}>
        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke={T.border} strokeWidth="3" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={scoreColor} strokeWidth="3"
              strokeLinecap="round" strokeDasharray={`${(score / 100) * 150.8} 150.8`}
              transform="rotate(-90 28 28)"
              style={{ filter: `drop-shadow(0 0 6px ${scoreColor}60)`, transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 18, fontFamily: 'monospace', fontWeight: 900, color: scoreColor,
              lineHeight: 1, textShadow: `0 0 16px ${scoreColor}50`,
            }}>
              {Math.round(score)}
            </span>
            <span style={{
              fontSize: 6, fontFamily: 'monospace', color: T.textTer,
              letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 1,
            }}>
              SCORE
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 7, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 3,
          }}>
            BIOLOGICAL OPTIMIZATION
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'monospace', color: T.textSec, lineHeight: 1.5,
          }}>
            {score >= 75 ? 'Systems primed — ready for peak output' :
             score >= 50 ? 'Moderate readiness — optimize recovery' :
             'Recovery priority — reduce strain load'}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(0,220,130,0.06)', border: `1px solid rgba(0,220,130,0.15)`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: T.green,
            boxShadow: `0 0 8px ${T.green}60`,
            animation: 'tl-pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.green, fontWeight: 700, letterSpacing: '0.1em' }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Vitals Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
        padding: '0 12px 12px',
      }}>
        {metrics.map(m => (
          <div key={m.key} style={{
            textAlign: 'center', padding: '6px 2px', borderRadius: 10,
            background: `${m.color}06`, border: `1px solid ${m.color}10`,
            transition: 'all 0.3s',
          }}>
            <div style={{ fontSize: 9, marginBottom: 1 }}>{m.icon}</div>
            <div style={{
              fontSize: 15, fontFamily: 'monospace', fontWeight: 800, color: m.color,
              lineHeight: 1.1, textShadow: `0 0 10px ${m.color}35`,
            }}>
              {m.value}
            </div>
            <div style={{
              fontSize: 6, fontFamily: 'monospace', color: T.textQuad,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1,
            }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Heartbeat line */}
      <div style={{ padding: '0 12px 8px' }}>
        <svg width="100%" height="12" viewBox="0 0 300 12" preserveAspectRatio="none" style={{ opacity: 0.3 }}>
          <path
            d={`M0,6 ${Array.from({ length: 30 }, (_, i) => {
              const x = i * 10
              const phase = (i + pulsePhase * 0.3) % 10
              const y = phase < 2 ? 6 - Math.sin(phase * Math.PI) * 5 : phase < 3 ? 6 + Math.sin((phase - 2) * Math.PI) * 3 : 6
              return `L${x},${y}`
            }).join(' ')}`}
            fill="none" stroke={T.green} strokeWidth="1" strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION DIVIDER — Time-segment headers in the stream
   ═══════════════════════════════════════════════════════════════ */

function SectionDivider({ section, nodeCount }: { section: string; nodeCount: number }) {
  const meta = SECTION_META[section] || SECTION_META.morning
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 0 4px', margin: '4px 0',
    }}>
      <div style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 8,
        background: `${meta.color}08`, border: `1px solid ${meta.color}15`,
      }}>
        <span style={{ fontSize: 10 }}>{meta.icon}</span>
        <span style={{
          fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
          color: meta.color, letterSpacing: '0.15em',
        }}>
          {meta.label}
        </span>
        <span style={{
          fontSize: 7, fontFamily: 'monospace', color: T.textTer,
          marginLeft: 2,
        }}>
          {nodeCount}
        </span>
      </div>
      <div style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, ${meta.color}20, transparent)`,
      }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   NOW MARKER — Divider between past and future
   ═══════════════════════════════════════════════════════════════ */

function NowMarker() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0', margin: '6px 0',
    }}>
      <div style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, transparent, ${T.accent}60, transparent)`,
      }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 14px', borderRadius: 10,
        background: 'rgba(0,255,204,0.06)', border: `1px solid rgba(0,255,204,0.2)`,
        boxShadow: `0 0 20px rgba(0,255,204,0.08)`,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: T.accent,
          boxShadow: `0 0 12px ${T.accent}80`,
          animation: 'tl-pulse 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 8, fontFamily: 'monospace', fontWeight: 800,
          color: T.accent, letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>
          NOW
        </span>
        <span style={{
          fontSize: 7, fontFamily: 'monospace', color: T.textTer,
        }}>
          {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </div>
      <div style={{
        flex: 1, height: 1,
        background: `linear-gradient(90deg, transparent, ${T.accent}60, transparent)`,
      }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TIMELINE NODE CARD — Individual event in the stream
   ═══════════════════════════════════════════════════════════════ */

function TimelineNodeCard({
  node, onAction, isExpanded, onToggle,
}: {
  node: TimelineNode
  onAction: (id: string) => void
  isExpanded: boolean
  onToggle: (id: string) => void
}) {
  const isPast = node.timestamp <= Date.now()
  const isProjection = node.type === 'projection' || node.type === 'insight'
  const isProtocol = node.type === 'protocol'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={() => !isProtocol && onToggle(node.id)}
      style={{
        position: 'relative',
        padding: isProtocol ? '8px 12px' : '12px 14px',
        borderRadius: isProtocol ? 10 : 14,
        background: node.completed
          ? 'rgba(0,220,130,0.05)'
          : isProjection
            ? 'rgba(59,130,246,0.03)'
            : T.surface,
        border: `1px solid ${node.completed ? 'rgba(0,220,130,0.12)' : node.priority >= 3 ? 'rgba(255,107,107,0.2)' : node.priority >= 2 ? 'rgba(232,151,108,0.12)' : T.borderBlue}`,
        cursor: isProtocol ? 'default' : 'pointer',
        transition: 'all 0.2s',
        overflow: 'hidden',
      }}
    >
      {/* Priority glow bar */}
      {node.priority >= 2 && !node.completed && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${node.accentColor}, transparent)`,
          opacity: node.priority >= 3 ? 0.8 : 0.4,
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Icon */}
        <div style={{
          width: isProtocol ? 30 : 36, height: isProtocol ? 30 : 36,
          borderRadius: isProtocol ? 8 : 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: node.completed ? 'rgba(0,220,130,0.12)' : node.glowColor,
          border: `1px solid ${node.completed ? 'rgba(0,220,130,0.2)' : `${node.accentColor}15`}`,
          fontSize: isProtocol ? 13 : 16,
          boxShadow: node.priority >= 2 && !node.completed ? `0 0 14px ${node.accentColor}25` : 'none',
          transition: 'all 0.3s',
        }}>
          {node.completed ? <span style={{ fontSize: isProtocol ? 12 : 14, color: T.green }}>✓</span> : node.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
            <span style={{
              fontSize: isProtocol ? 11 : 12, fontFamily: 'monospace', fontWeight: 700,
              color: node.completed ? T.green : T.text,
              textDecoration: node.completed ? 'line-through' : 'none',
              opacity: node.completed ? 0.6 : 1,
            }}>
              {node.title}
            </span>
            {node.type === 'intervention' && !node.completed && (
              <span style={{
                fontSize: 6, fontFamily: 'monospace', fontWeight: 800,
                padding: '1px 5px', borderRadius: 4,
                background: 'rgba(255,107,107,0.12)', color: T.red,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                animation: 'tl-pulse 2s ease-in-out infinite',
              }}>
                DRIFT
              </span>
            )}
            {isProjection && (
              <span style={{
                fontSize: 6, fontFamily: 'monospace', fontWeight: 800,
                padding: '1px 5px', borderRadius: 4,
                background: T.blueMuted, color: T.blueBright,
                letterSpacing: '0.12em',
              }}>
                FORECAST
              </span>
            )}
            {node.type === 'win' && (
              <span style={{
                fontSize: 6, fontFamily: 'monospace', fontWeight: 800,
                padding: '1px 5px', borderRadius: 4,
                background: T.greenGlow, color: T.green,
                letterSpacing: '0.12em',
              }}>
                WIN
              </span>
            )}
          </div>
          {!isProtocol && (
            <div style={{
              fontSize: 10, fontFamily: 'monospace', color: T.textSec, lineHeight: 1.4,
            }}>
              {node.subtitle}
            </div>
          )}
        </div>

        {/* Timestamp + action */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <span style={{
            fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.06em',
          }}>
            {isPast ? formatTime(node.timestamp) : formatFutureTime(node.timestamp)}
          </span>
          {node.actionable && !node.completed && (
            <button
              onClick={(e) => { e.stopPropagation(); onAction(node.id) }}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                background: `linear-gradient(135deg, ${node.accentColor}25, ${node.accentColor}10)`,
                color: node.accentColor, fontSize: 9, fontFamily: 'monospace',
                fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
                transition: 'all 0.15s',
                boxShadow: `0 0 8px ${node.accentColor}15`,
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.05)' }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)' }}
            >
              {node.actionLabel || '✓ LOG'}
            </button>
          )}
          {node.actionable && node.completed && (
            <span style={{
              fontSize: 8, fontFamily: 'monospace', color: T.green, fontWeight: 600,
              opacity: 0.6,
            }}>
              ✓ Done
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (node.data.detail || node.data.metrics) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {node.data.detail && (
              <div style={{
                marginTop: 10, paddingTop: 10,
                borderTop: `1px solid ${T.border}`,
                fontSize: 10, fontFamily: 'monospace', color: T.textSec, lineHeight: 1.6,
              }}>
                {node.data.detail}
              </div>
            )}
            {node.data.metrics && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {(node.data.metrics as Array<{ label: string; value: string; color: string }>).map((m, i) => (
                  <div key={i} style={{
                    padding: '3px 8px', borderRadius: 6,
                    background: `${m.color}08`, border: `1px solid ${m.color}15`,
                    fontSize: 9, fontFamily: 'monospace', color: m.color, fontWeight: 600,
                  }}>
                    {m.label}: {m.value}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PROJECTION BAND — Ghost trend visualization for future
   ═══════════════════════════════════════════════════════════════ */

function ProjectionBand({ projections }: { projections: any[] }) {
  if (!projections || projections.length === 0) return null

  const improving = projections.filter((p: any) => p.direction === 'improving')
  const declining = projections.filter((p: any) => p.direction === 'declining')

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14,
      background: 'rgba(59,130,246,0.03)',
      border: `1px solid ${T.borderBlue}`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ghost gradient */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
        background: `linear-gradient(90deg, transparent, ${T.blueGlow})`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11 }}>🔮</span>
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: T.blueBright, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          7-Day Bio-Projection
        </span>
        <div style={{
          marginLeft: 'auto', display: 'flex', gap: 8,
          fontSize: 8, fontFamily: 'monospace',
        }}>
          {improving.length > 0 && <span style={{ color: T.green }}>↑{improving.length}</span>}
          {declining.length > 0 && <span style={{ color: T.red }}>↓{declining.length}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {projections.slice(0, 6).map((p: any) => {
          const isGood = p.direction === 'improving'
          const isBad = p.direction === 'declining'
          const color = isGood ? T.green : isBad ? T.red : T.textSec
          return (
            <div key={p.key} style={{
              padding: '8px 10px', borderRadius: 10,
              background: isGood ? 'rgba(0,220,130,0.04)' : isBad ? 'rgba(255,107,107,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${color}10`,
            }}>
              <div style={{
                fontSize: 7, fontFamily: 'monospace', color: T.textTer,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3,
              }}>
                {p.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 800, color }}>
                  {typeof p.projected === 'number' ? (p.projected % 1 === 0 ? p.projected : p.projected.toFixed(1)) : p.projected}
                </span>
                <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer }}>{p.unit}</span>
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color, marginLeft: 'auto',
                }}>
                  {p.delta > 0 ? '↑' : p.delta < 0 ? '↓' : '→'}{Math.abs(Math.round(p.deltaPct))}%
                </span>
              </div>
              {/* Mini sparkline */}
              {p.trajectory && p.trajectory.length > 1 && (
                <svg width="100%" height="14" viewBox={`0 0 ${Math.max(p.trajectory.length * 12, 24)} 14`} style={{ marginTop: 4, opacity: 0.5 }}>
                  <defs>
                    <linearGradient id={`tl-g-${p.key}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <path
                    d={p.trajectory.map((v: number, i: number) => {
                      const min = Math.min(...p.trajectory)
                      const max = Math.max(...p.trajectory)
                      const range = max - min || 1
                      const x = i * 12
                      const y = 12 - ((v - min) / range) * 10
                      return `${i === 0 ? 'M' : 'L'}${x},${y}`
                    }).join(' ')}
                    fill="none" stroke={`url(#tl-g-${p.key})`} strokeWidth={1.5}
                    strokeLinecap="round" strokeDasharray={isBad ? '3,2' : 'none'}
                  />
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL QUICK-LOG BAR — Sticky bottom for 1-tap logging
   ═══════════════════════════════════════════════════════════════ */

function ProtocolQuickLog({
  protocols, completedIds, onToggle,
}: {
  protocols: Array<{ id: string; name: string; icon: string; category: string }>
  completedIds: Set<string>
  onToggle: (id: string, name: string, category: string) => void
}) {
  if (protocols.length === 0) return null

  const completed = protocols.filter(p => completedIds.has(p.id)).length
  const total = protocols.length
  const pct = Math.round((completed / total) * 100)

  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 50,
      padding: '8px 14px 10px',
      background: 'rgba(10,10,11,0.96)',
      borderTop: `1px solid ${T.borderBlue}`,
      backdropFilter: 'blur(24px)',
    }}>
      {/* Progress header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
          color: T.textTer, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          PROTOCOL STACK
        </span>
        <div style={{
          flex: 1, height: 2, borderRadius: 1,
          background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
        }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              height: '100%', borderRadius: 1,
              background: pct === 100
                ? `linear-gradient(90deg, ${T.green}, ${T.accent})`
                : `linear-gradient(90deg, ${T.blue}, ${T.blueBright})`,
              boxShadow: `0 0 6px ${pct === 100 ? T.green : T.blue}30`,
            }}
          />
        </div>
        <span style={{
          fontSize: 9, fontFamily: 'monospace', fontWeight: 800,
          color: pct === 100 ? T.green : T.blueBright,
        }}>
          {completed}/{total}
        </span>
      </div>

      {/* Protocol chips — horizontal scroll */}
      <div style={{
        display: 'flex', gap: 5, overflowX: 'auto',
        paddingBottom: 2, scrollbarWidth: 'none',
      }}>
        {protocols.map(p => {
          const done = completedIds.has(p.id)
          return (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => onToggle(p.id, p.name, p.category)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, border: 'none',
                background: done ? 'rgba(0,220,130,0.1)' : T.blueMuted,
                color: done ? T.green : T.text,
                fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                opacity: done ? 0.6 : 1,
                textDecoration: done ? 'line-through' : 'none',
              }}
            >
              <span style={{ fontSize: 11 }}>{done ? '✓' : p.icon}</span>
              {p.name.length > 16 ? p.name.slice(0, 16) + '…' : p.name}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BIO-TIMELINE — Main Single-Stream Component
   ═══════════════════════════════════════════════════════════════ */

export default function BioTimeline() {
  const sessionId = useMemo(() => getSessionId(), [])
  const { vitals } = useBiometricSync()
  const { optimizationScore, bioReport } = useProductRecommendations(12)

  // Convex queries
  const driftData = useQuery(api.protocolDrift.detectProtocolDrift, { sessionId })
  const forecastData = useQuery(api.bioForecast.getPredictiveForecast, { sessionId })

  // Mutations
  const toggleCompletion = useMutation(api.mutations.toggleProtocolCompletion)
  const logProtocol = useMutation(api.mutations.logProtocolCompletionToLogs)
  const createJournalEvent = useMutation(api.mutations.createJournalEvent)

  // State
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [completedProtocols, setCompletedProtocols] = useState<Set<string>>(new Set())
  const [actionFeedback, setActionFeedback] = useState<{ id: string; type: 'success' | 'error'; msg: string } | null>(null)
  const [showBodyScan, setShowBodyScan] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nowRef = useRef<HTMLDivElement>(null)

  // Bio-Intelligence report
  const report = useMemo<BioIntelligenceReport | null>(() => {
    if (bioReport) return bioReport
    try {
      const inputs: BiometricInputs = {
        hrv: vitals.hrv, heartRate: vitals.heartRate,
        sleepHours: vitals.sleepHours, sleepScore: vitals.sleepScore,
        sleepDeepPct: vitals.sleepDeepPct, sleepRemPct: vitals.sleepRemPct,
        recovery: vitals.recovery, stress: vitals.stress,
        spo2: vitals.spo2, bodyBattery: vitals.bodyBattery,
        strain: vitals.strain, skinTemp: vitals.skinTemp,
        respiratoryRate: vitals.respiratoryRate, steps: vitals.steps,
        readiness: vitals.readiness,
      }
      return runBioIntelligence(inputs)
    } catch { return null }
  }, [bioReport, vitals])

  // Composite score
  const compositeScore = useMemo(() => {
    return optimizationScore?.overall ?? report?.state.compositeScore ?? 0
  }, [optimizationScore, report])

  // Build protocol list for quick-log bar
  const protocolList = useMemo(() => {
    const items: Array<{ id: string; name: string; icon: string; category: string }> = []
    const interventions = report?.interventions?.slice(0, 8) ?? []
    for (const iv of interventions) {
      items.push({ id: iv.id, name: iv.name, icon: iv.icon || '💊', category: iv.systemTarget })
    }
    if (items.length === 0) {
      items.push(
        { id: 'omega3', name: 'Omega-3', icon: '🐟', category: 'supplement' },
        { id: 'vitd', name: 'Vitamin D3+K2', icon: '☀️', category: 'supplement' },
        { id: 'magnesium', name: 'Magnesium', icon: '💊', category: 'supplement' },
        { id: 'creatine', name: 'Creatine', icon: '⚡', category: 'supplement' },
        { id: 'cold', name: 'Cold Exposure', icon: '🧊', category: 'recovery' },
        { id: 'sunlight', name: 'Morning Sun', icon: '🌅', category: 'habits' },
      )
    }
    return items
  }, [report])

  // Build timeline nodes
  const timelineNodes = useMemo<TimelineNode[]>(() => {
    const nodes: TimelineNode[] = []
    const now = Date.now()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    // ── 1. Morning Vitals Snapshot ──
    const morningTs = todayStart.getTime() + 7 * 3600000
    nodes.push({
      id: 'morning-vitals',
      type: 'vitals',
      timestamp: morningTs,
      title: `Sleep Score: ${Math.round(vitals.sleepScore)}`,
      subtitle: `${vitals.sleepHours.toFixed(1)}h sleep · Deep ${Math.round(vitals.sleepDeepPct)}% · REM ${Math.round(vitals.sleepRemPct)}% · Recovery ${Math.round(vitals.recovery)}%`,
      icon: '🌙',
      accentColor: vitals.sleepScore >= 80 ? T.green : vitals.sleepScore >= 60 ? T.orange : T.red,
      glowColor: vitals.sleepScore >= 80 ? T.greenGlow : T.orangeGlow,
      data: {
        detail: `Sleep architecture analysis: ${vitals.sleepDeepPct >= 15 ? 'Deep sleep adequate for physical recovery.' : 'Deep sleep below optimal — consider earlier bedtime.'} ${vitals.sleepRemPct >= 20 ? 'REM cycles support cognitive consolidation.' : 'REM deficit — reduce evening stimulants.'}`,
        metrics: [
          { label: 'Deep', value: `${Math.round(vitals.sleepDeepPct)}%`, color: vitals.sleepDeepPct >= 15 ? T.green : T.orange },
          { label: 'REM', value: `${Math.round(vitals.sleepRemPct)}%`, color: vitals.sleepRemPct >= 20 ? T.green : T.orange },
          { label: 'Latency', value: '<15m', color: T.green },
        ],
      },
      priority: 1,
      section: 'morning',
    })

    // ── 2. Morning Readiness ──
    nodes.push({
      id: 'readiness-check',
      type: 'vitals',
      timestamp: morningTs + 1800000,
      title: `Readiness: ${Math.round(vitals.readiness)}`,
      subtitle: `HRV ${Math.round(vitals.hrv)}ms · Resting HR ${Math.round(vitals.heartRate)}bpm · Body Battery ${Math.round(vitals.bodyBattery)}`,
      icon: '🧬',
      accentColor: vitals.readiness >= 70 ? T.green : vitals.readiness >= 50 ? T.orange : T.red,
      glowColor: vitals.readiness >= 70 ? T.greenGlow : T.orangeGlow,
      data: {
        detail: `Autonomic nervous system ${vitals.hrv >= 55 ? 'well-balanced — parasympathetic tone strong' : 'showing sympathetic dominance — prioritize recovery protocols'}. ${vitals.bodyBattery >= 60 ? 'Energy reserves adequate for training.' : 'Low energy reserves — consider lighter training load.'}`,
        metrics: [
          { label: 'HRV', value: `${Math.round(vitals.hrv)}ms`, color: vitals.hrv >= 55 ? T.green : T.orange },
          { label: 'RHR', value: `${Math.round(vitals.heartRate)}bpm`, color: vitals.heartRate <= 65 ? T.green : T.orange },
          { label: 'SpO₂', value: `${vitals.spo2.toFixed(1)}%`, color: vitals.spo2 >= 96 ? T.green : T.red },
        ],
      },
      priority: 1,
      section: 'morning',
    })

    // ── 3. Risk Alerts ──
    const alerts = report?.state.riskFlags ?? []
    for (const flag of alerts.slice(0, 3)) {
      nodes.push({
        id: `alert-${flag.id}`,
        type: 'alert',
        timestamp: now - 1800000 - Math.random() * 3600000,
        title: flag.marker,
        subtitle: `${flag.marker} — ${flag.severity} severity`,
        icon: flag.severity === 'critical' ? '🔴' : flag.severity === 'alert' ? '🟠' : '🟡',
        accentColor: flag.severity === 'critical' ? T.red : flag.severity === 'alert' ? T.orange : T.gold,
        glowColor: flag.severity === 'critical' ? T.redGlow : T.orangeGlow,
        data: { detail: flag.message || `${flag.marker} is outside optimal range. Consider adjusting your protocol stack.` },
        priority: flag.severity === 'critical' ? 3 : flag.severity === 'alert' ? 2 : 1,
        section: getTimeSection(now - 1800000),
      })
    }

    // ── 4. Wins ──
    if (vitals.hrv >= 55) nodes.push({
      id: 'win-hrv', type: 'win', timestamp: now - 3600000,
      title: 'HRV Optimal Zone', subtitle: `${Math.round(vitals.hrv)}ms — parasympathetic tone strong`,
      icon: '💚', accentColor: T.green, glowColor: T.greenGlow,
      data: { detail: 'Heart rate variability indicates excellent autonomic balance. Your nervous system is well-recovered.' },
      priority: 0, section: getTimeSection(now - 3600000),
    })
    if (vitals.recovery >= 70) nodes.push({
      id: 'win-recovery', type: 'win', timestamp: now - 4200000,
      title: 'Recovery Primed', subtitle: `${Math.round(vitals.recovery)}% — green-light for strain`,
      icon: '⚡', accentColor: T.green, glowColor: T.greenGlow,
      data: { detail: 'Recovery metrics indicate your body is prepared for high-intensity training or cognitive demands.' },
      priority: 0, section: getTimeSection(now - 4200000),
    })
    if (vitals.sleepScore >= 82) nodes.push({
      id: 'win-sleep', type: 'win', timestamp: morningTs + 600000,
      title: 'Sleep Architecture Aligned', subtitle: `Score ${Math.round(vitals.sleepScore)} — deep + REM balanced`,
      icon: '🏆', accentColor: T.gold, glowColor: T.goldGlow,
      data: { detail: 'Deep sleep and REM cycles are well-balanced for both physical and cognitive recovery.' },
      priority: 0, section: 'morning',
    })

    // ── 5. Protocol Drift Interventions ──
    if (driftData?.suggestedInterventions) {
      for (const iv of driftData.suggestedInterventions) {
        nodes.push({
          id: `drift-${iv.metric}-${iv.template.interventionType}`,
          type: 'intervention',
          timestamp: now + 300000,
          title: iv.template.title,
          subtitle: `${iv.template.subtitle} · ${iv.deviationPct.toFixed(0)}% drift detected`,
          icon: iv.template.icon,
          accentColor: iv.priority === 'critical' ? T.red : T.orange,
          glowColor: iv.priority === 'critical' ? T.redGlow : T.orangeGlow,
          data: {
            detail: iv.template.description,
            metrics: [
              { label: 'Current', value: `${typeof iv.currentValue === 'number' ? iv.currentValue.toFixed(1) : iv.currentValue}`, color: T.red },
              { label: 'Baseline', value: `${typeof iv.baselineValue === 'number' ? iv.baselineValue.toFixed(1) : iv.baselineValue}`, color: T.blue },
              { label: 'Drift', value: `${iv.deviationPct.toFixed(1)}%`, color: T.orange },
            ],
          },
          priority: iv.priority === 'critical' ? 3 : 2,
          actionable: true,
          actionLabel: `✓ ${iv.template.durationMinutes}min`,
          section: 'future',
        })
      }
    }

    // ── 6. Protocol Adherence Items ──
    const afternoonTs = todayStart.getTime() + 13 * 3600000
    for (let i = 0; i < protocolList.length; i++) {
      const proto = protocolList[i]
      const done = completedProtocols.has(proto.id)
      const protoTs = afternoonTs + i * 600000
      nodes.push({
        id: `proto-${proto.id}`,
        type: 'protocol',
        timestamp: protoTs,
        title: proto.name,
        subtitle: proto.category,
        icon: proto.icon,
        accentColor: done ? T.green : T.blue,
        glowColor: done ? T.greenGlow : T.blueMuted,
        data: {},
        priority: done ? 0 : 1,
        actionable: true,
        actionLabel: done ? '✓ DONE' : '✓ TAP',
        completed: done,
        section: getTimeSection(protoTs),
      })
    }

    // ── 7. Afternoon Strain Check ──
    if (vitals.strain > 0) {
      nodes.push({
        id: 'strain-check',
        type: 'vitals',
        timestamp: todayStart.getTime() + 15 * 3600000,
        title: `Strain Load: ${vitals.strain.toFixed(1)}`,
        subtitle: vitals.strain > 14 ? 'High strain — recovery protocols critical' : vitals.strain > 8 ? 'Moderate strain — maintain hydration' : 'Low strain — capacity for more output',
        icon: '🏋️',
        accentColor: vitals.strain > 14 ? T.red : vitals.strain > 8 ? T.orange : T.green,
        glowColor: vitals.strain > 14 ? T.redGlow : vitals.strain > 8 ? T.orangeGlow : T.greenGlow,
        data: {
          detail: `Current cardiovascular strain is ${vitals.strain.toFixed(1)} on a 0-21 scale. ${vitals.strain > 14 ? 'This is high — prioritize NSDR, cold exposure, and sleep optimization tonight.' : vitals.strain > 8 ? 'Moderate load — stay hydrated and consider a recovery walk.' : 'Low strain — you have capacity for additional training stimulus.'}`,
          metrics: [
            { label: 'Strain', value: vitals.strain.toFixed(1), color: vitals.strain > 14 ? T.red : T.orange },
            { label: 'Steps', value: `${vitals.steps.toLocaleString()}`, color: T.blue },
            { label: 'Stress', value: `${Math.round(vitals.stress)}`, color: vitals.stress > 60 ? T.red : T.green },
          ],
        },
        priority: vitals.strain > 14 ? 2 : 1,
        section: 'afternoon',
      })
    }

    // ── 8. Bio-Projection Insights (future) ──
    if (forecastData?.insights) {
      for (let i = 0; i < Math.min(forecastData.insights.length, 3); i++) {
        const insight = forecastData.insights[i]
        nodes.push({
          id: `forecast-insight-${i}`,
          type: 'insight',
          timestamp: now + 86400000 * (i + 1),
          title: insight.type === 'positive' ? 'Positive Trajectory' : insight.type === 'warning' ? 'Attention Needed' : 'Forecast Update',
          subtitle: insight.text.length > 100 ? insight.text.slice(0, 100) + '…' : insight.text,
          icon: insight.icon,
          accentColor: insight.type === 'positive' ? T.green : insight.type === 'warning' ? T.orange : T.blue,
          glowColor: insight.type === 'positive' ? T.greenGlow : insight.type === 'warning' ? T.orangeGlow : T.blueMuted,
          data: { detail: insight.text },
          priority: insight.type === 'warning' ? 2 : 1,
          section: 'future',
        })
      }
    }

    // ── 9. Evening Recovery Projection ──
    nodes.push({
      id: 'evening-projection',
      type: 'projection',
      timestamp: todayStart.getTime() + 21 * 3600000,
      title: 'Evening Recovery Window',
      subtitle: vitals.strain > 10
        ? 'High strain day — prioritize sleep onset by 10pm'
        : 'Moderate day — standard recovery protocols sufficient',
      icon: '🌃',
      accentColor: T.purple,
      glowColor: T.purpleGlow,
      data: {
        detail: `Based on today's strain (${vitals.strain.toFixed(1)}) and current recovery (${Math.round(vitals.recovery)}%), ${vitals.strain > 10 ? 'recommend: Magnesium glycinate 400mg + L-theanine 200mg at 9pm. Screen-off by 9:30pm. Target 7.5+ hours.' : 'standard evening routine should maintain recovery trajectory. Consider 10min meditation before bed.'}`,
      },
      priority: 1,
      section: 'evening',
    })

    return nodes
  }, [vitals, report, driftData, forecastData, optimizationScore, protocolList, completedProtocols])

  // Group nodes by section and sort
  const groupedNodes = useMemo(() => {
    const sections: Record<string, TimelineNode[]> = { morning: [], afternoon: [], evening: [], future: [] }
    for (const node of timelineNodes) {
      const sec = node.section || getTimeSection(node.timestamp)
      if (sections[sec]) sections[sec].push(node)
    }
    // Sort each section: priority desc, then timestamp
    for (const key of Object.keys(sections)) {
      sections[key].sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return key === 'future' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
      })
    }
    return sections
  }, [timelineNodes])

  // Determine current section
  const currentSection = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'morning'
    if (h < 17) return 'afternoon'
    return 'evening'
  }, [])

  // Handle protocol toggle
  const handleProtocolToggle = useCallback(async (id: string, name: string, category: string) => {
    try {
      const wasCompleted = completedProtocols.has(id)
      setCompletedProtocols(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
      await toggleCompletion({ sessionId, protocolItemId: id })
      if (!wasCompleted) {
        await logProtocol({
          sessionId, protocolId: id, protocolName: name,
          category, completedAt: Date.now(),
        })
        await createJournalEvent({
          sessionId, eventType: 'protocol_complete', eventKey: id,
          value: `Completed ${name}`, loggedAt: Date.now(),
        })
      }
      setActionFeedback({ id, type: 'success', msg: wasCompleted ? `${name} unchecked` : `${name} logged ✓` })
      setTimeout(() => setActionFeedback(null), 1500)
    } catch {
      setActionFeedback({ id, type: 'error', msg: 'Failed to log' })
      setTimeout(() => setActionFeedback(null), 2000)
    }
  }, [sessionId, completedProtocols, toggleCompletion, logProtocol, createJournalEvent])

  // Handle node action
  const handleNodeAction = useCallback((nodeId: string) => {
    const node = timelineNodes.find(n => n.id === nodeId)
    if (!node) return
    if (node.type === 'protocol') {
      const proto = protocolList.find(p => `proto-${p.id}` === nodeId)
      if (proto) handleProtocolToggle(proto.id, proto.name, proto.category)
    } else if (node.type === 'intervention') {
      setCompletedProtocols(prev => { const next = new Set(prev); next.add(nodeId); return next })
      setActionFeedback({ id: nodeId, type: 'success', msg: 'Intervention accepted ✓' })
      setTimeout(() => setActionFeedback(null), 1500)
    }
  }, [timelineNodes, protocolList, handleProtocolToggle])

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedNode(prev => prev === id ? null : id)
  }, [])

  // Scroll to NOW on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  // Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Render a section of nodes
  const renderSection = (sectionKey: string, nodes: TimelineNode[]) => {
    if (nodes.length === 0) return null
    return (
      <div key={sectionKey}>
        <SectionDivider section={sectionKey} nodeCount={nodes.length} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodes.map(node => (
            <TimelineNodeCard
              key={node.id}
              node={node}
              onAction={handleNodeAction}
              isExpanded={expandedNode === node.id}
              onToggle={handleToggleExpand}
            />
          ))}
        </div>
      </div>
    )
  }

  const pastSections = ['morning', 'afternoon', 'evening'].filter(s => {
    const order = { morning: 0, afternoon: 1, evening: 2 }
    const currentOrder = order[currentSection as keyof typeof order] ?? 0
    return (order[s as keyof typeof order] ?? 0) <= currentOrder
  })

  return (
    <div style={{
      maxWidth: 680, margin: '0 auto',
      minHeight: '100vh', position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Date + Greeting */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 7, fontFamily: 'monospace', color: T.textTer,
              letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3,
            }}>
              {dateStr}
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 900, color: T.text, margin: 0,
              fontFamily: 'monospace', letterSpacing: '-0.03em',
            }}>
              {greeting}
            </h1>
          </div>

          {/* Live Vitals Header */}
          <div style={{
            borderRadius: 16, overflow: 'hidden',
            background: T.surface, border: `1px solid ${T.borderBlue}`,
            backdropFilter: 'blur(20px)',
          }}>
            <LiveVitalsHeader vitals={vitals} score={compositeScore} />
          </div>

          {/* Body Scan Toggle */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowBodyScan(prev => !prev)}
            style={{
              width: '100%', marginTop: 8, padding: '8px 14px',
              borderRadius: 12, border: `1px solid ${showBodyScan ? T.borderAccent : T.borderBlue}`,
              background: showBodyScan ? T.accentGlow : T.surface,
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 14 }}>🫀</span>
            <span style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              color: showBodyScan ? T.accent : T.textSec,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {showBodyScan ? 'HIDE BODY SCAN' : 'SOMATIC MIRROR'}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 10, color: T.textTer,
              transform: showBodyScan ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>
              ▼
            </span>
          </motion.button>

          {/* Somatic Mirror */}
          <AnimatePresence>
            {showBodyScan && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ overflow: 'hidden', marginTop: 6 }}
              >
                <SomaticMirror compact />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Timeline Stream ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 16px',
          display: 'flex', flexDirection: 'column', gap: 4,
          scrollbarWidth: 'none',
        }}
      >
        {/* Timeline spine */}
        <div style={{ position: 'relative' }}>
          {/* Vertical spine line */}
          <div style={{
            position: 'absolute', left: 18, top: 0, bottom: 0, width: 1,
            background: `linear-gradient(180deg, ${T.blue}20, ${T.accent}15, ${T.purple}10, ${T.blue}05)`,
            pointerEvents: 'none', zIndex: 0,
          }} />

          {/* Past sections */}
          {pastSections.map(sec => renderSection(sec, groupedNodes[sec] || []))}

          {/* NOW Marker */}
          <div ref={nowRef}>
            <NowMarker />
          </div>

          {/* Bio-Projection Band */}
          {forecastData?.projections && forecastData.projections.length > 0 && (
            <div style={{ marginBottom: 8, marginTop: 4 }}>
              <ProjectionBand projections={forecastData.projections} />
            </div>
          )}

          {/* Future section */}
          {renderSection('future', groupedNodes.future || [])}

          {/* Bottom spacer */}
          <div style={{ height: 90 }} />
        </div>
      </div>

      {/* ── Protocol Quick-Log Bar ── */}
      <ProtocolQuickLog
        protocols={protocolList}
        completedIds={completedProtocols}
        onToggle={handleProtocolToggle}
      />

      {/* ── Action Feedback Toast ── */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)',
              padding: '6px 18px', borderRadius: 10, zIndex: 100,
              background: actionFeedback.type === 'success' ? 'rgba(0,220,130,0.12)' : 'rgba(255,107,107,0.12)',
              border: `1px solid ${actionFeedback.type === 'success' ? 'rgba(0,220,130,0.25)' : 'rgba(255,107,107,0.25)'}`,
              backdropFilter: 'blur(16px)',
              boxShadow: `0 4px 20px ${actionFeedback.type === 'success' ? 'rgba(0,220,130,0.1)' : 'rgba(255,107,107,0.1)'}`,
            }}
          >
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              color: actionFeedback.type === 'success' ? T.green : T.red,
            }}>
              {actionFeedback.msg}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes tl-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
