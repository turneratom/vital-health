import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIOVAULT → DAILY PROTOCOL BRIDGE
   
   When lab results show deficiencies, auto-inject supplement tasks
   into the Daily Protocol. Closes the loop: Knowing → Doing.
   ═══════════════════════════════════════════════════════════════ */

const DEFICIENCY_PROTOCOLS: Record<string, {
  name: string;
  icon: string;
  category: string;
  description: string;
  timeOfDay: string;
  threshold: { low: number; unit: string };
}> = {
  vitaminD: {
    name: "Vitamin D3 5000IU + K2",
    icon: "☀️",
    category: "supplement",
    description: "Take with fat-containing meal. Corrects deficiency detected in labs.",
    timeOfDay: "morning",
    threshold: { low: 50, unit: "ng/mL" },
  },
  magnesium: {
    name: "Magnesium Glycinate 400mg",
    icon: "🧲",
    category: "supplement",
    description: "Take before bed. Supports sleep, HRV, and muscle recovery.",
    timeOfDay: "evening",
    threshold: { low: 2.0, unit: "mg/dL" },
  },
  ferritin: {
    name: "Iron Bisglycinate 25mg + Vit C",
    icon: "🩸",
    category: "supplement",
    description: "Take on empty stomach with 500mg Vitamin C for absorption.",
    timeOfDay: "morning",
    threshold: { low: 40, unit: "ng/mL" },
  },
  omega3: {
    name: "EPA-Dominant Omega-3 2g",
    icon: "🐟",
    category: "supplement",
    description: "Anti-inflammatory support. Take with meals.",
    timeOfDay: "morning",
    threshold: { low: 5.0, unit: "%" },
  },
  zinc: {
    name: "Zinc Picolinate 30mg",
    icon: "⚡",
    category: "supplement",
    description: "Immune + testosterone support. Take with food.",
    timeOfDay: "morning",
    threshold: { low: 70, unit: "mcg/dL" },
  },
  b12: {
    name: "Methylcobalamin B12 1000mcg",
    icon: "🧬",
    category: "supplement",
    description: "Sublingual. Supports methylation and energy.",
    timeOfDay: "morning",
    threshold: { low: 500, unit: "pg/mL" },
  },
};

/** Check BioVault for deficiencies and return protocols to inject */
export const getDeficiencyProtocols = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    if (!vault) return { deficiencies: [], injectedCount: 0 };

    const deficiencies: Array<{
      marker: string;
      value: number;
      threshold: number;
      unit: string;
      protocol: typeof DEFICIENCY_PROTOCOLS[string];
    }> = [];

    // Check each marker against thresholds
    const markerMap: Record<string, number | undefined> = {
      vitaminD: vault.vitaminD,
      ferritin: vault.ferritin,
    };

    for (const [key, config] of Object.entries(DEFICIENCY_PROTOCOLS)) {
      const value = markerMap[key];
      if (value !== undefined && value < config.threshold.low) {
        deficiencies.push({
          marker: key,
          value,
          threshold: config.threshold.low,
          unit: config.threshold.unit,
          protocol: config,
        });
      }
    }

    return { deficiencies, injectedCount: deficiencies.length };
  },
});

/** Auto-inject deficiency-based protocols into the user's protocol list */
export const injectDeficiencyProtocols = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    if (!vault) return { injected: 0, protocols: [] };

    // Get existing protocols to avoid duplicates
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    const injected: string[] = [];

    const markerMap: Record<string, number | undefined> = {
      vitaminD: vault.vitaminD,
      ferritin: vault.ferritin,
    };

    for (const [key, config] of Object.entries(DEFICIENCY_PROTOCOLS)) {
      const value = markerMap[key];
      if (value !== undefined && value < config.threshold.low) {
        // Check if protocol already exists
        if (!existingNames.has(config.name.toLowerCase())) {
          await ctx.db.insert("protocols", {
            sessionId: args.sessionId,
            name: config.name,
            category: config.category,
            icon: config.icon,
            description: `${config.description} (Lab value: ${value} ${config.threshold.unit}, optimal: >${config.threshold.low})`,
            timeOfDay: config.timeOfDay,
            isActive: true,
            sortOrder: existing.length + injected.length,
            source: "biovault-auto",
            createdAt: Date.now(),
          });
          injected.push(config.name);
        }
      }
    }

    return { injected: injected.length, protocols: injected };
  },
});
