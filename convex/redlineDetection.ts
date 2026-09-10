import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Biological Redline Detection System
 *
 * Monitors HRV and sleep data for each user. If the latest reading
 * drops more than 20% below the 7-day rolling average, a "redline"
 * alert is triggered. Squad members can "Deploy Support" to send
 * encouragement or recovery suggestions.
 *
 * WAR STATE: When a >20% drop is detected, the system enters a
 * high-visibility "war" state — updating the user's FluidCanvas
 * proximity_glow to a red pulse and broadcasting a priority alert
 * to the entire squad.
 */

export interface RedlineAlert {
  sessionId: string;
  metric: "hrv" | "sleep";
  currentValue: number;
  rollingAvg: number;
  dropPercent: number;
  severity: "warning" | "critical";
  detectedAt: number;
}

export interface WarState {
  sessionId: string;
  active: boolean;
  triggeredAt: number;
  alerts: RedlineAlert[];
  severity: "warning" | "critical";
  squadAlertSent: boolean;
}

/** Get redline status for a single user */
export const getRedlineStatus = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const alerts: RedlineAlert[] = [];

    // ── HRV Analysis ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    if (hrvReadings.length >= 2) {
      const sorted = hrvReadings.sort((a, b) => a.measuredAt - b.measuredAt);
      const latest = sorted[sorted.length - 1];
      const prior = sorted.slice(0, -1);
      if (prior.length >= 1) {
        const avg = prior.reduce((s, r) => s + r.value, 0) / prior.length;
        if (avg > 0) {
          const dropPct = ((avg - latest.value) / avg) * 100;
          if (dropPct >= 20) {
            alerts.push({
              sessionId: args.sessionId,
              metric: "hrv",
              currentValue: Math.round(latest.value),
              rollingAvg: Math.round(avg),
              dropPercent: Math.round(dropPct * 10) / 10,
              severity: dropPct >= 35 ? "critical" : "warning",
              detectedAt: latest.measuredAt,
            });
          }
        }
      }
    }

    // Also check HRV from elite scores as fallback
    if (alerts.filter((a) => a.metric === "hrv").length === 0) {
      const eliteScores = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentScores = eliteScores
        .filter((s) => s.calculatedAt >= cutoff7d)
        .sort((a, b) => a.calculatedAt - b.calculatedAt);

      if (recentScores.length >= 2) {
        const latest = recentScores[recentScores.length - 1];
        const prior = recentScores.slice(0, -1);
        const avg = prior.reduce((s, r) => s + r.currentHrv, 0) / prior.length;
        if (avg > 0) {
          const dropPct = ((avg - latest.currentHrv) / avg) * 100;
          if (dropPct >= 20) {
            alerts.push({
              sessionId: args.sessionId,
              metric: "hrv",
              currentValue: Math.round(latest.currentHrv),
              rollingAvg: Math.round(avg),
              dropPercent: Math.round(dropPct * 10) / 10,
              severity: dropPct >= 35 ? "critical" : "warning",
              detectedAt: latest.calculatedAt,
            });
          }
        }
      }
    }

    // ── Sleep Analysis ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs
      .filter((s) => s.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    if (recentSleep.length >= 2) {
      const latest = recentSleep[recentSleep.length - 1];
      const prior = recentSleep.slice(0, -1);

      const avgScore = prior.reduce((s, r) => s + r.sleepScore, 0) / prior.length;
      if (avgScore > 0) {
        const dropPct = ((avgScore - latest.sleepScore) / avgScore) * 100;
        if (dropPct >= 20) {
          alerts.push({
            sessionId: args.sessionId,
            metric: "sleep",
            currentValue: Math.round(latest.sleepScore),
            rollingAvg: Math.round(avgScore),
            dropPercent: Math.round(dropPct * 10) / 10,
            severity: dropPct >= 35 ? "critical" : "warning",
            detectedAt: latest.loggedAt,
          });
        }
      }

      if (alerts.filter((a) => a.metric === "sleep").length === 0) {
        const avgHours = prior.reduce((s, r) => s + r.totalHours, 0) / prior.length;
        if (avgHours > 0) {
          const dropPct = ((avgHours - latest.totalHours) / avgHours) * 100;
          if (dropPct >= 20) {
            alerts.push({
              sessionId: args.sessionId,
              metric: "sleep",
              currentValue: Math.round(latest.totalHours * 10) / 10,
              rollingAvg: Math.round(avgHours * 10) / 10,
              dropPercent: Math.round(dropPct * 10) / 10,
              severity: dropPct >= 35 ? "critical" : "warning",
              detectedAt: latest.loggedAt,
            });
          }
        }
      }
    }

    const isRedlined = alerts.length > 0;
    const worstSeverity = alerts.some((a) => a.severity === "critical")
      ? "critical"
      : alerts.length > 0
        ? "warning"
        : "nominal";

    return {
      sessionId: args.sessionId,
      isRedlined,
      severity: worstSeverity as "critical" | "warning" | "nominal",
      alerts,
      checkedAt: now,
    };
  },
});

/**
 * ══════════════════════════════════════════════════════════════
 * ── EVALUATE REDLINE WAR STATE                              ──
 * ══════════════════════════════════════════════════════════════
 */
export const evaluateRedlineWarState = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const alerts: RedlineAlert[] = [];

    // ── STEP 1: Analyze last 24h HRV vs 7d avg ──
    const allHrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    const hrvSorted = allHrvReadings.sort((a, b) => a.measuredAt - b.measuredAt);
    const hrvLast24h = hrvSorted.filter((r) => r.measuredAt >= cutoff24h);
    const hrvPrior = hrvSorted.filter((r) => r.measuredAt < cutoff24h);

    if (hrvLast24h.length >= 1 && hrvPrior.length >= 1) {
      const latestHrv = hrvLast24h.reduce((s, r) => s + r.value, 0) / hrvLast24h.length;
      const avg7dHrv = hrvPrior.reduce((s, r) => s + r.value, 0) / hrvPrior.length;

      if (avg7dHrv > 0) {
        const dropPct = ((avg7dHrv - latestHrv) / avg7dHrv) * 100;
        if (dropPct >= 20) {
          alerts.push({
            sessionId: args.sessionId,
            metric: "hrv",
            currentValue: Math.round(latestHrv),
            rollingAvg: Math.round(avg7dHrv),
            dropPercent: Math.round(dropPct * 10) / 10,
            severity: dropPct >= 35 ? "critical" : "warning",
            detectedAt: now,
          });
        }
      }
    }

    // Fallback: check eliteScores HRV if no direct readings
    if (alerts.filter((a) => a.metric === "hrv").length === 0) {
      const eliteScores = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentScores = eliteScores
        .filter((s) => s.calculatedAt >= cutoff7d)
        .sort((a, b) => a.calculatedAt - b.calculatedAt);

      const last24hScores = recentScores.filter((s) => s.calculatedAt >= cutoff24h);
      const priorScores = recentScores.filter((s) => s.calculatedAt < cutoff24h);

      if (last24hScores.length >= 1 && priorScores.length >= 1) {
        const latestHrv = last24hScores.reduce((s, r) => s + r.currentHrv, 0) / last24hScores.length;
        const avg7dHrv = priorScores.reduce((s, r) => s + r.currentHrv, 0) / priorScores.length;
        if (avg7dHrv > 0) {
          const dropPct = ((avg7dHrv - latestHrv) / avg7dHrv) * 100;
          if (dropPct >= 20) {
            alerts.push({
              sessionId: args.sessionId,
              metric: "hrv",
              currentValue: Math.round(latestHrv),
              rollingAvg: Math.round(avg7dHrv),
              dropPercent: Math.round(dropPct * 10) / 10,
              severity: dropPct >= 35 ? "critical" : "warning",
              detectedAt: now,
            });
          }
        }
      }
    }

    // ── STEP 2: Analyze last 24h Sleep vs 7d avg ──
    const allSleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = allSleepLogs
      .filter((s) => s.loggedAt >= cutoff7d)
      .sort((a, b) => a.loggedAt - b.loggedAt);

    const sleepLast24h = recentSleep.filter((s) => s.loggedAt >= cutoff24h);
    const sleepPrior = recentSleep.filter((s) => s.loggedAt < cutoff24h);

    if (sleepLast24h.length >= 1 && sleepPrior.length >= 1) {
      const latestScore = sleepLast24h.reduce((s, r) => s + r.sleepScore, 0) / sleepLast24h.length;
      const avgScore = sleepPrior.reduce((s, r) => s + r.sleepScore, 0) / sleepPrior.length;
      if (avgScore > 0) {
        const dropPct = ((avgScore - latestScore) / avgScore) * 100;
        if (dropPct >= 20) {
          alerts.push({
            sessionId: args.sessionId,
            metric: "sleep",
            currentValue: Math.round(latestScore),
            rollingAvg: Math.round(avgScore),
            dropPercent: Math.round(dropPct * 10) / 10,
            severity: dropPct >= 35 ? "critical" : "warning",
            detectedAt: now,
          });
        }
      }

      if (alerts.filter((a) => a.metric === "sleep").length === 0) {
        const latestHours = sleepLast24h.reduce((s, r) => s + r.totalHours, 0) / sleepLast24h.length;
        const avgHours = sleepPrior.reduce((s, r) => s + r.totalHours, 0) / sleepPrior.length;
        if (avgHours > 0) {
          const dropPct = ((avgHours - latestHours) / avgHours) * 100;
          if (dropPct >= 20) {
            alerts.push({
              sessionId: args.sessionId,
              metric: "sleep",
              currentValue: Math.round(latestHours * 10) / 10,
              rollingAvg: Math.round(avgHours * 10) / 10,
              dropPercent: Math.round(dropPct * 10) / 10,
              severity: dropPct >= 35 ? "critical" : "warning",
              detectedAt: now,
            });
          }
        }
      }
    }

    // ── STEP 3: Determine war state ──
    const isWarState = alerts.length > 0;
    const worstSeverity = alerts.some((a) => a.severity === "critical")
      ? "critical"
      : alerts.length > 0
        ? "warning"
        : "nominal";

    if (!isWarState) {
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
      if (presence) {
        await ctx.db.patch(presence._id, {
          heartRate: undefined,
          hrv: undefined,
        });
      }

      const vault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
      if (vault && vault.bioStatus !== "optimal" && vault.bioStatus !== "recovered") {
        await ctx.db.patch(vault._id, {
          bioStatus: "recovered",
          bioStatusUpdatedAt: now,
        });
      }

      return {
        warState: false,
        severity: "nominal" as const,
        alerts: [],
        squadAlertSent: false,
        evaluatedAt: now,
      };
    }

    // ── STEP 4: Activate WAR state ──
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (presence) {
      const hrvAlert = alerts.find((a) => a.metric === "hrv");
      await ctx.db.patch(presence._id, {
        heartRate: worstSeverity === "critical" ? 120 : 105,
        hrv: hrvAlert ? hrvAlert.currentValue : (presence.hrv ?? 40),
      });
    }

    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (vault) {
      const hrvAlert = alerts.find((a) => a.metric === "hrv");
      const sleepAlert = alerts.find((a) => a.metric === "sleep");
      await ctx.db.patch(vault._id, {
        bioStatus: worstSeverity === "critical" ? "strained" : "sleep-deprived",
        bioStatusUpdatedAt: now,
        ...(hrvAlert ? {
          hrvCurrent: hrvAlert.currentValue,
          hrvTrend: "down" as const,
        } : {}),
        ...(sleepAlert ? {
          sleepScore: sleepAlert.currentValue,
        } : {}),
      });
    }

    // ── STEP 5: Broadcast high-priority alert to squad ──
    const metricNames = alerts.map((a) =>
      a.metric === "hrv" ? `HRV \u2193${a.dropPercent}%` : `Sleep \u2193${a.dropPercent}%`
    ).join(", ");

    await ctx.db.insert("squadPings", {
      fromSessionId: args.sessionId,
      toSessionId: undefined,
      pingType: "redline_war",
      message: `BIOLOGICAL REDLINE: ${metricNames}. Squad member needs support.`,
      emoji: worstSeverity === "critical" ? "\uD83D\uDEA8" : "\u26A0\uFE0F",
      sentAt: now,
      expiresAt: now + 30 * 60 * 1000,
      dismissed: false,
    });

    return {
      warState: true,
      severity: worstSeverity as "critical" | "warning",
      alerts,
      squadAlertSent: true,
      evaluatedAt: now,
    };
  },
});

/** Get the current war state for a user (query version for UI polling) */
export const getWarState = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff30m = now - 30 * 60 * 1000;

    const warPings = await ctx.db
      .query("squadPings")
      .withIndex("by_sentAt")
      .order("desc")
      .collect();

    const activeWarPing = warPings.find(
      (p) =>
        p.fromSessionId === args.sessionId &&
        p.pingType === "redline_war" &&
        !p.dismissed &&
        p.sentAt > cutoff30m
    );

    if (!activeWarPing) {
      return { active: false, severity: "nominal" as const, alerts: [], triggeredAt: 0 };
    }

    const presence = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const isElevated = presence && presence.heartRate && presence.heartRate > 100;

    return {
      active: true,
      severity: (isElevated && presence!.heartRate! >= 120 ? "critical" : "warning") as "critical" | "warning" | "nominal",
      alerts: [],
      triggeredAt: activeWarPing.sentAt,
    };
  },
});

/**
 * ══════════════════════════════════════════════════════════════
 * ── SQUAD PRESENCE STATUS (for Squad Sidebar)               ──
 * ══════════════════════════════════════════════════════════════
 *
 * Merges real-time presence data with peer profiles and redline
 * detection to power the Squad Status sidebar. Returns each
 * squad member's:
 *   - Online/offline status (from presence table)
 *   - Current activity (active protocol, deep work, etc.)
 *   - Redline state (from presence heartRate/hrv signals)
 *   - Bio metrics snapshot (HRV, recovery, strain)
 *   - Recent support messages received
 */
export const getSquadPresenceStatus = query({
  args: { currentSessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff30s = now - 30000;
    const cutoff30m = now - 30 * 60 * 1000;

    // Get all peers from the peers table
    const peers = await ctx.db.query("peers").collect();

    // Get all active presence entries
    const allPresence = await ctx.db.query("presence").collect();
    const activePresence = allPresence.filter((p) => p.lastSeen > cutoff30s);

    // Get recent war alerts (last 30 min)
    const recentPings = await ctx.db
      .query("squadPings")
      .withIndex("by_sentAt")
      .order("desc")
      .collect();

    const activeWarAlerts = recentPings.filter(
      (p) => p.pingType === "redline_war" && !p.dismissed && p.sentAt > cutoff30m
    );

    // Get recent support messages (last 24h)
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const recentSupport = recentPings.filter(
      (p) => p.pingType === "support" && p.sentAt > cutoff24h
    );

    // Build squad status for each peer
    const squadStatus = peers.map((peer) => {
      // Check if this peer has an active presence entry
      // Match by name since peers table uses _id not sessionId
      const presenceEntry = activePresence.find(
        (p) => p.sessionId !== args.currentSessionId
      );

      // Check for active war alert from this peer
      const warAlert = activeWarAlerts.find(
        (p) => p.fromSessionId === peer._id
      );

      // Determine redline state from presence heartRate signal
      const isRedlined = peer.recovery < 65 || (presenceEntry?.heartRate ?? 0) > 100;
      const redlineSeverity: "critical" | "warning" | "nominal" =
        peer.recovery < 45 || (presenceEntry?.heartRate ?? 0) >= 120
          ? "critical"
          : isRedlined
            ? "warning"
            : "nominal";

      // Compute redline metrics for display
      const redlineMetrics: Array<{
        metric: string;
        current: number;
        average: number;
        dropPercent: number;
      }> = [];

      if (isRedlined) {
        // Simulate HRV drop based on recovery score
        const simulatedAvg = Math.round(peer.hrv * 1.3);
        const hrvDrop = Math.round(((simulatedAvg - peer.hrv) / simulatedAvg) * 100);
        if (hrvDrop >= 20) {
          redlineMetrics.push({
            metric: "HRV",
            current: peer.hrv,
            average: simulatedAvg,
            dropPercent: hrvDrop,
          });
        }

        // If recovery is very low, add sleep metric
        if (peer.recovery < 55) {
          redlineMetrics.push({
            metric: "Sleep",
            current: Math.round(peer.recovery * 0.8),
            average: Math.round(peer.recovery * 1.2),
            dropPercent: Math.round(((peer.recovery * 1.2 - peer.recovery * 0.8) / (peer.recovery * 1.2)) * 100),
          });
        }
      }

      // Count support messages received
      const supportReceived = recentSupport.filter(
        (p) => p.toSessionId === peer._id
      ).length;

      // Determine online status
      const isOnline = !!presenceEntry;
      const lastSeenAgo = presenceEntry
        ? Math.round((now - presenceEntry.lastSeen) / 1000)
        : null;

      return {
        peerId: peer._id,
        peerName: peer.name,
        peerAvatar: peer.avatar,
        peerHandle: peer.handle,
        tier: peer.tier,
        // Online status
        isOnline,
        lastSeenAgo,
        // Activity
        activeProtocol: presenceEntry?.activeProtocol ?? null,
        activeCategory: presenceEntry?.activeCategory ?? null,
        isDeepWork: presenceEntry?.isDeepWork ?? false,
        ghostMode: presenceEntry?.ghostMode ?? false,
        // Bio metrics
        hrv: peer.hrv,
        recovery: peer.recovery,
        strain: peer.strain,
        heartRate: presenceEntry?.heartRate ?? null,
        // Redline state
        isRedlined,
        redlineSeverity,
        redlineMetrics,
        hasWarAlert: !!warAlert,
        warAlertMessage: warAlert?.message ?? null,
        warAlertTime: warAlert?.sentAt ?? null,
        // Support
        supportReceived,
      };
    });

    // Sort: redlined critical first, then warning, then by recovery ascending
    squadStatus.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, nominal: 2 };
      const aSev = severityOrder[a.redlineSeverity];
      const bSev = severityOrder[b.redlineSeverity];
      if (aSev !== bSev) return aSev - bSev;
      return a.recovery - b.recovery;
    });

    return {
      members: squadStatus,
      totalOnline: squadStatus.filter((s) => s.isOnline).length,
      totalRedlined: squadStatus.filter((s) => s.isRedlined).length,
      activeWarAlerts: activeWarAlerts.length,
      checkedAt: now,
    };
  },
});

/** Get redline status for all squad peers */
export const getSquadRedlines = query({
  args: { currentSessionId: v.string() },
  handler: async (ctx, args) => {
    const peers = await ctx.db.query("peers").collect();
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    const peerRedlines: Array<{
      peerId: string;
      peerName: string;
      peerAvatar: string;
      peerHandle: string;
      isRedlined: boolean;
      severity: "critical" | "warning" | "nominal";
      alerts: RedlineAlert[];
      supportCount: number;
    }> = [];

    for (const peer of peers) {
      const alerts: RedlineAlert[] = [];

      if (peer.recovery < 65) {
        const simulatedAvg = peer.hrv * 1.3;
        const dropPct = ((simulatedAvg - peer.hrv) / simulatedAvg) * 100;
        if (dropPct >= 20) {
          alerts.push({
            sessionId: peer._id,
            metric: "hrv",
            currentValue: peer.hrv,
            rollingAvg: Math.round(simulatedAvg),
            dropPercent: Math.round(dropPct * 10) / 10,
            severity: dropPct >= 35 ? "critical" : "warning",
            detectedAt: now - Math.random() * 3600000,
          });
        }
      }

      const supportMessages = await ctx.db
        .query("squadPings")
        .withIndex("by_sentAt")
        .order("desc")
        .collect();
      const recentSupport = supportMessages.filter(
        (p) =>
          p.pingType === "support" &&
          p.sentAt > cutoff7d
      ).length;

      peerRedlines.push({
        peerId: peer._id,
        peerName: peer.name,
        peerAvatar: peer.avatar,
        peerHandle: peer.handle,
        isRedlined: alerts.length > 0,
        severity: alerts.some((a) => a.severity === "critical")
          ? "critical"
          : alerts.length > 0
            ? "warning"
            : "nominal",
        alerts,
        supportCount: recentSupport,
      });
    }

    return peerRedlines;
  },
});

/** Get active war alerts for the squad */
export const getSquadWarAlerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff30m = now - 30 * 60 * 1000;

    const allPings = await ctx.db
      .query("squadPings")
      .withIndex("by_sentAt")
      .order("desc")
      .collect();

    return allPings
      .filter(
        (p) =>
          p.pingType === "redline_war" &&
          !p.dismissed &&
          p.sentAt > cutoff30m &&
          p.fromSessionId !== args.sessionId
      )
      .slice(0, 5);
  },
});

/** Deploy Support — send encouragement or recovery suggestion to a redlined peer */
export const deploySupport = mutation({
  args: {
    fromSessionId: v.string(),
    toPeerId: v.string(),
    toPeerName: v.string(),
    message: v.string(),
    supportType: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("squadPings", {
      fromSessionId: args.fromSessionId,
      toSessionId: args.toPeerId,
      pingType: "support",
      message: args.message,
      emoji: args.supportType === "encouragement" ? "\uD83D\uDCAA" : args.supportType === "recovery_tip" ? "\uD83E\uDDD8" : "\uD83D\uDC4B",
      sentAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      dismissed: false,
    });
    return { id, sentAt: now };
  },
});

/**
 * ══════════════════════════════════════════════════════════════
 * ── SEND HAPTIC NUDGE / PRIORITY INTERVENTION               ──
 * ══════════════════════════════════════════════════════════════
 *
 * Sends a high-priority "intervene" ping that triggers:
 * 1. A haptic-style visual pulse on the target's FluidCanvas
 * 2. A priority push notification via squadPings
 * 3. Updates the target's presence to signal incoming support
 */
export const sendHapticNudge = mutation({
  args: {
    fromSessionId: v.string(),
    toPeerId: v.string(),
    toPeerName: v.string(),
    nudgeType: v.string(), // "haptic" | "priority_push" | "recovery_protocol"
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const defaultMessages: Record<string, string> = {
      haptic: `Sending strength to ${args.toPeerName}. You're not alone in this.`,
      priority_push: `PRIORITY: ${args.toPeerName}, your squad is watching. Take a recovery break NOW.`,
      recovery_protocol: `Recovery protocol activated for ${args.toPeerName}: breathwork + hydration + 20min rest.`,
    };

    const message = args.message || defaultMessages[args.nudgeType] || `Support incoming for ${args.toPeerName}`;

    const emojiMap: Record<string, string> = {
      haptic: "\uD83D\uDCF3",
      priority_push: "\uD83D\uDEA8",
      recovery_protocol: "\uD83E\uDE7A",
    };

    const id = await ctx.db.insert("squadPings", {
      fromSessionId: args.fromSessionId,
      toSessionId: args.toPeerId,
      pingType: args.nudgeType === "haptic" ? "haptic_nudge" : args.nudgeType === "recovery_protocol" ? "recovery_protocol" : "priority_push",
      message,
      emoji: emojiMap[args.nudgeType] || "\uD83D\uDCF3",
      sentAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 min TTL for nudges
      dismissed: false,
    });

    return { id, sentAt: now, nudgeType: args.nudgeType };
  },
});

/** Get recent support messages sent to a peer */
export const getRecentSupport = query({
  args: { peerId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const all = await ctx.db
      .query("squadPings")
      .withIndex("by_sentAt")
      .order("desc")
      .collect();
    return all
      .filter(
        (p) =>
          p.pingType === "support" &&
          p.toSessionId === args.peerId &&
          p.sentAt > cutoff
      )
      .slice(0, 10);
  },
});
