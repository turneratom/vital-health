import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   Sleep Intel — Deep sleep analytics query
   Returns 30 days of nightly breakdowns + protocol/supplement
   correlation data for the AI insight engine.
   ═══════════════════════════════════════════════════════════════ */

export const getSleepIntel = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    // ── 1. All sleep logs (up to 30 days) ──
    const allSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId_and_date", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();

    const sleep30d = allSleep
      .filter((s) => s.loggedAt >= cutoff30d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    const sleep7d = sleep30d.filter((s) => s.loggedAt >= cutoff7d);

    // ── 2. Protocol adherence (for correlation) ──
    const adherenceRecords = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentAdherence = adherenceRecords.filter((a) => a.updatedAt >= cutoff30d);

    // ── 3. Protocol logs (supplement timing) ──
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff30d)
      )
      .collect();

    // ── 4. HRV for readiness correlation ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff30d)
      )
      .collect();

    // ── 5. BioVault for current state ──
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // ── Build nightly breakdown ──
    const nightlyData = sleep30d.map((s) => {
      const totalH = s.totalHours || 0.01;
      return {
        date: s.date,
        sleepScore: s.sleepScore,
        totalHours: s.totalHours,
        deepHours: s.deepHours,
        remHours: s.remHours,
        lightHours: s.lightHours,
        awakeHours: s.awakeHours,
        deepPct: Math.round((s.deepHours / totalH) * 100),
        remPct: Math.round((s.remHours / totalH) * 100),
        lightPct: Math.round((s.lightHours / totalH) * 100),
        awakePct: Math.round((s.awakeHours / totalH) * 100),
        efficiency: s.efficiency,
        latencyMin: s.latencyMin,
        heartRateAvg: s.heartRateAvg ?? null,
        heartRateMin: s.heartRateMin ?? null,
        respiratoryRate: s.respiratoryRate ?? null,
        bedtimeAt: s.bedtimeAt,
        wakeAt: s.wakeAt,
      };
    });

    // ── Averages ──
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const scores7d = sleep7d.map((s) => s.sleepScore);
    const scores30d = sleep30d.map((s) => s.sleepScore);
    const hours7d = sleep7d.map((s) => s.totalHours);
    const hours30d = sleep30d.map((s) => s.totalHours);
    const deep7d = sleep7d.map((s) =>
      s.totalHours > 0 ? (s.deepHours / s.totalHours) * 100 : 0
    );
    const rem7d = sleep7d.map((s) =>
      s.totalHours > 0 ? (s.remHours / s.totalHours) * 100 : 0
    );
    const eff7d = sleep7d.map((s) => s.efficiency);

    // ── Supplement correlation: find nights where magnesium was taken before 9pm ──
    const supplementCorrelations: Array<{
      supplement: string;
      nightsWith: number;
      nightsWithout: number;
      avgDeepWith: number;
      avgDeepWithout: number;
      deltaDeepPct: number;
    }> = [];

    // Group protocol logs by date
    const logsByDate: Record<string, typeof protocolLogs> = {};
    for (const log of protocolLogs) {
      const d = new Date(log.loggedAt).toISOString().slice(0, 10);
      if (!logsByDate[d]) logsByDate[d] = [];
      logsByDate[d].push(log);
    }

    // Check common supplements
    const supplementKeywords = ["magnesium", "zinc", "ashwagandha", "melatonin", "glycine", "l-theanine"];
    for (const keyword of supplementKeywords) {
      const datesWithSupplement = new Set<string>();
      for (const [date, logs] of Object.entries(logsByDate)) {
        const hasSupplement = logs.some(
          (l) =>
            (l.protocolName?.toLowerCase().includes(keyword) ||
              l.message?.toLowerCase().includes(keyword)) &&
            new Date(l.loggedAt).getHours() < 21
        );
        if (hasSupplement) datesWithSupplement.add(date);
      }

      if (datesWithSupplement.size >= 2) {
        const nightsWith = sleep30d.filter((s) => datesWithSupplement.has(s.date));
        const nightsWithout = sleep30d.filter((s) => !datesWithSupplement.has(s.date));

        if (nightsWith.length >= 2 && nightsWithout.length >= 2) {
          const avgDeepWith = avg(
            nightsWith.map((s) => (s.totalHours > 0 ? (s.deepHours / s.totalHours) * 100 : 0))
          );
          const avgDeepWithout = avg(
            nightsWithout.map((s) => (s.totalHours > 0 ? (s.deepHours / s.totalHours) * 100 : 0))
          );

          supplementCorrelations.push({
            supplement: keyword.charAt(0).toUpperCase() + keyword.slice(1),
            nightsWith: nightsWith.length,
            nightsWithout: nightsWithout.length,
            avgDeepWith: Math.round(avgDeepWith * 10) / 10,
            avgDeepWithout: Math.round(avgDeepWithout * 10) / 10,
            deltaDeepPct: Math.round((avgDeepWith - avgDeepWithout) * 10) / 10,
          });
        }
      }
    }

    // ── Readiness score correlation (next-day HRV after good/bad sleep) ──
    const sleepHrvCorrelation: Array<{ date: string; sleepScore: number; nextDayHrv: number | null }> = [];
    for (const night of sleep30d) {
      const nextDay = new Date(night.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      const nextDayStart = nextDay.getTime();
      const nextDayEnd = nextDayStart + 24 * 60 * 60 * 1000;
      const nextDayReadings = hrvReadings.filter(
        (r) => r.measuredAt >= nextDayStart && r.measuredAt < nextDayEnd
      );
      const avgHrv =
        nextDayReadings.length > 0
          ? Math.round(nextDayReadings.reduce((s, r) => s + r.value, 0) / nextDayReadings.length)
          : null;
      sleepHrvCorrelation.push({ date: night.date, sleepScore: night.sleepScore, nextDayHrv: avgHrv });
    }

    // ── Adherence correlation ──
    const adherenceByDate: Record<string, number> = {};
    for (const a of recentAdherence) {
      const d = new Date(a.updatedAt).toISOString().slice(0, 10);
      adherenceByDate[d] = a.adherencePercent;
    }

    // ── Trend: compare last 7d avg to previous 7d avg ──
    const prev7dStart = cutoff7d - 7 * 24 * 60 * 60 * 1000;
    const prev7d = sleep30d.filter((s) => s.loggedAt >= prev7dStart && s.loggedAt < cutoff7d);
    const prevScoreAvg = avg(prev7d.map((s) => s.sleepScore));
    const currScoreAvg = avg(scores7d);
    const scoreTrend = scores7d.length >= 3 && prev7d.length >= 3
      ? (currScoreAvg - prevScoreAvg > 3 ? "improving" : currScoreAvg - prevScoreAvg < -3 ? "declining" : "stable")
      : "insufficient_data";

    return {
      nightlyData,
      summary: {
        avgScore7d: Math.round(avg(scores7d)),
        avgScore30d: Math.round(avg(scores30d)),
        avgHours7d: Math.round(avg(hours7d) * 10) / 10,
        avgHours30d: Math.round(avg(hours30d) * 10) / 10,
        avgDeepPct7d: Math.round(avg(deep7d)),
        avgRemPct7d: Math.round(avg(rem7d)),
        avgEfficiency7d: Math.round(avg(eff7d)),
        nights7d: sleep7d.length,
        nights30d: sleep30d.length,
        scoreTrend,
        bestNight: sleep30d.length > 0
          ? sleep30d.reduce((best, s) => (s.sleepScore > best.sleepScore ? s : best)).date
          : null,
        worstNight: sleep30d.length > 0
          ? sleep30d.reduce((worst, s) => (s.sleepScore < worst.sleepScore ? s : worst)).date
          : null,
      },
      supplementCorrelations,
      sleepHrvCorrelation,
      adherenceByDate,
      currentVault: vault
        ? {
            sleepScore: vault.sleepScore ?? null,
            hrvCurrent: vault.hrvCurrent ?? null,
            hrvTrend: vault.hrvTrend ?? null,
          }
        : null,
    };
  },
});
