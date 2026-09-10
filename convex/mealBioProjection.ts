import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   MEAL BIO-PROJECTION ENGINE
   
   Takes a parsed GhostLog meal result + the user's BioVault
   biomarkers and computes a 24-hour biological age shift.
   
   Pipeline:
   1. Pull current BioVault (CRP, HbA1c, ferritin, testosterone, VitD)
   2. Pull current Vive Age baseline from bioTrajectory
   3. Compute meal's inflammatory load against personal biomarkers
   4. Project 24-hour CRP trajectory (hourly resolution)
   5. Translate CRP shift → Bio-Age delta using the same weights
      as bioAgeAlgorithm.ts
   6. Return hourly projection data for TrajectoryCanvas overlay
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker age-impact weights (mirroring bioAgeAlgorithm.ts) ── */
const MARKER_AGE_IMPACT: Record<string, number> = {
  crp: 4,
  hba1c: 5,
  vitaminD: 3,
  testosteroneTotal: 2,
  ferritin: 2,
};

/* ── Food category → CRP amplification factors ──
   How much a food category amplifies or attenuates CRP
   based on the user's existing inflammatory state */
const CRP_AMPLIFIERS: Record<string, number> = {
  // Anti-inflammatory foods reduce CRP faster when baseline is high
  salmon: -0.12,
  "fatty fish": -0.12,
  blueberries: -0.08,
  berries: -0.07,
  turmeric: -0.15,
  "olive oil": -0.08,
  spinach: -0.05,
  broccoli: -0.06,
  avocado: -0.05,
  "green tea": -0.06,
  walnuts: -0.06,
  ginger: -0.08,
  garlic: -0.05,
  eggs: -0.02,
  oatmeal: -0.03,
  yogurt: -0.03,
  coffee: -0.03,
  espresso: -0.03,
  "black coffee": -0.04,
  // Neutral
  chicken: 0.0,
  turkey: 0.0,
  rice: 0.02,
  quinoa: -0.01,
  // Pro-inflammatory foods spike CRP, worse when baseline is already high
  steak: 0.04,
  beef: 0.04,
  bread: 0.06,
  pasta: 0.05,
  sugar: 0.15,
  soda: 0.15,
  fries: 0.12,
  pizza: 0.10,
  bacon: 0.10,
  "processed meat": 0.14,
  alcohol: 0.08,
  beer: 0.08,
  candy: 0.15,
  donut: 0.15,
  "ice cream": 0.10,
  cheese: 0.03,
  potato: 0.03,
  pork: 0.03,
  wine: 0.02,
};

/* ── Glucose spike → Bio-Age transient impact ──
   High glycemic meals cause a transient bio-age spike via:
   - Insulin resistance pathway (HbA1c proxy)
   - AGE formation (advanced glycation end-products)
   - Oxidative stress cascade */
function glucoseBioAgeImpact(glycemicLoad: number, hba1c: number | null): number {
  const baseImpact = glycemicLoad <= 10 ? 0 : glycemicLoad <= 19 ? 0.05 : 0.12;
  // Amplify if HbA1c is already elevated (insulin resistance)
  const hba1cMultiplier = hba1c && hba1c > 5.7 ? 1.5 : hba1c && hba1c > 5.4 ? 1.2 : 1.0;
  return baseImpact * hba1cMultiplier;
}

/* ── CRP pharmacokinetics model ──
   Models the 24-hour CRP response curve to a meal:
   - Pro-inflammatory: peaks at 4-6h, returns to baseline by 18-24h
   - Anti-inflammatory: gradual reduction, nadir at 8-12h */
function crpResponseCurve(hour: number, peakDelta: number): number {
  if (peakDelta >= 0) {
    // Pro-inflammatory: bell curve peaking at hour 5
    const peak = 5;
    const sigma = 3.5;
    return peakDelta * Math.exp(-0.5 * Math.pow((hour - peak) / sigma, 2));
  } else {
    // Anti-inflammatory: gradual reduction, nadir at hour 10
    const nadir = 10;
    const sigma = 5;
    return peakDelta * Math.exp(-0.5 * Math.pow((hour - nadir) / sigma, 2));
  }
}

/* ═══════════════════════════════════════════════════════════════
   ACTION: projectMealBioImpact
   
   Called after GhostLog parses a meal. Returns a 24-hour
   hourly projection of how the meal shifts biological age.
   ═══════════════════════════════════════════════════════════════ */
export const projectMealBioImpact = action({
  args: {
    sessionId: v.string(),
    items: v.array(v.object({
      name: v.string(),
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
    inflammationScore: v.number(),
    projectedCRPDelta: v.number(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    currentBioAge: number;
    chronoAge: number;
    currentCRP: number | null;
    currentHbA1c: number | null;
    peakBioAgeDelta: number;
    peakHour: number;
    recoveryHour: number;
    hourlyProjection: Array<{
      hour: number;
      bioAgeDelta: number;
      crpDelta: number;
      glucoseImpact: number;
      cumulativeDelta: number;
    }>;
    inflammationSpike: {
      magnitude: number;
      peakCRP: number;
      mechanism: string;
      severity: "minimal" | "mild" | "moderate" | "significant" | "severe";
    };
    bioAgeShift: {
      immediate: number;
      peak: number;
      at24h: number;
      netEffect: string;
    };
    personalizedInsight: string;
  }> => {
    /* ── 1. Pull BioVault ── */
    let bioVault: any = null;
    try {
      bioVault = await ctx.runQuery(
        ("queries:getBioVaultBySession" as any),
        { sessionId: args.sessionId }
      );
    } catch { /* continue */ }

    /* ── 2. Pull current trajectory for baseline bio-age ── */
    let trajectoryData: any = null;
    try {
      trajectoryData = await ctx.runQuery(
        ("bioTrajectory:get90DayTrajectory" as any),
        { sessionId: args.sessionId }
      );
    } catch { /* continue */ }

    const currentBioAge = trajectoryData?.currentBioAge ?? 35;
    const chronoAge = trajectoryData?.chronologicalAge ?? 35;
    const currentCRP: number | null = bioVault?.crp ?? null;
    const currentHbA1c: number | null = bioVault?.hba1c ?? null;
    const currentFerritin: number | null = bioVault?.ferritin ?? null;
    const currentVitD: number | null = bioVault?.vitaminD ?? null;

    /* ── 3. Compute meal's CRP impact using personal biomarkers ── */
    let mealCRPDelta = 0;
    const mechanisms: string[] = [];

    for (const item of args.items) {
      const lower = item.name.toLowerCase();
      let itemCRPFactor = 0;

      // Look up CRP amplification factor
      for (const [food, factor] of Object.entries(CRP_AMPLIFIERS)) {
        if (lower.includes(food) || food.includes(lower)) {
          itemCRPFactor = factor;
          break;
        }
      }

      // If no match, estimate from inflammatory index
      if (itemCRPFactor === 0) {
        itemCRPFactor = item.inflammatoryIndex * 0.03;
      }

      // Weight by caloric contribution
      const calorieWeight = Math.max(0.5, item.calories / 300);
      mealCRPDelta += itemCRPFactor * calorieWeight;
    }

    // Amplify CRP response if baseline is already elevated
    if (currentCRP !== null && currentCRP > 1.5 && mealCRPDelta > 0) {
      const amplification = 1 + (currentCRP - 1.0) * 0.3;
      mealCRPDelta *= amplification;
      mechanisms.push(`Elevated baseline CRP (${currentCRP.toFixed(1)} mg/L) amplifies inflammatory response by ${Math.round((amplification - 1) * 100)}%`);
    }

    // Ferritin interaction: high ferritin + pro-inflammatory meal = worse
    if (currentFerritin !== null && currentFerritin > 200 && mealCRPDelta > 0) {
      mealCRPDelta *= 1.15;
      mechanisms.push(`Elevated ferritin (${currentFerritin} ng/mL) potentiates iron-mediated oxidative stress`);
    }

    // Anti-inflammatory meals more effective when CRP is high
    if (currentCRP !== null && currentCRP > 2.0 && mealCRPDelta < 0) {
      mealCRPDelta *= 1.3;
      mechanisms.push(`Anti-inflammatory compounds more effective against elevated CRP baseline`);
    }

    /* ── 4. Compute glycemic impact on bio-age ── */
    const netCarbs = Math.max(0, args.totals.carbs - args.totals.fiber);
    const estimatedGI = args.items.some(i => {
      const l = i.name.toLowerCase();
      return ['bread', 'rice', 'pasta', 'potato', 'sugar', 'soda', 'candy', 'fries', 'pizza'].some(f => l.includes(f));
    }) ? 70 : args.items.some(i => {
      const l = i.name.toLowerCase();
      return ['eggs', 'steak', 'chicken', 'salmon', 'avocado', 'nuts'].some(f => l.includes(f));
    }) ? 30 : 50;
    const glycemicLoad = Math.round((estimatedGI * netCarbs) / 100);
    const glucoseBioAge = glucoseBioAgeImpact(glycemicLoad, currentHbA1c);

    /* ── 5. Generate 24-hour hourly projection ── */
    const hourlyProjection: Array<{
      hour: number;
      bioAgeDelta: number;
      crpDelta: number;
      glucoseImpact: number;
      cumulativeDelta: number;
    }> = [];

    let peakBioAgeDelta = 0;
    let peakHour = 0;
    let recoveryHour = 24;

    for (let h = 0; h <= 24; h++) {
      // CRP response curve
      const crpDelta = crpResponseCurve(h, mealCRPDelta);

      // Glucose impact: peaks at 1-2h, gone by 4-6h
      const glucoseImpact = h <= 6
        ? glucoseBioAge * Math.exp(-0.5 * Math.pow((h - 1.5) / 1.5, 2))
        : 0;

      // Protein synthesis benefit: gradual, peaks at 3-6h
      const proteinBenefit = args.totals.protein > 30
        ? -0.02 * Math.exp(-0.5 * Math.pow((h - 4) / 3, 2))
        : 0;

      // Fiber benefit: slow, sustained anti-inflammatory
      const fiberBenefit = args.totals.fiber > 5
        ? -0.01 * (1 - Math.exp(-h / 6))
        : 0;

      // CRP → Bio-Age translation
      // Each 0.1 mg/L CRP shift ≈ 0.04 years bio-age shift
      // (derived from MARKER_AGE_IMPACT.crp = 4 years for full range)
      const crpBioAgeDelta = crpDelta * 0.4;

      const totalDelta = crpBioAgeDelta + glucoseImpact + proteinBenefit + fiberBenefit;

      hourlyProjection.push({
        hour: h,
        bioAgeDelta: +totalDelta.toFixed(3),
        crpDelta: +crpDelta.toFixed(4),
        glucoseImpact: +glucoseImpact.toFixed(3),
        cumulativeDelta: +(totalDelta).toFixed(3),
      });

      if (Math.abs(totalDelta) > Math.abs(peakBioAgeDelta)) {
        peakBioAgeDelta = totalDelta;
        peakHour = h;
      }

      // Find recovery hour (when delta returns to <10% of peak)
      if (h > peakHour && Math.abs(totalDelta) < Math.abs(peakBioAgeDelta) * 0.1) {
        if (recoveryHour === 24) recoveryHour = h;
      }
    }

    /* ── 6. Inflammation spike classification ── */
    const peakCRP = (currentCRP ?? 0.5) + mealCRPDelta;
    const spikeMagnitude = Math.abs(mealCRPDelta);
    let severity: "minimal" | "mild" | "moderate" | "significant" | "severe" = "minimal";
    if (spikeMagnitude > 0.3) severity = "severe";
    else if (spikeMagnitude > 0.2) severity = "significant";
    else if (spikeMagnitude > 0.1) severity = "moderate";
    else if (spikeMagnitude > 0.05) severity = "mild";

    const spikeMechanism = mechanisms.length > 0
      ? mechanisms[0]
      : mealCRPDelta > 0
        ? "Pro-inflammatory pathway activation via NF-κB and COX-2 upregulation"
        : mealCRPDelta < -0.03
          ? "Anti-inflammatory cascade via omega-3 mediated prostaglandin modulation"
          : "Neutral inflammatory profile — no significant pathway modulation";

    /* ── 7. Bio-age shift summary ── */
    const immediateDelta = hourlyProjection[1]?.cumulativeDelta ?? 0;
    const at24h = hourlyProjection[24]?.cumulativeDelta ?? 0;
    const netEffect = peakBioAgeDelta > 0.05
      ? `+${peakBioAgeDelta.toFixed(2)}y transient aging spike at ${peakHour}h, recovering by ${recoveryHour}h`
      : peakBioAgeDelta < -0.03
        ? `${peakBioAgeDelta.toFixed(2)}y biological age reduction, sustained through ${recoveryHour}h`
        : "Negligible biological age impact — neutral meal profile";

    /* ── 8. Personalized insight using biomarker context ── */
    let personalizedInsight = "";
    if (currentCRP !== null && currentCRP > 2.0 && mealCRPDelta > 0) {
      personalizedInsight = `⚠️ With your hs-CRP at ${currentCRP.toFixed(1)} mg/L, this meal projects a ${(mealCRPDelta * 100).toFixed(0)}% amplified inflammatory response. Your bio-age will transiently spike +${peakBioAgeDelta.toFixed(2)} years at hour ${peakHour}. Consider omega-3 supplementation or a 15-min post-meal walk to blunt the response.`;
    } else if (currentCRP !== null && currentCRP > 1.0 && mealCRPDelta < 0) {
      personalizedInsight = `✅ Excellent choice given your CRP at ${currentCRP.toFixed(1)} mg/L. This meal actively reduces inflammation — projected ${Math.abs(peakBioAgeDelta).toFixed(2)} year bio-age improvement peaking at hour ${peakHour}. Consistent anti-inflammatory meals like this can reduce CRP by 20-30% over 4 weeks.`;
    } else if (currentHbA1c !== null && currentHbA1c > 5.7 && glycemicLoad > 15) {
      personalizedInsight = `⚠️ With HbA1c at ${currentHbA1c}%, this meal's glycemic load of ${glycemicLoad} will cause a significant glucose spike. Your insulin resistance amplifies the bio-age impact by ${Math.round((glucoseBioAge / 0.05 - 1) * 100)}%. A 15-min walk within 30 minutes of eating reduces the spike by 30%.`;
    } else if (mealCRPDelta < -0.05) {
      personalizedInsight = `✅ Strong anti-inflammatory profile. ${currentCRP !== null ? `Your CRP baseline of ${currentCRP.toFixed(1)} mg/L will benefit from ` : ""}This meal's compounds actively suppress NF-κB pathway activation, projecting a ${Math.abs(peakBioAgeDelta).toFixed(2)} year bio-age reduction over ${recoveryHour} hours.`;
    } else if (Math.abs(peakBioAgeDelta) < 0.02) {
      personalizedInsight = `Neutral bio-age impact. This meal neither accelerates nor reverses biological aging. ${currentCRP !== null && currentCRP > 1.0 ? `With your CRP at ${currentCRP.toFixed(1)} mg/L, consider adding omega-3 rich foods to actively reduce inflammation.` : "Add leafy greens or fatty fish to shift toward anti-inflammatory."}`;
    } else {
      personalizedInsight = `This meal projects a ${peakBioAgeDelta > 0 ? "+" : ""}${peakBioAgeDelta.toFixed(2)} year bio-age shift peaking at hour ${peakHour}. ${peakBioAgeDelta > 0 ? "The inflammatory load will resolve within " + recoveryHour + " hours." : "The anti-inflammatory benefit sustains through " + recoveryHour + " hours."}`;
    }

    return {
      success: true,
      currentBioAge,
      chronoAge,
      currentCRP,
      currentHbA1c,
      peakBioAgeDelta: +peakBioAgeDelta.toFixed(3),
      peakHour,
      recoveryHour,
      hourlyProjection,
      inflammationSpike: {
        magnitude: +spikeMagnitude.toFixed(4),
        peakCRP: +peakCRP.toFixed(2),
        mechanism: spikeMechanism,
        severity,
      },
      bioAgeShift: {
        immediate: +immediateDelta.toFixed(3),
        peak: +peakBioAgeDelta.toFixed(3),
        at24h: +at24h.toFixed(3),
        netEffect,
      },
      personalizedInsight,
    };
  },
});
