/**
 * Bind better-auth userId → twin sessionId (`user:<id>`).
 * On first bind, optionally rekeys guest session rows onto the auth session key.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";

/** Tables keyed by sessionId that own operator twin data (skip ephemeral/squad shared). */
const MIGRATE_TABLES = [
  "commitments",
  "foodLogs",
  "activityLogs",
  "leaderboardUsers",
  "eliteScores",
  "bioVault",
  "sleepLogs",
  "hrvReadings",
  "caffeineLogs",
  "protocolLogs",
  "journalEvents",
  "integrationConnections",
  "userPreferences",
  "userVitals",
  "workoutLogs",
  "plannedProtocols",
  "dailyIntake",
  "voiceJournalEntries",
  "devicePermissions",
  "protocols",
  "protocolCompletions",
  "dailyDirectives",
  "vaultFiles",
  "daily_completions",
  "adherenceScores",
  "protocolSessions",
  "inductionProfiles",
  "missionParticipants",
  "labResults",
  "habitVerifications",
  "syncJobs",
  "weeklyBadges",
  "recoveryObjectives",
  "streakData",
  "physicalBaseline",
  "normalizedMetrics",
  "sensorStatus",
  "ingestionJobs",
  "sharedReports",
  "driftHistory",
  "activeInterventions",
  "viveAgeHistory",
  "substanceLogs",
  "substanceCycles",
  "substancePulseAlerts",
  "somaticFeedback",
  "bioIdentityState",
  "objectives",
  "objectiveMilestones",
  "bodyMapEntries",
  "inventory",
  "driftEvents",
  "coherencePulses",
  "recoveryProtocolSessions",
  "longevityScoreHistory",
  "somaticVoiceMemos",
] as const;

const BATCH = 100;

async function rekeyTable(
  ctx: MutationCtx,
  table: (typeof MIGRATE_TABLES)[number],
  fromSessionId: string,
  toSessionId: string,
): Promise<number> {
  let moved = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = ctx.db as any;
  for (;;) {
    const rows = await db
      .query(table)
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", fromSessionId))
      .take(BATCH);
    if (!rows.length) break;
    for (const row of rows) {
      await ctx.db.patch(row._id, { sessionId: toSessionId });
      moved += 1;
    }
    if (rows.length < BATCH) break;
  }
  return moved;
}

export function authTwinSessionId(userId: string): string {
  return `user:${userId}`;
}

export const getBinding = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("sessionBindings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Claim `user:<userId>` as the stable twin session key.
 * If guestSessionId differs and looks like a guest key, rekey rows onto the auth key.
 */
export const claimAndMigrate = mutation({
  args: {
    userId: v.string(),
    guestSessionId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, guestSessionId }) => {
    if (!userId || !userId.trim()) {
      throw new Error("userId required");
    }

    const sessionId = authTwinSessionId(userId);
    const now = Date.now();
    const existing = await ctx.db
      .query("sessionBindings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    let migratedCount = existing?.migratedCount ?? 0;
    const from =
      guestSessionId &&
      guestSessionId.trim() &&
      guestSessionId !== sessionId &&
      !guestSessionId.startsWith("user:")
        ? guestSessionId
        : null;

    if (from) {
      let batchMoved = 0;
      for (const table of MIGRATE_TABLES) {
        try {
          batchMoved += await rekeyTable(ctx, table, from, sessionId);
        } catch {
          // Table may lack rows / index edge — continue
        }
      }
      migratedCount += batchMoved;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionId,
        guestSessionId: from ?? existing.guestSessionId,
        migratedCount,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("sessionBindings", {
        userId,
        sessionId,
        guestSessionId: from ?? undefined,
        migratedCount,
        boundAt: now,
        updatedAt: now,
      });
    }

    return { sessionId, migratedCount, migratedFrom: from };
  },
});
