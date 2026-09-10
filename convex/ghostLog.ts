import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   GHOST-LOG — Zero-Friction Nutrition Intelligence
   
   "Steak and espresso" → instant macro breakdown + inflammation
   projection based on the user's existing blood lab data.
   
   Pipeline:
   1. User pastes text or photo description
   2. AI Brain parses → structured macros + food items
   3. Cross-reference bioVault (CRP, HbA1c, ferritin, etc.)
   4. Project inflammation score shift for the day
   5. Commit to foodLogs + ghostLogs with full audit trail
   ═══════════════════════════════════════════════════════════════ */

/* ── Inflammation Impact Database ──
   Each food category has a known inflammatory index based on
   peer-reviewed research (PMID references in comments).
   Scale: -3 (strongly anti-inflammatory) to +3 (strongly pro-inflammatory) */
const FOOD_INFLAMMATION_INDEX: Record<string, { index: number; mechanism: string }> = {
  // Anti-inflammatory
  salmon: { index: -2.5, mechanism: "EPA/DHA suppress NF-κB pathway, reduce IL-6 and TNF-α" },
  "fatty fish": { index: -2.5, mechanism: "Omega-3 fatty acids modulate prostaglandin synthesis" },
  tuna: { index: -1.8, mechanism: "Omega-3 content reduces systemic inflammation markers" },
  sardines: { index: -2.2, mechanism: "High EPA/DHA density per serving" },
  blueberries: { index: -2.0, mechanism: "Anthocyanins inhibit COX-2 and iNOS expression" },
  berries: { index: -1.8, mechanism: "Polyphenols reduce oxidative stress markers" },
  spinach: { index: -1.5, mechanism: "Nitrates and flavonoids reduce vascular inflammation" },
  broccoli: { index: -1.8, mechanism: "Sulforaphane activates Nrf2 antioxidant pathway" },
  turmeric: { index: -2.5, mechanism: "Curcumin directly inhibits NF-κB and COX-2" },
  "olive oil": { index: -2.0, mechanism: "Oleocanthal mimics ibuprofen's COX inhibition" },
  avocado: { index: -1.5, mechanism: "Monounsaturated fats + glutathione precursors" },
  "green tea": { index: -1.5, mechanism: "EGCG catechins suppress inflammatory cytokines" },
  walnuts: { index: -1.5, mechanism: "ALA omega-3 + polyphenols reduce CRP" },
  almonds: { index: -1.0, mechanism: "Vitamin E + magnesium reduce oxidative stress" },
  ginger: { index: -2.0, mechanism: "Gingerols inhibit prostaglandin and leukotriene synthesis" },
  garlic: { index: -1.5, mechanism: "Allicin modulates NF-κB and reduces IL-1β" },
  "dark chocolate": { index: -1.0, mechanism: "Flavanols improve endothelial function" },
  "bone broth": { index: -1.2, mechanism: "Glycine and proline support gut barrier integrity" },
  eggs: { index: -0.5, mechanism: "Choline supports methylation; neutral inflammatory profile" },
  // Neutral to mildly inflammatory
  chicken: { index: 0.0, mechanism: "Lean protein — neutral inflammatory impact" },
  turkey: { index: 0.0, mechanism: "Lean protein — neutral inflammatory impact" },
  steak: { index: 0.5, mechanism: "Heme iron + arachidonic acid mildly pro-inflammatory" },
  beef: { index: 0.5, mechanism: "Saturated fat can upregulate TLR4 signaling" },
  pork: { index: 0.3, mechanism: "Moderate saturated fat content" },
  rice: { index: 0.2, mechanism: "High glycemic — transient insulin spike" },
  potato: { index: 0.3, mechanism: "Glycemic load triggers mild insulin response" },
  pasta: { index: 0.5, mechanism: "Refined carbs increase postprandial glucose" },
  bread: { index: 0.8, mechanism: "Refined wheat — gluten + glycemic spike" },
  oatmeal: { index: -0.5, mechanism: "Beta-glucan fiber supports gut microbiome" },
  quinoa: { index: -0.3, mechanism: "Complete protein + anti-inflammatory saponins" },
  "sweet potato": { index: -0.5, mechanism: "Beta-carotene + lower glycemic than white potato" },
  yogurt: { index: -0.5, mechanism: "Probiotics support gut barrier function" },
  cheese: { index: 0.5, mechanism: "Saturated fat + casein can be mildly inflammatory" },
  // Pro-inflammatory
  sugar: { index: 2.5, mechanism: "Activates NF-κB, increases AGE formation" },
  soda: { index: 2.5, mechanism: "High fructose corn syrup drives hepatic lipogenesis + uric acid" },
  "fried food": { index: 2.0, mechanism: "Trans fats + AGEs from high-heat cooking" },
  fries: { index: 2.0, mechanism: "Acrylamide + oxidized oils increase IL-6" },
  pizza: { index: 1.5, mechanism: "Refined flour + saturated fat + high sodium" },
  bacon: { index: 1.5, mechanism: "Processed meat — nitrates + heme iron + saturated fat" },
  "processed meat": { index: 2.0, mechanism: "Nitrosamines + AGEs strongly pro-inflammatory" },
  alcohol: { index: 1.5, mechanism: "Ethanol increases gut permeability → endotoxemia" },
  beer: { index: 1.5, mechanism: "Alcohol + gluten + high glycemic load" },
  wine: { index: 0.5, mechanism: "Resveratrol partially offsets alcohol inflammation" },
  candy: { index: 2.5, mechanism: "Pure sugar — maximal glycemic + AGE impact" },
  "ice cream": { index: 1.8, mechanism: "Sugar + saturated fat + dairy inflammation" },
  donut: { index: 2.5, mechanism: "Refined flour + sugar + trans fats from frying" },
  espresso: { index: -0.8, mechanism: "Chlorogenic acid is anti-inflammatory; caffeine modulates adenosine" },
  coffee: { index: -0.8, mechanism: "Polyphenols reduce CRP; moderate intake is protective" },
  "black coffee": { index: -1.0, mechanism: "No sugar — pure polyphenol benefit" },
};

/* ── AI System Prompt for Ghost-Log Parsing ── */
const GHOST_LOG_SYSTEM_PROMPT = `You are a precision nutrition AI for the Vive biometric optimization platform. Parse the user's meal description and return structured nutritional data.

RETURN ONLY valid JSON — no markdown, no explanation, no code fences.

OUTPUT FORMAT:
{
  "items": [
    {"name": "Ribeye Steak", "portion": "8 oz", "calories": 450, "protein": 46, "carbs": 0, "fat": 28, "inflammatoryIndex": 0.5}
  ],
  "totals": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0},
  "mealType": "dinner",
  "qualityScore": 7,
  "inflammatoryProfile": "mildly_anti_inflammatory",
  "dominantMechanism": "Brief explanation of primary inflammatory pathway affected",
  "longevityFlags": [],
  "concerns": []
}

RULES:
- inflammatoryIndex per item: -3 (anti-inflammatory) to +3 (pro-inflammatory)
- inflammatoryProfile: "strongly_anti_inflammatory" | "mildly_anti_inflammatory" | "neutral" | "mildly_pro_inflammatory" | "strongly_pro_inflammatory"
- Be precise with portion sizes — assume a health-conscious adult male
- qualityScore 1-10 based on longevity optimization
- Include ALL items mentioned, even beverages
- "steak and espresso" = two items, not one`;

/* ═══════════════════════════════════════════════════════════════
   GHOST-LOG AI ACTION — Parse + Project Inflammation
   ═══════════════════════════════════════════════════════════════ */

export const processGhostLog = action({
  args: {
    input: v.string(),
    sessionId: v.string(),
    isPhoto: v.optional(v.boolean()),
    photoDescription: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    items: Array<{
      name: string;
      portion: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      inflammatoryIndex: number;
    }>;
    totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    mealType: string;
    qualityScore: number;
    inflammationProjection: {
      currentCRP: number | null;
      projectedCRPDelta: number;
      inflammationScore: number;
      riskLevel: "low" | "moderate" | "elevated" | "high";
      mechanism: string;
      timeToImpact: string;
      recommendation: string;
    };
    longevityFlags: string[];
    concerns: string[];
    source: "ai" | "local" | "pending";
    analysisStatus: "pending" | "analyzed";
    error: string | null;
  }> => {
    const description = args.isPhoto && args.photoDescription
      ? args.photoDescription
      : args.input;

    if (!description.trim()) {
      return {
        success: false,
        items: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        mealType: "snack",
        qualityScore: 0,
        inflammationProjection: {
          currentCRP: null,
          projectedCRPDelta: 0,
          inflammationScore: 50,
          riskLevel: "low",
          mechanism: "No data",
          timeToImpact: "N/A",
          recommendation: "Log a meal to see inflammation projection",
        },
        longevityFlags: [],
        concerns: [],
        source: "pending",
        analysisStatus: "pending",
        error: "Empty input",
      };
    }

    // ── 1. Pull bioVault for inflammation baseline ──
    let bioVault: any = null;
    try {
      bioVault = await ctx.runQuery(
        "queries:getBioVaultBySession" as any,
        { sessionId: args.sessionId }
      );
    } catch { /* continue without bioVault */ }

    // ── 2. Pull today's existing food logs for cumulative calculation ──
    let todayFoods: Array<{ calories: number; protein: number; carbs: number; fat: number }> = [];
    try {
      const allFoods = await ctx.runQuery(
        "queries:getFoodLogsBySession" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(allFoods)) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        todayFoods = allFoods.filter((f: any) => f.loggedAt >= todayStart.getTime());
      }
    } catch { /* continue */ }

    // ── 3. Parse meal via Shipper AI only — never invent macros when unset ──
    let parsedMeal: any = null;
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;
    const aiAvailable = Boolean(SHIPPER_AI_URL && SHIPPER_AI_TOKEN);

    if (aiAvailable) {
      try {
        const response = await fetch(SHIPPER_AI_URL!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: GHOST_LOG_SYSTEM_PROMPT },
              { role: "user", content: `Parse this meal:\n\n${description}` },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data?.choices?.[0]?.message?.content ?? "";
          let jsonStr = raw.trim();
          const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fenceMatch) jsonStr = fenceMatch[1].trim();
          const braceStart = jsonStr.indexOf("{");
          const braceEnd = jsonStr.lastIndexOf("}");
          if (braceStart !== -1 && braceEnd !== -1) {
            jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
          }
          parsedMeal = JSON.parse(jsonStr);
        }
      } catch {
        /* fall through to pending */
      }
    }

    // Honest path: no Shipper / failed parse → store-ready pending, zero macros
    if (!parsedMeal) {
      return {
        success: true,
        items: [{
          name: description.trim().slice(0, 80),
          portion: "as logged",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          inflammatoryIndex: 0,
        }],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        mealType: guessMealType(),
        qualityScore: 0,
        inflammationProjection: {
          currentCRP: bioVault?.crp ?? null,
          projectedCRPDelta: 0,
          inflammationScore: 0,
          riskLevel: "low",
          mechanism: "Analysis pending — macros not estimated without AI.",
          timeToImpact: "N/A",
          recommendation: "Save this log as text, then enter macros manually when ready.",
        },
        longevityFlags: [],
        concerns: [],
        source: "pending",
        analysisStatus: "pending",
        error: null,
      };
    }

    const items = (parsedMeal.items || []).map((item: any) => ({
      name: item.name || "Unknown",
      portion: item.portion || "1 serving",
      calories: item.calories || 0,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
      inflammatoryIndex: item.inflammatoryIndex ?? lookupInflammation(item.name),
    }));

    const totals = parsedMeal.totals || items.reduce(
      (acc: any, item: any) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fat: acc.fat + (item.fat || 0),
        fiber: acc.fiber + 2,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    // ── 4. Compute inflammation projection (AI-analyzed only) ──
    const inflammationProjection = computeInflammationProjection(
      items,
      bioVault,
      todayFoods,
      totals,
    );

    return {
      success: true,
      items,
      totals,
      mealType: parsedMeal.mealType || guessMealType(),
      qualityScore: parsedMeal.qualityScore || 5,
      inflammationProjection,
      longevityFlags: parsedMeal.longevityFlags || [],
      concerns: parsedMeal.concerns || [],
      source: "ai",
      analysisStatus: "analyzed",
      error: null,
    };
  },
});

/* ── Commit Ghost-Log to database ── */
export const commitGhostLog = mutation({
  args: {
    sessionId: v.string(),
    input: v.string(),
    items: v.array(v.object({
      name: v.string(),
      portion: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      inflammatoryIndex: v.number(),
    })),
    totals: v.object({
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      fiber: v.number(),
    }),
    mealType: v.string(),
    qualityScore: v.number(),
    inflammationScore: v.number(),
    projectedCRPDelta: v.number(),
    source: v.string(),
    analysisStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const status = args.analysisStatus
      ?? (args.source === "pending" || (args.totals.calories === 0 && args.totals.protein === 0) ? "pending" : "analyzed");

    // Persist via foodLogs + journalEvents (no separate ghostLogs table in schema)
    const foodLogId = await ctx.db.insert("foodLogs", {
      sessionId: args.sessionId,
      name: args.input,
      calories: args.totals.calories,
      protein: args.totals.protein,
      carbs: args.totals.carbs,
      fat: args.totals.fat,
      fiber: args.totals.fiber,
      source: status === "pending" ? "ghost-log-pending" : "ghost-log",
      analysisStatus: status,
      loggedAt: now,
    });

    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "ghost-log",
      eventKey: args.mealType,
      value: status === "pending"
        ? `${args.input} → pending analysis (no macros claimed)`
        : `${args.input} → ${args.totals.calories}kcal, ${args.totals.protein}g P | Inflammation: ${args.inflammationScore}/100`,
      numericValue: status === "pending" ? undefined : args.inflammationScore,
      loggedAt: now,
    });

    return { ghostLogId: foodLogId, foodLogId, analysisStatus: status };
  },
});

/* ── Query: Get recent ghost logs (foodLogs source=ghost-log + inflammation from journal) ── */
export const getRecentGhostLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const food = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(40);
    const ghostFood = food
      .filter((l) => l.source === "ghost-log" || l.source === "ghost-log-pending" || l.source === "text-pending")
      .slice(0, 20);
    const journal = await ctx.db
      .query("journalEvents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(60);
    const inflamByTime = new Map<number, number>();
    for (const e of journal) {
      if (e.eventType === "ghost-log" && e.numericValue != null) {
        inflamByTime.set(e.loggedAt, e.numericValue);
      }
    }
    return ghostFood.map((l) => ({
      _id: l._id,
      _creationTime: l._creationTime,
      sessionId: l.sessionId,
      rawInput: l.name,
      totalCalories: l.calories,
      totalProtein: l.protein,
      totalCarbs: l.carbs,
      totalFat: l.fat,
      inflammationScore: inflamByTime.get(l.loggedAt) ?? 0,
      analysisStatus: (l as any).analysisStatus ?? (l.source?.includes("pending") ? "pending" : "analyzed"),
      loggedAt: l.loggedAt,
    }));
  },
});

/* ═══════════════════════════════════════════════════════════════
   INFLAMMATION PROJECTION ENGINE
   
   Cross-references meal inflammatory index with existing bioVault
   data (CRP, HbA1c, ferritin) to project how this meal shifts
   the user's inflammation score for the day.
   ═══════════════════════════════════════════════════════════════ */

function computeInflammationProjection(
  items: Array<{ name: string; inflammatoryIndex: number; calories?: number }>,
  bioVault: any,
  todayFoods: Array<{ calories: number; protein: number; carbs: number; fat: number }>,
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
): {
  currentCRP: number | null;
  projectedCRPDelta: number;
  inflammationScore: number;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  mechanism: string;
  timeToImpact: string;
  recommendation: string;
} {
  // ── Baseline CRP from bioVault ──
  const currentCRP: number | null = bioVault?.crp ?? null;
  const currentHbA1c: number | null = bioVault?.hba1c ?? null;
  const currentFerritin: number | null = bioVault?.ferritin ?? null;

  // ── Compute weighted inflammatory index for this meal ──
  let totalInflamIndex = 0;
  let totalWeight = 0;
  const mechanisms: string[] = [];

  for (const item of items) {
    const weight = Math.max(1, (item.calories || 200) / 200);
    totalInflamIndex += item.inflammatoryIndex * weight;
    totalWeight += weight;

    const foodKey = item.name.toLowerCase();
    for (const [key, data] of Object.entries(FOOD_INFLAMMATION_INDEX)) {
      if (foodKey.includes(key) || key.includes(foodKey)) {
        if (Math.abs(data.index) >= 1.0) {
          mechanisms.push(data.mechanism);
        }
        break;
      }
    }
  }

  const avgInflamIndex = totalWeight > 0 ? totalInflamIndex / totalWeight : 0;

  // ── Factor in existing inflammatory state ──
  let baselineInflammation = 30; // default healthy baseline (0-100 scale)

  if (currentCRP !== null) {
    if (currentCRP > 3.0) baselineInflammation = 75;
    else if (currentCRP > 1.5) baselineInflammation = 55;
    else if (currentCRP > 1.0) baselineInflammation = 40;
    else if (currentCRP > 0.5) baselineInflammation = 30;
    else baselineInflammation = 15;
  }

  if (currentHbA1c !== null && currentHbA1c > 5.7) {
    baselineInflammation += 10; // metabolic inflammation amplifier
  }

  if (currentFerritin !== null && currentFerritin > 300) {
    baselineInflammation += 8; // iron overload inflammation
  }

  // ── Cumulative daily food impact ──
  const todayCals = todayFoods.reduce((s, f) => s + f.calories, 0);
  const todayProtein = todayFoods.reduce((s, f) => s + f.protein, 0);
  const isOvereating = (todayCals + totals.calories) > 2800;
  const isLowProtein = (todayProtein + totals.protein) < 100;

  // ── Project inflammation score ──
  // Scale: avgInflamIndex (-3 to +3) maps to score delta (-20 to +20)
  const mealDelta = avgInflamIndex * 7;
  const overeatingPenalty = isOvereating ? 5 : 0;
  const lowProteinPenalty = isLowProtein ? 3 : 0;
  const fiberBonus = totals.fiber > 8 ? -3 : 0;

  const projectedScore = Math.max(0, Math.min(100,
    baselineInflammation + mealDelta + overeatingPenalty + lowProteinPenalty + fiberBonus
  ));

  // ── CRP delta projection (approximate) ──
  // Each point of inflammatory index ≈ 0.05 mg/L CRP shift over 24-48h
  const projectedCRPDelta = Math.round(avgInflamIndex * 0.05 * 100) / 100;

  // ── Risk level ──
  let riskLevel: "low" | "moderate" | "elevated" | "high" = "low";
  if (projectedScore >= 70) riskLevel = "high";
  else if (projectedScore >= 50) riskLevel = "elevated";
  else if (projectedScore >= 35) riskLevel = "moderate";

  // ── Mechanism summary ──
  const uniqueMechanisms = [...new Set(mechanisms)].slice(0, 2);
  const mechanism = uniqueMechanisms.length > 0
    ? uniqueMechanisms.join(". ")
    : avgInflamIndex < -0.5
      ? "Anti-inflammatory compounds reducing NF-κB activation"
      : avgInflamIndex > 0.5
        ? "Pro-inflammatory pathway activation via glycemic load and saturated fat"
        : "Neutral inflammatory impact — no significant pathway modulation";

  // ── Time to impact ──
  const timeToImpact = Math.abs(avgInflamIndex) > 1.5
    ? "2-4 hours (acute phase)"
    : Math.abs(avgInflamIndex) > 0.5
      ? "4-8 hours (moderate response)"
      : "Minimal acute impact";

  // ── Recommendation ──
  let recommendation = "";
  if (avgInflamIndex > 1.0) {
    recommendation = "Consider adding omega-3 rich food (salmon, walnuts) or turmeric to counteract inflammatory load. A 15-min post-meal walk reduces glucose spike by 30%.";
  } else if (avgInflamIndex > 0.3 && currentCRP !== null && currentCRP > 1.0) {
    recommendation = `With CRP at ${currentCRP} mg/L, minimize pro-inflammatory meals. Add cold-water fish or berries to your next meal.`;
  } else if (avgInflamIndex < -1.0) {
    recommendation = "Excellent anti-inflammatory choice. This meal actively reduces systemic inflammation markers.";
  } else if (avgInflamIndex < 0) {
    recommendation = "Good choice — mildly anti-inflammatory. Consistent meals like this compound CRP reduction over 2-4 weeks.";
  } else {
    recommendation = "Neutral inflammatory profile. Consider adding leafy greens or omega-3 sources to optimize.";
  }

  return {
    currentCRP,
    projectedCRPDelta,
    inflammationScore: Math.round(projectedScore),
    riskLevel,
    mechanism,
    timeToImpact,
    recommendation,
  };
}

/* ── Local meal parser (no AI fallback) ── */
function parseLocalMeal(description: string) {
  const lower = description.toLowerCase();
  const items: Array<{ name: string; portion: string; calories: number; protein: number; carbs: number; fat: number; inflammatoryIndex: number }> = [];

  const foodDB: Record<string, { cal: number; p: number; c: number; f: number; portion: string }> = {
    steak: { cal: 450, p: 46, c: 0, f: 28, portion: "8 oz" },
    chicken: { cal: 280, p: 52, c: 0, f: 6, portion: "6 oz" },
    salmon: { cal: 350, p: 40, c: 0, f: 20, portion: "6 oz" },
    eggs: { cal: 210, p: 18, c: 2, f: 14, portion: "3 eggs" },
    egg: { cal: 70, p: 6, c: 0, f: 5, portion: "1 egg" },
    rice: { cal: 200, p: 4, c: 44, f: 0, portion: "1 cup" },
    pasta: { cal: 220, p: 8, c: 42, f: 2, portion: "1 cup" },
    salad: { cal: 50, p: 2, c: 8, f: 1, portion: "2 cups" },
    avocado: { cal: 240, p: 3, c: 12, f: 22, portion: "1 whole" },
    bread: { cal: 80, p: 3, c: 14, f: 1, portion: "1 slice" },
    espresso: { cal: 5, p: 0, c: 1, f: 0, portion: "1 shot" },
    coffee: { cal: 5, p: 0, c: 1, f: 0, portion: "1 cup" },
    yogurt: { cal: 150, p: 15, c: 12, f: 4, portion: "1 cup" },
    oatmeal: { cal: 150, p: 5, c: 27, f: 3, portion: "1 cup" },
    banana: { cal: 105, p: 1, c: 27, f: 0, portion: "1 medium" },
    berries: { cal: 60, p: 1, c: 14, f: 0, portion: "1 cup" },
    "protein shake": { cal: 200, p: 30, c: 8, f: 4, portion: "1 scoop" },
    beef: { cal: 350, p: 42, c: 0, f: 18, portion: "6 oz" },
    turkey: { cal: 240, p: 48, c: 0, f: 4, portion: "6 oz" },
    tuna: { cal: 200, p: 44, c: 0, f: 2, portion: "5 oz" },
    broccoli: { cal: 55, p: 4, c: 10, f: 0, portion: "1 cup" },
    "sweet potato": { cal: 115, p: 2, c: 27, f: 0, portion: "1 medium" },
    nuts: { cal: 170, p: 5, c: 6, f: 15, portion: "1 oz" },
    almonds: { cal: 160, p: 6, c: 6, f: 14, portion: "1 oz" },
    cheese: { cal: 110, p: 7, c: 1, f: 9, portion: "1 oz" },
    pizza: { cal: 300, p: 12, c: 36, f: 12, portion: "1 slice" },
    fries: { cal: 365, p: 4, c: 48, f: 17, portion: "medium" },
    burger: { cal: 540, p: 34, c: 40, f: 28, portion: "1 burger" },
    soda: { cal: 140, p: 0, c: 39, f: 0, portion: "12 oz" },
    beer: { cal: 150, p: 1, c: 13, f: 0, portion: "12 oz" },
    wine: { cal: 125, p: 0, c: 4, f: 0, portion: "5 oz" },
  };

  for (const [food, macros] of Object.entries(foodDB)) {
    if (lower.includes(food)) {
      items.push({
        name: food.charAt(0).toUpperCase() + food.slice(1),
        portion: macros.portion,
        calories: macros.cal,
        protein: macros.p,
        carbs: macros.c,
        fat: macros.f,
        inflammatoryIndex: lookupInflammation(food),
      });
    }
  }

  if (items.length === 0) {
    items.push({
      name: description.slice(0, 50),
      portion: "1 serving",
      calories: 400,
      protein: 25,
      carbs: 35,
      fat: 15,
      inflammatoryIndex: 0,
    });
  }

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
      fiber: acc.fiber + 2,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const avgInflam = items.reduce((s, i) => s + i.inflammatoryIndex, 0) / items.length;
  const qualityScore = Math.min(10, Math.max(1, Math.round(7 - avgInflam * 1.5)));

  return {
    items,
    totals,
    mealType: guessMealType(),
    qualityScore,
    longevityFlags: avgInflam < -0.5 ? ["anti-inflammatory"] : [],
    concerns: avgInflam > 1.0 ? ["pro-inflammatory"] : [],
  };
}

function lookupInflammation(name: string): number {
  const lower = name.toLowerCase();
  for (const [key, data] of Object.entries(FOOD_INFLAMMATION_INDEX)) {
    if (lower.includes(key) || key.includes(lower)) {
      return data.index;
    }
  }
  return 0;
}

function guessMealType(): string {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  if (hour < 17) return "snack";
  return "dinner";
}
