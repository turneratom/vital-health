import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

/* ══════════════════════════════════════════════════════════════════
   BOOT SEQUENCE — Terminal-Style Rolling Text Animation
   
   Phases:
   1. Terminal roll — rapid scrolling diagnostic lines
   2. Logo draw-in — VIVE mark with concentric rings
   3. System ready — final status + fade out
   
   After completion, fires onComplete to reveal the HUD.
   Uses warm gold palette (#C4A46C / #E8976C) matching VIVE 4.0.
   ══════════════════════════════════════════════════════════════════ */

const GOLD = '#C4A46C'
const TERRA = '#E8976C'
const DIM = '#4A4238'
const BG = '#0A0908'
const TEXT_DIM = '#6A6259'
const TEXT_BRIGHT = '#E8E0D8'

/* ── Terminal log lines — rapid-fire diagnostic output ── */
const TERMINAL_LINES: Array<{ text: string; color?: string; indent?: number }> = [
  { text: '[BOOT] Initializing VIVE Longevity OS v4.0.2...', color: GOLD },
  { text: '[KERN] Loading biological kernel modules' },
  { text: '[KERN] Module: biomarker_engine.ko ............ OK', color: '#7CB68E' },
  { text: '[KERN] Module: somatic_mirror.ko .............. OK', color: '#7CB68E' },
  { text: '[KERN] Module: protocol_scheduler.ko .......... OK', color: '#7CB68E' },
  { text: '[KERN] Module: neural_sync.ko ................. OK', color: '#7CB68E' },
  { text: '[KERN] Module: temporal_projection.ko ......... OK', color: '#7CB68E' },
  { text: '[MEM ] Allocating biometric buffer pool: 256MB' },
  { text: '[MEM ] Mapping somatic cortex regions' },
  { text: '[NET ] Establishing Convex real-time link' },
  { text: '[NET ] WebSocket handshake ..................... OK', color: '#7CB68E' },
  { text: '[NET ] Latency: 12ms | Protocol: WSS/TLS1.3' },
  { text: '[AUTH] Validating session token' },
  { text: '[AUTH] Session integrity ...................... PASS', color: '#7CB68E' },
  { text: '[SYNC] Querying Bio-Vault for latest snapshot' },
  { text: '[SYNC] Biomarker data: 47 markers loaded' },
  { text: '[SYNC] Protocol adherence: 78% (7-day avg)' },
  { text: '[SYNC] Last lab upload: 3 days ago' },
  { text: '[AI  ] Warming inference context engine' },
  { text: '[AI  ] Loading contextual brief model' },
  { text: '[AI  ] Readiness engine calibrated', color: '#7CB68E' },
  { text: '[TWIN] Initializing Digital Twin subsystem' },
  { text: '[TWIN] Somatic body map: 11 regions mapped' },
  { text: '[TWIN] Thermal overlay: standby' },
  { text: '[HUD ] Mounting Command Summary overlay' },
  { text: '[HUD ] Mounting Time-Travel projection' },
  { text: '[HUD ] Mounting Squad Presence listener' },
  { text: '[HUD ] Sensor status: 3 devices linked' },
  { text: '[PROT] Loading today\'s protocol stack' },
  { text: '[PROT] 8 tasks queued | 2 adaptive swaps detected', color: TERRA },
  { text: '[PROT] Recovery priority: MODERATE' },
  { text: '[SYS ] System stability: 87%' },
  { text: '[SYS ] Biological age delta: -2.3 years', color: '#7CB68E' },
  { text: '[SYS ] All subsystems nominal', color: '#7CB68E' },
  { text: '' },
  { text: '[BOOT] ═══════════════════════════════════════════', color: GOLD },
  { text: '[BOOT] VIVE 4.0 — LONGEVITY OPERATING SYSTEM', color: GOLD },
  { text: '[BOOT] System ready. Transferring to HUD...', color: GOLD },
  { text: '[BOOT] ═══════════════════════════════════════════', color: GOLD },
]

/* ── Timing constants ── */
const LINE_INTERVAL_FAST = 45    // ms between lines during rapid scroll
const LINE_INTERVAL_SLOW = 120   // ms for final lines
const LOGO_DRAW_MS = 1200        // logo draw-in duration
const HOLD_READY_MS = 600        // hold "SYSTEM READY" before exit
const FADE_OUT_MS = 500          // exit fade duration
const VISIBLE_LINES = 28         // max visible terminal lines

interface BootSequenceProps {
  onComplete: () => void
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<'terminal' | 'logo' | 'ready' | 'exit'>('terminal')
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [logoProgress, setLogoProgress] = useState(0)
  const [cursorVisible, setCursorVisible] = useState(true)
  const completedRef = useRef(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  // Phase 1: Terminal roll
  useEffect(() => {
    if (phase !== 'terminal') return
    let line = 0
    const total = TERMINAL_LINES.length

    const tick = () => {
      line++
      setVisibleLines(line)
      if (line >= total) {
        setTimeout(() => setPhase('logo'), 300)
        return
      }
      // Slow down for the last 6 lines
      const delay = line > total - 6 ? LINE_INTERVAL_SLOW : LINE_INTERVAL_FAST
      setTimeout(tick, delay)
    }
    const t = setTimeout(tick, 200)
    return () => clearTimeout(t)
  }, [phase])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [visibleLines])

  // Phase 2: Logo draw-in
  useEffect(() => {
    if (phase !== 'logo') return
    const start = performance.now()
    let raf: number
    const animate = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / LOGO_DRAW_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setLogoProgress(eased)
      if (t < 1) {
        raf = requestAnimationFrame(animate)
      } else {
        setTimeout(() => setPhase('ready'), 400)
      }
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Phase 3: Ready → exit
  useEffect(() => {
    if (phase !== 'ready') return
    const t = setTimeout(() => setPhase('exit'), HOLD_READY_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Phase 4: Exit
  useEffect(() => {
    if (phase !== 'exit') return
    const t = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  const isExiting = phase === 'exit'
  const showLogo = phase === 'logo' || phase === 'ready' || phase === 'exit'
  const showTerminal = phase === 'terminal' || phase === 'logo'

  const displayedLines = useMemo(() => {
    return TERMINAL_LINES.slice(0, visibleLines)
  }, [visibleLines])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: BG,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(0.96)' : 'scale(1)',
        transition: `opacity ${FADE_OUT_MS}ms ease, transform ${FADE_OUT_MS}ms ease`,
        overflow: 'hidden',
      }}
    >
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 3px)',
        opacity: 0.6,
      }} />

      {/* Corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map(c => {
        const isTop = c.startsWith('t')
        const isLeft = c.endsWith('l')
        return (
          <div key={c} style={{
            position: 'absolute',
            top: isTop ? 12 : 'auto',
            bottom: isTop ? 'auto' : 12,
            left: isLeft ? 12 : 'auto',
            right: isLeft ? 'auto' : 12,
            width: 20, height: 20,
            borderTop: isTop ? `1px solid rgba(196,164,108,0.2)` : 'none',
            borderBottom: isTop ? 'none' : `1px solid rgba(196,164,108,0.2)`,
            borderLeft: isLeft ? `1px solid rgba(196,164,108,0.2)` : 'none',
            borderRight: isLeft ? 'none' : `1px solid rgba(196,164,108,0.2)`,
            opacity: phase === 'terminal' ? Math.min(1, visibleLines / 5) : 1,
            transition: 'opacity 0.3s',
          }} />
        )
      })}

      {/* Terminal output area */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '40px 24px',
          opacity: showTerminal ? (phase === 'logo' ? 0.15 : 1) : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={terminalRef}
          style={{
            maxHeight: '70vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {displayedLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontSize: 10,
                lineHeight: 1.7,
                color: line.color || DIM,
                letterSpacing: '0.04em',
                whiteSpace: 'pre',
                opacity: 0,
                animation: 'bootLineAppear 0.15s ease forwards',
                animationDelay: '0ms',
                paddingLeft: line.indent ? `${line.indent * 12}px` : 0,
              }}
            >
              {line.text}
            </div>
          ))}
          {/* Blinking cursor */}
          {phase === 'terminal' && (
            <span style={{
              fontFamily: 'JetBrains Mono, Menlo, monospace',
              fontSize: 10,
              color: GOLD,
              opacity: cursorVisible ? 0.8 : 0,
              transition: 'opacity 0.1s',
            }}>
              {'>'} _
            </span>
          )}
        </div>
      </div>

      {/* Logo + status center area */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: showLogo ? 1 : 0,
          transform: showLogo ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Concentric ring logo */}
        <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 24 }}>
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
            {/* Outer ring */}
            <circle
              cx="50" cy="50" r="44"
              stroke={GOLD}
              strokeWidth="0.6"
              opacity={0.25 * logoProgress}
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={2 * Math.PI * 44 * (1 - logoProgress)}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
            {/* Middle ring */}
            <circle
              cx="50" cy="50" r="32"
              stroke={GOLD}
              strokeWidth="0.5"
              opacity={0.18 * logoProgress}
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={2 * Math.PI * 32 * (1 - Math.max(0, (logoProgress - 0.2) / 0.8))}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
            {/* Inner ring */}
            <circle
              cx="50" cy="50" r="20"
              stroke={TERRA}
              strokeWidth="0.8"
              opacity={0.3 * logoProgress}
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={2 * Math.PI * 20 * (1 - Math.max(0, (logoProgress - 0.4) / 0.6))}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
            {/* Center dot */}
            <circle
              cx="50" cy="50" r="4"
              fill={GOLD}
              opacity={Math.max(0, (logoProgress - 0.7) / 0.3) * 0.9}
            />
            {/* Tick marks */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * 360 - 90
              const rad = (angle * Math.PI) / 180
              const x1 = 50 + Math.cos(rad) * 38
              const y1 = 50 + Math.sin(rad) * 38
              const x2 = 50 + Math.cos(rad) * 40
              const y2 = 50 + Math.sin(rad) * 40
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={GOLD}
                  strokeWidth="0.5"
                  opacity={Math.max(0, (logoProgress - 0.5) / 0.5) * 0.3}
                />
              )
            })}
          </svg>
          {/* Glow behind logo */}
          <div style={{
            position: 'absolute', inset: -20,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(196,164,108,${0.06 * logoProgress}) 0%, transparent 70%)`,
          }} />
        </div>

        {/* VIVE text */}
        <div style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.3em',
          color: GOLD,
          opacity: Math.max(0, (logoProgress - 0.5) / 0.5) * 0.9,
          marginBottom: 6,
        }}>
          VIVE
        </div>

        {/* Subtitle */}
        <div style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 8,
          fontWeight: 500,
          letterSpacing: '0.25em',
          color: TEXT_DIM,
          opacity: Math.max(0, (logoProgress - 0.6) / 0.4),
          marginBottom: 24,
        }}>
          LONGEVITY OPERATING SYSTEM
        </div>

        {/* Status line */}
        <div style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: phase === 'ready' || phase === 'exit' ? GOLD : TEXT_DIM,
          transition: 'color 0.3s ease',
          height: 16,
          display: 'flex',
          alignItems: 'center',
        }}>
          {phase === 'logo' && 'LOADING SUBSYSTEMS...'}
          {(phase === 'ready' || phase === 'exit') && 'SYSTEM READY'}
        </div>

        {/* Progress bar */}
        <div style={{
          marginTop: 16,
          width: 160,
          height: 1,
          background: 'rgba(196,164,108,0.1)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: phase === 'terminal'
              ? `${(visibleLines / TERMINAL_LINES.length) * 50}%`
              : phase === 'logo'
                ? `${50 + logoProgress * 40}%`
                : '100%',
            background: `linear-gradient(90deg, ${GOLD}, ${TERRA})`,
            boxShadow: `0 0 8px rgba(196,164,108,0.4)`,
            transition: 'width 0.3s ease',
            borderRadius: 4,
          }} />
        </div>

        {/* Version */}
        <div style={{
          marginTop: 32,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 7,
          fontWeight: 500,
          letterSpacing: '0.25em',
          color: 'rgba(106,98,89,0.4)',
        }}>
          v4.0.2 BUILD 2026.06
        </div>
      </div>
    </div>
  )
}
