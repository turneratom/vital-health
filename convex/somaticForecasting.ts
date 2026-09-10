import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   AI-SOMATIC FORECASTING ENGINE
   
   Analyzes the last 7 days of biometric data to generate
   predictive "Biotic Prediction" cards. Moves the app from
   reactive to proactive by detecting accumulating debt in:
   
   • Sleep debt → cognitive clarity decline
   • HRV decline → autonomic dysregulation risk
   • Protocol drift → biomarker regression forecast
   • Inflammation trajectory → systemic risk escalation
   • Recovery deficit → overtraining threshold proximity
   
   Returns structured predictions with confidence scores,
   projected impact percentages, and corrective protocols.
   ═══════════════════════════════════════════════════════════════ */

/* ── Prediction Types ── */
export interface BioticPrediction {
  id: string;
  severity: "critical" | "warning" | "advisory" | "positive";
  icon: string;
  title: string;
  message: string;
  /** Projected impact metric (e.g., "15% cognitive decline") */
  impactMetric: string;
  /** Confidence 0-100 based on data density */
  confidence: number;
  /** Time horizon for the prediction */
  horizon: string;
  /** Corrective action if applicable */
  corrective: string | null;
  /** Which subsystems are involved */
  subsystems: string[];
  /** Trend data points for sparkline (7 values, normalized 0-100) */
  trendData: number[];
  /** Timestamp */
  generatedAt: number;
}

/* ── Thresholds ── */
const SLEEP_DEBT_THRESHOLD_HOURS = 3.5; // cumulative deficit over 7d
const HRV_DECLINE_PCT = 12; // % below 7d baseline
const ADHERENCE_CLIFF = 0.45; // below this = biomarker regression
const CRP_ESCALATION = 1.5; // mg/L trending upward
const RECOVERY_DEFICIT_DAYS = 3; // consecutive low-recovery days

export const getSomaticForecast = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    predictions: BioticPrediction[];
    overallRisk: "nominal" | "elevated" | "high" | "critical";
    riskScore: number;
    dataCompleteness: number;
    generatedAt: number;
  }> => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const predictions: BioticPrediction[] = [];

    try {
      /* ── 1. Gather 7-day data ── */

      // Sleep logs
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentSleep = sleepLogs
        .filter((s) => now - s.loggedAt < 7 * dayMs)
        .sort((a, b) => a.loggedAt - b.loggedAt);

      // HRV readings
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", now - 7 * dayMs)
        )
        .collect();

      // Protocol adherence
      const allProtocols = await ctx.db
        .query("protocols")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const activeProtocols = allProtocols.filter((p) => p.isActive);

      const allCompletions = await ctx.db
        .query("protocolCompletions")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", args.sessionId)
        )
        .collect();

      // Bio-Vault for current markers
      const bioVaultDocs = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const bioVault = bioVaultDocs.length > 0 ? bioVaultDocs[bioVaultDocs.length - 1] : null;

      // Somatic body map entries
      const bodyMapEntries = await ctx.db
        .query("bodyMapEntries")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - 7 * dayMs)
        )
        .collect();

      // Somatic feedback channels
      const somaticFeedback = await ctx.db
        .query("somaticFeedback")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - 7 * dayMs)
        )
        .collect();

      /* ── 2. Data completeness ── */
      let dataPoints = 0;
      if (recentSleep.length > 0) dataPoints++;
      if (hrvReadings.length > 0) dataPoints++;
      if (activeProtocols.length > 0) dataPoints++;
      if (bioVault) dataPoints++;
      if (bodyMapEntries.length > 0) dataPoints++;
      if (somaticFeedback.length > 0) dataPoints++;
      const dataCompleteness = Math.round((dataPoints / 6) * 100);

      /* ═══════════════════════════════════════════════════════
         PREDICTION 1: SLEEP DEBT ACCUMULATION
         ═══════════════════════════════════════════════════════ */
      if (recentSleep.length >= 3) {
        const optimalHours = 7.5;
        let cumulativeDebt = 0;
        const sleepTrend: number[] = [];
        const dailySleep: number[] = [];

        for (let d = 6; d >= 0; d--) {
          const dayStart = now - (d + 1) * dayMs;
          const dayEnd = now - d * dayMs;
          const dayLogs = recentSleep.filter(
            (s) => s.loggedAt >= dayStart && s.loggedAt < dayEnd
          );
          const hours = dayLogs.length > 0
            ? dayLogs.reduce((sum, s) => sum + (s.totalHours || 0), 0) / dayLogs.length
            : optimalHours; // assume optimal if no data
          dailySleep.push(hours);
          cumulativeDebt += Math.max(0, optimalHours - hours);
          sleepTrend.push(Math.min(100, Math.round((hours / 9) * 100)));
        }

        const avgSleepScore = recentSleep.length > 0
          ? recentSleep.reduce((s, l) => s + (l.sleepScore || 50), 0) / recentSleep.length
          : 50;

        // Consecutive poor nights
        let consecutivePoor = 0;
        for (let i = dailySleep.length - 1; i >= 0; i--) {
          if (dailySleep[i] < 6.5) consecutivePoor++;
          else break;
        }

        if (cumulativeDebt >= SLEEP_DEBT_THRESHOLD_HOURS) {
          const cognitiveDecline = Math.min(35, Math.round(cumulativeDebt * 3.2));
          const reactionTimeIncrease = Math.round(cumulativeDebt * 4.5);

          predictions.push({
            id: "sleep-debt-accumulation",
            severity: cumulativeDebt > 7 ? "critical" : "warning",
            icon: "🧠",
            title: "Sleep Debt Accumulation Detected",
            message: `${Math.round(cumulativeDebt * 10) / 10}h cumulative sleep deficit over 7 days${consecutivePoor >= 2 ? ` — ${consecutivePoor} consecutive sub-optimal nights` : ""}. Expect ${cognitiveDecline}% reduction in cognitive clarity and ${reactionTimeIncrease}ms slower reaction time tomorrow if protocol is skipped.`,
            impactMetric: `↓${cognitiveDecline}% cognitive clarity`,
            confidence: Math.min(92, 55 + recentSleep.length * 5),
            horizon: "Next 24-48h",
            corrective: consecutivePoor >= 3
              ? "Deploy emergency sleep protocol: Glycine 3g + Apigenin 50mg + Magnesium L-Threonate 500mg at T-60min. Block all screens T-90min. Target 9h tonight to begin debt recovery."
              : "Prioritize 8.5h sleep window tonight. Add Glycine 3g pre-bed. Avoid caffeine after 12pm. One recovery night can offset 40% of accumulated debt.",
            subsystems: ["sleep", "cognition", "recovery"],
            trendData: sleepTrend,
            generatedAt: now,
          });
        }

        // Positive: good sleep streak
        if (cumulativeDebt < 1 && avgSleepScore > 80 && recentSleep.length >= 5) {
          predictions.push({
            id: "sleep-optimization-positive",
            severity: "positive",
            icon: "✨",
            title: "Sleep Architecture Optimized",
            message: `7-day sleep score averaging ${Math.round(avgSleepScore)}/100 with minimal debt. Deep sleep cycles are compounding — expect enhanced memory consolidation and growth hormone pulsatility.`,
            impactMetric: `↑${Math.round((avgSleepScore - 70) * 0.8)}% recovery rate`,
            confidence: 88,
            horizon: "Sustained",
            corrective: null,
            subsystems: ["sleep", "recovery", "hormonal"],
            trendData: sleepTrend,
            generatedAt: now,
          });
        }
      }

      /* ═══════════════════════════════════════════════════════
         PREDICTION 2: HRV DECLINE → AUTONOMIC DYSREGULATION
         ═══════════════════════════════════════════════════════ */
      if (hrvReadings.length >= 4) {
        const sorted = [...hrvReadings].sort((a, b) => a.measuredAt - b.measuredAt);
        const avg7d = sorted.reduce((s, r) => s + r.value, 0) / sorted.length;
        const recentHalf = sorted.slice(Math.floor(sorted.length / 2));
        const earlyHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const recentAvg = recentHalf.reduce((s, r) => s + r.value, 0) / (recentHalf.length || 1);
        const earlyAvg = earlyHalf.reduce((s, r) => s + r.value, 0) / (earlyHalf.length || 1);
        const declinePct = earlyAvg > 0 ? ((earlyAvg - recentAvg) / earlyAvg) * 100 : 0;
        const latestHrv = sorted[sorted.length - 1]?.value || 0;

        // Build trend
        const hrvTrend: number[] = [];
        for (let d = 6; d >= 0; d--) {
          const dayStart = now - (d + 1) * dayMs;
          const dayEnd = now - d * dayMs;
          const dayReadings = sorted.filter(
            (r) => r.measuredAt >= dayStart && r.measuredAt < dayEnd
          );
          const dayAvg = dayReadings.length > 0
            ? dayReadings.reduce((s, r) => s + r.value, 0) / dayReadings.length
            : avg7d;
          hrvTrend.push(Math.min(100, Math.round((dayAvg / 120) * 100)));
        }

        if (declinePct > HRV_DECLINE_PCT) {
          const autonomicRisk = Math.min(40, Math.round(declinePct * 1.8));

          predictions.push({
            id: "hrv-autonomic-decline",
            severity: declinePct > 25 ? "critical" : "warning",
            icon: "💓",
            title: "Autonomic Nervous System Under Strain",
            message: `HRV declining ${Math.round(declinePct)}% over 7 days (${Math.round(earlyAvg)}ms → ${Math.round(recentAvg)}ms). Sympathetic dominance increasing — ${autonomicRisk}% elevated risk of immune suppression and cortisol dysregulation within 72h if trajectory continues.`,
            impactMetric: `↓${Math.round(declinePct)}% HRV baseline`,
            confidence: Math.min(90, 50 + hrvReadings.length * 4),
            horizon: "Next 48-72h",
            corrective: declinePct > 20
              ? "Activate parasympathetic recovery: Box breathing 5min (4-4-4-4), cold exposure 2min, reduce training intensity 30% for 48h. Consider Ashwagandha KSM-66 600mg PM."
              : "Increase vagal tone: 10min slow breathing before bed, reduce stimulant intake, add 15min nature walk. Monitor for 48h before resuming full intensity.",
            subsystems: ["autonomic", "immune", "hormonal"],
            trendData: hrvTrend,
            generatedAt: now,
          });
        }

        // Positive: HRV improving
        if (declinePct < -8 && latestHrv > 55) {
          predictions.push({
            id: "hrv-improvement-positive",
            severity: "positive",
            icon: "💚",
            title: "Autonomic Resilience Strengthening",
            message: `HRV trending up ${Math.round(Math.abs(declinePct))}% — parasympathetic tone is recovering. Current ${Math.round(latestHrv)}ms indicates strong vagal function and stress adaptability.`,
            impactMetric: `↑${Math.round(Math.abs(declinePct))}% autonomic capacity`,
            confidence: 85,
            horizon: "Sustained",
            corrective: null,
            subsystems: ["autonomic", "recovery"],
            trendData: hrvTrend,
            generatedAt: now,
          });
        }
      }

      /* ═══════════════════════════════════════════════════════
         PREDICTION 3: PROTOCOL DRIFT → BIOMARKER REGRESSION
         ═══════════════════════════════════════════════════════ */
      if (activeProtocols.length > 0) {
        const dailyRates: number[] = [];
        for (let d = 6; d >= 0; d--) {
          const date = new Date(now - d * dayMs);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const dayCompletions = allCompletions.filter(
            (c) => c.dateKey === dateKey && c.completed
          );
          dailyRates.push(Math.min(1, dayCompletions.length / (activeProtocols.length || 1)));
        }

        const avg7dAdherence = dailyRates.reduce((s, r) => s + r, 0) / dailyRates.length;
        const last3dAdherence = dailyRates.slice(-3).reduce((s, r) => s + r, 0) / 3;
        const adherenceTrend = dailyRates.map((r) => Math.round(r * 100));

        // Declining adherence trend
        const earlyAdherence = dailyRates.slice(0, 3).reduce((s, r) => s + r, 0) / 3;
        const adherenceDecline = earlyAdherence - last3dAdherence;

        if (avg7dAdherence < ADHERENCE_CLIFF || (adherenceDecline > 0.25 && last3dAdherence < 0.6)) {
          const regressionPct = Math.min(25, Math.round((1 - avg7dAdherence) * 30));
          const daysToRegression = Math.max(3, Math.round(14 * avg7dAdherence));

          predictions.push({
            id: "protocol-drift-regression",
            severity: avg7dAdherence < 0.3 ? "critical" : "warning",
            icon: "📉",
            title: "Protocol Drift — Biomarker Regression Imminent",
            message: `Protocol adherence at ${Math.round(avg7dAdherence * 100)}% over 7 days${adherenceDecline > 0.2 ? ` (declining from ${Math.round(earlyAdherence * 100)}% → ${Math.round(last3dAdherence * 100)}%)` : ""}. At current trajectory, expect ${regressionPct}% biomarker regression within ${daysToRegression} days. Vitamin D, testosterone, and inflammation markers are most vulnerable.`,
            impactMetric: `↓${regressionPct}% biomarker integrity`,
            confidence: Math.min(88, 50 + activeProtocols.length * 3 + allCompletions.length),
            horizon: `${daysToRegression} days`,
            corrective: avg7dAdherence < 0.3
              ? "Critical: Resume minimum viable protocol immediately — focus on top 3 highest-impact items. Even 50% adherence halts regression. Rebuild momentum with morning anchor protocol."
              : "Stabilize adherence above 60% to prevent regression. Identify friction points — simplify protocol stack if needed. Consistency beats intensity.",
            subsystems: ["adherence", "biomarkers", "longevity"],
            trendData: adherenceTrend,
            generatedAt: now,
          });
        }

        // Positive: high adherence
        if (avg7dAdherence > 0.85 && last3dAdherence > 0.8) {
          predictions.push({
            id: "adherence-compounding",
            severity: "positive",
            icon: "🔥",
            title: "Protocol Compounding Active",
            message: `${Math.round(avg7dAdherence * 100)}% adherence sustained — biological compounding is accelerating. Each consecutive day above 80% amplifies biomarker improvement by ~2.3%. Maintain trajectory for exponential gains.`,
            impactMetric: `↑${Math.round(avg7dAdherence * 100)}% stack integrity`,
            confidence: 90,
            horizon: "Compounding",
            corrective: null,
            subsystems: ["adherence", "longevity"],
            trendData: adherenceTrend,
            generatedAt: now,
          });
        }
      }

      /* ═══════════════════════════════════════════════════════
         PREDICTION 4: INFLAMMATION TRAJECTORY
         ═══════════════════════════════════════════════════════ */
      if (bioVault?.crp != null) {
        const crp = bioVault.crp;
        // Check somatic tension as inflammation proxy
        const recentTension = bodyMapEntries
          .filter((e) => now - e.loggedAt < 3 * dayMs)
          .map((e) => e.severity);
        const avgTension = recentTension.length > 0
          ? recentTension.reduce((s, v) => s + v, 0) / recentTension.length
          : 0;

        // Build inflammation proxy trend from body map + CRP
        const inflammTrend: number[] = [];
        for (let d = 6; d >= 0; d--) {
          const dayStart = now - (d + 1) * dayMs;
          const dayEnd = now - d * dayMs;
          const dayEntries = bodyMapEntries.filter(
            (e) => e.loggedAt >= dayStart && e.loggedAt < dayEnd
          );
          const daySeverity = dayEntries.length > 0
            ? dayEntries.reduce((s, e) => s + e.severity, 0) / dayEntries.length
            : avgTension;
          inflammTrend.push(Math.min(100, Math.round(daySeverity * 10)));
        }

        if (crp > CRP_ESCALATION && avgTension > 4) {
          const escalationRisk = Math.min(45, Math.round(crp * 8 + avgTension * 3));

          predictions.push({
            id: "inflammation-escalation",
            severity: crp > 3 ? "critical" : "warning",
            icon: "🔥",
            title: "Systemic Inflammation Escalating",
            message: `hs-CRP at ${crp} mg/L with somatic tension averaging ${Math.round(avgTension * 10) / 10}/10. Dual-signal convergence indicates ${escalationRisk}% probability of immune cascade within 5 days. NF-κB pathway likely upregulated.`,
            impactMetric: `${escalationRisk}% immune cascade risk`,
            confidence: Math.min(90, 60 + (recentTension.length > 3 ? 20 : 10)),
            horizon: "3-5 days",
            corrective: crp > 3
              ? "Deploy anti-inflammatory protocol: EPA 4g + Curcumin 1g + eliminate seed oils. Cold exposure 3min AM. Reduce training to zone 2 only for 72h."
              : "Increase omega-3 intake to 2g EPA/day. Add turmeric to meals. Prioritize 8h sleep — cortisol reduction is the fastest CRP lever.",
            subsystems: ["inflammation", "immune", "somatic"],
            trendData: inflammTrend,
            generatedAt: now,
          });
        }
      }

      /* ═══════════════════════════════════════════════════════
         PREDICTION 5: RECOVERY DEFICIT → OVERTRAINING RISK
         ═══════════════════════════════════════════════════════ */
      {
        // Use somatic feedback channels for recovery proxy
        const energyReadings = somaticFeedback
          .filter((f) => f.channel === "energy_flux" || f.channel === "recovery")
          .sort((a, b) => a.loggedAt - b.loggedAt);

        const recoveryTrend: number[] = [];
        let consecutiveLowDays = 0;

        for (let d = 6; d >= 0; d--) {
          const dayStart = now - (d + 1) * dayMs;
          const dayEnd = now - d * dayMs;
          const dayReadings = energyReadings.filter(
            (r) => r.loggedAt >= dayStart && r.loggedAt < dayEnd
          );
          const dayVal = dayReadings.length > 0
            ? dayReadings.reduce((s, r) => s + r.value, 0) / dayReadings.length
            : 50;
          recoveryTrend.push(Math.round(dayVal));

          if (d <= 2 && dayVal < 40) consecutiveLowDays++;
        }

        const recentRecovery = recoveryTrend.slice(-3);
        const avgRecentRecovery = recentRecovery.reduce((s, v) => s + v, 0) / 3;

        if (consecutiveLowDays >= RECOVERY_DEFICIT_DAYS || avgRecentRecovery < 35) {
          const overtrainingRisk = Math.min(50, Math.round((50 - avgRecentRecovery) * 1.5));

          predictions.push({
            id: "recovery-deficit-overtraining",
            severity: consecutiveLowDays >= 3 ? "critical" : "warning",
            icon: "⚡",
            title: "Recovery Deficit — Overtraining Threshold",
            message: `${consecutiveLowDays} consecutive days below recovery baseline. Energy flux at ${Math.round(avgRecentRecovery)}% — approaching overtraining threshold. Continued high-intensity output risks cortisol spike, testosterone suppression, and immune compromise.`,
            impactMetric: `${overtrainingRisk}% overtraining risk`,
            confidence: Math.min(85, 50 + energyReadings.length * 3),
            horizon: "Next 24-48h",
            corrective: "Mandatory deload: reduce training volume 50% for 48h. Prioritize sleep, sauna 20min, and protein intake 1.6g/kg. Resume intensity only when recovery exceeds 60%.",
            subsystems: ["recovery", "hormonal", "immune"],
            trendData: recoveryTrend,
            generatedAt: now,
          });
        }
      }

      /* ═══════════════════════════════════════════════════════
         PREDICTION 6: SOMATIC TENSION PATTERN RECOGNITION
         ═══════════════════════════════════════════════════════ */
      if (bodyMapEntries.length >= 3) {
        // Find recurring tension regions
        const regionCounts: Record<string, { count: number; totalSeverity: number }> = {};
        for (const entry of bodyMapEntries) {
          if (!regionCounts[entry.region]) {
            regionCounts[entry.region] = { count: 0, totalSeverity: 0 };
          }
          regionCounts[entry.region].count++;
          regionCounts[entry.region].totalSeverity += entry.severity;
        }

        const chronicRegions = Object.entries(regionCounts)
          .filter(([_, data]) => data.count >= 3 && data.totalSeverity / data.count >= 5)
          .sort((a, b) => b[1].totalSeverity - a[1].totalSeverity);

        if (chronicRegions.length > 0) {
          const topRegion = chronicRegions[0];
          const avgSeverity = Math.round((topRegion[1].totalSeverity / topRegion[1].count) * 10) / 10;

          const tensionTrend: number[] = [];
          for (let d = 6; d >= 0; d--) {
            const dayStart = now - (d + 1) * dayMs;
            const dayEnd = now - d * dayMs;
            const dayEntries = bodyMapEntries.filter(
              (e) => e.region === topRegion[0] && e.loggedAt >= dayStart && e.loggedAt < dayEnd
            );
            const dayMax = dayEntries.length > 0
              ? Math.max(...dayEntries.map((e) => e.severity))
              : 0;
            tensionTrend.push(dayMax * 10);
          }

          predictions.push({
            id: `chronic-tension-${topRegion[0]}`,
            severity: avgSeverity >= 7 ? "warning" : "advisory",
            icon: "🎯",
            title: `Chronic Tension Pattern: ${topRegion[0].charAt(0).toUpperCase() + topRegion[0].slice(1)}`,
            message: `${topRegion[0]} region logged ${topRegion[1].count} times in 7 days at avg ${avgSeverity}/10 severity. Persistent somatic holding patterns indicate fascial adhesion risk and localized inflammation. Without intervention, expect mobility restriction within 10-14 days.`,
            impactMetric: `${topRegion[1].count}× in 7d at ${avgSeverity}/10`,
            confidence: Math.min(85, 50 + topRegion[1].count * 8),
            horizon: "10-14 days",
            corrective: `Targeted myofascial release for ${topRegion[0]} — foam roll 5min daily + targeted stretching. Consider BPC-157 if severity persists above 6/10 for >10 days.`,
            subsystems: ["somatic", "mobility", "inflammation"],
            trendData: tensionTrend,
            generatedAt: now,
          });
        }
      }

      /* ── Sort predictions by severity ── */
      const severityOrder: Record<string, number> = {
        critical: 0, warning: 1, advisory: 2, positive: 3,
      };
      predictions.sort((a, b) => {
        const sDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sDiff !== 0) return sDiff;
        return b.confidence - a.confidence;
      });

      /* ── Overall risk assessment ── */
      const criticalCount = predictions.filter((p) => p.severity === "critical").length;
      const warningCount = predictions.filter((p) => p.severity === "warning").length;
      const riskScore = Math.min(100, criticalCount * 30 + warningCount * 15);
      const overallRisk: "nominal" | "elevated" | "high" | "critical" =
        criticalCount >= 2 ? "critical"
        : criticalCount >= 1 ? "high"
        : warningCount >= 2 ? "elevated"
        : "nominal";

      return {
        predictions,
        overallRisk,
        riskScore,
        dataCompleteness,
        generatedAt: now,
      };
    } catch (error) {
      return {
        predictions: [],
        overallRisk: "nominal",
        riskScore: 0,
        dataCompleteness: 0,
        generatedAt: now,
      };
    }
  },
});
