import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * getLast24hDashboardData — single query that returns all data
 * needed by the usePerformanceScore hook in one round-trip.
 */
export const getLast24hDashboardData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCutoff = startOfDay.getTime();

    // Food logs last 24h
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentFood = foodLogs.filter((l) => l.loggedAt >= cutoff24h);
    const todayFood = foodLogs.filter((l) => l.loggedAt >= todayCutoff);

    // Activity logs last 24h
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentActivity = activityLogs.filter((l) => l.loggedAt >= cutoff24h);
    const todayActivity = activityLogs.filter((l) => l.loggedAt >= todayCutoff);

    // Journal events today (for supplement/protocol tracking)
    const journalEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    // Protocol logs today
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    // Elite scores for 7-day HRV trend
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentScores = eliteScores
      .filter((s) => s.calculatedAt >= cutoff7d)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // Workout logs last 72h for recovery calculation
    const cutoff72h = now - 72 * 60 * 60 * 1000;
    const workoutLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff72h)
      )
      .collect();

    // Aggregate food macros
    const totalCaloriesIn = todayFood.reduce((s, l) => s + l.calories, 0);
    const totalProtein = todayFood.reduce((s, l) => s + l.protein, 0);
    const totalCarbs = todayFood.reduce((s, l) => s + l.carbs, 0);
    const totalFat = todayFood.reduce((s, l) => s + l.fat, 0);

    // Aggregate activity
    const totalCaloriesOut = todayActivity.reduce((s, l) => s + l.calories, 0);
    const totalDuration = todayActivity.reduce((s, l) => s + l.duration, 0);

    // Supplement count from journal events
    const supplementCount = journalEvents.filter(
      (e) =>
        e.eventType === "supplement_log" ||
        e.eventType === "meds" ||
        e.eventType === "supplements" ||
        e.eventKey?.includes("supplement") ||
        e.eventKey?.includes("protocol")
    ).length;

    // HRV history from elite scores
    const hrvHistory7d = recentScores.map((s) => s.currentHrv);
    const latestHrv = recentScores.length > 0
      ? recentScores[recentScores.length - 1].currentHrv
      : 0;

    // Recovery: based on time since last workout + sleep proxy
    const lastWorkoutTime = workoutLogs.length > 0
      ? Math.max(...workoutLogs.map((w) => w.loggedAt))
      : 0;
    const hoursSinceWorkout = lastWorkoutTime > 0
      ? (now - lastWorkoutTime) / (1000 * 60 * 60)
      : 48;

    return {
      // Counts
      foodLogCount: recentFood.length,
      todayFoodLogCount: todayFood.length,
      activityLogCount: recentActivity.length,
      todayActivityLogCount: todayActivity.length,
      supplementCount,
      protocolLogCount: protocolLogs.length,

      // Macros
      totalCaloriesIn,
      totalProtein,
      totalCarbs,
      totalFat,
      totalCaloriesOut,
      totalDuration,

      // HRV
      currentHrv: latestHrv,
      hrvHistory7d,

      // Recovery inputs
      hoursSinceWorkout,
      recentWorkoutCount: workoutLogs.length,

      // Journal events for goal tracking
      journalEventCount: journalEvents.length,

      // Timestamp for reactivity
      lastLogTimestamp: Math.max(
        ...([
          ...todayFood.map((l) => l.loggedAt),
          ...todayActivity.map((l) => l.loggedAt),
          ...journalEvents.map((e) => e.loggedAt),
        ].length > 0
          ? [
              ...todayFood.map((l) => l.loggedAt),
              ...todayActivity.map((l) => l.loggedAt),
              ...journalEvents.map((e) => e.loggedAt),
            ]
          : [0])
      ),
    };
  },
});
