import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROACTIVE PERFORMANCE COACH ENGINE
   
   Analyzes 7 days of vitals + protocol completion data to detect
   negative trends and generate specific correction protocols.
   Also tracks personal bests for encouragement context.
   ═══════════════════════════════════════════════════════════════ */

interface TrendAlert {
  id: string;
  severity: "warning" | "critical";
  metric: string;
  title: string;
  description: string;
  correctionProtocol: string;
  icon: string;
  color: string;
  delta: number;
  unit: string;
}

interface PersonalBest {
  metric: string;
  value: number;
  unit: string;
  date: string;
  icon: string;
}

interface NearRecord {
  metric: string;
  currentValue: number;
  bestValue: number;
  unit: string;
  percentAway: number;
  encouragement: string;
  icon: string;
}

// ── Analyze 7-day trends and detect negative patterns ──
export const analyzeWeeklyTrends = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const cutoff14d = now - 14 * 24 * 60 * 60 * 1000;
    const cutoff90d = now - 90 * 24 * 60 * 60 * 1000;

    // ── Fetch Elite Scores (HRV, recovery proxy) ──
    const allScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const scores7d = allScores
      .filter((s) => s.calculatedAt >= cutoff7d)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);
    const scoresPrev7d = allScores
      .filter((s) => s.calculatedAt >= cutoff14d && s.calculatedAt < cutoff7d)
      .sort((a, b) => a.calculatedAt - b.calculatedAt);

    // ── Fetch Protocol Completions ──
    const allCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const completions7d = allCompletions.filter(
      (c) => c.completedAt >= cutoff7d && c.completed
    );
    const completionsPrev7d = allCompletions.filter(
      (c) => c.completedAt >= cutoff14d && c.completedAt < cutoff7d && c.completed
    );

    // ── Fetch Active Protocols count ──
    const activeProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeCount = activeProtocols.filter((p) => p.isActive).length;

    // ── Fetch Sleep data from daily directives ──
    const directives = await ctx.db
      .query("dailyDirectives")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const directives7d = directives
      .filter((d) => d.generatedAt >= cutoff7d)
      .sort((a, b) => a.generatedAt - b.generatedAt);
    const directivesPrev7d = directives
      .filter((d) => d.generatedAt >= cutoff14d && d.generatedAt < cutoff7d)
      .sort((a, b) => a.generatedAt - b.generatedAt);

    // ── Fetch Food Logs for nutrition trends ──
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const food7d = foodLogs.filter((l) => l.loggedAt >= cutoff7d);
    const foodPrev7d = foodLogs.filter(
      (l) => l.loggedAt >= cutoff14d && l.loggedAt < cutoff7d
    );

    // ── Fetch Activity Logs ──
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activity7d = activityLogs.filter((l) => l.loggedAt >= cutoff7d);
    const activityPrev7d = activityLogs.filter(
      (l) => l.loggedAt >= cutoff14d && l.loggedAt < cutoff7d
    );

    // ── Bio Vault for context ──
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // ═══════════════════════════════════════════
    // TREND ANALYSIS
    // ═══════════════════════════════════════════
    const alerts: TrendAlert[] = [];

    // ── 1. HRV Trend Analysis ──
    if (scores7d.length >= 2) {
      const hrvValues7d = scores7d.map((s) => s.currentHrv);
      const avgHrv7d =
        hrvValues7d.reduce((s, v) => s + v, 0) / hrvValues7d.length;

      if (scoresPrev7d.length >= 2) {
        const hrvValuesPrev = scoresPrev7d.map((s) => s.currentHrv);
        const avgHrvPrev =
          hrvValuesPrev.reduce((s, v) => s + v, 0) / hrvValuesPrev.length;
        const hrvDelta = ((avgHrv7d - avgHrvPrev) / avgHrvPrev) * 100;

        if (hrvDelta <= -10) {
          alerts.push({
            id: "hrv-decline",
            severity: hrvDelta <= -20 ? "critical" : "warning",
            metric: "HRV",
            title: `HRV dropped ${Math.abs(Math.round(hrvDelta))}% this week`,
            description: `Your 7-day HRV average fell from ${Math.round(avgHrvPrev)}ms to ${Math.round(avgHrv7d)}ms. This indicates increased sympathetic nervous system activation and incomplete recovery.`,
            correctionProtocol:
              "Skip tonight's high-intensity workout. Replace with 30 min zone 2 cardio (HR < 130 bpm). Add 400mg magnesium glycinate before bed and practice 5 min box breathing.",
            icon: "\u2764\uFE0F",
            color: "#FF453A",
            delta: Math.round(hrvDelta),
            unit: "ms",
          });
        }
      }

      // Check for declining HRV trend within the week (last 3 days vs first 3)
      if (hrvValues7d.length >= 4) {
        const half = Math.floor(hrvValues7d.length / 2);
        const firstHalf = hrvValues7d.slice(0, half);
        const secondHalf = hrvValues7d.slice(half);
        const avgFirst =
          firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
        const avgSecond =
          secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
        const intraWeekDelta = ((avgSecond - avgFirst) / avgFirst) * 100;

        if (
          intraWeekDelta <= -12 &&
          !alerts.find((a) => a.id === "hrv-decline")
        ) {
          alerts.push({
            id: "hrv-intraweek-dip",
            severity: "warning",
            metric: "HRV",
            title: "HRV trending down mid-week",
            description: `Your HRV has dipped ${Math.abs(Math.round(intraWeekDelta))}% in the last few days. Early intervention can prevent a full recovery deficit.`,
            correctionProtocol:
              "Prioritize parasympathetic activation: cold exposure (2 min, 55\u00B0F), nasal breathing drills, and ensure 8+ hours sleep tonight. Reduce training volume by 30% tomorrow.",
            icon: "\u26A0\uFE0F",
            color: "#FF9F0A",
            delta: Math.round(intraWeekDelta),
            unit: "ms",
          });
        }
      }
    }

    // ── 2. Sleep Quality Trend ──
    if (directives7d.length >= 2) {
      const sleepScores7d = directives7d
        .filter((d) => d.sleepScore != null)
        .map((d) => d.sleepScore!);
      const sleepHours7d = directives7d
        .filter((d) => d.sleepHours != null)
        .map((d) => d.sleepHours!);

      if (sleepScores7d.length >= 2 && directivesPrev7d.length >= 2) {
        const avgSleep7d =
          sleepScores7d.reduce((s, v) => s + v, 0) / sleepScores7d.length;
        const prevSleepScores = directivesPrev7d
          .filter((d) => d.sleepScore != null)
          .map((d) => d.sleepScore!);
        if (prevSleepScores.length >= 2) {
          const avgSleepPrev =
            prevSleepScores.reduce((s, v) => s + v, 0) /
            prevSleepScores.length;
          const sleepDelta =
            ((avgSleep7d - avgSleepPrev) / avgSleepPrev) * 100;

          if (sleepDelta <= -15) {
            alerts.push({
              id: "sleep-decline",
              severity: sleepDelta <= -25 ? "critical" : "warning",
              metric: "Sleep",
              title: `Sleep quality dropped ${Math.abs(Math.round(sleepDelta))}%`,
              description: `Average sleep score fell from ${Math.round(avgSleepPrev)} to ${Math.round(avgSleep7d)}. Poor sleep compounds recovery deficits and attenuates hormonal optimization.`,
              correctionProtocol:
                "Enforce a 10:00 PM digital sunset. Room temperature to 65-67\u00B0F. Add L-theanine 200mg + magnesium glycinate 400mg at T-60 min before bed. No caffeine after 12 PM.",
              icon: "\uD83D\uDE34",
              color: "#6366F1",
              delta: Math.round(sleepDelta),
              unit: "pts",
            });
          }
        }
      }

      // Check for consistently low sleep hours
      if (sleepHours7d.length >= 3) {
        const avgHours =
          sleepHours7d.reduce((s, v) => s + v, 0) / sleepHours7d.length;
        if (avgHours < 6.5) {
          alerts.push({
            id: "sleep-deficit",
            severity: avgHours < 6 ? "critical" : "warning",
            metric: "Sleep",
            title: `Averaging only ${avgHours.toFixed(1)}h sleep`,
            description: `You're accumulating a significant sleep debt. Below 7h, cortisol dysregulation begins impacting glucose metabolism, protein synthesis, and cognitive performance.`,
            correctionProtocol:
              "Non-negotiable: lights out by 10 PM for the next 3 nights. Cancel any early morning training. Your body needs to clear this sleep debt before performance optimization can resume.",
            icon: "\uD83D\uDCA4",
            color: "#8B5CF6",
            delta: Math.round((avgHours - 7.5) * 10) / 10,
            unit: "hrs",
          });
        }
      }
    }

    // ── 3. Protocol Adherence Trend ──
    if (activeCount > 0) {
      // Group completions by day
      const days7d = new Set(completions7d.map((c) => c.dateKey));
      const daysPrev7d = new Set(completionsPrev7d.map((c) => c.dateKey));
      const avgAdherence7d =
        days7d.size > 0 ? completions7d.length / (days7d.size * activeCount) : 0;
      const avgAdherencePrev =
        daysPrev7d.size > 0
          ? completionsPrev7d.length / (daysPrev7d.size * activeCount)
          : 0;

      if (
        avgAdherencePrev > 0 &&
        avgAdherence7d < avgAdherencePrev * 0.7 &&
        avgAdherence7d < 0.6
      ) {
        const adherenceDelta =
          ((avgAdherence7d - avgAdherencePrev) / avgAdherencePrev) * 100;
        alerts.push({
          id: "protocol-slip",
          severity: avgAdherence7d < 0.3 ? "critical" : "warning",
          metric: "Protocols",
          title: `Protocol adherence dropped ${Math.abs(Math.round(adherenceDelta))}%`,
          description: `You completed ${Math.round(avgAdherence7d * 100)}% of your daily stack this week vs ${Math.round(avgAdherencePrev * 100)}% last week. Consistency is the highest-leverage variable in your optimization.`,
          correctionProtocol:
            "Simplify: focus on your top 3 highest-impact protocols only. Anchor them to existing habits (morning coffee = Vitamin D, post-workout = creatine, bedtime = magnesium). Rebuild momentum before adding complexity.",
          icon: "\uD83D\uDCCB",
          color: "#BF5AF2",
          delta: Math.round(adherenceDelta),
          unit: "%",
        });
      }
    }

    // ── 4. Activity/Movement Decline ──
    if (activity7d.length >= 0 && activityPrev7d.length > 0) {
      const totalMin7d = activity7d.reduce((s, a) => s + a.duration, 0);
      const totalMinPrev = activityPrev7d.reduce((s, a) => s + a.duration, 0);

      if (totalMinPrev > 0) {
        const activityDelta =
          ((totalMin7d - totalMinPrev) / totalMinPrev) * 100;
        if (activityDelta <= -40 && totalMin7d < 120) {
          alerts.push({
            id: "activity-decline",
            severity: "warning",
            metric: "Activity",
            title: `Movement down ${Math.abs(Math.round(activityDelta))}% this week`,
            description: `Only ${totalMin7d} minutes of activity logged vs ${totalMinPrev} last week. Movement is a primary driver of HRV recovery, insulin sensitivity, and BDNF production.`,
            correctionProtocol:
              "Start with a 20-minute walk today \u2014 no excuses. Zone 2 cardio is the most underrated longevity intervention. Aim for 150 min/week minimum to maintain metabolic health.",
            icon: "\uD83C\uDFC3",
            color: "#30D158",
            delta: Math.round(activityDelta),
            unit: "min",
          });
        }
      }
    }

    // ── 5. Nutrition Decline ──
    if (food7d.length >= 0 && foodPrev7d.length > 0) {
      const avgProtein7d =
        food7d.length > 0
          ? food7d.reduce((s, f) => s + f.protein, 0) / Math.max(1, new Set(food7d.map((f) => new Date(f.loggedAt).toDateString())).size)
          : 0;
      const avgProteinPrev =
        foodPrev7d.length > 0
          ? foodPrev7d.reduce((s, f) => s + f.protein, 0) / Math.max(1, new Set(foodPrev7d.map((f) => new Date(f.loggedAt).toDateString())).size)
          : 0;

      if (avgProteinPrev > 0 && avgProtein7d < avgProteinPrev * 0.7 && avgProtein7d < 100) {
        alerts.push({
          id: "protein-decline",
          severity: "warning",
          metric: "Nutrition",
          title: `Daily protein dropped to ${Math.round(avgProtein7d)}g`,
          description: `Your average daily protein fell from ${Math.round(avgProteinPrev)}g to ${Math.round(avgProtein7d)}g. Below 1g/lb bodyweight, muscle protein synthesis is suboptimal.`,
          correctionProtocol:
            "Add a protein-forward meal: 40g+ at each sitting. Quick wins: Greek yogurt (20g), protein shake (30g), or 6oz chicken breast (42g). Front-load protein at breakfast.",
          icon: "\uD83E\uDD69",
          color: "#FF9F0A",
          delta: Math.round(avgProtein7d - avgProteinPrev),
          unit: "g",
        });
      }
    }

    // ═══════════════════════════════════════════
    // PERSONAL BESTS (All-Time)
    // ═══════════════════════════════════════════
    const personalBests: PersonalBest[] = [];
    const nearRecords: NearRecord[] = [];

    // Best Elite Score
    if (allScores.length > 0) {
      const bestScore = allScores.reduce((best, s) =>
        s.score > best.score ? s : best
      );
      personalBests.push({
        metric: "Elite Score",
        value: bestScore.score,
        unit: "pts",
        date: new Date(bestScore.calculatedAt).toISOString().slice(0, 10),
        icon: "\uD83C\uDFC6",
      });

      // Check if current is near record
      const latest = scores7d.length > 0 ? scores7d[scores7d.length - 1] : null;
      if (latest && latest.score >= bestScore.score * 0.9 && latest.score < bestScore.score) {
        nearRecords.push({
          metric: "Elite Score",
          currentValue: latest.score,
          bestValue: bestScore.score,
          unit: "pts",
          percentAway: Math.round(
            ((bestScore.score - latest.score) / bestScore.score) * 100
          ),
          encouragement: `You're ${bestScore.score - latest.score} points from your all-time best Elite Score. Push your protocol adherence to 100% today to break through.`,
          icon: "\uD83C\uDFC6",
        });
      }
    }

    // Best HRV
    if (allScores.length > 0) {
      const bestHrv = allScores.reduce((best, s) =>
        s.currentHrv > best.currentHrv ? s : best
      );
      personalBests.push({
        metric: "HRV",
        value: bestHrv.currentHrv,
        unit: "ms",
        date: new Date(bestHrv.calculatedAt).toISOString().slice(0, 10),
        icon: "\u2764\uFE0F",
      });

      const latest = scores7d.length > 0 ? scores7d[scores7d.length - 1] : null;
      if (
        latest &&
        latest.currentHrv >= bestHrv.currentHrv * 0.92 &&
        latest.currentHrv < bestHrv.currentHrv
      ) {
        nearRecords.push({
          metric: "HRV",
          currentValue: latest.currentHrv,
          bestValue: bestHrv.currentHrv,
          unit: "ms",
          percentAway: Math.round(
            ((bestHrv.currentHrv - latest.currentHrv) / bestHrv.currentHrv) *
              100
          ),
          encouragement: `Your HRV is ${bestHrv.currentHrv - latest.currentHrv}ms from your personal best. Nail your sleep and recovery protocols tonight to break through.`,
          icon: "\u2764\uFE0F",
        });
      }
    }

    // Best Sleep Score
    const allSleepScores = directives
      .filter((d) => d.sleepScore != null)
      .map((d) => ({ score: d.sleepScore!, date: d.dateKey, generatedAt: d.generatedAt }));
    if (allSleepScores.length > 0) {
      const bestSleep = allSleepScores.reduce((best, s) =>
        s.score > best.score ? s : best
      );
      personalBests.push({
        metric: "Sleep Score",
        value: bestSleep.score,
        unit: "pts",
        date: bestSleep.date,
        icon: "\uD83D\uDE34",
      });
    }

    // Longest Protocol Streak
    const completionsByDate = new Map<string, number>();
    for (const c of allCompletions.filter((c) => c.completed)) {
      completionsByDate.set(
        c.dateKey,
        (completionsByDate.get(c.dateKey) || 0) + 1
      );
    }
    // Calculate streak (consecutive days with at least 1 completion)
    const sortedDates = Array.from(completionsByDate.keys()).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    let streakEndDate = "";
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        streakEndDate = sortedDates[i];
      }
    }
    if (maxStreak > 0) {
      personalBests.push({
        metric: "Protocol Streak",
        value: maxStreak,
        unit: "days",
        date: streakEndDate,
        icon: "\uD83D\uDD25",
      });
    }

    // ── Sort alerts by severity ──
    alerts.sort((a, b) => {
      const sev = { critical: 0, warning: 1 };
      return sev[a.severity] - sev[b.severity];
    });

    return {
      alerts,
      personalBests,
      nearRecords,
      hasAlerts: alerts.length > 0,
      hasNearRecords: nearRecords.length > 0,
      analysisTimestamp: now,
    };
  },
});
