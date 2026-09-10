import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL LIBRARY ENGINE
   
   Famous longevity stacks as installable "Apps for your body."
   When a user installs a stack, the AI Brain maps every habit
   and supplement into the Daily Plan + Inventory tracker.
   ═══════════════════════════════════════════════════════════════ */

// ── Stack item definition ──
interface StackItem {
  name: string;
  category: string;
  icon: string;
  description: string;
  timeOfDay: string;
  inventoryItem?: {
    unit: string;
    dailyUsageUnits: number;
    dosagePerUnit: string;
    defaultQuantity: number;
    category: string;
  };
}

interface FamousStack {
  id: string;
  name: string;
  creator: string;
  creatorTitle: string;
  subtitle: string;
  icon: string;
  color: string;
  tier: "SIGNATURE" | "ELITE" | "RESEARCH";
  category: string;
  duration: string;
  scienceScore: number;
  adherenceDifficulty: number;
  monthlyEstCost: number;
  keyBenefit: string;
  items: StackItem[];
}

// ── The Famous Stacks Database ──
const FAMOUS_STACKS: FamousStack[] = [
  {
    id: "bryan-johnson-blueprint",
    name: "The Bryan Johnson Blueprint",
    creator: "Bryan Johnson",
    creatorTitle: "Founder of Blueprint / Kernel",
    subtitle: "The world's most measured human. 100+ daily interventions to reverse biological aging.",
    icon: "🧬",
    color: "#6366F1",
    tier: "SIGNATURE",
    category: "longevity",
    duration: "Daily",
    scienceScore: 94,
    adherenceDifficulty: 9,
    monthlyEstCost: 350,
    keyBenefit: "Biological age reversal — measured 5.1 years younger",
    items: [
      { name: "Morning Sunlight 10min", category: "biohacking", icon: "☀️", description: "First light exposure within 30 min of waking — cortisol + dopamine", timeOfDay: "morning" },
      { name: "Olive Oil 30mL", category: "nutrition", icon: "🫒", description: "Extra virgin — polyphenols + oleic acid for cardiovascular health", timeOfDay: "morning", inventoryItem: { unit: "mL", dailyUsageUnits: 30, dosagePerUnit: "30mL", defaultQuantity: 500, category: "nutrition" } },
      { name: "Blueprint Longevity Mix", category: "supplement", icon: "💊", description: "Cocoa flavanols, lycopene, astaxanthin — antioxidant stack", timeOfDay: "morning", inventoryItem: { unit: "servings", dailyUsageUnits: 1, dosagePerUnit: "1 scoop", defaultQuantity: 30, category: "supplement" } },
      { name: "Creatine 2.5g", category: "supplement", icon: "⚡", description: "Cognitive + muscular ATP buffer — neuroprotective", timeOfDay: "morning", inventoryItem: { unit: "g", dailyUsageUnits: 2.5, dosagePerUnit: "2.5g", defaultQuantity: 250, category: "supplement" } },
      { name: "Collagen Peptides 15g", category: "supplement", icon: "🦴", description: "Type I/III — skin elasticity + joint support", timeOfDay: "morning", inventoryItem: { unit: "g", dailyUsageUnits: 15, dosagePerUnit: "15g", defaultQuantity: 300, category: "supplement" } },
      { name: "Resistance Training 45min", category: "training", icon: "🏋️", description: "Compound lifts — progressive overload 3x/week", timeOfDay: "morning" },
      { name: "Zone 2 Cardio 30min", category: "training", icon: "🏃", description: "130-150 BPM — mitochondrial biogenesis", timeOfDay: "afternoon" },
      { name: "Last Meal by 11 AM", category: "nutrition", icon: "⏰", description: "Caloric restriction window — autophagy activation", timeOfDay: "morning" },
      { name: "Sleep by 8:30 PM", category: "recovery", icon: "😴", description: "8.5 hours sleep opportunity — non-negotiable", timeOfDay: "evening" },
      { name: "Vitamin D3 2000IU", category: "supplement", icon: "☀️", description: "Immune + bone + mood — with K2 for calcium routing", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 1, dosagePerUnit: "2000 IU", defaultQuantity: 90, category: "supplement" } },
    ],
  },
  {
    id: "huberman-morning-routine",
    name: "Huberman Morning Routine",
    creator: "Dr. Andrew Huberman",
    creatorTitle: "Stanford Neuroscience Professor",
    subtitle: "Neuroscience-backed morning protocol for focus, energy, and circadian optimization.",
    icon: "🧠",
    color: "#E8976C",
    tier: "SIGNATURE",
    category: "cognitive",
    duration: "Daily AM",
    scienceScore: 97,
    adherenceDifficulty: 5,
    monthlyEstCost: 80,
    keyBenefit: "Optimized dopamine + cortisol timing for peak focus",
    items: [
      { name: "Morning Sunlight 10min", category: "biohacking", icon: "☀️", description: "Outdoor light within 30 min of waking — sets circadian clock via melanopsin", timeOfDay: "morning" },
      { name: "Delay Caffeine 90min", category: "nutrition", icon: "☕", description: "Wait 90-120 min after waking — clear adenosine naturally first", timeOfDay: "morning" },
      { name: "Cold Shower 1-3min", category: "biohacking", icon: "🧊", description: "End of shower cold — 2.5x dopamine increase lasting 3+ hours", timeOfDay: "morning" },
      { name: "AG1 Greens", category: "supplement", icon: "🥬", description: "Foundational nutrition — vitamins, minerals, probiotics", timeOfDay: "morning", inventoryItem: { unit: "servings", dailyUsageUnits: 1, dosagePerUnit: "1 scoop", defaultQuantity: 30, category: "supplement" } },
      { name: "Omega-3 EPA/DHA 2g", category: "supplement", icon: "🐟", description: "Anti-inflammatory + brain membrane fluidity", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "1g per cap", defaultQuantity: 60, category: "supplement" } },
      { name: "Tongkat Ali 400mg", category: "supplement", icon: "🌿", description: "Free testosterone support — reduces SHBG binding", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 1, dosagePerUnit: "400mg", defaultQuantity: 60, category: "supplement" } },
      { name: "NSDR / Yoga Nidra 10min", category: "recovery", icon: "🧘", description: "Non-Sleep Deep Rest — dopamine replenishment + mental reset", timeOfDay: "afternoon" },
      { name: "Magnesium Threonate", category: "supplement", icon: "🌙", description: "300mg before bed — crosses BBB for sleep + neuroplasticity", timeOfDay: "evening", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "150mg", defaultQuantity: 60, category: "supplement" } },
    ],
  },
  {
    id: "attia-centenarian-decathlon",
    name: "Attia Centenarian Decathlon",
    creator: "Dr. Peter Attia",
    creatorTitle: "Longevity Medicine Physician",
    subtitle: "Train for the last decade of your life. Functional capacity preservation protocol.",
    icon: "🏅",
    color: "#7CB68E",
    tier: "SIGNATURE",
    category: "longevity",
    duration: "4x/week",
    scienceScore: 92,
    adherenceDifficulty: 7,
    monthlyEstCost: 120,
    keyBenefit: "Maintain functional independence through your 90s",
    items: [
      { name: "Zone 2 Cardio 45min", category: "training", icon: "🫀", description: "3-4x/week — mitochondrial density + fat oxidation at MAF HR", timeOfDay: "morning" },
      { name: "Zone 5 VO2max Intervals", category: "training", icon: "🔥", description: "1x/week — 4x4 min at 90-95% max HR, 4 min recovery", timeOfDay: "morning" },
      { name: "Stability Training", category: "training", icon: "🎯", description: "DNS-based — diaphragmatic breathing + rotational stability", timeOfDay: "morning" },
      { name: "Grip Strength Work", category: "training", icon: "✊", description: "Dead hangs + farmer carries — strongest mortality predictor", timeOfDay: "afternoon" },
      { name: "Hip Hinge Mobility", category: "training", icon: "🦵", description: "Romanian deadlifts + hip CARs — fall prevention", timeOfDay: "morning" },
      { name: "Protein 1g/lb", category: "nutrition", icon: "🥩", description: "1g per pound bodyweight — muscle protein synthesis", timeOfDay: "all-day" },
      { name: "EPA/DHA 2g", category: "supplement", icon: "🐟", description: "Omega-3 for inflammation + cardiovascular health", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "1g", defaultQuantity: 60, category: "supplement" } },
      { name: "Vitamin D3 5000IU", category: "supplement", icon: "☀️", description: "Steroid hormone precursor — target 60-80 ng/mL", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 1, dosagePerUnit: "5000 IU", defaultQuantity: 90, category: "supplement" } },
      { name: "CGM Monitoring", category: "biohacking", icon: "📊", description: "Continuous glucose monitor — metabolic awareness", timeOfDay: "all-day" },
    ],
  },
  {
    id: "sinclair-longevity",
    name: "Sinclair Longevity Protocol",
    creator: "Dr. David Sinclair",
    creatorTitle: "Harvard Genetics Professor",
    subtitle: "NAD+ restoration + sirtuin activation for epigenetic age reversal.",
    icon: "🔬",
    color: "#B8A9C9",
    tier: "RESEARCH",
    category: "longevity",
    duration: "Daily",
    scienceScore: 85,
    adherenceDifficulty: 4,
    monthlyEstCost: 200,
    keyBenefit: "NAD+ restoration — sirtuin pathway activation",
    items: [
      { name: "NMN 1000mg", category: "supplement", icon: "🧬", description: "NAD+ precursor — sirtuin activation for DNA repair", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "500mg", defaultQuantity: 60, category: "supplement" } },
      { name: "Resveratrol 1000mg", category: "supplement", icon: "🍇", description: "SIRT1 activator — take with yogurt (fat-soluble)", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "500mg", defaultQuantity: 60, category: "supplement" } },
      { name: "Vitamin D3 + K2", category: "supplement", icon: "☀️", description: "Immune modulation + calcium metabolism", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 1, dosagePerUnit: "5000 IU D3 + 200mcg K2", defaultQuantity: 90, category: "supplement" } },
      { name: "Metformin 500mg", category: "supplement", icon: "💊", description: "AMPK activator — glucose regulation (Rx required)", timeOfDay: "evening", inventoryItem: { unit: "tablets", dailyUsageUnits: 1, dosagePerUnit: "500mg", defaultQuantity: 30, category: "pharmaceutical" } },
      { name: "Skip Breakfast", category: "nutrition", icon: "⏰", description: "Time-restricted eating — 16:8 window for autophagy", timeOfDay: "morning" },
      { name: "Cold Exposure", category: "biohacking", icon: "❄️", description: "Brown fat activation — metabolic rate increase", timeOfDay: "morning" },
      { name: "Minimize Sugar", category: "nutrition", icon: "🚫", description: "Glycation accelerates aging — keep glucose stable", timeOfDay: "all-day" },
    ],
  },
  {
    id: "rhonda-patrick-foundation",
    name: "Rhonda Patrick Foundation",
    creator: "Dr. Rhonda Patrick",
    creatorTitle: "Biomedical Scientist / FoundMyFitness",
    subtitle: "Micronutrient optimization + heat/cold stress for longevity gene expression.",
    icon: "🧪",
    color: "#D4847A",
    tier: "ELITE",
    category: "nutrition",
    duration: "Daily",
    scienceScore: 96,
    adherenceDifficulty: 6,
    monthlyEstCost: 150,
    keyBenefit: "Micronutrient sufficiency + heat shock protein activation",
    items: [
      { name: "Sulforaphane (Broccoli Sprouts)", category: "nutrition", icon: "🥦", description: "Nrf2 pathway activation — phase 2 detox enzymes", timeOfDay: "morning" },
      { name: "Omega-3 Index >8%", category: "supplement", icon: "🐟", description: "4g EPA/DHA — target Omega-3 Index above 8%", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 4, dosagePerUnit: "1g", defaultQuantity: 120, category: "supplement" } },
      { name: "Vitamin D3 4000IU", category: "supplement", icon: "☀️", description: "Target 40-60 ng/mL — gene expression modulator", timeOfDay: "morning", inventoryItem: { unit: "capsules", dailyUsageUnits: 1, dosagePerUnit: "4000 IU", defaultQuantity: 90, category: "supplement" } },
      { name: "Magnesium 400mg", category: "supplement", icon: "🌙", description: "300+ enzymatic reactions — most people deficient", timeOfDay: "evening", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "200mg", defaultQuantity: 60, category: "supplement" } },
      { name: "Sauna 20min at 170°F", category: "biohacking", icon: "🔥", description: "4-7x/week — 40% reduced all-cause mortality (Finnish study)", timeOfDay: "evening" },
      { name: "Time-Restricted Eating", category: "nutrition", icon: "⏰", description: "10-hour eating window — circadian alignment", timeOfDay: "all-day" },
    ],
  },
  {
    id: "walker-sleep-protocol",
    name: "Walker Sleep Masterclass",
    creator: "Dr. Matthew Walker",
    creatorTitle: "UC Berkeley Sleep Scientist",
    subtitle: "The single most effective thing you can do for health. Non-negotiable sleep architecture.",
    icon: "🌙",
    color: "#6B8AFF",
    tier: "ELITE",
    category: "recovery",
    duration: "Nightly",
    scienceScore: 99,
    adherenceDifficulty: 5,
    monthlyEstCost: 40,
    keyBenefit: "Optimized sleep architecture — deep + REM maximization",
    items: [
      { name: "Consistent Wake Time", category: "recovery", icon: "⏰", description: "Same time every day including weekends — anchors circadian rhythm", timeOfDay: "morning" },
      { name: "Room Temp 65-67°F", category: "recovery", icon: "❄️", description: "Core body temp must drop 2-3°F for sleep onset", timeOfDay: "evening" },
      { name: "No Caffeine After 2 PM", category: "nutrition", icon: "☕", description: "Caffeine half-life 5-7h — blocks adenosine receptors", timeOfDay: "afternoon" },
      { name: "Dim Lights 2h Before Bed", category: "recovery", icon: "🔅", description: "Melatonin onset requires darkness — use amber lighting", timeOfDay: "evening" },
      { name: "No Screens 1h Before", category: "recovery", icon: "📵", description: "Blue light suppresses melatonin by 50% for 90 min", timeOfDay: "evening" },
      { name: "Magnesium Glycinate", category: "supplement", icon: "🌙", description: "400mg — GABA receptor agonist for sleep onset", timeOfDay: "evening", inventoryItem: { unit: "capsules", dailyUsageUnits: 2, dosagePerUnit: "200mg", defaultQuantity: 60, category: "supplement" } },
      { name: "No Alcohol", category: "nutrition", icon: "🚫", description: "Alcohol fragments sleep + suppresses REM by 20-40%", timeOfDay: "evening" },
    ],
  },
];

// ── Get all available stacks ──
export const getAvailableStacks = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Get user's existing protocols to check what's already installed
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    const existingSources = new Set(existing.map((p) => p.source));

    return FAMOUS_STACKS.map((stack) => {
      const installedCount = stack.items.filter((item) =>
        existingNames.has(item.name.toLowerCase())
      ).length;
      const isFullyInstalled = existingSources.has(`library:${stack.id}`);
      const isPartiallyInstalled = installedCount > 0 && !isFullyInstalled;

      return {
        ...stack,
        items: stack.items.map((item) => ({
          ...item,
          alreadyInstalled: existingNames.has(item.name.toLowerCase()),
        })),
        installedCount,
        totalItems: stack.items.length,
        isFullyInstalled,
        isPartiallyInstalled,
        installPercent: Math.round((installedCount / stack.items.length) * 100),
      };
    });
  },
});

// ── Install a stack — maps protocols + inventory ──
export const installStack = mutation({
  args: {
    sessionId: v.string(),
    stackId: v.string(),
  },
  handler: async (ctx, args) => {
    const stack = FAMOUS_STACKS.find((s) => s.id === args.stackId);
    if (!stack) throw new Error("Stack not found");

    // Get existing protocols to avoid duplicates
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    const maxSortOrder = existing.length > 0
      ? Math.max(...existing.map((p) => p.sortOrder)) + 1
      : 0;

    let protocolsAdded = 0;
    let inventoryAdded = 0;
    const now = Date.now();

    for (let i = 0; i < stack.items.length; i++) {
      const item = stack.items[i];

      // Skip if protocol already exists
      if (existingNames.has(item.name.toLowerCase())) continue;

      // Add to protocols (Daily Plan)
      await ctx.db.insert("protocols", {
        sessionId: args.sessionId,
        name: item.name,
        category: item.category,
        icon: item.icon,
        description: item.description,
        timeOfDay: item.timeOfDay,
        isActive: true,
        sortOrder: maxSortOrder + i,
        source: `library:${stack.id}`,
        createdAt: now,
      });
      protocolsAdded++;

      // Add to inventory if it's a supplement/consumable
      if (item.inventoryItem) {
        const inv = item.inventoryItem;
        // Check if inventory item already exists
        const existingInv = await ctx.db
          .query("inventory")
          .withIndex("by_sessionId_and_name", (q: any) =>
            q.eq("sessionId", args.sessionId).eq("name", item.name)
          )
          .first();

        if (!existingInv) {
          await ctx.db.insert("inventory", {
            sessionId: args.sessionId,
            name: item.name,
            category: inv.category,
            icon: item.icon,
            totalQuantity: inv.defaultQuantity,
            currentQuantity: inv.defaultQuantity,
            unit: inv.unit,
            dailyUsageUnits: inv.dailyUsageUnits,
            dosagePerUnit: inv.dosagePerUnit,
            brand: undefined,
            linkedProtocolId: undefined,
            linkedSupplementId: undefined,
            expiresAt: undefined,
            reorderUrl: undefined,
            notes: `Auto-added from ${stack.name}`,
            scanData: undefined,
            status: "active",
            lastDecrementedAt: now,
            addedAt: now,
            updatedAt: now,
          });
          inventoryAdded++;
        }
      }
    }

    // ── Reset drift baselines — new protocol invalidates old baselines ──
    // Resolve active drift events
    const activeDriftEvents = await ctx.db
      .query("driftEvents")
      .withIndex("by_sessionId_and_status", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "active")
      )
      .collect();
    let resolvedDrifts = 0;
    for (const event of activeDriftEvents) {
      await ctx.db.patch(event._id, {
        status: "resolved_by_protocol",
        resolvedAt: now,
        recalibrationSummary: `Baselines reset — "${stack.name}" installed`,
      });
      resolvedDrifts++;
    }

    // Expire active interventions
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
    }

    // Log baseline reset to drift history
    if (resolvedDrifts > 0 || activeInterventions.length > 0) {
      await ctx.db.insert("driftHistory", {
        sessionId: args.sessionId,
        metric: "all_baselines",
        currentValue: 0,
        baselineValue: 0,
        deviationPct: 0,
        severity: "info",
        triggerRule: `protocol_install:${stack.id}`,
        interventionGenerated: false,
        detectedAt: now,
      });
    }

    // Log journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "stack_installed",
      eventKey: stack.id,
      value: `Installed "${stack.name}" by ${stack.creator} — ${protocolsAdded} protocols + ${inventoryAdded} inventory items. ${resolvedDrifts} drift baselines reset.`,
      numericValue: protocolsAdded,
      loggedAt: now,
    });

    return {
      stackId: stack.id,
      stackName: stack.name,
      creator: stack.creator,
      protocolsAdded,
      inventoryAdded,
      resolvedDrifts,
      interventionsCleared: activeInterventions.length,
      totalItems: stack.items.length,
    };
  },
});

// ── Uninstall a stack ──
export const uninstallStack = mutation({
  args: {
    sessionId: v.string(),
    stackId: v.string(),
  },
  handler: async (ctx, args) => {
    const source = `library:${args.stackId}`;
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const toRemove = protocols.filter((p) => p.source === source);
    for (const p of toRemove) {
      await ctx.db.delete(p._id);
    }

    return { removed: toRemove.length, stackId: args.stackId };
  },
});
