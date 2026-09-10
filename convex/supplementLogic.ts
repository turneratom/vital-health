/**
 * Vive 4.0 — Daily Protocol Engine (supplementLogic.ts)
 *
 * Takes Bio-Vault data (blood markers, genetic toggles, dietary prefs)
 * + System Vitals (HRV, sleep, strain, recovery) and generates a
 * personalized "Daily Protocol" array of supplements, interventions,
 * and dynamic targets.
 *
 * This is a PURE LOGIC file — no Convex imports, no side effects.
 * It can be imported by queries, actions, or even the frontend.
 */

/* ── Types ── */

export interface BioVaultData {
  vitaminD?: number | null;
  testosteroneFree?: number | null;
  testosteroneTotal?: number | null;
  ferritin?: number | null;
  crp?: number | null;
  hba1c?: number | null;
  mthfrVariant: boolean;
  apoe4: boolean;
  caffeineSensitivity: boolean;
  preferredProteins: string;
  dietaryRestrictions: string;
}

export interface SystemVitals {
  hrv: number;           // Current HRV in ms
  hrvAvg7d: number;      // 7-day HRV average in ms
  sleepHours: number;    // Last night sleep duration
  sleepScore: number;    // 0-100
  strain: number;        // 0-21 scale (Whoop-style)
  rhr: number;           // Resting heart rate
  recovery: number;      // 0-100
  spo2: number;          // Blood oxygen %
}

export type SupplementPriority = "critical" | "recommended" | "optional";

export interface ProtocolSupplement {
  id: string;
  name: string;
  dose: string;
  reason: string;
  icon: string;
  linkedMarker: string;
  priority: SupplementPriority;
  category: "blood-marker" | "genetic" | "recovery" | "performance" | "sleep";
  timing: "morning" | "afternoon" | "evening" | "with-food" | "empty-stomach";
}

export interface ProtocolIntervention {
  id: string;
  name: string;
  duration: string;
  icon: string;
  benefit: string;
  strainBased: boolean;
  intensity: "low" | "medium" | "high";
  category: "thermal" | "breathwork" | "light" | "movement" | "sleep";
}

export interface DynamicTarget {
  id: string;
  label: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
  description: string;
  basedOn: string;
}

export interface DailyProtocol {
  supplements: ProtocolSupplement[];
  interventions: ProtocolIntervention[];
  dynamicTargets: DynamicTarget[];
  generatedAt: number;
  dataCompleteness: number; // 0-100 — how much Bio-Vault data is filled
  protocolTier: "personalized" | "baseline";
}

/* ── Defaults for when no Bio-Vault or Vitals data exists ── */

const DEFAULT_VITALS: SystemVitals = {
  hrv: 55,
  hrvAvg7d: 58,
  sleepHours: 7.2,
  sleepScore: 72,
  strain: 12.0,
  rhr: 58,
  recovery: 70,
  spo2: 97,
};

/* ── Helper: Calculate data completeness ── */

function calcCompleteness(vault: BioVaultData | null): number {
  if (!vault) return 0;
  const fields: (keyof BioVaultData)[] = [
    "vitaminD", "testosteroneFree", "testosteroneTotal",
    "ferritin", "crp", "hba1c",
  ];
  const boolFields: (keyof BioVaultData)[] = ["mthfrVariant", "apoe4", "caffeineSensitivity"];
  const stringFields: (keyof BioVaultData)[] = ["preferredProteins", "dietaryRestrictions"];

  let filled = 0;
  const total = fields.length + boolFields.length + stringFields.length;

  for (const f of fields) {
    const val = vault[f];
    if (val !== undefined && val !== null && val !== 0) filled++;
  }
  // Booleans always count as filled (they have a default)
  filled += boolFields.length;
  for (const f of stringFields) {
    if (vault[f] && (vault[f] as string).length > 0) filled++;
  }

  return Math.round((filled / total) * 100);
}

/* ── Helper: HRV percentile relative to 7-day average ── */

function hrvPercentile(current: number, avg7d: number): number {
  if (avg7d === 0) return 50;
  const ratio = current / avg7d;
  // Simple percentile: ratio < 0.8 = bottom 20%, ratio > 1.2 = top 20%
  if (ratio <= 0.8) return Math.max(0, Math.round(ratio * 25));
  if (ratio >= 1.2) return Math.min(100, Math.round(60 + (ratio - 1.0) * 200));
  return Math.round(20 + (ratio - 0.8) * 150);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN ENGINE: generateDailyProtocol
   ══════════════════════════════════════════════════════════════════ */

export function generateDailyProtocol(
  vault: BioVaultData | null,
  vitals?: Partial<SystemVitals> | null,
): DailyProtocol {
  const v: SystemVitals = { ...DEFAULT_VITALS, ...vitals };
  const completeness = calcCompleteness(vault);
  const isPersonalized = completeness >= 30;
  const hrvPct = hrvPercentile(v.hrv, v.hrvAvg7d);

  const supplements: ProtocolSupplement[] = [];
  const interventions: ProtocolIntervention[] = [];

  /* ────────────────────────────────────────────────────────────────
     SUPPLEMENT RULES — Blood Markers
     ──────────────────────────────────────────────────────────────── */

  // Rule 1: Vitamin D < 40 → D3 + K2
  if (vault?.vitaminD != null && vault.vitaminD < 40) {
    const severe = vault.vitaminD < 20;
    supplements.push({
      id: "vitd3-k2",
      name: severe ? "Vitamin D3 + K2 (High Dose)" : "Vitamin D3 + K2",
      dose: severe ? "10,000 IU" : "5,000 IU",
      reason: `Blood level: ${vault.vitaminD} ng/mL → Target: 40-60 ng/mL${severe ? " (severely deficient)" : ""}`,
      icon: "☀️",
      linkedMarker: "Vitamin D",
      priority: severe ? "critical" : "recommended",
      category: "blood-marker",
      timing: "with-food",
    });
  } else if (!vault?.vitaminD) {
    // No data — add baseline recommendation
    supplements.push({
      id: "vitd3-k2-baseline",
      name: "Vitamin D3 + K2",
      dose: "2,000 IU",
      reason: "Baseline recommendation — add blood panel data for personalized dosing",
      icon: "☀️",
      linkedMarker: "Vitamin D",
      priority: "optional",
      category: "blood-marker",
      timing: "with-food",
    });
  }

  // Rule 2: Ferritin < 50 → Iron Bisglycinate
  if (vault?.ferritin != null && vault.ferritin < 50) {
    const severe = vault.ferritin < 20;
    supplements.push({
      id: "iron-bisgly",
      name: "Iron Bisglycinate + Vitamin C",
      dose: severe ? "36mg" : "18mg",
      reason: `Ferritin: ${vault.ferritin} ng/mL → Target: 50-150 ng/mL`,
      icon: "🩸",
      linkedMarker: "Ferritin",
      priority: severe ? "critical" : "recommended",
      category: "blood-marker",
      timing: "empty-stomach",
    });
  }

  // Rule 3: CRP > 1.0 → Anti-inflammatory stack
  if (vault?.crp != null && vault.crp > 1.0) {
    const elevated = vault.crp > 3.0;
    supplements.push({
      id: "omega3-epa",
      name: "Omega-3 (High EPA)",
      dose: elevated ? "4,000mg" : "2,000mg",
      reason: `CRP: ${vault.crp} mg/L → Target: <1.0 mg/L (inflammation marker)`,
      icon: "🐟",
      linkedMarker: "CRP",
      priority: elevated ? "critical" : "recommended",
      category: "blood-marker",
      timing: "with-food",
    });
    if (elevated) {
      supplements.push({
        id: "curcumin",
        name: "Curcumin + Piperine",
        dose: "1,000mg",
        reason: `CRP elevated at ${vault.crp} mg/L — curcumin supports NF-kB pathway modulation`,
        icon: "🌿",
        linkedMarker: "CRP",
        priority: "recommended",
        category: "blood-marker",
        timing: "with-food",
      });
    }
  }

  // Rule 4: HbA1c > 5.4 → Berberine + Chromium
  if (vault?.hba1c != null && vault.hba1c > 5.4) {
    const preDiabetic = vault.hba1c > 5.7;
    supplements.push({
      id: "berberine",
      name: "Berberine HCl",
      dose: preDiabetic ? "1,500mg (3x500mg)" : "500mg",
      reason: `HbA1c: ${vault.hba1c}% → Target: <5.4% (glucose regulation)`,
      icon: "🌿",
      linkedMarker: "HbA1c",
      priority: preDiabetic ? "critical" : "recommended",
      category: "blood-marker",
      timing: "with-food",
    });
    supplements.push({
      id: "chromium",
      name: "Chromium Picolinate",
      dose: "200mcg",
      reason: "Supports insulin sensitivity alongside berberine",
      icon: "⚙️",
      linkedMarker: "HbA1c",
      priority: "optional",
      category: "blood-marker",
      timing: "with-food",
    });
  }

  // Rule 5: Testosterone (Total) < 500 or Free < 10 → Tongkat Ali + Zinc
  if (
    (vault?.testosteroneTotal != null && vault.testosteroneTotal < 500) ||
    (vault?.testosteroneFree != null && vault.testosteroneFree < 10)
  ) {
    supplements.push({
      id: "tongkat-ali",
      name: "Tongkat Ali (Eurycoma)",
      dose: "400mg",
      reason: `T-Total: ${vault?.testosteroneTotal ?? "—"} ng/dL, Free: ${vault?.testosteroneFree ?? "—"} pg/mL → supports endogenous production`,
      icon: "💪",
      linkedMarker: "Testosterone",
      priority: "recommended",
      category: "blood-marker",
      timing: "morning",
    });
    supplements.push({
      id: "zinc-pic",
      name: "Zinc Picolinate",
      dose: "30mg",
      reason: "Cofactor for testosterone synthesis and immune function",
      icon: "🛡️",
      linkedMarker: "Testosterone",
      priority: "recommended",
      category: "blood-marker",
      timing: "evening",
    });
  }

  /* ────────────────────────────────────────────────────────────────
     SUPPLEMENT RULES — Genetic Toggles
     ──────────────────────────────────────────────────────────────── */

  // Rule 6: MTHFR Variant → Methylated B-Complex
  if (vault?.mthfrVariant) {
    supplements.push({
      id: "methyl-b",
      name: "Methylated B-Complex",
      dose: "1 capsule",
      reason: "MTHFR variant detected — methylfolate + methylcobalamin for impaired methylation",
      icon: "🧬",
      linkedMarker: "MTHFR",
      priority: "critical",
      category: "genetic",
      timing: "morning",
    });
  }

  // Rule 7: APOE4 → DHA-focused Omega-3 + reduce saturated fat advisory
  if (vault?.apoe4) {
    // Only add if we haven't already added omega-3 from CRP rule
    if (!supplements.find(s => s.id === "omega3-epa")) {
      supplements.push({
        id: "omega3-dha",
        name: "Omega-3 (High DHA)",
        dose: "2,000mg",
        reason: "APOE4 carrier — DHA supports neuroprotection and lipid metabolism",
        icon: "🧠",
        linkedMarker: "APOE4",
        priority: "critical",
        category: "genetic",
        timing: "with-food",
      });
    }
    supplements.push({
      id: "phosphatidylserine",
      name: "Phosphatidylserine",
      dose: "100mg",
      reason: "APOE4 carrier — supports cognitive function and cortisol modulation",
      icon: "🧠",
      linkedMarker: "APOE4",
      priority: "recommended",
      category: "genetic",
      timing: "evening",
    });
  }

  // Rule 8: Caffeine Sensitivity → L-Theanine pairing
  if (vault?.caffeineSensitivity) {
    supplements.push({
      id: "l-theanine",
      name: "L-Theanine",
      dose: "200mg",
      reason: "Caffeine sensitivity detected — pair with coffee to smooth jitters and support alpha waves",
      icon: "🍵",
      linkedMarker: "Caffeine Gene",
      priority: "recommended",
      category: "genetic",
      timing: "morning",
    });
  }

  /* ────────────────────────────────────────────────────────────────
     SUPPLEMENT RULES — HRV / Recovery / Sleep
     ──────────────────────────────────────────────────────────────── */

  // Rule 9: HRV in bottom 20% of 7-day average → Magnesium L-Threonate
  if (hrvPct <= 20) {
    supplements.push({
      id: "mag-threonate",
      name: "Magnesium L-Threonate",
      dose: "400mg",
      reason: `HRV: ${v.hrv}ms (bottom ${hrvPct}% of your 7-day avg ${v.hrvAvg7d}ms) — supports parasympathetic recovery`,
      icon: "🧲",
      linkedMarker: "HRV",
      priority: "critical",
      category: "recovery",
      timing: "evening",
    });
  } else {
    // Standard magnesium for everyone
    supplements.push({
      id: "mag-glycinate",
      name: "Magnesium Glycinate",
      dose: "300mg",
      reason: "Baseline recovery support — muscle relaxation and sleep quality",
      icon: "🧲",
      linkedMarker: "Recovery",
      priority: "optional",
      category: "recovery",
      timing: "evening",
    });
  }

  // Rule 10: Sleep < 6h → Apigenin + Glycine
  if (v.sleepHours < 6) {
    supplements.push({
      id: "apigenin",
      name: "Apigenin",
      dose: "50mg",
      reason: `Sleep: ${v.sleepHours}h last night — supports GABA receptor activation for deeper sleep`,
      icon: "🌙",
      linkedMarker: "Sleep",
      priority: "critical",
      category: "sleep",
      timing: "evening",
    });
    supplements.push({
      id: "glycine",
      name: "Glycine",
      dose: "3g",
      reason: "Lowers core body temperature, improves sleep onset latency",
      icon: "❄️",
      linkedMarker: "Sleep",
      priority: "recommended",
      category: "sleep",
      timing: "evening",
    });
  }

  // Rule 11: High strain (>15) → Ashwagandha for cortisol
  if (v.strain > 15) {
    supplements.push({
      id: "ashwagandha",
      name: "Ashwagandha KSM-66",
      dose: "600mg",
      reason: `Strain: ${v.strain} — elevated cortisol management for recovery optimization`,
      icon: "🧘",
      linkedMarker: "Strain",
      priority: "recommended",
      category: "performance",
      timing: "evening",
    });
  }

  // Rule 12: Recovery < 50% → Creatine + Electrolytes
  if (v.recovery < 50) {
    supplements.push({
      id: "creatine",
      name: "Creatine Monohydrate",
      dose: "5g",
      reason: `Recovery: ${v.recovery}% — supports ATP regeneration and cognitive function under stress`,
      icon: "⚡",
      linkedMarker: "Recovery",
      priority: "recommended",
      category: "performance",
      timing: "morning",
    });
  }

  /* ────────────────────────────────────────────────────────────────
     INTERVENTION RULES
     ──────────────────────────────────────────────────────────────── */

  // Cold exposure — high strain or high CRP
  if (v.strain > 12 || (vault?.crp != null && vault.crp > 1.5)) {
    interventions.push({
      id: "cold-plunge",
      name: "Cold Plunge",
      duration: v.strain > 16 ? "3 min" : "10 min",
      icon: "🧊",
      benefit: `Reduces inflammation${vault?.crp && vault.crp > 1.5 ? ` (CRP: ${vault.crp})` : ""}, boosts norepinephrine 300%`,
      strainBased: true,
      intensity: "high",
      category: "thermal",
    });
  }

  // Sauna — recovery > 60% (safe to heat stress)
  if (v.recovery > 60) {
    interventions.push({
      id: "sauna",
      name: "Infrared Sauna",
      duration: v.recovery > 80 ? "25 min" : "15 min",
      icon: "🔥",
      benefit: "Heat shock proteins, improved cardiovascular function, growth hormone release",
      strainBased: false,
      intensity: v.recovery > 80 ? "medium" : "low",
      category: "thermal",
    });
  }

  // Box breathing — HRV below average
  if (hrvPct < 50) {
    interventions.push({
      id: "box-breathing",
      name: "Box Breathing (4-4-4-4)",
      duration: "5 min",
      icon: "🌬️",
      benefit: `HRV at ${hrvPct}th percentile — vagal tone activation to restore parasympathetic balance`,
      strainBased: false,
      intensity: "low",
      category: "breathwork",
    });
  }

  // Red light — always beneficial, adjust duration by recovery
  interventions.push({
    id: "red-light",
    name: "Red Light Therapy",
    duration: v.recovery < 50 ? "15 min" : "10 min",
    icon: "🔴",
    benefit: "Mitochondrial function (cytochrome c oxidase), collagen synthesis, circadian support",
    strainBased: false,
    intensity: "low",
    category: "light",
  });

  // Magnesium bath — poor sleep or high strain
  if (v.sleepHours < 7 || v.strain > 14) {
    interventions.push({
      id: "mag-bath",
      name: "Magnesium Bath",
      duration: "15 min",
      icon: "🛁",
      benefit: "Transdermal Mg absorption, parasympathetic activation, sleep prep",
      strainBased: false,
      intensity: "low",
      category: "thermal",
    });
  }

  // NSDR / Yoga Nidra — low sleep score
  if (v.sleepScore < 65) {
    interventions.push({
      id: "nsdr",
      name: "NSDR / Yoga Nidra",
      duration: "20 min",
      icon: "🧘",
      benefit: `Sleep score: ${v.sleepScore} — non-sleep deep rest to replenish dopamine and restore focus`,
      strainBased: false,
      intensity: "low",
      category: "sleep",
    });
  }

  // Zone 2 walk — APOE4 carriers benefit from consistent low-intensity cardio
  if (vault?.apoe4 && v.recovery > 50) {
    interventions.push({
      id: "zone2-walk",
      name: "Zone 2 Walk",
      duration: "30 min",
      icon: "🚶",
      benefit: "APOE4 protocol — consistent Zone 2 cardio supports BDNF and metabolic health",
      strainBased: false,
      intensity: "low",
      category: "movement",
    });
  }

  /* ────────────────────────────────────────────────────────────────
     DYNAMIC TARGETS
     ──────────────────────────────────────────────────────────────── */

  // Calorie target — adjusted by strain and sleep
  const baseCalories = 2400;
  const strainAdjust = Math.round((v.strain - 10) * 20); // +/- 20 kcal per strain point from baseline 10
  const sleepAdjust = v.sleepHours < 6 ? -100 : v.sleepHours < 7 ? -50 : 0; // Reduce if under-slept (appetite dysregulation)
  const calorieTarget = baseCalories + strainAdjust + sleepAdjust;

  const dynamicTargets: DynamicTarget[] = [
    {
      id: "calories",
      label: "Calorie Target",
      value: calorieTarget.toLocaleString(),
      unit: "kcal",
      icon: "🔥",
      color: "#FFB86B",
      description: `Adjusted ${strainAdjust >= 0 ? "+" : ""}${strainAdjust} kcal for strain${sleepAdjust !== 0 ? `, ${sleepAdjust} for sleep debt` : ""}`,
      basedOn: `Strain: ${v.strain} / Sleep: ${v.sleepHours}h`,
    },
    {
      id: "recovery",
      label: "Recovery Score",
      value: String(v.recovery),
      unit: "/ 100",
      icon: "💚",
      color: v.recovery >= 70 ? "#34D399" : v.recovery >= 40 ? "#FBBF24" : "#FF6B6B",
      description: v.recovery >= 70
        ? "Body is well-recovered — high intensity cleared"
        : v.recovery >= 40
          ? "Moderate recovery — keep intensity controlled"
          : "Low recovery — prioritize rest and gentle movement only",
      basedOn: `HRV: ${v.hrv}ms / RHR: ${v.rhr}bpm`,
    },
  ];

  // Strain ceiling — based on recovery
  const strainCeiling = v.recovery >= 80 ? 18.0 : v.recovery >= 60 ? 15.0 : v.recovery >= 40 ? 12.0 : 8.0;
  dynamicTargets.push({
    id: "strain-ceiling",
    label: "Strain Ceiling",
    value: strainCeiling.toFixed(1),
    unit: "max",
    icon: "⚡",
    color: "#00FFCC",
    description: `Stay below this to avoid overtraining today`,
    basedOn: `Recovery: ${v.recovery}% / Sleep Debt: ${v.sleepHours < 7 ? "Moderate" : "Low"}`,
  });

  // Protein target — adjusted by dietary preferences
  const isPlantBased = vault?.preferredProteins?.toLowerCase().includes("plant") ||
    vault?.dietaryRestrictions?.toLowerCase().includes("vegan");
  const proteinTarget = isPlantBased ? "1.8" : "1.6";
  dynamicTargets.push({
    id: "protein",
    label: "Protein Target",
    value: proteinTarget,
    unit: "g/kg",
    icon: "🥩",
    color: "#FF6BB5",
    description: isPlantBased
      ? "Elevated target for plant-based diet — ensure complete amino acid profile"
      : "Optimal range for muscle protein synthesis and recovery",
    basedOn: `Diet: ${isPlantBased ? "Plant-based" : "Omnivore"} / Strain: ${v.strain}`,
  });

  // Caffeine cutoff — based on sensitivity
  if (vault?.caffeineSensitivity) {
    dynamicTargets.push({
      id: "caffeine-cutoff",
      label: "Caffeine Cutoff",
      value: "12:00",
      unit: "PM",
      icon: "☕",
      color: "#FBBF24",
      description: "Slow metabolizer — caffeine after noon disrupts deep sleep architecture",
      basedOn: "Genetic: CYP1A2 slow metabolizer",
    });
  }

  /* ── Sort supplements by priority ── */
  const priorityOrder: Record<SupplementPriority, number> = { critical: 0, recommended: 1, optional: 2 };
  supplements.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    supplements,
    interventions,
    dynamicTargets,
    generatedAt: Date.now(),
    dataCompleteness: completeness,
    protocolTier: isPersonalized ? "personalized" : "baseline",
  };
}

/* ══════════════════════════════════════════════════════════════════
   PRECISION STACK ENGINE: generatePrecisionStack
   Focus-aware, gene-specific supplement formulation
   ══════════════════════════════════════════════════════════════════ */

export type PrecisionFocus = "performance" | "recovery" | "longevity";

export interface PrecisionItem {
  id: string;
  name: string;
  dose: string;
  gene: string;        // Gene pathway or marker driving this recommendation
  reason: string;      // Human-readable explanation
  icon: string;
  timing: string;      // e.g. "AM · With food"
  priority: SupplementPriority;
  source: "biomarker" | "genetic" | "focus" | "baseline";
}

export interface PrecisionStack {
  items: PrecisionItem[];
  focus: PrecisionFocus;
  dataCompleteness: number;
  tier: "personalized" | "baseline";
  generatedAt: number;
  totalItems: number;
  criticalCount: number;
}

/* ══════════════════════════════════════════════════════════════════
   STACK SYNERGY ENGINE — Intelligent Compound Pairing
   
   When a user logs a peptide or advanced compound, this engine
   automatically identifies synergistic supplements that amplify
   the compound's mechanism of action.
   
   Example: BPC-157 → Collagen (tissue substrate) + Vitamin C (cofactor)
   Example: CJC-1295 → Melatonin (GH pulse timing) + Glycine (sleep onset)
   ══════════════════════════════════════════════════════════════════ */

export interface StackSynergy {
  id: string;
  primaryCompound: string;
  primaryIcon: string;
  primaryCategory: string;
  synergisticItems: SynergyItem[];
  mechanismSummary: string;
  stackConfidence: number; // 0-100
  isFutureBio: boolean;
}

export interface SynergyItem {
  id: string;
  name: string;
  dose: string;
  icon: string;
  timing: string;
  role: "substrate" | "cofactor" | "amplifier" | "protector" | "timing";
  roleLabel: string;
  reason: string;
  priority: SupplementPriority;
}

/** Master synergy map — each key is a compound/peptide/supplement ID */
const SYNERGY_MAP: Record<string, {
  name: string;
  icon: string;
  category: string;
  isFutureBio: boolean;
  mechanism: string;
  synergies: Array<{
    id: string;
    name: string;
    dose: string;
    icon: string;
    timing: string;
    role: SynergyItem["role"];
    roleLabel: string;
    reason: string;
    priority: SupplementPriority;
    /** Optional: only suggest if this biomarker condition is met */
    condition?: (vault: BioVaultData | null) => boolean;
  }>;
}> = {
  "bpc-157": {
    name: "BPC-157",
    icon: "🧬",
    category: "Tissue Repair Peptide",
    isFutureBio: true,
    mechanism: "BPC-157 upregulates VEGF and FAK-paxillin for tissue repair — synergistic compounds provide the raw substrates and cofactors for accelerated healing",
    synergies: [
      {
        id: "syn-collagen", name: "Collagen Peptides (Type I/III)", dose: "15g", icon: "🦴",
        timing: "AM · With BPC-157 dose", role: "substrate", roleLabel: "Tissue Substrate",
        reason: "Provides hydroxyproline and glycine — the primary building blocks BPC-157 directs to repair sites via VEGF-mediated angiogenesis",
        priority: "critical",
      },
      {
        id: "syn-vitc", name: "Vitamin C (Liposomal)", dose: "1,000mg", icon: "🍊",
        timing: "AM · With collagen", role: "cofactor", roleLabel: "Collagen Cofactor",
        reason: "Essential cofactor for prolyl hydroxylase — without adequate Vitamin C, collagen cross-linking fails and BPC-157's repair signaling has no substrate to act on",
        priority: "recommended",
      },
      {
        id: "syn-zinc-bpc", name: "Zinc Carnosine", dose: "75mg", icon: "🛡️",
        timing: "With food", role: "amplifier", roleLabel: "Gut-Tissue Amplifier",
        reason: "Zinc carnosine synergizes with BPC-157's gastric healing — together they accelerate mucosal repair and reduce intestinal permeability by 40-60%",
        priority: "recommended",
        condition: (vault) => (vault?.crp ?? 0) > 1.0,
      },
    ],
  },
  "cjc-1295": {
    name: "CJC-1295 + Ipamorelin",
    icon: "💉",
    category: "GH Secretagogue",
    isFutureBio: true,
    mechanism: "CJC-1295/Ipamorelin triggers pulsatile GH release — synergistic compounds optimize the sleep window and provide substrates for GH-mediated repair",
    synergies: [
      {
        id: "syn-melatonin", name: "Melatonin (Low Dose)", dose: "0.3-0.5mg", icon: "🌙",
        timing: "PM · 30min before CJC dose", role: "timing", roleLabel: "GH Pulse Timer",
        reason: "Low-dose melatonin synchronizes the first GH pulse with Stage 3 deep sleep onset — amplifying the natural nocturnal GH surge by 20-30%",
        priority: "recommended",
      },
      {
        id: "syn-glycine-gh", name: "Glycine", dose: "3g", icon: "❄️",
        timing: "PM · With CJC dose", role: "amplifier", roleLabel: "Sleep Onset Amplifier",
        reason: "Glycine lowers core body temperature by 0.5°C — accelerating sleep onset so CJC-1295's GH pulse coincides with the deepest sleep phase",
        priority: "recommended",
      },
      {
        id: "syn-arginine", name: "L-Arginine", dose: "3g", icon: "💪",
        timing: "PM · Empty stomach", role: "amplifier", roleLabel: "GH Potentiator",
        reason: "L-Arginine suppresses somatostatin (GH inhibitor) — removing the brake so CJC-1295's GHRH signal produces a larger GH pulse",
        priority: "optional",
      },
    ],
  },
  "tb-500": {
    name: "TB-500 (Thymosin Beta-4)",
    icon: "🔬",
    category: "Systemic Repair Peptide",
    isFutureBio: true,
    mechanism: "TB-500 promotes cell migration and reduces fibrosis — synergistic compounds support the extracellular matrix remodeling it initiates",
    synergies: [
      {
        id: "syn-collagen-tb", name: "Collagen Peptides (Type II)", dose: "10g", icon: "🦴",
        timing: "AM · With food", role: "substrate", roleLabel: "Joint Matrix Substrate",
        reason: "Type II collagen provides the cartilage-specific building blocks that TB-500's cell migration signals direct to damaged joint surfaces",
        priority: "critical",
      },
      {
        id: "syn-msm", name: "MSM (Methylsulfonylmethane)", dose: "3g", icon: "⚙️",
        timing: "AM · With food", role: "cofactor", roleLabel: "Sulfur Donor",
        reason: "MSM provides bioavailable sulfur for disulfide bonds in connective tissue — essential for the structural integrity TB-500 is rebuilding",
        priority: "recommended",
      },
    ],
  },
  "ss-31": {
    name: "SS-31 (Elamipretide)",
    icon: "⚡",
    category: "Mitochondrial Peptide",
    isFutureBio: true,
    mechanism: "SS-31 restores cardiolipin in the inner mitochondrial membrane — synergistic compounds support the electron transport chain it's repairing",
    synergies: [
      {
        id: "syn-coq10", name: "CoQ10 (Ubiquinol)", dose: "200mg", icon: "🔋",
        timing: "AM · With fat", role: "amplifier", roleLabel: "ETC Complex III Support",
        reason: "CoQ10 shuttles electrons between Complex I/II and Complex III — while SS-31 repairs the membrane, CoQ10 ensures the chain has its key electron carrier",
        priority: "critical",
      },
      {
        id: "syn-pqq", name: "PQQ (Pyrroloquinoline Quinone)", dose: "20mg", icon: "🧬",
        timing: "AM · With food", role: "amplifier", roleLabel: "Mitochondrial Biogenesis",
        reason: "PQQ stimulates mitochondrial biogenesis via PGC-1α — creating new mitochondria while SS-31 repairs existing ones for maximum energy output",
        priority: "recommended",
      },
    ],
  },
  // ── Non-peptide supplement synergies ──
  "omega3-epa": {
    name: "Omega-3 (High EPA)",
    icon: "🐟",
    category: "Anti-Inflammatory",
    isFutureBio: false,
    mechanism: "EPA resolves inflammation via ALOX5 pathway — synergistic compounds target complementary inflammatory cascades",
    synergies: [
      {
        id: "syn-curcumin-o3", name: "Curcumin + Piperine", dose: "1,000mg", icon: "🌿",
        timing: "With EPA dose", role: "amplifier", roleLabel: "NF-kB Modulator",
        reason: "Curcumin targets NF-kB while EPA targets ALOX5 — dual-pathway inflammation reduction is 3× more effective than either alone",
        priority: "recommended",
      },
      {
        id: "syn-vitd-o3", name: "Vitamin D3", dose: "5,000 IU", icon: "☀️",
        timing: "AM · With EPA", role: "amplifier", roleLabel: "Immune Modulator",
        reason: "Vitamin D3 and EPA co-regulate the same immune cell populations — combined, they shift macrophage polarization from M1 (inflammatory) to M2 (resolving)",
        priority: "recommended",
        condition: (vault) => (vault?.vitaminD ?? 50) < 40,
      },
    ],
  },
  "mag-threonate": {
    name: "Magnesium L-Threonate",
    icon: "🧲",
    category: "Neural Recovery",
    isFutureBio: false,
    mechanism: "Mg-Threonate crosses the BBB to restore synaptic magnesium — synergistic compounds support the neural pathways it's repairing",
    synergies: [
      {
        id: "syn-theanine-mg", name: "L-Theanine", dose: "200mg", icon: "🍵",
        timing: "PM · With Mg-Threonate", role: "amplifier", roleLabel: "Alpha Wave Enhancer",
        reason: "L-Theanine promotes alpha brain waves while Mg-Threonate restores synaptic density — together they create a calm-focus state ideal for parasympathetic recovery",
        priority: "recommended",
      },
      {
        id: "syn-taurine", name: "Taurine", dose: "2g", icon: "💧",
        timing: "PM · Before bed", role: "amplifier", roleLabel: "GABA Potentiator",
        reason: "Taurine activates GABA-A receptors — combined with Mg-Threonate's synaptic effects, this creates a powerful anxiolytic and sleep-promoting stack",
        priority: "optional",
      },
    ],
  },
  "creatine": {
    name: "Creatine Monohydrate",
    icon: "⚡",
    category: "Performance",
    isFutureBio: false,
    mechanism: "Creatine saturates phosphocreatine stores for ATP regeneration — synergistic compounds support the energy systems it fuels",
    synergies: [
      {
        id: "syn-hmb", name: "HMB (β-Hydroxy β-Methylbutyrate)", dose: "3g", icon: "💪",
        timing: "Pre-workout", role: "amplifier", roleLabel: "Anti-Catabolic",
        reason: "HMB prevents muscle protein breakdown while creatine fuels ATP — together they shift the anabolic/catabolic balance toward net muscle protein synthesis",
        priority: "optional",
      },
    ],
  },
};

/**
 * Generate stack synergies for a list of active compounds.
 * Returns grouped stacks showing which supplements amplify each other.
 */
export function generateStackSynergies(
  activeCompounds: string[],
  vault: BioVaultData | null,
): StackSynergy[] {
  const stacks: StackSynergy[] = [];

  for (const compoundId of activeCompounds) {
    const entry = SYNERGY_MAP[compoundId];
    if (!entry) continue;

    const applicableSynergies: SynergyItem[] = [];
    for (const syn of entry.synergies) {
      // Check optional condition
      if (syn.condition && !syn.condition(vault)) continue;
      applicableSynergies.push({
        id: syn.id,
        name: syn.name,
        dose: syn.dose,
        icon: syn.icon,
        timing: syn.timing,
        role: syn.role,
        roleLabel: syn.roleLabel,
        reason: syn.reason,
        priority: syn.priority,
      });
    }

    if (applicableSynergies.length > 0) {
      stacks.push({
        id: `stack-${compoundId}`,
        primaryCompound: entry.name,
        primaryIcon: entry.icon,
        primaryCategory: entry.category,
        synergisticItems: applicableSynergies,
        mechanismSummary: entry.mechanism,
        stackConfidence: Math.min(95, 60 + applicableSynergies.length * 12),
        isFutureBio: entry.isFutureBio,
      });
    }
  }

  return stacks;
}

/** Get all known synergy compound IDs */
export function getSynergyCompoundIds(): string[] {
  return Object.keys(SYNERGY_MAP);
}

/** Check if a compound name matches a synergy entry */
export function matchCompoundToSynergyId(name: string): string | null {
  const lower = name.toLowerCase();
  const mappings: Record<string, string[]> = {
    "bpc-157": ["bpc-157", "bpc157", "bpc 157"],
    "cjc-1295": ["cjc-1295", "cjc1295", "cjc 1295", "ipamorelin"],
    "tb-500": ["tb-500", "tb500", "tb 500", "thymosin"],
    "ss-31": ["ss-31", "ss31", "elamipretide"],
    "omega3-epa": ["omega-3", "omega3", "epa", "fish oil"],
    "mag-threonate": ["magnesium l-threonate", "mag-threonate", "magtein"],
    "creatine": ["creatine"],
  };
  for (const [id, keywords] of Object.entries(mappings)) {
    if (keywords.some(k => lower.includes(k))) return id;
  }
  return null;
}

export function generatePrecisionStack(
  vault: BioVaultData | null,
  focus: PrecisionFocus,
): PrecisionStack {
  const completeness = calcCompleteness(vault);
  const isPersonalized = completeness >= 30;
  const items: PrecisionItem[] = [];

  /* ────────────────────────────────────────────────────────────────
     BIOMARKER-DRIVEN ITEMS — personalized from blood panels
     ──────────────────────────────────────────────────────────────── */

  // Vitamin D → CYP2R1 gene pathway
  if (vault?.vitaminD != null && vault.vitaminD < 40) {
    const severe = vault.vitaminD < 20;
    items.push({
      id: "ps-vitd3",
      name: "Vitamin D3 + K2 MK-7",
      dose: severe ? "10,000 IU" : "5,000 IU",
      gene: "CYP2R1",
      reason: `Blood: ${vault.vitaminD} ng/mL → Optimized for your CYP2R1 hydroxylation pathway`,
      icon: "☀️",
      timing: "AM · With fat-containing meal",
      priority: severe ? "critical" : "recommended",
      source: "biomarker",
    });
  } else if (!vault?.vitaminD) {
    items.push({
      id: "ps-vitd3-base",
      name: "Vitamin D3 + K2 MK-7",
      dose: "2,000 IU",
      gene: "CYP2R1",
      reason: "Baseline dose — upload blood panel for CYP2R1-optimized dosing",
      icon: "☀️",
      timing: "AM · With food",
      priority: "optional",
      source: "baseline",
    });
  }

  // Ferritin → SLC40A1 absorption pathway
  if (vault?.ferritin != null && vault.ferritin < 50) {
    const severe = vault.ferritin < 20;
    items.push({
      id: "ps-iron",
      name: "Iron Bisglycinate + Vitamin C",
      dose: severe ? "36mg" : "18mg",
      gene: "SLC40A1",
      reason: `Ferritin: ${vault.ferritin} ng/mL → Chelated form tuned to SLC40A1 absorption`,
      icon: "🩸",
      timing: "AM · Empty stomach",
      priority: severe ? "critical" : "recommended",
      source: "biomarker",
    });
  }

  // CRP → ALOX5 inflammatory cascade
  if (vault?.crp != null && vault.crp > 1.0) {
    const elevated = vault.crp > 3.0;
    items.push({
      id: "ps-epa",
      name: "Omega-3 (High EPA)",
      dose: elevated ? "4,000mg" : "2,000mg",
      gene: "ALOX5",
      reason: `CRP: ${vault.crp} mg/L → EPA targeting ALOX5 inflammatory cascade`,
      icon: "🐟",
      timing: "AM · With food",
      priority: elevated ? "critical" : "recommended",
      source: "biomarker",
    });
    if (elevated) {
      items.push({
        id: "ps-curcumin",
        name: "Curcumin + Piperine",
        dose: "1,000mg",
        gene: "NF-kB",
        reason: `CRP: ${vault.crp} mg/L → Curcumin modulates NF-kB transcription factor`,
        icon: "🌿",
        timing: "PM · With food",
        priority: "recommended",
        source: "biomarker",
      });
    }
  }

  // HbA1c → TCF7L2 variant / AMPK pathway
  if (vault?.hba1c != null && vault.hba1c > 5.4) {
    const preDiabetic = vault.hba1c > 5.7;
    items.push({
      id: "ps-berberine",
      name: "Berberine HCl",
      dose: preDiabetic ? "1,500mg (3×500mg)" : "500mg",
      gene: "TCF7L2 / AMPK",
      reason: `HbA1c: ${vault.hba1c}% → Berberine activates AMPK via TCF7L2 pathway`,
      icon: "🌿",
      timing: preDiabetic ? "3× daily · With meals" : "PM · With dinner",
      priority: preDiabetic ? "critical" : "recommended",
      source: "biomarker",
    });
  }

  // Testosterone → AR gene / SHBG modulation
  if (
    (vault?.testosteroneTotal != null && vault.testosteroneTotal < 500) ||
    (vault?.testosteroneFree != null && vault.testosteroneFree < 10)
  ) {
    items.push({
      id: "ps-tongkat",
      name: "Tongkat Ali (Eurycoma longifolia)",
      dose: "400mg",
      gene: "AR / SHBG",
      reason: `T: ${vault?.testosteroneTotal ?? "—"} ng/dL → Modulates SHBG binding via AR gene`,
      icon: "💪",
      timing: "AM · Empty stomach",
      priority: "recommended",
      source: "biomarker",
    });
  }

  /* ────────────────────────────────────────────────────────────────
     GENETIC-DRIVEN ITEMS — from DNA toggles
     ──────────────────────────────────────────────────────────────── */

  // MTHFR variant → impaired methylation enzyme
  if (vault?.mthfrVariant) {
    items.push({
      id: "ps-methylb",
      name: "Methylated B-Complex",
      dose: "1 capsule (5-MTHF + MeCbl)",
      gene: "MTHFR C677T",
      reason: "MTHFR variant detected — bypasses impaired methylenetetrahydrofolate reductase",
      icon: "🧬",
      timing: "AM · With breakfast",
      priority: "critical",
      source: "genetic",
    });
  }

  // APOE4 → amyloid clearance via TREM2
  if (vault?.apoe4) {
    items.push({
      id: "ps-dha",
      name: "Omega-3 (High DHA)",
      dose: "2,000mg",
      gene: "APOE4 / TREM2",
      reason: "APOE4 carrier — DHA supports amyloid clearance via TREM2 microglial pathway",
      icon: "🧠",
      timing: "AM · With food",
      priority: "critical",
      source: "genetic",
    });
    items.push({
      id: "ps-ps",
      name: "Phosphatidylserine",
      dose: "100mg",
      gene: "APOE4",
      reason: "APOE4 neuroprotection — supports cortisol modulation and membrane fluidity",
      icon: "🧠",
      timing: "PM · Before bed",
      priority: "recommended",
      source: "genetic",
    });
  }

  // CYP1A2 slow caffeine metabolizer
  if (vault?.caffeineSensitivity) {
    items.push({
      id: "ps-theanine",
      name: "L-Theanine",
      dose: "200mg",
      gene: "CYP1A2",
      reason: "Slow CYP1A2 metabolizer — L-Theanine smooths adrenergic response to caffeine",
      icon: "🍵",
      timing: "AM · Pair with coffee",
      priority: "recommended",
      source: "genetic",
    });
  }

  /* ────────────────────────────────────────────────────────────────
     FOCUS-SPECIFIC STACKS
     ──────────────────────────────────────────────────────────────── */

  if (focus === "performance") {
    items.push({
      id: "ps-creatine",
      name: "Creatine Monohydrate",
      dose: "5g",
      gene: "GATM",
      reason: "Saturates phosphocreatine stores via GATM-mediated synthesis for peak power output",
      icon: "⚡",
      timing: "Pre-workout · -30min",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-citrulline",
      name: "L-Citrulline Malate",
      dose: "8g",
      gene: "NOS3",
      reason: "Upregulates nitric oxide via NOS3 endothelial pathway — vasodilation + endurance",
      icon: "🔴",
      timing: "Pre-workout · -30min",
      priority: "recommended",
      source: "focus",
    });
    if (!vault?.caffeineSensitivity) {
      items.push({
        id: "ps-caffeine",
        name: "Caffeine Anhydrous",
        dose: "200mg",
        gene: "CYP1A2 (fast)",
        reason: "CYP1A2 fast metabolizer cleared — safe ergogenic dose for acute performance",
        icon: "☕",
        timing: "Pre-workout · -45min",
        priority: "optional",
        source: "focus",
      });
    }
    items.push({
      id: "ps-beta-alanine",
      name: "Beta-Alanine",
      dose: "3.2g",
      gene: "CARNS1",
      reason: "Buffers H+ ions via carnosine synthase (CARNS1) — delays muscular fatigue",
      icon: "🔥",
      timing: "Pre-workout · -30min",
      priority: "optional",
      source: "focus",
    });
  } else if (focus === "recovery") {
    items.push({
      id: "ps-mag-threonate",
      name: "Magnesium L-Threonate",
      dose: "400mg",
      gene: "TRPM7",
      reason: "Crosses BBB via TRPM7 channels — supports neural recovery and sleep architecture",
      icon: "🧲",
      timing: "PM · 1hr before bed",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-ashwagandha",
      name: "Ashwagandha KSM-66",
      dose: "600mg",
      gene: "HSD11B1",
      reason: "Modulates cortisol via 11β-HSD1 enzyme — reduces catabolic stress response",
      icon: "🧘",
      timing: "PM · With dinner",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-glycine",
      name: "Glycine",
      dose: "3g",
      gene: "COL1A1",
      reason: "Primary substrate for collagen synthesis (COL1A1) + lowers core temp for sleep onset",
      icon: "❄️",
      timing: "PM · Before bed",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-tart-cherry",
      name: "Tart Cherry Extract",
      dose: "500mg",
      gene: "COX-2",
      reason: "Natural COX-2 inhibitor — reduces DOMS and supports melatonin production",
      icon: "🍒",
      timing: "PM · With dinner",
      priority: "optional",
      source: "focus",
    });
  } else {
    // longevity
    items.push({
      id: "ps-nmn",
      name: "NMN (Nicotinamide Mononucleotide)",
      dose: "500mg",
      gene: "SIRT1 / NAD+",
      reason: "Precursor to NAD+ — activates SIRT1 deacetylase for cellular repair and longevity",
      icon: "🔬",
      timing: "AM · Empty stomach",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-resveratrol",
      name: "Trans-Resveratrol",
      dose: "500mg",
      gene: "SIRT1",
      reason: "Allosteric SIRT1 activator — synergizes with NMN for enhanced sirtuins activity",
      icon: "🍇",
      timing: "AM · With fat source",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-sulforaphane",
      name: "Sulforaphane (Broccoli Seed)",
      dose: "20mg",
      gene: "NRF2 / GSTP1",
      reason: "Activates NRF2 antioxidant pathway via GSTP1 — upregulates phase II detox enzymes",
      icon: "🥦",
      timing: "AM · With food",
      priority: "recommended",
      source: "focus",
    });
    items.push({
      id: "ps-spermidine",
      name: "Spermidine",
      dose: "1mg",
      gene: "ATG5 / Autophagy",
      reason: "Induces autophagy via ATG5 pathway — cellular cleanup and renewal",
      icon: "♻️",
      timing: "AM · Empty stomach",
      priority: "optional",
      source: "focus",
    });
  }

  /* ── Sort: critical → recommended → optional, biomarker → genetic → focus → baseline ── */
  const priorityOrder: Record<SupplementPriority, number> = { critical: 0, recommended: 1, optional: 2 };
  const sourceOrder: Record<PrecisionItem["source"], number> = { biomarker: 0, genetic: 1, focus: 2, baseline: 3 };
  items.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return sourceOrder[a.source] - sourceOrder[b.source];
  });

  const criticalCount = items.filter(i => i.priority === "critical").length;

  return {
    items,
    focus,
    dataCompleteness: completeness,
    tier: isPersonalized ? "personalized" : "baseline",
    generatedAt: Date.now(),
    totalItems: items.length,
    criticalCount,
  };
}
