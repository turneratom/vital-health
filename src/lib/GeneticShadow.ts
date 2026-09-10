/* ══════════════════════════════════════════════════════════════════════
   GENETIC SHADOW — SNP-Aware Protocol Filtering Layer
   
   Sits between BioIntelligence and the UI. Takes a user's genetic
   profile (3-5 key SNPs) and applies "shadow" modifiers to every
   protocol recommendation:
   
   • MTHFR C677T/A1298C → Folate metabolism, methylation capacity
   • APOE4 (ε4 carrier)  → Lipid metabolism, saturated fat sensitivity
   • COMT Val158Met       → Dopamine clearance, stimulant sensitivity
   • VDR (Vitamin D Receptor) → Vitamin D utilization efficiency
   • FTO (Fat Mass & Obesity) → Metabolic rate, carb sensitivity
   • CYP1A2 (Caffeine)   → Caffeine metabolism speed
   
   Each SNP can:
   1. BOOST a protocol's confidence (genetically favorable)
   2. WARN with a clinical note (requires dose adjustment)
   3. CONTRAINDICATE (genetically risky — flag prominently)
   4. SUBSTITUTE (swap one compound for a genetically-appropriate alternative)
   ══════════════════════════════════════════════════════════════════════ */

import type { Intervention } from './BioIntelligence';
import type { ProtocolCategory, UrgencyLevel } from './IntelligenceEngine';

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

/** SNP status for a given variant */
export type SNPStatus = 'none' | 'heterozygous' | 'homozygous' | 'unknown';

/** User's genetic profile — the 3-5 key SNPs */
export interface GeneticProfile {
  /** MTHFR C677T — methylation / folate metabolism */
  mthfrC677T: SNPStatus;
  /** MTHFR A1298C — secondary methylation variant */
  mthfrA1298C: SNPStatus;
  /** APOE4 — lipid metabolism / Alzheimer's risk */
  apoe4: SNPStatus;
  /** COMT Val158Met — dopamine clearance speed */
  comtVal158Met: SNPStatus;
  /** VDR — Vitamin D receptor efficiency */
  vdr: SNPStatus;
  /** FTO — fat mass / obesity-associated gene */
  fto: SNPStatus;
  /** CYP1A2 — caffeine metabolism (already in bioVault as boolean) */
  cyp1a2SlowMetabolizer: boolean;
}

/** A genetic modifier applied to an intervention */
export interface GeneticModifier {
  snp: string;
  snpLabel: string;
  type: 'boost' | 'warning' | 'contraindication' | 'substitution';
  icon: string;
  color: string;
  message: string;
  /** Confidence adjustment (-30 to +20) */
  confidenceAdjust: number;
  /** If substitution, what to use instead */
  substitute?: string;
}

/** An intervention with genetic shadow applied */
export interface ShadowedIntervention extends Intervention {
  geneticModifiers: GeneticModifier[];
  /** Whether this intervention is genetically contraindicated */
  isContraindicated: boolean;
  /** Original confidence before genetic adjustment */
  originalConfidence: number;
  /** Whether genetic data enhanced this recommendation */
  isGeneticallyBoosted: boolean;
}

/** Summary of genetic impact on the full protocol stack */
export interface GeneticShadowSummary {
  totalModifiers: number;
  contraindications: number;
  warnings: number;
  boosts: number;
  substitutions: number;
  topWarning: string | null;
  profileCompleteness: number; // 0-100
}

/* ══════════════════════════════════════════════════════════════════
   DEFAULT PROFILE — All unknown
   ══════════════════════════════════════════════════════════════════ */

export const DEFAULT_GENETIC_PROFILE: GeneticProfile = {
  mthfrC677T: 'unknown',
  mthfrA1298C: 'unknown',
  apoe4: 'unknown',
  comtVal158Met: 'unknown',
  vdr: 'unknown',
  fto: 'unknown',
  cyp1a2SlowMetabolizer: false,
};

/* ══════════════════════════════════════════════════════════════════
   SNP METADATA — For UI display
   ══════════════════════════════════════════════════════════════════ */

export interface SNPInfo {
  key: keyof Omit<GeneticProfile, 'cyp1a2SlowMetabolizer'>;
  label: string;
  gene: string;
  rsid: string;
  icon: string;
  description: string;
  impactAreas: string[];
}

export const SNP_REGISTRY: SNPInfo[] = [
  {
    key: 'mthfrC677T',
    label: 'MTHFR C677T',
    gene: 'MTHFR',
    rsid: 'rs1801133',
    icon: '🧬',
    description: 'Methylation enzyme — affects folate metabolism, homocysteine clearance, and B-vitamin utilization',
    impactAreas: ['Folate', 'B12', 'Methylation', 'Homocysteine'],
  },
  {
    key: 'mthfrA1298C',
    label: 'MTHFR A1298C',
    gene: 'MTHFR',
    rsid: 'rs1801131',
    icon: '🧬',
    description: 'Secondary methylation variant — compounds with C677T for reduced enzyme activity',
    impactAreas: ['BH4 synthesis', 'Neurotransmitters', 'Methylation'],
  },
  {
    key: 'apoe4',
    label: 'APOE ε4',
    gene: 'APOE',
    rsid: 'rs429358',
    icon: '🧠',
    description: 'Lipid transport variant — affects cholesterol metabolism, saturated fat response, and neurodegeneration risk',
    impactAreas: ['Lipids', 'Saturated Fat', 'ApoB', 'Neurodegeneration'],
  },
  {
    key: 'comtVal158Met',
    label: 'COMT Val158Met',
    gene: 'COMT',
    rsid: 'rs4680',
    icon: '⚡',
    description: 'Dopamine clearance enzyme — Met/Met = slow clearance (warrior), Val/Val = fast clearance (worrier)',
    impactAreas: ['Dopamine', 'Stimulants', 'Stress Response', 'Focus'],
  },
  {
    key: 'vdr',
    label: 'VDR Bsm/Taq',
    gene: 'VDR',
    rsid: 'rs1544410',
    icon: '☀️',
    description: 'Vitamin D receptor efficiency — affects how well cells respond to vitamin D signaling',
    impactAreas: ['Vitamin D', 'Calcium', 'Immune Function', 'Bone Health'],
  },
  {
    key: 'fto',
    label: 'FTO rs9939609',
    gene: 'FTO',
    rsid: 'rs9939609',
    icon: '🔥',
    description: 'Fat mass and obesity-associated gene — affects satiety signaling and carbohydrate sensitivity',
    impactAreas: ['Metabolism', 'Carb Sensitivity', 'Satiety', 'Weight'],
  },
];

/* ══════════════════════════════════════════════════════════════════
   GENETIC RULE ENGINE — Maps SNPs to intervention modifiers
   ══════════════════════════════════════════════════════════════════ */

interface GeneticRule {
  /** Which SNP this rule checks */
  snpKey: keyof GeneticProfile;
  snpLabel: string;
  /** Which intervention IDs or categories this applies to */
  matchInterventionIds?: string[];
  matchCategories?: ProtocolCategory[];
  /** Keywords in intervention name to match */
  matchKeywords?: string[];
  /** Minimum SNP status to trigger (heterozygous or homozygous) */
  minStatus: 'heterozygous' | 'homozygous';
  /** What type of modifier to apply */
  type: 'boost' | 'warning' | 'contraindication' | 'substitution';
  icon: string;
  color: string;
  /** Message template — {status} replaced with actual status */
  messageTemplate: string;
  /** Confidence adjustment */
  confidenceAdjust: number;
  substitute?: string;
}

const GENETIC_RULES: GeneticRule[] = [
  /* ─── MTHFR C677T Rules ─── */
  {
    snpKey: 'mthfrC677T',
    snpLabel: 'MTHFR C677T',
    matchKeywords: ['folate', 'folic acid', 'b-complex', 'b12', 'methylation'],
    minStatus: 'heterozygous',
    type: 'warning',
    icon: '🧬',
    color: '#FFB86B',
    messageTemplate: 'MTHFR {status}: Use methylfolate (5-MTHF) instead of folic acid. Folic acid cannot be efficiently converted and may accumulate as unmetabolized UMFA, blocking folate receptors.',
    confidenceAdjust: 5,
  },
  {
    snpKey: 'mthfrC677T',
    snpLabel: 'MTHFR C677T',
    matchKeywords: ['nad', 'nmn', 'niacin', 'nicotinamide'],
    minStatus: 'heterozygous',
    type: 'warning',
    icon: '🧬',
    color: '#FFB86B',
    messageTemplate: 'MTHFR {status}: NAD+ precursors increase methylation demand. Co-supplement with methylfolate 800mcg + methylcobalamin 1000mcg + TMG 500mg to prevent methyl donor depletion.',
    confidenceAdjust: 0,
  },
  {
    snpKey: 'mthfrC677T',
    snpLabel: 'MTHFR C677T',
    matchKeywords: ['creatine'],
    minStatus: 'heterozygous',
    type: 'boost',
    icon: '🧬',
    color: '#00DC82',
    messageTemplate: 'MTHFR {status}: Creatine supplementation is ESPECIALLY beneficial — it spares ~40% of daily methylation demand, reducing homocysteine burden on your compromised methylation cycle.',
    confidenceAdjust: 15,
  },

  /* ─── APOE4 Rules ─── */
  {
    snpKey: 'apoe4',
    snpLabel: 'APOE ε4',
    matchKeywords: ['saturated fat', 'mct', 'coconut', 'keto', 'ketogenic'],
    minStatus: 'heterozygous',
    type: 'contraindication',
    icon: '🧠',
    color: '#FF6B6B',
    messageTemplate: 'APOE4 {status}: High saturated fat intake significantly elevates ApoB and LDL-P in ε4 carriers. Avoid MCT oil, coconut oil, and ketogenic diets. Prioritize monounsaturated fats (olive oil, avocado).',
    confidenceAdjust: -30,
  },
  {
    snpKey: 'apoe4',
    snpLabel: 'APOE ε4',
    matchKeywords: ['omega', 'fish oil', 'dha', 'epa'],
    minStatus: 'heterozygous',
    type: 'boost',
    icon: '🧠',
    color: '#00DC82',
    messageTemplate: 'APOE4 {status}: Omega-3 (DHA/EPA) is CRITICAL for ε4 carriers — it provides neuroprotective effects that partially offset the increased neurodegeneration risk. Prioritize 2g+ EPA/DHA daily.',
    confidenceAdjust: 15,
  },
  {
    snpKey: 'apoe4',
    snpLabel: 'APOE ε4',
    matchKeywords: ['zone 2', 'cardio', 'aerobic', 'exercise'],
    minStatus: 'heterozygous',
    type: 'boost',
    icon: '🧠',
    color: '#00DC82',
    messageTemplate: 'APOE4 {status}: Aerobic exercise is the #1 modifiable risk reducer for ε4 carriers. Zone 2 training improves cerebral blood flow and BDNF expression, directly countering amyloid accumulation.',
    confidenceAdjust: 10,
  },
  {
    snpKey: 'apoe4',
    snpLabel: 'APOE ε4',
    matchKeywords: ['berberine', 'glucose', 'metabolic'],
    minStatus: 'heterozygous',
    type: 'boost',
    icon: '🧠',
    color: '#00DC82',
    messageTemplate: 'APOE4 {status}: Metabolic optimization is essential — insulin resistance accelerates neurodegeneration in ε4 carriers. Berberine/glucose management protocols are high-priority.',
    confidenceAdjust: 10,
  },

  /* ─── COMT Val158Met Rules ─── */
  {
    snpKey: 'comtVal158Met',
    snpLabel: 'COMT Val158Met',
    matchKeywords: ['caffeine', 'coffee', 'stimulant', 'nootropic', 'modafinil'],
    minStatus: 'homozygous',
    type: 'warning',
    icon: '⚡',
    color: '#FFB86B',
    messageTemplate: 'COMT Met/Met (slow dopamine clearance): Stimulants and high-dose caffeine cause dopamine overflow → anxiety, insomnia, and cortisol spikes. Limit caffeine to 100mg/day. Prefer L-theanine for focus.',
    confidenceAdjust: -10,
  },
  {
    snpKey: 'comtVal158Met',
    snpLabel: 'COMT Val158Met',
    matchKeywords: ['ashwagandha', 'adaptogen', 'rhodiola'],
    minStatus: 'homozygous',
    type: 'boost',
    icon: '⚡',
    color: '#00DC82',
    messageTemplate: 'COMT Met/Met: Adaptogens are especially effective for slow COMT — they modulate cortisol without spiking dopamine, providing stress relief through the HPA axis rather than catecholamine pathways.',
    confidenceAdjust: 10,
  },
  {
    snpKey: 'comtVal158Met',
    snpLabel: 'COMT Val158Met',
    matchKeywords: ['magnesium', 'gaba', 'theanine'],
    minStatus: 'heterozygous',
    type: 'boost',
    icon: '⚡',
    color: '#00DC82',
    messageTemplate: 'COMT {status}: GABAergic compounds (magnesium, L-theanine) help balance the dopamine-to-GABA ratio that COMT variants disrupt. Particularly effective for sleep and stress management.',
    confidenceAdjust: 8,
  },

  /* ─── VDR Rules ─── */
  {
    snpKey: 'vdr',
    snpLabel: 'VDR',
    matchKeywords: ['vitamin d', 'sunlight', 'cholecalciferol', 'd3'],
    minStatus: 'heterozygous',
    type: 'warning',
    icon: '☀️',
    color: '#FFB86B',
    messageTemplate: 'VDR {status}: Reduced vitamin D receptor sensitivity means standard doses (2000-4000 IU) may be insufficient. Target 5000-10000 IU D3 daily with K2 MK-7. Monitor 25(OH)D levels — aim for 60-80 ng/mL (higher than standard 40-60 target).',
    confidenceAdjust: 5,
  },

  /* ─── FTO Rules ─── */
  {
    snpKey: 'fto',
    snpLabel: 'FTO',
    matchKeywords: ['fasting', 'intermittent', 'time-restricted', 'caloric'],
    minStatus: 'heterozygous',
    type: 'boost',
    icon: '🔥',
    color: '#00DC82',
    messageTemplate: 'FTO {status}: Time-restricted eating is especially effective for FTO carriers — it compensates for impaired satiety signaling by creating a structural eating window that prevents overconsumption.',
    confidenceAdjust: 10,
  },
  {
    snpKey: 'fto',
    snpLabel: 'FTO',
    matchKeywords: ['carb', 'glucose', 'berberine', 'metabolic'],
    minStatus: 'heterozygous',
    type: 'warning',
    icon: '🔥',
    color: '#FFB86B',
    messageTemplate: 'FTO {status}: Increased carbohydrate sensitivity — prioritize low-glycemic carb sources and post-meal movement. Berberine/chromium can help blunt glucose spikes that FTO carriers are predisposed to.',
    confidenceAdjust: 5,
  },

  /* ─── CYP1A2 (Caffeine) Rules ─── */
  // Handled via cyp1a2SlowMetabolizer boolean — see applyGeneticShadow
];

/* ══════════════════════════════════════════════════════════════════
   CORE ENGINE — Apply genetic shadow to interventions
   ══════════════════════════════════════════════════════════════════ */

function snpStatusMatches(actual: SNPStatus | boolean, minRequired: 'heterozygous' | 'homozygous'): boolean {
  if (typeof actual === 'boolean') return actual;
  if (actual === 'unknown' || actual === 'none') return false;
  if (minRequired === 'heterozygous') return actual === 'heterozygous' || actual === 'homozygous';
  return actual === 'homozygous';
}

function interventionMatchesRule(intervention: Intervention, rule: GeneticRule): boolean {
  if (rule.matchInterventionIds?.includes(intervention.id)) return true;
  if (rule.matchCategories?.includes(intervention.category)) return true;
  if (rule.matchKeywords) {
    const nameLower = intervention.name.toLowerCase();
    const mechLower = intervention.mechanism.toLowerCase();
    const dosingLower = intervention.dosing.toLowerCase();
    const synLower = intervention.synergies.join(' ').toLowerCase();
    const combined = `${nameLower} ${mechLower} ${dosingLower} ${synLower}`;
    return rule.matchKeywords.some(kw => combined.includes(kw.toLowerCase()));
  }
  return false;
}

/**
 * applyGeneticShadow — The main filtering function
 * 
 * Takes a list of interventions and a genetic profile,
 * returns ShadowedInterventions with genetic modifiers applied.
 * Contraindicated interventions are moved to the bottom with warnings.
 */
export function applyGeneticShadow(
  interventions: Intervention[],
  profile: GeneticProfile
): ShadowedIntervention[] {
  const isProfileEmpty = Object.values(profile).every(v =>
    v === 'unknown' || v === 'none' || v === false
  );

  // If no genetic data, return interventions unchanged
  if (isProfileEmpty) {
    return interventions.map(i => ({
      ...i,
      geneticModifiers: [],
      isContraindicated: false,
      originalConfidence: i.confidence,
      isGeneticallyBoosted: false,
    }));
  }

  const shadowed: ShadowedIntervention[] = interventions.map(intervention => {
    const modifiers: GeneticModifier[] = [];
    let confidenceAdjust = 0;
    let isContraindicated = false;
    let isBoosted = false;

    // Check all genetic rules
    for (const rule of GENETIC_RULES) {
      const snpValue = profile[rule.snpKey];
      if (!snpStatusMatches(snpValue, rule.minStatus)) continue;
      if (!interventionMatchesRule(intervention, rule)) continue;

      const statusLabel = typeof snpValue === 'boolean'
        ? (snpValue ? 'positive' : 'negative')
        : snpValue;

      const message = rule.messageTemplate.replace('{status}', statusLabel);

      modifiers.push({
        snp: rule.snpKey,
        snpLabel: rule.snpLabel,
        type: rule.type,
        icon: rule.icon,
        color: rule.color,
        message,
        confidenceAdjust: rule.confidenceAdjust,
        substitute: rule.substitute,
      });

      confidenceAdjust += rule.confidenceAdjust;
      if (rule.type === 'contraindication') isContraindicated = true;
      if (rule.type === 'boost') isBoosted = true;
    }

    // CYP1A2 caffeine rule (from boolean field)
    if (profile.cyp1a2SlowMetabolizer) {
      const nameLower = intervention.name.toLowerCase();
      const mechLower = intervention.mechanism.toLowerCase();
      const combined = `${nameLower} ${mechLower}`;
      if (combined.includes('caffeine') || combined.includes('coffee')) {
        modifiers.push({
          snp: 'cyp1a2SlowMetabolizer',
          snpLabel: 'CYP1A2',
          type: 'warning',
          icon: '☕',
          color: '#FFB86B',
          message: 'CYP1A2 slow metabolizer: Caffeine half-life extended to ~8h. Enforce strict AM-only cutoff (before 10am). Limit to 100-200mg/day. Evening caffeine will fragment deep sleep architecture.',
          confidenceAdjust: -5,
        });
        confidenceAdjust -= 5;
      }
    }

    const adjustedConfidence = Math.max(5, Math.min(99, intervention.confidence + confidenceAdjust));

    return {
      ...intervention,
      confidence: adjustedConfidence,
      geneticModifiers: modifiers,
      isContraindicated,
      originalConfidence: intervention.confidence,
      isGeneticallyBoosted: isBoosted,
    };
  });

  // Sort: contraindicated to bottom, boosted to top within urgency tier
  shadowed.sort((a, b) => {
    if (a.isContraindicated && !b.isContraindicated) return 1;
    if (!a.isContraindicated && b.isContraindicated) return -1;
    if (a.isGeneticallyBoosted && !b.isGeneticallyBoosted) return -1;
    if (!a.isGeneticallyBoosted && b.isGeneticallyBoosted) return 1;
    const urgencyRank: Record<string, number> = { critical: 0, high: 1, moderate: 2, advisory: 3 };
    const tierDiff = (urgencyRank[a.urgency] ?? 3) - (urgencyRank[b.urgency] ?? 3);
    if (tierDiff !== 0) return tierDiff;
    return b.confidence - a.confidence;
  });

  return shadowed;
}

/* ══════════════════════════════════════════════════════════════════
   SUMMARY — Quick stats for the HUD badge
   ══════════════════════════════════════════════════════════════════ */

export function getGeneticShadowSummary(
  shadowed: ShadowedIntervention[],
  profile: GeneticProfile
): GeneticShadowSummary {
  const allModifiers = shadowed.flatMap(s => s.geneticModifiers);
  const contraindications = allModifiers.filter(m => m.type === 'contraindication').length;
  const warnings = allModifiers.filter(m => m.type === 'warning').length;
  const boosts = allModifiers.filter(m => m.type === 'boost').length;
  const substitutions = allModifiers.filter(m => m.type === 'substitution').length;

  // Profile completeness
  const snpKeys: (keyof Omit<GeneticProfile, 'cyp1a2SlowMetabolizer'>)[] = [
    'mthfrC677T', 'mthfrA1298C', 'apoe4', 'comtVal158Met', 'vdr', 'fto',
  ];
  const known = snpKeys.filter(k => profile[k] !== 'unknown').length;
  const profileCompleteness = Math.round(((known + (profile.cyp1a2SlowMetabolizer ? 1 : 0)) / 7) * 100);

  const topWarningMod = allModifiers.find(m => m.type === 'contraindication') || allModifiers.find(m => m.type === 'warning');

  return {
    totalModifiers: allModifiers.length,
    contraindications,
    warnings,
    boosts,
    substitutions,
    topWarning: topWarningMod?.message ?? null,
    profileCompleteness,
  };
}

/* ══════════════════════════════════════════════════════════════════
   GENETIC CONTEXT STRING — For LLM prompts
   ══════════════════════════════════════════════════════════════════ */

export function buildGeneticContextForLLM(profile: GeneticProfile): string {
  const lines: string[] = ['GENETIC PROFILE (SNP Shadow):'];
  const entries: string[] = [];

  if (profile.mthfrC677T !== 'unknown') {
    entries.push(`MTHFR C677T: ${profile.mthfrC677T}${profile.mthfrC677T !== 'none' ? ' — impaired methylation, use methylfolate not folic acid, monitor homocysteine' : ' — normal methylation'}`);
  }
  if (profile.mthfrA1298C !== 'unknown') {
    entries.push(`MTHFR A1298C: ${profile.mthfrA1298C}${profile.mthfrA1298C !== 'none' ? ' — reduced BH4 synthesis, compounds with C677T' : ' — normal'}`);
  }
  if (profile.apoe4 !== 'unknown') {
    entries.push(`APOE ε4: ${profile.apoe4}${profile.apoe4 !== 'none' ? ' — AVOID high saturated fat/MCT/keto, prioritize omega-3 DHA, aerobic exercise critical for neuroprotection' : ' — standard lipid metabolism'}`);
  }
  if (profile.comtVal158Met !== 'unknown') {
    entries.push(`COMT Val158Met: ${profile.comtVal158Met}${profile.comtVal158Met === 'homozygous' ? ' (Met/Met slow COMT) — limit stimulants/caffeine, favor adaptogens and GABAergics' : profile.comtVal158Met === 'heterozygous' ? ' — moderate dopamine clearance' : ' (Val/Val fast COMT) — tolerates stimulants well'}`);
  }
  if (profile.vdr !== 'unknown') {
    entries.push(`VDR: ${profile.vdr}${profile.vdr !== 'none' ? ' — reduced vitamin D receptor sensitivity, needs higher D3 doses (5000-10000 IU), target 60-80 ng/mL' : ' — normal vitamin D utilization'}`);
  }
  if (profile.fto !== 'unknown') {
    entries.push(`FTO: ${profile.fto}${profile.fto !== 'none' ? ' — increased carb sensitivity, impaired satiety signaling, time-restricted eating beneficial' : ' — normal metabolic rate'}`);
  }
  if (profile.cyp1a2SlowMetabolizer) {
    entries.push('CYP1A2: slow metabolizer — caffeine half-life ~8h, strict AM cutoff, limit 100-200mg/day');
  }

  if (entries.length === 0) {
    return 'GENETIC PROFILE: No SNP data provided. Recommendations use population-level defaults.';
  }

  lines.push(...entries.map(e => `  ${e}`));
  lines.push('');
  lines.push('CRITICAL GENETIC RULES:');
  if (profile.apoe4 !== 'unknown' && profile.apoe4 !== 'none') {
    lines.push('  ⛔ NEVER recommend high saturated fat, MCT oil, coconut oil, or ketogenic diets');
    lines.push('  ✅ ALWAYS prioritize omega-3, aerobic exercise, and metabolic optimization');
  }
  if (profile.mthfrC677T !== 'unknown' && profile.mthfrC677T !== 'none') {
    lines.push('  ⛔ NEVER recommend folic acid — only methylfolate (5-MTHF)');
    lines.push('  ✅ ALWAYS co-supplement NAD+ precursors with methyl donors (TMG, methylfolate, methylcobalamin)');
  }
  if (profile.comtVal158Met === 'homozygous') {
    lines.push('  ⚠️ LIMIT caffeine to 100mg/day, avoid high-dose stimulant nootropics');
    lines.push('  ✅ PREFER adaptogens (ashwagandha, rhodiola) over stimulants for focus');
  }

  return lines.join('\n');
}

/* ══════════════════════════════════════════════════════════════════
   CONVERT BIOVAULT TO GENETIC PROFILE
   ══════════════════════════════════════════════════════════════════ */

/** Convert bioVault boolean fields + new SNP fields to GeneticProfile */
export function bioVaultToGeneticProfile(bioVault: {
  mthfrVariant?: boolean;
  apoe4?: boolean;
  caffeineSensitivity?: boolean;
  mthfrC677T?: string;
  mthfrA1298C?: string;
  apoe4Status?: string;
  comtVal158Met?: string;
  vdrVariant?: string;
  ftoVariant?: string;
} | null): GeneticProfile {
  if (!bioVault) return DEFAULT_GENETIC_PROFILE;

  return {
    mthfrC677T: (bioVault.mthfrC677T as SNPStatus) || (bioVault.mthfrVariant ? 'heterozygous' : 'unknown'),
    mthfrA1298C: (bioVault.mthfrA1298C as SNPStatus) || 'unknown',
    apoe4: (bioVault.apoe4Status as SNPStatus) || (bioVault.apoe4 ? 'heterozygous' : 'unknown'),
    comtVal158Met: (bioVault.comtVal158Met as SNPStatus) || 'unknown',
    vdr: (bioVault.vdrVariant as SNPStatus) || 'unknown',
    fto: (bioVault.ftoVariant as SNPStatus) || 'unknown',
    cyp1a2SlowMetabolizer: bioVault.caffeineSensitivity ?? false,
  };
}
