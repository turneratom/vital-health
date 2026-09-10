import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useSession } from '@/lib/auth-client';

/* ── Session ID helper ── */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem('vive-session-id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('vive-session-id', id);
  }
  return id;
}

/* ═══════════════════════════════════════════════
   MOOD DEFINITIONS
   Each mood has a background gradient, emoji, headline,
   subtitle, and accent colors.
   ═══════════════════════════════════════════════ */
type MoodLevel = 'sunny' | 'steady' | 'rest' | 'recharge';

interface MoodConfig {
  emoji: string;
  headline: string;
  subtitle: string;
  gradient: string;
  glowColor: string;
  textColor: string;
  subtitleColor: string;
  accentColor: string;
  badgeLabel: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  particleColor: string;
}

const MOOD_MAP: Record<MoodLevel, MoodConfig> = {
  sunny: {
    emoji: '☀️',
    headline: "You're Sunny Today!",
    subtitle: 'Your energy is high and your body feels great. Make the most of it!',
    gradient: 'linear-gradient(165deg, #F59E0B 0%, #D97706 25%, #B45309 50%, #92400E 75%, #1a1000 100%)',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    textColor: '#FFFBEB',
    subtitleColor: 'rgba(255, 251, 235, 0.75)',
    accentColor: '#FCD34D',
    badgeLabel: 'Peak Energy',
    badgeBg: 'rgba(253, 211, 77, 0.15)',
    badgeBorder: 'rgba(253, 211, 77, 0.3)',
    badgeText: '#FCD34D',
    particleColor: 'rgba(253, 211, 77, 0.4)',
  },
  steady: {
    emoji: '🌤️',
    headline: 'Looking Good Today!',
    subtitle: 'Everything is on track. Stay consistent and keep up the good work.',
    gradient: 'linear-gradient(165deg, #10B981 0%, #059669 25%, #047857 50%, #065F46 75%, #021a10 100%)',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    textColor: '#ECFDF5',
    subtitleColor: 'rgba(236, 253, 245, 0.7)',
    accentColor: '#6EE7B7',
    badgeLabel: 'On Track',
    badgeBg: 'rgba(110, 231, 183, 0.15)',
    badgeBorder: 'rgba(110, 231, 183, 0.3)',
    badgeText: '#6EE7B7',
    particleColor: 'rgba(110, 231, 183, 0.3)',
  },
  rest: {
    emoji: '☕',
    headline: 'Time for Tea & Rest',
    subtitle: 'Your body is asking for a break. Be gentle with yourself today.',
    gradient: 'linear-gradient(165deg, #3B82F6 0%, #2563EB 25%, #1D4ED8 50%, #1E3A8A 75%, #050a1a 100%)',
    glowColor: 'rgba(59, 130, 246, 0.25)',
    textColor: '#EFF6FF',
    subtitleColor: 'rgba(239, 246, 255, 0.7)',
    accentColor: '#93C5FD',
    badgeLabel: 'Rest Day',
    badgeBg: 'rgba(147, 197, 253, 0.15)',
    badgeBorder: 'rgba(147, 197, 253, 0.3)',
    badgeText: '#93C5FD',
    particleColor: 'rgba(147, 197, 253, 0.3)',
  },
  recharge: {
    emoji: '🌙',
    headline: 'Recharge & Recover',
    subtitle: 'You pushed hard recently. Focus on rest, water, and an early bedtime.',
    gradient: 'linear-gradient(165deg, #8B5CF6 0%, #7C3AED 25%, #6D28D9 50%, #4C1D95 75%, #0a0515 100%)',
    glowColor: 'rgba(139, 92, 246, 0.25)',
    textColor: '#F5F3FF',
    subtitleColor: 'rgba(245, 243, 255, 0.7)',
    accentColor: '#C4B5FD',
    badgeLabel: 'Recovery Mode',
    badgeBg: 'rgba(196, 181, 253, 0.15)',
    badgeBorder: 'rgba(196, 181, 253, 0.3)',
    badgeText: '#C4B5FD',
    particleColor: 'rgba(196, 181, 253, 0.3)',
  },
};

/* ── Sensor snapshot ── */
interface SensorSnapshot {
  hrv: number;
  hrvAvg7d: number;
  sleepHours: number;
  sleepScore: number;
  recovery: number;
  steps: number;
}

/* ── Simulated sensor data (consistent per day) ── */
function useSimulatedSensors(): SensorSnapshot {
  const [data] = useState<SensorSnapshot>(() => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const rng = (n: number) => ((seed * 9301 + 49297 + n * 233) % 233280) / 233280;
    return {
      hrv: Math.round(42 + rng(1) * 38),
      hrvAvg7d: Math.round(50 + rng(2) * 20),
      sleepHours: +(5.5 + rng(3) * 3).toFixed(1),
      sleepScore: Math.round(55 + rng(4) * 40),
      recovery: Math.round(30 + rng(5) * 65),
      steps: Math.round(1500 + rng(7) * 9000),
    };
  });
  return data;
}

/* ═══════════════════════════════════════════════
   MOOD ENGINE
   Determines mood from Readiness + sensors + yesterday activity
   ═══════════════════════════════════════════════ */
function determineMood(
  vitalityScore: number | null,
  sensors: SensorSnapshot,
  yesterdayActivityMinutes: number,
): MoodLevel {
  const vs = vitalityScore ?? 50;
  const highActivityYesterday = yesterdayActivityMinutes >= 45;
  const veryHighActivityYesterday = yesterdayActivityMinutes >= 90;

  // RULE 1: Both Vitality and Recovery above 80 → SUNNY (peak)
  if (vs >= 80 && sensors.recovery >= 80) {
    return 'sunny';
  }

  // RULE 2: Low Vitality + High Activity Yesterday → RECHARGE
  if (vs < 60 && veryHighActivityYesterday) {
    return 'recharge';
  }

  // RULE 3: Low Vitality + moderate activity → REST
  if (vs < 70 && highActivityYesterday) {
    return 'rest';
  }

  // RULE 4: Low recovery or low HRV → REST
  if (sensors.recovery < 45 || (sensors.hrv < sensors.hrvAvg7d * 0.75 && vs < 65)) {
    return 'rest';
  }

  // RULE 5: Poor sleep → REST
  if (sensors.sleepScore < 50 && vs < 65) {
    return 'rest';
  }

  // RULE 6: Good vitality (75+) → SUNNY
  if (vs >= 75 && sensors.recovery >= 65) {
    return 'sunny';
  }

  // RULE 7: Moderate vitality → STEADY
  if (vs >= 55) {
    return 'steady';
  }

  // RULE 8: Low vitality general → REST
  return 'rest';
}

/* ── Floating particle component ── */
function FloatingParticle({ color, delay, size, x, y, duration }: {
  color: string; delay: number; size: number; x: number; y: number; duration: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        left: `${x}%`,
        top: `${y}%`,
        filter: 'blur(1px)',
      }}
      animate={{
        y: [0, -20, 0],
        x: [0, 8, -5, 0],
        opacity: [0.2, 0.6, 0.2],
        scale: [0.8, 1.2, 0.8],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════
   ENERGY FORECAST — 12-hour projection curve
   Uses recovery + stress to simulate energy trajectory.
   High recovery → elevated curve. High stress → crash ~3 PM.
   ═══════════════════════════════════════════════ */
function generateEnergyProjection(recovery: number, stress: number, currentHour: number): { data: number[]; crashIndex: number | null; labels: string[] } {
  const points = 13; // 12 hours + current
  const data: number[] = [];
  const labels: string[] = [];
  let crashIndex: number | null = null;

  // Normalize inputs (0-1)
  const recoveryFactor = recovery / 100;
  const stressFactor = stress / 100;

  // Base energy starts from recovery level
  const baseEnergy = 40 + recoveryFactor * 45; // 40-85 range

  for (let i = 0; i < points; i++) {
    const hour = (currentHour + i) % 24;
    labels.push(`${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}`);

    // Natural circadian rhythm: dip around 2-3 PM, rise in morning
    const circadianOffset = hour >= 13 && hour <= 15
      ? -12 - (stressFactor * 18) // Afternoon dip amplified by stress
      : hour >= 9 && hour <= 11
        ? 8 + recoveryFactor * 7 // Morning peak
        : hour >= 17 && hour <= 19
          ? -5 - stressFactor * 8 // Evening decline
          : 0;

    // Stress decay: high stress causes progressive energy drain
    const stressDecay = stressFactor * (i * 2.2);

    // Recovery sustain: high recovery keeps energy elevated longer
    const recoverySustain = recoveryFactor * Math.max(0, 10 - i * 0.8);

    // Compute point
    let energy = baseEnergy + circadianOffset - stressDecay + recoverySustain;

    // Add slight natural variation
    const jitter = Math.sin(i * 1.7 + recovery * 0.1) * 3;
    energy += jitter;

    // Clamp 0-100
    energy = Math.max(5, Math.min(98, energy));
    data.push(Math.round(energy));

    // Detect crash: energy drops below 35 and stress is high, mark the 3 PM zone
    if (hour >= 14 && hour <= 16 && energy < 40 && stressFactor > 0.5 && crashIndex === null) {
      crashIndex = i;
    }
  }

  return { data, crashIndex, labels };
}

/* ── Energy Forecast Sparkline ── */
function EnergyForecastSparkline({ recovery, stress, accentColor, ghostMode }: {
  recovery: number; stress: number; accentColor: string; ghostMode: boolean;
}) {
  const currentHour = new Date().getHours();
  const { data, crashIndex, labels } = useMemo(
    () => generateEnergyProjection(recovery, stress, currentHour),
    [recovery, stress, currentHour],
  );

  const width = 260;
  const height = 52;
  const padX = 8;
  const padY = 6;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * (width - padX * 2),
    y: padY + (1 - (v - min) / range) * (height - padY * 2),
  }));

  // Smooth curve using cubic bezier
  const buildSmoothPath = useCallback(() => {
    if (points.length < 2) return '';
    let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  }, [points]);

  const linePath = buildSmoothPath();
  const fillPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;

  const lineColor = ghostMode ? 'rgba(160,160,160,0.4)' : accentColor;
  const fillColor = ghostMode ? 'rgba(160,160,160,0.06)' : accentColor;
  const labelColor = ghostMode ? 'rgba(160,160,160,0.3)' : `${accentColor}88`;
  const crashColor = '#EF4444';

  const gradId = useMemo(() => `forecast-grad-${Math.random().toString(36).slice(2, 8)}`, []);

  // Trend label
  const lastVal = data[data.length - 1];
  const firstVal = data[0];
  const trend = lastVal >= firstVal + 5 ? 'Rising' : lastVal <= firstVal - 10 ? 'Declining' : 'Stable';
  const trendIcon = trend === 'Rising' ? '📈' : trend === 'Declining' ? '📉' : '➡️';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.5 }}
      className="flex flex-col items-center gap-1 w-full mt-2"
    >
      {/* Label row */}
      <div className="flex items-center justify-between w-full" style={{ maxWidth: width + 16 }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: '10px' }}>⚡</span>
          <span
            className="font-semibold uppercase tracking-[0.1em]"
            style={{ fontSize: '8px', color: labelColor, fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            12h Energy Forecast
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ fontSize: '9px' }}>{trendIcon}</span>
          <span
            className="font-medium"
            style={{ fontSize: '9px', color: lineColor, fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {trend}
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        width={width}
        height={height + 14}
        viewBox={`0 0 ${width} ${height + 14}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        style={{ maxWidth: '100%' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path d={fillPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Current position dot */}
        <circle cx={points[0].x} cy={points[0].y} r={2.5} fill={lineColor} />
        <circle cx={points[0].x} cy={points[0].y} r={5} fill={lineColor} opacity={0.2}>
          <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Crash icon at ~3 PM */}
        {crashIndex !== null && (
          <g>
            {/* Crash zone highlight */}
            <rect
              x={points[crashIndex].x - 10}
              y={0}
              width={20}
              height={height}
              rx={4}
              fill={crashColor}
              opacity={0.08}
            />
            {/* Crash marker */}
            <circle cx={points[crashIndex].x} cy={points[crashIndex].y} r={3} fill={crashColor} opacity={0.9} />
            <circle cx={points[crashIndex].x} cy={points[crashIndex].y} r={6} fill={crashColor} opacity={0.15}>
              <animate attributeName="r" values="5;8;5" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0.03;0.15" dur="1.5s" repeatCount="indefinite" />
            </circle>
            {/* Crash label */}
            <text
              x={points[crashIndex].x}
              y={points[crashIndex].y - 7}
              textAnchor="middle"
              fill={crashColor}
              fontSize="7"
              fontWeight="600"
              fontFamily="Inter, system-ui, sans-serif"
            >
              ⚠ Crash
            </text>
          </g>
        )}

        {/* End dot */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2} fill={lineColor} opacity={0.6} />

        {/* Time labels */}
        {[0, 3, 6, 9, 12].map((idx) => (
          <text
            key={idx}
            x={points[idx].x}
            y={height + 11}
            textAnchor="middle"
            fill={idx === 0 ? lineColor : labelColor}
            fontSize="7"
            fontWeight={idx === 0 ? '600' : '400'}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {labels[idx]}
          </text>
        ))}
      </svg>

      {/* Crash warning text */}
      {crashIndex !== null && !ghostMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
        >
          <span style={{ fontSize: '8px' }}>⚠️</span>
          <span
            className="font-medium"
            style={{ fontSize: '8px', color: '#FCA5A5', fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            Energy crash predicted ~{labels[crashIndex]} — hydrate & snack before
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Metric pill with circular progress ring ── */
function MetricPill({ label, value, color, ghostMode, maxValue }: {
  label: string; value: string; color: string; ghostMode: boolean; maxValue?: number;
}) {
  // Parse numeric value from string (e.g. "72", "7.5h", "85%", "52ms")
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
  const unit = value.replace(/[0-9.]/g, '');

  // Normalize to 0-100 for ring progress
  const normalizedMax = maxValue ?? (
    label === 'Sleep' ? 10 :
    label === 'HRV' ? 100 :
    label === 'Ready?' ? 100 :
    label === 'Recovery' ? 100 : 100
  );
  const pct = Math.min(100, Math.max(0, (numericValue / normalizedMax) * 100));

  // Color transition: Warning Orange → Brand Cyan at 80%+
  // Below 50: dull orange #E8720C
  // 50-79: transitioning amber #E8A20C → #4DD8C0
  // 80+: Brand Cyan #00F0FF
  const getRingColor = (percent: number): string => {
    if (ghostMode) return 'rgba(160,160,160,0.35)';
    if (percent >= 80) return '#00F0FF';
    if (percent >= 65) {
      // Transition zone: amber to teal
      const t = (percent - 65) / 15;
      const r = Math.round(232 * (1 - t) + 0 * t);
      const g = Math.round(162 * (1 - t) + 220 * t);
      const b = Math.round(12 * (1 - t) + 240 * t);
      return `rgb(${r},${g},${b})`;
    }
    if (percent >= 40) return '#E8A20C'; // Amber
    return '#E8720C'; // Warning Orange
  };

  const ringColor = getRingColor(pct);
  const glowIntensity = pct >= 80 ? 0.6 : pct >= 60 ? 0.3 : 0.15;
  const glowColor = pct >= 80 && !ghostMode ? 'rgba(0, 240, 255, ' + glowIntensity + ')' : ringColor.replace('rgb', 'rgba').replace(')', `, ${glowIntensity})`);

  // SVG ring params
  const size = 28;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct / 100);

  const pillBg = ghostMode ? 'rgba(160,160,160,0.06)' : `${color}12`;
  const pillBorder = ghostMode ? 'rgba(160,160,160,0.08)' : `${color}20`;
  const pillLabel = ghostMode ? 'rgba(160,160,160,0.35)' : `${color}88`;
  const valueColor = ghostMode ? 'rgba(160,160,160,0.6)' : ringColor;

  const ringGradId = useMemo(() => `ring-${label}-${Math.random().toString(36).slice(2, 6)}`, [label]);

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-full"
      style={{
        background: pillBg,
        border: `1px solid ${pillBorder}`,
      }}
    >
      {/* Circular progress ring */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* Glow effect for high scores */}
        {pct >= 70 && !ghostMode && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
              filter: 'blur(3px)',
              transform: 'scale(1.4)',
            }}
          />
        )}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="relative"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <defs>
            <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={ringColor} />
              <stop offset="100%" stopColor={pct >= 80 && !ghostMode ? '#00C8FF' : ringColor} />
            </linearGradient>
          </defs>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ghostMode ? 'rgba(160,160,160,0.08)' : `${ringColor}15`}
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${ringGradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 1s ease-out, stroke 0.6s ease',
              filter: pct >= 80 && !ghostMode ? `drop-shadow(0 0 3px ${glowColor})` : 'none',
            }}
          />
        </svg>
        {/* Center value */}
        <div
          className="absolute inset-0 flex items-center justify-center"
        >
          <span
            className="font-mono tabular-nums font-bold leading-none"
            style={{
              fontSize: numericValue >= 100 ? '7px' : '8px',
              color: valueColor,
              textShadow: pct >= 80 && !ghostMode ? `0 0 6px ${glowColor}` : 'none',
            }}
          >
            {Math.round(numericValue)}
          </span>
        </div>
      </div>

      {/* Label + unit */}
      <div className="flex flex-col">
        <span
          className="font-mono uppercase tracking-[0.1em] leading-none"
          style={{ fontSize: '8px', color: pillLabel }}
        >
          {label}
        </span>
        {unit && (
          <span
            className="font-mono tabular-nums leading-none mt-0.5"
            style={{ fontSize: '9px', color: valueColor, opacity: 0.7 }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   DynamicStatusHeader Component
   Top 30% of screen — mood-based background
   ══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   RECOMMENDED PROTOCOL — Dynamic protocol card
   Based on readiness score:
   - Above 80: High Performance
   - Below 40: Active Recovery
   - 40-80: Steady State
   Clickable to update MissionBriefing content.
   ═══════════════════════════════════════════════ */
export type ProtocolType = 'high-performance' | 'active-recovery' | 'steady-state';

interface ProtocolConfig {
  type: ProtocolType;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  glowColor: string;
  bgColor: string;
  borderColor: string;
  pulse: boolean;
}

function getProtocolConfig(vitalityScore: number): ProtocolConfig {
  if (vitalityScore >= 80) {
    return {
      type: 'high-performance',
      label: 'Protocol: High Performance',
      subtitle: 'Your body is primed. Push hard, fuel smart, and capitalize on this window.',
      icon: '\u26A1',
      color: '#00F0FF',
      glowColor: 'rgba(0, 240, 255, 0.4)',
      bgColor: 'rgba(0, 240, 255, 0.06)',
      borderColor: 'rgba(0, 240, 255, 0.25)',
      pulse: false,
    };
  }
  if (vitalityScore < 40) {
    return {
      type: 'active-recovery',
      label: 'Protocol: Active Recovery',
      subtitle: 'Your system needs repair. Hydrate, stretch, and prioritize sleep tonight.',
      icon: '\uD83D\uDEE1\uFE0F',
      color: '#F59E0B',
      glowColor: 'rgba(245, 158, 11, 0.35)',
      bgColor: 'rgba(245, 158, 11, 0.06)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
      pulse: true,
    };
  }
  return {
    type: 'steady-state',
    label: 'Protocol: Steady State',
    subtitle: 'Maintain your rhythm. Consistent effort compounds over time.',
    icon: '\uD83C\uDFAF',
    color: '#6EE7B7',
    glowColor: 'rgba(110, 231, 183, 0.25)',
    bgColor: 'rgba(110, 231, 183, 0.06)',
    borderColor: 'rgba(110, 231, 183, 0.2)',
    pulse: false,
  };
}

function RecommendedProtocol({ vitalityScore, accentColor, ghostMode, onSelect, selected }: {
  vitalityScore: number; accentColor: string; ghostMode: boolean;
  onSelect?: (protocol: ProtocolType) => void; selected?: ProtocolType | null;
}) {
  const cfg = getProtocolConfig(vitalityScore);
  const isSelected = selected === cfg.type;

  const color = ghostMode ? 'rgba(160,160,160,0.5)' : cfg.color;
  const glow = ghostMode ? 'transparent' : cfg.glowColor;
  const bg = ghostMode ? 'rgba(160,160,160,0.04)' : cfg.bgColor;
  const border = ghostMode ? 'rgba(160,160,160,0.1)' : isSelected ? cfg.color : cfg.borderColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="w-full mt-2"
    >
      <motion.button
        type="button"
        onClick={() => onSelect?.(cfg.type)}
        className="w-full text-left relative overflow-hidden rounded-lg transition-all duration-300"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          cursor: 'pointer',
          outline: 'none',
        }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Pulse animation for Active Recovery */}
        {cfg.pulse && !ghostMode && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ border: `2px solid ${cfg.color}` }}
            animate={{
              opacity: [0.6, 0.15, 0.6],
              scale: [1, 1.02, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Cyan glow for High Performance */}
        {cfg.type === 'high-performance' && !ghostMode && (
          <div
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${glow} 0%, transparent 70%)`,
              opacity: isSelected ? 0.5 : 0.25,
            }}
          />
        )}

        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: ghostMode
              ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.15), transparent)'
              : `linear-gradient(90deg, transparent 10%, ${color} 50%, transparent 90%)`,
            opacity: isSelected ? 1 : 0.5,
          }}
        />

        <div className="relative z-10 p-2.5 flex items-center gap-2.5">
          {/* Icon container */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.08)' : `${cfg.color}15`,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${cfg.color}30`}`,
              boxShadow: !ghostMode && (isSelected || cfg.type === 'high-performance')
                ? `0 0 12px ${glow}` : 'none',
            }}
          >
            <span style={{ fontSize: '16px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>
              {cfg.icon}
            </span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="font-bold tracking-[0.04em] uppercase"
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '11px',
                  color,
                  textShadow: !ghostMode && cfg.type === 'high-performance' ? `0 0 8px ${glow}` : 'none',
                }}
              >
                {cfg.label}
              </span>
              {isSelected && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[7px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${cfg.color}20`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}40`,
                  }}
                >
                  Active
                </motion.span>
              )}
            </div>
            <p
              className="mt-0.5 leading-snug"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '10px',
                color: ghostMode ? 'rgba(160,160,160,0.4)' : `${cfg.color}99`,
                lineHeight: 1.5,
              }}
            >
              {cfg.subtitle}
            </p>
          </div>

          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 opacity-50">
            <path d="M5 3l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   PROTOCOL BADGE — Compact inline badge next to greeting
   ═══════════════════════════════════════════════ */
function ProtocolBadge({ vitalityScore, ghostMode, onClick }: {
  vitalityScore: number; ghostMode: boolean; onClick: () => void;
}) {
  const pcfg = getProtocolConfig(vitalityScore);
  const color = ghostMode ? 'rgba(160,160,160,0.5)' : pcfg.color;
  const bg = ghostMode ? 'rgba(160,160,160,0.06)' : `${pcfg.color}15`;
  const border = ghostMode ? 'rgba(160,160,160,0.12)' : `${pcfg.color}30`;
  const glow = ghostMode ? 'transparent' : pcfg.glowColor;
  const shortLabel = vitalityScore >= 80 ? 'High Performance' : vitalityScore < 40 ? 'Active Recovery' : 'Maintenance';
  const icon = vitalityScore >= 80 ? '\u26A1' : vitalityScore < 40 ? '\uD83D\uDEE1\uFE0F' : '\uD83C\uDFAF';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, duration: 0.4, type: 'spring', stiffness: 250 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full relative cursor-pointer"
      style={{ background: bg, border: `1px solid ${border}`, outline: 'none' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {!ghostMode && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `1.5px solid ${pcfg.color}` }}
          animate={{ opacity: [0.5, 0.12, 0.5], scale: [1, 1.12, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {!ghostMode && (
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, filter: 'blur(4px)', opacity: 0.4 }} />
      )}
      <span style={{ fontSize: '10px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none', position: 'relative', zIndex: 1 }}>{icon}</span>
      <span className="font-bold uppercase tracking-[0.08em] relative z-10" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '8px', color, textShadow: !ghostMode ? `0 0 6px ${glow}` : 'none' }}>{shortLabel}</span>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="relative z-10 opacity-60"><path d="M2 3l2 2 2-2" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════
   PROTOCOL DETAIL MODAL
   ═══════════════════════════════════════════════ */
function ProtocolDetailModal({ vitalityScore, ghostMode, onClose }: {
  vitalityScore: number; ghostMode: boolean; onClose: () => void;
}) {
  const pcfg = getProtocolConfig(vitalityScore);
  const color = ghostMode ? 'rgba(160,160,160,0.6)' : pcfg.color;
  const glow = ghostMode ? 'transparent' : pcfg.glowColor;
  const icon = vitalityScore >= 80 ? '\u26A1' : vitalityScore < 40 ? '\uD83D\uDEE1\uFE0F' : '\uD83C\uDFAF';
  const protocol = vitalityScore >= 80 ? {
    title: 'High Performance Protocol', subtitle: 'Your system is primed for peak output.',
    sections: [
      { ic: '\uD83C\uDFCB\uFE0F', t: 'Training', d: 'Push intensity to 85-95% max. Compound lifts, HIIT intervals, or race-pace efforts.' },
      { ic: '\uD83E\uDD69', t: 'Nutrition', d: 'Increase protein to 1.2g/lb. Add complex carbs pre-workout. 40g protein post-workout within 30 min.' },
      { ic: '\uD83D\uDC8A', t: 'Supplements', d: 'Creatine 5g, Beta-alanine 3.2g, Caffeine 200mg pre-workout. Electrolytes during training.' },
      { ic: '\uD83E\uDDE0', t: 'Mindset', d: 'Set an ambitious target. Visualize success. Your body and mind are aligned.' },
    ],
  } : vitalityScore < 40 ? {
    title: 'Active Recovery Protocol', subtitle: 'Your system needs repair. Prioritize restoration.',
    sections: [
      { ic: '\uD83D\uDEB6', t: 'Movement', d: 'Light walking 20-30 min, gentle yoga, or mobility work only. Zone 1-2 heart rate max.' },
      { ic: '\uD83D\uDCA7', t: 'Hydration', d: 'Target 3L+ water today. Add electrolytes. Avoid excess caffeine.' },
      { ic: '\uD83D\uDE34', t: 'Sleep', d: 'Aim for 8-9 hours tonight. No screens 1hr before bed. Cool room 65-68\u00B0F.' },
      { ic: '\uD83E\uDDD8', t: 'Stress', d: 'Box breathing 4-4-4-4 for 5 minutes. Reduce decision load today.' },
    ],
  } : {
    title: 'Maintenance Protocol', subtitle: 'Steady state \u2014 maintain rhythm and build consistency.',
    sections: [
      { ic: '\uD83C\uDFC3', t: 'Training', d: 'Moderate intensity 60-75% max. Focus on technique and volume.' },
      { ic: '\uD83E\uDD57', t: 'Nutrition', d: 'Balanced macros: 30% protein, 40% carbs, 30% fats. Whole foods.' },
      { ic: '\uD83D\uDC8A', t: 'Supplements', d: 'Daily multivitamin, Omega-3 2g, Vitamin D 2000IU, Magnesium 400mg.' },
      { ic: '\uD83D\uDCCA', t: 'Tracking', d: 'Log meals and training. Review weekly trends. Small improvements compound.' },
    ],
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(15,15,20,0.95)', border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : `${pcfg.color}30`}`, boxShadow: ghostMode ? 'none' : `0 0 40px ${glow}, 0 20px 60px rgba(0,0,0,0.5)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] w-full" style={{ background: ghostMode ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.2), transparent)' : `linear-gradient(90deg, transparent 5%, ${pcfg.color} 50%, transparent 95%)` }} />
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ghostMode ? 'rgba(160,160,160,0.08)' : `${pcfg.color}15`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${pcfg.color}30`}`, boxShadow: ghostMode ? 'none' : `0 0 12px ${glow}` }}>
                <span style={{ fontSize: '14px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>{icon}</span>
              </div>
              <div>
                <h2 className="font-bold tracking-[0.02em]" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px', color, textShadow: ghostMode ? 'none' : `0 0 10px ${glow}` }}>{protocol.title}</h2>
                <p className="mt-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', color: ghostMode ? 'rgba(160,160,160,0.4)' : `${pcfg.color}88`, lineHeight: 1.4 }}>{protocol.subtitle}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.04)' : `${pcfg.color}08`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${pcfg.color}15`}` }}>
            <span style={{ fontSize: '10px' }}>\uD83D\uDCCA</span>
            <span className="font-mono font-semibold" style={{ fontSize: '10px', color: ghostMode ? 'rgba(160,160,160,0.5)' : pcfg.color }}>Ready for Today? {vitalityScore}/100</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${vitalityScore}%` }} transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.3)' : pcfg.color }} />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 space-y-2.5">
          {protocol.sections.map((s, i) => (
            <motion.div key={s.t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
              className="flex gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : `${pcfg.color}10`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${pcfg.color}18`}` }}>
                <span style={{ fontSize: '12px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>{s.ic}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold uppercase tracking-[0.08em]" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '9px', color }}>{s.t}</span>
                <p className="mt-0.5 leading-relaxed" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <motion.button type="button" onClick={onClose} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-2.5 rounded-lg font-bold uppercase tracking-[0.1em]" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', color: ghostMode ? 'rgba(160,160,160,0.6)' : pcfg.color, background: ghostMode ? 'rgba(160,160,160,0.06)' : `${pcfg.color}12`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${pcfg.color}25`}` }}>
            Got It
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   DAILY BRIEFING — 3 human-readable data sentences
   Uses latest sensor snapshot to generate plain-language insights.
   Large readable font (18px+), generous whitespace.
   ═══════════════════════════════════════════════ */
function generateBriefingSentences(sensors: SensorSnapshot, vitalityScore: number): string[] {
  const sentences: string[] = [];

  // 1. Sleep insight
  if (sensors.sleepHours >= 7.5 && sensors.sleepScore >= 70) {
    sentences.push('You slept well, so your energy is high.');
  } else if (sensors.sleepHours >= 6 && sensors.sleepScore >= 50) {
    sentences.push('You got decent sleep — not perfect, but enough to work with.');
  } else {
    sentences.push('Sleep was rough last night. Go easy on yourself today.');
  }

  // 2. Activity / recovery insight
  if (sensors.recovery >= 75 && sensors.steps >= 5000) {
    sentences.push("You've been active, keep it up!");
  } else if (sensors.recovery >= 60) {
    sentences.push('Your body is recovering well. Stay consistent.');
  } else if (sensors.recovery >= 40) {
    sentences.push('Recovery is moderate — listen to how you feel before pushing hard.');
  } else {
    sentences.push('Your body needs rest. A light walk is plenty today.');
  }

  // 3. Overall readiness insight
  if (vitalityScore >= 80) {
    sentences.push("You're in great shape — make today count.");
  } else if (vitalityScore >= 65) {
    sentences.push('Solid foundation today. Small wins add up.');
  } else if (vitalityScore >= 50) {
    sentences.push('Not your peak, but still a good day to stay on track.');
  } else {
    sentences.push('Take it slow. Rest is part of the process.');
  }

  return sentences;
}

function DailyBriefing({ sensors, vitalityScore, ghostMode, textColor, subtitleColor }: {
  sensors: SensorSnapshot; vitalityScore: number; ghostMode: boolean;
  textColor: string; subtitleColor: string;
}) {
  const sentences = useMemo(
    () => generateBriefingSentences(sensors, vitalityScore),
    [sensors, vitalityScore],
  );

  const color = ghostMode ? 'rgba(160,160,160,0.7)' : textColor;
  const dimColor = ghostMode ? 'rgba(160,160,160,0.35)' : subtitleColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.45 }}
      className="w-full py-3 px-1"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ fontSize: '12px' }}>📋</span>
        <span
          className="font-semibold uppercase tracking-[0.12em]"
          style={{
            fontSize: '10px',
            color: dimColor,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Daily Briefing
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sentences.map((sentence, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.42 + i * 0.1, duration: 0.35 }}
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '18px',
              lineHeight: '1.5',
              color,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            {sentence}
          </motion.p>
        ))}
      </div>
    </motion.div>
  );
}

interface DynamicStatusHeaderProps {
  onSelectProtocol?: (protocol: ProtocolType) => void;
  selectedProtocol?: ProtocolType | null;
}

export function DynamicStatusHeader({ onSelectProtocol, selectedProtocol }: DynamicStatusHeaderProps) {
  const ghostMode = useGhostMode();
  const sessionId = useMemo(() => getSessionId(), []);
  const [mounted, setMounted] = useState(false);
  const [showProtocolModal, setShowProtocolModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  // Auth session for skip pattern — prevents 'Unauthenticated' crash
  const { data: session } = useSession();

  const eliteScore = useQuery(api.eliteScore.getBySession, session ? { sessionId } : 'skip');
  const todayActivity = useQuery(api.queries.listActivityLogs, session ? {} : 'skip');
  const todayFoodLogs = useQuery(api.queries.listFoodLogs, session ? {} : 'skip');
  const sensors = useSimulatedSensors();

  // Detect if user has ANY synced data (even one piece)
  const hasAnyData = useMemo(() => {
    const hasScore = eliteScore != null && eliteScore.score != null;
    const hasActivity = todayActivity != null && todayActivity.length > 0;
    const hasFood = todayFoodLogs != null && todayFoodLogs.length > 0;
    return hasScore || hasActivity || hasFood;
  }, [eliteScore, todayActivity, todayFoodLogs]);

  // Still loading data from server
  const isDataLoading = eliteScore === undefined && todayActivity === undefined && todayFoodLogs === undefined;

  const yesterdayMinutes = useMemo(() => {
    if (!todayActivity) return 0;
    const now = Date.now();
    const yesterdayStart = now - 48 * 60 * 60 * 1000;
    const yesterdayEnd = now - 24 * 60 * 60 * 1000;
    let total = 0;
    for (const log of todayActivity) {
      if (log.loggedAt >= yesterdayStart && log.loggedAt < yesterdayEnd) {
        total += log.duration || 0;
      }
    }
    if (total === 0) {
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      const seed = yesterday.getFullYear() * 10000 + (yesterday.getMonth() + 1) * 100 + yesterday.getDate();
      const rng = ((seed * 9301 + 49297 + 42 * 233) % 233280) / 233280;
      total = Math.round(15 + rng * 75);
    }
    return total;
  }, [todayActivity]);

  const vitalityScore = eliteScore?.score ?? null;
  const mood = useMemo(
    () => determineMood(vitalityScore, sensors, yesterdayMinutes),
    [vitalityScore, sensors, yesterdayMinutes],
  );

  const m = MOOD_MAP[mood];

  const ghostConfig: MoodConfig = {
    ...m,
    gradient: 'linear-gradient(165deg, rgba(80,80,80,0.3) 0%, rgba(40,40,40,0.2) 50%, rgba(20,20,20,0.4) 100%)',
    glowColor: 'rgba(160,160,160,0.08)',
    textColor: 'rgba(160,160,160,0.7)',
    subtitleColor: 'rgba(160,160,160,0.45)',
    accentColor: 'rgba(160,160,160,0.5)',
    badgeBg: 'rgba(160,160,160,0.06)',
    badgeBorder: 'rgba(160,160,160,0.1)',
    badgeText: 'rgba(160,160,160,0.5)',
    particleColor: 'rgba(160,160,160,0.1)',
  };

  const cfg = ghostMode ? ghostConfig : m;
  const vs = vitalityScore ?? 50;

  const particles = useMemo(() => {
    const items: Array<{ id: number; delay: number; size: number; x: number; y: number; duration: number }> = [];
    for (let i = 0; i < 5; i++) {
      items.push({
        id: i,
        delay: i * 0.6,
        size: 3 + (i % 3) * 2,
        x: 10 + (i * 13) % 80,
        y: 15 + (i * 17) % 60,
        duration: 4 + (i % 3) * 1.5,
      });
    }
    return items;
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <>
    <AnimatePresence>
      {mounted && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            maxHeight: '340px',
            background: cfg.gradient,
          }}
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 30% 20%, ${cfg.glowColor} 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 50% 40% at 75% 80%, ${cfg.glowColor} 0%, transparent 60%)`,
              opacity: 0.5,
            }}
          />

          {/* Floating particles */}
          {!ghostMode && particles.map((p) => (
            <FloatingParticle
              key={p.id}
              color={cfg.particleColor}
              delay={p.delay}
              size={p.size}
              x={p.x}
              y={p.y}
              duration={p.duration}
            />
          ))}

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-between h-full p-4 sm:p-5">
            {/* Top row: greeting + protocol badge + mood badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="font-semibold tracking-[0.04em]"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '13px',
                    color: cfg.textColor,
                  }}
                >
                  {greeting}
                </motion.span>

                {/* Protocol Badge */}
                <ProtocolBadge
                  vitalityScore={vs}
                  ghostMode={ghostMode}
                  onClick={() => setShowProtocolModal(true)}
                />
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: cfg.badgeBg,
                  border: `1px solid ${cfg.badgeBorder}`,
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: cfg.badgeText }}
                />
                <span
                  className="font-medium tracking-[0.06em]"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '9px',
                    color: cfg.badgeText,
                  }}
                >
                  {cfg.badgeLabel}
                </span>
              </motion.div>
            </div>

            {/* Center: horizontal layout */}
            <div className="flex items-center gap-3 py-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 200 }}
                className="text-3xl flex-shrink-0"
                style={{ filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}
              >
                {m.emoji}
              </motion.div>

              <div className="flex flex-col min-w-0">
                <motion.h1
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="font-bold leading-tight"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 'clamp(18px, 4vw, 24px)',
                    color: cfg.textColor,
                    letterSpacing: '-0.01em',
                    textShadow: ghostMode ? 'none' : '0 2px 8px rgba(0,0,0,0.25)',
                  }}
                >
                  {m.headline}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  className="mt-0.5 leading-snug"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '11px',
                    color: cfg.subtitleColor,
                    lineHeight: '1.5',
                  }}
                >
                  {m.subtitle}
                </motion.p>
              </div>
            </div>

            {/* ═══ DATA-AWARE CONTENT ═══ */}
            {!hasAnyData && !isDataLoading ? (
              /* ── BLANK CANVAS STATE: No data synced yet ── */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="flex flex-col items-center text-center py-4 gap-3"
              >
                {/* Welcoming sparkle icon */}
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.06)' : `${cfg.accentColor}15`,
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${cfg.accentColor}25`}`,
                    boxShadow: ghostMode ? 'none' : `0 0 20px ${cfg.glowColor}`,
                  }}
                >
                  <span style={{ fontSize: '28px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>✨</span>
                </motion.div>

                {/* Blank canvas message */}
                <div className="flex flex-col gap-1">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '20px',
                      fontWeight: 600,
                      color: cfg.textColor,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3,
                    }}
                  >
                    Today is a blank canvas.
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '20px',
                      fontWeight: 600,
                      color: cfg.textColor,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3,
                    }}
                  >
                    We're ready when you are.
                  </motion.p>
                </div>

                {/* Gentle nudge — not a requirement */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.75, duration: 0.4 }}
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '12px',
                    color: cfg.subtitleColor,
                    lineHeight: 1.5,
                    maxWidth: 260,
                  }}
                >
                  Log a meal, track a workout, or just check in — every small step counts.
                </motion.p>

                {/* Soft pulsing dots instead of checklists */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="flex items-center gap-2 mt-1"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="rounded-full"
                      style={{
                        width: 6,
                        height: 6,
                        background: ghostMode ? 'rgba(160,160,160,0.2)' : `${cfg.accentColor}40`,
                      }}
                      animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              /* ── HAS DATA STATE: Show full dashboard with celebration ── */
              <>
                {/* Celebration banner when user has synced even one piece of data */}
                {hasAnyData && !isDataLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.32, duration: 0.4 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
                    style={{
                      background: ghostMode ? 'rgba(160,160,160,0.04)' : `${cfg.accentColor}10`,
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${cfg.accentColor}20`}`,
                    }}
                  >
                    <motion.span
                      animate={{ rotate: [0, 12, -12, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ fontSize: '14px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}
                    >
                      🎉
                    </motion.span>
                    <span
                      className="font-semibold"
                      style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: '12px',
                        color: ghostMode ? 'rgba(160,160,160,0.6)' : cfg.textColor,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      You've already started your day right!
                    </span>
                  </motion.div>
                )}

                {/* Daily Briefing — 3 human sentences from latest data */}
                <DailyBriefing sensors={sensors} vitalityScore={vs} ghostMode={ghostMode} textColor={cfg.textColor} subtitleColor={cfg.subtitleColor} />

                {/* Bottom: metric pills */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.35 }}
                  className="flex items-center justify-center gap-1.5 flex-wrap"
                >
                  <MetricPill label="Ready?" value={`${vs}`} color={cfg.accentColor} ghostMode={ghostMode} />
                  <MetricPill label="Sleep" value={`${sensors.sleepHours}h`} color={cfg.accentColor} ghostMode={ghostMode} />
                  <MetricPill label="Recovery" value={`${sensors.recovery}%`} color={cfg.accentColor} ghostMode={ghostMode} />
                  <MetricPill label="HRV" value={`${sensors.hrv}ms`} color={cfg.accentColor} ghostMode={ghostMode} />
                </motion.div>

                {/* Recommended Protocol card */}
                <RecommendedProtocol
                  vitalityScore={vs}
                  accentColor={cfg.accentColor}
                  ghostMode={ghostMode}
                  onSelect={onSelectProtocol}
                  selected={selectedProtocol}
                />

                {/* Energy Forecast Sparkline */}
                <EnergyForecastSparkline
                  recovery={sensors.recovery}
                  stress={Math.max(0, 100 - sensors.recovery - (sensors.sleepScore > 70 ? 15 : 0) + (sensors.hrv < sensors.hrvAvg7d ? 20 : 0))}
                  accentColor={cfg.accentColor}
                  ghostMode={ghostMode}
                />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Protocol Detail Modal */}
    <AnimatePresence>
      {showProtocolModal && (
        <ProtocolDetailModal
          vitalityScore={vs}
          ghostMode={ghostMode}
          onClose={() => setShowProtocolModal(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

export default DynamicStatusHeader;
