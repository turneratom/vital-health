import React, { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceLight: 'rgba(14,14,18,0.6)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.12)',
  gold: '#FFD700',
  purple: '#A78BFA',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.20)',
  amberBright: '#FBBF24',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.15)',
  tealDim: 'rgba(0,255,204,0.06)',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Body Region SVG Definitions ── */
interface RegionDef {
  id: string
  label: string
  path: string
  cx: number
  cy: number
  r: number
}

const BODY_REGIONS: RegionDef[] = [
  { id: 'head', label: 'Head & CNS', path: 'M46,8 C46,4 48,2 50,2 C52,2 54,4 54,8 C54,12 52,15 50,16 C48,15 46,12 46,8 Z', cx: 50, cy: 9, r: 8 },
  { id: 'neck', label: 'Neck', path: 'M48.5,16 L51.5,16 L52,20 L48,20 Z', cx: 50, cy: 18, r: 4 },
  { id: 'shoulders', label: 'Shoulders', path: 'M38,22 L48,20 L50,22 L52,20 L62,22 L62,26 L56,25 L50,26 L44,25 L38,26 Z', cx: 50, cy: 23, r: 12 },
  { id: 'chest', label: 'Chest', path: 'M43,26 L57,26 L58,36 L42,36 Z', cx: 50, cy: 31, r: 10 },
  { id: 'arms', label: 'Arms', path: 'M36,26 L43,26 L42,36 L40,46 L38,54 L34,54 L33,46 L34,36 Z M57,26 L64,26 L66,36 L67,46 L66,54 L62,54 L60,46 L58,36 Z', cx: 50, cy: 40, r: 14 },
  { id: 'gut', label: 'Gut & Digestive', path: 'M43,36 L57,36 L57,44 L43,44 Z', cx: 50, cy: 40, r: 8 },
  { id: 'abdomen', label: 'Abdomen & Core', path: 'M43,44 L57,44 L56,52 L44,52 Z', cx: 50, cy: 48, r: 8 },
  { id: 'hips', label: 'Hips & Pelvis', path: 'M42,52 L58,52 L60,58 L50,60 L40,58 Z', cx: 50, cy: 55, r: 10 },
  { id: 'upper_back', label: 'Upper Back', path: 'M44,26 L56,26 L57,36 L43,36 Z', cx: 50, cy: 31, r: 8 },
  { id: 'lower_back', label: 'Lower Back', path: 'M44,44 L56,44 L56,54 L44,54 Z', cx: 50, cy: 49, r: 8 },
  { id: 'legs', label: 'Legs', path: 'M42,58 L48,60 L46,74 L44,88 L40,88 L40,74 Z M52,60 L58,58 L60,74 L60,88 L56,88 L54,74 Z', cx: 50, cy: 73, r: 14 },
  { id: 'knees', label: 'Knees', path: 'M41,76 L46,76 L46,80 L41,80 Z M54,76 L59,76 L59,80 L54,80 Z', cx: 50, cy: 78, r: 10 },
  { id: 'feet', label: 'Feet & Ankles', path: 'M39,88 L45,88 L46,94 L38,94 Z M55,88 L61,88 L62,94 L54,94 Z', cx: 50, cy: 91, r: 10 },
  { id: 'skin', label: 'Skin', path: '', cx: 50, cy: 50, r: 30 },
]

/* ── Joint & Spine regions for Active Strain ── */
const JOINT_REGIONS = new Set(['knees', 'hips', 'shoulders', 'neck', 'feet'])
const SPINE_REGIONS = new Set(['upper_back', 'lower_back'])
const CORE_REGIONS = new Set(['chest', 'gut', 'abdomen'])
const STRAIN_REGIONS = new Set([...JOINT_REGIONS, ...SPINE_REGIONS, ...CORE_REGIONS])

/* ── Spine wireframe path for teal particle flow ── */
const SPINE_PATH = 'M50,17 L50,20 L50,26 L50,36 L50,44 L50,54'
const JOINT_POINTS = [
  { cx: 50, cy: 18, label: 'C-Spine' },
  { cx: 43, cy: 23, label: 'L-Shoulder' },
  { cx: 57, cy: 23, label: 'R-Shoulder' },
  { cx: 50, cy: 31, label: 'T-Spine' },
  { cx: 50, cy: 49, label: 'L-Spine' },
  { cx: 44, cy: 55, label: 'L-Hip' },
  { cx: 56, cy: 55, label: 'R-Hip' },
  { cx: 43, cy: 78, label: 'L-Knee' },
  { cx: 57, cy: 78, label: 'R-Knee' },
  { cx: 42, cy: 91, label: 'L-Ankle' },
  { cx: 58, cy: 91, label: 'R-Ankle' },
]

/* ── Core emissive points — torso center mass for amber glow ── */
const CORE_EMISSIVE_POINTS = [
  { cx: 50, cy: 31, r: 6, label: 'Heart Center' },
  { cx: 50, cy: 38, r: 5, label: 'Solar Plexus' },
  { cx: 50, cy: 46, r: 5, label: 'Core' },
  { cx: 47, cy: 40, r: 3.5, label: 'L-Oblique' },
  { cx: 53, cy: 40, r: 3.5, label: 'R-Oblique' },
]

/* ── Wireframe skeleton paths ── */
const WIREFRAME_PATHS = [
  'M50,9 L50,17 L50,20 L50,26 L50,36 L50,44 L50,54 L50,58',
  'M38,23 L43,23 L50,23 L57,23 L62,23',
  'M38,23 L36,30 L34,40 L33,50 L34,54',
  'M62,23 L64,30 L66,40 L67,50 L66,54',
  'M44,54 L50,58 L56,54',
  'M44,55 L43,65 L43,78 L42,85 L42,91',
  'M56,55 L57,65 L57,78 L58,85 L58,91',
]

/* ── Upward flow particle paths for teal Flow shader ── */
const FLOW_UPWARD_PATHS = [
  'M50,92 C49,80 48,70 47,60 C46,50 48,40 50,30 C52,20 50,12 50,5',
  'M44,90 C43,78 42,68 43,58 C44,48 46,38 47,28 C48,18 46,10 45,4',
  'M56,90 C57,78 58,68 57,58 C56,48 54,38 53,28 C52,18 54,10 55,4',
  'M48,88 C47,76 45,64 46,52 C47,42 49,32 50,22 C51,14 49,8 48,3',
  'M52,88 C53,76 55,64 54,52 C53,42 51,32 50,22 C49,14 51,8 52,3',
  'M46,86 C44,74 43,62 44,50 C45,40 47,30 48,20 C49,12 47,6 46,2',
  'M54,86 C56,74 57,62 56,50 C55,40 53,30 52,20 C51,12 53,6 54,2',
]

/* ── Silhouette Path ── */
const SILHOUETTE = `
  M50,2 C53,2 55,5 55,9 C55,13 53,16 50,17 C47,16 45,13 45,9 C45,5 47,2 50,2 Z
  M48,17 L52,17 L52.5,20 L47.5,20 Z
  M37,22 L47.5,20 L52.5,20 L63,22 L66,28 L67,38 L68,50 L66,56 L62,56 L60,46 L58,36 L57,26
  L43,26 L42,36 L40,46 L38,56 L34,56 L32,50 L33,38 L34,28 Z
  M43,26 L57,26 L58,36 L57,48 L56,54 L58,58 L60,62 L60,76 L59,82 L60,88 L62,95
  L54,95 L54,88 L53,76 L52,62 L50,60
  L48,62 L47,76 L46,88 L46,95 L38,95 L40,88 L41,82 L40,76 L40,62 L42,58 L44,54 L43,48 L42,36 Z
`

/* ── Core emissive silhouette — torso only for amber emissive fill ── */
const CORE_SILHOUETTE = `
  M43,26 L57,26 L58,36 L57,48 L56,54 L44,54 L43,48 L42,36 Z
`

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return T.red
    case 'high': return T.orange
    case 'moderate': return T.gold
    case 'low': return T.blue
    default: return T.accent
  }
}

function severityGlow(severity: string): string {
  switch (severity) {
    case 'critical': return T.redGlow
    case 'high': return T.orangeGlow
    case 'moderate': return 'rgba(255,215,0,0.15)'
    case 'low': return T.blueGlow
    default: return T.accentGlow
  }
}

/* ── Haptic Ripple State ── */
interface HapticRipple {
  id: number
  cx: number
  cy: number
  color: string
}

/* ── Main Component ── */
interface SomaticBodyMapProps {
  stabilizedRegions?: Set<string>
  protocolCompletion?: number
  systemStability?: number
}

export default function SomaticBodyMap({ stabilizedRegions = new Set(), protocolCompletion = 0, systemStability = 85 }: SomaticBodyMapProps) {
  /* ── System Stability Visual States ── */
  const isStrained = systemStability < 80
  const isCriticalStrain = systemStability < 40
  const isAmberStrain = systemStability < 70 && systemStability >= 40
  const isFlowState = systemStability >= 90
  const isPeakPerformance = systemStability >= 95
  const strainIntensity = isStrained ? Math.max(0, (80 - systemStability) / 80) : 0
  const flowIntensity = isFlowState ? Math.min(1, (systemStability - 90) / 10) : 0
  // Critical blend: 0 at 40%, 1 at 0% — controls amber→red interpolation
  const criticalBlend = isCriticalStrain ? Math.min(1, (40 - systemStability) / 40) : 0
  // Amber intensity: peaks at ~40%, fades toward 80%
  const amberIntensity = isStrained && !isCriticalStrain ? Math.min(1, (70 - systemStability) / 30) : 0
  // Pulse speed: faster as stability drops (2s at 70%, 0.6s at 0%)
  const strainPulseSpeed = isCriticalStrain ? Math.max(0.4, 1.2 - criticalBlend * 0.8) : Math.max(1.2, 2 - strainIntensity * 1.2)
  // Dynamic emissive color: interpolate amber→red based on criticalBlend
  const emissiveR = Math.round(245 + criticalBlend * 10) // 245→255
  const emissiveG = Math.round(158 - criticalBlend * 91) // 158→67
  const emissiveB = Math.round(11 + criticalBlend * 96)  // 11→107
  const emissiveColor = `rgb(${emissiveR},${emissiveG},${emissiveB})`
  const emissiveBright = isCriticalStrain ? '#FF4444' : T.amberBright
  const emissiveHex = isCriticalStrain ? '#FF4444' : T.amber
  const emissiveGlowAlpha = isCriticalStrain ? 0.35 + criticalBlend * 0.25 : 0.20 + amberIntensity * 0.15

  /* ── System Pulse: 60bpm = 1 beat per second ── */
  const PULSE_PERIOD_MS = 1000
  const isFullyComplete = protocolCompletion >= 100

  const pulseColor = isCriticalStrain ? '#FF4444' : isStrained ? T.amber : (isFlowState || isFullyComplete) ? T.accent : T.blue
  const pulseGlow = isCriticalStrain ? 'rgba(255,68,68,0.25)' : isStrained ? T.amberGlow : (isFlowState || isFullyComplete) ? T.accentGlow : T.blueGlow

  const sessionId = getTwinSessionId()
  const bodyData = useQuery(api.somaticCorrelation.getBodyMapData, { sessionId })
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [showInsightPanel, setShowInsightPanel] = useState(false)
  const [hapticRipples, setHapticRipples] = useState<HapticRipple[]>([])
  const [pressedRegion, setPressedRegion] = useState<string | null>(null)
  const rippleIdRef = useRef(0)

  const regionDataMap = useMemo(() => {
    if (!bodyData?.regions) return new Map()
    const map = new Map<string, typeof bodyData.regions[0]>()
    for (const r of bodyData.regions) {
      map.set(r.region, r)
    }
    return map
  }, [bodyData])

  const selectedData = selectedRegion ? regionDataMap.get(selectedRegion) : null

  const spawnHapticRipple = useCallback((cx: number, cy: number, color: string) => {
    const id = ++rippleIdRef.current
    setHapticRipples(prev => [...prev, { id, cx, cy, color }])
    setTimeout(() => {
      setHapticRipples(prev => prev.filter(r => r.id !== id))
    }, 700)
  }, [])

  const handleRegionTap = useCallback((regionId: string, cx: number, cy: number) => {
    const data = regionDataMap.get(regionId)
    const color = data ? severityColor(data.severity) : T.blue
    spawnHapticRipple(cx, cy, color)
    setPressedRegion(regionId)
    setTimeout(() => setPressedRegion(null), 300)
    if (data && data.heatIntensity > 0) {
      setSelectedRegion(regionId)
      setShowInsightPanel(true)
    }
  }, [regionDataMap, spawnHapticRipple])

  const handleClose = useCallback(() => {
    setShowInsightPanel(false)
    setTimeout(() => setSelectedRegion(null), 300)
  }, [])

  const activeRegions = useMemo(() => {
    return BODY_REGIONS.filter(r => {
      const data = regionDataMap.get(r.id)
      return data && data.heatIntensity > 0
    })
  }, [regionDataMap])

  const hasData = bodyData && bodyData.regions.length > 0

  const stabilityLabel = isCriticalStrain
    ? 'CRITICAL — SYSTEM ALERT'
    : isStrained
    ? systemStability < 70 ? 'ELEVATED STRAIN' : 'ACTIVE STRAIN'
    : isPeakPerformance
    ? 'PEAK FLOW'
    : isFlowState
    ? 'FLOW STATE'
    : 'NOMINAL'
  const stabilityColor = isCriticalStrain
    ? T.red
    : isStrained
    ? systemStability < 70 ? T.amber : T.amber
    : isFlowState ? T.teal : T.blue

  return (
    <div style={{ padding: '20px 16px', background: 'transparent' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="mono-label" style={{ fontSize: 9, color: T.blueBright, marginBottom: 4 }}>
            SOMATIC BODY MAP
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>
            Bio-Feedback Loop
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="soft-clinch" style={{
            padding: '4px 10px', borderRadius: 8,
            background: isCriticalStrain
              ? `rgba(255,68,68,${0.12 + criticalBlend * 0.15})`
              : isStrained
              ? `rgba(245,158,11,${0.08 + strainIntensity * 0.12})`
              : isFlowState ? T.tealDim : T.blueGlow,
            border: `1px solid ${stabilityColor}33`,
            animation: isCriticalStrain
              ? `strain-badge-pulse ${strainPulseSpeed}s ease-in-out infinite`
              : isStrained ? 'strain-badge-pulse 2s ease-in-out infinite'
              : isFlowState ? 'flow-badge-shimmer 3s ease-in-out infinite' : 'none',
            transition: 'background 1s ease, border-color 1s ease',
          }}>
            <span className="mono-label" style={{ fontSize: 8, color: stabilityColor }}>
              {isFlowState ? '\u2728 ' : isCriticalStrain ? '\u{1F6A8} ' : isStrained ? '\u26A1 ' : ''}{stabilityLabel} {systemStability}%
            </span>
          </div>
          {bodyData && (
            <>
              {bodyData.bodyStressScore > 0 && (
                <div className="soft-clinch" style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: bodyData.bodyStressScore > 60 ? T.redGlow : bodyData.bodyStressScore > 30 ? T.orangeGlow : T.blueGlow,
                  border: `1px solid ${bodyData.bodyStressScore > 60 ? 'rgba(255,107,107,0.3)' : bodyData.bodyStressScore > 30 ? 'rgba(232,151,108,0.3)' : T.borderBlue}`,
                }}>
                  <span className="mono-label" style={{ fontSize: 8, color: bodyData.bodyStressScore > 60 ? T.red : bodyData.bodyStressScore > 30 ? T.orange : T.blue }}>
                    STRESS {bodyData.bodyStressScore}
                  </span>
                </div>
              )}
              {bodyData.recurringPatterns > 0 && (
                <div className="soft-clinch" style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: T.orangeGlow,
                  border: '1px solid rgba(232,151,108,0.3)',
                }}>
                  <span className="mono-label" style={{ fontSize: 8, color: T.orange }}>
                    {bodyData.recurringPatterns} RECURRING
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body Map + Insight Panel */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 360 }}>
        {/* SVG Body Map */}
        <div style={{
          flex: '0 0 auto',
          width: showInsightPanel && selectedData ? '45%' : '100%',
          transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
        }}>
          <div className="luxury-surface" style={{ padding: '24px 16px', position: 'relative', overflow: 'hidden' }}>
            {/* Ambient glow behind silhouette */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 200, height: 200,
              transform: 'translate(-50%, -50%)',
              background: hasData
                ? `radial-gradient(circle, ${pulseGlow} 0%, transparent 70%)`
                : `radial-gradient(circle, ${isFlowState ? 'rgba(0,255,204,0.05)' : isStrained ? 'rgba(245,158,11,0.05)' : 'rgba(59,130,246,0.05)'} 0%, transparent 70%)`,
              pointerEvents: 'none',
              animation: 'somatic-cardiac-pulse 1s ease-in-out infinite',
            }} />

            {/* Active Strain vignette overlay — amber or red */}
            {isStrained && (
              <div style={{
                position: 'absolute', inset: 0,
                background: isCriticalStrain
                  ? `radial-gradient(ellipse at center, transparent 20%, rgba(255,68,68,${0.06 + criticalBlend * 0.12}) 100%)`
                  : `radial-gradient(ellipse at center, transparent 30%, rgba(245,158,11,${0.04 + strainIntensity * 0.08}) 100%)`,
                pointerEvents: 'none',
                animation: isCriticalStrain
                  ? `strain-vignette-pulse ${strainPulseSpeed}s ease-in-out infinite`
                  : 'strain-vignette-pulse 2s ease-in-out infinite',
                transition: 'background 1.5s ease',
              }} />
            )}

            {/* Flow State teal aurora overlay */}
            {isFlowState && (
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at 50% 70%, rgba(0,255,204,${0.03 + flowIntensity * 0.04}) 0%, transparent 50%), radial-gradient(ellipse at 50% 20%, rgba(0,255,204,${0.02 + flowIntensity * 0.03}) 0%, transparent 40%)`,
                pointerEvents: 'none',
                animation: 'flow-aurora-shift 5s ease-in-out infinite',
              }} />
            )}

            <style>{`
              @keyframes somatic-cardiac-pulse {
                0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
                25% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
                50% { opacity: 0.75; transform: translate(-50%, -50%) scale(1.02); }
              }
              @keyframes strain-badge-pulse {
                0%, 100% { opacity: 0.85; }
                50% { opacity: 1; }
              }
              @keyframes flow-badge-shimmer {
                0%, 100% { opacity: 0.85; box-shadow: 0 0 0 rgba(0,255,204,0); }
                50% { opacity: 1; box-shadow: 0 0 12px rgba(0,255,204,0.15); }
              }
              @keyframes strain-vignette-pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              @keyframes flow-aurora-shift {
                0%, 100% { opacity: 0.7; transform: scale(1) translateY(0); }
                33% { opacity: 1; transform: scale(1.02) translateY(-2px); }
                66% { opacity: 0.85; transform: scale(0.99) translateY(1px); }
              }
              @keyframes emissive-core-breathe {
                0%, 100% { opacity: 0.15; }
                50% { opacity: 0.45; }
              }
              @keyframes emissive-core-pulse {
                0%, 100% { r: 4; opacity: 0.2; }
                50% { r: 7; opacity: 0.6; }
              }
              @keyframes emissive-heatwave {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: -20; }
              }
              @keyframes flow-particle-rise {
                0% { offset-distance: 0%; opacity: 0; }
                5% { opacity: 0.8; }
                85% { opacity: 0.8; }
                100% { offset-distance: 100%; opacity: 0; }
              }
              @keyframes flow-shimmer-line {
                0% { stroke-dashoffset: 40; opacity: 0.1; }
                50% { opacity: 0.4; }
                100% { stroke-dashoffset: -40; opacity: 0.1; }
              }
              @keyframes flow-field-rotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes flow-core-bloom {
                0%, 100% { r: 8; opacity: 0.08; }
                50% { r: 14; opacity: 0.2; }
              }
              @keyframes flow-energy-ring {
                0% { r: 10; opacity: 0.3; stroke-width: 0.5; }
                100% { r: 40; opacity: 0; stroke-width: 0.05; }
              }
            `}</style>

            <svg
              viewBox="0 0 100 100"
              style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block', position: 'relative', zIndex: 1 }}
            >
              <defs>
                {/* ── GLASSMORPHISM SVG FILTERS ── */}
                <filter id="glass-depth" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                  <feOffset in="blur" dx="0" dy="1" result="shadow" />
                  <feFlood floodColor="rgba(0,0,0,0.4)" result="shadowColor" />
                  <feComposite in="shadowColor" in2="shadow" operator="in" result="dropShadow" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" result="softSource" />
                  <feMerge>
                    <feMergeNode in="dropShadow" />
                    <feMergeNode in="softSource" />
                  </feMerge>
                </filter>

                <filter id="glass-refract" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />
                  <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.6" specularExponent="25" result="specular">
                    <fePointLight x="50" y="-20" z="80" />
                  </feSpecularLighting>
                  <feComposite in="specular" in2="SourceGraphic" operator="in" result="specularClip" />
                  <feMerge>
                    <feMergeNode in="SourceGraphic" />
                    <feMergeNode in="specularClip" />
                  </feMerge>
                </filter>

                {/* Glow filters for each severity */}
                <filter id="glow-critical" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feFlood floodColor={T.red} floodOpacity="0.6" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="innerShadow" />
                  <feOffset in="innerShadow" dy="0.5" result="offsetShadow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                    <feMergeNode in="offsetShadow" />
                  </feMerge>
                </filter>
                <filter id="glow-high" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feFlood floodColor={T.orange} floodOpacity="0.5" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-moderate" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feFlood floodColor={T.gold} floodOpacity="0.4" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-low" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feFlood floodColor={T.blue} floodOpacity="0.3" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>

                <filter id="silhouette-glow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="0.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>

                {/* ── Emissive Core + Joint glow filter — dynamic amber/red ── */}
                <filter id="glow-emissive-amber" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation={isCriticalStrain ? 5 : 4} result="blur1" />
                  <feFlood floodColor={emissiveHex} floodOpacity={isCriticalStrain ? 0.95 : 0.8} result="color1" />
                  <feComposite in="color1" in2="blur1" operator="in" result="glow1" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation={isCriticalStrain ? 3 : 2} result="blur2" />
                  <feFlood floodColor={emissiveBright} floodOpacity={isCriticalStrain ? 0.7 : 0.5} result="color2" />
                  <feComposite in="color2" in2="blur2" operator="in" result="glow2" />
                  <feMerge>
                    <feMergeNode in="glow1" />
                    <feMergeNode in="glow2" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* ── Emissive Core fill material — amber or red ── */}
                <radialGradient id="emissive-amber-core" cx="50%" cy="45%" r="60%">
                  <stop offset="0%" stopColor={emissiveBright} stopOpacity={isCriticalStrain ? 0.5 + criticalBlend * 0.3 : 0.3 + strainIntensity * 0.3} />
                  <stop offset="40%" stopColor={emissiveHex} stopOpacity={isCriticalStrain ? 0.25 + criticalBlend * 0.2 : 0.15 + strainIntensity * 0.15} />
                  <stop offset="100%" stopColor={emissiveHex} stopOpacity="0" />
                </radialGradient>

                {/* ── Critical Red: Extra intense inner glow ── */}
                {isCriticalStrain && (
                  <radialGradient id="emissive-red-inner" cx="50%" cy="40%" r="40%">
                    <stop offset="0%" stopColor="#FF2222" stopOpacity={0.4 + criticalBlend * 0.3} />
                    <stop offset="60%" stopColor="#FF4444" stopOpacity={0.1 + criticalBlend * 0.15} />
                    <stop offset="100%" stopColor="#FF4444" stopOpacity="0" />
                  </radialGradient>
                )}

                {/* ── Flow State: Teal shader glow ── */}
                <filter id="glow-flow-teal" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feFlood floodColor={T.teal} floodOpacity="0.6" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="glow-flow-particle" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feFlood floodColor={T.teal} floodOpacity="0.9" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* ── Flow State: Teal gradient fill for silhouette ── */}
                <linearGradient id="flow-silhouette-fill" x1="50%" y1="100%" x2="50%" y2="0%">
                  <stop offset="0%" stopColor={T.teal} stopOpacity={0.02 + flowIntensity * 0.04} />
                  <stop offset="40%" stopColor={T.teal} stopOpacity={0.04 + flowIntensity * 0.06} />
                  <stop offset="70%" stopColor={T.teal} stopOpacity={0.02 + flowIntensity * 0.03} />
                  <stop offset="100%" stopColor={T.teal} stopOpacity="0" />
                </linearGradient>

                {/* Glassmorphism radials */}
                <radialGradient id="glass-fill-blue" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(59,130,246,0.25)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0.05)" />
                </radialGradient>
                <radialGradient id="glass-fill-red" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(255,107,107,0.3)" />
                  <stop offset="100%" stopColor="rgba(255,107,107,0.06)" />
                </radialGradient>
                <radialGradient id="glass-fill-orange" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(232,151,108,0.28)" />
                  <stop offset="100%" stopColor="rgba(232,151,108,0.06)" />
                </radialGradient>
                <radialGradient id="glass-fill-gold" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(255,215,0,0.25)" />
                  <stop offset="100%" stopColor="rgba(255,215,0,0.05)" />
                </radialGradient>
                <radialGradient id="glass-fill-green" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(0,220,130,0.3)" />
                  <stop offset="100%" stopColor="rgba(0,220,130,0.06)" />
                </radialGradient>
                <radialGradient id="glass-fill-amber" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="rgba(245,158,11,0.35)" />
                  <stop offset="100%" stopColor="rgba(245,158,11,0.06)" />
                </radialGradient>

                {/* Upward flow paths for particle animation */}
                {isFlowState && FLOW_UPWARD_PATHS.map((d, i) => (
                  <path key={`flow-path-${i}`} id={`flow-up-${i}`} d={d} fill="none" />
                ))}
                {isFlowState && WIREFRAME_PATHS.map((d, i) => (
                  <path key={`wire-path-${i}`} id={`wire-path-${i}`} d={d} fill="none" />
                ))}
              </defs>

              {/* Stabilization glow filter */}
              <filter id="glow-stabilized" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feFlood floodColor={T.green} floodOpacity="0.55" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* System Pulse filter */}
              <filter id="system-pulse-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor={pulseColor} floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* ═══════════════════════════════════════════════
                  FLOW STATE: Teal wireframe + upward particle stream
                  Visible when stability >= 90%
                  ═══════════════════════════════════════════════ */}
              {isFlowState && (
                <g opacity={0.6 + flowIntensity * 0.4}>
                  {/* Teal silhouette fill — subtle gradient flowing upward */}
                  <path
                    d={SILHOUETTE}
                    fill="url(#flow-silhouette-fill)"
                    stroke="none"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.5;0.9;0.5"
                      dur="4s"
                      repeatCount="indefinite"
                    />
                  </path>

                  {/* Wireframe skeleton paths — teal with glow */}
                  {WIREFRAME_PATHS.map((d, i) => (
                    <g key={`wire-${i}`}>
                      {/* Base wireframe */}
                      <path
                        d={d}
                        fill="none"
                        stroke={T.teal}
                        strokeWidth={0.3 + flowIntensity * 0.3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#glow-flow-teal)"
                        opacity="0.6"
                      >
                        <animate
                          attributeName="stroke-opacity"
                          values="0.3;0.7;0.3"
                          dur="3s"
                          begin={`${i * 0.3}s`}
                          repeatCount="indefinite"
                        />
                      </path>
                      {/* Shimmer line traveling along wireframe */}
                      <path
                        d={d}
                        fill="none"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="0.3"
                        strokeLinecap="round"
                        strokeDasharray="3 12"
                        opacity="0.3"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          values="40;-40"
                          dur={`${4 + i * 0.5}s`}
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.1;0.4;0.1"
                          dur={`${4 + i * 0.5}s`}
                          repeatCount="indefinite"
                        />
                      </path>
                    </g>
                  ))}

                  {/* Teal joint nodes — breathing glow */}
                  {JOINT_POINTS.map((jp, i) => (
                    <g key={`flow-joint-${i}`}>
                      <circle
                        cx={jp.cx} cy={jp.cy} r="2.5"
                        fill={T.teal}
                        filter="url(#glow-flow-particle)"
                        opacity="0.7"
                      >
                        <animate
                          attributeName="r"
                          values="2;3.5;2"
                          dur="2.5s"
                          begin={`${i * 0.2}s`}
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.5;0.9;0.5"
                          dur="2.5s"
                          begin={`${i * 0.2}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle cx={jp.cx} cy={jp.cy} r="1" fill="#fff" opacity="0.4">
                        <animate
                          attributeName="opacity"
                          values="0.2;0.6;0.2"
                          dur="2.5s"
                          begin={`${i * 0.2}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  ))}

                  {/* ── UPWARD PARTICLE STREAM — Flow shader effect ── */}
                  {/* Particles rise from feet to head along curved paths */}
                  {FLOW_UPWARD_PATHS.map((d, pathIdx) => (
                    <g key={`flow-stream-${pathIdx}`}>
                      {[0, 1, 2, 3].map(pIdx => {
                        const dur = 4 + pathIdx * 0.3
                        const delay = pIdx * (dur / 4) + pathIdx * 0.2
                        const size = 0.6 + flowIntensity * 0.5
                        return (
                          <circle
                            key={`fp-${pathIdx}-${pIdx}`}
                            r={size}
                            fill={T.teal}
                            filter="url(#glow-flow-particle)"
                            opacity="0"
                          >
                            <animateMotion
                              dur={`${dur}s`}
                              begin={`${delay}s`}
                              repeatCount="indefinite"
                              path={d}
                            />
                            <animate
                              attributeName="opacity"
                              values="0;0.85;0.85;0"
                              keyTimes="0;0.05;0.85;1"
                              dur={`${dur}s`}
                              begin={`${delay}s`}
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="r"
                              values={`${size * 0.6};${size * 1.4};${size * 0.4}`}
                              dur={`${dur}s`}
                              begin={`${delay}s`}
                              repeatCount="indefinite"
                            />
                          </circle>
                        )
                      })}
                    </g>
                  ))}

                  {/* Wireframe path particles — energy flowing through skeleton */}
                  {WIREFRAME_PATHS.map((d, pathIdx) => (
                    <g key={`wire-particles-${pathIdx}`}>
                      {[0, 1, 2].map(particleIdx => (
                        <circle
                          key={`wp-${pathIdx}-${particleIdx}`}
                          r="0.7"
                          fill={T.teal}
                          filter="url(#glow-flow-particle)"
                          opacity="0"
                        >
                          <animateMotion
                            dur={`${3 + pathIdx * 0.5}s`}
                            begin={`${particleIdx * (1 + pathIdx * 0.15)}s`}
                            repeatCount="indefinite"
                            path={d}
                          />
                          <animate
                            attributeName="opacity"
                            values="0;0.9;0.9;0"
                            dur={`${3 + pathIdx * 0.5}s`}
                            begin={`${particleIdx * (1 + pathIdx * 0.15)}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      ))}
                    </g>
                  ))}

                  {/* Core energy bloom — teal radiance from center */}
                  <circle cx="50" cy="40" r="10" fill={T.teal} opacity="0.1" filter="url(#glow-flow-teal)">
                    <animate attributeName="r" values="8;14;8" dur="3.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.06;0.18;0.06" dur="3.5s" repeatCount="indefinite" />
                  </circle>

                  {/* Rising energy rings from core */}
                  {isPeakPerformance && [0, 1, 2].map(i => (
                    <circle
                      key={`energy-ring-${i}`}
                      cx="50" cy="40" r="10"
                      fill="none" stroke={T.teal} strokeWidth="0.4"
                      opacity="0"
                    >
                      <animate attributeName="r" values="10;42" dur="4s" begin={`${i * 1.3}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0" dur="4s" begin={`${i * 1.3}s`} repeatCount="indefinite" />
                      <animate attributeName="stroke-width" values="0.5;0.05" dur="4s" begin={`${i * 1.3}s`} repeatCount="indefinite" />
                      <animate attributeName="cy" values="40;20" dur="4s" begin={`${i * 1.3}s`} repeatCount="indefinite" />
                    </circle>
                  ))}

                  {/* Outer teal aura rings */}
                  <circle cx="50" cy="50" r="42" fill="none" stroke={T.teal} strokeWidth="0.15" strokeDasharray="2 4" opacity="0.3">
                    <animateTransform attributeName="transform" type="rotate" values="0 50 50;360 50 50" dur="40s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.15;0.35;0.15" dur="4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="50" cy="50" r="46" fill="none" stroke={T.teal} strokeWidth="0.1" strokeDasharray="1 6" opacity="0.15">
                    <animateTransform attributeName="transform" type="rotate" values="360 50 50;0 50 50" dur="60s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}

              {/* Base silhouette with cardiac pulse */}
              <path
                d={SILHOUETTE}
                fill={isFlowState ? 'url(#flow-silhouette-fill)' : 'rgba(255,255,255,0.03)'}
                stroke={isFlowState ? T.teal : pulseColor}
                strokeWidth={isFlowState ? '0.5' : '0.3'}
                filter="url(#silhouette-glow)"
                opacity="0.9"
              >
                <animate
                  attributeName="stroke-opacity"
                  values={isFlowState ? '0.3;0.7;0.3' : '0.15;0.6;0.15'}
                  dur={`${PULSE_PERIOD_MS}ms`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
                />
                <animate
                  attributeName="stroke-width"
                  values={isFlowState ? '0.4;0.8;0.4' : '0.3;0.7;0.3'}
                  dur={`${PULSE_PERIOD_MS}ms`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
                />
              </path>

              {/* Cardiac pulse ring */}
              <circle cx="50" cy="50" r="20" fill="none" stroke={pulseColor} strokeWidth="0.4" opacity="0">
                <animate attributeName="r" values="15;45;15" dur={`${PULSE_PERIOD_MS}ms`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur={`${PULSE_PERIOD_MS}ms`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
                <animate attributeName="stroke-width" values="0.8;0.1;0.8" dur={`${PULSE_PERIOD_MS}ms`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
              </circle>

              {/* Inner cardiac core */}
              <circle cx="50" cy="32" r="2" fill={pulseColor} opacity="0.2">
                <animate attributeName="r" values="1.5;3.5;1.5" dur={`${PULSE_PERIOD_MS}ms`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
                <animate attributeName="opacity" values="0.15;0.55;0.15" dur={`${PULSE_PERIOD_MS}ms`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
              </circle>

              {/* Protocol completion aura */}
              {protocolCompletion > 0 && (
                <circle cx="50" cy="50" r="38" fill="none" stroke={pulseColor} strokeWidth="0.2" strokeDasharray="3 5" opacity="0.2">
                  <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${PULSE_PERIOD_MS * 2}ms`} repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="rotate" values="0 50 50;360 50 50" dur="30s" repeatCount="indefinite" />
                </circle>
              )}

              {/* ═══════════════════════════════════════════════
                  ACTIVE STRAIN: Emissive amber material on core + joints
                  Visible when stability < 80%
                  ═══════════════════════════════════════════════ */}
              {isStrained && (
                <g style={{ transition: 'opacity 1.5s ease' }}>
                  {/* ── EMISSIVE CORE MATERIAL — amber/red glow filling the torso ── */}
                  <path
                    d={CORE_SILHOUETTE}
                    fill="url(#emissive-amber-core)"
                    stroke="none"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="opacity"
                      values={isCriticalStrain
                        ? `${0.6 + criticalBlend * 0.2};${0.95};${0.6 + criticalBlend * 0.2}`
                        : `${0.4 + strainIntensity * 0.2};${0.8 + strainIntensity * 0.2};${0.4 + strainIntensity * 0.2}`}
                      dur={`${strainPulseSpeed}s`}
                      repeatCount="indefinite"
                    />
                  </path>

                  {/* ── CRITICAL: Extra red inner core overlay ── */}
                  {isCriticalStrain && (
                    <path
                      d={CORE_SILHOUETTE}
                      fill="url(#emissive-red-inner)"
                      stroke="none"
                      opacity="0.9"
                    >
                      <animate
                        attributeName="opacity"
                        values={`${0.5 + criticalBlend * 0.3};0.95;${0.5 + criticalBlend * 0.3}`}
                        dur={`${strainPulseSpeed * 0.7}s`}
                        repeatCount="indefinite"
                      />
                    </path>
                  )}

                  {/* Core emissive hotspots — pulsing amber/red orbs inside torso */}
                  {CORE_EMISSIVE_POINTS.map((pt, i) => {
                    const pulseDur = `${strainPulseSpeed}s`
                    const hotspotFill = isCriticalStrain
                      ? `rgba(255,${Math.round(68 + (1 - criticalBlend) * 90)},${Math.round(68 + (1 - criticalBlend) * 40)},${0.15 + criticalBlend * 0.2})`
                      : `rgba(245,158,11,${0.08 + strainIntensity * 0.12})`
                    const hotspotBright = isCriticalStrain ? emissiveBright : T.amberBright
                    const expandFactor = isCriticalStrain ? 1.6 + criticalBlend * 0.4 : 1.4
                    return (
                      <g key={`core-emit-${i}`}>
                        {/* Outer emissive halo */}
                        <circle
                          cx={pt.cx} cy={pt.cy}
                          r={pt.r}
                          fill={hotspotFill}
                          filter="url(#glow-emissive-amber)"
                        >
                          <animate
                            attributeName="r"
                            values={`${pt.r * 0.8};${pt.r * expandFactor};${pt.r * 0.8}`}
                            dur={pulseDur}
                            begin={`${i * 0.15}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values={isCriticalStrain ? '0.5;0.95;0.5' : '0.3;0.7;0.3'}
                            dur={pulseDur}
                            begin={`${i * 0.15}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                        {/* Inner bright emissive core */}
                        <circle
                          cx={pt.cx} cy={pt.cy}
                          r={pt.r * (isCriticalStrain ? 0.5 : 0.35)}
                          fill={hotspotBright}
                          opacity={isCriticalStrain ? 0.5 + criticalBlend * 0.3 : 0.3 + strainIntensity * 0.3}
                        >
                          <animate
                            attributeName="opacity"
                            values={isCriticalStrain
                              ? `${0.4 + criticalBlend * 0.3};0.95;${0.4 + criticalBlend * 0.3}`
                              : `${0.2 + strainIntensity * 0.2};${0.6 + strainIntensity * 0.3};${0.2 + strainIntensity * 0.2}`}
                            dur={pulseDur}
                            begin={`${i * 0.15}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                        {/* Critical: extra rapid flash ring */}
                        {isCriticalStrain && (
                          <circle
                            cx={pt.cx} cy={pt.cy}
                            r={pt.r * 0.5}
                            fill="none" stroke="#FF2222" strokeWidth="0.4" opacity="0"
                          >
                            <animate attributeName="r" values={`${pt.r * 0.5};${pt.r * 2.5}`} dur={`${strainPulseSpeed * 0.6}s`} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values={`${0.4 + criticalBlend * 0.3};0`} dur={`${strainPulseSpeed * 0.6}s`} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                            <animate attributeName="stroke-width" values="0.6;0.05" dur={`${strainPulseSpeed * 0.6}s`} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                          </circle>
                        )}
                      </g>
                    )
                  })}

                  {/* Emissive heat wave lines — rippling outward from core */}
                  {[0, 1, 2].map(i => (
                    <ellipse
                      key={`heatwave-${i}`}
                      cx="50" cy="40"
                      rx={12 + i * 6} ry={8 + i * 4}
                      fill="none"
                      stroke={T.amber}
                      strokeWidth="0.2"
                      strokeDasharray="2 4"
                      opacity="0"
                    >
                      <animate
                        attributeName="rx"
                        values={`${12 + i * 6};${20 + i * 8};${12 + i * 6}`}
                        dur={`${3 + i * 0.5}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="ry"
                        values={`${8 + i * 4};${14 + i * 6};${8 + i * 4}`}
                        dur={`${3 + i * 0.5}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values={`0;${0.15 + strainIntensity * 0.15};0`}
                        dur={`${3 + i * 0.5}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-dashoffset"
                        values="0;-20"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </ellipse>
                  ))}

                  {/* Spine line — pulsing emissive amber/red */}
                  <path
                    d={SPINE_PATH}
                    fill="none"
                    stroke={emissiveHex}
                    strokeWidth={isCriticalStrain ? 1.5 + criticalBlend * 1.5 : 0.8 + strainIntensity * 1}
                    strokeLinecap="round"
                    filter="url(#glow-emissive-amber)"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values={isCriticalStrain ? '0.5;1;0.5' : '0.3;0.85;0.3'}
                      dur={`${strainPulseSpeed}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-width"
                      values={isCriticalStrain
                        ? `${1.2 + criticalBlend};${2.5 + criticalBlend * 1.5};${1.2 + criticalBlend}`
                        : `${0.6 + strainIntensity * 0.6};${1.4 + strainIntensity * 1};${0.6 + strainIntensity * 0.6}`}
                      dur={`${strainPulseSpeed}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                  {/* Critical: second spine line — rapid red flash overlay */}
                  {isCriticalStrain && (
                    <path
                      d={SPINE_PATH}
                      fill="none"
                      stroke="#FF2222"
                      strokeWidth={0.5 + criticalBlend * 0.8}
                      strokeLinecap="round"
                      strokeDasharray="2 3"
                      filter="url(#glow-emissive-amber)"
                      opacity="0"
                    >
                      <animate
                        attributeName="opacity"
                        values={`0;${0.6 + criticalBlend * 0.3};0`}
                        dur={`${strainPulseSpeed * 0.5}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-dashoffset"
                        values="0;-10"
                        dur="0.8s"
                        repeatCount="indefinite"
                      />
                    </path>
                  )}

                  {/* Joint hotspots with dynamic emissive material — amber/red */}
                  {JOINT_POINTS.map((jp, i) => {
                    const pulseDur = `${strainPulseSpeed}s`
                    const baseR = isCriticalStrain ? 4 + criticalBlend * 3 : 3 + strainIntensity * 2.5
                    const maxR = isCriticalStrain ? 8 + criticalBlend * 4 : 6 + strainIntensity * 3.5
                    const jointStroke = isCriticalStrain ? '#FF4444' : T.amber
                    const jointFill = isCriticalStrain
                      ? `rgba(255,${Math.round(68 + (1 - criticalBlend) * 90)},68,${0.3 + criticalBlend * 0.3})`
                      : `rgba(245,158,11,${0.2 + strainIntensity * 0.3})`
                    return (
                      <g key={`strain-${i}`}>
                        {/* Expanding alarm ring */}
                        <circle
                          cx={jp.cx} cy={jp.cy} r="4"
                          fill="none" stroke={jointStroke} strokeWidth={isCriticalStrain ? 0.8 : 0.6} opacity="0"
                        >
                          <animate attributeName="r" values={`${baseR};${maxR + 7};${baseR}`} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values={isCriticalStrain ? '0.7;0;0.7' : '0.5;0;0.5'} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                          <animate attributeName="stroke-width" values={isCriticalStrain ? '0.9;0.05;0.9' : '0.6;0.05;0.6'} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                        </circle>
                        {/* Second ring — staggered */}
                        <circle
                          cx={jp.cx} cy={jp.cy} r="3"
                          fill="none" stroke={emissiveBright} strokeWidth="0.3" opacity="0"
                        >
                          <animate attributeName="r" values={`${baseR * 0.8};${maxR + 4};${baseR * 0.8}`} dur={pulseDur} begin={`${i * 0.12 + 0.2}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values={isCriticalStrain ? '0.5;0;0.5' : '0.3;0;0.3'} dur={pulseDur} begin={`${i * 0.12 + 0.2}s`} repeatCount="indefinite" />
                        </circle>
                        {/* Critical: third rapid ring */}
                        {isCriticalStrain && (
                          <circle
                            cx={jp.cx} cy={jp.cy} r="2"
                            fill="none" stroke="#FF2222" strokeWidth="0.5" opacity="0"
                          >
                            <animate attributeName="r" values={`${baseR * 0.6};${maxR + 10}`} dur={`${strainPulseSpeed * 0.4}s`} begin={`${i * 0.1}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values={`${0.5 + criticalBlend * 0.3};0`} dur={`${strainPulseSpeed * 0.4}s`} begin={`${i * 0.1}s`} repeatCount="indefinite" />
                          </circle>
                        )}
                        {/* Core emissive dot */}
                        <circle
                          cx={jp.cx} cy={jp.cy} r={baseR}
                          fill={jointFill}
                          filter="url(#glow-emissive-amber)"
                        >
                          <animate attributeName="r" values={`${baseR};${maxR};${baseR}`} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values={isCriticalStrain ? '0.6;1;0.6' : '0.4;0.9;0.4'} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                        </circle>
                        {/* Inner bright emissive core */}
                        <circle cx={jp.cx} cy={jp.cy} r={isCriticalStrain ? 2 : 1.5} fill={emissiveBright} opacity={isCriticalStrain ? 0.6 + criticalBlend * 0.3 : 0.4 + strainIntensity * 0.3}>
                          <animate attributeName="opacity" values={isCriticalStrain ? `${0.5 + criticalBlend * 0.3};1;${0.5 + criticalBlend * 0.3}` : `${0.3 + strainIntensity * 0.2};${0.8 + strainIntensity * 0.2};${0.3 + strainIntensity * 0.2}`} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                          <animate attributeName="r" values={isCriticalStrain ? '1.5;3;1.5' : '1;2;1'} dur={pulseDur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                        </circle>
                      </g>
                    )
                  })}

                  {/* Strain region path overlays — amber/red tint on all strain areas */}
                  {BODY_REGIONS.filter(r => STRAIN_REGIONS.has(r.id) && r.path).map(regionDef => {
                    const isCore = CORE_REGIONS.has(regionDef.id)
                    const fillAlpha = isCriticalStrain
                      ? (isCore ? 0.12 + criticalBlend * 0.15 : 0.08 + criticalBlend * 0.12)
                      : (isCore ? 0.06 + strainIntensity * 0.1 : 0.04 + strainIntensity * 0.08)
                    const strokeAlpha = isCriticalStrain
                      ? 0.3 + criticalBlend * 0.3
                      : 0.15 + strainIntensity * 0.25
                    const regionColor = isCriticalStrain
                      ? `rgba(255,${Math.round(68 + (1 - criticalBlend) * 90)},68`
                      : 'rgba(245,158,11'
                    return (
                      <path
                        key={`strain-region-${regionDef.id}`}
                        d={regionDef.path}
                        fill={`${regionColor},${fillAlpha})`}
                        stroke={`${regionColor},${strokeAlpha})`}
                        strokeWidth={isCriticalStrain ? '0.5' : '0.3'}
                        opacity="0.7"
                      >
                        <animate
                          attributeName="opacity"
                          values={isCriticalStrain ? '0.5;0.95;0.5' : '0.4;0.85;0.4'}
                          dur={`${isCore ? strainPulseSpeed : strainPulseSpeed * 1.2}s`}
                          repeatCount="indefinite"
                        />
                      </path>
                    )
                  })}

                  {/* ── CRITICAL: Full-body red vignette warning border ── */}
                  {isCriticalStrain && (
                    <rect
                      x="0" y="0" width="100" height="100"
                      fill="none"
                      stroke="#FF4444"
                      strokeWidth={0.3 + criticalBlend * 0.5}
                      rx="4"
                      opacity="0"
                    >
                      <animate
                        attributeName="opacity"
                        values={`0;${0.2 + criticalBlend * 0.25};0`}
                        dur={`${strainPulseSpeed * 0.8}s`}
                        repeatCount="indefinite"
                      />
                    </rect>
                  )}
                </g>
              )}

              {/* Active region highlights with glassmorphism */}
              {activeRegions.map(regionDef => {
                const data = regionDataMap.get(regionDef.id)
                if (!data || !regionDef.path) return null
                const isSelected = selectedRegion === regionDef.id
                const isPressed = pressedRegion === regionDef.id
                const color = severityColor(data.severity)
                const opacity = Math.min(0.7, data.heatIntensity / 100 * 0.6 + 0.1)
                const filterName = `glow-${data.severity === 'none' ? 'low' : data.severity}`
                const glassFill = data.severity === 'critical' ? 'url(#glass-fill-red)'
                  : data.severity === 'high' ? 'url(#glass-fill-orange)'
                  : data.severity === 'moderate' ? 'url(#glass-fill-gold)'
                  : 'url(#glass-fill-blue)'

                return (
                  <g
                    key={regionDef.id}
                    onClick={() => handleRegionTap(regionDef.id, regionDef.cx, regionDef.cy)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={regionDef.cx} cy={regionDef.cy}
                      r={regionDef.r * (isSelected ? 1.3 : 1)}
                      fill={`${color}${Math.round(opacity * 40).toString(16).padStart(2, '0')}`}
                      filter={`url(#${filterName})`}
                      style={{
                        transform: isPressed ? 'scale(1.3)' : 'scale(1)',
                        transformOrigin: `${regionDef.cx}px ${regionDef.cy}px`,
                        transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      <animate attributeName="r" values={`${regionDef.r * 0.9};${regionDef.r * 1.15};${regionDef.r * 0.9}`} dur={data.severity === 'critical' ? '1.5s' : '4s'} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;1;0.6" dur={data.severity === 'critical' ? '1.5s' : '4s'} repeatCount="indefinite" />
                    </circle>

                    <circle
                      cx={regionDef.cx} cy={regionDef.cy}
                      r={regionDef.r * 0.55}
                      fill={glassFill}
                      stroke={`${color}44`}
                      strokeWidth="0.3"
                      filter="url(#glass-depth)"
                      opacity={isSelected ? 1 : 0.85}
                    >
                      <animate attributeName="cy" values={`${regionDef.cy};${regionDef.cy - 0.5};${regionDef.cy}`} dur="3.5s" repeatCount="indefinite" />
                    </circle>

                    <ellipse
                      cx={regionDef.cx} cy={regionDef.cy - regionDef.r * 0.15}
                      rx={regionDef.r * 0.35} ry={regionDef.r * 0.18}
                      fill="rgba(255,255,255,0.08)"
                      filter="url(#glass-refract)"
                    />

                    {regionDef.path && (
                      <path
                        d={regionDef.path}
                        fill={`${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`}
                        stroke={isSelected ? color : 'transparent'}
                        strokeWidth={isSelected ? '0.5' : '0'}
                        opacity={isSelected ? 1 : 0.7}
                        style={{ transition: 'opacity 300ms ease, stroke-width 200ms ease' }}
                      />
                    )}

                    <circle
                      cx={regionDef.cx + regionDef.r * 0.6} cy={regionDef.cy - regionDef.r * 0.5}
                      r="1.2" fill={color} filter="url(#glass-depth)"
                    >
                      {data.severity === 'critical' && (
                        <animate attributeName="r" values="1;1.8;1" dur="0.8s" repeatCount="indefinite" />
                      )}
                    </circle>

                    {isPressed && (
                      <>
                        <circle cx={regionDef.cx} cy={regionDef.cy} r="3" fill="none" stroke={color} strokeWidth="1.5" opacity="0.8">
                          <animate attributeName="r" from="3" to="18" dur="0.6s" fill="freeze" />
                          <animate attributeName="opacity" from="0.8" to="0" dur="0.6s" fill="freeze" />
                          <animate attributeName="stroke-width" from="1.5" to="0.2" dur="0.6s" fill="freeze" />
                        </circle>
                        <circle cx={regionDef.cx} cy={regionDef.cy} r="2" fill="none" stroke={color} strokeWidth="1" opacity="0.5">
                          <animate attributeName="r" from="2" to="12" dur="0.5s" begin="0.08s" fill="freeze" />
                          <animate attributeName="opacity" from="0.5" to="0" dur="0.5s" begin="0.08s" fill="freeze" />
                        </circle>
                      </>
                    )}
                  </g>
                )
              })}

              {/* Haptic ripple effects */}
              {hapticRipples.map(ripple => (
                <g key={ripple.id}>
                  <circle cx={ripple.cx} cy={ripple.cy} r="2" fill={ripple.color} opacity="0.6">
                    <animate attributeName="r" from="2" to="20" dur="0.65s" fill="freeze" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="0.65s" fill="freeze" />
                  </circle>
                  <circle cx={ripple.cx} cy={ripple.cy} r="1" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8">
                    <animate attributeName="r" from="1" to="14" dur="0.5s" begin="0.05s" fill="freeze" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="0.5s" begin="0.05s" fill="freeze" />
                    <animate attributeName="stroke-width" from="0.8" to="0.1" dur="0.5s" begin="0.05s" fill="freeze" />
                  </circle>
                </g>
              ))}

              {/* Stabilized region overlays */}
              {BODY_REGIONS.filter(r => stabilizedRegions.has(r.id) && r.path).map(regionDef => {
                const hasActiveData = regionDataMap.has(regionDef.id)
                if (hasActiveData) return null
                return (
                  <g key={`stab-${regionDef.id}`}>
                    <circle cx={regionDef.cx} cy={regionDef.cy} r={regionDef.r} fill="rgba(0,220,130,0.08)" filter="url(#glow-stabilized)">
                      <animate attributeName="r" values={`${regionDef.r * 0.9};${regionDef.r * 1.1};${regionDef.r * 0.9}`} dur="3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={regionDef.cx} cy={regionDef.cy} r={regionDef.r * 0.5} fill="url(#glass-fill-green)" stroke="rgba(0,220,130,0.25)" strokeWidth="0.3" filter="url(#glass-depth)" />
                    <path d={regionDef.path} fill="rgba(0,220,130,0.12)" stroke="rgba(0,220,130,0.3)" strokeWidth="0.4" opacity="0.8" />
                    <circle cx={regionDef.cx + regionDef.r * 0.6} cy={regionDef.cy - regionDef.r * 0.5} r="1.2" fill={T.green} filter="url(#glass-depth)" />
                  </g>
                )
              })}

              {/* Override active regions with green when stabilized */}
              {activeRegions.filter(r => stabilizedRegions.has(r.id)).map(regionDef => (
                <g key={`stab-active-${regionDef.id}`} style={{ pointerEvents: 'none' }}>
                  <circle cx={regionDef.cx} cy={regionDef.cy} r={regionDef.r * 0.7} fill="rgba(0,220,130,0.1)" filter="url(#glow-stabilized)">
                    <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                </g>
              ))}

              {/* No-data state */}
              {!hasData && stabilizedRegions.size === 0 && (
                <circle cx="50" cy="50" r="30" fill="none" stroke={T.blue} strokeWidth="0.15" opacity="0.3">
                  <animate attributeName="r" values="28;32;28" dur="4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0.4;0.2" dur="4s" repeatCount="indefinite" />
                </circle>
              )}
            </svg>

            {/* Region labels for active zones */}
            {!showInsightPanel && hasData && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 14 }}>
                {activeRegions.slice(0, 6).map(regionDef => {
                  const data = regionDataMap.get(regionDef.id)
                  if (!data) return null
                  const color = severityColor(data.severity)
                  return (
                    <button
                      key={regionDef.id}
                      className="soft-clinch"
                      onClick={() => handleRegionTap(regionDef.id, regionDef.cx, regionDef.cy)}
                      style={{
                        padding: '4px 10px', borderRadius: 8,
                        background: severityGlow(data.severity),
                        border: `1px solid ${color}33`,
                        fontSize: 9, fontWeight: 600,
                        fontFamily: "'Inter', system-ui, sans-serif",
                        letterSpacing: '0.04em',
                        color, cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      {regionDef.label}
                      {data.isRecurring && ' \u27F3'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Empty state */}
            {!hasData && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <div style={{ fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif", color: T.textTer, fontWeight: 500 }}>
                  No somatic data yet
                </div>
                <div style={{ fontSize: 10, fontFamily: "'Inter', system-ui, sans-serif", color: T.textTer, marginTop: 4, opacity: 0.7 }}>
                  Use Quick Check-In to log body sensations
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Insight Panel */}
        <AnimatePresence>
          {showInsightPanel && selectedData && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: '55%' }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <div className="luxury-surface" style={{ padding: 16, position: 'relative' }}>
                <button
                  className="soft-clinch"
                  onClick={handleClose}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 26, height: 26, borderRadius: 13,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: T.textTer,
                    fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  \u2715
                </button>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div className="bio-breathe" style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: severityColor(selectedData.severity),
                      boxShadow: `0 0 8px ${severityColor(selectedData.severity)}`,
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>
                      {BODY_REGIONS.find(r => r.id === selectedData.region)?.label || selectedData.region}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="mono-label" style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 8,
                      background: severityGlow(selectedData.severity),
                      color: severityColor(selectedData.severity),
                    }}>
                      {selectedData.severity}
                    </span>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 8,
                      fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600,
                      background: 'rgba(255,255,255,0.04)',
                      color: T.textSec, letterSpacing: '0.06em',
                    }}>
                      HEAT {selectedData.heatIntensity}
                    </span>
                    {selectedData.isRecurring && (
                      <span className="mono-label" style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 8,
                        background: T.orangeGlow, color: T.orange,
                      }}>
                        \u27F3 {selectedData.consecutiveDays}D RECURRING
                      </span>
                    )}
                    {isStrained && STRAIN_REGIONS.has(selectedData.region) && (
                      <span className="mono-label" style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 8,
                        background: isCriticalStrain ? 'rgba(255,68,68,0.15)' : T.amberGlow,
                        color: isCriticalStrain ? T.red : T.amber,
                        border: isCriticalStrain ? '1px solid rgba(255,68,68,0.3)' : 'none',
                        animation: isCriticalStrain
                          ? `strain-badge-pulse ${strainPulseSpeed}s ease-in-out infinite`
                          : 'strain-badge-pulse 2s ease-in-out infinite',
                      }}>
                        {isCriticalStrain ? '\u{1F6A8}' : '\u26A1'} {isCriticalStrain ? 'CRITICAL' : CORE_REGIONS.has(selectedData.region) ? 'EMISSIVE CORE' : 'STRAIN ZONE'}
                      </span>
                    )}
                    {isFlowState && (
                      <span className="mono-label" style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 8,
                        background: T.tealGlow, color: T.teal,
                        animation: 'flow-badge-shimmer 3s ease-in-out infinite',
                      }}>
                        \u2728 FLOW STATE
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Insight */}
                {selectedData.aiInsight && (
                  <div style={{
                    padding: 12, borderRadius: 12,
                    background: 'rgba(59,130,246,0.06)',
                    border: `1px solid ${T.borderBlue}`,
                    marginBottom: 12,
                  }}>
                    <div className="mono-label" style={{ fontSize: 8, color: T.blueBright, marginBottom: 6 }}>
                      \uD83E\uDDE0 AI CORRELATION
                    </div>
                    <div style={{
                      fontSize: 11, lineHeight: 1.6, color: T.text,
                      fontFamily: "'Inter', system-ui, sans-serif",
                    }}>
                      {selectedData.aiInsight}
                    </div>
                  </div>
                )}

                {/* Meal Correlations */}
                {selectedData.mealCorrelations.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="mono-label" style={{ fontSize: 8, color: T.textSec, marginBottom: 8 }}>
                      NUTRITION CORRELATIONS
                    </div>
                    {selectedData.mealCorrelations.map((mc, i) => (
                      <div key={i} className="bio-fade-in" style={{
                        padding: 10, borderRadius: 10,
                        background: mc.isAntiInflammatory ? 'rgba(0,220,130,0.05)' : 'rgba(232,151,108,0.05)',
                        border: `1px solid ${mc.isAntiInflammatory ? 'rgba(0,220,130,0.15)' : 'rgba(232,151,108,0.15)'}`,
                        marginBottom: 6,
                        animationDelay: `${i * 80}ms`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                            {mc.isAntiInflammatory ? '\uD83D\uDEE1\uFE0F' : '\u26A0\uFE0F'} {mc.mealName}
                          </span>
                          <span style={{ fontSize: 9, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500, color: T.textTer }}>
                            {mc.hoursAgo.toFixed(1)}h ago
                          </span>
                        </div>
                        <div style={{ fontSize: 10, lineHeight: 1.5, color: T.textSec, fontStyle: 'italic' }}>
                          {mc.mechanism}
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{
                              width: `${mc.confidence * 100}%`, height: '100%', borderRadius: 1,
                              background: mc.confidence > 0.7 ? T.green : mc.confidence > 0.5 ? T.blue : T.textTer,
                              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                            }} />
                          </div>
                          <span style={{ fontSize: 8, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, color: T.textTer }}>
                            {Math.round(mc.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent descriptions */}
                {selectedData.descriptions.length > 0 && (
                  <div>
                    <div className="mono-label" style={{ fontSize: 8, color: T.textSec, marginBottom: 8 }}>
                      RECENT LOGS
                    </div>
                    {selectedData.descriptions.slice(0, 3).map((desc, i) => (
                      <div key={i} className="bio-fade-in" style={{
                        padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)',
                        marginBottom: 4,
                        fontSize: 10, color: T.textSec, lineHeight: 1.5,
                        animationDelay: `${i * 60}ms`,
                      }}>
                        &ldquo;{desc}&rdquo;
                      </div>
                    ))}
                  </div>
                )}

                {/* Biometric context */}
                {bodyData?.biometricContext && (
                  <div style={{
                    marginTop: 12, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${T.border}`,
                    display: 'flex', gap: 16,
                  }}>
                    {bodyData.biometricContext.crp != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: bodyData.biometricContext.crp > 2 ? T.red : bodyData.biometricContext.crp > 1 ? T.orange : T.green, fontFeatureSettings: "'tnum' 1" }}>
                          {bodyData.biometricContext.crp}
                        </div>
                        <div className="mono-label" style={{ fontSize: 7, color: T.textTer }}>CRP mg/L</div>
                      </div>
                    )}
                    {bodyData.biometricContext.hrvCurrent != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: bodyData.biometricContext.hrvCurrent > 50 ? T.green : T.orange, fontFeatureSettings: "'tnum' 1" }}>
                          {bodyData.biometricContext.hrvCurrent}
                        </div>
                        <div className="mono-label" style={{ fontSize: 7, color: T.textTer }}>HRV ms</div>
                      </div>
                    )}
                    {bodyData.biometricContext.sleepScore != null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: bodyData.biometricContext.sleepScore > 75 ? T.green : T.orange, fontFeatureSettings: "'tnum' 1" }}>
                          {bodyData.biometricContext.sleepScore}
                        </div>
                        <div className="mono-label" style={{ fontSize: 7, color: T.textTer }}>SLEEP</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom summary bar */}
      {hasData && !showInsightPanel && (
        <div className="bio-breathe-glow" style={{
          marginTop: 14, padding: '12px 16px', borderRadius: 14,
          background: T.surfaceLight,
          border: `1px solid ${isStrained ? 'rgba(245,158,11,0.12)' : isFlowState ? 'rgba(0,255,204,0.12)' : T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFeatureSettings: "'tnum' 1" }}>{bodyData!.totalActiveRegions}</div>
              <div className="mono-label" style={{ fontSize: 7, color: T.textTer }}>ACTIVE ZONES</div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: bodyData!.mealCorrelationsFound > 0 ? T.orange : T.textTer, fontFeatureSettings: "'tnum' 1" }}>
                {bodyData!.mealCorrelationsFound}
              </div>
              <div className="mono-label" style={{ fontSize: 7, color: T.textTer }}>MEAL LINKS</div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: stabilityColor, fontFeatureSettings: "'tnum' 1" }}>
                {systemStability}%
              </div>
              <div className="mono-label" style={{ fontSize: 7, color: T.textTer }}>
                {isFlowState ? 'FLOW' : isStrained ? 'STRAIN' : 'STABILITY'}
              </div>
            </div>
          </div>
          {bodyData!.recentMeals.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="mono-label" style={{ fontSize: 7, color: T.textTer, marginBottom: 3 }}>LAST MEAL</div>
              <div style={{ fontSize: 11, color: T.textSec, fontWeight: 600, fontFamily: "'Inter', system-ui, sans-serif" }}>
                {bodyData!.recentMeals[0].name.slice(0, 24)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
