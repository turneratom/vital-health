import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   READINESS REPORT — "Confidential Medical File" Style Snapshot
   
   One-tap generates a full-screen, stripped-down report view that
   looks like a classified document from a high-tech longevity lab.
   
   Features:
   • Strips all HUD chrome — pure data presentation
   • SomaticBodyMap thermal silhouette with system annotations
   • LongevityScore hero with subsystem breakdown
   • Biomarker panel with optimal range indicators
   • "Share to Command" — exports as branded PNG for social/coach
   • Confidential document styling (report ID, timestamps, classification)
   ═══════════════════════════════════════════════════════════════ */

type ThermalState = 'cold' | 'cool' | 'neutral' | 'warm' | 'hot' | 'critical'

const THERMAL_HEX: Record<ThermalState, string> = {
  cold: '#3B82F6', cool: '#06B6D4', neutral: '#00DC82',
  warm: '#F59E0B', hot: '#F97316', critical: '#EF4444',
}
const THERMAL_LABEL: Record<ThermalState, string> = {
  cold: 'OPTIMAL', cool: 'GOOD', neutral: 'BASELINE',
  warm: 'ELEVATED', hot: 'WARNING', critical: 'CRITICAL',
}

function scoreToThermal(score: number): ThermalState {
  if (score >= 90) return 'cold'
  if (score >= 75) return 'cool'
  if (score >= 60) return 'neutral'
  if (score >= 40) return 'warm'
  if (score >= 20) return 'hot'
  return 'critical'
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ── Body silhouette SVG path data for the somatic map ── */
const BODY_PATH = 'M50,8 C53,8 56,10 56,14 C56,18 54,21 52,22 L54,24 C58,25 64,28 66,34 L70,48 C71,52 70,54 68,55 L62,56 L64,72 C65,78 64,84 62,88 L58,96 C57,98 56,100 56,104 L56,120 C56,124 54,126 52,126 L50,126 L48,126 C46,126 44,124 44,120 L44,104 C44,100 43,98 42,96 L38,88 C36,84 35,78 36,72 L38,56 L32,55 C30,54 29,52 30,48 L34,34 C36,28 42,25 46,24 L48,22 C46,21 44,18 44,14 C44,10 47,8 50,8 Z'

/* ── Canvas rendering for the export image ── */
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

function renderReportCanvas(
  canvas: HTMLCanvasElement,
  longevity: {
    score: number
    breakdown: { autonomic: number; recovery: number; adherence: number; integrity: number }
    trend: string
    summaryLine: string
    dataCompleteness: number
  },
  bioIdentity: {
    overallScore: number
    overallThermal: ThermalState
    biologicalAge: number | null
    chronologicalAge: number | null
    ageDelta: number | null
    systems: Array<{
      system: string; label: string; score: number
      thermal: ThermalState; icon: string; trend: string
    }>
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

  const PAD = 64
  const CW = W - PAD * 2
  const reportId = `CMD-${Date.now().toString(36).toUpperCase().slice(-8)}`
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  /* ── Background ── */
  ctx.fillStyle = '#020204'
  ctx.fillRect(0, 0, W, H)

  /* ── Ambient field ── */
  const scoreColor = THERMAL_HEX[scoreToThermal(longevity.score)]
  const g1 = ctx.createRadialGradient(W * 0.5, H * 0.12, 0, W * 0.5, H * 0.12, W * 0.8)
  g1.addColorStop(0, hexToRgba(scoreColor, 0.04))
  g1.addColorStop(0.5, hexToRgba('#3B82F6', 0.015))
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)

  /* ── Scan lines ── */
  ctx.fillStyle = 'rgba(255,255,255,0.004)'
  for (let sy = 0; sy < H; sy += 2) ctx.fillRect(0, sy, W, 1)

  /* ── Corner brackets (classified document feel) ── */
  const cm = 28
  ctx.strokeStyle = 'rgba(0,255,204,0.08)'
  ctx.lineWidth = 1.5
  const corners = [
    [PAD - 24, 36, 1, 1], [W - PAD + 24, 36, -1, 1],
    [PAD - 24, H - 36, 1, -1], [W - PAD + 24, H - 36, -1, -1],
  ]
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath()
    ctx.moveTo(cx as number, (cy as number) + (dy as number) * cm)
    ctx.lineTo(cx as number, cy as number)
    ctx.lineTo((cx as number) + (dx as number) * cm, cy as number)
    ctx.stroke()
  })

  let Y = 56

  /* ══════ CLASSIFICATION HEADER ══════ */
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,68,68,0.35)'
  ctx.font = '800 11px "SF Mono", "Fira Code", monospace'
  ctx.fillText('▬▬ CONFIDENTIAL · FOR AUTHORIZED PERSONNEL ONLY ▬▬', W / 2, Y)
  Y += 28

  ctx.strokeStyle = 'rgba(255,68,68,0.08)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
  Y += 24

  /* ══════ REPORT HEADER ══════ */
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = '500 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText(`DOCUMENT: ${reportId}`, PAD, Y)
  ctx.textAlign = 'right'
  ctx.fillText(`${dateStr} · ${timeStr} UTC`, W - PAD, Y)
  Y += 18

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.font = '500 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText('CLASSIFICATION: LEVEL 4 · BIOLOGICAL INTELLIGENCE', PAD, Y)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(0,255,204,0.2)'
  ctx.fillText('VIVE 4.0 · LONGEVITY OS', W - PAD, Y)
  Y += 24

  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
  Y += 36

  /* ══════ TITLE ══════ */
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 42px "SF Pro Display", "Inter", system-ui, sans-serif'
  ctx.fillText('READINESS REPORT', PAD, Y)
  Y += 20
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '400 13px "SF Pro Display", "Inter", system-ui, sans-serif'
  ctx.fillText('Biological Operating System · Real-Time Assessment', PAD, Y)
  Y += 48

  /* ══════ HERO SCORE ══════ */
  const heroCX = W / 2
  const heroR = 120

  // Glow
  const hGrad = ctx.createRadialGradient(heroCX, Y + heroR, heroR * 0.4, heroCX, Y + heroR, heroR * 2)
  hGrad.addColorStop(0, hexToRgba(scoreColor, 0.06))
  hGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = hGrad
  ctx.beginPath(); ctx.arc(heroCX, Y + heroR, heroR * 2, 0, Math.PI * 2); ctx.fill()

  // Track
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(heroCX, Y + heroR, heroR, 0, Math.PI * 2); ctx.stroke()

  // Score arc
  const arcAngle = (longevity.score / 100) * Math.PI * 2
  ctx.strokeStyle = scoreColor
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(heroCX, Y + heroR, heroR, -Math.PI / 2, -Math.PI / 2 + arcAngle)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // Tick marks
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 1
  for (let t = 0; t < 100; t++) {
    const angle = (t / 100) * Math.PI * 2 - Math.PI / 2
    const inner = t % 10 === 0 ? heroR - 14 : t % 5 === 0 ? heroR - 8 : heroR - 4
    ctx.beginPath()
    ctx.moveTo(heroCX + Math.cos(angle) * inner, Y + heroR + Math.sin(angle) * inner)
    ctx.lineTo(heroCX + Math.cos(angle) * (heroR - 2), Y + heroR + Math.sin(angle) * (heroR - 2))
    ctx.stroke()
  }

  // Score number
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '100 96px "SF Pro Display", "Inter", system-ui, sans-serif'
  ctx.fillText(String(longevity.score), heroCX, Y + heroR + 24)

  // Label
  ctx.fillStyle = scoreColor
  ctx.font = '700 10px "SF Mono", "Fira Code", monospace'
  ctx.fillText('LONGEVITY SCORE', heroCX, Y + heroR + 50)

  // Trend
  const trendLabel = longevity.trend === 'improving' ? '▲ IMPROVING' : longevity.trend === 'declining' ? '▼ DECLINING' : '● STABLE'
  const trendColor = longevity.trend === 'improving' ? '#00DC82' : longevity.trend === 'declining' ? '#FF6B6B' : '#F59E0B'
  ctx.fillStyle = trendColor
  ctx.font = '700 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText(trendLabel, heroCX, Y + heroR + 68)

  Y += heroR * 2 + 96

  /* ══════ SUBSYSTEM QUADRANTS ══════ */
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
  Y += 24

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '600 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText('SUBSYSTEM ANALYSIS', PAD, Y)
  Y += 20

  const subsystems = [
    { key: 'autonomic', icon: '🧠', label: 'AUTONOMIC' },
    { key: 'recovery', icon: '💤', label: 'RECOVERY' },
    { key: 'adherence', icon: '🎯', label: 'ADHERENCE' },
    { key: 'integrity', icon: '🛡️', label: 'INTEGRITY' },
  ] as const

  const quadW = (CW - 16 * 3) / 4
  const quadH = 100

  subsystems.forEach((sub, i) => {
    const x = PAD + i * (quadW + 16)
    const val = longevity.breakdown[sub.key]
    const thermal = scoreToThermal(val * 4)
    const color = THERMAL_HEX[thermal]

    roundRect(ctx, x, Y, quadW, quadH, 12)
    ctx.fillStyle = hexToRgba(color, 0.04)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(color, 0.1)
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Icon
    ctx.textAlign = 'center'
    ctx.font = '22px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
    ctx.fillText(sub.icon, x + quadW / 2, Y + 32)

    // Score
    ctx.fillStyle = color
    ctx.font = '800 28px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(String(val), x + quadW / 2, Y + 64)

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '600 7px "SF Mono", "Fira Code", monospace'
    ctx.fillText(sub.label, x + quadW / 2, Y + 84)
  })

  Y += quadH + 32

  /* ══════ SOMATIC BODY MAP ══════ */
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
  Y += 24

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '600 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText('SOMATIC BODY MAP · THERMAL STATE', PAD, Y)
  Y += 8

  // Body silhouette — left side
  const bodyX = PAD + 40
  const bodyY = Y + 20
  const bodyScale = 2.8

  ctx.save()
  ctx.translate(bodyX, bodyY)
  ctx.scale(bodyScale, bodyScale)

  // Body glow
  const bodyGlow = ctx.createRadialGradient(50, 65, 10, 50, 65, 80)
  bodyGlow.addColorStop(0, hexToRgba(THERMAL_HEX[bioIdentity.overallThermal], 0.12))
  bodyGlow.addColorStop(1, 'transparent')
  ctx.fillStyle = bodyGlow
  ctx.beginPath(); ctx.arc(50, 65, 80, 0, Math.PI * 2); ctx.fill()

  // Body outline
  const bodyPath = new Path2D(BODY_PATH)
  ctx.fillStyle = hexToRgba(THERMAL_HEX[bioIdentity.overallThermal], 0.08)
  ctx.fill(bodyPath)
  ctx.strokeStyle = hexToRgba(THERMAL_HEX[bioIdentity.overallThermal], 0.3)
  ctx.lineWidth = 0.6
  ctx.stroke(bodyPath)

  // Thermal zones on body
  const bodyZones = [
    { y: 14, label: 'NEURO', system: 'neurological' },
    { y: 34, label: 'CARDIO', system: 'cardiovascular' },
    { y: 50, label: 'METABOLIC', system: 'metabolic' },
    { y: 70, label: 'IMMUNE', system: 'immune' },
    { y: 90, label: 'MUSCULO', system: 'musculoskeletal' },
    { y: 110, label: 'ENDOCRINE', system: 'endocrine' },
  ]

  bodyZones.forEach((zone) => {
    const sys = bioIdentity.systems.find(s => s.system === zone.system)
    const color = sys ? THERMAL_HEX[sys.thermal as ThermalState] : 'rgba(255,255,255,0.1)'
    const alpha = sys ? 0.4 : 0.1

    // Dot on body
    ctx.fillStyle = hexToRgba(color, alpha)
    ctx.beginPath(); ctx.arc(50, zone.y, 4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = hexToRgba(color, 0.6)
    ctx.lineWidth = 0.4
    ctx.beginPath(); ctx.arc(50, zone.y, 4, 0, Math.PI * 2); ctx.stroke()

    // Pulse ring
    ctx.strokeStyle = hexToRgba(color, 0.15)
    ctx.lineWidth = 0.3
    ctx.beginPath(); ctx.arc(50, zone.y, 8, 0, Math.PI * 2); ctx.stroke()
  })

  ctx.restore()

  // System annotations — right side
  const annotX = PAD + 320
  const annotW = CW - 320 + PAD
  const systems = bioIdentity.systems.slice(0, 8)
  const rowH = 56
  const rowGap = 8

  systems.forEach((sys, i) => {
    const ry = Y + 20 + i * (rowH + rowGap)
    const color = THERMAL_HEX[sys.thermal as ThermalState] || '#3B82F6'

    // Row card
    roundRect(ctx, annotX, ry, annotW - 40, rowH, 10)
    ctx.fillStyle = hexToRgba(color, 0.03)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(color, 0.06)
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Left accent
    ctx.fillStyle = color
    roundRect(ctx, annotX, ry + 6, 3, rowH - 12, 1.5)
    ctx.fill()

    // Icon + label
    ctx.textAlign = 'left'
    ctx.font = '16px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
    ctx.fillText(sys.icon, annotX + 14, ry + 24)

    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '600 12px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(sys.label.toUpperCase(), annotX + 38, ry + 22)

    // Thermal label
    ctx.fillStyle = hexToRgba(color, 0.7)
    ctx.font = '500 8px "SF Mono", "Fira Code", monospace'
    ctx.fillText(THERMAL_LABEL[sys.thermal as ThermalState] || 'N/A', annotX + 38, ry + 38)

    // Score
    ctx.textAlign = 'right'
    ctx.fillStyle = color
    ctx.font = '800 20px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(String(sys.score), annotX + annotW - 56, ry + 30)

    // Trend
    const tArrow = sys.trend === 'improving' ? '↑' : sys.trend === 'declining' ? '↓' : '→'
    const tCol = sys.trend === 'improving' ? '#00DC82' : sys.trend === 'declining' ? '#FF6B6B' : 'rgba(255,255,255,0.2)'
    ctx.fillStyle = tCol
    ctx.font = '700 10px "SF Mono", monospace'
    ctx.fillText(tArrow, annotX + annotW - 56, ry + 46)

    // Connection line to body (dashed)
    ctx.strokeStyle = hexToRgba(color, 0.06)
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.moveTo(annotX - 4, ry + rowH / 2)
    ctx.lineTo(annotX - 30, ry + rowH / 2)
    ctx.stroke()
    ctx.setLineDash([])
  })

  Y += Math.max(systems.length * (rowH + rowGap) + 40, 380)

  /* ══════ BIO-AGE DELTA ══════ */
  if (bioIdentity.biologicalAge != null && bioIdentity.chronologicalAge != null) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
    Y += 24

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '600 9px "SF Mono", "Fira Code", monospace'
    ctx.fillText('BIOLOGICAL AGE ANALYSIS', PAD, Y)
    Y += 28

    const delta = bioIdentity.ageDelta ?? 0
    const isYounger = delta < 0
    const deltaColor = isYounger ? '#00FFCC' : delta < 2 ? '#3B82F6' : '#E8976C'

    // Bio Age
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '500 10px "SF Mono", "Fira Code", monospace'
    ctx.fillText('BIOLOGICAL', PAD, Y)
    ctx.fillStyle = deltaColor
    ctx.font = '200 52px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(bioIdentity.biologicalAge.toFixed(1), PAD, Y + 50)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '300 16px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText('years', PAD + ctx.measureText(bioIdentity.biologicalAge.toFixed(1)).width + 8, Y + 50)

    // Chrono Age
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '500 10px "SF Mono", "Fira Code", monospace'
    ctx.fillText('CHRONOLOGICAL', W - PAD, Y)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '200 52px "SF Pro Display", "Inter", system-ui, sans-serif'
    ctx.fillText(String(bioIdentity.chronologicalAge), W - PAD, Y + 50)

    // Delta badge
    ctx.textAlign = 'center'
    const dStr = `${isYounger ? '' : '+'}${delta.toFixed(1)} YRS`
    roundRect(ctx, W / 2 - 56, Y + 14, 112, 30, 15)
    ctx.fillStyle = hexToRgba(deltaColor, 0.1)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(deltaColor, 0.2)
    ctx.lineWidth = 0.5
    ctx.stroke()
    ctx.fillStyle = deltaColor
    ctx.font = '700 12px "SF Mono", "Fira Code", monospace'
    ctx.fillText(dStr, W / 2, Y + 34)

    Y += 80
  }

  /* ══════ DATA COMPLETENESS ══════ */
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
  Y += 20

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = '600 8px "SF Mono", "Fira Code", monospace'
  ctx.fillText('DATA COMPLETENESS', PAD, Y)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(59,130,246,0.5)'
  ctx.fillText(`${longevity.dataCompleteness}%`, W - PAD, Y)
  Y += 12

  roundRect(ctx, PAD, Y, CW, 4, 2)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fill()
  const fillW = Math.max(2, (longevity.dataCompleteness / 100) * CW)
  const barGrad = ctx.createLinearGradient(PAD, 0, PAD + fillW, 0)
  barGrad.addColorStop(0, hexToRgba('#3B82F6', 0.4))
  barGrad.addColorStop(1, hexToRgba('#00FFCC', 0.5))
  ctx.fillStyle = barGrad
  roundRect(ctx, PAD, Y, fillW, 4, 2)
  ctx.fill()

  Y += 24

  /* ══════ SUMMARY ══════ */
  if (longevity.summaryLine) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = 'italic 400 13px "SF Pro Display", "Inter", system-ui, sans-serif'
    const maxW = CW - 80
    const words = longevity.summaryLine.split(' ')
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word }
      else line = test
    }
    if (line) lines.push(line)
    lines.forEach((l, li) => ctx.fillText(l, W / 2, Y + li * 20))
  }

  /* ══════ FOOTER ══════ */
  const footerY = H - 80
  ctx.strokeStyle = 'rgba(255,68,68,0.06)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, footerY); ctx.lineTo(W - PAD, footerY); ctx.stroke()

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(0,255,204,0.2)'
  ctx.font = '700 10px "SF Mono", "Fira Code", monospace'
  ctx.fillText('VIVE 4.0 · BIOLOGICAL OPERATING SYSTEM', PAD, footerY + 24)

  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.font = '500 9px "SF Mono", "Fira Code", monospace'
  ctx.fillText(`${reportId} · ${dateStr}`, W - PAD, footerY + 24)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,68,68,0.2)'
  ctx.font = '700 8px "SF Mono", "Fira Code", monospace'
  ctx.fillText('▬▬ END OF CLASSIFIED REPORT ▬▬', W / 2, footerY + 48)
}

/* ═══════════════════════════════════════════════════════════════
   READINESS REPORT COMPONENT — Full-Screen Report Mode
   ═══════════════════════════════════════════════════════════════ */

interface ReadinessReportProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReadinessReport({ isOpen, onClose }: ReadinessReportProps) {
  const sessionId = getTwinSessionId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'loading' | 'scanning' | 'ready'>('loading')
  const [sharing, setSharing] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)

  const longevityScore = useQuery(api.longevityScore.getLongevityScore, { sessionId })
  const bioIdentity = useQuery(api.bioIdentity.getBioIdentityState, { sessionId })

  const reportId = useRef(`CMD-${Date.now().toString(36).toUpperCase().slice(-8)}`).current
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  useEffect(() => {
    if (!isOpen) { setPhase('loading'); return }
    if (!longevityScore || !bioIdentity) return

    setPhase('scanning')
    const timer = setTimeout(() => setPhase('ready'), 1800)
    return () => clearTimeout(timer)
  }, [isOpen, longevityScore, bioIdentity])

  // Pre-render export canvas when data is ready
  useEffect(() => {
    if (phase !== 'ready' || !exportCanvasRef.current || !longevityScore || !bioIdentity) return
    renderReportCanvas(
      exportCanvasRef.current,
      {
        score: longevityScore.score,
        breakdown: longevityScore.breakdown,
        trend: longevityScore.trend,
        summaryLine: longevityScore.summaryLine,
        dataCompleteness: longevityScore.dataCompleteness,
      },
      {
        overallScore: bioIdentity.overallScore,
        overallThermal: bioIdentity.overallThermal as ThermalState,
        biologicalAge: bioIdentity.biologicalAge,
        chronologicalAge: bioIdentity.chronologicalAge,
        ageDelta: bioIdentity.ageDelta,
        systems: bioIdentity.systems.map((s: any) => ({
          system: s.system, label: s.label, score: s.score,
          thermal: s.thermal as ThermalState, icon: s.icon, trend: s.trend,
        })),
      }
    )
  }, [phase, longevityScore, bioIdentity])

  const handleShareToCommand = useCallback(async () => {
    if (!exportCanvasRef.current) return
    setSharing(true)
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvasRef.current!.toBlob(resolve, 'image/png', 1.0)
      )
      if (!blob) return

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `vive-readiness-${reportId}.png`, { type: 'image/png' })
        const shareData = { title: `Readiness Report · ${reportId}`, text: `Longevity Score: ${longevityScore?.score}/100 · Vive 4.0`, files: [file] }
        if (navigator.canShare(shareData)) { await navigator.share(shareData); return }
      }
      handleDownload()
    } catch (err: any) {
      if (err?.name !== 'AbortError') handleDownload()
    } finally {
      setSharing(false)
    }
  }, [longevityScore, reportId])

  const handleDownload = useCallback(() => {
    if (!exportCanvasRef.current) return
    const link = document.createElement('a')
    link.download = `vive-readiness-${reportId}.png`
    link.href = exportCanvasRef.current.toDataURL('image/png', 1.0)
    link.click()
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2500)
  }, [reportId])

  const handleCopyCaption = useCallback(() => {
    const score = longevityScore?.score ?? 0
    const trend = longevityScore?.trend === 'improving' ? '📈' : longevityScore?.trend === 'declining' ? '📉' : '📊'
    const delta = bioIdentity?.ageDelta
    const deltaStr = delta != null ? `\nBio-Age Delta: ${delta < 0 ? '' : '+'}${delta.toFixed(1)} years` : ''
    const caption = `${trend} Readiness Report · ${reportId}\n\nLongevity Score: ${score}/100${deltaStr}\n\n${longevityScore?.summaryLine || 'Biological OS running.'}\n\nOptimized by @ViveBio 4.0\n#longevity #biohacking #healthOS #optimization`
    navigator.clipboard.writeText(caption).then(() => {
      setCaptionCopied(true)
      setTimeout(() => setCaptionCopied(false), 2000)
    })
  }, [longevityScore, bioIdentity, reportId])

  if (!isOpen) return null

  const isLoading = !longevityScore || !bioIdentity
  const score = longevityScore?.score ?? 0
  const scoreColor = THERMAL_HEX[scoreToThermal(score)]
  const systems = bioIdentity?.systems ?? []

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99995,
            background: '#020204',
            overflowY: 'auto', overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Hidden export canvas */}
          <canvas ref={exportCanvasRef} style={{ display: 'none' }} />

          {/* ── Scanning overlay ── */}
          <AnimatePresence>
            {(phase === 'loading' || phase === 'scanning') && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 99999,
                  background: '#020204',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 20,
                }}
              >
                {/* Scanning animation */}
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: 80, height: 80,
                      border: '2px solid rgba(59,130,246,0.06)',
                      borderTopColor: '#3B82F6',
                      borderRadius: '50%',
                    }}
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    style={{
                      position: 'absolute', inset: 12,
                      border: '2px solid rgba(0,255,204,0.04)',
                      borderBottomColor: '#00FFCC',
                      borderRadius: '50%',
                    }}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      position: 'absolute', inset: 28,
                      background: 'rgba(59,130,246,0.15)',
                      borderRadius: '50%',
                    }}
                  />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      fontSize: 10, fontFamily: '"SF Mono", "Fira Code", monospace',
                      fontWeight: 700, letterSpacing: '0.2em', color: '#3B82F6',
                      textTransform: 'uppercase',
                    }}
                  >
                    {phase === 'loading' ? 'LOADING BIO-DATA' : 'GENERATING CLASSIFIED REPORT'}
                  </motion.div>
                  <div style={{
                    fontSize: 9, fontFamily: '"SF Mono", monospace',
                    color: 'rgba(255,255,255,0.15)', marginTop: 6,
                    letterSpacing: '0.1em',
                  }}>
                    {phase === 'loading' ? 'Syncing biometric streams…' : 'Compiling somatic thermal map…'}
                  </div>
                </div>

                {/* Scan line */}
                <motion.div
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', left: 0, right: 0, height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.15), transparent)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Report Content ── */}
          {phase === 'ready' && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ minHeight: '100vh', paddingBottom: 120 }}
            >
              {/* Close + Share bar */}
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99997,
                padding: '12px 16px',
                background: 'linear-gradient(180deg, rgba(2,2,4,0.95) 0%, rgba(2,2,4,0.8) 70%, transparent 100%)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: 'max(12px, env(safe-area-inset-top))',
              }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.5)', fontSize: 11,
                    fontFamily: '"SF Mono", monospace', fontWeight: 600,
                    cursor: 'pointer', letterSpacing: '0.05em',
                  }}
                >
                  ✕ CLOSE
                </button>
                <div style={{
                  fontSize: 8, fontFamily: '"SF Mono", monospace',
                  color: 'rgba(255,68,68,0.4)', fontWeight: 700,
                  letterSpacing: '0.15em',
                }}>
                  CONFIDENTIAL
                </div>
                <button
                  onClick={handleShareToCommand}
                  disabled={sharing}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'rgba(0,255,204,0.08)',
                    border: '1px solid rgba(0,255,204,0.15)',
                    color: '#00FFCC', fontSize: 11,
                    fontFamily: '"SF Mono", monospace', fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '0.05em',
                    opacity: sharing ? 0.5 : 1,
                  }}
                >
                  {sharing ? '⏳' : '↗'} SHARE TO COMMAND
                </button>
              </div>

              {/* Classification header */}
              <div style={{ padding: '80px 20px 0', textAlign: 'center' }}>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    fontSize: 9, fontFamily: '"SF Mono", "Fira Code", monospace',
                    fontWeight: 800, letterSpacing: '0.2em',
                    color: 'rgba(255,68,68,0.3)',
                  }}
                >
                  ▬▬ CLASSIFIED · FOR AUTHORIZED PERSONNEL ONLY ▬▬
                </motion.div>
                <div style={{
                  height: 1, margin: '12px auto', maxWidth: 500,
                  background: 'rgba(255,68,68,0.06)',
                }} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', maxWidth: 500, margin: '0 auto',
                  fontSize: 9, fontFamily: '"SF Mono", monospace', color: 'rgba(255,255,255,0.12)',
                }}>
                  <span>{reportId}</span>
                  <span>{dateStr} · {timeStr}</span>
                </div>
              </div>

              {/* Title */}
              <div style={{ padding: '32px 20px 0', textAlign: 'center' }}>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                    fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                    margin: 0, letterSpacing: '-0.02em',
                  }}
                >
                  READINESS REPORT
                </motion.h1>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.2)',
                  fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                  marginTop: 6,
                }}>
                  Biological Operating System · Real-Time Assessment
                </div>
              </div>

              {/* Hero Score */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', damping: 20 }}
                style={{ padding: '40px 20px', textAlign: 'center' }}
              >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  {/* Glow */}
                  <div style={{
                    position: 'absolute', inset: -40,
                    background: `radial-gradient(circle, ${hexToRgba(scoreColor, 0.08)} 0%, transparent 70%)`,
                    borderRadius: '50%',
                  }} />

                  {/* Ring */}
                  <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'relative' }}>
                    <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                    <circle
                      cx="100" cy="100" r="88" fill="none"
                      stroke={scoreColor} strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${(score / 100) * 553} 553`}
                      transform="rotate(-90 100 100)"
                      style={{ filter: `drop-shadow(0 0 8px ${hexToRgba(scoreColor, 0.3)})` }}
                    />
                    {/* Tick marks */}
                    {Array.from({ length: 60 }).map((_, i) => {
                      const angle = (i / 60) * 360 - 90
                      const rad = (angle * Math.PI) / 180
                      const inner = i % 5 === 0 ? 74 : 80
                      return (
                        <line
                          key={i}
                          x1={100 + Math.cos(rad) * inner}
                          y1={100 + Math.sin(rad) * inner}
                          x2={100 + Math.cos(rad) * 86}
                          y2={100 + Math.sin(rad) * 86}
                          stroke="rgba(255,255,255,0.04)"
                          strokeWidth="0.5"
                        />
                      )
                    })}
                  </svg>

                  {/* Score text */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      fontSize: 72, fontWeight: 100, color: '#FFFFFF',
                      fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                      lineHeight: 1,
                    }}>
                      {score}
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: '"SF Mono", monospace',
                      fontWeight: 700, color: scoreColor,
                      letterSpacing: '0.15em', marginTop: 4,
                    }}>
                      LONGEVITY SCORE
                    </div>
                  </div>
                </div>

                {/* Trend */}
                <div style={{
                  marginTop: 12,
                  fontSize: 10, fontFamily: '"SF Mono", monospace',
                  fontWeight: 700, letterSpacing: '0.1em',
                  color: longevityScore?.trend === 'improving' ? '#00DC82' : longevityScore?.trend === 'declining' ? '#FF6B6B' : '#F59E0B',
                }}>
                  {longevityScore?.trend === 'improving' ? '▲ IMPROVING' : longevityScore?.trend === 'declining' ? '▼ DECLINING' : '● STABLE'}
                </div>
              </motion.div>

              {/* Subsystem Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                style={{ padding: '0 16px' }}
              >
                <div style={{
                  height: 1, background: 'rgba(255,255,255,0.04)',
                  margin: '0 4px 16px',
                }} />
                <div style={{
                  fontSize: 9, fontFamily: '"SF Mono", monospace',
                  fontWeight: 600, color: 'rgba(255,255,255,0.15)',
                  letterSpacing: '0.15em', padding: '0 4px', marginBottom: 12,
                }}>
                  SUBSYSTEM ANALYSIS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { key: 'autonomic' as const, icon: '🧠', label: 'AUTONOMIC' },
                    { key: 'recovery' as const, icon: '💤', label: 'RECOVERY' },
                    { key: 'adherence' as const, icon: '🎯', label: 'ADHERENCE' },
                    { key: 'integrity' as const, icon: '🛡️', label: 'INTEGRITY' },
                  ].map((sub) => {
                    const val = longevityScore?.breakdown[sub.key] ?? 0
                    const thermal = scoreToThermal(val * 4)
                    const color = THERMAL_HEX[thermal]
                    return (
                      <div key={sub.key} style={{
                        background: hexToRgba(color, 0.04),
                        border: `1px solid ${hexToRgba(color, 0.08)}`,
                        borderRadius: 12, padding: '14px 0',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{sub.icon}</div>
                        <div style={{
                          fontSize: 22, fontWeight: 800, color,
                          fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                        }}>
                          {val}
                        </div>
                        <div style={{
                          fontSize: 7, fontFamily: '"SF Mono", monospace',
                          fontWeight: 600, color: 'rgba(255,255,255,0.25)',
                          letterSpacing: '0.1em', marginTop: 2,
                        }}>
                          {sub.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Somatic Body Map */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{ padding: '24px 16px 0' }}
              >
                <div style={{
                  height: 1, background: 'rgba(255,255,255,0.04)',
                  margin: '0 4px 16px',
                }} />
                <div style={{
                  fontSize: 9, fontFamily: '"SF Mono", monospace',
                  fontWeight: 600, color: 'rgba(255,255,255,0.15)',
                  letterSpacing: '0.15em', padding: '0 4px', marginBottom: 4,
                }}>
                  SOMATIC BODY MAP · THERMAL STATE
                </div>

                {/* Overall badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 4px 16px',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '5px 14px', borderRadius: 20,
                    background: hexToRgba(THERMAL_HEX[bioIdentity?.overallThermal as ThermalState] || '#3B82F6', 0.08),
                    border: `1px solid ${hexToRgba(THERMAL_HEX[bioIdentity?.overallThermal as ThermalState] || '#3B82F6', 0.15)}`,
                  }}>
                    <span style={{
                      fontSize: 10, fontFamily: '"SF Mono", monospace',
                      fontWeight: 700, color: THERMAL_HEX[bioIdentity?.overallThermal as ThermalState] || '#3B82F6',
                    }}>
                      {THERMAL_LABEL[bioIdentity?.overallThermal as ThermalState] || 'N/A'} · {bioIdentity?.overallScore ?? 0}
                    </span>
                  </div>

                  {bioIdentity?.ageDelta != null && (
                    <div style={{
                      fontSize: 10, fontFamily: '"SF Mono", monospace',
                      fontWeight: 700,
                      color: (bioIdentity.ageDelta ?? 0) < 0 ? '#00FFCC' : '#E8976C',
                    }}>
                      BIO-AGE {bioIdentity.biologicalAge?.toFixed(1)} · {(bioIdentity.ageDelta ?? 0) < 0 ? '' : '+'}{bioIdentity.ageDelta?.toFixed(1)}yr
                    </div>
                  )}
                </div>

                {/* System rows */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {systems.slice(0, 8).map((sys: any, i: number) => {
                    const color = THERMAL_HEX[sys.thermal as ThermalState] || '#3B82F6'
                    return (
                      <motion.div
                        key={sys.system}
                        initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + i * 0.05 }}
                        style={{
                          background: hexToRgba(color, 0.03),
                          border: `1px solid ${hexToRgba(color, 0.06)}`,
                          borderRadius: 10, padding: '10px 12px',
                          display: 'flex', alignItems: 'center', gap: 10,
                          position: 'relative', overflow: 'hidden',
                        }}
                      >
                        {/* Left accent */}
                        <div style={{
                          position: 'absolute', left: 0, top: 6, bottom: 6,
                          width: 3, borderRadius: 2, background: color,
                        }} />

                        <div style={{ fontSize: 16, marginLeft: 4 }}>{sys.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                            fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                          }}>
                            {sys.label}
                          </div>
                          <div style={{
                            fontSize: 8, fontFamily: '"SF Mono", monospace',
                            fontWeight: 500, color: hexToRgba(color, 0.7),
                            marginTop: 1,
                          }}>
                            {THERMAL_LABEL[sys.thermal as ThermalState] || 'N/A'}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 18, fontWeight: 800, color,
                          fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                        }}>
                          {sys.score}
                        </div>
                        <div style={{
                          fontSize: 10, fontFamily: '"SF Mono", monospace', fontWeight: 700,
                          color: sys.trend === 'improving' ? '#00DC82' : sys.trend === 'declining' ? '#FF6B6B' : 'rgba(255,255,255,0.15)',
                        }}>
                          {sys.trend === 'improving' ? '↑' : sys.trend === 'declining' ? '↓' : '→'}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Data Completeness */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                style={{ padding: '24px 20px 0' }}
              >
                <div style={{
                  height: 1, background: 'rgba(255,255,255,0.04)',
                  marginBottom: 16,
                }} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 8,
                }}>
                  <span style={{
                    fontSize: 8, fontFamily: '"SF Mono", monospace',
                    fontWeight: 600, color: 'rgba(255,255,255,0.12)',
                    letterSpacing: '0.15em',
                  }}>
                    DATA COMPLETENESS
                  </span>
                  <span style={{
                    fontSize: 9, fontFamily: '"SF Mono", monospace',
                    fontWeight: 700, color: 'rgba(59,130,246,0.5)',
                  }}>
                    {longevityScore?.dataCompleteness ?? 0}%
                  </span>
                </div>
                <div style={{
                  height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,0.03)',
                  overflow: 'hidden',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${longevityScore?.dataCompleteness ?? 0}%` }}
                    transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: 2,
                      background: 'linear-gradient(90deg, rgba(59,130,246,0.4), rgba(0,255,204,0.5))',
                    }}
                  />
                </div>
              </motion.div>

              {/* Summary */}
              {longevityScore?.summaryLine && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  style={{
                    padding: '24px 32px 0', textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.25)',
                    fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                    lineHeight: 1.6, maxWidth: 400, margin: '0 auto',
                  }}>
                    "{longevityScore.summaryLine}"
                  </div>
                </motion.div>
              )}

              {/* Footer classification */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                style={{ padding: '32px 20px 0', textAlign: 'center' }}
              >
                <div style={{
                  height: 1, background: 'rgba(255,68,68,0.06)',
                  maxWidth: 500, margin: '0 auto 16px',
                }} />
                <div style={{
                  fontSize: 10, fontFamily: '"SF Mono", monospace',
                  fontWeight: 700, color: 'rgba(0,255,204,0.2)',
                  letterSpacing: '0.1em',
                }}>
                  VIVE 4.0 · BIOLOGICAL OPERATING SYSTEM
                </div>
                <div style={{
                  fontSize: 8, fontFamily: '"SF Mono", monospace',
                  fontWeight: 700, color: 'rgba(255,68,68,0.15)',
                  letterSpacing: '0.15em', marginTop: 8,
                }}>
                  ▬▬ END OF CLASSIFIED REPORT ▬▬
                </div>
              </motion.div>

              {/* ── Bottom Action Bar ── */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99998,
                  padding: '12px 16px',
                  paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                  background: 'linear-gradient(0deg, rgba(2,2,4,0.98) 0%, rgba(2,2,4,0.9) 70%, transparent 100%)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex', gap: 8,
                }}
              >
                {/* Share to Command — primary */}
                <motion.button
                  onClick={handleShareToCommand}
                  disabled={sharing}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 2, padding: '14px 0',
                    background: 'linear-gradient(135deg, rgba(0,255,204,0.1), rgba(59,130,246,0.08))',
                    border: '1px solid rgba(0,255,204,0.2)',
                    borderRadius: 14, cursor: 'pointer',
                    color: '#00FFCC', fontSize: 12, fontWeight: 700,
                    fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                    letterSpacing: '0.05em',
                    opacity: sharing ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {sharing ? '⏳ SHARING…' : '↗ SHARE TO COMMAND'}
                </motion.button>

                {/* Download */}
                <motion.button
                  onClick={handleDownload}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1, padding: '14px 0',
                    background: 'rgba(59,130,246,0.06)',
                    border: `1px solid ${downloaded ? 'rgba(0,220,130,0.2)' : 'rgba(59,130,246,0.12)'}`,
                    borderRadius: 14, cursor: 'pointer',
                    color: downloaded ? '#00DC82' : '#3B82F6',
                    fontSize: 11, fontWeight: 700,
                    fontFamily: '"SF Mono", monospace',
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s',
                  }}
                >
                  {downloaded ? '✓ SAVED' : '⬇ PNG'}
                </motion.button>

                {/* Copy caption */}
                <motion.button
                  onClick={handleCopyCaption}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1, padding: '14px 0',
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${captionCopied ? 'rgba(0,220,130,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, cursor: 'pointer',
                    color: captionCopied ? '#00DC82' : 'rgba(255,255,255,0.3)',
                    fontSize: 11, fontWeight: 700,
                    fontFamily: '"SF Mono", monospace',
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s',
                  }}
                >
                  {captionCopied ? '✓' : '📋'}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
