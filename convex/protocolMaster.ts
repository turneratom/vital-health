import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL MASTER — Peptide & PEO Dosage Intelligence Engine
   
   Manages specialized logging for peptides (BPC-157, CJC-1295,
   TB-500, Ipamorelin, etc.) and Parent Essential Oils (PEOs).
   
   Features:
   • Standard dosage library with per-compound defaults
   • 1-tap confirmation logging from CommandBar
   • Protective Buffer metric calculation
   • Real-time event dispatch to TrajectoryCanvas
   ═══════════════════════════════════════════════════════════════ */

/* ── Peptide & PEO Dosage Library ── */
export interface CompoundProfile {
  id: string;
  name: string;
  aliases: string[];
  category: "peptide" | "peo" | "growth_factor";
  icon: string;
  defaultDoseMcg: number;
  defaultDoseUnit: string;
  route: string;
  frequency: string;
  halfLifeHours: number;
  protectiveBufferWeight: number; // 0-1 contribution to Protective Buffer
  mechanism: string;
  monitoredBiomarkers: string[];
  color: string;
}

const COMPOUND_LIBRARY: CompoundProfile[] = [
  {
    id: "bpc-157",
    name: "BPC-157",
    aliases: ["bpc", "bpc157", "bpc 157", "body protection compound"],
    category: "peptide",
    icon: "🧬",
    defaultDoseMcg: 250,
    defaultDoseUnit: "mcg",
    route: "subcutaneous",
    frequency: "2x daily",
    halfLifeHours: 4,
    protectiveBufferWeight: 0.25,
    mechanism: "Upregulates growth hormone receptors, accelerates tendon/ligament repair via nitric oxide pathway. Promotes angiogenesis and reduces inflammation through TNF-α suppression.",
    monitoredBiomarkers: ["CRP", "IGF-1", "Liver enzymes"],
    color: "#4ADE80",
  },
  {
    id: "cjc-1295",
    name: "CJC-1295",
    aliases: ["cjc", "cjc1295", "cjc 1295", "mod grf"],
    category: "peptide",
    icon: "⚡",
    defaultDoseMcg: 100,
    defaultDoseUnit: "mcg",
    route: "subcutaneous",
    frequency: "daily (evening)",
    halfLifeHours: 8,
    protectiveBufferWeight: 0.20,
    mechanism: "GHRH analog — stimulates pulsatile GH release from anterior pituitary. Extends GH half-life without desensitizing receptors. Synergistic with Ipamorelin.",
    monitoredBiomarkers: ["IGF-1", "Fasting glucose", "HbA1c"],
    color: "#67E8F9",
  },
  {
    id: "tb-500",
    name: "TB-500",
    aliases: ["tb500", "tb 500", "thymosin beta", "thymosin beta 4"],
    category: "peptide",
    icon: "🔬",
    defaultDoseMcg: 2500,
    defaultDoseUnit: "mcg",
    route: "subcutaneous",
    frequency: "2x weekly",
    halfLifeHours: 72,
    protectiveBufferWeight: 0.20,
    mechanism: "Thymosin beta-4 derivative — promotes cell migration, blood vessel formation, and tissue repair. Reduces inflammation via IL-6 and TNF-α modulation.",
    monitoredBiomarkers: ["CRP", "Ferritin", "WBC"],
    color: "#A78BFA",
  },
  {
    id: "ipamorelin",
    name: "Ipamorelin",
    aliases: ["ipa", "ipam", "ipamorelin acetate"],
    category: "peptide",
    icon: "💫",
    defaultDoseMcg: 200,
    defaultDoseUnit: "mcg",
    route: "subcutaneous",
    frequency: "daily (evening)",
    halfLifeHours: 2,
    protectiveBufferWeight: 0.15,
    mechanism: "Selective GH secretagogue — mimics ghrelin at pituitary without cortisol or prolactin elevation. Clean GH pulse for recovery and body composition.",
    monitoredBiomarkers: ["IGF-1", "Fasting glucose", "Cortisol"],
    color: "#FBBF24",
  },
  {
    id: "ghk-cu",
    name: "GHK-Cu",
    aliases: ["ghk", "ghk copper", "copper peptide"],
    category: "peptide",
    icon: "🟤",
    defaultDoseMcg: 200,
    defaultDoseUnit: "mcg",
    route: "subcutaneous",
    frequency: "daily",
    halfLifeHours: 12,
    protectiveBufferWeight: 0.10,
    mechanism: "Copper tripeptide — activates wound healing genes, stimulates collagen/elastin synthesis, and remodels damaged tissue. Anti-inflammatory and antioxidant.",
    monitoredBiomarkers: ["Copper", "Ceruloplasmin", "CRP"],
    color: "#D97706",
  },
  {
    id: "peo-blend",
    name: "PEO Blend (LA/ALA)",
    aliases: ["peo", "peos", "parent essential oils", "parent essential oil", "la ala", "linoleic", "alpha linolenic"],
    category: "peo",
    icon: "🫒",
    defaultDoseMcg: 4000000, // 4g = 4,000,000 mcg
    defaultDoseUnit: "mg",
    route: "oral",
    frequency: "daily with meal",
    halfLifeHours: 24,
    protectiveBufferWeight: 0.15,
    mechanism: "Parent Essential Oils (LA + ALA) — unadulterated linoleic and alpha-linolenic acids. Maintain cell membrane fluidity, oxygen transport, and mitochondrial function. Superior to fish oil derivatives per Peskin protocol.",
    monitoredBiomarkers: ["Omega-6:3 ratio", "hs-CRP", "Lipid panel"],
    color: "#84CC16",
  },
  {
    id: "ss-31",
    name: "SS-31 (Elamipretide)",
    aliases: ["ss31", "ss 31", "elamipretide", "mtp-131"],
    category: "peptide",
    icon: "⚛️",
    defaultDoseMcg: 500,
    defaultDoseUnit: "mcg",
    route: "subcutaneous",
    frequency: "daily",
    halfLifeHours: 6,
    protectiveBufferWeight: 0.15,
    mechanism: "Mitochondria-targeted peptide — binds cardiolipin in inner mitochondrial membrane, restoring electron transport chain efficiency and reducing ROS production.",
    monitoredBiomarkers: ["Lactate", "CoQ10", "Fasting glucose"],
    color: "#EC4899",
  },
];

/* ── Resolve compound from user input ── */
function resolveCompound(input: string): CompoundProfile | null {
  const lower = input.toLowerCase().replace(/[-_\s]+/g, " ").trim();
  for (const compound of COMPOUND_LIBRARY) {
    if (lower === compound.id.replace(/-/g, " ")) return compound;
    if (lower === compound.name.toLowerCase()) return compound;
    for (const alias of compound.aliases) {
      if (lower === alias || lower.includes(alias)) return compound;
    }
  }
  return null;
}

/* ── Parse peptide/PEO log command ── */
export interface ParsedDoseCommand {
  compound: CompoundProfile;
  dosage: number;
  unit: string;
  isCustomDose: boolean;
}

function parseDoseCommand(input: string): ParsedDoseCommand | null {
  const lower = input.toLowerCase().trim();

  // Pattern 1: "Log 250mcg BPC-157" or "Log 250 mcg BPC"
  const doseFirstMatch = lower.match(
    /^(?:log|took|pin|pinned|inject|injected|dose|dosed|administered)\s+(\d+(?:\.\d+)?)\s*(mcg|mg|iu|ml|g)\s+(.+)/i
  );
  if (doseFirstMatch) {
    const compound = resolveCompound(doseFirstMatch[3]);
    if (compound) {
      return {
        compound,
        dosage: parseFloat(doseFirstMatch[1]),
        unit: doseFirstMatch[2],
        isCustomDose: true,
      };
    }
  }

  // Pattern 2: "Log BPC-157 250mcg"
  const nameFirstMatch = lower.match(
    /^(?:log|took|pin|pinned|inject|injected|dose|dosed|administered)\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(mcg|mg|iu|ml|g)/i
  );
  if (nameFirstMatch) {
    const compound = resolveCompound(nameFirstMatch[1]);
    if (compound) {
      return {
        compound,
        dosage: parseFloat(nameFirstMatch[2]),
        unit: nameFirstMatch[3],
        isCustomDose: true,
      };
    }
  }

  // Pattern 3: "Log BPC" or "Log CJC" (use default dosage)
  const nameOnlyMatch = lower.match(
    /^(?:log|took|pin|pinned|inject|injected|dose|dosed|administered)\s+(.+)/i
  );
  if (nameOnlyMatch) {
    const compound = resolveCompound(nameOnlyMatch[1]);
    if (compound) {
      const defaultDose = compound.defaultDoseUnit === "mg"
        ? compound.defaultDoseMcg / 1000
        : compound.defaultDoseMcg;
      return {
        compound,
        dosage: defaultDose,
        unit: compound.defaultDoseUnit,
        isCustomDose: false,
      };
    }
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   QUERIES
   ═══════════════════════════════════════════════════════════════ */

/** Get the compound library for UI display */
export const getCompoundLibrary = query({
  args: {},
  handler: async () => {
    return COMPOUND_LIBRARY.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      icon: c.icon,
      defaultDoseMcg: c.defaultDoseMcg,
      defaultDoseUnit: c.defaultDoseUnit,
      route: c.route,
      frequency: c.frequency,
      mechanism: c.mechanism,
      color: c.color,
      protectiveBufferWeight: c.protectiveBufferWeight,
    }));
  },
});

/** Parse a command string and return the resolved compound + dosage (for 1-tap confirmation) */
export const parseCommand = query({
  args: { input: v.string() },
  handler: async (_ctx, args) => {
    const parsed = parseDoseCommand(args.input);
    if (!parsed) return null;
    return {
      compoundId: parsed.compound.id,
      compoundName: parsed.compound.name,
      compoundIcon: parsed.compound.icon,
      compoundColor: parsed.compound.color,
      category: parsed.compound.category,
      dosage: parsed.dosage,
      unit: parsed.unit,
      isCustomDose: parsed.isCustomDose,
      route: parsed.compound.route,
      frequency: parsed.compound.frequency,
      mechanism: parsed.compound.mechanism,
      protectiveBufferWeight: parsed.compound.protectiveBufferWeight,
      monitoredBiomarkers: parsed.compound.monitoredBiomarkers,
    };
  },
});

/** Get recent dose history for a session (last 7 days) */
export const getRecentDoses = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const logs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", sevenDaysAgo)
      )
      .collect();

    return logs.sort((a, b) => b.loggedAt - a.loggedAt).slice(0, 20);
  },
});

/** Calculate the Protective Buffer score based on recent peptide/PEO adherence */
export const getProtectiveBuffer = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Get all substance logs in the last 7 days
    const logs = await ctx.db
      .query("substanceLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", sevenDaysAgo)
      )
      .collect();

    // Get active substance cycles
    const cycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    // Calculate per-compound adherence
    const compoundScores: Array<{
      compoundId: string;
      name: string;
      icon: string;
      color: string;
      weight: number;
      adherence: number;
      lastDoseAt: number | null;
      isActive: boolean;
      hoursUntilNextDose: number | null;
    }> = [];

    for (const compound of COMPOUND_LIBRARY) {
      // Check if user has an active cycle for this compound
      const cycle = cycles.find(
        (c) => c.substanceName.toLowerCase().includes(compound.id.replace(/-/g, "")) ||
          compound.aliases.some((a) => c.substanceName.toLowerCase().includes(a.replace(/\s+/g, "")))
      );

      // Count doses in the last 7 days
      const compoundLogs = logs.filter(
        (l) => l.substanceName.toLowerCase().includes(compound.id.replace(/-/g, "")) ||
          compound.aliases.some((a) => l.substanceName.toLowerCase().includes(a.replace(/\s+/g, "")))
      );

      if (compoundLogs.length === 0 && !cycle) continue;

      const lastDose = compoundLogs.length > 0
        ? Math.max(...compoundLogs.map((l) => l.loggedAt))
        : null;

      // Calculate expected doses in 7 days based on frequency
      let expectedDoses = 7; // default: daily
      if (compound.frequency.includes("2x daily")) expectedDoses = 14;
      else if (compound.frequency.includes("2x weekly")) expectedDoses = 2;
      else if (compound.frequency.includes("3x weekly")) expectedDoses = 3;

      const adherence = Math.min(1, compoundLogs.length / expectedDoses);

      // Calculate hours until next dose
      let hoursUntilNextDose: number | null = null;
      if (lastDose) {
        const hoursSinceLastDose = (now - lastDose) / (1000 * 60 * 60);
        const doseIntervalHours = (7 * 24) / expectedDoses;
        hoursUntilNextDose = Math.max(0, doseIntervalHours - hoursSinceLastDose);
      }

      compoundScores.push({
        compoundId: compound.id,
        name: compound.name,
        icon: compound.icon,
        color: compound.color,
        weight: compound.protectiveBufferWeight,
        adherence,
        lastDoseAt: lastDose,
        isActive: !!cycle || compoundLogs.length > 0,
        hoursUntilNextDose,
      });
    }

    // Calculate overall Protective Buffer (0-100)
    if (compoundScores.length === 0) {
      return {
        score: 0,
        maxScore: 100,
        compounds: [],
        totalActiveCycles: cycles.length,
        lastDoseAt: null,
        trend: "neutral" as const,
      };
    }

    const totalWeight = compoundScores.reduce((s, c) => s + c.weight, 0);
    const weightedScore = compoundScores.reduce(
      (s, c) => s + c.adherence * (c.weight / totalWeight) * 100,
      0
    );

    const lastDoseAt = compoundScores
      .filter((c) => c.lastDoseAt)
      .sort((a, b) => (b.lastDoseAt || 0) - (a.lastDoseAt || 0))[0]?.lastDoseAt || null;

    // Trend: compare last 3 days vs previous 4 days
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter((l) => l.loggedAt >= threeDaysAgo).length;
    const olderLogs = logs.filter((l) => l.loggedAt < threeDaysAgo).length;
    const trend = recentLogs > olderLogs * (3 / 4) ? "improving" as const
      : recentLogs < olderLogs * (3 / 4) * 0.5 ? "declining" as const
        : "steady" as const;

    return {
      score: Math.round(weightedScore),
      maxScore: 100,
      compounds: compoundScores,
      totalActiveCycles: cycles.length,
      lastDoseAt,
      trend,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   MUTATIONS
   ═══════════════════════════════════════════════════════════════ */

/** Log a peptide/PEO dose — called from CommandBar 1-tap confirmation */
export const logDose = mutation({
  args: {
    sessionId: v.string(),
    compoundId: v.string(),
    compoundName: v.string(),
    category: v.string(),
    dosage: v.number(),
    unit: v.string(),
    route: v.string(),
    injectionSite: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dateKey = new Date().toISOString().slice(0, 10);

    // 1. Insert into substanceLogs
    const logId = await ctx.db.insert("substanceLogs", {
      sessionId: args.sessionId,
      substanceName: args.compoundName,
      category: args.category,
      dosageMg: args.unit === "mcg" ? args.dosage / 1000 : args.unit === "g" ? args.dosage * 1000 : args.dosage,
      dosageUnit: args.unit,
      route: args.route,
      injectionSite: args.injectionSite,
      notes: args.notes,
      loggedAt: now,
    });

    // 2. Update active substance cycle if exists
    const cycles = await ctx.db
      .query("substanceCycles")
      .withIndex("by_sessionId_and_status", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();

    const matchingCycle = cycles.find(
      (c) => c.substanceName.toLowerCase().replace(/[-_\s]+/g, "") ===
        args.compoundName.toLowerCase().replace(/[-_\s]+/g, "")
    );

    if (matchingCycle) {
      await ctx.db.patch(matchingCycle._id, {
        lastDoseAt: now,
        totalDosesLogged: matchingCycle.totalDosesLogged + 1,
      });
    }

    // 3. Log as protocol completion for today
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const matchingProtocol = protocols.find(
      (p) => p.isActive && (
        p.name.toLowerCase().includes(args.compoundId.replace(/-/g, "")) ||
        p.name.toLowerCase().includes(args.compoundName.toLowerCase())
      )
    );

    if (matchingProtocol) {
      const completions = await ctx.db
        .query("protocolCompletions")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
        )
        .collect();

      const existing = completions.find((c) => c.protocolItemId === matchingProtocol._id);
      if (!existing) {
        await ctx.db.insert("protocolCompletions", {
          sessionId: args.sessionId,
          dateKey,
          protocolItemId: matchingProtocol._id,
          completed: true,
          completedAt: now,
        });
      }
    }

    // 4. Log journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "peptide_dose",
      eventKey: args.compoundId,
      value: `${args.dosage}${args.unit} ${args.compoundName} (${args.route})`,
      numericValue: args.dosage,
      loggedAt: now,
    });

    // 5. Log protocol log for correlation engine
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: args.compoundId,
      protocolName: args.compoundName,
      category: args.category,
      loggedAt: now,
      status: "dose_logged",
    });

    return {
      logId,
      compoundId: args.compoundId,
      compoundName: args.compoundName,
      dosage: args.dosage,
      unit: args.unit,
      timestamp: now,
    };
  },
});
