import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List all peers
export const listPeers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("peers").collect();
  },
});

// Seed 3 mock peers if none exist
export const seedPeers = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("peers").collect();
    if (existing.length > 0) return existing.length;

    const mockPeers = [
      {
        name: "Kira Voss",
        avatar: "KV",
        handle: "@kiravoss",
        recovery: 94,
        strain: 14.2,
        hrv: 88,
        tier: "apex",
        status: "active",
        lastActive: "2m ago",
      },
      {
        name: "Marcus Chen",
        avatar: "MC",
        handle: "@mchen",
        recovery: 91,
        strain: 13.8,
        hrv: 82,
        tier: "apex",
        status: "active",
        lastActive: "5m ago",
      },
      {
        name: "Aria Nakamura",
        avatar: "AN",
        handle: "@arianaka",
        recovery: 80,
        strain: 11.9,
        hrv: 74,
        tier: "titan",
        status: "resting",
        lastActive: "18m ago",
      },
    ];

    for (const peer of mockPeers) {
      await ctx.db.insert("peers", peer);
    }
    return mockPeers.length;
  },
});

// Nudge a peer — sets nudgedAt timestamp
export const nudgePeer = mutation({
  args: { id: v.id("peers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { nudgedAt: Date.now() });
    return args.id;
  },
});

// ── Squad Pings ──

// Send a tactical ping (broadcast or targeted)
export const sendPing = mutation({
  args: {
    fromSessionId: v.string(),
    toSessionId: v.optional(v.string()),
    pingType: v.string(),
    message: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("squadPings", {
      fromSessionId: args.fromSessionId,
      toSessionId: args.toSessionId,
      pingType: args.pingType,
      message: args.message,
      emoji: args.emoji,
      sentAt: now,
      expiresAt: now + 8000, // 8 second TTL
      dismissed: false,
    });
  },
});

// Get active (non-expired, non-dismissed) pings for a session
export const getActivePings = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const all = await ctx.db.query("squadPings")
      .withIndex("by_sentAt")
      .order("desc")
      .collect();
    return all.filter(
      (p) =>
        !p.dismissed &&
        p.expiresAt > now &&
        p.fromSessionId !== args.sessionId &&
        (p.toSessionId === undefined || p.toSessionId === args.sessionId)
    ).slice(0, 5);
  },
});

// Dismiss a ping
export const dismissPing = mutation({
  args: { id: v.id("squadPings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { dismissed: true });
  },
});

// ── Live Activity Feed: Recent peer protocol completions (last 60s) ──
export const getRecentCompletions = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60000; // last 60 seconds
    const all = await ctx.db
      .query("habitVerifications")
      .order("desc")
      .take(50);
    return all
      .filter((v) => v.verifiedAt > cutoff)
      .map((v) => ({
        sessionId: v.sessionId,
        protocolName: v.protocolName,
        category: v.category,
        verifiedAt: v.verifiedAt,
      }))
      .slice(0, 10);
  },
});

// ── Send a quick "Sync" ping to all active peers ──
export const sendSyncPing = mutation({
  args: {
    fromSessionId: v.string(),
    toSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("squadPings", {
      fromSessionId: args.fromSessionId,
      toSessionId: args.toSessionId,
      pingType: "sync",
      message: "Squad Sync — Stay locked in.",
      emoji: "⚡",
      sentAt: now,
      expiresAt: now + 6000,
      dismissed: false,
    });
  },
});
