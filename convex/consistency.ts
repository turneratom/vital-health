import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ══════════════════════════════════════════════════════════════ */
/*  Consistency Engine — Protocol Streak Calculator & Badge Logic */
/*  Checks consecutive days with ≥80% Daily Mission completion   */
/*  Unlocks 'Elite' badge at 7-day streak                        */
/* ══════════════════════════════════════════════════════════════ */

const STREAK_THRESHOLD = 0.8; // 80% completion required
const ELITE_BADGE_DAYS = 7;   // 7 consecutive days for Elite badge

/** Helper: format date as YYYY-MM-DD */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Helper: subtract N days from a date */
function subtractDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

// ── Calculate & persist streak data for a user ──
export const calculateStreak = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const today = dateKey(now);

    // 1. Get all active protocols for this user (denominator)
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);
    const totalProtocols = activeProtocols.length;

    // If no protocols assigned, can't calculate streak
    if (totalProtocols === 0) {
      // Still upsert with zero streak
      return await upsertStreakData(ctx, args.sessionId, {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: "",
        eliteBadgeUnlocked: false,
        totalQualifiedDays: 0,
      });
    }

    // 2. Get all protocol completions (last 90 days max)
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // 3. Get all protocol logs (last 90 days)
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", ninetyDaysAgo)
      )
      .collect();

    // 4. Get adherence scores (pre-computed daily adherence)
    const adherenceScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const adherenceMap = new Map(adherenceScores.map((a) => [a.dateKey, a]));

    // 5. Build per-day completion map for last 90 days
    const dayCompletionMap = new Map<string, number>();

    for (let i = 0; i < 90; i++) {
      const d = subtractDays(now, i);
      const dk = dateKey(d);
      const dayStart = new Date(dk + "T00:00:00").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      // Check adherence score first (most accurate)
      const adherence = adherenceMap.get(dk);
      if (adherence) {
        dayCompletionMap.set(dk, adherence.adherencePercent / 100);
        continue;
      }

      // Fall back to counting completions + logs
      const dayCompletions = completions.filter(
        (c) => c.dateKey === dk && c.completed
      );
      const dayLogs = protocolLogs.filter(
        (l) => l.loggedAt >= dayStart && l.loggedAt < dayEnd
      );

      // Unique completed protocol IDs
      const completedIds = new Set([
        ...dayCompletions.map((c) => c.protocolItemId),
        ...dayLogs.map((l) => l.protocolId),
      ]);

      const pct = totalProtocols > 0 ? completedIds.size / totalProtocols : 0;
      dayCompletionMap.set(dk, Math.min(1, pct));
    }

    // 6. Calculate current streak (consecutive days from yesterday backward)
    //    We check from yesterday because today may not be complete yet
    let currentStreak = 0;
    
    // First check if today qualifies (bonus — counts toward streak if already ≥80%)
    const todayPct = dayCompletionMap.get(today) ?? 0;
    const todayQualifies = todayPct >= STREAK_THRESHOLD;

    // Walk backward from yesterday (or today if it qualifies)
    const startDay = todayQualifies ? 0 : 1;
    for (let i = startDay; i < 90; i++) {
      const dk = dateKey(subtractDays(now, i));
      const pct = dayCompletionMap.get(dk) ?? 0;
      if (pct >= STREAK_THRESHOLD) {
        currentStreak++;
      } else {
        break;
      }
    }

    // 7. Calculate longest streak ever
    let longestStreak = 0;
    let tempStreak = 0;
    // Walk from oldest to newest
    for (let i = 89; i >= 0; i--) {
      const dk = dateKey(subtractDays(now, i));
      const pct = dayCompletionMap.get(dk) ?? 0;
      if (pct >= STREAK_THRESHOLD) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // 8. Count total qualified days
    let totalQualifiedDays = 0;
    for (const pct of dayCompletionMap.values()) {
      if (pct >= STREAK_THRESHOLD) totalQualifiedDays++;
    }

    // 9. Find last completed date
    let lastCompletedDate = "";
    for (let i = 0; i < 90; i++) {
      const dk = dateKey(subtractDays(now, i));
      const pct = dayCompletionMap.get(dk) ?? 0;
      if (pct >= STREAK_THRESHOLD) {
        lastCompletedDate = dk;
        break;
      }
    }

    // 10. Check existing streak data for badge persistence
    const existing = await ctx.db
      .query("streakData")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const wasElite = existing?.eliteBadgeUnlocked ?? false;
    const eliteBadgeUnlocked = wasElite || currentStreak >= ELITE_BADGE_DAYS || longestStreak >= ELITE_BADGE_DAYS;

    // Use existing longest if higher (in case data was purged)
    const finalLongest = Math.max(longestStreak, existing?.longestStreak ?? 0);

    return await upsertStreakData(ctx, args.sessionId, {
      currentStreak,
      longestStreak: finalLongest,
      lastCompletedDate,
      eliteBadgeUnlocked,
      eliteBadgeUnlockedAt: eliteBadgeUnlocked && !wasElite ? Date.now() : existing?.eliteBadgeUnlockedAt,
      totalQualifiedDays,
    });
  },
});

/** Upsert helper */
async function upsertStreakData(
  ctx: any,
  sessionId: string,
  data: {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: string;
    eliteBadgeUnlocked: boolean;
    eliteBadgeUnlockedAt?: number;
    totalQualifiedDays: number;
  }
) {
  const existing = await ctx.db
    .query("streakData")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .first();

  const record = {
    sessionId,
    ...data,
    calculatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, record);
    return { ...record, _id: existing._id };
  } else {
    const id = await ctx.db.insert("streakData", record);
    return { ...record, _id: id };
  }
}

// ── Query: Get cached streak data (fast read for UI) ──
export const getStreakData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const data = await ctx.db
      .query("streakData")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!data) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: "",
        eliteBadgeUnlocked: false,
        eliteBadgeUnlockedAt: null,
        totalQualifiedDays: 0,
        calculatedAt: 0,
        isStale: true,
      };
    }

    // Consider data stale if older than 1 hour
    const isStale = Date.now() - data.calculatedAt > 60 * 60 * 1000;

    return {
      currentStreak: data.currentStreak,
      longestStreak: data.longestStreak,
      lastCompletedDate: data.lastCompletedDate,
      eliteBadgeUnlocked: data.eliteBadgeUnlocked,
      eliteBadgeUnlockedAt: data.eliteBadgeUnlockedAt ?? null,
      totalQualifiedDays: data.totalQualifiedDays,
      calculatedAt: data.calculatedAt,
      isStale,
    };
  },
});
