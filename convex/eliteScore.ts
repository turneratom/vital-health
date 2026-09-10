import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * calculateEliteScore Algorithm (v2 — with Protocol Adherence):
 * - Start at 40 points (base)
 * - +10 for every "Fueling" entry logged in the last 24h (Max 20)
 * - +15 for a "Movement" activity logged in the last 24h
 * - +/- 15 based on whether HRV is above or below the user's 7-day average
 * - +25 for protocol adherence (scaled: 0% = 0pts, 100% = 25pts)
 * - Clamped to 1-100
 */

// Calculate and store the Elite Score for a session
export const calculateAndStore = mutation({
  args: {
    sessionId: v.string(),
    currentHrv: v.number(),
    hrvHistory7d: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Count fueling entries in last 24h
    const allFoodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentFueling = allFoodLogs.filter((l) => l.loggedAt > twentyFourHoursAgo);
    const fuelingCount24h = recentFueling.length;

    // Check for movement activity in last 24h
    const allActivityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentMovement = allActivityLogs.filter((l) => l.loggedAt > twentyFourHoursAgo);
    const movementLogged = recentMovement.length > 0;

    // ── Protocol Adherence (NEW) ──
    const todayDate = new Date();
    const dateKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

    const activeProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeCount = activeProtocols.filter((p) => p.isActive).length;

    const todayCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedCount = todayCompletions.filter((c) => c.completed).length;

    const protocolAdherence = activeCount > 0 ? completedCount / activeCount : 0;

    // Calculate points
    const basePoints = 40;
    const fuelingPoints = Math.min(20, fuelingCount24h * 10);
    const movementPoints = movementLogged ? 15 : 0;

    // HRV delta: +/- 15 based on comparison to 7-day average
    const hrvAvg7d =
      args.hrvHistory7d.length > 0
        ? args.hrvHistory7d.reduce((s, v) => s + v, 0) / args.hrvHistory7d.length
        : args.currentHrv;
    let hrvPoints = 0;
    if (hrvAvg7d > 0) {
      const ratio = (args.currentHrv - hrvAvg7d) / hrvAvg7d;
      hrvPoints = Math.max(-15, Math.min(15, Math.round(ratio * 75)));
    }

    // Protocol adherence: up to 25 points
    const protocolPoints = Math.round(protocolAdherence * 25);

    const rawScore = basePoints + fuelingPoints + movementPoints + hrvPoints + protocolPoints;
    const score = Math.max(1, Math.min(100, rawScore));

    // Upsert: find existing score for this session, update or create
    const existing = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const data = {
      sessionId: args.sessionId,
      score,
      fuelingPoints,
      movementPoints,
      hrvPoints,
      basePoints,
      fuelingCount24h,
      movementLogged,
      currentHrv: args.currentHrv,
      hrvAvg7d: Math.round(hrvAvg7d),
      calculatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return { ...data, _id: existing._id, protocolPoints, protocolAdherence: Math.round(protocolAdherence * 100) };
    } else {
      const id = await ctx.db.insert("eliteScores", data);
      return { ...data, _id: id, protocolPoints, protocolAdherence: Math.round(protocolAdherence * 100) };
    }
  },
});

// Get the latest Elite Score for a session
export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Get all elite scores (for community/squad viewing)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("eliteScores")
      .order("desc")
      .collect();
  },
});

// Get today's adherence percentage for a session
export const getAdherenceToday = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeCount = protocols.filter((p) => p.isActive).length;
    if (activeCount === 0) return { percentage: 0, done: 0, total: 0, dateKey };

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const done = completions.filter((c) => c.completed).length;

    return {
      percentage: Math.round((done / activeCount) * 100),
      done,
      total: activeCount,
      dateKey,
    };
  },
});

// Get adherence streak — consecutive days with >= 80% protocol completion
export const getAdherenceStreak = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Get all protocols to know the active count
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeCount = protocols.filter((p) => p.isActive).length;
    if (activeCount === 0) return { streak: 0, bestStreak: 0 };

    // Get all completions, sorted by date
    const allCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Group completions by dateKey
    const byDate = new Map<string, number>();
    for (const c of allCompletions) {
      if (c.completed) {
        byDate.set(c.dateKey, (byDate.get(c.dateKey) || 0) + 1);
      }
    }

    // Walk backwards from today counting consecutive days with >= 80% adherence
    const today = new Date();
    let streak = 0;
    let bestStreak = 0;
    let currentStreak = 0;

    // Check up to 365 days back
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const done = byDate.get(dk) || 0;
      const pct = (done / activeCount) * 100;

      if (pct >= 80) {
        currentStreak++;
        if (i === streak) streak = currentStreak; // only count from today backwards
      } else {
        if (i === 0) streak = 0; // today not met yet
        bestStreak = Math.max(bestStreak, currentStreak);
        if (i <= streak) break; // streak broken
        currentStreak = 0;
      }
    }
    bestStreak = Math.max(bestStreak, currentStreak);

    return { streak, bestStreak };
  },
});
