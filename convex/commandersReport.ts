import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   COMMANDER'S REPORT — AI-Powered Plain English Lab Brief
   + Longevity Markers Analysis + Biological Age Impact
   
   Takes BioVault blood markers + sleep/HRV context and generates:
   1. Plain English brief per marker (e.g., "Your CRP is elevated...")
   2. Longevity Markers section with biological age impact
   3. Commander's directive — single authoritative action item
   ═══════════════════════════════════════════════════════════════ */

/* ── Longevity marker definitions ── */
const LONGEVITY_MARKERS: Record<string, {
  label: string;
  unit: string;
  optMin: number;
  optMax: number;
  ageImpactPerUnit: number; // years per unit deviation from optimal midpoint
  direction: "lower_better" | "higher_better" | "range";
  longevityRole: string;
  ageExplanation: (value: number, delta: number) => string;
}> = {
  crp: {
    label: "hs-CRP",
    unit: "mg/L",
    optMin: 0,
    optMax: 1.0,
    ageImpactPerUnit: 0.8,
    direction: "lower_better",
    longevityRole: "Systemic inflammation — the #1 driver of biological aging. Elevated CRP accelerates telomere shortening, arterial plaque formation, and cellular senescence.",
    ageExplanation: (value, delta) =>
      delta > 0
        ? `CRP at ${value} mg/L is adding approximately +${delta.toFixed(1)} years to your biological age through chronic inflammatory signaling. Every 1 mg/L reduction reverses ~0.8 years.`
        : `CRP at ${value} mg/L is optimal — your inflammatory load is minimal, preserving telomere length and reducing biological age by ~${Math.abs(delta).toFixed(1)} years.`,
  },
  hba1c: {
    label: "HbA1c",
    unit: "%",
    optMin: 4.5,
    optMax: 5.4,
    ageImpactPerUnit: 2.5,
    direction: "lower_better",
    longevityRole: "Glycemic control — elevated HbA1c drives AGE (Advanced Glycation End-products) formation, cross-linking collagen and accelerating vascular aging.",
    ageExplanation: (value, delta) =>
      delta > 0
        ? `HbA1c at ${value}% is accelerating glycation damage, adding +${delta.toFixed(1)} years to biological age. Each 0.1% reduction reverses ~0.25 years of glycation-driven aging.`
        : `HbA1c at ${value}% indicates excellent metabolic flexibility — glucose metabolism is protecting against AGE formation, saving ~${Math.abs(delta).toFixed(1)} years.`,
  },
  vitaminD: {
    label: "Vitamin D",
    unit: "ng/mL",
    optMin: 40,
    optMax: 80,
    ageImpactPerUnit: 0.05,
    direction: "higher_better",
    longevityRole: "Immune modulation + bone density + gene expression. Vitamin D regulates 1,000+ genes including those governing cell proliferation and apoptosis.",
    ageExplanation: (value, delta) =>
      delta > 0
        ? `Vitamin D at ${value} ng/mL is suboptimal — immune surveillance and gene regulation are compromised, adding +${delta.toFixed(1)} years to biological age.`
        : `Vitamin D at ${value} ng/mL is well-optimized — supporting immune function, bone density, and longevity gene expression, reducing biological age by ~${Math.abs(delta).toFixed(1)} years.`,
  },
  testosteroneTotal: {
    label: "Total Testosterone",
    unit: "ng/dL",
    optMin: 500,
    optMax: 900,
    ageImpactPerUnit: 0.005,
    direction: "higher_better",
    longevityRole: "Anabolic signaling — testosterone maintains muscle mass, bone density, cognitive function, and cardiovascular health. Low T accelerates sarcopenia and metabolic decline.",
    ageExplanation: (value, delta) =>
      delta > 0
        ? `Testosterone at ${value} ng/dL is below optimal — muscle preservation, bone density, and metabolic rate are compromised, adding +${delta.toFixed(1)} years to biological age.`
        : `Testosterone at ${value} ng/dL is strong — anabolic signaling supports muscle mass, cognitive function, and metabolic health, reducing biological age by ~${Math.abs(delta).toFixed(1)} years.`,
  },
  ferritin: {
    label: "Ferritin",
    unit: "ng/mL",
    optMin: 40,
    optMax: 150,
    ageImpactPerUnit: 0.01,
    direction: "range",
    longevityRole: "Iron homeostasis — both deficiency (impaired oxygen transport) and excess (oxidative damage via Fenton reaction) accelerate aging.",
    ageExplanation: (value, delta) =>
      delta > 0
        ? `Ferritin at ${value} ng/mL is outside optimal range — ${value < 40 ? "iron deficiency is impairing mitochondrial function" : "iron excess is driving oxidative damage"}, adding +${delta.toFixed(1)} years to biological age.`
        : `Ferritin at ${value} ng/mL is well-balanced — iron homeostasis supports oxygen transport without oxidative burden, reducing biological age by ~${Math.abs(delta).toFixed(1)} years.`,
  },
  testosteroneFree: {
    label: "Free Testosterone",
    unit: "pg/mL",
    optMin: 15,
    optMax: 25,
    ageImpactPerUnit: 0.1,
    direction: "higher_better",
    longevityRole: "Bioavailable testosterone — the fraction that actually reaches tissue receptors. Low free T despite normal total T indicates SHBG binding issues.",
    ageExplanation: (value, delta) =>
      delta > 0
        ? `Free T at ${value} pg/mL means tissue-level androgenic signaling is weak, adding +${delta.toFixed(1)} years to biological age through reduced anabolic capacity.`
        : `Free T at ${value} pg/mL ensures strong tissue-level androgenic signaling, supporting recovery and lean mass, reducing biological age by ~${Math.abs(delta).toFixed(1)} years.`,
  },
};

/* ── Plain English brief generation per marker ── */
const PLAIN_ENGLISH_MAP: Record<string, {
  label: string;
  unit: string;
  optMin: number;
  optMax: number;
  lowBrief: (v: number) => string;
  highBrief: (v: number) => string;
  optBrief: (v: number) => string;
}> = {
  crp: {
    label: "CRP (Inflammation)",
    unit: "mg/L",
    optMin: 0,
    optMax: 1.0,
    lowBrief: (v) => `Your inflammation marker CRP is very low at ${v} mg/L — your immune system is running clean with minimal inflammatory burden.`,
    highBrief: (v) => `Your inflammation (CRP) is elevated at ${v} mg/L. This is likely driven by poor sleep, high stress, or dietary triggers. Chronic inflammation accelerates every aging pathway. Focus on recovery today.`,
    optBrief: (v) => `Your CRP at ${v} mg/L is well-controlled — systemic inflammation is minimal. Your protocols are keeping inflammatory signaling in check.`,
  },
  hba1c: {
    label: "HbA1c (Blood Sugar)",
    unit: "%",
    optMin: 4.5,
    optMax: 5.6,
    lowBrief: (v) => `Your HbA1c is unusually low at ${v}% — ensure you're eating enough to fuel your training and recovery.`,
    highBrief: (v) => `Your blood sugar control (HbA1c) at ${v}% shows your body is struggling to manage glucose efficiently. This means sugar is sticking to your proteins and accelerating aging. Cut refined carbs and add post-meal walks.`,
    optBrief: (v) => `Your HbA1c at ${v}% shows excellent blood sugar control — your body is efficiently managing glucose without excess glycation damage.`,
  },
  vitaminD: {
    label: "Vitamin D",
    unit: "ng/mL",
    optMin: 40,
    optMax: 80,
    lowBrief: (v) => `Your Vitamin D is low at ${v} ng/mL — this weakens your immune system, bone density, and mood regulation. Get 15-20 minutes of morning sunlight and supplement D3 5000 IU daily.`,
    highBrief: (v) => `Your Vitamin D at ${v} ng/mL is elevated — reduce supplementation and retest in 60 days. Excess D can cause calcium imbalances.`,
    optBrief: (v) => `Your Vitamin D at ${v} ng/mL is dialed in — immune function, bone health, and over 1,000 gene pathways are properly supported.`,
  },
  testosteroneTotal: {
    label: "Total Testosterone",
    unit: "ng/dL",
    optMin: 400,
    optMax: 900,
    lowBrief: (v) => `Your Total Testosterone at ${v} ng/dL is below where it should be. This affects your energy, muscle recovery, mood, and cognitive sharpness. Prioritize 8 hours of sleep, compound lifts, and zinc supplementation.`,
    highBrief: (v) => `Your Total Testosterone at ${v} ng/dL is elevated — monitor estradiol conversion and watch for symptoms of excess aromatization.`,
    optBrief: (v) => `Your Total Testosterone at ${v} ng/dL is strong — hormonal signaling is supporting muscle growth, recovery, and cognitive performance.`,
  },
  testosteroneFree: {
    label: "Free Testosterone",
    unit: "pg/mL",
    optMin: 15,
    optMax: 30,
    lowBrief: (v) => `Your Free Testosterone at ${v} pg/mL is low — even if total T looks okay, this means not enough is reaching your muscles and brain. Consider boron 10mg/day and check SHBG levels.`,
    highBrief: (v) => `Your Free Testosterone at ${v} pg/mL is elevated — monitor DHT-sensitive tissues and check SHBG binding capacity.`,
    optBrief: (v) => `Your Free Testosterone at ${v} pg/mL means your body is effectively using the testosterone it produces — tissue-level signaling is strong.`,
  },
  ferritin: {
    label: "Ferritin (Iron Stores)",
    unit: "ng/mL",
    optMin: 40,
    optMax: 200,
    lowBrief: (v) => `Your iron stores (Ferritin) at ${v} ng/mL are depleted — this means your blood can't carry oxygen efficiently, leaving you fatigued and impairing recovery. Take iron bisglycinate 25mg with vitamin C on an empty stomach.`,
    highBrief: (v) => `Your Ferritin at ${v} ng/mL is elevated — excess iron drives oxidative damage. Consider blood donation and rule out hemochromatosis.`,
    optBrief: (v) => `Your Ferritin at ${v} ng/mL is well-balanced — iron stores are adequate for oxygen transport and mitochondrial function without oxidative risk.`,
  },
};

type MarkerBrief = {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: "optimal" | "suboptimal" | "critical";
  brief: string;
  icon: string;
};

type LongevityMarkerResult = {
  key: string;
  label: string;
  value: number;
  unit: string;
  ageImpactYears: number;
  direction: "aging" | "protecting";
  explanation: string;
  longevityRole: string;
};

export const generateCommandersReport = action({
  args: {
    sessionId: v.string(),
    markers: v.array(v.object({
      key: v.string(),
      value: v.number(),
    })),
    sleepScore: v.optional(v.number()),
    sleepHours: v.optional(v.number()),
    hrvCurrent: v.optional(v.number()),
    protocolAdherence: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<{
    briefs: MarkerBrief[];
    longevityMarkers: LongevityMarkerResult[];
    totalAgeImpact: number;
    commanderDirective: string;
    overallStatus: "elite" | "operational" | "attention" | "critical";
    generatedAt: number;
    source: "llm" | "local";
  }> => {
    const now = Date.now();
    const briefs: MarkerBrief[] = [];
    const longevityMarkers: LongevityMarkerResult[] = [];
    let totalAgeImpact = 0;

    /* ── Generate plain English briefs ── */
    for (const m of args.markers) {
      const def = PLAIN_ENGLISH_MAP[m.key];
      if (!def) continue;

      let status: "optimal" | "suboptimal" | "critical" = "optimal";
      let brief = def.optBrief(m.value);
      let icon = "✅";

      if (m.value < def.optMin) {
        const pctBelow = ((def.optMin - m.value) / def.optMin) * 100;
        status = pctBelow > 30 ? "critical" : "suboptimal";
        brief = def.lowBrief(m.value);
        icon = status === "critical" ? "🚨" : "⚠️";
      } else if (m.value > def.optMax) {
        const pctAbove = ((m.value - def.optMax) / def.optMax) * 100;
        status = pctAbove > 30 ? "critical" : "suboptimal";
        brief = def.highBrief(m.value);
        icon = status === "critical" ? "🚨" : "⚠️";
      }

      briefs.push({ key: m.key, label: def.label, value: m.value, unit: def.unit, status, brief, icon });
    }

    /* ── Compute longevity / biological age impact ── */
    for (const m of args.markers) {
      const lDef = LONGEVITY_MARKERS[m.key];
      if (!lDef) continue;

      const optMid = (lDef.optMin + lDef.optMax) / 2;
      let ageImpact = 0;

      if (lDef.direction === "lower_better") {
        if (m.value > lDef.optMax) {
          ageImpact = (m.value - lDef.optMax) * lDef.ageImpactPerUnit;
        } else if (m.value <= lDef.optMax) {
          ageImpact = -Math.min(1.5, (lDef.optMax - m.value) * lDef.ageImpactPerUnit * 0.3);
        }
      } else if (lDef.direction === "higher_better") {
        if (m.value < lDef.optMin) {
          ageImpact = (lDef.optMin - m.value) * lDef.ageImpactPerUnit;
        } else if (m.value >= lDef.optMin) {
          ageImpact = -Math.min(1.5, (m.value - lDef.optMin) * lDef.ageImpactPerUnit * 0.2);
        }
      } else {
        // range — both too low and too high are bad
        if (m.value < lDef.optMin) {
          ageImpact = (lDef.optMin - m.value) * lDef.ageImpactPerUnit;
        } else if (m.value > lDef.optMax) {
          ageImpact = (m.value - lDef.optMax) * lDef.ageImpactPerUnit;
        } else {
          ageImpact = -Math.min(0.8, Math.abs(m.value - optMid) * lDef.ageImpactPerUnit * 0.1) - 0.3;
        }
      }

      ageImpact = Math.round(ageImpact * 10) / 10;
      totalAgeImpact += ageImpact;

      longevityMarkers.push({
        key: m.key,
        label: lDef.label,
        value: m.value,
        unit: lDef.unit,
        ageImpactYears: ageImpact,
        direction: ageImpact > 0 ? "aging" : "protecting",
        explanation: lDef.ageExplanation(m.value, ageImpact),
        longevityRole: lDef.longevityRole,
      });
    }

    totalAgeImpact = Math.round(totalAgeImpact * 10) / 10;

    /* ── Determine overall status ── */
    const critCount = briefs.filter(b => b.status === "critical").length;
    const subCount = briefs.filter(b => b.status === "suboptimal").length;
    const overallStatus: "elite" | "operational" | "attention" | "critical" =
      critCount >= 2 ? "critical" : critCount >= 1 ? "attention" : subCount >= 2 ? "attention" : subCount >= 1 ? "operational" : "elite";

    /* ── Generate Commander's Directive via LLM ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;
    let commanderDirective = "";
    let source: "llm" | "local" = "local";

    const contextLines = [
      `MARKERS: ${briefs.map(b => `${b.label}: ${b.value} ${b.unit} [${b.status}]`).join(", ")}`,
      `LONGEVITY IMPACT: ${totalAgeImpact > 0 ? "+" : ""}${totalAgeImpact} years biological age shift`,
      args.sleepScore != null ? `SLEEP: ${args.sleepScore}/100, ${args.sleepHours ?? "?"}h` : "SLEEP: No data",
      args.hrvCurrent != null ? `HRV: ${args.hrvCurrent}ms` : "HRV: No data",
      args.protocolAdherence != null ? `ADHERENCE: ${args.protocolAdherence}%` : "ADHERENCE: No data",
      `STATUS: ${overallStatus.toUpperCase()}`,
    ];

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN && briefs.length >= 2) {
      try {
        const systemPrompt = `You are the Commander — an elite military performance officer delivering a lab results debrief. Write ONE paragraph (3-4 sentences) summarizing what these blood markers mean for the operator's longevity and performance.

TONE: Direct, authoritative, zero fluff. Like a Special Forces commander reviewing an operator's medical readiness. Reference SPECIFIC numbers. Use action verbs: fortify, recalibrate, deploy, sustain, advance.

RULES:
- Sentence 1: Overall assessment — are they aging faster or slower than expected based on these markers?
- Sentence 2: The single biggest threat or strength in their panel
- Sentence 3: One clear, specific order for the coming week
- Reference the biological age impact (${totalAgeImpact > 0 ? "+" : ""}${totalAgeImpact} years)
- Keep under 100 words
- Return ONLY the paragraph text, no quotes, no JSON`;

        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Generate the Commander's Report from:\n\n${contextLines.join("\n")}` },
            ],
            temperature: 0.4,
            max_tokens: 250,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const note = data?.choices?.[0]?.message?.content?.trim() ?? "";
          if (note.length > 30) {
            commanderDirective = note;
            source = "llm";
          }
        }
      } catch { /* fall through to local */ }
    }

    if (!commanderDirective) {
      /* ── Local fallback directive ── */
      const worstMarker = briefs.find(b => b.status === "critical") || briefs.find(b => b.status === "suboptimal");
      const bestMarker = briefs.find(b => b.status === "optimal");

      if (overallStatus === "elite") {
        commanderDirective = `Operator, your panel reads ${totalAgeImpact < 0 ? `${Math.abs(totalAgeImpact)} years younger than chronological age` : "at baseline"} — all markers within optimal range. ${bestMarker ? `${bestMarker.label} at ${bestMarker.value} ${bestMarker.unit} confirms your protocols are working.` : ""} Maintain current cadence and retest at 90-day intervals. The compounding effect of consistency is your greatest weapon.`;
      } else if (overallStatus === "operational") {
        commanderDirective = `Solid panel, Operator. ${totalAgeImpact > 0 ? `Net biological age shift of +${totalAgeImpact} years — room for recalibration.` : `Biological age tracking ${Math.abs(totalAgeImpact)} years favorable.`} ${worstMarker ? `${worstMarker.label} at ${worstMarker.value} ${worstMarker.unit} is your primary optimization target.` : ""} Close this gap and you'll shift the longevity curve in your favor. Standing order: address the weakest marker first.`;
      } else if (overallStatus === "attention") {
        commanderDirective = `Attention required, Operator. ${totalAgeImpact > 0 ? `Your markers are adding +${totalAgeImpact} years to biological age — ` : ""}${worstMarker ? `${worstMarker.label} at ${worstMarker.value} ${worstMarker.unit} is the primary threat vector.` : "Multiple markers need intervention."} ${args.sleepHours != null && args.sleepHours < 7 ? `Sleep at ${args.sleepHours}h is compounding the damage. ` : ""}This week's directive: ${worstMarker ? worstMarker.brief.split(".").pop()?.trim() || "address the critical marker immediately" : "recommit to fundamentals"}.`;
      } else {
        commanderDirective = `Operator, this panel demands immediate action. ${totalAgeImpact > 0 ? `+${totalAgeImpact} years of accelerated aging detected across multiple markers.` : ""} ${worstMarker ? `${worstMarker.label} at ${worstMarker.value} ${worstMarker.unit} is in critical range.` : "Multiple systems are compromised."} Every day without intervention compounds the biological cost. Standing order: execute minimum viable protocol stack — sleep, movement, and supplementation are non-negotiable starting tonight.`;
      }
    }

    return {
      briefs,
      longevityMarkers,
      totalAgeImpact,
      commanderDirective,
      overallStatus,
      generatedAt: now,
      source,
    };
  },
});
