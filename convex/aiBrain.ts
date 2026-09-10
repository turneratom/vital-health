import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   generateLabInterpretation — AI-Powered Blood Panel Interpreter
   
   Takes an array of biomarker results (name, value, unit) and
   generates plain-English interpretations grouped by category:
   Hormonal, Metabolic, Inflammatory, Micronutrient.
   Each marker gets a status badge + one-line AI recommendation.
   ═══════════════════════════════════════════════════════════════ */

const LAB_INTERPRETATION_RANGES: Record<string, {
  label: string;
  unit: string;
  optMin: number;
  optMax: number;
  warnLow?: number;
  warnHigh?: number;
  category: "hormonal" | "metabolic" | "inflammatory" | "micronutrient" | "cardiovascular";
  lowRec: string;
  highRec: string;
  optRec: string;
}> = {
  testosterone_total: {
    label: "Testosterone (Total)",
    unit: "ng/dL",
    optMin: 500, optMax: 900, warnLow: 300, warnHigh: 1100,
    category: "hormonal",
    lowRec: "Prioritize 8h sleep, zinc 30mg, cold exposure 2min AM, and compound lifts to upregulate Leydig cell function.",
    highRec: "Monitor estradiol conversion — consider aromatase assessment if symptoms present.",
    optRec: "Testosterone is well-optimized — maintain current sleep and training protocols.",
  },
  testosterone_free: {
    label: "Testosterone (Free)",
    unit: "pg/mL",
    optMin: 15, optMax: 25, warnLow: 9, warnHigh: 30,
    category: "hormonal",
    lowRec: "Check SHBG levels — boron 10mg/day and nettle root may improve free T bioavailability.",
    highRec: "Elevated free T — monitor DHT-sensitive tissues and check SHBG.",
    optRec: "Free testosterone bioavailability is excellent — tissue uptake is optimized.",
  },
  dhea_s: {
    label: "DHEA-S",
    unit: "µg/dL",
    optMin: 200, optMax: 400, warnLow: 100, warnHigh: 500,
    category: "hormonal",
    lowRec: "Adrenal reserve depleted — reduce chronic stressors, add adaptogenic support (ashwagandha 600mg).",
    highRec: "Elevated DHEA-S — rule out adrenal hyperplasia if persistent.",
    optRec: "Adrenal reserve is strong — stress resilience and longevity signaling intact.",
  },
  hba1c: {
    label: "HbA1c",
    unit: "%",
    optMin: 4.5, optMax: 5.4, warnHigh: 5.7,
    category: "metabolic",
    lowRec: "HbA1c unusually low — ensure adequate caloric intake and rule out hemolytic conditions.",
    highRec: "Insulin resistance developing — implement 16:8 fasting, post-meal walks, and reduce refined carbs.",
    optRec: "Glucose metabolism is well-regulated — metabolic flexibility intact.",
  },
  fasting_insulin: {
    label: "Fasting Insulin",
    unit: "µIU/mL",
    optMin: 2, optMax: 6, warnHigh: 10,
    category: "metabolic",
    lowRec: "Very low insulin — ensure adequate carbohydrate intake for thyroid and adrenal function.",
    highRec: "Hyperinsulinemia detected — prioritize time-restricted eating and resistance training for GLUT4 upregulation.",
    optRec: "Insulin sensitivity is excellent — metabolic flexibility is high.",
  },
  crp: {
    label: "hs-CRP",
    unit: "mg/L",
    optMin: 0, optMax: 1.0, warnHigh: 3.0,
    category: "inflammatory",
    lowRec: "CRP is very low — systemic inflammation minimal.",
    highRec: "Systemic inflammation elevated — add omega-3 (EPA 2g/day), cold exposure, and identify inflammatory triggers.",
    optRec: "Inflammation is well-controlled — immune system operating efficiently.",
  },
  vitamin_d: {
    label: "Vitamin D",
    unit: "ng/mL",
    optMin: 40, optMax: 80, warnLow: 30, warnHigh: 100,
    category: "micronutrient",
    lowRec: "Supplement D3 5000 IU + K2 MK-7 200mcg daily. Add 10-20min morning sunlight exposure.",
    highRec: "Vitamin D elevated — reduce supplementation and retest in 60 days.",
    optRec: "Vitamin D is optimized — immune function, bone density, and mood regulation supported.",
  },
  ferritin: {
    label: "Ferritin",
    unit: "ng/mL",
    optMin: 40, optMax: 150, warnLow: 20, warnHigh: 300,
    category: "micronutrient",
    lowRec: "Iron stores depleted — add iron bisglycinate 25mg with vitamin C on empty stomach. Avoid coffee within 2h.",
    highRec: "Ferritin elevated — rule out inflammation or hemochromatosis. Consider blood donation.",
    optRec: "Iron stores are adequate — oxygen transport and mitochondrial function supported.",
  },
  apob: {
    label: "ApoB",
    unit: "mg/dL",
    optMin: 40, optMax: 80, warnHigh: 100,
    category: "cardiovascular",
    lowRec: "ApoB very low — excellent atherogenic particle count.",
    highRec: "Atherogenic particle count elevated — consider statin or PCSK9 discussion with physician. Increase soluble fiber.",
    optRec: "Cardiovascular risk profile is excellent — atherogenic particle count well-managed.",
  },
  homocysteine: {
    label: "Homocysteine",
    unit: "µmol/L",
    optMin: 5, optMax: 9, warnHigh: 12,
    category: "cardiovascular",
    lowRec: "Homocysteine very low — methylation pathways efficient.",
    highRec: "Methylation impaired — add methylfolate 1mg + methylcobalamin 1000mcg. Check MTHFR status.",
    optRec: "Methylation efficiency is optimal — cardiovascular and cognitive risk minimized.",
  },
};

type InterpretedMarker = {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: "hormonal" | "metabolic" | "inflammatory" | "micronutrient" | "cardiovascular";
  status: "optimal" | "suboptimal" | "critical";
  statusLabel: string;
  recommendation: string;
  optimalRange: [number, number];
  percentFromOptimal: number;
};

type InterpretationCategory = {
  id: string;
  label: string;
  icon: string;
  markers: InterpretedMarker[];
  overallStatus: "optimal" | "suboptimal" | "critical";
};

export const generateLabInterpretation = action({
  args: {
    sessionId: v.string(),
    markers: v.array(v.object({
      id: v.string(),
      value: v.number(),
      unit: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<{
    categories: InterpretationCategory[];
    overallSummary: string;
    criticalCount: number;
    optimalCount: number;
    totalMarkers: number;
    generatedAt: number;
    source: "llm" | "local";
  }> => {
    const now = Date.now();
    const interpreted: InterpretedMarker[] = [];

    /* ── Interpret each marker locally ── */
    for (const m of args.markers) {
      const def = LAB_INTERPRETATION_RANGES[m.id];
      if (!def) continue;

      let status: "optimal" | "suboptimal" | "critical" = "optimal";
      let statusLabel = "Optimal";
      let recommendation = def.optRec;
      let percentFromOptimal = 0;

      if (m.value < def.optMin) {
        const pctBelow = ((def.optMin - m.value) / def.optMin) * 100;
        percentFromOptimal = -pctBelow;
        if (def.warnLow && m.value < def.warnLow) {
          status = "critical";
          statusLabel = "Low";
        } else {
          status = "suboptimal";
          statusLabel = "Below Optimal";
        }
        recommendation = def.lowRec;
      } else if (m.value > def.optMax) {
        const pctAbove = ((m.value - def.optMax) / def.optMax) * 100;
        percentFromOptimal = pctAbove;
        if (def.warnHigh && m.value > def.warnHigh) {
          status = "critical";
          statusLabel = "High";
        } else {
          status = "suboptimal";
          statusLabel = "Above Optimal";
        }
        recommendation = def.highRec;
      }

      interpreted.push({
        id: m.id,
        name: def.label,
        value: m.value,
        unit: def.unit,
        category: def.category,
        status,
        statusLabel,
        recommendation,
        optimalRange: [def.optMin, def.optMax],
        percentFromOptimal: Math.round(percentFromOptimal),
      });
    }

    /* ── Group by category ── */
    const categoryMap: Record<string, { label: string; icon: string; markers: InterpretedMarker[] }> = {
      hormonal: { label: "Hormonal", icon: "⚡", markers: [] },
      metabolic: { label: "Metabolic", icon: "🩸", markers: [] },
      inflammatory: { label: "Inflammatory", icon: "🛡️", markers: [] },
      micronutrient: { label: "Micronutrient", icon: "☀️", markers: [] },
      cardiovascular: { label: "Cardiovascular", icon: "❤️", markers: [] },
    };

    for (const m of interpreted) {
      categoryMap[m.category]?.markers.push(m);
    }

    const categories: InterpretationCategory[] = Object.entries(categoryMap)
      .filter(([_, v]) => v.markers.length > 0)
      .map(([id, v]) => {
        const hasCritical = v.markers.some(m => m.status === "critical");
        const hasSub = v.markers.some(m => m.status === "suboptimal");
        return {
          id,
          label: v.label,
          icon: v.icon,
          markers: v.markers,
          overallStatus: hasCritical ? "critical" as const : hasSub ? "suboptimal" as const : "optimal" as const,
        };
      });

    const criticalCount = interpreted.filter(m => m.status === "critical").length;
    const optimalCount = interpreted.filter(m => m.status === "optimal").length;

    /* ── Try LLM for overall summary ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;
    let overallSummary = "";
    let source: "llm" | "local" = "local";

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN && interpreted.length >= 2) {
      try {
        const markerSummary = interpreted.map(m =>
          `${m.name}: ${m.value} ${m.unit} [${m.statusLabel}]`
        ).join(", ");

        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content: `You are a world-class longevity physician reviewing a patient's blood panel. Write a 2-sentence clinical summary of their results. Sentence 1: Overall assessment referencing specific values. Sentence 2: The single most important action item. Be precise, clinical, and confident. No hedging. Return ONLY the 2 sentences as plain text, no JSON.`,
              },
              { role: "user", content: `Blood panel results: ${markerSummary}` },
            ],
            temperature: 0.3,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
          if (raw.length > 20) {
            overallSummary = raw;
            source = "llm";
          }
        }
      } catch { /* fall through to local */ }
    }

    if (!overallSummary) {
      /* ── Local fallback summary ── */
      if (criticalCount > 0) {
        const critMarkers = interpreted.filter(m => m.status === "critical");
        overallSummary = `${criticalCount} marker${criticalCount > 1 ? "s" : ""} require${criticalCount === 1 ? "s" : ""} immediate attention: ${critMarkers.map(m => `${m.name} at ${m.value} ${m.unit}`).join(", ")}. ${critMarkers[0].recommendation}`;
      } else if (optimalCount === interpreted.length) {
        overallSummary = `All ${interpreted.length} biomarkers are within optimal range — your biological systems are well-calibrated. Maintain current protocols and retest at 90-day intervals to track longitudinal trends.`;
      } else {
        const subMarkers = interpreted.filter(m => m.status === "suboptimal");
        overallSummary = `${optimalCount}/${interpreted.length} markers optimal with ${subMarkers.length} requiring fine-tuning: ${subMarkers.map(m => m.name).join(", ")}. Focus on the highest-leverage intervention first for maximum systemic impact.`;
      }
    }

    return {
      categories,
      overallSummary,
      criticalCount,
      optimalCount,
      totalMarkers: interpreted.length,
      generatedAt: now,
      source,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   AI BRAIN — Contextual Brief + Intelligence Insights Generator
   
   Pulls the latest labResults, protocolLogs, and bioVault data.
   Uses the correlation engine logic to identify:
     1. One Positive Trend (what's working)
     2. One Required Adjustment (what needs recalibration)
   
   NEW: generateInsights action produces targeted micro-insights
   by cross-referencing cortisol↔sleep, HRV↔protocol adherence,
   biomarker drift, and protocol-specific impact analysis.
   ═══════════════════════════════════════════════════════════════ */

/* ── Protocol → Biomarker Correlation Map (mirrors correlationEngine.ts) ── */
const PROTOCOL_MARKER_MAP: Record<string, string[]> = {
  sunlight: ["vitaminD", "crp", "testosteroneTotal"],
  magnesium: ["crp", "hba1c", "testosteroneFree"],
  cold: ["crp", "testosteroneTotal"],
  sleep: ["crp", "hba1c", "testosteroneTotal", "testosteroneFree"],
  detox: ["crp"],
  exercise: ["crp", "hba1c", "testosteroneTotal", "ferritin"],
  movement: ["hba1c"],
  walk: ["hba1c"],
  omega: ["crp"],
  fish: ["crp"],
  vitamin: ["vitaminD"],
  iron: ["ferritin"],
  zinc: ["testosteroneTotal", "testosteroneFree"],
  fasting: ["hba1c", "crp"],
};

/* ── Optimal ranges for biomarkers ── */
const OPTIMAL_RANGES: Record<string, { min: number; max: number; unit: string; label: string }> = {
  vitaminD: { min: 40, max: 80, unit: "ng/mL", label: "Vitamin D" },
  testosteroneTotal: { min: 400, max: 900, unit: "ng/dL", label: "Total Testosterone" },
  testosteroneFree: { min: 15, max: 25, unit: "pg/mL", label: "Free Testosterone" },
  ferritin: { min: 40, max: 200, unit: "ng/mL", label: "Ferritin" },
  crp: { min: 0, max: 1.0, unit: "mg/L", label: "hs-CRP" },
  hba1c: { min: 4.0, max: 5.6, unit: "%", label: "HbA1c" },
};

/* ── Cross-Domain Correlation Rules ──
   Each rule defines a multi-signal pattern that triggers a specific insight.
   When conditions from different biological domains align, the insight fires. */
interface CorrelationRule {
  id: string;
  label: string;
  category: "sleep_stress" | "inflammation" | "hormonal" | "metabolic" | "recovery" | "protocol_drift";
  icon: string;
  severity: "info" | "warning" | "critical";
  check: (ctx: InsightContext) => string | null; // returns insight text or null
  protocolFix: (ctx: InsightContext) => string;
}

interface InsightContext {
  bioVault: any;
  hrvData: { current?: number; avg7d?: number; trend?: string; baseline?: number };
  sleepData: { score?: number; hours?: number; deepPct?: number; efficiency?: number; latencyMin?: number };
  protocolAdherence: { total: number; completed: number; rate: number };
  protocolLogs: Array<{ protocolName: string; category: string; loggedAt: number }>;
  biomarkerAssessments: Array<{ key: string; status: string; label: string; value: number }>;
  caffeineData: { todayMg?: number; lastIntakeAt?: number; sensitivity?: boolean };
  eliteScore: { score: number } | null;
  missedCategories: Set<string>;
}

const CORRELATION_RULES: CorrelationRule[] = [
  /* ── 1. Cortisol ↔ Sleep Axis ── */
  {
    id: "cortisol_sleep_cascade",
    label: "Cortisol-Sleep Cascade",
    category: "sleep_stress",
    icon: "🌙",
    severity: "warning",
    check: (ctx) => {
      const crpHigh = ctx.bioVault?.crp != null && ctx.bioVault.crp > 1.5;
      const sleepLow = ctx.sleepData.hours != null && ctx.sleepData.hours < 6.5;
      const sleepScoreLow = ctx.sleepData.score != null && ctx.sleepData.score < 65;
      if (crpHigh && (sleepLow || sleepScoreLow)) {
        const crpVal = ctx.bioVault.crp.toFixed(1);
        const sleepVal = ctx.sleepData.hours?.toFixed(1) ?? "N/A";
        return `hs-CRP elevated at ${crpVal} mg/L with sleep at ${sleepVal}h — cortisol dysregulation is amplifying systemic inflammation. Sleep deprivation raises IL-6 and TNF-α, creating a feed-forward inflammatory loop.`;
      }
      return null;
    },
    protocolFix: () => "Enforce 9pm Screen-Off Protocol + Magnesium Glycinate 400mg. Target 7.5h minimum sleep to break the cortisol-inflammation cycle within 72h.",
  },
  /* ── 2. HRV Depression ↔ Protocol Adherence ── */
  {
    id: "hrv_adherence_drift",
    label: "Autonomic Drift",
    category: "recovery",
    icon: "💓",
    severity: "warning",
    check: (ctx) => {
      const hrvDepressed = ctx.hrvData.current && ctx.hrvData.avg7d && ctx.hrvData.current < ctx.hrvData.avg7d * 0.82;
      const lowAdherence = ctx.protocolAdherence.rate < 0.5;
      if (hrvDepressed && lowAdherence) {
        const pctBelow = Math.round(((ctx.hrvData.avg7d! - ctx.hrvData.current!) / ctx.hrvData.avg7d!) * 100);
        return `HRV ${pctBelow}% below 7-day baseline at ${ctx.hrvData.current}ms — protocol adherence at ${Math.round(ctx.protocolAdherence.rate * 100)}% is insufficient to maintain parasympathetic tone.`;
      }
      return null;
    },
    protocolFix: (ctx) => {
      const missedCats = Array.from(ctx.missedCategories).slice(0, 2);
      return missedCats.length > 0
        ? `Prioritize ${missedCats.join(" and ")} protocols. HRV recovery requires 3+ consecutive days of ≥80% adherence to re-establish autonomic baseline.`
        : "Resume full protocol stack. Focus on sleep and cold exposure protocols to restore vagal tone within 48-72h.";
    },
  },
  /* ── 3. Inflammation ↔ Exercise Gap ── */
  {
    id: "inflammation_exercise_gap",
    label: "Inflammatory Stagnation",
    category: "inflammation",
    icon: "🔥",
    severity: "critical",
    check: (ctx) => {
      const crpElevated = ctx.bioVault?.crp != null && ctx.bioVault.crp > 2.0;
      const noMovement = ctx.missedCategories.has("training") || ctx.missedCategories.has("movement");
      if (crpElevated && noMovement) {
        return `hs-CRP at ${ctx.bioVault.crp.toFixed(1)} mg/L with no movement protocols logged — skeletal muscle IL-6 release (the body's primary anti-inflammatory mechanism) is offline.`;
      }
      return null;
    },
    protocolFix: () => "Resume Movement Protocol immediately. Even 20min moderate walking triggers myokine release that reduces CRP by 15-20% within 48h. Add Cold Plunge 2min post-movement for norepinephrine-mediated anti-inflammatory cascade.",
  },
  /* ── 4. Testosterone ↔ Sleep + Zinc ── */
  {
    id: "testosterone_sleep_zinc",
    label: "Hormonal Suppression",
    category: "hormonal",
    icon: "⚡",
    severity: "warning",
    check: (ctx) => {
      const tLow = ctx.bioVault?.testosteroneTotal != null && ctx.bioVault.testosteroneTotal < 350;
      const sleepInsufficient = ctx.sleepData.hours != null && ctx.sleepData.hours < 7;
      const noSupplements = ctx.missedCategories.has("supplement");
      if (tLow && (sleepInsufficient || noSupplements)) {
        const tVal = ctx.bioVault.testosteroneTotal;
        const reason = sleepInsufficient
          ? `sleep at ${ctx.sleepData.hours?.toFixed(1)}h (70% of T is produced during deep sleep)`
          : "supplement protocols missed (zinc/magnesium are direct T precursors)";
        return `Total Testosterone at ${tVal} ng/dL — ${reason}. Leydig cell function is compromised.`;
      }
      return null;
    },
    protocolFix: () => "Priority: Sleep Protocol (target 8h) + Zinc 30mg + Magnesium 400mg before bed. Cold exposure 2min AM to upregulate Leydig cell function via hormetic stress.",
  },
  /* ── 5. Metabolic Drift — HbA1c ↔ Fasting/Movement ── */
  {
    id: "metabolic_drift",
    label: "Metabolic Drift",
    category: "metabolic",
    icon: "📊",
    severity: "warning",
    check: (ctx) => {
      const hba1cHigh = ctx.bioVault?.hba1c != null && ctx.bioVault.hba1c > 5.7;
      const noFasting = !ctx.protocolLogs.some(l => l.protocolName.toLowerCase().includes("fast"));
      const noMovement = ctx.missedCategories.has("movement") || ctx.missedCategories.has("training");
      if (hba1cHigh && (noFasting || noMovement)) {
        return `HbA1c at ${ctx.bioVault.hba1c}% — insulin sensitivity is declining. ${noMovement ? "No movement protocols logged" : "No fasting protocols detected"} to counteract glucose dysregulation.`;
      }
      return null;
    },
    protocolFix: () => "Implement 16:8 intermittent fasting window. Add 15min post-meal walk to blunt glucose spikes by 30-40%. Resume resistance training 3x/week for GLUT4 transporter upregulation.",
  },
  /* ── 6. Caffeine ↔ Sleep Interference ── */
  {
    id: "caffeine_sleep_interference",
    label: "Caffeine-Sleep Conflict",
    category: "sleep_stress",
    icon: "☕",
    severity: "info",
    check: (ctx) => {
      const highCaffeine = ctx.caffeineData.todayMg != null && ctx.caffeineData.todayMg > 300;
      const lateIntake = ctx.caffeineData.lastIntakeAt != null && (new Date(ctx.caffeineData.lastIntakeAt).getHours() >= 14);
      const poorSleep = ctx.sleepData.score != null && ctx.sleepData.score < 70;
      const isSensitive = ctx.caffeineData.sensitivity === true;
      if ((highCaffeine || (lateIntake && isSensitive)) && poorSleep) {
        const mg = ctx.caffeineData.todayMg ?? 0;
        return `${mg}mg caffeine consumed${lateIntake ? " with intake after 2pm" : ""}${isSensitive ? " (CYP1A2 slow metabolizer)" : ""} — sleep score at ${ctx.sleepData.score}/100. Adenosine receptor blockade is fragmenting deep sleep architecture.`;
      }
      return null;
    },
    protocolFix: (ctx) => {
      const cutoff = ctx.caffeineData.sensitivity ? "10am" : "12pm";
      return `Enforce caffeine cutoff at ${cutoff}. ${ctx.caffeineData.sensitivity ? "Your CYP1A2 variant extends caffeine half-life to ~8h. " : ""}Limit to 200mg/day max. Replace PM caffeine with L-theanine 200mg for sustained focus without sleep disruption.`;
    },
  },
  /* ── 7. Vitamin D ↔ Sunlight Protocol Gap ── */
  {
    id: "vitamin_d_sunlight_gap",
    label: "Photonic Deficit",
    category: "protocol_drift",
    icon: "☀️",
    severity: "info",
    check: (ctx) => {
      const dLow = ctx.bioVault?.vitaminD != null && ctx.bioVault.vitaminD < 35;
      const noSunlight = !ctx.protocolLogs.some(l => l.protocolName.toLowerCase().includes("sun") || l.protocolName.toLowerCase().includes("light"));
      if (dLow && noSunlight) {
        return `Vitamin D at ${ctx.bioVault.vitaminD} ng/mL with no sunlight protocols logged — cholecalciferol synthesis is offline. This impacts calcium absorption, immune function, and steroidogenesis.`;
      }
      return null;
    },
    protocolFix: () => "Resume 7am Sunlight Protocol (10-20min direct exposure within 30min of waking). Bridge with Vitamin D3 5000 IU + K2 MK-7 200mcg daily until levels reach 50+ ng/mL.",
  },
  /* ── 8. Ferritin ↔ Energy/Recovery ── */
  {
    id: "iron_depletion_signal",
    label: "Iron Depletion Signal",
    category: "metabolic",
    icon: "🩸",
    severity: "critical",
    check: (ctx) => {
      const ferritinLow = ctx.bioVault?.ferritin != null && ctx.bioVault.ferritin < 30;
      if (ferritinLow) {
        return `Ferritin at ${ctx.bioVault.ferritin} ng/mL — iron stores critically depleted. Oxygen transport capacity, mitochondrial electron chain function, and thyroid hormone conversion are all compromised.`;
      }
      return null;
    },
    protocolFix: () => "Add Iron Bisglycinate 25mg with Vitamin C 500mg on empty stomach AM. Avoid calcium/coffee within 2h of iron dose. Retest ferritin in 8 weeks. Target: 80-150 ng/mL.",
  },
  /* ── 9. Recovery Score ↔ Overtraining ── */
  {
    id: "overtraining_signal",
    label: "Overtraining Detection",
    category: "recovery",
    icon: "⚠️",
    severity: "warning",
    check: (ctx) => {
      const hrvDown = ctx.hrvData.trend === "down" && ctx.hrvData.current && ctx.hrvData.baseline && ctx.hrvData.current < ctx.hrvData.baseline * 0.8;
      const highTraining = ctx.protocolLogs.filter(l => l.category === "training").length > 5;
      const poorSleep = ctx.sleepData.score != null && ctx.sleepData.score < 60;
      if (hrvDown && highTraining && poorSleep) {
        return `HRV trending down to ${ctx.hrvData.current}ms (baseline: ${ctx.hrvData.baseline}ms) with ${ctx.protocolLogs.filter(l => l.category === "training").length} training sessions and sleep score ${ctx.sleepData.score}/100 — sympathetic overdrive detected. Recovery debt is accumulating.`;
      }
      return null;
    },
    protocolFix: () => "Shift to Active Recovery mode for 48-72h: replace high-intensity training with Zone 2 cardio (HR < 130bpm). Prioritize sleep (target 9h). Add Ashwagandha 600mg for cortisol modulation.",
  },
  /* ── 10. Positive: Elite Momentum ── */
  {
    id: "elite_momentum",
    label: "Elite Momentum",
    category: "recovery",
    icon: "🏆",
    severity: "info",
    check: (ctx) => {
      const highScore = ctx.eliteScore && ctx.eliteScore.score >= 80;
      const goodAdherence = ctx.protocolAdherence.rate >= 0.8;
      const hrvUp = ctx.hrvData.trend === "up" || (ctx.hrvData.current && ctx.hrvData.avg7d && ctx.hrvData.current > ctx.hrvData.avg7d * 1.05);
      if (highScore && goodAdherence && hrvUp) {
        return `Vitality Score ${ctx.eliteScore!.score}/100 with ${Math.round(ctx.protocolAdherence.rate * 100)}% adherence — HRV trending upward. All biological systems are synchronized and responding to protocol architecture.`;
      }
      return null;
    },
    protocolFix: () => "Maintain current protocol cadence. This is the compounding phase — consistency here yields exponential biomarker improvement over the next 30 days.",
  },
];

/* ── Helper: match protocol name to affected markers ── */
function getAffectedMarkers(protocolName: string): string[] {
  const lower = protocolName.toLowerCase();
  const markers = new Set<string>();
  for (const [keyword, affected] of Object.entries(PROTOCOL_MARKER_MAP)) {
    if (lower.includes(keyword)) {
      for (const m of affected) markers.add(m);
    }
  }
  return Array.from(markers);
}

/* ── Helper: assess a biomarker value against optimal range ── */
function assessMarker(key: string, value: number): { status: "optimal" | "suboptimal" | "critical"; label: string; detail: string } {
  const range = OPTIMAL_RANGES[key];
  if (!range) return { status: "optimal", label: key, detail: `${value}` };

  if (value < range.min) {
    const pctBelow = Math.round(((range.min - value) / range.min) * 100);
    const severity = pctBelow > 25 ? "critical" : "suboptimal";
    return { status: severity, label: range.label, detail: `${value} ${range.unit} (${pctBelow}% below optimal ${range.min}-${range.max})` };
  }
  if (value > range.max) {
    const pctAbove = Math.round(((value - range.max) / range.max) * 100);
    const severity = pctAbove > 25 ? "critical" : "suboptimal";
    return { status: severity, label: range.label, detail: `${value} ${range.unit} (${pctAbove}% above optimal ceiling of ${range.max})` };
  }
  return { status: "optimal", label: range.label, detail: `${value} ${range.unit} — within optimal range` };
}

/* ── Helper: build InsightContext from raw data ── */
function buildInsightContext(
  bioVault: any,
  protocolLogs: Array<{ protocolName: string; category: string; loggedAt: number }>,
  biomarkerAssessments: Array<{ key: string; status: string; label: string; value: number }>,
  protocolStatus: { done: number; total: number },
  eliteScore: { score: number } | null,
): InsightContext {
  const hrvData = {
    current: bioVault?.hrvCurrent ?? undefined,
    avg7d: bioVault?.hrvAvg7d ?? undefined,
    trend: bioVault?.hrvTrend ?? undefined,
    baseline: bioVault?.hrvBaseline ?? undefined,
  };
  const sleepData = {
    score: bioVault?.sleepScore ?? undefined,
    hours: bioVault?.sleepHours ?? undefined,
    deepPct: bioVault?.sleepDeepPct ?? undefined,
    efficiency: bioVault?.sleepEfficiency ?? undefined,
    latencyMin: bioVault?.sleepLatencyMin ?? undefined,
  };
  const caffeineData = {
    todayMg: bioVault?.caffeineTodayMg ?? undefined,
    lastIntakeAt: bioVault?.caffeineLastIntakeAt ?? undefined,
    sensitivity: bioVault?.caffeineSensitivity ?? false,
  };

  // Determine which protocol categories are missing today
  const loggedCategories = new Set(protocolLogs.map(l => l.category.toLowerCase()));
  const allCategories = ["supplement", "training", "movement", "recovery", "biohacking", "nutrition"];
  const missedCategories = new Set<string>();
  for (const cat of allCategories) {
    if (!loggedCategories.has(cat)) missedCategories.add(cat);
  }

  return {
    bioVault,
    hrvData,
    sleepData,
    protocolAdherence: {
      total: protocolStatus.total,
      completed: protocolStatus.done,
      rate: protocolStatus.total > 0 ? protocolStatus.done / protocolStatus.total : 0,
    },
    protocolLogs,
    biomarkerAssessments,
    caffeineData,
    eliteScore,
    missedCategories,
  };
}

/* ═══════════════════════════════════════════════════════════════
   generateInsights — Cross-Domain Intelligence Engine
   
   Runs all correlation rules against current biological state.
   Returns an array of targeted micro-insights with severity,
   category, and specific protocol adjustments.
   ═══════════════════════════════════════════════════════════════ */

export const generateInsights = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    insights: Array<{
      id: string;
      label: string;
      category: string;
      icon: string;
      severity: "info" | "warning" | "critical";
      message: string;
      protocolFix: string;
      timestamp: number;
    }>;
    dataPoints: number;
    generatedAt: number;
  }> => {
    const now = Date.now();
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;

    /* ── Pull all data sources ── */
    const bioVault = await ctx.runQuery(
      "queries:getBioVaultBySession" as any,
      { sessionId: args.sessionId }
    ).catch(() => null);

    let protocolLogs: Array<{ protocolName: string; category: string; loggedAt: number }> = [];
    try {
      const allLogs = await ctx.runQuery(
        "queries:getTodayProtocolLogs" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(allLogs)) protocolLogs = allLogs;
    } catch { /* continue */ }

    let protocolStatus = { done: 0, total: 0 };
    try {
      const status = await ctx.runQuery(
        "protocols:getTodayProtocolStatus" as any,
        { sessionId: args.sessionId }
      );
      if (status) protocolStatus = { done: status.done ?? 0, total: status.total ?? 0 };
    } catch { /* continue */ }

    let eliteScore: { score: number } | null = null;
    try {
      const scores = await ctx.runQuery(
        "queries:getVitalityScores14d" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(scores) && scores.length > 0) {
        eliteScore = { score: scores[scores.length - 1].score };
      }
    } catch { /* continue */ }

    /* ── Assess biomarkers ── */
    const biomarkerAssessments: Array<{ key: string; status: string; label: string; value: number }> = [];
    let dataPoints = 0;
    if (bioVault) {
      const markerKeys = ["vitaminD", "testosteroneTotal", "testosteroneFree", "ferritin", "crp", "hba1c"] as const;
      for (const key of markerKeys) {
        const val = (bioVault as any)[key];
        if (val != null && typeof val === "number") {
          dataPoints++;
          const assessment = assessMarker(key, val);
          biomarkerAssessments.push({ key, ...assessment, value: val });
        }
      }
    }
    if (bioVault?.hrvCurrent) dataPoints++;
    if (bioVault?.sleepScore) dataPoints++;
    if (eliteScore) dataPoints++;
    dataPoints += Math.min(protocolLogs.length, 15);

    /* ── Build context and run correlation rules ── */
    const insightCtx = buildInsightContext(bioVault, protocolLogs, biomarkerAssessments, protocolStatus, eliteScore);

    const insights: Array<{
      id: string;
      label: string;
      category: string;
      icon: string;
      severity: "info" | "warning" | "critical";
      message: string;
      protocolFix: string;
      timestamp: number;
    }> = [];

    for (const rule of CORRELATION_RULES) {
      const message = rule.check(insightCtx);
      if (message) {
        insights.push({
          id: rule.id,
          label: rule.label,
          category: rule.category,
          icon: rule.icon,
          severity: rule.severity,
          message,
          protocolFix: rule.protocolFix(insightCtx),
          timestamp: now,
        });
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      insights,
      dataPoints,
      generatedAt: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   generateContextualBrief — Main AI Brain Action
   
   Gathers all biological data, computes local correlations,
   then sends to LLM for a precision 3-sentence brief.
   Falls back to local analysis if LLM is unavailable.
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   generateBiologicalSummary — Mirror Component Summary Engine
   
   Generates a high-fidelity 2-sentence biological summary that
   reads like a briefing from a top-tier longevity physician.
   Sentence 1: Current internal state assessment with specifics.
   Sentence 2: The single most important trajectory signal.
   ═══════════════════════════════════════════════════════════════ */

export const generateBiologicalSummary = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    summary: string;
    statusLabel: string;
    statusThermal: "optimal" | "good" | "attention" | "warning" | "critical";
    confidence: number;
    keySignals: Array<{ label: string; value: string; status: string }>;
    generatedAt: number;
    source: "llm" | "local";
  }> => {
    const now = Date.now();

    /* ── Pull BioVault ── */
    let bioVault: any = null;
    try {
      bioVault = await ctx.runQuery(
        "queries:getBioVaultBySession" as any,
        { sessionId: args.sessionId }
      );
    } catch { /* continue */ }

    /* ── Pull Elite Score ── */
    let eliteScore: number | null = null;
    try {
      const scores = await ctx.runQuery(
        "queries:getVitalityScores14d" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(scores) && scores.length > 0) {
        eliteScore = scores[scores.length - 1].score;
      }
    } catch { /* continue */ }

    /* ── Pull Protocol Adherence ── */
    let protocolRate = 0;
    try {
      const status = await ctx.runQuery(
        "protocols:getTodayProtocolStatus" as any,
        { sessionId: args.sessionId }
      );
      if (status && status.total > 0) protocolRate = status.done / status.total;
    } catch { /* continue */ }

    /* ── Pull Somatic Feedback (latest) ── */
    let somaticSignals: Array<{ channel: string; value: number; label: string }> = [];
    try {
      const feedback = await ctx.runQuery(
        "somaticLog:getLatestSomaticSnapshot" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(feedback)) somaticSignals = feedback;
    } catch { /* continue */ }

    /* ── Assess key biomarkers ── */
    const keySignals: Array<{ label: string; value: string; status: string }> = [];
    let dataPoints = 0;

    if (bioVault) {
      const checks: Array<{ key: string; label: string; unit: string; optMin: number; optMax: number }> = [
        { key: "crp", label: "hs-CRP", unit: "mg/L", optMin: 0, optMax: 1.0 },
        { key: "hrvCurrent", label: "HRV", unit: "ms", optMin: 40, optMax: 120 },
        { key: "sleepScore", label: "Sleep", unit: "/100", optMin: 70, optMax: 100 },
        { key: "testosteroneTotal", label: "Total T", unit: "ng/dL", optMin: 400, optMax: 900 },
        { key: "vitaminD", label: "Vitamin D", unit: "ng/mL", optMin: 40, optMax: 80 },
        { key: "hba1c", label: "HbA1c", unit: "%", optMin: 4.0, optMax: 5.6 },
        { key: "ferritin", label: "Ferritin", unit: "ng/mL", optMin: 40, optMax: 200 },
      ];
      for (const c of checks) {
        const val = (bioVault as any)[c.key];
        if (val != null && typeof val === "number") {
          dataPoints++;
          const status = val >= c.optMin && val <= c.optMax ? "optimal" : val < c.optMin * 0.7 || val > c.optMax * 1.3 ? "critical" : "suboptimal";
          keySignals.push({ label: c.label, value: `${val}${c.unit}`, status });
        }
      }
    }
    if (eliteScore != null) {
      dataPoints++;
      keySignals.push({ label: "Vitality", value: `${eliteScore}/100`, status: eliteScore >= 75 ? "optimal" : eliteScore >= 50 ? "suboptimal" : "critical" });
    }

    /* ── Determine overall thermal ── */
    const critCount = keySignals.filter(s => s.status === "critical").length;
    const subCount = keySignals.filter(s => s.status === "suboptimal").length;
    const optCount = keySignals.filter(s => s.status === "optimal").length;
    const statusThermal: "optimal" | "good" | "attention" | "warning" | "critical" =
      critCount >= 2 ? "critical" : critCount >= 1 ? "warning" : subCount >= 2 ? "attention" : optCount >= 3 ? "optimal" : "good";

    const statusLabels = { optimal: "Peak State", good: "Operational", attention: "Recalibrating", warning: "Recovery Needed", critical: "Priority Mode" };
    const statusLabel = statusLabels[statusThermal];
    const confidence = Math.min(100, Math.round((dataPoints / 7) * 100));

    /* ── Build context for LLM ── */
    const contextParts: string[] = [];
    if (keySignals.length > 0) {
      contextParts.push("BIOMARKERS: " + keySignals.map(s => `${s.label}: ${s.value} [${s.status}]`).join(", "));
    }
    if (bioVault?.sleepHours) contextParts.push(`Sleep: ${bioVault.sleepHours}h`);
    if (protocolRate > 0) contextParts.push(`Protocol adherence: ${Math.round(protocolRate * 100)}%`);
    if (somaticSignals.length > 0) {
      contextParts.push("Somatic: " + somaticSignals.map(s => `${s.channel}: ${s.value}/100`).join(", "));
    }
    contextParts.push(`Status: ${statusLabel} (${statusThermal})`);

    /* ── Try LLM ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN && dataPoints >= 2) {
      try {
        const sysPrompt = `You are a world-class longevity physician delivering a morning briefing. Generate EXACTLY 2 sentences about the patient's current internal state.

Sentence 1: Assess the current biological state — reference specific biomarker values and what they indicate about systemic function (inflammation, recovery, hormonal balance, metabolic health).
Sentence 2: Identify the single most important trajectory signal — what's improving, what's lagging, and the one thing that matters most right now.

TONE: Clinical precision with quiet confidence. Like Peter Attia meets Andrew Huberman. No fluff, no hedging. Reference real numbers.
FORMAT: Return ONLY a JSON object: { "summary": "Two sentences here." }
RULES: No code fences. No markdown. Just the JSON object.`;

        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: contextParts.join("\n") },
            ],
            temperature: 0.3,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content ?? "";
          let jsonStr = raw.trim();
          const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fence) jsonStr = fence[1].trim();
          const b0 = jsonStr.indexOf("{");
          const b1 = jsonStr.lastIndexOf("}");
          if (b0 !== -1 && b1 !== -1) jsonStr = jsonStr.slice(b0, b1 + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.summary) {
              return { summary: parsed.summary, statusLabel, statusThermal, confidence, keySignals: keySignals.slice(0, 5), generatedAt: now, source: "llm" };
            }
          } catch { /* fall through */ }
        }
      } catch { /* fall through to local */ }
    }

    /* ── Local Fallback ── */
    const s1Parts: string[] = [];
    const crpSig = keySignals.find(s => s.label === "hs-CRP");
    const hrvSig = keySignals.find(s => s.label === "HRV");
    const sleepSig = keySignals.find(s => s.label === "Sleep");
    const tSig = keySignals.find(s => s.label === "Total T");

    if (crpSig) {
      s1Parts.push(crpSig.status === "optimal" ? `Systemic inflammation is well-controlled at ${crpSig.value}` : `Inflammatory markers elevated at ${crpSig.value} — immune system under load`);
    }
    if (hrvSig) {
      s1Parts.push(hrvSig.status === "optimal" ? `autonomic recovery strong at ${hrvSig.value}` : `neural recovery lagging at ${hrvSig.value}`);
    }
    if (s1Parts.length === 0) {
      if (sleepSig) s1Parts.push(`Sleep architecture scoring ${sleepSig.value}`);
      else s1Parts.push("Biological systems at baseline — awaiting deeper signal mapping");
    }
    const sentence1 = s1Parts.join(", ") + ".";

    let sentence2 = "";
    const critSignal = keySignals.find(s => s.status === "critical");
    const optSignal = keySignals.find(s => s.status === "optimal");
    if (critSignal && optSignal) {
      sentence2 = `${optSignal.label} is performing well, but ${critSignal.label} at ${critSignal.value} is the primary recalibration target — address this first for maximum systemic impact.`;
    } else if (critSignal) {
      sentence2 = `${critSignal.label} at ${critSignal.value} requires immediate protocol attention — this is your highest-leverage intervention point.`;
    } else if (optSignal) {
      sentence2 = `${optSignal.label} at ${optSignal.value} confirms your protocols are working — maintain current cadence and the compounding effect will accelerate.`;
    } else {
      sentence2 = "Add blood panel data and wearable metrics to unlock precision-grade biological intelligence.";
    }

    const summary = `${sentence1.charAt(0).toUpperCase()}${sentence1.slice(1)} ${sentence2}`;

    return { summary, statusLabel, statusThermal, confidence, keySignals: keySignals.slice(0, 5), generatedAt: now, source: "local" };
  },
});

export const generateContextualBrief = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    brief: string;
    positiveTrend: string;
    requiredAdjustment: string;
    dataPoints: number;
    generatedAt: number;
    source: "llm" | "local";
  }> => {
    const now = Date.now();
    const lookback30d = 30 * 24 * 60 * 60 * 1000;
    const cutoff30d = now - lookback30d;

    /* ── 1. Pull BioVault ── */
    const bioVault = await ctx.runQuery(
      "queries:getBioVaultBySession" as any,
      { sessionId: args.sessionId }
    ).catch(() => null);

    /* ── 2. Pull Lab Results (last 90 days) ── */
    let labResults: Array<{ marker: string; value: number; unit: string; testedAt: number }> = [];
    try {
      const allLabs = await ctx.runQuery(
        "queries:getLabResults" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(allLabs)) {
        labResults = allLabs
          .filter((l: any) => l.testedAt >= cutoff30d * 3) // 90 days
          .sort((a: any, b: any) => b.testedAt - a.testedAt);
      }
    } catch {
      // Lab results query may not exist — continue with bioVault data
    }

    /* ── 3. Pull Protocol Logs (last 30 days) ── */
    let protocolLogs: Array<{ protocolName: string; category: string; loggedAt: number; status?: string }> = [];
    try {
      const allLogs = await ctx.runQuery(
        "queries:getTodayProtocolLogs" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(allLogs)) {
        protocolLogs = allLogs;
      }
    } catch {
      // Protocol logs query may not exist — continue
    }

    /* ── 4. Pull Protocol Completions (last 7 days for adherence) ── */
    let completions: Array<{ protocolItemId: string; completed: boolean; completedAt: number; dateKey: string }> = [];
    try {
      const allCompletions = await ctx.runQuery(
        "correlationEngine:getProtocolAdherenceHistory" as any,
        { sessionId: args.sessionId, days: 7 }
      );
      if (allCompletions?.dailyRates) {
        completions = allCompletions.dailyRates;
      }
    } catch {
      // Continue without completions
    }

    /* ── 5. Pull Elite Score ── */
    let eliteScore: { score: number; fuelingPoints: number; movementPoints: number; hrvPoints: number; basePoints: number } | null = null;
    try {
      const scores = await ctx.runQuery(
        "queries:getVitalityScores14d" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(scores) && scores.length > 0) {
        const latest = scores[scores.length - 1];
        eliteScore = {
          score: latest.score,
          fuelingPoints: latest.fuelingPoints,
          movementPoints: latest.movementPoints,
          hrvPoints: latest.hrvPoints,
          basePoints: latest.basePoints,
        };
      }
    } catch {
      // Continue without elite score
    }

    /* ── 6. Pull HRV Readings ── */
    let hrvData: { current?: number; avg7d?: number; trend?: string; baseline?: number } = {};
    if (bioVault) {
      hrvData = {
        current: bioVault.hrvCurrent ?? undefined,
        avg7d: bioVault.hrvAvg7d ?? undefined,
        trend: bioVault.hrvTrend ?? undefined,
        baseline: bioVault.hrvBaseline ?? undefined,
      };
    }

    /* ── 7. Pull Sleep Data ── */
    let sleepData: { score?: number; hours?: number; deepPct?: number; efficiency?: number } = {};
    if (bioVault) {
      sleepData = {
        score: bioVault.sleepScore ?? undefined,
        hours: bioVault.sleepHours ?? undefined,
        deepPct: bioVault.sleepDeepPct ?? undefined,
        efficiency: bioVault.sleepEfficiency ?? undefined,
      };
    }

    /* ── 8. Compute Local Correlations ── */
    let dataPoints = 0;
    const biomarkerAssessments: Array<{ key: string; status: string; label: string; detail: string }> = [];

    if (bioVault) {
      const markerKeys = ["vitaminD", "testosteroneTotal", "testosteroneFree", "ferritin", "crp", "hba1c"] as const;
      for (const key of markerKeys) {
        const val = (bioVault as any)[key];
        if (val != null && typeof val === "number") {
          dataPoints++;
          const assessment = assessMarker(key, val);
          biomarkerAssessments.push({ key, ...assessment });
        }
      }
    }

    for (const _lab of labResults.slice(0, 20)) {
      dataPoints++;
    }

    const protocolCount = protocolLogs.length;
    dataPoints += Math.min(protocolCount, 30);

    if (hrvData.current) dataPoints++;
    if (sleepData.score) dataPoints++;
    if (eliteScore) dataPoints++;

    /* ── 9. Identify Positive Trend (local analysis) ── */
    const optimalMarkers = biomarkerAssessments.filter(a => a.status === "optimal");
    const suboptimalMarkers = biomarkerAssessments.filter(a => a.status !== "optimal");

    let localPositiveTrend = "";
    if (optimalMarkers.length > 0) {
      const best = optimalMarkers[0];
      localPositiveTrend = `${best.label} is ${best.detail}`;
    } else if (hrvData.current && hrvData.avg7d && hrvData.current > hrvData.avg7d) {
      const pctAbove = Math.round(((hrvData.current - hrvData.avg7d) / hrvData.avg7d) * 100);
      localPositiveTrend = `HRV trending ${pctAbove}% above 7-day baseline at ${hrvData.current}ms — parasympathetic recovery is strengthening`;
    } else if (eliteScore && eliteScore.score >= 70) {
      localPositiveTrend = `Vitality Score at ${eliteScore.score}/100 — system operating above threshold`;
    } else if (protocolCount > 15) {
      localPositiveTrend = `${protocolCount} protocol completions in 30 days — adherence momentum is building`;
    } else {
      localPositiveTrend = "System baseline established — data collection phase active";
    }

    /* ── 10. Identify Required Adjustment (local analysis) ── */
    let localRequiredAdjustment = "";
    if (suboptimalMarkers.length > 0) {
      const critical = suboptimalMarkers.find(a => a.status === "critical") || suboptimalMarkers[0];
      const affectingProtocols: string[] = [];
      for (const log of protocolLogs) {
        const affected = getAffectedMarkers(log.protocolName);
        if (affected.includes(critical.key)) {
          if (!affectingProtocols.includes(log.protocolName)) {
            affectingProtocols.push(log.protocolName);
          }
        }
      }
      const protocolHint = affectingProtocols.length > 0
        ? ` — correlates with ${affectingProtocols.slice(0, 2).join(" and ")} protocol adherence`
        : "";
      localRequiredAdjustment = `${critical.label} at ${critical.detail}${protocolHint}`;
    } else if (hrvData.current && hrvData.avg7d && hrvData.current < hrvData.avg7d * 0.85) {
      const pctBelow = Math.round(((hrvData.avg7d - hrvData.current) / hrvData.avg7d) * 100);
      localRequiredAdjustment = `HRV ${pctBelow}% below baseline at ${hrvData.current}ms — autonomic recovery needs recalibration`;
    } else if (sleepData.hours && sleepData.hours < 7) {
      localRequiredAdjustment = `Sleep duration at ${sleepData.hours}h — below 7h minimum for adequate hormonal recovery`;
    } else if (protocolCount < 5) {
      localRequiredAdjustment = "Protocol adherence below threshold — consistency is the primary lever for biomarker optimization";
    } else {
      localRequiredAdjustment = "Expand Bio-Vault with fresh blood panel data to unlock precision protocol adjustments";
    }

    /* ── 11. Build context string for LLM ── */
    const contextLines: string[] = [
      "=== BIOLOGICAL DATA SNAPSHOT ===",
    ];

    if (eliteScore) {
      contextLines.push(`Vitality Score: ${eliteScore.score}/100 (Fueling: ${eliteScore.fuelingPoints}/25, Movement: ${eliteScore.movementPoints}/25, HRV: ${eliteScore.hrvPoints}/25, Base: ${eliteScore.basePoints}/25)`);
    }

    if (biomarkerAssessments.length > 0) {
      contextLines.push("\nBIOMARKERS:");
      for (const a of biomarkerAssessments) {
        contextLines.push(`  ${a.label}: ${a.detail} [${a.status.toUpperCase()}]`);
      }
    }

    if (labResults.length > 0) {
      contextLines.push(`\nLAB RESULTS (${labResults.length} recent entries):`);
      for (const lab of labResults.slice(0, 10)) {
        const daysAgo = Math.round((now - lab.testedAt) / (24 * 60 * 60 * 1000));
        contextLines.push(`  ${lab.marker}: ${lab.value} ${lab.unit} (${daysAgo}d ago)`);
      }
    }

    if (hrvData.current) {
      contextLines.push(`\nHRV: ${hrvData.current}ms (7d avg: ${hrvData.avg7d ?? "N/A"}, trend: ${hrvData.trend ?? "N/A"}, baseline: ${hrvData.baseline ?? "N/A"})`);
    }

    if (sleepData.score) {
      contextLines.push(`Sleep: Score ${sleepData.score}/100, ${sleepData.hours ?? "?"}h, ${sleepData.deepPct ?? "?"}% deep, ${sleepData.efficiency ?? "?"}% efficiency`);
    }

    contextLines.push(`\nPROTOCOL ADHERENCE: ${protocolCount} completions in 30 days`);

    if (protocolLogs.length > 0) {
      const categories = new Map<string, number>();
      for (const log of protocolLogs) {
        categories.set(log.category, (categories.get(log.category) || 0) + 1);
      }
      contextLines.push("  By category: " + Array.from(categories.entries()).map(([c, n]) => `${c}: ${n}`).join(", "));
      const recentNames = [...new Set(protocolLogs.slice(0, 10).map(l => l.protocolName))];
      contextLines.push("  Recent protocols: " + recentNames.join(", "));
    }

    if (bioVault) {
      const genetics: string[] = [];
      if (bioVault.mthfrVariant) genetics.push("MTHFR variant");
      if (bioVault.apoe4) genetics.push("APOE4 carrier");
      if (bioVault.caffeineSensitivity) genetics.push("CYP1A2 slow metabolizer");
      if (genetics.length > 0) {
        contextLines.push(`\nGENETIC VARIANTS: ${genetics.join(", ")}`);
      }
    }

    contextLines.push("\n=== END DATA ===");
    contextLines.push(`\nLOCAL ANALYSIS:`);
    contextLines.push(`  Positive Trend: ${localPositiveTrend}`);
    contextLines.push(`  Required Adjustment: ${localRequiredAdjustment}`);

    const contextBlock = contextLines.join("\n");

    /* ── 12. Call LLM for precision brief ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const systemPrompt = `You are the Vive Clinical Performance Architect — a physician-scientist analyzing a patient's real-time biological data. Generate a Contextual Brief.

INSTRUCTIONS:
1. Write exactly 3 sentences summarizing the user's current physiological state. Be precise, reference specific numbers.
2. Identify ONE "Positive Trend" — the strongest upward signal in their data. One sentence.
3. Identify ONE "Required Adjustment" — the most critical recalibration needed. One sentence with a specific, actionable protocol change.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "brief": "Three-sentence clinical summary referencing specific biomarker values and trends.",
  "positiveTrend": "One sentence identifying the strongest positive signal with specific data.",
  "requiredAdjustment": "One sentence with a specific protocol adjustment and the mechanism behind it."
}

RULES:
- Reference SPECIFIC numbers from the data (e.g., "HRV at 62ms", "Vitamin D at 38 ng/mL")
- Use performance verbs: calibrate, architect, synchronize, optimize, modulate, upregulate, attenuate, potentiate, titrate, recalibrate
- Never say "I think" or "maybe" — speak with clinical certainty
- If data is sparse, acknowledge it and recommend specific data collection actions
- The brief should feel like a physician's morning rounds note — concise, data-driven, actionable
- Return ONLY the JSON object, no code fences, no explanation`;

        const response = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Generate a Contextual Brief from this biological data:\n\n${contextBlock}` },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data?.choices?.[0]?.message?.content ?? "";

          let jsonStr = raw.trim();
          const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fenceMatch) jsonStr = fenceMatch[1].trim();
          const braceStart = jsonStr.indexOf("{");
          const braceEnd = jsonStr.lastIndexOf("}");
          if (braceStart !== -1 && braceEnd !== -1) {
            jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
          }

          try {
            const parsed = JSON.parse(jsonStr) as {
              brief: string;
              positiveTrend: string;
              requiredAdjustment: string;
            };

            if (parsed.brief && parsed.positiveTrend && parsed.requiredAdjustment) {
              return {
                brief: parsed.brief,
                positiveTrend: parsed.positiveTrend,
                requiredAdjustment: parsed.requiredAdjustment,
                dataPoints,
                generatedAt: now,
                source: "llm",
              };
            }
          } catch {
            console.warn("[aiBrain] Failed to parse LLM JSON, falling back to local analysis");
          }
        }
      } catch (err) {
        console.warn("[aiBrain] LLM call failed, falling back to local analysis:", err);
      }
    }

    /* ── 13. Local Fallback Brief ── */
    const briefParts: string[] = [];

    if (eliteScore) {
      const tier = eliteScore.score >= 85 ? "elite optimization" : eliteScore.score >= 65 ? "operational readiness" : "recovery priority";
      briefParts.push(`Biological systems operating at ${eliteScore.score}/100 — ${tier} state.`);
    } else if (biomarkerAssessments.length > 0) {
      const optCount = optimalMarkers.length;
      const total = biomarkerAssessments.length;
      briefParts.push(`${optCount}/${total} tracked biomarkers within optimal range — ${optCount === total ? "all systems calibrated" : "recalibration targets identified"}.`);
    } else {
      briefParts.push("Biological baseline establishing — insufficient data for precision analysis.");
    }

    if (hrvData.current && hrvData.avg7d) {
      const trend = hrvData.current > hrvData.avg7d * 1.05 ? "upregulating" : hrvData.current < hrvData.avg7d * 0.95 ? "attenuated" : "stable";
      briefParts.push(`Autonomic nervous system ${trend} — HRV at ${hrvData.current}ms against ${hrvData.avg7d}ms baseline.`);
    } else if (sleepData.hours) {
      const quality = sleepData.hours >= 8 ? "optimized" : sleepData.hours >= 7 ? "adequate" : "compromised";
      briefParts.push(`Recovery architecture ${quality} — ${sleepData.hours}h sleep${sleepData.score ? ` (score: ${sleepData.score}/100)` : ""}.`);
    } else {
      briefParts.push(`${protocolCount} protocol completions logged in the last 30 days — ${protocolCount >= 20 ? "strong adherence momentum" : "consistency is the primary optimization lever"}.`);
    }

    if (suboptimalMarkers.length > 0) {
      const worst = suboptimalMarkers.find(a => a.status === "critical") || suboptimalMarkers[0];
      briefParts.push(`Priority recalibration: ${worst.label} requires intervention — ${worst.detail}.`);
    } else if (dataPoints < 5) {
      briefParts.push("Priority: populate Bio-Vault with blood panel and wearable data to unlock precision protocol architecture.");
    } else {
      briefParts.push("All tracked systems within parameters — maintain current protocol cadence and retest biomarkers at 90-day interval.");
    }

    return {
      brief: briefParts.join(" "),
      positiveTrend: localPositiveTrend,
      requiredAdjustment: localRequiredAdjustment,
      dataPoints,
      generatedAt: now,
      source: "local",
    };
  },
});
