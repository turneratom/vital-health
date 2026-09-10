import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useBiometricSync } from '@/hooks/useBiometricSync'

/* ── HUD Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.12)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.12)',
  gold: '#FFD700',
  purple: '#A78BFA',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

/* ── Body Zone Definitions ── */
interface BodyZone {
  id: string
  label: string
  muscleGroups: string[]
  path: string
  cx: number; cy: number
  protocols: string[]
  biomarkers: string[]
  metabolicWeight: number // 0-1, how metabolically active
}

const BODY_ZONES: BodyZone[] = [
  {
    id: 'head', label: 'Head & CNS',
    muscleGroups: ['neck', 'traps', 'head'],
    path: 'M50,6 C50,6 45.5,2 42,2 C38,2 34,5 34,11 C34,17 37,22 42,24 L42,28 L50,28 L50,24 C55,22 58,17 58,11 C58,5 54,2 50,2 Z',
    cx: 46, cy: 13, metabolicWeight: 0.2,
    protocols: ['Box Breathing 4-7-8', 'Cervical Decompression', 'NSDR Protocol'],
    biomarkers: ['Cortisol', 'HRV', 'Stress Index'],
  },
  {
    id: 'shoulders', label: 'Shoulders & Delts',
    muscleGroups: ['shoulders', 'delts', 'deltoids', 'rotator cuff'],
    path: 'M30,32 C26,32 18,36 15,41 L15,46 L30,40 Z M62,32 C66,32 74,36 77,41 L77,46 L62,40 Z',
    cx: 46, cy: 38, metabolicWeight: 0.4,
    protocols: ['Shoulder CARs', 'Band Pull-Aparts', 'Dead Hang 60s'],
    biomarkers: ['CRP', 'Recovery %', 'Strain'],
  },
  {
    id: 'chest', label: 'Chest & Thorax',
    muscleGroups: ['chest', 'pecs', 'pectorals'],
    path: 'M33,32 L59,32 L62,40 L58,48 L34,48 L30,40 Z',
    cx: 46, cy: 40, metabolicWeight: 0.5,
    protocols: ['Pec Doorway Stretch', 'Diaphragmatic Breathing', 'Foam Roll Thoracic'],
    biomarkers: ['Respiratory Rate', 'SpO2', 'Recovery %'],
  },
  {
    id: 'arms', label: 'Arms & Forearms',
    muscleGroups: ['biceps', 'triceps', 'forearms', 'arms'],
    path: 'M15,46 L13,62 L11,78 L16,78 L19,64 L23,50 Z M77,46 L69,50 L73,64 L76,78 L81,78 L79,62 Z',
    cx: 46, cy: 62, metabolicWeight: 0.3,
    protocols: ['Wrist CARs', 'Grip Hangs', 'Forearm Stretch'],
    biomarkers: ['Grip Strength', 'Recovery %', 'Strain'],
  },
  {
    id: 'core', label: 'Core & Viscera',
    muscleGroups: ['core', 'abs', 'obliques', 'abdominals'],
    path: 'M36,48 L56,48 L58,64 L54,70 L38,70 L34,64 Z',
    cx: 46, cy: 58, metabolicWeight: 0.8,
    protocols: ['Dead Bug 3×10', 'Diaphragmatic Breathing', 'McGill Curl-Up'],
    biomarkers: ['Cortisol', 'HbA1c', 'Metabolic Rate'],
  },
  {
    id: 'lower-back', label: 'Lumbar & Spine',
    muscleGroups: ['lower back', 'erectors', 'lumbar', 'spinal erectors'],
    path: 'M36,56 L56,56 L58,70 L54,74 L38,74 L34,70 Z',
    cx: 46, cy: 65, metabolicWeight: 0.6,
    protocols: ['Cat-Cow 2min', 'Child\'s Pose', 'McGill Big 3'],
    biomarkers: ['CRP', 'Cortisol', 'Sleep Score'],
  },
  {
    id: 'hips', label: 'Hips & Glutes',
    muscleGroups: ['glutes', 'hips', 'hip flexors', 'gluteus'],
    path: 'M32,70 L60,70 L62,80 L56,84 L36,84 L30,80 Z',
    cx: 46, cy: 76, metabolicWeight: 0.7,
    protocols: ['Hip 90/90 Flow', 'Pigeon Stretch', 'Glute Bridge 3×12'],
    biomarkers: ['Recovery %', 'Strain', 'Steps'],
  },
  {
    id: 'quads', label: 'Quadriceps',
    muscleGroups: ['quads', 'quadriceps', 'legs', 'thighs'],
    path: 'M34,84 L44,84 L42,106 L32,106 Z M48,84 L58,84 L60,106 L50,106 Z',
    cx: 46, cy: 95, metabolicWeight: 0.7,
    protocols: ['Quad Foam Roll', 'Couch Stretch', 'Wall Sit 60s'],
    biomarkers: ['Lactate', 'Strain', 'Recovery %'],
  },
  {
    id: 'knees', label: 'Knees',
    muscleGroups: ['knees'],
    path: 'M32,106 L42,106 L42,112 L32,112 Z M50,106 L60,106 L60,112 L50,112 Z',
    cx: 46, cy: 109, metabolicWeight: 0.2,
    protocols: ['Knee CARs', 'Terminal Extension', 'Step-Downs'],
    biomarkers: ['CRP', 'Joint Mobility', 'Recovery %'],
  },
  {
    id: 'calves', label: 'Calves & Ankles',
    muscleGroups: ['calves', 'ankles', 'tibialis', 'lower legs'],
    path: 'M32,112 L40,112 L38,136 L30,136 Z M52,112 L60,112 L62,136 L54,136 Z',
    cx: 46, cy: 124, metabolicWeight: 0.4,
    protocols: ['Calf Raises 3×15', 'Ankle CARs', 'Tibialis Raises'],
    biomarkers: ['Steps', 'Strain', 'Recovery %'],
  },
]

/* ── Strain Levels ── */
type StrainLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical'

interface ZoneState {
  zone: BodyZone
  strainLevel: StrainLevel
  strainScore: number
  recentWorkouts: string[]
  hoursAgo: number
  color: string
  glowColor: string
  opacity: number
  pulseSpeed: number
  metabolicHeat: number // 0-1 metabolic activity
  tooltip: {
    title: string
    strain: string
    recovery: string
    protocols: string[]
    biomarkers: { name: string; status: string; color: string }[]
  }
}

function getStrainVisuals(level: StrainLevel) {
  switch (level) {
    case 'critical': return { color: '#FF4444', glow: 'rgba(255,68,68,0.4)', opacity: 0.92, pulse: 1.0 }
    case 'high': return { color: '#FF6B6B', glow: 'rgba(255,107,107,0.3)', opacity: 0.75, pulse: 1.6 }
    case 'moderate': return { color: '#E8976C', glow: 'rgba(232,151,108,0.22)', opacity: 0.55, pulse: 2.4 }
    case 'low': return { color: '#00DC82', glow: 'rgba(0,220,130,0.15)', opacity: 0.35, pulse: 3.5 }
    case 'none': default: return { color: '#3B82F6', glow: 'rgba(59,130,246,0.06)', opacity: 0.1, pulse: 0 }
  }
}

function getStrainLabel(level: StrainLevel): string {
  switch (level) {
    case 'critical': return 'CRITICAL'
    case 'high': return 'HIGH STRAIN'
    case 'moderate': return 'MODERATE'
    case 'low': return 'RECOVERED'
    case 'none': default: return 'BASELINE'
  }
}

function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id')
    if (!id) { id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('vive-session-id', id) }
    return id
  } catch { return 'guest-user' }
}

/* ── Animated Spine Energy Flow ── */
function SpineEnergyFlow({ readiness }: { readiness: number }) {
  const color = readiness >= 70 ? T.green : readiness >= 50 ? T.orange : T.red
  return (
    <g opacity={0.6}>
      {/* Spine line */}
      <line x1="46" y1="28" x2="46" y2="84" stroke={`${color}30`} strokeWidth={1} strokeDasharray="2,4" />
      {/* Flowing energy particles */}
      <circle r="1.5" fill={color} opacity={0.8}>
        <animateMotion dur="3s" repeatCount="indefinite" path="M46,28 L46,84" />
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle r="1" fill={color} opacity={0.5}>
        <animateMotion dur="3s" repeatCount="indefinite" path="M46,28 L46,84" begin="1s" />
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3s" repeatCount="indefinite" begin="1s" />
      </circle>
      <circle r="1.2" fill={color} opacity={0.6}>
        <animateMotion dur="3s" repeatCount="indefinite" path="M46,28 L46,84" begin="2s" />
        <animate attributeName="opacity" values="0.6;0.15;0.6" dur="3s" repeatCount="indefinite" begin="2s" />
      </circle>
    </g>
  )
}

/* ── Metabolic Heat Overlay ── */
function MetabolicHeatOverlay({ zones }: { zones: ZoneState[] }) {
  const hotZones = zones.filter(z => z.metabolicHeat > 0.3)
  if (hotZones.length === 0) return null
  return (
    <g>
      {hotZones.map(z => (
        <circle
          key={`heat-${z.zone.id}`}
          cx={z.zone.cx} cy={z.zone.cy}
          r={8 + z.metabolicHeat * 12}
          fill="none"
          stroke={z.color}
          strokeWidth={0.5}
          opacity={z.metabolicHeat * 0.2}
          style={{ pointerEvents: 'none' }}
        >
          <animate
            attributeName="r"
            values={`${8 + z.metabolicHeat * 10};${12 + z.metabolicHeat * 14};${8 + z.metabolicHeat * 10}`}
            dur={`${3 + (1 - z.metabolicHeat) * 2}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={`${z.metabolicHeat * 0.2};${z.metabolicHeat * 0.08};${z.metabolicHeat * 0.2}`}
            dur={`${3 + (1 - z.metabolicHeat) * 2}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  )
}

/* ── Readiness Ring ── */
function ReadinessRing({ value, size = 44 }: { value: number; size?: number }) {
  const color = value >= 70 ? T.green : value >= 50 ? T.orange : T.red
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 4px ${color}50)`, transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 14, fontFamily: 'monospace', fontWeight: 900, color,
          lineHeight: 1, textShadow: `0 0 12px ${color}40`,
        }}>
          {Math.round(value)}
        </span>
        <span style={{
          fontSize: 5, fontFamily: 'monospace', color: T.textTer,
          letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 1,
        }}>
          READY
        </span>
      </div>
    </div>
  )
}

/* ── Zone Strain Summary Chips ── */
function StrainChips({ zones, onSelect }: { zones: ZoneState[]; onSelect: (id: string) => void }) {
  const strained = zones
    .filter(z => z.strainLevel !== 'none' && z.strainLevel !== 'low')
    .sort((a, b) => b.strainScore - a.strainScore)
    .slice(0, 4)

  if (strained.length === 0) return (
    <div style={{
      fontSize: 8, fontFamily: 'monospace', color: T.green,
      padding: '4px 8px', borderRadius: 6,
      background: 'rgba(0,220,130,0.06)', border: '1px solid rgba(0,220,130,0.12)',
      textAlign: 'center',
    }}>
      ✓ All zones recovered — ready for output
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{
        fontSize: 6.5, fontFamily: 'monospace', color: T.textTer,
        letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 1,
      }}>
        ATTENTION ZONES
      </div>
      {strained.map(z => (
        <div
          key={z.zone.id}
          onClick={() => onSelect(z.zone.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 7px', borderRadius: 6, cursor: 'pointer',
            background: `${z.color}08`, border: `1px solid ${z.color}12`,
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: 2, flexShrink: 0,
            background: z.color, boxShadow: `0 0 6px ${z.glowColor}`,
          }} />
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textSec, flex: 1 }}>
            {z.zone.label}
          </span>
          <span style={{
            fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: z.color,
            letterSpacing: '0.05em',
          }}>
            {z.strainScore}%
          </span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SOMATIC MIRROR — Body-Scan Visualization
   Minimalist SVG silhouette with dynamic metabolic/musculoskeletal
   strain highlighting. At-a-glance physical readiness.
   ═══════════════════════════════════════════════════════════════ */

export default function SomaticMirror({ compact = false }: { compact?: boolean }) {
  const sessionId = useMemo(() => getSessionId(), [])
  const { vitals } = useBiometricSync()
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [breathPhase, setBreathPhase] = useState(0)

  // Subtle breathing animation for the silhouette
  useEffect(() => {
    const iv = setInterval(() => setBreathPhase(p => (p + 1) % 360), 50)
    return () => clearInterval(iv)
  }, [])

  const breathScale = 1 + Math.sin((breathPhase * Math.PI) / 180) * 0.003

  // Fetch recent workout logs (72h recovery window)
  const workoutLogs = useQuery(api.queries.getRecentWorkoutLogs, { sessionId }) ?? []

  // Compute zone states from workout data + vitals
  const zoneStates = useMemo<ZoneState[]>(() => {
    const now = Date.now()
    const recoveryFactor = Math.max(0.3, Math.min(1.2, vitals.recovery / 70))
    const globalStrain = vitals.strain

    return BODY_ZONES.map(zone => {
      const matchingWorkouts = workoutLogs.filter((w: any) =>
        w.muscleGroups?.some((mg: string) =>
          zone.muscleGroups.some(zmg =>
            mg.toLowerCase().includes(zmg.toLowerCase()) ||
            zmg.toLowerCase().includes(mg.toLowerCase())
          )
        )
      )

      let strainScore = 0
      const recentNames: string[] = []
      let latestHoursAgo = Infinity

      for (const workout of matchingWorkouts) {
        const hoursAgo = (now - (workout as any).loggedAt) / 3600000
        if (hoursAgo < latestHoursAgo) latestHoursAgo = hoursAgo
        const intensityMult = (workout as any).intensity === 'high' ? 1.0
          : (workout as any).intensity === 'moderate' ? 0.65 : 0.35
        const timeFactor = Math.max(0, 1 - (hoursAgo / 72))
        const durationFactor = Math.min(1.5, (workout as any).duration / 45)
        strainScore += intensityMult * timeFactor * durationFactor * 40
        const wName = (workout as any).workoutName
        if (wName && !recentNames.includes(wName)) recentNames.push(wName)
      }

      strainScore = strainScore / recoveryFactor

      // Ambient strain from global metrics
      if (zone.id === 'lower-back' || zone.id === 'core') strainScore += globalStrain * 1.5
      if (zone.id === 'head') {
        if (vitals.hrv < 40) strainScore += 25
        else if (vitals.hrv < 55) strainScore += 10
      }
      if (zone.id === 'calves' || zone.id === 'knees') {
        strainScore += Math.max(0, (vitals.steps - 8000) / 1000) * 3
      }

      strainScore = Math.min(100, Math.max(0, strainScore))

      let strainLevel: StrainLevel = 'none'
      if (strainScore >= 80) strainLevel = 'critical'
      else if (strainScore >= 55) strainLevel = 'high'
      else if (strainScore >= 30) strainLevel = 'moderate'
      else if (strainScore >= 10) strainLevel = 'low'

      const vis = getStrainVisuals(strainLevel)

      // Metabolic heat = combination of strain + zone metabolic weight
      const metabolicHeat = Math.min(1, (strainScore / 100) * 0.6 + zone.metabolicWeight * 0.4)

      const biomarkerStatus = zone.biomarkers.map(bm => {
        if (bm === 'HRV') return { name: bm, status: `${Math.round(vitals.hrv)}ms`, color: vitals.hrv >= 55 ? T.green : vitals.hrv >= 40 ? T.orange : T.red }
        if (bm === 'Recovery %') return { name: bm, status: `${Math.round(vitals.recovery)}%`, color: vitals.recovery >= 70 ? T.green : vitals.recovery >= 50 ? T.orange : T.red }
        if (bm === 'Strain') return { name: bm, status: `${vitals.strain.toFixed(1)}`, color: vitals.strain > 14 ? T.red : vitals.strain > 8 ? T.orange : T.green }
        if (bm === 'SpO2') return { name: bm, status: `${vitals.spo2.toFixed(1)}%`, color: vitals.spo2 >= 96 ? T.green : T.red }
        if (bm === 'Sleep Score') return { name: bm, status: `${Math.round(vitals.sleepScore)}`, color: vitals.sleepScore >= 80 ? T.green : vitals.sleepScore >= 60 ? T.orange : T.red }
        if (bm === 'Respiratory Rate') return { name: bm, status: `${vitals.respiratoryRate.toFixed(1)}`, color: T.blue }
        if (bm === 'Steps') return { name: bm, status: `${vitals.steps.toLocaleString()}`, color: vitals.steps >= 8000 ? T.green : T.orange }
        if (bm === 'Cortisol') return { name: bm, status: vitals.stress > 60 ? 'Elevated' : 'Normal', color: vitals.stress > 60 ? T.orange : T.green }
        if (bm === 'Stress Index') return { name: bm, status: `${Math.round(vitals.stress)}`, color: vitals.stress > 60 ? T.red : vitals.stress > 40 ? T.orange : T.green }
        if (bm === 'CRP') return { name: bm, status: strainScore > 50 ? 'Watch' : 'Normal', color: strainScore > 50 ? T.orange : T.green }
        if (bm === 'HbA1c') return { name: bm, status: 'Tracking', color: T.blue }
        if (bm === 'Metabolic Rate') return { name: bm, status: 'Active', color: T.accent }
        if (bm === 'Lactate') return { name: bm, status: strainScore > 60 ? 'Elevated' : 'Normal', color: strainScore > 60 ? T.orange : T.green }
        if (bm === 'Joint Mobility') return { name: bm, status: strainScore > 40 ? 'Restricted' : 'Good', color: strainScore > 40 ? T.orange : T.green }
        if (bm === 'Grip Strength') return { name: bm, status: 'Normal', color: T.green }
        return { name: bm, status: '—', color: T.textTer }
      })

      let recoveryEst = 'Fully recovered'
      if (strainLevel === 'critical') recoveryEst = '24-48h recovery'
      else if (strainLevel === 'high') recoveryEst = '12-24h recovery'
      else if (strainLevel === 'moderate') recoveryEst = '6-12h recovery'
      else if (strainLevel === 'low') recoveryEst = 'Nearly recovered'

      return {
        zone, strainLevel, strainScore: Math.round(strainScore),
        recentWorkouts: recentNames,
        hoursAgo: latestHoursAgo === Infinity ? -1 : Math.round(latestHoursAgo),
        color: vis.color, glowColor: vis.glow, opacity: vis.opacity,
        pulseSpeed: vis.pulse, metabolicHeat,
        tooltip: {
          title: zone.label, strain: getStrainLabel(strainLevel),
          recovery: recoveryEst, protocols: zone.protocols.slice(0, 3),
          biomarkers: biomarkerStatus,
        },
      }
    })
  }, [workoutLogs, vitals])

  const overallReadiness = useMemo(() => {
    const avgStrain = zoneStates.reduce((sum, z) => sum + z.strainScore, 0) / zoneStates.length
    return Math.round(Math.max(0, 100 - avgStrain))
  }, [zoneStates])

  const activeZone = zoneStates.find(z => z.zone.id === (selectedZone || hoveredZone))

  const handleZoneClick = useCallback((id: string) => {
    setSelectedZone(prev => prev === id ? null : id)
  }, [])

  const readinessColor = overallReadiness >= 70 ? T.green : overallReadiness >= 50 ? T.orange : T.red
  const svgH = compact ? 260 : 320

  // Strain distribution for the mini bar
  const strainDist = useMemo(() => {
    const counts = { critical: 0, high: 0, moderate: 0, low: 0, none: 0 }
    zoneStates.forEach(z => { counts[z.strainLevel]++ })
    return counts
  }, [zoneStates])

  return (
    <div style={{
      position: 'relative', borderRadius: 16,
      background: T.surface, border: `1px solid ${T.borderBlue}`,
      backdropFilter: 'blur(20px)', overflow: 'hidden',
      padding: compact ? '10px 10px 8px' : '14px 14px 10px',
    }}>
      {/* Ambient background glow based on readiness */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 35% 40%, ${readinessColor}06, transparent 70%)`,
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: compact ? 6 : 10, position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>🫀</span>
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: T.text, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Somatic Mirror
          </span>
          <span style={{
            fontSize: 6.5, fontFamily: 'monospace', fontWeight: 700,
            padding: '1px 5px', borderRadius: 4,
            background: 'rgba(0,255,204,0.08)', color: T.accent,
            letterSpacing: '0.08em',
          }}>
            BODY SCAN
          </span>
        </div>

        {/* Mini strain distribution bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {strainDist.critical > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, background: '#FF4444', boxShadow: '0 0 4px rgba(255,68,68,0.5)' }} />
            <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: '#FF4444' }}>{strainDist.critical}</span>
          </div>}
          {strainDist.high > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, background: T.red }} />
            <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: T.red }}>{strainDist.high}</span>
          </div>}
          {strainDist.moderate > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, background: T.orange }} />
            <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: T.orange }}>{strainDist.moderate}</span>
          </div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: compact ? 6 : 10 }}>
        {/* SVG Silhouette */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg
            viewBox="0 0 92 144"
            width={compact ? 100 : 125}
            height={svgH}
            style={{ display: 'block' }}
          >
            <defs>
              <filter id="sm-glow-crit" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feFlood floodColor="#FF4444" floodOpacity="0.5" />
                <feComposite in2="b" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="sm-glow-hi" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feFlood floodColor="#FF6B6B" floodOpacity="0.4" />
                <feComposite in2="b" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="sm-glow-mod" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feFlood floodColor="#E8976C" floodOpacity="0.3" />
                <feComposite in2="b" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="sm-glow-lo" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feFlood floodColor="#00DC82" floodOpacity="0.2" />
                <feComposite in2="b" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="sm-body-base" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(59,130,246,0.1)" />
                <stop offset="50%" stopColor="rgba(59,130,246,0.04)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0.08)" />
              </linearGradient>
            </defs>

            {/* Base anatomical silhouette */}
            <g
              opacity={0.18}
              stroke="rgba(59,130,246,0.25)"
              strokeWidth={0.6}
              fill="url(#sm-body-base)"
              style={{ transform: `scale(${breathScale})`, transformOrigin: '46px 70px', transition: 'transform 0.1s linear' }}
            >
              {/* Head */}
              <ellipse cx="46" cy="11" rx="10" ry="11" />
              {/* Neck */}
              <rect x="42" y="22" width="8" height="8" rx="3" />
              {/* Torso */}
              <path d="M30,30 L62,30 L64,48 L60,70 L58,84 L34,84 L32,70 L28,48 Z" />
              {/* Left arm */}
              <path d="M28,32 C22,35 16,40 14,46 L12,62 L10,78 L16,78 L19,64 L23,48 L28,38 Z" />
              {/* Right arm */}
              <path d="M64,32 C70,35 76,40 78,46 L80,62 L82,78 L76,78 L73,64 L69,48 L64,38 Z" />
              {/* Left leg */}
              <path d="M34,84 L44,84 L42,108 L40,114 L38,138 L30,138 L32,114 L32,108 Z" />
              {/* Right leg */}
              <path d="M48,84 L58,84 L60,108 L60,114 L62,138 L54,138 L52,114 L50,108 Z" />
            </g>

            {/* Spine energy flow */}
            <SpineEnergyFlow readiness={overallReadiness} />

            {/* Metabolic heat overlay */}
            <MetabolicHeatOverlay zones={zoneStates} />

            {/* Strain zone overlays */}
            {zoneStates.map(zs => {
              const isActive = hoveredZone === zs.zone.id || selectedZone === zs.zone.id
              const filterMap: Record<string, string> = {
                critical: 'url(#sm-glow-crit)', high: 'url(#sm-glow-hi)',
                moderate: 'url(#sm-glow-mod)', low: 'url(#sm-glow-lo)',
              }
              return (
                <g key={zs.zone.id}>
                  <path
                    d={zs.zone.path}
                    fill={zs.color}
                    opacity={isActive ? Math.min(1, zs.opacity + 0.3) : zs.opacity}
                    filter={zs.strainLevel !== 'none' ? filterMap[zs.strainLevel] : undefined}
                    stroke={isActive ? zs.color : 'transparent'}
                    strokeWidth={isActive ? 1.2 : 0}
                    style={{ cursor: 'pointer', transition: 'opacity 0.3s, stroke 0.2s' }}
                    onMouseEnter={() => setHoveredZone(zs.zone.id)}
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={() => handleZoneClick(zs.zone.id)}
                  />
                  {/* Pulse indicator for strained zones */}
                  {zs.strainLevel !== 'none' && zs.strainLevel !== 'low' && (
                    <g style={{ pointerEvents: 'none' }}>
                      <circle cx={zs.zone.cx} cy={zs.zone.cy} r={isActive ? 3 : 2} fill={zs.color} opacity={0.85}>
                        {zs.pulseSpeed > 0 && (
                          <animate attributeName="opacity" values="0.85;0.25;0.85" dur={`${zs.pulseSpeed}s`} repeatCount="indefinite" />
                        )}
                      </circle>
                      {/* Outer ring pulse */}
                      {(zs.strainLevel === 'critical' || zs.strainLevel === 'high') && (
                        <circle cx={zs.zone.cx} cy={zs.zone.cy} r={4} fill="none" stroke={zs.color} strokeWidth={0.5} opacity={0}>
                          <animate attributeName="r" values="3;8;3" dur={`${zs.pulseSpeed * 1.5}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.4;0;0.4" dur={`${zs.pulseSpeed * 1.5}s`} repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  )}
                </g>
              )
            })}

            {/* Symmetry guide lines (subtle) */}
            <line x1="46" y1="0" x2="46" y2="144" stroke="rgba(59,130,246,0.03)" strokeWidth={0.3} />
          </svg>
        </div>

        {/* Right panel — Detail or Summary */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence mode="wait">
            {activeZone ? (
              <motion.div
                key={activeZone.zone.id}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                {/* Zone title + strain badge */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: activeZone.color, boxShadow: `0 0 8px ${activeZone.glowColor}`,
                    }} />
                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: T.text }}>
                      {activeZone.tooltip.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 7.5, fontFamily: 'monospace', fontWeight: 700,
                      color: activeZone.color, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      {activeZone.tooltip.strain}
                    </span>
                    <div style={{
                      height: 3, flex: 1, borderRadius: 2,
                      background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2, width: `${activeZone.strainScore}%`,
                        background: `linear-gradient(90deg, ${activeZone.color}, ${activeZone.color}60)`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, color: activeZone.color }}>
                      {activeZone.strainScore}%
                    </span>
                  </div>
                </div>

                {/* Recovery estimate */}
                <div style={{
                  padding: '4px 8px', borderRadius: 6,
                  background: `${activeZone.color}08`, border: `1px solid ${activeZone.color}15`,
                }}>
                  <div style={{ fontSize: 6.5, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                    RECOVERY WINDOW
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: activeZone.color, fontWeight: 700 }}>
                    {activeZone.tooltip.recovery}
                  </div>
                </div>

                {/* Recent workouts */}
                {activeZone.recentWorkouts.length > 0 && (
                  <div>
                    <div style={{ fontSize: 6.5, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                      RECENT ACTIVITY
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {activeZone.recentWorkouts.map((w, i) => (
                        <span key={i} style={{
                          fontSize: 7.5, fontFamily: 'monospace', fontWeight: 600,
                          padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
                          color: T.textSec,
                        }}>
                          {w}
                        </span>
                      ))}
                      {activeZone.hoursAgo >= 0 && (
                        <span style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, padding: '2px 4px' }}>
                          {activeZone.hoursAgo}h ago
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Biomarkers */}
                <div>
                  <div style={{ fontSize: 6.5, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                    BIOMARKERS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {activeZone.tooltip.biomarkers.slice(0, 3).map((bm, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textSec }}>{bm.name}</span>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: bm.color }}>{bm.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested protocols */}
                <div>
                  <div style={{ fontSize: 6.5, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                    MICRO-PROTOCOLS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {activeZone.tooltip.protocols.map((p, i) => (
                      <div key={i} style={{
                        fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                        color: T.accent, padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(0,255,204,0.06)', border: '1px solid rgba(0,255,204,0.1)',
                      }}>
                        → {p}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                {/* Readiness ring + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ReadinessRing value={overallReadiness} size={compact ? 40 : 48} />
                  <div>
                    <div style={{
                      fontSize: 6.5, fontFamily: 'monospace', color: T.textTer,
                      letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2,
                    }}>
                      PHYSICAL READINESS
                    </div>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textSec, lineHeight: 1.5 }}>
                      {overallReadiness >= 80 ? 'All systems primed for peak output' :
                       overallReadiness >= 60 ? 'Good readiness — minor strain detected' :
                       overallReadiness >= 40 ? 'Moderate strain — prioritize recovery' :
                       'Recovery critical — reduce load today'}
                    </div>
                  </div>
                </div>

                {/* Strain legend */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['critical', 'high', 'moderate', 'low'] as StrainLevel[]).map(level => {
                    const vis = getStrainVisuals(level)
                    const count = zoneStates.filter(z => z.strainLevel === level).length
                    if (count === 0) return null
                    return (
                      <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: 1.5,
                          background: vis.color,
                          boxShadow: `0 0 4px ${vis.glow}`,
                        }} />
                        <span style={{ fontSize: 7.5, fontFamily: 'monospace', color: T.textSec }}>
                          {getStrainLabel(level)}
                        </span>
                        <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: vis.color }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Attention zones */}
                <StrainChips zones={zoneStates} onSelect={handleZoneClick} />

                {/* Quick vitals strip */}
                <div style={{
                  display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2,
                  padding: '5px 6px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
                }}>
                  {[
                    { label: 'HRV', value: `${Math.round(vitals.hrv)}ms`, color: vitals.hrv >= 55 ? T.green : vitals.hrv >= 40 ? T.orange : T.red },
                    { label: 'REC', value: `${Math.round(vitals.recovery)}%`, color: vitals.recovery >= 70 ? T.green : vitals.recovery >= 50 ? T.orange : T.red },
                    { label: 'STR', value: vitals.strain.toFixed(1), color: vitals.strain > 14 ? T.red : vitals.strain > 8 ? T.orange : T.green },
                    { label: 'O₂', value: `${vitals.spo2.toFixed(0)}%`, color: vitals.spo2 >= 96 ? T.green : T.red },
                  ].map(m => (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 6.5, fontFamily: 'monospace', color: T.textTer }}>{m.label}</span>
                      <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: m.color }}>{m.value}</span>
                    </div>
                  ))}
                </div>

                {/* Tap hint */}
                <div style={{
                  fontSize: 7, fontFamily: 'monospace', color: T.textTer,
                  textAlign: 'center', opacity: 0.6, marginTop: 2,
                }}>
                  Tap a body zone for strain data & protocols
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
