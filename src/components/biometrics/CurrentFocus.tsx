import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  computeAllBaselines,
  ageFromDOB,
  type ComputedBaselines,
  type PhysicalProfile,
} from '@/lib/intelligence/BioLogic';

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════════
   CURRENT FOCUS — Metric Progress Ring
   
   Pulls the user's most improved biomarker and wraps it in a
   glowing circular progress bar that mimics FluidCanvas aesthetics.
   Called "Current Optimization Goal". Shows how close they are to
   their Ideal Baseline from BioLogic.ts.
   
   When they reach 100%, the ring dissipates into the background
   pulse, signaling the marker is now "Locked In".
   ══════════════════════════════════════════════════════════════════ */

/* ── Design Tokens ── */
const DT = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00DCAA',
  accentGlow: 'rgba(0,220,170,',
  amber: '#E8B86C',
  amberGlow: 'rgba(232,184,108,',
  locked: '#3B82F6',
  lockedGlow: 'rgba(59,130,246,',
  border: 'rgba(255,255,255,0.05)',
};

/* ── Biomarker ideal ranges (longevity-optimized) ── */
interface BiomarkerIdeal {
  key: string;
  label: string;
  unit: string;
  /** Ideal target value (longevity-optimized) */
  idealValue: number;
  /** Direction: 'lower' means lower is better, 'higher' means higher is better */
  direction: 'lower' | 'higher' | 'range';
  /** For range type: ideal low bound */
  idealLow?: number;
  /** For range type: ideal high bound */
  idealHigh?: number;
  /** Worst-case starting point for progress calculation */
  worstCase: number;
  icon: string;
  encouragement: string;
  lockedMessage: string;
}

const BIOMARKER_IDEALS: BiomarkerIdeal[] = [
  {
    key: 'apoB',
    label: 'ApoB',
    unit: 'mg/dL',
    idealValue: 60,
    direction: 'lower',
    worstCase: 150,
    icon: '🧬',
    encouragement: 'Trending toward elite cardiovascular protection',
    lockedMessage: 'Cardiovascular shield — locked in',
  },
  {
    key: 'hba1c',
    label: 'HbA1c',
    unit: '%',
    idealValue: 4.8,
    direction: 'lower',
    worstCase: 7.0,
    icon: '🩸',
    encouragement: 'Metabolic precision improving steadily',
    lockedMessage: 'Metabolic mastery — locked in',
  },
  {
    key: 'testosterone',
    label: 'Testosterone',
    unit: 'ng/dL',
    idealValue: 800,
    direction: 'higher',
    worstCase: 300,
    icon: '⚡',
    encouragement: 'Hormonal optimization on a strong trajectory',
    lockedMessage: 'Hormonal peak — locked in',
  },
  {
    key: 'vitaminD',
    label: 'Vitamin D',
    unit: 'ng/mL',
    idealValue: 60,
    direction: 'higher',
    worstCase: 15,
    icon: '☀️',
    encouragement: 'Solar optimization building momentum',
    lockedMessage: 'Vitamin D fortress — locked in',
  },
  {
    key: 'hscrp',
    label: 'hs-CRP',
    unit: 'mg/L',
    idealValue: 0.3,
    direction: 'lower',
    worstCase: 5.0,
    icon: '🛡️',
    encouragement: 'Inflammation markers moving in the right direction',
    lockedMessage: 'Inflammation shield — locked in',
  },
  {
    key: 'ferritin',
    label: 'Ferritin',
    unit: 'ng/mL',
    idealValue: 100,
    direction: 'range',
    idealLow: 40,
    idealHigh: 150,
    worstCase: 15,
    icon: '🔋',
    encouragement: 'Iron stores building toward optimal range',
    lockedMessage: 'Iron balance — locked in',
  },
];

/* ── Session helper ── */
/* ── Calculate progress toward ideal ── */
function calculateProgress(
  currentValue: number,
  ideal: BiomarkerIdeal
): number {
  if (ideal.direction === 'lower') {
    // Lower is better: progress = how far from worstCase toward ideal
    if (currentValue <= ideal.idealValue) return 1;
    if (currentValue >= ideal.worstCase) return 0;
    return (ideal.worstCase - currentValue) / (ideal.worstCase - ideal.idealValue);
  } else if (ideal.direction === 'higher') {
    // Higher is better
    if (currentValue >= ideal.idealValue) return 1;
    if (currentValue <= ideal.worstCase) return 0;
    return (currentValue - ideal.worstCase) / (ideal.idealValue - ideal.worstCase);
  } else {
    // Range: in-range = 100%, distance from range = progress
    const low = ideal.idealLow ?? ideal.idealValue * 0.8;
    const high = ideal.idealHigh ?? ideal.idealValue * 1.2;
    if (currentValue >= low && currentValue <= high) return 1;
    if (currentValue < low) {
      if (currentValue <= ideal.worstCase) return 0;
      return (currentValue - ideal.worstCase) / (low - ideal.worstCase);
    }
    // Above high
    const overshoot = currentValue - high;
    const maxOvershoot = ideal.worstCase;
    return Math.max(0, 1 - overshoot / maxOvershoot);
  }
}

/* ── Find most improved biomarker from lab results ── */
interface FocusMetric {
  ideal: BiomarkerIdeal;
  currentValue: number;
  previousValue: number | null;
  progress: number;
  improvement: number; // percentage improvement
  isLocked: boolean;
}

function findMostImproved(
  labResults: Array<{
    markerName: string;
    value: number;
    _creationTime: number;
  }>
): FocusMetric | null {
  if (!labResults || labResults.length === 0) return null;

  // Normalize marker names for matching
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[\s\-_\.]/g, '');

  const keyMap: Record<string, string> = {
    apob: 'apoB',
    apolipoproteinb: 'apoB',
    hba1c: 'hba1c',
    hemoglobina1c: 'hba1c',
    glycatedhemoglobin: 'hba1c',
    testosterone: 'testosterone',
    totaltestosterone: 'testosterone',
    freetestosterone: 'testosterone',
    vitamind: 'vitaminD',
    '25hydroxyvitamind': 'vitaminD',
    '25ohvitamind': 'vitaminD',
    vitd: 'vitaminD',
    hscrp: 'hscrp',
    creactiveprotein: 'hscrp',
    crp: 'hscrp',
    ferritin: 'ferritin',
    serumferritin: 'ferritin',
  };

  // Group lab results by biomarker key, sorted by time
  const grouped: Record<string, Array<{ value: number; time: number }>> = {};

  for (const lab of labResults) {
    const norm = normalize(lab.markerName);
    const key = keyMap[norm];
    if (!key) continue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ value: lab.value, time: lab._creationTime });
  }

  // Sort each group by time
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.time - b.time);
  }

  // Calculate improvement for each biomarker
  let bestMetric: FocusMetric | null = null;
  let bestImprovement = -Infinity;

  for (const ideal of BIOMARKER_IDEALS) {
    const entries = grouped[ideal.key];
    if (!entries || entries.length === 0) continue;

    const latest = entries[entries.length - 1];
    const previous = entries.length > 1 ? entries[entries.length - 2] : null;
    const progress = calculateProgress(latest.value, ideal);
    const isLocked = progress >= 0.98;

    let improvement = 0;
    if (previous) {
      const prevProgress = calculateProgress(previous.value, ideal);
      improvement = progress - prevProgress;
    } else {
      // Single reading: use absolute progress as "improvement"
      improvement = progress * 0.5; // Weight single readings lower
    }

    if (improvement > bestImprovement || (improvement === bestImprovement && progress > (bestMetric?.progress ?? 0))) {
      bestImprovement = improvement;
      bestMetric = {
        ideal,
        currentValue: latest.value,
        previousValue: previous?.value ?? null,
        progress: Math.min(1, Math.max(0, progress)),
        improvement: Math.round(improvement * 100),
        isLocked,
      };
    }
  }

  // If no improvement found, pick the one closest to being locked
  if (!bestMetric) {
    let bestProgress = -1;
    for (const ideal of BIOMARKER_IDEALS) {
      const entries = grouped[ideal.key];
      if (!entries || entries.length === 0) continue;
      const latest = entries[entries.length - 1];
      const progress = calculateProgress(latest.value, ideal);
      if (progress > bestProgress) {
        bestProgress = progress;
        bestMetric = {
          ideal,
          currentValue: latest.value,
          previousValue: null,
          progress: Math.min(1, Math.max(0, progress)),
          improvement: 0,
          isLocked: progress >= 0.98,
        };
      }
    }
  }

  return bestMetric;
}

/* ── Glowing Progress Ring (Canvas) ── */
function ProgressRingCanvas({
  progress,
  isLocked,
  dissipating,
  size = 140,
}: {
  progress: number;
  isLocked: boolean;
  dissipating: boolean;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const phaseRef = useRef(0);
  const dissipateRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 16;
    const lineWidth = 4;

    const animate = () => {
      phaseRef.current += 0.015;
      const phase = phaseRef.current;

      if (dissipating) {
        dissipateRef.current = Math.min(1, dissipateRef.current + 0.008);
      }
      const diss = dissipateRef.current;

      ctx.clearRect(0, 0, size, size);

      const breathe = Math.sin(phase) * 0.5 + 0.5;
      const breathe2 = Math.sin(phase * 0.7 + 1.2) * 0.5 + 0.5;

      // Background glow
      const glowAlpha = isLocked
        ? 0.06 * (1 - diss) + 0.02
        : 0.04 + breathe * 0.03;
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 20);
      if (isLocked) {
        bgGrad.addColorStop(0, `rgba(59,130,246,${glowAlpha * (1 - diss * 0.7)})`);
        bgGrad.addColorStop(0.5, `rgba(0,220,170,${glowAlpha * 0.5 * (1 - diss * 0.8)})`);
        bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        bgGrad.addColorStop(0, `${DT.accentGlow}${glowAlpha})`);
        bgGrad.addColorStop(0.6, `${DT.accentGlow}${glowAlpha * 0.3})`);
        bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // Track ring (dim background)
      const trackAlpha = (0.08 + breathe * 0.02) * (1 - diss);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${trackAlpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Progress arc
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + progress * Math.PI * 2;
      const arcAlpha = (1 - diss * 0.6);

      if (progress > 0.005) {
        // Glow layer
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = isLocked
          ? `rgba(59,130,246,${0.25 * breathe * arcAlpha})`
          : `${DT.accentGlow}${0.3 * breathe * arcAlpha})`;
        ctx.lineWidth = lineWidth + 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main arc
        const arcGrad = ctx.createConicGradient(startAngle, cx, cy);
        if (isLocked) {
          arcGrad.addColorStop(0, `rgba(59,130,246,${0.9 * arcAlpha})`);
          arcGrad.addColorStop(progress * 0.5, `rgba(0,220,170,${0.8 * arcAlpha})`);
          arcGrad.addColorStop(progress, `rgba(59,130,246,${0.9 * arcAlpha})`);
          arcGrad.addColorStop(1, 'rgba(59,130,246,0)');
        } else {
          arcGrad.addColorStop(0, `rgba(0,220,170,${0.9 * arcAlpha})`);
          arcGrad.addColorStop(progress * 0.7, `rgba(0,255,204,${0.95 * arcAlpha})`);
          arcGrad.addColorStop(progress, `rgba(59,180,220,${0.8 * arcAlpha})`);
          arcGrad.addColorStop(1, 'rgba(0,220,170,0)');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = arcGrad;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Leading dot
        const dotX = cx + Math.cos(endAngle) * radius;
        const dotY = cy + Math.sin(endAngle) * radius;
        const dotSize = (2.5 + breathe * 1.5) * (1 - diss);
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = isLocked
          ? `rgba(59,130,246,${0.9 * arcAlpha})`
          : `rgba(0,255,204,${0.9 * arcAlpha})`;
        ctx.fill();

        // Dot glow
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize + 4, 0, Math.PI * 2);
        ctx.fillStyle = isLocked
          ? `rgba(59,130,246,${0.2 * breathe * arcAlpha})`
          : `${DT.accentGlow}${0.25 * breathe * arcAlpha})`;
        ctx.fill();
      }

      // Particle ring (when locked, particles drift outward = dissipation)
      if (isLocked) {
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2 + phase * 0.2;
          const drift = diss * 40;
          const r = radius + drift + Math.sin(phase * 1.5 + i * 0.8) * (6 + drift * 0.3);
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          const pSize = (1.2 + breathe2 * 0.8) * (1 - diss * 0.8);
          const pAlpha = (0.4 + breathe * 0.3) * (1 - diss * 0.9);

          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.2, pSize), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(59,130,246,${pAlpha})`;
          ctx.fill();
        }
      } else if (progress > 0.5) {
        // Subtle orbiting particles for high-progress metrics
        const count = Math.floor(progress * 6);
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + phase * 0.4;
          const r = radius + Math.sin(phase * 2 + i) * 5;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          const pAlpha = 0.2 + breathe * 0.15;

          ctx.beginPath();
          ctx.arc(px, py, 1 + breathe * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `${DT.accentGlow}${pAlpha})`;
          ctx.fill();
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [progress, isLocked, dissipating, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════
   CURRENT FOCUS — Main Component
   ══════════════════════════════════════════════════════════════════ */

export default function CurrentFocus() {
  const sessionId = useMemo(() => getTwinSessionId(), []);

  // Fetch lab results and physical baseline
  const labResults = useQuery(api.queries.getRecentLabResults, { sessionId });
  const physicalBaseline = useQuery(api.queries.getPhysicalBaseline, { sessionId });

  // Compute baselines from BioLogic
  const baselines = useMemo<ComputedBaselines | null>(() => {
    if (!physicalBaseline) return null;
    if (physicalBaseline.computedBaselines) {
      try {
        return JSON.parse(physicalBaseline.computedBaselines);
      } catch { /* fall through */ }
    }
    if (physicalBaseline.sex && physicalBaseline.dateOfBirth && physicalBaseline.heightCm && physicalBaseline.weightKg) {
      try {
        const profile: PhysicalProfile = {
          sex: (physicalBaseline.sex as any) || 'male',
          age: ageFromDOB(physicalBaseline.dateOfBirth),
          heightCm: physicalBaseline.heightCm,
          weightKg: physicalBaseline.weightKg,
        };
        return computeAllBaselines(profile);
      } catch { return null; }
    }
    return null;
  }, [physicalBaseline]);

  // Find the most improved biomarker
  const focusMetric = useMemo(() => {
    if (!labResults) return null;
    return findMostImproved(
      labResults.map((r) => ({
        markerName: r.marker,
        value: r.value,
        _creationTime: r._creationTime,
      }))
    );
  }, [labResults]);

  // Fallback: use HRV from baselines if no lab results
  const fallbackMetric = useMemo<FocusMetric | null>(() => {
    if (focusMetric) return null;
    if (!baselines?.hrv) return null;
    return {
      ideal: {
        key: 'hrv',
        label: 'HRV',
        unit: 'ms',
        idealValue: baselines.hrv.eliteThreshold,
        direction: 'higher',
        worstCase: baselines.hrv.concernThreshold,
        icon: '💓',
        encouragement: 'Heart rate variability building toward elite range',
        lockedMessage: 'HRV optimization — locked in',
      },
      currentValue: baselines.hrv.median,
      previousValue: null,
      progress: 0.65,
      improvement: 0,
      isLocked: false,
    };
  }, [focusMetric, baselines]);

  const metric = focusMetric || fallbackMetric;

  // Animated progress
  const [displayProgress, setDisplayProgress] = useState(0);
  const targetProgress = metric?.progress ?? 0;

  useEffect(() => {
    const step = () => {
      setDisplayProgress((prev) => {
        const diff = targetProgress - prev;
        if (Math.abs(diff) < 0.002) return targetProgress;
        return prev + diff * 0.04;
      });
    };
    const id = setInterval(step, 25);
    return () => clearInterval(id);
  }, [targetProgress]);

  // Dissipation state for locked metrics
  const [dissipating, setDissipating] = useState(false);
  const [showLockedMessage, setShowLockedMessage] = useState(false);

  useEffect(() => {
    if (metric?.isLocked && displayProgress >= 0.97) {
      const t1 = setTimeout(() => setDissipating(true), 800);
      const t2 = setTimeout(() => setShowLockedMessage(true), 2000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      setDissipating(false);
      setShowLockedMessage(false);
    }
  }, [metric?.isLocked, displayProgress]);

  // No data state
  if (!metric) {
    return (
      <div
        style={{
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'rgba(14,14,18,0.6)',
          border: `1px solid ${DT.border}`,
          padding: '16px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: DT.textTer,
            }}
          />
          <span
            style={{
              fontSize: 8,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: DT.textTer,
            }}
          >
            Current Optimization Goal
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '12px 0',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `1.5px dashed rgba(255,255,255,0.08)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 20, opacity: 0.3 }}>🧬</span>
          </div>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: DT.textTer,
              textAlign: 'center' as const,
              lineHeight: 1.5,
              maxWidth: 180,
            }}
          >
            Upload lab results to unlock your optimization goal
          </span>
        </div>
      </div>
    );
  }

  const isLocked = metric.isLocked;
  const progressPct = Math.round(displayProgress * 100);
  const primaryColor = isLocked ? DT.locked : DT.accent;
  const glowPrefix = isLocked ? DT.lockedGlow : DT.accentGlow;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        background: isLocked
          ? 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(0,220,170,0.02))'
          : 'linear-gradient(135deg, rgba(0,220,170,0.04), rgba(59,130,246,0.02))',
        border: `1px solid ${glowPrefix}0.12)`,
        transition: 'all 0.8s ease',
      }}
    >
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '14px 14px 12px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: primaryColor,
                boxShadow: `0 0 10px ${glowPrefix}0.5)`,
              }}
            />
            <span
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                color: primaryColor,
                transition: 'color 0.6s',
              }}
            >
              Current Optimization Goal
            </span>
          </div>

          {metric.improvement > 0 && (
            <div
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                background: `${DT.accentGlow}0.08)`,
                border: `1px solid ${DT.accentGlow}0.15)`,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: DT.accent,
                }}
              >
                +{metric.improvement}%
              </span>
            </div>
          )}
        </div>

        {/* Ring + Center Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Progress Ring */}
          <div
            style={{
              position: 'relative',
              width: 100,
              height: 100,
              flexShrink: 0,
            }}
          >
            <ProgressRingCanvas
              progress={displayProgress}
              isLocked={isLocked}
              dissipating={dissipating}
              size={100}
            />

            {/* Center content */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3,
              }}
            >
              <AnimatePresence mode="wait">
                {showLockedMessage ? (
                  <motion.div
                    key="locked"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>✦</span>
                    <span
                      style={{
                        fontSize: 7,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: DT.locked,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                      }}
                    >
                      Locked In
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{metric.ideal.icon}</span>
                    <span
                      style={{
                        fontSize: 18,
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        color: primaryColor,
                        transition: 'color 0.6s',
                        lineHeight: 1,
                      }}
                    >
                      {progressPct}%
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Metric Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 14,
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  color: DT.text,
                }}
              >
                {metric.ideal.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: DT.textTer,
                }}
              >
                {metric.ideal.unit}
              </span>
            </div>

            {/* Current value */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 20,
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  color: primaryColor,
                  transition: 'color 0.6s',
                }}
              >
                {metric.currentValue % 1 === 0
                  ? metric.currentValue
                  : metric.currentValue.toFixed(1)}
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontFamily: 'monospace',
                  color: DT.textTer,
                }}
              >
                → {metric.ideal.idealValue} ideal
              </span>
            </div>

            {/* Previous value */}
            {metric.previousValue !== null && (
              <div
                style={{
                  fontSize: 8,
                  fontFamily: 'monospace',
                  color: DT.textTer,
                  marginBottom: 4,
                }}
              >
                Previous: {metric.previousValue % 1 === 0
                  ? metric.previousValue
                  : metric.previousValue.toFixed(1)}{' '}
                {metric.ideal.unit}
              </div>
            )}

            {/* Encouragement */}
            <AnimatePresence mode="wait">
              <motion.p
                key={isLocked ? 'locked' : 'progress'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: DT.textSec,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {isLocked ? metric.ideal.lockedMessage : metric.ideal.encouragement}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Baseline source */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            marginTop: 10,
          }}
        >
          <div
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: baselines ? DT.accent : DT.textTer,
              boxShadow: baselines ? `0 0 5px ${DT.accentGlow}0.4)` : 'none',
            }}
          />
          <span
            style={{
              fontSize: 7,
              fontFamily: 'monospace',
              color: DT.textTer,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
            }}
          >
            {baselines?.isEstimated
              ? 'Ideal from BioLogic Estimate'
              : baselines
                ? 'Ideal from Personalized Baselines'
                : 'Longevity-Optimized Targets'}
          </span>
        </div>
      </div>
    </div>
  );
}
