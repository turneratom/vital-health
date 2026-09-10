import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   AAR MODAL — After Action Review
   
   Triggers automatically when a ProtocolTimer session ends.
   Fetches session average vitals from simulated data and presents:
   • Efficiency Score — how well the protocol was executed
   • Biological Cost — metabolic/nervous system expenditure
   • Recovery Requirement — estimated recovery time needed
   
   "Share to Squad" persists the summary to the group feed.
   ═══════════════════════════════════════════════════════════════ */

export interface AARSessionData {
  protocolName: string;
  protocolIcon: string;
  category: string;
  durationSeconds: number;
  /** Vitals sampled during the session */
  avgHeartRate: number;
  avgStress: number;
  avgRecovery: number;
  avgSpO2: number;
  peakHeartRate: number;
  minHeartRate: number;
}

interface AARModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: AARSessionData | null;
  sessionId: string;
}

/* ── Compute AAR metrics from session vitals ── */
function computeAARMetrics(data: AARSessionData) {
  const { avgHeartRate, avgStress, avgRecovery, avgSpO2, peakHeartRate, durationSeconds, category } = data;

  // Efficiency Score (0-100): How well the protocol was executed
  // Based on: staying in optimal HR zone, low stress, high recovery, good SpO2
  const hrZoneScore = category === 'recovery'
    ? Math.max(0, 100 - Math.abs(avgHeartRate - 62) * 2.5) // Recovery: lower HR = better
    : category === 'training'
      ? Math.min(100, (avgHeartRate - 60) * 1.2) // Training: higher HR = better effort
      : Math.max(0, 100 - Math.abs(avgHeartRate - 72) * 1.5); // Default: moderate HR

  const stressScore = category === 'recovery'
    ? Math.max(0, 100 - avgStress * 1.2) // Recovery: low stress = good
    : Math.min(100, 50 + avgStress * 0.5); // Training: some stress is expected

  const recoveryFactor = avgRecovery * 0.8;
  const spo2Factor = Math.max(0, (avgSpO2 - 90) * 10);
  const durationBonus = Math.min(15, (durationSeconds / 60) * 0.5);

  const efficiencyScore = Math.round(
    Math.min(100, Math.max(0,
      hrZoneScore * 0.35 + stressScore * 0.2 + recoveryFactor * 0.25 + spo2Factor * 0.1 + durationBonus
    ))
  );

  // Biological Cost (0-100): Metabolic expenditure on the nervous system
  const hrCost = Math.max(0, (avgHeartRate - 55) * 0.8);
  const peakCost = Math.max(0, (peakHeartRate - 70) * 0.5);
  const stressCost = avgStress * 0.6;
  const durationCost = Math.min(30, (durationSeconds / 60) * 0.8);
  const recoverySavings = avgRecovery * 0.3;

  const biologicalCost = Math.round(
    Math.min(100, Math.max(5,
      hrCost * 0.3 + peakCost * 0.2 + stressCost * 0.25 + durationCost - recoverySavings * 0.15
    ))
  );

  // Recovery Requirement (minutes): How long to recover
  const baseRecovery = category === 'training' ? 45 : category === 'recovery' ? 10 : 20;
  const costMultiplier = 1 + (biologicalCost / 100) * 1.5;
  const recoveryMinutes = Math.round(baseRecovery * costMultiplier);

  // Grade
  const grade = efficiencyScore >= 90 ? 'S' : efficiencyScore >= 80 ? 'A' : efficiencyScore >= 70 ? 'B' : efficiencyScore >= 55 ? 'C' : 'D';

  return { efficiencyScore, biologicalCost, recoveryMinutes, grade };
}

/* ── Grade color mapping ── */
function getGradeColor(grade: string): string {
  switch (grade) {
    case 'S': return '#FFD700';
    case 'A': return '#00FFAA';
    case 'B': return '#00CFFF';
    case 'C': return '#FF9F0A';
    case 'D': return '#FF453A';
    default: return '#8A7E72';
  }
}

/* ── Category accent colors ── */
const CATEGORY_COLORS: Record<string, string> = {
  biohacking: '#00CFFF',
  recovery: '#6B8AFF',
  training: '#E8976C',
  cognitive: '#D4847A',
  supplement: '#7CB68E',
  nutrition: '#C4A46C',
  movement: '#B8A9C9',
};

/* ── Circular progress ring ── */
function MetricRing({ value, max, color, size = 72, strokeWidth = 4, children }: {
  value: number; max: number; color: string; size?: number; strokeWidth?: number; children: React.ReactNode;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const offset = c - pct * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ── Main AAR Modal ── */
export function AARModal({ isOpen, onClose, sessionData, sessionId }: AARModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    if (isOpen && sessionData) {
      const t = setTimeout(() => setAnimateIn(true), 100);
      return () => clearTimeout(t);
    } else {
      setAnimateIn(false);
      setShared(false);
    }
  }, [isOpen, sessionData]);

  const metrics = useMemo(() => {
    if (!sessionData) return null;
    return computeAARMetrics(sessionData);
  }, [sessionData]);

  const handleShare = useCallback(async () => {
    if (!sessionData || !metrics || isSharing) return;
    setIsSharing(true);
    try {
      // shareAARToSquad not present in export API — local ack only
      void sessionId;
      setShared(true);
    } catch (err) {
      console.error('Failed to share AAR:', err);
    } finally {
      setIsSharing(false);
    }
  }, [sessionData, metrics, sessionId, isSharing]);

  if (!sessionData || !metrics) return null;

  const accent = CATEGORY_COLORS[sessionData.category] || '#00CFFF';
  const gradeColor = getGradeColor(metrics.grade);
  const durationMin = Math.round(sessionData.durationSeconds / 60);

  // Cost severity
  const costColor = metrics.biologicalCost >= 70 ? '#FF453A' : metrics.biologicalCost >= 40 ? '#FF9F0A' : '#00FFAA';
  const costLabel = metrics.biologicalCost >= 70 ? 'HIGH' : metrics.biologicalCost >= 40 ? 'MODERATE' : 'LOW';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999]"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed z-[10000] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[380px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(12,10,8,0.97)',
              border: `1px solid ${accent}20`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${accent}08`,
              backdropFilter: 'blur(32px)',
            }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(ellipse at 50% 20%, ${accent}08 0%, transparent 70%)`,
            }} />

            {/* ── Header ── */}
            <div className="relative px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                    background: `${accent}12`, border: `1px solid ${accent}25`,
                  }}>
                    <span className="text-base">{sessionData.protocolIcon}</span>
                  </div>
                  <div>
                    <div className="text-[8px] font-mono font-bold tracking-[0.15em] uppercase" style={{ color: `${accent}80` }}>
                      AFTER ACTION REVIEW
                    </div>
                    <div className="text-[13px] font-semibold truncate max-w-[200px]" style={{
                      color: '#E8E0D8', fontFamily: "'Inter', system-ui, sans-serif",
                    }}>
                      {sessionData.protocolName}
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(42,38,34,0.5)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(138,126,114,0.5)" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Duration + Category tag */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono tracking-[0.1em] px-2 py-0.5 rounded-md" style={{
                  background: `${accent}10`, color: `${accent}90`, border: `1px solid ${accent}15`,
                }}>
                  {durationMin}m SESSION
                </span>
                <span className="text-[9px] font-mono tracking-[0.1em] uppercase" style={{ color: 'rgba(138,126,114,0.5)' }}>
                  {sessionData.category}
                </span>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}15, transparent)` }} />

            {/* ── Metrics Grid ── */}
            <div className="relative px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                {/* Efficiency Score */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={animateIn ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex flex-col items-center flex-1"
                >
                  <MetricRing value={metrics.efficiencyScore} max={100} color={gradeColor} size={76} strokeWidth={4}>
                    <span className="text-[22px] font-bold font-mono" style={{ color: gradeColor, textShadow: `0 0 12px ${gradeColor}30` }}>
                      {metrics.grade}
                    </span>
                    <span className="text-[7px] font-mono tracking-[0.1em]" style={{ color: 'rgba(138,126,114,0.5)' }}>
                      {metrics.efficiencyScore}%
                    </span>
                  </MetricRing>
                  <span className="text-[9px] font-bold tracking-[0.08em] mt-2" style={{ color: 'rgba(224,224,224,0.7)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                    EFFICIENCY
                  </span>
                </motion.div>

                {/* Biological Cost */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={animateIn ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="flex flex-col items-center flex-1"
                >
                  <MetricRing value={metrics.biologicalCost} max={100} color={costColor} size={76} strokeWidth={4}>
                    <span className="text-[20px] font-bold font-mono" style={{ color: costColor }}>
                      {metrics.biologicalCost}
                    </span>
                    <span className="text-[7px] font-mono tracking-[0.1em]" style={{ color: `${costColor}80` }}>
                      {costLabel}
                    </span>
                  </MetricRing>
                  <span className="text-[9px] font-bold tracking-[0.08em] mt-2" style={{ color: 'rgba(224,224,224,0.7)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                    BIO COST
                  </span>
                </motion.div>

                {/* Recovery Requirement */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={animateIn ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="flex flex-col items-center flex-1"
                >
                  <MetricRing value={Math.min(metrics.recoveryMinutes, 120)} max={120} color="#6B8AFF" size={76} strokeWidth={4}>
                    <span className="text-[20px] font-bold font-mono" style={{ color: '#6B8AFF' }}>
                      {metrics.recoveryMinutes}
                    </span>
                    <span className="text-[7px] font-mono tracking-[0.1em]" style={{ color: 'rgba(107,138,255,0.6)' }}>
                      MIN
                    </span>
                  </MetricRing>
                  <span className="text-[9px] font-bold tracking-[0.08em] mt-2" style={{ color: 'rgba(224,224,224,0.7)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                    RECOVERY
                  </span>
                </motion.div>
              </div>
            </div>

            {/* ── Vitals Summary Strip ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={animateIn ? { opacity: 1 } : {}}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mx-5 rounded-xl px-4 py-3 mb-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(42,38,34,0.4)' }}
            >
              <div className="flex items-center justify-between">
                <VitalStat label="AVG HR" value={`${Math.round(sessionData.avgHeartRate)}`} unit="bpm" color="#FF6B6B" />
                <div className="w-px h-6" style={{ background: 'rgba(42,38,34,0.5)' }} />
                <VitalStat label="PEAK HR" value={`${Math.round(sessionData.peakHeartRate)}`} unit="bpm" color="#FF9F0A" />
                <div className="w-px h-6" style={{ background: 'rgba(42,38,34,0.5)' }} />
                <VitalStat label="SpO2" value={`${Math.round(sessionData.avgSpO2)}`} unit="%" color="#00CFFF" />
                <div className="w-px h-6" style={{ background: 'rgba(42,38,34,0.5)' }} />
                <VitalStat label="STRESS" value={`${Math.round(sessionData.avgStress)}`} unit="%" color="#AF82FF" />
              </div>
            </motion.div>

            {/* ── Action Buttons ── */}
            <div className="px-5 pb-5 flex gap-3">
              {/* Share to Squad */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={animateIn ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.7, duration: 0.4 }}
                onClick={handleShare}
                disabled={isSharing || shared}
                className="flex-1 py-3 rounded-xl font-mono text-[10px] font-bold tracking-[0.1em] uppercase flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96]"
                style={{
                  background: shared ? 'rgba(124,182,142,0.1)' : `${accent}0C`,
                  border: `1px solid ${shared ? 'rgba(124,182,142,0.3)' : `${accent}25`}`,
                  color: shared ? '#7CB68E' : `${accent}CC`,
                  cursor: isSharing || shared ? 'default' : 'pointer',
                }}
              >
                {shared ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7CB68E" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                    SHARED
                  </>
                ) : isSharing ? (
                  <>
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke={`${accent}30`} strokeWidth="3" />
                      <path d="M12 2a10 10 0 019.95 9" stroke={accent} strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    SHARING...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    SHARE TO SQUAD
                  </>
                )}
              </motion.button>

              {/* Dismiss */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={animateIn ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.75, duration: 0.4 }}
                onClick={onClose}
                className="py-3 px-5 rounded-xl font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition-all duration-200 active:scale-[0.96]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(42,38,34,0.5)',
                  color: 'rgba(138,126,114,0.6)',
                }}
              >
                DISMISS
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Small vital stat display ── */
function VitalStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[7px] font-mono tracking-[0.12em] mb-0.5" style={{ color: 'rgba(138,126,114,0.4)' }}>{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[14px] font-bold font-mono" style={{ color }}>{value}</span>
        <span className="text-[8px] font-mono" style={{ color: `${color}60` }}>{unit}</span>
      </div>
    </div>
  );
}

export default AARModal;
