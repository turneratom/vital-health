import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   RECOVERY INDEX ENGINE
   
   Calculates a 0-100 recovery score based on:
   - Last night's sleep quality (40% weight)
   - HRV trend (25% weight)
   - Protocol adherence yesterday (20% weight)
   - Somatic feedback (15% weight)
   
   Returns the score + 3 contextual recommendations.
   ═══════════════════════════════════════════════════════════════ */

interface RecoveryBreakdown {
  sleepScore: number;
  sleepRaw: number | null;
  hrvScore: number;
  hrvRaw: number | null;
  hrvTrend: string;
  adherenceScore: number;
  adherenceRaw: number | null;
  somaticScore: number;
  somaticRaw: number | null;
}

interface RecoveryRecommendation {
  icon: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  accentColor: string;
}

export const getRecoveryIndex = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    score: number;
    tier: string;
    tierColor: string;
    breakdown: RecoveryBreakdown;
    recommendations: RecoveryRecommendation[];
    lastUpdated: number;
  }> => {
    const { sessionId } = args;
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayKey = yesterdayStart.toISOString().slice(0, 10);

    // ── 1. Sleep Quality (40% weight) ──
    // Pull latest sleep log
    let sleepRaw: number | null = null;
    let sleepComponent = 50; // default if no data
    try {
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .order("desc")
        .take(1);
      if (sleepLogs.length > 0) {
        const latest = sleepLogs[0];
        sleepRaw = latest.sleepScore;
        sleepComponent = Math.min(100, Math.max(0, latest.sleepScore));
      } else {
        // Fallback to bioVault sleepScore
        const vault = await ctx.db
          .query("bioVault")
          .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
          .first();
        if (vault?.sleepScore) {
          sleepRaw = vault.sleepScore;
          sleepComponent = Math.min(100, Math.max(0, vault.sleepScore));
        }
      }
    } catch { /* use default */ }

    // ── 2. HRV Trend (25% weight) ──
    let hrvRaw: number | null = null;
    let hrvTrend = "stable";
    let hrvComponent = 50;
    try {
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", sessionId)
        )
        .order("desc")
        .take(14);
      if (hrvReadings.length > 0) {
        const latest = hrvReadings[0].value;
        hrvRaw = latest;
        // Calculate 7-day average
        const values = hrvReadings.map((r: any) => r.value);
        const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
        // HRV score: normalize to 0-100 (baseline ~50ms avg, elite ~80ms+)
        hrvComponent = Math.min(100, Math.max(0, (latest / 80) * 100));
        // Trend detection
        if (values.length >= 3) {
          const recent = values.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
          if (recent > avg * 1.05) hrvTrend = "improving";
          else if (recent < avg * 0.95) hrvTrend = "declining";
          else hrvTrend = "stable";
        }
      } else {
        // Fallback to bioVault
        const vault = await ctx.db
          .query("bioVault")
          .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
          .first();
        if (vault?.hrvCurrent) {
          hrvRaw = vault.hrvCurrent;
          hrvComponent = Math.min(100, Math.max(0, (vault.hrvCurrent / 80) * 100));
          if (vault.hrvTrend) hrvTrend = vault.hrvTrend;
        }
      }
    } catch { /* use default */ }

    // ── 3. Protocol Adherence Yesterday (20% weight) ──
    let adherenceRaw: number | null = null;
    let adherenceComponent = 50;
    try {
      // Check adherenceScores table first
      const adherenceRecord = await ctx.db
        .query("adherenceScores")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", sessionId).eq("dateKey", yesterdayKey)
        )
        .first();
      if (adherenceRecord) {
        adherenceRaw = adherenceRecord.adherencePercent;
        adherenceComponent = Math.min(100, Math.max(0, adherenceRecord.adherencePercent));
      } else {
        // Fallback: count protocol logs from yesterday
        const logs = await ctx.db
          .query("protocolLogs")
          .withIndex("by_sessionId_and_loggedAt", (q: any) =>
            q.eq("sessionId", sessionId).gte("loggedAt", yesterdayStart.getTime())
          )
          .collect();
        const yesterdayLogs = logs.filter((l: any) => l.loggedAt < todayStart.getTime());
        if (yesterdayLogs.length > 0) {
          // Estimate: each completed protocol = ~15% adherence, cap at 100
          adherenceRaw = Math.min(100, yesterdayLogs.length * 15);
          adherenceComponent = adherenceRaw;
        }
      }
    } catch { /* use default */ }

    // ── 4. Somatic Feedback (15% weight) ──
    let somaticRaw: number | null = null;
    let somaticComponent = 50;
    try {
      const somaticLogs = await ctx.db
        .query("somaticFeedback")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", sessionId)
        )
        .order("desc")
        .take(6);
      if (somaticLogs.length > 0) {
        // Average the most recent somatic values (0-100 scale)
        const avg = somaticLogs.reduce((sum: number, l: any) => sum + l.value, 0) / somaticLogs.length;
        somaticRaw = Math.round(avg);
        somaticComponent = Math.min(100, Math.max(0, avg));
      }
    } catch { /* use default */ }

    // ── Calculate weighted score ──
    const score = Math.round(
      sleepComponent * 0.40 +
      hrvComponent * 0.25 +
      adherenceComponent * 0.20 +
      somaticComponent * 0.15
    );

    // ── Tier classification ──
    let tier: string;
    let tierColor: string;
    if (score >= 80) { tier = "PEAK"; tierColor = "#00FFCC"; }
    else if (score >= 60) { tier = "READY"; tierColor = "#3B82F6"; }
    else if (score >= 40) { tier = "MODERATE"; tierColor = "#E8976C"; }
    else { tier = "DEPLETED"; tierColor = "#FF6B6B"; }

    // ── Generate recommendations ──
    const recommendations: RecoveryRecommendation[] = [];

    if (score < 60) {
      recommendations.push({
        icon: "🛡️",
        title: "Deload Day Recommended",
        description: "Recovery is below threshold. Reduce training intensity by 40-50%. Focus on mobility, Zone 1 cardio, and active recovery protocols.",
        priority: "high",
        accentColor: "#FF6B6B",
      });
    } else if (score < 80) {
      recommendations.push({
        icon: "⚡",
        title: "Normal Training Load",
        description: "Recovery supports standard training. Maintain current protocol intensity. Monitor HRV mid-session for auto-regulation.",
        priority: "medium",
        accentColor: "#3B82F6",
      });
    } else {
      recommendations.push({
        icon: "🔥",
        title: "Push Intensity Today",
        description: "Recovery is optimal. Consider progressive overload, higher volume, or tackling your hardest training session of the week.",
        priority: "low",
        accentColor: "#00FFCC",
      });
    }

    // Sleep-specific recommendation
    if (sleepComponent < 60) {
      recommendations.push({
        icon: "😴",
        title: "Sleep Debt Detected",
        description: `Sleep quality at ${sleepRaw ?? 'unknown'}. Prioritize 9pm screen-off protocol tonight. Consider magnesium glycinate 400mg before bed.`,
        priority: "high",
        accentColor: "#AF82FF",
      });
    } else if (hrvTrend === "declining") {
      recommendations.push({
        icon: "📉",
        title: "HRV Trending Down",
        description: "Autonomic nervous system showing stress accumulation. Add 10-min breathwork session and consider reducing stimulant intake.",
        priority: "medium",
        accentColor: "#E8976C",
      });
    } else {
      recommendations.push({
        icon: "🧬",
        title: "Bio-Systems Aligned",
        description: "HRV and sleep architecture are supporting recovery. Maintain current supplement timing and sleep hygiene protocols.",
        priority: "low",
        accentColor: "#00DC82",
      });
    }

    // Adherence recommendation
    if (adherenceComponent < 50) {
      recommendations.push({
        icon: "📋",
        title: "Protocol Adherence Gap",
        description: "Yesterday's protocol completion was below 50%. Consistency compounds — even partial completion beats skipping entirely.",
        priority: "medium",
        accentColor: "#FFB86B",
      });
    } else {
      recommendations.push({
        icon: "✅",
        title: "Strong Protocol Adherence",
        description: `${adherenceRaw ?? 'Good'}% completion yesterday. This consistency is directly improving your biological trajectory.`,
        priority: "low",
        accentColor: "#00DC82",
      });
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      tier,
      tierColor,
      breakdown: {
        sleepScore: Math.round(sleepComponent),
        sleepRaw,
        hrvScore: Math.round(hrvComponent),
        hrvRaw,
        hrvTrend,
        adherenceScore: Math.round(adherenceComponent),
        adherenceRaw,
        somaticScore: Math.round(somaticComponent),
        somaticRaw,
      },
      recommendations: recommendations.slice(0, 3),
      lastUpdated: now,
    };
  },
});
