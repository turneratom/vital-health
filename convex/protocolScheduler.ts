import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL SCHEDULER — AI-Driven Checklist Generator
   
   When the AI suggests a peptide like BPC-157 or a specific
   nutrition window, this module automatically generates a
   frictionless checklist in the HUD. The user shouldn't have
   to think about "What do I do today?" — the OS tells them.
   
   Flow:
   1. AI Context Engine detects biomarker gaps / protocol suggestions
   2. This scheduler ingests those signals + existing protocols
   3. Generates a time-ordered, priority-ranked daily checklist
   4. Items auto-complete when logged via Quick Log or Protocol Stack
   ═══════════════════════════════════════════════════════════════ */

/* ── Peptide/Substance Knowledge Base ── */
const SUBSTANCE_PROTOCOLS: Record<string, {
  name: string;
  icon: string;
  category: string;
  defaultDosage: string;
  timeOfDay: string;
  frequency: string;
  description: string;
  biomarkerTargets: string[];
  recoveryImpact: string;
}> = {
  "bpc-157": {
    name: "BPC-157",
    icon: "🧬",
    category: "peptide",
    defaultDosage: "250mcg subQ",
    timeOfDay: "morning",
    frequency: "daily",
    description: "Gastric pentadecapeptide — accelerates tendon/ligament repair, gut healing, and angiogenesis",
    biomarkerTargets: ["crp", "ferritin"],
    recoveryImpact: "Reduces systemic inflammation markers within 72h. Upregulates GH receptor density.",
  },
  "tb-500": {
    name: "TB-500",
    icon: "🔬",
    category: "peptide",
    defaultDosage: "2mg subQ 2x/week",
    timeOfDay: "evening",
    frequency: "2x-weekly",
    description: "Thymosin Beta-4 — systemic tissue repair, cardiac protection, hair follicle stem cell migration",
    biomarkerTargets: ["crp"],
    recoveryImpact: "Promotes actin regulation for cellular repair. Peak tissue response at 4-6 weeks.",
  },
  "cjc-1295": {
    name: "CJC-1295 + Ipamorelin",
    icon: "⚗️",
    category: "peptide",
    defaultDosage: "200mcg/200mcg subQ",
    timeOfDay: "evening",
    frequency: "5-on-2-off",
    description: "GH secretagogue stack — pulsatile GH release mimicking natural circadian pattern",
    biomarkerTargets: ["igf1", "testosteroneTotal"],
    recoveryImpact: "Elevates IGF-1 by 30-60% over 8 weeks. Best administered 30min pre-sleep on empty stomach.",
  },
  "tirzepatide": {
    name: "Tirzepatide",
    icon: "💉",
    category: "glp1",
    defaultDosage: "2.5mg subQ weekly",
    timeOfDay: "morning",
    frequency: "weekly",
    description: "Dual GIP/GLP-1 receptor agonist — metabolic optimization, insulin sensitization, appetite regulation",
    biomarkerTargets: ["hba1c", "fastingGlucose"],
    recoveryImpact: "HbA1c reduction of 0.5-1.5% over 12 weeks. Fasting glucose normalization within 4 weeks.",
  },
  "semaglutide": {
    name: "Semaglutide",
    icon: "💊",
    category: "glp1",
    defaultDosage: "0.25mg subQ weekly",
    timeOfDay: "morning",
    frequency: "weekly",
    description: "GLP-1 receptor agonist — glucose homeostasis, cardiovascular protection, weight management",
    biomarkerTargets: ["hba1c", "fastingGlucose", "crp"],
    recoveryImpact: "Cardiovascular risk reduction of 20%. Sustained appetite regulation via hypothalamic signaling.",
  },
  "nad-plus": {
    name: "NAD+ IV/SubQ",
    icon: "⚡",
    category: "longevity",
    defaultDosage: "250mg IV or 100mg subQ",
    timeOfDay: "morning",
    frequency: "2x-weekly",
    description: "Nicotinamide adenine dinucleotide — mitochondrial biogenesis, sirtuin activation, DNA repair",
    biomarkerTargets: ["crp", "hba1c"],
    recoveryImpact: "Cellular NAD+ levels increase 40-60% within 2h of administration. Sirtuin pathway activation peaks at 4-6h.",
  },
  "glutathione": {
    name: "Glutathione IV/Liposomal",
    icon: "🛡️",
    category: "antioxidant",
    defaultDosage: "500mg liposomal or 1200mg IV",
    timeOfDay: "morning",
    frequency: "daily",
    description: "Master antioxidant — phase II detoxification, heavy metal chelation, immune modulation",
    biomarkerTargets: ["crp", "ferritin"],
    recoveryImpact: "Reduces oxidative stress markers within 24h. Supports hepatic detox pathways.",
  },
  "metformin": {
    name: "Metformin",
    icon: "📊",
    category: "longevity",
    defaultDosage: "500mg with dinner",
    timeOfDay: "evening",
    frequency: "daily",
    description: "AMPK activator — glucose disposal, mTOR inhibition, longevity pathway activation",
    biomarkerTargets: ["hba1c", "fastingGlucose", "igf1"],
    recoveryImpact: "AMPK activation within 2h. Avoid within 4h of exercise to prevent blunting of mTOR-mediated adaptation.",
  },
};

/* ── Nutrition Window Templates ── */
const NUTRITION_WINDOWS: Record<string, {
  name: string;
  icon: string;
  timeOfDay: string;
  description: string;
  macroTarget: string;
}> = {
  "pre-workout": {
    name: "Pre-Workout Fuel",
    icon: "⚡",
    timeOfDay: "morning",
    description: "30g carbs + 10g EAA — 45min before training",
    macroTarget: "30C / 10P / 5F",
  },
  "post-workout": {
    name: "Post-Workout Recovery",
    icon: "🥩",
    timeOfDay: "morning",
    description: "40g protein + 50g carbs within 60min of training",
    macroTarget: "50C / 40P / 10F",
  },
  "fasting-window": {
    name: "Fasting Window",
    icon: "⏰",
    timeOfDay: "morning",
    description: "16:8 protocol — water, black coffee, electrolytes only",
    macroTarget: "0C / 0P / 0F",
  },
  "protein-bolus": {
    name: "Protein Bolus",
    icon: "🎯",
    timeOfDay: "afternoon",
    description: "40g+ leucine-rich protein to maximize MPS",
    macroTarget: "5C / 40P / 10F",
  },
  "evening-fuel": {
    name: "Evening Recovery Meal",
    icon: "🌙",
    timeOfDay: "evening",
    description: "Complex carbs + protein — glycogen replenishment + sleep support",
    macroTarget: "60C / 30P / 15F",
  },
};

/* ── Helper: get today's date key ── */
function getDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/* ── Helper: get current hour ── */
function getCurrentHour(): number {
  return new Date().getHours();
}

/* ── Helper: map timeOfDay to hour range ── */
function getTimeWindow(timeOfDay: string): { start: number; end: number; label: string } {
  switch (timeOfDay) {
    case "morning": return { start: 5, end: 11, label: "5:00 — 11:59 AM" };
    case "afternoon": return { start: 12, end: 17, label: "12:00 — 5:59 PM" };
    case "evening": return { start: 18, end: 22, label: "6:00 — 10:00 PM" };
    case "all-day": return { start: 5, end: 22, label: "All Day" };
    default: return { start: 5, end: 22, label: "All Day" };
  }
}

/* ═══════════════════════════════════════════════════════════════
   generateTodaySchedule — The Core Scheduler
   
   Pulls all active protocols, substance cycles, AI suggestions,
   and nutrition windows. Merges them into a single time-ordered
   checklist with completion status. This is what the HUD renders.
   ═══════════════════════════════════════════════════════════════ */

export const generateTodaySchedule = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const dateKey = getDateKey();
    const currentHour = getCurrentHour();

    /* ── 1. Get active protocols ── */
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);

    /* ── 2. Get today's completions ── */
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    /* ── 3. Get active substance cycles ── */
    const cycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    /* ── 4. Get today's substance logs ── */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const substanceLogs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const todaySubstanceLogs = substanceLogs.filter(
      (l) => l.loggedAt >= todayStart.getTime()
    );
    const loggedSubstances = new Set(
      todaySubstanceLogs.map((l) => l.substanceName.toLowerCase())
    );

    /* ── 5. Get BioVault for context-aware scheduling ── */
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    /* ── Build unified schedule items ── */
    type ScheduleItem = {
      id: string;
      name: string;
      icon: string;
      category: string;
      description: string;
      timeOfDay: string;
      timeWindow: { start: number; end: number; label: string };
      priority: "critical" | "high" | "medium" | "low";
      completed: boolean;
      source: "protocol" | "substance" | "nutrition" | "ai-suggestion";
      protocolId?: string;
      substanceName?: string;
      dosage?: string;
      biomarkerContext?: string;
      isOverdue: boolean;
      isUpcoming: boolean;
      isCurrent: boolean;
    };

    const items: ScheduleItem[] = [];

    // ── Protocol items ──
    for (const p of activeProtocols) {
      const tw = getTimeWindow(p.timeOfDay);
      const isOverdue = currentHour > tw.end && !completedIds.has(p._id);
      const isCurrent = currentHour >= tw.start && currentHour <= tw.end;
      const isUpcoming = currentHour < tw.start;

      items.push({
        id: `protocol-${p._id}`,
        name: p.name,
        icon: p.icon,
        category: p.category,
        description: p.description,
        timeOfDay: p.timeOfDay,
        timeWindow: tw,
        priority: isOverdue ? "high" : p.category === "supplement" ? "medium" : "medium",
        completed: completedIds.has(p._id),
        source: "protocol",
        protocolId: p._id as string,
        isOverdue,
        isUpcoming,
        isCurrent,
      });
    }

    // ── Substance cycle items (peptides, HRT, etc.) ──
    for (const cycle of cycles) {
      if (!cycle.isOnPhase) continue; // Skip off-phase days

      const substanceKey = cycle.substanceName.toLowerCase().replace(/\s+/g, "-");
      const knownProtocol = SUBSTANCE_PROTOCOLS[substanceKey];
      const tw = getTimeWindow(knownProtocol?.timeOfDay ?? "morning");
      const isLogged = loggedSubstances.has(cycle.substanceName.toLowerCase());
      const isOverdue = currentHour > tw.end && !isLogged;
      const isCurrent = currentHour >= tw.start && currentHour <= tw.end;
      const isUpcoming = currentHour < tw.start;

      // Determine priority based on biomarker context
      let priority: "critical" | "high" | "medium" | "low" = "high";
      let biomarkerContext: string | undefined;

      if (knownProtocol && bioVault) {
        for (const target of knownProtocol.biomarkerTargets) {
          const val = (bioVault as any)[target];
          if (val != null) {
            const range = BIO_RANGES[target];
            if (range && ((range.critLow != null && val < range.critLow) || (range.critHigh != null && val > range.critHigh))) {
              priority = "critical";
              biomarkerContext = `${range.label} at ${val}${range.unit} — this protocol directly targets this marker`;
              break;
            } else if (range && (val < range.min || val > range.max)) {
              biomarkerContext = `${range.label} at ${val}${range.unit} — suboptimal, this protocol helps`;
            }
          }
        }
      }

      items.push({
        id: `substance-${cycle._id}`,
        name: cycle.substanceName,
        icon: cycle.icon || knownProtocol?.icon || "💉",
        category: cycle.category || "peptide",
        description: `${cycle.dosageMg}${cycle.dosageUnit} ${cycle.route}${knownProtocol ? ` — ${knownProtocol.description}` : ""}`,
        timeOfDay: knownProtocol?.timeOfDay ?? "morning",
        timeWindow: tw,
        priority,
        completed: isLogged,
        source: "substance",
        substanceName: cycle.substanceName,
        dosage: `${cycle.dosageMg}${cycle.dosageUnit}`,
        biomarkerContext,
        isOverdue,
        isUpcoming,
        isCurrent,
      });
    }

    // ── Sort: overdue first, then current window, then upcoming. Within each: by priority ──
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const timeOrder = (item: ScheduleItem) => {
      if (item.isOverdue && !item.completed) return 0;
      if (item.isCurrent && !item.completed) return 1;
      if (item.isUpcoming) return 2;
      if (item.completed) return 3;
      return 4;
    };

    items.sort((a, b) => {
      const ta = timeOrder(a);
      const tb = timeOrder(b);
      if (ta !== tb) return ta - tb;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // ── Compute stats ──
    const total = items.length;
    const done = items.filter((i) => i.completed).length;
    const overdue = items.filter((i) => i.isOverdue && !i.completed).length;
    const critical = items.filter((i) => i.priority === "critical" && !i.completed).length;

    // ── Group by time window ──
    const windows = {
      morning: {
        label: "Morning Activation",
        icon: "☀️",
        timeRange: "5:00 — 11:59",
        items: items.filter((i) => i.timeOfDay === "morning"),
      },
      afternoon: {
        label: "Performance Window",
        icon: "⚡",
        timeRange: "12:00 — 17:59",
        items: items.filter((i) => i.timeOfDay === "afternoon"),
      },
      evening: {
        label: "Recovery Protocol",
        icon: "🌙",
        timeRange: "18:00 — 22:00",
        items: items.filter((i) => i.timeOfDay === "evening"),
      },
      allDay: {
        label: "Continuous",
        icon: "🔄",
        timeRange: "All Day",
        items: items.filter((i) => i.timeOfDay === "all-day"),
      },
    };

    // ── Determine active window ──
    let activeWindow = "morning";
    if (currentHour >= 18) activeWindow = "evening";
    else if (currentHour >= 12) activeWindow = "afternoon";

    // ── Generate AI status sentence ──
    let statusSentence = "";
    if (total === 0) {
      statusSentence = "No protocols scheduled. Add supplements, peptides, or training to build your daily stack.";
    } else if (done === total) {
      statusSentence = "All protocols complete. Your biological systems are fully serviced today.";
    } else if (overdue > 0) {
      const overdueItems = items.filter((i) => i.isOverdue && !i.completed);
      const names = overdueItems.slice(0, 2).map((i) => i.name).join(" and ");
      statusSentence = `${overdue} protocol${overdue > 1 ? "s" : ""} overdue — ${names}${overdue > 2 ? ` +${overdue - 2} more` : ""}. Tactical pivot available.`;
    } else if (critical > 0) {
      const critItems = items.filter((i) => i.priority === "critical" && !i.completed);
      statusSentence = `Priority: ${critItems[0].name} — ${critItems[0].biomarkerContext || "biomarker-linked protocol requires attention"}.`;
    } else {
      const remaining = total - done;
      const nextItem = items.find((i) => !i.completed);
      statusSentence = `${remaining} protocol${remaining > 1 ? "s" : ""} remaining. Next: ${nextItem?.name ?? "—"}.`;
    }

    return {
      items,
      windows,
      activeWindow,
      total,
      done,
      overdue,
      critical,
      percentage: total > 0 ? Math.round((done / total) * 100) : 0,
      dateKey,
      currentHour,
      statusSentence,
    };
  },
});

/* ── Biomarker ranges for substance priority calculation ── */
const BIO_RANGES: Record<string, { min: number; max: number; unit: string; label: string; critLow?: number; critHigh?: number }> = {
  crp: { min: 0, max: 1.0, unit: "mg/L", label: "hs-CRP", critHigh: 3.0 },
  hba1c: { min: 4.0, max: 5.4, unit: "%", label: "HbA1c", critHigh: 5.7 },
  vitaminD: { min: 40, max: 80, unit: "ng/mL", label: "Vitamin D", critLow: 20 },
  testosteroneTotal: { min: 400, max: 900, unit: "ng/dL", label: "Total T", critLow: 250 },
  ferritin: { min: 40, max: 200, unit: "ng/mL", label: "Ferritin", critLow: 20, critHigh: 300 },
  fastingGlucose: { min: 70, max: 95, unit: "mg/dL", label: "Fasting Glucose", critHigh: 110 },
  igf1: { min: 100, max: 300, unit: "ng/mL", label: "IGF-1" },
};

/* ═══════════════════════════════════════════════════════════════
   addAISuggestedProtocol — When AI recommends a peptide/supplement,
   this mutation creates it as a real protocol in the user's stack.
   ═══════════════════════════════════════════════════════════════ */

export const addAISuggestedProtocol = mutation({
  args: {
    sessionId: v.string(),
    substanceKey: v.string(),
    customName: v.optional(v.string()),
    customDosage: v.optional(v.string()),
    customTimeOfDay: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const known = SUBSTANCE_PROTOCOLS[args.substanceKey];
    const name = args.customName ?? known?.name ?? args.substanceKey;
    const timeOfDay = args.customTimeOfDay ?? known?.timeOfDay ?? "morning";

    // Check for duplicates
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const duplicate = existing.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      // Reactivate if inactive
      if (!duplicate.isActive) {
        await ctx.db.patch(duplicate._id, { isActive: true });
        return { action: "reactivated", protocolId: duplicate._id, name };
      }
      return { action: "already_exists", protocolId: duplicate._id, name };
    }

    const protocolId = await ctx.db.insert("protocols", {
      sessionId: args.sessionId,
      name,
      category: known?.category ?? "supplement",
      icon: known?.icon ?? "💊",
      description: args.customDosage
        ? `${args.customDosage} — ${known?.description ?? "AI-recommended protocol"}`
        : known?.description ?? "AI-recommended protocol",
      timeOfDay,
      isActive: true,
      sortOrder: existing.length,
      source: "ai-scheduler",
      frictionLevel: 1,
      frequency: known?.frequency ?? "daily",
      createdAt: Date.now(),
    });

    // Log the AI suggestion event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "ai_protocol_added",
      eventKey: name,
      value: `AI Scheduler added ${name} to daily stack${known ? ` — targets ${known.biomarkerTargets.join(", ")}` : ""}`,
      numericValue: undefined,
      loggedAt: Date.now(),
    });

    return { action: "created", protocolId, name };
  },
});

/* ═══════════════════════════════════════════════════════════════
   getNextAction — Returns the single most important thing
   the user should do RIGHT NOW. Used by the HUD headline.
   ═══════════════════════════════════════════════════════════════ */

export const getNextAction = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const dateKey = getDateKey();
    const currentHour = getCurrentHour();

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const active = protocols.filter((p) => p.isActive);

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .collect();
    const completedIds = new Set(
      completions.filter((c) => c.completed).map((c) => c.protocolItemId)
    );

    // Find the next incomplete protocol in the current time window
    const windowMap: Record<string, number[]> = {
      morning: [5, 11],
      afternoon: [12, 17],
      evening: [18, 22],
    };

    // First: overdue items
    for (const p of active) {
      if (completedIds.has(p._id)) continue;
      const [, end] = windowMap[p.timeOfDay] ?? [5, 22];
      if (currentHour > end) {
        return {
          action: p.name,
          icon: p.icon,
          description: p.description,
          category: p.category,
          urgency: "overdue" as const,
          protocolId: p._id,
          message: `${p.name} is overdue — complete now or pivot`,
        };
      }
    }

    // Second: current window items
    for (const p of active) {
      if (completedIds.has(p._id)) continue;
      const [start, end] = windowMap[p.timeOfDay] ?? [5, 22];
      if (currentHour >= start && currentHour <= end) {
        return {
          action: p.name,
          icon: p.icon,
          description: p.description,
          category: p.category,
          urgency: "now" as const,
          protocolId: p._id,
          message: `${p.name} — ${p.description}`,
        };
      }
    }

    // Third: upcoming items
    for (const p of active) {
      if (completedIds.has(p._id)) continue;
      const [start] = windowMap[p.timeOfDay] ?? [5, 22];
      if (currentHour < start) {
        return {
          action: p.name,
          icon: p.icon,
          description: p.description,
          category: p.category,
          urgency: "upcoming" as const,
          protocolId: p._id,
          message: `Next: ${p.name} at ${start > 12 ? start - 12 : start}${start >= 12 ? "pm" : "am"}`,
        };
      }
    }

    // All done
    const total = active.length;
    const done = completedIds.size;
    return {
      action: "All Clear",
      icon: "✅",
      description: "Every protocol completed for today",
      category: "complete",
      urgency: "complete" as const,
      protocolId: null,
      message: `${done}/${total} protocols complete — biological systems fully serviced`,
    };
  },
});
