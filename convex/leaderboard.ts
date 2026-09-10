import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Helper: compute consecutive-day streak for a sessionId ──
function computeStreak(completions: Array<{ dateKey: string; completed: boolean }>): number {
  const completedDates = new Set<string>();
  for (const c of completions) {
    if (c.completed) completedDates.add(c.dateKey);
  }
  if (completedDates.size === 0) return 0;

  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (completedDates.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Stable anonymous operator ID from sessionId ──
function operatorId(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 900) + 100; // 3-digit: 100–999
}

// ── Performance-to-Recovery Ratio Calculator ──
// Measures how effectively someone converts strain into recovery.
// Higher ratio = better biological optimization (not burning out).
// Formula: (Recovery% * Adherence%) / max(Strain, 1) * HRV_multiplier
function computePerfRecoveryRatio(
  recovery: number,     // 0-100
  adherence: number,    // 0-100
  strain: number,       // 0-21
  hrv: number,          // ms
  sleepScore: number    // 0-100
): { ratio: number; efficiency: string; grade: string } {
  // Normalize strain to 0-1 (higher strain = harder to maintain ratio)
  const strainNorm = Math.max(strain, 0.5) / 21;
  
  // HRV multiplier: above 50ms is good, below 30ms is concerning
  const hrvMult = Math.min(1.5, Math.max(0.5, hrv / 50));
  
  // Sleep quality bonus: good sleep amplifies recovery efficiency
  const sleepMult = Math.min(1.3, Math.max(0.7, sleepScore / 80));
  
  // Core ratio: how much recovery you get per unit of strain
  // High recovery + high adherence + low strain = high ratio
  const rawRatio = ((recovery / 100) * (adherence / 100) * hrvMult * sleepMult) / strainNorm;
  
  // Normalize to 0-100 scale (typical range 0.5-4.0 maps to 20-95)
  const ratio = Math.max(0, Math.min(100, Math.round(rawRatio * 25)));
  
  // Efficiency label
  let efficiency: string;
  let grade: string;
  if (ratio >= 85) { efficiency = "Elite Optimizer"; grade = "S"; }
  else if (ratio >= 70) { efficiency = "High Performer"; grade = "A"; }
  else if (ratio >= 55) { efficiency = "Steady Builder"; grade = "B"; }
  else if (ratio >= 40) { efficiency = "Developing"; grade = "C"; }
  else { efficiency = "Burnout Risk"; grade = "D"; }
  
  return { ratio, efficiency, grade };
}

// ── Tier from P:R ratio ──
function tierFromRatio(ratio: number): string {
  if (ratio >= 85) return "apex";
  if (ratio >= 70) return "titan";
  if (ratio >= 55) return "sentinel";
  return "vanguard";
}

// ── System Benchmark data — shown when no real peers exist ──
function getSystemBenchmarks(): Array<{
  rank: number;
  anonId: string;
  anonLabel: string;
  avgAdherence: number;
  daysTracked: number;
  tier: string;
  isActive: boolean;
  activeProtocol: string | null;
  inSession: string | null;
  streak: number;
  isBenchmark: boolean;
}> {
  return [
    {
      rank: 1,
      anonId: "__benchmark_top10",
      anonLabel: "Top 10% Avg",
      avgAdherence: 95,
      daysTracked: 7,
      tier: "apex",
      isActive: false,
      activeProtocol: null,
      inSession: null,
      streak: 21,
      isBenchmark: true,
    },
    {
      rank: 2,
      anonId: "__benchmark_median",
      anonLabel: "Global Median",
      avgAdherence: 74,
      daysTracked: 7,
      tier: "titan",
      isActive: false,
      activeProtocol: null,
      inSession: null,
      streak: 7,
      isBenchmark: true,
    },
    {
      rank: 3,
      anonId: "__benchmark_baseline",
      anonLabel: "Starter Baseline",
      avgAdherence: 48,
      daysTracked: 3,
      tier: "vanguard",
      isActive: false,
      activeProtocol: null,
      inSession: null,
      streak: 1,
      isBenchmark: true,
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════
   SQUAD-SYNC LEADERBOARD
   
   Ranks members by Performance-to-Recovery ratio — who is
   optimizing their biology most effectively without burning out.
   Pulls from adherence, presence, sleep, HRV, strain, and
   recovery data across the last 7 days.
   ═══════════════════════════════════════════════════════════════ */

export const getSquadSyncLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const presenceCutoff = now - 30000;

    // 1. Get all adherence scores (last 7 days)
    let allAdherence: any[] = [];
    try {
      const raw = await ctx.db.query("adherenceScores").collect();
      allAdherence = raw.filter((a: any) => a.updatedAt >= sevenDaysAgo);
    } catch { /* table may not exist */ }

    // 2. Group adherence by sessionId
    const sessionAdherence = new Map<string, { total: number; count: number; dates: Set<string> }>();
    for (const entry of allAdherence) {
      const existing = sessionAdherence.get(entry.sessionId);
      if (existing) {
        if (!existing.dates.has(entry.dateKey)) {
          existing.total += entry.adherencePercent;
          existing.count += 1;
          existing.dates.add(entry.dateKey);
        }
      } else {
        sessionAdherence.set(entry.sessionId, {
          total: entry.adherencePercent,
          count: 1,
          dates: new Set([entry.dateKey]),
        });
      }
    }

    // 3. Get presence data for live status + HRV/HR
    let allPresence: any[] = [];
    try { allPresence = await ctx.db.query("presence").collect(); } catch {}
    
    const presenceMap = new Map<string, any>();
    for (const p of allPresence) {
      presenceMap.set(p.sessionId, p);
    }

    // 4. Get bioVault for recovery, sleep, HRV baselines
    let allBioVault: any[] = [];
    try { allBioVault = await ctx.db.query("bioVault").collect(); } catch {}
    
    const bioVaultMap = new Map<string, any>();
    for (const bv of allBioVault) {
      bioVaultMap.set(bv.sessionId, bv);
    }

    // 5. Get elite scores for strain data
    let allEliteScores: any[] = [];
    try { allEliteScores = await ctx.db.query("eliteScores").collect(); } catch {}
    
    const eliteMap = new Map<string, any>();
    for (const es of allEliteScores) {
      const existing = eliteMap.get(es.sessionId);
      if (!existing || es.calculatedAt > existing.calculatedAt) {
        eliteMap.set(es.sessionId, es);
      }
    }

    // 6. Get active protocol sessions
    let activeSessions: any[] = [];
    try { activeSessions = await ctx.db.query("protocolSessions").collect(); } catch {}
    
    const inSessionMap = new Map<string, string>();
    for (const s of activeSessions) {
      if (s.status === "active" || s.status === "running") {
        inSessionMap.set(s.sessionId, s.protocolName);
      }
    }

    // 7. Get daily completions for streak
    let allCompletions: any[] = [];
    try { allCompletions = await ctx.db.query("daily_completions").collect(); } catch {}
    
    const completionsBySession = new Map<string, Array<{ dateKey: string; completed: boolean }>>();
    for (const c of allCompletions) {
      const arr = completionsBySession.get(c.sessionId) || [];
      arr.push({ dateKey: c.dateKey, completed: c.completed });
      completionsBySession.set(c.sessionId, arr);
    }

    // 8. Collect all unique sessionIds from any data source
    const allSessionIds = new Set<string>();
    for (const sid of sessionAdherence.keys()) allSessionIds.add(sid);
    for (const sid of presenceMap.keys()) allSessionIds.add(sid);
    for (const sid of bioVaultMap.keys()) allSessionIds.add(sid);

    if (allSessionIds.size === 0) {
      return { entries: getSquadBenchmarks(), hasPeers: false, squadStats: getDefaultSquadStats() };
    }

    // 9. Build Squad-Sync entries with P:R ratio
    const entries: Array<{
      rank: number;
      anonId: string;
      anonLabel: string;
      prRatio: number;
      prGrade: string;
      prEfficiency: string;
      avgAdherence: number;
      recovery: number;
      strain: number;
      hrv: number;
      sleepScore: number;
      daysTracked: number;
      tier: string;
      isActive: boolean;
      activeProtocol: string | null;
      inSession: string | null;
      streak: number;
      isBenchmark: boolean;
      trendDirection: "up" | "down" | "stable";
    }> = [];

    for (const sessionId of allSessionIds) {
      const adherenceData = sessionAdherence.get(sessionId);
      const avgAdherence = adherenceData && adherenceData.count > 0
        ? Math.round(adherenceData.total / adherenceData.count)
        : 50; // default if no adherence data

      const presence = presenceMap.get(sessionId);
      const bioVault = bioVaultMap.get(sessionId);
      const elite = eliteMap.get(sessionId);
      const sessionCompletions = completionsBySession.get(sessionId) || [];
      const streak = computeStreak(sessionCompletions);

      // Extract biometrics with sensible defaults
      const recovery = bioVault?.sleepScore ? Math.min(100, Math.round(bioVault.sleepScore * 0.8 + (bioVault.hrvCurrent || 50) * 0.4)) : 65;
      const strain = elite?.score ? Math.min(21, elite.score / 5) : 8;
      const hrv = bioVault?.hrvCurrent || presence?.hrv || 48;
      const sleepScore = bioVault?.sleepScore || 70;

      // Compute Performance-to-Recovery ratio
      const { ratio, efficiency, grade } = computePerfRecoveryRatio(
        recovery, avgAdherence, strain, hrv, sleepScore
      );

      // Determine trend from HRV trend data
      const hrvTrend = bioVault?.hrvTrend || "stable";
      const trendDirection: "up" | "down" | "stable" = 
        hrvTrend === "up" ? "up" : hrvTrend === "down" ? "down" : "stable";

      const isActive = presence ? presence.lastSeen > presenceCutoff : false;
      const opId = operatorId(sessionId);

      entries.push({
        rank: 0,
        anonId: sessionId,
        anonLabel: `Operator #${opId}`,
        prRatio: ratio,
        prGrade: grade,
        prEfficiency: efficiency,
        avgAdherence,
        recovery,
        strain: Math.round(strain * 10) / 10,
        hrv: Math.round(hrv),
        sleepScore: Math.round(sleepScore),
        daysTracked: adherenceData?.count || 1,
        tier: tierFromRatio(ratio),
        isActive,
        activeProtocol: presence?.activeProtocol ?? null,
        inSession: inSessionMap.get(sessionId) ?? null,
        streak,
        isBenchmark: false,
        trendDirection,
      });
    }

    // Sort by P:R ratio descending, then by streak
    entries.sort((a, b) => {
      if (b.prRatio !== a.prRatio) return b.prRatio - a.prRatio;
      if (b.streak !== a.streak) return b.streak - a.streak;
      return b.avgAdherence - a.avgAdherence;
    });
    entries.forEach((e, i) => (e.rank = i + 1));

    const result = entries.slice(0, 15);

    // If too few peers, inject benchmarks
    if (result.length <= 1) {
      const benchmarks = getSquadBenchmarks();
      const combined = [...result, ...benchmarks];
      combined.sort((a, b) => {
        if (b.prRatio !== a.prRatio) return b.prRatio - a.prRatio;
        return b.streak - a.streak;
      });
      combined.forEach((e, i) => (e.rank = i + 1));

      return {
        entries: combined,
        hasPeers: false,
        squadStats: computeSquadStats(combined),
      };
    }

    return {
      entries: result,
      hasPeers: true,
      squadStats: computeSquadStats(result),
    };
  },
});

// ── Squad-level aggregate stats ──
function computeSquadStats(entries: Array<{ prRatio: number; recovery: number; strain: number; hrv: number; avgAdherence: number; isActive: boolean; isBenchmark: boolean }>) {
  const real = entries.filter(e => !e.isBenchmark);
  const all = real.length > 0 ? real : entries;
  const count = all.length || 1;
  
  return {
    avgPrRatio: Math.round(all.reduce((s, e) => s + e.prRatio, 0) / count),
    avgRecovery: Math.round(all.reduce((s, e) => s + e.recovery, 0) / count),
    avgStrain: Math.round(all.reduce((s, e) => s + e.strain, 0) / count * 10) / 10,
    avgHrv: Math.round(all.reduce((s, e) => s + e.hrv, 0) / count),
    avgAdherence: Math.round(all.reduce((s, e) => s + e.avgAdherence, 0) / count),
    activeCount: all.filter(e => e.isActive).length,
    totalMembers: count,
    squadGrade: all.reduce((s, e) => s + e.prRatio, 0) / count >= 70 ? "A" : 
                all.reduce((s, e) => s + e.prRatio, 0) / count >= 55 ? "B" : "C",
  };
}

function getDefaultSquadStats() {
  return { avgPrRatio: 72, avgRecovery: 72, avgStrain: 8.5, avgHrv: 55, avgAdherence: 72, activeCount: 0, totalMembers: 3, squadGrade: "B" };
}

// ── Squad-Sync Benchmarks with P:R data ──
function getSquadBenchmarks(): Array<{
  rank: number; anonId: string; anonLabel: string; prRatio: number; prGrade: string;
  prEfficiency: string; avgAdherence: number; recovery: number; strain: number;
  hrv: number; sleepScore: number; daysTracked: number; tier: string; isActive: boolean;
  activeProtocol: string | null; inSession: string | null; streak: number;
  isBenchmark: boolean; trendDirection: "up" | "down" | "stable";
}> {
  return [
    {
      rank: 1, anonId: "__bench_elite", anonLabel: "Elite Avg",
      prRatio: 88, prGrade: "S", prEfficiency: "Elite Optimizer",
      avgAdherence: 94, recovery: 91, strain: 14.2, hrv: 72, sleepScore: 88,
      daysTracked: 7, tier: "apex", isActive: false, activeProtocol: null,
      inSession: null, streak: 21, isBenchmark: true, trendDirection: "up",
    },
    {
      rank: 2, anonId: "__bench_median", anonLabel: "Global Median",
      prRatio: 62, prGrade: "B", prEfficiency: "Steady Builder",
      avgAdherence: 72, recovery: 74, strain: 9.8, hrv: 52, sleepScore: 74,
      daysTracked: 7, tier: "sentinel", isActive: false, activeProtocol: null,
      inSession: null, streak: 7, isBenchmark: true, trendDirection: "stable",
    },
    {
      rank: 3, anonId: "__bench_starter", anonLabel: "Starter Baseline",
      prRatio: 38, prGrade: "D", prEfficiency: "Burnout Risk",
      avgAdherence: 45, recovery: 55, strain: 12.5, hrv: 35, sleepScore: 58,
      daysTracked: 3, tier: "vanguard", isActive: false, activeProtocol: null,
      inSession: null, streak: 1, isBenchmark: true, trendDirection: "down",
    },
  ];
}

// ── Anonymized Peer Leaderboard (last 7 days adherence + live presence + streaks) ──
// Returns System Benchmarks as fallback when no real peer data exists.
export const getPeerLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const presenceCutoff = now - 30000; // 30s for "active"

    // 1. Get all adherence scores — guard empty table
    let allAdherence;
    try {
      allAdherence = await ctx.db.query("adherenceScores").collect();
    } catch {
      return getSystemBenchmarks();
    }

    if (!allAdherence || allAdherence.length === 0) {
      return getSystemBenchmarks();
    }

    const recentAdherence = allAdherence.filter(
      (a) => a.updatedAt >= sevenDaysAgo
    );

    if (recentAdherence.length === 0) {
      return getSystemBenchmarks();
    }

    // 2. Group by sessionId and compute 7-day average
    const sessionMap = new Map<
      string,
      { total: number; count: number; dates: Set<string> }
    >();
    for (const entry of recentAdherence) {
      const existing = sessionMap.get(entry.sessionId);
      if (existing) {
        if (!existing.dates.has(entry.dateKey)) {
          existing.total += entry.adherencePercent;
          existing.count += 1;
          existing.dates.add(entry.dateKey);
        }
      } else {
        sessionMap.set(entry.sessionId, {
          total: entry.adherencePercent,
          count: 1,
          dates: new Set([entry.dateKey]),
        });
      }
    }

    if (sessionMap.size === 0) {
      return getSystemBenchmarks();
    }

    // 3. Get all active presence entries
    let allPresence: any[] = [];
    try {
      allPresence = await ctx.db.query("presence").collect();
    } catch {}

    const activePresenceMap = new Map<string, { activeProtocol?: string }>();
    if (allPresence && allPresence.length > 0) {
      for (const p of allPresence) {
        if (p.lastSeen > presenceCutoff) {
          activePresenceMap.set(p.sessionId, {
            activeProtocol: p.activeProtocol ?? undefined,
          });
        }
      }
    }

    // 4. Get active protocol sessions
    let activeSessions: any[] = [];
    try {
      activeSessions = await ctx.db.query("protocolSessions").collect();
    } catch {}

    const inSessionMap = new Map<string, string>();
    if (activeSessions && activeSessions.length > 0) {
      for (const s of activeSessions) {
        if (s.status === "active" || s.status === "running") {
          inSessionMap.set(s.sessionId, s.protocolName);
        }
      }
    }

    // 5. Get daily completions for streak calculation
    let allCompletions: any[] = [];
    try {
      allCompletions = await ctx.db.query("daily_completions").collect();
    } catch {}

    const completionsBySession = new Map<string, Array<{ dateKey: string; completed: boolean }>>();
    if (allCompletions && allCompletions.length > 0) {
      for (const c of allCompletions) {
        const arr = completionsBySession.get(c.sessionId) || [];
        arr.push({ dateKey: c.dateKey, completed: c.completed });
        completionsBySession.set(c.sessionId, arr);
      }
    }

    // 6. Build anonymized leaderboard
    const entries: Array<{
      rank: number;
      anonId: string;
      anonLabel: string;
      avgAdherence: number;
      daysTracked: number;
      tier: string;
      isActive: boolean;
      activeProtocol: string | null;
      inSession: string | null;
      streak: number;
      isBenchmark: boolean;
    }> = [];

    for (const [sessionId, data] of sessionMap) {
      const avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
      const opId = operatorId(sessionId);
      const presence = activePresenceMap.get(sessionId);
      const sessionCompletions = completionsBySession.get(sessionId) || [];
      const streak = computeStreak(sessionCompletions);

      entries.push({
        rank: 0,
        anonId: sessionId,
        anonLabel: `Operator #${opId}`,
        avgAdherence: avg,
        daysTracked: data.count,
        tier: avg >= 90 ? "apex" : avg >= 70 ? "titan" : "vanguard",
        isActive: activePresenceMap.has(sessionId),
        activeProtocol: presence?.activeProtocol ?? null,
        inSession: inSessionMap.get(sessionId) ?? null,
        streak,
        isBenchmark: false,
      });
    }

    entries.sort((a, b) => {
      if (b.avgAdherence !== a.avgAdherence) return b.avgAdherence - a.avgAdherence;
      return b.streak - a.streak;
    });
    entries.forEach((e, i) => (e.rank = i + 1));

    const result = entries.slice(0, 15);

    if (result.length <= 1) {
      const benchmarks = getSystemBenchmarks();
      const combined = [...result.map(e => ({ ...e, isBenchmark: false })), ...benchmarks];
      combined.sort((a, b) => {
        if (b.avgAdherence !== a.avgAdherence) return b.avgAdherence - a.avgAdherence;
        return b.streak - a.streak;
      });
      combined.forEach((e, i) => (e.rank = i + 1));
      return combined;
    }

    return result;
  },
});

// ── Fallback: list seeded leaderboard users ranked by adherence ──
export const listLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("leaderboardUsers").collect();
    return all.sort((a, b) => b.adherence - a.adherence).slice(0, 10);
  },
});

// Get current user's leaderboard entry
export const getCurrentUserEntry = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("leaderboardUsers").collect();
    return all.find((u) => u.isCurrentUser) ?? null;
  },
});

// Seed leaderboard with 10 mock users if empty
export const seedLeaderboard = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("leaderboardUsers").collect();
    if (existing.length > 0) return existing.length;

    const mockUsers = [
      { name: "Kira Voss", handle: "@kiravoss", avatar: "KV", adherence: 97, recovery: 94, strain: 14.2, hrv: 88, tier: "apex", isCurrentUser: false },
      { name: "Marcus Chen", handle: "@mchen", avatar: "MC", adherence: 94, recovery: 91, strain: 13.8, hrv: 82, tier: "apex", isCurrentUser: false },
      { name: "You", handle: "@you", avatar: "YO", adherence: 88, recovery: 84, strain: 12.5, hrv: 82, tier: "titan", isCurrentUser: true },
      { name: "Aria Nakamura", handle: "@arianaka", avatar: "AN", adherence: 85, recovery: 80, strain: 11.9, hrv: 74, tier: "titan", isCurrentUser: false },
      { name: "Dex Holloway", handle: "@dexh", avatar: "DH", adherence: 82, recovery: 78, strain: 10.4, hrv: 71, tier: "titan", isCurrentUser: false },
      { name: "Lena Park", handle: "@lenapark", avatar: "LP", adherence: 76, recovery: 75, strain: 9.8, hrv: 68, tier: "titan", isCurrentUser: false },
      { name: "Theo Briggs", handle: "@theob", avatar: "TB", adherence: 68, recovery: 70, strain: 8.2, hrv: 62, tier: "vanguard", isCurrentUser: false },
      { name: "Sage Williams", handle: "@sagew", avatar: "SW", adherence: 64, recovery: 66, strain: 7.5, hrv: 58, tier: "vanguard", isCurrentUser: false },
      { name: "Ravi Patel", handle: "@ravip", avatar: "RP", adherence: 58, recovery: 62, strain: 6.8, hrv: 54, tier: "vanguard", isCurrentUser: false },
      { name: "Zoe Hart", handle: "@zoeh", avatar: "ZH", adherence: 52, recovery: 58, strain: 5.4, hrv: 50, tier: "vanguard", isCurrentUser: false },
    ];

    for (const user of mockUsers) {
      await ctx.db.insert("leaderboardUsers", {
        ...user,
        lastUpdated: Date.now(),
      });
    }
    return mockUsers.length;
  },
});

// Update a user's adherence score
export const updateAdherence = mutation({
  args: {
    id: v.id("leaderboardUsers"),
    adherence: v.number(),
  },
  handler: async (ctx, args) => {
    const tier =
      args.adherence >= 90
        ? "apex"
        : args.adherence >= 70
          ? "titan"
          : "vanguard";
    await ctx.db.patch(args.id, {
      adherence: args.adherence,
      tier,
      lastUpdated: Date.now(),
    });
    return args.id;
  },
});
