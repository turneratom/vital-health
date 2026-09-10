import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ═══════════════════════════════════════════════════════════════
   WEEKLY TACTICAL REPORT — Mission Debrief Engine
   
   Aggregates 7 days of:
   • Sleep scores & quality metrics
   • Blood marker status from BioVault
   • Protocol completion rates (per-protocol & overall)
   • Correlation engine data: which protocols drove recovery
   
   Outputs a single "Squad Readiness Score" (0-100) and
   detailed protocol-to-recovery correlation analysis.
   ═══════════════════════════════════════════════════════════════ */

/* ── Protocol → Recovery Impact Map ── */
const PROTOCOL_RECOVERY_WEIGHTS: Record<string, number> = {
  sunlight: 0.15,
  cold: 0.12,
  sleep: 0.25,
  detox: 0.08,
  exercise: 0.18,
  movement: 0.10,
  magnesium: 0.08,
  omega: 0.06,
  fish: 0.06,
  vitamin: 0.07,
  iron: 0.05,
  zinc: 0.05,
  creatine: 0.03,
  fasting: 0.10,
  walk: 0.08,
};

function matchProtocolWeight(name: string): number {
  const lower = name.toLowerCase();
  let maxWeight = 0.05; // default
  for (const [keyword, weight] of Object.entries(PROTOCOL_RECOVERY_WEIGHTS)) {
    if (lower.includes(keyword) && weight > maxWeight) {
      maxWeight = weight;
    }
  }
  return maxWeight;
}

function getProtocolCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("sleep") || lower.includes("detox") || lower.includes("screen")) return "Recovery";
  if (lower.includes("cold") || lower.includes("plunge") || lower.includes("sauna")) return "Hormesis";
  if (lower.includes("sun") || lower.includes("light")) return "Circadian";
  if (lower.includes("exercise") || lower.includes("movement") || lower.includes("walk") || lower.includes("train")) return "Movement";
  if (lower.includes("magnesium") || lower.includes("omega") || lower.includes("vitamin") || lower.includes("zinc") || lower.includes("iron") || lower.includes("creatine") || lower.includes("fish") || lower.includes("supplement")) return "Supplements";
  if (lower.includes("fast") || lower.includes("meal") || lower.includes("eat")) return "Nutrition";
  return "Protocol";
}

/* ── Stable anonymous operator ID from sessionId ── */
function operatorIdFromSession(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 900) + 100;
}

/* ═══════════════════════════════════════════════════════════════
   MISSION DEBRIEF — Weekly Squad Performance Report
   
   Generates every Sunday at 8 PM. Aggregates:
   • Elite Performance Scores from all squad members (7 days)
   • Crowns a "Squad Lead" for the week (highest avg score)
   • Identifies "Missed Objectives" — most-skipped habits
   • Per-member score breakdown with daily sparklines
   • Squad-wide protocol adherence heatmap
   ═══════════════════════════════════════════════════════════════ */

export const getMissionDebrief = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const today = new Date();

    // ── 1. Gather ALL Elite Scores (squad-wide) ──
    const allEliteScores = await ctx.db
      .query("eliteScores")
      .order("desc")
      .collect();

    // Group scores by sessionId
    const scoresBySession = new Map<string, Array<{
      score: number;
      fuelingPoints: number;
      movementPoints: number;
      hrvPoints: number;
      basePoints: number;
      calculatedAt: number;
    }>>();

    for (const es of allEliteScores) {
      if (es.calculatedAt >= sevenDaysAgo) {
        const arr = scoresBySession.get(es.sessionId) || [];
        arr.push({
          score: es.score,
          fuelingPoints: es.fuelingPoints,
          movementPoints: es.movementPoints,
          hrvPoints: es.hrvPoints,
          basePoints: es.basePoints,
          calculatedAt: es.calculatedAt,
        });
        scoresBySession.set(es.sessionId, arr);
      }
    }

    // ── 2. Build per-member performance profiles ──
    const memberProfiles: Array<{
      sessionId: string;
      operatorLabel: string;
      operatorId: number;
      avgScore: number;
      peakScore: number;
      lowestScore: number;
      totalEntries: number;
      tier: "APEX" | "TITAN" | "VANGUARD" | "RECRUIT";
      dailyScores: Array<{ date: string; score: number }>;
      fuelingAvg: number;
      movementAvg: number;
      hrvAvg: number;
      isCurrentUser: boolean;
      trend: "up" | "down" | "flat";
    }> = [];

    for (const [sessionId, scores] of scoresBySession) {
      const sorted = [...scores].sort((a, b) => a.calculatedAt - b.calculatedAt);
      const avgScore = Math.round(scores.reduce((s, e) => s + e.score, 0) / scores.length);
      const peakScore = Math.max(...scores.map((s) => s.score));
      const lowestScore = Math.min(...scores.map((s) => s.score));
      const fuelingAvg = Math.round(scores.reduce((s, e) => s + e.fuelingPoints, 0) / scores.length);
      const movementAvg = Math.round(scores.reduce((s, e) => s + e.movementPoints, 0) / scores.length);
      const hrvAvg = Math.round(scores.reduce((s, e) => s + e.hrvPoints, 0) / scores.length);

      // Daily scores for sparkline (last 7 days)
      const dailyScores: Array<{ date: string; score: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dk = d.toISOString().slice(0, 10);
        const dayScores = scores.filter((s) => {
          const sd = new Date(s.calculatedAt).toISOString().slice(0, 10);
          return sd === dk;
        });
        const dayAvg = dayScores.length > 0
          ? Math.round(dayScores.reduce((s, e) => s + e.score, 0) / dayScores.length)
          : 0;
        dailyScores.push({ date: dk, score: dayAvg });
      }

      // Trend: compare first half vs second half
      let trend: "up" | "down" | "flat" = "flat";
      if (sorted.length >= 3) {
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
        const avgFirst = firstHalf.reduce((s, e) => s + e.score, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, e) => s + e.score, 0) / secondHalf.length;
        trend = avgSecond > avgFirst + 3 ? "up" : avgSecond < avgFirst - 3 ? "down" : "flat";
      }

      // Tier classification
      let tier: "APEX" | "TITAN" | "VANGUARD" | "RECRUIT";
      if (avgScore >= 85) tier = "APEX";
      else if (avgScore >= 65) tier = "TITAN";
      else if (avgScore >= 40) tier = "VANGUARD";
      else tier = "RECRUIT";

      memberProfiles.push({
        sessionId,
        operatorLabel: `Operator #${operatorIdFromSession(sessionId)}`,
        operatorId: operatorIdFromSession(sessionId),
        avgScore,
        peakScore,
        lowestScore,
        totalEntries: scores.length,
        tier,
        dailyScores,
        fuelingAvg,
        movementAvg,
        hrvAvg,
        isCurrentUser: sessionId === args.sessionId,
        trend,
      });
    }

    // Sort by avgScore descending — #1 is Squad Lead
    memberProfiles.sort((a, b) => b.avgScore - a.avgScore);

    // ── 3. Crown the Squad Lead ──
    const squadLead = memberProfiles.length > 0 ? memberProfiles[0] : null;
    const currentUserProfile = memberProfiles.find((m) => m.isCurrentUser) || null;
    const currentUserRank = currentUserProfile
      ? memberProfiles.indexOf(currentUserProfile) + 1
      : null;

    // ── 4. Missed Objectives — most-skipped protocols across ALL members ──
    // Gather all active protocols and their completions
    const allProtocols = await ctx.db.query("protocols").collect();
    const allCompletions = await ctx.db.query("protocolCompletions").collect();
    const recentCompletions = allCompletions.filter(
      (c) => c.completedAt >= sevenDaysAgo
    );

    // Build a map of protocol name → { totalPossible, totalCompleted }
    const protocolMissMap = new Map<string, {
      name: string;
      icon: string;
      category: string;
      totalPossible: number;
      totalCompleted: number;
      uniqueMembers: Set<string>;
      membersMissed: Set<string>;
    }>();

    // Group active protocols by sessionId
    const activeProtocolsBySession = new Map<string, typeof allProtocols>();
    for (const p of allProtocols) {
      if (p.isActive) {
        const arr = activeProtocolsBySession.get(p.sessionId) || [];
        arr.push(p);
        activeProtocolsBySession.set(p.sessionId, arr);
      }
    }

    // For each session's active protocols, count completions over 7 days
    for (const [sessionId, protocols] of activeProtocolsBySession) {
      for (const proto of protocols) {
        const key = proto.name.toLowerCase().trim();
        const existing = protocolMissMap.get(key) || {
          name: proto.name,
          icon: proto.icon,
          category: getProtocolCategory(proto.name),
          totalPossible: 0,
          totalCompleted: 0,
          uniqueMembers: new Set<string>(),
          membersMissed: new Set<string>(),
        };

        existing.totalPossible += 7; // 7 days
        existing.uniqueMembers.add(sessionId);

        // Count how many days this member completed this protocol
        const memberCompletions = recentCompletions.filter(
          (c) => c.protocolItemId === (proto._id as string) && c.completed
        );
        const completedDays = new Set(
          memberCompletions.map((c) => new Date(c.completedAt).toISOString().slice(0, 10))
        ).size;

        existing.totalCompleted += completedDays;

        // If completed less than 3 of 7 days, count as "missed" by this member
        if (completedDays < 3) {
          existing.membersMissed.add(sessionId);
        }

        protocolMissMap.set(key, existing);
      }
    }

    // Convert to sorted array — most missed first
    const missedObjectives = Array.from(protocolMissMap.values())
      .map((m) => ({
        name: m.name,
        icon: m.icon,
        category: m.category,
        completionRate: m.totalPossible > 0
          ? Math.round((m.totalCompleted / m.totalPossible) * 100)
          : 0,
        totalPossible: m.totalPossible,
        totalCompleted: m.totalCompleted,
        membersAssigned: m.uniqueMembers.size,
        membersMissed: m.membersMissed.size,
        missRate: m.uniqueMembers.size > 0
          ? Math.round((m.membersMissed.size / m.uniqueMembers.size) * 100)
          : 0,
        severity: "low" as "critical" | "high" | "medium" | "low",
      }))
      .sort((a, b) => a.completionRate - b.completionRate);

    // Assign severity based on completion rate
    for (const obj of missedObjectives) {
      if (obj.completionRate < 20) obj.severity = "critical";
      else if (obj.completionRate < 40) obj.severity = "high";
      else if (obj.completionRate < 60) obj.severity = "medium";
      else obj.severity = "low";
    }

    // ── 5. Squad-wide aggregate metrics ──
    const squadAvgScore = memberProfiles.length > 0
      ? Math.round(memberProfiles.reduce((s, m) => s + m.avgScore, 0) / memberProfiles.length)
      : 0;

    const squadPeakScore = memberProfiles.length > 0
      ? Math.max(...memberProfiles.map((m) => m.peakScore))
      : 0;

    // Daily squad average for sparkline
    const squadDailyAvg: Array<{ date: string; avgScore: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = d.toISOString().slice(0, 10);
      const dayScores = memberProfiles
        .map((m) => m.dailyScores.find((ds) => ds.date === dk)?.score ?? 0)
        .filter((s) => s > 0);
      squadDailyAvg.push({
        date: dk,
        avgScore: dayScores.length > 0
          ? Math.round(dayScores.reduce((s, v) => s + v, 0) / dayScores.length)
          : 0,
      });
    }

    // ── 6. Sleep data for current user (context) ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs.filter((s) => s.loggedAt >= sevenDaysAgo);
    const avgSleepScore = recentSleep.length > 0
      ? Math.round(recentSleep.reduce((s, l) => s + l.sleepScore, 0) / recentSleep.length)
      : null;
    const avgSleepHours = recentSleep.length > 0
      ? Math.round(recentSleep.reduce((s, l) => s + l.totalHours, 0) / recentSleep.length * 10) / 10
      : null;

    // ── 7. Report period ──
    const periodStart = new Date(today);
    periodStart.setDate(periodStart.getDate() - 6);

    // ── 8. Squad Readiness Score (composite) ──
    // 40% elite score avg + 30% protocol adherence + 20% sleep + 10% participation
    const overallAdherence = missedObjectives.length > 0
      ? Math.round(missedObjectives.reduce((s, m) => s + m.completionRate, 0) / missedObjectives.length)
      : 0;
    const participationRate = Math.min(100, memberProfiles.length * 20); // 5 members = 100%
    const sleepComp = (avgSleepScore ?? 50);

    const squadReadinessScore = Math.round(
      Math.min(100, Math.max(0,
        squadAvgScore * 0.40 +
        overallAdherence * 0.30 +
        sleepComp * 0.20 +
        participationRate * 0.10
      ))
    );

    let readinessGrade: "APEX" | "COMBAT_READY" | "RECOVERING" | "COMPROMISED";
    if (squadReadinessScore >= 85) readinessGrade = "APEX";
    else if (squadReadinessScore >= 65) readinessGrade = "COMBAT_READY";
    else if (squadReadinessScore >= 40) readinessGrade = "RECOVERING";
    else readinessGrade = "COMPROMISED";

    return {
      reportPeriod: {
        start: periodStart.toISOString().slice(0, 10),
        end: today.toISOString().slice(0, 10),
        generatedAt: now,
      },
      squadReadinessScore,
      readinessGrade,
      squadAvgScore,
      squadPeakScore,
      squadDailyAvg,
      squadLead,
      memberProfiles,
      currentUserProfile,
      currentUserRank,
      totalMembers: memberProfiles.length,
      missedObjectives: missedObjectives.filter((m) => m.completionRate < 80),
      topPerformingProtocols: missedObjectives
        .filter((m) => m.completionRate >= 80)
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5),
      sleepContext: {
        avgScore: avgSleepScore,
        avgHours: avgSleepHours,
        nightsLogged: recentSleep.length,
      },
      overallAdherence,
    };
  },
});

export const getWeeklyTacticalReport = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const today = new Date();

    // ── 1. Sleep Data (last 7 days) ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs.filter((s) => s.loggedAt >= sevenDaysAgo);
    
    const sleepMetrics = {
      avgScore: recentSleep.length > 0
        ? Math.round(recentSleep.reduce((s, l) => s + l.sleepScore, 0) / recentSleep.length)
        : null,
      avgHours: recentSleep.length > 0
        ? Math.round(recentSleep.reduce((s, l) => s + l.totalHours, 0) / recentSleep.length * 10) / 10
        : null,
      avgEfficiency: recentSleep.length > 0
        ? Math.round(recentSleep.reduce((s, l) => s + l.efficiency, 0) / recentSleep.length)
        : null,
      avgDeepPct: recentSleep.length > 0
        ? Math.round(recentSleep.reduce((s, l) => s + (l.deepHours / Math.max(l.totalHours, 0.1)) * 100, 0) / recentSleep.length)
        : null,
      avgRemPct: recentSleep.length > 0
        ? Math.round(recentSleep.reduce((s, l) => s + (l.remHours / Math.max(l.totalHours, 0.1)) * 100, 0) / recentSleep.length)
        : null,
      nightsLogged: recentSleep.length,
      dailyScores: [] as Array<{ date: string; score: number; hours: number }>,
      trend: "flat" as "up" | "down" | "flat",
    };

    // Daily sleep scores for sparkline
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = d.toISOString().slice(0, 10);
      const dayLog = recentSleep.find((s) => s.date === dk);
      sleepMetrics.dailyScores.push({
        date: dk,
        score: dayLog?.sleepScore ?? 0,
        hours: dayLog?.totalHours ?? 0,
      });
    }

    // Sleep trend
    if (recentSleep.length >= 3) {
      const sorted = [...recentSleep].sort((a, b) => a.loggedAt - b.loggedAt);
      const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
      const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
      const avgFirst = firstHalf.reduce((s, l) => s + l.sleepScore, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, l) => s + l.sleepScore, 0) / secondHalf.length;
      sleepMetrics.trend = avgSecond > avgFirst + 3 ? "up" : avgSecond < avgFirst - 3 ? "down" : "flat";
    }

    // ── 2. BioVault Markers ──
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const MARKER_CONFIG = [
      { key: "vitaminD", label: "Vitamin D", unit: "ng/mL", optimal: [40, 80] },
      { key: "testosteroneFree", label: "Free Testosterone", unit: "pg/mL", optimal: [15, 30] },
      { key: "testosteroneTotal", label: "Total Testosterone", unit: "ng/dL", optimal: [400, 900] },
      { key: "ferritin", label: "Ferritin", unit: "ng/mL", optimal: [40, 200] },
      { key: "crp", label: "hs-CRP", unit: "mg/L", optimal: [0, 1] },
      { key: "hba1c", label: "HbA1c", unit: "%", optimal: [4, 5.6] },
    ];

    const biomarkerStatus = MARKER_CONFIG.map((m) => {
      const val = vault ? (vault as Record<string, unknown>)[m.key] : null;
      let status: "optimal" | "borderline" | "flagged" | "no_data" = "no_data";
      if (val != null && typeof val === "number") {
        if (val >= m.optimal[0] && val <= m.optimal[1]) status = "optimal";
        else if (val >= m.optimal[0] * 0.7 && val <= m.optimal[1] * 1.3) status = "borderline";
        else status = "flagged";
      }
      return { ...m, value: typeof val === "number" ? val : null, status };
    });

    const markersWithData = biomarkerStatus.filter((m) => m.status !== "no_data");
    const optimalCount = markersWithData.filter((m) => m.status === "optimal").length;
    const bioScore = markersWithData.length > 0
      ? Math.round((optimalCount / markersWithData.length) * 100)
      : null;

    // ── 3. Protocol Completion (last 7 days) ──
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentCompletions = completions.filter(
      (c) => c.completedAt >= sevenDaysAgo && c.completed
    );

    // Per-protocol stats
    const protocolStats: Array<{
      name: string;
      icon: string;
      category: string;
      completionRate: number;
      daysCompleted: number;
      totalDays: number;
      recoveryWeight: number;
      recoveryContribution: number;
      streak: number;
    }> = [];

    for (const proto of activeProtocols) {
      const protoCompletions = recentCompletions.filter(
        (c) => c.protocolItemId === (proto._id as string)
      );
      const completedDates = new Set(
        protoCompletions.map((c) => new Date(c.completedAt).toISOString().slice(0, 10))
      );

      // Count streak from today backwards
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (completedDates.has(d.toISOString().slice(0, 10))) streak++;
        else break;
      }

      const rate = Math.round((completedDates.size / 7) * 100);
      const weight = matchProtocolWeight(proto.name);
      const contribution = Math.round(rate * weight);

      protocolStats.push({
        name: proto.name,
        icon: proto.icon,
        category: getProtocolCategory(proto.name),
        completionRate: rate,
        daysCompleted: completedDates.size,
        totalDays: 7,
        recoveryWeight: weight,
        recoveryContribution: contribution,
        streak,
      });
    }

    // Sort by recovery contribution (highest impact first)
    protocolStats.sort((a, b) => b.recoveryContribution - a.recoveryContribution);

    // Overall adherence rate
    const overallAdherence = protocolStats.length > 0
      ? Math.round(protocolStats.reduce((s, p) => s + p.completionRate, 0) / protocolStats.length)
      : 0;

    // Daily adherence for sparkline
    const dailyAdherence: Array<{ date: string; rate: number; completed: number; total: number }> = [];
    const totalProtos = activeProtocols.length || 1;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = d.toISOString().slice(0, 10);
      const dayCompletions = recentCompletions.filter(
        (c) => new Date(c.completedAt).toISOString().slice(0, 10) === dk
      );
      const uniqueProtos = new Set(dayCompletions.map((c) => c.protocolItemId));
      dailyAdherence.push({
        date: dk,
        rate: Math.round((uniqueProtos.size / totalProtos) * 100),
        completed: uniqueProtos.size,
        total: totalProtos,
      });
    }

    // ── 4. HRV Trend (last 7 days) ──
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentHrv = hrvReadings.filter((h) => h.measuredAt >= sevenDaysAgo);
    const avgHrv = recentHrv.length > 0
      ? Math.round(recentHrv.reduce((s, h) => s + h.value, 0) / recentHrv.length)
      : vault?.hrvAvg7d ?? null;

    // ── 5. Top Protocol → Recovery Correlations ──
    const topCorrelations: Array<{
      protocolName: string;
      protocolIcon: string;
      category: string;
      adherenceRate: number;
      recoveryImpact: string;
      mechanism: string;
      verdict: "strong_positive" | "moderate_positive" | "weak" | "negative";
    }> = [];

    for (const ps of protocolStats.slice(0, 8)) {
      let verdict: typeof topCorrelations[0]["verdict"] = "weak";
      let impact = "";
      let mechanism = "";

      if (ps.completionRate >= 80) {
        verdict = "strong_positive";
        impact = `${ps.completionRate}% adherence — driving measurable recovery gains`;
        mechanism = `Consistent ${ps.name} execution correlates with improved biomarker trajectory`;
      } else if (ps.completionRate >= 50) {
        verdict = "moderate_positive";
        impact = `${ps.completionRate}% adherence — partial recovery benefit`;
        mechanism = `Inconsistent execution limits the compounding effect of ${ps.name}`;
      } else if (ps.completionRate >= 20) {
        verdict = "weak";
        impact = `${ps.completionRate}% adherence — minimal recovery signal`;
        mechanism = `${ps.name} needs 5+ days/week for measurable biomarker impact`;
      } else {
        verdict = "negative";
        impact = `${ps.completionRate}% adherence — protocol abandoned`;
        mechanism = `Missing ${ps.name} is projected to worsen related biomarkers within 2 weeks`;
      }

      topCorrelations.push({
        protocolName: ps.name,
        protocolIcon: ps.icon,
        category: ps.category,
        adherenceRate: ps.completionRate,
        recoveryImpact: impact,
        mechanism,
        verdict,
      });
    }

    // ── 6. Failures / Missed Protocols ──
    const failures = protocolStats
      .filter((p) => p.completionRate < 40)
      .map((p) => ({
        name: p.name,
        icon: p.icon,
        category: p.category,
        completionRate: p.completionRate,
        daysCompleted: p.daysCompleted,
        recommendation: p.completionRate === 0
          ? `${p.name} was completely missed this week. Resume immediately.`
          : `${p.name} only completed ${p.daysCompleted}/7 days. Increase to 5+ for measurable impact.`,
      }));

    // ── 7. Squad Readiness Score (0-100) ──
    const adherenceComponent = overallAdherence * 0.35;
    const sleepComponent = (sleepMetrics.avgScore ?? 50) * 0.30;
    const bioComponent = (bioScore ?? 50) * 0.20;
    const hrvComponent = avgHrv
      ? Math.min(100, Math.round((avgHrv / 80) * 100)) * 0.15
      : 50 * 0.15;

    const readinessScore = Math.round(
      Math.min(100, Math.max(0, adherenceComponent + sleepComponent + bioComponent + hrvComponent))
    );

    let readinessGrade: "APEX" | "COMBAT_READY" | "RECOVERING" | "COMPROMISED";
    if (readinessScore >= 85) readinessGrade = "APEX";
    else if (readinessScore >= 65) readinessGrade = "COMBAT_READY";
    else if (readinessScore >= 40) readinessGrade = "RECOVERING";
    else readinessGrade = "COMPROMISED";

    // ── 8. Week-over-week delta ──
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    const prevWeekCompletions = completions.filter(
      (c) => c.completedAt >= twoWeeksAgo && c.completedAt < sevenDaysAgo && c.completed
    );
    const prevWeekAdherence = activeProtocols.length > 0
      ? Math.round(
          (new Set(prevWeekCompletions.map((c) => `${c.protocolItemId}-${new Date(c.completedAt).toISOString().slice(0, 10)}`)).size /
            (activeProtocols.length * 7)) * 100
        )
      : 0;
    const adherenceDelta = overallAdherence - prevWeekAdherence;

    const prevSleep = sleepLogs.filter(
      (s) => s.loggedAt >= twoWeeksAgo && s.loggedAt < sevenDaysAgo
    );
    const prevSleepAvg = prevSleep.length > 0
      ? Math.round(prevSleep.reduce((s, l) => s + l.sleepScore, 0) / prevSleep.length)
      : null;
    const sleepDelta = sleepMetrics.avgScore != null && prevSleepAvg != null
      ? sleepMetrics.avgScore - prevSleepAvg
      : null;

    // Report period
    const periodStart = new Date(today);
    periodStart.setDate(periodStart.getDate() - 6);

    return {
      reportPeriod: {
        start: periodStart.toISOString().slice(0, 10),
        end: today.toISOString().slice(0, 10),
        generatedAt: now,
      },
      readinessScore,
      readinessGrade,
      scoreBreakdown: {
        adherence: { score: overallAdherence, weight: 35, contribution: Math.round(adherenceComponent) },
        sleep: { score: sleepMetrics.avgScore ?? 0, weight: 30, contribution: Math.round(sleepComponent) },
        biomarkers: { score: bioScore ?? 0, weight: 20, contribution: Math.round(bioComponent) },
        hrv: { score: avgHrv ? Math.min(100, Math.round((avgHrv / 80) * 100)) : 0, weight: 15, contribution: Math.round(hrvComponent) },
      },
      weekOverWeek: {
        adherenceDelta,
        sleepDelta,
      },
      sleepMetrics,
      biomarkerStatus,
      protocolStats,
      dailyAdherence,
      topCorrelations,
      failures,
      avgHrv,
      totalProtocols: activeProtocols.length,
      totalCompletions: recentCompletions.length,
    };
  },
});
