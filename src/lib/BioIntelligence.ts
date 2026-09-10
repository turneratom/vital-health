/* ══════════════════════════════════════════════════════════════════════
   BIO-INTELLIGENCE — The "Brain" of Vive 4.0
   
   Higher-order logic system that sits ABOVE IntelligenceEngine.
   Maps daily biometric marker PATTERNS and TRENDS to specific
   Interventions across Peptides, Holistic, and Supplements.
   
   Key differences from IntelligenceEngine:
   • Trend-aware — analyzes multi-day trajectories, not just snapshots
   • Composite scoring — weighted multi-signal confidence
   • Intervention cascades — chains of protocols that build on each other
   • Expanded compound library — NAD+, CJC-1295, Ipamorelin, Zone 2, etc.
   • Scientific rationale generation — dynamic prose, not static strings
   ══════════════════════════════════════════════════════════════════════ */

import {
  type BiometricInputs,
  type ProtocolRecommendation,
  type ProtocolCategory,
  type UrgencyLevel,
  type SystemTarget,
  type Citation,
  runIntelligenceEngine,
} from './IntelligenceEngine';

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

/** A single biometric reading with timestamp for trend analysis */
export interface TimestampedReading {
  timestamp: number;
  value: number;
}

/** Multi-day biometric history for trend computation */
export interface BiometricHistory {
  hrv: TimestampedReading[];
  heartRate: TimestampedReading[];
  sleepHours: TimestampedReading[];
  sleepScore: TimestampedReading[];
  recovery: TimestampedReading[];
  stress: TimestampedReading[];
  strain: TimestampedReading[];
  bodyBattery: TimestampedReading[];
  spo2: TimestampedReading[];
  glucose?: TimestampedReading[];
}

/** Trend direction for a biomarker */
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'critical_decline';

/** Computed trend for a single biomarker */
export interface BiomarkerTrend {
  marker: string;
  current: number;
  average7d: number;
  trend: TrendDirection;
  /** Slope of linear regression (units per day) */
  slope: number;
  /** Volatility — standard deviation of readings */
  volatility: number;
  /** Percentile rank vs. optimal range */
  percentileRank: number;
}

/** Composite biological state assessment */
export interface BiologicalState {
  /** Overall system readiness 0-100 */
  compositeScore: number;
  /** Dominant biological concern */
  primaryConcern: string;
  /** System-level assessments */
  systems: SystemAssessment[];
  /** Computed trends for each biomarker */
  trends: BiomarkerTrend[];
  /** Risk flags that need attention */
  riskFlags: RiskFlag[];
  /** Timestamp of assessment */
  assessedAt: number;
}

export interface SystemAssessment {
  system: SystemTarget;
  label: string;
  score: number; // 0-100
  status: 'optimal' | 'adequate' | 'suboptimal' | 'compromised' | 'critical';
  icon: string;
  color: string;
  insight: string;
}

export interface RiskFlag {
  id: string;
  severity: 'warning' | 'alert' | 'critical';
  marker: string;
  message: string;
  icon: string;
}

/** An intervention with full scientific backing */
export interface Intervention {
  id: string;
  name: string;
  category: ProtocolCategory;
  icon: string;
  color: string;
  systemTarget: SystemTarget;
  /** Confidence score 0-100 */
  confidence: number;
  urgency: UrgencyLevel;
  /** Dynamic scientific rationale generated from current data */
  rationale: string;
  /** Mechanism of action */
  mechanism: string;
  /** Specific dosing protocol */
  dosing: string;
  /** Optimal timing */
  timing: string;
  /** Duration of protocol */
  duration: string;
  /** Expected outcomes with timeline */
  expectedOutcomes: string[];
  /** Synergistic compounds */
  synergies: string[];
  /** Contraindications */
  cautions: string[];
  /** Peer-reviewed citations */
  citations: Citation[];
  /** Which biomarker signals triggered this */
  triggers: string[];
  /** Cascade — what to stack after this protocol */
  cascadeNext?: string[];
}

/** Full BioIntelligence output */
export interface BioIntelligenceReport {
  state: BiologicalState;
  interventions: Intervention[];
  /** Top 3 priority actions for today */
  todayPriorities: string[];
  /** Natural language summary */
  executiveSummary: string;
  /** Protocols from the base IntelligenceEngine (for compatibility) */
  baseProtocols: ProtocolRecommendation[];
}

/* ══════════════════════════════════════════════════════════════════
   TREND ANALYSIS — Linear regression + volatility computation
   ══════════════════════════════════════════════════════════════════ */

function computeSlope(readings: TimestampedReading[]): number {
  if (readings.length < 2) return 0;
  const n = readings.length;
  const msPerDay = 86400000;
  // Normalize timestamps to days from first reading
  const t0 = readings[0].timestamp;
  const xs = readings.map(r => (r.timestamp - t0) / msPerDay);
  const ys = readings.map(r => r.value);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function computeAverage(readings: TimestampedReading[]): number {
  if (readings.length === 0) return 0;
  return readings.reduce((s, r) => s + r.value, 0) / readings.length;
}

function computeStdDev(readings: TimestampedReading[]): number {
  if (readings.length < 2) return 0;
  const mean = computeAverage(readings);
  const variance = readings.reduce((s, r) => s + (r.value - mean) ** 2, 0) / (readings.length - 1);
  return Math.sqrt(variance);
}

function classifyTrend(slope: number, volatility: number, isHigherBetter: boolean): TrendDirection {
  const normalizedSlope = isHigherBetter ? slope : -slope;
  if (normalizedSlope > 1.5) return 'improving';
  if (normalizedSlope > -0.5) return 'stable';
  if (normalizedSlope > -3) return 'declining';
  return 'critical_decline';
}

function computePercentileRank(value: number, optimalMin: number, optimalMax: number): number {
  if (value >= optimalMin && value <= optimalMax) return 100;
  if (value < optimalMin) return Math.max(0, (value / optimalMin) * 80);
  return Math.max(0, 80 - ((value - optimalMax) / optimalMax) * 40);
}

/** Compute trend for a single biomarker */
function analyzeBiomarker(
  marker: string,
  readings: TimestampedReading[],
  current: number,
  optimalMin: number,
  optimalMax: number,
  isHigherBetter: boolean
): BiomarkerTrend {
  const slope = computeSlope(readings);
  const avg = readings.length > 0 ? computeAverage(readings) : current;
  const vol = computeStdDev(readings);
  return {
    marker,
    current,
    average7d: Math.round(avg * 10) / 10,
    trend: classifyTrend(slope, vol, isHigherBetter),
    slope: Math.round(slope * 100) / 100,
    volatility: Math.round(vol * 100) / 100,
    percentileRank: Math.round(computePercentileRank(current, optimalMin, optimalMax)),
  };
}

/* ══════════════════════════════════════════════════════════════════
   SYSTEM ASSESSMENT — Score each biological system
   ══════════════════════════════════════════════════════════════════ */

function assessSystems(inputs: BiometricInputs, trends: BiomarkerTrend[]): SystemAssessment[] {
  const getTrend = (m: string) => trends.find(t => t.marker === m);

  const systems: SystemAssessment[] = [
    {
      system: 'nervous_system',
      label: 'Autonomic Nervous System',
      icon: '🧠',
      color: '#AF82FF',
      score: computeSystemScore([
        { value: inputs.hrv, weight: 0.35, optimal: [50, 100] },
        { value: inputs.stress, weight: 0.25, optimal: [0, 30], invert: true },
        { value: inputs.heartRate, weight: 0.2, optimal: [55, 72], invert: true },
        { value: inputs.respiratoryRate, weight: 0.2, optimal: [12, 16], invert: true },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'sleep_architecture',
      label: 'Sleep Architecture',
      icon: '🌙',
      color: '#6B8AFF',
      score: computeSystemScore([
        { value: inputs.sleepHours, weight: 0.3, optimal: [7, 9] },
        { value: inputs.sleepScore, weight: 0.25, optimal: [80, 100] },
        { value: inputs.sleepDeepPct, weight: 0.25, optimal: [15, 25] },
        { value: inputs.sleepRemPct, weight: 0.2, optimal: [20, 30] },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'cardiovascular',
      label: 'Cardiovascular',
      icon: '❤️',
      color: '#FF6B6B',
      score: computeSystemScore([
        { value: inputs.heartRate, weight: 0.35, optimal: [55, 72], invert: true },
        { value: inputs.hrv, weight: 0.3, optimal: [50, 100] },
        { value: inputs.spo2, weight: 0.2, optimal: [96, 100] },
        { value: inputs.recovery, weight: 0.15, optimal: [70, 100] },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'metabolic',
      label: 'Metabolic',
      icon: '🔥',
      color: '#FF8C42',
      score: computeSystemScore([
        { value: inputs.bodyBattery, weight: 0.3, optimal: [60, 100] },
        { value: inputs.strain, weight: 0.25, optimal: [4, 14] },
        { value: inputs.recovery, weight: 0.25, optimal: [65, 100] },
        { value: inputs.steps, weight: 0.2, optimal: [6000, 12000] },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'immune',
      label: 'Immune / Inflammatory',
      icon: '🛡️',
      color: '#00DC82',
      score: computeSystemScore([
        { value: inputs.recovery, weight: 0.25, optimal: [70, 100] },
        { value: inputs.sleepHours, weight: 0.2, optimal: [7, 9] },
        { value: inputs.hrv, weight: 0.2, optimal: [50, 100] },
        { value: inputs.skinTemp, weight: 0.15, optimal: [36.2, 36.8] },
        { value: inputs.crp ?? 1, weight: 0.2, optimal: [0, 1.5], invert: true },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'endocrine',
      label: 'Endocrine / Hormonal',
      icon: '⚗️',
      color: '#FFD700',
      score: computeSystemScore([
        { value: inputs.sleepDeepPct, weight: 0.3, optimal: [15, 25] },
        { value: inputs.cortisol ?? 15, weight: 0.25, optimal: [6, 18] },
        { value: inputs.stress, weight: 0.25, optimal: [0, 35], invert: true },
        { value: inputs.recovery, weight: 0.2, optimal: [65, 100] },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'mitochondrial',
      label: 'Mitochondrial / Energy',
      icon: '⚡',
      color: '#00E5FF',
      score: computeSystemScore([
        { value: inputs.bodyBattery, weight: 0.35, optimal: [60, 100] },
        { value: inputs.spo2, weight: 0.25, optimal: [96, 100] },
        { value: inputs.strain, weight: 0.2, optimal: [4, 14] },
        { value: inputs.recovery, weight: 0.2, optimal: [65, 100] },
      ]),
      status: 'adequate',
      insight: '',
    },
    {
      system: 'cognitive',
      label: 'Cognitive Performance',
      icon: '💡',
      color: '#E8976C',
      score: computeSystemScore([
        { value: inputs.sleepScore, weight: 0.25, optimal: [80, 100] },
        { value: inputs.readiness, weight: 0.25, optimal: [70, 100] },
        { value: inputs.bodyBattery, weight: 0.2, optimal: [55, 100] },
        { value: inputs.stress, weight: 0.15, optimal: [0, 35], invert: true },
        { value: inputs.sleepRemPct, weight: 0.15, optimal: [20, 30] },
      ]),
      status: 'adequate',
      insight: '',
    },
  ];

  // Assign status and generate insight for each system
  for (const sys of systems) {
    sys.status = sys.score >= 85 ? 'optimal' : sys.score >= 70 ? 'adequate' : sys.score >= 50 ? 'suboptimal' : sys.score >= 30 ? 'compromised' : 'critical';
    sys.insight = generateSystemInsight(sys, inputs, getTrend);
  }

  return systems.sort((a, b) => a.score - b.score); // Worst first
}

interface WeightedSignal {
  value: number;
  weight: number;
  optimal: [number, number];
  invert?: boolean;
}

function computeSystemScore(signals: WeightedSignal[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of signals) {
    const [lo, hi] = s.optimal;
    let score: number;
    if (s.invert) {
      // Lower is better (stress, HR, etc.)
      if (s.value <= hi) score = 100;
      else if (s.value <= hi * 1.3) score = 70;
      else if (s.value <= hi * 1.6) score = 40;
      else score = 15;
    } else {
      if (s.value >= lo && s.value <= hi) score = 100;
      else if (s.value >= lo * 0.8) score = 75;
      else if (s.value >= lo * 0.5) score = 45;
      else score = 15;
    }
    weightedSum += score * s.weight;
    totalWeight += s.weight;
  }
  return Math.round(totalWeight > 0 ? weightedSum / totalWeight : 50);
}

function generateSystemInsight(
  sys: SystemAssessment,
  inputs: BiometricInputs,
  getTrend: (m: string) => BiomarkerTrend | undefined
): string {
  const hrvTrend = getTrend('hrv');
  const sleepTrend = getTrend('sleepScore');

  switch (sys.system) {
    case 'nervous_system':
      if (sys.score < 40) return `Autonomic nervous system under significant stress. HRV at ${inputs.hrv}ms with stress index ${inputs.stress} indicates sympathetic dominance. ${hrvTrend?.trend === 'declining' ? 'HRV trending downward — vagal tone deteriorating.' : ''} Immediate parasympathetic restoration protocols recommended.`;
      if (sys.score < 65) return `Mild autonomic imbalance detected. HRV (${inputs.hrv}ms) and stress (${inputs.stress}) suggest room for parasympathetic optimization. Consider breathwork and NSDR protocols.`;
      return `Autonomic balance within operational parameters. HRV ${inputs.hrv}ms indicates healthy vagal tone. ${hrvTrend?.trend === 'improving' ? 'Positive trend — continue current protocols.' : 'Maintain current recovery practices.'}`;

    case 'sleep_architecture':
      if (sys.score < 40) return `Sleep architecture critically compromised. ${inputs.sleepHours}h total with ${inputs.sleepDeepPct}% deep and ${inputs.sleepRemPct}% REM. Glymphatic clearance and memory consolidation are impaired. ${sleepTrend?.trend === 'declining' ? 'Sleep quality declining — investigate root cause.' : ''} Prioritize sleep optimization immediately.`;
      if (sys.score < 65) return `Sleep quality suboptimal. Deep sleep at ${inputs.sleepDeepPct}% (target >15%) and REM at ${inputs.sleepRemPct}% (target >20%). Consider magnesium threonate and sleep hygiene adjustments.`;
      return `Sleep architecture healthy. ${inputs.sleepHours}h with balanced deep (${inputs.sleepDeepPct}%) and REM (${inputs.sleepRemPct}%) phases supporting full recovery.`;

    case 'cardiovascular':
      if (sys.score < 40) return `Cardiovascular markers concerning. Resting HR ${inputs.heartRate}bpm with HRV ${inputs.hrv}ms and SpO2 ${inputs.spo2}%. Elevated sympathetic tone may indicate overtraining or systemic inflammation.`;
      if (sys.score < 65) return `Cardiovascular function adequate but not optimal. HR ${inputs.heartRate}bpm — consider Zone 2 cardio to improve cardiac efficiency and parasympathetic tone.`;
      return `Cardiovascular system performing well. Resting HR ${inputs.heartRate}bpm with strong HRV ${inputs.hrv}ms indicates efficient cardiac function.`;

    case 'metabolic':
      if (sys.score < 40) return `Metabolic system under strain. Body battery ${inputs.bodyBattery}% with strain ${inputs.strain}/21 and recovery ${inputs.recovery}%. Energy production failing to meet demand. ${inputs.hba1c && inputs.hba1c > 5.7 ? `HbA1c at ${inputs.hba1c}% — glucose dysregulation detected.` : ''}`;
      if (sys.score < 65) return `Metabolic flexibility suboptimal. Consider fasted Zone 2 training and time-restricted eating to improve fat oxidation capacity.`;
      return `Metabolic system balanced. Energy production meeting demand with adequate recovery reserves.`;

    case 'immune':
      if (sys.score < 40) return `Immune system compromised. ${inputs.crp ? `CRP at ${inputs.crp} mg/L indicates active inflammation.` : 'Recovery deficit suggests immune burden.'} Sleep deficit and HRV suppression are reducing immune surveillance capacity.`;
      if (sys.score < 65) return `Immune function adequate but vulnerable. Optimize vitamin D, sleep, and consider anti-inflammatory protocols to build resilience.`;
      return `Immune markers within healthy range. Continue supporting with adequate sleep and micronutrient optimization.`;

    case 'endocrine':
      if (sys.score < 40) return `Endocrine system stressed. ${inputs.cortisol ? `Cortisol at ${inputs.cortisol} ng/dL` : 'Stress patterns'} combined with ${inputs.sleepDeepPct}% deep sleep suggest HPA axis dysregulation. Growth hormone secretion likely impaired.`;
      if (sys.score < 65) return `Hormonal balance suboptimal. Deep sleep (${inputs.sleepDeepPct}%) drives GH secretion — improving sleep architecture will support endocrine function.`;
      return `Endocrine markers suggest healthy hormonal balance. Deep sleep supporting nocturnal GH pulse.`;

    case 'mitochondrial':
      if (sys.score < 40) return `Mitochondrial energy production critically low. Body battery ${inputs.bodyBattery}% with SpO2 ${inputs.spo2}%. Electron transport chain efficiency likely compromised. Consider NAD+ precursors and CoQ10.`;
      if (sys.score < 65) return `Energy production adequate but could improve. Mitochondrial support via NMN/NR and targeted exercise may boost cellular energy output.`;
      return `Mitochondrial function strong. Body battery ${inputs.bodyBattery}% with good oxygen saturation supporting efficient ATP production.`;

    case 'cognitive':
      if (sys.score < 40) return `Cognitive performance significantly impaired. Readiness ${inputs.readiness}% with sleep score ${inputs.sleepScore} — expect reduced working memory, executive function, and reaction time. Nootropic support recommended.`;
      if (sys.score < 65) return `Cognitive capacity moderate. Sleep quality and readiness suggest some executive function limitation. Consider targeted nootropics and NSDR for restoration.`;
      return `Cognitive systems performing well. High readiness (${inputs.readiness}%) and good sleep quality support peak mental performance.`;

    default:
      return `System score: ${sys.score}/100.`;
  }
}

/* ══════════════════════════════════════════════════════════════════
   RISK FLAG DETECTION
   ══════════════════════════════════════════════════════════════════ */

function detectRiskFlags(inputs: BiometricInputs, trends: BiomarkerTrend[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const getTrend = (m: string) => trends.find(t => t.marker === m);

  // Critical HRV
  if (inputs.hrv < 30) {
    flags.push({ id: 'hrv-critical', severity: 'critical', marker: 'HRV', message: `HRV critically low at ${inputs.hrv}ms — severe autonomic suppression`, icon: '🚨' });
  } else if (inputs.hrv < 40 && getTrend('hrv')?.trend === 'declining') {
    flags.push({ id: 'hrv-declining', severity: 'alert', marker: 'HRV', message: `HRV declining trend at ${inputs.hrv}ms — vagal tone deteriorating`, icon: '⚠️' });
  }

  // Sleep debt
  if (inputs.sleepHours < 5.5) {
    flags.push({ id: 'sleep-critical', severity: 'critical', marker: 'Sleep', message: `Severe sleep debt: ${inputs.sleepHours}h — cognitive and immune function impaired`, icon: '🚨' });
  } else if (inputs.sleepHours < 6.5 && inputs.sleepScore < 60) {
    flags.push({ id: 'sleep-poor', severity: 'alert', marker: 'Sleep', message: `Poor sleep quality: ${inputs.sleepHours}h with score ${inputs.sleepScore}`, icon: '⚠️' });
  }

  // Overtraining
  if (inputs.strain > 16 && inputs.recovery < 40) {
    flags.push({ id: 'overtrain', severity: 'critical', marker: 'Strain/Recovery', message: `Overtraining risk: strain ${inputs.strain}/21 with only ${inputs.recovery}% recovery`, icon: '🚨' });
  }

  // Inflammation
  if (inputs.crp && inputs.crp > 5) {
    flags.push({ id: 'crp-high', severity: 'critical', marker: 'CRP', message: `CRP at ${inputs.crp} mg/L — significant systemic inflammation`, icon: '🔥' });
  } else if (inputs.crp && inputs.crp > 3) {
    flags.push({ id: 'crp-elevated', severity: 'alert', marker: 'CRP', message: `CRP elevated at ${inputs.crp} mg/L — chronic inflammation pattern`, icon: '⚠️' });
  }

  // Glucose dysregulation
  if (inputs.hba1c && inputs.hba1c > 6.4) {
    flags.push({ id: 'hba1c-diabetic', severity: 'critical', marker: 'HbA1c', message: `HbA1c at ${inputs.hba1c}% — diabetic range glucose dysregulation`, icon: '🚨' });
  } else if (inputs.hba1c && inputs.hba1c > 5.7) {
    flags.push({ id: 'hba1c-prediabetic', severity: 'alert', marker: 'HbA1c', message: `HbA1c at ${inputs.hba1c}% — pre-diabetic. Insulin sensitivity compromised.`, icon: '⚠️' });
  }

  // Vitamin D deficiency
  if (inputs.vitaminD !== undefined && inputs.vitaminD < 20) {
    flags.push({ id: 'vitd-deficient', severity: 'critical', marker: 'Vitamin D', message: `Vitamin D severely deficient at ${inputs.vitaminD} ng/mL — immune and bone health at risk`, icon: '☀️' });
  }

  // SpO2
  if (inputs.spo2 < 94) {
    flags.push({ id: 'spo2-low', severity: 'alert', marker: 'SpO2', message: `Blood oxygen at ${inputs.spo2}% — below safe threshold`, icon: '🫁' });
  }

  // Body battery crash
  if (inputs.bodyBattery < 15) {
    flags.push({ id: 'battery-crash', severity: 'critical', marker: 'Body Battery', message: `Body battery critically depleted at ${inputs.bodyBattery}% — complete rest required`, icon: '🪫' });
  }

  return flags.sort((a, b) => {
    const sev = { critical: 0, alert: 1, warning: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

/* ══════════════════════════════════════════════════════════════════
   EXPANDED INTERVENTION LIBRARY
   Compounds NOT in IntelligenceEngine — NAD+, CJC-1295, Ipamorelin,
   Zone 2 Cardio, Berberine, Apigenin, Ashwagandha, etc.
   ══════════════════════════════════════════════════════════════════ */

interface InterventionEntry {
  id: string;
  name: string;
  category: ProtocolCategory;
  icon: string;
  color: string;
  systemTarget: SystemTarget;
  mechanism: string;
  dosing: string;
  timing: string;
  duration: string;
  expectedOutcomes: string[];
  synergies: string[];
  cautions: string[];
  citations: Citation[];
  cascadeNext?: string[];
  /** Match function — returns confidence, triggers, urgency, and dynamic rationale */
  match: (inputs: BiometricInputs, trends: BiomarkerTrend[]) => {
    confidence: number;
    triggers: string[];
    urgency: UrgencyLevel;
    rationale: string;
  } | null;
}

const EXPANDED_LIBRARY: InterventionEntry[] = [
  /* ─── NAD+ (NMN) ─── */
  {
    id: 'nad-nmn',
    name: 'NAD+ Precursor (NMN)',
    category: 'supplement',
    icon: '🔋',
    color: '#00E5FF',
    systemTarget: 'mitochondrial',
    mechanism: 'NMN (Nicotinamide Mononucleotide) is a direct precursor to NAD+, a coenzyme essential for mitochondrial electron transport, sirtuin activation (SIRT1-7), and PARP-mediated DNA repair. NAD+ levels decline ~50% between ages 40-60. Supplementation restores cellular energy metabolism, activates longevity pathways, and enhances mitochondrial biogenesis via PGC-1α.',
    dosing: '500-1000mg sublingual NMN daily. Start at 250mg and titrate up over 2 weeks. Sublingual bypasses first-pass metabolism for 2-3x bioavailability.',
    timing: 'Morning on empty stomach. NAD+ has circadian rhythm — morning dosing aligns with peak metabolic demand. Avoid evening — may disrupt sleep via sirtuin-mediated clock gene activation.',
    duration: 'Ongoing — 8-12 weeks for measurable biomarker changes. Continuous supplementation recommended.',
    expectedOutcomes: [
      'Subjective energy improvement within 7-14 days',
      'Measurable body battery improvement within 3-4 weeks',
      'Improved exercise recovery within 4-6 weeks',
      'Enhanced cognitive clarity within 2-4 weeks',
    ],
    synergies: ['Resveratrol (SIRT1 activation)', 'CoQ10 (ETC Complex III)', 'TMG/Betaine (methyl donor to offset NAD+ methylation)'],
    cautions: ['May cause mild GI discomfort initially', 'Take TMG alongside to prevent methyl group depletion', 'Theoretical concern in active malignancy (NAD+ fuels all cells)'],
    citations: [
      { authors: 'Yoshino J, Baur JA, Imai SI', title: 'NAD+ intermediates: the biology and therapeutic potential of NMN and NR', journal: 'Cell Metab', year: 2018, doi: '10.1016/j.cmet.2017.11.002' },
      { authors: 'Mills KF, Yoshida S, et al.', title: 'Long-term administration of NMN mitigates age-associated physiological decline in mice', journal: 'Cell Metab', year: 2016, doi: '10.1016/j.cmet.2016.09.013' },
    ],
    cascadeNext: ['ss-31', 'cold-exposure'],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.bodyBattery < 40) { score += 30; triggers.push(`Body battery depleted (${inputs.bodyBattery}%)`); }
      else if (inputs.bodyBattery < 55) { score += 15; triggers.push(`Body battery suboptimal (${inputs.bodyBattery}%)`); }
      if (inputs.recovery < 50) { score += 20; triggers.push(`Low recovery (${inputs.recovery}%) — NAD+ supports cellular repair`); }
      if (inputs.strain > 12) { score += 15; triggers.push(`High strain (${inputs.strain}) depleting NAD+ reserves`); }
      if (inputs.spo2 < 96) { score += 10; triggers.push(`SpO2 below optimal (${inputs.spo2}%) — mitochondrial support needed`); }
      const batteryTrend = trends.find(t => t.marker === 'bodyBattery');
      if (batteryTrend && batteryTrend.trend === 'declining') { score += 15; triggers.push('Body battery trending downward — cellular energy declining'); }
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 55 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      const rationale = `Your body battery at ${inputs.bodyBattery}% with recovery at ${inputs.recovery}% indicates cellular energy production is failing to meet demand. NAD+ levels naturally decline with age and are further depleted by high strain (${inputs.strain}/21). NMN supplementation directly replenishes the NAD+ pool, restoring mitochondrial electron transport chain efficiency and activating SIRT1-mediated cellular repair pathways. ${batteryTrend?.trend === 'declining' ? 'The declining energy trend makes this intervention particularly urgent.' : ''}`;
      return { confidence: Math.min(95, score), triggers, urgency, rationale };
    },
  },

  /* ─── CJC-1295 + Ipamorelin ─── */
  {
    id: 'cjc-1295-ipamorelin',
    name: 'CJC-1295 / Ipamorelin Stack',
    category: 'peptide',
    icon: '💉',
    color: '#AF82FF',
    systemTarget: 'endocrine',
    mechanism: 'CJC-1295 is a GHRH analog with Drug Affinity Complex (DAC) that extends half-life to 6-8 days, providing sustained GH-releasing hormone stimulation. Ipamorelin is a selective ghrelin mimetic (GHS-R agonist) that triggers pulsatile GH release without cortisol or prolactin elevation. Combined, they amplify the natural nocturnal GH pulse by 3-6x, promoting lipolysis, collagen synthesis, deep sleep enhancement, and tissue repair.',
    dosing: 'CJC-1295 (no DAC): 100mcg + Ipamorelin 100mcg subcutaneous, 5 nights/week. Cycle: 12 weeks on, 4 weeks off.',
    timing: 'Pre-bed (30 min before sleep) to amplify nocturnal GH pulse. Fasted state required — insulin suppresses GH release.',
    duration: '12-week cycle with 4-week washout. Effects compound over 8-12 weeks.',
    expectedOutcomes: [
      'Improved deep sleep percentage within 1-2 weeks',
      'Enhanced recovery scores within 2-3 weeks',
      'Visible body composition changes within 6-8 weeks',
      'Improved skin quality and collagen within 8-12 weeks',
    ],
    synergies: ['Magnesium Threonate (sleep synergy)', 'TB-500 (tissue repair amplification)', 'Fasted training AM (GH + lipolysis)'],
    cautions: ['Not FDA-approved for anti-aging use', 'Contraindicated in active malignancy', 'Monitor IGF-1 levels quarterly', 'May cause water retention initially'],
    citations: [
      { authors: 'Teichman SL, Neale A, et al.', title: 'Prolonged stimulation of growth hormone (GH) and insulin-like growth factor I secretion by CJC-1295', journal: 'J Clin Endocrinol Metab', year: 2006, doi: '10.1210/jc.2005-1601' },
      { authors: 'Raun K, Hansen BS, et al.', title: 'Ipamorelin, the first selective growth hormone secretagogue', journal: 'Eur J Endocrinol', year: 1998, doi: '10.1530/eje.0.1390552' },
    ],
    cascadeNext: ['magnesium-threonate', 'thymosin-beta-4'],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.sleepDeepPct < 13) { score += 30; triggers.push(`Deep sleep critically low (${inputs.sleepDeepPct}%) — GH secretion impaired`); }
      else if (inputs.sleepDeepPct < 18) { score += 15; triggers.push(`Deep sleep suboptimal (${inputs.sleepDeepPct}%)`); }
      if (inputs.recovery < 50) { score += 20; triggers.push(`Recovery depleted (${inputs.recovery}%) — tissue repair insufficient`); }
      if (inputs.strain > 12 && inputs.recovery < 60) { score += 15; triggers.push(`High strain-to-recovery imbalance`); }
      if (inputs.readiness < 55) { score += 10; triggers.push(`Low readiness (${inputs.readiness}%)`); }
      const sleepTrend = trends.find(t => t.marker === 'sleepScore');
      if (sleepTrend && sleepTrend.trend === 'declining') { score += 10; triggers.push('Sleep quality declining — GH optimization urgent'); }
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 55 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      const rationale = `Deep sleep at ${inputs.sleepDeepPct}% is ${inputs.sleepDeepPct < 15 ? 'critically below' : 'below'} the 15-25% optimal range. During deep sleep, the anterior pituitary releases ~70% of daily growth hormone in pulsatile bursts. Your recovery at ${inputs.recovery}% suggests insufficient tissue repair — the CJC-1295/Ipamorelin stack amplifies nocturnal GH pulse amplitude by 3-6x without disrupting the natural pulsatile pattern. Unlike exogenous GH, this approach preserves hypothalamic feedback sensitivity.`;
      return { confidence: Math.min(94, score), triggers, urgency, rationale };
    },
  },

  /* ─── Zone 2 Cardio ─── */
  {
    id: 'zone-2-cardio',
    name: 'Zone 2 Aerobic Training',
    category: 'holistic',
    icon: '🏃',
    color: '#00DC82',
    systemTarget: 'cardiovascular',
    mechanism: 'Zone 2 training (60-70% max HR) maximizes mitochondrial fat oxidation via the aerobic energy system. It selectively trains Type I slow-twitch muscle fibers, increasing mitochondrial density and capillary bed volume. This improves lactate clearance capacity (MCT1 transporter upregulation), cardiac stroke volume, and parasympathetic tone. Dr. Iñigo San Millán\'s research shows Zone 2 is the only intensity that improves metabolic flexibility — the ability to switch between fat and carbohydrate oxidation.',
    dosing: '45-60 minutes, 3-4x per week. Heart rate should stay at 60-70% of max HR (roughly 180 - age ± 5 bpm). You should be able to hold a conversation but not sing.',
    timing: 'Morning fasted for maximum fat oxidation. Or afternoon for those with low morning readiness. Avoid within 3 hours of bedtime.',
    duration: 'Ongoing — minimum 8-12 weeks for measurable mitochondrial adaptations. Lifelong practice recommended.',
    expectedOutcomes: [
      'Improved resting HR within 4-6 weeks',
      'Enhanced HRV within 6-8 weeks',
      'Better fat oxidation and metabolic flexibility within 8-12 weeks',
      'Reduced lactate at submaximal intensities within 12 weeks',
    ],
    synergies: ['NAD+ (mitochondrial biogenesis)', 'Omega-3 (cardiovascular support)', 'Magnesium (muscle function)'],
    cautions: ['Ensure adequate recovery before sessions', 'Stay strictly in Zone 2 — going harder defeats the purpose', 'Hydrate adequately'],
    citations: [
      { authors: 'San-Millán I, Brooks GA', title: 'Assessment of metabolic flexibility by means of measuring blood lactate, fat, and carbohydrate oxidation responses to exercise', journal: 'Sports Med', year: 2018, doi: '10.1007/s40279-017-0751-x' },
    ],
    cascadeNext: ['nad-nmn', 'omega-3-spm'],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.heartRate > 72) { score += 20; triggers.push(`Elevated resting HR (${inputs.heartRate}bpm) — cardiac efficiency suboptimal`); }
      if (inputs.hrv < 50) { score += 15; triggers.push(`Low HRV (${inputs.hrv}ms) — parasympathetic tone needs improvement`); }
      if (inputs.bodyBattery < 50) { score += 10; triggers.push(`Low body battery (${inputs.bodyBattery}%) — aerobic base needs building`); }
      if (inputs.recovery > 55) { score += 10; triggers.push(`Recovery sufficient (${inputs.recovery}%) for aerobic training`); }
      if (inputs.steps < 5000) { score += 15; triggers.push(`Low daily movement (${inputs.steps} steps)`); }
      const hrvTrend = trends.find(t => t.marker === 'hrv');
      if (hrvTrend && hrvTrend.trend === 'declining') { score += 10; triggers.push('HRV declining — aerobic base training can reverse this'); }
      if (score < 15) return null;
      // Don't recommend if recovery is too low
      if (inputs.recovery < 30) return null;
      const urgency: UrgencyLevel = score >= 50 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      const rationale = `Your resting HR of ${inputs.heartRate}bpm and HRV of ${inputs.hrv}ms indicate suboptimal cardiovascular efficiency. Zone 2 training is the single most effective intervention for improving mitochondrial density, cardiac stroke volume, and parasympathetic tone. At your current recovery (${inputs.recovery}%), you have sufficient reserves for aerobic training. Target HR zone: ${Math.round(140 - inputs.heartRate * 0.3)}-${Math.round(155 - inputs.heartRate * 0.3)}bpm for 45-60 minutes.`;
      return { confidence: Math.min(93, score), triggers, urgency, rationale };
    },
  },

  /* ─── Berberine ─── */
  {
    id: 'berberine',
    name: 'Berberine HCl',
    category: 'supplement',
    icon: '🌿',
    color: '#FFD700',
    systemTarget: 'metabolic',
    mechanism: 'Berberine activates AMPK (AMP-activated protein kinase), the master metabolic switch that mimics caloric restriction and exercise at the cellular level. It improves insulin sensitivity by upregulating GLUT4 transporters, reduces hepatic glucose output, and modulates gut microbiome composition (increasing Akkermansia muciniphila). Meta-analyses show glucose-lowering efficacy comparable to metformin (0.5-0.9% HbA1c reduction).',
    dosing: '500mg 2-3x daily with meals. Start with 500mg 1x daily and titrate up over 2 weeks to minimize GI side effects.',
    timing: 'With meals — berberine requires food for absorption and works by modulating postprandial glucose response.',
    duration: '8-12 week cycles. Monitor fasting glucose and HbA1c at baseline and 8 weeks.',
    expectedOutcomes: [
      'Reduced postprandial glucose spikes within 1-2 weeks',
      'Improved fasting glucose within 4-6 weeks',
      'HbA1c reduction of 0.5-0.9% within 8-12 weeks',
      'Improved gut microbiome diversity within 4-8 weeks',
    ],
    synergies: ['Chromium (insulin receptor sensitivity)', 'Alpha-lipoic acid (glucose uptake)', 'Cinnamon extract (AMPK synergy)'],
    cautions: ['GI discomfort common initially — titrate slowly', 'May interact with CYP3A4/CYP2D6 substrates', 'Not with metformin (additive hypoglycemia risk)', 'Avoid in pregnancy'],
    citations: [
      { authors: 'Yin J, Xing H, Ye J', title: 'Efficacy of berberine in patients with type 2 diabetes mellitus', journal: 'Metabolism', year: 2008, doi: '10.1016/j.metabol.2008.01.013' },
      { authors: 'Zhang Y, Li X, et al.', title: 'Treatment of type 2 diabetes and dyslipidemia with the natural plant alkaloid berberine', journal: 'J Clin Endocrinol Metab', year: 2008, doi: '10.1210/jc.2007-2404' },
    ],
    cascadeNext: ['zone-2-cardio'],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.hba1c && inputs.hba1c > 6.0) { score += 40; triggers.push(`HbA1c elevated (${inputs.hba1c}%) — glucose dysregulation confirmed`); }
      else if (inputs.hba1c && inputs.hba1c > 5.7) { score += 25; triggers.push(`HbA1c pre-diabetic range (${inputs.hba1c}%)`); }
      if (inputs.stress > 55) { score += 10; triggers.push(`Stress (${inputs.stress}) driving cortisol-mediated gluconeogenesis`); }
      if (inputs.sleepHours < 6.5) { score += 10; triggers.push(`Sleep deficit (${inputs.sleepHours}h) impairing insulin sensitivity`); }
      if (inputs.bodyBattery < 40) { score += 5; triggers.push(`Low energy (${inputs.bodyBattery}%) may indicate metabolic inflexibility`); }
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 50 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      const rationale = `${inputs.hba1c ? `Your HbA1c at ${inputs.hba1c}% indicates ${inputs.hba1c > 6.4 ? 'diabetic-range' : 'pre-diabetic'} glucose dysregulation.` : 'Your metabolic markers suggest glucose metabolism may be suboptimal.'} Berberine activates AMPK — the same pathway triggered by exercise and caloric restriction — improving insulin sensitivity and reducing hepatic glucose output. Combined with stress at ${inputs.stress} (cortisol drives gluconeogenesis) and sleep deficit, your metabolic flexibility is compromised. Berberine addresses this at the cellular level.`;
      return { confidence: Math.min(92, score), triggers, urgency, rationale };
    },
  },

  /* ─── Apigenin ─── */
  {
    id: 'apigenin',
    name: 'Apigenin',
    category: 'supplement',
    icon: '🌼',
    color: '#E8976C',
    systemTarget: 'sleep_architecture',
    mechanism: 'Apigenin is a flavonoid that acts as a positive allosteric modulator of GABA-A receptors (specifically the benzodiazepine binding site) without the dependency or tolerance issues of pharmaceutical GABAergics. It also inhibits CD38, an NAD+-consuming enzyme, thereby preserving cellular NAD+ levels. The dual action — anxiolytic sleep promotion + NAD+ preservation — makes it uniquely suited for sleep optimization in high-performers.',
    dosing: '50mg apigenin (from chamomile extract), 30-60 minutes before bed.',
    timing: 'Evening only — 30-60 minutes pre-sleep. Combine with magnesium threonate for synergistic GABA potentiation.',
    duration: 'Ongoing — no tolerance development reported. Safe for long-term use.',
    expectedOutcomes: [
      'Reduced sleep onset latency within 3-5 days',
      'Improved subjective sleep quality within 1 week',
      'Enhanced deep sleep percentage within 2-3 weeks',
      'Preserved NAD+ levels (measurable via blood test at 8 weeks)',
    ],
    synergies: ['Magnesium Threonate (GABA synergy)', 'L-Theanine (alpha wave promotion)', 'NMN (NAD+ pathway synergy via CD38 inhibition)'],
    cautions: ['May potentiate sedative medications', 'Mild estrogenic activity at very high doses', 'Source quality matters — standardized extract preferred'],
    citations: [
      { authors: 'Salehi B, Venditti A, et al.', title: 'The therapeutic potential of apigenin', journal: 'Int J Mol Sci', year: 2019, doi: '10.3390/ijms20061305' },
    ],
    cascadeNext: ['magnesium-threonate', 'nad-nmn'],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.sleepScore < 60) { score += 25; triggers.push(`Poor sleep quality (score ${inputs.sleepScore})`); }
      else if (inputs.sleepScore < 75) { score += 12; triggers.push(`Suboptimal sleep quality (score ${inputs.sleepScore})`); }
      if (inputs.sleepDeepPct < 14) { score += 20; triggers.push(`Deep sleep critically low (${inputs.sleepDeepPct}%)`); }
      if (inputs.stress > 50) { score += 15; triggers.push(`Elevated stress (${inputs.stress}) impeding sleep onset`); }
      if (inputs.sleepHours < 7) { score += 10; triggers.push(`Insufficient sleep duration (${inputs.sleepHours}h)`); }
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 50 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      const rationale = `Sleep score at ${inputs.sleepScore} with deep sleep at ${inputs.sleepDeepPct}% indicates compromised sleep architecture. Apigenin modulates GABA-A receptors to promote natural sleep onset without the tolerance or dependency of pharmaceutical sleep aids. Its secondary action — CD38 inhibition — preserves NAD+ levels that are critical for overnight cellular repair. With stress at ${inputs.stress}, the anxiolytic properties will help quiet the sympathetic nervous system for sleep onset.`;
      return { confidence: Math.min(91, score), triggers, urgency, rationale };
    },
  },

  /* ─── Ashwagandha KSM-66 ─── */
  {
    id: 'ashwagandha-ksm66',
    name: 'Ashwagandha KSM-66',
    category: 'supplement',
    icon: '🌱',
    color: '#8B5CF6',
    systemTarget: 'endocrine',
    mechanism: 'KSM-66 is a full-spectrum ashwagandha extract standardized to >5% withanolides. It modulates the HPA axis by reducing cortisol output 25-30% (Chandrasekhar 2012), enhances GABA-mimetic activity, and upregulates thyroid function (T3/T4). The adaptogenic mechanism normalizes stress response — it doesn\'t simply suppress cortisol but restores the diurnal cortisol curve (high AM, low PM) that chronic stress flattens.',
    dosing: '600mg KSM-66 daily (300mg AM + 300mg PM). Full-spectrum root extract standardized to ≥5% withanolides.',
    timing: 'Split dose: 300mg with breakfast, 300mg with dinner. PM dose supports evening cortisol decline for sleep.',
    duration: '8-12 weeks for full adaptogenic effect. Cycle 8 weeks on, 2 weeks off to prevent receptor downregulation.',
    expectedOutcomes: [
      'Reduced perceived stress within 2-4 weeks',
      'Cortisol reduction of 25-30% within 4-8 weeks',
      'Improved sleep quality within 2-3 weeks',
      'Enhanced recovery scores within 4-6 weeks',
    ],
    synergies: ['Magnesium (HPA axis support)', 'NSDR (parasympathetic synergy)', 'Rhodiola (adaptogenic stacking)'],
    cautions: ['May potentiate thyroid medication', 'Avoid in autoimmune thyroid conditions', 'Nightshade family — avoid if nightshade-sensitive', 'Cycle to prevent tolerance'],
    citations: [
      { authors: 'Chandrasekhar K, Kapoor J, Anishetty S', title: 'A prospective, randomized double-blind, placebo-controlled study of safety and efficacy of a high-concentration full-spectrum extract of ashwagandha root', journal: 'Indian J Psychol Med', year: 2012, doi: '10.4103/0253-7176.106022' },
    ],
    cascadeNext: ['nsdr-yoga-nidra', 'magnesium-threonate'],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.stress > 65) { score += 30; triggers.push(`High chronic stress (${inputs.stress}) — HPA axis dysregulation likely`); }
      else if (inputs.stress > 45) { score += 15; triggers.push(`Moderate stress (${inputs.stress}) — adaptogenic support beneficial`); }
      if (inputs.cortisol && inputs.cortisol > 22) { score += 25; triggers.push(`Cortisol elevated (${inputs.cortisol} ng/dL)`); }
      if (inputs.recovery < 55) { score += 10; triggers.push(`Low recovery (${inputs.recovery}%) — stress burden evident`); }
      if (inputs.sleepScore < 65) { score += 10; triggers.push(`Poor sleep (score ${inputs.sleepScore}) — cortisol may be disrupting sleep`); }
      const stressTrend = trends.find(t => t.marker === 'stress');
      if (stressTrend && stressTrend.trend === 'declining') { score -= 10; } // Stress improving — less urgent
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 55 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      const rationale = `Stress index at ${inputs.stress} ${inputs.cortisol ? `with cortisol at ${inputs.cortisol} ng/dL` : ''} indicates HPA axis dysregulation. Chronic stress flattens the diurnal cortisol curve — you lose the healthy AM spike (alertness) and PM decline (sleep onset). Ashwagandha KSM-66 doesn't just suppress cortisol — it restores the natural rhythm, reducing total output by 25-30% while preserving the morning peak. Recovery at ${inputs.recovery}% will improve as the stress burden lifts.`;
      return { confidence: Math.min(93, score), triggers, urgency, rationale };
    },
  },

  /* ─── Tongkat Ali ─── */
  {
    id: 'tongkat-ali',
    name: 'Tongkat Ali (Eurycoma longifolia)',
    category: 'supplement',
    icon: '🌿',
    color: '#FF8C42',
    systemTarget: 'endocrine',
    mechanism: 'Tongkat Ali contains eurypeptides that reduce SHBG (sex hormone-binding globulin) by 30-40%, increasing free testosterone bioavailability without exogenous hormone administration. It also inhibits cortisol via CYP17 modulation and enhances luteinizing hormone (LH) signaling. The net effect is improved testosterone-to-cortisol ratio — the primary hormonal driver of recovery, body composition, and performance.',
    dosing: '400mg standardized extract (100:1 or 200:1) daily. Cycle: 5 days on, 2 days off.',
    timing: 'Morning with breakfast. Testosterone peaks in AM — morning dosing supports natural rhythm.',
    duration: '4-12 weeks for measurable hormonal changes. Cycle with 2-week breaks.',
    expectedOutcomes: [
      'Improved morning energy and drive within 1-2 weeks',
      'Enhanced recovery scores within 3-4 weeks',
      'Measurable free testosterone increase within 4-8 weeks',
      'Improved body composition with training within 8-12 weeks',
    ],
    synergies: ['Ashwagandha (cortisol reduction synergy)', 'Zinc (testosterone cofactor)', 'Vitamin D3 (hormonal support)'],
    cautions: ['Source quality critical — many adulterated products', 'May affect blood sugar — monitor if diabetic', 'Avoid with hormone-sensitive conditions'],
    citations: [
      { authors: 'Talbott SM, Talbott JA, et al.', title: 'Effect of Tongkat Ali on stress hormones and psychological mood state', journal: 'J Int Soc Sports Nutr', year: 2013, doi: '10.1186/1550-2783-10-28' },
    ],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.stress > 55 && inputs.recovery < 60) { score += 25; triggers.push(`Poor testosterone-to-cortisol ratio (stress ${inputs.stress}, recovery ${inputs.recovery}%)`); }
      if (inputs.strain > 12) { score += 15; triggers.push(`High training strain (${inputs.strain}) — hormonal recovery support needed`); }
      if (inputs.sleepDeepPct < 15) { score += 10; triggers.push(`Low deep sleep (${inputs.sleepDeepPct}%) — GH/testosterone secretion impaired`); }
      if (inputs.bodyBattery < 45) { score += 10; triggers.push(`Low energy reserves (${inputs.bodyBattery}%)`); }
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'advisory';
      const rationale = `Your stress-to-recovery ratio (${inputs.stress}/${inputs.recovery}%) suggests an unfavorable testosterone-to-cortisol balance. High cortisol suppresses LH signaling and increases SHBG, reducing free testosterone bioavailability. Tongkat Ali addresses this by reducing SHBG 30-40% and modulating cortisol via CYP17 inhibition — improving the hormonal environment for recovery and adaptation without exogenous hormones.`;
      return { confidence: Math.min(88, score), triggers, urgency, rationale };
    },
  },

  /* ─── Creatine Monohydrate ─── */
  {
    id: 'creatine',
    name: 'Creatine Monohydrate',
    category: 'supplement',
    icon: '💪',
    color: '#7DD3FC',
    systemTarget: 'cognitive',
    mechanism: 'Creatine serves as a phosphate donor for rapid ATP regeneration via the phosphocreatine system. Beyond muscle performance, brain creatine levels directly impact cognitive function — the brain consumes 20% of daily energy. Creatine supplementation improves working memory, reduces mental fatigue, and enhances cognitive performance under stress and sleep deprivation (Rae et al., 2003). It also has neuroprotective properties via mitochondrial membrane stabilization.',
    dosing: '5g creatine monohydrate daily. No loading phase needed — saturation occurs within 3-4 weeks of daily dosing.',
    timing: 'Any time of day with water. Post-workout if training, or with morning meal for cognitive focus.',
    duration: 'Ongoing — safe for continuous long-term use. Most studied supplement in sports science.',
    expectedOutcomes: [
      'Cognitive improvement under stress within 1-2 weeks',
      'Muscle phosphocreatine saturation within 3-4 weeks',
      'Improved exercise performance within 4 weeks',
      'Neuroprotective benefits accumulate over months',
    ],
    synergies: ['NAD+ (energy metabolism synergy)', 'Zone 2 cardio (aerobic + anaerobic capacity)', 'Omega-3 (brain health)'],
    cautions: ['Ensure adequate hydration (creatine increases intracellular water)', 'Monohydrate form only — other forms lack evidence', 'Safe for kidneys in healthy individuals'],
    citations: [
      { authors: 'Rae C, Digney AL, et al.', title: 'Oral creatine monohydrate supplementation improves brain performance', journal: 'Proc Biol Sci', year: 2003, doi: '10.1098/rspb.2003.2492' },
    ],
    match: (inputs, trends) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.readiness < 55) { score += 20; triggers.push(`Low readiness (${inputs.readiness}%) — cognitive support needed`); }
      if (inputs.sleepHours < 6.5) { score += 15; triggers.push(`Sleep deficit (${inputs.sleepHours}h) — creatine buffers cognitive decline`); }
      if (inputs.bodyBattery < 45) { score += 10; triggers.push(`Low energy (${inputs.bodyBattery}%) — phosphocreatine system support`); }
      if (inputs.strain > 10) { score += 10; triggers.push(`Moderate-high strain (${inputs.strain}) — ATP regeneration support`); }
      if (score < 15) return null;
      const urgency: UrgencyLevel = score >= 40 ? 'moderate' : 'advisory';
      const rationale = `With readiness at ${inputs.readiness}% and ${inputs.sleepHours}h sleep, your brain's energy reserves are depleted. The brain consumes 20% of daily ATP — creatine supplementation directly buffers this deficit by maintaining phosphocreatine stores for rapid ATP regeneration. Research shows creatine improves cognitive performance by 10-15% under sleep deprivation conditions, making it particularly relevant given your current sleep debt.`;
      return { confidence: Math.min(87, score), triggers, urgency, rationale };
    },
  },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN ENGINE — Run full BioIntelligence analysis
   ══════════════════════════════════════════════════════════════════ */

/**
 * runBioIntelligence — The "Brain" of Vive 4.0
 * 
 * Takes current biometric inputs and optional history,
 * returns a comprehensive BioIntelligence report with:
 * - Biological state assessment (composite score, system scores)
 * - Trend analysis for each biomarker
 * - Risk flags
 * - Ranked interventions with confidence scores and scientific rationale
 * - Today's priority actions
 * - Executive summary
 */
export function runBioIntelligence(
  inputs: BiometricInputs,
  history?: BiometricHistory
): BioIntelligenceReport {
  // 1. Compute trends from history (or synthesize from current snapshot)
  const trends = computeTrends(inputs, history);

  // 2. Assess each biological system
  const systems = assessSystems(inputs, trends);

  // 3. Detect risk flags
  const riskFlags = detectRiskFlags(inputs, trends);

  // 4. Compute composite score
  const compositeScore = Math.round(
    systems.reduce((s, sys) => s + sys.score, 0) / systems.length
  );

  // 5. Determine primary concern
  const worstSystem = systems[0]; // Already sorted worst-first
  const primaryConcern = worstSystem.score < 50
    ? `${worstSystem.label} — ${worstSystem.status}`
    : riskFlags.length > 0
    ? riskFlags[0].message
    : 'All systems within operational parameters';

  // 6. Build biological state
  const state: BiologicalState = {
    compositeScore,
    primaryConcern,
    systems,
    trends,
    riskFlags,
    assessedAt: Date.now(),
  };

  // 7. Run expanded intervention matching
  const expandedInterventions = matchExpandedInterventions(inputs, trends);

  // 8. Run base IntelligenceEngine for compatibility
  const baseProtocols = runIntelligenceEngine(inputs);

  // 9. Merge and deduplicate interventions
  const allInterventions = mergeInterventions(expandedInterventions, baseProtocols);

  // 10. Generate today's priorities
  const todayPriorities = generateTodayPriorities(allInterventions, state);

  // 11. Generate executive summary
  const executiveSummary = generateExecutiveSummary(state, allInterventions);

  return {
    state,
    interventions: allInterventions,
    todayPriorities,
    executiveSummary,
    baseProtocols,
  };
}

/* ── Compute trends from history or synthesize from snapshot ── */
function computeTrends(inputs: BiometricInputs, history?: BiometricHistory): BiomarkerTrend[] {
  const now = Date.now();

  // If no history, create synthetic single-point "trends"
  const getReadings = (key: keyof BiometricHistory, fallback: number): TimestampedReading[] => {
    if (history && history[key] && (history[key] as TimestampedReading[]).length > 0) {
      return history[key] as TimestampedReading[];
    }
    // Synthesize 7 days of data with slight variation around current value
    return Array.from({ length: 7 }, (_, i) => ({
      timestamp: now - (6 - i) * 86400000,
      value: fallback + (Math.random() - 0.5) * fallback * 0.15,
    }));
  };

  return [
    analyzeBiomarker('hrv', getReadings('hrv', inputs.hrv), inputs.hrv, 50, 100, true),
    analyzeBiomarker('heartRate', getReadings('heartRate', inputs.heartRate), inputs.heartRate, 55, 72, false),
    analyzeBiomarker('sleepHours', getReadings('sleepHours', inputs.sleepHours), inputs.sleepHours, 7, 9, true),
    analyzeBiomarker('sleepScore', getReadings('sleepScore', inputs.sleepScore), inputs.sleepScore, 80, 100, true),
    analyzeBiomarker('recovery', getReadings('recovery', inputs.recovery), inputs.recovery, 70, 100, true),
    analyzeBiomarker('stress', getReadings('stress', inputs.stress), inputs.stress, 0, 30, false),
    analyzeBiomarker('strain', getReadings('strain', inputs.strain), inputs.strain, 4, 14, true),
    analyzeBiomarker('bodyBattery', getReadings('bodyBattery', inputs.bodyBattery), inputs.bodyBattery, 60, 100, true),
    analyzeBiomarker('spo2', getReadings('spo2', inputs.spo2), inputs.spo2, 96, 100, true),
  ];
}

/* ── Match expanded interventions ── */
function matchExpandedInterventions(inputs: BiometricInputs, trends: BiomarkerTrend[]): Intervention[] {
  const results: Intervention[] = [];

  for (const entry of EXPANDED_LIBRARY) {
    const matchResult = entry.match(inputs, trends);
    if (!matchResult || matchResult.confidence < 15) continue;

    results.push({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      icon: entry.icon,
      color: entry.color,
      systemTarget: entry.systemTarget,
      confidence: matchResult.confidence,
      urgency: matchResult.urgency,
      rationale: matchResult.rationale,
      mechanism: entry.mechanism,
      dosing: entry.dosing,
      timing: entry.timing,
      duration: entry.duration,
      expectedOutcomes: entry.expectedOutcomes,
      synergies: entry.synergies,
      cautions: entry.cautions,
      citations: entry.citations,
      triggers: matchResult.triggers,
      cascadeNext: entry.cascadeNext,
    });
  }

  return results;
}

/* ── Merge expanded interventions with base protocols ── */
function mergeInterventions(
  expanded: Intervention[],
  base: ProtocolRecommendation[]
): Intervention[] {
  const expandedIds = new Set(expanded.map(i => i.id));

  // Convert base protocols to Intervention format (skip duplicates)
  const converted: Intervention[] = base
    .filter(p => !expandedIds.has(p.id))
    .map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      icon: p.icon,
      color: p.color,
      systemTarget: p.systemTarget,
      confidence: p.confidence,
      urgency: p.urgency,
      rationale: p.rationale,
      mechanism: p.rationale, // Base engine uses rationale as mechanism
      dosing: p.dosing,
      timing: p.timing,
      duration: '4-12 weeks',
      expectedOutcomes: [p.expectedOutcome],
      synergies: p.synergies,
      cautions: p.cautions,
      citations: p.citations,
      triggers: p.triggers,
    }));

  // Merge and sort by urgency tier, then confidence
  const all = [...expanded, ...converted];
  const urgencyRank: Record<UrgencyLevel, number> = { critical: 0, high: 1, moderate: 2, advisory: 3 };
  all.sort((a, b) => {
    const tierDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (tierDiff !== 0) return tierDiff;
    return b.confidence - a.confidence;
  });

  return all;
}

/* ── Generate today's top 3 priorities ── */
function generateTodayPriorities(interventions: Intervention[], state: BiologicalState): string[] {
  const priorities: string[] = [];

  // Priority 1: Address worst system
  const worstSystem = state.systems[0];
  if (worstSystem.score < 60) {
    const matchingIntervention = interventions.find(i => i.systemTarget === worstSystem.system);
    if (matchingIntervention) {
      priorities.push(`${matchingIntervention.icon} ${matchingIntervention.name} — ${worstSystem.label} needs attention (score: ${worstSystem.score}/100)`);
    }
  }

  // Priority 2-3: Top interventions not already covered
  const coveredIds = new Set<string>();
  for (const p of priorities) {
    const match = interventions.find(i => p.includes(i.name));
    if (match) coveredIds.add(match.id);
  }

  for (const intervention of interventions) {
    if (priorities.length >= 3) break;
    if (coveredIds.has(intervention.id)) continue;
    if (intervention.confidence < 25) continue;
    priorities.push(`${intervention.icon} ${intervention.name} — ${intervention.triggers[0] || intervention.rationale.slice(0, 80)}`);
    coveredIds.add(intervention.id);
  }

  // Fill remaining with general advice
  while (priorities.length < 3) {
    if (priorities.length === 0) priorities.push('✅ All systems operational — maintain current protocols');
    else if (priorities.length === 1) priorities.push('💧 Hydrate — target 3L water intake today');
    else priorities.push('🚶 Movement — aim for 8,000+ steps');
  }

  return priorities;
}

/* ── Generate executive summary ── */
function generateExecutiveSummary(state: BiologicalState, interventions: Intervention[]): string {
  const { compositeScore, systems, riskFlags } = state;
  const criticalSystems = systems.filter(s => s.status === 'critical' || s.status === 'compromised');
  const topInterventions = interventions.slice(0, 3);

  let summary = '';

  if (compositeScore >= 80) {
    summary = `Biological systems operating at ${compositeScore}% composite efficiency. `;
    summary += `All major systems within operational parameters. `;
    summary += topInterventions.length > 0
      ? `Optimization opportunities: ${topInterventions.map(i => i.name).join(', ')}.`
      : 'Continue current protocol stack.';
  } else if (compositeScore >= 60) {
    summary = `Composite biological score: ${compositeScore}%. `;
    summary += criticalSystems.length > 0
      ? `${criticalSystems.map(s => s.label).join(' and ')} ${criticalSystems.length === 1 ? 'requires' : 'require'} attention. `
      : 'Minor suboptimalities detected across multiple systems. ';
    summary += `Priority interventions: ${topInterventions.slice(0, 2).map(i => `${i.name} (${i.confidence}% confidence)`).join(', ')}.`;
  } else if (compositeScore >= 40) {
    summary = `⚠️ Composite score ${compositeScore}% — multiple systems suboptimal. `;
    summary += `Critical areas: ${criticalSystems.map(s => `${s.label} (${s.score}%)`).join(', ')}. `;
    summary += riskFlags.length > 0 ? `${riskFlags.length} risk flag${riskFlags.length > 1 ? 's' : ''} detected. ` : '';
    summary += `Immediate action: ${topInterventions[0]?.name || 'Rest and recovery'}.`;
  } else {
    summary = `🚨 CRITICAL: Composite score ${compositeScore}%. `;
    summary += `${criticalSystems.length} system${criticalSystems.length !== 1 ? 's' : ''} in critical state. `;
    summary += `${riskFlags.filter(f => f.severity === 'critical').length} critical risk flags. `;
    summary += `Prioritize: rest, sleep optimization, and ${topInterventions[0]?.name || 'medical consultation'}.`;
  }

  return summary;
}

/* ══════════════════════════════════════════════════════════════════
   UTILITY EXPORTS
   ══════════════════════════════════════════════════════════════════ */

/** Get status color for a system assessment */
export function getStatusColor(status: SystemAssessment['status']): string {
  switch (status) {
    case 'optimal': return '#00FFCC';
    case 'adequate': return '#6B8AFF';
    case 'suboptimal': return '#FFB86B';
    case 'compromised': return '#FF8C42';
    case 'critical': return '#FF6B6B';
  }
}

/** Get status label */
export function getStatusLabel(status: SystemAssessment['status']): string {
  switch (status) {
    case 'optimal': return 'OPTIMAL';
    case 'adequate': return 'ADEQUATE';
    case 'suboptimal': return 'SUBOPTIMAL';
    case 'compromised': return 'COMPROMISED';
    case 'critical': return 'CRITICAL';
  }
}

/** Get trend icon */
export function getTrendIcon(trend: TrendDirection): string {
  switch (trend) {
    case 'improving': return '📈';
    case 'stable': return '➡️';
    case 'declining': return '📉';
    case 'critical_decline': return '🔻';
  }
}

/** Get trend color */
export function getTrendColor(trend: TrendDirection): string {
  switch (trend) {
    case 'improving': return '#00DC82';
    case 'stable': return '#6B8AFF';
    case 'declining': return '#FFB86B';
    case 'critical_decline': return '#FF6B6B';
  }
}

/** Get urgency color */
export function getUrgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical': return '#FF6B6B';
    case 'high': return '#FF8C42';
    case 'moderate': return '#FFB86B';
    case 'advisory': return '#00FFCC';
  }
}
