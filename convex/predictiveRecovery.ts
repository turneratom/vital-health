import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE RECOVERY ENGINE
   
   Monitors multi-day trends in HRV and sleep data. If 3+ 
   consecutive days of decline are detected, the system generates
   a proactive "Protocol Adjustment" alert with specific 
   interventions: breathwork sessions, supplement adjustments,
   and training modifications.
   
   This transforms Vive from passive tracking → proactive OS.
   ═══════════════════════════════════════════════════════════════ */

interface TrendDataPoint {
  date: string;
  value: number;
  timestamp: number;
}

interface DecliningTrend {
  metric: "hrv" | "sleep";
  consecutiveDays: number;
  dataPoints: TrendDataPoint[];
  totalDeclinePercent: number;
  latestValue: number;
  baselineValue: number;
  severity: "early_warning" | "accelerating" | "critical_decline";
}

interface ProtocolIntervention {
  id: string;
  category: "breathwork" | "supplement" | "training" | "sleep" | "nutrition" | "stress";
  title: string;
  description: string;
  timing: string;
  duration?: string;
  dosage?: string;
  priority: "immediate" | "tonight" | "tomorrow";
  icon: string;
  accentColor: string;
  evidenceBasis: string;
}

interface PredictiveAlert {
  active: boolean;
  severity: "early_warning" | "accelerating" | "critical_decline" | "nominal";
  headline: string;
  subheadline: string;
  trends: DecliningTrend[];
  interventions: ProtocolIntervention[];
  projectedRecoveryDays: number;
  generatedAt: number;
  dismissedUntil?: number;
}

/**
 * Analyze daily values and detect consecutive declining days.
 * Groups readings by date and checks if each day is lower than the previous.
 */
function detectDecliningTrend(
  readings: Array<{ value: number; timestamp: number }>,
  metric: "hrv" | "sleep"
): DecliningTrend | null {
  if (readings.length < 3) return null;

  // Group by date (local day)
  const byDate = new Map<string, number[]>();
  for (const r of readings) {
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r.value);
  }

  // Calculate daily averages, sorted by date descending (most recent first)
  const dailyAvgs: TrendDataPoint[] = [];
  for (const [date, values] of byDate) {
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    dailyAvgs.push({ date, value: Math.round(avg * 10) / 10, timestamp: new Date(date).getTime() });
  }
  dailyAvgs.sort((a, b) => b.timestamp - a.timestamp);

  if (dailyAvgs.length < 3) return null;

  // Count consecutive declining days from most recent
  let consecutiveDays = 1;
  for (let i = 0; i < dailyAvgs.length - 1; i++) {
    if (dailyAvgs[i].value < dailyAvgs[i + 1].value) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  if (consecutiveDays < 3) return null;

  const latestValue = dailyAvgs[0].value;
  const baselineValue = dailyAvgs[consecutiveDays - 1].value;
  const totalDeclinePercent = baselineValue > 0
    ? Math.round(((baselineValue - latestValue) / baselineValue) * 1000) / 10
    : 0;

  let severity: DecliningTrend["severity"];
  if (consecutiveDays >= 5 || totalDeclinePercent >= 25) severity = "critical_decline";
  else if (consecutiveDays >= 4 || totalDeclinePercent >= 15) severity = "accelerating";
  else severity = "early_warning";

  return {
    metric,
    consecutiveDays,
    dataPoints: dailyAvgs.slice(0, consecutiveDays).reverse(),
    totalDeclinePercent,
    latestValue,
    baselineValue,
    severity,
  };
}

/**
 * Generate targeted interventions based on detected trends
 */
function generateInterventions(trends: DecliningTrend[]): ProtocolIntervention[] {
  const interventions: ProtocolIntervention[] = [];
  const hasHrvDecline = trends.find((t) => t.metric === "hrv");
  const hasSleepDecline = trends.find((t) => t.metric === "sleep");
  const worstSeverity = trends.reduce(
    (worst, t) => {
      const order = { early_warning: 0, accelerating: 1, critical_decline: 2 };
      return order[t.severity] > order[worst] ? t.severity : worst;
    },
    "early_warning" as DecliningTrend["severity"]
  );

  // ── BREATHWORK (always recommended for declining trends) ──
  if (hasHrvDecline) {
    interventions.push({
      id: "breathwork-nsdr",
      category: "breathwork",
      title: "NSDR / Yoga Nidra Session",
      description:
        worstSeverity === "critical_decline"
          ? "Your HRV has declined for " + hasHrvDecline.consecutiveDays + " consecutive days. A 20-minute Non-Sleep Deep Rest session will activate parasympathetic recovery and begin restoring vagal tone."
          : "Declining HRV trend detected. A focused breathwork session will help reset autonomic balance and improve tonight's recovery.",
      timing: "Within the next 2 hours",
      duration: worstSeverity === "critical_decline" ? "20 min" : "10 min",
      priority: "immediate",
      icon: "🫁",
      accentColor: "#AF82FF",
      evidenceBasis: "Huberman Lab: NSDR increases parasympathetic tone by 30-40% within one session",
    });
  }

  if (hasHrvDecline && hasHrvDecline.severity !== "early_warning") {
    interventions.push({
      id: "breathwork-box",
      category: "breathwork",
      title: "Box Breathing Protocol",
      description:
        "4-4-4-4 cadence for 5 minutes. This will directly stimulate the vagus nerve and begin reversing the sympathetic dominance causing your HRV decline.",
      timing: "Before bed tonight",
      duration: "5 min",
      priority: "tonight",
      icon: "🧘",
      accentColor: "#60A5FA",
      evidenceBasis: "Navy SEAL protocol: Box breathing reduces cortisol by 23% in acute stress states",
    });
  }

  // ── SUPPLEMENTS ──
  if (hasHrvDecline || hasSleepDecline) {
    interventions.push({
      id: "supp-magnesium",
      category: "supplement",
      title: "Magnesium Glycinate — Increase to 400mg",
      description:
        hasSleepDecline
          ? `Sleep quality has declined ${hasSleepDecline.totalDeclinePercent}% over ${hasSleepDecline.consecutiveDays} days. Increasing magnesium to 400mg tonight will enhance GABA receptor activity and improve deep sleep architecture.`
          : "Magnesium glycinate supports parasympathetic recovery and will help restore HRV baseline. Take 400mg 60 minutes before bed.",
      timing: "60 min before bed tonight",
      dosage: "400mg (increase from standard 200mg)",
      priority: "tonight",
      icon: "💊",
      accentColor: "#00FFCC",
      evidenceBasis: "Magnesium glycinate crosses BBB efficiently; 400mg shown to increase deep sleep by 15-20%",
    });
  }

  if (hasHrvDecline && hasHrvDecline.severity === "critical_decline") {
    interventions.push({
      id: "supp-ltheanine",
      category: "supplement",
      title: "L-Theanine — 200mg Stack",
      description:
        "Critical HRV decline requires aggressive parasympathetic support. L-Theanine promotes alpha brain wave activity and reduces cortisol without sedation.",
      timing: "With dinner tonight",
      dosage: "200mg",
      priority: "tonight",
      icon: "🧬",
      accentColor: "#00DC82",
      evidenceBasis: "L-Theanine increases alpha waves within 40 min; synergistic with magnesium for HRV recovery",
    });
  }

  if (hasSleepDecline && hasSleepDecline.consecutiveDays >= 4) {
    interventions.push({
      id: "supp-apigenin",
      category: "supplement",
      title: "Apigenin — 50mg Before Bed",
      description:
        "Extended sleep decline warrants additional support. Apigenin (chamomile extract) is a mild anxiolytic that improves sleep onset latency without next-day grogginess.",
      timing: "30 min before bed",
      dosage: "50mg",
      priority: "tonight",
      icon: "🌿",
      accentColor: "#34D399",
      evidenceBasis: "Huberman sleep stack: Apigenin + Magnesium + L-Theanine is the gold standard non-pharmaceutical sleep protocol",
    });
  }

  // ── TRAINING MODIFICATIONS ──
  interventions.push({
    id: "training-deload",
    category: "training",
    title:
      worstSeverity === "critical_decline"
        ? "Full Deload Day — Active Recovery Only"
        : worstSeverity === "accelerating"
          ? "Reduce Training Volume by 40%"
          : "Auto-Regulate Intensity Today",
    description:
      worstSeverity === "critical_decline"
        ? "Your biological systems are in sustained decline. Skip all high-intensity work today. Walk 30 min, mobility work, and sauna if available. Your body needs recovery, not stimulus."
        : worstSeverity === "accelerating"
          ? "Reduce all working sets by 40% and eliminate any HIIT or VO2max work. Focus on technique and Zone 1-2 cardio only."
          : "Use RPE-based auto-regulation today. If any set feels above RPE 7, terminate the exercise. Your nervous system is showing early fatigue signals.",
    timing: "Today's training session",
    priority: "immediate",
    icon: "🏋️",
    accentColor: worstSeverity === "critical_decline" ? "#FF6B6B" : "#E8976C",
    evidenceBasis: "Overreaching prevention: 3+ days of HRV decline correlates with 2-3 week recovery debt if training load isn't adjusted",
  });

  // ── SLEEP PROTOCOL ──
  if (hasSleepDecline) {
    interventions.push({
      id: "sleep-protocol",
      category: "sleep",
      title: "Enhanced Sleep Protocol Tonight",
      description:
        "Screen-off by 9pm. Room temp 65-67°F. No caffeine after 12pm. Hot shower 90 min before bed (core temp drop triggers melatonin). This protocol addresses the root cause of your declining sleep architecture.",
      timing: "Starting at 9pm tonight",
      priority: "tonight",
      icon: "🌙",
      accentColor: "#818CF8",
      evidenceBasis: "Stanford Sleep Lab: Temperature manipulation is the single most effective non-pharmaceutical sleep intervention",
    });
  }

  // ── STRESS MANAGEMENT ──
  if (worstSeverity === "critical_decline" || (hasHrvDecline && hasSleepDecline)) {
    interventions.push({
      id: "stress-audit",
      category: "stress",
      title: "Stress Audit — Identify Allostatic Load",
      description:
        "Both HRV and sleep declining simultaneously suggests elevated allostatic load. Review: work stress, relationship tension, overtraining, or dietary inflammation. Address the root cause, not just symptoms.",
      timing: "Review today",
      priority: "immediate",
      icon: "🔍",
      accentColor: "#F59E0B",
      evidenceBasis: "Dual-metric decline (HRV + sleep) has 85% correlation with elevated cortisol and systemic inflammation",
    });
  }

  return interventions;
}

/**
 * ══════════════════════════════════════════════════════════════
 * ── GET PREDICTIVE RECOVERY ALERT                           ──
 * ══════════════════════════════════════════════════════════════
 * 
 * Main query: Analyzes 14 days of HRV and sleep data to detect
 * multi-day declining trends. Returns proactive protocol
 * adjustment alerts with specific interventions.
 */
export const getPredictiveRecoveryAlert = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<PredictiveAlert> => {
    const now = Date.now();
    const cutoff14d = now - 14 * 24 * 60 * 60 * 1000;
    const trends: DecliningTrend[] = [];

    // ── Check for dismissed alerts ──
    const dismissals = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", now - 12 * 60 * 60 * 1000)
      )
      .collect();
    const recentDismissal = dismissals.find(
      (d: any) => d.protocolName === "__predictive_alert_dismissed"
    );
    if (recentDismissal) {
      return {
        active: false,
        severity: "nominal",
        headline: "",
        subheadline: "",
        trends: [],
        interventions: [],
        projectedRecoveryDays: 0,
        generatedAt: now,
        dismissedUntil: recentDismissal.loggedAt + 12 * 60 * 60 * 1000,
      };
    }

    // ── Analyze HRV Trend (14-day window) ──
    try {
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff14d)
        )
        .collect();

      if (hrvReadings.length >= 3) {
        const hrvTrend = detectDecliningTrend(
          hrvReadings.map((r) => ({ value: r.value, timestamp: r.measuredAt })),
          "hrv"
        );
        if (hrvTrend) trends.push(hrvTrend);
      }

      // Fallback: check eliteScores HRV
      if (trends.filter((t) => t.metric === "hrv").length === 0) {
        const eliteScores = await ctx.db
          .query("eliteScores")
          .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
          .collect();
        const recentScores = eliteScores.filter((s) => s.calculatedAt >= cutoff14d);
        if (recentScores.length >= 3) {
          const hrvTrend = detectDecliningTrend(
            recentScores.map((s) => ({ value: s.currentHrv, timestamp: s.calculatedAt })),
            "hrv"
          );
          if (hrvTrend) trends.push(hrvTrend);
        }
      }
    } catch { /* continue */ }

    // ── Analyze Sleep Trend (14-day window) ──
    try {
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentSleep = sleepLogs.filter((s) => s.loggedAt >= cutoff14d);

      if (recentSleep.length >= 3) {
        const sleepTrend = detectDecliningTrend(
          recentSleep.map((s) => ({ value: s.sleepScore, timestamp: s.loggedAt })),
          "sleep"
        );
        if (sleepTrend) trends.push(sleepTrend);
      }
    } catch { /* continue */ }

    // ── No declining trends detected ──
    if (trends.length === 0) {
      return {
        active: false,
        severity: "nominal",
        headline: "",
        subheadline: "",
        trends: [],
        interventions: [],
        projectedRecoveryDays: 0,
        generatedAt: now,
      };
    }

    // ── Generate interventions ──
    const interventions = generateInterventions(trends);

    // ── Determine overall severity ──
    const worstSeverity = trends.reduce(
      (worst, t) => {
        const order = { early_warning: 0, accelerating: 1, critical_decline: 2 };
        return order[t.severity] > order[worst] ? t.severity : worst;
      },
      "early_warning" as DecliningTrend["severity"]
    );

    // ── Generate headline ──
    const hrvTrend = trends.find((t) => t.metric === "hrv");
    const sleepTrend = trends.find((t) => t.metric === "sleep");
    const maxDays = Math.max(...trends.map((t) => t.consecutiveDays));

    let headline: string;
    let subheadline: string;

    if (worstSeverity === "critical_decline") {
      headline = "⚠️ RECOVERY RED-LINING";
      subheadline = `${maxDays}-day sustained decline detected. I've automatically generated a recovery protocol to prevent overreaching.`;
    } else if (worstSeverity === "accelerating") {
      headline = "📉 RECOVERY DECLINING";
      subheadline = `${maxDays} consecutive days of decline in ${hrvTrend && sleepTrend ? "HRV and sleep" : hrvTrend ? "HRV" : "sleep quality"}. Proactive adjustments recommended.`;
    } else {
      headline = "🔔 EARLY WARNING";
      subheadline = `3-day declining trend in ${hrvTrend && sleepTrend ? "HRV and sleep" : hrvTrend ? "HRV" : "sleep quality"}. Minor protocol adjustments suggested.`;
    }

    // ── Projected recovery days ──
    const projectedRecoveryDays =
      worstSeverity === "critical_decline" ? 5 :
      worstSeverity === "accelerating" ? 3 : 2;

    return {
      active: true,
      severity: worstSeverity,
      headline,
      subheadline,
      trends,
      interventions,
      projectedRecoveryDays,
      generatedAt: now,
    };
  },
});

/**
 * Dismiss the predictive alert for 12 hours
 */
export const dismissPredictiveAlert = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: "predictive-alert-dismissed",
      protocolName: "__predictive_alert_dismissed",
      category: "system",
      loggedAt: now,
      message: "User dismissed predictive recovery alert",
    });
    return { dismissed: true, resumesAt: now + 12 * 60 * 60 * 1000 };
  },
});

/**
 * Accept an intervention — log it as a protocol action
 */
export const acceptIntervention = mutation({
  args: {
    sessionId: v.string(),
    interventionId: v.string(),
    interventionTitle: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.interventionId,
      protocolName: args.interventionTitle,
      category: args.category,
      loggedAt: now,
      message: `Accepted predictive intervention: ${args.interventionId}`,
    });
    return { accepted: true, loggedAt: now };
  },
});
