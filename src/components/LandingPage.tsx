import { useRef, useEffect, useState, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  gold: '#C4A46C',
  goldDim: 'rgba(196,164,108,0.5)',
  goldGlow: 'rgba(196,164,108,0.12)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.15)',
  accentGlow: 'rgba(0,255,204,0.06)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.12)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  border: 'rgba(255,255,255,0.05)',
}

/* ══════════════════════════════════════════════════════════════
   FLUID CANVAS — Preview Mode (Lightweight Hero Animation)
   A simplified, performant version of the FluidCanvas that
   renders ambient biological particles + aura without user
   interaction dependencies.
   ══════════════════════════════════════════════════════════════ */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; life: number; maxLife: number;
  hue: number; sat: number; light: number; alpha: number;
}

const HeroCanvas = memo(function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const timeRef = useRef(0)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.min(Math.floor((w * h) / 8000), 120)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2 - 0.1,
        r: Math.random() * 2 + 0.5,
        life: Math.random() * 300,
        maxLife: 300 + Math.random() * 200,
        hue: 160 + Math.random() * 40, // teal-cyan range
        sat: 60 + Math.random() * 30,
        light: 50 + Math.random() * 20,
        alpha: 0,
      })
    }
    particlesRef.current = particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let w = 0, h = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.parentElement?.clientWidth || window.innerWidth
      h = canvas.parentElement?.clientHeight || window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initParticles(w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      }
    }
    canvas.addEventListener('mousemove', handleMouse)

    const draw = () => {
      timeRef.current++
      const t = timeRef.current
      const mx = mouseRef.current.x * w
      const my = mouseRef.current.y * h

      ctx.clearRect(0, 0, w, h)

      // Central aura — breathing biological glow
      const breathe = Math.sin(t * 0.015) * 0.3 + 0.7
      const auraR = Math.min(w, h) * 0.35 * breathe
      const auraGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, auraR)
      auraGrad.addColorStop(0, `rgba(0,255,204,${0.06 * breathe})`)
      auraGrad.addColorStop(0.4, `rgba(59,130,246,${0.03 * breathe})`)
      auraGrad.addColorStop(0.7, `rgba(196,164,108,${0.015 * breathe})`)
      auraGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = auraGrad
      ctx.fillRect(0, 0, w, h)

      // Mouse-follow subtle glow
      const mouseGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 120)
      mouseGrad.addColorStop(0, 'rgba(0,255,204,0.04)')
      mouseGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = mouseGrad
      ctx.fillRect(0, 0, w, h)

      // Particles
      const particles = particlesRef.current
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.life++
        if (p.life > p.maxLife) {
          p.x = Math.random() * w
          p.y = h + 10
          p.life = 0
          p.vx = (Math.random() - 0.5) * 0.3
          p.vy = -(Math.random() * 0.3 + 0.1)
        }

        // Gentle drift toward center
        const dx = w * 0.5 - p.x
        const dy = h * 0.45 - p.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        p.vx += (dx / dist) * 0.002
        p.vy += (dy / dist) * 0.002

        // Mouse repulsion
        const mdx = p.x - mx
        const mdy = p.y - my
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy) || 1
        if (mDist < 100) {
          const force = (100 - mDist) / 100 * 0.02
          p.vx += (mdx / mDist) * force
          p.vy += (mdy / mDist) * force
        }

        p.vx *= 0.995
        p.vy *= 0.995
        p.x += p.vx
        p.y += p.vy

        // Fade in/out
        const lifeRatio = p.life / p.maxLife
        p.alpha = lifeRatio < 0.1 ? lifeRatio / 0.1
          : lifeRatio > 0.85 ? (1 - lifeRatio) / 0.15
          : 1
        p.alpha *= 0.6

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${p.light}%,${p.alpha})`
        ctx.fill()

        // Glow
        if (p.r > 1.2 && p.alpha > 0.3) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${p.light}%,${p.alpha * 0.08})`
          ctx.fill()
        }
      }

      // Connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j]
          const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
          if (d < 80) {
            const lineAlpha = (1 - d / 80) * Math.min(a.alpha, b.alpha) * 0.15
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(0,255,204,${lineAlpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Orbital rings
      for (let ring = 0; ring < 3; ring++) {
        const ringR = Math.min(w, h) * (0.15 + ring * 0.1)
        const ringAlpha = 0.03 + Math.sin(t * 0.01 + ring) * 0.015
        const rotation = t * 0.001 * (ring % 2 === 0 ? 1 : -1)
        ctx.save()
        ctx.translate(w * 0.5, h * 0.45)
        ctx.rotate(rotation)
        ctx.beginPath()
        ctx.ellipse(0, 0, ringR, ringR * 0.6, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(196,164,108,${ringAlpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouse)
    }
  }, [initParticles])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'auto',
      }}
    />
  )
})

/* ══════════════════════════════════════════════════════════════
   BENTO CARDS — Feature Showcase
   ══════════════════════════════════════════════════════════════ */

interface BentoCardProps {
  icon: React.ReactNode
  label: string
  title: string
  description: string
  accentColor: string
  accentGlow: string
  delay: number
}

function BentoCard({ icon, label, title, description, accentColor, accentGlow, delay }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'relative',
        background: 'rgba(14,14,18,0.6)',
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        padding: '32px 28px 28px',
        overflow: 'hidden',
        cursor: 'default',
        flex: '1 1 300px',
        minWidth: 280,
        maxWidth: 420,
      }}
      whileHover={{ borderColor: accentColor, transition: { duration: 0.3 } }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        borderRadius: '50%', background: accentGlow, filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Module label */}
      <div style={{
        fontSize: 9, fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: accentColor, marginBottom: 16, opacity: 0.8,
      }}>
        {label}
      </div>

      {/* Icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: `linear-gradient(135deg, ${accentGlow}, rgba(14,14,18,0.4))`,
        border: `1px solid ${accentColor}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, fontSize: 22,
      }}>
        {icon}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 18, fontWeight: 700, color: T.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        lineHeight: 1.3, marginBottom: 10,
      }}>
        {title}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 13, lineHeight: 1.65, color: T.textSec,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {description}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 28, right: 28, height: 1,
        background: `linear-gradient(90deg, transparent, ${accentColor}33, transparent)`,
      }} />
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SOMATIC MAP ICON — SVG body outline for Bento card
   ══════════════════════════════════════════════════════════════ */
function SomaticIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00FFCC" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="4" r="2.5" />
      <path d="M12 6.5v5M12 11.5l-3.5 5M12 11.5l3.5 5M8 8l-3 2M16 8l3 2" />
      <circle cx="12" cy="9" r="1" fill="#00FFCC" opacity="0.4" />
    </svg>
  )
}

function LongevityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4A46C" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 2v20M8 6c0-2 8-2 8 0M6 12h12M8 18c0 2 8 2 8 0" />
      <circle cx="12" cy="12" r="2" fill="#C4A46C" opacity="0.3" />
    </svg>
  )
}

function ProtocolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 12l3 3 5-6" />
      <circle cx="18" cy="6" r="2" fill="#3B82F6" opacity="0.4" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   STAT COUNTER — Animated number for social proof
   ══════════════════════════════════════════════════════════════ */
function AnimatedStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1200
        const start = performance.now()
        const tick = (now: number) => {
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setDisplay(Math.round(value * eased))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value])

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 28, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif',
        color: T.gold, letterSpacing: '-0.02em',
      }}>
        {display.toLocaleString()}{suffix}
      </div>
      <div style={{
        fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif',
        color: T.textTer, letterSpacing: '0.15em', textTransform: 'uppercase',
        marginTop: 4, fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   LANDING PAGE — Main Export
   ══════════════════════════════════════════════════════════════ */

interface LandingPageProps {
  onInitialize: () => void
}

export default function LandingPage({ onInitialize }: LandingPageProps) {
  const [ctaHover, setCtaHover] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const handleInit = useCallback(() => {
    setInitialized(true)
    setTimeout(onInitialize, 600)
  }, [onInitialize])

  return (
    <AnimatePresence>
      {!initialized && (
        <motion.div
          key="landing"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: T.bg, overflowY: 'auto', overflowX: 'hidden',
          }}
        >
          {/* ── HERO SECTION ── */}
          <section style={{
            position: 'relative', minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '80px 24px 60px',
          }}>
            {/* FluidCanvas Preview */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <HeroCanvas />
            </div>

            {/* Gradient overlay for text contrast */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(ellipse at 50% 40%, transparent 30%, ${T.bg} 75%)`,
            }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 640 }}>
              {/* Version badge */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px', borderRadius: 100,
                  background: 'rgba(196,164,108,0.06)',
                  border: '1px solid rgba(196,164,108,0.12)',
                  marginBottom: 32,
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: T.accent,
                  boxShadow: `0 0 8px ${T.accent}`,
                  animation: 'landing-pulse 2s ease-in-out infinite',
                }} />
                <span style={{
                  fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 700, letterSpacing: '0.2em', color: T.gold,
                  textTransform: 'uppercase',
                }}>
                  LONGEVITY OS v4.0
                </span>
              </motion.div>

              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ marginBottom: 24 }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: '0 auto 16px' }}>
                  <circle cx="28" cy="28" r="24" stroke={T.gold} strokeWidth="0.8" opacity="0.3" />
                  <circle cx="28" cy="28" r="16" stroke={T.gold} strokeWidth="0.5" opacity="0.2" />
                  <circle cx="28" cy="28" r="6" fill={T.gold} opacity="0.7" />
                  <circle cx="28" cy="28" r="3" fill={T.accent} opacity="0.5" />
                </svg>
                <div style={{
                  fontSize: 42, fontWeight: 800, letterSpacing: '0.25em',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  color: T.text,
                  textShadow: `0 0 40px rgba(196,164,108,0.2)`,
                }}>
                  VIVE
                </div>
              </motion.div>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                style={{
                  fontSize: 16, lineHeight: 1.7, color: T.textSec,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  maxWidth: 480, margin: '0 auto 40px',
                  fontWeight: 400,
                }}
              >
                Your biological operating system. Real-time somatic mapping,
                predictive longevity intelligence, and protocol execution—engineered
                for those who refuse to age on default settings.
              </motion.p>

              {/* CTA Button */}
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                onClick={handleInit}
                onMouseEnter={() => setCtaHover(true)}
                onMouseLeave={() => setCtaHover(false)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  position: 'relative',
                  padding: '16px 48px',
                  background: ctaHover
                    ? 'rgba(0,255,204,0.12)'
                    : 'rgba(0,255,204,0.06)',
                  border: `1px solid ${ctaHover ? 'rgba(0,255,204,0.4)' : 'rgba(0,255,204,0.15)'}`,
                  borderRadius: 14,
                  color: T.accent,
                  fontSize: 13,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: ctaHover
                    ? '0 0 40px rgba(0,255,204,0.15), inset 0 0 20px rgba(0,255,204,0.05)'
                    : '0 0 20px rgba(0,255,204,0.06)',
                  overflow: 'hidden',
                }}
              >
                {/* Shimmer effect */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(105deg, transparent 40%, rgba(0,255,204,0.08) 50%, transparent 60%)',
                  animation: 'landing-shimmer 3s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <span style={{ position: 'relative', zIndex: 1 }}>
                  Initialize Biological OS
                </span>
              </motion.button>

              {/* Sub-CTA text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1 }}
                style={{
                  marginTop: 20, fontSize: 10, color: T.textTer,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  letterSpacing: '0.1em',
                }}
              >
                Zero-friction onboarding · Your data stays sovereign
              </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              style={{
                position: 'absolute', bottom: 32, left: '50%',
                transform: 'translateX(-50%)', zIndex: 2,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}
            >
              <div style={{
                fontSize: 9, fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '0.2em', color: T.textTer, textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                EXPLORE MODULES
              </div>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </motion.div>
            </motion.div>
          </section>

          {/* ── SOCIAL PROOF STRIP ── */}
          <section style={{
            padding: '48px 24px',
            display: 'flex', justifyContent: 'center', gap: 48,
            flexWrap: 'wrap',
            borderTop: `1px solid ${T.border}`,
            borderBottom: `1px solid ${T.border}`,
          }}>
            <AnimatedStat value={12847} suffix="+" label="Active Operators" />
            <AnimatedStat value={94} suffix="%" label="Protocol Adherence" />
            <AnimatedStat value={2} suffix=".7yr" label="Avg Bio-Age Reduction" />
          </section>

          {/* ── BENTO FEATURE CARDS ── */}
          <section style={{
            padding: '80px 24px 100px',
            maxWidth: 1200, margin: '0 auto',
          }}>
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ textAlign: 'center', marginBottom: 56 }}
            >
              <div style={{
                fontSize: 9, fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 700, letterSpacing: '0.25em', color: T.gold,
                textTransform: 'uppercase', marginBottom: 12,
              }}>
                CORE MODULES
              </div>
              <div style={{
                fontSize: 26, fontWeight: 700, color: T.text,
                fontFamily: 'Inter, system-ui, sans-serif',
                lineHeight: 1.3,
              }}>
                Three Pillars of Biological Sovereignty
              </div>
              <div style={{
                fontSize: 14, color: T.textSec, marginTop: 12,
                fontFamily: 'Inter, system-ui, sans-serif',
                maxWidth: 500, margin: '12px auto 0',
                lineHeight: 1.6,
              }}>
                Each module operates independently. Together, they form
                a closed-loop biological intelligence system.
              </div>
            </motion.div>

            {/* Cards */}
            <div style={{
              display: 'flex', gap: 20, flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              <BentoCard
                icon={<SomaticIcon />}
                label="MODULE 01"
                title="Somatic Mapping"
                description="Full-body biometric visualization. Every organ system, every biomarker—rendered as a living digital twin that responds to your real-time physiology. See strain before you feel it."
                accentColor={T.accent}
                accentGlow={T.accentGlow}
                delay={0}
              />
              <BentoCard
                icon={<LongevityIcon />}
                label="MODULE 02"
                title="Predictive Longevity"
                description="AI-driven biological age calculation with 90-day trajectory forecasting. Wearable data hooks from Oura and WHOOP feed directly into your Longevity Score—no manual entry required."
                accentColor={T.gold}
                accentGlow={T.goldGlow}
                delay={0.12}
              />
              <BentoCard
                icon={<ProtocolIcon />}
                label="MODULE 03"
                title="Protocol Execution"
                description="Adaptive daily protocols tied to your somatic state. Check off interventions and watch your body map stabilize in real-time. The system learns what works for your unique biology."
                accentColor={T.blue}
                accentGlow={T.blueDim}
                delay={0.24}
              />
            </div>
          </section>

          {/* ── BOTTOM CTA ── */}
          <section style={{
            padding: '60px 24px 80px',
            textAlign: 'center',
            borderTop: `1px solid ${T.border}`,
          }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div style={{
                fontSize: 22, fontWeight: 700, color: T.text,
                fontFamily: 'Inter, system-ui, sans-serif',
                marginBottom: 16,
              }}>
                Your biology is running. Are you watching?
              </div>
              <div style={{
                fontSize: 13, color: T.textSec, marginBottom: 32,
                fontFamily: 'Inter, system-ui, sans-serif',
                maxWidth: 400, margin: '0 auto 32px',
                lineHeight: 1.6,
              }}>
                Join the operators who have taken control of their
                biological trajectory. No subscriptions. No data harvesting.
                Just signal.
              </div>
              <motion.button
                onClick={handleInit}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '14px 40px',
                  background: 'rgba(196,164,108,0.08)',
                  border: '1px solid rgba(196,164,108,0.2)',
                  borderRadius: 12,
                  color: T.gold,
                  fontSize: 12,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(196,164,108,0.14)'
                  e.currentTarget.style.borderColor = 'rgba(196,164,108,0.35)'
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(196,164,108,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(196,164,108,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(196,164,108,0.2)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Begin Initialization
              </motion.button>
            </motion.div>

            {/* Footer signature */}
            <div style={{
              marginTop: 60, fontSize: 9, color: T.textTer,
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '0.2em', fontWeight: 500,
            }}>
              VIVE · BIOLOGICAL OPERATING SYSTEM · EST. 2024
            </div>
          </section>

          {/* Animations */}
          <style>{`
            @keyframes landing-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.8); }
            }
            @keyframes landing-shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
