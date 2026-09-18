import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   SYSTEM READINESS SHARE — "Super-Soldier" Bio-Readout Graphic
   
   Generates a premium, black-site style shareable graphic:
   • Full body silhouette with thermal zone mapping
   • LongevityScore (composite + 4 subsystem breakdown)
   • SomaticBodyMap thermal state (8 body systems)
   • "Vive 4.0: [User Name] Bio-Identity Status" branding
   • Confidential classification aesthetic
   
   Output: 1080×1920 (Instagram Stories) or 1200×675 (X/Twitter)
   One-tap share via Web Share API with download fallback.
   ═══════════════════════════════════════════════════════════════ */

type ShareFormat = 'story' | 'twitter'
type ThermalState = 'cold' | 'cool' | 'neutral' | 'warm' | 'hot' | 'critical'

const THERMAL_HEX: Record<ThermalState, string> = {
  cold: '#3B82F6',
  cool: '#06B6D4',
  neutral: '#00DC82',
  warm: '#F59E0B',
  hot: '#F97316',
  critical: '#EF4444',
}

const THERMAL_LABEL: Record<ThermalState, string> = {
  cold: 'OPTIMAL',
  cool: 'GOOD',
  neutral: 'BASELINE',
  warm: 'ELEVATED',
  hot: 'WARNING',
  critical: 'CRITICAL',
}

const SUBSYSTEM_LABELS: Record<string, string> = {
  autonomic: 'AUTONOMIC',
  recovery: 'RECOVERY',
  adherence: 'ADHERENCE',
  integrity: 'INTEGRITY',
}

/* ── Canvas helpers ── */
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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function scoreToThermal(score: number): ThermalState {
  if (score >= 90) return 'cold'
  if (score >= 75) return 'cool'
  if (score >= 60) return 'neutral'
  if (score >= 40) return 'warm'
  if (score >= 20) return 'hot'
  return 'critical'
}

/* ── Body silhouette path data (simplified anatomical outline) ── */
function drawBodySilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  systems: Array<{ system: string; thermal: string; score: number }>
) {
  const s = scale

  // Build thermal map from systems
  const thermalMap: Record<string, { color: string; score: number }> = {}
  systems.forEach(sys => {
    thermalMap[sys.system] = {
      color: THERMAL_HEX[sys.thermal as ThermalState] || '#3B82F6',
      score: sys.score,
    }
  })

  const getColor = (system: string, fallback: string = '#3B82F6') =>
    thermalMap[system]?.color || fallback

  // ── Head (nervous system) ──
  const headColor = getColor('nervous')
  const headGrad = ctx.createRadialGradient(cx, cy - 170 * s, 0, cx, cy - 170 * s, 38 * s)
  headGrad.addColorStop(0, hexToRgba(headColor, 0.5))
  headGrad.addColorStop(0.6, hexToRgba(headColor, 0.2))
  headGrad.addColorStop(1, hexToRgba(headColor, 0.03))
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.ellipse(cx, cy - 170 * s, 30 * s, 36 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head outline
  ctx.strokeStyle = hexToRgba(headColor, 0.6)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(cx, cy - 170 * s, 30 * s, 36 * s, 0, 0, Math.PI * 2)
  ctx.stroke()

  // ── Neck ──
  ctx.fillStyle = hexToRgba('#3B82F6', 0.08)
  ctx.fillRect(cx - 10 * s, cy - 134 * s, 20 * s, 18 * s)

  // ── Torso (cardiovascular + metabolic + digestive) ──
  const torsoColor = getColor('cardiovascular')
  const metaColor = getColor('metabolic')
  const digestColor = getColor('digestive')

  // Upper torso — cardiovascular
  const upperGrad = ctx.createLinearGradient(cx, cy - 116 * s, cx, cy - 30 * s)
  upperGrad.addColorStop(0, hexToRgba(torsoColor, 0.35))
  upperGrad.addColorStop(0.5, hexToRgba(metaColor, 0.2))
  upperGrad.addColorStop(1, hexToRgba(digestColor, 0.15))
  ctx.fillStyle = upperGrad

  ctx.beginPath()
  ctx.moveTo(cx - 52 * s, cy - 116 * s)
  // Shoulders
  ctx.quadraticCurveTo(cx - 60 * s, cy - 110 * s, cx - 62 * s, cy - 90 * s)
  // Left side
  ctx.lineTo(cx - 48 * s, cy + 20 * s)
  // Waist
  ctx.quadraticCurveTo(cx - 42 * s, cy + 40 * s, cx - 36 * s, cy + 50 * s)
  // Hip
  ctx.lineTo(cx + 36 * s, cy + 50 * s)
  ctx.quadraticCurveTo(cx + 42 * s, cy + 40 * s, cx + 48 * s, cy + 20 * s)
  // Right side
  ctx.lineTo(cx + 62 * s, cy - 90 * s)
  ctx.quadraticCurveTo(cx + 60 * s, cy - 110 * s, cx + 52 * s, cy - 116 * s)
  ctx.closePath()
  ctx.fill()

  // Torso outline
  ctx.strokeStyle = hexToRgba(torsoColor, 0.4)
  ctx.lineWidth = 1.2
  ctx.stroke()

  // Heart glow (cardiovascular center)
  const heartGrad = ctx.createRadialGradient(cx - 8 * s, cy - 80 * s, 0, cx - 8 * s, cy - 80 * s, 28 * s)
  heartGrad.addColorStop(0, hexToRgba(torsoColor, 0.4))
  heartGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = heartGrad
  ctx.beginPath()
  ctx.arc(cx - 8 * s, cy - 80 * s, 28 * s, 0, Math.PI * 2)
  ctx.fill()

  // Gut glow (digestive)
  const gutGrad = ctx.createRadialGradient(cx, cy + 10 * s, 0, cx, cy + 10 * s, 24 * s)
  gutGrad.addColorStop(0, hexToRgba(digestColor, 0.3))
  gutGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = gutGrad
  ctx.beginPath()
  ctx.arc(cx, cy + 10 * s, 24 * s, 0, Math.PI * 2)
  ctx.fill()

  // ── Arms (musculoskeletal) ──
  const muscleColor = getColor('musculoskeletal')

  // Left arm
  ctx.strokeStyle = hexToRgba(muscleColor, 0.4)
  ctx.lineWidth = 14 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 62 * s, cy - 90 * s)
  ctx.quadraticCurveTo(cx - 78 * s, cy - 40 * s, cx - 72 * s, cy + 10 * s)
  ctx.quadraticCurveTo(cx - 68 * s, cy + 40 * s, cx - 60 * s, cy + 60 * s)
  ctx.stroke()

  // Right arm
  ctx.beginPath()
  ctx.moveTo(cx + 62 * s, cy - 90 * s)
  ctx.quadraticCurveTo(cx + 78 * s, cy - 40 * s, cx + 72 * s, cy + 10 * s)
  ctx.quadraticCurveTo(cx + 68 * s, cy + 40 * s, cx + 60 * s, cy + 60 * s)
  ctx.stroke()

  // Arm glow
  const armGlowL = ctx.createRadialGradient(cx - 70 * s, cy - 20 * s, 0, cx - 70 * s, cy - 20 * s, 30 * s)
  armGlowL.addColorStop(0, hexToRgba(muscleColor, 0.15))
  armGlowL.addColorStop(1, 'transparent')
  ctx.fillStyle = armGlowL
  ctx.beginPath()
  ctx.arc(cx - 70 * s, cy - 20 * s, 30 * s, 0, Math.PI * 2)
  ctx.fill()

  const armGlowR = ctx.createRadialGradient(cx + 70 * s, cy - 20 * s, 0, cx + 70 * s, cy - 20 * s, 30 * s)
  armGlowR.addColorStop(0, hexToRgba(muscleColor, 0.15))
  armGlowR.addColorStop(1, 'transparent')
  ctx.fillStyle = armGlowR
  ctx.beginPath()
  ctx.arc(cx + 70 * s, cy - 20 * s, 30 * s, 0, Math.PI * 2)
  ctx.fill()

  // ── Legs (musculoskeletal lower) ──
  ctx.strokeStyle = hexToRgba(muscleColor, 0.3)
  ctx.lineWidth = 16 * s
  ctx.lineCap = 'round'

  // Left leg
  ctx.beginPath()
  ctx.moveTo(cx - 22 * s, cy + 50 * s)
  ctx.quadraticCurveTo(cx - 28 * s, cy + 100 * s, cx - 26 * s, cy + 150 * s)
  ctx.lineTo(cx - 24 * s, cy + 200 * s)
  ctx.stroke()

  // Right leg
  ctx.beginPath()
  ctx.moveTo(cx + 22 * s, cy + 50 * s)
  ctx.quadraticCurveTo(cx + 28 * s, cy + 100 * s, cx + 26 * s, cy + 150 * s)
  ctx.lineTo(cx + 24 * s, cy + 200 * s)
  ctx.stroke()

  ctx.lineCap = 'butt'

  // ── Immune shield glow (chest area) ──
  const immuneColor = getColor('immune')
  const immuneGrad = ctx.createRadialGradient(cx + 12 * s, cy - 70 * s, 0, cx + 12 * s, cy - 70 * s, 22 * s)
  immuneGrad.addColorStop(0, hexToRgba(immuneColor, 0.2))
  immuneGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = immuneGrad
  ctx.beginPath()
  ctx.arc(cx + 12 * s, cy - 70 * s, 22 * s, 0, Math.PI * 2)
  ctx.fill()

  // ── Respiratory glow (lung area) ──
  const respColor = getColor('respiratory')
  const respGradL = ctx.createRadialGradient(cx - 24 * s, cy - 85 * s, 0, cx - 24 * s, cy - 85 * s, 18 * s)
  respGradL.addColorStop(0, hexToRgba(respColor, 0.15))
  respGradL.addColorStop(1, 'transparent')
  ctx.fillStyle = respGradL
  ctx.beginPath()
  ctx.arc(cx - 24 * s, cy - 85 * s, 18 * s, 0, Math.PI * 2)
  ctx.fill()

  const respGradR = ctx.createRadialGradient(cx + 24 * s, cy - 85 * s, 0, cx + 24 * s, cy - 85 * s, 18 * s)
  respGradR.addColorStop(0, hexToRgba(respColor, 0.15))
  respGradR.addColorStop(1, 'transparent')
  ctx.fillStyle = respGradR
  ctx.beginPath()
  ctx.arc(cx + 24 * s, cy - 85 * s, 18 * s, 0, Math.PI * 2)
  ctx.fill()

  // ── Endocrine glow (lower abdomen) ──
  const endoColor = getColor('endocrine')
  const endoGrad = ctx.createRadialGradient(cx, cy + 30 * s, 0, cx, cy + 30 * s, 20 * s)
  endoGrad.addColorStop(0, hexToRgba(endoColor, 0.2))
  endoGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = endoGrad
  ctx.beginPath()
  ctx.arc(cx, cy + 30 * s, 20 * s, 0, Math.PI * 2)
  ctx.fill()

  // ── Pulse rings on critical/warning systems ──
  systems.forEach(sys => {
    if (sys.thermal === 'hot' || sys.thermal === 'critical' || sys.thermal === 'warm') {
      const color = THERMAL_HEX[sys.thermal as ThermalState]
      let px = cx, py = cy
      const r = 20 * s

      switch (sys.system) {
        case 'nervous': px = cx; py = cy - 170 * s; break
        case 'cardiovascular': px = cx - 8 * s; py = cy - 80 * s; break
        case 'metabolic': px = cx + 8 * s; py = cy - 40 * s; break
        case 'endocrine': px = cx; py = cy + 30 * s; break
        case 'immune': px = cx + 12 * s; py = cy - 70 * s; break
        case 'musculoskeletal': px = cx - 70 * s; py = cy - 20 * s; break
        case 'digestive': px = cx; py = cy + 10 * s; break
        case 'respiratory': px = cx; py = cy - 85 * s; break
      }

      // Outer pulse ring
      ctx.strokeStyle = hexToRgba(color, 0.15)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(px, py, r * 1.6, 0, Math.PI * 2)
      ctx.stroke()

      // Inner pulse ring
      ctx.strokeStyle = hexToRgba(color, 0.25)
      ctx.beginPath()
      ctx.arc(px, py, r * 1.1, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
}

/* ── Corner brackets for classified look ── */
function drawCornerBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'square'

  // Top-left
  ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y); ctx.stroke()
  // Top-right
  ctx.beginPath(); ctx.moveTo(x + w - size, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + size); ctx.stroke()
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(x, y + h - size); ctx.lineTo(x, y + h); ctx.lineTo(x + size, y + h); ctx.stroke()
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(x + w - size, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - size); ctx.stroke()

  ctx.lineCap = 'butt'
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CANVAS RENDERER — Super-Soldier Bio-Readout
   ═══════════════════════════════════════════════════════════════ */
function renderShareGraphic(
  canvas: HTMLCanvasElement,
  format: ShareFormat,
  userName: string,
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
      system: string
      label: string
      score: number
      thermal: ThermalState
      icon: string
      trend: string
    }>
  }
) {
  const W = format === 'story' ? 1080 : 1200
  const H = format === 'story' ? 1920 : 675
  const dpr = 2
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const PAD = format === 'story' ? 56 : 48
  const CW = W - PAD * 2
  const scoreColor = THERMAL_HEX[scoreToThermal(longevity.score)]

  /* ── Deep black background ── */
  ctx.fillStyle = '#020204'
  ctx.fillRect(0, 0, W, H)

  /* ── Ambient glow field ── */
  const g1 = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, W * 0.8)
  g1.addColorStop(0, hexToRgba(scoreColor, 0.05))
  g1.addColorStop(0.5, hexToRgba('#3B82F6', 0.015))
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)

  const g2 = ctx.createRadialGradient(W * 0.7, H * 0.65, 0, W * 0.7, H * 0.65, W * 0.6)
  g2.addColorStop(0, hexToRgba('#00FFCC', 0.02))
  g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)

  /* ── Micro grid texture ── */
  ctx.fillStyle = 'rgba(255,255,255,0.006)'
  for (let gy = 0; gy < H; gy += 40) {
    for (let gx = 0; gx < W; gx += 40) {
      ctx.beginPath()
      ctx.arc(gx, gy, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /* ── Scan lines ── */
  ctx.fillStyle = 'rgba(255,255,255,0.004)'
  for (let sy = 0; sy < H; sy += 3) {
    ctx.fillRect(0, sy, W, 1)
  }

  /* ── Corner brackets ── */
  drawCornerBrackets(ctx, PAD - 16, 36, CW + 32, H - 72, 24, 'rgba(255,255,255,0.06)')

  let Y = format === 'story' ? 64 : 36

  /* ══════════════════════════════════════════════════
     HEADER — Classification bar
     ══════════════════════════════════════════════════ */
  const reportId = `BIO-${Date.now().toString(36).toUpperCase().slice(-8)}`
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  // Red classification bar
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(239,68,68,0.08)'
  roundRect(ctx, PAD, Y, CW, format === 'story' ? 28 : 22, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(239,68,68,0.15)'
  ctx.lineWidth = 0.5
  ctx.stroke()

  ctx.fillStyle = 'rgba(239,68,68,0.5)'
  ctx.font = `700 ${format === 'story' ? 9 : 7}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.letterSpacing = '0.2em'
  ctx.fillText(`CLASSIFIED · ${reportId} · FOR AUTHORIZED PERSONNEL ONLY`, W / 2, Y + (format === 'story' ? 18 : 15))

  Y += format === 'story' ? 48 : 32

  /* ══════════════════════════════════════════════════
     TITLE — VIVE 4.0: [USER NAME] BIO-IDENTITY STATUS
     ══════════════════════════════════════════════════ */
  ctx.textAlign = 'left'

  // "VIVE 4.0" in accent
  ctx.fillStyle = hexToRgba('#00FFCC', 0.6)
  ctx.font = `800 ${format === 'story' ? 13 : 10}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.fillText('VIVE 4.0', PAD, Y)

  Y += format === 'story' ? 28 : 18

  // User name + Bio-Identity Status
  const displayName = userName || 'OPERATOR'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `800 ${format === 'story' ? 36 : 24}px "SF Pro Display", "Inter", system-ui, sans-serif`
  ctx.fillText(displayName.toUpperCase(), PAD, Y)

  Y += format === 'story' ? 24 : 16
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = `500 ${format === 'story' ? 11 : 9}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.fillText(`BIO-IDENTITY STATUS · ${dateStr.toUpperCase()} · ${timeStr}`, PAD, Y)

  Y += format === 'story' ? 20 : 12

  // Thin rule
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()

  Y += format === 'story' ? 32 : 20

  if (format === 'story') {
    /* ══════════════════════════════════════════════════
       STORY FORMAT — Full body silhouette + score ring side by side
       ══════════════════════════════════════════════════ */

    /* ── Hero Score Ring (left side) ── */
    const ringCX = PAD + 120
    const ringCY = Y + 110
    const ringR = 80

    // Outer track
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2)
    ctx.stroke()

    // Score arc
    const arcAngle = (longevity.score / 100) * Math.PI * 2
    ctx.strokeStyle = hexToRgba(scoreColor, 0.7)
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + arcAngle)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // Tick marks
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2
      const isMajor = i % 15 === 0
      const innerR = ringR - (isMajor ? 10 : 6)
      const outerR = ringR - 2
      ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'
      ctx.lineWidth = isMajor ? 1.5 : 0.5
      ctx.beginPath()
      ctx.moveTo(ringCX + Math.cos(angle) * innerR, ringCY + Math.sin(angle) * innerR)
      ctx.lineTo(ringCX + Math.cos(angle) * outerR, ringCY + Math.sin(angle) * outerR)
      ctx.stroke()
    }

    // Glow
    const scoreGlow = ctx.createRadialGradient(ringCX, ringCY, 0, ringCX, ringCY, ringR * 1.3)
    scoreGlow.addColorStop(0, hexToRgba(scoreColor, 0.06))
    scoreGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = scoreGlow
    ctx.beginPath()
    ctx.arc(ringCX, ringCY, ringR * 1.3, 0, Math.PI * 2)
    ctx.fill()

    // Score number
    ctx.textAlign = 'center'
    ctx.fillStyle = scoreColor
    ctx.font = `900 72px "SF Pro Display", "Inter", system-ui, sans-serif`
    ctx.fillText(String(longevity.score), ringCX, ringCY + 24)

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `600 9px "SF Mono", "Fira Code", "Courier New", monospace`
    ctx.fillText('LONGEVITY', ringCX, ringCY + 44)
    ctx.fillText('SCORE', ringCX, ringCY + 56)

    // Trend
    const trendLabel = longevity.trend === 'improving' ? '▲ IMPROVING' : longevity.trend === 'declining' ? '▼ DECLINING' : '● STABLE'
    const trendColor = longevity.trend === 'improving' ? '#00DC82' : longevity.trend === 'declining' ? '#FF6B6B' : '#F59E0B'
    ctx.fillStyle = trendColor
    ctx.font = `700 8px "SF Mono", "Fira Code", "Courier New", monospace`
    ctx.fillText(trendLabel, ringCX, ringCY + 74)

    /* ── Subsystem mini-bars (right of ring) ── */
    const barX = PAD + 260
    const barW = CW - 260
    const barStartY = Y + 30
    const subsystems = ['autonomic', 'recovery', 'adherence', 'integrity'] as const

    subsystems.forEach((key, i) => {
      const by = barStartY + i * 48
      const val = longevity.breakdown[key]
      const thermal = scoreToThermal(val * 4)
      const color = THERMAL_HEX[thermal]

      // Label
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = `600 8px "SF Mono", "Fira Code", "Courier New", monospace`
      ctx.fillText(SUBSYSTEM_LABELS[key], barX, by)

      // Score
      ctx.textAlign = 'right'
      ctx.fillStyle = color
      ctx.font = `800 14px "SF Pro Display", "Inter", system-ui, sans-serif`
      ctx.fillText(`${val}/25`, barX + barW, by)

      // Bar track
      const trackY = by + 8
      roundRect(ctx, barX, trackY, barW, 6, 3)
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fill()

      // Bar fill
      const fillW = (val / 25) * barW
      if (fillW > 0) {
        roundRect(ctx, barX, trackY, fillW, 6, 3)
        const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0)
        barGrad.addColorStop(0, hexToRgba(color, 0.5))
        barGrad.addColorStop(1, hexToRgba(color, 0.25))
        ctx.fillStyle = barGrad
        ctx.fill()
      }
    })

    Y += 240

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
    Y += 24

    // Section label
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `600 9px "SF Mono", "Fira Code", "Courier New", monospace`
    ctx.fillText('SOMATIC BODY MAP · THERMAL ANALYSIS', PAD, Y)
    Y += 28

    /* ══════════════════════════════════════════════════
       BODY SILHOUETTE — Center of the graphic
       ══════════════════════════════════════════════════ */
    const bodyCX = W / 2
    const bodyCY = Y + 260
    const bodyScale = 2.2

    drawBodySilhouette(ctx, bodyCX, bodyCY, bodyScale, bioIdentity.systems)

    // System labels pointing to body parts
    const labelPositions: Array<{ system: string; label: string; x: number; y: number; side: 'left' | 'right' }> = [
      { system: 'nervous', label: 'NEURAL', x: bodyCX + 100, y: bodyCY - 370, side: 'right' },
      { system: 'cardiovascular', label: 'CARDIO', x: bodyCX - 160, y: bodyCY - 180, side: 'left' },
      { system: 'respiratory', label: 'RESP', x: bodyCX + 140, y: bodyCY - 190, side: 'right' },
      { system: 'immune', label: 'IMMUNE', x: bodyCX + 160, y: bodyCY - 140, side: 'right' },
      { system: 'metabolic', label: 'METAB', x: bodyCX - 170, y: bodyCY - 80, side: 'left' },
      { system: 'endocrine', label: 'ENDO', x: bodyCX - 150, y: bodyCY + 60, side: 'left' },
      { system: 'digestive', label: 'DIGEST', x: bodyCX + 150, y: bodyCY + 20, side: 'right' },
      { system: 'musculoskeletal', label: 'MUSCULO', x: bodyCX + 180, y: bodyCY - 40, side: 'right' },
    ]

    labelPositions.forEach(lp => {
      const sys = bioIdentity.systems.find(s => s.system === lp.system)
      if (!sys) return
      const color = THERMAL_HEX[sys.thermal as ThermalState] || '#3B82F6'
      const thermalLabel = THERMAL_LABEL[sys.thermal as ThermalState] || 'N/A'

      // Connector dot
      ctx.fillStyle = hexToRgba(color, 0.6)
      ctx.beginPath()
      ctx.arc(lp.x + (lp.side === 'left' ? 60 : -60), lp.y + 4, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // Connector line
      ctx.strokeStyle = hexToRgba(color, 0.15)
      ctx.lineWidth = 0.5
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(lp.x + (lp.side === 'left' ? 60 : -60), lp.y + 4)

      // Find body part center
      let bpx = bodyCX, bpy = bodyCY
      switch (lp.system) {
        case 'nervous': bpx = bodyCX; bpy = bodyCY - 170 * bodyScale; break
        case 'cardiovascular': bpx = bodyCX - 8 * bodyScale; bpy = bodyCY - 80 * bodyScale; break
        case 'respiratory': bpx = bodyCX; bpy = bodyCY - 85 * bodyScale; break
        case 'immune': bpx = bodyCX + 12 * bodyScale; bpy = bodyCY - 70 * bodyScale; break
        case 'metabolic': bpx = bodyCX + 8 * bodyScale; bpy = bodyCY - 40 * bodyScale; break
        case 'endocrine': bpx = bodyCX; bpy = bodyCY + 30 * bodyScale; break
        case 'digestive': bpx = bodyCX; bpy = bodyCY + 10 * bodyScale; break
        case 'musculoskeletal': bpx = bodyCX + 70 * bodyScale; bpy = bodyCY - 20 * bodyScale; break
      }
      ctx.lineTo(bpx, bpy)
      ctx.stroke()
      ctx.setLineDash([])

      // Label card
      ctx.textAlign = lp.side === 'left' ? 'left' : 'right'
      const tx = lp.side === 'left' ? lp.x : lp.x

      // System name
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `700 9px "SF Mono", "Fira Code", "Courier New", monospace`
      ctx.fillText(lp.label, tx, lp.y)

      // Score + thermal
      ctx.fillStyle = color
      ctx.font = `800 13px "SF Pro Display", "Inter", system-ui, sans-serif`
      ctx.fillText(`${sys.score}`, tx, lp.y + 16)

      ctx.fillStyle = hexToRgba(color, 0.5)
      ctx.font = `600 7px "SF Mono", "Fira Code", "Courier New", monospace`
      ctx.fillText(thermalLabel, tx, lp.y + 28)
    })

    Y = bodyCY + 260

    // Overall thermal badge
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(PAD, Y); ctx.lineTo(W - PAD, Y); ctx.stroke()
    Y += 24

    const overallColor = THERMAL_HEX[bioIdentity.overallThermal]
    const badgeW = 200
    const badgeH = 32
    const badgeCX = W / 2

    roundRect(ctx, badgeCX - badgeW / 2, Y, badgeW, badgeH, badgeH / 2)
    ctx.fillStyle = hexToRgba(overallColor, 0.08)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(overallColor, 0.25)
    ctx.lineWidth = 0.5
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = overallColor
    ctx.font = `700 11px "SF Mono", "Fira Code", "Courier New", monospace`
    ctx.fillText(`OVERALL: ${THERMAL_LABEL[bioIdentity.overallThermal]} · ${bioIdentity.overallScore}/100`, badgeCX, Y + 21)

    Y += badgeH + 16

    // Bio age delta
    if (bioIdentity.ageDelta != null && bioIdentity.biologicalAge != null) {
      const deltaColor = bioIdentity.ageDelta < 0 ? '#00DC82' : bioIdentity.ageDelta > 0 ? '#FF6B6B' : '#F59E0B'
      const sign = bioIdentity.ageDelta < 0 ? '' : '+'

      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = `500 9px "SF Mono", "Fira Code", "Courier New", monospace`
      ctx.fillText('BIOLOGICAL AGE', W / 2, Y)

      Y += 22
      ctx.fillStyle = deltaColor
      ctx.font = `900 32px "SF Pro Display", "Inter", system-ui, sans-serif`
      ctx.fillText(`${bioIdentity.biologicalAge}`, W / 2, Y)

      Y += 16
      ctx.fillStyle = hexToRgba(deltaColor, 0.6)
      ctx.font = `700 10px "SF Mono", "Fira Code", "Courier New", monospace`
      ctx.fillText(`${sign}${bioIdentity.ageDelta.toFixed(1)} YEARS VS CHRONOLOGICAL`, W / 2, Y)

      Y += 28
    }

    // Data completeness
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `600 8px "SF Mono", "Fira Code", "Courier New", monospace`
    ctx.fillText('DATA COMPLETENESS', PAD, Y)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillText(`${longevity.dataCompleteness}%`, W - PAD, Y)
    Y += 10

    roundRect(ctx, PAD, Y, CW, 4, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fill()
    const dcFill = (longevity.dataCompleteness / 100) * CW
    if (dcFill > 0) {
      roundRect(ctx, PAD, Y, dcFill, 4, 2)
      const dcGrad = ctx.createLinearGradient(PAD, 0, PAD + dcFill, 0)
      dcGrad.addColorStop(0, hexToRgba('#3B82F6', 0.4))
      dcGrad.addColorStop(1, hexToRgba('#00FFCC', 0.4))
      ctx.fillStyle = dcGrad
      ctx.fill()
    }

    Y += 28

    // Summary line
    if (longevity.summaryLine) {
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = `italic 500 13px "SF Pro Display", "Inter", system-ui, sans-serif`
      const maxW = CW - 40
      const words = longevity.summaryLine.split(' ')
      let line = ''
      const lines: string[] = []
      for (const word of words) {
        const test = line ? `${line} ${word}` : word
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word } else { line = test }
      }
      if (line) lines.push(line)
      lines.forEach((l, li) => { ctx.fillText(l, W / 2, Y + li * 20) })
    }

  } else {
    /* ══════════════════════════════════════════════════
       TWITTER FORMAT — Compact horizontal layout
       ══════════════════════════════════════════════════ */

    // Score on left
    const ringCX = PAD + 90
    const ringCY = Y + 120
    const ringR = 60

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2)
    ctx.stroke()

    const arcAngle = (longevity.score / 100) * Math.PI * 2
    ctx.strokeStyle = hexToRgba(scoreColor, 0.7)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + arcAngle)
    ctx.stroke()
    ctx.lineCap = 'butt'

    const scoreGlow = ctx.createRadialGradient(ringCX, ringCY, 0, ringCX, ringCY, ringR * 1.2)
    scoreGlow.addColorStop(0, hexToRgba(scoreColor, 0.06))
    scoreGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = scoreGlow
    ctx.beginPath()
    ctx.arc(ringCX, ringCY, ringR * 1.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.fillStyle = scoreColor
    ctx.font = `900 52px "SF Pro Display", "Inter", system-ui, sans-serif`
    ctx.fillText(String(longevity.score), ringCX, ringCY + 18)

    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = `600 8px "SF Mono", "Fira Code", "Courier New", monospace`
    ctx.fillText('LONGEVITY SCORE', ringCX, ringCY + 36)

    // Mini body silhouette center
    const miniBodyCX = W / 2
    const miniBodyCY = Y + 120
    drawBodySilhouette(ctx, miniBodyCX, miniBodyCY, 0.7, bioIdentity.systems)

    // Subsystem bars on right
    const barX = W / 2 + 140
    const barW2 = W - PAD - barX
    const subsystems = ['autonomic', 'recovery', 'adherence', 'integrity'] as const

    subsystems.forEach((key, i) => {
      const by = Y + 50 + i * 42
      const val = longevity.breakdown[key]
      const thermal = scoreToThermal(val * 4)
      const color = THERMAL_HEX[thermal]

      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = `600 7px "SF Mono", "Fira Code", "Courier New", monospace`
      ctx.fillText(SUBSYSTEM_LABELS[key], barX, by)

      ctx.textAlign = 'right'
      ctx.fillStyle = color
      ctx.font = `800 12px "SF Pro Display", "Inter", system-ui, sans-serif`
      ctx.fillText(`${val}`, barX + barW2, by)

      const trackY = by + 6
      roundRect(ctx, barX, trackY, barW2, 4, 2)
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fill()

      const fillW = (val / 25) * barW2
      if (fillW > 0) {
        roundRect(ctx, barX, trackY, fillW, 4, 2)
        ctx.fillStyle = hexToRgba(color, 0.4)
        ctx.fill()
      }
    })
  }

  /* ══════════════════════════════════════════════════
     FOOTER — Watermark + branding
     ══════════════════════════════════════════════════ */
  const footerY = H - (format === 'story' ? 72 : 36)

  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(PAD, footerY); ctx.lineTo(W - PAD, footerY); ctx.stroke()

  // Left: Vive branding
  ctx.textAlign = 'left'
  ctx.fillStyle = hexToRgba('#00FFCC', 0.25)
  ctx.font = `800 ${format === 'story' ? 12 : 9}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.fillText('VIVE 4.0', PAD, footerY + (format === 'story' ? 28 : 18))

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = `500 ${format === 'story' ? 9 : 7}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.fillText('BIOLOGICAL OPERATING SYSTEM', PAD, footerY + (format === 'story' ? 44 : 28))

  // Right: URL
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.font = `500 ${format === 'story' ? 9 : 7}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.fillText('vive.bio', W - PAD, footerY + (format === 'story' ? 28 : 18))

  // Center: classification
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(239,68,68,0.15)'
  ctx.font = `600 ${format === 'story' ? 8 : 6}px "SF Mono", "Fira Code", "Courier New", monospace`
  ctx.fillText('FOR AUTHORIZED PERSONNEL ONLY', W / 2, footerY + (format === 'story' ? 56 : 28))
}

/* ═══════════════════════════════════════════════════════════════
   SHARE OVERLAY COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface SystemReadinessShareProps {
  isOpen: boolean
  onClose: () => void
}

export default function SystemReadinessShare({ isOpen, onClose }: SystemReadinessShareProps) {
  const sessionId = getTwinSessionId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [format, setFormat] = useState<ShareFormat>('story')
  const [rendered, setRendered] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userName, setUserName] = useState('')

  const longevityScore = useQuery(api.longevityScore.getLongevityScore, { sessionId })
  const bioIdentity = useQuery(api.bioIdentity.getBioIdentityState, { sessionId })

  // Load user name from session
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vive-user-name')
      if (stored) setUserName(stored)
    } catch {}
  }, [])

  const renderGraphic = useCallback(() => {
    if (!canvasRef.current || !longevityScore || !bioIdentity) return

    renderShareGraphic(
      canvasRef.current,
      format,
      userName,
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
          system: s.system,
          label: s.label,
          score: s.score,
          thermal: s.thermal as ThermalState,
          icon: s.icon,
          trend: s.trend,
        })),
      }
    )
    setRendered(true)
  }, [longevityScore, bioIdentity, format, userName])

  useEffect(() => {
    if (isOpen && longevityScore && bioIdentity) {
      setRendered(false)
      const timer = setTimeout(renderGraphic, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen, longevityScore, bioIdentity, renderGraphic])

  const getBlob = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null
    return new Promise((resolve) => {
      canvasRef.current!.toBlob((blob) => resolve(blob), 'image/png', 1.0)
    })
  }, [])

  const handleShare = useCallback(async () => {
    setSharing(true)
    try {
      const blob = await getBlob()
      if (!blob) return

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `vive-bio-identity-${Date.now()}.png`, { type: 'image/png' })
        const shareData = {
          title: `Vive 4.0: ${userName || 'Operator'} Bio-Identity Status`,
          text: `Longevity Score: ${longevityScore?.score}/100 · Optimized by Vive 4.0`,
          files: [file],
        }
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      }
      handleDownload()
    } catch (err: any) {
      if (err?.name !== 'AbortError') handleDownload()
    } finally {
      setSharing(false)
    }
  }, [getBlob, longevityScore, userName])

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `vive-bio-identity-${format}-${Date.now()}.png`
    link.href = canvasRef.current.toDataURL('image/png', 1.0)
    link.click()
  }, [format])

  const handleCopyCaption = useCallback(() => {
    const score = longevityScore?.score ?? 0
    const trend = longevityScore?.trend === 'improving' ? '📈' : longevityScore?.trend === 'declining' ? '📉' : '📊'
    const name = userName || 'Operator'
    const caption = `${trend} Vive 4.0: ${name} Bio-Identity Status\n\nLongevity Score: ${score}/100\n${longevityScore?.summaryLine || 'Biological OS running.'}\n\nOptimized by @ViveBio 4.0\n#longevity #biohacking #healthOS #optimization #bioidentity`
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [longevityScore, userName])

  if (!isOpen) return null

  const isLoading = !longevityScore || !bioIdentity

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99990,
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(24px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%', maxWidth: 440,
              background: 'rgba(8,8,12,0.97)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#F0F0F4',
                  fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ color: '#00FFCC', fontSize: 12 }}>◆</span>
                  System Readiness Share
                </div>
                <div style={{
                  fontSize: 9, fontFamily: '"SF Mono", "Fira Code", monospace',
                  color: 'rgba(255,255,255,0.2)', marginTop: 3, letterSpacing: '0.12em',
                }}>
                  SUPER-SOLDIER BIO-READOUT · {format === 'story' ? '1080×1920' : '1200×675'}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.35)', fontSize: 14,
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                ✕
              </button>
            </div>

            {/* Name Input */}
            <div style={{ padding: '12px 20px 0' }}>
              <div style={{
                fontSize: 8, fontFamily: '"SF Mono", "Fira Code", monospace',
                color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em',
                marginBottom: 6, textTransform: 'uppercase',
              }}>
                Operator Name
              </div>
              <input
                type="text"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value)
                  try { localStorage.setItem('vive-user-name', e.target.value) } catch {}
                  setRendered(false)
                }}
                placeholder="Enter your name..."
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8, color: '#F0F0F4',
                  fontSize: 13, fontWeight: 600,
                  fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              />
            </div>

            {/* Format Toggle */}
            <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
              {(['story', 'twitter'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFormat(f); setRendered(false) }}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: format === f ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${format === f ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 10, cursor: 'pointer',
                    color: format === f ? '#60A5FA' : 'rgba(255,255,255,0.3)',
                    fontSize: 10, fontFamily: '"SF Mono", "Fira Code", monospace', fontWeight: 600,
                    letterSpacing: '0.06em',
                    transition: 'all 0.2s',
                  }}
                >
                  {f === 'story' ? '📱 STORY · 1080×1920' : '𝕏 POST · 1200×675'}
                </button>
              ))}
            </div>

            {/* Canvas Preview */}
            <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'center' }}>
              {isLoading ? (
                <div style={{
                  width: '100%',
                  aspectRatio: format === 'story' ? '1080/1920' : '1200/675',
                  maxHeight: format === 'story' ? 400 : 200,
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 12,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, position: 'relative',
                  }}>
                    <div style={{
                      width: 36, height: 36,
                      border: '2px solid rgba(59,130,246,0.08)',
                      borderTopColor: '#3B82F6',
                      borderRadius: '50%',
                      animation: 'srs-spin 0.8s linear infinite',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 6,
                      border: '2px solid rgba(0,255,204,0.06)',
                      borderBottomColor: '#00FFCC',
                      borderRadius: '50%',
                      animation: 'srs-spin-rev 1.2s linear infinite',
                    }} />
                  </div>
                  <div style={{
                    fontSize: 9, fontFamily: '"SF Mono", "Fira Code", monospace',
                    color: 'rgba(255,255,255,0.15)', letterSpacing: '0.15em',
                  }}>
                    SCANNING BIO-SYSTEMS…
                  </div>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  style={{
                    width: '100%',
                    maxHeight: format === 'story' ? 400 : 200,
                    objectFit: 'contain',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Share */}
              <button
                onClick={handleShare}
                disabled={!rendered || sharing}
                style={{
                  width: '100%', padding: '13px 0',
                  background: rendered
                    ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(0,255,204,0.08))'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${rendered ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 12, cursor: rendered ? 'pointer' : 'default',
                  color: rendered ? '#60A5FA' : 'rgba(255,255,255,0.15)',
                  fontSize: 12, fontWeight: 700,
                  fontFamily: '"SF Pro Display", "Inter", system-ui, sans-serif',
                  letterSpacing: '0.04em',
                  opacity: sharing ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {sharing ? '⏳ SHARING…' : rendered ? '↗ SHARE BIO-IDENTITY GRAPHIC' : '⏳ RENDERING…'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {/* Copy Caption */}
                <button
                  onClick={handleCopyCaption}
                  disabled={!rendered}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, cursor: rendered ? 'pointer' : 'default',
                    color: copied ? '#00DC82' : 'rgba(255,255,255,0.25)',
                    fontSize: 9, fontWeight: 600,
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    letterSpacing: '0.06em',
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? '✅ COPIED' : '📋 COPY CAPTION'}
                </button>

                {/* Download */}
                <button
                  onClick={handleDownload}
                  disabled={!rendered}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, cursor: rendered ? 'pointer' : 'default',
                    color: 'rgba(255,255,255,0.25)',
                    fontSize: 9, fontWeight: 600,
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    letterSpacing: '0.06em',
                    transition: 'all 0.2s',
                  }}
                >
                  ⬇ DOWNLOAD PNG
                </button>
              </div>
            </div>
          </motion.div>

          <style>{`
            @keyframes srs-spin { to { transform: rotate(360deg); } }
            @keyframes srs-spin-rev { to { transform: rotate(-360deg); } }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
