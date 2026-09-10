/* ══════════════════════════════════════════════════════════════════
   CORRELATION ENGINE — Lab Results → Protocol Mapping
   
   Maps labResults biomarkers to specific protocols. When a marker
   is out of range, the engine "pins" the most relevant protocol
   to the top of the stack and tags it with a "Linked to Lab" icon.
   
   This is the Digital Twin's quiet logic — it doesn't warn or
   alarm. It simply surfaces the right action at the right time.
   ══════════════════════════════════════════════════════════════════ */

/* ── Types ── */

export interface LabResult {
  marker: string;
  value: number;
  unit: string;
  testedAt: number;
}

export interface LabCorrelation {
  marker: string;
  markerLabel: string;
  value: number;
  unit: string;
  idealMin: number;
  idealMax: number;
  status: 'low' | 'high' | 'optimal';
  /** Which protocol keywords this marker links to */
  linkedProtocolKeywords: string[];
  /** The specific protocol to pin (display name match) */
  pinnedProtocolName: string;
  /** Why the Twin is suggesting this — quiet, encouraging */
  twinRationale: string;
  /** Accent color for the "Linked to Lab" badge */
  color: string;
  /** Icon for the badge */
  icon: string;
}

export interface CorrelationResult {
  /** Protocols that should be pinned to the top (by name keyword match) */
  pinnedProtocols: Map<string, LabCorrelation>;
  /** All active correlations */
  correlations: LabCorrelation[];
  /** Whether any lab-driven pins are active */
  hasActiveCorrelations: boolean;
}

/* ── Marker → Protocol Mapping Table ──
   Each entry defines:
   - idealMin/idealMax: the optimal range
   - lowAction: what to pin when the marker is LOW
   - highAction: what to pin when the marker is HIGH
   ══════════════════════════════════════════════════════════════ */

interface MarkerConfig {
  label: string;
  unit: string;
  idealMin: number;
  idealMax: number;
  lowAction?: {
    keywords: string[];
    pinnedName: string;
    rationale: string;
    color: string;
    icon: string;
  };
  highAction?: {
    keywords: string[];
    pinnedName: string;
    rationale: string;
    color: string;
    icon: string;
  };
}

const MARKER_MAP: Record<string, MarkerConfig> = {
  /* ── Vitamin D ── */
  'Vitamin D': {
    label: 'Vitamin D',
    unit: 'ng/mL',
    idealMin: 50,
    idealMax: 80,
    lowAction: {
      keywords: ['vitamin d', 'sunlight', 'sun', 'd3', 'morning sun'],
      pinnedName: 'Vitamin D3 10,000 IU',
      rationale: 'Your Vitamin D is below optimal. Your Twin has pinned a targeted supplementation protocol to restore levels efficiently.',
      color: '#FFB86B',
      icon: '☀️',
    },
  },
  'vitamin_d': {
    label: 'Vitamin D',
    unit: 'ng/mL',
    idealMin: 50,
    idealMax: 80,
    lowAction: {
      keywords: ['vitamin d', 'sunlight', 'sun', 'd3', 'morning sun'],
      pinnedName: 'Vitamin D3 10,000 IU',
      rationale: 'Your Vitamin D is below optimal. Your Twin has pinned a targeted supplementation protocol to restore levels efficiently.',
      color: '#FFB86B',
      icon: '☀️',
    },
  },

  /* ── Testosterone (Total) ── */
  'Testosterone': {
    label: 'Testosterone',
    unit: 'ng/dL',
    idealMin: 500,
    idealMax: 1000,
    lowAction: {
      keywords: ['strength', 'resistance', 'deadlift', 'squat', 'testosterone', 'zinc', 'training'],
      pinnedName: 'Strength Session',
      rationale: 'Your testosterone levels suggest room for optimization. Compound resistance training is the most effective natural lever.',
      color: '#3B82F6',
      icon: '💪',
    },
  },
  'testosterone_total': {
    label: 'Total Testosterone',
    unit: 'ng/dL',
    idealMin: 500,
    idealMax: 1000,
    lowAction: {
      keywords: ['strength', 'resistance', 'deadlift', 'squat', 'testosterone', 'zinc', 'training'],
      pinnedName: 'Strength Session',
      rationale: 'Your testosterone levels suggest room for optimization. Compound resistance training is the most effective natural lever.',
      color: '#3B82F6',
      icon: '💪',
    },
  },

  /* ── Testosterone (Free) ── */
  'testosterone_free': {
    label: 'Free Testosterone',
    unit: 'pg/mL',
    idealMin: 15,
    idealMax: 30,
    lowAction: {
      keywords: ['zinc', 'magnesium', 'strength', 'sleep', 'cold'],
      pinnedName: 'Zinc + Magnesium Stack',
      rationale: 'Free testosterone is below your ideal baseline. Zinc and magnesium support bioavailability by modulating SHBG.',
      color: '#6B8AFF',
      icon: '⚡',
    },
  },

  /* ── ApoB ── */
  'ApoB': {
    label: 'ApoB',
    unit: 'mg/dL',
    idealMin: 0,
    idealMax: 80,
    highAction: {
      keywords: ['omega', 'fish oil', 'epa', 'dha', 'zone 2', 'cardio', 'walk'],
      pinnedName: 'Omega-3 EPA/DHA Protocol',
      rationale: 'Your ApoB is above the longevity threshold. Omega-3 fatty acids and Zone 2 cardio are your most effective levers.',
      color: '#FF6B6B',
      icon: '🫀',
    },
  },
  'apob': {
    label: 'ApoB',
    unit: 'mg/dL',
    idealMin: 0,
    idealMax: 80,
    highAction: {
      keywords: ['omega', 'fish oil', 'epa', 'dha', 'zone 2', 'cardio', 'walk'],
      pinnedName: 'Omega-3 EPA/DHA Protocol',
      rationale: 'Your ApoB is above the longevity threshold. Omega-3 fatty acids and Zone 2 cardio are your most effective levers.',
      color: '#FF6B6B',
      icon: '🫀',
    },
  },

  /* ── HbA1c ── */
  'HbA1c': {
    label: 'HbA1c',
    unit: '%',
    idealMin: 0,
    idealMax: 5.4,
    highAction: {
      keywords: ['walk', 'movement', 'fasting', 'zone 2', 'glucose', 'post-meal'],
      pinnedName: 'Post-Meal Walk Protocol',
      rationale: 'Your HbA1c suggests glucose management can improve. Post-meal walking blunts glucose spikes by 30-50%.',
      color: '#E8976C',
      icon: '🚶',
    },
  },
  'hba1c': {
    label: 'HbA1c',
    unit: '%',
    idealMin: 0,
    idealMax: 5.4,
    highAction: {
      keywords: ['walk', 'movement', 'fasting', 'zone 2', 'glucose', 'post-meal'],
      pinnedName: 'Post-Meal Walk Protocol',
      rationale: 'Your HbA1c suggests glucose management can improve. Post-meal walking blunts glucose spikes by 30-50%.',
      color: '#E8976C',
      icon: '🚶',
    },
  },

  /* ── hs-CRP (Inflammation) ── */
  'hs-CRP': {
    label: 'hs-CRP',
    unit: 'mg/L',
    idealMin: 0,
    idealMax: 1.0,
    highAction: {
      keywords: ['omega', 'fish oil', 'cold', 'sleep', 'magnesium', 'anti-inflam'],
      pinnedName: 'Anti-Inflammatory Stack',
      rationale: 'Your inflammation marker is elevated. Omega-3s and cold exposure activate anti-inflammatory pathways.',
      color: '#AF82FF',
      icon: '🧊',
    },
  },
  'crp': {
    label: 'hs-CRP',
    unit: 'mg/L',
    idealMin: 0,
    idealMax: 1.0,
    highAction: {
      keywords: ['omega', 'fish oil', 'cold', 'sleep', 'magnesium', 'anti-inflam'],
      pinnedName: 'Anti-Inflammatory Stack',
      rationale: 'Your inflammation marker is elevated. Omega-3s and cold exposure activate anti-inflammatory pathways.',
      color: '#AF82FF',
      icon: '🧊',
    },
  },

  /* ── Ferritin ── */
  'Ferritin': {
    label: 'Ferritin',
    unit: 'ng/mL',
    idealMin: 40,
    idealMax: 200,
    lowAction: {
      keywords: ['iron', 'ferritin', 'bisglycinate'],
      pinnedName: 'Iron Bisglycinate Protocol',
      rationale: 'Your ferritin stores are below optimal. Iron bisglycinate with Vitamin C maximizes absorption.',
      color: '#DC6868',
      icon: '🩸',
    },
  },
  'ferritin': {
    label: 'Ferritin',
    unit: 'ng/mL',
    idealMin: 40,
    idealMax: 200,
    lowAction: {
      keywords: ['iron', 'ferritin', 'bisglycinate'],
      pinnedName: 'Iron Bisglycinate Protocol',
      rationale: 'Your ferritin stores are below optimal. Iron bisglycinate with Vitamin C maximizes absorption.',
      color: '#DC6868',
      icon: '🩸',
    },
  },

  /* ── Fasting Glucose ── */
  'Fasting Glucose': {
    label: 'Fasting Glucose',
    unit: 'mg/dL',
    idealMin: 70,
    idealMax: 90,
    highAction: {
      keywords: ['walk', 'fasting', 'berberine', 'glucose', 'zone 2'],
      pinnedName: 'Glucose Optimization Protocol',
      rationale: 'Your fasting glucose is above the longevity-optimal range. Time-restricted eating and post-meal walks are your best tools.',
      color: '#E8976C',
      icon: '📊',
    },
  },

  /* ── Homocysteine ── */
  'Homocysteine': {
    label: 'Homocysteine',
    unit: 'µmol/L',
    idealMin: 0,
    idealMax: 8,
    highAction: {
      keywords: ['methylfolate', 'b12', 'b-complex', 'methyl'],
      pinnedName: 'Methylation Support Stack',
      rationale: 'Elevated homocysteine suggests methylation support would benefit you. Methylfolate and B12 are the primary levers.',
      color: '#00DC82',
      icon: '🧬',
    },
  },
};

/* ══════════════════════════════════════════════════════════════════
   CORE ENGINE — Analyze lab results and produce correlations
   ══════════════════════════════════════════════════════════════════ */

export function analyzeLabCorrelations(labResults: LabResult[]): CorrelationResult {
  const correlations: LabCorrelation[] = [];
  const pinnedProtocols = new Map<string, LabCorrelation>();

  // Get the most recent result for each marker
  const latestByMarker = new Map<string, LabResult>();
  for (const lr of labResults) {
    const existing = latestByMarker.get(lr.marker);
    if (!existing || lr.testedAt > existing.testedAt) {
      latestByMarker.set(lr.marker, lr);
    }
  }

  for (const [marker, result] of latestByMarker) {
    const config = MARKER_MAP[marker];
    if (!config) continue;

    const { value } = result;
    let status: 'low' | 'high' | 'optimal' = 'optimal';
    let action: MarkerConfig['lowAction'] | undefined;

    if (value < config.idealMin) {
      status = 'low';
      action = config.lowAction;
    } else if (value > config.idealMax && config.highAction) {
      status = 'high';
      action = config.highAction;
    }

    if (status !== 'optimal' && action) {
      const correlation: LabCorrelation = {
        marker,
        markerLabel: config.label,
        value,
        unit: config.unit,
        idealMin: config.idealMin,
        idealMax: config.idealMax,
        status,
        linkedProtocolKeywords: action.keywords,
        pinnedProtocolName: action.pinnedName,
        twinRationale: action.rationale,
        color: action.color,
        icon: action.icon,
      };

      correlations.push(correlation);

      // Register all keywords for protocol matching
      for (const kw of action.keywords) {
        pinnedProtocols.set(kw, correlation);
      }
    }
  }

  return {
    pinnedProtocols,
    correlations,
    hasActiveCorrelations: correlations.length > 0,
  };
}

/* ── Protocol Matching Helper ──
   Given a protocol name + category, check if it matches any
   active lab correlation. Returns the correlation if found. */

export function matchProtocolToLab(
  protocolName: string,
  protocolCategory: string,
  correlationResult: CorrelationResult,
): LabCorrelation | null {
  if (!correlationResult.hasActiveCorrelations) return null;

  const lower = protocolName.toLowerCase();
  const catLower = protocolCategory.toLowerCase();

  for (const [keyword, correlation] of correlationResult.pinnedProtocols) {
    if (lower.includes(keyword) || catLower.includes(keyword)) {
      return correlation;
    }
  }
  return null;
}

/* ── Sort Priority Helper ──
   Returns a numeric priority for sorting. Lower = higher priority.
   Lab-pinned protocols get priority 0 (highest). */

export function getLabPinPriority(
  protocolName: string,
  protocolCategory: string,
  correlationResult: CorrelationResult,
): number {
  const match = matchProtocolToLab(protocolName, protocolCategory, correlationResult);
  return match ? 0 : 100;
}
