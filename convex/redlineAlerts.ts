import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Automated Alert System — Biomarker Threshold Detection
 *
 * Checks incoming biomarker data against personal baselines.
 * If resting HR exceeds baseline +20%, or HRV drops >20% below
 * 7-day rolling average, or sleep score tanks, a persistent
 * "Squad Alert" is written to the squadAlerts table and the
 * squad is notified via squadPings.
 *
 * Thresholds:
 *   - Resting HR: +20% above 7d avg → warning, +35% → critical
 *   - HRV: -20% below 7d avg → warning, -35% → critical
 *   - Sleep score: -20% below 7d avg → warning, -35% → critical
 *   - Recovery: <50 → warning, <35 → critical
 *
 * Squad Readiness:
 *   - If >30% of connected peers have Readiness <60, trigger
 *     a global "Redline Pulse" across all HUDs
 *   - Squad can collectively vote to shift from High Output
 *     to Active Recovery mode
 */

interface ThresholdBreach {
  metric: string;
  currentValue: number;
  baselineValue: number;
  thresholdPercent: number;
  direction: "above" | "below";
  severity: "warning" | "critical";
}

/**
 * checkBiomarkerThresholds — Called when new biomarker data arrives.
 * Evaluates all metrics against personal baselines and creates
 * persistent squadAlerts + broadcasts to squad if breached.
 */
export const checkBiomarkerThresholds = mutation({
  args: {
    sessionId: v.string(),
    peerName: v.optional(v.string()),
    peerAvatar: v.optional(v.string()),
    restingHeartRate: v.optional(v.number()),
    hrv: v.optional(v.number()),
    sleepScore: v.optional(v.number()),
    recoveryScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const breaches: ThresholdBreach[] = [];

    const name = args.peerName ?? "Unknown";
    const avatar = args.peerAvatar ?? "👤";

    // ── 1. Resting Heart Rate: +20% above baseline ──
    if (args.restingHeartRate != null) {
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
        )
        .collect();

      const hrValues = hrvReadings
        .filter((r) => r.heartRate != null && r.heartRate > 0)
        .map((r) => r.heartRate!);

      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentSleepHR = sleepLogs
        .filter((s) => s.loggedAt >= cutoff7d && s.heartRateMin != null)
        .map((s) => s.heartRateMin!);

      const allHR = [...hrValues, ...recentSleepHR];

      if (allHR.length >= 2) {
        const baselineHR = allHR.reduce((s, v) => s + v, 0) / allHR.length;
        if (baselineHR > 0) {
          const pctAbove =
            ((args.restingHeartRate - baselineHR) / baselineHR) * 100;
          if (pctAbove >= 20) {
            breaches.push({
              metric: "resting_hr",
              currentValue: Math.round(args.restingHeartRate),
              baselineValue: Math.round(baselineHR),
              thresholdPercent: Math.round(pctAbove * 10) / 10,
              direction: "above",
              severity: pctAbove >= 35 ? "critical" : "warning",
            });
          }
        }
      }
    }

    // ── 2. HRV: -20% below 7d rolling average ──
    if (args.hrv != null) {
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
        )
        .collect();

      if (hrvReadings.length >= 2) {
        const sorted = hrvReadings.sort((a, b) => a.measuredAt - b.measuredAt);
        const baseline =
          sorted.slice(0, -1).reduce((s, r) => s + r.value, 0) /
          (sorted.length - 1);
        if (baseline > 0) {
          const pctBelow = ((baseline - args.hrv) / baseline) * 100;
          if (pctBelow >= 20) {
            breaches.push({
              metric: "hrv",
              currentValue: Math.round(args.hrv),
              baselineValue: Math.round(baseline),
              thresholdPercent: Math.round(pctBelow * 10) / 10,
              direction: "below",
              severity: pctBelow >= 35 ? "critical" : "warning",
            });
          }
        }
      } else {
        const scores = await ctx.db
          .query("eliteScores")
          .withIndex("by_sessionId", (q) =>
            q.eq("sessionId", args.sessionId)
          )
          .collect();
        const recent = scores
          .filter((s) => s.calculatedAt >= cutoff7d)
          .sort((a, b) => a.calculatedAt - b.calculatedAt);
        if (recent.length >= 2) {
          const baseline =
            recent.slice(0, -1).reduce((s, r) => s + r.currentHrv, 0) /
            (recent.length - 1);
          if (baseline > 0) {
            const pctBelow = ((baseline - args.hrv) / baseline) * 100;
            if (pctBelow >= 20) {
              breaches.push({
                metric: "hrv",
                currentValue: Math.round(args.hrv),
                baselineValue: Math.round(baseline),
                thresholdPercent: Math.round(pctBelow * 10) / 10,
                direction: "below",
                severity: pctBelow >= 35 ? "critical" : "warning",
              });
            }
          }
        }
      }
    }

    // ── 3. Sleep Score: -20% below 7d average ──
    if (args.sleepScore != null) {
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recent = sleepLogs
        .filter((s) => s.loggedAt >= cutoff7d)
        .sort((a, b) => a.loggedAt - b.loggedAt);

      if (recent.length >= 2) {
        const baseline =
          recent.slice(0, -1).reduce((s, r) => s + r.sleepScore, 0) /
          (recent.length - 1);
        if (baseline > 0) {
          const pctBelow =
            ((baseline - args.sleepScore) / baseline) * 100;
          if (pctBelow >= 20) {
            breaches.push({
              metric: "sleep",
              currentValue: Math.round(args.sleepScore),
              baselineValue: Math.round(baseline),
              thresholdPercent: Math.round(pctBelow * 10) / 10,
              direction: "below",
              severity: pctBelow >= 35 ? "critical" : "warning",
            });
          }
        }
      }
    }

    // ── 4. Recovery Score: absolute thresholds ──
    if (args.recoveryScore != null) {
      if (args.recoveryScore < 50) {
        breaches.push({
          metric: "recovery",
          currentValue: Math.round(args.recoveryScore),
          baselineValue: 70,
          thresholdPercent:
            Math.round(((70 - args.recoveryScore) / 70) * 1000) / 10,
          direction: "below",
          severity: args.recoveryScore < 35 ? "critical" : "warning",
        });
      }
    }

    // ── No breaches → resolve any active alerts ──
    if (breaches.length === 0) {
      const activeAlerts = await ctx.db
        .query("squadAlerts")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", args.sessionId)
        )
        .collect();
      for (const alert of activeAlerts) {
        if (alert.status === "active") {
          await ctx.db.patch(alert._id, {
            status: "resolved",
            resolvedAt: now,
          });
        }
      }
      return { breaches: 0, alerts: [], resolved: true };
    }

    // ── Write persistent squad alerts ──
    const alertIds: string[] = [];
    const worstSeverity = breaches.some((b) => b.severity === "critical")
      ? "critical"
      : "warning";

    for (const breach of breaches) {
      const existing = await ctx.db
        .query("squadAlerts")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", args.sessionId)
        )
        .collect();
      const existingForMetric = existing.find(
        (a) => a.metric === breach.metric && a.status === "active"
      );

      if (existingForMetric) {
        await ctx.db.patch(existingForMetric._id, {
          currentValue: breach.currentValue,
          baselineValue: breach.baselineValue,
          thresholdPercent: breach.thresholdPercent,
          severity: breach.severity,
          triggeredAt: now,
        });
        alertIds.push(existingForMetric._id);
      } else {
        const id = await ctx.db.insert("squadAlerts", {
          sessionId: args.sessionId,
          peerName: name,
          peerAvatar: avatar,
          metric: breach.metric,
          currentValue: breach.currentValue,
          baselineValue: breach.baselineValue,
          thresholdPercent: breach.thresholdPercent,
          direction: breach.direction,
          severity: breach.severity,
          status: "active",
          triggeredAt: now,
          notifiedSquad: true,
        });
        alertIds.push(id);
      }
    }

    // ── Broadcast squad ping ──
    const metricSummary = breaches
      .map((b) => {
        const label =
          b.metric === "resting_hr"
            ? "Resting HR"
            : b.metric === "hrv"
              ? "HRV"
              : b.metric === "sleep"
                ? "Sleep"
                : "Recovery";
        const arrow = b.direction === "above" ? "↑" : "↓";
        return `${label} ${arrow}${b.thresholdPercent}%`;
      })
      .join(", ");

    await ctx.db.insert("squadPings", {
      fromSessionId: args.sessionId,
      toSessionId: undefined,
      pingType: "redline_war",
      message: `SQUAD ALERT: ${name} — ${metricSummary}. Threshold breached.`,
      emoji: worstSeverity === "critical" ? "🚨" : "⚠️",
      sentAt: now,
      expiresAt: now + 60 * 60 * 1000,
      dismissed: false,
    });

    // ── Update presence with elevated signals ──
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (presence) {
      await ctx.db.patch(presence._id, {
        heartRate:
          args.restingHeartRate ?? (worstSeverity === "critical" ? 120 : 105),
        hrv: args.hrv ?? presence.hrv,
        auraState: worstSeverity === "critical" ? "redline" : "warning",
      });
    }

    return {
      breaches: breaches.length,
      alerts: breaches,
      worstSeverity,
      alertIds,
      resolved: false,
    };
  },
});

/**
 * getActiveSquadAlerts — Returns all active (unresolved) squad alerts
 * across all members. Used by the UI warning banner.
 */
export const getActiveSquadAlerts = query({
  args: { currentSessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff1h = now - 60 * 60 * 1000;

    const allAlerts = await ctx.db
      .query("squadAlerts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const recent = allAlerts
      .filter((a) => a.triggeredAt >= cutoff1h)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);

    const bySession = new Map<
      string,
      {
        sessionId: string;
        peerName: string;
        peerAvatar: string;
        worstSeverity: string;
        alerts: typeof recent;
        triggeredAt: number;
      }
    >();

    for (const alert of recent) {
      const existing = bySession.get(alert.sessionId);
      if (existing) {
        existing.alerts.push(alert);
        if (
          alert.severity === "critical" &&
          existing.worstSeverity !== "critical"
        ) {
          existing.worstSeverity = "critical";
        }
        if (alert.triggeredAt > existing.triggeredAt) {
          existing.triggeredAt = alert.triggeredAt;
        }
      } else {
        bySession.set(alert.sessionId, {
          sessionId: alert.sessionId,
          peerName: alert.peerName,
          peerAvatar: alert.peerAvatar,
          worstSeverity: alert.severity,
          alerts: [alert],
          triggeredAt: alert.triggeredAt,
        });
      }
    }

    const grouped = Array.from(bySession.values()).sort(
      (a, b) => b.triggeredAt - a.triggeredAt
    );

    return {
      totalActive: recent.length,
      members: grouped,
      hasAnyRedline: recent.length > 0,
      hasCritical: recent.some((a) => a.severity === "critical"),
      checkedAt: now,
    };
  },
});

/**
 * getMyRedlineAlerts — Returns active critical/warning alerts for the current session.
 * Used by the HUD RedlineAlertOverlay to show high-priority alerts with counter-measures.
 */
export const getMyRedlineAlerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff2h = now - 2 * 60 * 60 * 1000;

    const alerts = await ctx.db
      .query("squadAlerts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const active = alerts
      .filter((a) => a.status === "active" && a.triggeredAt >= cutoff2h)
      .sort((a, b) => b.triggeredAt - a.triggeredAt);

    // Enrich with human-readable labels and counter-measure hints
    const enriched = active.map((a) => {
      const metricLabels: Record<string, string> = {
        resting_hr: "Resting Heart Rate",
        hrv: "Heart Rate Variability",
        sleep: "Sleep Score",
        recovery: "Recovery Score",
        glucose: "Blood Glucose",
        crp: "hs-CRP (Inflammation)",
      };
      const metricIcons: Record<string, string> = {
        resting_hr: "💓",
        hrv: "📉",
        sleep: "🌙",
        recovery: "⚡",
        glucose: "🩸",
        crp: "🔥",
      };
      // Local counter-measure fallbacks (used if AI is unavailable)
      const localCounterMeasures: Record<string, string> = {
        resting_hr: "Elevated resting HR detected. Immediate: 5min box breathing (4-4-4-4). Hydrate with electrolytes (sodium 500mg + potassium 200mg). Avoid caffeine for 4h. If persistent >2h, consider magnesium glycinate 400mg.",
        hrv: "HRV suppression indicates autonomic stress. Immediate: 10min parasympathetic activation via cold face immersion or slow nasal breathing at 6 breaths/min. Cancel high-intensity training today. Prioritize 9h sleep tonight.",
        sleep: "Sleep architecture degraded. Tonight: enforce 9pm screen-off, magnesium glycinate 400mg + L-theanine 200mg 30min before bed. Room temp 65-67°F. No caffeine after 12pm. If chronic, assess cortisol rhythm.",
        recovery: "Recovery score critical — sympathetic overdrive detected. Shift to Active Recovery: Zone 2 only (HR <130bpm), cold plunge 2min, ashwagandha 600mg. No HIIT for 48h minimum.",
        glucose: "Glucose excursion detected. Immediate: 15min brisk walk to activate GLUT4 transporters. Next meal: protein-first, fiber-rich, minimal refined carbs. Consider apple cider vinegar 1tbsp pre-meal.",
        crp: "Systemic inflammation elevated. Immediate: omega-3 EPA 2g, cold exposure 2min, eliminate processed foods for 72h. If CRP >3.0, consult physician to rule out acute infection.",
      };

      return {
        _id: a._id,
        metric: a.metric,
        metricLabel: metricLabels[a.metric] || a.metric,
        metricIcon: metricIcons[a.metric] || "⚠️",
        currentValue: a.currentValue,
        baselineValue: a.baselineValue,
        thresholdPercent: a.thresholdPercent,
        direction: a.direction,
        severity: a.severity,
        triggeredAt: a.triggeredAt,
        localCounterMeasure: localCounterMeasures[a.metric] || "Monitor closely and reduce training intensity. Hydrate and prioritize sleep.",
      };
    });

    return {
      alerts: enriched,
      hasCritical: enriched.some((a) => a.severity === "critical"),
      hasWarning: enriched.some((a) => a.severity === "warning"),
      totalActive: enriched.length,
    };
  },
});

/** Dismiss a specific squad alert */
export const dismissSquadAlert = mutation({
  args: { alertId: v.id("squadAlerts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      status: "dismissed",
      resolvedAt: Date.now(),
    });
    return { dismissed: true };
  },
});

/** Resolve all active alerts for a session (e.g. when vitals normalize) */
export const resolveAlertsForSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const active = await ctx.db
      .query("squadAlerts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    let resolved = 0;
    for (const alert of active) {
      if (alert.status === "active") {
        await ctx.db.patch(alert._id, {
          status: "resolved",
          resolvedAt: now,
        });
        resolved++;
      }
    }

    const presence = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (presence) {
      await ctx.db.patch(presence._id, { auraState: "nominal" });
    }

    return { resolved };
  },
});

/**
 * ══════════════════════════════════════════════════════════════
 * ── SQUAD READINESS CALCULATION                             ──
 * ══════════════════════════════════════════════════════════════
 *
 * Scans all connected peers on the FluidCanvas and computes a
 * Readiness Score for each (based on recovery, HRV, sleep).
 * If >30% of peers score below 60, triggers a global "Redline
 * Pulse" across every HUD and recommends Active Recovery mode.
 *
 * Readiness Score formula:
 *   readiness = (recovery * 0.4) + (hrvNormalized * 0.35) + (sleepNormalized * 0.25)
 *   where hrvNormalized = min(100, hrv / 0.8)
 *         sleepNormalized = sleepScore (already 0-100)
 */
export const calculateSquadReadiness = mutation({
  args: { triggeredBy: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff30s = now - 30000;

    // ── 1. Get all active presence entries (online peers) ──
    const allPresence = await ctx.db.query("presence").collect();
    const activePeers = allPresence.filter((p) => p.lastSeen > cutoff30s);

    if (activePeers.length === 0) {
      return {
        totalPeers: 0,
        belowThresholdCount: 0,
        belowThresholdPercent: 0,
        averageReadiness: 100,
        isRedlinePulse: false,
        recommendedMode: "high_output",
      };
    }

    // ── 2. Get peer profiles for recovery/hrv data ──
    const peers = await ctx.db.query("peers").collect();

    // ── 3. Calculate readiness for each active peer ──
    const peerBreakdown: Array<{
      sessionId: string;
      readiness: number;
      recovery: number;
      hrv: number;
      sleepScore: number;
      belowThreshold: boolean;
    }> = [];

    for (const presence of activePeers) {
      // Try to match with peer profile for richer data
      const matchedPeer = peers.find((p) => {
        // Match by presence data — use recovery from peer table
        return true; // We'll use presence data + peer data together
      });

      // Get recovery from presence hrv or peer table
      const presenceHrv = presence.hrv ?? 55;
      const presenceHr = presence.heartRate ?? 68;

      // Estimate recovery from HR + HRV (lower HR + higher HRV = better recovery)
      const hrvNormalized = Math.min(100, (presenceHrv / 80) * 100);
      const hrRecoveryFactor = Math.max(0, Math.min(100, 100 - (presenceHr - 50)));

      // Check for recent sleep data
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", presence.sessionId))
        .collect();
      const latestSleep = sleepLogs
        .sort((a, b) => b.loggedAt - a.loggedAt)[0];
      const sleepScore = latestSleep?.sleepScore ?? 70;

      // Check elite scores for more accurate recovery
      const eliteScores = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", presence.sessionId))
        .collect();
      const latestScore = eliteScores
        .sort((a, b) => b.calculatedAt - a.calculatedAt)[0];

      const recovery = latestScore
        ? Math.min(100, latestScore.score)
        : Math.round(hrRecoveryFactor * 0.5 + hrvNormalized * 0.5);

      // Readiness = weighted composite
      const readiness = Math.round(
        recovery * 0.4 + hrvNormalized * 0.35 + (sleepScore / 100) * 100 * 0.25
      );

      peerBreakdown.push({
        sessionId: presence.sessionId,
        readiness: Math.max(0, Math.min(100, readiness)),
        recovery,
        hrv: presenceHrv,
        sleepScore,
        belowThreshold: readiness < 60,
      });
    }

    // ── 4. Calculate squad-wide metrics ──
    const belowThresholdCount = peerBreakdown.filter((p) => p.belowThreshold).length;
    const totalPeers = peerBreakdown.length;
    const belowThresholdPercent = totalPeers > 0
      ? Math.round((belowThresholdCount / totalPeers) * 100)
      : 0;
    const averageReadiness = totalPeers > 0
      ? Math.round(peerBreakdown.reduce((s, p) => s + p.readiness, 0) / totalPeers)
      : 100;

    // ── 5. Determine if Redline Pulse should trigger ──
    const isRedlinePulse = belowThresholdPercent > 30;
    const recommendedMode = isRedlinePulse ? "active_recovery" : "high_output";

    // ── 6. Write state to DB ──
    // Remove old state entries (keep only latest)
    const oldStates = await ctx.db
      .query("squadReadinessState")
      .withIndex("by_calculatedAt")
      .order("desc")
      .collect();
    // Keep only the 3 most recent
    for (let i = 3; i < oldStates.length; i++) {
      await ctx.db.delete(oldStates[i]._id);
    }

    await ctx.db.insert("squadReadinessState", {
      calculatedAt: now,
      totalPeers,
      belowThresholdCount,
      belowThresholdPercent,
      averageReadiness,
      isRedlinePulse,
      recommendedMode,
      peerBreakdown: JSON.stringify(peerBreakdown),
      triggeredBy: args.triggeredBy,
    });

    // ── 7. If redline pulse triggered, broadcast squad ping ──
    if (isRedlinePulse) {
      // Check if we already sent a redline pulse in the last 10 min
      const recentPings = await ctx.db
        .query("squadPings")
        .withIndex("by_sentAt")
        .order("desc")
        .collect();
      const recentPulse = recentPings.find(
        (p) =>
          p.pingType === "squad_redline_pulse" &&
          p.sentAt > now - 10 * 60 * 1000
      );

      if (!recentPulse) {
        await ctx.db.insert("squadPings", {
          fromSessionId: args.triggeredBy ?? "system",
          toSessionId: undefined,
          pingType: "squad_redline_pulse",
          message: `SQUAD READINESS ALERT: ${belowThresholdPercent}% of squad below threshold (avg readiness: ${averageReadiness}). Consider shifting to Active Recovery.`,
          emoji: "🔴",
          sentAt: now,
          expiresAt: now + 30 * 60 * 1000,
          dismissed: false,
        });
      }
    }

    return {
      totalPeers,
      belowThresholdCount,
      belowThresholdPercent,
      averageReadiness,
      isRedlinePulse,
      recommendedMode,
    };
  },
});

/**
 * getSquadReadinessStatus — Query for UI to subscribe to the
 * latest squad readiness state. Returns the most recent calculation
 * plus current mode vote tally.
 */
export const getSquadReadinessStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get latest readiness state
    const states = await ctx.db
      .query("squadReadinessState")
      .withIndex("by_calculatedAt")
      .order("desc")
      .collect();
    const latest = states[0] ?? null;

    // Only consider state from last 5 minutes as "active"
    const isActive = latest && (now - latest.calculatedAt) < 5 * 60 * 1000;

    // Get current mode votes (last 30 min)
    const cutoff30m = now - 30 * 60 * 1000;
    const allVotes = await ctx.db
      .query("squadModeVotes")
      .withIndex("by_votedAt")
      .order("desc")
      .collect();

    // Deduplicate by sessionId (latest vote wins)
    const voteMap = new Map<string, string>();
    for (const vote of allVotes) {
      if (vote.votedAt < cutoff30m) continue;
      if (!voteMap.has(vote.sessionId)) {
        voteMap.set(vote.sessionId, vote.vote);
      }
    }

    const recoveryVotes = Array.from(voteMap.values()).filter((v) => v === "active_recovery").length;
    const outputVotes = Array.from(voteMap.values()).filter((v) => v === "high_output").length;
    const totalVotes = recoveryVotes + outputVotes;

    // Determine active mode based on majority vote
    const activeMode = recoveryVotes > outputVotes ? "active_recovery" : "high_output";

    // Parse peer breakdown if available
    let peerBreakdown: Array<{
      sessionId: string;
      readiness: number;
      recovery: number;
      hrv: number;
      sleepScore: number;
      belowThreshold: boolean;
    }> = [];
    if (latest?.peerBreakdown) {
      try {
        peerBreakdown = JSON.parse(latest.peerBreakdown);
      } catch {
        peerBreakdown = [];
      }
    }

    return {
      isActive: isActive && latest?.isRedlinePulse === true,
      totalPeers: latest?.totalPeers ?? 0,
      belowThresholdCount: latest?.belowThresholdCount ?? 0,
      belowThresholdPercent: latest?.belowThresholdPercent ?? 0,
      averageReadiness: latest?.averageReadiness ?? 100,
      isRedlinePulse: isActive ? (latest?.isRedlinePulse ?? false) : false,
      recommendedMode: latest?.recommendedMode ?? "high_output",
      calculatedAt: latest?.calculatedAt ?? 0,
      peerBreakdown,
      // Vote tally
      votes: {
        activeRecovery: recoveryVotes,
        highOutput: outputVotes,
        total: totalVotes,
        activeMode,
      },
    };
  },
});

/**
 * castSquadModeVote — Let a peer vote to shift squad mode.
 * Each peer gets one vote (latest wins).
 */
export const castSquadModeVote = mutation({
  args: {
    sessionId: v.string(),
    vote: v.string(), // "high_output" | "active_recovery"
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Upsert: remove old vote from this session
    const existing = await ctx.db
      .query("squadModeVotes")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const old of existing) {
      await ctx.db.delete(old._id);
    }

    const id = await ctx.db.insert("squadModeVotes", {
      sessionId: args.sessionId,
      vote: args.vote,
      votedAt: now,
    });

    return { id, vote: args.vote, votedAt: now };
  },
});
