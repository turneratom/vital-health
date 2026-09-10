import React, { useState, useEffect, useRef, useCallback } from 'react'
import { signInWithEmail, signUpWithEmail, useSession } from '@/lib/auth-client'
import { useNavigate } from '@tanstack/react-router'
import { bindTwinSessionToUser } from '@/lib/twinSession'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Design Tokens ── */
const V = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  gold: '#C4A46C',
  goldDim: 'rgba(196,164,108,0.15)',
  goldGlow: 'rgba(196,164,108,0.06)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.12)',
  blueGlow: 'rgba(59,130,246,0.06)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.08)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.06)',
  borderGold: 'rgba(196,164,108,0.12)',
}

/* ── Canvas Background ── */
function BioCanvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let t = 0
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; life: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Seed particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.3 + 0.05,
        life: Math.random() * 1000,
      })
    }

    const draw = () => {
      t++
      ctx.fillStyle = V.bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Central orb glow
      const cx = canvas.width / 2
      const cy = canvas.height * 0.38
      const pulse = Math.sin(t * 0.008) * 0.15 + 0.85

      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220 * pulse)
      orbGrad.addColorStop(0, 'rgba(196,164,108,0.06)')
      orbGrad.addColorStop(0.4, 'rgba(59,130,246,0.03)')
      orbGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = orbGrad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Orbital rings
      ctx.strokeStyle = 'rgba(196,164,108,0.04)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < 3; i++) {
        const r = 80 + i * 60
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * 1.2, r * 0.6, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.life++
        const flicker = Math.sin(p.life * 0.02) * 0.5 + 0.5

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(196,164,108,${p.a * flicker})`
        ctx.fill()
      })

      // DNA helix hint
      for (let i = 0; i < 20; i++) {
        const yy = cy - 100 + i * 10
        const xOff = Math.sin((i + t * 0.01) * 0.5) * 30
        ctx.beginPath()
        ctx.arc(cx + xOff, yy, 1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59,130,246,${0.08 + Math.sin(i * 0.3) * 0.04})`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx - xOff, yy, 1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,204,${0.06 + Math.cos(i * 0.3) * 0.03})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    />
  )
}

/* ── System Access Component ── */
interface SystemAccessProps {
  mode?: 'signin' | 'signup'
}

export default function SystemAccess({ mode: initialMode = 'signin' }: SystemAccessProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [bootPhase, setBootPhase] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const navigate = useNavigate()
  const { data: session } = useSession()
  const claimAndMigrate = useMutation(api.sessionBind.claimAndMigrate)
  const boundRef = useRef(false)

  // Bind twin sessionId to auth user before dashboard loads
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || boundRef.current) return
    boundRef.current = true
    const { guestSessionId } = bindTwinSessionToUser(userId)
    void claimAndMigrate({
      userId,
      guestSessionId: guestSessionId ?? undefined,
    })
      .catch((err) => console.warn('[vive] bind on auth failed', err))
      .finally(() => {
        navigate({ to: '/' })
      })
  }, [session, navigate, claimAndMigrate])

  // Boot sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => setBootPhase(1), 300),
      setTimeout(() => setBootPhase(2), 800),
      setTimeout(() => setBootPhase(3), 1200),
      setTimeout(() => setShowForm(true), 1600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (mode === 'signin') {
        const result = await signInWithEmail(email, password)
        if (!result.success) {
          setError(result.error?.message ?? 'Authentication failed')
        }
      } else {
        const result = await signUpWithEmail(email, password, name || undefined)
        if (!result.success) {
          setError(result.error?.message ?? 'Registration failed')
        }
      }
    } catch (err: any) {
      setError(err?.message || 'System error — retry')
    } finally {
      setIsLoading(false)
    }
  }, [mode, email, password, name])

  const toggleMode = useCallback(() => {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
    setError(null)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: V.bg, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <BioCanvas canvasRef={canvasRef} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400, padding: '0 24px',
        opacity: showForm ? 1 : 0,
        transform: showForm ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center', marginBottom: 48,
          opacity: bootPhase >= 1 ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke={V.gold} strokeWidth="0.8" opacity="0.3" />
              <circle cx="16" cy="16" r="9" stroke={V.gold} strokeWidth="0.5" opacity="0.2" />
              <circle cx="16" cy="16" r="3.5" fill={V.gold} opacity={bootPhase >= 2 ? 0.8 : 0.2} style={{ transition: 'opacity 0.4s' }} />
            </svg>
            <span style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 20, fontWeight: 700, letterSpacing: '0.25em',
              color: V.gold,
            }}>
              VIVE
            </span>
          </div>
          <div style={{
            fontSize: 9, fontFamily: "'Inter', system-ui, sans-serif",
            letterSpacing: '0.3em', color: V.textTer,
            fontWeight: 500, textTransform: 'uppercase',
          }}>
            Biological Operating System
          </div>
        </div>

        {/* Access Card */}
        <div style={{
          background: V.surface,
          border: `1px solid ${V.borderGold}`,
          borderRadius: 16,
          padding: '32px 28px',
          backdropFilter: 'blur(24px)',
          boxShadow: `0 0 60px ${V.goldGlow}, inset 0 1px 0 rgba(255,255,255,0.03)`,
        }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.25em',
              color: V.gold, fontWeight: 600, marginBottom: 8,
              textTransform: 'uppercase',
              opacity: bootPhase >= 2 ? 1 : 0,
              transition: 'opacity 0.4s',
            }}>
              {mode === 'signin' ? 'SYSTEM ACCESS' : 'OPERATOR REGISTRATION'}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 600, color: V.text,
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: '-0.01em',
            }}>
              {mode === 'signin' ? 'Authenticate Identity' : 'Initialize Bio-Signature'}
            </div>
            <div style={{
              fontSize: 11, color: V.textSec, marginTop: 6,
              fontFamily: "'Inter', system-ui, sans-serif",
              lineHeight: 1.5,
            }}>
              {mode === 'signin'
                ? 'Access your personalized Somatic Map and Longevity Score.'
                : 'Create your biological profile to begin optimization.'}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 20,
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.15)',
              borderRadius: 10, fontSize: 11,
              color: V.red, fontFamily: "'Inter', system-ui, sans-serif",
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={{
                  display: 'block', fontSize: 9, fontFamily: 'monospace',
                  letterSpacing: '0.15em', color: V.textTer, marginBottom: 6,
                  fontWeight: 600, textTransform: 'uppercase',
                }}>
                  OPERATOR DESIGNATION
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null) }}
                  placeholder="Enter your name"
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${V.border}`,
                    borderRadius: 10, color: V.text,
                    fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
                    outline: 'none', transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(196,164,108,0.3)'}
                  onBlur={e => e.currentTarget.style.borderColor = V.border}
                />
              </div>
            )}

            <div>
              <label style={{
                display: 'block', fontSize: 9, fontFamily: 'monospace',
                letterSpacing: '0.15em', color: V.textTer, marginBottom: 6,
                fontWeight: 600, textTransform: 'uppercase',
              }}>
                BIO-SIGNATURE ID
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="operator@vive.bio"
                required
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${V.border}`,
                  borderRadius: 10, color: V.text,
                  fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
                  outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(196,164,108,0.3)'}
                onBlur={e => e.currentTarget.style.borderColor = V.border}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 9, fontFamily: 'monospace',
                letterSpacing: '0.15em', color: V.textTer, marginBottom: 6,
                fontWeight: 600, textTransform: 'uppercase',
              }}>
                ACCESS CIPHER
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="••••••••"
                required
                minLength={8}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${V.border}`,
                  borderRadius: 10, color: V.text,
                  fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
                  outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(196,164,108,0.3)'}
                onBlur={e => e.currentTarget.style.borderColor = V.border}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: 8, padding: '14px 0',
                background: isLoading
                  ? 'rgba(196,164,108,0.08)'
                  : 'linear-gradient(135deg, rgba(196,164,108,0.15), rgba(196,164,108,0.08))',
                border: `1px solid ${isLoading ? 'rgba(196,164,108,0.1)' : 'rgba(196,164,108,0.25)'}`,
                borderRadius: 10, color: V.gold,
                fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 600, letterSpacing: '0.12em',
                cursor: isLoading ? 'wait' : 'pointer',
                transition: 'all 0.3s',
                textTransform: 'uppercase',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = 'rgba(196,164,108,0.4)'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(196,164,108,0.1)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(196,164,108,0.25)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, border: '2px solid rgba(196,164,108,0.2)',
                    borderTopColor: V.gold, borderRadius: '50%',
                    animation: 'sa-spin 0.6s linear infinite', display: 'inline-block',
                  }} />
                  AUTHENTICATING…
                </span>
              ) : (
                mode === 'signin' ? 'INITIALIZE SESSION' : 'CREATE BIO-SIGNATURE'
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '24px 0 20px',
          }}>
            <div style={{ flex: 1, height: 1, background: V.border }} />
            <span style={{
              fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.2em',
              color: V.textTer, fontWeight: 500,
            }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: V.border }} />
          </div>

          {/* Toggle */}
          <button
            onClick={toggleMode}
            style={{
              width: '100%', padding: '12px 0',
              background: 'transparent',
              border: `1px solid ${V.border}`,
              borderRadius: 10, color: V.textSec,
              fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = V.blueDim
              e.currentTarget.style.color = V.text
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = V.border
              e.currentTarget.style.color = V.textSec
            }}
          >
            {mode === 'signin'
              ? 'New operator? Initialize Bio-Signature →'
              : 'Existing operator? Access System →'}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 32,
          opacity: bootPhase >= 3 ? 1 : 0,
          transition: 'opacity 0.6s',
        }}>
          <div style={{
            fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.2em',
            color: V.textTer, fontWeight: 500,
          }}>
            LONGEVITY OS v4.0 · ENCRYPTED · HIPAA-GRADE
          </div>
          <div style={{
            fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.12)', marginTop: 6,
          }}>
            Your biological data never leaves your vault
          </div>
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes sa-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
