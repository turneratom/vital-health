import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════
   Bio-Vault Metrics — Sleep, HRV, Caffeine ingestion + auto-status
   ═══════════════════════════════════════════════════════════════════ */

// ── Sleep Log: Record a night of sleep ──
export const logSleep = mutation({
  args: {
    sessionId: v.string(),
    date: v.string(),
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Calculate composite sleep score (0–100)
    const sleepScore = calculateSleepScore({
      totalHours: args.totalHours,
      deepPct: args.totalHours > 0 ? (args.deepHours / args.totalHours) * 100 : 0,
      remPct: args.totalHours > 0 ? (args.remHours / args.totalHours) * 100 : 0,
      efficiency: args.efficiency,
      latencyMin: args.latencyMin,
    });

    // Upsert sleep log for this date (one per night)
    const existing = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId_and_date", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("date", args.date)
      )
      .first();

    const sleepData = {
      sessionId: args.sessionId,
      date: args.date,
      sleepScore,
      totalHours: args.totalHours,
      deepHours: args.deepHours,
      remHours: args.remHours,
      lightHours: args.lightHours,
      awakeHours: args.awakeHours,
      efficiency: args.efficiency,
      latencyMin: args.latencyMin,
      heartRateAvg: args.heartRateAvg,
      heartRateMin: args.heartRateMin,
      respiratoryRate: args.respiratoryRate,
      source: args.source,
      bedtimeAt: args.bedtimeAt,
      wakeAt: args.wakeAt,
      loggedAt: now,
    };

    let logId;
    if (existing) {
      await ctx.db.patch(existing._id, sleepData);
      logId = existing._id;
    } else {
      logId = await ctx.db.insert("sleepLogs", sleepData);
    }

    // Update bioVault summary
    await updateBioVaultSleep(ctx, args.sessionId, {
      sleepScore,
      sleepHours: args.totalHours,
      sleepDeepPct: args.totalHours > 0 ? (args.deepHours / args.totalHours) * 100 : 0,
      sleepRemPct: args.totalHours > 0 ? (args.remHours / args.totalHours) * 100 : 0,
      sleepLatencyMin: args.latencyMin,
      sleepEfficiency: args.efficiency,
    });

    // Recalculate auto-status
    await recalculateBioStatus(ctx, args.sessionId);

    return logId;
  },
});

// ── HRV Reading: Record a single HRV measurement ──
export const logHrvReading = mutation({
  args: {
    sessionId: v.string(),
    value: v.number(),
    context: v.string(),
    heartRate: v.optional(v.number()),
    source: v.string(),
    measuredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const readingId = await ctx.db.insert("hrvReadings", {
      sessionId: args.sessionId,
      value: args.value,
      context: args.context,
      heartRate: args.heartRate,
      source: args.source,
      measuredAt: args.measuredAt,
      loggedAt: now,
    });

    // Calculate 7-day rolling average
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const recentReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    const avg7d = recentReadings.length > 0
      ? Math.round(recentReadings.reduce((s, r) => s + r.value, 0) / recentReadings.length)
      : args.value;

    // Calculate 30-day baseline
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
    const baselineReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff30d)
      )
      .collect();

    const baseline = baselineReadings.length > 0
      ? Math.round(baselineReadings.reduce((s, r) => s + r.value, 0) / baselineReadings.length)
      : args.value;

    // Determine trend
    const delta = avg7d - baseline;
    const trend: string = Math.abs(delta) < 3 ? "flat" : delta > 0 ? "up" : "down";

    // Update bioVault HRV summary
    await updateBioVaultHrv(ctx, args.sessionId, {
      hrvCurrent: args.value,
      hrvAvg7d: avg7d,
      hrvTrend: trend,
      hrvBaseline: baseline,
    });

    // Recalculate auto-status
    await recalculateBioStatus(ctx, args.sessionId);

    return readingId;
  },
});

// ── Caffeine Log: Record a caffeine intake event ──
export const logCaffeine = mutation({
  args: {
    sessionId: v.string(),
    source: v.string(),
    amountMg: v.number(),
    name: v.optional(v.string()),
    halfLifeHours: v.optional(v.number()),
    consumedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const logId = await ctx.db.insert("caffeineLogs", {
      sessionId: args.sessionId,
      source: args.source,
      amountMg: args.amountMg,
      name: args.name,
      halfLifeHours: args.halfLifeHours,
      consumedAt: args.consumedAt,
      loggedAt: now,
    });

    // Calculate today's total caffeine
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayLogs = await ctx.db
      .query("caffeineLogs")
      .withIndex("by_sessionId_and_consumedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("consumedAt", todayStart.getTime())
      )
      .collect();

    const totalMg = todayLogs.reduce((s, l) => s + l.amountMg, 0);
    const lastIntake = todayLogs.reduce((max, l) => Math.max(max, l.consumedAt), 0);

    // Update bioVault caffeine summary
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (vault) {
      await ctx.db.patch(vault._id, {
        caffeineTodayMg: totalMg,
        caffeineLastIntakeAt: lastIntake,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("bioVault", {
        sessionId: args.sessionId,
        mthfrVariant: false,
        apoe4: false,
        caffeineSensitivity: false,
        preferredProteins: "",
        dietaryRestrictions: "",
        caffeineTodayMg: totalMg,
        caffeineLastIntakeAt: lastIntake,
        updatedAt: now,
      });
    }

    // Recalculate auto-status
    await recalculateBioStatus(ctx, args.sessionId);

    return logId;
  },
});

// ── Set personal caffeine limit ──
export const setCaffeineDailyLimit = mutation({
  args: {
    sessionId: v.string(),
    limitMg: v.number(),
  },
  handler: async (ctx, args) => {
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (vault) {
      await ctx.db.patch(vault._id, {
        caffeineDailyLimitMg: args.limitMg,
        updatedAt: Date.now(),
      });
    }
  },
});

// ── Query: Get full biological metrics dashboard ──
export const getBioMetrics = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    // Bio vault summary
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Recent sleep logs (7 days)
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId_and_date", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const recentSleep = sleepLogs
      .filter((s) => s.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    // Recent HRV readings (7 days)
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    // Today's caffeine
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const caffeineLogs = await ctx.db
      .query("caffeineLogs")
      .withIndex("by_sessionId_and_consumedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("consumedAt", todayStart.getTime())
      )
      .collect();

    // Calculate active caffeine in system (using half-life decay)
    const halfLife = vault?.caffeineSensitivity ? 7 : 5; // hours
    let activeCaffeineMg = 0;
    for (const log of caffeineLogs) {
      const hoursElapsed = (now - log.consumedAt) / (1000 * 60 * 60);
      const remaining = log.amountMg * Math.pow(0.5, hoursElapsed / halfLife);
      activeCaffeineMg += remaining;
    }

    return {
      vault: vault ? {
        sleepScore: vault.sleepScore ?? null,
        sleepHours: vault.sleepHours ?? null,
        sleepDeepPct: vault.sleepDeepPct ?? null,
        sleepRemPct: vault.sleepRemPct ?? null,
        sleepEfficiency: vault.sleepEfficiency ?? null,
        hrvCurrent: vault.hrvCurrent ?? null,
        hrvAvg7d: vault.hrvAvg7d ?? null,
        hrvTrend: vault.hrvTrend ?? null,
        hrvBaseline: vault.hrvBaseline ?? null,
        caffeineTodayMg: vault.caffeineTodayMg ?? 0,
        caffeineLastIntakeAt: vault.caffeineLastIntakeAt ?? null,
        caffeineDailyLimitMg: vault.caffeineDailyLimitMg ?? 400,
        caffeineSensitivity: vault.caffeineSensitivity,
        bioStatus: vault.bioStatus ?? null,
      } : null,
      sleepHistory: recentSleep.map((s) => ({
        date: s.date,
        score: s.sleepScore,
        hours: s.totalHours,
        deepPct: s.totalHours > 0 ? (s.deepHours / s.totalHours) * 100 : 0,
        remPct: s.totalHours > 0 ? (s.remHours / s.totalHours) * 100 : 0,
        efficiency: s.efficiency,
      })),
      hrvHistory: hrvReadings
        .sort((a, b) => a.measuredAt - b.measuredAt)
        .map((r) => ({
          value: r.value,
          context: r.context,
          measuredAt: r.measuredAt,
        })),
      caffeine: {
        todayTotal: caffeineLogs.reduce((s, l) => s + l.amountMg, 0),
        activeInSystem: Math.round(activeCaffeineMg),
        logs: caffeineLogs.map((l) => ({
          source: l.source,
          amountMg: l.amountMg,
          name: l.name ?? l.source,
          consumedAt: l.consumedAt,
        })),
      },
    };
  },
});

// ── Query: Weekly Debrief — aggregate 7 days for Squad Readiness Score ──
export const getWeeklyDebrief = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    // ── 1. Sleep scores (last 7 days) ──
    const allSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId_and_date", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const recentSleep = allSleep
      .filter((s) => s.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    const sleepScores = recentSleep.map((s) => ({
      date: s.date,
      score: s.sleepScore,
      hours: s.totalHours,
      deepPct: s.totalHours > 0 ? Math.round((s.deepHours / s.totalHours) * 100) : 0,
      remPct: s.totalHours > 0 ? Math.round((s.remHours / s.totalHours) * 100) : 0,
      efficiency: s.efficiency,
    }));
    const avgSleepScore = sleepScores.length > 0
      ? Math.round(sleepScores.reduce((s, r) => s + r.score, 0) / sleepScores.length)
      : null;
    const avgSleepHours = sleepScores.length > 0
      ? Math.round((sleepScores.reduce((s, r) => s + r.hours, 0) / sleepScores.length) * 10) / 10
      : null;

    // ── 2. HRV trend (last 7 days) ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();
    const hrvValues = hrvReadings.map((r) => ({ value: r.value, measuredAt: r.measuredAt }));
    const avgHrv = hrvValues.length > 0
      ? Math.round(hrvValues.reduce((s, r) => s + r.value, 0) / hrvValues.length)
      : null;

    // ── 3. Blood markers / Lab results ──
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentLabs = labResults.filter((l) => l.loggedAt >= cutoff7d);

    // Score blood markers (0-100): each marker in optimal = 100, borderline = 60, out = 30
    let bloodScore: number | null = null;
    if (vault) {
      const markers: { val: number | undefined; low: number; high: number; inverse?: boolean }[] = [
        { val: vault.vitaminD ?? undefined, low: 40, high: 60 },
        { val: vault.testosteroneTotal ?? undefined, low: 500, high: 900 },
        { val: vault.ferritin ?? undefined, low: 40, high: 150 },
        { val: vault.crp ?? undefined, low: 0, high: 1, inverse: true },
        { val: vault.hba1c ?? undefined, low: 0, high: 5.7, inverse: true },
      ];
      const scored = markers.filter((m) => m.val !== undefined);
      if (scored.length > 0) {
        const total = scored.reduce((sum, m) => {
          const v = m.val!;
          if (m.inverse) {
            return sum + (v <= m.high ? 100 : v <= m.high * 1.5 ? 60 : 30);
          }
          return sum + (v >= m.low && v <= m.high ? 100 : v >= m.low * 0.8 ? 60 : 30);
        }, 0);
        bloodScore = Math.round(total / scored.length);
      }
    }

    // ── 4. Mission completion (last 7 days) ──
    const adherenceRecords = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentAdherence = adherenceRecords.filter((a) => a.updatedAt >= cutoff7d);
    const avgAdherence = recentAdherence.length > 0
      ? Math.round(recentAdherence.reduce((s, a) => s + a.adherencePercent, 0) / recentAdherence.length)
      : null;

    // Protocol completion logs
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff7d)
      )
      .collect();
    const protocolsByDay: Record<string, number> = {};
    for (const log of protocolLogs) {
      const d = new Date(log.loggedAt).toISOString().slice(0, 10);
      protocolsByDay[d] = (protocolsByDay[d] || 0) + 1;
    }

    // ── 5. Compute Squad Readiness Score (0–100) ──
    // Weights: Sleep 30%, HRV 25%, Blood 20%, Mission Adherence 25%
    const components: { label: string; score: number | null; weight: number }[] = [
      { label: 'Sleep Quality', score: avgSleepScore, weight: 0.30 },
      { label: 'HRV Recovery', score: avgHrv ? Math.min(100, Math.round((avgHrv / 80) * 100)) : null, weight: 0.25 },
      { label: 'Blood Markers', score: bloodScore, weight: 0.20 },
      { label: 'Mission Adherence', score: avgAdherence, weight: 0.25 },
    ];

    let readinessScore: number | null = null;
    const activeComponents = components.filter((c) => c.score !== null);
    if (activeComponents.length > 0) {
      const totalWeight = activeComponents.reduce((s, c) => s + c.weight, 0);
      readinessScore = Math.round(
        activeComponents.reduce((s, c) => s + (c.score! * (c.weight / totalWeight)), 0)
      );
    }

    // ── 6. Determine readiness tier ──
    let tier = 'Unknown';
    let tierEmoji = '❓';
    if (readinessScore !== null) {
      if (readinessScore >= 85) { tier = 'Mission Ready'; tierEmoji = '🟢'; }
      else if (readinessScore >= 70) { tier = 'Operational'; tierEmoji = '🔵'; }
      else if (readinessScore >= 50) { tier = 'Recovering'; tierEmoji = '🟡'; }
      else { tier = 'Stand Down'; tierEmoji = '🔴'; }
    }

    return {
      readinessScore,
      tier,
      tierEmoji,
      components: components.map((c) => ({ label: c.label, score: c.score, weight: Math.round(c.weight * 100) })),
      sleep: {
        avgScore: avgSleepScore,
        avgHours: avgSleepHours,
        nights: sleepScores,
        count: sleepScores.length,
      },
      hrv: {
        avg7d: avgHrv,
        readings: hrvValues.sort((a, b) => a.measuredAt - b.measuredAt),
        count: hrvValues.length,
        trend: vault?.hrvTrend ?? null,
      },
      blood: {
        score: bloodScore,
        markers: vault ? {
          vitaminD: vault.vitaminD ?? null,
          testosteroneTotal: vault.testosteroneTotal ?? null,
          testosteroneFree: vault.testosteroneFree ?? null,
          ferritin: vault.ferritin ?? null,
          crp: vault.crp ?? null,
          hba1c: vault.hba1c ?? null,
        } : null,
        recentLabCount: recentLabs.length,
      },
      missions: {
        avgAdherence,
        protocolsByDay,
        totalProtocolsLogged: protocolLogs.length,
        daysTracked: recentAdherence.length,
      },
      periodStart: new Date(cutoff7d).toISOString().slice(0, 10),
      periodEnd: new Date(now).toISOString().slice(0, 10),
      generatedAt: now,
    };
  },
});

// ── Query: Get bio-status for FluidCanvas presence ──
export const getBioStatus = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!vault) return { status: null, updatedAt: null };

    return {
      status: vault.bioStatus ?? null,
      updatedAt: vault.bioStatusUpdatedAt ?? null,
      sleepScore: vault.sleepScore ?? null,
      hrvCurrent: vault.hrvCurrent ?? null,
      caffeineTodayMg: vault.caffeineTodayMg ?? 0,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════════
   Internal helpers
   ═══════════════════════════════════════════════════════════════════ */

function calculateSleepScore(input: {
  totalHours: number;
  deepPct: number;
  remPct: number;
  efficiency: number;
  latencyMin: number;
}): number {
  // Duration score (30% weight) — 7-9h optimal
  let durationScore: number;
  if (input.totalHours >= 7 && input.totalHours <= 9) durationScore = 100;
  else if (input.totalHours >= 6) durationScore = 70 + (input.totalHours - 6) * 30;
  else if (input.totalHours > 9 && input.totalHours <= 10) durationScore = 100 - (input.totalHours - 9) * 20;
  else durationScore = Math.max(20, input.totalHours * 10);

  // Deep sleep score (25% weight) — 15-25% optimal
  let deepScore: number;
  if (input.deepPct >= 15 && input.deepPct <= 25) deepScore = 100;
  else if (input.deepPct >= 10) deepScore = 60 + (input.deepPct - 10) * 8;
  else deepScore = Math.max(20, input.deepPct * 6);

  // REM score (20% weight) — 20-25% optimal
  let remScore: number;
  if (input.remPct >= 20 && input.remPct <= 25) remScore = 100;
  else if (input.remPct >= 15) remScore = 70 + (input.remPct - 15) * 6;
  else remScore = Math.max(20, input.remPct * 4.5);

  // Efficiency score (15% weight)
  const effScore = Math.min(100, Math.max(0, input.efficiency));

  // Latency score (10% weight) — <15min optimal
  let latScore: number;
  if (input.latencyMin <= 15) latScore = 100;
  else if (input.latencyMin <= 30) latScore = 100 - (input.latencyMin - 15) * 2;
  else latScore = Math.max(20, 70 - (input.latencyMin - 30));

  return Math.round(
    durationScore * 0.30 +
    deepScore * 0.25 +
    remScore * 0.20 +
    effScore * 0.15 +
    latScore * 0.10
  );
}

async function updateBioVaultSleep(
  ctx: any,
  sessionId: string,
  data: {
    sleepScore: number;
    sleepHours: number;
    sleepDeepPct: number;
    sleepRemPct: number;
    sleepLatencyMin: number;
    sleepEfficiency: number;
  }
) {
  const vault = await ctx.db
    .query("bioVault")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .first();

  if (vault) {
    await ctx.db.patch(vault._id, { ...data, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("bioVault", {
      sessionId,
      mthfrVariant: false,
      apoe4: false,
      caffeineSensitivity: false,
      preferredProteins: "",
      dietaryRestrictions: "",
      ...data,
      updatedAt: Date.now(),
    });
  }
}

async function updateBioVaultHrv(
  ctx: any,
  sessionId: string,
  data: {
    hrvCurrent: number;
    hrvAvg7d: number;
    hrvTrend: string;
    hrvBaseline: number;
  }
) {
  const vault = await ctx.db
    .query("bioVault")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .first();

  if (vault) {
    await ctx.db.patch(vault._id, { ...data, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("bioVault", {
      sessionId,
      mthfrVariant: false,
      apoe4: false,
      caffeineSensitivity: false,
      preferredProteins: "",
      dietaryRestrictions: "",
      ...data,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Recalculate the auto bio-status based on current vault metrics.
 * Priority order: sleep-deprived > strained > caffeinated > recovered > optimal
 * This status drives the FluidCanvas peer icon glow/badge.
 */
async function recalculateBioStatus(ctx: any, sessionId: string) {
  const vault = await ctx.db
    .query("bioVault")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .first();

  if (!vault) return;

  const now = Date.now();
  let status = "optimal";

  // Check sleep deprivation (score < 50 or < 5 hours)
  if (vault.sleepScore != null && vault.sleepScore < 50) {
    status = "sleep-deprived";
  } else if (vault.sleepHours != null && vault.sleepHours < 5) {
    status = "sleep-deprived";
  }
  // Check HRV strain (current well below baseline)
  else if (
    vault.hrvCurrent != null &&
    vault.hrvBaseline != null &&
    vault.hrvCurrent < vault.hrvBaseline * 0.75
  ) {
    status = "strained";
  }
  // Check high caffeine (over daily limit or sensitivity threshold)
  else if (vault.caffeineTodayMg != null) {
    const limit = vault.caffeineDailyLimitMg ?? (vault.caffeineSensitivity ? 200 : 400);
    if (vault.caffeineTodayMg > limit * 0.8) {
      status = "caffeinated";
    }
  }
  // Check good recovery (sleep > 80, HRV trending up)
  if (
    status === "optimal" &&
    vault.sleepScore != null &&
    vault.sleepScore >= 80 &&
    vault.hrvTrend === "up"
  ) {
    status = "recovered";
  }

  await ctx.db.patch(vault._id, {
    bioStatus: status,
    bioStatusUpdatedAt: now,
    updatedAt: now,
  });
}
