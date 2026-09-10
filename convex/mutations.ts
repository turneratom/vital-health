import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Seed initial protocol log entries for dashboard preview
export const generateInitialLogs = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("protocolLogs").take(1);
    if (existing.length > 0) return { seeded: false, count: 0 };
    const now = Date.now();
    const seeds = [
      { type: "info", message: "Vive Engine online. Biometric streams nominal.", systemId: "core", offset: 0 },
      { type: "warning", message: "HRV trending below 7-day baseline. Recovery protocol advised.", systemId: "hrv", offset: 1000 * 60 * 12 },
      { type: "info", message: "Morning fueling window acquired. Protein target: 40g.", systemId: "nutrition", offset: 1000 * 60 * 45 },
      { type: "critical", message: "Sleep debt exceeds 90min. Deep work capacity reduced 22%.", systemId: "sleep", offset: 1000 * 60 * 90 },
      { type: "info", message: "Caffeine half-life cleared. Evening wind-down unlocked.", systemId: "caffeine", offset: 1000 * 60 * 180 },
    ];
    for (const s of seeds) {
      const ts = now - s.offset;
      await ctx.db.insert("protocolLogs", {
        sessionId: "system",
        protocolId: s.systemId,
        protocolName: s.message,
        category: s.type,
        loggedAt: ts,
        type: s.type,
        message: s.message,
        systemId: s.systemId,
        timestamp: ts,
      });
    }
    return { seeded: true, count: seeds.length };
  },
});

// Create a 90-day commitment
export const createCommitment = mutation({
  args: {
    sessionId: v.string(),
    foodPlan: v.string(),
    activityPlan: v.string(),
    recoveryPlan: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("commitments", {
      sessionId: args.sessionId,
      committedAt: Date.now(),
      durationDays: 90,
      foodPlan: args.foodPlan,
      activityPlan: args.activityPlan,
      recoveryPlan: args.recoveryPlan,
    });
  },
});

// Update a commitment
export const updateCommitment = mutation({
  args: {
    id: v.id("commitments"),
    sessionId: v.optional(v.string()),
    committedAt: v.optional(v.number()),
    durationDays: v.optional(v.number()),
    foodPlan: v.optional(v.string()),
    activityPlan: v.optional(v.string()),
    recoveryPlan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a commitment
export const deleteCommitment = mutation({
  args: { id: v.id("commitments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Upsert presence - create or update by sessionId
export const upsertPresence = mutation({
  args: {
    sessionId: v.string(),
    x: v.number(),
    y: v.number(),
    ghostMode: v.boolean(),
    color: v.string(),
    lastSeen: v.number(),
    activeProtocol: v.optional(v.string()),
    activeCategory: v.optional(v.string()),
    focusMode: v.optional(v.boolean()),
    heartRate: v.optional(v.number()),
    hrv: v.optional(v.number()),
    isDeepWork: v.optional(v.boolean()),
    protocolPct: v.optional(v.number()),
    behindCritical: v.optional(v.boolean()),
    auraState: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        x: args.x,
        y: args.y,
        ghostMode: args.ghostMode,
        color: args.color,
        lastSeen: args.lastSeen,
        activeProtocol: args.activeProtocol,
        activeCategory: args.activeCategory,
        focusMode: args.focusMode,
        heartRate: args.heartRate,
        hrv: args.hrv,
        isDeepWork: args.isDeepWork,
        // protocolPct and behindCritical removed (not in schema)
        auraState: args.auraState,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("presence", args);
    }
  },
});

// Create a new presence
export const createPresence = mutation({
  args: {
    sessionId: v.string(),
    x: v.number(),
    y: v.number(),
    ghostMode: v.boolean(),
    color: v.string(),
    lastSeen: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("presence", args);
  },
});

// Update a presence
export const updatePresence = mutation({
  args: {
    id: v.id("presence"),
    sessionId: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    ghostMode: v.optional(v.boolean()),
    color: v.optional(v.string()),
    lastSeen: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a presence
export const deletePresence = mutation({
  args: { id: v.id("presence") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Remove stale presence entries (older than 30s)
export const cleanupStale = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30000;
    const all = await ctx.db.query("presence").collect();
    const stale = all.filter((p) => p.lastSeen < cutoff);
    for (const entry of stale) {
      await ctx.db.delete(entry._id);
    }
    return stale.length;
  },
});

// Create a new foodLog
export const createFoodLog = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    source: v.string(),
    loggedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("foodLogs", args);
  },
});

// Update a foodLog
export const updateFoodLog = mutation({
  args: {
    id: v.id("foodLogs"),
    sessionId: v.optional(v.string()),
    name: v.optional(v.string()),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    source: v.optional(v.string()),
    loggedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a foodLog
export const deleteFoodLog = mutation({
  args: { id: v.id("foodLogs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new activityLog
export const createActivityLog = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    duration: v.number(),
    calories: v.number(),
    distance: v.optional(v.number()),
    type: v.string(),
    source: v.string(),
    loggedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLogs", args);
  },
});

// Update an activityLog
export const updateActivityLog = mutation({
  args: {
    id: v.id("activityLogs"),
    sessionId: v.optional(v.string()),
    name: v.optional(v.string()),
    duration: v.optional(v.number()),
    calories: v.optional(v.number()),
    distance: v.optional(v.number()),
    type: v.optional(v.string()),
    source: v.optional(v.string()),
    loggedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete an activityLog
export const deleteActivityLog = mutation({
  args: { id: v.id("activityLogs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new peer
export const createPeer = mutation({
  args: {
    name: v.string(),
    avatar: v.string(),
    handle: v.string(),
    recovery: v.number(),
    strain: v.number(),
    hrv: v.number(),
    tier: v.string(),
    status: v.string(),
    lastActive: v.string(),
    nudgedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("peers", args);
  },
});

// Update a peer
export const updatePeer = mutation({
  args: {
    id: v.id("peers"),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    handle: v.optional(v.string()),
    recovery: v.optional(v.number()),
    strain: v.optional(v.number()),
    hrv: v.optional(v.number()),
    tier: v.optional(v.string()),
    status: v.optional(v.string()),
    lastActive: v.optional(v.string()),
    nudgedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a peer
export const deletePeer = mutation({
  args: { id: v.id("peers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new leaderboardUser
export const createLeaderboardUser = mutation({
  args: {
    name: v.string(),
    handle: v.string(),
    avatar: v.string(),
    adherence: v.number(),
    recovery: v.number(),
    strain: v.number(),
    hrv: v.number(),
    tier: v.string(),
    isCurrentUser: v.boolean(),
    lastUpdated: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("leaderboardUsers", args);
  },
});

// Update a leaderboardUser
export const updateLeaderboardUser = mutation({
  args: {
    id: v.id("leaderboardUsers"),
    name: v.optional(v.string()),
    handle: v.optional(v.string()),
    avatar: v.optional(v.string()),
    adherence: v.optional(v.number()),
    recovery: v.optional(v.number()),
    strain: v.optional(v.number()),
    hrv: v.optional(v.number()),
    tier: v.optional(v.string()),
    isCurrentUser: v.optional(v.boolean()),
    lastUpdated: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a leaderboardUser
export const deleteLeaderboardUser = mutation({
  args: { id: v.id("leaderboardUsers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new eliteScore
export const createEliteScore = mutation({
  args: {
    sessionId: v.string(),
    score: v.number(),
    fuelingPoints: v.number(),
    movementPoints: v.number(),
    hrvPoints: v.number(),
    basePoints: v.number(),
    fuelingCount24h: v.number(),
    movementLogged: v.boolean(),
    currentHrv: v.number(),
    hrvAvg7d: v.number(),
    calculatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("eliteScores", args);
  },
});

// Update an eliteScore
export const updateEliteScore = mutation({
  args: {
    id: v.id("eliteScores"),
    sessionId: v.optional(v.string()),
    score: v.optional(v.number()),
    fuelingPoints: v.optional(v.number()),
    movementPoints: v.optional(v.number()),
    hrvPoints: v.optional(v.number()),
    basePoints: v.optional(v.number()),
    fuelingCount24h: v.optional(v.number()),
    movementLogged: v.optional(v.boolean()),
    currentHrv: v.optional(v.number()),
    hrvAvg7d: v.optional(v.number()),
    calculatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete an eliteScore
export const deleteEliteScore = mutation({
  args: { id: v.id("eliteScores") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new bioVault entry
export const createBioVault = mutation({
  args: {
    sessionId: v.string(),
    vitaminD: v.optional(v.number()),
    testosteroneFree: v.optional(v.number()),
    testosteroneTotal: v.optional(v.number()),
    ferritin: v.optional(v.number()),
    crp: v.optional(v.number()),
    hba1c: v.optional(v.number()),
    mthfrVariant: v.boolean(),
    apoe4: v.boolean(),
    caffeineSensitivity: v.boolean(),
    preferredProteins: v.string(),
    dietaryRestrictions: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bioVault", args);
  },
});

// Update a bioVault entry
export const updateBioVault = mutation({
  args: {
    id: v.id("bioVault"),
    vitaminD: v.optional(v.number()),
    testosteroneFree: v.optional(v.number()),
    testosteroneTotal: v.optional(v.number()),
    ferritin: v.optional(v.number()),
    crp: v.optional(v.number()),
    hba1c: v.optional(v.number()),
    mthfrVariant: v.optional(v.boolean()),
    apoe4: v.optional(v.boolean()),
    caffeineSensitivity: v.optional(v.boolean()),
    preferredProteins: v.optional(v.string()),
    dietaryRestrictions: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a bioVault entry
export const deleteBioVault = mutation({
  args: { id: v.id("bioVault") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a protocol log entry
export const createProtocolLog = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
    loggedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("protocolLogs", args);
  },
});

// Get today's protocol logs for a session
export const getTodayProtocolLogs = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const logs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", startOfDay.getTime())
      )
      .collect();
    return logs;
  },
});

// Create a journal event (protocol toggle, vitality score, etc.)
export const createJournalEvent = mutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    eventKey: v.string(),
    value: v.string(),
    numericValue: v.optional(v.number()),
    loggedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("journalEvents", args);
  },
});

// Get today's journal events for a session
export const getTodayJournalEvents = mutation({
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

// Toggle integration connection (connect/disconnect a provider)
export const toggleIntegrationConnection = mutation({
  args: {
    sessionId: v.string(),
    provider: v.string(),
    connected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationConnections")
      .withIndex("by_sessionId_and_provider", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("provider", args.provider)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        connected: args.connected,
        syncStatus: args.connected ? "syncing" : "disconnected",
        lastSynced: args.connected ? undefined : existing.lastSynced,
        connectedAt: args.connected ? Date.now() : undefined,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("integrationConnections", {
        sessionId: args.sessionId,
        provider: args.provider,
        connected: args.connected,
        syncStatus: args.connected ? "syncing" : "disconnected",
        connectedAt: args.connected ? Date.now() : undefined,
        biometricPoints: args.connected ? 52 : undefined,
      });
    }
  },
});

// Mark integration sync as complete
export const completeIntegrationSync = mutation({
  args: {
    sessionId: v.string(),
    provider: v.string(),
    biometricPoints: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationConnections")
      .withIndex("by_sessionId_and_provider", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("provider", args.provider)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        syncStatus: "synced",
        lastSynced: Date.now(),
        biometricPoints: args.biometricPoints,
      });
      return existing._id;
    }
    return null;
  },
});

// Upsert bioVault - create or update by sessionId
export const upsertBioVault = mutation({
  args: {
    sessionId: v.string(),
    vitaminD: v.optional(v.number()),
    testosteroneFree: v.optional(v.number()),
    testosteroneTotal: v.optional(v.number()),
    ferritin: v.optional(v.number()),
    crp: v.optional(v.number()),
    hba1c: v.optional(v.number()),
    fastingGlucose: v.optional(v.number()),
    igf1: v.optional(v.number()),
    mthfrVariant: v.boolean(),
    apoe4: v.boolean(),
    caffeineSensitivity: v.boolean(),
    preferredProteins: v.string(),
    dietaryRestrictions: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const data = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("bioVault", data);
    }
  },
});

// Upsert user preference (Core vs Elite style)
export const upsertUserPreference = mutation({
  args: {
    sessionId: v.string(),
    userStyle: v.string(),
    missionProfile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userStyle: args.userStyle,
        missionProfile: args.missionProfile,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userPreferences", {
        sessionId: args.sessionId,
        userStyle: args.userStyle,
        missionProfile: args.missionProfile,
        updatedAt: Date.now(),
      });
    }
  },
});

// Upsert user vitals from onboarding
export const upsertUserVitals = mutation({
  args: {
    sessionId: v.string(),
    age: v.number(),
    gender: v.string(),
    weight: v.number(),
    goalWeight: v.optional(v.number()),
    unit: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    const data = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("userVitals", data);
    }
  },
});

// Log a workout with muscle groups for Human Map recovery tracking
export const logWorkout = mutation({
  args: {
    sessionId: v.string(),
    workoutName: v.string(),
    muscleGroups: v.array(v.string()),
    duration: v.number(),
    intensity: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workoutLogs", {
      ...args,
      loggedAt: Date.now(),
    });
  },
});

// Toggle a granular device permission
export const toggleDevicePermission = mutation({
  args: {
    sessionId: v.string(),
    provider: v.string(),
    permission: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("devicePermissions")
      .withIndex("by_sessionId_and_provider", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("provider", args.provider)
      )
      .collect();
    const match = existing.find((p) => p.permission === args.permission);
    if (match) {
      await ctx.db.patch(match._id, {
        enabled: args.enabled,
        updatedAt: Date.now(),
      });
      return match._id;
    } else {
      return await ctx.db.insert("devicePermissions", {
        sessionId: args.sessionId,
        provider: args.provider,
        permission: args.permission,
        enabled: args.enabled,
        updatedAt: Date.now(),
      });
    }
  },
});

// Create a planned protocol for a future date
export const createPlannedProtocol = mutation({
  args: {
    sessionId: v.string(),
    dateKey: v.string(),
    type: v.string(),
    name: v.string(),
    time: v.string(),
    category: v.optional(v.string()),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    duration: v.optional(v.number()),
    activityType: v.optional(v.string()),
    protocolId: v.optional(v.string()),
    items: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("plannedProtocols", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Delete a planned protocol
export const deletePlannedProtocol = mutation({
  args: { id: v.id("plannedProtocols") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Upsert daily intake answer for a protocol card
export const upsertDailyIntake = mutation({
  args: {
    sessionId: v.string(),
    dateKey: v.string(),
    protocol: v.string(),
    answer: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyIntake")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", args.dateKey)
      )
      .collect();
    const match = existing.find((e) => e.protocol === args.protocol);
    if (match) {
      await ctx.db.patch(match._id, {
        answer: args.answer,
        summary: args.summary,
        updatedAt: Date.now(),
      });
      return match._id;
    } else {
      return await ctx.db.insert("dailyIntake", {
        ...args,
        updatedAt: Date.now(),
      });
    }
  },
});

// ── Analytics: Track an event (info icon click, protocol completion, etc.) ──
export const trackAnalyticsEvent = mutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    eventKey: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analyticsEvents", {
      sessionId: args.sessionId,
      eventType: args.eventType,
      eventKey: args.eventKey,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  },
});

// ── Daily Directives: Save generated morning directives ──
export const saveDailyDirectives = mutation({
  args: {
    sessionId: v.string(),
    directives: v.string(),
    sleepHours: v.optional(v.number()),
    sleepScore: v.optional(v.number()),
    recovery: v.optional(v.number()),
    hrv: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const existing = await ctx.db
      .query("dailyDirectives")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        directives: args.directives,
        sleepHours: args.sleepHours,
        sleepScore: args.sleepScore,
        recovery: args.recovery,
        hrv: args.hrv,
        generatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("dailyDirectives", {
      sessionId: args.sessionId,
      dateKey,
      directives: args.directives,
      sleepHours: args.sleepHours,
      sleepScore: args.sleepScore,
      recovery: args.recovery,
      hrv: args.hrv,
      generatedAt: Date.now(),
    });
  },
});

// ── Protocol Completions: Toggle a checklist item for today ──
export const toggleProtocolCompletion = mutation({
  args: {
    sessionId: v.string(),
    protocolItemId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const existing = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const match = existing.find((e) => e.protocolItemId === args.protocolItemId);
    if (match) {
      if (match.completed) {
        await ctx.db.delete(match._id);
        return { completed: false, id: null };
      } else {
        await ctx.db.patch(match._id, { completed: true, completedAt: Date.now() });
        return { completed: true, id: match._id };
      }
    } else {
      const id = await ctx.db.insert("protocolCompletions", {
        sessionId: args.sessionId,
        dateKey,
        protocolItemId: args.protocolItemId,
        completed: true,
        completedAt: Date.now(),
      });
      return { completed: true, id };
    }
  },
});

// ── Induction Profile: Save North Star, sleep goal, supplements ──
export const upsertInductionProfile = mutation({
  args: {
    sessionId: v.string(),
    northStar: v.string(),
    sleepGoalHours: v.number(),
    primarySupplements: v.array(v.string()),
    targetWeight: v.optional(v.number()),
    weightUnit: v.string(),
    accessCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("inductionProfiles")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    const data = { ...args, completedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("inductionProfiles", data);
    }
  },
});

// ── Water Intake: Log water consumption (syncs to Briefing Room) ──
export const logWaterIntake = mutation({
  args: {
    sessionId: v.string(),
    amountMl: v.number(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "water",
      eventKey: "water_intake",
      value: `${args.amountMl}ml water`,
      numericValue: args.amountMl,
      loggedAt: Date.now(),
    });
    return eventId;
  },
});

// ── Quick Meal Log: Log a meal from Journal with full macro breakdown ──
export const logQuickMeal = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
  },
  handler: async (ctx, args) => {
    const foodId = await ctx.db.insert("foodLogs", {
      sessionId: args.sessionId,
      name: args.name,
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat,
      source: "journal",
      loggedAt: Date.now(),
    });
    return foodId;
  },
});

// ── Quick Exercise Log: Log exercise from Journal ──
export const logQuickExercise = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    duration: v.number(),
    calories: v.number(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const activityId = await ctx.db.insert("activityLogs", {
      sessionId: args.sessionId,
      name: args.name,
      duration: args.duration,
      calories: args.calories,
      type: args.type,
      source: "journal",
      loggedAt: Date.now(),
    });
    return activityId;
  },
});

// ── Log protocol completion to logs collection for long-term adherence tracking ──
export const logProtocolCompletionToLogs = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
    completedAt: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.protocolId,
      protocolName: args.protocolName,
      category: args.category,
      loggedAt: args.completedAt,
      status: args.status ?? "completed",
    });
  },
});

// ── Update Membership Tier (Core <-> Elite) ──
export const updateMembershipTier = mutation({
  args: {
    sessionId: v.string(),
    membershipTier: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        membershipTier: args.membershipTier,
        userStyle: args.membershipTier,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userPreferences", {
        sessionId: args.sessionId,
        userStyle: args.membershipTier,
        membershipTier: args.membershipTier,
        updatedAt: Date.now(),
      });
    }
  },
});

// ── Seed Sample Vitals: Insert 7 days of dummy data for dashboard demo ──
export const seedSampleVitals = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sid = args.sessionId;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const rand = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    // 1. Upsert user vitals
    const existingVitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sid))
      .first();
    if (!existingVitals) {
      await ctx.db.insert("userVitals", {
        sessionId: sid,
        age: 34,
        gender: "male",
        weight: 185,
        goalWeight: 175,
        unit: "lbs",
        updatedAt: now,
      });
    }

    // 2. Upsert bio vault
    const existingBio = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sid))
      .first();
    if (!existingBio) {
      await ctx.db.insert("bioVault", {
        sessionId: sid,
        vitaminD: 52,
        testosteroneFree: 18.5,
        testosteroneTotal: 680,
        ferritin: 95,
        crp: 0.4,
        hba1c: 5.1,
        mthfrVariant: false,
        apoe4: false,
        caffeineSensitivity: true,
        preferredProteins: "chicken,salmon,eggs",
        dietaryRestrictions: "none",
        updatedAt: now,
      });
    }

    // 3. Seed 7 days of food logs (3 meals per day)
    const meals = [
      { name: "Protein Oats + Blueberries", calories: 420, protein: 35, carbs: 52, fat: 12 },
      { name: "Grilled Chicken Salad", calories: 550, protein: 48, carbs: 22, fat: 18 },
      { name: "Salmon + Sweet Potato", calories: 620, protein: 42, carbs: 45, fat: 24 },
      { name: "Greek Yogurt Parfait", calories: 320, protein: 28, carbs: 38, fat: 8 },
      { name: "Turkey Wrap + Avocado", calories: 480, protein: 38, carbs: 32, fat: 20 },
      { name: "Steak + Roasted Vegetables", calories: 680, protein: 52, carbs: 28, fat: 30 },
      { name: "Egg White Omelette", calories: 350, protein: 32, carbs: 12, fat: 14 },
    ];
    for (let d = 0; d < 7; d++) {
      const dayOffset = now - d * DAY;
      const dayMeals = [
        meals[d % meals.length],
        meals[(d + 2) % meals.length],
        meals[(d + 4) % meals.length],
      ];
      for (let m = 0; m < 3; m++) {
        const mealTime = dayOffset - (12 - m * 5) * 60 * 60 * 1000;
        await ctx.db.insert("foodLogs", {
          sessionId: sid,
          name: dayMeals[m].name,
          calories: dayMeals[m].calories + rand(-30, 30),
          protein: dayMeals[m].protein + rand(-5, 5),
          carbs: dayMeals[m].carbs + rand(-5, 5),
          fat: dayMeals[m].fat + rand(-3, 3),
          source: "manual",
          loggedAt: mealTime,
        });
      }
    }

    // 4. Seed 7 days of activity logs
    const activities = [
      { name: "Morning Run", duration: 35, calories: 380, type: "cardio", distance: 5.2 },
      { name: "Strength Training", duration: 55, calories: 420, type: "strength", distance: undefined },
      { name: "HIIT Session", duration: 25, calories: 310, type: "hiit", distance: undefined },
      { name: "Zone 2 Cycling", duration: 45, calories: 350, type: "cardio", distance: 18.5 },
      { name: "Yoga Flow", duration: 40, calories: 180, type: "flexibility", distance: undefined },
      { name: "Swimming Laps", duration: 30, calories: 290, type: "cardio", distance: 1.5 },
      { name: "Deadlift + Squats", duration: 50, calories: 450, type: "strength", distance: undefined },
    ];
    for (let d = 0; d < 7; d++) {
      const act = activities[d % activities.length];
      await ctx.db.insert("activityLogs", {
        sessionId: sid,
        name: act.name,
        duration: act.duration + rand(-5, 5),
        calories: act.calories + rand(-20, 20),
        distance: act.distance,
        type: act.type,
        source: "manual",
        loggedAt: now - d * DAY - rand(2, 8) * 60 * 60 * 1000,
      });
    }

    // 5. Seed 7 days of workout logs (for Human Map recovery)
    const workouts = [
      { name: "Push Day", muscleGroups: ["chest", "shoulders", "triceps"], intensity: "high" },
      { name: "Pull Day", muscleGroups: ["back", "biceps", "forearms"], intensity: "high" },
      { name: "Leg Day", muscleGroups: ["quads", "hamstrings", "glutes", "calves"], intensity: "high" },
      { name: "Core + Cardio", muscleGroups: ["abs", "obliques"], intensity: "medium" },
      { name: "Upper Body", muscleGroups: ["chest", "back", "shoulders"], intensity: "medium" },
      { name: "Full Body HIIT", muscleGroups: ["quads", "chest", "abs", "shoulders"], intensity: "high" },
      { name: "Active Recovery", muscleGroups: ["hamstrings", "back"], intensity: "low" },
    ];
    for (let d = 0; d < 7; d++) {
      const w = workouts[d % workouts.length];
      await ctx.db.insert("workoutLogs", {
        sessionId: sid,
        workoutName: w.name,
        muscleGroups: w.muscleGroups,
        duration: rand(30, 60),
        intensity: w.intensity,
        loggedAt: now - d * DAY - rand(3, 10) * 60 * 60 * 1000,
      });
    }

    // 6. Seed 7 days of elite scores (drives the gauge)
    for (let d = 0; d < 7; d++) {
      const baseScore = 78 + rand(-8, 12);
      await ctx.db.insert("eliteScores", {
        sessionId: sid,
        score: Math.min(baseScore, 100),
        fuelingPoints: rand(20, 30),
        movementPoints: rand(15, 25),
        hrvPoints: rand(10, 20),
        basePoints: rand(10, 15),
        fuelingCount24h: rand(2, 4),
        movementLogged: true,
        currentHrv: rand(45, 75),
        hrvAvg7d: rand(50, 65),
        calculatedAt: now - d * DAY,
      });
    }

    // 7. Seed protocol logs (daily stack completions)
    const protocols = [
      { id: "omega3", name: "Omega-3 Fish Oil", category: "supplements" },
      { id: "vitd", name: "Vitamin D3 + K2", category: "supplements" },
      { id: "magnesium", name: "Magnesium Glycinate", category: "supplements" },
      { id: "creatine", name: "Creatine Monohydrate", category: "supplements" },
      { id: "morning-sun", name: "Morning Sunlight", category: "habits" },
      { id: "cold-shower", name: "Cold Exposure", category: "recovery" },
    ];
    for (let d = 0; d < 7; d++) {
      const completedCount = rand(4, 6);
      for (let p = 0; p < completedCount; p++) {
        const proto = protocols[p % protocols.length];
        await ctx.db.insert("protocolLogs", {
          sessionId: sid,
          protocolId: proto.id,
          protocolName: proto.name,
          category: proto.category,
          loggedAt: now - d * DAY - rand(1, 12) * 60 * 60 * 1000,
          status: "completed",
        });
      }
    }

    // 8. Seed journal events (vitality scores, water intake)
    for (let d = 0; d < 7; d++) {
      const dayTs = now - d * DAY;
      await ctx.db.insert("journalEvents", {
        sessionId: sid,
        eventType: "vitality",
        eventKey: "morning_energy",
        value: `${rand(6, 9)}/10`,
        numericValue: rand(6, 9),
        loggedAt: dayTs - 10 * 60 * 60 * 1000,
      });
      await ctx.db.insert("journalEvents", {
        sessionId: sid,
        eventType: "water",
        eventKey: "water_intake",
        value: `${rand(1500, 3000)}ml water`,
        numericValue: rand(1500, 3000),
        loggedAt: dayTs - rand(2, 8) * 60 * 60 * 1000,
      });
    }

    // 9. Seed adherence scores
    for (let d = 0; d < 7; d++) {
      const total = 6;
      const completed = rand(4, 6);
      const dateObj = new Date(now - d * DAY);
      const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      await ctx.db.insert("adherenceScores", {
        sessionId: sid,
        dateKey,
        totalProtocols: total,
        completedProtocols: completed,
        adherencePercent: Math.round((completed / total) * 100),
        updatedAt: now - d * DAY,
      });
    }

    return {
      success: true,
      message: "Seeded 7 days of sample data: vitals, meals, activities, workouts, scores, protocols, and journal events.",
    };
  },
});

// ── Habit Verification: Verify a protocol and broadcast to squad ──
export const verifyHabit = mutation({
  args: {
    sessionId: v.string(),
    protocolId: v.string(),
    protocolName: v.string(),
    category: v.string(),
    verificationType: v.string(),
    photoStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const message = `locked in their ${args.protocolName} protocol`;
    const id = await ctx.db.insert("habitVerifications", {
      sessionId: args.sessionId,
      protocolId: args.protocolId,
      protocolName: args.protocolName,
      category: args.category,
      verificationType: args.verificationType,
      photoStorageId: args.photoStorageId,
      message,
      verifiedAt: Date.now(),
      dateKey,
    });
    // Update presence to "Mission Accomplished" status for 1 hour
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        activeProtocol: `✅ ${args.protocolName}`,
        activeCategory: "mission-accomplished",
      });
    }
    return { id, message };
  },
});

// ── Lab Results: Create a biomarker entry from laboratory results ──
export const createLabResult = mutation({
  args: {
    sessionId: v.string(),
    marker: v.string(),
    value: v.number(),
    unit: v.string(),
    source: v.string(),
    notes: v.optional(v.string()),
    testedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("labResults", {
      ...args,
      loggedAt: Date.now(),
    });
  },
});

// ── Lab Results: Delete a biomarker entry ──
export const deleteLabResult = mutation({
  args: { id: v.id("labResults") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ── Deploy Protocol Template: Batch-add items from a template to user's Daily Mission ──
export const deployProtocolTemplate = mutation({
  args: {
    sessionId: v.string(),
    templateId: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        category: v.string(),
        icon: v.string(),
        description: v.string(),
        timeOfDay: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get existing protocols to determine sort order and avoid duplicates
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    let sortOrder = existing.length;
    let added = 0;
    let skipped = 0;

    for (const item of args.items) {
      if (existingNames.has(item.name.toLowerCase())) {
        skipped++;
        continue;
      }
      await ctx.db.insert("protocols", {
        sessionId: args.sessionId,
        name: item.name,
        category: item.category,
        icon: item.icon,
        description: item.description,
        timeOfDay: item.timeOfDay,
        isActive: true,
        sortOrder: sortOrder++,
        source: `template:${args.templateId}`,
        createdAt: Date.now(),
      });
      existingNames.add(item.name.toLowerCase());
      added++;
    }

    return { added, skipped, total: existing.length + added };
  },
});

// ── Update User Baselines: Save computed BioLogic baselines to physicalBaseline ──
export const updateUserBaselines = mutation({
  args: {
    sessionId: v.string(),
    sex: v.string(),
    age: v.number(),
    heightCm: v.number(),
    weightKg: v.number(),
    computedBaselines: v.string(),
  },
  handler: async (ctx, args) => {
    // Derive a synthetic DOB from age for storage
    const now = new Date();
    const birthYear = now.getFullYear() - args.age;
    const dateOfBirth = `${birthYear}-01-01`;

    const existing = await ctx.db
      .query("physicalBaseline")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    const data = {
      sessionId: args.sessionId,
      sex: args.sex,
      dateOfBirth,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      computedBaselines: args.computedBaselines,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("physicalBaseline", data);
    }
  },
});

// ── Physical Baseline: Upsert sex, DOB, height, weight + compute baselines ──
export const upsertPhysicalBaseline = mutation({
  args: {
    sessionId: v.string(),
    sex: v.string(),
    dateOfBirth: v.string(),
    heightCm: v.number(),
    weightKg: v.number(),
    computedBaselines: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("physicalBaseline")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    const data = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("physicalBaseline", data);
    }
  },
});

// ── Voice Journal: Save a categorized voice entry (Mood, Pain, Energy) ──
export const createVoiceJournalEntry = mutation({
  args: {
    sessionId: v.string(),
    category: v.string(),
    summary: v.string(),
    originalText: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("voiceJournalEntries", {
      sessionId: args.sessionId,
      category: args.category,
      summary: args.summary,
      originalText: args.originalText,
      confidence: args.confidence,
      loggedAt: Date.now(),
    });
  },
});

// ══════════════════════════════════════════════════════════════
//  Quick-Voice Command: Parse voice input and update presence
//  metadata + log journal events automatically
// ══════════════════════════════════════════════════════════════
export const applyVoiceCommand = mutation({
  args: {
    sessionId: v.string(),
    transcript: v.string(),
    parsedIntent: v.string(),
    parsedCategory: v.string(),
    parsedValue: v.optional(v.string()),
    parsedNumeric: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const results: string[] = [];

    // 1. Update presence metadata based on parsed intent
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (presence) {
      const presenceUpdate: Record<string, unknown> = { lastSeen: now };

      switch (args.parsedIntent) {
        case "fatigue":
          // "Level 4 fatigue" → set aura to depleted, update protocol status
          presenceUpdate.auraState = (args.parsedNumeric ?? 0) >= 3 ? "depleted" : "recharging";
          presenceUpdate.activeProtocol = `⚡ Fatigue L${args.parsedNumeric ?? 0}`;
          presenceUpdate.activeCategory = "recovery";
          break;

        case "protocol_start":
          // "Started hydration protocol" → set active protocol
          presenceUpdate.activeProtocol = `🔄 ${args.parsedValue ?? "Protocol"}`;
          presenceUpdate.activeCategory = args.parsedCategory;
          presenceUpdate.auraState = "flow";
          break;

        case "protocol_complete":
          // "Finished cold exposure" → mark completed
          presenceUpdate.activeProtocol = `✅ ${args.parsedValue ?? "Protocol"}`;
          presenceUpdate.activeCategory = "mission-accomplished";
          presenceUpdate.auraState = "flow";
          break;

        case "energy":
          // "Energy level 8" → update aura based on energy
          presenceUpdate.auraState = (args.parsedNumeric ?? 5) >= 7 ? "flow" : (args.parsedNumeric ?? 5) >= 4 ? "social" : "depleted";
          presenceUpdate.activeProtocol = `⚡ Energy ${args.parsedNumeric ?? 5}/10`;
          presenceUpdate.activeCategory = "vitals";
          break;

        case "focus":
          // "Entering deep work" → set focus mode
          presenceUpdate.focusMode = true;
          presenceUpdate.isDeepWork = true;
          presenceUpdate.auraState = "flow";
          presenceUpdate.activeProtocol = "🎯 Deep Work";
          presenceUpdate.activeCategory = "focus";
          break;

        case "recovery":
          // "Starting recovery" → set recovery mode
          presenceUpdate.auraState = "recharging";
          presenceUpdate.activeProtocol = `💤 ${args.parsedValue ?? "Recovery"}`;
          presenceUpdate.activeCategory = "recovery";
          break;

        case "hydration":
          // "Drank 500ml water" → log water + update status
          presenceUpdate.activeProtocol = `💧 Hydrated ${args.parsedNumeric ?? 0}ml`;
          presenceUpdate.activeCategory = "nutrition";
          break;

        case "supplement":
          // "Took creatine" → log supplement
          presenceUpdate.activeProtocol = `💊 ${args.parsedValue ?? "Supplement"}`;
          presenceUpdate.activeCategory = "supplements";
          break;

        case "mood":
          // "Feeling great" / "Mood is low"
          presenceUpdate.auraState = (args.parsedNumeric ?? 5) >= 7 ? "flow" : (args.parsedNumeric ?? 5) >= 4 ? "social" : "depleted";
          presenceUpdate.activeProtocol = `🧠 Mood ${args.parsedNumeric ?? 5}/10`;
          presenceUpdate.activeCategory = "vitals";
          break;

        case "sleep":
          // "Slept 7 hours" → log sleep
          presenceUpdate.activeProtocol = `😴 ${args.parsedNumeric ?? 0}h sleep`;
          presenceUpdate.activeCategory = "recovery";
          break;

        default:
          // Generic voice note
          presenceUpdate.activeProtocol = `🎙️ ${args.transcript.slice(0, 30)}`;
          presenceUpdate.activeCategory = "voice";
          break;
      }

      await ctx.db.patch(presence._id, presenceUpdate);
      results.push("presence_updated");
    }

    // 2. Log as journal event for history tracking
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "voice_command",
      eventKey: args.parsedIntent,
      value: args.transcript,
      numericValue: args.parsedNumeric,
      loggedAt: now,
    });
    results.push("journal_logged");

    // 3. If hydration, also log water intake
    if (args.parsedIntent === "hydration" && args.parsedNumeric) {
      await ctx.db.insert("journalEvents", {
        sessionId: args.sessionId,
        eventType: "water",
        eventKey: "water_intake",
        value: `${args.parsedNumeric}ml water`,
        numericValue: args.parsedNumeric,
        loggedAt: now,
      });
      results.push("water_logged");
    }

    // 4. If protocol start/complete, log to protocol logs
    if ((args.parsedIntent === "protocol_start" || args.parsedIntent === "protocol_complete") && args.parsedValue) {
      await ctx.db.insert("protocolLogs", {
        sessionId: args.sessionId,
        protocolId: `voice-${args.parsedValue.toLowerCase().replace(/\s+/g, "-")}`,
        protocolName: args.parsedValue,
        category: args.parsedCategory,
        loggedAt: now,
        status: args.parsedIntent === "protocol_complete" ? "completed" : "started",
      });
      results.push("protocol_logged");
    }

    return { success: true, actions: results, intent: args.parsedIntent };
  },
});
