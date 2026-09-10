import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   READINESS ENGINE — Biomarker-Reactive Protocol Reshuffling
   
   Compares today's Sleep Quality and HRV against 7-day rolling
   averages. If either metric drops below the average, the system
   automatically reshuffles the Daily Protocol list:
   
   • High-Intensity Training → demoted to "Optional"
   • Recovery / NSDR → promoted to top priority
   • Supplements & Nutrition → unchanged (always required)
   
   The readiness score (0-100) drives the reshuffling intensity.
   ═══════════════════════════════════════════════════════════════ */

/* ── Readiness Thresholds ── */
const READINESS_THRESHOLDS = {
  /** Below this readiness score, high-intensity is demoted */
  DEMOTE_INTENSITY: 65,
  /** Below this, recovery becomes URGENT priority */
  URGENT_RECOVERY: 45,
  /** HRV drop % that triggers reshuffling */
  HRV_DROP_TRIGGER: 0.10,
  /** Sleep score drop % that triggers reshuffling */
  SLEEP_DROP_TRIGGER: 0.12,
} as const;

/* ── Protocol priority tiers after reshuffling ── */
type PriorityTier = "critical" | "recommended" | "optional" | "demoted";

/* ── Categories that get demoted when readiness is low ── */
const HIGH_INTENSITY_CATEGORIES = new Set(["training"]);
const HIGH_INTENSITY_NAMES = new Set([
  "resistance training",
  "hiit",
  "high intensity",
  "heavy lifting",
  "sprint",
  "crossfit",
  "zone 5",
  "zone 4",
  "max effort",
  "pr attempt",
  "deadlift",
  "squat heavy",
  "bench press heavy",
]);

/* ── Categories that get promoted when readiness is low ── */
const RECOVERY_CATEGORIES = new Set(["recovery"]);
const RECOVERY_NAMES = new Set([
  "nsdr",
  "yoga nidra",
  "sleep",
  "meditation",
  "breathwork",
  "cold plunge",
  "infrared sauna",
  "stretching",
  "foam rolling",
  "mobility",
  "rest day",
  "gentle yoga",
  "recovery walk",
  "magnesium",
]);

/** Check if a protocol name matches high-intensity patterns */
function isHighIntensity(name: string, category: string): boolean {
  if (HIGH_INTENSITY_CATEGORIES.has(category)) {
    const lower = name.toLowerCase();
    // Zone 2 cardio is NOT high intensity
    if (lower.includes("zone 2") || lower.includes("walk") || lower.includes("yoga")) {
      return false;
    }
    // Resistance training, HIIT, etc. ARE high intensity
    if (lower.includes("resistance") || lower.includes("hiit") || lower.includes("heavy") ||
        lower.includes("sprint") || lower.includes("max") || lower.includes("intense")) {
      return true;
    }
    // Check explicit name matches
    for (const pattern of HIGH_INTENSITY_NAMES) {
      if (lower.includes(pattern)) return true;
    }
    // Default: training category items that aren't explicitly gentle
    return true;
  }
  // Check name patterns even outside training category
  const lower = name.toLowerCase();
  for (const pattern of HIGH_INTENSITY_NAMES) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

/** Check if a protocol is recovery-oriented */
function isRecoveryOriented(name: string, category: string): boolean {
  if (RECOVERY_CATEGORIES.has(category)) return true;
  const lower = name.toLowerCase();
  for (const pattern of RECOVERY_NAMES) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════
   QUERY: getReadinessAdjustedProtocols
   
   Returns the full protocol list reshuffled by morning readiness.
   Each item gets a `priorityTier` and `readinessNote` explaining
   why it was promoted or demoted.
   ═══════════════════════════════════════════════════════════════ */

export const getReadinessAdjustedProtocols = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // ── 1. Gather Sleep Data (7-day) ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const recentSleep = sleepLogs
      .filter((s) => s.loggedAt >= now - 7 * dayMs)
      .sort((a, b) => b.loggedAt - a.loggedAt);

    const todaySleep = recentSleep[0] ?? null;
    const sleepScores7d = recentSleep.map((s) => s.sleepScore);
    const sleepAvg7d = sleepScores7d.length > 1
      ? sleepScores7d.reduce((a, b) => a + b, 0) / sleepScores7d.length
      : sleepScores7d[0] ?? 70;
    const todaySleepScore = todaySleep?.sleepScore ?? sleepAvg7d;
    const sleepDelta = sleepAvg7d > 0 ? (todaySleepScore - sleepAvg7d) / sleepAvg7d : 0;

    // ── 2. Gather HRV Data (7-day) ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", now - 7 * dayMs)
      )
      .collect();

    const hrvValues = hrvReadings
      .sort((a, b) => b.measuredAt - a.measuredAt)
      .map((r) => r.value);

    const latestHrv = hrvValues[0] ?? 0;
    const hrvAvg7d = hrvValues.length > 1
      ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length
      : hrvValues[0] ?? 55;
    const hrvDelta = hrvAvg7d > 0 ? (latestHrv - hrvAvg7d) / hrvAvg7d : 0;

    // ── 3. Compute Readiness Score (0-100) ──
    // Weighted: Sleep 50%, HRV 35%, Sleep Hours 15%
    const sleepScoreNorm = Math.min(100, Math.max(0, todaySleepScore));
    const hrvScoreNorm = latestHrv > 0
      ? Math.min(100, Math.max(0, (latestHrv / 80) * 100))
      : 50;
    const sleepHoursScore = todaySleep
      ? Math.min(100, Math.max(0, (todaySleep.totalHours / 8) * 100))
      : 50;

    const readinessScore = Math.round(
      sleepScoreNorm * 0.50 +
      hrvScoreNorm * 0.35 +
      sleepHoursScore * 0.15
    );

    // ── 4. Determine if reshuffling is needed ──
    const sleepBelowAvg = sleepDelta < -READINESS_THRESHOLDS.SLEEP_DROP_TRIGGER;
    const hrvBelowAvg = hrvDelta < -READINESS_THRESHOLDS.HRV_DROP_TRIGGER;
    const needsReshuffle = sleepBelowAvg || hrvBelowAvg || readinessScore < READINESS_THRESHOLDS.DEMOTE_INTENSITY;
    const isUrgentRecovery = readinessScore < READINESS_THRESHOLDS.URGENT_RECOVERY;

    // ── 5. Build readiness signals for UI ──
    const signals: Array<{
      metric: string;
      current: number;
      average: number;
      delta: number;
      unit: string;
      status: "below" | "at" | "above";
      icon: string;
    }> = [];

    signals.push({
      metric: "Sleep Quality",
      current: Math.round(todaySleepScore),
      average: Math.round(sleepAvg7d),
      delta: Math.round(sleepDelta * 100),
      unit: "/100",
      status: sleepBelowAvg ? "below" : sleepDelta > 0.05 ? "above" : "at",
      icon: "🌙",
    });

    if (latestHrv > 0) {
      signals.push({
        metric: "HRV",
        current: Math.round(latestHrv),
        average: Math.round(hrvAvg7d),
        delta: Math.round(hrvDelta * 100),
        unit: "ms",
        status: hrvBelowAvg ? "below" : hrvDelta > 0.05 ? "above" : "at",
        icon: "💓",
      });
    }

    if (todaySleep) {
      signals.push({
        metric: "Sleep Duration",
        current: Math.round(todaySleep.totalHours * 10) / 10,
        average: Math.round(
          (recentSleep.reduce((s, l) => s + l.totalHours, 0) / Math.max(1, recentSleep.length)) * 10
        ) / 10,
        delta: 0,
        unit: "hrs",
        status: todaySleep.totalHours < 6 ? "below" : todaySleep.totalHours >= 7 ? "above" : "at",
        icon: "⏱️",
      });
    }

    // ── 6. Get protocols and reshuffle ──
    const dateKey = new Date().toISOString().slice(0, 10);

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
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

    // Map timeOfDay to biological windows
    const currentHour = new Date().getHours();
    const windowMap: Record<string, string> = {
      morning: "morning",
      afternoon: "performance",
      evening: "recovery",
      "all-day": currentHour < 12 ? "morning" : currentHour < 18 ? "performance" : "recovery",
    };

    // ── 7. Assign priority tiers and readiness notes ──
    const reshuffledItems = activeProtocols.map((p) => {
      const highIntensity = isHighIntensity(p.name, p.category);
      const recoveryItem = isRecoveryOriented(p.name, p.category);
      const completed = completedIds.has(p._id);
      const windowKey = windowMap[p.timeOfDay] || "performance";

      let priorityTier: PriorityTier = "recommended";
      let readinessNote: string | null = null;
      let adjustedSortOrder = p.sortOrder;
      let promoted = false;
      let demoted = false;

      if (needsReshuffle && !completed) {
        if (highIntensity) {
          // Demote high-intensity training
          priorityTier = isUrgentRecovery ? "demoted" : "optional";
          demoted = true;

          if (sleepBelowAvg && hrvBelowAvg) {
            readinessNote = `Sleep (${Math.round(todaySleepScore)}) and HRV (${Math.round(latestHrv)}ms) both below 7-day avg. High-intensity training increases cortisol load — consider swapping for Zone 2 or active recovery.`;
          } else if (sleepBelowAvg) {
            readinessNote = `Sleep quality ${Math.round(todaySleepScore)}/100 is ${Math.abs(Math.round(sleepDelta * 100))}% below your 7-day average (${Math.round(sleepAvg7d)}). CNS recovery insufficient for peak output — intensity moved to optional.`;
          } else if (hrvBelowAvg) {
            readinessNote = `HRV ${Math.round(latestHrv)}ms is ${Math.abs(Math.round(hrvDelta * 100))}% below your 7-day baseline (${Math.round(hrvAvg7d)}ms). Autonomic stress elevated — high-intensity deferred.`;
          } else {
            readinessNote = `Readiness score ${readinessScore}/100 indicates accumulated fatigue. Intensity moved to optional to prevent overreaching.`;
          }

          // Push to bottom of sort order
          adjustedSortOrder = 900 + p.sortOrder;

        } else if (recoveryItem) {
          // Promote recovery items
          priorityTier = isUrgentRecovery ? "critical" : "recommended";
          promoted = true;

          if (isUrgentRecovery) {
            readinessNote = `⚡ PRIORITY ELEVATED — Readiness at ${readinessScore}/100. Recovery protocols are your highest-leverage action today. Complete these first.`;
          } else {
            readinessNote = `Promoted: biomarkers indicate recovery deficit. This protocol has outsized impact on your trajectory today.`;
          }

          // Pull to top of sort order
          adjustedSortOrder = isUrgentRecovery ? -100 + p.sortOrder : -50 + p.sortOrder;
        }
      }

      return {
        _id: p._id as string,
        name: p.name,
        category: p.category,
        icon: p.icon,
        description: p.description,
        timeOfDay: p.timeOfDay,
        sortOrder: p.sortOrder,
        adjustedSortOrder,
        source: p.source,
        completed,
        completedAt: completions.find((c) => c.protocolItemId === p._id)?.completedAt ?? null,
        windowKey,
        priorityTier,
        readinessNote,
        promoted,
        demoted,
      };
    });

    // Sort by adjusted order (promoted items first, demoted last)
    reshuffledItems.sort((a, b) => a.adjustedSortOrder - b.adjustedSortOrder);

    // ── 8. Group into biological windows (reshuffled) ──
    const windows: Record<string, {
      label: string;
      icon: string;
      timeRange: string;
      accentColor: string;
      items: typeof reshuffledItems;
      hasPromoted: boolean;
      hasDemoted: boolean;
    }> = {
      morning: {
        label: "Morning Activation",
        icon: "☀️",
        timeRange: "5:00 — 11:59",
        accentColor: "#E8976C",
        items: [],
        hasPromoted: false,
        hasDemoted: false,
      },
      performance: {
        label: "Performance Window",
        icon: "⚡",
        timeRange: "12:00 — 17:59",
        accentColor: "#3B82F6",
        items: [],
        hasPromoted: false,
        hasDemoted: false,
      },
      recovery: {
        label: "Recovery Protocol",
        icon: "🌙",
        timeRange: "18:00 — 22:00",
        accentColor: "#7CB68E",
        items: [],
        hasPromoted: false,
        hasDemoted: false,
      },
    };

    for (const item of reshuffledItems) {
      const wk = item.windowKey;
      if (windows[wk]) {
        windows[wk].items.push(item);
        if (item.promoted) windows[wk].hasPromoted = true;
        if (item.demoted) windows[wk].hasDemoted = true;
      }
    }

    // Sort items within each window by adjustedSortOrder
    for (const wk of Object.keys(windows)) {
      windows[wk].items.sort((a, b) => a.adjustedSortOrder - b.adjustedSortOrder);
    }

    // ── 9. Generate readiness summary ──
    let readinessSummary: string;
    let readinessLevel: "peak" | "good" | "moderate" | "low" | "critical";

    if (readinessScore >= 85) {
      readinessLevel = "peak";
      readinessSummary = "All systems nominal. Full intensity cleared.";
    } else if (readinessScore >= 70) {
      readinessLevel = "good";
      readinessSummary = "Readiness adequate. Standard protocol applies.";
    } else if (readinessScore >= 55) {
      readinessLevel = "moderate";
      readinessSummary = "Moderate fatigue detected. High-intensity moved to optional.";
    } else if (readinessScore >= 40) {
      readinessLevel = "low";
      readinessSummary = "Low readiness. Recovery protocols prioritized. Intensity deferred.";
    } else {
      readinessLevel = "critical";
      readinessSummary = "Critical recovery state. All intensity demoted. Recovery is mandatory.";
    }

    const totalItems = reshuffledItems.length;
    const totalDone = reshuffledItems.filter((i) => i.completed).length;
    const promotedCount = reshuffledItems.filter((i) => i.promoted).length;
    const demotedCount = reshuffledItems.filter((i) => i.demoted).length;

    let activeWindow = "morning";
    if (currentHour >= 18) activeWindow = "recovery";
    else if (currentHour >= 12) activeWindow = "performance";

    return {
      readinessScore,
      readinessLevel,
      readinessSummary,
      needsReshuffle,
      isUrgentRecovery,
      signals,
      windows,
      activeWindow,
      totalItems,
      totalDone,
      percentage: totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0,
      promotedCount,
      demotedCount,
      dateKey,
      currentHour,
      sleepData: {
        todayScore: Math.round(todaySleepScore),
        avg7d: Math.round(sleepAvg7d),
        delta: Math.round(sleepDelta * 100),
        belowAvg: sleepBelowAvg,
      },
      hrvData: {
        latest: Math.round(latestHrv),
        avg7d: Math.round(hrvAvg7d),
        delta: Math.round(hrvDelta * 100),
        belowAvg: hrvBelowAvg,
      },
    };
  },
});
