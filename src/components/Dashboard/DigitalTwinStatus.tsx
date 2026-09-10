import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBiometricSync } from '@/hooks/useBiometricSync';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  computeAllBaselines,
  ageFromDOB,
  type ComputedBaselines,
  type PhysicalProfile,
} from '@/lib/intelligence/BioLogic';

/* ── Design Tokens ── */
const DT = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  // On-track palette: calming blue-green
  onTrack: '#00DCAA',
  onTrackGlow: 'rgba(0,220,170,',
  onTrackBg: 'linear-gradient(135deg, rgba(0,220,170,0.06), rgba(59,130,246,0.04))',
  // Off-track palette: soft dimmed amber (NOT red — supportive, not discouraging)
  offTrack: '#E8B86C',
  offTrackGlow: 'rgba(232,184,108,',
  offTrackBg: 'linear-gradient(135deg, rgba(232,184,108,0.06), rgba(200,160,80,0.03))',
  border: 'rgba(255,255,255,0.05)',
};

/* ── Session helper ── */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem('vive-session-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('vive-session-id', id);
  }
  return id;
}

/* ── Baseline status evaluation ── */
interface BaselineStatus {
  hydration: 'on-track' | 'off-track';
  hrv: 'on-track' | 'off-track';
  recovery: 'on-track' | 'off-track';
  sleep: 'on-track' | 'off-track';
  energy: 'on-track' | 'off-track';
  overall: 'on-track' | 'off-track';
  onTrackCount: number;
  totalChecks: number;
  nudge: string | null;
}

function evaluateBaselines(
  baselines: ComputedBaselines | null,
  vitals: ReturnType<typeof useBiometricSync>['vitals']
): BaselineStatus {
  const checks: {
    hydration: 'on-track' | 'off-track';
    hrv: 'on-track' | 'off-track';
    recovery: 'on-track' | 'off-track';
    sleep: 'on-track' | 'off-track';
    energy: 'on-track' | 'off-track';
  } = {
    hydration: 'on-track',
    hrv: 'on-track',
    recovery: 'on-track',
    sleep: 'on-track',
    energy: 'on-track',
  };

  let nudge: string | null = null;

  // HRV check — compare against baseline median
  if (baselines?.hrv) {
    if (vitals.hrv < baselines.hrv.low) {
      checks.hrv = 'off-track';
      nudge = nudge || 'Try 5 min box breathing to support HRV recovery';
    }
  } else if (vitals.hrv < 40) {
    checks.hrv = 'off-track';
    nudge = nudge || 'Try 5 min box breathing to support HRV recovery';
  }

  // Hydration — estimate from baselines
  if (baselines?.hydration) {
    // If body battery is low, hydration is likely off
    if (vitals.bodyBattery < 40) {
      checks.hydration = 'off-track';
      nudge = nudge || `Drink ${Math.round(baselines.hydration.baseMl * 0.25)}ml water now`;
    }
  } else if (vitals.bodyBattery < 35) {
    checks.hydration = 'off-track';
    nudge = nudge || 'Drink 500ml water — your energy reserves are low';
  }

  // Recovery
  if (vitals.recovery < 50) {
    checks.recovery = 'off-track';
    nudge = nudge || 'Light movement + early bedtime recommended tonight';
  }

  // Sleep
  if (vitals.sleepScore < 60) {
    checks.sleep = 'off-track';
    nudge = nudge || 'Prioritize 7+ hours tonight — sleep architecture needs support';
  }

  // Energy / Body Battery
  if (vitals.bodyBattery < 30) {
    checks.energy = 'off-track';
    nudge = nudge || 'Take a 20-min rest — your body battery is critically low';
  }

  const values = Object.values(checks);
  const onTrackCount = values.filter(v => v === 'on-track').length;
  const overall = onTrackCount >= 4 ? 'on-track' : 'off-track';

  return { ...checks, overall, onTrackCount, totalChecks: values.length, nudge };
}

/* ── Breathing Pulse Canvas ── */
function BreathingPulseCanvas({ isOnTrack, intensity }: { isOnTrack: boolean; intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const animate = () => {
      phaseRef.current += 0.012;
      const phase = phaseRef.current;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Breathing cycle: slow sine wave
      const breathe = Math.sin(phase) * 0.5 + 0.5; // 0-1
      const breathe2 = Math.sin(phase * 0.7 + 1) * 0.5 + 0.5;

      if (isOnTrack) {
        // Calming blue-green glow — serene, expansive
        const baseR = 60 + breathe * 30 * intensity;

        // Outer halo
        const grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR + 50);
        grad1.addColorStop(0, `rgba(0,220,170,${0.08 * intensity * breathe})`);
        grad1.addColorStop(0.4, `rgba(59,180,220,${0.05 * intensity * breathe2})`);
        grad1.addColorStop(1, 'rgba(0,220,170,0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, w, h);

        // Inner core
        const grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
        grad2.addColorStop(0, `rgba(0,255,204,${0.12 * intensity * breathe})`);
        grad2.addColorStop(0.5, `rgba(59,130,246,${0.06 * intensity * breathe2})`);
        grad2.addColorStop(1, 'rgba(0,220,170,0)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.fill();

        // Subtle particle ring
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + phase * 0.3;
          const r = baseR * 0.7 + Math.sin(phase * 2 + i) * 8;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          const size = 1.5 + breathe * 1;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,204,${0.3 * breathe * intensity})`;
          ctx.fill();
        }
      } else {
        // Soft dimmed amber — warm, supportive, NOT alarming
        const baseR = 55 + breathe * 20 * intensity;

        // Outer amber halo
        const grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR + 40);
        grad1.addColorStop(0, `rgba(232,184,108,${0.06 * intensity * breathe})`);
        grad1.addColorStop(0.5, `rgba(200,160,80,${0.03 * intensity * breathe2})`);
        grad1.addColorStop(1, 'rgba(232,184,108,0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, w, h);

        // Inner warm core
        const grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
        grad2.addColorStop(0, `rgba(232,184,108,${0.10 * intensity * breathe})`);
        grad2.addColorStop(0.6, `rgba(200,140,60,${0.04 * intensity})`);
        grad2.addColorStop(1, 'rgba(232,184,108,0)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isOnTrack, intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

/* ── System Ring Indicator ── */
function SystemRing({ label, status, value }: { label: string; status: 'on-track' | 'off-track'; value: string }) {
  const isOn = status === 'on-track';
  const color = isOn ? DT.onTrack : DT.offTrack;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${isOn ? DT.onTrackGlow : DT.offTrackGlow}0.08)`,
        border: `1.5px solid ${isOn ? DT.onTrackGlow : DT.offTrackGlow}0.25)`,
        boxShadow: `0 0 12px ${isOn ? DT.onTrackGlow : DT.offTrackGlow}0.15)`,
        transition: 'all 0.6s ease',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color, transition: 'color 0.6s' }}>
          {value}
        </span>
      </div>
      <span style={{
        fontSize: 7, fontFamily: 'monospace', color: DT.textTer,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DIGITAL TWIN STATUS — Hero visualization
   ══════════════════════════════════════════════════════════════════ */

export default function DigitalTwinStatus() {
  const { vitals } = useBiometricSync();
  const sessionId = useMemo(() => getSessionId(), []);

  // Fetch physical baseline from Convex for BioLogic computation
  const physicalBaseline = useQuery(api.queries.getPhysicalBaseline, { sessionId });

  // Compute baselines from BioLogic
  const baselines = useMemo<ComputedBaselines | null>(() => {
    if (!physicalBaseline?.computedBaselines) {
      // Fallback: compute from stored vitals if available
      if (physicalBaseline?.sex && physicalBaseline?.dateOfBirth && physicalBaseline?.heightCm && physicalBaseline?.weightKg) {
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
    }
    try {
      return JSON.parse(physicalBaseline.computedBaselines);
    } catch { return null; }
  }, [physicalBaseline]);

  // Evaluate on-track status
  const status = useMemo(() => evaluateBaselines(baselines, vitals), [baselines, vitals]);

  const isOnTrack = status.overall === 'on-track';
  const glowIntensity = status.onTrackCount / status.totalChecks;
  const primaryColor = isOnTrack ? DT.onTrack : DT.offTrack;
  const glowPrefix = isOnTrack ? DT.onTrackGlow : DT.offTrackGlow;

  // Animated score
  const [displayScore, setDisplayScore] = useState(0);
  const targetScore = Math.round((status.onTrackCount / status.totalChecks) * 100);
  useEffect(() => {
    const step = () => {
      setDisplayScore(prev => {
        const diff = targetScore - prev;
        if (Math.abs(diff) < 1) return targetScore;
        return prev + diff * 0.08;
      });
    };
    const id = setInterval(step, 30);
    return () => clearInterval(id);
  }, [targetScore]);

  const statusLabel = isOnTrack ? 'Systems Aligned' : 'Support Available';
  const statusEmoji = isOnTrack ? '◉' : '◎';

  return (
    <div style={{
      position: 'relative', borderRadius: 20, overflow: 'hidden',
      background: isOnTrack ? DT.onTrackBg : DT.offTrackBg,
      border: `1px solid ${glowPrefix}0.12)`,
      transition: 'all 0.8s ease',
    }}>
      {/* Breathing pulse canvas */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 20 }}>
        <BreathingPulseCanvas isOnTrack={isOnTrack} intensity={glowIntensity} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 18px 16px' }}>
        {/* Top row: Status badge + Score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: primaryColor,
                boxShadow: `0 0 12px ${glowPrefix}0.5)`,
              }}
            />
            <span style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: primaryColor, transition: 'color 0.6s',
            }}>
              {statusEmoji} Digital Twin · {statusLabel}
            </span>
          </div>

          <div style={{
            padding: '3px 10px', borderRadius: 8,
            background: `${glowPrefix}0.08)`,
            border: `1px solid ${glowPrefix}0.18)`,
          }}>
            <span style={{
              fontSize: 16, fontFamily: 'monospace', fontWeight: 800,
              color: primaryColor, transition: 'color 0.6s',
            }}>
              {Math.round(displayScore)}%
            </span>
            <span style={{
              fontSize: 7, fontFamily: 'monospace', color: DT.textTer,
              marginLeft: 4, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              aligned
            </span>
          </div>
        </div>

        {/* System rings */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          marginBottom: 14, padding: '0 8px',
        }}>
          <SystemRing label="HRV" status={status.hrv} value={`${Math.round(vitals.hrv)}`} />
          <SystemRing label="Sleep" status={status.sleep} value={`${Math.round(vitals.sleepScore)}`} />
          <SystemRing label="Recovery" status={status.recovery} value={`${Math.round(vitals.recovery)}%`} />
          <SystemRing label="Hydration" status={status.hydration} value={vitals.bodyBattery > 50 ? '✓' : '—'} />
          <SystemRing label="Energy" status={status.energy} value={`${Math.round(vitals.bodyBattery)}`} />
        </div>

        {/* Nudge — frictionless protocol suggestion */}
        <AnimatePresence mode="wait">
          {status.nudge && (
            <motion.div
              key={status.nudge}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 12,
                background: `${glowPrefix}0.05)`,
                border: `1px solid ${glowPrefix}0.10)`,
              }}
            >
              <span style={{ fontSize: 12 }}>{isOnTrack ? '✨' : '💧'}</span>
              <span style={{
                fontSize: 10, fontFamily: 'monospace', color: DT.textSec,
                lineHeight: 1.4, flex: 1,
              }}>
                {status.nudge}
              </span>
              <div style={{
                padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                background: `${glowPrefix}0.12)`,
                border: `1px solid ${glowPrefix}0.20)`,
                fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                color: primaryColor, letterSpacing: '0.08em', textTransform: 'uppercase',
                transition: 'all 0.2s',
              }}>
                Start
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Baseline source indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, marginTop: 10,
        }}>
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: baselines ? DT.onTrack : DT.textTer,
            boxShadow: baselines ? `0 0 6px ${DT.onTrackGlow}0.4)` : 'none',
          }} />
          <span style={{
            fontSize: 7, fontFamily: 'monospace', color: DT.textTer,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {baselines?.isEstimated
              ? 'AI-Estimated Baselines'
              : baselines
                ? 'Personalized Baselines'
                : 'Default Baselines · Complete Profile for Precision'}
          </span>
        </div>
      </div>
    </div>
  );
}
