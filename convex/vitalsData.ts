import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * getVitalsTimeSeries — Returns 7-day time-series data for all biomarkers.
 * Aggregates from eliteScores, foodLogs, activityLogs, workoutLogs, journalEvents,
 * sleepLogs, hrvReadings, and caffeineLogs.
 * Used by the VitalsView for chart rendering.
 */
export const getVitalsTimeSeries = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const cutoff72h = now - 72 * 60 * 60 * 1000;

    // Elite scores for HRV + recovery trend
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentScores = eliteScores
      .filter((s) => s.calculatedAt >= cutoff7d)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // Food logs for calorie/macro trends
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentFood = foodLogs
      .filter((l) => l.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    // Activity logs for movement/calorie burn trends
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentActivity = activityLogs
      .filter((l) => l.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    // Workout logs for recovery map
    const workoutLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff72h)
      )
      .collect();

    // Journal events for sleep/mood proxy
    const journalEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff7d)
      )
      .collect();

    // Bio vault for personal baselines
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // User vitals for age/weight context
    const userVitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // ── NEW: Sleep logs (7 days) ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs
      .filter((s) => s.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    // ── NEW: HRV readings (7 days) ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    // ── NEW: Caffeine logs (today) ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const caffeineLogs = await ctx.db
      .query("caffeineLogs")
      .withIndex("by_sessionId_and_consumedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("consumedAt", todayStart.getTime())
      )
      .collect();

    // Build daily aggregates for 7 days
    const dailyData: Array<{
      date: string;
      caloriesIn: number;
      caloriesOut: number;
      protein: number;
      carbs: number;
      fat: number;
      steps: number;
      duration: number;
      activityCount: number;
      foodCount: number;
      journalCount: number;
      sleepScore: number | null;
      sleepHours: number | null;
      sleepDeepPct: number | null;
      sleepRemPct: number | null;
      hrvAvg: number | null;
      hrvReadingCount: number;
      caffeineMg: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const ds = dayStart.getTime();
      const de = dayEnd.getTime();
      const dateKey = dayStart.toISOString().slice(0, 10);

      const dayFood = recentFood.filter((l) => l.loggedAt >= ds && l.loggedAt <= de);
      const dayActivity = recentActivity.filter((l) => l.loggedAt >= ds && l.loggedAt <= de);
      const dayJournal = journalEvents.filter((e) => e.loggedAt >= ds && e.loggedAt <= de);

      // Sleep for this date
      const daySleep = recentSleep.find((s) => s.date === dateKey);

      // HRV readings for this day
      const dayHrv = hrvReadings.filter((r) => r.measuredAt >= ds && r.measuredAt <= de);
      const dayHrvAvg = dayHrv.length > 0
        ? Math.round(dayHrv.reduce((s, r) => s + r.value, 0) / dayHrv.length)
        : null;

      // Caffeine for this day (all logs, not just today)
      const allCaffeine = await ctx.db
        .query("caffeineLogs")
        .withIndex("by_sessionId_and_consumedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("consumedAt", ds)
        )
        .collect();
      const dayCaffeine = allCaffeine.filter((l) => l.consumedAt <= de);

      const daySteps = dayActivity
        .filter((l) => l.type === "steps" || /step/i.test(l.name))
        .reduce((s, l) => {
          const fromName = /Manual steps \((\d+)\)/i.exec(l.name);
          if (fromName) return s + Number(fromName[1]);
          if (typeof l.distance === "number" && l.distance > 0) {
            return s + Math.round(l.distance * 1300);
          }
          return s;
        }, 0);

      dailyData.push({
        date: dateKey,
        caloriesIn: dayFood.reduce((s, l) => s + l.calories, 0),
        caloriesOut: dayActivity.reduce((s, l) => s + l.calories, 0),
        protein: dayFood.reduce((s, l) => s + l.protein, 0),
        carbs: dayFood.reduce((s, l) => s + l.carbs, 0),
        fat: dayFood.reduce((s, l) => s + l.fat, 0),
        steps: daySteps,
        duration: dayActivity.reduce((s, l) => s + l.duration, 0),
        activityCount: dayActivity.length,
        foodCount: dayFood.length,
        journalCount: dayJournal.length,
        sleepScore: daySleep?.sleepScore ?? null,
        sleepHours: daySleep?.totalHours ?? null,
        sleepDeepPct: daySleep ? (daySleep.deepHours / Math.max(0.1, daySleep.totalHours)) * 100 : null,
        sleepRemPct: daySleep ? (daySleep.remHours / Math.max(0.1, daySleep.totalHours)) * 100 : null,
        hrvAvg: dayHrvAvg,
        hrvReadingCount: dayHrv.length,
        caffeineMg: dayCaffeine.reduce((s, l) => s + l.amountMg, 0),
      });
    }

    // HRV time series from elite scores (legacy) + new HRV readings
    const hrvSeriesFromScores = recentScores.map((s) => ({
      timestamp: s.calculatedAt,
      value: s.currentHrv,
      source: "elite_score" as const,
    }));

    const hrvSeriesFromReadings = hrvReadings
      .sort((a, b) => a.measuredAt - b.measuredAt)
      .map((r) => ({
        timestamp: r.measuredAt,
        value: r.value,
        source: r.context as string,
      }));

    // Merge and deduplicate HRV series (prefer readings over scores)
    const allHrv = [...hrvSeriesFromReadings, ...hrvSeriesFromScores]
      .sort((a, b) => a.timestamp - b.timestamp);

    // Recovery scores from elite scores
    const recoverySeries = recentScores.map((s) => ({
      timestamp: s.calculatedAt,
      value: Math.round(
        50 + s.fuelingPoints * 0.5 + s.movementPoints * 0.5 + s.hrvPoints * 0.3
      ),
    }));

    // Sleep score series
    const sleepSeries = recentSleep.map((s) => ({
      date: s.date,
      score: s.sleepScore,
      hours: s.totalHours,
      deepPct: (s.deepHours / Math.max(0.1, s.totalHours)) * 100,
      remPct: (s.remHours / Math.max(0.1, s.totalHours)) * 100,
      efficiency: s.efficiency,
      latency: s.latencyMin,
    }));

    return {
      dailyData,
      hrvSeries: allHrv,
      recoverySeries,
      sleepSeries,
      caffeine: {
        todayTotal: caffeineLogs.reduce((s, l) => s + l.amountMg, 0),
        logs: caffeineLogs.map((l) => ({
          source: l.source,
          amountMg: l.amountMg,
          name: l.name ?? l.source,
          consumedAt: l.consumedAt,
        })),
      },
      workoutLogs: workoutLogs.map((w) => ({
        name: w.workoutName,
        muscleGroups: w.muscleGroups,
        duration: w.duration,
        intensity: w.intensity,
        loggedAt: w.loggedAt,
      })),
      bioVault: bioVault
        ? {
            vitaminD: bioVault.vitaminD ?? null,
            ferritin: bioVault.ferritin ?? null,
            crp: bioVault.crp ?? null,
            hba1c: bioVault.hba1c ?? null,
            sleepScore: bioVault.sleepScore ?? null,
            hrvCurrent: bioVault.hrvCurrent ?? null,
            hrvAvg7d: bioVault.hrvAvg7d ?? null,
            hrvTrend: bioVault.hrvTrend ?? null,
            caffeineTodayMg: bioVault.caffeineTodayMg ?? 0,
            bioStatus: bioVault.bioStatus ?? null,
          }
        : null,
      userVitals: userVitals
        ? {
            age: userVitals.age,
            weight: userVitals.weight,
            gender: userVitals.gender,
          }
        : null,
      hasData:
        recentScores.length > 0 ||
        recentFood.length > 0 ||
        recentActivity.length > 0 ||
        recentSleep.length > 0 ||
        hrvReadings.length > 0,
    };
  },
});
