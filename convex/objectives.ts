import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   Mission Objectives — Goal tracking with AI probability + milestones
   ═══════════════════════════════════════════════════════════════ */

const BIOVAULT_KEY_MAP: Record<string, { unit: string; label: string; optMin: number; optMax: number }> = {
  testosteroneTotal: { unit: "ng/dL", label: "Total Testosterone", optMin: 400, optMax: 900 },
  testosteroneFree: { unit: "pg/mL", label: "Free Testosterone", optMin: 15, optMax: 25 },
  vitaminD: { unit: "ng/mL", label: "Vitamin D", optMin: 40, optMax: 80 },
  crp: { unit: "mg/L", label: "hs-CRP", optMin: 0, optMax: 1.0 },
  hba1c: { unit: "%", label: "HbA1c", optMin: 4.0, optMax: 5.6 },
  ferritin: { unit: "ng/mL", label: "Ferritin", optMin: 40, optMax: 200 },
  sleepScore: { unit: "/100", label: "Sleep Score", optMin: 70, optMax: 100 },
  hrvCurrent: { unit: "ms", label: "HRV", optMin: 40, optMax: 120 },
};

// ── Create a new objective (max 3 active) ──
export const createObjective = mutation({
  args: {
    sessionId: v.string(),
    title: v.string(),
    category: v.string(),
    targetValue: v.number(),
    targetUnit: v.string(),
    currentValue: v.number(),
    bioVaultKey: v.optional(v.string()),
    targetDate: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("objectives")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const active = existing.filter((o) => o.status === "active");
    if (active.length >= 3) throw new Error("Maximum 3 active objectives allowed");

    const now = Date.now();
    const objId = await ctx.db.insert("objectives", {
      ...args,
      status: "active",
      probability: undefined,
      probabilityReason: undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create milestones at 25%, 50%, 75%, 100%
    const checkpoints = [25, 50, 75, 100];
    const startVal = args.currentValue;
    const delta = args.targetValue - startVal;
    for (const pct of checkpoints) {
      const milestoneVal = Math.round((startVal + delta * (pct / 100)) * 10) / 10;
      const reached = pct === 0 || (delta > 0 ? args.currentValue >= milestoneVal : args.currentValue <= milestoneVal);
      await ctx.db.insert("objectiveMilestones", {
        sessionId: args.sessionId,
        objectiveId: objId,
        checkpoint: pct,
        title: pct === 100 ? `🏆 Goal reached: ${args.targetValue}${args.targetUnit}` : `${pct}% — Reach ${milestoneVal}${args.targetUnit}`,
        reachedAt: reached ? now : undefined,
        status: reached ? "reached" : "pending",
      });
    }

    return objId;
  },
});

// ── Update objective progress (pulls from BioVault automatically) ──
export const syncObjectiveProgress = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const objectives = await ctx.db
      .query("objectives")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const active = objectives.filter((o) => o.status === "active");
    if (active.length === 0) return [];

    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const updated: string[] = [];

    for (const obj of active) {
      let newValue = obj.currentValue;

      // Pull from BioVault if key is mapped
      if (obj.bioVaultKey && vault) {
        const val = (vault as any)[obj.bioVaultKey];
        if (val != null && typeof val === "number") newValue = val;
      }

      // Pull weight from vitals
      if (obj.category === "body_composition" && vitals) {
        if (obj.title.toLowerCase().includes("body fat")) {
          // Body fat not directly stored, keep manual
        } else if (obj.title.toLowerCase().includes("weight")) {
          newValue = vitals.weight;
        }
      }

      if (newValue !== obj.currentValue) {
        await ctx.db.patch(obj._id, { currentValue: newValue, updatedAt: now });
        updated.push(obj._id);

        // Check milestones
        const milestones = await ctx.db
          .query("objectiveMilestones")
          .withIndex("by_objectiveId", (q) => q.eq("objectiveId", obj._id))
          .collect();

        const startVal = obj.currentValue;
        const delta = obj.targetValue - startVal;
        const isIncreasing = delta > 0;

        for (const ms of milestones) {
          if (ms.status === "reached") continue;
          const msTarget = startVal + delta * (ms.checkpoint / 100);
          const reached = isIncreasing ? newValue >= msTarget : newValue <= msTarget;
          if (reached) {
            await ctx.db.patch(ms._id, { status: "reached", reachedAt: now });
          }
        }

        // Check if goal is complete
        const goalReached = isIncreasing ? newValue >= obj.targetValue : newValue <= obj.targetValue;
        if (goalReached) {
          await ctx.db.patch(obj._id, { status: "completed", updatedAt: now });
        }
      }
    }

    return updated;
  },
});

// ── Update objective manually ──
export const updateObjective = mutation({
  args: {
    id: v.id("objectives"),
    currentValue: v.optional(v.number()),
    targetValue: v.optional(v.number()),
    targetDate: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const clean = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
    await ctx.db.patch(id, { ...clean, updatedAt: Date.now() });
    return id;
  },
});

// ── Delete objective + milestones ──
export const deleteObjective = mutation({
  args: { id: v.id("objectives") },
  handler: async (ctx, args) => {
    const milestones = await ctx.db
      .query("objectiveMilestones")
      .withIndex("by_objectiveId", (q) => q.eq("objectiveId", args.id))
      .collect();
    for (const ms of milestones) await ctx.db.delete(ms._id);
    await ctx.db.delete(args.id);
  },
});

// ── Query: Get all objectives + milestones for session ──
export const getObjectives = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const objectives = await ctx.db
      .query("objectives")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const result = [];
    for (const obj of objectives) {
      const milestones = await ctx.db
        .query("objectiveMilestones")
        .withIndex("by_objectiveId", (q) => q.eq("objectiveId", obj._id))
        .collect();
      
      // Calculate progress percentage
      const delta = obj.targetValue - obj.currentValue;
      const totalDelta = obj.targetValue - (obj.currentValue - delta); // approximate start
      const startVal = obj.createdAt ? obj.currentValue : 0;
      const range = obj.targetValue - startVal;
      const progress = range !== 0 ? Math.min(100, Math.max(0, ((obj.currentValue - startVal) / range) * 100)) : 0;

      result.push({
        ...obj,
        milestones: milestones.sort((a, b) => a.checkpoint - b.checkpoint),
        progress: Math.round(progress),
      });
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── AI: Forecast probability of hitting goal ──
export const forecastProbability = action({
  args: {
    sessionId: v.string(),
    objectiveId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    probability: number;
    reason: string;
    source: "llm" | "local";
  }> => {
    // Pull objective
    const objectives = await ctx.runQuery(
      "objectives:getObjectives" as any,
      { sessionId: args.sessionId }
    );
    const obj = objectives?.find((o: any) => o._id === args.objectiveId);
    if (!obj) return { probability: 50, reason: "Objective not found", source: "local" };

    // Pull BioVault
    let bioVault: any = null;
    try {
      bioVault = await ctx.runQuery(
        "queries:getBioVaultBySession" as any,
        { sessionId: args.sessionId }
      );
    } catch { /* continue */ }

    // Pull adherence
    let adherenceRate = 0;
    try {
      const adherence = await ctx.runQuery(
        "protocols:getTodayProtocolStatus" as any,
        { sessionId: args.sessionId }
      );
      if (adherence && adherence.total > 0) adherenceRate = adherence.done / adherence.total;
    } catch { /* continue */ }

    // Calculate days remaining
    const now = Date.now();
    const daysRemaining = Math.max(0, Math.round((obj.targetDate - now) / (24 * 60 * 60 * 1000)));
    const daysElapsed = Math.max(1, Math.round((now - obj.createdAt) / (24 * 60 * 60 * 1000)));
    const totalDays = daysElapsed + daysRemaining;

    // Calculate trajectory
    const startValue = obj.currentValue - ((obj.currentValue - obj.currentValue) || 0);
    const progressPct = obj.progress || 0;
    const dailyRate = daysElapsed > 0 ? progressPct / daysElapsed : 0;
    const projectedCompletion = dailyRate > 0 ? Math.round(100 / dailyRate) : 999;
    const onTrack = projectedCompletion <= totalDays;

    // Try LLM
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const context = [
          `OBJECTIVE: "${obj.title}"`,
          `Current: ${obj.currentValue}${obj.targetUnit} → Target: ${obj.targetValue}${obj.targetUnit}`,
          `Progress: ${progressPct}% complete`,
          `Days elapsed: ${daysElapsed}, Days remaining: ${daysRemaining}`,
          `Daily progress rate: ${dailyRate.toFixed(2)}%/day`,
          `Projected completion: ${projectedCompletion} days (${onTrack ? "ON TRACK" : "BEHIND"})`,
          `Protocol adherence: ${Math.round(adherenceRate * 100)}%`,
          bioVault?.sleepScore ? `Sleep score: ${bioVault.sleepScore}/100` : null,
          bioVault?.hrvCurrent ? `HRV: ${bioVault.hrvCurrent}ms` : null,
          bioVault?.crp ? `hs-CRP: ${bioVault.crp} mg/L` : null,
        ].filter(Boolean).join("\n");

        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content: `You are a precision longevity coach forecasting goal probability. Return ONLY JSON: { "probability": <0-100>, "reason": "<1 sentence clinical assessment>" }. Be data-driven and reference specific numbers. No code fences.`,
              },
              { role: "user", content: context },
            ],
            temperature: 0.2,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
          let jsonStr = raw;
          const b0 = jsonStr.indexOf("{");
          const b1 = jsonStr.lastIndexOf("}");
          if (b0 !== -1 && b1 !== -1) jsonStr = jsonStr.slice(b0, b1 + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed.probability === "number" && parsed.reason) {
              // Save to objective
              await ctx.runMutation(
                "objectives:updateObjective" as any,
                { id: obj._id, currentValue: obj.currentValue }
              );
              return { probability: parsed.probability, reason: parsed.reason, source: "llm" };
            }
          } catch { /* fall through */ }
        }
      } catch { /* fall through */ }
    }

    // Local fallback
    let probability: number;
    let reason: string;

    if (daysRemaining <= 0) {
      probability = progressPct >= 95 ? 90 : progressPct >= 75 ? 40 : 10;
      reason = `Deadline reached with ${progressPct}% progress — ${probability >= 50 ? "goal nearly achieved" : "significant gap remains"}.`;
    } else if (onTrack && adherenceRate >= 0.7) {
      probability = Math.min(95, 60 + Math.round(adherenceRate * 25) + Math.round(progressPct * 0.1));
      reason = `On track at ${dailyRate.toFixed(1)}%/day with ${Math.round(adherenceRate * 100)}% protocol adherence — trajectory supports goal completion.`;
    } else if (onTrack) {
      probability = Math.min(80, 45 + Math.round(progressPct * 0.3));
      reason = `Trajectory is viable but adherence at ${Math.round(adherenceRate * 100)}% introduces risk — consistency is the primary lever.`;
    } else {
      probability = Math.max(10, 30 - Math.round((projectedCompletion - totalDays) * 0.5));
      reason = `Behind schedule — current rate projects ${projectedCompletion} days vs ${totalDays} available. Increase protocol intensity.`;
    }

    return { probability, reason, source: "local" };
  },
});
