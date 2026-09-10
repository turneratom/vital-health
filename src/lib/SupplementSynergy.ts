/**
 * Vive 4.0 — Supplement Synergy Engine
 *
 * Cross-references the user's current blood lab biomarkers (from Bio-Vault)
 * with their logged Bio-Stack adherence. When a biomarker is out of range
 * but the prescribed protocol isn't being logged, surfaces a
 * "Precision-Adjustment" alert with a one-tap "Sync Dosage" action.
 *
 * PURE LOGIC — no Convex imports, no side effects.
 */

/* ── Types ── */

export interface BioVaultSnapshot {
  vitaminD?: number | null;
  testosteroneFree?: number | null;
  testosteroneTotal?: number | null;
  ferritin?: number | null;
  crp?: number | null;
  hba1c?: number | null;
  apoB?: number | null;
  ldlC?: number | null;
  hdlC?: number | null;
  triglycerides?: number | null;
  lpA?: number | null;
  homocysteine?: number | null;
  mthfrVariant?: boolean;
  apoe4?: boolean;
  caffeineSensitivity?: boolean;
}

export interface StackLogEntry {
  protocolId: string;
  protocolName: string;
  category: string;
  loggedAt: number;
  status?: string;
}

export type AlertSeverity = 'critical' | 'high' | 'moderate' | 'info';

export interface SynergyAlert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  title: string;
  subtitle: string;
  rationale: string;
  marker: string;
  markerValue: number | null;
  markerUnit: string;
  targetRange: string;
  prescribedProtocol: PrescribedProtocol;
  adherenceGap: number; // 0-100, 0 = never logged, 100 = fully adherent
  synergyCompounds: string[];
  color: string;
  category: 'lipid' | 'metabolic' | 'inflammation' | 'hormonal' | 'genetic' | 'vitamin';
}

export interface PrescribedProtocol {
  id: string;
  name: string;
  dose: string;
  timing: string;
  icon: string;
  gene?: string;
  mechanism: string;
}

export interface SynergyReport {
  alerts: SynergyAlert[];
  totalGaps: number;
  criticalGaps: number;
  overallAdherence: number; // 0-100
  generatedAt: number;
  biomarkersCovered: number;
  biomarkersTotal: number;
}

/* ── Biomarker → Protocol Mapping ── */

interface BiomarkerRule {
  key: keyof BioVaultSnapshot;
  label: string;
  unit: string;
  optimalRange: { low: number; high: number };
  warningThreshold: number; // value at which it becomes "high" severity
  criticalThreshold: number; // value at which it becomes "critical"
  direction: 'lower-is-better' | 'higher-is-better' | 'range';
  category: SynergyAlert['category'];
  color: string;
  protocols: PrescribedProtocol[];
  synergyCompounds: string[];
  geneticModifiers?: { gene: keyof BioVaultSnapshot; effect: string }[];
}

const BIOMARKER_RULES: BiomarkerRule[] = [
  /* ── ApoB (Cardiovascular) ── */
  {
    key: 'apoB',
    label: 'ApoB',
    unit: 'mg/dL',
    optimalRange: { low: 0, high: 80 },
    warningThreshold: 90,
    criticalThreshold: 120,
    direction: 'lower-is-better',
    category: 'lipid',
    color: '#EF4444',
    protocols: [
      {
        id: 'citrus-bergamot',
        name: 'Citrus Bergamot Extract',
        dose: '1,000mg',
        timing: 'AM · With breakfast',
        icon: '🍊',
        gene: 'PCSK9',
        mechanism: 'Inhibits HMG-CoA reductase and upregulates LDL receptor expression via PCSK9 modulation',
      },
      {
        id: 'omega3-epa-apob',
        name: 'Omega-3 (High EPA)',
        dose: '4,000mg',
        timing: 'AM · With food',
        icon: '🐟',
        gene: 'APOB / CETP',
        mechanism: 'Reduces VLDL particle production and ApoB-containing lipoprotein secretion',
      },
      {
        id: 'red-yeast-rice',
        name: 'Red Yeast Rice',
        dose: '1,200mg',
        timing: 'PM · With dinner',
        icon: '🔴',
        gene: 'HMGCR',
        mechanism: 'Natural monacolin K inhibits HMG-CoA reductase — statin-equivalent lipid reduction',
      },
    ],
    synergyCompounds: ['CoQ10 (200mg)', 'Niacin (500mg)', 'Plant Sterols (2g)', 'Berberine (500mg)'],
    geneticModifiers: [
      { gene: 'apoe4', effect: 'APOE4 carriers have impaired ApoB clearance — prioritize aggressive lipid management' },
    ],
  },

  /* ── LDL-C ── */
  {
    key: 'ldlC',
    label: 'LDL Cholesterol',
    unit: 'mg/dL',
    optimalRange: { low: 0, high: 100 },
    warningThreshold: 130,
    criticalThreshold: 160,
    direction: 'lower-is-better',
    category: 'lipid',
    color: '#F97316',
    protocols: [
      {
        id: 'plant-sterols',
        name: 'Plant Sterols + Stanols',
        dose: '2g',
        timing: 'With meals (split)',
        icon: '🌿',
        mechanism: 'Competes with cholesterol absorption in the intestinal lumen — reduces LDL 8-15%',
      },
      {
        id: 'psyllium-fiber',
        name: 'Psyllium Husk Fiber',
        dose: '10g',
        timing: 'Before meals',
        icon: '🌾',
        mechanism: 'Soluble fiber binds bile acids, forcing hepatic LDL receptor upregulation',
      },
    ],
    synergyCompounds: ['Citrus Bergamot', 'Omega-3 EPA', 'Niacin'],
  },

  /* ── CRP (Inflammation) ── */
  {
    key: 'crp',
    label: 'hs-CRP',
    unit: 'mg/L',
    optimalRange: { low: 0, high: 1.0 },
    warningThreshold: 2.0,
    criticalThreshold: 3.0,
    direction: 'lower-is-better',
    category: 'inflammation',
    color: '#F97316',
    protocols: [
      {
        id: 'omega3-epa-crp',
        name: 'Omega-3 (High EPA)',
        dose: '4,000mg',
        timing: 'AM · With food',
        icon: '🐟',
        gene: 'ALOX5',
        mechanism: 'EPA targets ALOX5 inflammatory cascade — resolvin and protectin synthesis',
      },
      {
        id: 'curcumin-crp',
        name: 'Curcumin + Piperine',
        dose: '1,000mg',
        timing: 'PM · With food',
        icon: '🌿',
        gene: 'NF-kB',
        mechanism: 'Modulates NF-kB transcription factor — reduces TNF-α, IL-6, and CRP production',
      },
    ],
    synergyCompounds: ['SPMs (Specialized Pro-resolving Mediators)', 'Boswellia (500mg)', 'Quercetin (500mg)'],
  },

  /* ── HbA1c (Metabolic) ── */
  {
    key: 'hba1c',
    label: 'HbA1c',
    unit: '%',
    optimalRange: { low: 4.0, high: 5.4 },
    warningThreshold: 5.7,
    criticalThreshold: 6.0,
    direction: 'lower-is-better',
    category: 'metabolic',
    color: '#F59E0B',
    protocols: [
      {
        id: 'berberine-hba1c',
        name: 'Berberine HCl',
        dose: '1,500mg (3×500mg)',
        timing: 'With meals (3× daily)',
        icon: '🌿',
        gene: 'TCF7L2 / AMPK',
        mechanism: 'Activates AMPK pathway via TCF7L2 — improves insulin sensitivity and glucose uptake',
      },
      {
        id: 'chromium-hba1c',
        name: 'Chromium Picolinate',
        dose: '200mcg',
        timing: 'With lunch',
        icon: '⚙️',
        mechanism: 'Enhances insulin receptor signaling and GLUT4 transporter expression',
      },
    ],
    synergyCompounds: ['Alpha-Lipoic Acid (600mg)', 'Cinnamon Extract (500mg)', 'Magnesium (400mg)'],
  },

  /* ── Vitamin D ── */
  {
    key: 'vitaminD',
    label: 'Vitamin D',
    unit: 'ng/mL',
    optimalRange: { low: 40, high: 80 },
    warningThreshold: 30,
    criticalThreshold: 20,
    direction: 'higher-is-better',
    category: 'vitamin',
    color: '#FBBF24',
    protocols: [
      {
        id: 'vitd3-k2-synergy',
        name: 'Vitamin D3 + K2 MK-7',
        dose: '5,000–10,000 IU',
        timing: 'AM · With fat-containing meal',
        icon: '☀️',
        gene: 'CYP2R1',
        mechanism: 'D3 hydroxylation via CYP2R1 — K2 directs calcium to bones, not arteries',
      },
    ],
    synergyCompounds: ['Magnesium (400mg)', 'Zinc (30mg)', 'Boron (3mg)'],
  },

  /* ── Ferritin ── */
  {
    key: 'ferritin',
    label: 'Ferritin',
    unit: 'ng/mL',
    optimalRange: { low: 40, high: 200 },
    warningThreshold: 30,
    criticalThreshold: 15,
    direction: 'higher-is-better',
    category: 'vitamin',
    color: '#3B82F6',
    protocols: [
      {
        id: 'iron-bisgly-synergy',
        name: 'Iron Bisglycinate + Vitamin C',
        dose: '18–36mg',
        timing: 'AM · Empty stomach',
        icon: '🩸',
        gene: 'SLC40A1',
        mechanism: 'Chelated iron via SLC40A1 ferroportin absorption — Vitamin C enhances non-heme uptake 3×',
      },
    ],
    synergyCompounds: ['Vitamin C (500mg)', 'Lactoferrin (250mg)'],
  },

  /* ── Testosterone ── */
  {
    key: 'testosteroneTotal',
    label: 'Testosterone (Total)',
    unit: 'ng/dL',
    optimalRange: { low: 500, high: 1000 },
    warningThreshold: 400,
    criticalThreshold: 300,
    direction: 'higher-is-better',
    category: 'hormonal',
    color: '#A855F7',
    protocols: [
      {
        id: 'tongkat-ali-synergy',
        name: 'Tongkat Ali (Eurycoma)',
        dose: '400mg',
        timing: 'AM · Empty stomach',
        icon: '💪',
        gene: 'AR / SHBG',
        mechanism: 'Modulates SHBG binding via androgen receptor — frees bioavailable testosterone',
      },
      {
        id: 'zinc-synergy',
        name: 'Zinc Picolinate',
        dose: '30mg',
        timing: 'PM · With dinner',
        icon: '🛡️',
        mechanism: 'Cofactor for testosterone synthesis — inhibits aromatase conversion to estradiol',
      },
    ],
    synergyCompounds: ['Ashwagandha KSM-66 (600mg)', 'Boron (10mg)', 'Vitamin D3 (5000 IU)'],
  },

  /* ── Homocysteine ── */
  {
    key: 'homocysteine',
    label: 'Homocysteine',
    unit: 'µmol/L',
    optimalRange: { low: 4, high: 8 },
    warningThreshold: 10,
    criticalThreshold: 15,
    direction: 'lower-is-better',
    category: 'metabolic',
    color: '#EC4899',
    protocols: [
      {
        id: 'methyl-b-synergy',
        name: 'Methylated B-Complex',
        dose: '1 capsule (5-MTHF + MeCbl)',
        timing: 'AM · With breakfast',
        icon: '🧬',
        gene: 'MTHFR C677T',
        mechanism: 'Bypasses impaired MTHFR enzyme — methylfolate + methylcobalamin clear homocysteine via remethylation',
      },
      {
        id: 'tmg-synergy',
        name: 'TMG (Trimethylglycine)',
        dose: '500mg',
        timing: 'AM · With food',
        icon: '🔬',
        mechanism: 'Alternative homocysteine remethylation pathway via betaine-homocysteine methyltransferase',
      },
    ],
    synergyCompounds: ['B6 (P-5-P, 50mg)', 'Riboflavin (25mg)', 'NAC (600mg)'],
    geneticModifiers: [
      { gene: 'mthfrVariant', effect: 'MTHFR variant impairs folate metabolism — methylated B-complex is critical, not optional' },
    ],
  },

  /* ── Triglycerides ── */
  {
    key: 'triglycerides',
    label: 'Triglycerides',
    unit: 'mg/dL',
    optimalRange: { low: 0, high: 100 },
    warningThreshold: 150,
    criticalThreshold: 200,
    direction: 'lower-is-better',
    category: 'lipid',
    color: '#F43F5E',
    protocols: [
      {
        id: 'omega3-trig',
        name: 'Omega-3 (EPA + DHA)',
        dose: '4,000mg',
        timing: 'AM · With food',
        icon: '🐟',
        gene: 'FADS1',
        mechanism: 'Reduces hepatic VLDL-triglyceride synthesis via FADS1 fatty acid desaturase pathway',
      },
    ],
    synergyCompounds: ['Berberine (500mg)', 'Niacin (500mg)', 'Fiber (10g psyllium)'],
  },
];

/* ── Helpers ── */

function isOutOfRange(
  value: number,
  rule: BiomarkerRule,
): boolean {
  if (rule.direction === 'lower-is-better') return value > rule.optimalRange.high;
  if (rule.direction === 'higher-is-better') return value < rule.optimalRange.low;
  return value < rule.optimalRange.low || value > rule.optimalRange.high;
}

function getSeverity(
  value: number,
  rule: BiomarkerRule,
): AlertSeverity {
  if (rule.direction === 'lower-is-better') {
    if (value >= rule.criticalThreshold) return 'critical';
    if (value >= rule.warningThreshold) return 'high';
    if (value > rule.optimalRange.high) return 'moderate';
    return 'info';
  }
  if (rule.direction === 'higher-is-better') {
    if (value <= rule.criticalThreshold) return 'critical';
    if (value <= rule.warningThreshold) return 'high';
    if (value < rule.optimalRange.low) return 'moderate';
    return 'info';
  }
  // range
  const distLow = rule.optimalRange.low - value;
  const distHigh = value - rule.optimalRange.high;
  const dist = Math.max(distLow, distHigh);
  if (dist <= 0) return 'info';
  const range = rule.optimalRange.high - rule.optimalRange.low;
  const pct = dist / (range || 1);
  if (pct > 0.5) return 'critical';
  if (pct > 0.25) return 'high';
  return 'moderate';
}

function computeAdherenceGap(
  protocolIds: string[],
  logs: StackLogEntry[],
  lookbackDays: number = 7,
): number {
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter(l => l.loggedAt >= cutoff);

  if (protocolIds.length === 0) return 0;

  // For each protocol, check if it was logged at least once per day in lookback
  let totalExpected = 0;
  let totalLogged = 0;

  for (const pid of protocolIds) {
    totalExpected += lookbackDays;
    // Count unique days this protocol was logged
    const daysLogged = new Set(
      recentLogs
        .filter(l => l.protocolId === pid || l.protocolName.toLowerCase().includes(pid.replace(/-/g, ' ')))
        .map(l => new Date(l.loggedAt).toISOString().slice(0, 10))
    );
    totalLogged += daysLogged.size;
  }

  if (totalExpected === 0) return 0;
  return Math.round((totalLogged / totalExpected) * 100);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN ENGINE: runSupplementSynergy
   ══════════════════════════════════════════════════════════════════ */

export function runSupplementSynergy(
  vault: BioVaultSnapshot | null,
  stackLogs: StackLogEntry[],
  lookbackDays: number = 7,
): SynergyReport {
  if (!vault) {
    return {
      alerts: [],
      totalGaps: 0,
      criticalGaps: 0,
      overallAdherence: 0,
      generatedAt: Date.now(),
      biomarkersCovered: 0,
      biomarkersTotal: BIOMARKER_RULES.length,
    };
  }

  const alerts: SynergyAlert[] = [];
  let biomarkersCovered = 0;

  for (const rule of BIOMARKER_RULES) {
    const rawValue = vault[rule.key];
    if (rawValue == null) continue;
    const value = rawValue as number;
    biomarkersCovered++;

    // Skip if in optimal range
    if (!isOutOfRange(value, rule)) continue;

    const severity = getSeverity(value, rule);
    if (severity === 'info') continue;

    // Compute adherence gap for prescribed protocols
    const protocolIds = rule.protocols.map(p => p.id);
    const adherence = computeAdherenceGap(protocolIds, stackLogs, lookbackDays);

    // Only surface alert if adherence is below 70% (meaningful gap)
    if (adherence >= 70) continue;

    // Check genetic modifiers
    let geneticNote = '';
    if (rule.geneticModifiers) {
      for (const mod of rule.geneticModifiers) {
        if (vault[mod.gene]) {
          geneticNote = ` ${mod.effect}`;
        }
      }
    }

    const targetStr = rule.direction === 'lower-is-better'
      ? `< ${rule.optimalRange.high} ${rule.unit}`
      : rule.direction === 'higher-is-better'
        ? `> ${rule.optimalRange.low} ${rule.unit}`
        : `${rule.optimalRange.low}–${rule.optimalRange.high} ${rule.unit}`;

    // Pick the primary prescribed protocol (first one)
    const primaryProtocol = rule.protocols[0];

    alerts.push({
      id: `synergy-${rule.key}`,
      severity,
      icon: primaryProtocol.icon,
      title: `${rule.label} Gap Detected`,
      subtitle: `${value} ${rule.unit} — ${adherence}% protocol adherence`,
      rationale: `Your ${rule.label} is at ${value} ${rule.unit} (target: ${targetStr}), but your prescribed protocol "${primaryProtocol.name}" has only ${adherence}% adherence over the last ${lookbackDays} days.${geneticNote} Syncing this dosage could improve your trajectory.`,
      marker: rule.label,
      markerValue: value,
      markerUnit: rule.unit,
      targetRange: targetStr,
      prescribedProtocol: primaryProtocol,
      adherenceGap: adherence,
      synergyCompounds: rule.synergyCompounds,
      color: rule.color,
      category: rule.category,
    });
  }

  // Sort: critical → high → moderate
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, moderate: 2, info: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const criticalGaps = alerts.filter(a => a.severity === 'critical').length;

  // Overall adherence across all out-of-range markers
  const allProtocolIds = alerts.flatMap(a => [a.prescribedProtocol.id]);
  const overallAdherence = allProtocolIds.length > 0
    ? computeAdherenceGap(allProtocolIds, stackLogs, lookbackDays)
    : 100;

  return {
    alerts,
    totalGaps: alerts.length,
    criticalGaps,
    overallAdherence,
    generatedAt: Date.now(),
    biomarkersCovered,
    biomarkersTotal: BIOMARKER_RULES.length,
  };
}

/* ── Get all prescribed protocols for a given vault snapshot ── */
export function getPrescribedProtocols(vault: BioVaultSnapshot | null): PrescribedProtocol[] {
  if (!vault) return [];
  const protocols: PrescribedProtocol[] = [];

  for (const rule of BIOMARKER_RULES) {
    const rawValue = vault[rule.key];
    if (rawValue == null) continue;
    const value = rawValue as number;
    if (!isOutOfRange(value, rule)) continue;
    protocols.push(...rule.protocols);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return protocols.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/* ── Get synergy compounds for a specific marker ── */
export function getSynergyCompounds(markerKey: string): string[] {
  const rule = BIOMARKER_RULES.find(r => r.key === markerKey);
  return rule?.synergyCompounds ?? [];
}
