import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIO-PINGS — Proactive Intelligence Engine
   
   Scans real-time biometric data every query cycle and generates
   1-sentence "whisper" pings that feel like a high-performance
   coach anticipating the user's biological needs.
   
   Ping categories:
   • opportunity  — HRV high + schedule gap → train now
   • recovery     — HRV down / sleep deficit → ease off
   • nutrition    — fasting window / protein gap / caffeine timing
   • supplement   — missed protocol / optimal timing window
   • momentum     — streak recognition / adherence milestone
   • circadian    — light exposure / sleep prep / cortisol timing
   ═══════════════════════════════════════════════════════════════ */

interface BioPing {
  id: string;
  category: "opportunity" | "recovery" | "nutrition" | "supplement" | "momentum" | "circadian";
  icon: string;
  message: string;
  subtext: string;
  urgency: "whisper" | "nudge" | "alert";
  accentColor: string;
  actionLabel?: string;
  actionType?: string;
  expiresAt: number;
  generatedAt: number;
}

/* ── Time-of-day context ── */
function getTimeContext(now: Date): {
  period: "early_morning" | "morning" | "midday" | "afternoon" | "evening" | "night";
  hour: number;
  isWorkoutWindow: boolean;
  isFastingWindow: boolean;
  isSleepPrepWindow: boolean;
  isCaffeineSafe: boolean;
} {
  const hour = now.getHours();
  const period = hour < 6 ? "early_morning" as const
    : hour < 10 ? "morning" as const
    : hour < 13 ? "midday" as const
    : hour < 17 ? "afternoon" as const
    : hour < 21 ? "evening" as const
    : "night" as const;

  return {
    period,
    hour,
    isWorkoutWindow: hour >= 6 && hour <= 18,
    isFastingWindow: hour >= 20 || hour < 12,
    isSleepPrepWindow: hour >= 20 && hour <= 23,
    isCaffeineSafe: hour < 14,
  };
}

export const getProactivePings = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    pings: BioPing[];
    dataSignals: number;
    generatedAt: number;
  }> => {
    const now = Date.now();
    const nowDate = new Date(now);
    const timeCtx = getTimeContext(nowDate);
    const pings: BioPing[] = [];
    let dataSignals = 0;

    /* ── Pull all data sources ── */
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Latest elite score
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const latestScore = eliteScores.length > 0
      ? eliteScores.sort((a, b) => b.calculatedAt - a.calculatedAt)[0]
      : null;

    // Today's food logs
    const todayStart = new Date(nowDate);
    todayStart.setHours(0, 0, 0, 0);
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const todayFood = foodLogs.filter((l) => l.loggedAt >= todayStart.getTime());

    // Today's caffeine
    const caffeineLogs = await ctx.db
      .query("caffeineLogs")
      .withIndex("by_sessionId_and_consumedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("consumedAt", todayStart.getTime())
      )
      .collect();

    // Today's protocol completions
    const dateKey = nowDate.toISOString().slice(0, 10);
    const completions = await ctx.db
      .query("daily_completions")
      .withIndex("by_sessionId_and_dateKey", (q) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();

    // Active protocols
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);

    // Streak data
    const streakData = await ctx.db
      .query("streakData")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Recent HRV readings (last 24h)
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff24h)
      )
      .collect();

    // Latest sleep
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const latestSleep = sleepLogs.length > 0
      ? sleepLogs.sort((a, b) => b.loggedAt - a.loggedAt)[0]
      : null;

    // Activity logs today
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const todayActivity = activityLogs.filter((l) => l.loggedAt >= todayStart.getTime());

    /* ── Count data signals ── */
    if (bioVault) dataSignals += 5;
    if (latestScore) dataSignals++;
    if (todayFood.length > 0) dataSignals += todayFood.length;
    if (hrvReadings.length > 0) dataSignals += hrvReadings.length;
    if (latestSleep) dataSignals++;
    if (streakData) dataSignals++;
    dataSignals += completions.length;

    const expiry30m = now + 30 * 60 * 1000;
    const expiry1h = now + 60 * 60 * 1000;
    const expiry2h = now + 2 * 60 * 60 * 1000;

    /* ═══════════════════════════════════════════════════════════
       PING RULES — Each rule checks a biological condition and
       generates a contextual 1-sentence whisper.
       ═══════════════════════════════════════════════════════════ */

    /* ── 1. HRV HIGH + No Activity Yet → Training Opportunity ── */
    if (bioVault?.hrvCurrent && bioVault?.hrvAvg7d && timeCtx.isWorkoutWindow) {
      const hrvPctAbove = ((bioVault.hrvCurrent - bioVault.hrvAvg7d) / bioVault.hrvAvg7d) * 100;
      if (hrvPctAbove > 10 && todayActivity.length === 0) {
        pings.push({
          id: "hrv_training_window",
          category: "opportunity",
          icon: "⚡",
          message: `HRV is ${Math.round(hrvPctAbove)}% above your baseline at ${bioVault.hrvCurrent}ms — your nervous system is primed for high-intensity output.`,
          subtext: "Parasympathetic reserve is elevated. This is your optimal training window.",
          urgency: "nudge",
          accentColor: "#00FFCC",
          actionLabel: "Start Session",
          actionType: "start_workout",
          expiresAt: expiry2h,
          generatedAt: now,
        });
      }
    }

    /* ── 2. HRV DOWN → Recovery Mode ── */
    if (bioVault?.hrvCurrent && bioVault?.hrvBaseline) {
      const hrvPctBelow = ((bioVault.hrvBaseline - bioVault.hrvCurrent) / bioVault.hrvBaseline) * 100;
      if (hrvPctBelow >= 15) {
        const severity = hrvPctBelow >= 25 ? "alert" as const : "nudge" as const;
        pings.push({
          id: "hrv_recovery_mode",
          category: "recovery",
          icon: "🫀",
          message: `HRV is ${Math.round(hrvPctBelow)}% below baseline — your autonomic system is signaling recovery debt. Zone 2 only today.`,
          subtext: `Current: ${bioVault.hrvCurrent}ms vs baseline ${bioVault.hrvBaseline}ms. Sympathetic overdrive detected.`,
          urgency: severity,
          accentColor: severity === "alert" ? "#FF6B6B" : "#E8976C",
          actionLabel: "Switch to Recovery",
          actionType: "recovery_mode",
          expiresAt: expiry2h,
          generatedAt: now,
        });
      }
    }

    /* ── 3. Sleep Deficit → Cortisol Warning ── */
    if (latestSleep && timeCtx.period === "morning") {
      if (latestSleep.totalHours < 6.5) {
        pings.push({
          id: "sleep_deficit_morning",
          category: "recovery",
          icon: "🌙",
          message: `${latestSleep.totalHours.toFixed(1)}h sleep last night — cortisol will peak early. Delay caffeine 90 minutes and add 10min morning sunlight.`,
          subtext: `Sleep score: ${latestSleep.sleepScore}/100. Deep sleep: ${latestSleep.deepHours.toFixed(1)}h. Recovery capacity reduced.`,
          urgency: "nudge",
          accentColor: "#A78BFA",
          expiresAt: expiry2h,
          generatedAt: now,
        });
      } else if (latestSleep.sleepScore >= 85) {
        pings.push({
          id: "sleep_excellent",
          category: "momentum",
          icon: "✨",
          message: `Sleep score ${latestSleep.sleepScore}/100 with ${latestSleep.deepHours.toFixed(1)}h deep sleep — recovery architecture is optimized. You have full capacity today.`,
          subtext: "Growth hormone release and neural consolidation were both above threshold.",
          urgency: "whisper",
          accentColor: "#34D399",
          expiresAt: expiry1h,
          generatedAt: now,
        });
      }
    }

    /* ── 4. Protein Gap → Fuel Reminder ── */
    if (timeCtx.hour >= 12 && timeCtx.hour <= 20) {
      const totalProtein = todayFood.reduce((s, f) => s + f.protein, 0);
      const targetProtein = 150; // baseline target
      const mealsLogged = todayFood.length;
      if (mealsLogged >= 1 && totalProtein < targetProtein * 0.5 && timeCtx.hour >= 14) {
        const remaining = targetProtein - totalProtein;
        pings.push({
          id: "protein_gap",
          category: "nutrition",
          icon: "🥩",
          message: `${totalProtein}g protein logged — you need ${remaining}g more to hit your synthesis threshold. Prioritize your next meal.`,
          subtext: `${mealsLogged} meal${mealsLogged > 1 ? "s" : ""} logged today. Muscle protein synthesis requires distributed intake.`,
          urgency: "nudge",
          accentColor: "#F59E0B",
          actionLabel: "Log Meal",
          actionType: "quick_fuel",
          expiresAt: expiry2h,
          generatedAt: now,
        });
      }
    }

    /* ── 5. Caffeine Timing → Adenosine Warning ── */
    if (caffeineLogs.length > 0 && !timeCtx.isCaffeineSafe) {
      const lateCaffeine = caffeineLogs.filter((l) => new Date(l.consumedAt).getHours() >= 14);
      if (lateCaffeine.length > 0) {
        const totalLateMg = lateCaffeine.reduce((s, l) => s + l.amountMg, 0);
        const isSensitive = bioVault?.caffeineSensitivity === true;
        pings.push({
          id: "caffeine_late",
          category: "circadian",
          icon: "☕",
          message: `${totalLateMg}mg caffeine after 2pm${isSensitive ? " with your CYP1A2 slow-metabolizer variant" : ""} — this will fragment tonight's deep sleep architecture.`,
          subtext: isSensitive ? "Your genetic profile extends caffeine half-life to ~8h." : "Adenosine receptor blockade persists 6+ hours post-intake.",
          urgency: isSensitive ? "nudge" : "whisper",
          accentColor: "#E8976C",
          expiresAt: expiry1h,
          generatedAt: now,
        });
      }
    }

    /* ── 6. No Caffeine Yet (Morning) → Cortisol Alignment ── */
    if (timeCtx.period === "morning" && caffeineLogs.length === 0 && timeCtx.hour >= 7 && timeCtx.hour <= 9) {
      pings.push({
        id: "caffeine_cortisol_window",
        category: "circadian",
        icon: "☀️",
        message: "Cortisol is naturally peaking now — delay caffeine 60-90 minutes after waking for maximum adenosine clearance.",
        subtext: "Aligning caffeine with your cortisol trough amplifies alertness without tolerance buildup.",
        urgency: "whisper",
        accentColor: "#FBBF24",
        expiresAt: expiry1h,
        generatedAt: now,
      });
    }

    /* ── 7. Protocol Adherence Gap → Gentle Nudge ── */
    if (activeProtocols.length > 0 && timeCtx.hour >= 10) {
      const completedIds = new Set(completions.filter((c) => c.completed).map((c) => c.protocolId));
      const totalActive = activeProtocols.length;
      const doneCount = activeProtocols.filter((p) => completedIds.has(p._id.toString())).length;
      const adherenceRate = totalActive > 0 ? doneCount / totalActive : 0;

      if (adherenceRate < 0.3 && timeCtx.hour >= 14) {
        const remaining = totalActive - doneCount;
        // Find the highest-priority uncompleted protocol
        const uncompleted = activeProtocols
          .filter((p) => !completedIds.has(p._id.toString()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const nextProtocol = uncompleted[0];

        pings.push({
          id: "protocol_adherence_gap",
          category: "supplement",
          icon: "📋",
          message: `${remaining} protocol${remaining > 1 ? "s" : ""} remaining today${nextProtocol ? ` — start with ${nextProtocol.name}` : ""}. Consistency compounds.`,
          subtext: `${doneCount}/${totalActive} completed. Each protocol logged strengthens your biological trajectory.`,
          urgency: "nudge",
          accentColor: "#3B82F6",
          actionLabel: "View Protocols",
          actionType: "open_protocols",
          expiresAt: expiry2h,
          generatedAt: now,
        });
      } else if (adherenceRate >= 0.9 && doneCount >= 5) {
        pings.push({
          id: "protocol_momentum",
          category: "momentum",
          icon: "🔥",
          message: `${doneCount}/${totalActive} protocols completed — you're in the top 5% of adherence today. This is where compounding happens.`,
          subtext: "Biological systems respond exponentially to consistent protocol execution.",
          urgency: "whisper",
          accentColor: "#00FFCC",
          expiresAt: expiry1h,
          generatedAt: now,
        });
      }
    }

    /* ── 8. Streak Milestone → Celebration ── */
    if (streakData && streakData.currentStreak > 0) {
      const milestones = [3, 7, 14, 21, 30, 60, 90, 100];
      const streak = streakData.currentStreak;
      if (milestones.includes(streak)) {
        pings.push({
          id: `streak_milestone_${streak}`,
          category: "momentum",
          icon: streak >= 30 ? "🏆" : streak >= 7 ? "🔥" : "⭐",
          message: `${streak}-day streak — ${streak >= 30 ? "elite-tier consistency" : streak >= 14 ? "your biology is adapting" : streak >= 7 ? "neural pathways are forming" : "momentum is building"}. Every day compounds.`,
          subtext: streak >= 14
            ? "Epigenetic markers begin shifting at 14+ days of consistent protocol adherence."
            : "Habit formation requires 3+ consecutive days to establish neural grooves.",
          urgency: "whisper",
          accentColor: "#FFD700",
          expiresAt: expiry2h,
          generatedAt: now,
        });
      }
    }

    /* ── 9. Evening Sleep Prep → Wind-Down ── */
    if (timeCtx.isSleepPrepWindow) {
      const hasEveningProtocol = completions.some((c) => {
        const proto = activeProtocols.find((p) => p._id.toString() === c.protocolId);
        return proto?.timeOfDay === "evening" && c.completed;
      });

      if (!hasEveningProtocol) {
        pings.push({
          id: "sleep_prep_window",
          category: "circadian",
          icon: "🌙",
          message: "Sleep prep window is open — dim lights, reduce screen brightness, and take Magnesium Glycinate 400mg for optimal melatonin onset.",
          subtext: "Blue light exposure after 9pm delays melatonin secretion by 90+ minutes.",
          urgency: "whisper",
          accentColor: "#818CF8",
          expiresAt: expiry1h,
          generatedAt: now,
        });
      }
    }

    /* ── 10. Fasting Window Opportunity ── */
    if (timeCtx.isFastingWindow && todayFood.length === 0 && timeCtx.hour >= 7 && timeCtx.hour <= 11) {
      const lastMealTime = foodLogs.length > 0
        ? Math.max(...foodLogs.map((f) => f.loggedAt))
        : null;
      if (lastMealTime) {
        const fastingHours = Math.round((now - lastMealTime) / (60 * 60 * 1000));
        if (fastingHours >= 14 && fastingHours <= 20) {
          pings.push({
            id: "fasting_window",
            category: "nutrition",
            icon: "⏱️",
            message: `${fastingHours}h fasted — autophagy pathways are active. ${fastingHours >= 16 ? "You've hit the 16h threshold for enhanced cellular cleanup." : `${16 - fastingHours}h to the 16h autophagy threshold.`}`,
            subtext: "Fasting-induced AMPK activation upregulates mitochondrial biogenesis and reduces mTOR signaling.",
            urgency: "whisper",
            accentColor: "#10B981",
            expiresAt: expiry1h,
            generatedAt: now,
          });
        }
      }
    }

    /* ── 11. Vitality Score Surge ── */
    if (latestScore && latestScore.score >= 85) {
      pings.push({
        id: "vitality_surge",
        category: "momentum",
        icon: "💎",
        message: `Vitality Score at ${latestScore.score}/100 — all biological systems synchronized. You're operating at peak capacity.`,
        subtext: `Fueling: ${latestScore.fuelingPoints}/25 · Movement: ${latestScore.movementPoints}/25 · HRV: ${latestScore.hrvPoints}/25`,
        urgency: "whisper",
        accentColor: "#00FFCC",
        expiresAt: expiry2h,
        generatedAt: now,
      });
    }

    /* ── 12. Inflammation + No Movement → Myokine Prompt ── */
    if (bioVault?.crp && bioVault.crp > 1.5 && todayActivity.length === 0 && timeCtx.isWorkoutWindow) {
      pings.push({
        id: "inflammation_movement",
        category: "opportunity",
        icon: "🛡️",
        message: `hs-CRP at ${bioVault.crp.toFixed(1)} mg/L — even a 20-minute walk triggers myokine release that reduces systemic inflammation within 48h.`,
        subtext: "Skeletal muscle IL-6 is the body's primary anti-inflammatory mechanism. Movement is medicine.",
        urgency: "nudge",
        accentColor: "#F97316",
        actionLabel: "Log Walk",
        actionType: "log_activity",
        expiresAt: expiry2h,
        generatedAt: now,
      });
    }

    /* ── Sort: alerts first, then nudges, then whispers ── */
    const urgencyOrder = { alert: 0, nudge: 1, whisper: 2 };
    pings.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    /* ── Limit to top 3 most relevant pings ── */
    return {
      pings: pings.slice(0, 3),
      dataSignals,
      generatedAt: now,
    };
  },
});
