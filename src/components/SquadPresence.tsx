import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   SQUAD PRESENCE — Live Teammate Stability Widget
   
   Shows 2-3 teammates' System Stability in real-time using the
   existing Convex presence/peers system. If a teammate is
   "Redlining" (Stability < 50%), a subtle red notification
   pulses in the HUD for squad accountability.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  border: 'rgba(255,255,255,0.05)',
}

/** Compute stability from recovery/hrv/strain */
function computeStability(recovery: number, hrv: number, strain: number): number {
  // Recovery is the primary driver (0-100 scale)
  // HRV contributes positively (typical range 20-120, normalize to 0-100)
  // Strain contributes negatively (typical range 0-21, normalize inversely)
  const hrvNorm = Math.min(100, Math.max(0, (hrv / 100) * 100))
  const strainPenalty = Math.min(40, Math.max(0, (strain / 21) * 40))
  const raw = (recovery * 0.5) + (hrvNorm * 0.3) - (strainPenalty * 0.2) + 10
  return Math.round(Math.min(100, Math.max(0, raw)))
}

/** Get thermal state from stability score */
function getThermal(stability: number): { color: string; glow: string; bg: string; label: string } {
  if (stability >= 90) return { color: T.teal, glow: T.tealGlow, bg: 'rgba(0,255,204,0.06)', label: 'Peak' }
  if (stability >= 75) return { color: T.green, glow: T.greenGlow, bg: 'rgba(0,220,130,0.06)', label: 'Optimal' }
  if (stability >= 50) return { color: T.amber, glow: T.amberGlow, bg: 'rgba(245,158,11,0.06)', label: 'Strained' }
  return { color: T.red, glow: T.redGlow, bg: 'rgba(255,107,107,0.06)', label: 'Redlining' }
}

/** Tier badge colors */
function getTierColor(tier: string): string {
  switch (tier) {
    case 'apex': return T.teal
    case 'titan': return T.amber
    case 'sentinel': return T.green
    default: return T.textSec
  }
}

interface SquadPresenceProps {
  /** Callback when any teammate is redlining */
  onRedlineDetected?: (redliningPeers: Array<{ name: string; stability: number }>) => void
  /** Compact mode for inline HUD display */
  compact?: boolean
}

export default function SquadPresence({ onRedlineDetected, compact = false }: SquadPresenceProps) {
  const peers = useQuery(api.peers.listPeers)
  const seedPeers = useMutation(api.peers.seedPeers)
  const nudgePeer = useMutation(api.peers.nudgePeer)
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set())
  const [expandedPeer, setExpandedPeer] = useState<string | null>(null)

  // Seed peers if none exist
  useEffect(() => {
    if (peers && peers.length === 0) {
      seedPeers()
    }
  }, [peers, seedPeers])

  // Compute stability for each peer
  const peerData = useMemo(() => {
    if (!peers) return []
    return peers.slice(0, 3).map(p => {
      const stability = computeStability(p.recovery, p.hrv, p.strain)
      const thermal = getThermal(stability)
      const isRedlining = stability < 50
      return { ...p, stability, thermal, isRedlining }
    })
  }, [peers])

  // Notify parent about redlining peers
  useEffect(() => {
    if (onRedlineDetected) {
      const redlining = peerData.filter(p => p.isRedlining).map(p => ({
        name: p.name,
        stability: p.stability,
      }))
      onRedlineDetected(redlining)
    }
  }, [peerData, onRedlineDetected])

  const handleNudge = useCallback(async (peerId: string) => {
    if (nudgedIds.has(peerId)) return
    try {
      await nudgePeer({ id: peerId as any })
      setNudgedIds(prev => new Set(prev).add(peerId))
      setTimeout(() => {
        setNudgedIds(prev => {
          const next = new Set(prev)
          next.delete(peerId)
          return next
        })
      }, 10000)
    } catch {
      // silent
    }
  }, [nudgePeer, nudgedIds])

  if (!peers || peerData.length === 0) return null

  const redliningCount = peerData.filter(p => p.isRedlining).length
  const avgStability = Math.round(peerData.reduce((s, p) => s + p.stability, 0) / peerData.length)
  const squadThermal = getThermal(avgStability)

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {peerData.map(p => (
          <motion.div
            key={p._id}
            title={`${p.name}: ${p.stability}% stability`}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: p.thermal.bg,
              border: `1.5px solid ${p.thermal.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: p.thermal.color,
              fontFamily: '"JetBrains Mono", monospace',
              position: 'relative',
            }}
            animate={p.isRedlining ? {
              boxShadow: [
                `0 0 0px ${p.thermal.color}00`,
                `0 0 12px ${p.thermal.color}60`,
                `0 0 0px ${p.thermal.color}00`,
              ],
            } : {}}
            transition={p.isRedlining ? { duration: 2, repeat: Infinity } : {}}
          >
            {p.avatar}
            {p.isRedlining && (
              <motion.div
                style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 8, height: 8, borderRadius: '50%',
                  background: T.red,
                  border: '1.5px solid #0A0A0B',
                }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(14,14,18,0.92)',
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: squadThermal.color,
            boxShadow: `0 0 8px ${squadThermal.glow}`,
          }} />
          <div>
            <div style={{
              fontSize: 8, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
              color: T.textTer, letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              SQUAD PRESENCE
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginTop: 1 }}>
              {peerData.length} Active
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {redliningCount > 0 && (
            <motion.div
              style={{
                padding: '2px 8px', borderRadius: 8,
                background: 'rgba(255,107,107,0.12)',
                border: '1px solid rgba(255,107,107,0.2)',
                fontSize: 9, fontWeight: 700, color: T.red,
                fontFamily: '"JetBrains Mono", monospace',
              }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {redliningCount} REDLINE
            </motion.div>
          )}
          <div style={{
            padding: '2px 8px', borderRadius: 8,
            background: squadThermal.bg,
            border: `1px solid ${squadThermal.color}20`,
            fontSize: 9, fontWeight: 700, color: squadThermal.color,
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            AVG {avgStability}%
          </div>
        </div>
      </div>

      {/* Peer Cards */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {peerData.map(peer => {
          const isExpanded = expandedPeer === peer._id
          const wasNudged = nudgedIds.has(peer._id)

          return (
            <motion.div
              key={peer._id}
              layout
              onClick={() => setExpandedPeer(isExpanded ? null : peer._id)}
              style={{
                padding: '10px 12px', borderRadius: 12,
                background: peer.isRedlining
                  ? 'rgba(255,107,107,0.04)'
                  : peer.thermal.bg,
                border: `1px solid ${peer.isRedlining ? 'rgba(255,107,107,0.12)' : `${peer.thermal.color}10`}`,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
              whileHover={{ background: peer.isRedlining ? 'rgba(255,107,107,0.08)' : `${peer.thermal.color}10` }}
            >
              {/* Redline pulse overlay */}
              {peer.isRedlining && (
                <motion.div
                  style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(135deg, rgba(255,107,107,0.06), transparent)`,
                    pointerEvents: 'none',
                  }}
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              )}

              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `linear-gradient(135deg, ${peer.thermal.color}15, ${peer.thermal.color}08)`,
                  border: `1.5px solid ${peer.thermal.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: peer.thermal.color,
                  fontFamily: '"JetBrains Mono", monospace',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  {peer.avatar}
                  {/* Status dot */}
                  <div style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 10, height: 10, borderRadius: '50%',
                    background: peer.status === 'active' ? T.green : T.amber,
                    border: '2px solid #0E0E12',
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                      {peer.name}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, color: getTierColor(peer.tier),
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      {peer.tier}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 9, color: T.textTer,
                    fontFamily: '"JetBrains Mono", monospace',
                    marginTop: 1,
                  }}>
                    {peer.handle} · {peer.lastActive}
                  </div>
                </div>

                {/* Stability gauge */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 18, fontWeight: 800, color: peer.thermal.color,
                    fontFamily: '"JetBrains Mono", monospace',
                    lineHeight: 1,
                    textShadow: peer.isRedlining ? `0 0 12px ${T.redGlow}` : 'none',
                  }}>
                    {peer.stability}%
                  </div>
                  <div style={{
                    fontSize: 7, fontWeight: 700, color: peer.thermal.color,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    fontFamily: '"JetBrains Mono", monospace',
                    opacity: 0.7, marginTop: 1,
                  }}>
                    {peer.thermal.label}
                  </div>
                </div>
              </div>

              {/* Stability bar */}
              <div style={{
                marginTop: 8, height: 3, borderRadius: 2,
                background: 'rgba(255,255,255,0.04)',
                overflow: 'hidden',
                position: 'relative', zIndex: 1,
              }}>
                <motion.div
                  style={{
                    height: '100%', borderRadius: 2,
                    background: peer.isRedlining
                      ? `linear-gradient(90deg, ${T.red}, ${T.red}80)`
                      : `linear-gradient(90deg, ${peer.thermal.color}, ${peer.thermal.color}60)`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${peer.stability}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden', position: 'relative', zIndex: 1 }}
                  >
                    <div style={{
                      marginTop: 10, paddingTop: 10,
                      borderTop: `1px solid ${T.border}`,
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                    }}>
                      {/* Recovery */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 7, fontFamily: '"JetBrains Mono", monospace',
                          color: T.textTer, letterSpacing: '0.15em', marginBottom: 2,
                        }}>
                          RECOVERY
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: peer.recovery >= 80 ? T.green : peer.recovery >= 60 ? T.amber : T.red,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          {peer.recovery}%
                        </div>
                      </div>
                      {/* HRV */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 7, fontFamily: '"JetBrains Mono", monospace',
                          color: T.textTer, letterSpacing: '0.15em', marginBottom: 2,
                        }}>
                          HRV
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: peer.hrv >= 70 ? T.green : peer.hrv >= 50 ? T.amber : T.red,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          {peer.hrv}
                        </div>
                      </div>
                      {/* Strain */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 7, fontFamily: '"JetBrains Mono", monospace',
                          color: T.textTer, letterSpacing: '0.15em', marginBottom: 2,
                        }}>
                          STRAIN
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color: peer.strain <= 10 ? T.green : peer.strain <= 15 ? T.amber : T.red,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}>
                          {peer.strain.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Nudge button */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleNudge(peer._id)
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        width: '100%', marginTop: 10, padding: '7px 0',
                        borderRadius: 8,
                        background: wasNudged
                          ? 'rgba(0,220,130,0.08)'
                          : peer.isRedlining
                            ? 'rgba(255,107,107,0.08)'
                            : 'rgba(59,130,246,0.08)',
                        border: `1px solid ${wasNudged ? 'rgba(0,220,130,0.2)' : peer.isRedlining ? 'rgba(255,107,107,0.2)' : 'rgba(59,130,246,0.2)'}`,
                        color: wasNudged ? T.green : peer.isRedlining ? T.red : '#60A5FA',
                        fontSize: 10, fontWeight: 700, cursor: wasNudged ? 'default' : 'pointer',
                        fontFamily: '"JetBrains Mono", monospace',
                        letterSpacing: '0.1em',
                      }}
                      disabled={wasNudged}
                    >
                      {wasNudged
                        ? '✓ NUDGE SENT'
                        : peer.isRedlining
                          ? '🔴 SEND SUPPORT PING'
                          : '⚡ NUDGE'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Squad Sync Footer */}
      <div style={{
        padding: '8px 14px 10px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 8, fontFamily: '"JetBrains Mono", monospace',
          color: T.textTer, letterSpacing: '0.1em',
        }}>
          LIVE · UPDATED {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {peerData.map(p => (
            <div
              key={p._id}
              style={{
                width: 4, height: 4, borderRadius: '50%',
                background: p.thermal.color,
                boxShadow: `0 0 4px ${p.thermal.glow}`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REDLINE NOTIFICATION BANNER
   
   A subtle red notification that appears at the top of the HUD
   when a teammate drops below 50% stability. Dismissible.
   ═══════════════════════════════════════════════════════════════ */

interface RedlineNotificationProps {
  redliningPeers: Array<{ name: string; stability: number }>
  onDismiss: () => void
}

export function RedlineNotification({ redliningPeers, onDismiss }: RedlineNotificationProps) {
  if (redliningPeers.length === 0) return null

  const names = redliningPeers.map(p => p.name.split(' ')[0]).join(', ')
  const lowestStability = Math.min(...redliningPeers.map(p => p.stability))

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      style={{
        margin: '0 12px 8px',
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(255,107,107,0.06)',
        border: '1px solid rgba(255,107,107,0.15)',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Pulse overlay */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(255,107,107,0.08), transparent, rgba(255,107,107,0.08))',
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Icon */}
      <motion.div
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(255,107,107,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        🔴
      </motion.div>

      {/* Message */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.red,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          SQUAD REDLINE ALERT
        </div>
        <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, lineHeight: 1.4 }}>
          {names} {redliningPeers.length === 1 ? 'is' : 'are'} at{' '}
          <span style={{ color: T.red, fontWeight: 700 }}>{lowestStability}%</span> stability.
          Consider sending support.
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: T.textTer, fontSize: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, position: 'relative', zIndex: 1,
        }}
      >
        ✕
      </button>
    </motion.div>
  )
}
