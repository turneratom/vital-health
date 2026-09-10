import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Health Data Synchronization Layer
 *
 * Provides mutations to ingest normalized health data from external providers
 * (Apple HealthKit, Oura, Garmin, Fitbit) and update the relevant Convex tables:
 * - hrvReadings: Individual HRV measurements
 * - sleepLogs: Per-night sleep data
 * - bioVault: Summary fields (hrvCurrent, hrvAvg7d, sleepScore, etc.)
 * - eliteScores: HRV data for legacy redline detection
 * - syncJobs: Audit trail of sync operations
 *
 * The client-side healthSyncService.ts normalizes provider-specific payloads
 * into the canonical shapes expected by these mutations.
 */

/* ═══════════════════════════════════════════════════════════
   Sync Job Management
   ═══════════════════════════════════════════════════════════ */

/** Create a new sync job record */
export const createSyncJob = mutation({
  args: {
    sessionId: v.string(),
    provider: v.string(),
    dataType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("syncJobs", {
      sessionId: args.sessionId,
      provider: args.provider,
      dataType: args.dataType,
      status: "running",
      recordsProcessed: 0,
      recordsFailed: 0,
      startedAt: Date.now(),
    });
  },
});

/** Complete a sync job */
export const completeSyncJob = mutation({
  args: {
    jobId: v.id("syncJobs"),
    recordsProcessed: v.number(),
    recordsFailed: v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.recordsFailed > 0 && args.recordsProcessed === 0 ? "failed" : "completed",
      recordsProcessed: args.recordsProcessed,
      recordsFailed: args.recordsFailed,
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
  },
});

/** Get recent sync jobs for a session */
export const getRecentSyncJobs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("syncJobs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(20);
    return jobs;
  },
});

/** Get last successful sync per provider */
export const getLastSyncPerProvider = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("syncJobs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(100);

    const lastByProvider: Record<string, { completedAt: number; recordsProcessed: number; status: string }> = {};
    for (const job of jobs) {
      if (!lastByProvider[job.provider] && job.status === "completed") {
        lastByProvider[job.provider] = {
          completedAt: job.completedAt ?? job.startedAt,
          recordsProcessed: job.recordsProcessed,
          status: job.status,
        };
      }
    }
    return lastByProvider;
  },
});

/* ═══════════════════════════════════════════════════════════
   HRV Data Ingestion
   ═══════════════════════════════════════════════════════════ */

/** Batch-insert HRV readings from a provider sync */
export const ingestHrvReadings = mutation({
  args: {
    sessionId: v.string(),
    readings: v.array(
      v.object({
        value: v.number(),
        context: v.string(),
        heartRate: v.optional(v.number()),
        source: v.string(),
        measuredAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;

    for (const reading of args.readings) {
      // Deduplicate: skip if a reading from same source within 5 min exists
      const existing = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", reading.measuredAt - 300000)
        )
        .first();

      if (existing && Math.abs(existing.measuredAt - reading.measuredAt) < 300000 && existing.source === reading.source) {
        continue;
      }

      await ctx.db.insert("hrvReadings", {
        sessionId: args.sessionId,
        value: reading.value,
        context: reading.context,
        heartRate: reading.heartRate,
        source: reading.source,
        measuredAt: reading.measuredAt,
        loggedAt: now,
      });
      inserted++;
    }

    // Update bioVault summary with latest HRV data
    if (inserted > 0) {
      await updateHrvSummary(ctx, args.sessionId);
    }

    return { inserted };
  },
});

/** Internal: Recalculate HRV summary fields in bioVault */
async function updateHrvSummary(ctx: any, sessionId: string) {
  const now = Date.now();
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;

  // Get recent readings
  const readings7d = await ctx.db
    .query("hrvReadings")
    .withIndex("by_sessionId_and_measuredAt", (q: any) =>
      q.eq("sessionId", sessionId).gte("measuredAt", cutoff7d)
    )
    .collect();

  const readings30d = await ctx.db
    .query("hrvReadings")
    .withIndex("by_sessionId_and_measuredAt", (q: any) =>
      q.eq("sessionId", sessionId).gte("measuredAt", cutoff30d)
    )
    .collect();

  if (readings7d.length === 0) return;

  const sorted = readings7d.sort((a: any, b: any) => b.measuredAt - a.measuredAt);
  const latest = sorted[0];
  const avg7d = Math.round(readings7d.reduce((s: number, r: any) => s + r.value, 0) / readings7d.length);
  const avg30d = readings30d.length > 0
    ? Math.round(readings30d.reduce((s: number, r: any) => s + r.value, 0) / readings30d.length)
    : avg7d;

  // Determine trend
  let trend: string = "flat";
  if (readings7d.length >= 3) {
    const recentHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    const olderHalf = sorted.slice(Math.ceil(sorted.length / 2));
    const recentAvg = recentHalf.reduce((s: number, r: any) => s + r.value, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((s: number, r: any) => s + r.value, 0) / olderHalf.length;
    const pctChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (pctChange > 3) trend = "up";
    else if (pctChange < -3) trend = "down";
  }

  // Upsert bioVault
  const vault = await ctx.db
    .query("bioVault")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .first();

  const hrvUpdate = {
    hrvCurrent: latest.value,
    hrvAvg7d: avg7d,
    hrvTrend: trend,
    hrvBaseline: avg30d,
    updatedAt: now,
  };

  if (vault) {
    await ctx.db.patch(vault._id, hrvUpdate);
  }
}

/* ═══════════════════════════════════════════════════════════
   Sleep Data Ingestion
   ═══════════════════════════════════════════════════════════ */

/** Batch-insert sleep logs from a provider sync */
export const ingestSleepLogs = mutation({
  args: {
    sessionId: v.string(),
    logs: v.array(
      v.object({
        date: v.string(),
        sleepScore: v.number(),
        totalHours: v.number(),
        deepHours: v.number(),
        remHours: v.number(),
        lightHours: v.number(),
        awakeHours: v.number(),
        efficiency: v.number(),
        latencyMin: v.number(),
        heartRateAvg: v.optional(v.number()),
        heartRateMin: v.optional(v.number()),
        respiratoryRate: v.optional(v.number()),
        source: v.string(),
        bedtimeAt: v.number(),
        wakeAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;

    for (const log of args.logs) {
      // Deduplicate by date + source
      const existing = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId_and_date", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("date", log.date)
        )
        .first();

      if (existing && existing.source === log.source) {
        // Update existing record with fresh data
        await ctx.db.patch(existing._id, {
          sleepScore: log.sleepScore,
          totalHours: log.totalHours,
          deepHours: log.deepHours,
          remHours: log.remHours,
          lightHours: log.lightHours,
          awakeHours: log.awakeHours,
          efficiency: log.efficiency,
          latencyMin: log.latencyMin,
          heartRateAvg: log.heartRateAvg,
          heartRateMin: log.heartRateMin,
          respiratoryRate: log.respiratoryRate,
          bedtimeAt: log.bedtimeAt,
          wakeAt: log.wakeAt,
          loggedAt: now,
        });
        inserted++;
        continue;
      }

      if (existing) continue; // Different source for same date, skip

      await ctx.db.insert("sleepLogs", {
        sessionId: args.sessionId,
        date: log.date,
        sleepScore: log.sleepScore,
        totalHours: log.totalHours,
        deepHours: log.deepHours,
        remHours: log.remHours,
        lightHours: log.lightHours,
        awakeHours: log.awakeHours,
        efficiency: log.efficiency,
        latencyMin: log.latencyMin,
        heartRateAvg: log.heartRateAvg,
        heartRateMin: log.heartRateMin,
        respiratoryRate: log.respiratoryRate,
        source: log.source,
        bedtimeAt: log.bedtimeAt,
        wakeAt: log.wakeAt,
        loggedAt: now,
      });
      inserted++;
    }

    // Update bioVault sleep summary
    if (inserted > 0) {
      await updateSleepSummary(ctx, args.sessionId);
    }

    return { inserted };
  },
});

/** Internal: Recalculate sleep summary fields in bioVault */
async function updateSleepSummary(ctx: any, sessionId: string) {
  const now = Date.now();

  // Get latest sleep log
  const sleepLogs = await ctx.db
    .query("sleepLogs")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .order("desc")
    .take(7);

  if (sleepLogs.length === 0) return;

  const latest = sleepLogs[0];

  const vault = await ctx.db
    .query("bioVault")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .first();

  const sleepUpdate = {
    sleepScore: latest.sleepScore,
    sleepHours: latest.totalHours,
    sleepDeepPct: latest.totalHours > 0 ? Math.round((latest.deepHours / latest.totalHours) * 100) : 0,
    sleepRemPct: latest.totalHours > 0 ? Math.round((latest.remHours / latest.totalHours) * 100) : 0,
    sleepLatencyMin: latest.latencyMin,
    sleepEfficiency: latest.efficiency,
    updatedAt: now,
  };

  // Determine bio status
  const avgScore = sleepLogs.reduce((s: number, l: any) => s + l.sleepScore, 0) / sleepLogs.length;
  let bioStatus = "optimal";
  if (latest.sleepScore < 50 || latest.totalHours < 5) bioStatus = "sleep-deprived";
  else if (avgScore < 60) bioStatus = "strained";
  else if (avgScore >= 80) bioStatus = "recovered";

  if (vault) {
    await ctx.db.patch(vault._id, {
      ...sleepUpdate,
      bioStatus,
      bioStatusUpdatedAt: now,
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   Resting Heart Rate Ingestion
   ═══════════════════════════════════════════════════════════ */

/** Ingest RHR data — stored as HRV readings with "rest" context + heart rate */
export const ingestRestingHeartRate = mutation({
  args: {
    sessionId: v.string(),
    readings: v.array(
      v.object({
        heartRate: v.number(),
        source: v.string(),
        measuredAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;

    for (const reading of args.readings) {
      // Store RHR as an HRV reading with context "resting" and the HR value
      const existing = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", reading.measuredAt - 300000)
        )
        .first();

      if (existing && existing.context === "resting" && Math.abs(existing.measuredAt - reading.measuredAt) < 300000) {
        continue;
      }

      await ctx.db.insert("hrvReadings", {
        sessionId: args.sessionId,
        value: 0, // RHR entries don't have HRV value
        context: "resting",
        heartRate: reading.heartRate,
        source: reading.source,
        measuredAt: reading.measuredAt,
        loggedAt: now,
      });
      inserted++;
    }

    return { inserted };
  },
});

/* ═══════════════════════════════════════════════════════════
   Full Provider Sync — Orchestrates all data types
   ═══════════════════════════════════════════════════════════ */

/** Mark integration connection as synced with timestamp */
export const markProviderSynced = mutation({
  args: {
    sessionId: v.string(),
    provider: v.string(),
    biometricPoints: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationConnections")
      .withIndex("by_sessionId_and_provider", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("provider", args.provider)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSynced: Date.now(),
        syncStatus: "synced",
        biometricPoints: args.biometricPoints,
      });
    }
  },
});

/* ═══════════════════════════════════════════════════════════
   Sync Status Dashboard Query
   ═══════════════════════════════════════════════════════════ */

/** Get comprehensive sync status for all providers */
export const getSyncDashboard = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    // Get connections
    const connections = await ctx.db
      .query("integrationConnections")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Get recent sync jobs
    const recentJobs = await ctx.db
      .query("syncJobs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);

    // Get data freshness
    const latestHrv = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .order("desc")
      .first();

    const latestSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    const hrvCount7d = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    const sleepCount7d = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleepCount = sleepCount7d.filter((s) => s.loggedAt >= cutoff7d).length;

    return {
      connections: connections.map((c) => ({
        provider: c.provider,
        connected: c.connected,
        lastSynced: c.lastSynced ?? null,
        syncStatus: c.syncStatus,
        biometricPoints: c.biometricPoints ?? 0,
      })),
      recentJobs: recentJobs.slice(0, 10).map((j) => ({
        provider: j.provider,
        dataType: j.dataType,
        status: j.status,
        recordsProcessed: j.recordsProcessed,
        startedAt: j.startedAt,
        completedAt: j.completedAt ?? null,
      })),
      dataFreshness: {
        lastHrvReading: latestHrv?.measuredAt ?? null,
        lastSleepLog: latestSleep?.loggedAt ?? null,
        hrvReadings7d: hrvCount7d.length,
        sleepLogs7d: recentSleepCount,
        isStale: !latestHrv || (now - latestHrv.measuredAt > 24 * 60 * 60 * 1000),
      },
    };
  },
});
