import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceElevated: 'rgba(18,18,24,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  purple: '#AF82FF',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

const STATE_STYLES: Record<string, { gradient: string; pulse: string; border: string; ring: string }> = {
  high_inflammation: {
    gradient: 'linear-gradient(135deg, rgba(255,107,107,0.10) 0%, rgba(255,107,107,0.02) 100%)',
    pulse: 'rgba(255,107,107,0.08)',
    border: 'rgba(255,107,107,0.20)',
    ring: '#FF6B6B',
  },
  sleep_deprived: {
    gradient: 'linear-gradient(135deg, rgba(175,130,255,0.10) 0%, rgba(175,130,255,0.02) 100%)',
    pulse: 'rgba(175,130,255,0.08)',
    border: 'rgba(175,130,255,0.20)',
    ring: '#AF82FF',
  },
  overreached: {
    gradient: 'linear-gradient(135deg, rgba(232,151,108,0.10) 0%, rgba(232,151,108,0.02) 100%)',
    pulse: 'rgba(232,151,108,0.08)',
    border: 'rgba(232,151,108,0.20)',
    ring: '#E8976C',
  },
  primed: {
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
    pulse: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.15)',
    ring: '#3B82F6',
  },
  optimal: {
    gradient: 'linear-gradient(135deg, rgba(0,255,204,0.08) 0%, rgba(0,255,204,0.02) 100%)',
    pulse: 'rgba(0,255,204,0.06)',
    border: 'rgba(0,255,204,0.15)',
    ring: '#00FFCC',
  },
}

/* ── Inflammation Gauge ── */
function InflammationGauge({ score, color }: { score: number; color: string }) {
  const radius = 32
  const stroke = 4
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const gaugeColor = score >= 65 ? CC.red : score >= 35 ? CC.orange : CC.accent

  return (
    <div style={{ position: 'relative', width: 76, height: 76 }}>
      <svg width={76} height={76} viewBox="0 0 76 76">
        <circle cx={38} cy={38} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
        <motion.circle
          cx={38} cy={38} r={radius} fill="none"
          stroke={gaugeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          transform="rotate(-90 38 38)"
          style={{ filter: `drop-shadow(0 0 4px ${gaugeColor}40)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 800, color: gaugeColor }}
        >
          {score}
        </motion.span>
        <span style={{ fontSize: 7, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.1em' }}>
          INFLAM
        </span>
      </div>
    </div>
  )
}

/* ── Bio Signal Pill ── */
function BioSignalPill({ label, value, unit, status }: {
  label: string; value: string | number | null; unit: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
}) {
  const statusColor = status === 'good' ? CC.accent : status === 'warning' ? CC.orange : status === 'critical' ? CC.red : CC.textSec
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${statusColor}20`,
      borderRadius: 10, padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0,
    }}>
      <span style={{ fontSize: 7, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: statusColor }}>
          {value ?? '—'}
        </span>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>{unit}</span>
      </div>
    </div>
  )
}

/* ── Protocol Card ── */
function ProtocolCard({ item, index }: {
  item: {
    id: string; name: string; icon: string; description: string; category: string;
    duration?: string; dosage?: string; priority: string;
    replacedOriginal?: string; pivotReason?: string;
  };
  index: number;
}) {
  const [showReason, setShowReason] = useState(false)
  const isPivoted = !!item.replacedOriginal
  const priorityColor = item.priority === 'critical' ? CC.red : item.priority === 'recommended' ? CC.electricBlueBright : CC.textSec

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.15 + index * 0.07 }}
      style={{
        background: isPivoted ? 'rgba(255,107,107,0.04)' : CC.surfaceElevated,
        border: `1px solid ${isPivoted ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.04)'}`,
        borderRadius: 14, padding: '12px 14px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Left accent */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: isPivoted ? CC.red : priorityColor,
        borderRadius: '3px 0 0 3px',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: isPivoted ? 'rgba(255,107,107,0.10)' : 'rgba(59,130,246,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {item.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: CC.text, letterSpacing: '0.01em' }}>
              {item.name}
            </span>
            {isPivoted && (
              <span style={{
                fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                color: CC.red, background: 'rgba(255,107,107,0.12)',
                padding: '2px 5px', borderRadius: 4, letterSpacing: '0.1em',
              }}>
                PIVOTED
              </span>
            )}
            <span style={{
              fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
              color: priorityColor, background: `${priorityColor}15`,
              padding: '2px 5px', borderRadius: 4, letterSpacing: '0.1em',
            }}>
              {item.priority === 'critical' ? 'CRITICAL' : item.priority === 'recommended' ? 'REC' : 'OPT'}
            </span>
          </div>

          {/* Badges row */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
            {item.duration && (
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.electricBlueBright, background: 'rgba(59,130,246,0.08)',
                padding: '2px 6px', borderRadius: 4,
              }}>
                ⏱ {item.duration}
              </span>
            )}
            {item.dosage && (
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.accent, background: 'rgba(0,255,204,0.08)',
                padding: '2px 6px', borderRadius: 4,
              }}>
                💊 {item.dosage}
              </span>
            )}
            {isPivoted && item.replacedOriginal && (
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.textTer, background: 'rgba(255,255,255,0.04)',
                padding: '2px 6px', borderRadius: 4, textDecoration: 'line-through',
              }}>
                {item.replacedOriginal}
              </span>
            )}
          </div>

          <p style={{ fontSize: 10, fontFamily: 'monospace', color: CC.textSec, lineHeight: 1.5, margin: 0 }}>
            {item.description}
          </p>

          {/* Pivot reason toggle */}
          {item.pivotReason && (
            <>
              <button
                onClick={() => setShowReason(!showReason)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 6,
                  fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 7 }}>🧠</span>
                {showReason ? 'HIDE REASONING' : 'WHY THIS PIVOT?'}
              </button>
              <AnimatePresence>
                {showReason && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      marginTop: 6, padding: '6px 8px', borderRadius: 6,
                      background: 'rgba(59,130,246,0.04)',
                      border: '1px solid rgba(59,130,246,0.08)',
                    }}>
                      <p style={{
                        fontSize: 9, fontFamily: 'monospace', color: CC.electricBlueBright,
                        lineHeight: 1.4, margin: 0, fontStyle: 'italic',
                      }}>
                        {item.pivotReason}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MORNING PROTOCOL ENGINE
   
   Dynamic dashboard component that reflects the user's internal
   biology. Never looks the same two days in a row. When sleep
   or HRV signals are poor, protocols automatically pivot from
   high-intensity to restorative alternatives.
   ══════════════════════════════════════════════════════════════ */

export default function MorningProtocolEngine() {
  const sessionId = getTwinSessionId()

  const protocol = useQuery(api.morningProtocol.getMorningProtocol, { sessionId })
  const [expanded, setExpanded] = useState(true)

  if (!protocol) return null

  const style = STATE_STYLES[protocol.bioState] || STATE_STYLES.primed
  const isAlert = protocol.bioState === 'high_inflammation' || protocol.bioState === 'sleep_deprived' || protocol.bioState === 'overreached'

  const sleepStatus = protocol.lastNightSleep.quality === 'excellent' ? 'good'
    : protocol.lastNightSleep.quality === 'good' ? 'good'
    : protocol.lastNightSleep.quality === 'fair' ? 'warning'
    : protocol.lastNightSleep.quality === 'poor' ? 'critical' : 'neutral'

  const hrvStatus = protocol.currentHrv.deviationPct !== null
    ? (protocol.currentHrv.deviationPct > 15 ? 'critical' : protocol.currentHrv.deviationPct > 5 ? 'warning' : 'good')
    : 'neutral'

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{
        margin: '16px 16px 0',
        borderRadius: 20,
        background: style.gradient,
        border: `1px solid ${style.border}`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Animated pulse for alert states */}
      {isAlert && (
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 15% 25%, ${style.pulse} 0%, transparent 55%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '16px 18px 14px', cursor: 'pointer', position: 'relative', zIndex: 1 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* State badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <motion.div
                animate={isAlert ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: protocol.bioStateColor,
                  boxShadow: `0 0 8px ${protocol.bioStateColor}50`,
                }}
              />
              <span style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                color: protocol.bioStateColor, letterSpacing: '0.15em',
              }}>
                {protocol.bioStateLabel}
              </span>
              {protocol.pivotedCount > 0 && (
                <span style={{
                  fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                  color: CC.red, background: 'rgba(255,107,107,0.12)',
                  padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em',
                }}>
                  {protocol.pivotedCount} PIVOTED
                </span>
              )}
              <span style={{
                fontSize: 7, fontFamily: 'monospace', fontWeight: 600,
                color: CC.textTer, letterSpacing: '0.05em', marginLeft: 'auto',
              }}>
                {protocol.confidence}% CONF
              </span>
            </div>

            {/* Headline */}
            <h3 style={{
              fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
              color: CC.text, margin: 0, marginBottom: 4, letterSpacing: '-0.01em',
            }}>
              {protocol.headline}
            </h3>
            <p style={{
              fontSize: 10, fontFamily: 'monospace', color: CC.textSec,
              margin: 0, lineHeight: 1.5, maxWidth: 360,
            }}>
              {protocol.subheadline}
            </p>
          </div>

          {/* Inflammation gauge */}
          <InflammationGauge score={protocol.inflammationScore} color={protocol.bioStateColor} />
        </div>

        {/* Bio signal pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <BioSignalPill
            label="SLEEP"
            value={protocol.lastNightSleep.hours !== null ? `${protocol.lastNightSleep.hours.toFixed(1)}` : null}
            unit="hrs"
            status={sleepStatus}
          />
          <BioSignalPill
            label="HRV"
            value={protocol.currentHrv.value}
            unit="ms"
            status={hrvStatus}
          />
          <BioSignalPill
            label="HRV AVG"
            value={protocol.currentHrv.avg7d}
            unit="ms"
            status="neutral"
          />
          <BioSignalPill
            label="SLEEP SCORE"
            value={protocol.lastNightSleep.score}
            unit="/100"
            status={sleepStatus}
          />
        </div>

        {/* Expand indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ fontSize: 10, color: CC.textTer }}
          >
            ▼
          </motion.div>
        </div>
      </div>

      {/* Expanded protocol list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* Divider */}
            <div style={{
              height: 1, margin: '0 18px',
              background: `linear-gradient(90deg, transparent, ${style.border}, transparent)`,
            }} />

            {/* Section label */}
            <div style={{
              padding: '10px 18px 6px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: 12 }}
              >
                🧬
              </motion.div>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                color: protocol.bioStateColor, letterSpacing: '0.05em',
              }}>
                TODAY'S DYNAMIC PROTOCOL — {protocol.protocols.length} ITEMS
              </span>
            </div>

            {/* Protocol cards */}
            <div style={{ padding: '6px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {protocol.protocols.map((item, i) => (
                <ProtocolCard key={item.id} item={item} index={i} />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 18px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.05em',
              }}>
                Generated from {protocol.lastNightSleep.score !== null ? 'sleep + ' : ''}{protocol.currentHrv.value !== null ? 'HRV + ' : ''}biomarker data
              </span>
              <div style={{
                fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                color: CC.textTer, letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 7 }}>🔄</span>
                Updates with new data
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
