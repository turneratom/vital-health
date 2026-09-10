import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   SUBSTANCE INTEGRITY ENGINE
   
   Tracks peptide/HRT/wellness protocol dosages with cycle-aware
   logic (5-on/2-off, 4-week blocks). Cross-references biomarkers
   (IGF-1, fasting glucose, testosterone) against reference ranges
   and generates Proactive Pulse alerts when cycles are ending or
   biomarkers drift outside optimal windows.
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker Reference Ranges ── */
const BIOMARKER_REFERENCES: Record<string, {
  label: string; unit: string; optimalLow: number; optimalHigh: number;
  warningLow: number; warningHigh: number; icon: string;
}> = {
  igf1: { label: "IGF-1", unit: "ng/mL", optimalLow: 150, optimalHigh: 300, warningLow: 100, warningHigh: 400, icon: "🧬" },
  fastingGlucose: { label: "Fasting Glucose", unit: "mg/dL", optimalLow: 72, optimalHigh: 95, warningLow: 65, warningHigh: 110, icon: "🩸" },
  testosteroneTotal: { label: "Total Testosterone", unit: "ng/dL", optimalLow: 500, optimalHigh: 900, warningLow: 300, warningHigh: 1100, icon: "⚡" },
  testosteroneFree: { label: "Free Testosterone", unit: "pg/mL", optimalLow: 15, optimalHigh: 30, warningLow: 9, warningHigh: 40, icon: "⚡" },
  crp: { label: "CRP", unit: "mg/L", optimalLow: 0, optimalHigh: 1.0, warningLow: 0, warningHigh: 3.0, icon: "🔥" },
  hba1c: { label: "HbA1c", unit: "%", optimalLow: 4.0, optimalHigh: 5.4, warningLow: 3.5, warningHigh: 5.7, icon: "📊" },
  ferritin: { label: "Ferritin", unit: "ng/mL", optimalLow: 80, optimalHigh: 150, warningLow: 30, warningHigh: 300, icon: "🧲" },
  vitaminD: { label: "Vitamin D", unit: "ng/mL", optimalLow: 60, optimalHigh: 80, warningLow: 30, warningHigh: 100, icon: "☀️" },
};

/* ── Injection Site Rotation Logic ── */
const INJECTION_SITES = [
  "abdomen_left", "abdomen_right", "deltoid_left", "deltoid_right",
  "glute_left", "glute_right", "thigh_left", "thigh_right",
] as const;

function getNextInjectionSite(recentSites: string[]): string {
  const last3 = recentSites.slice(-3);
  for (const site of INJECTION_SITES) {
    if (!last3.includes(site)) return site;
  }
  return INJECTION_SITES[0];
}

/* ═══════════════════════════════════════════════════════════════
   QUERIES
   ═══════════════════════════════════════════════════════════════ */

// ── Get all active substance cycles for a session ──
export const getActiveCycles = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    const offPhase = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "off_phase")
      )
      .collect();

    return [...cycles, ...offPhase].sort((a, b) => b.startedAt - a.startedAt);
  },
});

// ── Get all cycles (including paused/completed) ──
export const getAllCycles = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// ── Get recent dosage logs for a substance ──
export const getSubstanceLogs = query({
  args: { sessionId: v.string(), substanceName: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.substanceName) {
      const logs = await ctx.db
        .query("substanceLogs")
        .withIndex("by_sessionId_and_substance", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("substanceName", args.substanceName)
        )
        .collect();
      return logs.sort((a, b) => b.loggedAt - a.loggedAt).slice(0, args.limit ?? 30);
    }
    const logs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    return logs.sort((a, b) => b.loggedAt - a.loggedAt).slice(0, args.limit ?? 50);
  },
});

// ── Get active Proactive Pulse alerts ──
export const getActiveAlerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const alerts = await ctx.db
      .query("substancePulseAlerts")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();
    return alerts.filter((a) => a.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── Get suggested next injection site ──
export const getSuggestedInjectionSite = query({
  args: { sessionId: v.string(), substanceName: v.string() },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_substance", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("substanceName", args.substanceName)
      )
      .collect();
    const recentSites = logs
      .sort((a, b) => b.loggedAt - a.loggedAt)
      .slice(0, 8)
      .map((l) => l.injectionSite)
      .filter(Boolean) as string[];
    return {
      suggestedSite: getNextInjectionSite(recentSites),
      recentSites: recentSites.slice(0, 4),
    };
  },
});

// ── Full Substance Integrity dashboard state ──
export const getDashboardState = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Active cycles
    const allCycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeCycles = allCycles.filter((c) => c.status === "active" || c.status === "off_phase");

    // Recent logs (last 14 days)
    const day14ago = now - 14 * 24 * 60 * 60 * 1000;
    const allLogs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const recentLogs = allLogs.filter((l) => l.loggedAt >= day14ago).sort((a, b) => b.loggedAt - a.loggedAt);

    // Active alerts
    const alerts = await ctx.db
      .query("substancePulseAlerts")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();
    const activeAlerts = alerts.filter((a) => a.expiresAt > now);

    // BioVault for biomarker cross-reference
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Build biomarker status for monitored markers
    const monitoredMarkers = new Set<string>();
    for (const cycle of activeCycles) {
      for (const m of cycle.monitoredBiomarkers) monitoredMarkers.add(m);
    }

    const biomarkerStatus: Array<{
      key: string; label: string; value: number | null; unit: string;
      status: "optimal" | "warning" | "critical" | "unknown"; icon: string;
      optimalRange: string;
    }> = [];

    for (const key of monitoredMarkers) {
      const ref = BIOMARKER_REFERENCES[key];
      if (!ref) continue;
      const value = bioVault ? (bioVault as any)[key] ?? null : null;
      let status: "optimal" | "warning" | "critical" | "unknown" = "unknown";
      if (value !== null) {
        if (value >= ref.optimalLow && value <= ref.optimalHigh) status = "optimal";
        else if (value >= ref.warningLow && value <= ref.warningHigh) status = "warning";
        else status = "critical";
      }
      biomarkerStatus.push({
        key, label: ref.label, value, unit: ref.unit, status, icon: ref.icon,
        optimalRange: `${ref.optimalLow}-${ref.optimalHigh}`,
      });
    }

    // Compute cycle progress for each active cycle
    const cycleDetails = activeCycles.map((cycle) => {
      const totalCycleDays = cycle.onDays + cycle.offDays;
      const dayInCycle = ((cycle.currentCycleDay - 1) % totalCycleDays) + 1;
      const isOnPhase = dayInCycle <= cycle.onDays;
      const daysRemaining = isOnPhase
        ? cycle.onDays - dayInCycle
        : totalCycleDays - dayInCycle;
      const phaseLabel = isOnPhase ? `Day ${dayInCycle}/${cycle.onDays} ON` : `Day ${dayInCycle - cycle.onDays}/${cycle.offDays} OFF`;

      // Total weeks elapsed
      const weeksElapsed = Math.floor((now - cycle.startedAt) / (7 * 24 * 60 * 60 * 1000));

      // Doses in current on-phase
      const cycleLogs = recentLogs.filter((l) => l.substanceName === cycle.substanceName);

      return {
        ...cycle,
        dayInCycle,
        isOnPhase,
        daysRemaining,
        phaseLabel,
        weeksElapsed,
        recentDoseCount: cycleLogs.length,
      };
    });

    return {
      cycles: cycleDetails,
      recentLogs: recentLogs.slice(0, 20),
      activeAlerts,
      biomarkerStatus,
      totalActiveCycles: activeCycles.length,
      totalDosesLogged: allLogs.length,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   MUTATIONS
   ═══════════════════════════════════════════════════════════════ */

// ── Create a new substance cycle ──
export const createCycle = mutation({
  args: {
    sessionId: v.string(),
    substanceName: v.string(),
    category: v.string(),
    icon: v.string(),
    color: v.string(),
    dosageMg: v.number(),
    dosageUnit: v.string(),
    route: v.string(),
    frequency: v.string(),
    onDays: v.number(),
    offDays: v.number(),
    totalCycleWeeks: v.optional(v.number()),
    monitoredBiomarkers: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cycleId = await ctx.db.insert("substanceCycles", {
      sessionId: args.sessionId,
      substanceName: args.substanceName,
      category: args.category,
      icon: args.icon,
      color: args.color,
      dosageMg: args.dosageMg,
      dosageUnit: args.dosageUnit,
      route: args.route,
      frequency: args.frequency,
      onDays: args.onDays,
      offDays: args.offDays,
      totalCycleWeeks: args.totalCycleWeeks,
      startedAt: now,
      status: "active",
      currentCycleDay: 1,
      isOnPhase: true,
      totalDosesLogged: 0,
      monitoredBiomarkers: args.monitoredBiomarkers,
      notes: args.notes,
    });

    // Journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "substance_cycle_started",
      eventKey: args.substanceName,
      value: `Started ${args.substanceName} cycle: ${args.onDays}-on/${args.offDays}-off`,
      loggedAt: now,
    });

    return cycleId;
  },
});

// ── Log a dosage ──
export const logDose = mutation({
  args: {
    sessionId: v.string(),
    substanceName: v.string(),
    category: v.string(),
    dosageMg: v.number(),
    dosageUnit: v.string(),
    route: v.string(),
    injectionSite: v.optional(v.string()),
    cycleId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Insert the dose log
    const logId = await ctx.db.insert("substanceLogs", {
      sessionId: args.sessionId,
      substanceName: args.substanceName,
      category: args.category,
      dosageMg: args.dosageMg,
      dosageUnit: args.dosageUnit,
      route: args.route,
      injectionSite: args.injectionSite,
      cycleId: args.cycleId,
      notes: args.notes,
      loggedAt: now,
    });

    // Update cycle if linked
    if (args.cycleId) {
      const allCycles = await ctx.db
        .query("substanceCycles")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const cycle = allCycles.find((c) => c._id === args.cycleId);
      if (cycle) {
        await ctx.db.patch(cycle._id, {
          lastDoseAt: now,
          totalDosesLogged: cycle.totalDosesLogged + 1,
        });
      }
    }

    // Journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "substance_dose_logged",
      eventKey: args.substanceName,
      value: `Logged ${args.dosageMg}${args.dosageUnit} ${args.substanceName}${args.injectionSite ? ` @ ${args.injectionSite.replace(/_/g, " ")}` : ""}`,
      numericValue: args.dosageMg,
      loggedAt: now,
    });

    return logId;
  },
});

// ── Advance cycle day (called daily or on-demand) ──
export const advanceCycleDay = mutation({
  args: { sessionId: v.string(), cycleId: v.id("substanceCycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.sessionId !== args.sessionId) throw new Error("Cycle not found");
    if (cycle.status === "completed" || cycle.status === "paused") return cycle;

    const totalCycleDays = cycle.onDays + cycle.offDays;
    const nextDay = cycle.currentCycleDay + 1;
    const dayInCycle = ((nextDay - 1) % totalCycleDays) + 1;
    const isOnPhase = dayInCycle <= cycle.onDays;
    const wasOnPhase = cycle.isOnPhase;

    // Check if total cycle duration exceeded
    const now = Date.now();
    const weeksElapsed = (now - cycle.startedAt) / (7 * 24 * 60 * 60 * 1000);
    if (cycle.totalCycleWeeks && weeksElapsed >= cycle.totalCycleWeeks) {
      await ctx.db.patch(args.cycleId, { status: "completed", completedAt: now });
      // Generate cycle-ending alert
      await ctx.db.insert("substancePulseAlerts", {
        sessionId: args.sessionId,
        cycleId: args.cycleId,
        alertType: "cycle_ending",
        severity: "info",
        title: `${cycle.substanceName} Cycle Complete`,
        message: `Your ${cycle.totalCycleWeeks}-week ${cycle.substanceName} cycle has concluded. Review biomarkers before starting a new cycle.`,
        icon: "🏁",
        accentColor: cycle.color,
        substanceName: cycle.substanceName,
        actionLabel: "View Labs",
        actionType: "view_labs",
        status: "active",
        createdAt: now,
        expiresAt: now + 48 * 60 * 60 * 1000,
      });
      return { ...cycle, status: "completed" };
    }

    // Phase transition alerts
    if (wasOnPhase && !isOnPhase) {
      await ctx.db.insert("substancePulseAlerts", {
        sessionId: args.sessionId,
        cycleId: args.cycleId,
        alertType: "off_phase_start",
        severity: "info",
        title: `${cycle.substanceName} — Off Phase`,
        message: `Entering ${cycle.offDays}-day off phase. Your body uses this window for receptor resensitization. No doses needed until Day ${cycle.onDays + cycle.offDays + 1}.`,
        icon: "⏸️",
        accentColor: "#6B8AFF",
        substanceName: cycle.substanceName,
        status: "active",
        createdAt: now,
        expiresAt: now + cycle.offDays * 24 * 60 * 60 * 1000,
      });
    } else if (!wasOnPhase && isOnPhase) {
      await ctx.db.insert("substancePulseAlerts", {
        sessionId: args.sessionId,
        cycleId: args.cycleId,
        alertType: "on_phase_start",
        severity: "info",
        title: `${cycle.substanceName} — On Phase Resumes`,
        message: `Off phase complete. Resume ${cycle.dosageMg}${cycle.dosageUnit} ${cycle.substanceName} ${cycle.frequency}.`,
        icon: "▶️",
        accentColor: cycle.color,
        substanceName: cycle.substanceName,
        actionLabel: "Log Dose",
        actionType: "log_dose",
        status: "active",
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
    }

    // Check for approaching cycle end (2 days before off-phase)
    if (isOnPhase && dayInCycle === cycle.onDays - 1) {
      await ctx.db.insert("substancePulseAlerts", {
        sessionId: args.sessionId,
        cycleId: args.cycleId,
        alertType: "cycle_ending",
        severity: "warning",
        title: `${cycle.substanceName} — Last On-Day Tomorrow`,
        message: `Tomorrow is your final on-day before the ${cycle.offDays}-day off phase. Ensure today's dose is logged.`,
        icon: "⚠️",
        accentColor: "#E8976C",
        substanceName: cycle.substanceName,
        actionLabel: "Log Dose",
        actionType: "log_dose",
        status: "active",
        createdAt: now,
        expiresAt: now + 36 * 60 * 60 * 1000,
      });
    }

    await ctx.db.patch(args.cycleId, {
      currentCycleDay: nextDay,
      isOnPhase,
      status: isOnPhase ? "active" : "off_phase",
    });

    return { currentCycleDay: nextDay, isOnPhase, dayInCycle };
  },
});

// ── Pause/resume a cycle ──
export const toggleCyclePause = mutation({
  args: { sessionId: v.string(), cycleId: v.id("substanceCycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.sessionId !== args.sessionId) throw new Error("Cycle not found");
    const now = Date.now();
    if (cycle.status === "paused") {
      await ctx.db.patch(args.cycleId, { status: cycle.isOnPhase ? "active" : "off_phase", pausedAt: undefined });
      return { status: "resumed" };
    } else {
      await ctx.db.patch(args.cycleId, { status: "paused", pausedAt: now });
      return { status: "paused" };
    }
  },
});

// ── Check biomarker drift against monitored substances ──
export const checkBiomarkerDrift = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get active cycles
    const allCycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeCycles = allCycles.filter((c) => c.status === "active" || c.status === "off_phase");
    if (activeCycles.length === 0) return { alertsGenerated: 0 };

    // Get bioVault
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!bioVault) return { alertsGenerated: 0 };

    // Get existing active alerts to avoid duplicates
    const existingAlerts = await ctx.db
      .query("substancePulseAlerts")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();
    const existingBiomarkerAlerts = new Set(
      existingAlerts.filter((a) => a.alertType === "biomarker_drift").map((a) => a.biomarker)
    );

    let alertsGenerated = 0;

    for (const cycle of activeCycles) {
      for (const markerKey of cycle.monitoredBiomarkers) {
        if (existingBiomarkerAlerts.has(markerKey)) continue;

        const ref = BIOMARKER_REFERENCES[markerKey];
        if (!ref) continue;

        const value = (bioVault as any)[markerKey] as number | undefined;
        if (value == null) continue;

        // Check if outside warning range
        let severity: "warning" | "critical" | null = null;
        let direction = "";
        if (value < ref.warningLow) { severity = "critical"; direction = "below"; }
        else if (value > ref.warningHigh) { severity = "critical"; direction = "above"; }
        else if (value < ref.optimalLow) { severity = "warning"; direction = "below"; }
        else if (value > ref.optimalHigh) { severity = "warning"; direction = "above"; }

        if (severity) {
          await ctx.db.insert("substancePulseAlerts", {
            sessionId: args.sessionId,
            cycleId: cycle._id,
            alertType: "biomarker_drift",
            severity,
            title: `${ref.label} Drift Detected`,
            message: `${ref.label} is ${value} ${ref.unit} — ${direction} optimal range (${ref.optimalLow}-${ref.optimalHigh}). This may affect your ${cycle.substanceName} protocol efficacy. Consider adjusting dosage or consulting your provider.`,
            icon: ref.icon,
            accentColor: severity === "critical" ? "#FF6B6B" : "#E8976C",
            substanceName: cycle.substanceName,
            biomarker: markerKey,
            biomarkerValue: value,
            biomarkerReference: `${ref.optimalLow}-${ref.optimalHigh} ${ref.unit}`,
            actionLabel: "Sync Dosage",
            actionType: "sync_dosage",
            status: "active",
            createdAt: now,
            expiresAt: now + 72 * 60 * 60 * 1000,
          });
          alertsGenerated++;
        }
      }
    }

    // Check for missed doses (no log in expected window)
    for (const cycle of activeCycles) {
      if (!cycle.isOnPhase) continue;
      const expectedIntervalMs = cycle.frequency === "daily" ? 24 * 60 * 60 * 1000
        : cycle.frequency === "eod" ? 48 * 60 * 60 * 1000
        : cycle.frequency === "3x_week" ? 56 * 60 * 60 * 1000
        : cycle.frequency === "2x_week" ? 84 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;

      const missedThreshold = expectedIntervalMs * 1.5;
      if (cycle.lastDoseAt && (now - cycle.lastDoseAt) > missedThreshold) {
        const alreadyAlerted = existingAlerts.some(
          (a) => a.alertType === "missed_dose" && a.substanceName === cycle.substanceName
        );
        if (!alreadyAlerted) {
          const hoursSince = Math.round((now - cycle.lastDoseAt) / (60 * 60 * 1000));
          await ctx.db.insert("substancePulseAlerts", {
            sessionId: args.sessionId,
            cycleId: cycle._id,
            alertType: "missed_dose",
            severity: "warning",
            title: `Missed ${cycle.substanceName} Dose`,
            message: `No dose logged in ${hoursSince}h (expected every ${Math.round(expectedIntervalMs / (60 * 60 * 1000))}h). Tap to log now and maintain cycle integrity.`,
            icon: "⏰",
            accentColor: "#E8976C",
            substanceName: cycle.substanceName,
            actionLabel: "Log Dose",
            actionType: "log_dose",
            status: "active",
            createdAt: now,
            expiresAt: now + 24 * 60 * 60 * 1000,
          });
          alertsGenerated++;
        }
      }
    }

    return { alertsGenerated };
  },
});

// ── Dismiss an alert ──
export const dismissAlert = mutation({
  args: { alertId: v.id("substancePulseAlerts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, { status: "dismissed", dismissedAt: Date.now() });
  },
});

// ── Act on an alert (Sync Dosage / Log Dose) ──
export const actOnAlert = mutation({
  args: { alertId: v.id("substancePulseAlerts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, { status: "acted", actedAt: Date.now() });
  },
});

// ── Sync Dosage — one-tap auto-log based on cycle defaults ──
export const syncDosage = mutation({
  args: { sessionId: v.string(), cycleId: v.id("substanceCycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.sessionId !== args.sessionId) throw new Error("Cycle not found");
    const now = Date.now();

    // Get suggested injection site
    const logs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_substance", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("substanceName", cycle.substanceName)
      )
      .collect();
    const recentSites = logs
      .sort((a, b) => b.loggedAt - a.loggedAt)
      .slice(0, 8)
      .map((l) => l.injectionSite)
      .filter(Boolean) as string[];
    const suggestedSite = cycle.route === "subcutaneous" || cycle.route === "intramuscular"
      ? getNextInjectionSite(recentSites)
      : undefined;

    // Auto-log the dose
    const logId = await ctx.db.insert("substanceLogs", {
      sessionId: args.sessionId,
      substanceName: cycle.substanceName,
      category: cycle.category,
      dosageMg: cycle.dosageMg,
      dosageUnit: cycle.dosageUnit,
      route: cycle.route,
      injectionSite: suggestedSite,
      cycleId: args.cycleId,
      notes: "Auto-synced via Proactive Pulse",
      loggedAt: now,
    });

    // Update cycle
    await ctx.db.patch(args.cycleId, {
      lastDoseAt: now,
      totalDosesLogged: cycle.totalDosesLogged + 1,
    });

    // Journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "substance_sync_dosage",
      eventKey: cycle.substanceName,
      value: `Synced ${cycle.dosageMg}${cycle.dosageUnit} ${cycle.substanceName}${suggestedSite ? ` @ ${suggestedSite.replace(/_/g, " ")}` : ""}`,
      numericValue: cycle.dosageMg,
      loggedAt: now,
    });

    return { logId, substanceName: cycle.substanceName, dosageMg: cycle.dosageMg, injectionSite: suggestedSite };
  },
});

// ── Delete a cycle ──
export const deleteCycle = mutation({
  args: { sessionId: v.string(), cycleId: v.id("substanceCycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.sessionId !== args.sessionId) throw new Error("Cycle not found");
    await ctx.db.delete(args.cycleId);
    return { deleted: true };
  },
});
