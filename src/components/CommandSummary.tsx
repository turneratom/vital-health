import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   COMMAND SUMMARY — Mission Briefing Overlay
   
   Frosted-glass overlay that slides from the top of the HUD.
   Three giant metrics in monospace terminal style:
   • Biological Age (Vive Age)
   • System Stability % (protocol adherence + readiness composite)
   • Next Protocol Task (most critical Daily Protocol item)
   
   NULL/LOADING STATES:
   • Analog glitch + scanline effect on tiles when data is missing
   • "Searching..." with animated dots when query is pending
   • "Sensor Offline" when data returns null/empty
   • Re-scan button triggers reconnection animation
   
   Toggle: 'C' keyboard shortcut or ⌘ HUD icon.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  glass: 'rgba(8,8,10,0.72)',
  glassBorder: 'rgba(255,255,255,0.06)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.15)',
  border: 'rgba(255,255,255,0.05)',
}

function stabilityColor(pct: number): { color: string; glow: string } {
  if (pct >= 90) return { color: T.teal, glow: T.tealGlow }
  if (pct >= 75) return { color: T.green, glow: T.greenGlow }
  if (pct >= 50) return { color: T.amber, glow: T.amberGlow }
  if (pct >= 30) return { color: T.orange, glow: T.orangeGlow }
  return { color: T.red, glow: T.redGlow }
}

function bioAgeColor(delta: number): string {
  if (delta <= -5) return T.teal
  if (delta <= -2) return T.green
  if (delta <= 0) return T.blue
  if (delta <= 3) return T.orange
  return T.red
}

/* ── Animated "Searching..." text with cycling dots ── */
function SearchingText({ label, color }: { label: string; color: string }) {
  const [dots, setDots] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setDots(d => (d + 1) % 4), 500)
    return () => clearInterval(interval)
  }, [])
  return (
    <span style={{ color, opacity: 0.6 }}>
      {label}{'.'.repeat(dots)}
    </span>
  )
}

/* ── Shimmer overlay for loading metric cards ── */
function ShimmerOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 14,
      overflow: 'hidden', pointerEvents: 'none', zIndex: 2,
    }}>
      {/* Shimmer sweep */}
      <motion.div
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '50%', height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04), transparent)',
        }}
      />
      {/* Breathing border glow */}
      <motion.div
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

/* ── Sensor Offline badge ── */
function SensorOfflineBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px', borderRadius: 6,
        background: 'rgba(255,107,107,0.08)',
        border: '1px solid rgba(255,107,107,0.15)',
        marginTop: 4,
      }}
    >
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          width: 4, height: 4, borderRadius: '50%',
          background: T.red,
          boxShadow: `0 0 4px ${T.redGlow}`,
        }}
      />
      <span style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 7, fontWeight: 700,
        color: T.red, letterSpacing: '0.12em',
        opacity: 0.8,
      }}>
        SENSOR OFFLINE
      </span>
    </motion.div>
  )
}

/* ── Re-scan Button with sweep animation ── */
function RescanButton({ onRescan, rescanning }: { onRescan: () => void; rescanning: boolean }) {
  return (
    <button
      className={`hud-rescan-btn ${rescanning ? 'rescanning' : ''}`}
      onClick={onRescan}
      disabled={rescanning}
    >
      {rescanning ? (
        <>
          <svg width="8" height="8" viewBox="0 0 16 16" style={{ animation: 'rescanSpinner 1s linear infinite' }}>
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="12 24" strokeLinecap="round" />
          </svg>
          SCANNING
        </>
      ) : (
        <>
          <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
            <path d="M2 8a6 6 0 0 1 10.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 8a6 6 0 0 1-10.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 1.5L12.5 4 10 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14.5L3.5 12 6 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          RE-SCAN
        </>
      )}
    </button>
  )
}

interface CommandSummaryProps {
  isOpen: boolean
  onClose: () => void
}

export default function CommandSummary({ isOpen, onClose }: CommandSummaryProps) {
  const sessionId = useMemo(() => getTwinSessionId(), [])
  const [scanLine, setScanLine] = useState(0)
  const [uptimeTick, setUptimeTick] = useState(0)
  // Re-scan state per tile
  const [rescanBio, setRescanBio] = useState(false)
  const [rescanStab, setRescanStab] = useState(false)
  const [rescanMission, setRescanMission] = useState(false)
  // Sweep animation keys
  const [sweepBio, setSweepBio] = useState(0)
  const [sweepStab, setSweepStab] = useState(0)
  const [sweepMission, setSweepMission] = useState(0)

  // Data queries — only fire when open
  const viveAge = useQuery(api.bioAgeAlgorithm.computeViveAge, isOpen ? { sessionId } : 'skip')
  const systemStatus = useQuery(api.queries.getSystemStatus, isOpen ? { sessionId } : 'skip')
  const windowData = useQuery(api.protocols.getProtocolsByBiologicalWindow, isOpen ? { sessionId } : 'skip')

  // Determine loading states (undefined = still fetching, null/empty = no data)
  const bioAgeLoading = isOpen && viveAge === undefined
  const bioAgeOffline = isOpen && viveAge !== undefined && (
    viveAge === null || (viveAge && viveAge.viveAge === 0 && viveAge.confidence === 0)
  )
  const stabilityLoading = isOpen && systemStatus === undefined
  const stabilityOffline = isOpen && systemStatus !== undefined && systemStatus === null
  const missionLoading = isOpen && windowData === undefined
  const missionOffline = isOpen && windowData !== undefined && windowData === null

  // Whether a tile should show the glitch effect
  const bioGlitch = bioAgeLoading || bioAgeOffline
  const stabGlitch = stabilityLoading || stabilityOffline
  const missionGlitch = missionLoading || missionOffline

  // Re-scan handlers — simulate a 2s reconnection attempt
  const handleRescan = useCallback((tile: 'bio' | 'stab' | 'mission') => {
    const setRescanning = tile === 'bio' ? setRescanBio : tile === 'stab' ? setRescanStab : setRescanMission
    const setSweep = tile === 'bio' ? setSweepBio : tile === 'stab' ? setSweepStab : setSweepMission
    setRescanning(true)
    setSweep(prev => prev + 1)
    setTimeout(() => {
      setRescanning(false)
    }, 2200)
  }, [])

  // Scan line animation
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 1) % 100)
    }, 40)
    return () => clearInterval(interval)
  }, [isOpen])

  // Live clock tick for uptime display
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => setUptimeTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Compute System Stability from protocol adherence + readiness
  const stability = useMemo(() => {
    if (!systemStatus) return { pct: 0, label: 'OFFLINE', done: 0, total: 0 }
    const pct = systemStatus.user.percentage
    let label = 'CRITICAL'
    if (pct >= 90) label = 'PEAK PERFORMANCE'
    else if (pct >= 75) label = 'OPERATIONAL'
    else if (pct >= 50) label = 'DEGRADED'
    else if (pct >= 30) label = 'UNSTABLE'
    return { pct, label, done: systemStatus.user.done, total: systemStatus.user.total }
  }, [systemStatus])

  // Find next mission — first incomplete protocol item from active window
  const nextMission = useMemo(() => {
    if (!windowData) return null
    const windowOrder = ['morning', 'performance', 'recovery'] as const
    for (const wk of windowOrder) {
      const win = windowData.windows[wk]
      if (!win) continue
      const incomplete = win.items.find((i: any) => !i.completed)
      if (incomplete) {
        return {
          name: incomplete.name,
          icon: incomplete.icon,
          category: incomplete.category,
          window: wk,
          timeOfDay: incomplete.timeOfDay,
        }
      }
    }
    return null
  }, [windowData])

  const stabColors = stabilityLoading || stabilityOffline
    ? { color: T.textTer, glow: 'rgba(255,255,255,0.05)' }
    : stabilityColor(stability.pct)
  const bioColor = bioAgeLoading || bioAgeOffline
    ? T.textTer
    : viveAge ? bioAgeColor(viveAge.delta) : T.blue

  // Stability arc for the ring gauge
  const stabArc = useMemo(() => {
    const r = 18
    const circumference = 2 * Math.PI * r
    const offset = circumference * (1 - stability.pct / 100)
    return { circumference, offset, r }
  }, [stability.pct])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — click to dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 10001,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Frosted Glass Panel */}
          <motion.div
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0,
              zIndex: 10002,
              background: T.glass,
              backdropFilter: 'blur(40px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
              borderBottom: `1px solid ${T.glassBorder}`,
              boxShadow: '0 8px 48px rgba(0,0,0,0.5), 0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* ── Frosted glass inner highlights ── */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%, transparent 80%, rgba(0,0,0,0.1) 100%)',
            }} />

            {/* ── Scan line effect ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: `${scanLine}%`,
                left: 0, right: 0,
                height: 1,
                background: 'linear-gradient(90deg, transparent 5%, rgba(0,255,204,0.06) 30%, rgba(0,255,204,0.10) 50%, rgba(0,255,204,0.06) 70%, transparent 95%)',
              }} />
              {/* CRT scanline overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)',
              }} />
              {/* Horizontal noise lines */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 120px, rgba(255,255,255,0.008) 120px, rgba(255,255,255,0.008) 121px)',
              }} />
            </div>

            {/* ── Header bar ── */}
            <div style={{
              padding: '14px 16px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'relative', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: T.teal,
                    boxShadow: `0 0 8px ${T.tealGlow}, 0 0 16px ${T.tealGlow}`,
                  }}
                />
                <span style={{
                  fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
                  fontSize: 9, fontWeight: 700,
                  color: T.teal, letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}>
                  COMMAND SUMMARY // {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Keyboard shortcut hint */}
                <div style={{
                  padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${T.border}`,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 8, fontWeight: 600,
                  color: T.textTer, letterSpacing: '0.05em',
                }}>
                  C
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${T.border}`,
                    color: T.textSec, fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'monospace',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = T.border
                  }}
                >
                  \u2715
                </button>
              </div>
            </div>

            {/* ── Three Giant Metrics ── */}
            <div style={{
              padding: '16px 16px 20px',
              display: 'flex', gap: 8,
              position: 'relative', zIndex: 1,
            }}>
              {/* ── METRIC 1: Biological Age ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.4 }}
                className={bioGlitch ? 'hud-tile-glitch' : ''}
                style={{
                  flex: 1, padding: '14px 12px', borderRadius: 14,
                  background: bioGlitch
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))'
                    : `linear-gradient(135deg, ${bioColor}0A, rgba(255,255,255,0.01))`,
                  border: `1px solid ${bioGlitch ? 'rgba(232,151,108,0.12)' : `${bioColor}18`}`,
                  position: 'relative', overflow: 'hidden',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {/* Shimmer overlay when loading */}
                {bioAgeLoading && <ShimmerOverlay />}

                {/* Re-scan sweep line */}
                {sweepBio > 0 && <div key={`sweep-bio-${sweepBio}`} className="hud-rescan-sweep" />}

                {/* Corner accents */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 1, background: bioGlitch ? T.orange : bioColor, opacity: bioGlitch ? 0.3 : 0.4 }} />
                <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 20, background: bioGlitch ? T.orange : bioColor, opacity: bioGlitch ? 0.3 : 0.4 }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 1, background: bioGlitch ? T.orange : bioColor, opacity: 0.15 }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 20, background: bioGlitch ? T.orange : bioColor, opacity: 0.15 }} />

                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 7, fontWeight: 700,
                  color: T.textTer, letterSpacing: '0.2em',
                  textTransform: 'uppercase', marginBottom: 6,
                  position: 'relative', zIndex: 1,
                }}>
                  BIO AGE
                </div>

                {/* ── Loading State ── */}
                {bioAgeLoading && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <motion.div
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 28, fontWeight: 800,
                        color: T.textTer, lineHeight: 1,
                        letterSpacing: '-0.04em',
                      }}
                    >
                      --.-
                    </motion.div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 9, fontWeight: 600,
                      color: T.amber, opacity: 0.7,
                      marginTop: 4,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        style={{ width: 8, height: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="3" fill="none" stroke={T.amber} strokeWidth="1" strokeDasharray="6 12" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                      <SearchingText label="Searching" color={T.amber} />
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 2, letterSpacing: '0.05em',
                      opacity: 0.5,
                    }}>
                      SYNCING BIOMARKERS
                    </div>
                    <RescanButton onRescan={() => handleRescan('bio')} rescanning={rescanBio} />
                  </div>
                )}

                {/* ── Sensor Offline State ── */}
                {bioAgeOffline && !bioAgeLoading && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 28, fontWeight: 800,
                      color: T.textTer, lineHeight: 1,
                      letterSpacing: '-0.04em',
                      opacity: 0.4,
                    }}>
                      {'\u2014'}
                    </div>
                    <SensorOfflineBadge />
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 2, letterSpacing: '0.05em',
                      opacity: 0.4,
                    }}>
                      NO LAB DATA UPLOADED
                    </div>
                    <RescanButton onRescan={() => handleRescan('bio')} rescanning={rescanBio} />
                  </div>
                )}

                {/* ── Data Available State ── */}
                {!bioAgeLoading && !bioAgeOffline && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 32, fontWeight: 800,
                      color: bioColor, lineHeight: 1,
                      letterSpacing: '-0.04em',
                      textShadow: `0 0 30px ${bioColor}40, 0 0 60px ${bioColor}15`,
                    }}>
                      {viveAge ? viveAge.viveAge.toFixed(1) : '\u2014'}
                    </div>
                    {viveAge && (
                      <div style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 9, fontWeight: 600,
                        color: viveAge.delta <= 0 ? T.green : T.red,
                        marginTop: 4,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span>{viveAge.delta <= 0 ? '\u25BC' : '\u25B2'}</span>
                        <span>{Math.abs(viveAge.delta).toFixed(1)}y {viveAge.delta <= 0 ? 'younger' : 'older'}</span>
                      </div>
                    )}
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 2, letterSpacing: '0.05em',
                    }}>
                      {viveAge ? `CHRONO: ${viveAge.chronologicalAge} \u00B7 ${viveAge.confidence}% CONF` : 'AWAITING DATA'}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* ── METRIC 2: System Stability ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.4 }}
                className={stabGlitch ? 'hud-tile-glitch' : ''}
                style={{
                  flex: 1, padding: '14px 12px', borderRadius: 14,
                  background: stabGlitch
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))'
                    : `linear-gradient(135deg, ${stabColors.color}0A, rgba(255,255,255,0.01))`,
                  border: `1px solid ${stabGlitch ? 'rgba(232,151,108,0.12)' : `${stabColors.color}18`}`,
                  position: 'relative', overflow: 'hidden',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {/* Shimmer overlay when loading */}
                {stabilityLoading && <ShimmerOverlay />}

                {/* Re-scan sweep line */}
                {sweepStab > 0 && <div key={`sweep-stab-${sweepStab}`} className="hud-rescan-sweep" />}

                <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 1, background: stabGlitch ? T.orange : stabColors.color, opacity: stabGlitch ? 0.3 : 0.4 }} />
                <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 20, background: stabGlitch ? T.orange : stabColors.color, opacity: stabGlitch ? 0.3 : 0.4 }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 1, background: stabGlitch ? T.orange : stabColors.color, opacity: 0.15 }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 20, background: stabGlitch ? T.orange : stabColors.color, opacity: 0.15 }} />

                {/* Mini ring gauge — only when data is available */}
                {!stabilityLoading && !stabilityOffline && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, zIndex: 1 }}>
                    <svg viewBox="0 0 44 44" width="44" height="44">
                      <circle cx="22" cy="22" r={stabArc.r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
                      <motion.circle
                        cx="22" cy="22" r={stabArc.r}
                        fill="none" stroke={stabColors.color} strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={stabArc.circumference}
                        initial={{ strokeDashoffset: stabArc.circumference }}
                        animate={{ strokeDashoffset: stabArc.offset }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', filter: `drop-shadow(0 0 4px ${stabColors.glow})` }}
                      />
                    </svg>
                  </div>
                )}

                {/* Loading ring placeholder */}
                {stabilityLoading && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, zIndex: 3 }}>
                    <svg viewBox="0 0 44 44" width="44" height="44">
                      <circle cx="22" cy="22" r={stabArc.r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
                      <motion.circle
                        cx="22" cy="22" r={stabArc.r}
                        fill="none" stroke={T.textTer} strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={stabArc.circumference}
                        animate={{ strokeDashoffset: [stabArc.circumference, stabArc.circumference * 0.6, stabArc.circumference] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', opacity: 0.3 }}
                      />
                    </svg>
                  </div>
                )}

                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 7, fontWeight: 700,
                  color: T.textTer, letterSpacing: '0.2em',
                  textTransform: 'uppercase', marginBottom: 6,
                  position: 'relative', zIndex: 1,
                }}>
                  STABILITY
                </div>

                {/* ── Loading State ── */}
                {stabilityLoading && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <motion.span
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: 32, fontWeight: 800,
                          color: T.textTer, lineHeight: 1,
                          letterSpacing: '-0.04em',
                        }}
                      >
                        --
                      </motion.span>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 14, fontWeight: 700,
                        color: `${T.textTer}50`,
                      }}>
                        %
                      </span>
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, fontWeight: 700,
                      color: T.amber, opacity: 0.7,
                      marginTop: 4, letterSpacing: '0.12em',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        style={{ width: 8, height: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="3" fill="none" stroke={T.amber} strokeWidth="1" strokeDasharray="6 12" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                      <SearchingText label="Searching" color={T.amber} />
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 2, letterSpacing: '0.05em',
                      opacity: 0.5,
                    }}>
                      SYNCING PROTOCOLS
                    </div>
                    <RescanButton onRescan={() => handleRescan('stab')} rescanning={rescanStab} />
                  </div>
                )}

                {/* ── Sensor Offline State ── */}
                {stabilityOffline && !stabilityLoading && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 32, fontWeight: 800,
                        color: T.textTer, lineHeight: 1,
                        letterSpacing: '-0.04em',
                        opacity: 0.4,
                      }}>
                        {'\u2014'}
                      </span>
                    </div>
                    <SensorOfflineBadge />
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 2, letterSpacing: '0.05em',
                      opacity: 0.4,
                    }}>
                      NO PROTOCOL DATA
                    </div>
                    <RescanButton onRescan={() => handleRescan('stab')} rescanning={rescanStab} />
                  </div>
                )}

                {/* ── Data Available State ── */}
                {!stabilityLoading && !stabilityOffline && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 32, fontWeight: 800,
                        color: stabColors.color, lineHeight: 1,
                        letterSpacing: '-0.04em',
                        textShadow: `0 0 30px ${stabColors.glow}, 0 0 60px ${stabColors.glow}`,
                      }}>
                        {stability.pct}
                      </span>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 14, fontWeight: 700,
                        color: `${stabColors.color}80`,
                      }}>
                        %
                      </span>
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, fontWeight: 700,
                      color: stabColors.color, opacity: 0.7,
                      marginTop: 4, letterSpacing: '0.12em',
                    }}>
                      {stability.label}
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 2, letterSpacing: '0.05em',
                    }}>
                      {stability.done}/{stability.total} PROTOCOLS
                    </div>
                  </div>
                )}
              </motion.div>

              {/* ── METRIC 3: Next Protocol Task ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                className={missionGlitch ? 'hud-tile-glitch' : ''}
                style={{
                  flex: 1, padding: '14px 12px', borderRadius: 14,
                  background: missionGlitch
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))'
                    : nextMission
                      ? 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(255,255,255,0.01))'
                      : `linear-gradient(135deg, ${T.green}0A, rgba(255,255,255,0.01))`,
                  border: `1px solid ${missionGlitch ? 'rgba(232,151,108,0.12)' : nextMission ? 'rgba(59,130,246,0.15)' : `${T.green}18`}`,
                  position: 'relative', overflow: 'hidden',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {/* Shimmer overlay when loading */}
                {missionLoading && <ShimmerOverlay />}

                {/* Re-scan sweep line */}
                {sweepMission > 0 && <div key={`sweep-mission-${sweepMission}`} className="hud-rescan-sweep" />}

                <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 1, background: missionGlitch ? T.orange : (nextMission ? T.blue : T.green), opacity: missionGlitch ? 0.3 : 0.4 }} />
                <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 20, background: missionGlitch ? T.orange : (nextMission ? T.blue : T.green), opacity: missionGlitch ? 0.3 : 0.4 }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 1, background: missionGlitch ? T.orange : (nextMission ? T.blue : T.green), opacity: 0.15 }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 20, background: missionGlitch ? T.orange : (nextMission ? T.blue : T.green), opacity: 0.15 }} />

                {/* Pulsing urgency indicator for active missions */}
                {nextMission && !missionGlitch && (
                  <motion.div
                    animate={{ opacity: [0, 0.06, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{
                      position: 'absolute', inset: 0,
                      background: `radial-gradient(ellipse at 50% 80%, ${T.blue}30, transparent 70%)`,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 7, fontWeight: 700,
                  color: T.textTer, letterSpacing: '0.2em',
                  textTransform: 'uppercase', marginBottom: 6,
                  position: 'relative', zIndex: 1,
                }}>
                  NEXT MISSION
                </div>

                {/* ── Loading State ── */}
                {missionLoading && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <motion.div
                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ fontSize: 22, lineHeight: 1, marginBottom: 4, opacity: 0.3 }}
                    >
                      {'\u23F3'}
                    </motion.div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 10, fontWeight: 700,
                      color: T.amber, opacity: 0.7,
                      lineHeight: 1.3,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        style={{ width: 8, height: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="3" fill="none" stroke={T.amber} strokeWidth="1" strokeDasharray="6 12" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                      <SearchingText label="Searching" color={T.amber} />
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 3, letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      opacity: 0.5,
                    }}>
                      LOADING PROTOCOLS
                    </div>
                    <RescanButton onRescan={() => handleRescan('mission')} rescanning={rescanMission} />
                  </div>
                )}

                {/* ── Sensor Offline State ── */}
                {missionOffline && !missionLoading && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4, opacity: 0.3 }}>
                      {'\u26A0\uFE0F'}
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 10, fontWeight: 700,
                      color: T.textTer, lineHeight: 1.3,
                      opacity: 0.5,
                    }}>
                      NO SIGNAL
                    </div>
                    <SensorOfflineBadge />
                    <RescanButton onRescan={() => handleRescan('mission')} rescanning={rescanMission} />
                  </div>
                )}

                {/* ── Data Available: Has next mission ── */}
                {!missionLoading && !missionOffline && nextMission && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>
                      {nextMission.icon}
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 10, fontWeight: 700,
                      color: T.text, lineHeight: 1.3,
                      letterSpacing: '0.02em',
                    }}>
                      {nextMission.name}
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 3, letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}>
                      {nextMission.window} {'\u00B7'} {nextMission.category}
                    </div>
                  </div>
                )}

                {/* ── Data Available: All complete ── */}
                {!missionLoading && !missionOffline && !nextMission && windowData && (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{'\u2705'}</div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 10, fontWeight: 700,
                      color: T.green, lineHeight: 1.3,
                    }}>
                      ALL CLEAR
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 8, color: T.textTer,
                      marginTop: 3, letterSpacing: '0.08em',
                    }}>
                      PROTOCOLS COMPLETE
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Bottom status bar ── */}
            <div style={{
              padding: '0 16px 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'relative', zIndex: 1,
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 8, color: T.textTer,
                letterSpacing: '0.1em',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>SYS.UPTIME: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span style={{ color: T.border }}>{'\u2502'}</span>
                <span>VIVE 4.0</span>
                <span style={{ color: T.border }}>{'\u2502'}</span>
                <span style={{ color: T.teal, opacity: 0.5 }}>PRESS C TO TOGGLE</span>
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 8, color: T.textTer,
                letterSpacing: '0.08em',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {/* Data source status indicators */}
                {bioAgeLoading || stabilityLoading || missionLoading ? (
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ color: T.amber, fontSize: 8 }}
                  >
                    {'\u25CF'} SYNCING
                  </motion.span>
                ) : bioAgeOffline && stabilityOffline ? (
                  <span style={{ color: T.red, opacity: 0.6, fontSize: 8 }}>
                    {'\u25CF'} SENSORS OFFLINE
                  </span>
                ) : (
                  <span style={{ color: T.green, opacity: 0.6, fontSize: 8 }}>
                    {'\u25CF'} ALL SYSTEMS NOMINAL
                  </span>
                )}
                {viveAge && !bioAgeLoading && (
                  <>
                    <span style={{ color: T.border }}>{'\u2502'}</span>
                    <span>{viveAge.status.toUpperCase()}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
