/**
 * Vive 4.0 — Precision Stack Engine (Client-side)
 *
 * Re-exports the supplement logic for browser-side use.
 * This is a PURE LOGIC file — no Convex imports, no side effects.
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

export type SupplementPriority = "critical" | "recommended" | "optional";

export type PrecisionFocus = "performance" | "recovery" | "longevity";

export interface PrecisionItem {
  id: string;
  name: string;
  dose: string;
  gene: string;
  reason: string;
  icon: string;
  timing: string;
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
  filled += boolFields.length;
  for (const f of stringFields) {
    if (vault[f] && (vault[f] as string).length > 0) filled++;
  }

  return Math.round((filled / total) * 100);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN ENGINE: generatePrecisionStack
   Focus-aware, gene-specific supplement formulation
   ══════════════════════════════════════════════════════════════════ */

export function generatePrecisionStack(
  vault: BioVaultData | null,
  focus: PrecisionFocus,
): PrecisionStack {
  const completeness = calcCompleteness(vault);
  const isPersonalized = completeness >= 30;
  const items: PrecisionItem[] = [];

  /* ── BIOMARKER-DRIVEN ITEMS ── */

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

  /* ── GENETIC-DRIVEN ITEMS ── */

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

  /* ── FOCUS-SPECIFIC STACKS ── */

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
