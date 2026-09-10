import { useState, useEffect, useMemo } from 'react';
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

/* ── Status levels with high-contrast colors ── */
type StatusLevel = 'great' | 'steady' | 'needs-rest';

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

const STATUS_MAP: Record<StatusLevel, StatusConfig> = {
  great: {
    label: 'Great',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.20)',
    dotColor: '#22C55E',
  },
  steady: {
    label: 'Steady',
    color: '#FACC15',
    bgColor: 'rgba(250, 204, 21, 0.08)',
    borderColor: 'rgba(250, 204, 21, 0.20)',
    dotColor: '#FACC15',
  },
  'needs-rest': {
    label: 'Needs Rest',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.20)',
    dotColor: '#EF4444',
  },
};

/* ── Sensor snapshot ── */
interface SensorSnapshot {
  hrv: number;
  hrvAvg7d: number;
  sleepHours: number;
  sleepScore: number;
  recovery: number;
  rhr: number;
  steps: number;
  strain: number;
  spo2: number;
}

/* ── Tip output ── */
interface QuickTip {
  message: string;
  status: StatusLevel;
  metric: string;
  metricLabel: string;
  icon: string;
  correlationTag: string;
}

/* ═══════════════════════════════════════════════
   CORRELATION ENGINE
   Cross-references: Vitality Score + Yesterday's Activity + Sensors
   ═══════════════════════════════════════════════ */
function correlationEngine(
  sensors: SensorSnapshot,
  vitalityScore: number | null,
  yesterdayActivityMinutes: number,
  yesterdayCaloriesBurned: number,
  hour: number,
): QuickTip {
  const vs = vitalityScore ?? 50; // fallback if no score yet
  const highActivityYesterday = yesterdayActivityMinutes >= 45 || yesterdayCaloriesBurned >= 400;
  const veryHighActivityYesterday = yesterdayActivityMinutes >= 90 || yesterdayCaloriesBurned >= 700;

  // ── RULE 1: Low Vitality + High Activity Yesterday → REST ──
  // "You pushed hard yesterday! Take it easy this morning."
  if (vs < 70 && highActivityYesterday) {
    const isVeryLow = vs < 50;
    if (isVeryLow && veryHighActivityYesterday) {
      return {
        message: "You really pushed yourself yesterday and your body needs time to bounce back. Rest today, stretch gently, and drink plenty of water.",
        status: 'needs-rest',
        metric: `${vs}`,
        metricLabel: 'Vitality',
        icon: 'V',
        correlationTag: 'low-vitality + very-high-activity',
      };
    }
    if (hour < 12) {
      return {
        message: "You pushed hard yesterday! Take it easy this morning. A light walk or some stretching is all you need today.",
        status: 'needs-rest',
        metric: `${vs}`,
        metricLabel: 'Vitality',
        icon: 'V',
        correlationTag: 'low-vitality + high-activity',
      };
    }
    return {
      message: "Yesterday was a big effort and your body is still catching up. Keep it light this afternoon and get to bed early tonight.",
      status: 'needs-rest',
      metric: `${vs}`,
      metricLabel: 'Vitality',
      icon: 'V',
      correlationTag: 'low-vitality + high-activity (pm)',
    };
  }

  // ── RULE 2: Both Above 80 → PEAK CONDITION ──
  // "You're in peak condition—great day for a challenge!"
  if (vs >= 80 && sensors.recovery >= 80) {
    if (highActivityYesterday) {
      return {
        message: "You trained hard yesterday AND bounced back beautifully. You're in peak condition — great day for a challenge!",
        status: 'great',
        metric: `${vs}`,
        metricLabel: 'Vitality',
        icon: 'V',
        correlationTag: 'peak + recovered-from-activity',
      };
    }
    return {
      message: "You're in peak condition today! Your body is rested and ready. This is a perfect day to push yourself and try something new.",
      status: 'great',
      metric: `${vs}`,
      metricLabel: 'Vitality',
      icon: 'V',
      correlationTag: 'peak-condition',
    };
  }

  // ── RULE 3: High Vitality + Low Activity Yesterday → ENCOURAGE ──
  if (vs >= 75 && !highActivityYesterday) {
    return {
      message: "Your body is feeling great and you took it easy yesterday. Today is a wonderful opportunity to get moving — even 20 minutes will feel amazing!",
      status: 'great',
      metric: `${vs}`,
      metricLabel: 'Vitality',
      icon: 'V',
      correlationTag: 'high-vitality + rest-day',
    };
  }

  // ── RULE 4: Sleep-based tips (morning priority) ──
  if (hour < 12) {
    if (sensors.sleepScore >= 85 && vs >= 70) {
      return {
        message: "You slept really well last night and your Vitality Score shows it! You have plenty of energy for a great day ahead.",
        status: 'great',
        metric: `${sensors.sleepHours.toFixed(1)}h`,
        metricLabel: 'Sleep',
        icon: 'M',
        correlationTag: 'good-sleep + good-vitality',
      };
    }
    if (sensors.sleepScore < 60) {
      return {
        message: "You didn't sleep much last night. Try to take it easy today, drink extra water, and maybe sneak in a short nap if you can.",
        status: 'needs-rest',
        metric: `${sensors.sleepHours.toFixed(1)}h`,
        metricLabel: 'Sleep',
        icon: 'M',
        correlationTag: 'poor-sleep',
      };
    }
  }

  // ── RULE 5: HRV below baseline → stress warning ──
  const hrvRatio = sensors.hrvAvg7d > 0 ? sensors.hrv / sensors.hrvAvg7d : 1;
  if (hrvRatio < 0.82 && vs < 65) {
    return {
      message: "Your stress levels are a bit elevated and your Vitality Score is lower than usual. Some deep breathing or a calm walk would help your body relax.",
      status: 'needs-rest',
      metric: `${sensors.hrv}ms`,
      metricLabel: 'HRV',
      icon: 'H',
      correlationTag: 'low-hrv + low-vitality',
    };
  }

  // ── RULE 6: HRV above baseline + good vitality → green light ──
  if (hrvRatio >= 1.1 && vs >= 70) {
    return {
      message: "Your heart is in great shape today and your Vitality Score agrees! This is a perfect day for that workout you've been planning.",
      status: 'great',
      metric: `${sensors.hrv}ms`,
      metricLabel: 'HRV',
      icon: 'H',
      correlationTag: 'high-hrv + good-vitality',
    };
  }

  // ── RULE 7: Afternoon step check ──
  if (hour >= 14) {
    if (sensors.steps < 3000 && vs >= 60) {
      return {
        message: "You've been sitting a lot today but your body has energy to spare. Even a 10-minute walk around the block would do wonders for how you feel.",
        status: 'steady',
        metric: `${sensors.steps.toLocaleString()}`,
        metricLabel: 'Steps',
        icon: 'S',
        correlationTag: 'low-steps + ok-vitality',
      };
    }
    if (sensors.steps >= 8000) {
      return {
        message: "You've been really active today! Great job staying on your feet. Keep it up, or take a well-deserved rest this evening.",
        status: 'great',
        metric: `${sensors.steps.toLocaleString()}`,
        metricLabel: 'Steps',
        icon: 'S',
        correlationTag: 'high-steps',
      };
    }
  }

  // ── RULE 8: Moderate vitality → steady encouragement ──
  if (vs >= 55 && vs < 75) {
    return {
      message: "Everything looks normal today. Stay hydrated, eat well, and listen to your body. Small consistent efforts add up to big results!",
      status: 'steady',
      metric: `${vs}`,
      metricLabel: 'Vitality',
      icon: 'V',
      correlationTag: 'moderate-vitality',
    };
  }

  // ── RULE 9: Low vitality without high activity → general rest ──
  if (vs < 55) {
    return {
      message: "Your body could use some extra care today. Focus on good food, plenty of water, and getting to bed a little earlier tonight.",
      status: 'needs-rest',
      metric: `${vs}`,
      metricLabel: 'Vitality',
      icon: 'V',
      correlationTag: 'low-vitality-general',
    };
  }

  // ── DEFAULT: Steady state ──
  return {
    message: "You're doing well today! Keep up the good habits — every healthy choice you make is building a stronger you.",
    status: 'steady',
    metric: `${vs}`,
    metricLabel: 'Vitality',
    icon: 'V',
    correlationTag: 'default-steady',
  };
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
      rhr: Math.round(52 + rng(6) * 18),
      steps: Math.round(1500 + rng(7) * 9000),
      strain: +(4 + rng(8) * 14).toFixed(1),
      spo2: +(96 + rng(9) * 3).toFixed(0) as unknown as number,
    };
  });
  return data;
}

/* ── Icon SVGs ── */
function SleepIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function HeartIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function RecoveryIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function StepsIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function VitalityIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function getIcon(iconKey: string, color: string) {
  switch (iconKey) {
    case 'M': return <SleepIcon color={color} />;
    case 'H': return <HeartIcon color={color} />;
    case 'R': return <RecoveryIcon color={color} />;
    case 'S': return <StepsIcon color={color} />;
    case 'V': return <VitalityIcon color={color} />;
    default: return <HeartIcon color={color} />;
  }
}

/* ══════════════════════════════════════════════
   QuickTipCard Component
   ══════════════════════════════════════════════ */
export function QuickTipCard() {
  const ghostMode = useGhostMode();
  const sessionId = useMemo(() => getSessionId(), []);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Auth session for skip pattern
  const { data: session } = useSession();

  // Pull Vitality Score from DB (skip if not authenticated)
  const eliteScore = useQuery(api.eliteScore.getBySession, session ? { sessionId } : 'skip');

  // Pull real bio-vault data if available
  const bioVault = useQuery(api.queries.getBioVaultBySession, session ? { sessionId } : 'skip');

  // Pull today's activity logs
  const todayActivity = useQuery(api.queries.listActivityLogs, session ? {} : 'skip');

  // Use simulated sensor data
  const sensorData = useSimulatedSensors();

  // Compute yesterday's activity from logs
  const yesterdayStats = useMemo(() => {
    if (!todayActivity) return { minutes: 0, calories: 0 };

    const now = Date.now();
    const yesterdayStart = now - 48 * 60 * 60 * 1000;
    const yesterdayEnd = now - 24 * 60 * 60 * 1000;

    let totalMinutes = 0;
    let totalCalories = 0;

    for (const log of todayActivity) {
      if (log.loggedAt >= yesterdayStart && log.loggedAt < yesterdayEnd) {
        totalMinutes += log.duration || 0;
        totalCalories += log.calories || 0;
      }
    }

    // If no real yesterday data, use simulated based on date seed
    if (totalMinutes === 0) {
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      const seed = yesterday.getFullYear() * 10000 + (yesterday.getMonth() + 1) * 100 + yesterday.getDate();
      const rng = ((seed * 9301 + 49297 + 42 * 233) % 233280) / 233280;
      totalMinutes = Math.round(15 + rng * 75); // 15-90 min
      totalCalories = Math.round(100 + rng * 600); // 100-700 cal
    }

    return { minutes: totalMinutes, calories: totalCalories };
  }, [todayActivity]);

  // Enrich sensor data with real step count from activity logs
  const enrichedData = useMemo(() => {
    const activitySteps = todayActivity
      ? todayActivity.reduce((sum, a) => {
          const name = (a.name || '').toLowerCase();
          if (name.includes('run') || name.includes('walk') || name.includes('jog')) {
            return sum + Math.round((a.duration || 0) * 120);
          }
          return sum;
        }, 0)
      : 0;

    return {
      ...sensorData,
      steps: activitySteps > 0 ? sensorData.steps + activitySteps : sensorData.steps,
    };
  }, [sensorData, todayActivity]);

  const hour = new Date().getHours();
  const vitalityScore = eliteScore?.score ?? null;

  const tip = useMemo(
    () => correlationEngine(enrichedData, vitalityScore, yesterdayStats.minutes, yesterdayStats.calories, hour),
    [enrichedData, vitalityScore, yesterdayStats, hour],
  );

  const status = STATUS_MAP[tip.status];

  // Ghost mode styling
  const ghostStatus: StatusConfig = {
    label: status.label,
    color: 'rgba(160,160,160,0.6)',
    bgColor: 'rgba(160,160,160,0.04)',
    borderColor: 'rgba(160,160,160,0.08)',
    dotColor: 'rgba(160,160,160,0.4)',
  };
  const s = ghostMode ? ghostStatus : status;

  const labelColor = ghostMode ? 'rgba(160,160,160,0.45)' : 'rgba(255,255,255,0.4)';
  const textColor = ghostMode ? 'rgba(160,160,160,0.7)' : 'rgba(255,255,255,0.85)';
  const subColor = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)';

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {mounted && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-xl border"
          style={{
            background: s.bgColor,
            borderColor: s.borderColor,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* Accent line at top */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: ghostMode
                ? 'rgba(160,160,160,0.1)'
                : `linear-gradient(90deg, ${s.color}44 0%, ${s.color} 50%, ${s.color}44 100%)`,
            }}
          />

          <div className="relative z-10 p-4 sm:p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {/* Pulsing status dot */}
                <div className="relative">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: s.dotColor }}
                  />
                  {!ghostMode && tip.status === 'great' && (
                    <motion.div
                      className="absolute inset-0 w-2 h-2 rounded-full"
                      style={{ background: s.dotColor }}
                      animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>
                <span
                  className="font-medium tracking-[0.08em] uppercase"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '10px',
                    color: labelColor,
                  }}
                >
                  Quick Tip
                </span>
              </div>

              {/* Status badge + dismiss */}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.06)' : `${s.color}15`,
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${s.color}30`}`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span
                    className="font-medium"
                    style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '9px',
                      color: s.color,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {s.label}
                  </span>
                </div>

                <button
                  onClick={() => setDismissed(true)}
                  className="flex items-center justify-center w-5 h-5 rounded-full transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: subColor,
                  }}
                  aria-label="Dismiss tip"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="2" y1="2" x2="8" y2="8" />
                    <line x1="8" y1="2" x2="2" y2="8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Main content row */}
            <div className="flex items-start gap-3.5">
              {/* Metric icon + value */}
              <div
                className="flex flex-col items-center shrink-0 pt-0.5"
                style={{ minWidth: 48 }}
              >
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg mb-1.5"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.06)' : `${s.color}12`,
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${s.color}20`}`,
                  }}
                >
                  {getIcon(tip.icon, s.color)}
                </div>
                <span
                  className="font-mono tabular-nums font-semibold"
                  style={{ fontSize: '13px', color: s.color, lineHeight: 1 }}
                >
                  {tip.metric}
                </span>
                <span
                  className="font-mono uppercase tracking-[0.1em] mt-0.5"
                  style={{ fontSize: '8px', color: subColor }}
                >
                  {tip.metricLabel}
                </span>
              </div>

              {/* Tip message */}
              <div className="flex-1 min-w-0">
                <p
                  className="leading-relaxed"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '14px',
                    color: textColor,
                    lineHeight: '1.6',
                  }}
                >
                  {tip.message}
                </p>
              </div>
            </div>

            {/* Correlation strip — shows what data was cross-referenced */}
            <div
              className="flex items-center gap-3 mt-3 pt-2.5"
              style={{ borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.04)'}` }}
            >
              <div className="flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={subColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span
                  className="font-mono"
                  style={{ fontSize: '9px', color: subColor, letterSpacing: '0.05em' }}
                >
                  Vitality {vitalityScore ?? '—'}
                  {yesterdayStats.minutes > 0 ? ` · Yesterday ${yesterdayStats.minutes}min` : ''}
                  {bioVault ? ' · Health records' : ''}
                </span>
              </div>
              <span
                className="font-mono ml-auto"
                style={{ fontSize: '9px', color: subColor, letterSpacing: '0.05em' }}
              >
                {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QuickTipCard;
