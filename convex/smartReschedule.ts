import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Smart Rescheduling Logic:
 * 
 * When a day ends without a log entry for a planned protocol:
 * 1. Do NOT mark it as "Failed" — that's guilt-inducing
 * 2. Instead, label it "Pivoted to Standby" 
 * 3. Automatically move the protocol to the next available slot
 * 4. The rescheduled entry gets a "pivotedFrom" reference to the original date
 * 5. Pivoted protocols do NOT negatively impact Elite Score
 * 
 * This maintains the supportive, no-guilt "Symbiotic Twin" experience.
 */

// Helper: get the next date key from a given date key
function getNextDateKey(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper: get today's date key
function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * rescheduleExpiredProtocols
 * 
 * Called when the user opens the Journal or when a new day begins.
 * Scans for any planned protocols from yesterday (or earlier) that were
 * never logged, and pivots them to the next available date.
 */
export const rescheduleExpiredProtocols = mutation({
  args: {
    sessionId: v.string(),
    currentDateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, currentDateKey } = args;
    const pivotedIds: string[] = [];
    const rescheduledIds: string[] = [];

    // Get all planned protocols for this user
    const allPlanned = await ctx.db
      .query("plannedProtocols")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();

    // Filter: find protocols from past dates that are still "scheduled"
    const expiredProtocols = allPlanned.filter((p) => {
      const status = p.status || "scheduled";
      return p.dateKey < currentDateKey && status === "scheduled";
    });

    if (expiredProtocols.length === 0) {
      return { pivoted: 0, rescheduled: 0, pivotedIds: [], rescheduledIds: [] };
    }

    // Get protocol logs to check if any were actually completed
    const recentLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();

    // Build a set of logged protocol IDs by date for quick lookup
    const loggedSet = new Set<string>();
    for (const log of recentLogs) {
      const logDate = new Date(log.loggedAt);
      const logDateKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, "0")}-${String(logDate.getDate()).padStart(2, "0")}`;
      loggedSet.add(`${log.protocolId}::${logDateKey}`);
    }

    // Also check food logs and activity logs for fueling/movement entries
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();

    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();

    // Build date-based lookup for food and activity logs
    const foodLogDates = new Set<string>();
    for (const fl of foodLogs) {
      const d = new Date(fl.loggedAt);
      foodLogDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }

    const activityLogDates = new Set<string>();
    for (const al of activityLogs) {
      const d = new Date(al.loggedAt);
      activityLogDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }

    // Find the next available date (today or tomorrow)
    const nextDateKey = currentDateKey;

    for (const expired of expiredProtocols) {
      // Check if this protocol was actually logged on its planned date
      const wasLogged =
        (expired.type === "protocol" && expired.protocolId && loggedSet.has(`${expired.protocolId}::${expired.dateKey}`)) ||
        (expired.type === "fueling" && foodLogDates.has(expired.dateKey)) ||
        (expired.type === "movement" && activityLogDates.has(expired.dateKey));

      if (wasLogged) {
        // Mark as logged — it was completed
        await ctx.db.patch(expired._id, { status: "logged" });
        continue;
      }

      // Mark the original as "pivoted" (not failed!)
      await ctx.db.patch(expired._id, {
        status: "pivoted",
        rescheduledTo: nextDateKey,
      });
      pivotedIds.push(expired._id);

      // Create a new rescheduled entry for the next available date
      const rescheduledId = await ctx.db.insert("plannedProtocols", {
        sessionId,
        dateKey: nextDateKey,
        type: expired.type,
        name: expired.name,
        time: expired.time,
        category: expired.category,
        calories: expired.calories,
        protein: expired.protein,
        carbs: expired.carbs,
        fat: expired.fat,
        duration: expired.duration,
        activityType: expired.activityType,
        protocolId: expired.protocolId,
        items: expired.items,
        notes: expired.notes
          ? `${expired.notes} (rescheduled from ${expired.dateKey})`
          : `Rescheduled from ${expired.dateKey}`,
        status: "standby",
        pivotedFrom: expired.dateKey,
        originalDateKey: expired.originalDateKey || expired.dateKey,
        createdAt: Date.now(),
      });
      rescheduledIds.push(rescheduledId);
    }

    return {
      pivoted: pivotedIds.length,
      rescheduled: rescheduledIds.length,
      pivotedIds,
      rescheduledIds,
    };
  },
});

/**
 * getPivotedProtocols
 * 
 * Get all protocols that were pivoted from a specific date.
 * Used to show "Pivoted to Standby" status in the UI.
 */
export const getPivotedProtocols = query({
  args: {
    sessionId: v.string(),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("plannedProtocols")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", args.dateKey)
      )
      .collect();

    return all.filter((p) => p.status === "pivoted");
  },
});

/**
 * getStandbyProtocols
 * 
 * Get all protocols in "standby" status for a specific date.
 * These are rescheduled entries that were moved from a previous date.
 */
export const getStandbyProtocols = query({
  args: {
    sessionId: v.string(),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("plannedProtocols")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", args.dateKey)
      )
      .collect();

    return all.filter((p) => p.status === "standby");
  },
});

/**
 * markProtocolCompleted
 * 
 * When a user logs a standby protocol, mark it as completed.
 */
export const markProtocolCompleted = mutation({
  args: {
    id: v.id("plannedProtocols"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "logged" });
    return args.id;
  },
});

/**
 * getRescheduleHistory
 * 
 * Get the full reschedule chain for a protocol — shows how many times
 * it was pivoted and where it ended up. Useful for the Journal narrative.
 */
export const getRescheduleHistory = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("plannedProtocols")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const pivoted = all.filter((p) => p.status === "pivoted" || p.status === "standby");
    return pivoted.map((p) => ({
      id: p._id,
      name: p.name,
      type: p.type,
      dateKey: p.dateKey,
      status: p.status,
      pivotedFrom: p.pivotedFrom,
      originalDateKey: p.originalDateKey,
      rescheduledTo: p.rescheduledTo,
    }));
  },
});
