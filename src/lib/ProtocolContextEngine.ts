/* ══════════════════════════════════════════════════════════════════════
   PROTOCOL CONTEXT ENGINE — Biomarker ↔ Protocol Mapping Intelligence
   
   Maps real-time biomarker trends from BioIntelligence to specific
   protocols in the user's stack. When the AI Brain detects a signal
   (e.g., low HRV, high glucose, declining sleep), this engine:
   
   1. Identifies which protocols directly address that signal
   2. Computes a "proactive urgency" score for each protocol
   3. Generates contextual micro-briefs explaining WHY a protocol matters NOW
   4. Returns highlight states for the UI to render with Proximity Glow
   
   This is the bridge between the AI Brain's analysis and the
   ProtocolStack's visual presentation layer.
   ══════════════════════════════════════════════════════════════════════ */

import type {
  BiologicalState,
  BiomarkerTrend,
  Intervention,
  BioIntelligenceReport,
  SystemAssessment,
  RiskFlag,
} from './BioIntelligence';
import type { BiometricInputs } from './IntelligenceEngine';

/* ── Types ── */

export type ProactiveUrgency = 'critical' | 'elevated' | 'suggested' | 'neutral';

export interface ProtocolHighlight {
  /** Protocol name (matched against user's protocol stack) */
  protocolNamePattern: string;
  /** Category match (supplement, training, biohacking, etc.) */
  categoryMatch: string;
  /** Proactive urgency level — drives glow intensity */
  urgency: ProactiveUrgency;
  /** Color for the proximity glow */
  glowColor: string;
  /** Short contextual reason (1 line) */
  reason: string;
  /** Detailed scientific brief (2-3 sentences) */
  brief: string;
  /** Which biomarker triggered this highlight */
  triggerMarker: string;
  /** Current value of the triggering biomarker */
  triggerValue: string;
  /** Optimal range for context */
  optimalRange: string;
  /** Confidence 0-100 that this protocol addresses the signal */
  confidence: number;
  /** Linked intervention from BioIntelligence (if any) */
  linkedIntervention?: Intervention;
  /** Icon for the trigger signal */
  triggerIcon: string;
}

export interface ProtocolContextState {
  /** All active highlights mapped by protocol category */
  highlights: ProtocolHighlight[];
  /** Number of protocols that need attention */
  urgentCount: number;
  /** Overall proactive status message */
  statusMessage: string;
  /** Whether the system is in "proactive mode" (has active highlights) */
  isProactive: boolean;
  /** Top priority action */
  topPriority: ProtocolHighlight | null;
}

/* ── Biomarker → Protocol Category Mapping ── */

interface BiomarkerRule {
  marker: string;
  /** Check function — returns urgency + reason if triggered */
  check: (inputs: BiometricInputs, trends: BiomarkerTrend[]) => {
    urgency: ProactiveUrgency;
    reason: string;
    brief: string;
    value: string;
    optimal: string;
    icon: string;
  } | null;
  /** Which protocol categories this biomarker maps to */
  categories: string[];
  /** Protocol name patterns to match (partial, case-insensitive) */
  namePatterns: string[];
  /** Glow color when triggered */
  glowColor: string;
}

const BIOMARKER_RULES: BiomarkerRule[] = [
  /* ── HRV — Autonomic Nervous System ── */
  {
    marker: 'HRV',
    check: (inputs, trends) => {
      const hrvTrend = trends.find(t => t.marker === 'hrv');
      if (inputs.hrv < 35) {
        return {
          urgency: 'critical',
          reason: `HRV critically low at ${Math.round(inputs.hrv)}ms — vagal tone suppressed`,
          brief: `Your HRV at ${Math.round(inputs.hrv)}ms indicates severe autonomic suppression. The parasympathetic nervous system is unable to maintain recovery. Breathwork and cold exposure directly stimulate the vagus nerve, restoring autonomic balance within 24-48 hours.`,
          value: `${Math.round(inputs.hrv)}ms`,
          optimal: '50-100ms',
          icon: '💓',
        };
      }
      if (inputs.hrv < 45 || (hrvTrend && hrvTrend.trend === 'declining')) {
        return {
          urgency: 'elevated',
          reason: `HRV at ${Math.round(inputs.hrv)}ms${hrvTrend?.trend === 'declining' ? ' and declining' : ''} — recovery compromised`,
          brief: `HRV at ${Math.round(inputs.hrv)}ms signals suboptimal parasympathetic tone. ${hrvTrend?.trend === 'declining' ? 'The downward trend suggests accumulating stress load.' : ''} Cold exposure triggers norepinephrine release (2-3x baseline), while breathwork activates the vagal brake. Both protocols directly address this signal.`,
          value: `${Math.round(inputs.hrv)}ms`,
          optimal: '50-100ms',
          icon: '💓',
        };
      }
      return null;
    },
    categories: ['biohacking', 'recovery'],
    namePatterns: ['cold', 'breath', 'plunge', 'sauna', 'meditation', 'nsdr'],
    glowColor: '#AF82FF',
  },

  /* ── Sleep Architecture ── */
  {
    marker: 'Sleep',
    check: (inputs, trends) => {
      const sleepTrend = trends.find(t => t.marker === 'sleepScore');
      if (inputs.sleepHours < 6 || inputs.sleepScore < 55) {
        return {
          urgency: 'critical',
          reason: `Sleep critically impaired — ${inputs.sleepHours.toFixed(1)}h with score ${Math.round(inputs.sleepScore)}`,
          brief: `Sleep at ${inputs.sleepHours.toFixed(1)}h with quality score ${Math.round(inputs.sleepScore)} indicates severely compromised recovery architecture. Deep sleep (${inputs.sleepDeepPct}%) drives GH secretion and glymphatic clearance. Magnesium glycinate enhances GABA-A receptor activity, while strict sleep hygiene restores circadian alignment.`,
          value: `${inputs.sleepHours.toFixed(1)}h / ${Math.round(inputs.sleepScore)}`,
          optimal: '7-9h / 80+',
          icon: '🌙',
        };
      }
      if (inputs.sleepHours < 7 || inputs.sleepScore < 70 || inputs.sleepDeepPct < 14) {
        return {
          urgency: 'elevated',
          reason: `Sleep suboptimal — ${inputs.sleepDeepPct}% deep sleep${sleepTrend?.trend === 'declining' ? ', declining trend' : ''}`,
          brief: `Deep sleep at ${inputs.sleepDeepPct}% (target: 15-25%) is limiting overnight recovery. ${inputs.sleepRemPct < 20 ? `REM at ${inputs.sleepRemPct}% is also below threshold for memory consolidation.` : ''} Evening magnesium and consistent sleep timing are the highest-leverage interventions.`,
          value: `${inputs.sleepDeepPct}% deep`,
          optimal: '15-25% deep',
          icon: '🌙',
        };
      }
      return null;
    },
    categories: ['recovery', 'supplement'],
    namePatterns: ['sleep', 'magnesium', 'melatonin', 'apigenin', 'bed', 'screen'],
    glowColor: '#6B8AFF',
  },

  /* ── Heart Rate — Cardiovascular ── */
  {
    marker: 'Resting HR',
    check: (inputs) => {
      if (inputs.heartRate > 78) {
        return {
          urgency: 'elevated',
          reason: `Resting HR elevated at ${Math.round(inputs.heartRate)}bpm — cardiac efficiency suboptimal`,
          brief: `Resting heart rate at ${Math.round(inputs.heartRate)}bpm is above the optimal athletic range (55-68bpm). Zone 2 cardio is the single most effective intervention for improving cardiac stroke volume and lowering resting HR. Target 45-60 minutes at 60-70% max HR.`,
          value: `${Math.round(inputs.heartRate)}bpm`,
          optimal: '55-68bpm',
          icon: '❤️',
        };
      }
      return null;
    },
    categories: ['training'],
    namePatterns: ['zone 2', 'cardio', 'run', 'walk', 'cycling'],
    glowColor: '#FF6B6B',
  },

  /* ── Stress — HPA Axis ── */
  {
    marker: 'Stress',
    check: (inputs, trends) => {
      const stressTrend = trends.find(t => t.marker === 'stress');
      if (inputs.stress > 65) {
        return {
          urgency: 'critical',
          reason: `Stress index at ${Math.round(inputs.stress)} — HPA axis dysregulated`,
          brief: `Stress at ${Math.round(inputs.stress)}/100 indicates chronic HPA axis activation. Elevated cortisol suppresses immune function, impairs sleep onset, and drives visceral fat accumulation. Cold exposure, breathwork, and adaptogenic supplements (ashwagandha) directly modulate the cortisol response.`,
          value: `${Math.round(inputs.stress)}/100`,
          optimal: '<30',
          icon: '🧠',
        };
      }
      if (inputs.stress > 45) {
        return {
          urgency: 'elevated',
          reason: `Stress moderately elevated at ${Math.round(inputs.stress)}`,
          brief: `Stress index at ${Math.round(inputs.stress)} suggests sympathetic nervous system dominance. ${stressTrend?.trend === 'declining' ? 'Trend is improving — current protocols are working.' : 'Consider adding parasympathetic activation protocols.'} Morning sunlight and cold exposure help reset the cortisol curve.`,
          value: `${Math.round(inputs.stress)}/100`,
          optimal: '<30',
          icon: '🧠',
        };
      }
      return null;
    },
    categories: ['biohacking', 'recovery', 'supplement'],
    namePatterns: ['cold', 'breath', 'meditation', 'ashwagandha', 'sunlight', 'sauna', 'yoga'],
    glowColor: '#E8976C',
  },

  /* ── Recovery — Systemic Readiness ── */
  {
    marker: 'Recovery',
    check: (inputs) => {
      if (inputs.recovery < 40) {
        return {
          urgency: 'critical',
          reason: `Recovery critically low at ${Math.round(inputs.recovery)}% — rest priority`,
          brief: `Recovery at ${Math.round(inputs.recovery)}% means your body cannot adequately repair tissue, consolidate training adaptations, or maintain immune surveillance. Skip high-intensity training today. Focus on sleep, nutrition (protein target), and gentle movement only.`,
          value: `${Math.round(inputs.recovery)}%`,
          optimal: '70-100%',
          icon: '⚡',
        };
      }
      if (inputs.recovery < 60) {
        return {
          urgency: 'elevated',
          reason: `Recovery at ${Math.round(inputs.recovery)}% — moderate training only`,
          brief: `Recovery at ${Math.round(inputs.recovery)}% suggests incomplete restoration from recent strain. Prioritize Zone 2 cardio over high-intensity work. Ensure protein intake hits 1g/lb target and supplement stack is complete to support repair pathways.`,
          value: `${Math.round(inputs.recovery)}%`,
          optimal: '70-100%',
          icon: '⚡',
        };
      }
      return null;
    },
    categories: ['recovery', 'nutrition', 'supplement'],
    namePatterns: ['sleep', 'protein', 'hydration', 'creatine', 'omega', 'magnesium'],
    glowColor: '#00FFCC',
  },

  /* ── Body Battery — Energy Reserves ── */
  {
    marker: 'Body Battery',
    check: (inputs) => {
      if (inputs.bodyBattery < 25) {
        return {
          urgency: 'critical',
          reason: `Body battery depleted at ${Math.round(inputs.bodyBattery)}% — energy crisis`,
          brief: `Body battery at ${Math.round(inputs.bodyBattery)}% indicates cellular energy production is failing to meet demand. NAD+ precursors (NMN) and CoQ10 directly support mitochondrial electron transport chain efficiency. Prioritize rest and complete your supplement stack.`,
          value: `${Math.round(inputs.bodyBattery)}%`,
          optimal: '60-100%',
          icon: '🔋',
        };
      }
      if (inputs.bodyBattery < 45) {
        return {
          urgency: 'elevated',
          reason: `Body battery low at ${Math.round(inputs.bodyBattery)}% — energy suboptimal`,
          brief: `Energy reserves at ${Math.round(inputs.bodyBattery)}% suggest mitochondrial output is below demand. Creatine monohydrate provides immediate phosphocreatine buffering for both muscle and brain. Ensure hydration and electrolyte protocols are complete.`,
          value: `${Math.round(inputs.bodyBattery)}%`,
          optimal: '60-100%',
          icon: '🔋',
        };
      }
      return null;
    },
    categories: ['supplement', 'nutrition'],
    namePatterns: ['creatine', 'nmn', 'nad', 'coq10', 'hydration', 'protein', 'electrolyte'],
    glowColor: '#00E5FF',
  },

  /* ── SpO2 — Oxygen Saturation ── */
  {
    marker: 'SpO2',
    check: (inputs) => {
      if (inputs.spo2 < 95) {
        return {
          urgency: 'critical',
          reason: `SpO2 at ${inputs.spo2.toFixed(1)}% — below safe threshold`,
          brief: `Blood oxygen at ${inputs.spo2.toFixed(1)}% is below the safe threshold of 95%. This impairs mitochondrial ATP production and cognitive function. Breathwork protocols (box breathing, Wim Hof) can acutely improve oxygenation. If persistent, consult a physician.`,
          value: `${inputs.spo2.toFixed(1)}%`,
          optimal: '96-100%',
          icon: '🫁',
        };
      }
      return null;
    },
    categories: ['biohacking', 'training'],
    namePatterns: ['breath', 'cardio', 'zone 2', 'walk'],
    glowColor: '#FF6B6B',
  },

  /* ── Strain vs Recovery Imbalance ── */
  {
    marker: 'Strain/Recovery',
    check: (inputs) => {
      if (inputs.strain > 14 && inputs.recovery < 55) {
        return {
          urgency: 'critical',
          reason: `Overtraining risk — strain ${inputs.strain.toFixed(1)}/21 with ${Math.round(inputs.recovery)}% recovery`,
          brief: `Your strain-to-recovery ratio is dangerously imbalanced. Strain at ${inputs.strain.toFixed(1)}/21 with only ${Math.round(inputs.recovery)}% recovery means tissue repair and adaptation are compromised. Shift to active recovery: gentle walking, stretching, and prioritize sleep and nutrition.`,
          value: `${inputs.strain.toFixed(1)} / ${Math.round(inputs.recovery)}%`,
          optimal: 'Strain < Recovery',
          icon: '⚠️',
        };
      }
      return null;
    },
    categories: ['recovery', 'nutrition'],
    namePatterns: ['sleep', 'protein', 'hydration', 'rest', 'yoga', 'stretch'],
    glowColor: '#FF8C42',
  },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN ENGINE — Compute protocol context from biometric state
   ══════════════════════════════════════════════════════════════════ */

export function computeProtocolContext(
  inputs: BiometricInputs,
  report: BioIntelligenceReport | null,
): ProtocolContextState {
  const trends = report?.state.trends ?? [];
  const interventions = report?.interventions ?? [];
  const highlights: ProtocolHighlight[] = [];

  for (const rule of BIOMARKER_RULES) {
    const result = rule.check(inputs, trends);
    if (!result) continue;

    // Find linked intervention from BioIntelligence
    const linked = interventions.find(i =>
      rule.namePatterns.some(p => i.name.toLowerCase().includes(p)) ||
      rule.categories.includes(i.category)
    );

    // Create a highlight for each matching category
    for (const cat of rule.categories) {
      for (const pattern of rule.namePatterns) {
        highlights.push({
          protocolNamePattern: pattern,
          categoryMatch: cat,
          urgency: result.urgency,
          glowColor: rule.glowColor,
          reason: result.reason,
          brief: result.brief,
          triggerMarker: rule.marker,
          triggerValue: result.value,
          optimalRange: result.optimal,
          confidence: linked?.confidence ?? 70,
          linkedIntervention: linked,
          triggerIcon: result.icon,
        });
      }
    }
  }

  // Deduplicate by pattern + category, keeping highest urgency
  const deduped = new Map<string, ProtocolHighlight>();
  for (const h of highlights) {
    const key = `${h.protocolNamePattern}::${h.categoryMatch}`;
    const existing = deduped.get(key);
    if (!existing || urgencyRank(h.urgency) < urgencyRank(existing.urgency)) {
      deduped.set(key, h);
    }
  }

  const finalHighlights = Array.from(deduped.values())
    .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency));

  const urgentCount = finalHighlights.filter(h => h.urgency === 'critical' || h.urgency === 'elevated').length;
  const topPriority = finalHighlights[0] ?? null;

  const statusMessage = urgentCount === 0
    ? 'All protocols on track — maintain current cadence'
    : urgentCount === 1
      ? `1 protocol needs attention: ${topPriority?.triggerMarker}`
      : `${urgentCount} protocols flagged — biomarkers driving proactive recommendations`;

  return {
    highlights: finalHighlights,
    urgentCount,
    statusMessage,
    isProactive: urgentCount > 0,
    topPriority,
  };
}

/** Match a protocol name/category against highlights */
export function getProtocolHighlight(
  protocolName: string,
  protocolCategory: string,
  highlights: ProtocolHighlight[],
): ProtocolHighlight | null {
  const nameLower = protocolName.toLowerCase();
  const catLower = protocolCategory.toLowerCase();

  // First try exact name pattern match within matching category
  for (const h of highlights) {
    if (
      nameLower.includes(h.protocolNamePattern) &&
      catLower === h.categoryMatch
    ) {
      return h;
    }
  }

  // Then try name pattern match across any category
  for (const h of highlights) {
    if (nameLower.includes(h.protocolNamePattern)) {
      return h;
    }
  }

  // Then try category-only match (weaker signal)
  for (const h of highlights) {
    if (catLower === h.categoryMatch && (h.urgency === 'critical' || h.urgency === 'elevated')) {
      return h;
    }
  }

  return null;
}

function urgencyRank(u: ProactiveUrgency): number {
  switch (u) {
    case 'critical': return 0;
    case 'elevated': return 1;
    case 'suggested': return 2;
    case 'neutral': return 3;
  }
}

/** Get glow animation intensity based on urgency */
export function getGlowIntensity(urgency: ProactiveUrgency): {
  pulseSpeed: string;
  glowOpacity: number;
  glowSpread: number;
  borderOpacity: number;
} {
  switch (urgency) {
    case 'critical':
      return { pulseSpeed: '1.5s', glowOpacity: 0.35, glowSpread: 16, borderOpacity: 0.4 };
    case 'elevated':
      return { pulseSpeed: '2.5s', glowOpacity: 0.2, glowSpread: 10, borderOpacity: 0.25 };
    case 'suggested':
      return { pulseSpeed: '4s', glowOpacity: 0.1, glowSpread: 6, borderOpacity: 0.12 };
    case 'neutral':
      return { pulseSpeed: '0s', glowOpacity: 0, glowSpread: 0, borderOpacity: 0.06 };
  }
}
