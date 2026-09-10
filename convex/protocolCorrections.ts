import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL CORRECTION ENGINE
   
   When a user misses a scheduled protocol dose/task, the AI Brain
   generates a 'Correction' notification suggesting an adjusted
   timing window later in the day. Corrections are context-aware:
   they factor in the current hour, remaining biological windows,
   and supplement interaction rules.
   ═══════════════════════════════════════════════════════════════ */

// ── Correction timing rules by category ──
const CORRECTION_RULES: Record<string, {
  maxDelayHours: number;
  canReschedule: boolean;
  alternativeWindows: string[];
  interactionNotes: string;
}> = {
  supplement: {
    maxDelayHours: 8,
    canReschedule: true,
    alternativeWindows: ["with lunch", "with dinner", "before bed"],
    interactionNotes: "Fat-soluble vitamins absorb with any fatty meal. Most supplements are timing-flexible.",
  },
  training: {
    maxDelayHours: 10,
    canReschedule: true,
    alternativeWindows: ["afternoon session", "evening bodyweight", "active recovery walk"],
    interactionNotes: "Shift intensity down if rescheduling past 6pm to avoid cortisol disruption before sleep.",
  },
  biohacking: {
    maxDelayHours: 6,
    canReschedule: true,
    alternativeWindows: ["cold shower finish", "breathwork session", "evening sauna"],
    interactionNotes: "Cold exposure after 8pm may delay sleep onset. Prefer breathwork as late alternative.",
  },
  nutrition: {
    maxDelayHours: 12,
    canReschedule: true,
    alternativeWindows: ["next meal", "protein-forward dinner", "hydration sprint"],
    interactionNotes: "Macro targets can be redistributed across remaining meals.",
  },
  recovery: {
    maxDelayHours: 4,
    canReschedule: true,
    alternativeWindows: ["10-min meditation", "gentle stretching", "early lights-out"],
    interactionNotes: "Recovery protocols are most effective when not rushed. Quality over timing.",
  },
  movement: {
    maxDelayHours: 10,
    canReschedule: true,
    alternativeWindows: ["desk mobility break", "post-dinner walk", "stair climbing"],
    interactionNotes: "Any movement counts. Even 10 minutes triggers beneficial myokine release.",
  },
};

// ── Get missed protocols that need correction notifications ──
export const getMissedProtocols = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const currentHour = now.getHours();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Get active protocols
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);

    // Get today's completions
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    // Map timeOfDay to expected hour ranges
    const TIME_WINDOWS: Record<string, { start: number; end: number }> = {
      morning: { start: 5, end: 11 },
      afternoon: { start: 12, end: 17 },
      evening: { start: 18, end: 22 },
      "all-day": { start: 5, end: 22 },
    };

    // Find protocols that are overdue (past their window) and not completed
    const missed = activeProtocols
      .filter((p) => {
        if (completedIds.has(p._id)) return false;
        const window = TIME_WINDOWS[p.timeOfDay] || TIME_WINDOWS["all-day"];
        // Protocol is missed if current hour is past its window end
        return currentHour > window.end;
      })
      .map((p) => {
        const rules = CORRECTION_RULES[p.category] || CORRECTION_RULES.recovery;
        const window = TIME_WINDOWS[p.timeOfDay] || TIME_WINDOWS["all-day"];
        const hoursOverdue = currentHour - window.end;
        const canStillCorrect = hoursOverdue <= rules.maxDelayHours && currentHour < 23;

        // Pick the best alternative window based on current time
        let suggestedWindow = rules.alternativeWindows[0];
        if (currentHour >= 20) {
          suggestedWindow = rules.alternativeWindows[rules.alternativeWindows.length - 1];
        } else if (currentHour >= 17) {
          suggestedWindow = rules.alternativeWindows[Math.min(1, rules.alternativeWindows.length - 1)];
        }

        return {
          _id: p._id,
          name: p.name,
          icon: p.icon,
          category: p.category,
          description: p.description,
          timeOfDay: p.timeOfDay,
          hoursOverdue,
          canStillCorrect,
          suggestedWindow,
          correctionNote: rules.interactionNotes,
          correctionMessage: canStillCorrect
            ? `Missed ${p.timeOfDay} window. ${suggestedWindow} is still effective — ${rules.interactionNotes.split(".")[0].toLowerCase()}.`
            : `${p.name} window has passed for today. Resume tomorrow at scheduled time.`,
        };
      })
      .filter((p) => p.canStillCorrect); // Only show actionable corrections

    return {
      missed,
      dateKey,
      currentHour,
      totalMissed: missed.length,
    };
  },
});

// ── Accept a correction — reschedule and mark as corrected ──
export const acceptCorrection = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
    correctionWindow: v.string(),
  },
  handler: async (ctx, args) => {
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = Date.now();

    // Log the correction acceptance
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.protocolId as string,
      protocolName: protocol.name,
      category: protocol.category,
      loggedAt: timestamp,
      status: "correction_accepted",
      rescheduledTo: args.correctionWindow,
    });

    // Log journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "protocol_correction",
      eventKey: protocol.name,
      value: `Correction accepted: ${protocol.name} → ${args.correctionWindow}`,
      numericValue: undefined,
      loggedAt: timestamp,
    });

    return {
      protocolName: protocol.name,
      correctionWindow: args.correctionWindow,
      dateKey,
    };
  },
});

// ── Dismiss a correction notification ──
export const dismissCorrection = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.id("protocols"),
  },
  handler: async (ctx, args) => {
    const protocol = await ctx.db.get(args.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    const timestamp = Date.now();

    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.protocolId as string,
      protocolName: protocol.name,
      category: protocol.category,
      loggedAt: timestamp,
      status: "correction_dismissed",
    });

    return { dismissed: true, protocolName: protocol.name };
  },
});
