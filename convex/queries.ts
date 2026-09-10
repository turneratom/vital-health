import { query } from "./_generated/server";
import { v } from "convex/values";
import { generateDailyProtocol, generatePrecisionStack } from "./supplementLogic";
import type { PrecisionFocus } from "./supplementLogic";

// List recent protocol logs
export const listProtocolLogs = query({
  args: {},
  handler: async (ctx) => {
    try {
      const logs = await ctx.db.query("protocolLogs").order("desc").take(50);
      return logs ?? [];
    } catch (e) {
      console.error("[listProtocolLogs] Error:", e);
      return [];
    }
  },
});

// List all commitments
export const listCommitments = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("commitments").collect();
  },
});

// Get a single commitment by ID
export const getCommitment = query({
  args: { id: v.id("commitments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all active presence entries (seen in last 30 seconds)
export const listPresence = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30000;
    const all = await ctx.db.query("presence").collect();
    return all.filter((p) => p.lastSeen > cutoff);
  },
});

// Get a single presence by ID
export const getPresence = query({
  args: { id: v.id("presence") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get presence by session ID
export const getPresenceBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Connection health check
export const connectionHealth = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30000;
    const all = await ctx.db.query("presence").collect();
    const active = all.filter((p) => p.lastSeen > cutoff);
    return { status: "connected" as const, activeUsers: active.length, timestamp: Date.now() };
  },
});

// Get user vitals by session ID
export const getUserVitals = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!vitals) return null;
    return {
      age: vitals.age ?? null,
      gender: vitals.gender ?? null,
      weight: vitals.weight ?? null,
      goalWeight: vitals.goalWeight ?? null,
      unit: vitals.unit ?? "lbs",
    };
  },
});

// List all foodLogs
export const listFoodLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("foodLogs").collect();
  },
});

// Get a single foodLog by ID
export const getFoodLog = query({
  args: { id: v.id("foodLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all activityLogs
export const listActivityLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("activityLogs").collect();
  },
});

// Get a single activityLog by ID
export const getActivityLog = query({
  args: { id: v.id("activityLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all peers
export const listPeers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("peers").collect();
  },
});

// Get a single peer by ID
export const getPeer = query({
  args: { id: v.id("peers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all leaderboardUsers
export const listLeaderboardUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("leaderboardUsers").collect();
  },
});

// Get a single leaderboardUser by ID
export const getLeaderboardUser = query({
  args: { id: v.id("leaderboardUsers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all eliteScores
export const listEliteScores = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("eliteScores").collect();
  },
});

// Get Vitality Scores for the last 14 days (this week + last week for comparison)
export const getVitalityScores14d = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const scores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return scores
      .filter((s) => s.calculatedAt >= cutoff)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);
  },
});

// Get a single eliteScore by ID
export const getEliteScore = query({
  args: { id: v.id("eliteScores") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all bioVault
export const listBioVault = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bioVault").collect();
  },
});

// Get a single bioVault by ID
export const getBioVault = query({
  args: { id: v.id("bioVault") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get bioVault by session ID
export const getBioVaultBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Get today's protocol logs for a session
export const getTodayProtocolLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", startOfDay.getTime())
      )
      .collect();
  },
});

// Get today's journal events for a session
export const getTodayJournalEvents = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", startOfDay.getTime())
      )
      .collect();
  },
});

// Get integration connections for a session
export const getIntegrationConnections = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationConnections")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Get device permissions for a session
export const getDevicePermissions = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devicePermissions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Get recent workout logs (last 74 hours) for muscle recovery map — covers full 72h heavy recovery window
export const getRecentWorkoutLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 74 * 60 * 60 * 1000;
    return await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .collect();
  },
});

// Get planned protocols for a specific date
export const getPlannedProtocols = query({
  args: { sessionId: v.string(), dateKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plannedProtocols")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", args.dateKey)
      )
      .collect();
  },
});

// Generate Daily Protocol from Bio-Vault + System Vitals
export const getDailyProtocol = query({
  args: {
    sessionId: v.string(),
    hrv: v.optional(v.number()),
    hrvAvg7d: v.optional(v.number()),
    sleepHours: v.optional(v.number()),
    sleepScore: v.optional(v.number()),
    strain: v.optional(v.number()),
    rhr: v.optional(v.number()),
    recovery: v.optional(v.number()),
    spo2: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...vitals } = args;
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();

    const bioData = vault
      ? {
          vitaminD: vault.vitaminD ?? null,
          testosteroneFree: vault.testosteroneFree ?? null,
          testosteroneTotal: vault.testosteroneTotal ?? null,
          ferritin: vault.ferritin ?? null,
          crp: vault.crp ?? null,
          hba1c: vault.hba1c ?? null,
          mthfrVariant: vault.mthfrVariant,
          apoe4: vault.apoe4,
          caffeineSensitivity: vault.caffeineSensitivity,
          preferredProteins: vault.preferredProteins,
          dietaryRestrictions: vault.dietaryRestrictions,
        }
      : null;

    const hasVitals = Object.values(vitals).some((v) => v !== undefined);
    return generateDailyProtocol(bioData, hasVitals ? vitals : null);
  },
});

// ── Friction-Free Return: Get last activity timestamp across all log types ──
export const getLastActivityTimestamp = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Check most recent food log
    const latestFood = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Check most recent activity log
    const latestActivity = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Check most recent protocol log
    const latestProtocol = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Check most recent journal event
    const latestJournal = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Check most recent workout log
    const latestWorkout = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    const timestamps = [
      latestFood?.loggedAt,
      latestActivity?.loggedAt,
      latestProtocol?.loggedAt,
      latestJournal?.loggedAt,
      latestWorkout?.loggedAt,
    ].filter((t): t is number => t !== undefined && t !== null);

    if (timestamps.length === 0) return null;

    const lastActivity = Math.max(...timestamps);
    const hoursAgo = (Date.now() - lastActivity) / (1000 * 60 * 60);

    return {
      lastActivity,
      hoursAgo: Math.round(hoursAgo * 10) / 10,
      isInactive48h: hoursAgo >= 48,
      daysSinceActive: Math.floor(hoursAgo / 24),
    };
  },
});

// ── Friction-Free Return: Get return context with next recommended action ──
export const getReturnContext = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Check today's logs
    const todayFoodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(20);
    const todayFood = todayFoodLogs.filter((f) => f.loggedAt >= startOfDay.getTime());

    const todayActivityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(20);
    const todayActivity = todayActivityLogs.filter((a) => a.loggedAt >= startOfDay.getTime());

    const todayProtocols = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", startOfDay.getTime())
      )
      .collect();

    // Determine the most relevant next step
    const hour = new Date().getHours();
    let nextStep: { id: string; label: string; detail: string; icon: string; action: string };

    if (todayFood.length === 0) {
      // No food logged today — fuel is always the first priority
      if (hour < 11) {
        nextStep = {
          id: "fuel-morning",
          label: "Protocol Alpha: Morning Fuel",
          detail: "Log your first meal to activate today's tracking matrix",
          icon: "\uD83E\uDD5A",
          action: "food",
        };
      } else if (hour < 15) {
        nextStep = {
          id: "fuel-midday",
          label: "Protocol Alpha: Midday Fuel",
          detail: "Log a meal to calibrate your macro trajectory",
          icon: "\uD83E\uDD57",
          action: "food",
        };
      } else {
        nextStep = {
          id: "fuel-evening",
          label: "Protocol Alpha: Evening Fuel",
          detail: "Log your meal to close today's nutrition window",
          icon: "\uD83C\uDF73",
          action: "food",
        };
      }
    } else if (todayActivity.length === 0) {
      // Food logged but no activity
      nextStep = {
        id: "movement",
        label: "Protocol Bravo: Movement",
        detail: "Log any activity to complete your daily output target",
        icon: "\uD83C\uDFCB\uFE0F",
        action: "activity",
      };
    } else if (todayProtocols.length === 0) {
      // Food + activity logged but no protocol
      nextStep = {
        id: "protocol",
        label: "Protocol Charlie: Daily Stack",
        detail: "Tap through your supplement protocol to lock in full adherence",
        icon: "\uD83D\uDC8A",
        action: "blueprint",
      };
    } else {
      // Everything logged — maintenance mode
      nextStep = {
        id: "maintain",
        label: "All Systems Nominal",
        detail: "Protocols complete. Monitor vitals or review your journal.",
        icon: "\u2705",
        action: "dashboard",
      };
    }

    return {
      todayFoodCount: todayFood.length,
      todayActivityCount: todayActivity.length,
      todayProtocolCount: todayProtocols.length,
      nextStep,
      timestamp: now,
    };
  },
});

// Get today's daily intake answers for a session
export const getTodayIntake = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return await ctx.db
      .query("dailyIntake")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
  },
});

// ── Precision Stack: Generate focus-aware supplement formulation from Bio-Vault ──
export const getPrecisionStack = query({
  args: {
    sessionId: v.string(),
    focus: v.union(v.literal("performance"), v.literal("recovery"), v.literal("longevity")),
  },
  handler: async (ctx, args) => {
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const bioData = vault
      ? {
          vitaminD: vault.vitaminD ?? null,
          testosteroneFree: vault.testosteroneFree ?? null,
          testosteroneTotal: vault.testosteroneTotal ?? null,
          ferritin: vault.ferritin ?? null,
          crp: vault.crp ?? null,
          hba1c: vault.hba1c ?? null,
          mthfrVariant: vault.mthfrVariant,
          apoe4: vault.apoe4,
          caffeineSensitivity: vault.caffeineSensitivity,
          preferredProteins: vault.preferredProteins,
          dietaryRestrictions: vault.dietaryRestrictions,
        }
      : null;

    return generatePrecisionStack(bioData, args.focus as PrecisionFocus);
  },
});

// ── Morning Directives: Get today's cached directives ──
export const getTodayDirectives = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return await ctx.db
      .query("dailyDirectives")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .first();
  },
});

// ── Morning Directives: Get sleep + bio data for directive generation ──
export const getDirectiveContext = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Get Bio-Vault
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Get latest vitality score
    const latestScore = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Get yesterday's workout logs for recovery context
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const recentWorkouts = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", yesterday)
      )
      .collect();

    return {
      vault: vault ? {
        vitaminD: vault.vitaminD ?? null,
        testosteroneFree: vault.testosteroneFree ?? null,
        testosteroneTotal: vault.testosteroneTotal ?? null,
        ferritin: vault.ferritin ?? null,
        crp: vault.crp ?? null,
        hba1c: vault.hba1c ?? null,
        mthfrVariant: vault.mthfrVariant,
        apoe4: vault.apoe4,
        caffeineSensitivity: vault.caffeineSensitivity,
      } : null,
      vitalityScore: latestScore?.score ?? null,
      hrvCurrent: latestScore?.currentHrv ?? null,
      hrvAvg7d: latestScore?.hrvAvg7d ?? null,
      recentWorkoutCount: recentWorkouts.length,
      recentMuscleGroups: recentWorkouts.flatMap(w => w.muscleGroups),
    };
  },
});

// ── Protocol Completions: Get today's checked items for a session ──
export const getTodayCompletions = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
  },
});

// ── Vitality Scores: Get last 14 days for Biological Velocity ──
export const getRecentVitalityScores = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .collect();
    return events
      .filter((e) => e.eventType === "vitality_score" && e.numericValue != null)
      .map((e) => ({ overallScore: e.numericValue as number, calculatedAt: e.loggedAt }));
  },
});

// ── Analytics: Get events by type for a session ──
export const getAnalyticsEvents = query({
  args: { sessionId: v.string(), eventType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyticsEvents")
      .withIndex("by_sessionId_and_eventType", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("eventType", args.eventType)
      )
      .collect();
  },
});

// ── Analytics: Get info click counts grouped by eventKey ──
export const getInfoClickCounts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_sessionId_and_eventType", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("eventType", "info_click")
      )
      .collect();
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.eventKey] = (counts[e.eventKey] || 0) + 1;
    }
    return counts;
  },
});

// ── Analytics: Get plan completion rate ──
export const getPlanCompletionRate = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_sessionId_and_eventType", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("eventType", "plan_completion")
      )
      .collect();
    if (events.length === 0) return { total: 0, completed: 0, rate: 0 };
    const completed = events.filter((e) => e.eventKey === "all_complete").length;
    return { total: events.length, completed, rate: Math.round((completed / events.length) * 100) };
  },
});

// ── Water Intake: Get today's water logs for a session ──
export const getTodayWaterLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const events = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", startOfDay.getTime())
      )
      .collect();
    return events.filter((e) => e.eventType === "water");
  },
});

// ── Food Logs: Get today's food logs for a session ──
export const getTodayFoodLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const all = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);
    return all.filter((f) => f.loggedAt >= startOfDay.getTime());
  },
});

// ── Activity Logs: Get today's activity logs for a session ──
export const getTodayActivityLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const all = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(30);
    return all.filter((a) => a.loggedAt >= startOfDay.getTime());
  },
});

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// Biomarker History — Time-series data for TrendAnalytics charts
// Pulls from journalEvents (biomarker_update events) + bioVault snapshot
// ═══════════════════════════════════════════════════════════════
export const getBiomarkerHistory = query({
  args: { sessionId: v.string(), marker: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lookbackDays = args.days ?? 90;
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

    // Pull all journal events for this marker
    const events = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .collect();

    // Filter to biomarker_update events matching the requested marker
    const markerEvents = events.filter(
      (e) =>
        (e.eventType === "biomarker_update" || e.eventType === "lab_result") &&
        e.eventKey.toLowerCase() === args.marker.toLowerCase() &&
        e.numericValue != null
    );

    // Sort chronologically
    const sorted = markerEvents.sort((a, b) => a.loggedAt - b.loggedAt);

    // Get current vault snapshot for latest value
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Get user vitals for age/sex-aware thresholds
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Map marker key to vault field
    const vaultMap: Record<string, string> = {
      vitamind: "vitaminD",
      vitaminD: "vitaminD",
      testosterone_free: "testosteroneFree",
      testosteronefree: "testosteroneFree",
      testosterone_total: "testosteroneTotal",
      testosteronetotal: "testosteroneTotal",
      ferritin: "ferritin",
      crp: "crp",
      hba1c: "hba1c",
    };

    const vaultKey = vaultMap[args.marker.toLowerCase()] ?? args.marker;
    const currentValue = vault ? (vault as any)[vaultKey] ?? null : null;

    // Build data points
    const dataPoints = sorted.map((e) => ({
      timestamp: e.loggedAt,
      value: e.numericValue!,
      source: e.value || "journal",
    }));

    // If vault has a current value and it's newer than last event, append it
    if (currentValue != null && vault) {
      const lastEventTime = sorted.length > 0 ? sorted[sorted.length - 1].loggedAt : 0;
      if (vault.updatedAt > lastEventTime) {
        dataPoints.push({
          timestamp: vault.updatedAt,
          value: currentValue,
          source: "vault",
        });
      }
    }

    return {
      marker: args.marker,
      dataPoints,
      currentValue,
      age: vitals?.age ?? null,
      gender: vitals?.gender ?? null,
      vaultUpdatedAt: vault?.updatedAt ?? null,
    };
  },
});

// Squad Verifications — Recent habit verifications for toast feed
export const getRecentSquadVerifications = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60 * 60 * 1000; // last hour
    const all = await ctx.db.query("habitVerifications").order("desc").take(50);
    return all.filter((v) => v.verifiedAt > cutoff).slice(0, 10);
  },
});

// System Status — Real-time adherence across user + peers
// ═══════════════════════════════════════════════════════════════

export const getSystemStatus = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // User's protocol adherence
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    const userTotal = activeProtocols.length;
    const userDone = activeProtocols.filter((p) => completedIds.has(p._id)).length;
    const userPct = userTotal > 0 ? Math.round((userDone / userTotal) * 100) : 0;

    // Peer adherence from leaderboard
    const peers = await ctx.db.query("leaderboardUsers").collect();
    const activePeers = peers.filter((p) => !p.isCurrentUser);
    const peerAvgAdherence = activePeers.length > 0
      ? Math.round(activePeers.reduce((sum, p) => sum + p.adherence, 0) / activePeers.length)
      : 0;

    // Category breakdown
    const categories: Record<string, { total: number; done: number }> = {};
    for (const p of activeProtocols) {
      if (!categories[p.category]) categories[p.category] = { total: 0, done: 0 };
      categories[p.category].total++;
      if (completedIds.has(p._id)) categories[p.category].done++;
    }

    // Recent completions (last 3) for activity feed
    const recentCompletions = completions
      .filter((c) => c.completed)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 3)
      .map((c) => {
        const protocol = activeProtocols.find((p) => p._id === c.protocolItemId);
        return {
          name: protocol?.name ?? 'Unknown',
          category: protocol?.category ?? 'supplement',
          completedAt: c.completedAt,
        };
      });

    return {
      user: { total: userTotal, done: userDone, percentage: userPct },
      peerAvgAdherence,
      peerCount: activePeers.length,
      categories,
      recentCompletions,
      dateKey,
      allComplete: userPct === 100 && userTotal > 0,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Briefing Room Context — Last 24h Vitals + Journal snapshot
// Pulls HRV, Sleep, Activity, Food, Water, and Supplements
// for generating Today's Brief (3 high-impact bullet points)
// ═══════════════════════════════════════════════════════════════
export const getBriefingContext = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCutoff = startOfDay.getTime();

    // ── Vitals: Latest elite score (HRV, Recovery, Strain) ──
    const latestScore = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Previous score for comparison (yesterday or earlier)
    const recentScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(5);
    const previousScore = recentScores.length > 1 ? recentScores[1] : null;

    // ── Journal Events: Last 24h (sleep logs, vitality scores, check-ins) ──
    const journalEvents24h = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff24h)
      )
      .collect();

    // Extract sleep-related journal events
    const sleepEvents = journalEvents24h.filter(
      (e) => e.eventType === "sleep" || e.eventKey.toLowerCase().includes("sleep")
    );
    const vitalityEvents = journalEvents24h.filter(
      (e) => e.eventType === "vitality_score"
    );

    // ── Food Logs: Today's intake ──
    const todayFoodAll = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);
    const todayFood = todayFoodAll.filter((f) => f.loggedAt >= todayCutoff);

    const totalCalories = todayFood.reduce((sum, f) => sum + f.calories, 0);
    const totalProtein = todayFood.reduce((sum, f) => sum + f.protein, 0);
    const totalCarbs = todayFood.reduce((sum, f) => sum + f.carbs, 0);
    const totalFat = todayFood.reduce((sum, f) => sum + f.fat, 0);
    const mealCount = todayFood.length;

    // ── Activity Logs: Today's exercise ──
    const todayActivityAll = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(30);
    const todayActivity = todayActivityAll.filter((a) => a.loggedAt >= todayCutoff);

    const totalActivityCalories = todayActivity.reduce((sum, a) => sum + a.calories, 0);
    const totalActivityMinutes = todayActivity.reduce((sum, a) => sum + a.duration, 0);
    const activityCount = todayActivity.length;

    // ── Protocol Logs: Today's supplement adherence ──
    const todayProtocols = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    // ── Workout Logs: Last 24h for recovery context ──
    const recentWorkouts = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff24h)
      )
      .collect();

    // ── Bio-Vault: Biomarker context ──
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // ── Daily Directives: Today's cached directives ──
    const dateKey = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, '0')}-${String(startOfDay.getDate()).padStart(2, '0')}`;
    const directives = await ctx.db
      .query("dailyDirectives")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .first();

    // ── Voice Journal: Last 24h entries ──
    const voiceEntries = await ctx.db
      .query("voiceJournalEntries")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff24h)
      )
      .collect();

    // ── Compute derived insights ──
    const hrvCurrent = latestScore?.currentHrv ?? null;
    const hrvAvg7d = latestScore?.hrvAvg7d ?? null;
    const hrvDelta = (hrvCurrent != null && hrvAvg7d != null && hrvAvg7d > 0)
      ? Math.round(((hrvCurrent - hrvAvg7d) / hrvAvg7d) * 100)
      : null;

    const vitalityScore = latestScore?.score ?? null;
    const previousVitality = previousScore?.score ?? null;
    const vitalityDelta = (vitalityScore != null && previousVitality != null)
      ? vitalityScore - previousVitality
      : null;

    // Protein target (default 160g, can be personalized later)
    const proteinTarget = 160;
    const proteinGap = proteinTarget - totalProtein;

    // Calorie target (default 2400)
    const calorieTarget = 2400;

    return {
      // Vitals snapshot
      vitals: {
        hrvCurrent,
        hrvAvg7d,
        hrvDelta,
        vitalityScore,
        vitalityDelta,
        recovery: latestScore ? Math.round((latestScore.hrvPoints / 25) * 100) : null,
        strain: latestScore?.movementPoints ?? null,
        fuelingPoints: latestScore?.fuelingPoints ?? null,
        movementPoints: latestScore?.movementPoints ?? null,
        hrvPoints: latestScore?.hrvPoints ?? null,
        basePoints: latestScore?.basePoints ?? null,
      },

      // Sleep data from journal events or directives
      sleep: {
        hours: directives?.sleepHours ?? null,
        score: directives?.sleepScore ?? null,
        recovery: directives?.recovery ?? null,
        events: sleepEvents.map((e) => ({
          type: e.eventType,
          key: e.eventKey,
          value: e.value,
          numericValue: e.numericValue,
        })),
      },

      // Nutrition summary
      nutrition: {
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        mealCount,
        calorieTarget,
        proteinTarget,
        proteinGap,
        calorieRemaining: calorieTarget - totalCalories + totalActivityCalories,
      },

      // Activity summary
      activity: {
        totalCaloriesBurned: totalActivityCalories,
        totalMinutes: totalActivityMinutes,
        activityCount,
        activities: todayActivity.map((a) => ({
          name: a.name,
          duration: a.duration,
          calories: a.calories,
          type: a.type,
        })),
      },

      // Supplement adherence
      supplements: {
        completedCount: todayProtocols.length,
        protocols: todayProtocols.map((p) => ({
          name: p.protocolName,
          category: p.category,
        })),
      },

      // Recent workouts for recovery context
      workouts: {
        count: recentWorkouts.length,
        muscleGroups: recentWorkouts.flatMap((w) => w.muscleGroups),
        totalDuration: recentWorkouts.reduce((s, w) => s + w.duration, 0),
      },

      // Bio-Vault flags
      bioFlags: {
        vitaminD: vault?.vitaminD ?? null,
        ferritin: vault?.ferritin ?? null,
        crp: vault?.crp ?? null,
        hba1c: vault?.hba1c ?? null,
        mthfrVariant: vault?.mthfrVariant ?? false,
        apoe4: vault?.apoe4 ?? false,
        caffeineSensitivity: vault?.caffeineSensitivity ?? false,
      },

      // Voice journal mood
      voiceMood: voiceEntries.length > 0
        ? {
            count: voiceEntries.length,
            latestCategory: voiceEntries[voiceEntries.length - 1]?.category ?? null,
            latestSummary: voiceEntries[voiceEntries.length - 1]?.summary ?? null,
          }
        : null,

      // Directives (if already generated today)
      directivesRaw: directives?.directives ?? null,

      // Metadata
      timestamp: now,
      journalEventCount24h: journalEvents24h.length,
    };
  },
});

// ── User Preferences: Get membership tier + settings with graceful fallback ──
// Queries the actual userPreferences table first, then enriches from bioVault.
// Returns a consistent "initialState" object for new users — never throws.
export const getUserPreferences = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // ── 1. Primary source: userPreferences table ──
    let prefs: { userStyle: string; membershipTier?: string; missionProfile?: string } | null = null;
    try {
      prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    } catch {
      // Table may not exist yet in dev — gracefully continue
      prefs = null;
    }

    // ── 2. Enrichment: bioVault for dietary/genetic context ──
    let vault: any = null;
    try {
      vault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    } catch {
      vault = null;
    }

    // ── 3. Enrichment: userVitals for profile completeness ──
    let vitals: any = null;
    try {
      vitals = await ctx.db
        .query("userVitals")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    } catch {
      vitals = null;
    }

    // ── 4. Build consistent response — safe defaults for every field ──
    // New users get a complete "initialState" so the UI never crashes.
    const membershipTier = (prefs != null && prefs.membershipTier) ? prefs.membershipTier : "standard";
    const userStyle = (prefs != null && prefs.userStyle) ? prefs.userStyle : "standard";
    const missionProfile = (prefs != null && prefs.missionProfile) ? prefs.missionProfile : null;

    return {
      sessionId: args.sessionId,
      membershipTier,
      userStyle,
      missionProfile,
      hasPreferences: prefs != null,
      hasBioVault: vault != null,
      hasVitals: vitals != null,
      // Bio-Vault fields — all defensively null-checked
      dietaryRestrictions: vault != null ? (vault.dietaryRestrictions ?? "") : "",
      preferredProteins: vault != null ? (vault.preferredProteins ?? "") : "",
      mthfrVariant: vault != null ? (vault.mthfrVariant ?? false) : false,
      apoe4: vault != null ? (vault.apoe4 ?? false) : false,
      caffeineSensitivity: vault != null ? (vault.caffeineSensitivity ?? false) : false,
      // Vitals summary
      age: vitals != null ? (vitals.age ?? null) : null,
      gender: vitals != null ? (vitals.gender ?? null) : null,
    };
  },
});

// ── Lab Results: Get all biomarker entries for a session ──
export const getLabResults = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  },
});

// ── Lab Results: Get history for a specific marker ──
export const getLabResultsByMarker = query({
  args: { sessionId: v.string(), marker: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("labResults")
      .withIndex("by_sessionId_and_marker", (q) =>
        q.eq("sessionId", args.sessionId).eq("marker", args.marker)
      )
      .order("desc")
      .collect();
  },
});

// ── Lab Results: Get unique marker names for autocomplete ──
export const getUniqueMarkerNames = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const unique = [...new Set(all.map((r) => r.marker))];
    return unique.sort();
  },
});

// ── Daily Energy: 30-day protocol completion + biomarker readiness grid ──
export const getReadinessHeatmapData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
   try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // 1. Protocol completions for the last 30 days
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // 2. Protocol logs for the last 30 days
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", thirtyDaysAgo)
      )
      .collect();

    // 3. Active protocols count (for total denominator)
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocolCount = protocols.filter((p) => p.isActive).length;

    // 4. Adherence scores (pre-computed daily adherence)
    const adherenceScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // 5. Elite scores for readiness overlay
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentScores = eliteScores
      .filter((s) => s.calculatedAt >= thirtyDaysAgo)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // 6. HRV readings for readiness context
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", thirtyDaysAgo)
      )
      .collect();

    // 7. Sleep logs for readiness context
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs.filter((s) => s.loggedAt >= thirtyDaysAgo);

    // Build per-day data for 30 days
    const days: {
      date: string;
      dayOfWeek: number;
      protocolsCompleted: number;
      protocolsTotal: number;
      completionPct: number;
      eliteScore: number;
      avgHrv: number;
      sleepScore: number;
      readinessScore: number;
      hasData: boolean;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
      const dayStart = new Date(dateKey + "T00:00:00Z").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      // Protocol completions for this day
      const dayCompletions = completions.filter((c) => c.dateKey === dateKey);
      const dayLogs = protocolLogs.filter(
        (l) => l.loggedAt >= dayStart && l.loggedAt < dayEnd
      );
      const completed = dayCompletions.filter((c) => c.completed).length + dayLogs.length;

      // Total from adherence or active protocols
      const dayAdherence = adherenceScores.find((a) => a.dateKey === dateKey);
      const total = dayAdherence
        ? dayAdherence.totalProtocols
        : Math.max(completed, activeProtocolCount || 8);
      const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Elite score for this day
      const dayScores = recentScores.filter(
        (s) => s.calculatedAt >= dayStart && s.calculatedAt < dayEnd
      );
      const eliteScore =
        dayScores.length > 0
          ? Math.round(dayScores.reduce((s, e) => s + e.score, 0) / dayScores.length)
          : 0;

      // HRV for this day
      const dayHrv = hrvReadings.filter(
        (r) => r.measuredAt >= dayStart && r.measuredAt < dayEnd
      );
      const avgHrv =
        dayHrv.length > 0
          ? Math.round(dayHrv.reduce((s, r) => s + (r.value || 0), 0) / Math.max(1, dayHrv.length))
          : 0;

      // Sleep score
      const daySleep = recentSleep.filter((s) => s.date === dateKey);
      const sleepScore = daySleep.length > 0 ? Math.round(daySleep[0].sleepScore || 0) : 0;

      // Composite readiness: weighted blend of completion, elite score, HRV, sleep
      const hasAnyData = completed > 0 || eliteScore > 0 || avgHrv > 0 || sleepScore > 0;
      let readinessScore = 0;
      if (hasAnyData) {
        const weights = { completion: 0.4, elite: 0.25, hrv: 0.2, sleep: 0.15 };
        const hrvNorm = avgHrv > 0 ? Math.min(100, Math.round((avgHrv / Math.max(1, 100)) * 100)) : 0;
        readinessScore = Math.round(
          (completionPct || 0) * weights.completion +
          (eliteScore || 0) * weights.elite +
          (hrvNorm || 0) * weights.hrv +
          (sleepScore || 0) * weights.sleep
        );
      }

      days.push({
        date: dateKey,
        dayOfWeek,
        protocolsCompleted: completed,
        protocolsTotal: total,
        completionPct: Math.min(100, completionPct),
        eliteScore,
        avgHrv,
        sleepScore,
        readinessScore: Math.min(100, readinessScore),
        hasData: hasAnyData,
      });
    }

    // Summary stats
    const daysWithData = days.filter((d) => d.hasData);
    const avgReadiness =
      daysWithData.length > 0
        ? Math.round(daysWithData.reduce((s, d) => s + d.readinessScore, 0) / daysWithData.length)
        : 0;
    const avgCompletion =
      daysWithData.length > 0
        ? Math.round(daysWithData.reduce((s, d) => s + d.completionPct, 0) / daysWithData.length)
        : 0;
    const streakDays = (() => {
      let streak = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].completionPct >= 70) streak++;
        else break;
      }
      return streak;
    })();
    const perfectDays = days.filter((d) => d.completionPct === 100).length;

    return {
      days,
      summary: {
        avgReadiness,
        avgCompletion,
        streakDays,
        perfectDays,
        totalDays: 30,
        daysWithData: daysWithData.length,
      },
    };
   } catch (e) {
    console.error("[getReadinessHeatmapData] Error:", e);
    return { days: [], summary: { avgReadiness: 0, avgCompletion: 0, streakDays: 0, perfectDays: 0, totalDays: 30, daysWithData: 0 } };
   }
  },
});

// ── Weekly Recap: 7-day heart rate + protocol compliance chart data ──
export const getWeeklyRecapData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
   try {
    if (!args.sessionId) return { days: [], summary: {} };
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // 1. HRV readings for the last 7 days
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", sevenDaysAgo)
      )
      .collect();

    // 2. Sleep logs for heart rate during sleep
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs.filter((s) => s.loggedAt >= sevenDaysAgo);

    // 3. Protocol completions for the last 7 days
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // 4. Protocol logs for the last 7 days
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", sevenDaysAgo)
      )
      .collect();

    // 5. Elite scores for the last 7 days
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentScores = eliteScores
      .filter((s) => s.calculatedAt >= sevenDaysAgo)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // 6. Adherence scores
    const adherenceScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Build per-day aggregation
    const days: {
      date: string;
      dayLabel: string;
      avgHrv: number;
      avgHeartRate: number;
      sleepScore: number;
      protocolsCompleted: number;
      protocolsTotal: number;
      compliancePct: number;
      eliteScore: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayStart = new Date(dateKey + "T00:00:00Z").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      // HRV for this day
      const dayHrv = hrvReadings.filter(
        (r) => r.measuredAt >= dayStart && r.measuredAt < dayEnd
      );
      const avgHrv =
        dayHrv.length > 0
          ? Math.round(dayHrv.reduce((s, r) => s + r.value, 0) / dayHrv.length)
          : 0;

      // Heart rate from HRV readings or sleep
      const hrFromHrv = dayHrv.filter((r) => r.heartRate != null);
      const daySleep = recentSleep.filter((s) => s.date === dateKey);
      let avgHeartRate = 0;
      if (hrFromHrv.length > 0) {
        avgHeartRate = Math.round(
          hrFromHrv.reduce((s, r) => s + (r.heartRate ?? 0), 0) / hrFromHrv.length
        );
      } else if (daySleep.length > 0 && daySleep[0].heartRateAvg) {
        avgHeartRate = daySleep[0].heartRateAvg;
      }

      // Sleep score
      const sleepScore =
        daySleep.length > 0 ? Math.round(daySleep[0].sleepScore) : 0;

      // Protocol compliance
      const dayCompletions = completions.filter((c) => c.dateKey === dateKey);
      const dayLogs = protocolLogs.filter(
        (l) => l.loggedAt >= dayStart && l.loggedAt < dayEnd
      );
      const protocolsCompleted = dayCompletions.filter((c) => c.completed).length + dayLogs.length;
      // Estimate total from adherence or default
      const dayAdherence = adherenceScores.find((a) => a.dateKey === dateKey);
      const protocolsTotal = dayAdherence
        ? dayAdherence.totalProtocols
        : Math.max(protocolsCompleted, 8);
      const compliancePct =
        protocolsTotal > 0
          ? Math.round((protocolsCompleted / protocolsTotal) * 100)
          : 0;

      // Elite score
      const dayScores = recentScores.filter(
        (s) => s.calculatedAt >= dayStart && s.calculatedAt < dayEnd
      );
      const eliteScore =
        dayScores.length > 0
          ? Math.round(
              dayScores.reduce((s, e) => s + e.score, 0) / dayScores.length
            )
          : 0;

      days.push({
        date: dateKey,
        dayLabel,
        avgHrv,
        avgHeartRate,
        sleepScore,
        protocolsCompleted,
        protocolsTotal,
        compliancePct,
        eliteScore,
      });
    }

    // Weekly summary
    const daysWithHrv = days.filter((d) => d.avgHrv > 0);
    const daysWithHr = days.filter((d) => d.avgHeartRate > 0);
    const daysWithSleep = days.filter((d) => d.sleepScore > 0);
    const daysWithScore = days.filter((d) => d.eliteScore > 0);

    const weekAvgHrv =
      daysWithHrv.length > 0
        ? Math.round(daysWithHrv.reduce((s, d) => s + d.avgHrv, 0) / daysWithHrv.length)
        : 0;
    const weekAvgHr =
      daysWithHr.length > 0
        ? Math.round(daysWithHr.reduce((s, d) => s + d.avgHeartRate, 0) / daysWithHr.length)
        : 0;
    const weekAvgSleep =
      daysWithSleep.length > 0
        ? Math.round(daysWithSleep.reduce((s, d) => s + d.sleepScore, 0) / daysWithSleep.length)
        : 0;
    const weekAvgElite =
      daysWithScore.length > 0
        ? Math.round(daysWithScore.reduce((s, d) => s + d.eliteScore, 0) / daysWithScore.length)
        : 0;
    const weekAvgCompliance =
      days.length > 0
        ? Math.round(days.reduce((s, d) => s + d.compliancePct, 0) / days.length)
        : 0;

    // Redline days (elite score >= 70 or compliance >= 80)
    const daysAboveRedline = days.filter(
      (d) => d.eliteScore >= 70 || d.compliancePct >= 80
    ).length;

    // Badge check
    const weekBadges = await ctx.db
      .query("weeklyBadges")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const thisWeekStart = new Date(now - 6 * 24 * 60 * 60 * 1000);
    const weekKey = `${thisWeekStart.getFullYear()}-W${String(
      Math.ceil(
        (thisWeekStart.getTime() -
          new Date(thisWeekStart.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
    ).padStart(2, "0")}`;
    const currentBadge = weekBadges.find((b) => b.weekKey === weekKey);

    // Recovery objectives
    const objectives = await ctx.db
      .query("recoveryObjectives")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeObjectives = objectives.filter((o) => o.status === "active");

    return {
      days,
      summary: {
        weekAvgHrv,
        weekAvgHr,
        weekAvgSleep,
        weekAvgElite,
        weekAvgCompliance,
        daysAboveRedline,
        totalDays: 7,
        hasData: daysWithHrv.length > 0 || daysWithScore.length > 0,
      },
      badge: currentBadge
        ? { badge: currentBadge.badge, avgScore: currentBadge.avgScore }
        : daysAboveRedline >= 6
          ? { badge: "ELITE_OPERATOR", avgScore: weekAvgElite }
          : null,
      needsRecoveryObjective: daysAboveRedline < 6 && !activeObjectives.length,
      activeObjectives: activeObjectives.map((o) => ({
        objective: o.objective,
        category: o.category,
        status: o.status,
      })),
    };
   } catch (e) {
    console.error("[getWeeklyRecapData] Error:", e);
    return { days: [], summary: {} };
   }
  },
});

// ── Progress Intelligence: 30-day protocol logs ──
export const getProtocolLogs30d = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .collect();
  },
});

// ── Progress Intelligence: 30-day protocol completions ──
export const getProtocolCompletions30d = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const keys: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    const all = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return all.filter((c) => keys.includes(c.dateKey));
  },
});

// ── Intelligence Feed: Get recent lab results for a session ──
export const getRecentLabResults = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);
  },
});

// ── Physical Baseline: Get sex, DOB, height, weight + computed baselines ──
export const getPhysicalBaseline = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    try {
      if (!args.sessionId) return null;
      const result = await ctx.db
        .query("physicalBaseline")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
      return result ?? null;
    } catch (err) {
      console.warn("[getPhysicalBaseline] caught error:", err);
      return null;
    }
  },
});

// ── Bio Timeline: Joined protocolLogs + labResults for correlation timeline ──
export const getBioTimelineData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // 1. Protocol logs (last 90 days)
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", ninetyDaysAgo)
      )
      .collect();

    // 2. Lab results (last 90 days)
    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentLabs = labResults.filter((l) => l.testedAt >= ninetyDaysAgo);

    // 3. Build protocol streaks: group consecutive days per protocolName
    const logsByProtocol: Record<string, number[]> = {};
    for (const log of protocolLogs) {
      const key = log.protocolName;
      if (!logsByProtocol[key]) logsByProtocol[key] = [];
      logsByProtocol[key].push(log.loggedAt);
    }

    const streaks: {
      protocolName: string;
      category: string;
      streakDays: number;
      startDate: number;
      endDate: number;
      logCount: number;
    }[] = [];

    for (const log of protocolLogs) {
      const key = log.protocolName;
      const timestamps = logsByProtocol[key];
      if (!timestamps || timestamps.length === 0) continue;

      // Deduplicate to unique days
      const uniqueDays = [...new Set(timestamps.map((t) => {
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }))].sort();

      if (uniqueDays.length === 0) continue;

      // Find longest consecutive streak
      let maxStreak = 1;
      let currentStreak = 1;
      let streakStartIdx = 0;
      let bestStartIdx = 0;

      for (let i = 1; i < uniqueDays.length; i++) {
        const prev = new Date(uniqueDays[i - 1]).getTime();
        const curr = new Date(uniqueDays[i]).getTime();
        const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            bestStartIdx = streakStartIdx;
          }
        } else {
          currentStreak = 1;
          streakStartIdx = i;
        }
      }

      const startDay = new Date(uniqueDays[bestStartIdx]).getTime();
      const endDay = new Date(uniqueDays[bestStartIdx + maxStreak - 1]).getTime();

      // Only include streaks >= 3 days
      if (maxStreak >= 3) {
        // Avoid duplicates
        if (!streaks.find((s) => s.protocolName === key)) {
          streaks.push({
            protocolName: key,
            category: log.category,
            streakDays: maxStreak,
            startDate: startDay,
            endDate: endDay,
            logCount: timestamps.length,
          });
        }
      }

      // Clear to avoid re-processing
      delete logsByProtocol[key];
    }

    // 4. Build lab biomarker points
    const labPoints = recentLabs.map((l) => ({
      marker: l.marker,
      value: l.value,
      unit: l.unit,
      testedAt: l.testedAt,
      source: l.source,
      notes: l.notes ?? null,
    }));

    // 5. Detect correlations: streak that precedes a positive lab change
    const correlations: {
      protocolName: string;
      marker: string;
      streakDays: number;
      labBefore: number | null;
      labAfter: number;
      delta: number | null;
      isPositive: boolean;
      streakEnd: number;
      labDate: number;
    }[] = [];

    // Map markers to protocol names for correlation detection
    const markerProtocolMap: Record<string, string[]> = {
      "Vitamin D": ["Vitamin D", "Vitamin D3", "D3", "Cholecalciferol"],
      "Testosterone": ["Testosterone", "Ashwagandha", "Tongkat Ali", "Zinc"],
      "ApoB": ["Omega-3", "Fish Oil", "EPA/DHA", "Berberine"],
      "Ferritin": ["Iron", "Ferritin", "Iron Bisglycinate"],
      "CRP": ["Omega-3", "Curcumin", "Turmeric", "Anti-inflammatory"],
      "HbA1c": ["Berberine", "Chromium", "Cinnamon", "Blood Sugar"],
    };

    for (const lab of recentLabs) {
      const relatedProtocols = markerProtocolMap[lab.marker] ?? [lab.marker];
      for (const streak of streaks) {
        const isRelated = relatedProtocols.some(
          (p) => streak.protocolName.toLowerCase().includes(p.toLowerCase())
        );
        if (!isRelated) continue;
        // Streak must end before or around the lab test date
        if (streak.endDate > lab.testedAt + 7 * 24 * 60 * 60 * 1000) continue;

        // Find previous lab result for same marker
        const prevLabs = recentLabs
          .filter((l) => l.marker === lab.marker && l.testedAt < lab.testedAt)
          .sort((a, b) => b.testedAt - a.testedAt);
        const prevLab = prevLabs[0] ?? null;

        const delta = prevLab ? lab.value - prevLab.value : null;
        // Positive = improvement (higher for most markers, lower for CRP/HbA1c)
        const lowerIsBetter = ["CRP", "HbA1c", "ApoB"].includes(lab.marker);
        const isPositive = delta !== null
          ? lowerIsBetter ? delta < 0 : delta > 0
          : true;

        correlations.push({
          protocolName: streak.protocolName,
          marker: lab.marker,
          streakDays: streak.streakDays,
          labBefore: prevLab?.value ?? null,
          labAfter: lab.value,
          delta,
          isPositive,
          streakEnd: streak.endDate,
          labDate: lab.testedAt,
        });
      }
    }

    return {
      streaks: streaks.sort((a, b) => b.streakDays - a.streakDays),
      labPoints: labPoints.sort((a, b) => a.testedAt - b.testedAt),
      correlations: correlations.filter((c) => c.isPositive),
      totalProtocolLogs: protocolLogs.length,
      totalLabResults: recentLabs.length,
    };
  },
});

// ── Bio-Resume: 7-day aggregated longevity + somatic data for export ──
export const getBioResumeData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // 1. Elite scores for the last 7 days
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentScores = eliteScores
      .filter((s) => s.calculatedAt >= sevenDaysAgo)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // 2. HRV readings
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", sevenDaysAgo)
      )
      .collect();

    // 3. Sleep logs
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs.filter((s) => s.loggedAt >= sevenDaysAgo);

    // 4. Protocol completions
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // 5. Somatic check-ins (journal events)
    const journalEvents = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", sevenDaysAgo)
      )
      .collect();
    const somaticEvents = journalEvents.filter(
      (e) => e.eventType === "somatic_checkin" || e.eventType === "body_scan" || e.eventType === "check_in"
    );

    // 6. Bio-Vault snapshot
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // 7. User vitals
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // 8. Lab results (recent)
    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(20);

    // 9. Workout logs
    const workoutLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", sevenDaysAgo)
      )
      .collect();

    // Build per-day aggregation
    const days: {
      date: string;
      dayLabel: string;
      vitalityScore: number;
      avgHrv: number;
      sleepScore: number;
      adherencePct: number;
      workoutMinutes: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayStart = new Date(dateKey + "T00:00:00Z").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayScores = recentScores.filter(
        (s) => s.calculatedAt >= dayStart && s.calculatedAt < dayEnd
      );
      const vitalityScore = dayScores.length > 0
        ? Math.round(dayScores.reduce((s, e) => s + e.score, 0) / dayScores.length)
        : 0;

      const dayHrv = hrvReadings.filter(
        (r) => r.measuredAt >= dayStart && r.measuredAt < dayEnd
      );
      const avgHrv = dayHrv.length > 0
        ? Math.round(dayHrv.reduce((s, r) => s + r.value, 0) / dayHrv.length)
        : 0;

      const daySleep = recentSleep.filter((s) => s.date === dateKey);
      const sleepScore = daySleep.length > 0 ? Math.round(daySleep[0].sleepScore) : 0;

      const dayCompletions = completions.filter((c) => c.dateKey === dateKey);
      const completed = dayCompletions.filter((c) => c.completed).length;
      const total = Math.max(completed, 8);
      const adherencePct = total > 0 ? Math.round((completed / total) * 100) : 0;

      const dayWorkouts = workoutLogs.filter(
        (w) => w.loggedAt >= dayStart && w.loggedAt < dayEnd
      );
      const workoutMinutes = dayWorkouts.reduce((s, w) => s + w.duration, 0);

      days.push({ date: dateKey, dayLabel, vitalityScore, avgHrv, sleepScore, adherencePct, workoutMinutes });
    }

    // Summary stats
    const daysWithScores = days.filter((d) => d.vitalityScore > 0);
    const daysWithHrv = days.filter((d) => d.avgHrv > 0);
    const daysWithSleep = days.filter((d) => d.sleepScore > 0);

    const avgVitality = daysWithScores.length > 0
      ? Math.round(daysWithScores.reduce((s, d) => s + d.vitalityScore, 0) / daysWithScores.length)
      : 0;
    const avgHrv = daysWithHrv.length > 0
      ? Math.round(daysWithHrv.reduce((s, d) => s + d.avgHrv, 0) / daysWithHrv.length)
      : 0;
    const avgSleep = daysWithSleep.length > 0
      ? Math.round(daysWithSleep.reduce((s, d) => s + d.sleepScore, 0) / daysWithSleep.length)
      : 0;
    const avgAdherence = days.length > 0
      ? Math.round(days.reduce((s, d) => s + d.adherencePct, 0) / days.length)
      : 0;
    const totalWorkoutMinutes = days.reduce((s, d) => s + d.workoutMinutes, 0);

    // Trend: compare first 3 days vs last 3 days
    const firstHalf = days.slice(0, 3).filter((d) => d.vitalityScore > 0);
    const secondHalf = days.slice(4).filter((d) => d.vitalityScore > 0);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.vitalityScore, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.vitalityScore, 0) / secondHalf.length : 0;
    const trend: "improving" | "stable" | "declining" = secondAvg > firstAvg + 3 ? "improving" : secondAvg < firstAvg - 3 ? "declining" : "stable";

    // Somatic summary
    const tensionRegions = somaticEvents
      .filter((e) => e.eventKey && e.numericValue != null && (e.numericValue as number) > 3)
      .map((e) => e.eventKey);
    const uniqueTensionRegions = [...new Set(tensionRegions)];

    // Key biomarkers from vault
    const biomarkers: { label: string; value: number | null; unit: string; status: string }[] = [];
    if (vault?.vitaminD != null) biomarkers.push({ label: "Vitamin D", value: vault.vitaminD, unit: "ng/mL", status: vault.vitaminD >= 40 ? "optimal" : vault.vitaminD >= 30 ? "adequate" : "low" });
    if (vault?.crp != null) biomarkers.push({ label: "hs-CRP", value: vault.crp, unit: "mg/L", status: vault.crp <= 1 ? "optimal" : vault.crp <= 3 ? "moderate" : "elevated" });
    if (vault?.hba1c != null) biomarkers.push({ label: "HbA1c", value: vault.hba1c, unit: "%", status: vault.hba1c <= 5.4 ? "optimal" : vault.hba1c <= 5.7 ? "adequate" : "elevated" });
    if (vault?.testosteroneTotal != null) biomarkers.push({ label: "Testosterone", value: vault.testosteroneTotal, unit: "ng/dL", status: vault.testosteroneTotal >= 500 ? "optimal" : vault.testosteroneTotal >= 300 ? "adequate" : "low" });
    if (vault?.ferritin != null) biomarkers.push({ label: "Ferritin", value: vault.ferritin, unit: "ng/mL", status: vault.ferritin >= 40 ? "optimal" : vault.ferritin >= 20 ? "adequate" : "low" });

    // Recent lab results
    const recentLabs = labResults.slice(0, 5).map((l) => ({
      marker: l.marker,
      value: l.value,
      unit: l.unit,
      testedAt: l.testedAt,
    }));

    return {
      days,
      summary: {
        avgVitality,
        avgHrv,
        avgSleep,
        avgAdherence,
        totalWorkoutMinutes,
        trend,
        daysWithData: daysWithScores.length,
        somaticCheckIns: somaticEvents.length,
        tensionRegions: uniqueTensionRegions,
      },
      biomarkers,
      recentLabs,
      profile: {
        age: vitals?.age ?? null,
        gender: vitals?.gender ?? null,
        geneticFlags: {
          mthfr: vault?.mthfrVariant ?? false,
          apoe4: vault?.apoe4 ?? false,
          caffeineSensitive: vault?.caffeineSensitivity ?? false,
        },
      },
      generatedAt: now,
    };
  },
});

// ── Intelligence Feed: Composite bio + lab snapshot ──
export const getIntelligenceFeedData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(30);

    const recentSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(7);

    const recentHrv = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(14);

    return { bioVault, labResults, recentSleep, recentHrv };
  },
});
