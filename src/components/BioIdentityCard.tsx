import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   BIO-IDENTITY CARD — Premium Lab-Report Style Share Card
   
   Canvas-rendered high-end biological coherence report.
   Designed to look like a $1,000/year luxury health OS output.
   FluidCanvas aesthetic + clinical precision typography.
   Watermark: "Optimized by Vive 4.0"
   ═══════════════════════════════════════════════════════════════ */

type ThermalState = 'cold' | 'cool' | 'neutral' | 'warm' | 'hot' | 'critical'

const THERMAL_COLORS: Record<ThermalState, string> = {
  cold: '#3B82F6',
  cool: '#06B6D4',
  neutral: '#00DC82',
  warm: '#F59E0B',
  hot: '#F97316',
  critical: '#EF4444',
}

const THERMAL_LABELS: Record<ThermalState, string> = {
  cold: 'OPTIMAL',
  cool: 'GOOD',
  neutral: 'BASELINE',
  warm: 'ATTENTION',
  hot: 'WARNING',
  critical: 'CRITICAL',
}

interface SystemData {
  system: string
  label: string
  score: number
  thermal: ThermalState
  icon: string
  trend: string
}

function getSessionId(): string {
  try { return localStorage.getItem('vive-session-id') || 'guest-user' } catch { return 'guest-user' }
}

/* ── Rounded rect helper ── */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/* ── Draw a thin horizontal rule ── */
function drawRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
}

/* ═══════════════════════════════════════════════════════════════
   CANVAS RENDERER — High-End Lab Report Card
   ═══════════════════════════════════════════════════════════════ */
function renderCardToCanvas(
  canvas: HTMLCanvasElement,
  data: {
    overallScore: number
    overallThermal: ThermalState
    biologicalAge: number | null
    chronologicalAge: number | null
    ageDelta: number | null
    systems: SystemData[]
    dataCompleteness: number
  }
) {
  const W = 1080
  const H = 1920
  const dpr = 2
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const PAD = 72 // generous margins
  const CW = W - PAD * 2 // content width

  /* ── Deep black background ── */
  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 0, W, H)

  /* ── Subtle ambient glow (FluidCanvas feel) ── */
  const ambGrad = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, W * 0.7)
  ambGrad.addColorStop(0, 'rgba(59,130,246,0.04)')
  ambGrad.addColorStop(0.5, 'rgba(0,255,204,0.015)')
  ambGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = ambGrad
  ctx.fillRect(0, 0, W, H)

  // Second glow — lower right
  const amb2 = ctx.createRadialGradient(W * 0.75, H * 0.65, 0, W * 0.75, H * 0.65, W * 0.5)
  amb2.addColorStop(0, 'rgba(0,255,204,0.025)')
  amb2.addColorStop(1, 'transparent')
  ctx.fillStyle = amb2
  ctx.fillRect(0, 0, W, H)

  /* ── Micro dot grid (lab paper texture) ── */
  ctx.fillStyle = 'rgba(255,255,255,0.012)'
  for (let gy = 0; gy < H; gy += 40) {
    for (let gx = 0; gx < W; gx += 40) {
      ctx.beginPath()
      ctx.arc(gx, gy, 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /* ── Floating particles (FluidCanvas snapshot) ── */
  for (let i = 0; i < 30; i++) {
    const px = Math.random() * W
    const py = Math.random() * H
    const pr = Math.random() * 1.8 + 0.3
    const alpha = Math.random() * 0.08 + 0.02
    const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr * 12)
    pGrad.addColorStop(0, `rgba(0,255,204,${alpha})`)
    pGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = pGrad
    ctx.beginPath(); ctx.arc(px, py, pr * 12, 0, Math.PI * 2); ctx.fill()
  }

  let Y = 64

  /* ══════════════════════════════════════════════════
     HEADER — Specimen ID / Report Type
     ══════════════════════════════════════════════════ */
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.font = '500 10px "SF Mono", "Fira Code", monospace'
  const reportId = `RPT-${Date.now().toString(36).toUpperCase().slice(-6)}`
  ctx.fillText(`REPORT ${reportId}`, PAD, Y)

  ctx.textAlign = 'right'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  ctx.fillText(`${dateStr} · ${timeStr} UTC`, W - PAD, Y)

  Y += 20
  drawRule(ctx, PAD, W - PAD, Y, 'rgba(255,255,255,0.04)')

  Y += 40

  /* ── VIVE 4.0 wordmark ── */
  ctx.textAlign = 'left'
  ctx.fillStyle = '#00FFCC'
  ctx.font = '700 28px "SF Pro Display", "Inter", system-ui, sans-serif'
  ctx.fillText('VIVE', PAD, Y)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '300 28px "SF Pro Display", "Inter", system-ui, sans-serif'
  ctx.fillText(' 4.0', PAD + ctx.measureText('VIVE').width + 2, Y)

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = '500 10px "SF Mono", "Fira Code", monospace'
  ctx.textAlign = 'right'
  ctx.fillText('BIOLOGICAL COHERENCE REPORT', W - PAD, Y)

  Y += 16
  drawRule(ctx, PAD, W - PAD, Y, 'rgba(0,255,204,0.08)')

  Y += 48

  /* ══════════════════════════════════════════════════
     PRIMARY METRIC — Coherence Score (hero)
     ══════════════════════════════════════════════════ */
  const scoreColor = THERMAL_COLORS[data.overallThermal]
  const cx = W / 2
  const scoreRingR = 130

  // Outer glow halo
  const haloGrad = ctx.createRadialGradient(cx, Y + scoreRingR, scoreRingR * 0.6, cx, Y + scoreRingR, scoreRingR * 1.6)
  haloGrad.addColorStop(0, `${scoreColor}10`)
  haloGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = haloGrad
  ctx.beginPath(); ctx.arc(cx, Y + scoreRingR, scoreRingR * 1.6, 0, Math.PI * 2); ctx.fill()

  // Track ring
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.arc(cx, Y + scoreRingR, scoreRingR, 0, Math.PI * 2); ctx.stroke()

  // Score arc
  const scoreAngle = (data.overallScore / 100) * Math.PI * 2
  ctx.strokeStyle = scoreColor
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, Y + scoreRingR, scoreRingR, -Math.PI / 2, -Math.PI / 2 + scoreAngle)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // Tick marks around ring
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let t = 0; t < 60; t++) {
    const angle = (t / 60) * Math.PI * 2 - Math.PI / 2
    const inner = t % 5 === 0 ? scoreRingR - 12 : scoreRingR - 6
    const outer = scoreRingR - 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * inner, Y + scoreRingR + Math.sin(angle) * inner)
    ctx.lineTo(cx + Math.cos(angle) * outer, Y + scoreRingR + Math.sin(angle) * outer)
    ctx.stroke()
  }

  // Score number
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '100 80px "SF Pro Display", "Inter", system-ui, sans-serif'
  ctx.fillText(Math.round(data.overallScore).toString(), cx, Y + scoreRingR + 16)

  // Unit label
  ctx.fillStyle = scoreColor
  ctx.font = '700 10px "SF Mono", "Fira Code", monospace'
  ctx.fillText('COHERENCE INDEX', cx, Y + scoreRingR + 44)

  // Thermal badge
  ctx.fillStyle = `${scoreColor}15`
  const bW = 100, bH = 24
  roundRect(ctx, cx - bW / 2, Y + scoreRingR + 56, bW, bH, 12)
  ctx.fill()
  ctx.fillStyle = scoreColor
  ctx.font = '700 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText(THERMAL_LABELS[data.overallThermal], cx, Y + scoreRingR + 72)

  Y += scoreRingR * 2 + 100

  /* ══════════════════════════════════════════════════
     AGE DELTA — Bio vs Chrono (clinical layout)
     ══════════════════════════════════════════════════ */
  if (data.biologicalAge != null && data.chronologicalAge != null) {
    drawRule(ctx, PAD, W - PAD, Y, 'rgba(255,255,255,0.03)')
    Y += 28

    const delta = data.ageDelta ?? 0
    const isYounger = delta < 0

    // Section label
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '600 9px "SF Mono", "Fira Code", monospace'
    ctx.fillText('AGE ANALYSIS', PAD, Y)
    Y += 32

    // Bio Age — large
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '500 10px "SF Mono", "Fira Code", monospace'
    ctx.fillText('BIOLOGICAL AGE', PAD, Y)
    ctx.fillStyle = isYounger ? '#00FFCC' : '#E8976C'
    ctx.font = '200 56px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(data.biologicalAge.toFixed(1), PAD, Y + 56)
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '300 18px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText('years', PAD + ctx.measureText(data.biologicalAge.toFixed(1)).width + 8, Y + 56)

    // Chrono Age — right aligned
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '500 10px "SF Mono", "Fira Code", monospace'
    ctx.fillText('CHRONOLOGICAL AGE', W - PAD, Y)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '200 56px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(data.chronologicalAge.toString(), W - PAD, Y + 56)

    // Delta badge — centered
    ctx.textAlign = 'center'
    const deltaStr = `${isYounger ? '' : '+'}${delta.toFixed(1)} YRS`
    const deltaColor = isYounger ? '#00FFCC' : delta < 2 ? '#3B82F6' : '#E8976C'
    ctx.fillStyle = `${deltaColor}12`
    roundRect(ctx, cx - 60, Y + 18, 120, 32, 16)
    ctx.fill()
    ctx.fillStyle = deltaColor
    ctx.font = '700 13px "SF Mono", "Fira Code", monospace'
    ctx.fillText(deltaStr, cx, Y + 40)

    // Dashed connectors
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 5])
    ctx.beginPath(); ctx.moveTo(PAD + 180, Y + 34); ctx.lineTo(cx - 65, Y + 34); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + 65, Y + 34); ctx.lineTo(W - PAD - 120, Y + 34); ctx.stroke()
    ctx.setLineDash([])

    Y += 90
  }

  /* ══════════════════════════════════════════════════
     SYSTEM THERMAL MAP — 8 body systems
     ══════════════════════════════════════════════════ */
  drawRule(ctx, PAD, W - PAD, Y, 'rgba(255,255,255,0.03)')
  Y += 28

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '600 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText('SYSTEM THERMAL MAP', PAD, Y)

  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillText(`${data.systems.length} SYSTEMS MONITORED`, W - PAD, Y)

  Y += 24

  const systems = data.systems.slice(0, 8)
  const colW = (CW - 24) / 2
  const rowH = 88

  systems.forEach((sys, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = PAD + col * (colW + 24)
    const y = Y + row * (rowH + 12)
    const sysColor = THERMAL_COLORS[sys.thermal as ThermalState] || '#3B82F6'

    // Card bg
    ctx.fillStyle = 'rgba(255,255,255,0.015)'
    roundRect(ctx, x, y, colW, rowH, 12)
    ctx.fill()

    // Left accent line
    ctx.fillStyle = sysColor
    roundRect(ctx, x, y + 8, 3, rowH - 16, 1.5)
    ctx.fill()

    // Icon
    ctx.font = '20px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(sys.icon, x + 16, y + 36)

    // System name
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '600 13px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(sys.label, x + 46, y + 30)

    // Thermal label
    ctx.fillStyle = `${sysColor}AA`
    ctx.font = '600 8px "SF Mono", "Fira Code", monospace'
    ctx.fillText(THERMAL_LABELS[sys.thermal as ThermalState] || 'N/A', x + 46, y + 46)

    // Score bar
    const barX = x + 46
    const barY = y + 58
    const barW = colW - 100
    const barH = 4
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    roundRect(ctx, barX, barY, barW, barH, 2)
    ctx.fill()
    const fillW = Math.max(3, (sys.score / 100) * barW)
    const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0)
    barGrad.addColorStop(0, `${sysColor}50`)
    barGrad.addColorStop(1, sysColor)
    ctx.fillStyle = barGrad
    roundRect(ctx, barX, barY, fillW, barH, 2)
    ctx.fill()

    // Score number
    ctx.textAlign = 'right'
    ctx.fillStyle = sysColor
    ctx.font = '700 18px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(Math.round(sys.score).toString(), x + colW - 14, y + 38)

    // Trend
    const trendIcon = sys.trend === 'improving' ? '↑' : sys.trend === 'declining' ? '↓' : '→'
    const trendColor = sys.trend === 'improving' ? '#00DC82' : sys.trend === 'declining' ? '#FF6B6B' : 'rgba(255,255,255,0.2)'
    ctx.fillStyle = trendColor
    ctx.font = '600 10px "SF Mono", monospace'
    ctx.fillText(trendIcon, x + colW - 14, y + 58)
  })

  Y += Math.ceil(systems.length / 2) * (rowH + 12) + 16

  /* ══════════════════════════════════════════════════
     DATA COMPLETENESS
     ══════════════════════════════════════════════════ */
  drawRule(ctx, PAD, W - PAD, Y, 'rgba(255,255,255,0.03)')
  Y += 24

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '600 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText('DATA COMPLETENESS', PAD, Y)

  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(59,130,246,0.6)'
  ctx.font = '700 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText(`${data.dataCompleteness}%`, W - PAD, Y)

  Y += 14
  const compBarW = CW
  ctx.fillStyle = 'rgba(255,255,255,0.02)'
  roundRect(ctx, PAD, Y, compBarW, 4, 2)
  ctx.fill()
  const compFill = Math.max(2, (data.dataCompleteness / 100) * compBarW)
  const compGrad = ctx.createLinearGradient(PAD, 0, PAD + compFill, 0)
  compGrad.addColorStop(0, 'rgba(59,130,246,0.3)')
  compGrad.addColorStop(1, '#3B82F6')
  ctx.fillStyle = compGrad
  roundRect(ctx, PAD, Y, compFill, 4, 2)
  ctx.fill()

  /* ══════════════════════════════════════════════════
     FOOTER — Watermark + Branding
     ══════════════════════════════════════════════════ */
  const footerY = H - 100
  drawRule(ctx, PAD, W - PAD, footerY, 'rgba(0,255,204,0.06)')

  // Watermark
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,255,204,0.3)'
  ctx.font = '700 12px "SF Mono", "Fira Code", monospace'
  ctx.fillText('OPTIMIZED BY VIVE 4.0', cx, footerY + 32)

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.font = '400 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText('YOUR BIOLOGICAL OPERATING SYSTEM', cx, footerY + 52)

  // Corner accents (lab report feel)
  ctx.strokeStyle = 'rgba(0,255,204,0.06)'
  ctx.lineWidth = 1
  const cm = 20
  // Top-left
  ctx.beginPath(); ctx.moveTo(PAD - 20, 40); ctx.lineTo(PAD - 20, 40 - cm); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(PAD - 20, 40); ctx.lineTo(PAD - 20 + cm, 40); ctx.stroke()
  // Top-right
  ctx.beginPath(); ctx.moveTo(W - PAD + 20, 40); ctx.lineTo(W - PAD + 20, 40 - cm); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W - PAD + 20, 40); ctx.lineTo(W - PAD + 20 - cm, 40); ctx.stroke()
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(PAD - 20, H - 40); ctx.lineTo(PAD - 20, H - 40 + cm); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(PAD - 20, H - 40); ctx.lineTo(PAD - 20 + cm, H - 40); ctx.stroke()
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(W - PAD + 20, H - 40); ctx.lineTo(W - PAD + 20, H - 40 + cm); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W - PAD + 20, H - 40); ctx.lineTo(W - PAD + 20 - cm, H - 40); ctx.stroke()
}

/* ═══════════════════════════════════════════════════════════════
   SHARE STATUS OVERLAY — Main Export Component
   ═══════════════════════════════════════════════════════════════ */

export default function BioIdentityCard({ isOpen, onClose }: {
  isOpen: boolean
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'generating' | 'ready' | 'sharing' | 'copied'>('generating')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const sessionId = getSessionId()
  const bioIdentity = useQuery(api.bioIdentity.getBioIdentityState, { sessionId })

  useEffect(() => {
    if (!isOpen || !bioIdentity || !canvasRef.current) return
    setStatus('generating')

    const timer = setTimeout(() => {
      try {
        renderCardToCanvas(canvasRef.current!, {
          overallScore: bioIdentity.overallScore,
          overallThermal: bioIdentity.overallThermal as ThermalState,
          biologicalAge: bioIdentity.biologicalAge,
          chronologicalAge: bioIdentity.chronologicalAge,
          ageDelta: bioIdentity.ageDelta,
          systems: bioIdentity.systems.map((s: any) => ({
            system: s.system,
            label: s.label,
            score: s.score,
            thermal: s.thermal,
            icon: s.icon,
            trend: s.trend,
          })),
          dataCompleteness: bioIdentity.dataCompleteness,
        })

        canvasRef.current!.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            setImageUrl(url)
            setStatus('ready')
          }
        }, 'image/png')
      } catch (err) {
        console.error('Card render error:', err)
        setStatus('ready')
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [isOpen, bioIdentity])

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl) }
  }, [imageUrl])

  const handleShare = useCallback(async () => {
    if (!canvasRef.current) return
    setStatus('sharing')

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, 'image/png')
      )

      if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], 'vive-bio-card.png', { type: 'image/png' })] })) {
        const file = new File([blob], 'vive-bio-card.png', { type: 'image/png' })
        await navigator.share({
          title: 'My Vive Bio-Identity Card',
          text: `Biological Coherence: ${Math.round(bioIdentity?.overallScore ?? 0)}% \u2014 Optimized by Vive 4.0`,
          files: [file],
        })
      } else {
        const text = [
          '\ud83e\uddec VIVE BIO-IDENTITY CARD',
          '',
          `Biological Coherence: ${Math.round(bioIdentity?.overallScore ?? 0)}%`,
          bioIdentity?.biologicalAge != null ? `Bio Age: ${bioIdentity.biologicalAge.toFixed(1)}` : '',
          bioIdentity?.chronologicalAge != null ? `Chrono Age: ${bioIdentity.chronologicalAge}` : '',
          bioIdentity?.ageDelta != null ? `Delta: ${bioIdentity.ageDelta < 0 ? '' : '+'}${bioIdentity.ageDelta.toFixed(1)} years` : '',
          '',
          'Optimized by Vive 4.0',
        ].filter(Boolean).join('\n')

        await navigator.clipboard.writeText(text)
        setStatus('copied')
        setTimeout(() => setStatus('ready'), 2500)
        return
      }
      setStatus('ready')
    } catch {
      setStatus('ready')
    }
  }, [bioIdentity])

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return
    canvasRef.current.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vive-bio-card-${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99990,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(24px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          {/* Close */}
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            \u2715
          </motion.button>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ textAlign: 'center', marginBottom: 16 }}
          >
            <div style={{
              fontSize: 9, fontFamily: '"SF Mono", "Fira Code", monospace',
              fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase',
              color: '#00FFCC', marginBottom: 4,
            }}>
              SHARE STATUS
            </div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: '#F0F0F4',
              fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
            }}>
              Bio-Identity Card
            </div>
          </motion.div>

          {/* Card Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 28 }}
            style={{
              position: 'relative',
              width: '100%', maxWidth: 340,
              borderRadius: 20, overflow: 'hidden',
              border: '1px solid rgba(0,255,204,0.08)',
              boxShadow: '0 0 80px rgba(0,255,204,0.06), 0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            <AnimatePresence>
              {status === 'generating' && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: '#050508',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 12,
                  }}
                >
                  <div style={{
                    width: 28, height: 28,
                    border: '2px solid rgba(0,255,204,0.08)',
                    borderTopColor: '#00FFCC',
                    borderRadius: '50%',
                    animation: 'bio-card-spin 0.8s linear infinite',
                  }} />
                  <div style={{
                    fontSize: 9, fontFamily: '"SF Mono", monospace',
                    fontWeight: 600, letterSpacing: '0.2em',
                    color: '#00FFCC', textTransform: 'uppercase',
                  }}>
                    RENDERING REPORT\u2026
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Bio-Identity Card"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '9/16', background: '#050508' }} />
            )}
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              display: 'flex', gap: 12, marginTop: 20,
              width: '100%', maxWidth: 340,
            }}
          >
            <motion.button
              onClick={handleShare}
              disabled={status === 'generating' || status === 'sharing'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1, padding: '14px 0',
                background: status === 'copied' ? 'rgba(0,220,130,0.12)' : 'rgba(0,255,204,0.08)',
                border: `1px solid ${status === 'copied' ? 'rgba(0,220,130,0.25)' : 'rgba(0,255,204,0.15)'}`,
                borderRadius: 14, cursor: 'pointer',
                color: status === 'copied' ? '#00DC82' : '#00FFCC',
                fontSize: 13, fontWeight: 700,
                fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                letterSpacing: '0.03em',
                transition: 'all 0.3s',
                opacity: status === 'generating' ? 0.4 : 1,
              }}
            >
              {status === 'sharing' ? '\u23f3 Sharing\u2026' : status === 'copied' ? '\u2713 Copied!' : '\u2197 Share'}
            </motion.button>

            <motion.button
              onClick={handleDownload}
              disabled={status === 'generating'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1, padding: '14px 0',
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.12)',
                borderRadius: 14, cursor: 'pointer',
                color: '#3B82F6',
                fontSize: 13, fontWeight: 700,
                fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                letterSpacing: '0.03em',
                transition: 'all 0.3s',
                opacity: status === 'generating' ? 0.4 : 1,
              }}
            >
              \u2193 Download
            </motion.button>
          </motion.div>

          <style>{`@keyframes bio-card-spin { to { transform: rotate(360deg); } }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
