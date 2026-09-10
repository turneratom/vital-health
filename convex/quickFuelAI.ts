import { action, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   QUICK FUEL AI — Natural Language Meal Parser
   
   Parses strings like "3 eggs, half avocado, and some peptide-collagen coffee"
   into structured macros, micros, and longevity-booster highlights.
   Returns a parsed summary for one-tap approval and BioVault logging.
   ═══════════════════════════════════════════════════════════════ */

const QUICK_FUEL_SYSTEM_PROMPT = `You are a precision nutrition parser for the Vive biometric optimization platform. Parse the user's natural language meal description into a structured JSON breakdown with FULL micronutrient analysis and longevity pathway scoring.

RETURN ONLY valid JSON — no markdown, no explanation, no code fences.

OUTPUT FORMAT:
{
  "mealName": "SHORT_DESCRIPTIVE_NAME",
  "items": [
    {
      "name": "FOOD_ITEM",
      "quantity": "AMOUNT_STRING",
      "calories": NUMBER,
      "protein": NUMBER,
      "carbs": NUMBER,
      "fat": NUMBER,
      "fiber": NUMBER,
      "isLongevityBooster": BOOLEAN,
      "longevityNote": "STRING_OR_NULL",
      "micronutrients": {
        "omega3mg": NUMBER_OR_0,
        "polyphenolsMg": NUMBER_OR_0,
        "sulforaphaneMcg": NUMBER_OR_0,
        "resveratrolMcg": NUMBER_OR_0,
        "quercetinMg": NUMBER_OR_0,
        "curcuminMg": NUMBER_OR_0,
        "vitaminCmg": NUMBER_OR_0,
        "vitaminEmg": NUMBER_OR_0,
        "seleniumMcg": NUMBER_OR_0,
        "zincMg": NUMBER_OR_0,
        "magnesiumMg": NUMBER_OR_0,
        "nad_precursorMg": NUMBER_OR_0
      }
    }
  ],
  "totals": {
      "calories": NUMBER,
      "protein": NUMBER,
      "carbs": NUMBER,
      "fat": NUMBER,
      "fiber": NUMBER
  },
  "microTotals": {
      "omega3mg": NUMBER,
      "polyphenolsMg": NUMBER,
      "sulforaphaneMcg": NUMBER,
      "resveratrolMcg": NUMBER,
      "quercetinMg": NUMBER,
      "curcuminMg": NUMBER,
      "vitaminCmg": NUMBER,
      "vitaminEmg": NUMBER,
      "seleniumMcg": NUMBER,
      "zincMg": NUMBER,
      "magnesiumMg": NUMBER,
      "nad_precursorMg": NUMBER
  },
  "longevityHighlights": ["STRING_ARRAY_OF_LONGEVITY_BENEFITS"],
  "fuelScore": NUMBER_1_TO_10,
  "molecularInsight": {
      "sirtuinActivation": NUMBER_0_TO_100,
      "sirtuinDrivers": ["STRING_ARRAY"],
      "cellularRepairScore": NUMBER_0_TO_100,
      "cellularRepairDrivers": ["STRING_ARRAY"],
      "mitochondrialScore": NUMBER_0_TO_100,
      "mitochondrialDrivers": ["STRING_ARRAY"],
      "antiInflammatoryScore": NUMBER_0_TO_100,
      "antiInflammatoryDrivers": ["STRING_ARRAY"],
      "gutMicrobiomeScore": NUMBER_0_TO_100,
      "gutMicrobiomeDrivers": ["STRING_ARRAY"],
      "headline": "ONE_SENTENCE_MOLECULAR_IMPACT_HEADLINE",
      "narrative": "2_3_SENTENCE_BIOLOGICAL_EXPERT_NARRATIVE"
  }
}
}

MICRONUTRIENT ESTIMATION RULES:
- Estimate micronutrients using standard USDA + research databases
- omega3mg: EPA+DHA+ALA combined (salmon=2200mg, walnuts=2500mg per oz, eggs=80mg)
- polyphenolsMg: total polyphenols (blueberries=500mg/cup, dark chocolate=200mg/oz, coffee=200mg/cup, olive oil=150mg/tbsp)
- sulforaphaneMcg: only in cruciferous (broccoli=30000mcg/cup, kale=15000mcg/cup)
- resveratrolMcg: grapes=500mcg, red wine=1000mcg/glass, peanuts=100mcg
- quercetinMg: onions=20mg, apples=10mg, berries=15mg
- curcuminMg: turmeric=150mg/tsp, curry=30mg
- nad_precursorMg: NMN/NR supplements, or niacin-rich foods (chicken=15mg, tuna=10mg)
- Round to nearest whole number, 0 if not present

MOLECULAR INSIGHT SCORING (0-100 each):
- sirtuinActivation: Polyphenols (resveratrol, quercetin, fisetin) + NAD+ precursors + caloric restriction signals. >70 = exceptional.
- cellularRepairScore: Autophagy triggers (polyphenols, fasting window), antioxidants (C, E, selenium), sulforaphane (Nrf2). >70 = strong repair.
- mitochondrialScore: CoQ10, omega-3s, magnesium, healthy fats, NAD+ precursors. >70 = mitochondrial boost.
- antiInflammatoryScore: Omega-3s, curcumin, polyphenols vs pro-inflammatory foods. >70 = anti-inflammatory.
- gutMicrobiomeScore: Fiber, fermented foods, polyphenols, prebiotic diversity. >70 = microbiome positive.
- headline: e.g. "This meal just boosted your cellular repair (Sirtuins) by 15% due to the polyphenols in your blueberries."
- narrative: 2-3 sentences explaining the molecular pathways activated, written like a biological expert briefing a patient.

LONGEVITY BOOSTERS — flag these and explain why:
- High fiber foods (>5g per serving): gut microbiome, insulin sensitivity
- Omega-3 rich foods (salmon, sardines, walnuts, flax): anti-inflammatory, brain health
- Polyphenol-rich foods (berries, dark chocolate, green tea, olive oil): antioxidant, cellular repair
- Collagen/peptides: joint health, skin elasticity, gut lining
- Cruciferous vegetables (broccoli, kale, cauliflower): sulforaphane, detox pathways
- Fermented foods (kimchi, sauerkraut, yogurt, kefir): gut microbiome diversity
- Healthy fats (avocado, nuts, olive oil, MCT): mitochondrial function, hormone production
- High-protein foods (>25g per serving): muscle protein synthesis, mTOR signaling
- Low-glycemic foods: glucose stability, insulin sensitivity
- Turmeric/ginger: anti-inflammatory, NF-kB pathway modulation

FUEL SCORE (1-10):
- 9-10: Exceptional longevity meal (high protein, healthy fats, fiber, multiple boosters)
- 7-8: Strong fuel (good macros, some longevity benefits)
- 5-6: Adequate (meets basic needs, few boosters)
- 3-4: Suboptimal (high processed carbs, low protein, few nutrients)
- 1-2: Poor fuel (junk food, empty calories)

RULES:
- Estimate portions generously if not specified (e.g., "some eggs" = 2 eggs)
- Use standard USDA nutritional data for estimates
- Round calories to nearest 5, macros to nearest 0.5g
- Always include fiber — it's critical for longevity scoring
- Be specific in longevityNote (e.g., "Rich in omega-3 DHA — reduces systemic inflammation")
- mealName should be concise (3-5 words max)`;

export const parseQuickFuel = action({
  args: {
    input: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    parsed: any;
    error?: string;
    source: "llm" | "local";
  }> => {
    const input = args.input.trim();
    if (!input) {
      return { success: false, parsed: null, error: "Empty input", source: "local" };
    }

    // ── Shipper AI only for macro estimates — never invent when unset ──
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    const pendingParse = () => ({
      mealName: input.slice(0, 60),
      items: [{
        name: input.slice(0, 60),
        quantity: "as logged",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        isLongevityBooster: false,
        longevityNote: null,
      }],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      longevityHighlights: [],
      fuelScore: 0,
      analysisStatus: "pending",
      pendingMessage: "Pending analysis — AI unavailable. Macros not estimated. Save text or enter macros manually.",
    });

    if (!SHIPPER_AI_URL || !SHIPPER_AI_TOKEN) {
      return { success: true, parsed: pendingParse(), source: "local" };
    }

    try {
      const response = await fetch(SHIPPER_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: QUICK_FUEL_SYSTEM_PROMPT },
            { role: "user", content: input },
          ],
          temperature: 0.15,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        return { success: true, parsed: pendingParse(), error: `AI error: ${response.status}`, source: "local" };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";

      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
      }

      const parsed = JSON.parse(cleaned);
      return { success: true, parsed: { ...parsed, analysisStatus: "analyzed" }, source: "llm" };
    } catch (err: any) {
      return { success: true, parsed: pendingParse(), error: err.message, source: "local" };
    }
  },
});

/* ── Log approved meal to foodLogs ── */
export const logQuickFuelMeal = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    fiber: v.optional(v.number()),
    fuelScore: v.optional(v.number()),
    longevityScore: v.optional(v.number()),
    molecularInsight: v.optional(v.string()),
    microTotals: v.optional(v.string()),
    items: v.optional(v.string()),
    analysisStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const status = args.analysisStatus
      ?? (args.calories === 0 && args.protein === 0 && args.carbs === 0 && args.fat === 0 ? "pending" : "analyzed");
    // Log to foodLogs table
    const logId = await ctx.db.insert("foodLogs", {
      sessionId: args.sessionId,
      name: args.name,
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat,
      fiber: args.fiber,
      fuelScore: status === "pending" ? undefined : args.fuelScore,
      longevityScore: args.longevityScore,
      molecularInsight: args.molecularInsight,
      microTotals: args.microTotals,
      source: status === "pending" ? "quick-fuel-pending" : "quick-fuel",
      analysisStatus: status,
      loggedAt: now,
    });

    // Also log as a journal event for the timeline
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "nutrition",
      eventKey: "quick_fuel_meal",
      value: JSON.stringify({
        name: args.name,
        calories: args.calories,
        protein: args.protein,
        carbs: args.carbs,
        fat: args.fat,
        fiber: args.fiber ?? 0,
        fuelScore: args.fuelScore ?? 5,
        items: args.items ?? "[]",
      }),
      numericValue: args.calories,
      loggedAt: now,
    });

    return { logId, loggedAt: now };
  },
});

/* ── Local parsing for common simple meals ── */
function tryLocalMealParse(input: string): any | null {
  const lower = input.toLowerCase().trim();

  // Very simple patterns: "just a protein shake", "black coffee"
  const simpleMap: Record<string, any> = {
    "black coffee": {
      mealName: "Black Coffee",
      items: [{ name: "Black Coffee", quantity: "1 cup", calories: 5, protein: 0.3, carbs: 0, fat: 0, fiber: 0, isLongevityBooster: true, longevityNote: "Rich in polyphenols — supports autophagy and cognitive function" }],
      totals: { calories: 5, protein: 0.3, carbs: 0, fat: 0, fiber: 0 },
      longevityHighlights: ["Polyphenol-rich — supports autophagy"],
      fuelScore: 6,
    },
    "protein shake": {
      mealName: "Protein Shake",
      items: [{ name: "Whey Protein Shake", quantity: "1 scoop + water", calories: 130, protein: 25, carbs: 3, fat: 1.5, fiber: 0, isLongevityBooster: false, longevityNote: null }],
      totals: { calories: 130, protein: 25, carbs: 3, fat: 1.5, fiber: 0 },
      longevityHighlights: ["High protein — supports muscle protein synthesis"],
      fuelScore: 7,
    },
  };

  for (const [key, val] of Object.entries(simpleMap)) {
    if (lower === key || lower === `just a ${key}` || lower === `just ${key}`) {
      return val;
    }
  }

  return null;
}

/* ── Fallback parser when AI is unavailable ── */
function buildFallbackParse(input: string): any {
  const lower = input.toLowerCase();
  const items: any[] = [];
  let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, totalFiber = 0;
  const highlights: string[] = [];
  const microTotals: Record<string, number> = {};

  // Simple food database for fallback
  const foodDb: Record<string, { cal: number; p: number; c: number; f: number; fiber: number; longevity: boolean; note: string | null; micro?: Record<string, number> }> = {
    egg: { cal: 70, p: 6, c: 0.5, f: 5, fiber: 0, longevity: false, note: null, micro: { omega3mg: 80, seleniumMcg: 15, zincMg: 0.6, vitaminEmg: 0.5 } },
    avocado: { cal: 160, p: 2, c: 9, f: 15, fiber: 7, longevity: true, note: "Healthy monounsaturated fats — mitochondrial support", micro: { magnesiumMg: 29, vitaminEmg: 2, polyphenolsMg: 30 } },
    coffee: { cal: 5, p: 0.3, c: 0, f: 0, fiber: 0, longevity: true, note: "Polyphenol-rich — supports autophagy", micro: { polyphenolsMg: 200 } },
    salmon: { cal: 230, p: 25, c: 0, f: 14, fiber: 0, longevity: true, note: "Omega-3 DHA — reduces systemic inflammation", micro: { omega3mg: 2200, seleniumMcg: 40, vitaminEmg: 3 } },
    chicken: { cal: 165, p: 31, c: 0, f: 3.5, fiber: 0, longevity: false, note: null, micro: { zincMg: 1.5, seleniumMcg: 22, nad_precursorMg: 15 } },
    rice: { cal: 205, p: 4, c: 45, f: 0.5, fiber: 0.5, longevity: false, note: null, micro: { magnesiumMg: 12 } },
    broccoli: { cal: 55, p: 4, c: 11, f: 0.5, fiber: 5, longevity: true, note: "Sulforaphane — activates Nrf2 detox pathways", micro: { sulforaphaneMcg: 30000, vitaminCmg: 89, quercetinMg: 3 } },
    spinach: { cal: 23, p: 3, c: 3.5, f: 0.5, fiber: 2, longevity: true, note: "Rich in nitrates and magnesium — cardiovascular support", micro: { magnesiumMg: 24, vitaminCmg: 8, vitaminEmg: 2, quercetinMg: 4 } },
    oatmeal: { cal: 150, p: 5, c: 27, f: 2.5, fiber: 4, longevity: true, note: "Beta-glucan fiber — gut microbiome support", micro: { magnesiumMg: 27, zincMg: 1.5 } },
    berries: { cal: 85, p: 1, c: 21, f: 0.5, fiber: 4, longevity: true, note: "Anthocyanins — powerful antioxidant, cellular repair", micro: { polyphenolsMg: 500, quercetinMg: 15, vitaminCmg: 14, resveratrolMcg: 200 } },
    collagen: { cal: 35, p: 9, c: 0, f: 0, fiber: 0, longevity: true, note: "Peptide collagen — joint health, gut lining repair", micro: {} },
    "olive oil": { cal: 120, p: 0, c: 0, f: 14, fiber: 0, longevity: true, note: "Oleocanthal — anti-inflammatory, mimics ibuprofen", micro: { polyphenolsMg: 150, vitaminEmg: 2 } },
    nuts: { cal: 170, p: 5, c: 6, f: 15, fiber: 3, longevity: true, note: "Healthy fats + fiber — cardiovascular longevity", micro: { omega3mg: 2500, magnesiumMg: 50, vitaminEmg: 7, seleniumMcg: 3 } },
    steak: { cal: 270, p: 26, c: 0, f: 18, fiber: 0, longevity: false, note: null, micro: { zincMg: 5, seleniumMcg: 26, nad_precursorMg: 8 } },
    yogurt: { cal: 100, p: 17, c: 6, f: 0.7, fiber: 0, longevity: true, note: "Probiotics — gut microbiome diversity", micro: { magnesiumMg: 12, zincMg: 0.9 } },
  };

  // Try to match foods in the input
  for (const [food, data] of Object.entries(foodDb)) {
    if (lower.includes(food)) {
      // Try to extract quantity
      const qtyMatch = lower.match(new RegExp(`(\\d+)\\s*${food}`));
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      const multiplier = food === "avocado" && lower.includes("half") ? 0.5 : qty;

      const item = {
        name: food.charAt(0).toUpperCase() + food.slice(1),
        quantity: multiplier === 0.5 ? "½" : `${multiplier}`,
        calories: Math.round(data.cal * multiplier),
        protein: Math.round(data.p * multiplier * 2) / 2,
        carbs: Math.round(data.c * multiplier * 2) / 2,
        fat: Math.round(data.f * multiplier * 2) / 2,
        fiber: Math.round(data.fiber * multiplier * 2) / 2,
        isLongevityBooster: data.longevity,
        longevityNote: data.note,
      };

      items.push(item);
      totalCal += item.calories;
      totalP += item.protein;
      totalC += item.carbs;
      totalF += item.fat;
      totalFiber += item.fiber;

      // Accumulate micronutrients
      if (data.micro) {
        for (const [mk, mv] of Object.entries(data.micro)) {
          microTotals[mk] = (microTotals[mk] || 0) + (mv as number) * multiplier;
        }
      }

      if (data.longevity && data.note) {
        highlights.push(data.note);
      }
    }
  }

  // If nothing matched, create a generic entry
  if (items.length === 0) {
    items.push({
      name: input.slice(0, 50),
      quantity: "1 serving",
      calories: 300,
      protein: 15,
      carbs: 30,
      fat: 12,
      fiber: 3,
      isLongevityBooster: false,
      longevityNote: null,
    });
    totalCal = 300; totalP = 15; totalC = 30; totalF = 12; totalFiber = 3;
  }

  // Compute fuel score
  let fuelScore = 5;
  if (totalP > 25) fuelScore += 1;
  if (totalFiber > 5) fuelScore += 1;
  if (highlights.length > 0) fuelScore += highlights.length;
  fuelScore = Math.min(10, Math.max(1, fuelScore));

  // Build molecular insight from micronutrient totals
  const sirtuin = Math.min(100, Math.round(((microTotals.polyphenolsMg || 0) / 5 + (microTotals.resveratrolMcg || 0) / 20 + (microTotals.quercetinMg || 0) * 2 + (microTotals.nad_precursorMg || 0) * 1.5)));
  const cellRepair = Math.min(100, Math.round(((microTotals.sulforaphaneMcg || 0) / 500 + (microTotals.vitaminCmg || 0) / 2 + (microTotals.vitaminEmg || 0) * 3 + (microTotals.seleniumMcg || 0) / 2)));
  const mito = Math.min(100, Math.round(((microTotals.omega3mg || 0) / 40 + (microTotals.magnesiumMg || 0) / 2 + (microTotals.nad_precursorMg || 0) * 3 + totalF * 0.5)));
  const antiInflam = Math.min(100, Math.round(((microTotals.omega3mg || 0) / 30 + (microTotals.curcuminMg || 0) * 0.5 + (microTotals.polyphenolsMg || 0) / 4)));
  const gut = Math.min(100, Math.round((totalFiber * 5 + (microTotals.polyphenolsMg || 0) / 8)));

  const topPathway = [{ n: 'Sirtuin Activation', s: sirtuin }, { n: 'Cellular Repair', s: cellRepair }, { n: 'Mitochondrial Function', s: mito }, { n: 'Anti-Inflammatory', s: antiInflam }, { n: 'Gut Microbiome', s: gut }].sort((a, b) => b.s - a.s)[0];

  return {
    mealName: items.length === 1 ? items[0].name : `${items[0].name} + ${items.length - 1} more`,
    items,
    totals: { calories: totalCal, protein: totalP, carbs: totalC, fat: totalF, fiber: totalFiber },
    microTotals: {
      omega3mg: Math.round(microTotals.omega3mg || 0),
      polyphenolsMg: Math.round(microTotals.polyphenolsMg || 0),
      sulforaphaneMcg: Math.round(microTotals.sulforaphaneMcg || 0),
      resveratrolMcg: Math.round(microTotals.resveratrolMcg || 0),
      quercetinMg: Math.round(microTotals.quercetinMg || 0),
      curcuminMg: Math.round(microTotals.curcuminMg || 0),
      vitaminCmg: Math.round(microTotals.vitaminCmg || 0),
      vitaminEmg: Math.round(microTotals.vitaminEmg || 0),
      seleniumMcg: Math.round(microTotals.seleniumMcg || 0),
      zincMg: Math.round(microTotals.zincMg || 0),
      magnesiumMg: Math.round(microTotals.magnesiumMg || 0),
      nad_precursorMg: Math.round(microTotals.nad_precursorMg || 0),
    },
    longevityHighlights: highlights.length > 0 ? highlights : ["Log more nutrient-dense foods to unlock longevity insights"],
    fuelScore,
    molecularInsight: {
      sirtuinActivation: sirtuin,
      sirtuinDrivers: sirtuin > 20 ? ["Polyphenol-mediated SIRT1 upregulation", "NAD+ pathway support"] : ["Low sirtuin activation — add polyphenol-rich foods"],
      cellularRepairScore: cellRepair,
      cellularRepairDrivers: cellRepair > 20 ? ["Nrf2 pathway activation", "Antioxidant defense cascade"] : ["Minimal repair signals — add cruciferous vegetables"],
      mitochondrialScore: mito,
      mitochondrialDrivers: mito > 20 ? ["Omega-3 membrane integration", "Magnesium-dependent ATP synthesis"] : ["Low mitochondrial support — add healthy fats"],
      antiInflammatoryScore: antiInflam,
      antiInflammatoryDrivers: antiInflam > 20 ? ["NF-κB suppression via omega-3 prostaglandins"] : ["Neutral inflammatory profile"],
      gutMicrobiomeScore: gut,
      gutMicrobiomeDrivers: gut > 20 ? ["Prebiotic fiber fermentation", "Polyphenol-mediated diversity"] : ["Low microbiome impact — add fiber"],
      headline: `This meal scored ${topPathway.s}% on ${topPathway.n} — ${topPathway.s >= 50 ? 'strong biological signal detected' : 'moderate molecular impact'}.`,
      narrative: `${topPathway.s >= 50 ? 'Your meal activates key longevity pathways.' : 'This meal provides baseline nutrition.'} ${sirtuin >= 30 ? `Polyphenol content triggers SIRT1-mediated cellular maintenance, enhancing DNA repair and metabolic efficiency.` : ''} ${antiInflam >= 40 ? `Anti-inflammatory compounds suppress NF-κB signaling, reducing systemic inflammation.` : ''} ${gut >= 40 ? `Fiber and polyphenols support short-chain fatty acid production in the gut.` : ''}`.trim(),
    },
  };
}
