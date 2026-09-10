import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL PROJECTION ENGINE
   
   Cross-references the user's active peptide/supplement stack with
   their uploaded blood work (bioVault + labResults). Computes:
   
   1. Synergy Score (0-100) — how well the stack supports biomarker goals
   2. Conflict Risks — specific supplements that may be causing off biomarkers
   3. AI Highlights — flagged items with clinical rationale
   
   Pure server-side computation, no AI calls needed.
   ═══════════════════════════════════════════════════════════════ */

/* ── Supplement → Biomarker Impact Map ── */
interface SupplementImpact {
  marker: string;
  direction: "increase" | "decrease";
  magnitude: "strong" | "moderate" | "mild";
  mechanism: string;
}

interface SupplementProfile {
  keywords: string[];
  category: "peptide" | "supplement" | "hormone" | "nootropic";
  impacts: SupplementImpact[];
  liverLoad: number; // 0-3 scale of hepatic stress
  kidneyLoad: number;
  icon: string;
}

const SUPPLEMENT_DB: Record<string, SupplementProfile> = {
  "bpc-157": {
    keywords: ["bpc", "bpc157", "bpc-157", "body protection compound"],
    category: "peptide",
    impacts: [
      { marker: "crp", direction: "decrease", magnitude: "moderate", mechanism: "Anti-inflammatory via NO pathway modulation" },
      { marker: "igf1", direction: "increase", magnitude: "mild", mechanism: "Growth factor signaling upregulation" },
    ],
    liverLoad: 0, kidneyLoad: 0, icon: "🧬",
  },
  "cjc-1295": {
    keywords: ["cjc", "cjc1295", "cjc-1295", "mod grf"],
    category: "peptide",
    impacts: [
      { marker: "igf1", direction: "increase", magnitude: "strong", mechanism: "GH secretagogue — pulsatile GH release via GHRH receptor" },
      { marker: "fastingGlucose", direction: "increase", magnitude: "mild", mechanism: "GH-mediated insulin antagonism" },
      { marker: "hba1c", direction: "increase", magnitude: "mild", mechanism: "Chronic GH elevation impairs glucose disposal" },
    ],
    liverLoad: 1, kidneyLoad: 0, icon: "💉",
  },
  "tb-500": {
    keywords: ["tb500", "tb-500", "thymosin beta"],
    category: "peptide",
    impacts: [
      { marker: "crp", direction: "decrease", magnitude: "moderate", mechanism: "Thymosin beta-4 modulates inflammatory cytokine cascade" },
      { marker: "ferritin", direction: "increase", magnitude: "mild", mechanism: "Tissue repair increases iron mobilization" },
    ],
    liverLoad: 0, kidneyLoad: 0, icon: "🩹",
  },
  "ipamorelin": {
    keywords: ["ipamorelin", "ipam"],
    category: "peptide",
    impacts: [
      { marker: "igf1", direction: "increase", magnitude: "strong", mechanism: "Selective GH secretagogue via ghrelin receptor" },
      { marker: "fastingGlucose", direction: "increase", magnitude: "mild", mechanism: "GH-mediated hepatic glucose output" },
    ],
    liverLoad: 0, kidneyLoad: 0, icon: "⚡",
  },
  "mk-677": {
    keywords: ["mk677", "mk-677", "ibutamoren"],
    category: "peptide",
    impacts: [
      { marker: "igf1", direction: "increase", magnitude: "strong", mechanism: "Oral GH secretagogue — sustained IGF-1 elevation" },
      { marker: "fastingGlucose", direction: "increase", magnitude: "moderate", mechanism: "Significant insulin resistance at higher doses" },
      { marker: "hba1c", direction: "increase", magnitude: "moderate", mechanism: "Chronic glucose dysregulation with prolonged use" },
    ],
    liverLoad: 1, kidneyLoad: 0, icon: "🔬",
  },
  "testosterone": {
    keywords: ["testosterone", "trt", "test cyp", "test e", "enanthate", "cypionate"],
    category: "hormone",
    impacts: [
      { marker: "testosteroneTotal", direction: "increase", magnitude: "strong", mechanism: "Exogenous androgen replacement" },
      { marker: "testosteroneFree", direction: "increase", magnitude: "strong", mechanism: "Direct free T elevation" },
      { marker: "hba1c", direction: "decrease", magnitude: "mild", mechanism: "Improved insulin sensitivity via lean mass" },
      { marker: "ferritin", direction: "increase", magnitude: "moderate", mechanism: "Erythropoiesis stimulation increases iron demand" },
      { marker: "crp", direction: "decrease", magnitude: "mild", mechanism: "Anti-inflammatory effect of optimized androgens" },
    ],
    liverLoad: 1, kidneyLoad: 1, icon: "💪",
  },
  "nac": {
    keywords: ["nac", "n-acetyl cysteine", "n-acetylcysteine"],
    category: "supplement",
    impacts: [
      { marker: "crp", direction: "decrease", magnitude: "moderate", mechanism: "Glutathione precursor — reduces oxidative stress" },
    ],
    liverLoad: 0, kidneyLoad: 0, icon: "🛡️",
  },
  "berberine": {
    keywords: ["berberine"],
    category: "supplement",
    impacts: [
      { marker: "hba1c", direction: "decrease", magnitude: "strong", mechanism: "AMPK activation — statin-equivalent glucose control" },
      { marker: "fastingGlucose", direction: "decrease", magnitude: "strong", mechanism: "Hepatic glucose output suppression" },
      { marker: "crp", direction: "decrease", magnitude: "mild", mechanism: "NF-kB pathway modulation" },
    ],
    liverLoad: 2, kidneyLoad: 1, icon: "🌿",
  },
  "omega-3": {
    keywords: ["omega", "fish oil", "epa", "dha", "omega-3", "omega3"],
    category: "supplement",
    impacts: [
      { marker: "crp", direction: "decrease", magnitude: "strong", mechanism: "EPA resolvin synthesis — pro-resolving mediators" },
    ],
    liverLoad: 0, kidneyLoad: 0, icon: "🐟",
  },
  "vitamin-d": {
    keywords: ["vitamin d", "d3", "cholecalciferol", "vit d"],
    category: "supplement",
    impacts: [
      { marker: "vitaminD", direction: "increase", magnitude: "strong", mechanism: "Direct 25-OH-D3 supplementation" },
      { marker: "crp", direction: "decrease", magnitude: "mild", mechanism: "Immunomodulatory anti-inflammatory effect" },
    ],
    liverLoad: 0, kidneyLoad: 0, icon: "☀️",
  },
  "curcumin": {
    keywords: ["curcumin", "turmeric"],
    category: "supplement",
    impacts: [
      { marker: "crp", direction: "decrease", magnitude: "moderate", mechanism: "NF-kB transcription factor modulation" },
    ],
    liverLoad: 1, kidneyLoad: 0, icon: "🌿",
  },
  "ashwagandha": {
    keywords: ["ashwagandha", "ksm-66", "ksm66", "withania"],
    category: "supplement",
    impacts: [
      { marker: "testosteroneTotal", direction: "increase", magnitude: "mild", mechanism: "Cortisol reduction frees DHEA for T synthesis" },
      { marker: "crp", direction: "decrease", magnitude: "mild", mechanism: "Adaptogenic stress-axis modulation" },
    ],
    liverLoad: 1, kidneyLoad: 0, icon: "🌱",
  },
  "creatine": {
    keywords: ["creatine", "creatine monohydrate"],
    category: "supplement",
    impacts: [
      { marker: "ferritin", direction: "increase", magnitude: "mild", mechanism: "Increased muscle turnover" },
    ],
    liverLoad: 0, kidneyLoad: 1, icon: "⚡",
  },
};

/* ── Biomarker Reference Ranges ── */
const BIOMARKER_RANGES: Record<string, { min: number; max: number; unit: string; label: string; direction: "lower" | "higher" | "range" }> = {
  vitaminD: { min: 40, max: 80, unit: "ng/mL", label: "Vitamin D", direction: "range" },
  testosteroneTotal: { min: 500, max: 1000, unit: "ng/dL", label: "Total Testosterone", direction: "higher" },
  testosteroneFree: { min: 15, max: 25, unit: "pg/mL", label: "Free Testosterone", direction: "higher" },
  ferritin: { min: 40, max: 200, unit: "ng/mL", label: "Ferritin", direction: "range" },
  crp: { min: 0, max: 1.0, unit: "mg/L", label: "hs-CRP", direction: "lower" },
  hba1c: { min: 4.0, max: 5.4, unit: "%", label: "HbA1c", direction: "lower" },
  igf1: { min: 100, max: 300, unit: "ng/mL", label: "IGF-1", direction: "range" },
  fastingGlucose: { min: 70, max: 95, unit: "mg/dL", label: "Fasting Glucose", direction: "lower" },
};

/* ── Match supplement name to DB entry ── */
function matchSupplement(name: string): { key: string; profile: SupplementProfile } | null {
  const lower = name.toLowerCase();
  for (const [key, profile] of Object.entries(SUPPLEMENT_DB)) {
    if (profile.keywords.some(kw => lower.includes(kw))) {
      return { key, profile };
    }
  }
  return null;
}

/* ── Types ── */
export interface ProjectionItem {
  supplementName: string;
  supplementKey: string;
  icon: string;
  category: string;
  synergyScore: number; // 0-100
  conflictRisks: ConflictRisk[];
  synergies: SynergyBenefit[];
  liverLoad: number;
  kidneyLoad: number;
}

export interface ConflictRisk {
  marker: string;
  markerLabel: string;
  currentValue: number | null;
  unit: string;
  optimalRange: string;
  direction: string;
  severity: "critical" | "high" | "moderate" | "low";
  explanation: string;
}

export interface SynergyBenefit {
  marker: string;
  markerLabel: string;
  currentValue: number | null;
  unit: string;
  direction: string;
  magnitude: string;
  explanation: string;
}

export interface ProjectionReport {
  items: ProjectionItem[];
  overallSynergyScore: number;
  totalConflicts: number;
  criticalConflicts: number;
  hepaticLoadScore: number; // 0-10
  renalLoadScore: number;
  topConflict: ConflictRisk | null;
  generatedAt: number;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN QUERY: getProtocolProjection
   ═══════════════════════════════════════════════════════════════ */

export const getProtocolProjection = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<ProjectionReport> => {
    const now = Date.now();

    // 1. Get active protocols (supplements + peptides)
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter(p => p.isActive);

    // 2. Get active substance cycles (peptides/HRT)
    const cycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId_and_status", (q: any) => q.eq("sessionId", args.sessionId).eq("status", "active"))
      .collect();

    // 3. Get bioVault data
    const vaultDocs = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    const vault = vaultDocs[0] || null;

    // 4. Get latest lab results for each marker
    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    // Build biomarker snapshot from vault + labs
    const biomarkers: Record<string, number | null> = {};
    for (const key of Object.keys(BIOMARKER_RANGES)) {
      // Try vault first
      const vaultVal = vault ? (vault as any)[key] : null;
      if (vaultVal != null) {
        biomarkers[key] = vaultVal;
        continue;
      }
      // Fall back to latest lab result
      const labMatch = labResults
        .filter(l => l.marker.toLowerCase().replace(/[\s-_]/g, "") === key.toLowerCase())
        .sort((a, b) => b.testedAt - a.testedAt);
      biomarkers[key] = labMatch.length > 0 ? labMatch[0].value : null;
    }

    // 5. Build supplement list from protocols + cycles
    const supplementNames: { name: string; source: string }[] = [];

    for (const p of activeProtocols) {
      if (p.category === "supplement" || p.category === "biohacking") {
        supplementNames.push({ name: p.name, source: "protocol" });
      }
    }
    for (const c of cycles) {
      supplementNames.push({ name: c.substanceName, source: "cycle" });
    }

    // 6. Compute projection for each supplement
    const items: ProjectionItem[] = [];
    let totalHepaticLoad = 0;
    let totalRenalLoad = 0;

    for (const { name } of supplementNames) {
      const match = matchSupplement(name);
      if (!match) continue;

      // Avoid duplicates
      if (items.some(i => i.supplementKey === match.key)) continue;

      const { key, profile } = match;
      const conflicts: ConflictRisk[] = [];
      const synergies: SynergyBenefit[] = [];

      for (const impact of profile.impacts) {
        const range = BIOMARKER_RANGES[impact.marker];
        if (!range) continue;
        const currentVal = biomarkers[impact.marker];

        const optimalStr = range.direction === "lower"
          ? `< ${range.max} ${range.unit}`
          : range.direction === "higher"
            ? `> ${range.min} ${range.unit}`
            : `${range.min}–${range.max} ${range.unit}`;

        // Determine if this is a conflict or synergy
        const isOutOfRange = currentVal != null && (
          currentVal < range.min || currentVal > range.max
        );

        if (isOutOfRange && currentVal != null) {
          // Check if supplement pushes marker further out of range
          const markerTooHigh = currentVal > range.max;
          const markerTooLow = currentVal < range.min;
          const pushesWrong = (markerTooHigh && impact.direction === "increase") ||
                              (markerTooLow && impact.direction === "decrease");

          if (pushesWrong) {
            const deviation = markerTooHigh
              ? ((currentVal - range.max) / range.max) * 100
              : ((range.min - currentVal) / range.min) * 100;

            const severity: ConflictRisk["severity"] = deviation > 30 ? "critical"
              : deviation > 15 ? "high"
              : deviation > 5 ? "moderate" : "low";

            conflicts.push({
              marker: impact.marker,
              markerLabel: range.label,
              currentValue: currentVal,
              unit: range.unit,
              optimalRange: optimalStr,
              direction: impact.direction === "increase" ? "↑ Elevating" : "↓ Suppressing",
              severity,
              explanation: `${name} ${impact.direction === "increase" ? "elevates" : "suppresses"} ${range.label} via ${impact.mechanism}. Current: ${currentVal} ${range.unit} (target: ${optimalStr}).`,
            });
          } else {
            // Supplement helps correct the out-of-range marker
            synergies.push({
              marker: impact.marker,
              markerLabel: range.label,
              currentValue: currentVal,
              unit: range.unit,
              direction: impact.direction === "increase" ? "↑" : "↓",
              magnitude: impact.magnitude,
              explanation: `${impact.mechanism} — helping correct ${range.label} toward optimal.`,
            });
          }
        } else if (currentVal != null) {
          // Marker is in range — supplement is synergistic
          synergies.push({
            marker: impact.marker,
            markerLabel: range.label,
            currentValue: currentVal,
            unit: range.unit,
            direction: impact.direction === "increase" ? "↑" : "↓",
            magnitude: impact.magnitude,
            explanation: impact.mechanism,
          });
        }
      }

      // Compute per-supplement synergy score
      const totalImpacts = conflicts.length + synergies.length;
      const conflictPenalty = conflicts.reduce((sum, c) => {
        const w = c.severity === "critical" ? 40 : c.severity === "high" ? 25 : c.severity === "moderate" ? 12 : 5;
        return sum + w;
      }, 0);
      const synergyBonus = synergies.length * 15;
      const rawScore = Math.max(0, Math.min(100, 70 + synergyBonus - conflictPenalty));
      const synergyScore = totalImpacts === 0 ? 50 : rawScore;

      totalHepaticLoad += profile.liverLoad;
      totalRenalLoad += profile.kidneyLoad;

      items.push({
        supplementName: name,
        supplementKey: key,
        icon: profile.icon,
        category: profile.category,
        synergyScore,
        conflictRisks: conflicts,
        synergies,
        liverLoad: profile.liverLoad,
        kidneyLoad: profile.kidneyLoad,
      });
    }

    // 7. Compute overall scores
    const allConflicts = items.flatMap(i => i.conflictRisks);
    const criticalConflicts = allConflicts.filter(c => c.severity === "critical").length;
    const overallSynergy = items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.synergyScore, 0) / items.length)
      : 0;

    // Sort: lowest synergy (most conflicts) first
    items.sort((a, b) => a.synergyScore - b.synergyScore);

    const topConflict = allConflicts.sort((a, b) => {
      const sev = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
    })[0] || null;

    return {
      items,
      overallSynergyScore: overallSynergy,
      totalConflicts: allConflicts.length,
      criticalConflicts,
      hepaticLoadScore: Math.min(10, totalHepaticLoad),
      renalLoadScore: Math.min(10, totalRenalLoad),
      topConflict,
      generatedAt: now,
    };
  },
});
