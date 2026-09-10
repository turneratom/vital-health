import { action, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   AI CONTEXT ENGINE — Dynamic System Status Generator
   
   Ingests:
     1. SomaticBodyMap feedback (region severity + somatic channels)
     2. Recent nutrition logs (macros, fuel scores, molecular insights)
     3. Wellness protocols (peptides, supplements, HRT cycles)
     4. BioVault biomarkers (CRP, HbA1c, testosterone, etc.)
     5. Sleep + HRV data
   
   Outputs: A single "System Status" sentence that changes dynamically
   based on the user's current biological state. Feels like the AI
   is actively "thinking" about their biology in real-time.
   ═══════════════════════════════════════════════════════════════ */

/* ── Protocol → Recommendation Map for peptides/supplements ── */
const PROTOCOL_RECOMMENDATIONS: Record<string, {
  trigger: string;
  recommendation: string;
  icon: string;
}> = {
  bpc157: {
    trigger: "inflammation",
    recommendation: "peptide-protocol BPC-157 (250mcg subQ) and 24h gut-rest fast",
    icon: "🧬",
  },
  tb500: {
    trigger: "recovery",
    recommendation: "TB-500 (2mg subQ) for systemic tissue repair and angiogenesis",
    icon: "🔬",
  },
  ipamorelin: {
    trigger: "growth_hormone",
    recommendation: "Ipamorelin/CJC-1295 pulse (200mcg pre-sleep) for GH secretagogue cascade",
    icon: "⚗️",
  },
  glutathione: {
    trigger: "detox",
    recommendation: "liposomal glutathione 500mg + NAC 600mg for phase II detoxification",
    icon: "🛡️",
  },
  magnesium: {
    trigger: "sleep",
    recommendation: "magnesium glycinate 400mg + L-theanine 200mg 60min pre-sleep",
    icon: "🌙",
  },
  omega3: {
    trigger: "inflammation",
    recommendation: "EPA-dominant omega-3 (2g EPA) to attenuate NF-κB inflammatory cascade",
    icon: "🐟",
  },
  berberine: {
    trigger: "metabolic",
    recommendation: "berberine 500mg with meals for AMPK activation and glucose disposal",
    icon: "📊",
  },
  ashwagandha: {
    trigger: "hormonal",
    recommendation: "KSM-66 ashwagandha 600mg for cortisol modulation and T-support",
    icon: "⚡",
  },
  creatine: {
    trigger: "performance",
    recommendation: "creatine monohydrate 5g for ATP regeneration and cognitive reserve",
    icon: "💪",
  },
  vitaminD: {
    trigger: "immune",
    recommendation: "Vitamin D3 5000IU + K2 MK-7 200mcg for immunomodulation",
    icon: "☀️",
  },
};

/* ── Somatic Region → System Mapping ── */
const REGION_SYSTEM_MAP: Record<string, { system: string; biomarkers: string[] }> = {
  head: { system: "neurological", biomarkers: ["hrvCurrent", "sleepScore", "caffeineTodayMg"] },
  neck: { system: "thyroid-cervical", biomarkers: ["crp", "ferritin"] },
  shoulders: { system: "musculoskeletal-upper", biomarkers: ["crp", "testosteroneTotal"] },
  chest: { system: "cardiovascular", biomarkers: ["crp", "hrvCurrent"] },
  arms: { system: "peripheral-motor", biomarkers: ["ferritin", "testosteroneTotal"] },
  gut: { system: "gastrointestinal", biomarkers: ["crp", "hba1c"] },
  abdomen: { system: "metabolic-core", biomarkers: ["hba1c", "fastingGlucose", "crp"] },
  hips: { system: "pelvic-structural", biomarkers: ["testosteroneTotal", "vitaminD"] },
  upper_back: { system: "thoracic-postural", biomarkers: ["crp", "vitaminD"] },
  lower_back: { system: "lumbar-spinal", biomarkers: ["vitaminD", "crp", "ferritin"] },
  legs: { system: "lower-extremity", biomarkers: ["ferritin", "vitaminD"] },
  knees: { system: "articular", biomarkers: ["crp", "vitaminD"] },
  feet: { system: "peripheral-vascular", biomarkers: ["hba1c", "ferritin"] },
  skin: { system: "integumentary", biomarkers: ["vitaminD", "crp"] },
};

/* ── Biomarker Optimal Ranges ── */
const BIO_RANGES: Record<string, { min: number; max: number; unit: string; label: string; critLow?: number; critHigh?: number }> = {
  crp: { min: 0, max: 1.0, unit: "mg/L", label: "C-Reactive Protein", critHigh: 3.0 },
  hba1c: { min: 4.0, max: 5.4, unit: "%", label: "HbA1c", critHigh: 5.7 },
  vitaminD: { min: 40, max: 80, unit: "ng/mL", label: "Vitamin D", critLow: 20 },
  testosteroneTotal: { min: 400, max: 900, unit: "ng/dL", label: "Total Testosterone", critLow: 250 },
  testosteroneFree: { min: 15, max: 25, unit: "pg/mL", label: "Free Testosterone", critLow: 8 },
  ferritin: { min: 40, max: 200, unit: "ng/mL", label: "Ferritin", critLow: 20, critHigh: 300 },
  fastingGlucose: { min: 70, max: 95, unit: "mg/dL", label: "Fasting Glucose", critHigh: 110 },
  igf1: { min: 100, max: 300, unit: "ng/mL", label: "IGF-1" },
  hrvCurrent: { min: 40, max: 120, unit: "ms", label: "HRV" },
  sleepScore: { min: 70, max: 100, unit: "/100", label: "Sleep Score" },
  caffeineTodayMg: { min: 0, max: 200, unit: "mg", label: "Caffeine", critHigh: 400 },
};

/* ── Types ── */
interface ContextSignal {
  source: "somatic" | "nutrition" | "biomarker" | "protocol" | "sleep" | "hrv" | "substance";
  severity: "optimal" | "attention" | "warning" | "critical";
  system: string;
  detail: string;
  value?: number;
  unit?: string;
  recommendation?: string;
}

/* ═══════════════════════════════════════════════════════════════
   getBioContext — Query that aggregates all context data
   for the AI Context Engine. Called by the frontend to get
   the raw data needed for status generation.
   ═══════════════════════════════════════════════════════════════ */

export const getBioContext = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    // 1. BioVault — core biomarkers + sleep + HRV
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // 2. Somatic feedback — last 24h body map entries
    const somaticFeedback = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", last24h)
      )
      .collect();

    // 3. Body map entries — recent pain/tension regions
    const bodyMapEntries = await ctx.db
      .query("bodyMapEntries")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", last7d)
      )
      .collect();

    // 4. Nutrition logs — today's intake
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayFoodAll = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);
    const todayFood = todayFoodAll.filter((f) => f.loggedAt >= startOfDay.getTime());

    // 5. Active substance cycles (peptides, HRT, supplements)
    let activeCycles: Array<{
      substanceName: string;
      category: string;
      dosageMg: number;
      dosageUnit: string;
      route: string;
      status: string;
      currentCycleDay: number;
      isOnPhase: boolean;
      monitoredBiomarkers: string[];
    }> = [];
    try {
      const cycles = await ctx.db
        .query("substanceCycles")
        .withIndex("by_sessionId_and_status", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("status", "active")
        )
        .collect();
      activeCycles = cycles.map((c) => ({
        substanceName: c.substanceName,
        category: c.category,
        dosageMg: c.dosageMg,
        dosageUnit: c.dosageUnit,
        route: c.route,
        status: c.status,
        currentCycleDay: c.currentCycleDay,
        isOnPhase: c.isOnPhase,
        monitoredBiomarkers: c.monitoredBiomarkers,
      }));
    } catch { /* table may not exist */ }

    // 6. Recent substance logs — last 24h doses
    let recentSubstanceLogs: Array<{
      substanceName: string;
      category: string;
      dosageMg: number;
      route: string;
      loggedAt: number;
    }> = [];
    try {
      const sLogs = await ctx.db
        .query("substanceLogs")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", last24h)
        )
        .collect();
      recentSubstanceLogs = sLogs.map((l) => ({
        substanceName: l.substanceName,
        category: l.category,
        dosageMg: l.dosageMg,
        route: l.route,
        loggedAt: l.loggedAt,
      }));
    } catch { /* continue */ }

    // 7. Protocol completions today
    const dateKey = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, "0")}-${String(startOfDay.getDate()).padStart(2, "0")}`;
    let protocolStatus = { done: 0, total: 0 };
    try {
      const protocols = await ctx.db
        .query("protocols")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const activeProtocols = protocols.filter((p) => p.isActive);
      const completions = await ctx.db
        .query("protocolCompletions")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
        )
        .collect();
      const completedIds = new Set(completions.filter((c) => c.completed).map((c) => c.protocolItemId));
      protocolStatus = {
        total: activeProtocols.length,
        done: activeProtocols.filter((p) => completedIds.has(p._id)).length,
      };
    } catch { /* continue */ }

    // 8. Latest elite score
    let vitalityScore: number | null = null;
    try {
      const latest = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .first();
      if (latest) vitalityScore = latest.score;
    } catch { /* continue */ }

    // Aggregate nutrition
    const nutrition = {
      totalCalories: todayFood.reduce((s, f) => s + f.calories, 0),
      totalProtein: todayFood.reduce((s, f) => s + f.protein, 0),
      totalCarbs: todayFood.reduce((s, f) => s + f.carbs, 0),
      totalFat: todayFood.reduce((s, f) => s + f.fat, 0),
      mealCount: todayFood.length,
      avgFuelScore: todayFood.length > 0
        ? Math.round(todayFood.reduce((s, f) => s + (f.fuelScore ?? 0), 0) / todayFood.length)
        : null,
      avgLongevityScore: todayFood.length > 0
        ? Math.round(todayFood.reduce((s, f) => s + (f.longevityScore ?? 0), 0) / todayFood.length)
        : null,
    };

    return {
      bioVault: bioVault ? {
        crp: bioVault.crp ?? null,
        hba1c: bioVault.hba1c ?? null,
        vitaminD: bioVault.vitaminD ?? null,
        testosteroneTotal: bioVault.testosteroneTotal ?? null,
        testosteroneFree: bioVault.testosteroneFree ?? null,
        ferritin: bioVault.ferritin ?? null,
        igf1: bioVault.igf1 ?? null,
        fastingGlucose: bioVault.fastingGlucose ?? null,
        hrvCurrent: bioVault.hrvCurrent ?? null,
        hrvAvg7d: bioVault.hrvAvg7d ?? null,
        hrvTrend: bioVault.hrvTrend ?? null,
        sleepScore: bioVault.sleepScore ?? null,
        sleepHours: bioVault.sleepHours ?? null,
        sleepDeepPct: bioVault.sleepDeepPct ?? null,
        caffeineTodayMg: bioVault.caffeineTodayMg ?? null,
        caffeineSensitivity: bioVault.caffeineSensitivity ?? false,
        mthfrVariant: bioVault.mthfrVariant ?? false,
        apoe4: bioVault.apoe4 ?? false,
      } : null,
      somaticFeedback: somaticFeedback.map((s) => ({
        channel: s.channel,
        value: s.value,
        label: s.label,
        loggedAt: s.loggedAt,
      })),
      bodyMapEntries: bodyMapEntries.map((b) => ({
        region: b.region,
        severity: b.severity,
        description: b.description,
        loggedAt: b.loggedAt,
      })),
      nutrition,
      activeCycles,
      recentSubstanceLogs,
      protocolStatus,
      vitalityScore,
      timestamp: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   generateSystemStatus — AI-Powered System Status Generator
   
   Analyzes all biological context and generates a single
   dynamic "System Status" sentence for the HUD.
   
   Priority cascade:
   1. CRITICAL alerts (biomarker out of range + somatic pain)
   2. Substance/peptide interactions with biomarkers
   3. Nutrition + metabolic state
   4. Recovery + sleep + HRV
   5. Positive momentum (all systems nominal)
   ═══════════════════════════════════════════════════════════════ */

export const generateSystemStatus = action({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    status: string;
    severity: "optimal" | "attention" | "warning" | "critical";
    icon: string;
    signals: ContextSignal[];
    recommendation: string | null;
    generatedAt: number;
    source: "llm" | "local";
  }> => {
    const now = Date.now();

    /* ── Pull aggregated context ── */
    let bioContext: any = null;
    try {
      bioContext = await ctx.runQuery(
        "aiContextEngine:getBioContext" as any,
        { sessionId: args.sessionId }
      );
    } catch { /* continue with null */ }

    if (!bioContext) {
      return {
        status: "Awaiting biological data — initialize Bio-Vault and connect wearables to activate real-time system intelligence.",
        severity: "attention",
        icon: "📡",
        signals: [],
        recommendation: "Complete your Bio-Vault profile to unlock precision status monitoring.",
        generatedAt: now,
        source: "local",
      };
    }

    const { bioVault, somaticFeedback, bodyMapEntries, nutrition, activeCycles, recentSubstanceLogs, protocolStatus, vitalityScore } = bioContext;

    /* ── Collect all context signals ── */
    const signals: ContextSignal[] = [];

    // 1. Biomarker signals
    if (bioVault) {
      const markerChecks: Array<{ key: string; value: number | null }> = [
        { key: "crp", value: bioVault.crp },
        { key: "hba1c", value: bioVault.hba1c },
        { key: "vitaminD", value: bioVault.vitaminD },
        { key: "testosteroneTotal", value: bioVault.testosteroneTotal },
        { key: "ferritin", value: bioVault.ferritin },
        { key: "fastingGlucose", value: bioVault.fastingGlucose },
        { key: "hrvCurrent", value: bioVault.hrvCurrent },
        { key: "sleepScore", value: bioVault.sleepScore },
      ];

      for (const { key, value } of markerChecks) {
        if (value == null) continue;
        const range = BIO_RANGES[key];
        if (!range) continue;

        let severity: ContextSignal["severity"] = "optimal";
        if (value < range.min) {
          severity = range.critLow != null && value < range.critLow ? "critical" : "warning";
        } else if (value > range.max) {
          severity = range.critHigh != null && value > range.critHigh ? "critical" : "warning";
        }

        if (severity !== "optimal") {
          signals.push({
            source: "biomarker",
            severity,
            system: range.label,
            detail: `${range.label} at ${value}${range.unit}`,
            value,
            unit: range.unit,
          });
        }
      }

      // HRV trend signal
      if (bioVault.hrvCurrent && bioVault.hrvAvg7d) {
        const pctDiff = ((bioVault.hrvCurrent - bioVault.hrvAvg7d) / bioVault.hrvAvg7d) * 100;
        if (pctDiff < -15) {
          signals.push({
            source: "hrv",
            severity: "warning",
            system: "autonomic",
            detail: `HRV ${Math.abs(Math.round(pctDiff))}% below 7-day baseline at ${bioVault.hrvCurrent}ms`,
            value: bioVault.hrvCurrent,
            unit: "ms",
          });
        }
      }

      // Sleep signal
      if (bioVault.sleepHours != null && bioVault.sleepHours < 6.5) {
        signals.push({
          source: "sleep",
          severity: bioVault.sleepHours < 5 ? "critical" : "warning",
          system: "recovery",
          detail: `Sleep at ${bioVault.sleepHours}h — below recovery threshold`,
          value: bioVault.sleepHours,
          unit: "h",
        });
      }
    }

    // 2. Somatic body map signals
    for (const entry of bodyMapEntries) {
      if (entry.severity >= 6) {
        const regionInfo = REGION_SYSTEM_MAP[entry.region];
        signals.push({
          source: "somatic",
          severity: entry.severity >= 8 ? "critical" : "warning",
          system: regionInfo?.system ?? entry.region,
          detail: `${entry.region} region: severity ${entry.severity}/10 — ${entry.description}`,
          value: entry.severity,
        });
      }
    }

    // 3. Somatic channel signals (real-time body feedback)
    for (const fb of somaticFeedback) {
      if (fb.value < 30) {
        signals.push({
          source: "somatic",
          severity: fb.value < 15 ? "critical" : "warning",
          system: fb.channel.replace(/_/g, " "),
          detail: `${fb.label} — ${fb.channel} at ${fb.value}/100`,
          value: fb.value,
        });
      }
    }

    // 4. Substance/peptide interaction signals
    for (const cycle of activeCycles) {
      if (cycle.isOnPhase && cycle.monitoredBiomarkers.length > 0) {
        const flaggedBiomarkers: string[] = [];
        for (const bm of cycle.monitoredBiomarkers) {
          const val = bioVault?.[bm as keyof typeof bioVault];
          const range = BIO_RANGES[bm];
          if (val != null && range && (typeof val === "number") && (val < range.min || val > range.max)) {
            flaggedBiomarkers.push(`${range.label}: ${val}${range.unit}`);
          }
        }
        if (flaggedBiomarkers.length > 0) {
          signals.push({
            source: "substance",
            severity: "warning",
            system: cycle.substanceName,
            detail: `${cycle.substanceName} (day ${cycle.currentCycleDay}) — monitored markers flagged: ${flaggedBiomarkers.join(", ")}`,
          });
        }
      }
    }

    // 5. Nutrition signals
    if (nutrition.mealCount > 0) {
      if (nutrition.totalProtein < 80 && new Date().getHours() >= 14) {
        signals.push({
          source: "nutrition",
          severity: "attention",
          system: "metabolic",
          detail: `Protein at ${nutrition.totalProtein}g — below anabolic threshold for the day`,
          value: nutrition.totalProtein,
          unit: "g",
        });
      }
      if (nutrition.avgFuelScore != null && nutrition.avgFuelScore < 50) {
        signals.push({
          source: "nutrition",
          severity: "attention",
          system: "fuel quality",
          detail: `Fuel Score averaging ${nutrition.avgFuelScore}/100 — suboptimal molecular nutrition`,
          value: nutrition.avgFuelScore,
        });
      }
    }

    /* ── Sort signals by severity ── */
    const severityOrder = { critical: 0, warning: 1, attention: 2, optimal: 3 };
    signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    /* ── Determine overall severity ── */
    const overallSeverity: ContextSignal["severity"] =
      signals.some((s) => s.severity === "critical") ? "critical" :
      signals.some((s) => s.severity === "warning") ? "warning" :
      signals.some((s) => s.severity === "attention") ? "attention" : "optimal";

    /* ── Determine recommendation based on top signal ── */
    let recommendation: string | null = null;
    const topSignal = signals[0];
    if (topSignal) {
      // Match against protocol recommendations
      if (topSignal.system.includes("C-Reactive") || topSignal.detail.includes("CRP") || topSignal.detail.includes("inflammation")) {
        recommendation = PROTOCOL_RECOMMENDATIONS.bpc157.recommendation;
      } else if (topSignal.source === "sleep" || topSignal.system === "recovery") {
        recommendation = PROTOCOL_RECOMMENDATIONS.magnesium.recommendation;
      } else if (topSignal.detail.includes("HRV") || topSignal.system === "autonomic") {
        recommendation = "4-7-8 breathing protocol (5 cycles) + cold exposure 2min to restore vagal tone";
      } else if (topSignal.detail.includes("Testosterone")) {
        recommendation = PROTOCOL_RECOMMENDATIONS.ashwagandha.recommendation;
      } else if (topSignal.detail.includes("HbA1c") || topSignal.detail.includes("Glucose")) {
        recommendation = PROTOCOL_RECOMMENDATIONS.berberine.recommendation;
      } else if (topSignal.detail.includes("Vitamin D")) {
        recommendation = PROTOCOL_RECOMMENDATIONS.vitaminD.recommendation;
      } else if (topSignal.detail.includes("Ferritin")) {
        recommendation = "Iron bisglycinate 25mg + Vitamin C 500mg on empty stomach AM";
      } else if (topSignal.source === "nutrition") {
        recommendation = "Prioritize protein-dense whole foods — target 40g per meal for mTOR activation";
      } else if (topSignal.source === "somatic") {
        recommendation = "Targeted mobility protocol for affected region + anti-inflammatory stack";
      }
    }

    /* ── Determine icon ── */
    const iconMap = {
      critical: "🔴",
      warning: "🟡",
      attention: "🟠",
      optimal: "🟢",
    };

    /* ── Build context for LLM ── */
    const contextParts: string[] = [];

    if (signals.length > 0) {
      contextParts.push("ACTIVE SIGNALS:");
      for (const s of signals.slice(0, 6)) {
        contextParts.push(`  [${s.severity.toUpperCase()}] ${s.detail}`);
      }
    }

    if (activeCycles.length > 0) {
      contextParts.push("\nACTIVE PROTOCOLS:");
      for (const c of activeCycles) {
        contextParts.push(`  ${c.substanceName} (${c.category}) — Day ${c.currentCycleDay}, ${c.isOnPhase ? "ON phase" : "OFF phase"}, ${c.dosageMg}${c.dosageUnit} ${c.route}`);
      }
    }

    if (recentSubstanceLogs.length > 0) {
      contextParts.push("\nRECENT DOSES (24h):");
      for (const l of recentSubstanceLogs.slice(0, 5)) {
        contextParts.push(`  ${l.substanceName}: ${l.dosageMg}mg ${l.route}`);
      }
    }

    if (nutrition.mealCount > 0) {
      contextParts.push(`\nNUTRITION: ${nutrition.totalCalories}kcal, ${nutrition.totalProtein}g protein, ${nutrition.mealCount} meals`);
      if (nutrition.avgFuelScore) contextParts.push(`  Fuel Score: ${nutrition.avgFuelScore}/100`);
    }

    if (protocolStatus.total > 0) {
      contextParts.push(`\nPROTOCOL ADHERENCE: ${protocolStatus.done}/${protocolStatus.total} (${Math.round((protocolStatus.done / protocolStatus.total) * 100)}%)`);
    }

    if (vitalityScore != null) {
      contextParts.push(`\nVITALITY SCORE: ${vitalityScore}/100`);
    }

    contextParts.push(`\nOVERALL SEVERITY: ${overallSeverity}`);
    if (recommendation) contextParts.push(`RECOMMENDED: ${recommendation}`);

    /* ── Try LLM for natural-language status ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN && signals.length >= 1) {
      try {
        const sysPrompt = `You are the Vive Biological OS — an AI that monitors a user's real-time biological state. Generate EXACTLY ONE sentence for the "System Status" display at the top of their HUD.

RULES:
- Start with "System Alert:" for critical/warning, "System Status:" for attention, "System Nominal:" for optimal
- Reference SPECIFIC biomarker values, somatic regions, or protocol names from the data
- If peptides/supplements are active, reference them by name and their interaction with flagged biomarkers
- If inflammation is elevated, recommend specific peptide protocols (e.g., BPC-157, TB-500)
- Use clinical precision — no hedging, no "may" or "might"
- Maximum 35 words. One sentence only.
- Sound like a spacecraft's biological monitoring system — calm, precise, authoritative

EXAMPLES:
- "System Alert: C-Reactive levels elevated at 2.8 mg/L; recommending peptide-protocol BPC-157 and 24h gut-rest fast."
- "System Status: HRV recovering at 58ms post-training — magnesium glycinate 400mg pre-sleep will accelerate parasympathetic restoration."
- "System Nominal: All biomarkers within optimal range — BPC-157 cycle day 12 correlating with 23% CRP reduction."

Return ONLY the sentence as plain text. No JSON, no quotes, no explanation.`;

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
            max_tokens: 120,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
          if (raw.length > 20 && raw.length < 300) {
            return {
              status: raw,
              severity: overallSeverity,
              icon: iconMap[overallSeverity],
              signals,
              recommendation,
              generatedAt: now,
              source: "llm",
            };
          }
        }
      } catch { /* fall through to local */ }
    }

    /* ── Local Fallback Status Generation ── */
    let localStatus: string;

    if (overallSeverity === "critical") {
      const critSignal = signals.find((s) => s.severity === "critical")!;
      if (critSignal.source === "biomarker" && critSignal.detail.includes("C-Reactive")) {
        localStatus = `System Alert: ${critSignal.detail}; recommending ${recommendation ?? "anti-inflammatory protocol stack and 24h fast"}.`;
      } else if (critSignal.source === "somatic") {
        localStatus = `System Alert: Somatic distress detected in ${critSignal.system} — ${critSignal.detail}. Initiating targeted recovery protocol.`;
      } else if (critSignal.source === "sleep") {
        localStatus = `System Alert: ${critSignal.detail} — cortisol dysregulation imminent. Enforce sleep protocol immediately.`;
      } else {
        localStatus = `System Alert: ${critSignal.detail}. ${recommendation ? `Recommending ${recommendation}.` : "Immediate protocol adjustment required."}`;
      }
    } else if (overallSeverity === "warning") {
      const warnSignal = signals.find((s) => s.severity === "warning")!;
      const substanceContext = activeCycles.length > 0
        ? ` — monitoring against ${activeCycles[0].substanceName} cycle (day ${activeCycles[0].currentCycleDay})`
        : "";
      localStatus = `System Alert: ${warnSignal.detail}${substanceContext}. ${recommendation ? `Recommending ${recommendation}.` : ""}`;
    } else if (overallSeverity === "attention") {
      const attSignal = signals.find((s) => s.severity === "attention")!;
      localStatus = `System Status: ${attSignal.detail}. ${recommendation ?? "Optimize next meal for recovery."}`;
    } else {
      // All optimal
      const adherencePct = protocolStatus.total > 0 ? Math.round((protocolStatus.done / protocolStatus.total) * 100) : 0;
      const cycleNote = activeCycles.length > 0
        ? ` ${activeCycles[0].substanceName} cycle day ${activeCycles[0].currentCycleDay} tracking nominal.`
        : "";
      if (vitalityScore != null && vitalityScore >= 75) {
        localStatus = `System Nominal: Vitality at ${vitalityScore}/100 — all biological systems synchronized.${cycleNote} Protocol adherence at ${adherencePct}%.`;
      } else if (bioVault?.hrvCurrent && bioVault.hrvCurrent >= 50) {
        localStatus = `System Nominal: HRV at ${bioVault.hrvCurrent}ms, autonomic balance maintained.${cycleNote} Continue current protocol cadence.`;
      } else {
        localStatus = `System Nominal: Biological systems at baseline.${cycleNote} ${adherencePct > 0 ? `Protocol adherence: ${adherencePct}%.` : "Awaiting deeper signal mapping."}`;
      }
    }

    return {
      status: localStatus,
      severity: overallSeverity,
      icon: iconMap[overallSeverity],
      signals,
      recommendation,
      generatedAt: now,
      source: "local",
    };
  },
});
