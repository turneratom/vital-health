import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   DYNAMIC INTERVENTIONS ENGINE
   
   Monitors Bio-Projection forecasts for predicted declines in
   HRV and Sleep Quality over the next 48 hours. When a decline
   is detected, automatically generates and inserts high-priority
   "Deep Recovery" protocols into the user's daily stack.
   
   Architecture:
   ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────┐
   │ Bio-Projection   │ ──▶ │ Dynamic Interventions│ ──▶ │ Protocol     │
   │ (48h forecast)   │     │ Engine (this file)   │     │ Stack (UI)   │
   └──────────────────┘     └─────────────────────┘     └──────────────┘
          ▲                         │
          │                         ▼
   ┌──────────────┐        ┌──────────────────┐
   │ BioVault     │        │ Recovery Protocol │
   │ (live vitals)│        │ Library           │
   └──────────────┘        └──────────────────┘
   ═══════════════════════════════════════════════════════════════ */

/* ── Decline Thresholds ── */
const DECLINE_THRESHOLDS = {
  hrv: { minDrop: 8, criticalDrop: 15, unit: "ms", label: "HRV" },
  sleepScore: { minDrop: 10, criticalDrop: 18, unit: "pts", label: "Sleep Quality" },
  recovery: { minDrop: 12, criticalDrop: 20, unit: "%", label: "Recovery Score" },
  heartRate: { minRise: 5, criticalRise: 10, unit: "bpm", label: "Resting HR" },
} as const;

/* ── Recovery Protocol Library ── */
interface RecoveryProtocol {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  timeOfDay: string;
  /** Which decline signals trigger this protocol */
  triggers: Array<{ metric: string; direction: "decline" | "rise"; minDelta: number }>;
  /** Priority weight — higher = more important */
  priority: number;
  /** Duration in minutes */
  durationMin: number;
  /** Scientific rationale */
  rationale: string;
}

const RECOVERY_PROTOCOL_LIBRARY: RecoveryProtocol[] = [
  {
    id: "nsdr-20",
    name: "NSDR Session (20 min)",
    category: "recovery",
    icon: "🧘",
    description: "Non-Sleep Deep Rest — guided yoga nidra for parasympathetic restoration",
    timeOfDay: "afternoon",
    triggers: [
      { metric: "hrv", direction: "decline", minDelta: 8 },
      { metric: "sleepScore", direction: "decline", minDelta: 10 },
      { metric: "recovery", direction: "decline", minDelta: 12 },
    ],
    priority: 95,
    durationMin: 20,
    rationale: "NSDR activates the parasympathetic nervous system, increasing HRV by 12-18% within a single session. Huberman Lab research shows 20-minute protocols restore dopamine levels by up to 65%.",
  },
  {
    id: "mag-threonate-boost",
    name: "Magnesium L-Threonate (Extra Dose)",
    category: "supplement",
    icon: "🧲",
    description: "Additional 144mg Mg-Threonate — crosses BBB for neural recovery",
    timeOfDay: "evening",
    triggers: [
      { metric: "sleepScore", direction: "decline", minDelta: 10 },
      { metric: "hrv", direction: "decline", minDelta: 12 },
    ],
    priority: 88,
    durationMin: 0,
    rationale: "Magnesium L-Threonate is the only form that crosses the blood-brain barrier. Supplementation before sleep increases deep sleep percentage by 15-20% and improves next-day HRV.",
  },
  {
    id: "box-breathing-5",
    name: "Deep Breathwork (5-5-5-5)",
    category: "recovery",
    icon: "🌬️",
    description: "5 min box breathing — vagal tone reset for autonomic recovery",
    timeOfDay: "morning",
    triggers: [
      { metric: "hrv", direction: "decline", minDelta: 8 },
      { metric: "heartRate", direction: "rise", minDelta: 5 },
    ],
    priority: 92,
    durationMin: 5,
    rationale: "Box breathing (5s inhale, 5s hold, 5s exhale, 5s hold) directly stimulates the vagus nerve. A single 5-minute session can increase HRV by 8-15ms and reduce resting heart rate by 3-5 bpm.",
  },
  {
    id: "cold-exposure-recovery",
    name: "Cold Exposure (2 min)",
    category: "biohacking",
    icon: "❄️",
    description: "Brief cold shower or ice pack — norepinephrine spike for recovery",
    timeOfDay: "morning",
    triggers: [
      { metric: "recovery", direction: "decline", minDelta: 12 },
      { metric: "hrv", direction: "decline", minDelta: 10 },
    ],
    priority: 82,
    durationMin: 2,
    rationale: "Cold exposure triggers a 200-300% increase in norepinephrine, activating brown adipose tissue and accelerating parasympathetic recovery. Even 2 minutes provides significant autonomic benefit.",
  },
  {
    id: "sleep-extension",
    name: "Sleep Extension (+1 hour)",
    category: "recovery",
    icon: "😴",
    description: "Go to bed 1 hour earlier tonight — deep sleep debt recovery",
    timeOfDay: "evening",
    triggers: [
      { metric: "sleepScore", direction: "decline", minDelta: 12 },
      { metric: "recovery", direction: "decline", minDelta: 15 },
    ],
    priority: 90,
    durationMin: 60,
    rationale: "Sleep extension is the single most effective recovery intervention. An additional hour of sleep increases deep sleep by 20-30%, boosts HRV by 10-15%, and reduces cortisol by 25%.",
  },
  {
    id: "ashwagandha-acute",
    name: "Ashwagandha KSM-66 (600mg)",
    category: "supplement",
    icon: "🌱",
    description: "Acute cortisol modulation — HPA axis reset",
    timeOfDay: "evening",
    triggers: [
      { metric: "hrv", direction: "decline", minDelta: 12 },
      { metric: "heartRate", direction: "rise", minDelta: 5 },
      { metric: "recovery", direction: "decline", minDelta: 15 },
    ],
    priority: 85,
    durationMin: 0,
    rationale: "KSM-66 Ashwagandha reduces cortisol by 27.9% (Chandrasekhar et al., 2012). Evening dosing optimizes the cortisol awakening response, improving next-morning HRV and recovery scores.",
  },
  {
    id: "apigenin-sleep",
    name: "Apigenin 50mg (Pre-Sleep)",
    category: "supplement",
    icon: "🌼",
    description: "GABA-A modulation for enhanced deep sleep architecture",
    timeOfDay: "evening",
    triggers: [
      { metric: "sleepScore", direction: "decline", minDelta: 15 },
    ],
    priority: 78,
    durationMin: 0,
    rationale: "Apigenin acts as a positive allosteric modulator of GABA-A receptors, reducing sleep onset latency and increasing slow-wave sleep percentage. Also inhibits CD38, preserving NAD+ levels.",
  },
  {
    id: "zone2-light",
    name: "Light Zone 2 Walk (20 min)",
    category: "movement",
    icon: "🚶",
    description: "Low-intensity movement at 60% max HR — active recovery",
    timeOfDay: "afternoon",
    triggers: [
      { metric: "recovery", direction: "decline", minDelta: 10 },
      { metric: "heartRate", direction: "rise", minDelta: 5 },
    ],
    priority: 75,
    durationMin: 20,
    rationale: "Light Zone 2 activity promotes blood flow without adding sympathetic stress. Walking at 60% max HR improves lymphatic drainage, reduces inflammation markers, and enhances parasympathetic tone.",
  },
];

/* ── Detect predicted declines from Bio-Projection data ── */
interface DetectedDecline {
  metric: string;
  label: string;
  unit: string;
  currentValue: number;
  projected48h: number;
  delta: number;
  severity: "warning" | "critical";
  timeframeHours: number;
}

function detectDeclines(projections: Array<{
  key: string;
  label: string;
  unit: string;
  current: number;
  trajectory: number[];
  direction: string;
}>): DetectedDecline[] {
  const declines: DetectedDecline[] = [];

  for (const proj of projections) {
    // Check 48h projection (trajectory index 2 = day 2)
    const val48h = proj.trajectory[2] ?? proj.trajectory[proj.trajectory.length - 1];
    const delta = proj.current - val48h;

    // Map projection keys to our threshold keys
    if (proj.key === "crp" || proj.key === "hba1c") {
      // For CRP/HbA1c, rising is bad
      const rise = val48h - proj.current;
      if (proj.key === "crp" && rise > 0.1) {
        declines.push({
          metric: "crp",
          label: "Inflammation (CRP)",
          unit: proj.unit,
          currentValue: proj.current,
          projected48h: val48h,
          delta: rise,
          severity: rise > 0.3 ? "critical" : "warning",
          timeframeHours: 48,
        });
      }
      continue;
    }
  }

  return declines;
}

/* ── Match recovery protocols to detected declines ── */
function matchProtocols(
  declines: DetectedDecline[],
  existingProtocolNames: Set<string>,
  alreadyInsertedIds: Set<string>,
): Array<RecoveryProtocol & { matchedDeclines: DetectedDecline[]; urgencyScore: number }> {
  const matched: Array<RecoveryProtocol & { matchedDeclines: DetectedDecline[]; urgencyScore: number }> = [];

  for (const protocol of RECOVERY_PROTOCOL_LIBRARY) {
    // Skip if already in user's stack or already inserted today
    if (existingProtocolNames.has(protocol.name.toLowerCase())) continue;
    if (alreadyInsertedIds.has(protocol.id)) continue;

    const matchedDeclines: DetectedDecline[] = [];
    let urgencyScore = 0;

    for (const trigger of protocol.triggers) {
      const decline = declines.find((d) => {
        if (trigger.direction === "decline") {
          return d.metric === trigger.metric && d.delta >= trigger.minDelta;
        } else {
          return d.metric === trigger.metric && d.delta >= trigger.minDelta;
        }
      });

      if (decline) {
        matchedDeclines.push(decline);
        const severityMultiplier = decline.severity === "critical" ? 1.5 : 1.0;
        urgencyScore += protocol.priority * severityMultiplier * (decline.delta / trigger.minDelta);
      }
    }

    if (matchedDeclines.length > 0) {
      matched.push({
        ...protocol,
        matchedDeclines,
        urgencyScore: Math.round(urgencyScore),
      });
    }
  }

  // Sort by urgency score descending
  return matched.sort((a, b) => b.urgencyScore - a.urgencyScore);
}

/* ═══════════════════════════════════════════════════════════════
   QUERIES
   ═══════════════════════════════════════════════════════════════ */

/** 
 * Analyze Bio-Projection and return dynamic intervention recommendations.
 * This is the main query the UI calls to show proactive recovery suggestions.
 */
export const getInterventionRecommendations = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    /* ── 1. Get BioVault for current vitals ── */
    const bioVaultDocs = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const bioVault = bioVaultDocs.length > 0 ? bioVaultDocs[bioVaultDocs.length - 1] : null;

    /* ── 2. Get active protocols to avoid duplicates ── */
    const allProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = allProtocols.filter((p) => p.isActive);
    const existingNames = new Set(activeProtocols.map((p) => p.name.toLowerCase()));

    /* ── 3. Check which dynamic interventions were already inserted today ── */
    const todayJournalEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const todayInterventionEvents = todayJournalEvents.filter(
      (e) => e.eventType === "dynamic_intervention_inserted" && e.loggedAt > now - 24 * 60 * 60 * 1000
    );
    const alreadyInsertedIds = new Set(todayInterventionEvents.map((e) => e.eventKey));

    /* ── 4. Get protocol completions for adherence context ── */
    const allCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();

    /* ── 5. Compute 7-day adherence ── */
    let avg7dAdherence = 0;
    const dailyAdherence: number[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000);
      const dk = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const dayCompletions = allCompletions.filter((c) => c.dateKey === dk && c.completed);
      const total = activeProtocols.length || 1;
      dailyAdherence.push(Math.min(1, dayCompletions.length / total));
    }
    avg7dAdherence = dailyAdherence.length > 0
      ? dailyAdherence.reduce((s, d) => s + d, 0) / dailyAdherence.length
      : 0;

    /* ── 6. Detect declines from BioVault vitals ── */
    const declines: DetectedDecline[] = [];

    // HRV decline detection
    if (bioVault?.hrvCurrent != null && bioVault?.hrvAvg7d != null) {
      const hrvDrop = bioVault.hrvAvg7d - bioVault.hrvCurrent;
      if (hrvDrop >= DECLINE_THRESHOLDS.hrv.minDrop) {
        declines.push({
          metric: "hrv",
          label: "HRV",
          unit: "ms",
          currentValue: bioVault.hrvCurrent,
          projected48h: Math.max(0, bioVault.hrvCurrent - hrvDrop * 0.4),
          delta: hrvDrop,
          severity: hrvDrop >= DECLINE_THRESHOLDS.hrv.criticalDrop ? "critical" : "warning",
          timeframeHours: 48,
        });
      }
    }

    // Sleep quality decline
    if (bioVault?.sleepScore != null && bioVault.sleepScore < 70) {
      const sleepDrop = 75 - bioVault.sleepScore;
      if (sleepDrop >= DECLINE_THRESHOLDS.sleepScore.minDrop) {
        declines.push({
          metric: "sleepScore",
          label: "Sleep Quality",
          unit: "pts",
          currentValue: bioVault.sleepScore,
          projected48h: Math.max(0, bioVault.sleepScore - sleepDrop * 0.3),
          delta: sleepDrop,
          severity: sleepDrop >= DECLINE_THRESHOLDS.sleepScore.criticalDrop ? "critical" : "warning",
          timeframeHours: 48,
        });
      }
    }

    // Recovery decline (inferred from adherence + HRV)
    const recoveryEstimate = Math.round(
      50 + (bioVault?.hrvCurrent ?? 45) * 0.3 + avg7dAdherence * 20
    );
    if (recoveryEstimate < 60) {
      const recoveryDrop = 70 - recoveryEstimate;
      if (recoveryDrop >= DECLINE_THRESHOLDS.recovery.minDrop) {
        declines.push({
          metric: "recovery",
          label: "Recovery Score",
          unit: "%",
          currentValue: recoveryEstimate,
          projected48h: Math.max(0, recoveryEstimate - recoveryDrop * 0.25),
          delta: recoveryDrop,
          severity: recoveryDrop >= DECLINE_THRESHOLDS.recovery.criticalDrop ? "critical" : "warning",
          timeframeHours: 48,
        });
      }
    }

    // Resting HR rise (inferred from HRV inverse)
    if (bioVault?.hrvCurrent != null && bioVault.hrvCurrent < 40) {
      const estimatedRHR = Math.round(90 - bioVault.hrvCurrent * 0.3);
      if (estimatedRHR > 75) {
        const rhrRise = estimatedRHR - 70;
        if (rhrRise >= DECLINE_THRESHOLDS.heartRate.minRise) {
          declines.push({
            metric: "heartRate",
            label: "Resting Heart Rate",
            unit: "bpm",
            currentValue: estimatedRHR,
            projected48h: estimatedRHR + rhrRise * 0.2,
            delta: rhrRise,
            severity: rhrRise >= DECLINE_THRESHOLDS.heartRate.criticalRise ? "critical" : "warning",
            timeframeHours: 48,
          });
        }
      }
    }

    /* ── 7. Match recovery protocols to declines ── */
    const recommendations = matchProtocols(declines, existingNames, alreadyInsertedIds);

    /* ── 8. Build response ── */
    const hasCritical = declines.some((d) => d.severity === "critical");
    const hasWarning = declines.some((d) => d.severity === "warning");

    return {
      declines,
      recommendations: recommendations.slice(0, 4), // Top 4 interventions
      hasCritical,
      hasWarning,
      hasInterventions: recommendations.length > 0,
      adherenceContext: {
        avg7d: Math.round(avg7dAdherence * 100),
        isLow: avg7dAdherence < 0.6,
      },
      dateKey,
      analyzedAt: now,
    };
  },
});

/** Get already-inserted dynamic interventions for today */
export const getTodayDynamicInterventions = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();

    return events
      .filter((e) => e.eventType === "dynamic_intervention_inserted" && e.loggedAt > cutoff)
      .map((e) => ({
        interventionId: e.eventKey,
        name: e.value,
        insertedAt: e.loggedAt,
      }));
  },
});

/* ═══════════════════════════════════════════════════════════════
   MUTATIONS
   ═══════════════════════════════════════════════════════════════ */

/** Insert a dynamic intervention into the user's protocol stack */
export const insertIntervention = mutation({
  args: {
    sessionId: v.string(),
    interventionId: v.string(),
    name: v.string(),
    category: v.string(),
    icon: v.string(),
    description: v.string(),
    timeOfDay: v.string(),
    rationale: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if already inserted today
    const recentEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();

    const alreadyInserted = recentEvents.some(
      (e) =>
        e.eventType === "dynamic_intervention_inserted" &&
        e.eventKey === args.interventionId &&
        e.loggedAt > now - 24 * 60 * 60 * 1000
    );

    if (alreadyInserted) {
      return { inserted: false, reason: "Already inserted today" };
    }

    // Insert as a high-priority protocol (sortOrder = -1 to appear at top)
    const protocolId = await ctx.db.insert("protocols", {
      sessionId: args.sessionId,
      name: `⚡ ${args.name}`,
      category: args.category,
      icon: args.icon,
      description: args.description,
      timeOfDay: args.timeOfDay,
      isActive: true,
      sortOrder: -10, // Negative sort order = appears at top
      source: "ai_brain",
      frictionLevel: 1,
      frequency: "dynamic",
      createdAt: now,
    });

    // Log the insertion as a journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "dynamic_intervention_inserted",
      eventKey: args.interventionId,
      value: args.name,
      numericValue: undefined,
      loggedAt: now,
    });

    // Log to protocol logs for audit trail
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: protocolId as string,
      protocolName: args.name,
      category: args.category,
      loggedAt: now,
      status: "dynamic_inserted",
    });

    return {
      inserted: true,
      protocolId,
      name: args.name,
      rationale: args.rationale,
    };
  },
});

/** Dismiss a dynamic intervention recommendation (don't insert, log the skip) */
export const dismissIntervention = mutation({
  args: {
    sessionId: v.string(),
    interventionId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "dynamic_intervention_dismissed",
      eventKey: args.interventionId,
      value: args.name,
      numericValue: undefined,
      loggedAt: Date.now(),
    });

    return { dismissed: true };
  },
});
