import { query } from "./_generated/server";
import { v } from "convex/values";

// Check if a session has completed induction
export const getInductionProfile = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    if (!args.sessionId) return null;
    return await ctx.db
      .query("inductionProfiles")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});
