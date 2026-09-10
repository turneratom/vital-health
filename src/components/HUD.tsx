import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import CommandSummary from './CommandSummary'
import SensorStatus from './SensorStatus'
import BioVaultModal from './BioVaultModal'
import SquadPresence, { RedlineNotification } from './SquadPresence'

/* ═══════════════════════════════════════════════════════════════
   TIME-TRAVEL HUD + COMMAND SUMMARY + SENSOR STATUS
   
   A sleek slider overlay that projects biomarker trajectories
   from "Today" to "+10 Years". Now includes:
   • Command Summary — slides from top with 3 giant metrics
   • Sensor Status — footer with Oura/Whoop/Apple Health sync
   • Toggle HUD — hide all overlays for full-screen 3D canvas
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  orange: '#E8976C',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  border: 'rgba(255,255,255,0.05)',
}

const THERMAL_COLORS: Record<string, { color: string; glow: string; bg: string }> = {
  peak:      { color: T.teal,  glow: T.tealGlow,  bg: 'rgba(0,255,204,0.06)' },
  optimal:   { color: T.green, glow: T.greenGlow,  bg: 'rgba(0,220,130,0.06)' },
  declining: { color: T.amber, glow: T.amberGlow,  bg: 'rgba(245,158,11,0.06)' },
  strain:    { color: T.orange,glow: 'rgba(232,151,108,0.15)', bg: 'rgba(232,151,108,0.06)' },
  critical:  { color: T.red,   glow: T.redGlow,    bg: 'rgba(255,107,107,0.06)' },
}

const YEAR_MARKS = [0, 1, 2, 3, 5, 7, 10]

interface TimeTravelHUDProps {
  onTemporalOffset?: (years: number, regionThermals: Array<{ region: string; score: number; thermal: string }>) => void
  /** External HUD visibility control */
  hudVisible?: boolean
  onHudVisibilityChange?: (visible: boolean) => void
}

export default function TimeTravelHUD({ onTemporalOffset, hudVisible: externalVisible, onHudVisibilityChange }: TimeTravelHUDProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [vaultMarkerId, setVaultMarkerId] = useState<string | null>(null)
  const [years, setYears] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [redliningPeers, setRedliningPeers] = useState<Array<{ name: string; stability: number }>>([])
  const [redlineDismissed, setRedlineDismissed] = useState(false)
  // Internal HUD visibility state (used when no external control)
  const [internalHudVisible, setInternalHudVisible] = useState(true)
  const sliderRef = useRef<HTMLDivElement>(null)
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('vive-session-id') || 'guest-user' : 'guest-user'

  // Resolve whether HUD is visible — prefer external prop, fallback to internal
  const hudVisible = externalVisible !== undefined ? externalVisible : internalHudVisible
  const setHudVisible = useCallback((v: boolean) => {
    if (onHudVisibilityChange) {
      onHudVisibilityChange(v)
    } else {
      setInternalHudVisible(v)
    }
  }, [onHudVisibilityChange])

  // Global keyboard shortcuts: 'C' for Command Summary, 'H' for Toggle HUD
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        setCommandOpen(prev => !prev)
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        setHudVisible(!hudVisible)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hudVisible, setHudVisible])

  const projection = useQuery(
    api.bioForecast.getTimeTravelProjection,
    isOpen ? { sessionId, yearsForward: years } : 'skip'
  )

  useEffect(() => {
    if (onTemporalOffset && projection?.regionThermals) {
      onTemporalOffset(years, projection.regionThermals)
    }
  }, [years, projection?.regionThermals, onTemporalOffset])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setYears(0)
    if (onTemporalOffset) onTemporalOffset(0, [])
  }, [onTemporalOffset])

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setYears(parseFloat(e.target.value))
  }, [])

  const thermal = projection?.statusThermal
    ? THERMAL_COLORS[projection.statusThermal] || THERMAL_COLORS.optimal
    : THERMAL_COLORS.optimal

  const yearLabel = years === 0 ? 'Today' : years === 1 ? '+1 Year' : `+${years.toFixed(1)} Years`

  return (
    <>
      {/* ── Toggle HUD FAB — Always visible ── */}
      <motion.button
        onClick={() => setHudVisible(!hudVisible)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        initial={false}
        animate={{
          background: hudVisible
            ? 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))'
            : 'linear-gradient(135deg, rgba(232,151,108,0.15), rgba(232,151,108,0.08))',
          borderColor: hudVisible
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(232,151,108,0.30)',
        }}
        style={{
          position: 'fixed',
          bottom: hudVisible ? 270 : 24,
          right: 16,
          zIndex: 9997,
          width: 44, height: 44, borderRadius: '50%',
          border: '1px solid',
          color: hudVisible ? 'rgba(255,255,255,0.5)' : 'rgba(232,151,108,0.9)',
          fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
          boxShadow: hudVisible
            ? '0 0 16px rgba(255,255,255,0.04)'
            : '0 0 24px rgba(232,151,108,0.15)',
          transition: 'bottom 0.4s cubic-bezier(0.4,0,0.2,1)',
        }}
        title={hudVisible ? 'Hide HUD (H)' : 'Show HUD (H)'}
      >
        {hudVisible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </motion.button>

      {/* ── Keyboard hint toast (shows briefly when HUD toggled) ── */}
      <AnimatePresence>
        {!hudVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              bottom: 76, right: 16, zIndex: 9997,
              padding: '6px 12px', borderRadius: 10,
              background: 'rgba(14,14,18,0.90)',
              border: '1px solid rgba(232,151,108,0.15)',
              backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: 'rgba(232,151,108,0.7)',
              letterSpacing: '0.08em',
            }}>
              Press
            </span>
            <span style={{
              fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
              color: 'rgba(232,151,108,0.9)',
              padding: '1px 6px', borderRadius: 4,
              background: 'rgba(232,151,108,0.10)',
              border: '1px solid rgba(232,151,108,0.20)',
            }}>
              H
            </span>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: 'rgba(232,151,108,0.7)',
              letterSpacing: '0.08em',
            }}>
              to restore HUD
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── All HUD FABs + Overlays — hidden when HUD is off ── */}
      <AnimatePresence>
        {hudVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9996 }}
          >
            {/* ── FAB: Squad Presence Trigger ── */}
            <motion.button
              onClick={() => setIsOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              style={{
                position: 'absolute', bottom: 470, right: 16,
                width: 44, height: 44, borderRadius: '50%',
                pointerEvents: 'auto',
                background: redliningPeers.length > 0
                  ? 'linear-gradient(135deg, rgba(255,107,107,0.12), rgba(255,107,107,0.06))'
                  : 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(59,130,246,0.06))',
                border: `1px solid ${redliningPeers.length > 0 ? 'rgba(255,107,107,0.25)' : 'rgba(59,130,246,0.2)'}`,
                color: redliningPeers.length > 0 ? 'rgba(255,107,107,0.9)' : 'rgba(59,130,246,0.8)',
                fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(12px)',
                boxShadow: redliningPeers.length > 0
                  ? '0 0 24px rgba(255,107,107,0.12)'
                  : '0 0 24px rgba(59,130,246,0.08)',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 700,
              }}
              title="Squad Presence"
            >
              👥
              {redliningPeers.length > 0 && (
                <motion.div
                  style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#FF6B6B',
                    border: '2px solid #0A0A0B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 7, fontWeight: 800, color: '#fff',
                  }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {redliningPeers.length}
                </motion.div>
              )}
            </motion.button>

            {/* ── FAB: Bio-Vault Trigger ── */}
            <motion.button
              onClick={() => { setVaultMarkerId(null); setVaultOpen(true) }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              style={{
                position: 'absolute', bottom: 420, right: 16,
                pointerEvents: 'auto',
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(139,92,246,0.08))',
                border: '1px solid rgba(168,85,247,0.2)',
                color: 'rgba(168,85,247,0.8)', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 24px rgba(168,85,247,0.08)',
              }}
              title="Bio-Vault Dossier"
            >
              🧬
            </motion.button>

            {/* ── FAB: Command Summary Trigger ── */}
            <motion.button
              onClick={() => setCommandOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              style={{
                position: 'absolute', bottom: 370, right: 16,
                pointerEvents: 'auto',
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,255,204,0.10), rgba(0,220,130,0.08))',
                border: '1px solid rgba(0,255,204,0.2)',
                color: 'rgba(0,255,204,0.8)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 24px rgba(0,255,204,0.08)',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 700,
              }}
              title="Command Summary (C)"
            >
              ⌘
            </motion.button>

            {/* ── FAB: Time-Travel Trigger ── */}
            <motion.button
              onClick={() => setIsOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              style={{
                position: 'absolute', bottom: 320, right: 16,
                pointerEvents: 'auto',
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(59,130,246,0.08))',
                border: '1px solid rgba(168,85,247,0.2)',
                color: 'rgba(168,85,247,0.8)', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 24px rgba(168,85,247,0.08)',
              }}
              title="Time-Travel Projection"
            >
              ⏳
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hidden Squad Presence data listener (always active) ── */}
      <div style={{ display: 'none' }}>
        <SquadPresence
          onRedlineDetected={(peers) => {
            setRedliningPeers(peers)
            if (peers.length > 0) setRedlineDismissed(false)
          }}
          compact
        />
      </div>

      {/* ── Bio-Vault Modal ── */}
      <BioVaultModal
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
        initialMarkerId={vaultMarkerId}
      />

      {/* ── Command Summary Overlay ── */}
      <CommandSummary isOpen={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* ── Time-Travel Overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10001,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'auto',
            }}
          >
            {/* Redline Notification */}
            <AnimatePresence>
              {redliningPeers.length > 0 && !redlineDismissed && (
                <RedlineNotification
                  redliningPeers={redliningPeers}
                  onDismiss={() => setRedlineDismissed(true)}
                />
              )}
            </AnimatePresence>

            {/* Header */}
            <div style={{
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: 'rgba(168,85,247,0.7)', letterSpacing: '0.2em',
                  textTransform: 'uppercase', marginBottom: 2,
                }}>
                  TEMPORAL PROJECTION ENGINE
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
                  Time-Travel
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: T.textSec, fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Year Display */}
            <div style={{ padding: '24px 20px 8px', textAlign: 'center' }}>
              <motion.div
                key={yearLabel}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em',
                  color: thermal.color,
                  textShadow: `0 0 40px ${thermal.glow}`,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {yearLabel}
              </motion.div>
              {projection && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginTop: 4 }}
                >
                  {projection.statusLabel}
                  {projection.adherenceRate > 0 && (
                    <span style={{ color: T.textTer, marginLeft: 8 }}>
                      @ {projection.adherenceRate}% adherence
                    </span>
                  )}
                </motion.div>
              )}
            </div>

            {/* Composite Score Ring */}
            {projection && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <svg viewBox="0 0 120 120" width="120" height="120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                    <motion.circle
                      cx="60" cy="60" r="52"
                      fill="none" stroke={thermal.color} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 52}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - projection.projectedComposite / 100) }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                    {Array.from({ length: 24 }).map((_, i) => {
                      const angle = (i / 24) * 360 - 90
                      const rad = (angle * Math.PI) / 180
                      const x1 = 60 + Math.cos(rad) * 46
                      const y1 = 60 + Math.sin(rad) * 46
                      const x2 = 60 + Math.cos(rad) * 48
                      const y2 = 60 + Math.sin(rad) * 48
                      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                    })}
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      fontSize: 32, fontWeight: 800, color: thermal.color,
                      letterSpacing: '-0.04em', lineHeight: 1,
                    }}>
                      {projection.projectedComposite}
                    </div>
                    <div style={{
                      fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                      letterSpacing: '0.15em', marginTop: 2,
                    }}>
                      COMPOSITE
                    </div>
                    {projection.compositeDelta !== 0 && (
                      <div style={{
                        fontSize: 10, fontWeight: 700, marginTop: 2,
                        color: projection.compositeDelta > 0 ? T.green : T.red,
                      }}>
                        {projection.compositeDelta > 0 ? '▲' : '▼'} {Math.abs(projection.compositeDelta)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Slider */}
            <div style={{ padding: '8px 20px 20px' }}>
              <div ref={sliderRef} style={{ position: 'relative', height: 48, marginBottom: 8 }}>
                <div style={{
                  position: 'absolute', top: 20, left: 0, right: 0, height: 8,
                  borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
                }}>
                  <motion.div
                    style={{
                      height: '100%', borderRadius: 4,
                      background: `linear-gradient(90deg, ${T.teal}, ${years > 5 ? T.amber : T.blue}, ${years > 8 ? T.red : T.amber})`,
                      opacity: 0.6,
                    }}
                    animate={{ width: `${(years / 10) * 100}%` }}
                    transition={{ duration: 0.15 }}
                  />
                </div>
                {YEAR_MARKS.map(y => (
                  <div key={y} style={{
                    position: 'absolute', top: 32, left: `${(y / 10) * 100}%`,
                    transform: 'translateX(-50%)',
                    fontSize: 8, fontFamily: 'monospace',
                    color: Math.abs(years - y) < 0.5 ? T.text : T.textTer,
                    fontWeight: Math.abs(years - y) < 0.5 ? 700 : 400,
                    transition: 'all 0.2s',
                  }}>
                    {y === 0 ? 'NOW' : `+${y}Y`}
                  </div>
                ))}
                <input
                  type="range" min="0" max="10" step="0.1" value={years}
                  onChange={handleSliderChange}
                  onPointerDown={() => setIsDragging(true)}
                  onPointerUp={() => setIsDragging(false)}
                  style={{
                    position: 'absolute', top: 12, left: 0, width: '100%', height: 24,
                    opacity: 0, cursor: 'pointer', zIndex: 2, WebkitAppearance: 'none',
                  }}
                />
                <motion.div
                  style={{
                    position: 'absolute', top: 14, left: `${(years / 10) * 100}%`,
                    transform: 'translateX(-50%)',
                    width: isDragging ? 22 : 18, height: isDragging ? 22 : 18,
                    borderRadius: '50%', background: thermal.color,
                    boxShadow: `0 0 16px ${thermal.glow}, 0 0 32px ${thermal.glow}`,
                    border: '2px solid rgba(255,255,255,0.3)',
                    pointerEvents: 'none', zIndex: 1,
                    transition: 'width 0.15s, height 0.15s',
                  }}
                  animate={{
                    boxShadow: isDragging
                      ? `0 0 24px ${thermal.color}80, 0 0 48px ${thermal.glow}`
                      : `0 0 12px ${thermal.glow}`,
                  }}
                />
              </div>
            </div>

            {/* Marker Projections */}
            {projection && projection.projections.length > 0 && (
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: T.textTer, letterSpacing: '0.15em',
                  textTransform: 'uppercase', marginBottom: 12,
                }}>
                  BIOMARKER TRAJECTORIES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {projection.projections.map(proj => {
                    const scoreDelta = proj.score - proj.currentScore
                    const isImproving = scoreDelta > 0
                    const markerThermal = proj.score >= 85 ? THERMAL_COLORS.peak
                      : proj.score >= 70 ? THERMAL_COLORS.optimal
                      : proj.score >= 50 ? THERMAL_COLORS.declining
                      : proj.score >= 30 ? THERMAL_COLORS.strain
                      : THERMAL_COLORS.critical

                    return (
                      <motion.div
                        key={proj.key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          const markerMap: Record<string, string> = {
                            'Vitamin D': 'vitaminD', 'Ferritin': 'ferritin',
                            'CRP': 'crp', 'HbA1c': 'hba1c',
                            'Testosterone': 'testosterone', 'Free Testosterone': 'testosterone',
                            'Sleep': 'sleep', 'HRV': 'hrv',
                          }
                          const markerId = markerMap[proj.label] || null
                          if (markerId) {
                            setVaultMarkerId(markerId)
                            setVaultOpen(true)
                          }
                        }}
                        style={{
                          padding: '12px 14px', borderRadius: 14,
                          background: markerThermal.bg,
                          border: `1px solid ${markerThermal.color}15`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: markerThermal.color,
                              boxShadow: `0 0 6px ${markerThermal.glow}`,
                            }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                              {proj.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: markerThermal.color }}>
                              {proj.projected} {proj.unit}
                            </span>
                            {scoreDelta !== 0 && (
                              <span style={{
                                fontSize: 9, fontWeight: 700,
                                color: isImproving ? T.green : T.red,
                                padding: '1px 5px', borderRadius: 4,
                                background: isImproving ? T.greenGlow : T.redGlow,
                              }}>
                                {isImproving ? '▲' : '▼'}{Math.abs(scoreDelta)}
                              </span>
                            )}
                          </div>
                        </div>
                        {proj.trajectory.length > 1 && (
                          <svg viewBox={`0 0 ${(proj.trajectory.length - 1) * 20} 20`} width="100%" height="20" style={{ display: 'block' }}>
                            <polyline
                              points={proj.trajectory.map((v, i) => {
                                const x = i * 20
                                const min = Math.min(...proj.trajectory)
                                const max = Math.max(...proj.trajectory)
                                const range = max - min || 1
                                const y = 18 - ((v - min) / range) * 16
                                return `${x},${y}`
                              }).join(' ')}
                              fill="none" stroke={markerThermal.color}
                              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"
                            />
                            <circle cx="0" cy={(() => {
                              const min = Math.min(...proj.trajectory)
                              const max = Math.max(...proj.trajectory)
                              const range = max - min || 1
                              return 18 - ((proj.trajectory[0] - min) / range) * 16
                            })()} r="2" fill={T.text} opacity="0.5" />
                            <circle cx={(proj.trajectory.length - 1) * 20} cy={(() => {
                              const min = Math.min(...proj.trajectory)
                              const max = Math.max(...proj.trajectory)
                              const range = max - min || 1
                              return 18 - ((proj.trajectory[proj.trajectory.length - 1] - min) / range) * 16
                            })()} r="2.5" fill={markerThermal.color} />
                          </svg>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer }}>
                            NOW: {proj.current} {proj.unit}
                          </span>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer }}>
                            SCORE: {proj.currentScore} → {proj.score}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Region Thermal Grid */}
            {projection && projection.regionThermals.length > 0 && (
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: T.textTer, letterSpacing: '0.15em',
                  textTransform: 'uppercase', marginBottom: 12,
                }}>
                  BODY REGION THERMAL MAP
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {projection.regionThermals.map(rt => {
                    const tc = THERMAL_COLORS[rt.thermal] || THERMAL_COLORS.optimal
                    return (
                      <div key={rt.region} style={{
                        padding: '8px 10px', borderRadius: 10,
                        background: tc.bg, border: `1px solid ${tc.color}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: tc.color, boxShadow: `0 0 4px ${tc.glow}`,
                          }} />
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: T.text, textTransform: 'capitalize',
                          }}>
                            {rt.region}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: tc.color, fontFamily: 'monospace',
                        }}>
                          {rt.score}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* No data state */}
            {projection && !projection.hasData && (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🧬</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  No Biomarker Data
                </div>
                <div style={{ fontSize: 12, color: T.textSec, maxWidth: 280, margin: '0 auto' }}>
                  Upload lab results via the Biomarker Ingestion zone to unlock temporal projections.
                </div>
              </div>
            )}

            {/* Footer insight */}
            {projection && projection.hasData && years > 0 && (
              <div style={{ padding: '12px 20px 8px', textAlign: 'center' }}>
                <div style={{
                  fontSize: 11, color: T.textSec, fontStyle: 'italic',
                  maxWidth: 320, margin: '0 auto', lineHeight: 1.6,
                }}>
                  {projection.projectedComposite >= 80
                    ? `At ${projection.adherenceRate}% adherence, your biology maintains Performance Peak through ${yearLabel.replace('+', '')}.`
                    : projection.projectedComposite >= 50
                    ? `Current trajectory shows gradual decline. Increasing protocol adherence above 80% reverses this trend.`
                    : `Warning: Strain points accumulating. Without intervention, biological age accelerates ${Math.abs(projection.compositeDelta)} points by ${yearLabel.replace('+', '')}.`
                  }
                </div>
              </div>
            )}

            {/* ── Squad Presence Widget ── */}
            <div style={{ padding: '0 20px 16px' }}>
              <SquadPresence />
            </div>

            {/* ── Sensor Status Footer ── */}
            <div style={{ marginTop: 'auto' }}>
              <SensorStatus />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
