import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   MICRO-PROTOCOL ENGINE
   
   Cross-references high-tension body regions with inventory
   supplements and aiBrain logic to generate targeted 2-minute
   interventions. When accepted, logs as "Active Intervention"
   that immediately impacts the BiologicalTwin glow.
   ═══════════════════════════════════════════════════════════════ */

/* ── Region → Micro-Protocol Mapping ── */
const REGION_PROTOCOLS: Record<string, Array<{
  type: "stretch" | "supplement" | "breathwork" | "cold" | "mobility" | "massage";
  name: string;
  duration: string;
  description: string;
  icon: string;
  supplementKeywords?: string[];
  glowImpact: number; // 0-1 how much this boosts twin glow
  integrityBoost: number; // 0-10 structural integrity points
}>> = {
  head: [
    { type: "breathwork", name: "Box Breathing Reset", duration: "2 min", description: "4-4-4-4 box breathing to reduce cortisol and restore prefrontal clarity. Activates parasympathetic nervous system.", icon: "🫁", glowImpact: 0.08, integrityBoost: 3 },
    { type: "supplement", name: "Magnesium Glycinate", duration: "Immediate", description: "400mg magnesium glycinate crosses BBB — reduces neural excitotoxicity and tension headache signaling.", icon: "💊", supplementKeywords: ["magnesium", "mag"], glowImpact: 0.12, integrityBoost: 5 },
    { type: "massage", name: "Temple Pressure Release", duration: "90 sec", description: "Circular pressure on temporal fascia release points. Reduces trigeminal nerve compression.", icon: "🤲", glowImpact: 0.06, integrityBoost: 2 },
  ],
  neck: [
    { type: "stretch", name: "Cervical Decompression", duration: "2 min", description: "Gentle chin tucks + lateral neck stretches to decompress C1-C7 vertebrae and release SCM tension.", icon: "🧘", glowImpact: 0.07, integrityBoost: 3 },
    { type: "supplement", name: "Omega-3 Anti-Inflammatory", duration: "Immediate", description: "2g EPA/DHA to reduce cervical inflammation via resolvin synthesis pathway.", icon: "💊", supplementKeywords: ["omega", "fish oil", "epa", "dha"], glowImpact: 0.10, integrityBoost: 4 },
    { type: "mobility", name: "Neck CARs", duration: "2 min", description: "Controlled Articular Rotations — full ROM neck circles to restore cervical joint health.", icon: "🔄", glowImpact: 0.06, integrityBoost: 3 },
  ],
  shoulders: [
    { type: "stretch", name: "Shoulder Dislocates", duration: "2 min", description: "Band-assisted shoulder dislocates to restore glenohumeral ROM and reduce impingement.", icon: "🧘", glowImpact: 0.07, integrityBoost: 3 },
    { type: "supplement", name: "Curcumin + Piperine", duration: "Immediate", description: "500mg curcumin with piperine for NF-κB inhibition — targets shoulder joint inflammation.", icon: "💊", supplementKeywords: ["turmeric", "curcumin"], glowImpact: 0.10, integrityBoost: 4 },
    { type: "cold", name: "Targeted Cold Pack", duration: "2 min", description: "Cold application to deltoid/trap junction. Vasoconstriction reduces acute inflammation.", icon: "🧊", glowImpact: 0.08, integrityBoost: 3 },
  ],
  chest: [
    { type: "breathwork", name: "Diaphragmatic Expansion", duration: "2 min", description: "Deep belly breathing with 6-second exhale to release intercostal tension and improve thoracic mobility.", icon: "🫁", glowImpact: 0.07, integrityBoost: 3 },
    { type: "stretch", name: "Doorway Pec Stretch", duration: "90 sec", description: "Bilateral pec stretch in doorframe — opens anterior chain and corrects forward shoulder posture.", icon: "🧘", glowImpact: 0.06, integrityBoost: 2 },
  ],
  arms: [
    { type: "mobility", name: "Wrist & Forearm CARs", duration: "2 min", description: "Controlled rotations through full wrist ROM + forearm pronation/supination.", icon: "🔄", glowImpact: 0.05, integrityBoost: 2 },
    { type: "stretch", name: "Nerve Flossing", duration: "2 min", description: "Median and ulnar nerve glides to reduce compression and restore neural conductivity.", icon: "🧘", glowImpact: 0.07, integrityBoost: 3 },
  ],
  gut: [
    { type: "supplement", name: "L-Glutamine Gut Repair", duration: "Immediate", description: "5g L-glutamine to reinforce intestinal tight junctions and reduce gut permeability.", icon: "💊", supplementKeywords: ["glutamine", "l-glutamine"], glowImpact: 0.12, integrityBoost: 5 },
    { type: "breathwork", name: "Vagal Tone Activation", duration: "2 min", description: "Extended exhale breathing (4-in, 8-out) to stimulate vagus nerve and improve gut motility.", icon: "🫁", glowImpact: 0.08, integrityBoost: 3 },
    { type: "supplement", name: "Digestive Enzymes", duration: "Immediate", description: "Broad-spectrum enzymes to reduce post-meal bloating and improve nutrient absorption.", icon: "💊", supplementKeywords: ["enzyme", "digestive"], glowImpact: 0.08, integrityBoost: 3 },
  ],
  abdomen: [
    { type: "stretch", name: "Abdominal Decompression", duration: "2 min", description: "Supine twist + cat-cow to release psoas tension and improve core blood flow.", icon: "🧘", glowImpact: 0.06, integrityBoost: 3 },
    { type: "massage", name: "ICV Massage", duration: "90 sec", description: "Ileocecal valve massage to improve gut transit and reduce abdominal distension.", icon: "🤲", glowImpact: 0.07, integrityBoost: 3 },
  ],
  hips: [
    { type: "stretch", name: "90/90 Hip Opener", duration: "2 min", description: "90/90 position with controlled rotation to restore hip internal/external rotation.", icon: "🧘", glowImpact: 0.07, integrityBoost: 3 },
    { type: "mobility", name: "Hip CARs", duration: "2 min", description: "Controlled Articular Rotations — full ROM hip circles in standing position.", icon: "🔄", glowImpact: 0.06, integrityBoost: 3 },
  ],
  upper_back: [
    { type: "stretch", name: "Thoracic Extension", duration: "2 min", description: "Foam roller thoracic extension to restore T-spine mobility and reduce kyphotic tension.", icon: "🧘", glowImpact: 0.07, integrityBoost: 3 },
    { type: "supplement", name: "Magnesium Spray", duration: "Immediate", description: "Topical magnesium chloride on upper traps — direct muscular relaxation via transdermal absorption.", icon: "💊", supplementKeywords: ["magnesium", "mag"], glowImpact: 0.09, integrityBoost: 4 },
  ],
  lower_back: [
    { type: "stretch", name: "McKenzie Extension", duration: "2 min", description: "Prone press-ups to centralize disc pressure and reduce lumbar nerve compression.", icon: "🧘", glowImpact: 0.08, integrityBoost: 4 },
    { type: "supplement", name: "Curcumin + Boswellia", duration: "Immediate", description: "Anti-inflammatory stack targeting lumbar facet joint inflammation via dual COX/LOX inhibition.", icon: "💊", supplementKeywords: ["turmeric", "curcumin", "boswellia"], glowImpact: 0.12, integrityBoost: 5 },
    { type: "cold", name: "Lumbar Ice Protocol", duration: "2 min", description: "Cold pack on L4-L5 region to reduce acute inflammatory cascade and pain signaling.", icon: "🧊", glowImpact: 0.07, integrityBoost: 3 },
  ],
  legs: [
    { type: "stretch", name: "Hamstring PNF Stretch", duration: "2 min", description: "Contract-relax PNF stretching for hamstrings — 6-second contract, 30-second stretch cycles.", icon: "🧘", glowImpact: 0.06, integrityBoost: 3 },
    { type: "mobility", name: "Ankle Dorsiflexion Drill", duration: "2 min", description: "Wall-assisted ankle dorsiflexion to improve squat depth and reduce compensatory knee stress.", icon: "🔄", glowImpact: 0.05, integrityBoost: 2 },
  ],
  knees: [
    { type: "mobility", name: "Knee CARs + VMO Activation", duration: "2 min", description: "Controlled knee rotations + terminal knee extension to strengthen VMO and stabilize patella.", icon: "🔄", glowImpact: 0.07, integrityBoost: 3 },
    { type: "supplement", name: "Collagen + Vitamin C", duration: "Immediate", description: "10g collagen peptides + 500mg vitamin C to support cartilage synthesis and joint integrity.", icon: "💊", supplementKeywords: ["collagen", "vitamin c"], glowImpact: 0.10, integrityBoost: 4 },
  ],
  feet: [
    { type: "massage", name: "Plantar Fascia Release", duration: "2 min", description: "Lacrosse ball roll under arch — releases plantar fascia adhesions and improves foot proprioception.", icon: "🤲", glowImpact: 0.06, integrityBoost: 2 },
    { type: "mobility", name: "Toe Yoga + Ankle CARs", duration: "2 min", description: "Individual toe activation + full ankle ROM circles to restore foot intrinsic muscle function.", icon: "🔄", glowImpact: 0.05, integrityBoost: 2 },
  ],
  skin: [
    { type: "supplement", name: "Zinc + Vitamin A", duration: "Immediate", description: "30mg zinc picolinate + 5000 IU vitamin A to support skin barrier function and reduce inflammation.", icon: "💊", supplementKeywords: ["zinc", "vitamin a"], glowImpact: 0.08, integrityBoost: 3 },
    { type: "cold", name: "Cold Water Splash", duration: "60 sec", description: "Cold water on affected area to reduce histamine response and vasoconstrict inflamed tissue.", icon: "🧊", glowImpact: 0.05, integrityBoost: 2 },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   QUERY: getMicroProtocols
   Returns targeted Micro-Protocol suggestions for a body region,
   cross-referenced with user's inventory availability.
   ═══════════════════════════════════════════════════════════════ */
export const getMicroProtocols = query({
  args: {
    sessionId: v.string(),
    region: v.string(),
    severity: v.string(),
  },
  handler: async (ctx, { sessionId, region, severity }) => {
    // 1. Get protocols for this region
    const protocols = REGION_PROTOCOLS[region] || REGION_PROTOCOLS["chest"] || [];

    // 2. Get user's inventory to check supplement availability
    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();
    const activeInventory = inventory.filter(i => i.status === "active" && i.currentQuantity > 0);

    // 3. Cross-reference supplements with inventory
    const enriched = protocols.map(proto => {
      let inventoryMatch: { name: string; daysRemaining: number; inStock: boolean } | null = null;

      if (proto.type === "supplement" && proto.supplementKeywords) {
        for (const item of activeInventory) {
          const itemNameLower = item.name.toLowerCase();
          const matched = proto.supplementKeywords.some(kw => itemNameLower.includes(kw));
          if (matched) {
            const daysRemaining = item.dailyUsageUnits > 0
              ? Math.floor(item.currentQuantity / item.dailyUsageUnits)
              : 999;
            inventoryMatch = {
              name: item.name,
              daysRemaining,
              inStock: true,
            };
            break;
          }
        }
        if (!inventoryMatch) {
          inventoryMatch = { name: proto.name, daysRemaining: 0, inStock: false };
        }
      }

      // Boost priority for high-severity regions
      const severityMultiplier = severity === "critical" ? 1.5 : severity === "high" ? 1.3 : severity === "moderate" ? 1.1 : 1.0;
      const priorityScore = proto.glowImpact * severityMultiplier * (inventoryMatch?.inStock !== false ? 1.2 : 0.7);

      return {
        ...proto,
        inventoryMatch,
        priorityScore: +priorityScore.toFixed(3),
        severityAdjustedGlow: +(proto.glowImpact * severityMultiplier).toFixed(3),
        severityAdjustedIntegrity: Math.round(proto.integrityBoost * severityMultiplier),
      };
    });

    // Sort by priority (in-stock supplements first, then by glow impact)
    enriched.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      region,
      severity,
      protocols: enriched,
      totalAvailable: enriched.length,
      supplementsInStock: enriched.filter(p => p.inventoryMatch?.inStock).length,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   MUTATION: logActiveIntervention
   Logs an accepted Micro-Protocol as an Active Intervention.
   This immediately impacts the BiologicalTwin glow by writing
   a journal event + updating adherence.
   ═══════════════════════════════════════════════════════════════ */
export const logActiveIntervention = mutation({
  args: {
    sessionId: v.string(),
    region: v.string(),
    protocolName: v.string(),
    protocolType: v.string(),
    glowImpact: v.number(),
    integrityBoost: v.number(),
    supplementUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Log as journal event for BiologicalTwin tracking
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "active_intervention",
      eventKey: `intervention:${args.region}:${args.protocolType}`,
      value: `${args.protocolName} — ${args.region} (glow +${(args.glowImpact * 100).toFixed(0)}%)`,
      numericValue: args.glowImpact * 100,
      loggedAt: now,
    });

    // 2. Log as protocol completion for adherence tracking
    await ctx.db.insert("protocolLogs", {
      sessionId: args.sessionId,
      protocolId: `micro-${args.protocolType}-${args.region}`,
      protocolName: args.protocolName,
      category: "micro-protocol",
      loggedAt: now,
      status: "completed",
    });

    // 3. If supplement was used, decrement inventory
    if (args.supplementUsed) {
      const items = await ctx.db
        .query("inventory")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const match = items.find(i =>
        i.status === "active" &&
        i.name.toLowerCase().includes(args.supplementUsed!.toLowerCase())
      );
      if (match && match.currentQuantity > 0) {
        const newQty = Math.max(0, match.currentQuantity - 1);
        await ctx.db.patch(match._id, {
          currentQuantity: newQty,
          status: newQty <= 0 ? "depleted" : "active",
          lastDecrementedAt: now,
          updatedAt: now,
        });
      }
    }

    // 4. Update presence to show active intervention
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (presence) {
      await ctx.db.patch(presence._id, {
        activeProtocol: `🎯 ${args.protocolName}`,
        activeCategory: "micro-protocol",
        auraState: "flow",
        lastSeen: now,
      });
    }

    return { success: true, loggedAt: now };
  },
});
