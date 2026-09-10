import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   METABOLIC PULSE — Background Stress-Glucose Mismatch Detector
   
   Quietly monitors real-time glucose proxies (HbA1c, food logs,
   carb intake timing) and HRV data to detect "Stress-Glucose
   Spikes" — moments where sympathetic stress drives glucose
   dysregulation even without dietary cause.
   
   When a mismatch is detected, surfaces a minimalist toast
   micro-intervention (physiological sigh, post-meal walk, etc.)
   
   Architecture:
   ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
   │ HRV Readings │ ──▶ │  Metabolic Pulse  │ ──▶ │ Toast UI     │
   │ + Food Logs  │     │  Mismatch Engine  │     │ (non-intrusive)│
   │ + BioVault   │     │  (this file)      │     └──────────────┘
   └──────────────┘     └──────────────────┘
   ═══════════════════════════════════════════════════════════════ */

/* ── Mismatch Detection Thresholds ── */
const THRESHOLDS = {
  /** HRV drop % from 2h rolling avg that signals acute stress */
  hrvStressDrop: 15,
  /** HRV absolute value below which stress is assumed */
  hrvStressFloor: 38,
  /** Minutes after a high-carb meal where glucose spike is expected */
  postMealWindowMin: 90,
  /** Carb grams in a single meal that qualifies as "high-carb" */
  highCarbThresholdG: 50,
  /** HbA1c level above which metabolic sensitivity is flagged */
  hba1cElevated: 5.5,
  /** Minimum minutes between mismatch alerts (cooldown) */
  cooldownMinutes: 45,
  /** CRP level that amplifies mismatch severity */
  crpInflammatory: 2.0,
} as const;

/* ── Micro-Intervention Templates ── */
interface MicroIntervention {
  id: string;
  type: "breathing" | "movement" | "hydration" | "supplement" | "mindfulness";
  title: string;
  subtitle: string;
  instruction: string;
  icon: string;
  durationMin: number;
  accentColor: string;
  /** Which mismatch patterns trigger this */
  triggers: Array<"stress_glucose" | "post_meal_spike" | "fasted_stress" | "inflammatory_cascade">;
  /** Scientific rationale */
  rationale: string;
  priority: number;
}

const MICRO_INTERVENTIONS: MicroIntervention[] = [
  {
    id: "physiological-sigh",
    type: "breathing",
    title: "Physiological Sigh",
    subtitle: "2-min vagal reset",
    instruction: "Double inhale through nose, long exhale through mouth. Repeat for 2 minutes.",
    icon: "🌊",
    durationMin: 2,
    accentColor: "#00FFCC",
    triggers: ["stress_glucose", "fasted_stress"],
    rationale: "The physiological sigh (double inhale + extended exhale) is the fastest known method to activate the parasympathetic nervous system. A single cycle reduces cortisol within 60 seconds, directly lowering stress-driven hepatic glucose output.",
    priority: 95,
  },
  {
    id: "post-meal-walk",
    type: "movement",
    title: "Post-Meal Walk",
    subtitle: "10-min glucose disposal",
    instruction: "Walk at a comfortable pace for 10 minutes. Even light movement clears glucose 30% faster.",
    icon: "🚶",
    durationMin: 10,
    accentColor: "#00DC82",
    triggers: ["post_meal_spike"],
    rationale: "Walking within 30 minutes of eating activates GLUT4 transporters in skeletal muscle, clearing blood glucose 20-35% faster than sitting. This is the single most effective post-prandial intervention.",
    priority: 90,
  },
  {
    id: "cold-water-face",
    type: "mindfulness",
    title: "Cold Water Face Splash",
    subtitle: "Dive reflex activation",
    instruction: "Splash cold water on your face and hold for 15 seconds. Triggers the mammalian dive reflex.",
    icon: "💧",
    durationMin: 1,
    accentColor: "#60A5FA",
    triggers: ["stress_glucose", "fasted_stress"],
    rationale: "Cold water on the face activates the trigeminal-vagal pathway (mammalian dive reflex), causing immediate bradycardia and parasympathetic activation. Reduces cortisol and adrenaline within 30 seconds.",
    priority: 88,
  },
  {
    id: "electrolyte-hydration",
    type: "hydration",
    title: "Electrolyte Bolus",
    subtitle: "500ml + minerals",
    instruction: "Drink 500ml water with a pinch of salt and squeeze of lemon. Dehydration amplifies cortisol.",
    icon: "💦",
    durationMin: 1,
    accentColor: "#38BDF8",
    triggers: ["stress_glucose", "post_meal_spike", "inflammatory_cascade"],
    rationale: "Even 2% dehydration increases cortisol by 15-20%. Sodium-glucose cotransport (SGLT1) in the gut means electrolyte water actually improves glucose clearance. The salt also supports adrenal function under stress.",
    priority: 82,
  },
  {
    id: "box-breathing-micro",
    type: "breathing",
    title: "Box Breathing (4-4-4-4)",
    subtitle: "3-min autonomic reset",
    instruction: "Inhale 4s → Hold 4s → Exhale 4s → Hold 4s. Repeat for 3 minutes.",
    icon: "🫁",
    durationMin: 3,
    accentColor: "#A78BFA",
    triggers: ["stress_glucose", "fasted_stress", "inflammatory_cascade"],
    rationale: "Box breathing at a 4-second cadence entrains the baroreflex, synchronizing heart rate with respiration. This directly increases HRV by 8-15ms per session and reduces hepatic glucose output via vagal-hepatic signaling.",
    priority: 85,
  },
  {
    id: "berberine-acute",
    type: "supplement",
    title: "Berberine 500mg",
    subtitle: "AMPK activator",
    instruction: "Take 500mg berberine with your next meal. Activates the same pathway as metformin.",
    icon: "🌿",
    durationMin: 0,
    accentColor: "#34D399",
    triggers: ["post_meal_spike", "inflammatory_cascade"],
    rationale: "Berberine activates AMPK (AMP-activated protein kinase), the master metabolic switch. It reduces post-prandial glucose by 15-25% and has anti-inflammatory effects comparable to metformin without prescription.",
    priority: 75,
  },
  {
    id: "standing-desk-switch",
    type: "movement",
    title: "Stand & Stretch",
    subtitle: "5-min postural reset",
    instruction: "Stand up, do 10 calf raises, 5 squats, and stretch your hip flexors for 2 minutes.",
    icon: "🧍",
    durationMin: 5,
    accentColor: "#F59E0B",
    triggers: ["post_meal_spike", "stress_glucose"],
    rationale: "Standing activates large muscle groups that act as glucose sinks. Just 5 minutes of standing after sitting reduces post-meal glucose by 11%. Calf raises activate the soleus muscle — the body's most efficient glucose disposal unit.",
    priority: 78,
  },
];

/* ── Mismatch Pattern Types ── */
type MismatchPattern = "stress_glucose" | "post_meal_spike" | "fasted_stress" | "inflammatory_cascade";

interface DetectedMismatch {
  pattern: MismatchPattern;
  severity: "low" | "moderate" | "high" | "critical";
  confidence: number; // 0-100
  description: string;
  metrics: {
    hrvCurrent?: number;
    hrvAvg2h?: number;
    hrvDropPct?: number;
    lastMealMinAgo?: number;
    lastMealCarbs?: number;
    hba1c?: number;
    crp?: number;
    stressLevel?: number;
  };
}

/* ── Match interventions to detected mismatches ── */
function matchInterventions(
  mismatches: DetectedMismatch[],
  recentlyDismissedIds: Set<string>,
): Array<MicroIntervention & { matchedPatterns: MismatchPattern[]; score: number }> {
  const matched: Array<MicroIntervention & { matchedPatterns: MismatchPattern[]; score: number }> = [];
  const patterns = mismatches.map((m) => m.pattern);
  const worstSeverity = mismatches.reduce((worst, m) => {
    const order = { critical: 4, high: 3, moderate: 2, low: 1 };
    return order[m.severity] > order[worst] ? m.severity : worst;
  }, "low" as DetectedMismatch["severity"]);

  for (const intervention of MICRO_INTERVENTIONS) {
    if (recentlyDismissedIds.has(intervention.id)) continue;

    const matchedPatterns = intervention.triggers.filter((t) => patterns.includes(t));
    if (matchedPatterns.length === 0) continue;

    const severityMultiplier = { critical: 2.0, high: 1.5, moderate: 1.0, low: 0.7 }[worstSeverity];
    const avgConfidence = mismatches.reduce((s, m) => s + m.confidence, 0) / mismatches.length;
    const score = Math.round(
      intervention.priority * severityMultiplier * (matchedPatterns.length / intervention.triggers.length) * (avgConfidence / 100)
    );

    matched.push({ ...intervention, matchedPatterns, score });
  }

  return matched.sort((a, b) => b.score - a.score);
}

/* ═══════════════════════════════════════════════════════════════
   QUERIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * getMetabolicPulse — Main query the UI polls to detect Stress-Glucose mismatches.
 * Analyzes HRV readings, food logs, BioVault, and caffeine data to find patterns.
 */
export const getMetabolicPulse = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff2h = now - 2 * 60 * 60 * 1000;
    const cutoff4h = now - 4 * 60 * 60 * 1000;
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const mismatches: DetectedMismatch[] = [];

    /* ── 1. Gather HRV data (last 2h vs 4h baseline) ── */
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff4h)
      )
      .collect();

    const hrvSorted = hrvReadings.sort((a, b) => a.measuredAt - b.measuredAt);
    const hrvLast2h = hrvSorted.filter((r) => r.measuredAt >= cutoff2h);
    const hrvPrior = hrvSorted.filter((r) => r.measuredAt < cutoff2h);

    let hrvCurrent = 0;
    let hrvAvg2h = 0;
    let hrvDropPct = 0;
    let hasHrvStress = false;

    if (hrvLast2h.length >= 1) {
      hrvCurrent = hrvLast2h[hrvLast2h.length - 1].value;
      hrvAvg2h = hrvLast2h.reduce((s, r) => s + r.value, 0) / hrvLast2h.length;
    }

    // Use 4h window as baseline if available, else BioVault
    let hrvBaseline = 0;
    if (hrvPrior.length >= 2) {
      hrvBaseline = hrvPrior.reduce((s, r) => s + r.value, 0) / hrvPrior.length;
    } else {
      // Fallback to BioVault avg
      const bioVault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
      hrvBaseline = bioVault?.hrvAvg7d ?? bioVault?.hrvCurrent ?? 55;
    }

    if (hrvBaseline > 0 && hrvCurrent > 0) {
      hrvDropPct = ((hrvBaseline - hrvCurrent) / hrvBaseline) * 100;
      hasHrvStress = hrvDropPct >= THRESHOLDS.hrvStressDrop || hrvCurrent < THRESHOLDS.hrvStressFloor;
    }

    // Fallback: check eliteScores if no direct HRV readings
    if (hrvReadings.length === 0) {
      const eliteScores = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recent = eliteScores
        .filter((s) => s.calculatedAt >= cutoff24h)
        .sort((a, b) => a.calculatedAt - b.calculatedAt);
      if (recent.length >= 1) {
        const latest = recent[recent.length - 1];
        hrvCurrent = latest.currentHrv;
        hrvBaseline = latest.hrvAvg7d;
        hrvDropPct = ((hrvBaseline - hrvCurrent) / hrvBaseline) * 100;
        hasHrvStress = hrvDropPct >= THRESHOLDS.hrvStressDrop || hrvCurrent < THRESHOLDS.hrvStressFloor;
      }
    }

    /* ── 2. Gather food logs (last 4h for post-meal analysis) ── */
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentMeals = foodLogs
      .filter((l) => l.loggedAt >= cutoff4h)
      .sort((a, b) => b.loggedAt - a.loggedAt);

    const lastMeal = recentMeals[0] ?? null;
    const lastMealMinAgo = lastMeal ? Math.round((now - lastMeal.loggedAt) / 60000) : null;
    const lastMealCarbs = lastMeal?.carbs ?? 0;
    const isPostMealWindow = lastMealMinAgo !== null && lastMealMinAgo <= THRESHOLDS.postMealWindowMin;
    const isHighCarbMeal = lastMealCarbs >= THRESHOLDS.highCarbThresholdG;

    // Total carbs in last 4h
    const totalCarbs4h = recentMeals.reduce((s, m) => s + m.carbs, 0);

    /* ── 3. Get BioVault for metabolic context ── */
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const hba1c = bioVault?.hba1c ?? null;
    const crp = bioVault?.crp ?? null;
    const isMetabolicallySensitive = hba1c !== null && hba1c >= THRESHOLDS.hba1cElevated;
    const isInflamed = crp !== null && crp >= THRESHOLDS.crpInflammatory;

    /* ── 4. Get caffeine context ── */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const caffeineLogs = await ctx.db
      .query("caffeineLogs")
      .withIndex("by_sessionId_and_consumedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("consumedAt", cutoff4h)
      )
      .collect();
    const recentCaffeineMg = caffeineLogs.reduce((s, l) => s + l.amountMg, 0);
    const highCaffeine = recentCaffeineMg > 200; // >200mg in 4h

    /* ── 5. Detect mismatch patterns ── */

    // Pattern A: STRESS-GLUCOSE SPIKE — HRV dropping + no recent high-carb meal
    // The body is producing glucose via cortisol-driven gluconeogenesis
    if (hasHrvStress && !isPostMealWindow) {
      const severity = hrvDropPct >= 30 ? "critical" : hrvDropPct >= 20 ? "high" : "moderate";
      const confidence = Math.min(95, 50 + hrvDropPct * 1.5 + (highCaffeine ? 10 : 0));
      mismatches.push({
        pattern: "stress_glucose",
        severity,
        confidence: Math.round(confidence),
        description: `HRV dropped ${Math.round(hrvDropPct)}% below baseline without dietary cause — cortisol-driven glucose spike detected`,
        metrics: { hrvCurrent: Math.round(hrvCurrent), hrvAvg2h: Math.round(hrvAvg2h), hrvDropPct: Math.round(hrvDropPct) },
      });
    }

    // Pattern B: POST-MEAL SPIKE — High-carb meal + metabolic sensitivity
    if (isPostMealWindow && isHighCarbMeal) {
      const baseSeverity = isMetabolicallySensitive ? "high" : "moderate";
      const severity = hasHrvStress ? "critical" : baseSeverity;
      const confidence = Math.min(95, 40 + (lastMealCarbs / 10) + (isMetabolicallySensitive ? 20 : 0) + (hasHrvStress ? 15 : 0));
      mismatches.push({
        pattern: "post_meal_spike",
        severity,
        confidence: Math.round(confidence),
        description: `${lastMealCarbs}g carbs consumed ${lastMealMinAgo}min ago${isMetabolicallySensitive ? " with elevated HbA1c" : ""} — glucose spike window active`,
        metrics: { lastMealMinAgo, lastMealCarbs, hba1c: hba1c ?? undefined },
      });
    }

    // Pattern C: FASTED STRESS — No food in 4h + HRV stress
    if (hasHrvStress && recentMeals.length === 0) {
      const severity = hrvDropPct >= 25 ? "high" : "moderate";
      const confidence = Math.min(90, 45 + hrvDropPct + (highCaffeine ? 15 : 0));
      mismatches.push({
        pattern: "fasted_stress",
        severity,
        confidence: Math.round(confidence),
        description: `Fasted state with acute HRV stress — liver dumping glucose via gluconeogenesis. Caffeine may be amplifying.`,
        metrics: { hrvCurrent: Math.round(hrvCurrent), hrvDropPct: Math.round(hrvDropPct), stressLevel: Math.round(hrvDropPct * 2) },
      });
    }

    // Pattern D: INFLAMMATORY CASCADE — Elevated CRP + HRV suppression + any glucose trigger
    if (isInflamed && hasHrvStress) {
      const confidence = Math.min(95, 50 + (crp ?? 0) * 10 + hrvDropPct);
      mismatches.push({
        pattern: "inflammatory_cascade",
        severity: "high",
        confidence: Math.round(confidence),
        description: `CRP ${crp?.toFixed(1)}mg/L + HRV suppression — systemic inflammation driving metabolic dysregulation`,
        metrics: { crp: crp ?? undefined, hrvCurrent: Math.round(hrvCurrent), hrvDropPct: Math.round(hrvDropPct) },
      });
    }

    /* ── 6. Check cooldown — don't spam alerts ── */
    const recentPulseEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const recentDismissals = recentPulseEvents.filter(
      (e) =>
        (e.eventType === "metabolic_pulse_dismissed" || e.eventType === "metabolic_pulse_accepted") &&
        e.loggedAt > now - THRESHOLDS.cooldownMinutes * 60 * 1000
    );
    const isInCooldown = recentDismissals.length > 0;

    // Get recently dismissed intervention IDs (last 4h)
    const dismissedIds = new Set(
      recentPulseEvents
        .filter((e) => e.eventType === "metabolic_pulse_dismissed" && e.loggedAt > cutoff4h)
        .map((e) => e.eventKey)
    );

    /* ── 7. Match micro-interventions ── */
    const interventions = isInCooldown ? [] : matchInterventions(mismatches, dismissedIds);

    /* ── 8. Build metabolic context summary ── */
    const metabolicState = {
      hrvCurrent: Math.round(hrvCurrent),
      hrvBaseline: Math.round(hrvBaseline),
      hrvDropPct: Math.round(hrvDropPct),
      isStressed: hasHrvStress,
      lastMealMinAgo,
      lastMealName: lastMeal?.name ?? null,
      lastMealCarbs,
      totalCarbs4h,
      hba1c,
      crp,
      recentCaffeineMg,
      isMetabolicallySensitive,
      isInflamed,
      isPostMealWindow,
    };

    const hasMismatch = mismatches.length > 0 && !isInCooldown;
    const worstSeverity = mismatches.reduce((worst, m) => {
      const order = { critical: 4, high: 3, moderate: 2, low: 1 };
      return order[m.severity] > order[worst] ? m.severity : worst;
    }, "low" as DetectedMismatch["severity"]);

    return {
      hasMismatch,
      isInCooldown,
      mismatches: isInCooldown ? [] : mismatches,
      interventions: interventions.slice(0, 3),
      metabolicState,
      worstSeverity: hasMismatch ? worstSeverity : "nominal",
      analyzedAt: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   MUTATIONS
   ═══════════════════════════════════════════════════════════════ */

/** Accept a metabolic pulse micro-intervention */
export const acceptPulseIntervention = mutation({
  args: {
    sessionId: v.string(),
    interventionId: v.string(),
    interventionTitle: v.string(),
    pattern: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Log acceptance
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "metabolic_pulse_accepted",
      eventKey: args.interventionId,
      value: `${args.interventionTitle} (${args.pattern})`,
      numericValue: undefined,
      loggedAt: now,
    });

    // Log to protocol logs for audit trail
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: `pulse-${args.interventionId}`,
      protocolName: args.interventionTitle,
      category: "metabolic_pulse",
      loggedAt: now,
      status: "accepted",
    });

    return { accepted: true, interventionId: args.interventionId };
  },
});

/** Dismiss a metabolic pulse micro-intervention */
export const dismissPulseIntervention = mutation({
  args: {
    sessionId: v.string(),
    interventionId: v.string(),
    interventionTitle: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "metabolic_pulse_dismissed",
      eventKey: args.interventionId,
      value: args.interventionTitle,
      numericValue: undefined,
      loggedAt: Date.now(),
    });

    return { dismissed: true };
  },
});
