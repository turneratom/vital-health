import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Log a food entry (macros required by schema; use 0 + analysisStatus "pending" when AI off)
export const logFood = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    fiber: v.optional(v.number()),
    source: v.string(),
    analysisStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
    photoStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("foodLogs", {
      sessionId: args.sessionId,
      name: args.name,
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat,
      fiber: args.fiber,
      source: args.source,
      analysisStatus: args.analysisStatus,
      notes: args.notes,
      photoStorageId: args.photoStorageId,
      loggedAt: Date.now(),
    });
  },
});

/** Store text (and optional photo) without inventing macros — honest pending analysis */
export const logFoodPending = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    photoStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("foodLogs", {
      sessionId: args.sessionId,
      name: args.name.trim().slice(0, 200) || "Food log",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      source: args.source ?? "text-pending",
      analysisStatus: "pending",
      notes: args.notes,
      photoStorageId: args.photoStorageId,
      loggedAt: now,
    });
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "nutrition",
      eventKey: "food_pending",
      value: args.name.trim().slice(0, 200),
      loggedAt: now,
    });
    return { id, loggedAt: now, analysisStatus: "pending" as const };
  },
});

// Update a food entry (manual correction)
export const updateFoodLog = mutation({
  args: {
    id: v.id("foodLogs"),
    name: v.optional(v.string()),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    analysisStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, clean);
    return id;
  },
});

// Delete a food entry
export const deleteFoodLog = mutation({
  args: { id: v.id("foodLogs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Log an activity entry
export const logActivity = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    duration: v.number(),
    calories: v.number(),
    distance: v.optional(v.number()),
    type: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLogs", {
      ...args,
      loggedAt: Date.now(),
    });
  },
});

// Update an activity entry (manual correction)
export const updateActivityLog = mutation({
  args: {
    id: v.id("activityLogs"),
    name: v.optional(v.string()),
    duration: v.optional(v.number()),
    calories: v.optional(v.number()),
    distance: v.optional(v.number()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([_, val]) => val !== undefined)
    );
    await ctx.db.patch(id, clean);
    return id;
  },
});

// Delete an activity entry
export const deleteActivityLog = mutation({
  args: { id: v.id("activityLogs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ── Commit Verified Lab Results to BioVault ──
// Called after user reviews extracted biomarkers in the verification table.
// Upserts the verified values into the bioVault table for the session.
export const commitLabResults = mutation({
  args: {
    sessionId: v.string(),
    vitaminD: v.optional(v.number()),
    ferritin: v.optional(v.number()),
    crp: v.optional(v.number()),
    hba1c: v.optional(v.number()),
    testosteroneTotal: v.optional(v.number()),
    testosteroneFree: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...markers } = args;
    const clean = Object.fromEntries(
      Object.entries(markers).filter(([_, val]) => val !== undefined)
    );
    // Find existing bioVault entry
    const existing = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...clean, updatedAt: Date.now() });
      return existing._id;
    } else {
      // Create a new bioVault entry with defaults for required fields
      return await ctx.db.insert("bioVault", {
        sessionId,
        ...clean,
        mthfrVariant: false,
        apoe4: false,
        caffeineSensitivity: false,
        preferredProteins: "mixed",
        dietaryRestrictions: "none",
        updatedAt: Date.now(),
      });
    }
  },
});

// Get 30-day biomarker velocity data (elite scores + adherence + food/activity trends)
export const getBiomarkerVelocity30d = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    // Get elite scores for 30 days
    const scores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const scores30d = scores
      .filter((s) => s.calculatedAt >= cutoff30d)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // Get adherence scores for 30 days
    const adherence = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const adherence30d = adherence
      .filter((a) => a.updatedAt >= cutoff30d)
      .sort((a, b) => a.updatedAt - b.updatedAt);

    // Get food logs for calorie/protein velocity
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const food30d = foodLogs.filter((f) => f.loggedAt >= cutoff30d);

    // Get activity logs for movement velocity
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activity30d = activityLogs.filter((a) => a.loggedAt >= cutoff30d);

    // Get bioVault for current lab markers
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Aggregate daily scores
    const dailyMap = new Map<string, { scores: number[]; adherence: number[]; calories: number[]; protein: number[]; activityMin: number[] }>();

    for (const s of scores30d) {
      const dk = new Date(s.calculatedAt).toISOString().slice(0, 10);
      if (!dailyMap.has(dk)) dailyMap.set(dk, { scores: [], adherence: [], calories: [], protein: [], activityMin: [] });
      dailyMap.get(dk)!.scores.push(s.score);
    }
    for (const a of adherence30d) {
      const dk = a.dateKey;
      if (!dailyMap.has(dk)) dailyMap.set(dk, { scores: [], adherence: [], calories: [], protein: [], activityMin: [] });
      dailyMap.get(dk)!.adherence.push(a.adherencePercent);
    }
    for (const f of food30d) {
      const dk = new Date(f.loggedAt).toISOString().slice(0, 10);
      if (!dailyMap.has(dk)) dailyMap.set(dk, { scores: [], adherence: [], calories: [], protein: [], activityMin: [] });
      dailyMap.get(dk)!.calories.push(f.calories);
      dailyMap.get(dk)!.protein.push(f.protein);
    }
    for (const a of activity30d) {
      const dk = new Date(a.loggedAt).toISOString().slice(0, 10);
      if (!dailyMap.has(dk)) dailyMap.set(dk, { scores: [], adherence: [], calories: [], protein: [], activityMin: [] });
      dailyMap.get(dk)!.activityMin.push(a.duration);
    }

    // Build daily aggregates
    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, d]) => ({
        dateKey,
        avgScore: d.scores.length > 0 ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length) : null,
        avgAdherence: d.adherence.length > 0 ? Math.round(d.adherence.reduce((s, v) => s + v, 0) / d.adherence.length) : null,
        totalCalories: d.calories.reduce((s, v) => s + v, 0) || null,
        totalProtein: d.protein.reduce((s, v) => s + v, 0) || null,
        totalActivityMin: d.activityMin.reduce((s, v) => s + v, 0) || null,
      }));

    return {
      dailyData,
      bioVault: bioVault ? {
        crp: bioVault.crp ?? null,
        hba1c: bioVault.hba1c ?? null,
        vitaminD: bioVault.vitaminD ?? null,
        ferritin: bioVault.ferritin ?? null,
      } : null,
      totalDays: dailyData.length,
      hasData: dailyData.length > 0,
    };
  },
});

// Get today's food logs for a session
export const getTodayFoodLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return logs.filter((l) => l.loggedAt >= startOfDay.getTime());
  },
});

// Get today's activity logs for a session
export const getTodayActivityLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return logs.filter((l) => l.loggedAt >= startOfDay.getTime());
  },
});
