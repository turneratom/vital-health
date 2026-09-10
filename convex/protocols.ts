import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   DAILY PROTOCOL ENGINE
   
   Manages personalized health tasks (supplements, habits, recovery)
   with real-time completion tracking that feeds into Elite Score.
   ═══════════════════════════════════════════════════════════════ */

// ── Get all active protocols for a session ──
export const getActiveProtocols = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return protocols
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// ── Get today's completion status for all protocols ──
export const getTodayProtocolStatus = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    const items = activeProtocols.map((p) => ({
      _id: p._id,
      name: p.name,
      category: p.category,
      icon: p.icon,
      description: p.description,
      timeOfDay: p.timeOfDay,
      sortOrder: p.sortOrder,
      source: p.source,
      completed: completedIds.has(p._id),
    }));

    const total = items.length;
    const done = items.filter((i) => i.completed).length;

    return {
      items,
      total,
      done,
      percentage: total > 0 ? Math.round((done / total) * 100) : 0,
      dateKey,
    };
  },
});

// ── Toggle a protocol completion for today ──
export const toggleCompletion = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Find existing completion for this protocol today
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    const existing = completions.find(
      (c) => c.protocolItemId === args.protocolId
    );

    if (existing) {
      if (existing.completed) {
        // Uncheck — delete the completion
        await ctx.db.delete(existing._id);
        return { completed: false };
      } else {
        // Re-check
        await ctx.db.patch(existing._id, {
          completed: true,
          completedAt: Date.now(),
        });
        return { completed: true };
      }
    } else {
      // Create new completion
      await ctx.db.insert("protocolCompletions", {
        sessionId: args.sessionId,
        dateKey,
        protocolItemId: args.protocolId,
        completed: true,
        completedAt: Date.now(),
      });
      return { completed: true };
    }
  },
});

// ── Create a new protocol ──
export const createProtocol = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    category: v.string(),
    icon: v.string(),
    description: v.string(),
    timeOfDay: v.string(),
    sortOrder: v.optional(v.number()),
    source: v.optional(v.string()),
    frictionLevel: v.optional(v.number()),
    frequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current count for sort order
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return await ctx.db.insert("protocols", {
      sessionId: args.sessionId,
      name: args.name,
      category: args.category,
      icon: args.icon,
      description: args.description,
      timeOfDay: args.timeOfDay,
      isActive: true,
      sortOrder: args.sortOrder ?? existing.length,
      source: args.source ?? "user",
      frictionLevel: args.frictionLevel,
      frequency: args.frequency,
      createdAt: Date.now(),
    });
  },
});

// ── Delete a protocol ──
export const deleteProtocol = mutation({
  args: { id: v.id("protocols") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ── Toggle protocol active/inactive ──
export const toggleActive = mutation({
  args: { id: v.id("protocols") },
  handler: async (ctx, args) => {
    const protocol = await ctx.db.get(args.id);
    if (!protocol) throw new Error("Protocol not found");
    await ctx.db.patch(args.id, { isActive: !protocol.isActive });
    return { isActive: !protocol.isActive };
  },
});

// ── Seed default protocols for a new user ──
export const seedDefaults = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Check if user already has protocols
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    if (existing.length > 0) return { seeded: false, count: existing.length };

    const defaults = [
      // ── SUPPLEMENTS ──
      {
        name: "Vitamin D3 + K2",
        category: "supplement",
        icon: "\u2600\uFE0F",
        description: "5000 IU D3 + 200mcg K2 with fatty meal",
        timeOfDay: "morning",
        sortOrder: 0,
      },
      {
        name: "Omega-3 Fish Oil",
        category: "supplement",
        icon: "\uD83D\uDC1F",
        description: "2g EPA/DHA with food",
        timeOfDay: "morning",
        sortOrder: 1,
      },
      {
        name: "Creatine Monohydrate",
        category: "supplement",
        icon: "\u26A1",
        description: "5g with water — cognitive + muscular",
        timeOfDay: "morning",
        sortOrder: 2,
      },
      {
        name: "Magnesium Glycinate",
        category: "supplement",
        icon: "\uD83C\uDF19",
        description: "400mg 30 min before bed",
        timeOfDay: "evening",
        sortOrder: 3,
      },
      // ── TRAINING ──
      {
        name: "Zone 2 Cardio",
        category: "training",
        icon: "\uD83C\uDFC3",
        description: "30 min at conversational pace (130-150 BPM)",
        timeOfDay: "afternoon",
        sortOrder: 4,
      },
      {
        name: "Resistance Training",
        category: "training",
        icon: "\uD83C\uDFCB\uFE0F",
        description: "45 min compound lifts — progressive overload",
        timeOfDay: "morning",
        sortOrder: 5,
      },
      // ── BIO-HACKING ──
      {
        name: "Cold Plunge",
        category: "biohacking",
        icon: "\u2744\uFE0F",
        description: "3-5 min cold immersion at 50-55\u00B0F",
        timeOfDay: "morning",
        sortOrder: 6,
      },
      {
        name: "Infrared Sauna",
        category: "biohacking",
        icon: "\uD83D\uDD25",
        description: "20 min at 150-170\u00B0F — heat shock proteins",
        timeOfDay: "evening",
        sortOrder: 7,
      },
      {
        name: "Morning Sunlight",
        category: "biohacking",
        icon: "\u2600\uFE0F",
        description: "10 min outdoor light within 30 min of waking",
        timeOfDay: "morning",
        sortOrder: 8,
      },
      // ── NUTRITION ──
      {
        name: "Protein Target",
        category: "nutrition",
        icon: "\uD83E\uDD69",
        description: "Hit 160g protein across all meals",
        timeOfDay: "all-day",
        sortOrder: 9,
      },
      {
        name: "Hydration 3L+",
        category: "nutrition",
        icon: "\uD83D\uDCA7",
        description: "3L water + electrolytes throughout the day",
        timeOfDay: "all-day",
        sortOrder: 10,
      },
      {
        name: "Sleep by 10:30 PM",
        category: "recovery",
        icon: "\uD83D\uDE34",
        description: "Lights out, phone away, room at 65-68\u00B0F",
        timeOfDay: "evening",
        sortOrder: 11,
      },
    ];

    for (const protocol of defaults) {
      await ctx.db.insert("protocols", {
        sessionId: args.sessionId,
        ...protocol,
        isActive: true,
        source: "system",
        createdAt: Date.now(),
      });
    }

    return { seeded: true, count: defaults.length };
  },
});

// ── One-Tap Verification — log completion with timestamp + protocol log ──
export const oneTapVerify = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = Date.now();

    // Get protocol details for the log
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    // Check existing completion
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    const existing = completions.find(
      (c) => c.protocolItemId === args.protocolId
    );

    let completed: boolean;

    if (existing) {
      if (existing.completed) {
        // Un-verify
        await ctx.db.delete(existing._id);
        completed = false;
      } else {
        await ctx.db.patch(existing._id, {
          completed: true,
          completedAt: timestamp,
        });
        completed = true;
      }
    } else {
      // Create new completion with precise timestamp
      await ctx.db.insert("protocolCompletions", {
        sessionId: args.sessionId,
        dateKey,
        protocolItemId: args.protocolId,
        completed: true,
        completedAt: timestamp,
      });
      completed = true;
    }

    // Log to protocolLogs for Progress correlation
    if (completed) {
      await ctx.db.insert("protocolLogs", {
        sessionId: args.sessionId,
        protocolId: args.protocolId as string,
        protocolName: protocol.name,
        category: protocol.category,
        loggedAt: timestamp,
        status: "verified",
      });

      // Also log as journal event for timeline
      await ctx.db.insert("journalEvents", {
        sessionId: args.sessionId,
        eventType: "protocol_verified",
        eventKey: protocol.name,
        value: `Completed ${protocol.name}`,
        numericValue: 1,
        loggedAt: timestamp,
      });
    }

    return {
      completed,
      timestamp,
      protocolName: protocol.name,
      category: protocol.category,
    };
  },
});

// ── Get completion timestamps for today (for Energy Pulse timing) ──
export const getTodayCompletionTimestamps = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    return completions
      .filter((c) => c.completed)
      .map((c) => ({
        protocolItemId: c.protocolItemId,
        completedAt: c.completedAt,
      }))
      .sort((a, b) => b.completedAt - a.completedAt);
  },
});

// ── Get daily completions for supplement streak tracking ──
export const getDailyCompletions = query({
  args: { sessionId: v.string(), dateKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("daily_completions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", args.dateKey)
      )
      .collect();
  },
});

// ── Toggle a daily completion (supplement check-off) ──
export const toggleDailyCompletion = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const existing = await ctx.db
      .query("daily_completions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    const match = existing.find((c) => c.protocolId === args.protocolId);

    if (match) {
      if (match.completed) {
        await ctx.db.delete(match._id);
        return { completed: false, dateKey };
      } else {
        await ctx.db.patch(match._id, { completed: true, completedAt: Date.now() });
        return { completed: true, dateKey };
      }
    } else {
      await ctx.db.insert("daily_completions", {
        sessionId: args.sessionId,
        dateKey,
        protocolId: args.protocolId,
        protocolName: args.protocolName,
        category: args.category,
        completed: true,
        completedAt: Date.now(),
      });
      return { completed: true, dateKey };
    }
  },
});

// ── Get supplement adherence streak (consecutive days with all supplements done) ──
export const getSupplementStreak = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const allCompletions = await ctx.db
      .query("daily_completions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const supplementCount = protocols.filter((p) => p.isActive && p.category === "supplement").length;
    if (supplementCount === 0) return { streak: 0, longestStreak: 0, totalDaysLogged: 0 };

    const completedByDate = new Map<string, number>();
    for (const c of allCompletions) {
      if (c.completed && c.category === "supplement") {
        completedByDate.set(c.dateKey, (completedByDate.get(c.dateKey) || 0) + 1);
      }
    }

    const today = new Date();
    let streak = 0;
    let longestStreak = 0;
    let currentStreak = 0;

    const sortedDates = Array.from(completedByDate.keys()).sort().reverse();
    
    // Calculate current streak from today backwards
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const count = completedByDate.get(dk) || 0;
      if (count >= supplementCount) {
        currentStreak++;
      } else if (i === 0) {
        continue; // today might not be done yet
      } else {
        break;
      }
    }
    streak = currentStreak;

    // Calculate longest streak
    currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const count = completedByDate.get(dk) || 0;
      if (count >= supplementCount) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return { streak, longestStreak, totalDaysLogged: completedByDate.size };
  },
});

// ── Update adherence score — called after each DailyStack toggle ──
export const updateAdherenceScore = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Get all active protocols
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);
    const totalProtocols = activeProtocols.length;
    if (totalProtocols === 0) return { adherencePercent: 0, totalProtocols: 0, completedProtocols: 0 };

    // Count completions from both tables
    const protocolCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedProtocolIds = new Set(
      protocolCompletions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    const dailyCompletions = await ctx.db
      .query("daily_completions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    for (const dc of dailyCompletions) {
      if (dc.completed) completedProtocolIds.add(dc.protocolId);
    }

    // Only count completions for active protocols
    const activeIds = new Set(activeProtocols.map((p) => p._id as string));
    let completedProtocols = 0;
    for (const id of completedProtocolIds) {
      if (activeIds.has(id)) completedProtocols++;
    }

    const adherencePercent = Math.round((completedProtocols / totalProtocols) * 100);

    // Upsert adherence score
    const existing = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalProtocols,
        completedProtocols,
        adherencePercent,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("adherenceScores", {
        sessionId: args.sessionId,
        dateKey,
        totalProtocols,
        completedProtocols,
        adherencePercent,
        updatedAt: Date.now(),
      });
    }

    return { adherencePercent, totalProtocols, completedProtocols };
  },
});

// ── Reschedule a protocol's timeOfDay (Intelligence Overlay) ──
export const rescheduleProtocolTime = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
    newTimeOfDay: v.string(),
  },
  handler: async (ctx, args) => {
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) throw new Error("Protocol not found");
    if (protocol.sessionId !== args.sessionId) throw new Error("Unauthorized");
    const oldTimeOfDay = protocol.timeOfDay;
    await ctx.db.patch(args.protocolId, { timeOfDay: args.newTimeOfDay });
    // Log the reschedule as a journal event for audit trail
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "protocol_rescheduled",
      eventKey: protocol.name,
      value: `Rescheduled ${protocol.name} from ${oldTimeOfDay} to ${args.newTimeOfDay}`,
      numericValue: undefined,
      loggedAt: Date.now(),
    });
    return {
      protocolName: protocol.name,
      oldTimeOfDay,
      newTimeOfDay: args.newTimeOfDay,
    };
  },
});

// ── Get protocols grouped by Biological Windows (Morning / Performance / Recovery) ──
export const getProtocolsByBiologicalWindow = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHour = now.getHours();

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedMap = new Map(
      completions.filter((c) => c.completed).map((c) => [c.protocolItemId, c.completedAt])
    );

    // Map timeOfDay to biological windows
    const windowMap: Record<string, string> = {
      morning: "morning",
      afternoon: "performance",
      evening: "recovery",
      "all-day": currentHour < 12 ? "morning" : currentHour < 18 ? "performance" : "recovery",
    };

    const windows: Record<string, {
      label: string;
      icon: string;
      timeRange: string;
      accentColor: string;
      items: Array<{
        _id: string;
        name: string;
        category: string;
        icon: string;
        description: string;
        timeOfDay: string;
        sortOrder: number;
        source: string;
        completed: boolean;
        completedAt: number | null;
      }>;
    }> = {
      morning: {
        label: "Morning Activation",
        icon: "\u2600\uFE0F",
        timeRange: "5:00 — 11:59",
        accentColor: "#E8976C",
        items: [],
      },
      performance: {
        label: "Performance Window",
        icon: "\u26A1",
        timeRange: "12:00 — 17:59",
        accentColor: "#3B82F6",
        items: [],
      },
      recovery: {
        label: "Recovery Protocol",
        icon: "\uD83C\uDF19",
        timeRange: "18:00 — 22:00",
        accentColor: "#7CB68E",
        items: [],
      },
    };

    for (const p of activeProtocols) {
      const windowKey = windowMap[p.timeOfDay] || "performance";
      const completedAt = completedMap.get(p._id) ?? null;
      windows[windowKey].items.push({
        _id: p._id as string,
        name: p.name,
        category: p.category,
        icon: p.icon,
        description: p.description,
        timeOfDay: p.timeOfDay,
        sortOrder: p.sortOrder,
        source: p.source,
        completed: completedMap.has(p._id),
        completedAt,
      });
    }

    // Determine active window based on current hour
    let activeWindow = "morning";
    if (currentHour >= 18) activeWindow = "recovery";
    else if (currentHour >= 12) activeWindow = "performance";

    const totalItems = activeProtocols.length;
    const totalDone = completedMap.size;

    return {
      windows,
      activeWindow,
      totalItems,
      totalDone,
      percentage: totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0,
      dateKey,
      currentHour,
    };
  },
});

// ── Batch sign all incomplete items in a biological window ──
export const batchSignWindow = mutation({
  args: {
    sessionId: v.string(),
    protocolIds: v.array(v.id("protocols")),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = Date.now();

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    let signed = 0;
    for (const protocolId of args.protocolIds) {
      if (completedIds.has(protocolId)) continue;

      const protocol = await ctx.db.get(protocolId);
      if (!protocol || protocol.sessionId !== args.sessionId) continue;

      await ctx.db.insert("protocolCompletions", {
        sessionId: args.sessionId,
        dateKey,
        protocolItemId: protocolId,
        completed: true,
        completedAt: timestamp + signed, // slight offset for ordering
      });

      await ctx.db.insert("protocolLogs", {
        sessionId: args.sessionId,
        protocolId: protocolId as string,
        protocolName: protocol.name,
        category: protocol.category,
        loggedAt: timestamp + signed,
        status: "batch_signed",
      });

      await ctx.db.insert("journalEvents", {
        sessionId: args.sessionId,
        eventType: "protocol_batch_signed",
        eventKey: protocol.name,
        value: `Batch signed: ${protocol.name}`,
        numericValue: 1,
        loggedAt: timestamp + signed,
      });

      signed++;
    }

    return { signed, dateKey, timestamp };
  },
});

// ── Get current adherence score for today ──
export const getAdherenceScore = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const score = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .first();

    if (!score) return { adherencePercent: 0, totalProtocols: 0, completedProtocols: 0, dateKey };

    return {
      adherencePercent: score.adherencePercent,
      totalProtocols: score.totalProtocols,
      completedProtocols: score.completedProtocols,
      dateKey,
    };
  },
});

// ── Get 7-day adherence history for trend calculation ──
export const getAdherenceHistory7d = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const allScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Get last 7 days
    const today = new Date();
    const days: { dateKey: string; adherencePercent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const match = allScores.find((s) => s.dateKey === dk);
      days.push({ dateKey: dk, adherencePercent: match?.adherencePercent ?? 0 });
    }

    const avg = days.length > 0
      ? Math.round(days.reduce((s, d) => s + d.adherencePercent, 0) / days.length)
      : 0;

    return { days, average: avg };
  },
});

// ── Get 30-day adherence history for Protocol OS trend visualization ──
export const getAdherenceHistory30d = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    try {
    const allScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const today = new Date();
    const days: { dateKey: string; adherencePercent: number; total: number; completed: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const match = allScores.find((s) => s.dateKey === dk);
      days.push({
        dateKey: dk,
        adherencePercent: match?.adherencePercent ?? 0,
        total: match?.totalProtocols ?? 0,
        completed: match?.completedProtocols ?? 0,
      });
    }

    const activeDays = days.filter((d) => d.total > 0);
    const avg = activeDays.length > 0
      ? Math.round(activeDays.reduce((s, d) => s + d.adherencePercent, 0) / activeDays.length)
      : 0;
    const best = activeDays.length > 0
      ? Math.max(...activeDays.map((d) => d.adherencePercent))
      : 0;
    const worst = activeDays.length > 0
      ? Math.min(...activeDays.map((d) => d.adherencePercent))
      : 0;

    // Calculate streak (consecutive days ≥80%)
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].total > 0 && days[i].adherencePercent >= 80) streak++;
      else if (i === days.length - 1 && days[i].total === 0) continue; // today might not have data yet
      else break;
    }

    return { days, average: avg, best, worst, streak, activeDays: activeDays.length };
    } catch (e) {
      console.error("[getAdherenceHistory30d] Error:", e);
      return { days: [], average: 0, best: 0, worst: 0, streak: 0, activeDays: 0 };
    }
  },
});

// ── Get biomarker-to-protocol mapping for Protocol OS ──
export const getBiomarkerProtocolMap = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Get active protocols
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const active = protocols.filter((p) => p.isActive);

    // Get bioVault for current biomarker values
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Get today's completions
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    // Build biomarker → protocol mapping
    const BIOMARKER_MAP: Record<string, { marker: string; unit: string; optimal: string; field: string }> = {
      supplement: { marker: "Vitamin D", unit: "ng/mL", optimal: "60-80", field: "vitaminD" },
      training: { marker: "Testosterone", unit: "ng/dL", optimal: "500-900", field: "testosteroneTotal" },
      biohacking: { marker: "HRV", unit: "ms", optimal: ">55", field: "hrvCurrent" },
      nutrition: { marker: "HbA1c", unit: "%", optimal: "<5.4", field: "hba1c" },
      recovery: { marker: "CRP", unit: "mg/L", optimal: "<1.0", field: "crp" },
      movement: { marker: "Ferritin", unit: "ng/mL", optimal: "80-150", field: "ferritin" },
    };

    const mappings = active.map((p) => {
      const bio = BIOMARKER_MAP[p.category] ?? { marker: "General", unit: "", optimal: "—", field: "" };
      const currentValue = vault && bio.field ? (vault as any)[bio.field] ?? null : null;

      // Determine biomarker status
      let bioStatus: "optimal" | "suboptimal" | "critical" | "unknown" = "unknown";
      if (currentValue !== null) {
        if (bio.field === "vitaminD") bioStatus = currentValue >= 60 ? "optimal" : currentValue >= 30 ? "suboptimal" : "critical";
        else if (bio.field === "testosteroneTotal") bioStatus = currentValue >= 500 ? "optimal" : currentValue >= 300 ? "suboptimal" : "critical";
        else if (bio.field === "hrvCurrent") bioStatus = currentValue >= 55 ? "optimal" : currentValue >= 35 ? "suboptimal" : "critical";
        else if (bio.field === "hba1c") bioStatus = currentValue <= 5.4 ? "optimal" : currentValue <= 5.7 ? "suboptimal" : "critical";
        else if (bio.field === "crp") bioStatus = currentValue <= 1.0 ? "optimal" : currentValue <= 3.0 ? "suboptimal" : "critical";
        else if (bio.field === "ferritin") bioStatus = currentValue >= 80 ? "optimal" : currentValue >= 30 ? "suboptimal" : "critical";
      }

      return {
        protocolId: p._id,
        protocolName: p.name,
        protocolIcon: p.icon,
        category: p.category,
        completed: completedIds.has(p._id),
        biomarker: bio.marker,
        bioUnit: bio.unit,
        bioOptimal: bio.optimal,
        bioCurrentValue: currentValue,
        bioStatus,
      };
    });

    // Category-level summary
    const categories = Object.entries(
      mappings.reduce((acc, m) => {
        if (!acc[m.category]) acc[m.category] = { total: 0, completed: 0, bioStatus: m.bioStatus, biomarker: m.biomarker, bioValue: m.bioCurrentValue, bioUnit: m.bioUnit, bioOptimal: m.bioOptimal };
        acc[m.category].total++;
        if (m.completed) acc[m.category].completed++;
        // Keep worst bioStatus
        if (m.bioStatus === "critical") acc[m.category].bioStatus = "critical";
        else if (m.bioStatus === "suboptimal" && acc[m.category].bioStatus !== "critical") acc[m.category].bioStatus = "suboptimal";
        return acc;
      }, {} as Record<string, any>)
    ).map(([cat, data]) => ({ category: cat, ...data, adherence: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0 }));

    return { mappings, categories, dateKey };
  },
});

// ── Complete a protocol via timer (auto-mark when countdown hits zero) ──
export const completeProtocolByTimer = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = Date.now();

    // Get protocol details
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    // Check if already completed today
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    const existing = completions.find(
      (c) => c.protocolItemId === args.protocolId
    );

    if (existing && existing.completed) {
      return {
        alreadyCompleted: true,
        protocolName: protocol.name,
        category: protocol.category,
      };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        completed: true,
        completedAt: timestamp,
      });
    } else {
      await ctx.db.insert("protocolCompletions", {
        sessionId: args.sessionId,
        dateKey,
        protocolItemId: args.protocolId,
        completed: true,
        completedAt: timestamp,
      });
    }

    // Log to protocolLogs
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.protocolId as string,
      protocolName: protocol.name,
      category: protocol.category,
      loggedAt: timestamp,
      status: "timer_completed",
    });

    // Log journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "protocol_timer_completed",
      eventKey: protocol.name,
      value: `Timer completed: ${protocol.name}`,
      numericValue: 1,
      loggedAt: timestamp,
    });

    return {
      alreadyCompleted: false,
      protocolName: protocol.name,
      category: protocol.category,
      completedAt: timestamp,
    };
  },
});

// ── AI-suggested protocols based on vitals context ──
export const getAISuggestions = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Get latest elite score for vitals context
    const latestScore = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Get bio vault for biomarker context
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Get existing protocols to avoid duplicates
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

    const suggestions: Array<{
      name: string;
      category: string;
      icon: string;
      description: string;
      timeOfDay: string;
      reason: string;
      priority: "high" | "medium" | "low";
    }> = [];

    // Recovery-based suggestions
    if (latestScore) {
      const recovery = Math.round(
        50 + latestScore.fuelingPoints * 0.5 + latestScore.movementPoints * 0.5 + latestScore.hrvPoints * 0.3
      );

      if (recovery < 60) {
        if (!existingNames.has("cold plunge")) {
          suggestions.push({
            name: "Cold Plunge",
            category: "recovery",
            icon: "\u2744\uFE0F",
            description: "3-5 min cold immersion at 50-55\u00B0F",
            timeOfDay: "morning",
            reason: `Recovery is at ${recovery}%. Cold exposure activates norepinephrine and accelerates parasympathetic recovery.`,
            priority: "high",
          });
        }
        if (!existingNames.has("early bedtime")) {
          suggestions.push({
            name: "Early Bedtime",
            category: "recovery",
            icon: "\uD83D\uDE34",
            description: "Lights out 1 hour earlier than usual",
            timeOfDay: "evening",
            reason: `Low recovery (${recovery}%) signals sleep debt. An extra hour of sleep can boost HRV by 8-12%.`,
            priority: "high",
          });
        }
      }

      if (latestScore.hrvPoints < 0) {
        if (!existingNames.has("breathwork")) {
          suggestions.push({
            name: "Breathwork",
            category: "recovery",
            icon: "\uD83C\uDF2C\uFE0F",
            description: "5 min box breathing (4-4-4-4 pattern)",
            timeOfDay: "morning",
            reason: `HRV is below your 7-day average. Box breathing upregulates vagal tone and can improve HRV within 24 hours.`,
            priority: "high",
          });
        }
      }

      if (!latestScore.movementLogged) {
        if (!existingNames.has("walking")) {
          suggestions.push({
            name: "Walking",
            category: "movement",
            icon: "\uD83D\uDEB6",
            description: "20 min brisk walk outdoors",
            timeOfDay: "afternoon",
            reason: "No movement logged in 24h. Even a brisk walk improves insulin sensitivity and mood.",
            priority: "medium",
          });
        }
      }
    }

    // Biomarker-based suggestions
    if (vault) {
      if (vault.vitaminD != null && vault.vitaminD < 40) {
        if (!existingNames.has("vitamin d3 + k2")) {
          suggestions.push({
            name: "Vitamin D3 + K2",
            category: "supplement",
            icon: "\u2600\uFE0F",
            description: "5000 IU D3 + 200mcg K2 with fatty meal",
            timeOfDay: "morning",
            reason: `Vitamin D at ${vault.vitaminD} ng/mL (target: 60-80). K2 ensures calcium goes to bones, not arteries.`,
            priority: "high",
          });
        }
      }

      if (vault.crp != null && vault.crp > 1.0) {
        if (!existingNames.has("curcumin")) {
          suggestions.push({
            name: "Curcumin",
            category: "supplement",
            icon: "\uD83C\uDF1F",
            description: "1000mg with piperine for absorption",
            timeOfDay: "morning",
            reason: `CRP at ${vault.crp} mg/L indicates elevated inflammation. Curcumin is a potent NF-\u03BAB inhibitor.`,
            priority: "high",
          });
        }
      }

      if (vault.ferritin != null && vault.ferritin < 50) {
        if (!existingNames.has("iron bisglycinate")) {
          suggestions.push({
            name: "Iron Bisglycinate",
            category: "supplement",
            icon: "\uD83E\uDDE2",
            description: "25mg with vitamin C on empty stomach",
            timeOfDay: "morning",
            reason: `Ferritin at ${vault.ferritin} ng/mL (optimal: 80-150). Low iron impairs oxygen transport and energy.`,
            priority: "medium",
          });
        }
      }
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 4);
  },
});

/* ═══════════════════════════════════════════════════════════════
   TACTICAL PIVOT — Intelligent Alternative Generator
   
   When a critical protocol is missed (overdue), the system doesn't
   just mark it "Incomplete". Instead, it generates a context-aware
   alternative that fits the remaining day. A missed 7 AM workout
   becomes a 5 PM active recovery session. The user feels the system
   is helping them optimize, not grading them.
   ═══════════════════════════════════════════════════════════════ */

// ── Tactical Pivot alternatives map ──
const PIVOT_ALTERNATIVES: Record<string, Array<{
  name: string; icon: string; description: string; category: string; timeOfDay: string;
  rationale: string;
}>> = {
  training: [
    { name: "Active Recovery Walk", icon: "\uD83D\uDEB6", description: "30 min brisk walk — low-impact movement", category: "movement", timeOfDay: "afternoon", rationale: "Missed high-intensity window. Active recovery preserves movement streak without CNS fatigue." },
    { name: "Mobility Flow", icon: "\uD83E\uDDD8", description: "20 min dynamic stretching + foam rolling", category: "recovery", timeOfDay: "evening", rationale: "Swapping intensity for mobility. Joint health and flexibility still count toward your movement goals." },
    { name: "Evening Bodyweight Circuit", icon: "\uD83D\uDCAA", description: "15 min AMRAP — push-ups, squats, planks", category: "training", timeOfDay: "evening", rationale: "Condensed training stimulus. Short bodyweight circuits maintain muscle protein synthesis signaling." },
  ],
  supplement: [
    { name: "Catch-Up Dose (with lunch)", icon: "\uD83D\uDC8A", description: "Take missed supplement with your next meal", category: "supplement", timeOfDay: "afternoon", rationale: "Most supplements absorb well with food regardless of timing. Better late than skipped entirely." },
    { name: "Evening Supplement Window", icon: "\uD83C\uDF19", description: "Take with dinner — absorption still effective", category: "supplement", timeOfDay: "evening", rationale: "Fat-soluble vitamins absorb with any fatty meal. Evening dosing is a valid alternative." },
  ],
  biohacking: [
    { name: "Cold Shower Finish", icon: "\uD83D\uDEB0", description: "2 min cold at end of regular shower", category: "biohacking", timeOfDay: "afternoon", rationale: "Lower friction alternative. Cold shower endings still trigger norepinephrine and brown fat activation." },
    { name: "Breathwork Session", icon: "\uD83C\uDF2C\uFE0F", description: "5 min box breathing (4-4-4-4)", category: "biohacking", timeOfDay: "afternoon", rationale: "Parasympathetic activation via breathwork. Upregulates vagal tone similar to cold exposure." },
  ],
  nutrition: [
    { name: "Protein-Forward Next Meal", icon: "\uD83E\uDD69", description: "40g+ protein at your next meal to catch up", category: "nutrition", timeOfDay: "afternoon", rationale: "Front-loading protein in remaining meals compensates for earlier deficit. Aim for 40g+ per sitting." },
    { name: "Hydration Sprint", icon: "\uD83D\uDCA7", description: "1L water + electrolytes in next 2 hours", category: "nutrition", timeOfDay: "afternoon", rationale: "Concentrated hydration window. Adding electrolytes improves absorption rate by 2-3x." },
  ],
  recovery: [
    { name: "10-Min Meditation", icon: "\uD83E\uDDD8", description: "Guided or silent — parasympathetic reset", category: "recovery", timeOfDay: "afternoon", rationale: "Brief meditation activates the relaxation response. Even 10 minutes measurably lowers cortisol." },
    { name: "Gentle Evening Yoga", icon: "\uD83E\uDDD8\u200D\u2640\uFE0F", description: "15 min restorative poses before bed", category: "recovery", timeOfDay: "evening", rationale: "Restorative yoga before sleep improves sleep onset latency and deep sleep percentage." },
  ],
  movement: [
    { name: "Desk Mobility Break", icon: "\uD83E\uDDD1\u200D\uD83D\uDCBB", description: "5 min standing stretches + hip openers", category: "movement", timeOfDay: "afternoon", rationale: "Micro-movement breaks counteract prolonged sitting. Hip flexor and thoracic mobility are key." },
    { name: "Evening Stroll", icon: "\uD83C\uDF05", description: "20 min post-dinner walk — digestion + movement", category: "movement", timeOfDay: "evening", rationale: "Post-meal walking improves glucose disposal by 30-50%. Gentle movement that aids digestion." },
  ],
};

/** Get tactical pivot alternatives for a missed protocol */
export const getTacticalPivotOptions = query({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
  },
  handler: async (ctx, args) => {
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) return null;

    const now = new Date();
    const hour = now.getHours();

    // Get alternatives for this category
    const alternatives = PIVOT_ALTERNATIVES[protocol.category] ?? PIVOT_ALTERNATIVES.recovery;

    // Filter by what's still feasible given current time
    const feasible = alternatives.filter((alt) => {
      if (hour >= 20) return alt.timeOfDay === "evening";
      if (hour >= 17) return alt.timeOfDay === "evening" || alt.timeOfDay === "afternoon";
      return true;
    });

    // Return top 2 alternatives
    return {
      originalProtocol: {
        name: protocol.name,
        icon: protocol.icon,
        category: protocol.category,
        timeOfDay: protocol.timeOfDay,
      },
      alternatives: feasible.slice(0, 2),
    };
  },
});

/** Execute a tactical pivot — reschedule the original + create the alternative */
export const executeTacticalPivot = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
    pivotName: v.string(),
    pivotIcon: v.string(),
    pivotDescription: v.string(),
    pivotCategory: v.string(),
    pivotTimeOfDay: v.string(),
    pivotRationale: v.string(),
  },
  handler: async (ctx, args) => {
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) throw new Error("Protocol not found");
    if (protocol.sessionId !== args.sessionId) throw new Error("Unauthorized");

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = Date.now();

    // Mark the original protocol as completed via pivot (not failed!)
    // Insert a special completion that records the pivot
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    const existing = completions.find(
      (c) => c.protocolItemId === args.protocolId
    );

    if (!existing) {
      await ctx.db.insert("protocolCompletions", {
        sessionId: args.sessionId,
        dateKey,
        protocolItemId: args.protocolId,
        completed: true,
        completedAt: timestamp,
      });
    } else if (!existing.completed) {
      await ctx.db.patch(existing._id, {
        completed: true,
        completedAt: timestamp,
      });
    }

    // Log the tactical pivot as a protocol log
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.protocolId as string,
      protocolName: protocol.name,
      category: protocol.category,
      loggedAt: timestamp,
      status: "pivoted",
    });

    // Log journal event for the pivot narrative
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "tactical_pivot",
      eventKey: protocol.name,
      value: `Tactical Pivot: ${protocol.name} \u2192 ${args.pivotName}. ${args.pivotRationale}`,
      numericValue: undefined,
      loggedAt: timestamp,
    });

    return {
      originalName: protocol.name,
      pivotName: args.pivotName,
      pivotIcon: args.pivotIcon,
      pivotDescription: args.pivotDescription,
      pivotCategory: args.pivotCategory,
      pivotTimeOfDay: args.pivotTimeOfDay,
      pivotRationale: args.pivotRationale,
      dateKey,
    };
  },
});
