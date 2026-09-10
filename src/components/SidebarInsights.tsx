import { useMemo, useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getSessionId } from '@/components/Presence/usePresenceState';
import { useBiometricSync } from '@/hooks/useBiometricSync';

/* ══════════════════════════════════════════════════════════════
 * SIDEBAR INSIGHTS — Digital Twin Quiet Observations
 *
 * Analyzes labResults + physicalBaseline + live biometrics +
 * 14-day Vitality Score trends from Convex to produce a single
 * sentence of encouragement.
 *
 * NEW: Week-over-Week Trend Insights
 * Pulls getVitalityScores14d to compute this-week vs last-week
 * deltas, generating messages like "Your resilience is up 4%
 * this week—keep the momentum on Zone 2."
 *
 * Recovery State Detection
 * When live vitals show low HRV or poor sleep, the Twin shifts
 * into recovery mode — surfacing a calm, supportive observation.
 *
 * Never uses discouraging language. Feels like the Digital Twin
 * offering a quiet observation.
 * ══════════════════════════════════════════════════════════════ */

/* ── Recovery State Detection Thresholds ── */
const RECOVERY_THRESHOLDS = {
  hrvLow: 40,
  sleepScoreLow: 60,
  sleepHoursLow: 5.5,
  recoveryLow: 45,
  deepSleepLow: 12,
  bodyBatteryLow: 30,
};

export interface RecoveryState {
  isRecoveryMode: boolean;
  recoveryIntensity: number;
  triggers: string[];
  primaryLever: 'sleep' | 'hrv' | 'energy' | 'general';
}

export function detectRecoveryState(vitals: {
  hrv: number;
  sleepScore: number;
  sleepHours: number;
  recovery: number;
  sleepDeepPct: number;
  bodyBattery: number;
}): RecoveryState {
  const triggers: string[] = [];
  let intensity = 0;
  let primaryLever: RecoveryState['primaryLever'] = 'general';

  if (vitals.hrv > 0 && vitals.hrv < RECOVERY_THRESHOLDS.hrvLow) {
    triggers.push('hrv');
    const deficit = (RECOVERY_THRESHOLDS.hrvLow - vitals.hrv) / RECOVERY_THRESHOLDS.hrvLow;
    intensity += deficit * 0.4;
    primaryLever = 'hrv';
  }
  if (vitals.sleepScore > 0 && vitals.sleepScore < RECOVERY_THRESHOLDS.sleepScoreLow) {
    triggers.push('sleep-quality');
    const deficit = (RECOVERY_THRESHOLDS.sleepScoreLow - vitals.sleepScore) / RECOVERY_THRESHOLDS.sleepScoreLow;
    intensity += deficit * 0.25;
    if (primaryLever === 'general') primaryLever = 'sleep';
  }
  if (vitals.sleepHours > 0 && vitals.sleepHours < RECOVERY_THRESHOLDS.sleepHoursLow) {
    triggers.push('sleep-duration');
    const deficit = (RECOVERY_THRESHOLDS.sleepHoursLow - vitals.sleepHours) / RECOVERY_THRESHOLDS.sleepHoursLow;
    intensity += deficit * 0.2;
    if (primaryLever === 'general') primaryLever = 'sleep';
  }
  if (vitals.recovery > 0 && vitals.recovery < RECOVERY_THRESHOLDS.recoveryLow) {
    triggers.push('recovery-index');
    const deficit = (RECOVERY_THRESHOLDS.recoveryLow - vitals.recovery) / RECOVERY_THRESHOLDS.recoveryLow;
    intensity += deficit * 0.2;
  }
  if (vitals.sleepDeepPct > 0 && vitals.sleepDeepPct < RECOVERY_THRESHOLDS.deepSleepLow) {
    triggers.push('deep-sleep');
    intensity += 0.1;
    if (primaryLever === 'general') primaryLever = 'sleep';
  }
  if (vitals.bodyBattery > 0 && vitals.bodyBattery < RECOVERY_THRESHOLDS.bodyBatteryLow) {
    triggers.push('energy');
    intensity += 0.1;
    if (primaryLever === 'general') primaryLever = 'energy';
  }

  intensity = Math.min(1, Math.max(0, intensity));
  const isRecoveryMode = triggers.length >= 2 || intensity >= 0.3;
  return { isRecoveryMode, recoveryIntensity: intensity, triggers, primaryLever };
}

/* ── Optimal ranges for longevity-focused biomarkers ── */
const MARKER_INSIGHTS: Record<string, {
  optimalLow: number;
  optimalHigh: number;
  unit: string;
  onTrack: (value: number) => string;
  nudge: (value: number) => string;
  elite: (value: number) => string;
}> = {
  ApoB: {
    optimalLow: 0,
    optimalHigh: 80,
    unit: 'mg/dL',
    onTrack: (v) =>
      `Your ApoB at ${v} mg/dL is tracking toward the longevity-optimized range. You've built a strong cardiovascular foundation.`,
    nudge: (v) =>
      `Your ApoB is at ${v} mg/dL. Small dietary shifts \u2014 like increasing soluble fiber \u2014 can gently guide this marker toward an even stronger foundation.`,
    elite: (v) =>
      `Your ApoB levels at ${v} mg/dL are trending toward the 95th percentile of longevity. You've built a remarkable foundation.`,
  },
  Testosterone: {
    optimalLow: 400,
    optimalHigh: 900,
    unit: 'ng/dL',
    onTrack: (v) =>
      `Testosterone at ${v} ng/dL reflects a well-calibrated hormonal environment. Your recovery and drive benefit from this balance.`,
    nudge: (v) =>
      `Your testosterone is at ${v} ng/dL. Prioritizing sleep quality and resistance training can naturally support hormonal optimization.`,
    elite: (v) =>
      `Testosterone at ${v} ng/dL places you in an elite hormonal bracket. Your body is primed for adaptation and recovery.`,
  },
  'Vitamin D': {
    optimalLow: 40,
    optimalHigh: 80,
    unit: 'ng/mL',
    onTrack: (v) =>
      `Vitamin D at ${v} ng/mL supports immune resilience and bone density. Your levels reflect consistent attention to this marker.`,
    nudge: (v) =>
      `Vitamin D is at ${v} ng/mL. Morning sunlight and supplementation can help you reach the optimal zone where immune and metabolic benefits compound.`,
    elite: (v) =>
      `Vitamin D at ${v} ng/mL is in the optimal longevity corridor. Your immune system and metabolic health are well-supported.`,
  },
};

/* ── Recovery-mode Twin observations ── */
const RECOVERY_INSIGHTS: Record<RecoveryState['primaryLever'], string[]> = {
  hrv: [
    'Recovery is your primary lever today. Your OS is shifting to high-efficiency mode.',
    'Your autonomic system is requesting a gentler pace today. The Twin is prioritizing parasympathetic restoration.',
    'Your body is consolidating. Recovery protocols are now your highest-return investment.',
  ],
  sleep: [
    'Recovery is your primary lever today. Your OS is shifting to high-efficiency mode.',
    'Sleep architecture is recalibrating. Your Twin has shifted today\'s priorities toward restoration.',
    'Your system is in a consolidation phase. The protocols ahead are designed to accelerate your return to baseline.',
  ],
  energy: [
    'Recovery is your primary lever today. Your OS is shifting to high-efficiency mode.',
    'Energy reserves are rebuilding. Your Twin has queued recovery-first protocols for maximum efficiency.',
    'Your cellular energy systems are recharging. Today\'s stack is optimized for restoration.',
  ],
  general: [
    'Recovery is your primary lever today. Your OS is shifting to high-efficiency mode.',
    'Your biological systems are requesting a recovery window. The Twin is adapting your protocols accordingly.',
    'Today is a consolidation day. Your Twin has reorganized priorities to support your body\'s natural repair cycle.',
  ],
};

/* ── Week-over-week trend insight templates ── */
interface TrendData {
  thisWeekAvg: number;
  lastWeekAvg: number;
  deltaPercent: number;
  direction: 'up' | 'down' | 'stable';
  dataPoints: number;
}

const TREND_INSIGHTS = {
  strongUp: [
    (d: number) => `Your resilience is up ${d}% this week\u2014keep the momentum on Zone 2.`,
    (d: number) => `Vitality trending ${d}% higher than last week. Your protocols are compounding.`,
    (d: number) => `Your biological trajectory is climbing\u2014${d}% improvement this week. The consistency is paying off.`,
    (d: number) => `${d}% vitality gain this week. Your Twin sees a pattern of deliberate optimization.`,
  ],
  mildUp: [
    (d: number) => `Steady upward trajectory\u2014${d}% improvement this week. Small gains compound.`,
    (d: number) => `Your vitality is edging up ${d}% week-over-week. The direction matters more than the magnitude.`,
    (d: number) => `A quiet ${d}% gain this week. Your system is responding to the protocol stack.`,
  ],
  stable: [
    () => 'Your vitality is holding steady this week. Stability at this level is itself an achievement.',
    () => 'Consistent baseline this week\u2014your Twin sees a well-maintained system.',
    () => 'Your biological rhythm is stable. The protocols are maintaining your foundation.',
  ],
  mildDown: [
    (d: number) => `Your vitality dipped ${Math.abs(d)}% this week\u2014your Twin has adjusted today\'s stack to support recovery.`,
    (d: number) => `A ${Math.abs(d)}% shift this week. Your system is recalibrating\u2014recovery protocols are prioritized.`,
    (d: number) => `${Math.abs(d)}% variance this week. Your Twin sees this as a consolidation phase, not a setback.`,
  ],
  strongDown: [
    (d: number) => `Your system is requesting attention\u2014${Math.abs(d)}% shift this week. Recovery is now your highest-leverage action.`,
    (d: number) => `A ${Math.abs(d)}% recalibration this week. Your Twin has shifted to restoration-first protocols.`,
  ],
};

function getTrendInsight(trend: TrendData): string {
  const d = Math.round(Math.abs(trend.deltaPercent));
  let pool: ((d: number) => string)[];

  if (trend.direction === 'up' && d >= 5) {
    pool = TREND_INSIGHTS.strongUp;
  } else if (trend.direction === 'up') {
    pool = TREND_INSIGHTS.mildUp;
  } else if (trend.direction === 'stable') {
    pool = TREND_INSIGHTS.stable;
  } else if (d >= 5) {
    pool = TREND_INSIGHTS.strongDown;
  } else {
    pool = TREND_INSIGHTS.mildDown;
  }

  const idx = Math.floor(Date.now() / 86400000) % pool.length;
  return pool[idx](d);
}

function getTrendAccentColor(trend: TrendData): string {
  if (trend.direction === 'up' && trend.deltaPercent >= 5) return 'rgba(34, 197, 94, 0.5)';
  if (trend.direction === 'up') return 'rgba(34, 197, 94, 0.35)';
  if (trend.direction === 'stable') return 'rgba(196, 164, 108, 0.4)';
  if (trend.deltaPercent <= -5) return 'rgba(245, 158, 11, 0.45)';
  return 'rgba(245, 158, 11, 0.3)';
}

function getTrendIcon(trend: TrendData): string {
  if (trend.direction === 'up' && trend.deltaPercent >= 5) return '\u2728';
  if (trend.direction === 'up') return '\uD83D\uDCC8';
  if (trend.direction === 'stable') return '\u2796';
  return '\uD83C\uDF3F';
}

/* ── Fallback insights ── */
const BASELINE_INSIGHTS = [
  'Your Digital Twin is ready. Upload lab results to unlock personalized biological insights.',
  'Every data point you add sharpens the precision of your protocols. Start with a single marker.',
  'The foundation is set. When you add biomarker data, your Twin will begin mapping your trajectory.',
];

const PARTIAL_DATA_INSIGHTS = [
  'Each marker you track adds clarity to your biological trajectory. You are building something meaningful.',
  'Your commitment to tracking is itself a longevity signal. Consistency compounds.',
  'The data you have already tells a story of intention. Keep building the picture.',
];

interface LabResult {
  marker: string;
  value: number;
  unit: string;
  loggedAt: number;
}

interface VitalityScore {
  sessionId: string;
  score: number;
  calculatedAt: number;
}

function computeTrend(scores: VitalityScore[]): TrendData | null {
  if (!scores || scores.length < 3) return null;

  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  const thisWeek = scores.filter((s) => s.calculatedAt >= now - oneWeekMs);
  const lastWeek = scores.filter(
    (s) => s.calculatedAt >= now - 2 * oneWeekMs && s.calculatedAt < now - oneWeekMs
  );

  if (thisWeek.length === 0 || lastWeek.length === 0) return null;

  const thisWeekAvg = thisWeek.reduce((sum, s) => sum + s.score, 0) / thisWeek.length;
  const lastWeekAvg = lastWeek.reduce((sum, s) => sum + s.score, 0) / lastWeek.length;

  if (lastWeekAvg === 0) return null;

  const deltaPercent = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
  const direction: TrendData['direction'] =
    deltaPercent > 1.5 ? 'up' : deltaPercent < -1.5 ? 'down' : 'stable';

  return {
    thisWeekAvg: Math.round(thisWeekAvg),
    lastWeekAvg: Math.round(lastWeekAvg),
    deltaPercent: Math.round(deltaPercent * 10) / 10,
    direction,
    dataPoints: thisWeek.length + lastWeek.length,
  };
}

function generateInsight(
  labResults: LabResult[],
  hasBaseline: boolean,
  recoveryState: RecoveryState,
  trend: TrendData | null
): { text: string; icon: string; accentColor: string; isRecovery: boolean; isTrend: boolean; trend: TrendData | null } {

  // ── Recovery State takes highest priority ──
  if (recoveryState.isRecoveryMode) {
    const pool = RECOVERY_INSIGHTS[recoveryState.primaryLever];
    const hourIdx = new Date().getHours() % pool.length;
    return {
      text: pool[hourIdx],
      icon: '\uD83D\uDD04',
      accentColor: 'rgba(0, 212, 255, 0.45)',
      isRecovery: true,
      isTrend: false,
      trend: null,
    };
  }

  // ── Week-over-week trend insights (second priority) ──
  // Alternate between trend and lab insights daily so the sidebar feels alive
  const dayOfWeek = new Date().getDay();
  const showTrend = trend && (dayOfWeek % 2 === 0 || labResults.length === 0);

  if (showTrend && trend) {
    return {
      text: getTrendInsight(trend),
      icon: getTrendIcon(trend),
      accentColor: getTrendAccentColor(trend),
      isRecovery: false,
      isTrend: true,
      trend,
    };
  }

  // ── Standard lab-based insights ──
  const sorted = [...labResults].sort((a, b) => b.loggedAt - a.loggedAt);
  const latestByMarker = new Map<string, LabResult>();
  for (const r of sorted) {
    if (!latestByMarker.has(r.marker)) {
      latestByMarker.set(r.marker, r);
    }
  }

  const trackedMarkers = ['ApoB', 'Testosterone', 'Vitamin D'];
  const availableMarkers = trackedMarkers.filter((m) => latestByMarker.has(m));

  if (availableMarkers.length === 0) {
    // If we have trend data but no labs, always show trend
    if (trend) {
      return {
        text: getTrendInsight(trend),
        icon: getTrendIcon(trend),
        accentColor: getTrendAccentColor(trend),
        isRecovery: false,
        isTrend: true,
        trend,
      };
    }
    if (hasBaseline) {
      const idx = Math.floor(Date.now() / 86400000) % PARTIAL_DATA_INSIGHTS.length;
      return { text: PARTIAL_DATA_INSIGHTS[idx], icon: '\uD83E\uDDEC', accentColor: 'rgba(196, 164, 108, 0.5)', isRecovery: false, isTrend: false, trend: null };
    }
    const idx = Math.floor(Date.now() / 86400000) % BASELINE_INSIGHTS.length;
    return { text: BASELINE_INSIGHTS[idx], icon: '\uD83D\uDD2C', accentColor: 'rgba(196, 164, 108, 0.3)', isRecovery: false, isTrend: false, trend: null };
  }

  const dayIndex = Math.floor(Date.now() / 86400000) % availableMarkers.length;
  const selectedMarker = availableMarkers[dayIndex];
  const result = latestByMarker.get(selectedMarker)!;
  const config = MARKER_INSIGHTS[selectedMarker];

  if (!config) {
    return {
      text: `Your ${selectedMarker} data is being tracked. Your Digital Twin is learning your patterns.`,
      icon: '\uD83E\uDDEC',
      accentColor: 'rgba(196, 164, 108, 0.5)',
      isRecovery: false,
      isTrend: false,
      trend: null,
    };
  }

  const value = result.value;

  if (selectedMarker === 'ApoB' && value <= 60) {
    return { text: config.elite(value), icon: '\u2728', accentColor: 'rgba(34, 197, 94, 0.5)', isRecovery: false, isTrend: false, trend: null };
  }
  if (selectedMarker === 'Testosterone' && value >= 650) {
    return { text: config.elite(value), icon: '\u2728', accentColor: 'rgba(34, 197, 94, 0.5)', isRecovery: false, isTrend: false, trend: null };
  }
  if (selectedMarker === 'Vitamin D' && value >= 50 && value <= 70) {
    return { text: config.elite(value), icon: '\u2728', accentColor: 'rgba(34, 197, 94, 0.5)', isRecovery: false, isTrend: false, trend: null };
  }

  if (value >= config.optimalLow && value <= config.optimalHigh) {
    return { text: config.onTrack(value), icon: '\uD83D\uDFE2', accentColor: 'rgba(34, 197, 94, 0.4)', isRecovery: false, isTrend: false, trend: null };
  }

  return { text: config.nudge(value), icon: '\uD83C\uDF3F', accentColor: 'rgba(196, 164, 108, 0.5)', isRecovery: false, isTrend: false, trend: null };
}

export default function SidebarInsights() {
  const sessionId = getSessionId();
  const [breathPhase, setBreathPhase] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const labResults = useQuery(api.queries.getLabResults, { sessionId });
  const physicalBaseline = useQuery(api.queries.getPhysicalBaseline, { sessionId });
  const vitalityScores = useQuery(api.queries.getVitalityScores14d, { sessionId });

  // Live biometric vitals for recovery state detection
  const { vitals } = useBiometricSync();

  // Detect recovery state from live vitals
  const recoveryState = useMemo<RecoveryState>(() => {
    return detectRecoveryState({
      hrv: vitals.hrv,
      sleepScore: vitals.sleepScore,
      sleepHours: vitals.sleepHours,
      recovery: vitals.recovery,
      sleepDeepPct: vitals.sleepDeepPct,
      bodyBattery: vitals.bodyBattery,
    });
  }, [vitals.hrv, vitals.sleepScore, vitals.sleepHours, vitals.recovery, vitals.sleepDeepPct, vitals.bodyBattery]);

  // Compute week-over-week trend from 14-day Vitality Scores
  const trend = useMemo<TrendData | null>(() => {
    return computeTrend((vitalityScores ?? []) as VitalityScore[]);
  }, [vitalityScores]);

  // Gentle breathing animation — 6-second cycle (inhale 3s, exhale 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathPhase((p) => (p + 1) % 120);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Fade in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const breathOpacity = 0.4 + 0.2 * Math.sin((breathPhase / 120) * Math.PI * 2);
  // Secondary breath for the trend badge — offset phase
  const breathOpacity2 = 0.5 + 0.15 * Math.sin(((breathPhase + 40) / 120) * Math.PI * 2);

  const insight = useMemo(() => {
    const labs = (labResults ?? []) as LabResult[];
    const hasBaseline = physicalBaseline != null;
    return generateInsight(labs, hasBaseline, recoveryState, trend);
  }, [labResults, physicalBaseline, recoveryState, trend]);

  // Count verified markers for the subtle badge
  const verifiedCount = useMemo(() => {
    if (!labResults) return 0;
    const unique = new Set((labResults as LabResult[]).map((r) => r.marker));
    return unique.size;
  }, [labResults]);

  return (
    <div
      style={{
        margin: '6px 12px 2px',
        padding: '10px 12px',
        borderRadius: 10,
        background: insight.isRecovery
          ? 'rgba(0, 212, 255, 0.02)'
          : insight.isTrend
            ? 'rgba(255, 255, 255, 0.018)'
            : 'rgba(255, 255, 255, 0.015)',
        border: `1px solid ${insight.isRecovery
          ? 'rgba(0, 212, 255, 0.08)'
          : insight.isTrend
            ? 'rgba(196, 164, 108, 0.08)'
            : 'rgba(196, 164, 108, 0.06)'}`,
        position: 'relative',
        overflow: 'hidden',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease, background 0.8s ease, border-color 0.8s ease',
      }}
    >
      {/* Subtle ambient glow behind the insight */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 120,
          height: 60,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(ellipse, ${insight.accentColor} 0%, transparent 70%)`,
          opacity: breathOpacity * (insight.isRecovery ? 0.7 : 0.5),
          pointerEvents: 'none',
          transition: 'background 1s ease, opacity 0.5s ease',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: '0.15em',
              color: insight.isRecovery
                ? 'rgba(0, 212, 255, 0.7)'
                : insight.isTrend
                  ? 'rgba(196, 164, 108, 0.7)'
                  : 'rgba(196, 164, 108, 0.6)',
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'color 0.6s ease',
            }}
          >
            {insight.isRecovery
              ? 'TWIN \u00B7 RECOVERY MODE'
              : insight.isTrend
                ? 'TWIN \u00B7 WEEKLY TREND'
                : 'DIGITAL TWIN INSIGHT'}
          </span>
        </div>

        {/* Recovery intensity indicator */}
        {insight.isRecovery ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 8,
              color: 'rgba(0, 212, 255, 0.6)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'rgba(0, 212, 255, 0.6)',
                display: 'inline-block',
                boxShadow: '0 0 6px rgba(0, 212, 255, 0.4)',
                animation: 'si-recoveryPulse 2s ease-in-out infinite',
              }}
            />
            HIGH-EFFICIENCY
          </div>
        ) : insight.isTrend && insight.trend ? (
          /* ── Trend delta badge ── */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.06em',
              fontFamily: "'Inter', system-ui, sans-serif",
              color: insight.trend.direction === 'up'
                ? 'rgba(34, 197, 94, 0.75)'
                : insight.trend.direction === 'stable'
                  ? 'rgba(196, 164, 108, 0.65)'
                  : 'rgba(245, 158, 11, 0.7)',
              opacity: breathOpacity2 + 0.4,
              transition: 'color 0.6s ease',
            }}
          >
            <span style={{ fontSize: 9 }}>
              {insight.trend.direction === 'up' ? '\u25B2' : insight.trend.direction === 'down' ? '\u25BC' : '\u25C6'}
            </span>
            {insight.trend.direction === 'stable'
              ? 'STABLE'
              : `${Math.abs(Math.round(insight.trend.deltaPercent))}% ${insight.trend.direction === 'up' ? 'UP' : 'DOWN'}`}
          </div>
        ) : verifiedCount > 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 8,
              color: 'rgba(34, 197, 94, 0.6)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.5)',
                display: 'inline-block',
                boxShadow: '0 0 4px rgba(34, 197, 94, 0.3)',
              }}
            />
            {verifiedCount} MARKER{verifiedCount !== 1 ? 'S' : ''}
          </div>
        ) : null}
      </div>

      {/* Insight text with breath animation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          position: 'relative',
        }}
      >
        <span
          style={{
            fontSize: 14,
            flexShrink: 0,
            marginTop: 1,
            opacity: breathOpacity + 0.3,
            transition: 'opacity 0.1s linear',
          }}
        >
          {insight.icon}
        </span>
        <p
          style={{
            fontSize: 10.5,
            lineHeight: 1.55,
            color: insight.isRecovery
              ? 'rgba(255, 255, 255, 0.62)'
              : 'rgba(255, 255, 255, 0.55)',
            margin: 0,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: insight.isRecovery || insight.isTrend ? 500 : 400,
            letterSpacing: '0.01em',
            opacity: 0.7 + 0.3 * Math.sin((breathPhase / 120) * Math.PI * 2),
            transition: 'color 0.6s ease',
          }}
        >
          {insight.text}
        </p>
      </div>

      {/* Trend mini-sparkline: this-week vs last-week visual */}
      {insight.isTrend && insight.trend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 7,
            padding: '4px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 8,
              fontFamily: 'monospace',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>LAST</span>
            <span style={{ color: 'rgba(196, 164, 108, 0.5)' }}>{insight.trend.lastWeekAvg}</span>
          </div>
          {/* Mini progress bar showing relative change */}
          <div
            style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background: 'rgba(255, 255, 255, 0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${Math.min(100, Math.max(10, (insight.trend.thisWeekAvg / Math.max(1, insight.trend.lastWeekAvg)) * 50))}%`,
                borderRadius: 1,
                background: insight.trend.direction === 'up'
                  ? 'rgba(34, 197, 94, 0.5)'
                  : insight.trend.direction === 'stable'
                    ? 'rgba(196, 164, 108, 0.4)'
                    : 'rgba(245, 158, 11, 0.4)',
                transition: 'width 1s ease, background 0.6s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 8,
              fontFamily: 'monospace',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>NOW</span>
            <span
              style={{
                color: insight.trend.direction === 'up'
                  ? 'rgba(34, 197, 94, 0.7)'
                  : insight.trend.direction === 'stable'
                    ? 'rgba(196, 164, 108, 0.6)'
                    : 'rgba(245, 158, 11, 0.6)',
              }}
            >
              {insight.trend.thisWeekAvg}
            </span>
          </div>
        </div>
      )}

      {/* Recovery-mode: subtle trigger indicators */}
      {insight.isRecovery && recoveryState.triggers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            flexWrap: 'wrap',
          }}
        >
          {recoveryState.triggers.slice(0, 4).map((trigger) => {
            const labels: Record<string, { label: string; icon: string }> = {
              'hrv': { label: 'HRV', icon: '\uD83D\uDC9A' },
              'sleep-quality': { label: 'Sleep', icon: '\uD83C\uDF19' },
              'sleep-duration': { label: 'Duration', icon: '\u23F0' },
              'recovery-index': { label: 'Recovery', icon: '\uD83D\uDD04' },
              'deep-sleep': { label: 'Deep', icon: '\uD83C\uDF0A' },
              'energy': { label: 'Energy', icon: '\uD83D\uDD0B' },
            };
            const info = labels[trigger] ?? { label: trigger, icon: '\u00B7' };
            return (
              <span
                key={trigger}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px',
                  borderRadius: 6,
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.08)',
                  fontSize: 7,
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: 'rgba(0, 212, 255, 0.5)',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ fontSize: 8 }}>{info.icon}</span>
                {info.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Subtle bottom accent line */}
      <div
        style={{
          marginTop: 8,
          height: 1,
          borderRadius: 1,
          background: `linear-gradient(90deg, transparent, ${insight.accentColor}, transparent)`,
          opacity: breathOpacity * 0.6,
          transition: 'opacity 0.1s linear',
        }}
      />

      <style>{`
        @keyframes si-recoveryPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
