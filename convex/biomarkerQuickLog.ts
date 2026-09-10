import { mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIOMARKER QUICK-LOG ENGINE
   
   Writes HRV, Sleep Hours, and Subjective Energy from the 'K'
   hotkey drawer. Persists to labResults (biomarkers table) +
   journalEvents for Briefing Room reactivity.
   ═══════════════════════════════════════════════════════════════ */

export const logBiomarkers = mutation({
  args: {
    sessionId: v.string(),
    hrv: v.number(),
    sleepHours: v.number(),
    energy: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results: string[] = [];

    // 1. Write HRV to labResults (biomarkers table)
    await ctx.db.insert("labResults", {
      sessionId: args.sessionId,
      marker: "hrv",
      value: args.hrv,
      unit: "ms",
      source: "quick-log",
      notes: `Quick-logged via K hotkey`,
      testedAt: now,
      loggedAt: now,
    });
    results.push("hrv");

    // 2. Write HRV to hrvReadings for trend analysis
    await ctx.db.insert("hrvReadings", {
      sessionId: args.sessionId,
      value: args.hrv,
      context: "morning",
      source: "manual",
      measuredAt: now,
      loggedAt: now,
    });

    // 3. Write Sleep Hours to labResults
    await ctx.db.insert("labResults", {
      sessionId: args.sessionId,
      marker: "sleep_hours",
      value: args.sleepHours,
      unit: "hrs",
      source: "quick-log",
      notes: `Quick-logged via K hotkey`,
      testedAt: now,
      loggedAt: now,
    });
    results.push("sleep_hours");

    // 4. Write Subjective Energy to labResults
    await ctx.db.insert("labResults", {
      sessionId: args.sessionId,
      marker: "subjective_energy",
      value: args.energy,
      unit: "/10",
      source: "quick-log",
      notes: `Quick-logged via K hotkey`,
      testedAt: now,
      loggedAt: now,
    });
    results.push("subjective_energy");

    // 5. Also write to journalEvents for Briefing Room AI reactivity
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "vital",
      eventKey: "hrv",
      value: `${args.hrv} ms`,
      numericValue: args.hrv,
      loggedAt: now,
    });

    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "vital",
      eventKey: "sleep_hours",
      value: `${args.sleepHours} hrs`,
      numericValue: args.sleepHours,
      loggedAt: now,
    });

    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "energy",
      eventKey: "energy_score",
      value: `Energy: ${args.energy}/10`,
      numericValue: args.energy,
      loggedAt: now,
    });

    // 6. Update latest elite score HRV if exists
    const latestScore = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();
    if (latestScore) {
      await ctx.db.patch(latestScore._id, {
        currentHrv: args.hrv,
        calculatedAt: now,
      });
    }

    // 7. Update bioVault summary fields
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (bioVault) {
      await ctx.db.patch(bioVault._id, {
        hrvCurrent: args.hrv,
        sleepHours: args.sleepHours,
        updatedAt: now,
      });
    }

    return {
      success: true,
      logged: results,
      hrv: args.hrv,
      sleepHours: args.sleepHours,
      energy: args.energy,
    };
  },
});
