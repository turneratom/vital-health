/* ══════════════════════════════════════════════════════════════════
   INSIGHT CARD — Medical-Grade Biometric Intelligence
   
   Replaces generic alerts in the Daily Intelligence Feed.
   "Midnight" theme with subtle neon accents:
     • Green (#00FFCC) for Optimal
     • Amber (#FFB86B) for Warning
     • Red (#FF6B6B) for Critical
   
   Each card features:
   1. Sparkline graph of the specific metric (Deep Sleep, RHR, HRV…)
   2. "Medical-Grade Analysis" text block with intervention rationale
   3. Quick-link to relevant Optimization Store product
   4. Severity-coded visual hierarchy
   ══════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useBiometricSync, type SyncedVitals } from '@/hooks/useBiometricSync';

/* ── Midnight Palette ── */
const M = {
  bg: '#08080C',
  card: 'rgba(12,12,18,0.85)',
  cardHover: 'rgba(16,16,24,0.92)',
  cardBorder: 'rgba(255,255,255,0.04)',
  cardBorderActive: 'rgba(255,255,255,0.08)',
  text: '#F0F0F5',
  textSecondary: 'rgba(255,255,255,0.52)',
  textDim: 'rgba(255,255,255,0.24)',
  optimal: '#00FFCC',
  optimalBg: 'rgba(0,255,204,0.06)',
  optimalBorder: 'rgba(0,255,204,0.15)',
  warning: '#FFB86B',
  warningBg: 'rgba(255,184,107,0.06)',
  warningBorder: 'rgba(255,184,107,0.15)',
  critical: '#FF6B6B',
  criticalBg: 'rgba(255,107,107,0.06)',
  criticalBorder: 'rgba(255,107,107,0.15)',
  info: '#6B8AFF',
  infoBg: 'rgba(107,138,255,0.06)',
  infoBorder: 'rgba(107,138,255,0.15)',
  sparkFill: 'rgba(0,255,204,0.08)',
};

/* ── Types ── */
export type InsightSeverity = 'optimal' | 'warning' | 'critical' | 'info';
export type InsightMetric = 'hrv' | 'heartRate' | 'sleepDeepPct' | 'sleepRemPct' | 'sleepScore' | 'recovery' | 'strain' | 'stress' | 'bodyBattery' | 'spo2' | 'skinTemp' | 'steps' | 'sleepHours';

export interface InsightData {
  id: string;
  metric: InsightMetric;
  severity: InsightSeverity;
  title: string;
  /** Short headline — e.g. "HRV Trending Up +12%" */
  headline: string;
  /** Medical-grade analysis paragraph */
  analysis: string;
  /** Suggested intervention */
  intervention: string;
  /** Current value */
  currentValue: number;
  /** Unit label */
  unit: string;
  /** Optimal range */
  optimalRange: [number, number];
  /** Sparkline data points (last 7-14 readings) */
  sparklineData: number[];
  /** Optional product deep-link ID for Optimization Store */
  productId?: string;
  /** Optional product name for the CTA */
  productName?: string;
  /** Timestamp */
  timestamp: number;
}

/* ── Metric Configuration ── */
interface MetricConfig {
  label: string;
  icon: string;
  unit: string;
  optimal: [number, number];
  higherIsBetter: boolean;
  warningThreshold: number;
  criticalThreshold: number;
  analysisTemplates: {
    optimal: string;
    warning: string;
    critical: string;
  };
  interventionTemplates: {
    optimal: string;
    warning: string;
    critical: string;
  };
  productMapping: { id: string; name: string } | null;
}

const METRIC_CONFIGS: Record<InsightMetric, MetricConfig> = {
  hrv: {
    label: 'Heart Rate Variability',
    icon: '💚',
    unit: 'ms',
    optimal: [50, 120],
    higherIsBetter: true,
    warningThreshold: 40,
    criticalThreshold: 28,
    analysisTemplates: {
      optimal: 'Your parasympathetic nervous system is demonstrating excellent vagal tone. HRV readings in this range indicate robust autonomic flexibility — your body is efficiently modulating between sympathetic and parasympathetic states. This correlates with enhanced stress resilience and cardiovascular adaptability.',
      warning: 'HRV has dropped below your optimal baseline, suggesting increased sympathetic dominance. This pattern is consistent with accumulated allostatic load — your autonomic nervous system is prioritizing fight-or-flight signaling over recovery. Without intervention, this trajectory correlates with impaired sleep architecture and elevated inflammatory markers.',
      critical: 'HRV is critically suppressed, indicating significant autonomic dysregulation. At this level, vagal brake function is compromised — your body is locked in a sympathetic-dominant state. This is a strong biomarker for systemic inflammation, impaired immune function, and accelerated biological aging. Immediate recovery protocol recommended.',
    },
    interventionTemplates: {
      optimal: 'Maintain current recovery protocols. Consider adding Zone 2 cardio (60-70% max HR) to further strengthen vagal tone.',
      warning: 'Initiate parasympathetic restoration: Magnesium L-Threonate (2000mg) before bed for GABA receptor modulation. Add 10-min cyclic sighing breathwork (extended exhale 2:1 ratio) to stimulate vagal afferents.',
      critical: 'Priority recovery protocol: KSM-66 Ashwagandha (600mg) to suppress cortisol via HPA axis modulation. Magnesium L-Threonate for neural recovery. Reduce training load by 50% for 48-72 hours. Cold exposure (2-min cold shower) to trigger vagal rebound.',
    },
    productMapping: { id: 'prod-magtein', name: 'Magtein® Magnesium L-Threonate' },
  },
  heartRate: {
    label: 'Resting Heart Rate',
    icon: '❤️',
    unit: 'bpm',
    optimal: [52, 68],
    higherIsBetter: false,
    warningThreshold: 76,
    criticalThreshold: 85,
    analysisTemplates: {
      optimal: 'Resting heart rate is within the athletic-optimal range, indicating excellent cardiovascular efficiency. Your heart is pumping adequate blood volume per beat (stroke volume), requiring fewer contractions at rest. This efficiency marker correlates with longevity and reduced all-cause mortality risk.',
      warning: 'Resting heart rate is elevated above your baseline, suggesting increased sympathetic tone or early-stage overtraining. Elevated RHR is a sensitive proxy for systemic inflammation — each 10bpm increase above baseline correlates with a 15-20% increase in cardiovascular event risk over time.',
      critical: 'Resting heart rate is significantly elevated, indicating potential overtraining syndrome, acute illness, or chronic stress accumulation. At this level, myocardial oxygen demand is elevated and recovery capacity is compromised. This reading warrants immediate load reduction and anti-inflammatory intervention.',
    },
    interventionTemplates: {
      optimal: 'Continue current cardiovascular training. Zone 2 endurance work maintains this efficiency.',
      warning: 'ProOmega 2000 (2150mg EPA+DHA) to target ALOX5 inflammatory cascade. Reduce high-intensity training volume by 30%. Prioritize 7.5+ hours of sleep.',
      critical: 'Immediate training deload. Omega-3 supplementation for SPM resolution pathways. BPC-157 for tissue repair signaling. Monitor for 48 hours — if RHR doesn\'t normalize, consult physician.',
    },
    productMapping: { id: 'prod-omega3-nordic', name: 'ProOmega 2000' },
  },
  sleepDeepPct: {
    label: 'Deep Sleep',
    icon: '🌊',
    unit: '%',
    optimal: [18, 28],
    higherIsBetter: true,
    warningThreshold: 14,
    criticalThreshold: 9,
    analysisTemplates: {
      optimal: 'Deep sleep (N3 slow-wave) is in the optimal range for glymphatic clearance and growth hormone secretion. During this phase, cerebrospinal fluid flushes neurotoxic waste including beta-amyloid. Your current deep sleep architecture supports memory consolidation, tissue repair, and immune function.',
      warning: 'Deep sleep percentage has declined below the threshold for adequate glymphatic clearance. Reduced N3 slow-wave sleep impairs growth hormone pulsatility (70% of daily GH is secreted during deep sleep) and compromises the brain\'s waste-clearance system. This pattern accelerates cognitive decline markers over time.',
      critical: 'Deep sleep is critically deficient. At this level, glymphatic clearance is severely impaired — neurotoxic waste accumulation accelerates. Growth hormone secretion is suppressed, compromising tissue repair and immune surveillance. This is a high-priority intervention target.',
    },
    interventionTemplates: {
      optimal: 'Maintain sleep hygiene. Consider Apigenin (50mg) 30 min before bed to enhance GABA-A receptor binding for deeper N3 waves.',
      warning: 'Magnesium L-Threonate (2000mg) 1 hour before bed — the only Mg form proven to cross the blood-brain barrier. Eliminate blue light 90 min before sleep. Room temperature 65-67°F for optimal thermoregulation.',
      critical: 'Priority sleep protocol: Magtein® + Apigenin stack. Glycine (3g) for core body temperature drop. Eliminate caffeine after 12pm (adenosine receptor competition). Consider sleep study if pattern persists beyond 7 days.',
    },
    productMapping: { id: 'prod-magtein', name: 'Magtein® Magnesium L-Threonate' },
  },
  sleepRemPct: {
    label: 'REM Sleep',
    icon: '🧠',
    unit: '%',
    optimal: [20, 30],
    higherIsBetter: true,
    warningThreshold: 16,
    criticalThreshold: 10,
    analysisTemplates: {
      optimal: 'REM sleep is well-optimized for emotional processing and procedural memory consolidation. Adequate REM supports prefrontal cortex restoration and creative problem-solving capacity.',
      warning: 'REM sleep is below optimal, suggesting possible alcohol interference, late-night stimulant use, or stress-driven sleep fragmentation. REM deficiency impairs emotional regulation and next-day cognitive flexibility.',
      critical: 'REM sleep is critically low. This level of REM deprivation significantly impairs emotional processing, memory consolidation, and next-day executive function. Chronic REM deficiency is linked to mood disorders and accelerated cognitive aging.',
    },
    interventionTemplates: {
      optimal: 'Maintain current sleep schedule consistency. REM is most abundant in the last 2 hours of sleep — protect your wake time.',
      warning: 'Eliminate alcohol 3+ hours before bed (ethanol suppresses REM via GABA-A disruption). Ensure 7.5+ hours total sleep to capture late-cycle REM phases.',
      critical: 'Strict sleep schedule with 8+ hour sleep opportunity. Ashwagandha (KSM-66) to reduce cortisol-driven sleep fragmentation. Avoid all stimulants after 10am.',
    },
    productMapping: { id: 'prod-ksm66', name: 'KSM-66® Ashwagandha' },
  },
  sleepScore: {
    label: 'Sleep Quality Score',
    icon: '🌙',
    unit: 'pts',
    optimal: [80, 100],
    higherIsBetter: true,
    warningThreshold: 65,
    criticalThreshold: 50,
    analysisTemplates: {
      optimal: 'Composite sleep quality is excellent — duration, efficiency, deep sleep, and REM are all contributing to a high-performance recovery night. This level of sleep quality supports optimal next-day cognitive function and physical recovery.',
      warning: 'Sleep quality has declined, indicating disruption across one or more sleep architecture components. This composite score reflects suboptimal recovery that will compound over consecutive nights.',
      critical: 'Sleep quality is critically impaired. Multiple sleep architecture components are failing simultaneously. Without correction, expect degraded cognitive performance, elevated inflammation, and impaired immune function within 48-72 hours.',
    },
    interventionTemplates: {
      optimal: 'Excellent sleep hygiene. Continue current protocols.',
      warning: 'Review sleep environment: temperature (65-67°F), darkness (blackout), noise (white noise if needed). Magnesium L-Threonate 1 hour before bed.',
      critical: 'Full sleep protocol reset: Fixed wake time, no screens 90 min before bed, Magtein® + Apigenin + Glycine stack, cool room, morning sunlight within 30 min of waking.',
    },
    productMapping: { id: 'prod-magtein', name: 'Magtein® Magnesium L-Threonate' },
  },
  recovery: {
    label: 'Recovery Index',
    icon: '🔄',
    unit: '%',
    optimal: [70, 100],
    higherIsBetter: true,
    warningThreshold: 55,
    criticalThreshold: 35,
    analysisTemplates: {
      optimal: 'Recovery index indicates your body has successfully processed yesterday\'s allostatic load. Parasympathetic reactivation is complete — you have full capacity for high-intensity training or cognitive demands today.',
      warning: 'Recovery is incomplete — your body is still processing accumulated stress. Training at full intensity today will compound the recovery debt. This state suggests elevated cortisol and incomplete parasympathetic restoration.',
      critical: 'Recovery is critically low, indicating significant physiological debt. Your body is in a state of chronic allostatic overload. High-intensity activity today carries elevated injury risk and will further suppress immune function.',
    },
    interventionTemplates: {
      optimal: 'Green light for full training load. Consider this a high-performance day.',
      warning: 'Reduce training intensity to 60-70% max. KSM-66 Ashwagandha for cortisol modulation. Prioritize Zone 2 cardio over HIIT.',
      critical: 'Active recovery only: walking, gentle yoga, breathwork. BPC-157 for tissue repair signaling. Full sleep protocol tonight. No high-intensity training for 24-48 hours.',
    },
    productMapping: { id: 'prod-ksm66', name: 'KSM-66® Ashwagandha' },
  },
  strain: {
    label: 'Training Strain',
    icon: '🏋️',
    unit: 'load',
    optimal: [8, 14],
    higherIsBetter: false,
    warningThreshold: 17,
    criticalThreshold: 20,
    analysisTemplates: {
      optimal: 'Training strain is well-calibrated to your current recovery capacity. This load-to-recovery ratio supports progressive adaptation without overreaching.',
      warning: 'Training strain is elevated relative to your recovery state. This imbalance, if sustained, leads to non-functional overreaching — a state where performance plateaus despite increased effort.',
      critical: 'Training strain is excessive. At this load, you\'re in overtraining territory — cortisol is chronically elevated, testosterone-to-cortisol ratio is likely suppressed, and injury risk is significantly elevated.',
    },
    interventionTemplates: {
      optimal: 'Maintain current training periodization. Good strain-recovery balance.',
      warning: 'Reduce volume by 20-30%. Add NMN (1000mg) for mitochondrial energy support during high-demand phases.',
      critical: 'Mandatory deload week. NMN + CoQ10 for mitochondrial recovery. Creatine (5g/day) for ATP resynthesis. No training above 60% max HR for 5-7 days.',
    },
    productMapping: { id: 'prod-nmn-prohealth', name: 'NMN Pro 1000' },
  },
  stress: {
    label: 'Stress Load',
    icon: '⚡',
    unit: 'idx',
    optimal: [10, 35],
    higherIsBetter: false,
    warningThreshold: 55,
    criticalThreshold: 75,
    analysisTemplates: {
      optimal: 'Stress load is well-managed. Your HPA axis is functioning within normal parameters — cortisol follows a healthy diurnal rhythm with appropriate morning peak and evening nadir.',
      warning: 'Stress load is elevated, indicating sustained HPA axis activation. Chronic cortisol elevation at this level begins to impair hippocampal neurogenesis, suppress immune function, and disrupt sleep architecture.',
      critical: 'Stress load is critically high. At this level, the HPA axis is dysregulated — cortisol may be elevated throughout the day rather than following normal diurnal rhythm. This state accelerates biological aging and significantly impairs cognitive function.',
    },
    interventionTemplates: {
      optimal: 'Continue current stress management practices. Consider adding adaptogenic support for resilience.',
      warning: 'KSM-66 Ashwagandha (600mg) — clinically proven to reduce cortisol 25-30%. Add 10-min daily breathwork (box breathing or cyclic sighing).',
      critical: 'Priority cortisol intervention: KSM-66 Ashwagandha + Magnesium L-Threonate stack. Daily meditation (15+ min). Reduce caffeine to 1 cup before 10am. Consider professional stress assessment.',
    },
    productMapping: { id: 'prod-ksm66', name: 'KSM-66® Ashwagandha' },
  },
  bodyBattery: {
    label: 'Body Battery',
    icon: '🔋',
    unit: '%',
    optimal: [60, 100],
    higherIsBetter: true,
    warningThreshold: 40,
    criticalThreshold: 20,
    analysisTemplates: {
      optimal: 'Energy reserves are well-charged. Your body has successfully converted last night\'s sleep into usable metabolic energy. Mitochondrial function appears robust.',
      warning: 'Energy reserves are depleted below optimal. This indicates either insufficient sleep recovery, excessive daytime energy expenditure, or suboptimal mitochondrial efficiency.',
      critical: 'Energy reserves are critically low. At this level, cellular energy production (ATP) is insufficient for optimal organ function. Expect significant cognitive fog, reduced physical performance, and impaired immune surveillance.',
    },
    interventionTemplates: {
      optimal: 'Full energy capacity. Ideal day for demanding cognitive or physical work.',
      warning: 'NMN (1000mg) for NAD+ replenishment and mitochondrial energy support. Moderate caffeine timing (before 12pm only).',
      critical: 'Priority energy restoration: NMN + CoQ10 (Ubiquinol 200mg) for electron transport chain support. Creatine (5g) for rapid ATP resynthesis. Rest day mandatory.',
    },
    productMapping: { id: 'prod-nmn-prohealth', name: 'NMN Pro 1000' },
  },
  spo2: {
    label: 'Blood Oxygen',
    icon: '🫁',
    unit: '%',
    optimal: [96, 100],
    higherIsBetter: true,
    warningThreshold: 94,
    criticalThreshold: 92,
    analysisTemplates: {
      optimal: 'Blood oxygen saturation is excellent, indicating efficient gas exchange at the alveolar level. Hemoglobin is carrying adequate oxygen to all tissues.',
      warning: 'SpO2 has dipped below optimal. While still within safe range, this may indicate mild respiratory inefficiency, altitude effects, or early-stage respiratory compromise during sleep.',
      critical: 'Blood oxygen is below normal range. This warrants medical attention if persistent. Possible causes include sleep apnea, respiratory infection, or cardiovascular compromise.',
    },
    interventionTemplates: {
      optimal: 'Normal oxygenation. No intervention needed.',
      warning: 'Monitor overnight SpO2 trends. If consistently below 95%, consider sleep apnea screening. Nasal breathing exercises may improve baseline.',
      critical: 'Seek medical evaluation if SpO2 remains below 93%. This is outside the scope of supplementation — clinical assessment recommended.',
    },
    productMapping: null,
  },
  skinTemp: {
    label: 'Skin Temperature',
    icon: '🌡️',
    unit: '°C',
    optimal: [36.2, 36.8],
    higherIsBetter: false,
    warningThreshold: 37.2,
    criticalThreshold: 37.8,
    analysisTemplates: {
      optimal: 'Skin temperature is within normal circadian range, indicating stable thermoregulation and no inflammatory signals.',
      warning: 'Skin temperature is mildly elevated above baseline. This can indicate early immune activation, hormonal fluctuation, or environmental heat stress. Monitor for developing illness.',
      critical: 'Skin temperature is significantly elevated, suggesting active immune response or systemic inflammation. Combined with other markers, this may indicate onset of illness.',
    },
    interventionTemplates: {
      optimal: 'Normal thermoregulation. No action needed.',
      warning: 'Monitor closely. Increase hydration. Omega-3 for anti-inflammatory support. Rest if other markers also declining.',
      critical: 'Rest and hydration priority. If accompanied by other symptoms, consult healthcare provider. Immune support: Vitamin D3 + Zinc.',
    },
    productMapping: { id: 'prod-omega3-nordic', name: 'ProOmega 2000' },
  },
  steps: {
    label: 'Daily Movement',
    icon: '🚶',
    unit: 'steps',
    optimal: [8000, 15000],
    higherIsBetter: true,
    warningThreshold: 4000,
    criticalThreshold: 2000,
    analysisTemplates: {
      optimal: 'Daily movement is in the optimal range for metabolic health. Research shows 8,000-10,000 steps/day reduces all-cause mortality risk by 50-65% compared to sedentary baselines.',
      warning: 'Movement is below optimal. Sedentary behavior at this level increases insulin resistance, reduces BDNF production, and impairs lymphatic circulation.',
      critical: 'Movement is critically low. Extended sedentary behavior at this level significantly increases metabolic syndrome risk and accelerates sarcopenia.',
    },
    interventionTemplates: {
      optimal: 'Great movement baseline. Consider adding structured Zone 2 cardio for additional cardiovascular benefit.',
      warning: 'Set hourly movement reminders. Target 2,000 additional steps. Even a 10-min walk post-meal significantly improves glucose disposal.',
      critical: 'Priority: any movement is beneficial. Start with 3x 10-min walks today. Creatine (5g) supports muscle energy for increased activity.',
    },
    productMapping: null,
  },
  sleepHours: {
    label: 'Sleep Duration',
    icon: '⏰',
    unit: 'hrs',
    optimal: [7.0, 9.0],
    higherIsBetter: true,
    warningThreshold: 6.0,
    criticalThreshold: 5.0,
    analysisTemplates: {
      optimal: 'Sleep duration is in the optimal 7-9 hour window. This duration allows for complete cycling through all sleep stages including adequate deep sleep and REM phases.',
      warning: 'Sleep duration is below the minimum recommended threshold. At less than 7 hours, you\'re missing critical late-cycle REM sleep and reducing total glymphatic clearance time.',
      critical: 'Sleep duration is severely restricted. At this level, cognitive impairment is equivalent to a blood alcohol level of 0.05-0.10%. Immune function is suppressed by up to 70%.',
    },
    interventionTemplates: {
      optimal: 'Excellent sleep duration. Maintain consistent sleep/wake schedule.',
      warning: 'Extend sleep opportunity by 30-60 min. Fixed wake time is more important than bedtime. Magnesium L-Threonate to improve sleep onset latency.',
      critical: 'Sleep extension is the #1 priority. Set a non-negotiable 8-hour sleep opportunity. Full sleep stack: Magtein® + Apigenin + Glycine. No caffeine after 10am.',
    },
    productMapping: { id: 'prod-magtein', name: 'Magtein® Magnesium L-Threonate' },
  },
};

/* ══════════════════════════════════════════════════════════════════
   SPARKLINE — Pure SVG mini-chart
   ══════════════════════════════════════════════════════════════════ */

function Sparkline({ data, color, height = 40, width = 120, optimal }: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
  optimal?: [number, number];
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.1;
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  // Optimal zone band
  let optBand = null;
  if (optimal) {
    const y1 = height - ((optimal[1] - min) / range) * height;
    const y2 = height - ((optimal[0] - min) / range) * height;
    optBand = (
      <rect
        x={0} y={Math.max(0, y1)} width={width} height={Math.min(height, y2 - y1)}
        fill={color} opacity={0.06} rx={2}
      />
    );
  }

  // Pulse dot on the last point
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height + 4} viewBox={`0 -2 ${width} ${height + 4}`} className="overflow-visible">
      {optBand}
      {/* Area fill */}
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-grad-${color.replace('#', '')})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Current value dot */}
      <circle cx={last.x} cy={last.y} r={3} fill={color} opacity={0.9}>
        <animate attributeName="r" values="3;4.5;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Glow */}
      <circle cx={last.x} cy={last.y} r={6} fill={color} opacity={0.15}>
        <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SEVERITY HELPERS
   ══════════════════════════════════════════════════════════════════ */

function getSeverityColors(severity: InsightSeverity) {
  switch (severity) {
    case 'optimal': return { accent: M.optimal, bg: M.optimalBg, border: M.optimalBorder, label: 'OPTIMAL', icon: '✦' };
    case 'warning': return { accent: M.warning, bg: M.warningBg, border: M.warningBorder, label: 'WARNING', icon: '⚠' };
    case 'critical': return { accent: M.critical, bg: M.criticalBg, border: M.criticalBorder, label: 'CRITICAL', icon: '⬤' };
    case 'info': return { accent: M.info, bg: M.infoBg, border: M.infoBorder, label: 'INSIGHT', icon: 'ℹ' };
  }
}

function classifySeverity(metric: InsightMetric, value: number): InsightSeverity {
  const config = METRIC_CONFIGS[metric];
  if (!config) return 'info';

  const { optimal, higherIsBetter, warningThreshold, criticalThreshold } = config;

  if (value >= optimal[0] && value <= optimal[1]) return 'optimal';

  if (higherIsBetter) {
    if (value <= criticalThreshold) return 'critical';
    if (value <= warningThreshold) return 'warning';
    return 'optimal';
  } else {
    if (value >= criticalThreshold) return 'critical';
    if (value >= warningThreshold) return 'warning';
    return 'optimal';
  }
}

/* ══════════════════════════════════════════════════════════════════
   GENERATE SPARKLINE DATA — Simulated 14-point history
   ══════════════════════════════════════════════════════════════════ */

function generateSparklineHistory(current: number, metric: InsightMetric): number[] {
  const config = METRIC_CONFIGS[metric];
  if (!config) return [current];

  const points: number[] = [];
  const optMid = (config.optimal[0] + config.optimal[1]) / 2;
  const volatility = (config.optimal[1] - config.optimal[0]) * 0.15;

  // Generate 13 historical points trending toward current
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const base = optMid + (current - optMid) * t;
    const noise = (Math.random() - 0.5) * volatility * 2;
    points.push(Math.round((base + noise) * 10) / 10);
  }
  points.push(current);
  return points;
}

/* ══════════════════════════════════════════════════════════════════
   useInsightFeed — Generates InsightData[] from live vitals
   ══════════════════════════════════════════════════════════════════ */

export function useInsightFeed(): InsightData[] {
  const { vitals } = useBiometricSync();
  const sparklineCache = useRef<Record<string, number[]>>({});

  return useMemo(() => {
    const metricsToAnalyze: Array<{ metric: InsightMetric; value: number }> = [
      { metric: 'hrv', value: vitals.hrv },
      { metric: 'heartRate', value: vitals.heartRate },
      { metric: 'sleepDeepPct', value: vitals.sleepDeepPct },
      { metric: 'sleepRemPct', value: vitals.sleepRemPct },
      { metric: 'sleepScore', value: vitals.sleepScore },
      { metric: 'recovery', value: vitals.recovery },
      { metric: 'strain', value: vitals.strain },
      { metric: 'stress', value: vitals.stress },
      { metric: 'bodyBattery', value: vitals.bodyBattery },
      { metric: 'spo2', value: vitals.spo2 },
      { metric: 'sleepHours', value: vitals.sleepHours },
      { metric: 'steps', value: vitals.steps },
    ];

    const insights: InsightData[] = [];

    for (const { metric, value } of metricsToAnalyze) {
      if (value <= 0) continue;

      const config = METRIC_CONFIGS[metric];
      const severity = classifySeverity(metric, value);

      // Only show non-optimal or notable optimal metrics
      if (severity === 'optimal' && Math.random() > 0.3) continue;

      // Cache sparkline data so it doesn't regenerate every render
      const cacheKey = `${metric}-${Math.round(value)}`;
      if (!sparklineCache.current[cacheKey]) {
        sparklineCache.current[cacheKey] = generateSparklineHistory(value, metric);
      }

      const templateKey = severity === 'info' ? 'optimal' : severity;
      const delta = config.higherIsBetter
        ? ((value - config.optimal[0]) / config.optimal[0] * 100)
        : ((config.optimal[1] - value) / config.optimal[1] * 100);
      const deltaStr = delta >= 0 ? `+${Math.abs(delta).toFixed(0)}%` : `${delta.toFixed(0)}%`;
      const trendWord = delta >= 0 ? (config.higherIsBetter ? 'Above Baseline' : 'Elevated') : (config.higherIsBetter ? 'Below Baseline' : 'Optimized');

      insights.push({
        id: `insight-${metric}-${Date.now()}`,
        metric,
        severity,
        title: config.label,
        headline: `${config.label} ${deltaStr} — ${trendWord}`,
        analysis: config.analysisTemplates[templateKey],
        intervention: config.interventionTemplates[templateKey],
        currentValue: value,
        unit: config.unit,
        optimalRange: config.optimal,
        sparklineData: sparklineCache.current[cacheKey],
        productId: config.productMapping?.id,
        productName: config.productMapping?.name,
        timestamp: Date.now(),
      });
    }

    // Sort: critical first, then warning, then optimal
    const severityOrder: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, optimal: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights.slice(0, 6);
  }, [vitals]);
}

/* ══════════════════════════════════════════════════════════════════
   INSIGHT CARD — Single Card Component
   ══════════════════════════════════════════════════════════════════ */

export function InsightCard({ insight, onProductClick }: {
  insight: InsightData;
  onProductClick?: (productId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sev = getSeverityColors(insight.severity);
  const config = METRIC_CONFIGS[insight.metric];

  const isInRange = insight.currentValue >= insight.optimalRange[0] && insight.currentValue <= insight.optimalRange[1];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
      style={{
        background: M.card,
        border: `1px solid ${expanded ? sev.border : M.cardBorder}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: expanded ? `0 0 20px ${sev.accent}08, 0 8px 32px rgba(0,0,0,0.4)` : '0 2px 12px rgba(0,0,0,0.3)',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* ── Top severity accent line ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${sev.accent}60, transparent)` }} />

      {/* ── Header Row ── */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon + Title + Badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">{config.icon}</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold tracking-[0.14em] uppercase"
                style={{
                  background: sev.bg,
                  color: sev.accent,
                  border: `1px solid ${sev.border}`,
                }}
              >
                <span style={{ fontSize: 6 }}>{sev.icon}</span>
                {sev.label}
              </span>
            </div>
            <h3 className="text-[13px] font-semibold leading-tight mb-0.5" style={{
              color: M.text,
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: '-0.01em',
            }}>
              {insight.title}
            </h3>
            <p className="text-[10px] font-mono tracking-wide" style={{ color: M.textSecondary }}>
              {insight.headline}
            </p>
          </div>

          {/* Right: Value + Sparkline */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="text-right">
              <span className="font-mono text-lg font-bold tabular-nums" style={{
                color: sev.accent,
                textShadow: `0 0 12px ${sev.accent}25`,
              }}>
                {insight.metric === 'sleepHours'
                  ? insight.currentValue.toFixed(1)
                  : Math.round(insight.currentValue)}
              </span>
              <span className="text-[9px] font-mono ml-1" style={{ color: M.textDim }}>
                {insight.unit}
              </span>
            </div>
            <Sparkline
              data={insight.sparklineData}
              color={sev.accent}
              height={28}
              width={80}
              optimal={insight.optimalRange}
            />
          </div>
        </div>

        {/* ── Optimal Range Bar ── */}
        <div className="mt-2.5 mb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono tracking-wider uppercase" style={{ color: M.textDim }}>
              Optimal Range
            </span>
            <span className="text-[8px] font-mono" style={{ color: M.textDim }}>
              {insight.optimalRange[0]}–{insight.optimalRange[1]} {insight.unit}
            </span>
          </div>
          <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {/* Optimal zone highlight */}
            <div
              className="absolute h-full rounded-full"
              style={{
                left: `${Math.max(0, (insight.optimalRange[0] / (insight.optimalRange[1] * 1.5)) * 100)}%`,
                width: `${((insight.optimalRange[1] - insight.optimalRange[0]) / (insight.optimalRange[1] * 1.5)) * 100}%`,
                background: `${sev.accent}15`,
              }}
            />
            {/* Current value marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{
                left: `${Math.min(98, Math.max(2, (insight.currentValue / (insight.optimalRange[1] * 1.5)) * 100))}%`,
                background: sev.accent,
                boxShadow: `0 0 6px ${sev.accent}50`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Expanded: Medical-Grade Analysis ── */}
      <div
        style={{
          maxHeight: expanded ? 500 : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
        }}
      >
        <div className="px-4 pb-4">
          {/* Divider */}
          <div className="h-px my-2.5" style={{ background: `linear-gradient(90deg, transparent, ${M.cardBorder}, transparent)` }} />

          {/* Medical-Grade Analysis Label */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1 h-1 rounded-full" style={{ background: sev.accent }} />
            <span className="text-[8px] font-mono tracking-[0.16em] uppercase font-bold" style={{ color: sev.accent }}>
              Medical-Grade Analysis
            </span>
          </div>

          {/* Analysis Text */}
          <p className="text-[11px] leading-[1.65] mb-3" style={{
            color: M.textSecondary,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            {insight.analysis}
          </p>

          {/* Intervention Block */}
          <div className="rounded-xl p-3 mb-3" style={{
            background: sev.bg,
            border: `1px solid ${sev.border}`,
          }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[9px]">💊</span>
              <span className="text-[8px] font-mono tracking-[0.14em] uppercase font-bold" style={{ color: sev.accent }}>
                Suggested Intervention
              </span>
            </div>
            <p className="text-[10.5px] leading-[1.6]" style={{
              color: M.text,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              {insight.intervention}
            </p>
          </div>

          {/* Product Deep-Link CTA */}
          {insight.productId && insight.productName && (
            <button
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${sev.accent}08, ${sev.accent}04)`,
                border: `1px solid ${sev.border}`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onProductClick?.(insight.productId!);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${sev.accent}14, ${sev.accent}08)`;
                (e.currentTarget as HTMLElement).style.borderColor = `${sev.accent}30`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${sev.accent}08, ${sev.accent}04)`;
                (e.currentTarget as HTMLElement).style.borderColor = sev.border;
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px]">🛒</span>
                <div className="text-left">
                  <span className="text-[9px] font-mono tracking-wider uppercase block" style={{ color: M.textDim }}>
                    Recommended Product
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: M.text }}>
                    {insight.productName}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold" style={{ color: sev.accent }}>
                View →
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Expand indicator ── */}
      <div className="flex justify-center pb-2">
        <div
          className="w-6 h-0.5 rounded-full transition-all duration-300"
          style={{
            background: expanded ? sev.accent : M.textDim,
            opacity: expanded ? 0.5 : 0.3,
          }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INSIGHT FEED — Full Feed Component
   ══════════════════════════════════════════════════════════════════ */

export function InsightFeed({ onProductClick }: {
  onProductClick?: (productId: string) => void;
}) {
  const insights = useInsightFeed();
  const [filter, setFilter] = useState<InsightSeverity | 'all'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return insights;
    return insights.filter(i => i.severity === filter);
  }, [insights, filter]);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, optimal: 0, info: 0 };
    for (const i of insights) c[i.severity]++;
    return c;
  }, [insights]);

  return (
    <div>
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background: counts.critical > 0 ? M.critical : counts.warning > 0 ? M.warning : M.optimal,
            boxShadow: `0 0 6px ${counts.critical > 0 ? M.critical : counts.warning > 0 ? M.warning : M.optimal}50`,
          }} />
          <span className="text-[10px] font-mono tracking-[0.12em] uppercase font-bold" style={{ color: M.textSecondary }}>
            Biometric Intelligence
          </span>
        </div>
        <span className="text-[9px] font-mono" style={{ color: M.textDim }}>
          {insights.length} insights
        </span>
      </div>

      {/* ── Filter Pills ── */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {(['all', 'critical', 'warning', 'optimal'] as const).map(f => {
          const isActive = filter === f;
          const pillColor = f === 'all' ? M.textSecondary : f === 'critical' ? M.critical : f === 'warning' ? M.warning : M.optimal;
          const count = f === 'all' ? insights.length : counts[f as keyof typeof counts] || 0;

          return (
            <button
              key={f}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider uppercase transition-all duration-200 whitespace-nowrap"
              style={{
                background: isActive ? `${pillColor}15` : 'transparent',
                border: `1px solid ${isActive ? `${pillColor}30` : M.cardBorder}`,
                color: isActive ? pillColor : M.textDim,
              }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f}
              {count > 0 && (
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[7px] font-bold" style={{
                  background: isActive ? `${pillColor}20` : 'rgba(255,255,255,0.05)',
                  color: isActive ? pillColor : M.textDim,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Cards ── */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((insight, idx) => (
          <div
            key={insight.id}
            style={{
              animation: `insightSlideIn 0.35s ease both ${idx * 0.06}s`,
            }}
          >
            <InsightCard insight={insight} onProductClick={onProductClick} />
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 rounded-2xl" style={{
            background: M.card,
            border: `1px solid ${M.cardBorder}`,
          }}>
            <span className="text-[11px] font-mono" style={{ color: M.textDim }}>
              No {filter !== 'all' ? filter : ''} insights at this time
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes insightSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default InsightCard;
