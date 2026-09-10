import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   FIRST SYNC ENGINE
   
   Handles the onboarding "First Sync" sequence:
   1. Checks if user has completed first sync
   2. Saves initial 3 biomarkers (Sleep, HRV, Inflammation)
   3. Generates an immediate first LongevityScore
   4. Seeds initial HRV reading + sleep log + body map entry
   ═══════════════════════════════════════════════════════════════ */

/** Check if user has completed First Sync */
export const hasCompletedFirstSync = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Check if they have any elite scores (means they've been scored)
    const eliteScore = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    if (eliteScore) return { completed: true, score: eliteScore.score };

    // Check if they have any HRV readings
    const hrv = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    if (hrv) return { completed: true, score: null };

    // Check if they have food logs
    const food = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    if (food) return { completed: true, score: null };

    // Check user vitals
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    if (vitals) return { completed: true, score: null };

    return { completed: false, score: null };
  },
});

/** Save initial biomarkers from First Sync and generate first score */
export const saveFirstSyncBiomarkers = mutation({
  args: {
    sessionId: v.string(),
    sleepQuality: v.number(),    // 1-10
    hrvEstimate: v.number(),     // ms (20-120)
    inflammationLevel: v.number(), // 1-10 (1=none, 10=severe)
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { sessionId, sleepQuality, hrvEstimate, inflammationLevel } = args;

    // 1. Seed an HRV reading from their estimate
    await ctx.db.insert("hrvReadings", {
      sessionId,
      value: hrvEstimate,
      context: "first_sync",
      heartRate: Math.round(80 - (hrvEstimate - 40) * 0.3), // rough inverse
      source: "onboarding",
      measuredAt: now,
      loggedAt: now,
    });

    // 2. Seed a sleep log from their quality rating
    const sleepHours = 5 + (sleepQuality / 10) * 3; // 5-8h range
    const sleepScore = Math.round(sleepQuality * 10);
    const deepPct = 15 + (sleepQuality / 10) * 10;
    const remPct = 18 + (sleepQuality / 10) * 7;
    const lightPct = 100 - deepPct - remPct - 5;
    const dateStr = new Date().toISOString().slice(0, 10);
    
    await ctx.db.insert("sleepLogs", {
      sessionId,
      date: dateStr,
      sleepScore,
      totalHours: Math.round(sleepHours * 10) / 10,
      deepHours: Math.round(sleepHours * deepPct / 100 * 10) / 10,
      remHours: Math.round(sleepHours * remPct / 100 * 10) / 10,
      lightHours: Math.round(sleepHours * lightPct / 100 * 10) / 10,
      awakeHours: Math.round(sleepHours * 0.05 * 10) / 10,
      efficiency: Math.round(75 + sleepQuality * 2),
      latencyMin: Math.round(25 - sleepQuality * 1.5),
      heartRateAvg: Math.round(62 - (sleepQuality - 5) * 0.8),
      respiratoryRate: 14.5,
      source: "onboarding",
      bedtimeAt: now - sleepHours * 3600000,
      wakeAt: now,
      loggedAt: now,
    });

    // 3. Seed body map entry from inflammation level
    if (inflammationLevel > 3) {
      const regions = ["lower_back", "shoulders", "gut", "knees", "neck"];
      const region = regions[Math.floor(Math.random() * regions.length)];
      await ctx.db.insert("bodyMapEntries", {
        sessionId,
        region,
        severity: Math.min(10, inflammationLevel),
        description: "Initial inflammation assessment from First Sync",
        source: "first-sync",
        loggedAt: now,
      });
    }

    // 4. Seed a journal event for the first sync
    await ctx.db.insert("journalEvents", {
      sessionId,
      eventType: "first_sync",
      eventKey: "onboarding_complete",
      value: `Sleep: ${sleepQuality}/10, HRV: ${hrvEstimate}ms, Inflammation: ${inflammationLevel}/10`,
      numericValue: sleepQuality,
      loggedAt: now,
    });

    // 5. Calculate immediate first LongevityScore
    const hrvScore = Math.min(25, Math.round((Math.min(hrvEstimate / 80, 1.25)) * 20));
    const recoveryScore = Math.min(25, Math.round((sleepQuality / 10) * 20) + 5);
    const inflammPenalty = Math.min(15, Math.round(inflammationLevel * 1.2));
    const adherenceScore = 12; // baseline for new user
    const integrityScore = 10; // baseline for new user
    
    const compositeScore = Math.max(1, Math.min(100, 
      hrvScore + recoveryScore - inflammPenalty + adherenceScore + integrityScore
    ));

    // 6. Save as elite score
    await ctx.db.insert("eliteScores", {
      sessionId,
      score: compositeScore,
      fuelingPoints: 0,
      movementPoints: 0,
      hrvPoints: hrvScore,
      basePoints: adherenceScore + integrityScore,
      fuelingCount24h: 0,
      movementLogged: false,
      currentHrv: hrvEstimate,
      hrvAvg7d: hrvEstimate,
      calculatedAt: now,
    });

    // 7. Generate summary insight
    let insight = "";
    if (compositeScore >= 75) {
      insight = "Strong biological foundation detected. Your autonomic nervous system and recovery metrics indicate high resilience.";
    } else if (compositeScore >= 55) {
      insight = "Moderate baseline with clear optimization vectors. Focus on sleep architecture and HRV recovery for fastest gains.";
    } else {
      insight = "Recovery-priority state detected. Your system needs targeted intervention — we\'ll build your protocol stack now.";
    }

    return {
      score: compositeScore,
      breakdown: {
        autonomic: hrvScore,
        recovery: recoveryScore,
        inflammation: inflammPenalty,
        adherence: adherenceScore,
        integrity: integrityScore,
      },
      insight,
      trend: compositeScore >= 65 ? "stable" as const : "needs_attention" as const,
    };
  },
});
