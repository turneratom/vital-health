import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   RECOVERY PROTOCOL ENGINE
   
   Monitors LongevityScore trajectory. If the composite score
   drops ≥15% within a 24-hour window, the system pivots the
   MicroInterventionHUD into "Crisis Management" mode and
   surfaces 3 immediate recovery actions.
   
   The FluidCanvas dims to a restful amber hue until all 3
   actions are checked off by the user.
   ═══════════════════════════════════════════════════════════════ */

/* ── Crisis Action Templates ── */

interface CrisisAction {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "hydration" | "peptide" | "light" | "breathwork" | "supplement" | "sleep";
  dose: string;
  timing: string;
  accentColor: string;
  /** How much this action contributes to recovery (0-1) */
  recoveryWeight: number;
}

/** Generate 3 crisis actions based on current bio-state signals */
function generateCrisisActions(signals: {
  hrvDrop: number;
  sleepScore: number;
  tensionSeverity: number;
  adherenceRate: number;
  crp: number | null;
  hour: number;
}): CrisisAction[] {
  const actions: CrisisAction[] = [];

  // ── ACTION 1: Always start with Optimized Hydration ──
  // Hydration is the fastest lever for acute recovery
  const isEvening = signals.hour >= 18;
  actions.push({
    id: "crisis-hydration",
    title: "Optimized Hydration Protocol",
    subtitle: "Electrolyte + Mineral Rebalance",
    description: isEvening
      ? "500ml water with 1/4 tsp Himalayan salt + 200mg Magnesium Glycinate. Evening hydration supports overnight cellular repair without disrupting sleep via excess volume."
      : "750ml water with electrolyte mix (Na 1000mg, K 200mg, Mg 60mg). Acute dehydration amplifies cortisol and suppresses HRV — this reverses the cascade within 30 minutes.",
    icon: "💧",
    category: "hydration",
    dose: isEvening ? "500ml + Mg" : "750ml + electrolytes",
    timing: "Now · Immediate",
    accentColor: "#00B4D8",
    recoveryWeight: 0.30,
  });

  // ── ACTION 2: Context-dependent peptide/supplement ──
  if (signals.hrvDrop > 20 || signals.crp !== null && signals.crp > 2.0) {
    // Severe autonomic stress → BPC-157 or high-dose anti-inflammatory
    actions.push({
      id: "crisis-peptide",
      title: "BPC-157 Recovery Dose",
      subtitle: "Tissue Repair + Anti-Inflammatory",
      description: `HRV dropped ${Math.round(signals.hrvDrop)}% — systemic inflammation likely elevated. BPC-157 (250mcg subcutaneous) upregulates VEGF and reduces NF-κB signaling within 2-4 hours. If unavailable, substitute 4g EPA Omega-3 + 1g Curcumin.`,
      icon: "🧬",
      category: "peptide",
      dose: "250mcg SC or 4g EPA + 1g Curcumin",
      timing: "Now · With food if oral",
      accentColor: "#A78BFA",
      recoveryWeight: 0.35,
    });
  } else if (signals.sleepScore < 55) {
    // Poor sleep driving the crash → sleep-targeted intervention
    actions.push({
      id: "crisis-sleep-stack",
      title: "Emergency Sleep Stack",
      subtitle: "Glycine + Apigenin + L-Theanine",
      description: `Sleep score ${signals.sleepScore}/100 is critically low and driving systemic decline. 3g Glycine lowers core temp for sleep onset, 50mg Apigenin activates GABA-A, 200mg L-Theanine reduces cortisol for deeper slow-wave architecture.`,
      icon: "🌙",
      category: "sleep",
      dose: "3g Glycine + 50mg Apigenin + 200mg L-Theanine",
      timing: "PM · 45min before bed",
      accentColor: "#6366F1",
      recoveryWeight: 0.35,
    });
  } else if (signals.tensionSeverity >= 6) {
    // High somatic tension → targeted relief
    actions.push({
      id: "crisis-tension-relief",
      title: "Acute Tension Protocol",
      subtitle: "Magnesium + Targeted Cold",
      description: `Somatic tension at ${signals.tensionSeverity}/10 is creating a pain-cortisol feedback loop. 500mg Magnesium L-Threonate (crosses BBB) + 2-minute cold pack on highest-tension region breaks the cycle.`,
      icon: "🧊",
      category: "supplement",
      dose: "500mg Mg-Threonate + cold pack",
      timing: "Now · 2 minutes",
      accentColor: "#F59E0B",
      recoveryWeight: 0.35,
    });
  } else {
    // General recovery → adaptogenic support
    actions.push({
      id: "crisis-adaptogen",
      title: "Adaptogenic Recovery Stack",
      subtitle: "Ashwagandha + Rhodiola",
      description: "Composite score crash without a single dominant driver suggests multi-system stress. 600mg Ashwagandha KSM-66 modulates cortisol via HSD11B1, 200mg Rhodiola supports mitochondrial ATP production under stress.",
      icon: "🌿",
      category: "supplement",
      dose: "600mg Ashwagandha + 200mg Rhodiola",
      timing: "Now · With meal",
      accentColor: "#10B981",
      recoveryWeight: 0.35,
    });
  }

  // ── ACTION 3: Light Exposure / Breathwork (circadian reset) ──
  if (signals.hour >= 6 && signals.hour < 14) {
    // Morning/midday → bright light exposure
    actions.push({
      id: "crisis-light",
      title: "Bright Light Exposure",
      subtitle: "Circadian Reset · Cortisol Timing",
      description: "10 minutes of bright outdoor light (10,000+ lux) within the next hour. Morning light exposure via melanopsin receptors resets the cortisol awakening response and anchors circadian rhythm — the single most impactful free intervention for recovery.",
      icon: "☀️",
      category: "light",
      dose: "10 minutes · Outdoor",
      timing: "Now · Next 60 minutes",
      accentColor: "#FBBF24",
      recoveryWeight: 0.35,
    });
  } else if (signals.hour >= 14 && signals.hour < 20) {
    // Afternoon → breathwork for parasympathetic activation
    actions.push({
      id: "crisis-breathwork",
      title: "Physiological Sigh Protocol",
      subtitle: "Rapid Parasympathetic Activation",
      description: "5 minutes of double-inhale-long-exhale (physiological sigh). This is the fastest known method to shift autonomic balance — activates vagal brake within 90 seconds, reduces cortisol, and improves HRV acutely.",
      icon: "🫁",
      category: "breathwork",
      dose: "5 minutes",
      timing: "Now · Find quiet space",
      accentColor: "#06B6D4",
      recoveryWeight: 0.35,
    });
  } else {
    // Evening/night → dim light + NSDR
    actions.push({
      id: "crisis-nsdr",
      title: "NSDR / Yoga Nidra",
      subtitle: "Non-Sleep Deep Rest",
      description: "20-minute guided NSDR session in dim/red light. Evening bright light disrupts melatonin — instead, NSDR replenishes dopamine stores and provides 2-3 hours equivalent rest. Dim all screens to minimum brightness.",
      icon: "🧘",
      category: "breathwork",
      dose: "20 minutes · Dim light",
      timing: "Now · Before bed prep",
      accentColor: "#8B5CF6",
      recoveryWeight: 0.35,
    });
  }

  return actions;
}

/* ═══════════════════════════════════════════════════════════════
   QUERY: getCrisisStatus
   
   Computes current vs. recent-peak LongevityScore to detect
   ≥15% drops. Returns crisis state + 3 recovery actions.
   ═══════════════════════════════════════════════════════════════ */

export const getCrisisStatus = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    try {
      // ── Check for active crisis session first ──
      const activeCrisis = await ctx.db
        .query("recoveryProtocolSessions")
        .withIndex("by_sessionId_and_status", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("status", "active")
        )
        .first();

      if (activeCrisis) {
        // Parse stored actions and completion state
        const actions: CrisisAction[] = JSON.parse(activeCrisis.actions);
        const completedIds: string[] = JSON.parse(activeCrisis.completedActionIds);
        const allComplete = completedIds.length >= actions.length;

        // If all complete, auto-resolve
        if (allComplete && activeCrisis.status === "active") {
          // Don't mutate in query — just report resolved
          return {
            inCrisis: false,
            resolved: true,
            resolvedJustNow: true,
            scoreDropPct: activeCrisis.scoreDropPct,
            peakScore: activeCrisis.peakScore,
            currentScore: activeCrisis.currentScore,
            actions: [],
            completedActionIds: [],
            crisisSessionId: activeCrisis._id,
            triggeredAt: activeCrisis.triggeredAt,
          };
        }

        return {
          inCrisis: true,
          resolved: false,
          resolvedJustNow: false,
          scoreDropPct: activeCrisis.scoreDropPct,
          peakScore: activeCrisis.peakScore,
          currentScore: activeCrisis.currentScore,
          actions,
          completedActionIds: completedIds,
          crisisSessionId: activeCrisis._id,
          triggeredAt: activeCrisis.triggeredAt,
        };
      }

      // ── No active crisis — check if we should trigger one ──

      // Gather recent LongevityScore signals (recompute lightweight version)
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", now - 7 * dayMs)
        )
        .collect();

      const latestHrv = hrvReadings.length > 0
        ? hrvReadings.sort((a, b) => b.measuredAt - a.measuredAt)[0].value : 0;
      const avgHrv7d = hrvReadings.length > 0
        ? hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length : 0;
      const hrvDrop = avgHrv7d > 0 ? Math.max(0, ((avgHrv7d - latestHrv) / avgHrv7d) * 100) : 0;

      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentSleep = sleepLogs.filter(s => now - s.loggedAt < 3 * dayMs)
        .sort((a, b) => b.loggedAt - a.loggedAt);
      const sleepScore = recentSleep[0]?.sleepScore ?? 65;

      const bodyMapEntries = await ctx.db
        .query("bodyMapEntries")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - dayMs)
        )
        .collect();
      const tensionSeverity = bodyMapEntries.length > 0
        ? Math.max(...bodyMapEntries.map(e => e.severity)) : 0;

      const bioVault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .first();

      // Protocol adherence
      const dateKey = new Date().toISOString().slice(0, 10);
      const protocols = await ctx.db
        .query("protocols")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const activeProtocols = protocols.filter(p => p.isActive);
      const completions = await ctx.db
        .query("protocolCompletions")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
        )
        .collect();
      const adherenceRate = activeProtocols.length > 0
        ? completions.filter(c => c.completed).length / activeProtocols.length : 0.5;

      // ── Compute lightweight score ──
      const hrvScore = latestHrv > 0 ? Math.min(25, Math.round((Math.min(latestHrv / 80, 1.25)) * 20)) : 10;
      const hrvBonus = hrvDrop < 5 ? 5 : hrvDrop < 15 ? 2 : 0;
      const autonomic = Math.min(25, hrvScore + hrvBonus);

      const sleepComp = sleepScore > 0 ? Math.round((sleepScore / 100) * 15) : 7;
      const sleepBonus = (recentSleep[0]?.totalHours ?? 7) >= 7 ? 5 : (recentSleep[0]?.totalHours ?? 7) >= 6 ? 3 : 0;
      const tensionPen = Math.min(5, Math.round(tensionSeverity * 0.5));
      const recovery = Math.min(25, Math.max(0, sleepComp + sleepBonus + 5 - tensionPen));

      const adherence = Math.min(25, Math.round(adherenceRate * 25));

      const inventory = await ctx.db
        .query("inventory")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const activeInv = inventory.filter(i => i.status === "active" && i.dailyUsageUnits > 0);
      const lowStock = activeInv.filter(i => i.dailyUsageUnits > 0 && Math.floor(i.currentQuantity / i.dailyUsageUnits) <= 7);
      const invCoverage = activeInv.length > 0 ? (activeInv.length - lowStock.length) / activeInv.length : 1;
      const drifts = await ctx.db
        .query("driftEvents")
        .withIndex("by_sessionId_and_status", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("status", "active")
        )
        .collect();
      const integrity = Math.min(25, Math.max(0, Math.round(invCoverage * 15) + 10 - Math.min(10, drifts.length * 3)));

      const currentScore = Math.max(1, Math.min(100, autonomic + recovery + adherence + integrity));

      // ── Check score history for 15% drop ──
      const recentSnapshots = await ctx.db
        .query("longevityScoreHistory")
        .withIndex("by_sessionId_and_calculatedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("calculatedAt", now - dayMs)
        )
        .collect();

      const peakScore = recentSnapshots.length > 0
        ? Math.max(...recentSnapshots.map(s => s.score))
        : currentScore;

      const dropPct = peakScore > 0 ? ((peakScore - currentScore) / peakScore) * 100 : 0;

      if (dropPct >= 15) {
        // Crisis detected — generate actions
        const hour = new Date().getHours();
        const actions = generateCrisisActions({
          hrvDrop,
          sleepScore,
          tensionSeverity,
          adherenceRate,
          crp: bioVault?.crp ?? null,
          hour,
        });

        return {
          inCrisis: true,
          resolved: false,
          resolvedJustNow: false,
          scoreDropPct: Math.round(dropPct),
          peakScore,
          currentScore,
          actions,
          completedActionIds: [] as string[],
          crisisSessionId: null,
          triggeredAt: now,
          needsActivation: true,
        };
      }

      return {
        inCrisis: false,
        resolved: false,
        resolvedJustNow: false,
        scoreDropPct: Math.round(dropPct),
        peakScore,
        currentScore,
        actions: [] as CrisisAction[],
        completedActionIds: [] as string[],
        crisisSessionId: null,
        triggeredAt: null,
      };
    } catch (error) {
      return {
        inCrisis: false,
        resolved: false,
        resolvedJustNow: false,
        scoreDropPct: 0,
        peakScore: 0,
        currentScore: 0,
        actions: [] as CrisisAction[],
        completedActionIds: [] as string[],
        crisisSessionId: null,
        triggeredAt: null,
      };
    }
  },
});

/* ── Mutation: Activate crisis session ── */
export const activateCrisis = mutation({
  args: {
    sessionId: v.string(),
    peakScore: v.number(),
    currentScore: v.number(),
    scoreDropPct: v.number(),
    actions: v.string(), // JSON stringified CrisisAction[]
  },
  handler: async (ctx, args) => {
    // Check for existing active session
    const existing = await ctx.db
      .query("recoveryProtocolSessions")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("recoveryProtocolSessions", {
      sessionId: args.sessionId,
      peakScore: args.peakScore,
      currentScore: args.currentScore,
      scoreDropPct: args.scoreDropPct,
      actions: args.actions,
      completedActionIds: "[]",
      status: "active",
      triggeredAt: Date.now(),
      resolvedAt: undefined,
    });
  },
});

/* ── Mutation: Complete a crisis action ── */
export const completeCrisisAction = mutation({
  args: {
    sessionId: v.string(),
    actionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("recoveryProtocolSessions")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .first();

    if (!session) return { success: false, reason: "No active crisis session" };

    const completedIds: string[] = JSON.parse(session.completedActionIds);
    if (completedIds.includes(args.actionId)) {
      return { success: true, alreadyComplete: true };
    }

    completedIds.push(args.actionId);
    const actions: CrisisAction[] = JSON.parse(session.actions);
    const allComplete = completedIds.length >= actions.length;

    await ctx.db.patch(session._id, {
      completedActionIds: JSON.stringify(completedIds),
      ...(allComplete ? { status: "resolved" as const, resolvedAt: Date.now() } : {}),
    });

    return { success: true, allComplete, completedCount: completedIds.length, totalActions: actions.length };
  },
});

/* ── Mutation: Record a longevity score snapshot ── */
export const recordScoreSnapshot = mutation({
  args: {
    sessionId: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    // Only record once per 15 minutes to avoid spam
    const recent = await ctx.db
      .query("longevityScoreHistory")
      .withIndex("by_sessionId_and_calculatedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("calculatedAt", Date.now() - 15 * 60 * 1000)
      )
      .first();

    if (recent) return { recorded: false, reason: "Too recent" };

    await ctx.db.insert("longevityScoreHistory", {
      sessionId: args.sessionId,
      score: args.score,
      calculatedAt: Date.now(),
    });

    return { recorded: true };
  },
});
