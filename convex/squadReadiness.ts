import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Squad-Wide Readiness Alert System
 *
 * Computes the average Readiness Score across all active peers on the
 * FluidCanvas. If >30% of peers drop below a readiness of 60, the system
 * triggers a red pulsing vignette across the entire UI and flips the
 * Squad Status badge from "Optimal" → "Critical".
 *
 * Peers can vote to shift the squad into "Active Recovery" or
 * "High Output" mode based on the collective biometric state.
 */

/* ── Thresholds ── */
const READINESS_THRESHOLD = 60;       // Below this = "at risk"
const SQUAD_REDLINE_PERCENT = 30;     // >30% below threshold = squad redline

interface PeerReadiness {
  peerId: string;
  peerName: string;
  peerAvatar: string;
  peerHandle: string;
  recovery: number;
  hrv: number;
  strain: number;
  isBelow: boolean;
}

/**
 * Get the current squad-wide readiness state.
 * Computes in real-time from the peers table — no stale cache.
 */
export const getSquadReadinessState = query({
  args: {},
  handler: async (ctx) => {
    const peers = await ctx.db.query("peers").collect();
    if (peers.length === 0) {
      return {
        status: "optimal" as const,
        averageReadiness: 100,
        totalPeers: 0,
        belowThresholdCount: 0,
        belowThresholdPercent: 0,
        isRedlinePulse: false,
        recommendedMode: "high_output",
        peerBreakdown: [] as PeerReadiness[],
        calculatedAt: Date.now(),
      };
    }

    const breakdown: PeerReadiness[] = peers.map((p) => ({
      peerId: p._id,
      peerName: p.name,
      peerAvatar: p.avatar,
      peerHandle: p.handle,
      recovery: p.recovery,
      hrv: p.hrv,
      strain: p.strain,
      isBelow: p.recovery < READINESS_THRESHOLD,
    }));

    const totalPeers = breakdown.length;
    const belowCount = breakdown.filter((p) => p.isBelow).length;
    const belowPercent = Math.round((belowCount / totalPeers) * 100);
    const avgReadiness = Math.round(
      breakdown.reduce((s, p) => s + p.recovery, 0) / totalPeers
    );

    const isRedline = belowPercent > SQUAD_REDLINE_PERCENT;

    // Determine severity
    const status: "optimal" | "warning" | "critical" =
      belowPercent > 50
        ? "critical"
        : isRedline
          ? "warning"
          : "optimal";

    const recommendedMode =
      isRedline ? "active_recovery" : "high_output";

    return {
      status,
      averageReadiness: avgReadiness,
      totalPeers,
      belowThresholdCount: belowCount,
      belowThresholdPercent: belowPercent,
      isRedlinePulse: isRedline,
      recommendedMode,
      peerBreakdown: breakdown,
      calculatedAt: Date.now(),
    };
  },
});

/**
 * Persist a snapshot of the squad readiness state.
 * Called periodically or when a significant change is detected.
 */
export const recalculateSquadReadiness = mutation({
  args: { triggeredBy: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const peers = await ctx.db.query("peers").collect();
    const now = Date.now();

    if (peers.length === 0) return { persisted: false };

    const breakdown = peers.map((p) => ({
      name: p.name,
      avatar: p.avatar,
      recovery: p.recovery,
      hrv: p.hrv,
      isBelow: p.recovery < READINESS_THRESHOLD,
    }));

    const totalPeers = breakdown.length;
    const belowCount = breakdown.filter((p) => p.isBelow).length;
    const belowPercent = Math.round((belowCount / totalPeers) * 100);
    const avgReadiness = Math.round(
      breakdown.reduce((s, p) => s + p.recovery, 0) / totalPeers
    );
    const isRedline = belowPercent > SQUAD_REDLINE_PERCENT;

    await ctx.db.insert("squadReadinessState", {
      calculatedAt: now,
      totalPeers,
      belowThresholdCount: belowCount,
      belowThresholdPercent: belowPercent,
      averageReadiness: avgReadiness,
      isRedlinePulse: isRedline,
      recommendedMode: isRedline ? "active_recovery" : "high_output",
      peerBreakdown: JSON.stringify(breakdown),
      triggeredBy: args.triggeredBy,
    });

    return { persisted: true, isRedline, avgReadiness, belowPercent };
  },
});

/**
 * Cast a vote for squad mode (high_output or active_recovery).
 * One vote per session — upserts.
 */
export const castSquadModeVote = mutation({
  args: {
    sessionId: v.string(),
    vote: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff1h = now - 60 * 60 * 1000;

    // Check for existing vote from this session in the last hour
    const existing = await ctx.db
      .query("squadModeVotes")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const recentVote = existing.find((v) => v.votedAt > cutoff1h);
    if (recentVote) {
      await ctx.db.patch(recentVote._id, {
        vote: args.vote,
        votedAt: now,
      });
      return { updated: true };
    }

    await ctx.db.insert("squadModeVotes", {
      sessionId: args.sessionId,
      vote: args.vote,
      votedAt: now,
    });
    return { created: true };
  },
});

/**
 * Get current squad mode vote tally (last hour).
 */
export const getSquadModeVotes = query({
  args: {},
  handler: async (ctx) => {
    const cutoff1h = Date.now() - 60 * 60 * 1000;
    const allVotes = await ctx.db
      .query("squadModeVotes")
      .withIndex("by_votedAt")
      .collect();

    const recentVotes = allVotes.filter((v) => v.votedAt > cutoff1h);

    const highOutput = recentVotes.filter((v) => v.vote === "high_output").length;
    const activeRecovery = recentVotes.filter((v) => v.vote === "active_recovery").length;
    const total = recentVotes.length;

    return {
      highOutput,
      activeRecovery,
      total,
      winningMode: activeRecovery >= highOutput ? "active_recovery" : "high_output",
      voters: recentVotes.map((v) => ({ sessionId: v.sessionId, vote: v.vote })),
    };
  },
});
