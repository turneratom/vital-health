import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.96)',
  surfaceLight: 'rgba(14,14,18,0.6)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  greenBright: '#34D399',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.12)',
  gold: '#FFD700',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ══════════════════════════════════════════════════════════════
   PROTOCOL → BODY REGION MAPPING
   
   Each protocol category + name maps to specific SomaticBodyMap
   regions. When checked off, those regions get a "stabilized"
   green glow effect — creating a powerful visual dopamine loop.
   ══════════════════════════════════════════════════════════════ */

export const PROTOCOL_BODY_MAP: Record<string, string[]> = {
  // Supplements → systemic effects
  'Vitamin D3 + K2': ['chest', 'shoulders', 'arms'],
  'Omega-3 Fish Oil': ['head', 'chest', 'gut'],
  'Creatine Monohydrate': ['head', 'arms', 'legs'],
  'Magnesium Glycinate': ['head', 'neck', 'legs', 'lower_back'],
  'Curcumin': ['gut', 'abdomen', 'shoulders'],
  'Iron Bisglycinate': ['chest', 'head', 'arms'],

  // Training → musculoskeletal
  'Zone 2 Cardio': ['chest', 'legs', 'feet'],
  'Resistance Training': ['shoulders', 'arms', 'legs', 'upper_back'],
  'Walking': ['legs', 'feet', 'hips'],

  // Biohacking → nervous system + recovery
  'Cold Plunge': ['skin', 'chest', 'shoulders', 'arms', 'legs'],
  'Infrared Sauna': ['skin', 'lower_back', 'shoulders'],
  'Morning Sunlight': ['head', 'skin'],
  'Breathwork': ['chest', 'neck', 'abdomen'],

  // Nutrition → digestive + metabolic
  'Protein Target': ['gut', 'abdomen', 'arms'],
  'Hydration 3L+': ['gut', 'abdomen', 'head', 'skin'],

  // Recovery → CNS + sleep
  'Sleep by 10:30 PM': ['head', 'neck', 'lower_back'],
}

// Category-level fallback mapping
const CATEGORY_BODY_MAP: Record<string, string[]> = {
  supplement: ['chest', 'gut'],
  training: ['shoulders', 'legs'],
  biohacking: ['skin', 'chest'],
  nutrition: ['gut', 'abdomen'],
  recovery: ['head', 'lower_back'],
  movement: ['legs', 'hips'],
}

export function getBodyRegionsForProtocol(name: string, category: string): string[] {
  return PROTOCOL_BODY_MAP[name] || CATEGORY_BODY_MAP[category] || ['chest']
}

/* ── Category styling ── */
const CATEGORY_STYLE: Record<string, { icon: string; color: string; glow: string; label: string }> = {
  supplement: { icon: '💊', color: '#A78BFA', glow: 'rgba(167,139,250,0.12)', label: 'SUPPLEMENTS' },
  training: { icon: '🏋️', color: '#3B82F6', glow: 'rgba(59,130,246,0.12)', label: 'TRAINING' },
  biohacking: { icon: '⚡', color: '#00FFCC', glow: 'rgba(0,255,204,0.12)', label: 'BIO-HACKING' },
  nutrition: { icon: '🥩', color: '#E8976C', glow: 'rgba(232,151,108,0.12)', label: 'NUTRITION' },
  recovery: { icon: '🌙', color: '#7CB68E', glow: 'rgba(124,182,142,0.12)', label: 'RECOVERY' },
  movement: { icon: '🚶', color: '#60A5FA', glow: 'rgba(96,165,250,0.12)', label: 'MOVEMENT' },
}

/* ── Stabilization burst animation ── */
function StabilizationBurst({ color }: { color: string }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 1 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        position: 'absolute', inset: -8,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        pointerEvents: 'none',
      }}
    />
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN OVERLAY COMPONENT
   ══════════════════════════════════════════════════════════════ */

interface DailyProtocolOverlayProps {
  isOpen: boolean
  onClose: () => void
  onStabilize: (regions: string[]) => void
}

export default function DailyProtocolOverlay({ isOpen, onClose, onStabilize }: DailyProtocolOverlayProps) {
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('vive-session-id') || 'guest-user' : 'guest-user'

  const protocolStatus = useQuery(api.protocols.getProtocolsByBiologicalWindow, { sessionId })
  const toggleCompletion = useMutation(api.protocols.oneTapVerify)
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore)
  const seedDefaults = useMutation(api.protocols.seedDefaults)

  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const [burstItems, setBurstItems] = useState<Set<string>>(new Set())
  const [seeding, setSeeding] = useState(false)
  const hasSeeded = useRef(false)

  // Auto-seed protocols if user has none
  useEffect(() => {
    if (isOpen && protocolStatus && protocolStatus.totalItems === 0 && !hasSeeded.current && !seeding) {
      hasSeeded.current = true
      setSeeding(true)
      seedDefaults({ sessionId }).then(() => setSeeding(false)).catch(() => setSeeding(false))
    }
  }, [isOpen, protocolStatus, sessionId, seedDefaults, seeding])

  // Group items by category
  const groupedItems = useMemo(() => {
    if (!protocolStatus) return []
    const allItems: Array<{
      _id: string
      name: string
      category: string
      icon: string
      description: string
      completed: boolean
      completedAt: number | null
      timeOfDay: string
    }> = []

    for (const w of Object.values(protocolStatus.windows)) {
      allItems.push(...w.items)
    }

    // Group by category
    const groups = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const existing = groups.get(item.category) || []
      existing.push(item)
      groups.set(item.category, existing)
    }

    // Sort categories: supplement → training → biohacking → nutrition → recovery
    const order = ['supplement', 'training', 'biohacking', 'nutrition', 'recovery', 'movement']
    return order
      .filter(cat => groups.has(cat))
      .map(cat => ({ category: cat, items: groups.get(cat)!, style: CATEGORY_STYLE[cat] || CATEGORY_STYLE.supplement }))
  }, [protocolStatus])

  const handleToggle = useCallback(async (itemId: string, itemName: string, category: string) => {
    try {
      const result = await toggleCompletion({
        sessionId,
        protocolId: itemId as Id<'protocols'>,
      })

      if (result.completed) {
        // Trigger stabilization glow on body map
        const regions = getBodyRegionsForProtocol(itemName, category)
        onStabilize(regions)

        // Visual feedback
        setJustCompleted(prev => new Set(prev).add(itemId))
        setBurstItems(prev => new Set(prev).add(itemId))
        setTimeout(() => {
          setBurstItems(prev => {
            const next = new Set(prev)
            next.delete(itemId)
            return next
          })
        }, 600)
      } else {
        setJustCompleted(prev => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }

      // Update adherence score
      await updateAdherence({ sessionId })
    } catch (err) {
      console.error('Protocol toggle failed:', err)
    }
  }, [sessionId, toggleCompletion, updateAdherence, onStabilize])

  const totalItems = protocolStatus?.totalItems ?? 0
  const totalDone = protocolStatus?.totalDone ?? 0
  const percentage = protocolStatus?.percentage ?? 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
            }}
          />

          {/* Slide-out Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: '100%', maxWidth: 380,
              zIndex: 401,
              background: T.surface,
              borderLeft: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 20px 16px',
              borderBottom: `1px solid ${T.border}`,
              background: 'rgba(10,10,11,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div className="mono-label" style={{ fontSize: 9, color: T.blueBright, marginBottom: 4 }}>
                    DAILY PROTOCOL ENGINE
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
                    System Compliance
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${T.border}`,
                    color: T.textTer, fontSize: 14,
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: percentage === 100
                        ? `linear-gradient(90deg, ${T.green}, ${T.accent})`
                        : percentage > 60
                          ? `linear-gradient(90deg, ${T.blue}, ${T.blueBright})`
                          : `linear-gradient(90deg, ${T.orange}, ${T.gold})`,
                      boxShadow: percentage === 100
                        ? `0 0 12px ${T.greenGlow}`
                        : 'none',
                    }}
                  />
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, fontFeatureSettings: "'tnum' 1",
                  color: percentage === 100 ? T.green : percentage > 60 ? T.blueBright : T.orange,
                  minWidth: 44, textAlign: 'right',
                }}>
                  {totalDone}/{totalItems}
                </div>
              </div>

              {/* Completion message */}
              <AnimatePresence>
                {percentage === 100 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      marginTop: 10, padding: '8px 12px', borderRadius: 10,
                      background: T.greenGlow,
                      border: `1px solid rgba(0,220,130,0.25)`,
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.green }}>
                      ✦ ALL SYSTEMS STABILIZED — Full Biological Coherence
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scrollable Protocol List */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 16px 100px',
              WebkitOverflowScrolling: 'touch',
            }}>
              {seeding && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 11, color: T.textTer, fontFamily: 'monospace' }}>
                    Initializing protocol stack...
                  </div>
                </div>
              )}

              {groupedItems.map(({ category, items, style }) => (
                <div key={category} style={{ marginBottom: 20 }}>
                  {/* Category header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10, padding: '0 4px',
                  }}>
                    <span style={{ fontSize: 13 }}>{style.icon}</span>
                    <span className="mono-label" style={{
                      fontSize: 9, color: style.color, letterSpacing: '0.1em',
                    }}>
                      {style.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `${style.color}15` }} />
                    <span style={{
                      fontSize: 9, fontWeight: 600, fontFeatureSettings: "'tnum' 1",
                      color: T.textTer,
                    }}>
                      {items.filter(i => i.completed || justCompleted.has(i._id)).length}/{items.length}
                    </span>
                  </div>

                  {/* Protocol items */}
                  {items.map((item, idx) => {
                    const isCompleted = item.completed || justCompleted.has(item._id)
                    const hasBurst = burstItems.has(item._id)
                    const bodyRegions = getBodyRegionsForProtocol(item.name, item.category)

                    return (
                      <motion.button
                        key={item._id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.3 }}
                        onClick={() => handleToggle(item._id, item.name, item.category)}
                        style={{
                          width: '100%', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', marginBottom: 6,
                          borderRadius: 14,
                          background: isCompleted
                            ? 'rgba(0,220,130,0.04)'
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isCompleted ? 'rgba(0,220,130,0.15)' : T.border}`,
                          cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          position: 'relative',
                          overflow: 'visible',
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 24, height: 24, borderRadius: 8,
                          border: `2px solid ${isCompleted ? T.green : 'rgba(255,255,255,0.12)'}`,
                          background: isCompleted ? T.greenGlow : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          flexShrink: 0,
                          position: 'relative',
                        }}>
                          <AnimatePresence>
                            {isCompleted && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 12, stiffness: 400 }}
                                style={{ fontSize: 13, color: T.green, lineHeight: 1 }}
                              >
                                ✓
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {hasBurst && <StabilizationBurst color={T.green} />}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: isCompleted ? T.textSec : T.text,
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            textDecorationColor: 'rgba(0,220,130,0.3)',
                            letterSpacing: '-0.01em',
                            transition: 'all 0.3s',
                            marginBottom: 2,
                          }}>
                            <span style={{ marginRight: 6 }}>{item.icon}</span>
                            {item.name}
                          </div>
                          <div style={{
                            fontSize: 10, color: T.textTer, lineHeight: 1.4,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.description}
                          </div>
                        </div>

                        {/* Body region indicator */}
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
                          flexShrink: 0,
                        }}>
                          <div style={{
                            display: 'flex', gap: 2,
                          }}>
                            {bodyRegions.slice(0, 3).map(region => (
                              <div
                                key={region}
                                style={{
                                  width: 6, height: 6, borderRadius: 3,
                                  background: isCompleted ? T.green : 'rgba(255,255,255,0.08)',
                                  boxShadow: isCompleted ? `0 0 6px ${T.greenGlow}` : 'none',
                                  transition: 'all 0.4s',
                                }}
                              />
                            ))}
                          </div>
                          <span className="mono-label" style={{
                            fontSize: 7, color: isCompleted ? 'rgba(0,220,130,0.5)' : T.textTer,
                          }}>
                            {isCompleted ? 'STABILIZED' : bodyRegions[0]?.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              ))}

              {/* Empty state */}
              {!seeding && groupedItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🧬</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>
                    No Active Protocols
                  </div>
                  <div style={{ fontSize: 11, color: T.textTer }}>
                    Protocol stack is empty. System will auto-initialize.
                  </div>
                </div>
              )}
            </div>

            {/* Bottom gradient fade */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 80,
              background: `linear-gradient(transparent, ${T.bg})`,
              pointerEvents: 'none',
            }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
