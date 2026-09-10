import React, { useState, useRef, useCallback, useMemo } from 'react'
import { getTwinSessionId } from '@/lib/twinSession'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceLight: 'rgba(14,14,18,0.6)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
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

function statusColor(status: string): string {
  switch (status) {
    case 'optimal': return T.green
    case 'adequate': return T.blue
    case 'moderate': return T.orange
    case 'low': case 'elevated': return T.red
    default: return T.textSec
  }
}

function trendIcon(trend: string): string {
  switch (trend) {
    case 'improving': return '↗'
    case 'declining': return '↘'
    default: return '→'
  }
}

function trendColor(trend: string): string {
  switch (trend) {
    case 'improving': return T.green
    case 'declining': return T.red
    default: return T.blue
  }
}

/* ── Ghost State Skeleton ── */
function GhostSkeleton() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{
        background: T.surfaceLight, borderRadius: 20,
        border: `1px solid ${T.border}`, padding: 24,
      }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 16, borderRadius: 8, marginBottom: 12,
            background: 'rgba(255,255,255,0.04)',
            animation: 'ghost-pulse 1.8s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
            width: `${80 - i * 15}%`,
          }} />
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              flex: 1, height: 60, borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              animation: 'ghost-pulse 1.8s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes ghost-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

/* ── Mini Sparkline ── */
function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${w},${height}`}
        fill={`url(#sg-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Main Component ── */
export default function BioResume() {
  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : 'ssr'
  const resumeData = useQuery(api.queries.getBioResumeData, { sessionId })
  const [isExpanded, setIsExpanded] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copying' | 'copied'>('idle')
  const cardRef = useRef<HTMLDivElement>(null)

  const handleShare = useCallback(async () => {
    if (!resumeData) return
    setShareStatus('copying')

    const s = resumeData.summary
    const text = [
      `VIVE 4.0 — Bio-Resume (7-Day)`,
      `Generated: ${new Date(resumeData.generatedAt).toLocaleDateString()}`,
      ``,
      `Vitality Score: ${s.avgVitality}/100 ${trendIcon(s.trend)}`,
      `HRV Average: ${s.avgHrv} ms`,
      `Sleep Quality: ${s.avgSleep}/100`,
      `Protocol Adherence: ${s.avgAdherence}%`,
      `Training Volume: ${s.totalWorkoutMinutes} min`,
      ``,
      resumeData.biomarkers.length > 0 ? `Biomarkers:` : '',
      ...resumeData.biomarkers.map(b => `  ${b.label}: ${b.value} ${b.unit} (${b.status})`),
      resumeData.summary.tensionRegions.length > 0
        ? `\nSomatic Tension: ${resumeData.summary.tensionRegions.join(', ')}`
        : '',
      ``,
      `— Generated by VIVE Biological Operating System`,
    ].filter(Boolean).join('\n')

    try {
      if (navigator.share) {
        await navigator.share({ title: 'VIVE Bio-Resume', text })
      } else {
        await navigator.clipboard.writeText(text)
      }
      setShareStatus('copied')
      setTimeout(() => setShareStatus('idle'), 2500)
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setShareStatus('copied')
        setTimeout(() => setShareStatus('idle'), 2500)
      } catch {
        setShareStatus('idle')
      }
    }
  }, [resumeData])

  if (resumeData === undefined) return <GhostSkeleton />
  if (!resumeData) return null

  const { days, summary, biomarkers, profile } = resumeData

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: T.blueBright, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            BIO-RESUME · VISIT PREP
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            7-Day Performance Summary
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => window.dispatchEvent(new CustomEvent('vive-open-visit-packet'))}
            style={{
              padding: '6px 14px', borderRadius: 10,
              background: 'rgba(0,255,204,0.1)',
              border: '1px solid rgba(0,255,204,0.25)',
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              color: '#00FFCC',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            Visit Prep
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleShare}
            style={{
              padding: '6px 14px', borderRadius: 10,
              background: shareStatus === 'copied' ? T.greenGlow : T.blueGlow,
              border: `1px solid ${shareStatus === 'copied' ? 'rgba(0,220,130,0.3)' : T.borderBlue}`,
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              color: shareStatus === 'copied' ? T.green : T.blueBright,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {shareStatus === 'copied' ? '✓ Copied' : '↗ Export'}
          </motion.button>
        </div>
      </div>

      {/* Resume Card */}
      <div ref={cardRef} style={{
        background: T.surface, borderRadius: 20,
        border: `1px solid ${T.border}`,
        overflow: 'hidden',
      }}>
        {/* Top Score Banner */}
        <div style={{
          padding: '20px 20px 16px',
          background: `linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(0,220,130,0.04) 100%)`,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', marginBottom: 4 }}>
                COMPOSITE VITALITY
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: T.text, lineHeight: 1 }}>
                  {summary.avgVitality}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textTer }}>/100</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: trendColor(summary.trend),
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  {trendIcon(summary.trend)} {summary.trend}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, marginBottom: 2 }}>
                {new Date(resumeData.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              {profile.age && (
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textSec }}>
                  {profile.gender === 'male' ? '♂' : profile.gender === 'female' ? '♀' : '⚧'} Age {profile.age}
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Sparkline */}
          <Sparkline data={days.map(d => d.vitalityScore)} color={T.blueBright} height={36} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {days.map((d, i) => (
              <span key={i} style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer }}>
                {d.dayLabel}
              </span>
            ))}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 1, background: T.border,
        }}>
          {[
            { label: 'HRV', value: `${summary.avgHrv}`, unit: 'ms', data: days.map(d => d.avgHrv), color: T.blue },
            { label: 'Sleep', value: `${summary.avgSleep}`, unit: '/100', data: days.map(d => d.sleepScore), color: T.purple },
            { label: 'Adherence', value: `${summary.avgAdherence}`, unit: '%', data: days.map(d => d.adherencePct), color: T.green },
            { label: 'Training', value: `${summary.totalWorkoutMinutes}`, unit: 'min', data: days.map(d => d.workoutMinutes), color: T.orange },
          ].map((metric, i) => (
            <div key={i} style={{
              padding: '14px 10px', background: T.bg,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em', marginBottom: 4 }}>
                {metric.label.toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{metric.value}</span>
                <span style={{ fontSize: 8, color: T.textTer }}>{metric.unit}</span>
              </div>
              <div style={{ marginTop: 6, height: 20 }}>
                <Sparkline data={metric.data} color={metric.color} height={20} />
              </div>
            </div>
          ))}
        </div>

        {/* Biomarkers Section */}
        {biomarkers.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.border}` }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: T.textSec, letterSpacing: '0.1em',
              marginBottom: 10, textTransform: 'uppercase',
            }}>
              BIOMARKER PANEL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {biomarkers.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{b.label}</div>
                    <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>{b.unit}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{b.value}</span>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4,
                      fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                      textTransform: 'uppercase',
                      color: statusColor(b.status),
                      background: `${statusColor(b.status)}15`,
                    }}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Somatic Tension Summary */}
        {summary.tensionRegions.length > 0 && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: T.textSec, letterSpacing: '0.1em',
              marginBottom: 8, textTransform: 'uppercase',
            }}>
              SOMATIC TENSION ZONES
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {summary.tensionRegions.map((region, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: T.orangeGlow,
                  border: '1px solid rgba(232,151,108,0.2)',
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  color: T.orange,
                }}>
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Genetic Flags */}
        {(profile.geneticFlags.mthfr || profile.geneticFlags.apoe4 || profile.geneticFlags.caffeineSensitive) && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: T.textSec, letterSpacing: '0.1em',
              marginBottom: 8, textTransform: 'uppercase',
            }}>
              GENETIC FLAGS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.geneticFlags.mthfr && (
                <span style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.2)',
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  color: T.purple,
                }}>
                  🧬 MTHFR Variant
                </span>
              )}
              {profile.geneticFlags.apoe4 && (
                <span style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: T.redGlow,
                  border: '1px solid rgba(255,107,107,0.2)',
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  color: T.red,
                }}>
                  ⚠️ APOE4 Carrier
                </span>
              )}
              {profile.geneticFlags.caffeineSensitive && (
                <span style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: T.orangeGlow,
                  border: '1px solid rgba(232,151,108,0.2)',
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  color: T.orange,
                }}>
                  ☕ Caffeine Sensitive
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
            VIVE 4.0 · Biological Operating System
          </div>
          <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer }}>
            {summary.daysWithData}/7 days tracked
          </div>
        </div>
      </div>
    </div>
  )
}
