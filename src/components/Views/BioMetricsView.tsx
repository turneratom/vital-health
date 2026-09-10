import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlowCard } from '@/components/Dashboard/GlowCard';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { useUserStyle } from '@/lib/useUserStyle';
import { HumanSummaryCard } from '@/components/HumanSummaryCard';

/* ── Mock Data Generator ── */
function generateHRData(length: number): number[] {
  const data: number[] = [];
  let val = 72;
  for (let i = 0; i < length; i++) {
    val += (Math.random() - 0.48) * 6;
    val = Math.max(55, Math.min(105, val));
    data.push(Math.round(val));
  }
  return data;
}

const SLEEP_STAGES = [
  { label: 'Deep', hours: 1.8, color: '#6B4AFF' },
  { label: 'REM', hours: 2.1, color: '#FF6BB5' },
  { label: 'Light', hours: 3.4, color: '#6B8AFF' },
  { label: 'Awake', hours: 0.3, color: '#FFB86B' },
];
const TOTAL_SLEEP = SLEEP_STAGES.reduce((s, st) => s + st.hours, 0);
const SLEEP_GOAL = 8;

const WEEKLY_STEPS = [
  { day: 'Mon', steps: 8420 },
  { day: 'Tue', steps: 12100 },
  { day: 'Wed', steps: 6800 },
  { day: 'Thu', steps: 10500 },
  { day: 'Fri', steps: 9200 },
  { day: 'Sat', steps: 14300 },
  { day: 'Sun', steps: 7600 },
];
const MAX_STEPS = Math.max(...WEEKLY_STEPS.map((d) => d.steps));

const RECOVERY_SCORE = 82;

/* ── Stagger variants ── */
const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

/* ═══════════════════════════════════════════════
   Heart Rate Card — Live SVG Line Graph
   ═══════════════════════════════════════════════ */
function HeartRateCard({ ghostMode, neon }: { ghostMode: boolean; neon: string }) {
  const [hrData, setHrData] = useState<number[]>(() => generateHRData(40));
  const [currentBPM, setCurrentBPM] = useState(72);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate live fluctuating HR data
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setHrData((prev) => {
        const next = [...prev.slice(1)];
        let last = prev[prev.length - 1];
        last += (Math.random() - 0.48) * 5;
        last = Math.max(55, Math.min(105, last));
        next.push(Math.round(last));
        setCurrentBPM(Math.round(last));
        return next;
      });
    }, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Build SVG path
  const width = 280;
  const height = 80;
  const padding = 4;
  const minVal = Math.min(...hrData) - 3;
  const maxVal = Math.max(...hrData) + 3;
  const range = maxVal - minVal || 1;

  const points = hrData.map((v, i) => {
    const x = padding + (i / (hrData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - minVal) / range) * (height - padding * 2);
    return { x, y };
  });

  // Smooth cubic bezier path
  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (pt.x - prev.x) * 0.4;
    const cpx2 = pt.x - (pt.x - prev.x) * 0.4;
    return `${acc} C ${cpx1},${prev.y} ${cpx2},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  // Gradient fill path (close to bottom)
  const fillD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  const lineColor = ghostMode ? 'rgba(160,160,160,0.6)' : '#00FFCC';
  const fillColor = ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.08)';
  const glowColor = ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(0,255,204,0.5)';

  return (
    <GlowCard className="p-4 flex flex-col gap-3" glowRadius={200}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Pulsing heart icon */}
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-sm"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : '#FF6B6B' }}
          >
            ♥
          </motion.div>
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: `${neon}0.5)` }}
          >
            Heart Rate
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <motion.span
            key={currentBPM}
            initial={{ opacity: 0.5, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-mono font-bold tabular-nums"
            style={{
              color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC',
              textShadow: ghostMode ? 'none' : '0 0 8px rgba(0,255,204,0.4)',
            }}
          >
            {currentBPM}
          </motion.span>
          <span className="text-[9px] font-mono" style={{ color: `${neon}0.35)` }}>
            bpm
          </span>
        </div>
      </div>

      {/* SVG Line Graph */}
      <div className="relative overflow-hidden rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ height: '80px' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
            <filter id="hrGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Fill area */}
          <path d={fillD} fill="url(#hrFill)" />
          {/* Glow line */}
          <path
            d={pathD}
            fill="none"
            stroke={glowColor}
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: 'url(#hrGlow)' }}
          />
          {/* Main line */}
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Current point (last data point) */}
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3"
            fill={lineColor}
            style={{
              filter: ghostMode ? 'none' : `drop-shadow(0 0 4px ${glowColor})`,
            }}
          />
        </svg>
      </div>

      {/* HR zones */}
      <div className="flex gap-2">
        {[
          { label: 'Rest', range: '55-65', active: currentBPM <= 65 },
          { label: 'Normal', range: '66-80', active: currentBPM > 65 && currentBPM <= 80 },
          { label: 'Elevated', range: '81-95', active: currentBPM > 80 && currentBPM <= 95 },
          { label: 'High', range: '96+', active: currentBPM > 95 },
        ].map((z) => (
          <div
            key={z.label}
            className="flex-1 text-center py-1 rounded"
            style={{
              background: z.active
                ? ghostMode
                  ? 'rgba(160,160,160,0.08)'
                  : 'rgba(0,255,204,0.06)'
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${
                z.active
                  ? ghostMode
                    ? 'rgba(160,160,160,0.15)'
                    : 'rgba(0,255,204,0.15)'
                  : 'rgba(255,255,255,0.03)'
              }`,
              transition: 'all 0.3s ease',
            }}
          >
            <span
              className="text-[8px] font-mono uppercase block"
              style={{
                color: z.active ? (ghostMode ? 'rgba(200,200,200,0.6)' : '#00FFCC') : `${neon}0.25)`,
              }}
            >
              {z.label}
            </span>
            <span
              className="text-[7px] font-mono tabular-nums"
              style={{ color: `${neon}0.2)` }}
            >
              {z.range}
            </span>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

/* ═══════════════════════════════════════════════
   Sleep Card — Circular Progress Ring
   ═══════════════════════════════════════════════ */
function SleepCard({ ghostMode, neon }: { ghostMode: boolean; neon: string }) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const sleepPct = Math.min(100, (TOTAL_SLEEP / SLEEP_GOAL) * 100);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(sleepPct), 200);
    return () => clearTimeout(timer);
  }, [sleepPct]);

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPct / 100) * circumference;

  return (
    <GlowCard className="p-4 flex flex-col gap-3" glowRadius={200}>
      <div className="flex items-center gap-2">
        <span style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : '#6B8AFF', fontSize: '14px' }}>☽</span>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.5)` }}>
          Sleep
        </span>
      </div>

      {/* Circular ring */}
      <div className="flex justify-center relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ghostMode ? 'rgba(160,160,160,0.4)' : '#6B8AFF'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: ghostMode ? 'none' : 'drop-shadow(0 0 6px rgba(107,138,255,0.4))',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-mono font-bold tabular-nums"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : '#6B8AFF' }}
          >
            {TOTAL_SLEEP.toFixed(1)}h
          </span>
          <span className="text-[8px] font-mono" style={{ color: `${neon}0.3)` }}>
            / {SLEEP_GOAL}h goal
          </span>
        </div>
      </div>

      {/* Sleep stages breakdown */}
      <div className="flex flex-col gap-1.5">
        {SLEEP_STAGES.map((stage) => (
          <div key={stage.label} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.3)' : stage.color,
                boxShadow: ghostMode ? 'none' : `0 0 4px ${stage.color}40`,
              }}
            />
            <span className="text-[9px] font-mono flex-1" style={{ color: `${neon}0.4)` }}>
              {stage.label}
            </span>
            <span
              className="text-[9px] font-mono tabular-nums font-semibold"
              style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : `${stage.color}CC` }}
            >
              {stage.hours}h
            </span>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

/* ═══════════════════════════════════════════════
   Recovery Card — Percentage Glow Meter
   ═══════════════════════════════════════════════ */
function RecoveryCard({ ghostMode, neon }: { ghostMode: boolean; neon: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(RECOVERY_SCORE), 300);
    return () => clearTimeout(timer);
  }, []);

  const getScoreColor = useCallback(
    (score: number) => {
      if (ghostMode) return 'rgba(160,160,160,0.5)';
      if (score >= 80) return '#00FFCC';
      if (score >= 60) return '#FFB86B';
      return '#FF6B6B';
    },
    [ghostMode]
  );

  const scoreColor = getScoreColor(RECOVERY_SCORE);
  const segments = 20;

  return (
    <GlowCard className="p-4 flex flex-col gap-3" glowRadius={200}>
      <div className="flex items-center gap-2">
        <span style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : '#00FFCC', fontSize: '14px' }}>⚡</span>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.5)` }}>
          Recovery
        </span>
      </div>

      {/* Big score */}
      <div className="flex flex-col items-center gap-2 py-2">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-4xl font-mono font-bold tabular-nums"
          style={{
            color: scoreColor,
            textShadow: ghostMode ? 'none' : `0 0 12px ${scoreColor}60, 0 0 30px ${scoreColor}20`,
          }}
        >
          {animatedScore}%
        </motion.span>
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>
          {RECOVERY_SCORE >= 80 ? 'Optimal' : RECOVERY_SCORE >= 60 ? 'Moderate' : 'Low'}
        </span>
      </div>

      {/* Segmented glow meter */}
      <div className="flex gap-[2px] px-1">
        {Array.from({ length: segments }).map((_, i) => {
          const segPct = ((i + 1) / segments) * 100;
          const isActive = segPct <= animatedScore;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scaleY: 0.3 }}
              animate={{
                opacity: isActive ? 1 : 0.15,
                scaleY: 1,
              }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.03 }}
              className="flex-1 h-3 rounded-sm"
              style={{
                background: isActive
                  ? ghostMode
                    ? 'rgba(160,160,160,0.4)'
                    : scoreColor
                  : 'rgba(255,255,255,0.04)',
                boxShadow: isActive && !ghostMode ? `0 0 4px ${scoreColor}40` : 'none',
                transition: 'background 0.3s ease, box-shadow 0.3s ease',
              }}
            />
          );
        })}
      </div>

      {/* Recovery metrics */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        {[
          { label: 'HRV', value: '48ms', good: true },
          { label: 'SpO2', value: '98%', good: true },
          { label: 'Temp', value: '36.6°', good: true },
        ].map((m) => (
          <div
            key={m.label}
            className="text-center py-1.5 rounded"
            style={{
              background: `${neon}0.03)`,
              border: `1px solid ${neon}0.06)`,
            }}
          >
            <span className="text-[8px] font-mono uppercase block" style={{ color: `${neon}0.3)` }}>
              {m.label}
            </span>
            <span
              className="text-[10px] font-mono font-semibold tabular-nums"
              style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : '#00FFCC' }}
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

/* ═══════════════════════════════════════════════
   Activity Card — Step-Count Bar Chart
   ═══════════════════════════════════════════════ */
function ActivityCard({ ghostMode, neon }: { ghostMode: boolean; neon: string }) {
  const todaySteps = WEEKLY_STEPS[WEEKLY_STEPS.length - 1].steps;
  const stepGoal = 10000;

  return (
    <GlowCard className="p-4 flex flex-col gap-3" glowRadius={200}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : '#FFB86B', fontSize: '14px' }}>◎</span>
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.5)` }}>
            Activity
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-sm font-mono font-bold tabular-nums"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : '#FFB86B' }}
          >
            {todaySteps.toLocaleString()}
          </span>
          <span className="text-[8px] font-mono" style={{ color: `${neon}0.3)` }}>
            / {(stepGoal / 1000).toFixed(0)}k
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5 px-1" style={{ height: '80px' }}>
        {WEEKLY_STEPS.map((d, i) => {
          const heightPct = (d.steps / MAX_STEPS) * 100;
          const isToday = i === WEEKLY_STEPS.length - 1;
          const hitGoal = d.steps >= stepGoal;
          const barColor = ghostMode
            ? 'rgba(160,160,160,0.3)'
            : isToday
              ? '#FFB86B'
              : hitGoal
                ? '#00FFCC'
                : 'rgba(0,255,204,0.3)';

          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                className="w-full rounded-t-sm relative"
                style={{
                  background: barColor,
                  boxShadow:
                    isToday && !ghostMode
                      ? '0 0 8px rgba(255,184,107,0.4), 0 -4px 12px rgba(255,184,107,0.15)'
                      : hitGoal && !ghostMode
                        ? '0 0 6px rgba(0,255,204,0.2)'
                        : 'none',
                  minHeight: '2px',
                }}
              >
                {/* Goal line indicator */}
                {isToday && (
                  <div
                    className="absolute -top-0.5 left-0 right-0 h-px"
                    style={{
                      background: ghostMode
                        ? 'rgba(160,160,160,0.2)'
                        : 'rgba(255,184,107,0.4)',
                    }}
                  />
                )}
              </motion.div>
              <span
                className="text-[7px] font-mono"
                style={{
                  color: isToday
                    ? ghostMode
                      ? 'rgba(200,200,200,0.5)'
                      : '#FFB86B'
                    : `${neon}0.25)`,
                }}
              >
                {d.day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Goal line label */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-px" style={{ background: `${neon}0.08)` }} />
        <span className="text-[8px] font-mono" style={{ color: `${neon}0.25)` }}>
          {(stepGoal / 1000).toFixed(0)}k goal
        </span>
        <div className="flex-1 h-px" style={{ background: `${neon}0.08)` }} />
      </div>

      {/* Weekly summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Avg', value: `${Math.round(WEEKLY_STEPS.reduce((s, d) => s + d.steps, 0) / 7).toLocaleString()}` },
          { label: 'Best', value: `${Math.max(...WEEKLY_STEPS.map((d) => d.steps)).toLocaleString()}` },
          { label: 'Distance', value: '38.2km' },
        ].map((m) => (
          <div
            key={m.label}
            className="text-center py-1.5 rounded"
            style={{
              background: `${neon}0.03)`,
              border: `1px solid ${neon}0.06)`,
            }}
          >
            <span className="text-[8px] font-mono uppercase block" style={{ color: `${neon}0.3)` }}>
              {m.label}
            </span>
            <span
              className="text-[10px] font-mono font-semibold tabular-nums"
              style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : 'rgba(255,255,255,0.6)' }}
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

/* ═══════════════════════════════════════════════
   Main BioMetricsView
   ═══════════════════════════════════════════════ */
export function BioMetricsView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const userStyle = useUserStyle();
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight font-mono"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : '#00FFCC' }}
          >
            Vitals
          </h2>
          <p
            className="text-xs font-mono tracking-widest uppercase mt-1"
            style={{ color: `${neon}0.4)` }}
          >
            Vital Signs &middot; Live
          </p>
        </div>
        <GlowCard className="px-4 py-2" glowRadius={150}>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-2 h-2 rounded-full"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.5)' : '#00FFCC',
                boxShadow: ghostMode ? 'none' : '0 0 8px rgba(0,255,204,0.6)',
              }}
            />
            <span
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: `${neon}0.5)` }}
            >
              Streaming
            </span>
          </div>
        </GlowCard>
      </div>

      {/* Core mode: simplified summary */}
      {userStyle === 'core' && (
        <div className="px-2">
          <HumanSummaryCard />
        </div>
      )}

      {/* Elite mode: full biometric charts */}
      {userStyle === 'elite' && (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={cardVariants} layout>
          <HeartRateCard ghostMode={ghostMode} neon={neon} />
        </motion.div>
        <motion.div variants={cardVariants} layout>
          <SleepCard ghostMode={ghostMode} neon={neon} />
        </motion.div>
        <motion.div variants={cardVariants} layout>
          <RecoveryCard ghostMode={ghostMode} neon={neon} />
        </motion.div>
        <motion.div variants={cardVariants} layout>
          <ActivityCard ghostMode={ghostMode} neon={neon} />
        </motion.div>
      </motion.div>
      )}

      {/* Bottom summary strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="flex justify-center"
      >
        <GlowCard className="px-6 py-3" glowRadius={300}>
          <div className="flex items-center gap-6">
            {[
              { label: 'Readiness', value: '87%', color: '#00FFCC' },
              { label: 'Strain', value: '12.4', color: '#FF6BB5' },
              { label: 'Calories', value: '2,180', color: '#FFB86B' },
              { label: 'Active Min', value: '48', color: '#6B8AFF' },
            ].map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>
                  {m.label}
                </span>
                <span
                  className="text-xs font-mono font-bold tabular-nums"
                  style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : m.color }}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </GlowCard>
      </motion.div>
    </div>
  );
}
