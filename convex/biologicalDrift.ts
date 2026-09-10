import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIOLOGICAL DRIFT DETECTION ENGINE
   
   Scans BioVault + Somatic Feedback logs for sustained deviations
   from the user's optimal baseline. Unlike the Redline system
   (which detects acute 20%+ drops), Drift Detection catches
   GRADUAL erosion — e.g., Neural Drive dropping 2 days in a row,
   or sleep efficiency declining 3 consecutive nights.
   
   When drift is detected, generates an Urgent Intervention with
   a specific protocol shift (extra rest day, peptide adjustment,
   supplement timing change) to correct before it becomes a trend.
   
   DRIFT RULES:
   • Somatic channel drops ≥10 pts for 2+ consecutive days
   • HRV below baseline for 3+ consecutive readings
   • Sleep score declining 3+ nights in a row
   • Protocol adherence below 50% for 2+ days
   • Biomarker moving away from optimal for 2+ lab draws
   ═══════════════════════════════════════════════════════════════ */

/* ── Drift Thresholds ── */
const DRIFT_CONFIG = {
  somatic: {
    minConsecutiveDays: 2,
    minDropPoints: 10,      // ≥10 point drop from personal avg
    criticalDropPoints: 25, // ≥25 point drop = critical
  },
  hrv: {
    minConsecutiveReadings: 3,
    minDropPct: 12,         // ≥12% below 7d avg
    criticalDropPct: 22,    // ≥22% = critical
  },
  sleep: {
    minConsecutiveNights: 3,
    minScoreDrop: 10,       // ≥10 point decline
    minHoursDrop: 0.8,      // ≥0.8h decline
  },
  adherence: {
    minConsecutiveDays: 2,
    minRateDrop: 0.3,       // below 50% for 2+ days
  },
} as const;

/* ── Somatic Channel Labels ── */
const CHANNEL_LABELS: Record<string, string> = {
  neural_drive: "Neural Drive",
  core_temp: "Core Temperature",
  gut_status: "Gut Status",
  joint_mobility: "Joint Mobility",
  mental_clarity: "Mental Clarity",
  energy_flux: "Energy Flux",
};

/* ── Intervention Templates by Drift Type ── */
interface DriftIntervention {
  type: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  durationMinutes: number;
  accentColor: string;
  priority: "critical" | "high" | "moderate";
}

const DRIFT_INTERVENTIONS: Record<string, DriftIntervention[]> = {
  neural_drive: [
    {
      type: "cognitive_reset",
      title: "Neural Drive Recovery Protocol",
      subtitle: "Creatine 5g + Lion's Mane 1g + 20min NSDR",
      description: "Neural Drive has been declining for 2+ days — prefrontal cortex fatigue detected. Creatine replenishes brain ATP stores, Lion's Mane stimulates NGF production, and NSDR resets default mode network activity. Execute within 2 hours for optimal neuroplasticity window.",
      icon: "⚡",
      durationMinutes: 25,
      accentColor: "#A78BFA",
      priority: "high",
    },
    {
      type: "dopamine_reset",
      title: "Dopamine Baseline Reset",
      subtitle: "24h Low-Stimulation Window + Cold Exposure AM",
      description: "Sustained Neural Drive decline suggests dopamine receptor downregulation. A 24-hour low-stimulation window (no social media, minimal screens) combined with 2min AM cold exposure upregulates D2 receptor density by 15-20%.",
      icon: "🧊",
      durationMinutes: 1440,
      accentColor: "#6B8AFF",
      priority: "moderate",
    },
  ],
  core_temp: [
    {
      type: "thermoregulation",
      title: "Thermoregulation Protocol",
      subtitle: "Thyroid Support + Evening Cool-Down Routine",
      description: "Core temperature perception drifting suggests thyroid axis or circadian rhythm disruption. Implement evening cool-down (room temp 65-67°F, cold shower 30s) and check iodine/selenium intake. If on thyroid medication, verify timing consistency.",
      icon: "🌡️",
      durationMinutes: 15,
      accentColor: "#F97316",
      priority: "moderate",
    },
  ],
  gut_status: [
    {
      type: "gut_repair",
      title: "Gut Barrier Repair Protocol",
      subtitle: "L-Glutamine 5g + BPC-157 250mcg + Bone Broth",
      description: "Gut status declining for 2+ days indicates intestinal permeability increase or microbiome disruption. L-Glutamine is the primary fuel for enterocytes, BPC-157 accelerates mucosal repair, and bone broth provides collagen peptides for tight junction integrity.",
      icon: "🫁",
      durationMinutes: 5,
      accentColor: "#22C55E",
      priority: "high",
    },
  ],
  joint_mobility: [
    {
      type: "joint_recovery",
      title: "Joint Mobility Recovery",
      subtitle: "TB-500 500mcg + 15min Dynamic Stretching + Omega-3 3g",
      description: "Joint mobility declining suggests systemic inflammation reaching connective tissue. TB-500 upregulates actin for tissue repair, dynamic stretching maintains synovial fluid production, and high-dose omega-3 reduces IL-6 at the joint capsule level.",
      icon: "🦴",
      durationMinutes: 20,
      accentColor: "#06B6D4",
      priority: "moderate",
    },
  ],
  mental_clarity: [
    {
      type: "clarity_stack",
      title: "Mental Clarity Emergency Stack",
      subtitle: "Alpha-GPC 600mg + Focused Breathwork 5min",
      description: "Mental clarity erosion over 2+ days indicates acetylcholine depletion or chronic cortisol interference with hippocampal function. Alpha-GPC directly replenishes choline stores, while focused breathwork (4-7-8 pattern) reduces cortisol by 23% within minutes.",
      icon: "🧠",
      durationMinutes: 10,
      accentColor: "#3B82F6",
      priority: "high",
    },
  ],
  energy_flux: [
    {
      type: "energy_restoration",
      title: "Mitochondrial Energy Reset",
      subtitle: "CoQ10 200mg + Extra Rest Day + Zone 2 Only",
      description: "Energy flux declining for 2+ days signals mitochondrial fatigue or HPA axis dysregulation. CoQ10 supports electron transport chain efficiency, an extra rest day allows mitochondrial biogenesis, and Zone 2 cardio (if any movement) maintains metabolic flexibility without adding stress load.",
      icon: "🔋",
      durationMinutes: 1440,
      accentColor: "#EAB308",
      priority: "high",
    },
  ],
  hrv_drift: [
    {
      type: "vagal_restoration",
      title: "Vagal Tone Restoration",
      subtitle: "Cold Face Immersion + Gargling + Sleep Extension",
      description: "HRV has been below baseline for 3+ consecutive readings — parasympathetic tone is eroding. Cold face immersion (30s) triggers the dive reflex for immediate vagal activation. Gargling stimulates the pharyngeal branch of the vagus. Extend sleep by 30-60min tonight to allow autonomic recovery.",
      icon: "💓",
      durationMinutes: 10,
      accentColor: "#FF6B6B",
      priority: "critical",
    },
  ],
  sleep_drift: [
    {
      type: "sleep_architecture_repair",
      title: "Sleep Architecture Repair",
      subtitle: "Mag Glycinate 400mg + 9pm Screen-Off + Room 65°F",
      description: "Sleep quality declining for 3+ nights indicates circadian disruption or cortisol timing misalignment. Magnesium glycinate enhances GABA activity for deeper slow-wave sleep. Strict 9pm screen-off allows melatonin onset. Room temperature at 65°F optimizes thermoregulation for sleep initiation.",
      icon: "🌙",
      durationMinutes: 5,
      accentColor: "#6B8AFF",
      priority: "critical",
    },
  ],
  adherence_drift: [
    {
      type: "protocol_simplification",
      title: "Protocol Stack Simplification",
      subtitle: "Reduce to Top-3 Protocols for 48h Recovery Sprint",
      description: "Protocol adherence has dropped below 50% for 2+ days — decision fatigue or life stress is overwhelming the full stack. Temporarily reduce to your 3 highest-impact protocols (sleep, movement, primary supplement) for 48 hours. Rebuild stack incrementally once adherence returns above 80%.",
      icon: "🎯",
      durationMinutes: 2880,
      accentColor: "#E8976C",
      priority: "high",
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   DETECT BIOLOGICAL DRIFT — Main Query
   
   Scans all drift vectors and returns active drift signals with
   severity, duration, and recommended interventions.
   ═══════════════════════════════════════════════════════════════ */

export const detectBiologicalDrift = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const cutoff3d = now - 3 * 24 * 60 * 60 * 1000;

    const driftSignals: Array<{
      id: string;
      metric: string;
      metricLabel: string;
      currentValue: number;
      baselineValue: number;
      deviationPct: number;
      consecutiveDays: number;
      severity: "critical" | "high" | "moderate";
      trend: "declining" | "eroding" | "collapsing";
      detectedAt: number;
      intervention: DriftIntervention;
      dataPoints: Array<{ value: number; timestamp: number }>;
    }> = [];

    /* ── 1. SOMATIC CHANNEL DRIFT ── */
    const somaticEntries = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff7d)
      )
      .order("desc")
      .collect();

    // Group somatic by channel, then by day
    const channelsByDay: Record<string, Map<string, number[]>> = {};
    for (const entry of somaticEntries) {
      const dayKey = new Date(entry.loggedAt).toISOString().slice(0, 10);
      if (!channelsByDay[entry.channel]) channelsByDay[entry.channel] = new Map();
      const dayMap = channelsByDay[entry.channel];
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
      dayMap.get(dayKey)!.push(entry.value);
    }

    for (const [channel, dayMap] of Object.entries(channelsByDay)) {
      const sortedDays = Array.from(dayMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0])); // newest first

      if (sortedDays.length < 2) continue;

      // Compute daily averages
      const dailyAvgs = sortedDays.map(([day, values]) => ({
        day,
        avg: values.reduce((s, v) => s + v, 0) / values.length,
      }));

      // Check for consecutive declining days
      let consecutiveDecline = 0;
      const overallAvg = dailyAvgs.reduce((s, d) => s + d.avg, 0) / dailyAvgs.length;

      for (let i = 0; i < dailyAvgs.length - 1; i++) {
        if (dailyAvgs[i].avg < dailyAvgs[i + 1].avg - 3) {
          consecutiveDecline++;
        } else {
          break;
        }
      }

      // Also check if recent days are significantly below overall average
      const recentAvg = dailyAvgs.slice(0, 2).reduce((s, d) => s + d.avg, 0) / Math.min(2, dailyAvgs.length);
      const dropFromBaseline = overallAvg - recentAvg;

      if (
        consecutiveDecline >= DRIFT_CONFIG.somatic.minConsecutiveDays &&
        dropFromBaseline >= DRIFT_CONFIG.somatic.minDropPoints
      ) {
        const severity = dropFromBaseline >= DRIFT_CONFIG.somatic.criticalDropPoints
          ? "critical"
          : dropFromBaseline >= 18 ? "high" : "moderate";
        const trend = severity === "critical" ? "collapsing" : consecutiveDecline >= 3 ? "eroding" : "declining";
        const interventions = DRIFT_INTERVENTIONS[channel] ?? DRIFT_INTERVENTIONS.energy_flux;
        const intervention = severity === "critical" ? interventions[0] : interventions[interventions.length - 1] ?? interventions[0];

        driftSignals.push({
          id: `somatic_${channel}`,
          metric: channel,
          metricLabel: CHANNEL_LABELS[channel] ?? channel,
          currentValue: Math.round(recentAvg),
          baselineValue: Math.round(overallAvg),
          deviationPct: Math.round((dropFromBaseline / overallAvg) * 100),
          consecutiveDays: consecutiveDecline + 1,
          severity,
          trend,
          detectedAt: now,
          intervention,
          dataPoints: dailyAvgs.slice(0, 7).map((d) => ({
            value: Math.round(d.avg),
            timestamp: new Date(d.day).getTime(),
          })),
        });
      }
    }

    /* ── 2. HRV DRIFT ── */
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .order("desc")
      .collect();

    if (hrvReadings.length >= 4) {
      const sorted = hrvReadings.sort((a, b) => b.measuredAt - a.measuredAt);
      const avg7d = sorted.reduce((s, r) => s + r.value, 0) / sorted.length;
      let consecutiveBelow = 0;

      for (const reading of sorted) {
        if (reading.value < avg7d * (1 - DRIFT_CONFIG.hrv.minDropPct / 100)) {
          consecutiveBelow++;
        } else {
          break;
        }
      }

      if (consecutiveBelow >= DRIFT_CONFIG.hrv.minConsecutiveReadings) {
        const recentAvg = sorted.slice(0, 3).reduce((s, r) => s + r.value, 0) / 3;
        const dropPct = ((avg7d - recentAvg) / avg7d) * 100;
        const severity = dropPct >= DRIFT_CONFIG.hrv.criticalDropPct ? "critical" : dropPct >= 16 ? "high" : "moderate";
        const interventions = DRIFT_INTERVENTIONS.hrv_drift;

        driftSignals.push({
          id: "hrv_drift",
          metric: "hrv",
          metricLabel: "Heart Rate Variability",
          currentValue: Math.round(recentAvg),
          baselineValue: Math.round(avg7d),
          deviationPct: Math.round(dropPct),
          consecutiveDays: consecutiveBelow,
          severity,
          trend: severity === "critical" ? "collapsing" : "eroding",
          detectedAt: now,
          intervention: interventions[0],
          dataPoints: sorted.slice(0, 7).map((r) => ({
            value: Math.round(r.value),
            timestamp: r.measuredAt,
          })),
        });
      }
    }

    /* ── 3. SLEEP DRIFT ── */
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs
      .filter((s) => s.loggedAt >= cutoff7d)
      .sort((a, b) => b.loggedAt - a.loggedAt);

    if (recentSleep.length >= 3) {
      const avgScore = recentSleep.reduce((s, r) => s + r.sleepScore, 0) / recentSleep.length;
      let consecutiveDecline = 0;

      for (let i = 0; i < recentSleep.length - 1; i++) {
        if (recentSleep[i].sleepScore < recentSleep[i + 1].sleepScore - 3) {
          consecutiveDecline++;
        } else {
          break;
        }
      }

      const recentScoreAvg = recentSleep.slice(0, 3).reduce((s, r) => s + r.sleepScore, 0) / 3;
      const scoreDrop = avgScore - recentScoreAvg;

      if (
        consecutiveDecline >= DRIFT_CONFIG.sleep.minConsecutiveNights &&
        scoreDrop >= DRIFT_CONFIG.sleep.minScoreDrop
      ) {
        const severity = scoreDrop >= 20 ? "critical" : scoreDrop >= 15 ? "high" : "moderate";
        const interventions = DRIFT_INTERVENTIONS.sleep_drift;

        driftSignals.push({
          id: "sleep_drift",
          metric: "sleep",
          metricLabel: "Sleep Quality",
          currentValue: Math.round(recentScoreAvg),
          baselineValue: Math.round(avgScore),
          deviationPct: Math.round((scoreDrop / avgScore) * 100),
          consecutiveDays: consecutiveDecline + 1,
          severity,
          trend: severity === "critical" ? "collapsing" : "declining",
          detectedAt: now,
          intervention: interventions[0],
          dataPoints: recentSleep.slice(0, 7).map((s) => ({
            value: Math.round(s.sleepScore),
            timestamp: s.loggedAt,
          })),
        });
      }
    }

    /* ── 4. ADHERENCE DRIFT ── */
    const adherenceScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentAdherence = adherenceScores
      .filter((a) => a.updatedAt >= cutoff3d)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (recentAdherence.length >= 2) {
      let consecutiveLow = 0;
      for (const score of recentAdherence) {
        if (score.adherencePercent < 50) {
          consecutiveLow++;
        } else {
          break;
        }
      }

      if (consecutiveLow >= DRIFT_CONFIG.adherence.minConsecutiveDays) {
        const recentRate = recentAdherence.slice(0, 2).reduce((s, a) => s + a.adherencePercent, 0) / 2;
        const overallRate = adherenceScores.length > 0
          ? adherenceScores.reduce((s, a) => s + a.adherencePercent, 0) / adherenceScores.length
          : 80;
        const interventions = DRIFT_INTERVENTIONS.adherence_drift;

        driftSignals.push({
          id: "adherence_drift",
          metric: "adherence",
          metricLabel: "Protocol Adherence",
          currentValue: Math.round(recentRate),
          baselineValue: Math.round(overallRate),
          deviationPct: Math.round(((overallRate - recentRate) / overallRate) * 100),
          consecutiveDays: consecutiveLow,
          severity: recentRate < 30 ? "critical" : "high",
          trend: recentRate < 30 ? "collapsing" : "eroding",
          detectedAt: now,
          intervention: interventions[0],
          dataPoints: recentAdherence.slice(0, 7).map((a) => ({
            value: Math.round(a.adherencePercent),
            timestamp: a.updatedAt,
          })),
        });
      }
    }

    // Sort by severity: critical > high > moderate
    const severityOrder = { critical: 0, high: 1, moderate: 2 };
    driftSignals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const hasCritical = driftSignals.some((d) => d.severity === "critical");
    const totalDrifts = driftSignals.length;

    return {
      sessionId: args.sessionId,
      driftSignals,
      totalDrifts,
      hasCritical,
      worstSeverity: hasCritical ? "critical" : totalDrifts > 0 ? "high" : "nominal",
      systemStatus: totalDrifts === 0
        ? "All biological vectors within baseline — no drift detected"
        : `${totalDrifts} drift signal${totalDrifts > 1 ? "s" : ""} detected — ${hasCritical ? "URGENT intervention required" : "protocol adjustment recommended"}`,
      scannedAt: now,
    };
  },
});

/* ── Accept a drift intervention — log to activeInterventions ── */
export const acceptDriftIntervention = mutation({
  args: {
    sessionId: v.string(),
    driftMetric: v.string(),
    interventionType: v.string(),
    title: v.string(),
    subtitle: v.string(),
    description: v.string(),
    icon: v.string(),
    durationMinutes: v.number(),
    priority: v.string(),
    accentColor: v.string(),
    deviationPct: v.number(),
    currentValue: v.number(),
    baselineValue: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing active intervention for this metric
    const existing = await ctx.db
      .query("activeInterventions")
      .withIndex("by_sessionId_and_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    const alreadyActive = existing.find((i) => i.driftMetric === args.driftMetric);
    if (alreadyActive) {
      return { id: alreadyActive._id, alreadyActive: true };
    }

    // Log to drift history
    await ctx.db.insert("driftHistory", {
      sessionId: args.sessionId,
      metric: args.driftMetric,
      currentValue: args.currentValue,
      baselineValue: args.baselineValue,
      deviationPct: args.deviationPct,
      severity: args.priority,
      triggerRule: `${args.driftMetric}_consecutive_decline`,
      interventionGenerated: true,
      detectedAt: now,
    });

    const id = await ctx.db.insert("activeInterventions", {
      sessionId: args.sessionId,
      driftMetric: args.driftMetric,
      interventionType: args.interventionType,
      title: args.title,
      subtitle: args.subtitle,
      description: args.description,
      icon: args.icon,
      durationMinutes: args.durationMinutes,
      priority: args.priority,
      accentColor: args.accentColor,
      status: "active",
      deviationPct: args.deviationPct,
      currentValue: args.currentValue,
      baselineValue: args.baselineValue,
      createdAt: now,
      expiresAt: now + args.durationMinutes * 60 * 1000,
      acceptedAt: now,
    });

    return { id, alreadyActive: false };
  },
});

/* ── Dismiss a drift signal ── */
export const dismissDriftSignal = mutation({
  args: {
    sessionId: v.string(),
    driftMetric: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("driftHistory", {
      sessionId: args.sessionId,
      metric: args.driftMetric,
      currentValue: 0,
      baselineValue: 0,
      deviationPct: 0,
      severity: "dismissed",
      triggerRule: `${args.driftMetric}_dismissed`,
      interventionGenerated: false,
      detectedAt: now,
    });
    return { dismissed: true };
  },
});

/* ── Get drift history for a session ── */
export const getDriftHistory = query({
  args: { sessionId: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lookback = (args.days ?? 30) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - lookback;
    const history = await ctx.db
      .query("driftHistory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return history
      .filter((h) => h.detectedAt >= cutoff)
      .sort((a, b) => b.detectedAt - a.detectedAt);
  },
});

/* ═══════════════════════════════════════════════════════════════
   RESET BASELINES FOR PROTOCOL INSTALLATION
   
   When a new protocol stack is installed, existing drift baselines
   become invalid (the user's regimen has fundamentally changed).
   This mutation:
   1. Resolves all active drift events for the session
   2. Clears active interventions (new protocol = fresh start)
   3. Logs a "baseline_reset" event to drift history
   ═══════════════════════════════════════════════════════════════ */

export const resetBaselinesForProtocol = mutation({
  args: {
    sessionId: v.string(),
    protocolName: v.string(),
    protocolId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let resolvedDrifts = 0;
    let resolvedInterventions = 0;

    // 1. Resolve all active drift events
    const activeDriftEvents = await ctx.db
      .query("driftEvents")
      .withIndex("by_sessionId_and_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    for (const event of activeDriftEvents) {
      await ctx.db.patch(event._id, {
        status: "resolved_by_protocol",
        resolvedAt: now,
        recalibrationSummary: `Baselines reset — new protocol "${args.protocolName}" installed`,
      });
      resolvedDrifts++;
    }

    // 2. Expire all active interventions
    const activeInterventions = await ctx.db
      .query("activeInterventions")
      .withIndex("by_sessionId_and_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    for (const intervention of activeInterventions) {
      await ctx.db.patch(intervention._id, {
        status: "superseded",
        completedAt: now,
      });
      resolvedInterventions++;
    }

    // 3. Log baseline reset event to drift history
    await ctx.db.insert("driftHistory", {
      sessionId: args.sessionId,
      metric: "all_baselines",
      currentValue: 0,
      baselineValue: 0,
      deviationPct: 0,
      severity: "info",
      triggerRule: `protocol_install:${args.protocolId}`,
      interventionGenerated: false,
      detectedAt: now,
    });

    // 4. Log journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "baseline_reset",
      eventKey: args.protocolId,
      value: `Drift baselines reset — "${args.protocolName}" installed. ${resolvedDrifts} drift events resolved, ${resolvedInterventions} interventions superseded.`,
      numericValue: resolvedDrifts + resolvedInterventions,
      loggedAt: now,
    });

    return {
      resolvedDrifts,
      resolvedInterventions,
      message: `Baselines reset for "${args.protocolName}" — ${resolvedDrifts} drifts resolved, ${resolvedInterventions} interventions cleared`,
    };
  },
});
