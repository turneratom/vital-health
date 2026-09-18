import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════════
   DAILY PROTOCOL CHECKLIST — Center Column
   
   Pulls tasks from the `protocols` table via Convex.
   Each toggle triggers confetti + updates Daily Adherence %.
   Seeds defaults if the user has no protocols yet.
   ══════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceAlt: 'rgba(18,18,24,0.70)',
  elevated: 'rgba(22,22,30,0.90)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  electricBlueBright: '#60A5FA',
  electricBlueGlow: 'rgba(59,130,246,0.15)',
  electricBlueMuted: 'rgba(59,130,246,0.08)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.08)',
  green: '#00DC82',
  greenDim: 'rgba(0,220,130,0.12)',
  greenBorder: 'rgba(0,220,130,0.25)',
  orange: '#E8976C',
  orangeDim: 'rgba(232,151,108,0.12)',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Category Config ── */
const CATEGORY_META: Record<string, { color: string; dimColor: string; borderColor: string }> = {
  supplement: { color: T.orange, dimColor: T.orangeDim, borderColor: 'rgba(232,151,108,0.25)' },
  training: { color: T.green, dimColor: T.greenDim, borderColor: T.greenBorder },
  biohacking: { color: T.electricBlueBright, dimColor: T.electricBlueMuted, borderColor: T.borderBlue },
  nutrition: { color: T.accent, dimColor: T.accentDim, borderColor: 'rgba(0,255,204,0.25)' },
  recovery: { color: '#A78BFA', dimColor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.25)' },
  movement: { color: T.green, dimColor: T.greenDim, borderColor: T.greenBorder },
}

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] || { color: T.textSec, dimColor: 'rgba(255,255,255,0.04)', borderColor: T.border }
}

/* ── Confetti Particle System ── */

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  life: number
}

function ConfettiCanvas({ trigger, containerRef }: { trigger: number; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)
  const lastTrigger = useRef(0)

  useEffect(() => {
    if (trigger === 0 || trigger === lastTrigger.current) return
    lastTrigger.current = trigger

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    const colors = ['#00FFCC', '#3B82F6', '#00DC82', '#E8976C', '#A78BFA', '#FFD700', '#FF6B6B', '#60A5FA']
    const newParticles: Particle[] = []

    for (let i = 0; i < 60; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: canvas.width / 2 + (Math.random() - 0.5) * 100,
        y: canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        life: 1,
      })
    }

    particlesRef.current = [...particlesRef.current, ...newParticles]

    if (!animRef.current) {
      const animate = () => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        particlesRef.current = particlesRef.current.filter(p => {
          p.x += p.vx
          p.vy += 0.25 // gravity
          p.y += p.vy
          p.rotation += p.rotationSpeed
          p.life -= 0.012
          p.vx *= 0.99

          if (p.life <= 0) return false

          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.globalAlpha = Math.min(1, p.life * 2)
          ctx.fillStyle = p.color
          ctx.shadowColor = p.color
          ctx.shadowBlur = 4

          // Mix of shapes
          if (p.id % 3 === 0) {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4)
          } else if (p.id % 3 === 1) {
            ctx.beginPath()
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.beginPath()
            ctx.moveTo(0, -p.size / 2)
            ctx.lineTo(p.size / 2, p.size / 2)
            ctx.lineTo(-p.size / 2, p.size / 2)
            ctx.closePath()
            ctx.fill()
          }

          ctx.restore()
          return true
        })

        if (particlesRef.current.length > 0) {
          animRef.current = requestAnimationFrame(animate)
        } else {
          animRef.current = 0
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      animRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
        animRef.current = 0
      }
    }
  }, [trigger, containerRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  )
}

/* ── Protocol Row ── */

function ProtocolRow({
  item,
  onToggle,
  isToggling,
}: {
  item: {
    _id: string
    name: string
    category: string
    icon: string
    description: string
    timeOfDay: string
    completed: boolean
  }
  onToggle: (id: string) => void
  isToggling: boolean
}) {
  const meta = getCategoryMeta(item.category)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        background: item.completed ? 'rgba(0,220,130,0.04)' : T.surface,
        border: `1px solid ${item.completed ? T.greenBorder : T.border}`,
        transition: 'all 0.3s ease',
        cursor: isToggling ? 'wait' : 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => !isToggling && onToggle(item._id)}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: item.completed
          ? `linear-gradient(180deg, ${T.green}, ${T.green}40)`
          : `linear-gradient(180deg, ${meta.color}, ${meta.color}40)`,
        borderRadius: '12px 0 0 12px',
      }} />

      {/* Checkbox */}
      <div style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: `1.5px solid ${item.completed ? T.green : 'rgba(255,255,255,0.15)'}`,
        background: item.completed ? T.greenDim : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.25s ease',
        opacity: isToggling ? 0.5 : 1,
      }}>
        <AnimatePresence>
          {item.completed && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              width="13" height="13" viewBox="0 0 14 14" fill="none"
            >
              <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke={T.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>

      {/* Icon */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: item.completed ? T.green : T.text,
          textDecoration: item.completed ? 'line-through' : 'none',
          opacity: item.completed ? 0.75 : 1,
          lineHeight: 1.3,
          transition: 'all 0.3s',
        }}>
          {item.name}
        </div>
        <div style={{
          fontSize: 10,
          color: T.textTer,
          fontFamily: 'monospace',
          lineHeight: 1.4,
          marginTop: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.description}
        </div>
      </div>

      {/* Time badge */}
      <div style={{
        padding: '2px 7px',
        borderRadius: 6,
        background: meta.dimColor,
        border: `1px solid ${meta.borderColor}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: meta.color,
          textTransform: 'uppercase',
        }}>
          {item.timeOfDay}
        </span>
      </div>

      {/* Done badge */}
      {item.completed && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            fontSize: 8,
            fontFamily: 'monospace',
            fontWeight: 700,
            color: T.green,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          ✓
        </motion.span>
      )}
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT — DailyProtocolChecklist
   ══════════════════════════════════════════════════════════════════ */

export default function DailyProtocolChecklist() {
  const sessionId = getTwinSessionId()

  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId })
  const toggleCompletion = useMutation(api.protocols.toggleCompletion)
  const seedDefaults = useMutation(api.protocols.seedDefaults)
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore)

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const [seeding, setSeeding] = useState(false)
  const [hasSeeded, setHasSeeded] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-seed defaults if user has no protocols
  useEffect(() => {
    if (protocolStatus && protocolStatus.total === 0 && !seeding && !hasSeeded) {
      setSeeding(true)
      seedDefaults({ sessionId })
        .then(() => setHasSeeded(true))
        .catch(console.error)
        .finally(() => setSeeding(false))
    }
  }, [protocolStatus, seeding, hasSeeded, seedDefaults, sessionId])

  const handleToggle = useCallback(async (protocolId: string) => {
    if (togglingId) return
    setTogglingId(protocolId)

    try {
      const result = await toggleCompletion({
        sessionId,
        protocolId: protocolId as Id<"protocols">,
      })

      // Fire confetti on completion
      if (result.completed) {
        setConfettiTrigger(prev => prev + 1)
      }

      // Update adherence score
      await updateAdherence({ sessionId })
    } catch (err) {
      console.error('[DailyProtocolChecklist] Toggle failed:', err)
    } finally {
      setTogglingId(null)
    }
  }, [togglingId, toggleCompletion, updateAdherence, sessionId])

  // Loading state
  if (!protocolStatus) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, border: '2px solid rgba(59,130,246,0.12)',
          borderTopColor: T.electricBlue, borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 10px',
        }} />
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textTer }}>
          Loading protocols…
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Seeding state
  if (seeding || (protocolStatus.total === 0 && !hasSeeded)) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, border: '2px solid rgba(0,255,204,0.2)',
          borderTopColor: T.accent, borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 10px',
        }} />
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.accent }}>
          Initializing your protocol stack…
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const { items, total, done, percentage } = protocolStatus

  // Get unique categories for filter
  const categories = ['all', ...Array.from(new Set(items.map(i => i.category)))]
  const filteredItems = activeFilter === 'all' ? items : items.filter(i => i.category === activeFilter)

  const isAllComplete = percentage === 100

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Confetti overlay */}
      <ConfettiCanvas trigger={confettiTrigger} containerRef={containerRef} />

      {/* ── Adherence Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        {/* Progress ring + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Circular progress */}
          <div style={{ position: 'relative', width: 48, height: 48 }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle
                cx="24" cy="24" r="19"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="4"
              />
              <circle
                cx="24" cy="24" r="19"
                fill="none"
                stroke={isAllComplete ? T.green : percentage > 50 ? T.electricBlue : T.orange}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${(percentage / 100) * 119.38} 119.38`}
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 13,
                fontFamily: 'monospace',
                fontWeight: 800,
                color: isAllComplete ? T.green : T.text,
              }}>
                {percentage}%
              </span>
            </div>
          </div>

          <div>
            <div style={{
              fontSize: 9,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: isAllComplete ? T.green : T.electricBlueBright,
              textTransform: 'uppercase',
              marginBottom: 2,
            }}>
              Daily Adherence
            </div>
            <div style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: T.textSec,
            }}>
              {done} of {total} protocols completed
            </div>
          </div>
        </div>

        {/* Date badge */}
        <div style={{
          padding: '4px 10px',
          borderRadius: 8,
          background: T.surfaceAlt,
          border: `1px solid ${T.border}`,
        }}>
          <span style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: T.textTer,
            letterSpacing: '0.06em',
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Category Filters ── */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 12,
        overflowX: 'auto',
        paddingBottom: 2,
      }}>
        {categories.map(cat => {
          const isActive = activeFilter === cat
          const meta = cat === 'all' ? { color: T.electricBlueBright, dimColor: T.electricBlueMuted, borderColor: T.borderBlue } : getCategoryMeta(cat)
          const count = cat === 'all' ? total : items.filter(i => i.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isActive ? meta.color : T.textTer,
                background: isActive ? meta.dimColor : 'transparent',
                border: `1px solid ${isActive ? meta.borderColor : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Protocol List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <AnimatePresence mode="popLayout">
          {filteredItems.map(item => (
            <ProtocolRow
              key={item._id}
              item={item}
              onToggle={handleToggle}
              isToggling={togglingId === item._id}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── All Complete Celebration ── */}
      <AnimatePresence>
        {isAllComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              marginTop: 14,
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(0,220,130,0.08), rgba(0,255,204,0.04))',
              border: `1px solid ${T.greenBorder}`,
              borderRadius: 14,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Glow */}
            <div style={{
              position: 'absolute',
              top: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '80%',
              height: 40,
              background: `radial-gradient(ellipse, ${T.greenDim}, transparent 70%)`,
              pointerEvents: 'none',
            }} />

            <div style={{ fontSize: 24, marginBottom: 6 }}>🏆</div>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              color: T.green,
              marginBottom: 4,
              fontFamily: 'monospace',
              letterSpacing: '-0.02em',
            }}>
              All Protocols Complete
            </div>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: T.textSec,
              lineHeight: 1.5,
            }}>
              100% adherence logged · Elite performance unlocked
            </div>
            <div style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
            }}>
              {['🧬', '⚡', '🔥'].map((emoji, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 400 }}
                  style={{ fontSize: 18 }}
                >
                  {emoji}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 12,
        fontSize: 8,
        fontFamily: 'monospace',
        color: T.textTer,
        textAlign: 'center',
        letterSpacing: '0.06em',
      }}>
        Synced from protocols table · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
