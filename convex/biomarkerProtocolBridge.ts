import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIOMARKER → PROTOCOL BRIDGE
   
   Reactive feedback loop: when lab results land in BioVault,
   this engine reads the flagged markers and auto-injects
   targeted protocols into the user's Daily Protocol checklist.
   
   CRP High → Cold Plunge 3min + Curcumin 500mg + BPC-157 + Omega-3
   Testosterone Low → Heavy Compound Lift + Zinc/Mag + Ashwagandha
   HbA1c High → Post-meal walk 15min + Berberine 500mg + Cinnamon
   Vitamin D Low → D3 5000IU + K2 MK-7 + 20min morning sun
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker Optimal Ranges ── */
const RANGES: Record<string, { min: number; max: number; unit: string; label: string; critLow?: number; critHigh?: number }> = {
  crp: { min: 0, max: 1.0, unit: "mg/L", label: "CRP (Inflammation)", critHigh: 3.0 },
  hba1c: { min: 4.0, max: 5.4, unit: "%", label: "HbA1c (Glycation)", critHigh: 5.7 },
  vitaminD: { min: 40, max: 80, unit: "ng/mL", label: "Vitamin D", critLow: 20 },
  testosteroneTotal: { min: 400, max: 900, unit: "ng/dL", label: "Testosterone", critLow: 250 },
  ferritin: { min: 40, max: 200, unit: "ng/mL", label: "Ferritin", critLow: 20, critHigh: 300 },
  fastingGlucose: { min: 70, max: 95, unit: "mg/dL", label: "Fasting Glucose", critHigh: 110 },
};

/* ── Biomarker → Protocol Injection Rules ── */
interface InjectionRule {
  biomarker: string;
  condition: "high" | "low";
  protocols: Array<{
    name: string;
    icon: string;
    category: string;
    description: string;
    timeOfDay: string;
    sortOrder: number;
  }>;
  statusMessage: string;
}

const INJECTION_RULES: InjectionRule[] = [
  {
    biomarker: "crp",
    condition: "high",
    statusMessage: "Inflammation elevated — deploying anti-inflammatory protocol stack",
    protocols: [
      {
        name: "Cold Plunge 3min",
        icon: "🧊",
        category: "biohacking",
        description: "Cold exposure to suppress NF-κB inflammatory cascade and boost norepinephrine",
        timeOfDay: "morning",
        sortOrder: 15,
      },
      {
        name: "Curcumin 500mg + Piperine",
        icon: "🟡",
        category: "supplement",
        description: "Bioavailable curcumin for COX-2 inhibition and TNF-α suppression",
        timeOfDay: "morning",
        sortOrder: 16,
      },
      {
        name: "BPC-157 250mcg subQ",
        icon: "🧬",
        category: "supplement",
        description: "Peptide protocol for gut lining repair and systemic inflammation reduction",
        timeOfDay: "morning",
        sortOrder: 17,
      },
      {
        name: "Omega-3 EPA 2g",
        icon: "🐟",
        category: "supplement",
        description: "EPA-dominant fish oil to attenuate inflammatory cytokine production",
        timeOfDay: "performance",
        sortOrder: 30,
      },
    ],
  },
  {
    biomarker: "testosteroneTotal",
    condition: "low",
    statusMessage: "Testosterone sub-optimal — activating anabolic support protocol",
    protocols: [
      {
        name: "Heavy Compound Lift",
        icon: "🏋️",
        category: "training",
        description: "Squat/Deadlift/Bench — compound movements to maximize acute T response",
        timeOfDay: "performance",
        sortOrder: 25,
      },
      {
        name: "Zinc 30mg + Magnesium 400mg",
        icon: "⚡",
        category: "supplement",
        description: "ZMA stack for testosterone synthesis support and sleep quality",
        timeOfDay: "recovery",
        sortOrder: 45,
      },
      {
        name: "Ashwagandha KSM-66 600mg",
        icon: "🌿",
        category: "supplement",
        description: "Adaptogen for cortisol modulation and free testosterone elevation",
        timeOfDay: "morning",
        sortOrder: 18,
      },
      {
        name: "8h Sleep Protocol",
        icon: "🌙",
        category: "recovery",
        description: "Prioritize deep sleep — primary window for GnRH pulsatile T secretion",
        timeOfDay: "recovery",
        sortOrder: 50,
      },
    ],
  },
  {
    biomarker: "hba1c",
    condition: "high",
    statusMessage: "Glycation markers elevated — deploying glucose disposal protocol",
    protocols: [
      {
        name: "Post-Meal Walk 15min",
        icon: "🚶",
        category: "movement",
        description: "Immediate post-prandial walking to blunt glucose spike via GLUT4 translocation",
        timeOfDay: "performance",
        sortOrder: 32,
      },
      {
        name: "Berberine 500mg w/ meals",
        icon: "📊",
        category: "supplement",
        description: "AMPK activator for enhanced glucose disposal and insulin sensitivity",
        timeOfDay: "performance",
        sortOrder: 33,
      },
      {
        name: "Ceylon Cinnamon 1g",
        icon: "🟤",
        category: "supplement",
        description: "Insulin-mimetic for improved glucose uptake at cellular level",
        timeOfDay: "morning",
        sortOrder: 19,
      },
      {
        name: "Carb Window: 12pm-6pm only",
        icon: "⏰",
        category: "nutrition",
        description: "Restrict carbohydrate intake to peak insulin sensitivity window",
        timeOfDay: "performance",
        sortOrder: 28,
      },
    ],
  },
  {
    biomarker: "vitaminD",
    condition: "low",
    statusMessage: "Vitamin D deficient — initiating solar + supplementation protocol",
    protocols: [
      {
        name: "Vitamin D3 5000IU + K2 MK-7",
        icon: "☀️",
        category: "supplement",
        description: "High-dose D3 with K2 for calcium routing and immunomodulation",
        timeOfDay: "morning",
        sortOrder: 12,
      },
      {
        name: "20min Morning Sun Exposure",
        icon: "🌅",
        category: "biohacking",
        description: "Direct sunlight on skin for endogenous D3 synthesis and circadian entrainment",
        timeOfDay: "morning",
        sortOrder: 10,
      },
      {
        name: "Magnesium Glycinate 400mg",
        icon: "💊",
        category: "supplement",
        description: "Magnesium is required cofactor for Vitamin D activation (25-OH → 1,25-OH)",
        timeOfDay: "recovery",
        sortOrder: 46,
      },
    ],
  },
  {
    biomarker: "ferritin",
    condition: "low",
    statusMessage: "Iron stores depleted — activating hematologic support protocol",
    protocols: [
      {
        name: "Iron Bisglycinate 25mg AM",
        icon: "🩸",
        category: "supplement",
        description: "Chelated iron on empty stomach for maximum absorption without GI distress",
        timeOfDay: "morning",
        sortOrder: 11,
      },
      {
        name: "Vitamin C 500mg w/ Iron",
        icon: "🍊",
        category: "supplement",
        description: "Ascorbic acid enhances non-heme iron absorption by 3-6x",
        timeOfDay: "morning",
        sortOrder: 12,
      },
    ],
  },
  {
    biomarker: "fastingGlucose",
    condition: "high",
    statusMessage: "Fasting glucose elevated — deploying metabolic optimization stack",
    protocols: [
      {
        name: "16:8 Intermittent Fast",
        icon: "⏳",
        category: "nutrition",
        description: "Time-restricted eating to improve insulin sensitivity and hepatic glucose output",
        timeOfDay: "morning",
        sortOrder: 5,
      },
      {
        name: "Apple Cider Vinegar 2tbsp",
        icon: "🍎",
        category: "nutrition",
        description: "Pre-meal ACV to reduce post-prandial glucose by 20-30%",
        timeOfDay: "performance",
        sortOrder: 27,
      },
    ],
  },
];

/* ── Evaluate which rules fire based on BioVault ── */
function evaluateRules(bioVault: Record<string, any>): {
  firedRules: InjectionRule[];
  flaggedMarkers: Array<{ key: string; value: number; label: string; unit: string; status: string }>;
} {
  const firedRules: InjectionRule[] = [];
  const flaggedMarkers: Array<{ key: string; value: number; label: string; unit: string; status: string }> = [];

  for (const rule of INJECTION_RULES) {
    const value = bioVault[rule.biomarker];
    if (value == null) continue;

    const range = RANGES[rule.biomarker];
    if (!range) continue;

    let isFlagged = false;
    let status = "optimal";

    if (rule.condition === "high" && value > range.max) {
      isFlagged = true;
      status = range.critHigh != null && value >= range.critHigh ? "critical" : "elevated";
    } else if (rule.condition === "low" && value < range.min) {
      isFlagged = true;
      status = range.critLow != null && value <= range.critLow ? "critical" : "low";
    }

    if (isFlagged) {
      firedRules.push(rule);
      flaggedMarkers.push({
        key: rule.biomarker,
        value,
        label: range.label,
        unit: range.unit,
        status,
      });
    }
  }

  return { firedRules, flaggedMarkers };
}

/* ═══════════════════════════════════════════════════════════════
   getBiomarkerInjections — Query for the ProtocolSidebar
   
   Returns the list of biomarker-driven protocol items that
   should be injected into today's checklist, plus flagged
   marker context for the System Status sentence.
   ═══════════════════════════════════════════════════════════════ */

export const getBiomarkerInjections = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!bioVault) {
      return { injections: [], flaggedMarkers: [], statusMessages: [], totalInjected: 0 };
    }

    const { firedRules, flaggedMarkers } = evaluateRules(bioVault as any);

    // Collect all protocol injections
    const injections: Array<{
      id: string;
      name: string;
      icon: string;
      category: string;
      description: string;
      timeOfDay: string;
      sortOrder: number;
      biomarkerSource: string;
      biomarkerValue: number;
      biomarkerUnit: string;
      biomarkerStatus: string;
    }> = [];

    for (const rule of firedRules) {
      const marker = flaggedMarkers.find((m) => m.key === rule.biomarker);
      for (const proto of rule.protocols) {
        injections.push({
          id: `bio-${rule.biomarker}-${proto.name.replace(/\s+/g, "-").toLowerCase()}`,
          name: proto.name,
          icon: proto.icon,
          category: proto.category,
          description: proto.description,
          timeOfDay: proto.timeOfDay,
          sortOrder: proto.sortOrder,
          biomarkerSource: rule.biomarker,
          biomarkerValue: marker?.value ?? 0,
          biomarkerUnit: marker?.unit ?? "",
          biomarkerStatus: marker?.status ?? "flagged",
        });
      }
    }

    const statusMessages = firedRules.map((r) => r.statusMessage);

    return {
      injections,
      flaggedMarkers,
      statusMessages,
      totalInjected: injections.length,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   syncBiomarkerProtocols — Mutation to persist biomarker-driven
   protocols into the protocols table so they appear in the
   Daily Protocol sidebar with proper completion tracking.
   ═══════════════════════════════════════════════════════════════ */

export const syncBiomarkerProtocols = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!bioVault) return { synced: 0, removed: 0 };

    const { firedRules } = evaluateRules(bioVault as any);
    const now = Date.now();

    // Get existing bio-injected protocols
    const existingProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const bioProtocols = existingProtocols.filter((p) => p.source === "biomarker-bridge");
    const bioProtocolNames = new Set(bioProtocols.map((p) => p.name));

    // Determine which protocols should exist
    const targetProtocols = new Map<string, (typeof INJECTION_RULES)[0]["protocols"][0] & { biomarker: string }>();
    for (const rule of firedRules) {
      for (const proto of rule.protocols) {
        targetProtocols.set(proto.name, { ...proto, biomarker: rule.biomarker });
      }
    }

    let synced = 0;
    let removed = 0;

    // Add new protocols that don't exist yet
    for (const [name, proto] of targetProtocols) {
      if (!bioProtocolNames.has(name)) {
        await ctx.db.insert("protocols", {
          sessionId: args.sessionId,
          name: proto.name,
          category: proto.category,
          icon: proto.icon,
          description: proto.description,
          timeOfDay: proto.timeOfDay,
          isActive: true,
          sortOrder: proto.sortOrder,
          source: "biomarker-bridge",
          frictionLevel: 1,
          frequency: "daily",
          createdAt: now,
        });
        synced++;
      }
    }

    // Deactivate protocols whose biomarker is now in range
    for (const existing of bioProtocols) {
      if (!targetProtocols.has(existing.name)) {
        await ctx.db.patch(existing._id, { isActive: false });
        removed++;
      }
    }

    return { synced, removed };
  },
});
