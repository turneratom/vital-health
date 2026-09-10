import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// License tier seat limits
const TIER_SEATS: Record<string, number> = {
  free: 5,
  pro: 15,
  elite: 50,
};

// Create a new squad
export const createSquad = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    licenseTier: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const tier = args.licenseTier.toLowerCase();
    const maxSeats = TIER_SEATS[tier] ?? 5;
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const squadId = await ctx.db.insert("squads", {
      name: args.name,
      licenseTier: tier,
      leadUserId: args.sessionId,
      maxSeats,
      inviteCode,
      createdAt: Date.now(),
    });
    // Update leader's profile
    const prefs = await ctx.db.query("userPreferences").withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId)).first();
    if (prefs) {
      await ctx.db.patch(prefs._id, { squadId, displayName: args.displayName });
    } else {
      await ctx.db.insert("userPreferences", {
        sessionId: args.sessionId,
        userStyle: "tactical",
        squadId,
        displayName: args.displayName,
        updatedAt: Date.now(),
      });
    }
    return { squadId, inviteCode };
  },
});

// Join a squad via invite code
export const joinSquad = mutation({
  args: {
    sessionId: v.string(),
    inviteCode: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const squad = await ctx.db.query("squads").withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode.toUpperCase())).first();
    if (!squad) throw new Error("Invalid invite code");
    // Count current members
    const members = await ctx.db.query("userPreferences").withIndex("by_squadId", (q) => q.eq("squadId", squad._id)).collect();
    if (members.length >= squad.maxSeats) throw new Error("Squad is full");
    // Check not already in squad
    const existing = members.find((m) => m.sessionId === args.sessionId);
    if (existing) throw new Error("Already in this squad");
    // Update user prefs
    const prefs = await ctx.db.query("userPreferences").withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId)).first();
    if (prefs) {
      await ctx.db.patch(prefs._id, { squadId: squad._id, displayName: args.displayName });
    } else {
      await ctx.db.insert("userPreferences", {
        sessionId: args.sessionId,
        userStyle: "tactical",
        squadId: squad._id,
        displayName: args.displayName,
        updatedAt: Date.now(),
      });
    }
    return { squadId: squad._id, squadName: squad.name };
  },
});

// Remove a member (lead only)
export const removeSquadMember = mutation({
  args: {
    sessionId: v.string(),
    targetSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db.query("userPreferences").withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId)).first();
    if (!prefs?.squadId) throw new Error("Not in a squad");
    const squad = await ctx.db.get(prefs.squadId);
    if (!squad || squad.leadUserId !== args.sessionId) throw new Error("Not authorized");
    const targetPrefs = await ctx.db.query("userPreferences").withIndex("by_sessionId", (q) => q.eq("sessionId", args.targetSessionId)).first();
    if (targetPrefs) {
      await ctx.db.patch(targetPrefs._id, { squadId: undefined });
    }
    return { removed: args.targetSessionId };
  },
});

// Leave squad
export const leaveSquad = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db.query("userPreferences").withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId)).first();
    if (prefs?.squadId) {
      await ctx.db.patch(prefs._id, { squadId: undefined });
    }
    return { left: true };
  },
});

// Get squad admin data (for lead)
export const getSquadAdminData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db.query("userPreferences").withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId)).first();
    if (!prefs?.squadId) return null;
    const squad = await ctx.db.get(prefs.squadId);
    if (!squad) return null;
    const isLead = squad.leadUserId === args.sessionId;
    // Get all members
    const memberPrefs = await ctx.db.query("userPreferences").withIndex("by_squadId", (q) => q.eq("squadId", squad._id)).collect();
    // Get presence + elite scores for each member
    const members = await Promise.all(
      memberPrefs.map(async (mp) => {
        const presence = await ctx.db.query("presence").withIndex("by_sessionId", (q) => q.eq("sessionId", mp.sessionId)).first();
        const scores = await ctx.db.query("eliteScores").withIndex("by_sessionId", (q) => q.eq("sessionId", mp.sessionId)).collect();
        const latest = scores.sort((a, b) => b.calculatedAt - a.calculatedAt)[0];
        const isOnline = presence ? presence.lastSeen > Date.now() - 30000 : false;
        return {
          sessionId: mp.sessionId,
          displayName: mp.displayName || mp.sessionId.slice(0, 8),
          isLead: mp.sessionId === squad.leadUserId,
          isOnline,
          eliteScore: latest?.score ?? 0,
          lastSeen: presence?.lastSeen ?? 0,
        };
      })
    );
    return {
      squad: {
        id: squad._id,
        name: squad.name,
        licenseTier: squad.licenseTier,
        maxSeats: squad.maxSeats,
        inviteCode: squad.inviteCode,
        createdAt: squad.createdAt,
      },
      isLead,
      members: members.sort((a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0) || b.eliteScore - a.eliteScore),
      seatsUsed: members.length,
      seatsRemaining: squad.maxSeats - members.length,
    };
  },
});
