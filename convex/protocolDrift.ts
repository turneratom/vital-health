import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL DRIFT DETECTION ENGINE
   
   Compares real-time biometric data against 7-day rolling baselines.
   When a ≥15% decline in recovery metrics is detected, automatically
   generates frictionless Micro-Interventions (NSDR, breathwork,
   supplement stacks) and injects them into the user's HUD.
   
   Drift Rules:
   • HRV drop ≥15% → NSDR + Box Breathing
   • Sleep Quality drop ≥15% → Magnesium + Screen-Off Protocol
   • Recovery drop ≥15% → Active Recovery + Cold Exposure
   • Resting HR spike ≥12% → Vagal Tone Reset
   • Combined multi-metric drift → Deep Recovery Protocol
   ═══════════════════════════════════════════════════════════════ */

/* ── Drift Detection Thresholds ── */
const DRIFT_THRESHOLDS = {
  watch: 10,     // 10% deviation — monitor
  warning: 15,   // 15% deviation — generate intervention
  critical: 25,  // 25% deviation — urgent intervention
} as const;

/* ── Micro-Intervention Templates ── */
interface InterventionTemplate {
  interventionType: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  durationMinutes: number;
  accentColor: string;
  ttlHours: number;
}

const INTERVENTION_LIBRARY: Record<string, InterventionTemplate[]> = {
  hrv: [
    {
      interventionType: "nsdr",
      title: "20min Guided NSDR",
      subtitle: "Non-Sleep Deep Rest · Vagal Tone Reset",
      description: "HRV has dropped significantly below your 7-day baseline. NSDR (Non-Sleep Deep Rest) activates the parasympathetic nervous system through body scanning and controlled breathing, restoring vagal tone within a single session. This protocol has been shown to increase HRV by 15-25% within 2 hours post-session.",
      icon: "🧠",
      durationMinutes: 20,
      accentColor: "#6B8AFF",
      ttlHours: 8,
    },
    {
      interventionType: "breathwork",
      title: "10min Box Breathing",
      subtitle: "4-4-4-4 Cadence · Autonomic Rebalance",
      description: "Your autonomic nervous system is showing sympathetic overdrive. Box breathing (4s inhale, 4s hold, 4s exhale, 4s hold) directly stimulates the vagus nerve, shifting the autonomic balance toward parasympathetic dominance. Expect HRV improvement within 30 minutes.",
      icon: "🫁",
      durationMinutes: 10,
      accentColor: "#00FFCC",
      ttlHours: 6,
    },
  ],
  sleepScore: [
    {
      interventionType: "supplement",
      title: "Sleep Recovery Stack",
      subtitle: "Magnesium Glycinate 400mg + L-Theanine 200mg",
      description: "Sleep quality has declined below your baseline threshold. This supplement stack targets GABA receptor modulation (magnesium) and alpha-wave promotion (L-theanine) to restore sleep architecture. Take 60-90 minutes before bed for optimal absorption.",
      icon: "💊",
      durationMinutes: 2,
      accentColor: "#E8976C",
      ttlHours: 12,
    },
    {
      interventionType: "nsdr",
      title: "Afternoon NSDR Reset",
      subtitle: "15min Yoga Nidra · Sleep Debt Recovery",
      description: "Your sleep score indicates accumulated sleep debt. A 15-minute NSDR session between 1-3pm partially compensates for lost deep sleep by triggering theta-wave states that mirror Stage 2 NREM sleep architecture.",
      icon: "🌙",
      durationMinutes: 15,
      accentColor: "#6B8AFF",
      ttlHours: 8,
    },
  ],
  recovery: [
    {
      interventionType: "cold",
      title: "2min Cold Exposure",
      subtitle: "Cold Plunge or Shower · Norepinephrine Cascade",
      description: "Recovery metrics have dropped significantly. Cold exposure triggers a 200-300% increase in norepinephrine, activating the body's anti-inflammatory cascade and resetting the sympathetic-parasympathetic balance. Start at 15°C/59°F for 2 minutes.",
      icon: "🧊",
      durationMinutes: 2,
      accentColor: "#00FFCC",
      ttlHours: 6,
    },
    {
      interventionType: "movement",
      title: "15min Active Recovery Walk",
      subtitle: "Zone 1 HR · Lymphatic Flush + Parasympathetic Shift",
      description: "Your recovery score indicates systemic fatigue. Low-intensity walking (HR < 110bpm) promotes lymphatic drainage, reduces cortisol, and shifts the autonomic nervous system toward recovery mode without adding training load.",
      icon: "🚶",
      durationMinutes: 15,
      accentColor: "#00DC82",
      ttlHours: 8,
    },
  ],
  restingHR: [
    {
      interventionType: "breathwork",
      title: "Physiological Sigh Protocol",
      subtitle: "Double Inhale + Extended Exhale · Instant Calm",
      description: "Resting heart rate is elevated above your baseline, indicating sympathetic activation. The physiological sigh (double nasal inhale + slow oral exhale) is the fastest known method to reduce heart rate, activating the cardiac vagal brake within seconds.",
      icon: "💓",
      durationMinutes: 5,
      accentColor: "#FF6B6B",
      ttlHours: 4,
    },
    {
      interventionType: "hydration",
      title: "Hydration + Electrolyte Reset",
      subtitle: "500ml Water · Sodium + Potassium + Magnesium",
      description: "Elevated resting HR can indicate dehydration-induced cardiac compensation. Electrolyte replenishment restores plasma volume and reduces cardiac workload. Add a pinch of sea salt to water for immediate sodium delivery.",
      icon: "💧",
      durationMinutes: 2,
      accentColor: "#00FFCC",
      ttlHours: 6,
    },
  ],
  /* ── Hydration-specific interventions (triggered by compound dehydration signals) ── */
  hydration: [
    {
      interventionType: "hydration",
      title: "Rapid Rehydration Protocol",
      subtitle: "750ml Water + 1/4 tsp Sea Salt + Lemon",
      description: "Multiple biomarkers suggest dehydration-induced autonomic stress. Rapid rehydration with electrolytes restores plasma volume within 15-20 minutes, reducing cardiac workload and improving HRV. The sodium-glucose co-transport mechanism accelerates water absorption by 3x compared to plain water.",
      icon: "💧",
      durationMinutes: 5,
      accentColor: "#00FFCC",
      ttlHours: 4,
    },
    {
      interventionType: "hydration",
      title: "Coconut Water + Mineral Boost",
      subtitle: "Natural Electrolyte Replenishment · Potassium Load",
      description: "Your recovery metrics indicate electrolyte imbalance. Coconut water provides 600mg potassium per serving alongside natural sodium and magnesium. This combination supports cellular hydration and reduces sympathetic nervous system activation within 30 minutes.",
      icon: "🥥",
      durationMinutes: 2,
      accentColor: "#00DC82",
      ttlHours: 6,
    },
  ],
  /* ── Breathing-specific interventions (targeted vagal tone protocols) ── */
  breathing: [
    {
      interventionType: "breathwork",
      title: "4-7-8 Relaxation Breath",
      subtitle: "Parasympathetic Activation · Vagal Tone Boost",
      description: "The 4-7-8 breathing technique (4s inhale, 7s hold, 8s exhale) creates a powerful parasympathetic shift by extending the exhale phase. This activates the vagal brake mechanism, reducing heart rate and increasing HRV within 3-4 cycles. Perform 4 cycles for immediate autonomic rebalancing.",
      icon: "🌬️",
      durationMinutes: 5,
      accentColor: "#6B8AFF",
      ttlHours: 4,
    },
    {
      interventionType: "breathwork",
      title: "Cyclic Hyperventilation Reset",
      subtitle: "25 Deep Breaths + 1min Hold · Wim Hof Method",
      description: "When recovery drops significantly, a controlled hyperventilation protocol followed by breath retention triggers a massive norepinephrine release (200-300%), alkalizes blood pH, and resets the autonomic nervous system. This is the fastest known method to shift from sympathetic to parasympathetic dominance.",
      icon: "🫁",
      durationMinutes: 8,
      accentColor: "#00FFCC",
      ttlHours: 6,
    },
  ],
};

/* ── Multi-metric deep recovery (when 2+ metrics are drifting) ── */
const DEEP_RECOVERY_INTERVENTION: InterventionTemplate = {
  interventionType: "nsdr",
  title: "Deep Recovery Protocol",
  subtitle: "30min NSDR + Supplement Stack + Screen-Off",
  description: "Multiple recovery metrics are declining simultaneously, indicating systemic autonomic stress. This compound protocol combines NSDR for parasympathetic activation, targeted supplementation for neurochemical support, and digital sunset to eliminate blue-light cortisol stimulation. Execute within the next 2 hours for maximum recovery impact.",
  icon: "🛡️",
  durationMinutes: 30,
  accentColor: "#FF6B6B",
  ttlHours: 6,
};

/* ═══════════════════════════════════════════════════════════════
   detectProtocolDrift — Main Query
   
   Reads biometric baselines and current values, computes drift,
   and returns any active interventions + new drift detections.
   ═══════════════════════════════════════════════════════════════ */

export const detectProtocolDrift = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();

    /* ── Safe empty-state response (returned when insufficient data) ── */
    const EMPTY_DRIFT_RESPONSE = {
      driftSignals: [] as any[],
      suggestedInterventions: [] as any[],
      activeInterventions: [] as any[],
      recentDriftCount: 0,
      hasActiveDrift: false,
      worstDrift: null,
      generatedAt: now,
      calibrating: false,
      driftScore: 0,
      status: "stable" as const,
      message: "All systems normal",
    };

    try {

    /* ── Guard: validate sessionId ── */
    if (!args.sessionId || args.sessionId.trim() === "") {
      return { ...EMPTY_DRIFT_RESPONSE, calibrating: true };
    }

    /* ── 1. Get BioVault for current biometric state ── */
    const bioVaultDocs = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const bioVault = bioVaultDocs.length > 0 ? bioVaultDocs[bioVaultDocs.length - 1] : null;

    /* ── 2. Get recent HRV readings for rolling baseline ── */
    const day7ago = now - 7 * 24 * 60 * 60 * 1000;
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", day7ago)
      )
      .collect();

    /* ── 3. Get recent sleep logs for rolling baseline ── */
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentSleep = sleepLogs
      .filter((s) => s.loggedAt >= day7ago)
      .sort((a, b) => b.loggedAt - a.loggedAt);

    /* ── Guard: if no biometric data exists at all, return calibrating state ── */
    if (!bioVault && hrvReadings.length === 0 && recentSleep.length === 0) {
      return { ...EMPTY_DRIFT_RESPONSE, calibrating: true };
    }

    /* ── 4. Get existing active interventions ── */
    const existingInterventions = await ctx.db
      .query("activeInterventions")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    /* ── 5. Get recent drift history (last 24h) ── */
    const day1ago = now - 24 * 60 * 60 * 1000;
    const recentDrifts = await ctx.db
      .query("driftHistory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const last24hDrifts = recentDrifts.filter((d) => d.detectedAt >= day1ago);

    /* ── 6. Compute baselines and detect drift ── */
    interface DriftSignal {
      metric: string;
      currentValue: number;
      baselineValue: number;
      deviationPct: number;
      severity: "watch" | "warning" | "critical";
      triggerRule: string;
    }

    const driftSignals: DriftSignal[] = [];

    // HRV Drift — guard against empty arrays and null/undefined values
    const hrvBaseline = (bioVault?.hrvAvg7d != null && bioVault.hrvAvg7d > 0)
      ? bioVault.hrvAvg7d
      : (hrvReadings.length > 0
        ? hrvReadings.reduce((s, r) => s + (r.value ?? 0), 0) / hrvReadings.length
        : null);
    const hrvCurrent = (bioVault?.hrvCurrent != null && bioVault.hrvCurrent > 0)
      ? bioVault.hrvCurrent
      : (hrvReadings.length > 0 && hrvReadings[hrvReadings.length - 1]?.value != null
        ? hrvReadings[hrvReadings.length - 1].value
        : null);

    if (hrvBaseline != null && hrvCurrent != null && hrvBaseline > 0 && isFinite(hrvBaseline) && isFinite(hrvCurrent)) {
      const deviation = ((hrvCurrent - hrvBaseline) / hrvBaseline) * 100;
      if (deviation <= -DRIFT_THRESHOLDS.watch) {
        const absDev = Math.abs(deviation);
        const severity = absDev >= DRIFT_THRESHOLDS.critical ? "critical"
          : absDev >= DRIFT_THRESHOLDS.warning ? "warning" : "watch";
        driftSignals.push({
          metric: "hrv",
          currentValue: hrvCurrent,
          baselineValue: hrvBaseline,
          deviationPct: Math.round(deviation * 10) / 10,
          severity,
          triggerRule: `HRV ${Math.round(absDev)}% below 7-day baseline`,
        });
      }
    }

    // Sleep Score Drift — guard against empty arrays and null/undefined scores
    const sleepWithScores = recentSleep.filter((s) => s.sleepScore != null && isFinite(s.sleepScore));
    const sleepBaseline = sleepWithScores.length >= 3
      ? sleepWithScores.slice(0, 7).reduce((s, l) => s + l.sleepScore, 0) / Math.min(sleepWithScores.length, 7)
      : (bioVault?.sleepScore != null && bioVault.sleepScore > 0 ? bioVault.sleepScore : null);
    const sleepCurrent = sleepWithScores.length > 0
      ? sleepWithScores[0].sleepScore
      : (bioVault?.sleepScore != null && bioVault.sleepScore > 0 ? bioVault.sleepScore : null);

    if (sleepBaseline != null && sleepCurrent != null && sleepBaseline > 0 && isFinite(sleepBaseline) && isFinite(sleepCurrent)) {
      const deviation = ((sleepCurrent - sleepBaseline) / sleepBaseline) * 100;
      if (deviation <= -DRIFT_THRESHOLDS.watch) {
        const absDev = Math.abs(deviation);
        const severity = absDev >= DRIFT_THRESHOLDS.critical ? "critical"
          : absDev >= DRIFT_THRESHOLDS.warning ? "warning" : "watch";
        driftSignals.push({
          metric: "sleepScore",
          currentValue: sleepCurrent,
          baselineValue: Math.round(sleepBaseline * 10) / 10,
          deviationPct: Math.round(deviation * 10) / 10,
          severity,
          triggerRule: `Sleep score ${Math.round(absDev)}% below rolling average`,
        });
      }
    }

    // Recovery Drift (from elite scores as proxy)
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentScores = eliteScores
      .filter((s) => s.calculatedAt >= day7ago)
      .sort((a, b) => b.calculatedAt - a.calculatedAt);

    if (recentScores.length >= 2) {
      const validScores = recentScores.filter((e) => e.score != null && isFinite(e.score));
      if (validScores.length < 2) {
        // Not enough valid scores to compute recovery drift
      } else {
      const avgScore = validScores.reduce((s, e) => s + e.score, 0) / validScores.length;
      const latestScore = validScores[0].score;
      if (avgScore > 0 && isFinite(avgScore) && isFinite(latestScore)) {
        const deviation = ((latestScore - avgScore) / avgScore) * 100;
        if (deviation <= -DRIFT_THRESHOLDS.watch) {
          const absDev = Math.abs(deviation);
          const severity = absDev >= DRIFT_THRESHOLDS.critical ? "critical"
            : absDev >= DRIFT_THRESHOLDS.warning ? "warning" : "watch";
        driftSignals.push({
          metric: "recovery",
          currentValue: latestScore,
          baselineValue: Math.round(avgScore * 10) / 10,
          deviationPct: Math.round(deviation * 10) / 10,
          severity,
          triggerRule: `Vitality score ${Math.round(absDev)}% below 7-day average`,
        });
      }
      } // close validScores else
    }
    }

    // Resting HR Drift (inverse — higher is worse) — guard against empty/null HR values
    const hrvWithHR = hrvReadings.filter((r) => r.heartRate != null && r.heartRate > 0 && isFinite(r.heartRate));
    const restingHRBaseline = hrvWithHR.length > 0
      ? hrvWithHR.reduce((s, r) => s + (r.heartRate ?? 0), 0) / hrvWithHR.length
      : null;
    const lastHrvReading = hrvReadings.length > 0 ? hrvReadings[hrvReadings.length - 1] : null;
    const restingHRCurrent = (lastHrvReading?.heartRate != null && lastHrvReading.heartRate > 0 && isFinite(lastHrvReading.heartRate))
      ? lastHrvReading.heartRate
      : null;

    if (restingHRBaseline != null && restingHRCurrent != null && restingHRBaseline > 0 && isFinite(restingHRBaseline)) {
      const deviation = ((restingHRCurrent - restingHRBaseline) / restingHRBaseline) * 100;
      if (deviation >= 12) { // HR going UP is bad
        const severity = deviation >= 25 ? "critical" : deviation >= 15 ? "warning" : "watch";
        driftSignals.push({
          metric: "restingHR",
          currentValue: restingHRCurrent,
          baselineValue: Math.round(restingHRBaseline * 10) / 10,
          deviationPct: Math.round(deviation * 10) / 10,
          severity,
          triggerRule: `Resting HR ${Math.round(deviation)}% above baseline`,
        });
      }
    }

    /* ── 7. Generate intervention suggestions ── */
    const warningOrCritical = driftSignals.filter(
      (d) => d.severity === "warning" || d.severity === "critical"
    );

    const suggestedInterventions: Array<{
      metric: string;
      template: InterventionTemplate;
      deviationPct: number;
      currentValue: number;
      baselineValue: number;
      priority: "high" | "critical" | "moderate";
      alreadyActive: boolean;
    }> = [];

    // Check for multi-metric drift (compound stress)
    if (warningOrCritical.length >= 2) {
      const worstDrift = warningOrCritical.sort(
        (a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct)
      )[0];
      const alreadyActive = existingInterventions.some(
        (i) => i.interventionType === "nsdr" && i.driftMetric === "compound"
      );
      suggestedInterventions.push({
        metric: "compound",
        template: DEEP_RECOVERY_INTERVENTION,
        deviationPct: worstDrift.deviationPct,
        currentValue: worstDrift.currentValue,
        baselineValue: worstDrift.baselineValue,
        priority: "critical",
        alreadyActive,
      });
    }

    // Individual metric interventions
    for (const drift of warningOrCritical) {
      const templates = INTERVENTION_LIBRARY[drift.metric];
      if (!templates || templates.length === 0) continue;

      // Pick the most appropriate template based on severity
      const template = drift.severity === "critical" ? templates[0] : templates[templates.length - 1];
      const alreadyActive = existingInterventions.some(
        (i) => i.driftMetric === drift.metric
      );

      // Don't duplicate if already have a compound intervention
      if (suggestedInterventions.some((s) => s.metric === "compound")) continue;

      suggestedInterventions.push({
        metric: drift.metric,
        template,
        deviationPct: drift.deviationPct,
        currentValue: drift.currentValue,
        baselineValue: drift.baselineValue,
        priority: drift.severity === "critical" ? "critical" : "high",
        alreadyActive,
      });
    }

    // ── Recovery-specific: 15% drop triggers hydration + breathing micro-interventions ──
    const recoveryDrift = warningOrCritical.find((d) => d.metric === "recovery");
    if (recoveryDrift && Math.abs(recoveryDrift.deviationPct) >= 15) {
      // Add hydration intervention
      const hydrationTemplates = INTERVENTION_LIBRARY.hydration;
      if (hydrationTemplates && hydrationTemplates.length > 0) {
        const hydrationActive = existingInterventions.some(
          (i) => i.interventionType === "hydration" && i.driftMetric === "hydration"
        );
        suggestedInterventions.push({
          metric: "hydration",
          template: recoveryDrift.severity === "critical" ? hydrationTemplates[0] : hydrationTemplates[1],
          deviationPct: recoveryDrift.deviationPct,
          currentValue: recoveryDrift.currentValue,
          baselineValue: recoveryDrift.baselineValue,
          priority: "high",
          alreadyActive: hydrationActive,
        });
      }
      // Add breathing intervention
      const breathingTemplates = INTERVENTION_LIBRARY.breathing;
      if (breathingTemplates && breathingTemplates.length > 0) {
        const breathingActive = existingInterventions.some(
          (i) => i.interventionType === "breathwork" && i.driftMetric === "breathing"
        );
        suggestedInterventions.push({
          metric: "breathing",
          template: recoveryDrift.severity === "critical" ? breathingTemplates[1] : breathingTemplates[0],
          deviationPct: recoveryDrift.deviationPct,
          currentValue: recoveryDrift.currentValue,
          baselineValue: recoveryDrift.baselineValue,
          priority: recoveryDrift.severity === "critical" ? "critical" : "high",
          alreadyActive: breathingActive,
        });
      }
    }

    // ── HRV-specific: 15% drop also triggers targeted breathing ──
    const hrvDrift = warningOrCritical.find((d) => d.metric === "hrv");
    if (hrvDrift && Math.abs(hrvDrift.deviationPct) >= 15 && !recoveryDrift) {
      const breathingTemplates = INTERVENTION_LIBRARY.breathing;
      if (breathingTemplates && breathingTemplates.length > 0) {
        const breathingActive = existingInterventions.some(
          (i) => i.interventionType === "breathwork" && i.driftMetric === "breathing"
        );
        if (!suggestedInterventions.some((s) => s.metric === "breathing")) {
          suggestedInterventions.push({
            metric: "breathing",
            template: breathingTemplates[0],
            deviationPct: hrvDrift.deviationPct,
            currentValue: hrvDrift.currentValue,
            baselineValue: hrvDrift.baselineValue,
            priority: "high",
            alreadyActive: breathingActive,
          });
        }
      }
    }

    // Filter expired active interventions
    const validInterventions = existingInterventions.filter(
      (i) => i.expiresAt > now
    );

    // Compute aggregate drift score (0-100) from all signals
    const maxDeviation = driftSignals.length > 0
      ? Math.max(...driftSignals.map(d => Math.abs(d.deviationPct)))
      : 0;
    const driftScore = Math.min(100, Math.round(maxDeviation * 2));
    const status = warningOrCritical.length === 0
      ? "stable" as const
      : warningOrCritical.some(d => d.severity === "critical")
        ? "critical" as const
        : "drifting" as const;
    const message = status === "stable"
      ? "All systems normal"
      : status === "critical"
        ? `Critical drift detected in ${warningOrCritical.length} metric(s)`
        : `Monitoring ${warningOrCritical.length} drifting metric(s)`;

    return {
      driftSignals,
      suggestedInterventions: suggestedInterventions.slice(0, 3),
      activeInterventions: validInterventions,
      recentDriftCount: last24hDrifts.length,
      hasActiveDrift: warningOrCritical.length > 0,
      worstDrift: warningOrCritical.length > 0
        ? warningOrCritical.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))[0]
        : null,
      generatedAt: now,
      calibrating: false,
      driftScore,
      status,
      message,
    };

    } catch (error) {
      // Graceful fallback — never crash the server on missing/malformed biometric data
      console.error("[protocolDrift] detectProtocolDrift error:", error);
      return {
        ...EMPTY_DRIFT_RESPONSE,
        calibrating: true,
      };
    }
  },
});

/* ═══════════════════════════════════════════════════════════════
   commitDriftEvent — Persist a drift detection to history
   ═══════════════════════════════════════════════════════════════ */

export const commitDriftEvent = mutation({
  args: {
    sessionId: v.string(),
    metric: v.string(),
    currentValue: v.number(),
    baselineValue: v.number(),
    deviationPct: v.number(),
    severity: v.string(),
    triggerRule: v.string(),
    interventionGenerated: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("driftHistory", {
      ...args,
      detectedAt: Date.now(),
    });
  },
});

/* ═══════════════════════════════════════════════════════════════
   insertMicroIntervention — Create an active intervention
   ═══════════════════════════════════════════════════════════════ */

export const insertMicroIntervention = mutation({
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
    ttlHours: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("activeInterventions", {
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
      expiresAt: now + args.ttlHours * 60 * 60 * 1000,
    });
  },
});

/* ═══════════════════════════════════════════════════════════════
   updateInterventionStatus — Accept, dismiss, or complete
   ═══════════════════════════════════════════════════════════════ */

export const updateInterventionStatus = mutation({
  args: {
    interventionId: v.id("activeInterventions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: Record<string, any> = { status: args.status };
    if (args.status === "accepted") updates.acceptedAt = now;
    if (args.status === "completed") updates.completedAt = now;
    if (args.status === "dismissed") updates.dismissedAt = now;
    await ctx.db.patch(args.interventionId, updates);
  },
});
