import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   QUICK LOG ENGINE
   
   Fast-entry mutations for vitals, mood/energy, and protocol
   check-ins. Writes to journalEvents + protocolLogs tables
   so the Briefing Room AI summary updates reactively.
   ═══════════════════════════════════════════════════════════════ */

// ── Log a vital sign (HR, HRV, SpO2, Sleep Hours, Body Temp) ──
export const logVital = mutation({
  args: {
    sessionId: v.string(),
    vitalType: v.string(),
    value: v.number(),
    unit: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dateKey = new Date(now).toISOString().slice(0, 10);

    // Store as journal event for Briefing Room / HUD reactivity
    const eventId = await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "vital",
      eventKey: args.vitalType,
      value: `${args.value} ${args.unit}`,
      numericValue: args.value,
      loggedAt: now,
    });

    // Persist into canonical vitals tables so dashboard/brief/vitals charts read them
    if (args.vitalType === "hrv") {
      await ctx.db.insert("hrvReadings", {
        sessionId: args.sessionId,
        value: args.value,
        context: "manual",
        source: "manual",
        measuredAt: now,
        loggedAt: now,
      });
      const latestScore = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .first();
      if (latestScore) {
        await ctx.db.patch(latestScore._id, {
          currentHrv: args.value,
          calculatedAt: now,
        });
      }
      const vault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
      if (vault) {
        await ctx.db.patch(vault._id, { hrvCurrent: args.value, updatedAt: now });
      }
    }

    if (args.vitalType === "hr") {
      await ctx.db.insert("hrvReadings", {
        sessionId: args.sessionId,
        value: 0,
        context: "resting",
        heartRate: args.value,
        source: "manual",
        measuredAt: now,
        loggedAt: now,
      });
    }

    if (args.vitalType === "sleep_hours") {
      const totalHours = args.value;
      const deepHours = Math.round(totalHours * 0.18 * 10) / 10;
      const remHours = Math.round(totalHours * 0.22 * 10) / 10;
      const lightHours = Math.round(Math.max(0, totalHours - deepHours - remHours - 0.3) * 10) / 10;
      const awakeHours = Math.round(Math.max(0, totalHours - deepHours - remHours - lightHours) * 10) / 10;
      const sleepScore = Math.min(100, Math.round((totalHours / 8) * 70 + 20));
      const bedtimeAt = now - Math.round(totalHours * 3600 * 1000);
      const existingSleep = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId_and_date", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("date", dateKey)
        )
        .first();
      if (existingSleep && existingSleep.source === "manual") {
        await ctx.db.patch(existingSleep._id, {
          sleepScore,
          totalHours,
          deepHours,
          remHours,
          lightHours,
          awakeHours,
          efficiency: 90,
          latencyMin: 15,
          source: "manual",
          bedtimeAt,
          wakeAt: now,
          loggedAt: now,
        });
      } else if (!existingSleep) {
        await ctx.db.insert("sleepLogs", {
          sessionId: args.sessionId,
          date: dateKey,
          sleepScore,
          totalHours,
          deepHours,
          remHours,
          lightHours,
          awakeHours,
          efficiency: 90,
          latencyMin: 15,
          source: "manual",
          bedtimeAt,
          wakeAt: now,
          loggedAt: now,
        });
      }
      const vault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
      if (vault) {
        await ctx.db.patch(vault._id, {
          sleepHours: totalHours,
          sleepScore,
          updatedAt: now,
        });
      }
      const existing = await ctx.db
        .query("dailyDirectives")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          sleepHours: args.value,
          generatedAt: now,
        });
      } else {
        await ctx.db.insert("dailyDirectives", {
          sessionId: args.sessionId,
          dateKey,
          directives: "",
          sleepHours: args.value,
          generatedAt: now,
        });
      }
    }

    if (args.vitalType === "steps") {
      await ctx.db.insert("activityLogs", {
        sessionId: args.sessionId,
        name: `Manual steps (${Math.round(args.value)})`,
        duration: 0,
        calories: Math.round(args.value * 0.04),
        distance: Math.round((args.value / 1300) * 100) / 100,
        type: "steps",
        source: "manual",
        loggedAt: now,
      });
    }

    return { eventId, vitalType: args.vitalType, value: args.value };
  },
});

// ── Log mood and energy (1-5 scale) ──
export const logMoodEnergy = mutation({
  args: {
    sessionId: v.string(),
    mood: v.number(),
    energy: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const moodId = await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "mood",
      eventKey: "mood_score",
      value: `Mood: ${args.mood}/5`,
      numericValue: args.mood,
      loggedAt: now,
    });

    const energyId = await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "energy",
      eventKey: "energy_score",
      value: `Energy: ${args.energy}/5`,
      numericValue: args.energy,
      loggedAt: now,
    });

    return { moodId, energyId, mood: args.mood, energy: args.energy };
  },
});

// ── Get latest vitals logged today for header display ──
export const getLatestVitals = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCutoff = startOfDay.getTime();

    const events = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    const vitalEvents = events.filter((e) => e.eventType === "vital");
    const moodEvents = events.filter((e) => e.eventType === "mood");
    const energyEvents = events.filter((e) => e.eventType === "energy");

    // Get latest of each vital type
    const latestByType: Record<string, { value: number; loggedAt: number }> = {};
    for (const ev of vitalEvents) {
      const existing = latestByType[ev.eventKey];
      if (!existing || ev.loggedAt > existing.loggedAt) {
        latestByType[ev.eventKey] = {
          value: ev.numericValue ?? 0,
          loggedAt: ev.loggedAt,
        };
      }
    }

    const latestMood = moodEvents.length > 0
      ? moodEvents.sort((a, b) => b.loggedAt - a.loggedAt)[0]
      : null;
    const latestEnergy = energyEvents.length > 0
      ? energyEvents.sort((a, b) => b.loggedAt - a.loggedAt)[0]
      : null;

    // Get yesterday's HRV for comparison
    const yesterday = todayCutoff - 24 * 60 * 60 * 1000;
    const yesterdayEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", yesterday)
      )
      .collect();
    const yesterdayHrv = yesterdayEvents
      .filter((e) => e.eventType === "vital" && e.eventKey === "hrv" && e.loggedAt < todayCutoff)
      .sort((a, b) => b.loggedAt - a.loggedAt)[0];

    return {
      hr: latestByType["hr"] ?? null,
      hrv: latestByType["hrv"] ?? null,
      spo2: latestByType["spo2"] ?? null,
      sleepHours: latestByType["sleep_hours"] ?? null,
      bodyTemp: latestByType["body_temp"] ?? null,
      steps: latestByType["steps"] ?? null,
      mood: latestMood ? { value: latestMood.numericValue ?? 0, loggedAt: latestMood.loggedAt } : null,
      energy: latestEnergy ? { value: latestEnergy.numericValue ?? 0, loggedAt: latestEnergy.loggedAt } : null,
      yesterdayHrv: yesterdayHrv?.numericValue ?? null,
      totalVitalsLogged: vitalEvents.length,
      lastLoggedAt: vitalEvents.length > 0
        ? Math.max(...vitalEvents.map((e) => e.loggedAt))
        : null,
    };
  },
});

// ── Generate AI insight for a logged vital ──
export const generateVitalInsight = query({
  args: { sessionId: v.string(), vitalType: v.string(), value: v.number() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const yesterday = startOfDay.getTime() - 24 * 60 * 60 * 1000;

    // Get yesterday's same vital for comparison
    const recentEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", yesterday)
      )
      .collect();

    const sameTypeYesterday = recentEvents
      .filter(
        (e) =>
          e.eventType === "vital" &&
          e.eventKey === args.vitalType &&
          e.loggedAt < startOfDay.getTime()
      )
      .sort((a, b) => b.loggedAt - a.loggedAt)[0];

    const prevValue = sameTypeYesterday?.numericValue ?? null;
    let insight = "";

    switch (args.vitalType) {
      case "hr": {
        if (args.value < 60) insight = "Resting HR is excellent — strong parasympathetic tone.";
        else if (args.value < 72) insight = "Heart rate is in a healthy resting range.";
        else insight = "Elevated resting HR — consider stress management or extra recovery.";
        if (prevValue) {
          const delta = args.value - prevValue;
          if (Math.abs(delta) >= 3) {
            insight += ` ${delta > 0 ? "Up" : "Down"} ${Math.abs(Math.round(delta))} bpm from yesterday.`;
          }
        }
        break;
      }
      case "hrv": {
        if (prevValue && prevValue > 0) {
          const pctChange = Math.round(((args.value - prevValue) / prevValue) * 100);
          if (pctChange > 5) insight = `HRV is up ${pctChange}% from yesterday — recovery trending well.`;
          else if (pctChange < -5) insight = `HRV dropped ${Math.abs(pctChange)}% — consider lighter training today.`;
          else insight = "HRV is stable — consistent recovery pattern.";
        } else {
          if (args.value >= 65) insight = "Solid HRV reading — your autonomic nervous system is well-balanced.";
          else insight = "HRV is on the lower side — prioritize sleep and stress reduction.";
        }
        break;
      }
      case "spo2": {
        if (args.value >= 97) insight = "Excellent oxygen saturation — optimal for performance.";
        else if (args.value >= 95) insight = "SpO2 is within normal range.";
        else insight = "SpO2 is slightly low — consider deep breathing exercises or altitude adjustment.";
        break;
      }
      case "sleep_hours": {
        if (args.value >= 8) insight = "Great sleep duration — this supports optimal HRV and recovery.";
        else if (args.value >= 7) insight = "Decent sleep. Aim for 8+ hours to maximize recovery.";
        else if (args.value >= 6) insight = "Sleep is below target. Prioritize an earlier bedtime tonight.";
        else insight = "Significant sleep deficit detected — expect reduced recovery and elevated stress.";
        break;
      }
      case "body_temp": {
        if (args.value >= 97.5 && args.value <= 99.0) insight = "Body temperature is in the normal range.";
        else if (args.value < 97.5) insight = "Slightly low body temp — could indicate undereating or thyroid considerations.";
        else insight = "Elevated temperature — monitor for signs of illness or overtraining.";
        break;
      }
      default:
        insight = "Vital logged successfully.";
    }

    return { insight, previousValue: prevValue };
  },
});
