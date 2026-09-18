import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════ */
/*  PlanView — 90-Day Tactical Roadmap                          */
/*  Today's Plan + Transformation Progress                       */
/* ══════════════════════════════════════════════════════════════ */

/* ── Types ── */
interface WorkoutRx {
  name: string;
  muscleGroups: string[];
  duration: number;
  intensity: 'low' | 'moderate' | 'high';
  reason: string;
  fatigueLevel: number; // 0-100
  bioLink?: { marker: string; value: string; status: 'optimal' | 'warning' | 'critical' };
}

interface MealRx {
  name: string;
  calories: number;
  protein: number;
  bioReason: string;
  activeMuscleZone: string;
  tags: string[];
  bioLink?: { marker: string; value: string; status: 'optimal' | 'warning' | 'critical' };
}

interface SupplementRx {
  name: string;
  dose: string;
  timing: string;
  reason: string;
  deficiencyLink: string;
  urgency: 'high' | 'moderate' | 'low';
  bioLink?: { marker: string; value: string; status: 'optimal' | 'warning' | 'critical' };
}

interface BaselineMetric {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}

/* ── Utility: Session ID ── */
function useSessionId(): string {
  const [id] = useState(() => {
    if (typeof window === 'undefined') return 'anon';
    return getTwinSessionId();
  });
  return id;
}

/* ── Fatigue Map from recent workouts ── */
function useMuscleMap(sessionId: string) {
  const vitals = useQuery(api.vitalsData.getVitalsTimeSeries, sessionId ? { sessionId } : 'skip');

  return useMemo(() => {
    const fatigueMap: Record<string, number> = {
      chest: 20, back: 15, shoulders: 10, biceps: 25, triceps: 20,
      quads: 30, hamstrings: 25, glutes: 35, calves: 15, core: 20,
    };

    if (vitals?.workoutLogs) {
      for (const w of vitals.workoutLogs) {
        const hoursSince = (Date.now() - w.loggedAt) / (1000 * 60 * 60);
        const decayFactor = Math.max(0, 1 - hoursSince / 72);
        const intensityMult = w.intensity === 'high' ? 1.0 : w.intensity === 'moderate' ? 0.7 : 0.4;
        for (const mg of w.muscleGroups) {
          const key = mg.toLowerCase();
          if (fatigueMap[key] !== undefined) {
            fatigueMap[key] = Math.min(100, fatigueMap[key] + 40 * decayFactor * intensityMult);
          }
        }
      }
    }
    return fatigueMap;
  }, [vitals]);
}

/* ── Generate Workout Recommendations ── */
function generateWorkoutRx(fatigueMap: Record<string, number>): WorkoutRx[] {
  const sorted = Object.entries(fatigueMap).sort((a, b) => a[1] - b[1]);
  const freshGroups = sorted.filter(([, f]) => f < 40).slice(0, 3);
  const fatigued = sorted.filter(([, f]) => f >= 60);

  const workouts: WorkoutRx[] = [];

  if (freshGroups.length >= 2) {
    const groups = freshGroups.map(([g]) => g);
    workouts.push({
      name: `${groups[0].charAt(0).toUpperCase() + groups[0].slice(1)} & ${groups[1].charAt(0).toUpperCase() + groups[1].slice(1)} Compound`,
      muscleGroups: groups.slice(0, 2),
      duration: 45,
      intensity: 'high',
      reason: `Your ${groups[0]} and ${groups[1]} are fresh and ready — great day to push these`,
      fatigueLevel: Math.round((freshGroups[0][1] + freshGroups[1][1]) / 2),
      bioLink: { marker: 'Muscle Recovery', value: `${100 - Math.round((freshGroups[0][1] + freshGroups[1][1]) / 2)}%`, status: 'optimal' },
    });
  }

  if (fatigued.length > 0) {
    const avgFatigue = Math.round(fatigued.reduce((s, [, f]) => s + f, 0) / fatigued.length);
    workouts.push({
      name: 'Active Recovery Flow',
      muscleGroups: fatigued.map(([g]) => g),
      duration: 25,
      intensity: 'low',
      reason: `Your ${fatigued.map(([g]) => g).join(', ')} are still tired — easy movement helps them recover faster`,
      fatigueLevel: avgFatigue,
      bioLink: { marker: 'Cortisol Load', value: `${avgFatigue}%`, status: avgFatigue >= 70 ? 'critical' : 'warning' },
    });
  }

  workouts.push({
    name: 'Zone 2 Cardio Session',
    muscleGroups: ['cardiovascular'],
    duration: 30,
    intensity: 'moderate',
    reason: 'A steady cardio session to keep your heart strong without wearing out your muscles',
    fatigueLevel: 0,
    bioLink: { marker: 'VO2 Max', value: '38 mL/kg', status: 'warning' },
  });

  return workouts;
}

/* ── Generate Meal Recommendations ── */
function generateMealRx(fatigueMap: Record<string, number>, bioVault: any): MealRx[] {
  const highFatigue = Object.entries(fatigueMap)
    .filter(([, f]) => f >= 50)
    .sort((a, b) => b[1] - a[1]);

  const activeZone = highFatigue.length > 0 ? highFatigue[0][0] : 'general';
  const zoneLabel = activeZone.charAt(0).toUpperCase() + activeZone.slice(1);

  const meals: MealRx[] = [
    {
      name: 'Grilled Salmon Bowl with Quinoa',
      calories: 620,
      protein: 48,
      bioReason: `High protein because your ${zoneLabel} muscles need rebuilding`,
      activeMuscleZone: zoneLabel,
      tags: ['omega-3', 'anti-inflammatory', 'high-protein'],
      bioLink: { marker: 'Muscle Protein Synthesis', value: `${zoneLabel} active`, status: 'warning' },
    },
    {
      name: 'Turkey & Sweet Potato Power Plate',
      calories: 550,
      protein: 42,
      bioReason: `Refuels your ${zoneLabel} muscles with the energy they burned`,
      activeMuscleZone: zoneLabel,
      tags: ['lean-protein', 'complex-carbs', 'recovery'],
      bioLink: { marker: 'Glycogen Stores', value: 'Depleted', status: 'critical' },
    },
    {
      name: 'Greek Yogurt Parfait with Berries',
      calories: 340,
      protein: 28,
      bioReason: 'Slow-release protein that feeds your muscles while you rest',
      activeMuscleZone: 'systemic',
      tags: ['probiotics', 'antioxidants', 'slow-release'],
      bioLink: { marker: 'Gut Microbiome', value: 'Maintenance', status: 'optimal' },
    },
  ];

  if (bioVault?.crp && bioVault.crp >= 3.0) {
    meals.push({
      name: 'Turmeric Golden Broth with Ginger',
      calories: 120,
      protein: 4,
      bioReason: 'Your inflammation is high — this helps calm it down',
      activeMuscleZone: 'systemic',
      tags: ['anti-inflammatory', 'curcumin', 'healing'],
      bioLink: { marker: 'CRP', value: `${bioVault.crp} mg/L`, status: 'critical' },
    });
  }

  return meals;
}

/* ── Generate Supplement Recommendations ── */
function generateSupplementRx(bioVault: any, hrvHistory: number[]): SupplementRx[] {
  const supplements: SupplementRx[] = [];
  const hrvAvg = hrvHistory.length > 0 ? hrvHistory.reduce((s, v) => s + v, 0) / hrvHistory.length : 70;
  const hrvDrop = hrvHistory.length >= 2 ? ((hrvHistory[hrvHistory.length - 1] - hrvAvg) / hrvAvg) * 100 : 0;

  if (hrvDrop < -10) {
    supplements.push({
      name: 'Magnesium Glycinate',
      dose: '400mg',
      timing: 'Before bed',
      reason: `Your heart rate variability dropped ${Math.abs(Math.round(hrvDrop))}% — this helps your nervous system recover`,
      deficiencyLink: 'HRV autonomic stress',
      urgency: 'high',
      bioLink: { marker: 'HRV', value: `${Math.abs(Math.round(hrvDrop))}% drop`, status: 'critical' },
    });
  }

  if (bioVault?.vitaminD != null && bioVault.vitaminD < 40) {
    supplements.push({
      name: 'Vitamin D3 + K2',
      dose: '5000 IU / 100mcg',
      timing: 'With morning meal',
      reason: `Your Vitamin D is low at ${bioVault.vitaminD} — you need more for strong bones and immunity`,
      deficiencyLink: 'Vitamin D deficiency',
      urgency: bioVault.vitaminD < 30 ? 'high' : 'moderate',
      bioLink: { marker: 'Vitamin D', value: `${bioVault.vitaminD} ng/mL`, status: bioVault.vitaminD < 30 ? 'critical' : 'warning' },
    });
  } else {
    supplements.push({
      name: 'Vitamin D3 + K2',
      dose: '2000 IU / 50mcg',
      timing: 'With morning meal',
      reason: 'Keeps your immune system and bones healthy year-round',
      deficiencyLink: 'Preventive',
      urgency: 'low',
      bioLink: { marker: 'Vitamin D', value: 'In range', status: 'optimal' },
    });
  }

  if (bioVault?.ferritin != null && bioVault.ferritin < 40) {
    supplements.push({
      name: 'Iron Bisglycinate',
      dose: '25mg',
      timing: 'Empty stomach, with Vitamin C',
      reason: `Your iron is low at ${bioVault.ferritin} — this helps your blood carry more oxygen`,
      deficiencyLink: 'Iron stores low',
      urgency: 'high',
      bioLink: { marker: 'Ferritin', value: `${bioVault.ferritin} ng/mL`, status: 'critical' },
    });
  }

  supplements.push({
    name: 'Omega-3 (EPA/DHA)',
    dose: '2g EPA / 1g DHA',
    timing: 'With largest meal',
    reason: 'Keeps inflammation in check and supports your brain health',
    deficiencyLink: 'Baseline protocol',
    urgency: 'low',
    bioLink: { marker: 'Omega-3 Index', value: 'Baseline', status: 'optimal' },
  });

  if (bioVault?.crp != null && bioVault.crp >= 3.0) {
    supplements.push({
      name: 'Curcumin (Longvida)',
      dose: '400mg',
      timing: 'Twice daily with meals',
      reason: `Your inflammation marker is high at ${bioVault.crp} — this natural extract helps bring it down`,
      deficiencyLink: 'CRP inflammation',
      urgency: 'high',
      bioLink: { marker: 'CRP', value: `${bioVault.crp} mg/L`, status: 'critical' },
    });
  }

  return supplements.sort((a, b) => {
    const order = { high: 0, moderate: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

/* ── Biological Delta baseline metrics ── */
function generateBaselineMetrics(bioVault: any, hrvHistory: number[]): BaselineMetric[] {
  const hrvAvg = hrvHistory.length > 0 ? Math.round(hrvHistory.reduce((s, v) => s + v, 0) / hrvHistory.length) : 68;

  return [
    { label: 'HRV', current: hrvAvg, target: Math.round(hrvAvg * 1.25), unit: 'ms', color: '#00F0FF' },
    { label: 'Vitamin D', current: bioVault?.vitaminD ?? 32, target: 55, unit: 'ng/mL', color: '#F59E0B' },
    { label: 'Ferritin', current: bioVault?.ferritin ?? 45, target: 80, unit: 'ng/mL', color: '#EF4444' },
    { label: 'CRP', current: bioVault?.crp ?? 2.1, target: 0.8, unit: 'mg/L', color: '#A78BFA' },
    { label: 'Body Fat', current: 22, target: 16, unit: '%', color: '#10B981' },
    { label: 'VO2 Max', current: 38, target: 46, unit: 'mL/kg', color: '#3B82F6' },
  ];
}

/* ── Day counter ── */
function useDayCount(): number {
  const [day, setDay] = useState(1);
  useEffect(() => {
    const start = localStorage.getItem('vive-plan-start');
    if (!start) {
      localStorage.setItem('vive-plan-start', Date.now().toString());
      setDay(1);
    } else {
      const elapsed = Date.now() - parseInt(start);
      setDay(Math.min(90, Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60 * 24)))));
    }
  }, []);
  return day;
}

/* ══════════════════════════════════════════════════════════════ */
/*  Sub-Components                                               */
/* ══════════════════════════════════════════════════════════════ */

/* ── Bio-Link Badge ── */
function BioLinkBadge({ bioLink }: { bioLink?: { marker: string; value: string; status: 'optimal' | 'warning' | 'critical' } }) {
  if (!bioLink) return null;
  const statusConfig = {
    optimal: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', icon: '✓', glow: 'rgba(16,185,129,0.3)' },
    warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '◈', glow: 'rgba(245,158,11,0.3)' },
    critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: '▲', glow: 'rgba(239,68,68,0.3)' },
  };
  const cfg = statusConfig[bioLink.status];
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg mt-2"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: `0 0 8px ${cfg.glow}` }}>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }} />
        <span className="text-[7px] font-bold uppercase tracking-[0.15em]" style={{ color: cfg.color }}>BIO-LINK</span>
      </div>
      <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{bioLink.marker}</span>
      <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: cfg.color }}>
        {cfg.icon} {bioLink.value}
      </span>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon, title, subtitle, accentColor }: { icon: string; title: string; subtitle: string; accentColor: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
        style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
        {icon}
      </div>
      <div>
        <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: accentColor }}>{title}</h3>
        <p className="text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

/* ── Workout Card ── */
function WorkoutCard({ rx, index }: { rx: WorkoutRx; index: number }) {
  const intensityColors = { low: '#10B981', moderate: '#F59E0B', high: '#EF4444' };
  const color = intensityColors[rx.intensity];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="text-[13px] font-medium text-white/90">{rx.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                {rx.intensity.toUpperCase()}
              </span>
              <span className="text-[10px] text-white/30">{rx.duration} min</span>
            </div>
          </div>
          {/* Fatigue indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${color}10` }}>
              <span className="text-[11px] font-bold" style={{ color }}>{rx.fatigueLevel}%</span>
            </div>
            <span className="text-[7px] text-white/25 uppercase tracking-wider">fatigue</span>
          </div>
        </div>

        {/* Muscle groups */}
        <div className="flex flex-wrap gap-1 mb-2">
          {rx.muscleGroups.map((mg) => (
            <span key={mg} className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>
              {mg}
            </span>
          ))}
        </div>

        {/* Reason */}
        <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
          💡 {rx.reason}
        </p>

        {/* Bio-Link Badge */}
        <BioLinkBadge bioLink={rx.bioLink} />
      </div>
    </motion.div>
  );
}

/* ── Meal Card ── */
function MealCard({ rx, index }: { rx: MealRx; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#F59E0B' }} />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-[13px] font-medium text-white/90 flex-1">{rx.name}</h4>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[10px] font-mono text-white/40">{rx.calories} cal</span>
            <span className="text-[10px] font-mono font-bold" style={{ color: '#10B981' }}>{rx.protein}g P</span>
          </div>
        </div>

        {/* Bio-Reason tag */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-2"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: '#F59E0B' }}>BIO-REASON</span>
          <span className="text-[10px]" style={{ color: 'rgba(245,158,11,0.8)' }}>{rx.bioReason}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {rx.tags.map((tag) => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
              #{tag}
            </span>
          ))}
        </div>

        {/* Bio-Link Badge */}
        <BioLinkBadge bioLink={rx.bioLink} />
      </div>
    </motion.div>
  );
}

/* ── Supplement Card ── */
function SupplementCard({ rx, index }: { rx: SupplementRx; index: number }) {
  const urgencyColors = { high: '#EF4444', moderate: '#F59E0B', low: '#10B981' };
  const color = urgencyColors[rx.urgency];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#A78BFA' }} />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between mb-1.5">
          <div>
            <h4 className="text-[13px] font-medium text-white/90">{rx.name}</h4>
            <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{rx.dose}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Urgency dot */}
            <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
            <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color }}>{rx.urgency}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA' }}>
            ⏰ {rx.timing}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
            {rx.deficiencyLink}
          </span>
        </div>

        <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
          🧬 {rx.reason}
        </p>

        {/* Bio-Link Badge */}
        <BioLinkBadge bioLink={rx.bioLink} />
      </div>
    </motion.div>
  );
}

/* ── Biological Delta Chart ── */
function BiologicalDeltaChart({ metrics }: { metrics: BaselineMetric[] }) {
  return (
    <div className="space-y-3">
      {metrics.map((m, i) => {
        const isLowerBetter = m.label === 'CRP' || m.label === 'Body Fat';
        const progress = isLowerBetter
          ? Math.max(0, Math.min(1, (m.current - m.target) / (m.current * 0.5)))
          : Math.max(0, Math.min(1, m.current / m.target));
        const delta = isLowerBetter ? m.current - m.target : m.target - m.current;
        const deltaLabel = isLowerBetter
          ? (delta > 0 ? `−${delta.toFixed(1)}` : '✓ On target')
          : (delta > 0 ? `+${delta.toFixed(1)}` : '✓ On target');
        const onTrack = isLowerBetter ? m.current <= m.target : m.current >= m.target;

        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-white/70">{m.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/40">
                  {m.current}{m.unit}
                </span>
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: m.color }}>
                  {m.target}{m.unit}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: onTrack ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: onTrack ? '#10B981' : '#F59E0B',
                  }}>
                  {deltaLabel}
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {/* Target marker */}
              <div className="absolute top-0 bottom-0 w-px z-10" style={{
                left: `${Math.min(95, Math.max(5, (isLowerBetter ? (m.target / m.current) : 1) * 100))}%`,
                background: 'rgba(255,255,255,0.3)',
              }} />
              {/* Current fill */}
              <motion.div
                className="absolute top-0 left-0 bottom-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  background: `linear-gradient(90deg, ${m.color}40, ${m.color})`,
                  boxShadow: `0 0 8px ${m.color}40`,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Progress Ring ── */
function DayProgressRing({ day }: { day: number }) {
  const progress = day / 90;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative w-[130px] h-[130px] flex items-center justify-center">
      <svg width="130" height="130" viewBox="0 0 130 130" className="absolute">
        <defs>
          <linearGradient id="planRingGrad" x1="0" y1="0" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
        <motion.circle
          cx="65" cy="65" r={radius} fill="none" stroke="url(#planRingGrad)" strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.3))' }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-[28px] font-bold" style={{ color: '#00F0FF', textShadow: '0 0 12px rgba(0,240,255,0.4)' }}>
          {day}
        </span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">of 90 days</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Main PlanView Component                                      */
/* ══════════════════════════════════════════════════════════════ */

type DeckTab = 'metabolic' | 'fueling' | 'cellular';

export default function PlanView() {
  const sessionId = useSessionId();
  const day = useDayCount();
  const fatigueMap = useMuscleMap(sessionId);
  const [activeTab, setActiveTab] = useState<DeckTab>('metabolic');

  const vitals = useQuery(api.vitalsData.getVitalsTimeSeries, sessionId ? { sessionId } : 'skip');
  const bioVault = vitals?.bioVault ?? null;
  const hrvHistory = vitals?.hrvSeries?.map((s: { value: number }) => s.value) ?? [68, 72, 65, 78, 70, 75, 80];

  const workouts = useMemo(() => generateWorkoutRx(fatigueMap), [fatigueMap]);
  const meals = useMemo(() => generateMealRx(fatigueMap, bioVault), [fatigueMap, bioVault]);
  const supplements = useMemo(() => generateSupplementRx(bioVault, hrvHistory), [bioVault, hrvHistory]);
  const baselineMetrics = useMemo(() => generateBaselineMetrics(bioVault, hrvHistory), [bioVault, hrvHistory]);

  const tabs: Array<{ id: DeckTab; label: string; icon: string; count: number }> = [
    { id: 'metabolic', label: 'Movement', icon: '⚡', count: workouts.length },
    { id: 'fueling', label: 'What to Eat', icon: '🍽️', count: meals.length },
    { id: 'cellular', label: 'Supplements', icon: '🧬', count: supplements.length },
  ];

  return (
    <div className="px-4 pt-2 pb-40 space-y-6">
      {/* ── Hero Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold tracking-wide text-white/90">Your 90-Day Roadmap</h1>
          <p className="text-[11px] tracking-wider mt-0.5" style={{ color: 'rgba(0,240,255,0.5)' }}>
            YOUR PLAN — DAY {day}
          </p>
        </div>
        <DayProgressRing day={day} />
      </div>

      {/* ── Phase indicator ── */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/30">Current Phase</span>
          <span className="text-[10px] font-mono" style={{ color: '#00F0FF' }}>
            {day <= 30 ? 'FOUNDATION' : day <= 60 ? 'ACCELERATION' : 'OPTIMIZATION'}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((phase) => {
            const phaseDay = phase === 1 ? 30 : phase === 2 ? 60 : 90;
            const phaseStart = phase === 1 ? 0 : phase === 2 ? 30 : 60;
            const phaseProgress = Math.max(0, Math.min(1, (day - phaseStart) / 30));
            const isActive = day > phaseStart && day <= phaseDay;
            const isComplete = day > phaseDay;

            return (
              <div key={phase} className="flex-1">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: isComplete ? '100%' : `${phaseProgress * 100}%` }}
                    transition={{ duration: 1, delay: phase * 0.2 }}
                    style={{
                      background: isActive
                        ? 'linear-gradient(90deg, #00F0FF, #10B981)'
                        : isComplete ? '#10B981' : 'transparent',
                      boxShadow: isActive ? '0 0 8px rgba(0,240,255,0.4)' : 'none',
                    }}
                  />
                </div>
                <span className="text-[8px] text-white/20 mt-1 block text-center">
                  {phase === 1 ? 'Foundation' : phase === 2 ? 'Accelerate' : 'Optimize'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Intervention Deck Tabs ── */}
      <div>
        <h2 className="text-[14px] font-semibold text-white/80 mb-3 tracking-wide">Today&apos;s Plan</h2>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 relative rounded-xl py-2.5 px-3 transition-all duration-300"
              style={{
                background: activeTab === tab.id ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${activeTab === tab.id ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-base">{tab.icon}</span>
                <span className="text-[9px] uppercase tracking-wider font-medium"
                  style={{ color: activeTab === tab.id ? '#00F0FF' : 'rgba(255,255,255,0.3)' }}>
                  {tab.label}
                </span>
                <span className="text-[8px] font-mono"
                  style={{ color: activeTab === tab.id ? 'rgba(0,240,255,0.6)' : 'rgba(255,255,255,0.15)' }}>
                  {tab.count} items
                </span>
              </div>
              {activeTab === tab.id && (
                <motion.div layoutId="planTabIndicator" className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ background: '#00F0FF', boxShadow: '0 0 8px rgba(0,240,255,0.5)' }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'metabolic' && (
              <div className="space-y-3">
                <SectionHeader icon="⚡" title="MOVEMENT & ENERGY" subtitle="WORKOUTS MATCHED TO YOUR BODY TODAY" accentColor="#EF4444" />
                {workouts.map((rx, i) => <WorkoutCard key={rx.name} rx={rx} index={i} />)}
              </div>
            )}

            {activeTab === 'fueling' && (
              <div className="space-y-3">
                <SectionHeader icon="🍽️" title="WHAT TO EAT" subtitle="MEALS PICKED FOR YOUR BODY & TASTE" accentColor="#F59E0B" />
                {meals.map((rx, i) => <MealCard key={rx.name} rx={rx} index={i} />)}
              </div>
            )}

            {activeTab === 'cellular' && (
              <div className="space-y-3">
                <SectionHeader icon="🧬" title="DAILY SUPPLEMENTS" subtitle="BASED ON YOUR LATEST LAB RESULTS" accentColor="#A78BFA" />
                {supplements.map((rx, i) => <SupplementCard key={rx.name} rx={rx} index={i} />)}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Biological Delta Chart ── */}
      <div className="rounded-2xl p-5" style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 0 30px rgba(0,0,0,0.2)',
      }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-white/80">Transformation Progress</h3>
            <p className="text-[10px] tracking-wider" style={{ color: 'rgba(0,240,255,0.4)' }}>
              WHERE YOU ARE → WHERE YOU'RE HEADED
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#00F0FF', boxShadow: '0 0 6px rgba(0,240,255,0.5)' }} />
            <span className="text-[9px] text-white/30">Live tracking</span>
          </div>
        </div>

        <BiologicalDeltaChart metrics={baselineMetrics} />

        {/* Summary */}
        <div className="mt-4 pt-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] text-white/25">
            {baselineMetrics.filter((m) => {
              const isLower = m.label === 'CRP' || m.label === 'Body Fat';
              return isLower ? m.current <= m.target : m.current >= m.target;
            }).length} of {baselineMetrics.length} metrics on target
          </span>
          <span className="text-[10px] font-mono" style={{ color: '#10B981' }}>
            {90 - day} days remaining
          </span>
        </div>
      </div>
    </div>
  );
}
