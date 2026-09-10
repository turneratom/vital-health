import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIOLOGICAL TWIN ENGINE — Lifetime Trajectory Projection
   
   Computes two divergent aging curves projected across decades:
   
   1. CHRONOLOGICAL LINE — Standard aging trajectory based on
      population averages for the user's demographic. This is
      the "do nothing" baseline: ~1 biological year per calendar year,
      with accelerating decline after age 50.
   
   2. OPTIMIZED LINE — The Vive Protocol trajectory based on the
      user's actual sleep, HRV, biomarkers, adherence, and supplement
      consistency. Projects how their biological age will diverge
      from chronological age over time.
   
   The gap between these two lines at projected lifespan end
   = "Projected Longevity Extension" (e.g., +4.2 years).
   
   Also returns:
   - Consistency multiplier (how adherence compounds over time)
   - Key inflection points where the curves diverge most
   - Pillar breakdown showing which behaviors drive the most gain
   ═══════════════════════════════════════════════════════════════ */

/* ── Population aging rates by decade ── */
const STANDARD_AGING_RATE: Record<number, number> = {
  20: 1.00,  // 1:1 bio to chrono
  30: 1.02,  // slight acceleration
  40: 1.05,
  50: 1.10,
  60: 1.18,
  70: 1.28,
  80: 1.42,
  90: 1.60,
};

function getStandardRate(age: number): number {
  const decades = Object.keys(STANDARD_AGING_RATE).map(Number).sort((a, b) => a - b);
  for (let i = decades.length - 1; i >= 0; i--) {
    if (age >= decades[i]) return STANDARD_AGING_RATE[decades[i]];
  }
  return 1.0;
}

/* ── Optimized aging rate based on pillar scores ── */
function computeOptimizedRate(pillars: {
  sleepScore: number;      // 0-100
  hrvScore: number;        // 0-100
  adherenceScore: number;  // 0-100
  biomarkerScore: number;  // 0-100
  nutritionScore: number;  // 0-100
}, age: number): number {
  // Weighted composite: how much slower you age vs standard
  const weights = { sleep: 0.25, hrv: 0.20, adherence: 0.20, biomarkers: 0.25, nutrition: 0.10 };
  const composite = (
    pillars.sleepScore * weights.sleep +
    pillars.hrvScore * weights.hrv +
    pillars.adherenceScore * weights.adherence +
    pillars.biomarkerScore * weights.biomarkers +
    pillars.nutritionScore * weights.nutrition
  ) / 100;

  // composite 0-1 maps to aging rate multiplier
  // 1.0 composite (perfect) → 0.75x aging rate (aging 25% slower)
  // 0.5 composite (average) → 0.95x aging rate
  // 0.0 composite (poor)    → 1.05x aging rate (slightly worse than standard)
  const baseRate = getStandardRate(age);
  const optimizationFactor = 0.75 + (1 - composite) * 0.30;
  return baseRate * optimizationFactor;
}

/* ── Biomarker scoring ── */
const MARKER_OPTIMAL: Record<string, { low: number; high: number; lowerBetter: boolean }> = {
  crp:               { low: 0,   high: 1.0,  lowerBetter: true },
  hba1c:             { low: 4.0, high: 5.4,  lowerBetter: true },
  vitaminD:          { low: 40,  high: 60,   lowerBetter: false },
  testosteroneTotal: { low: 500, high: 900,  lowerBetter: false },
  ferritin:          { low: 40,  high: 150,  lowerBetter: false },
};

function scoreMarker(value: number | null | undefined, key: string): number {
  if (value == null || value <= 0) return 50; // neutral if unknown
  const range = MARKER_OPTIMAL[key];
  if (!range) return 50;
  const { low, high, lowerBetter } = range;
  if (lowerBetter) {
    if (value <= high * 0.5) return 95;
    if (value <= high) return 70 + 25 * (1 - value / high);
    if (value <= high * 2) return 40 + 30 * (1 - (value - high) / high);
    return 20;
  }
  if (value >= low && value <= high) {
    const mid = (low + high) / 2;
    return 75 + 25 * (1 - Math.abs(value - mid) / ((high - low) / 2));
  }
  if (value < low) return Math.max(20, 60 * (value / low));
  return Math.max(30, 70 - 40 * ((value - high) / high));
}

/* ═══════════════════════════════════════════════════════════════
   QUERY: getBiologicalTwin
   Returns lifetime projection data for the Biological Twin chart
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   QUERY: getWhatIfProjection
   Simulates 7 days of a given adherence % and returns shifted
   trajectory, glow intensity, and structural integrity metrics.
   ═══════════════════════════════════════════════════════════════ */
export const getWhatIfProjection = query({
  args: {
    sessionId: v.string(),
    adherencePercent: v.number(), // 0-100
  },
  handler: async (ctx, { sessionId, adherencePercent }) => {
    const now = Date.now();
    const day7 = now - 7 * 86400000;

    // 1. Chronological age
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();
    const chronoAge = vitals?.age ?? 35;
    const gender = vitals?.gender ?? "male";

    // 2. BioVault
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    // 3. Current pillar scores (same logic as main query)
    let sleepScore = 65;
    try {
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = sleepLogs.filter(s => s.loggedAt >= day7);
      if (recent.length > 0) sleepScore = recent.reduce((s, l) => s + l.sleepScore, 0) / recent.length;
      else if (vault?.sleepScore) sleepScore = vault.sleepScore;
    } catch { /* ok */ }

    let hrvScore = 50;
    if (vault?.hrvCurrent) {
      const expected = Math.max(20, 65 - (chronoAge - 20) * 0.8);
      hrvScore = Math.max(0, Math.min(100, 50 + ((vault.hrvCurrent - expected) / expected) * 100));
    }

    const crpScore = scoreMarker(vault?.crp, "crp");
    const hba1cScore = scoreMarker(vault?.hba1c, "hba1c");
    const vitDScore = scoreMarker(vault?.vitaminD, "vitaminD");
    const testScore = scoreMarker(vault?.testosteroneTotal, "testosteroneTotal");
    const ferrScore = scoreMarker(vault?.ferritin, "ferritin");
    const biomarkerScore = (crpScore + hba1cScore + vitDScore + testScore + ferrScore) / 5;

    let nutritionScore = 55;
    try {
      const foodLogs = await ctx.db
        .query("foodLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = foodLogs.filter(f => f.loggedAt >= day7);
      if (recent.length > 0) {
        const scores = recent.map(f => {
          if (f.longevityScore != null && f.longevityScore > 0) return f.longevityScore;
          const proteinRatio = f.protein / Math.max(1, f.calories / 4);
          return Math.min(100, 40 + proteinRatio * 60);
        });
        nutritionScore = scores.reduce((s, v) => s + v, 0) / scores.length;
      }
    } catch { /* ok */ }

    // 4. Simulate the what-if: blend current adherence toward target over 7 days
    const simAdherence = Math.max(0, Math.min(100, adherencePercent));
    // Adherence affects sleep quality, HRV recovery, and nutrition compliance
    const adherenceRatio = simAdherence / 100;
    const simSleep = sleepScore * 0.4 + (adherenceRatio >= 0.8 ? 85 : adherenceRatio >= 0.5 ? 70 : 55) * 0.6;
    const simHrv = hrvScore * 0.5 + (adherenceRatio >= 0.8 ? 80 : adherenceRatio >= 0.5 ? 60 : 40) * 0.5;
    const simNutrition = nutritionScore * 0.4 + (adherenceRatio >= 0.8 ? 80 : adherenceRatio >= 0.5 ? 65 : 45) * 0.6;

    const simPillars = {
      sleepScore: Math.round(simSleep),
      hrvScore: Math.round(simHrv),
      adherenceScore: Math.round(simAdherence),
      biomarkerScore: Math.round(biomarkerScore), // biomarkers don't change in 7 days
      nutritionScore: Math.round(simNutrition),
    };

    // 5. Project both curves (30 years for what-if view)
    const projectionYears = 30;
    const chronologicalLine: Array<{ year: number; chronoAge: number; bioAge: number }> = [];
    const whatIfLine: Array<{ year: number; chronoAge: number; bioAge: number }> = [];

    const hrvAdj = simHrv > 50 ? -(simHrv - 50) / 25 : (50 - simHrv) / 25;
    const bioAdj = biomarkerScore > 50 ? -(biomarkerScore - 50) / 25 : (50 - biomarkerScore) / 25;
    const slpAdj = simSleep >= 80 ? -1.5 : simSleep >= 70 ? -0.5 : simSleep >= 60 ? 0.5 : 1.5;
    const adhAdj = simAdherence >= 85 ? -1.0 : simAdherence >= 70 ? -0.3 : 0.5;
    const simBioAge = chronoAge + hrvAdj + bioAdj + slpAdj + adhAdj;

    let standardBioAge = chronoAge;
    let whatIfBioAge = simBioAge;
    const consistencyMult = Math.pow(simAdherence / 100, 0.3);

    for (let y = 0; y <= projectionYears; y++) {
      const futureAge = chronoAge + y;
      chronologicalLine.push({ year: y, chronoAge: futureAge, bioAge: +standardBioAge.toFixed(2) });
      whatIfLine.push({ year: y, chronoAge: futureAge, bioAge: +whatIfBioAge.toFixed(2) });
      standardBioAge += getStandardRate(futureAge);
      const optRate = computeOptimizedRate(simPillars, futureAge);
      const compoundBonus = Math.min(0.05, y * 0.0008 * consistencyMult);
      whatIfBioAge += Math.max(0.65, optRate - compoundBonus);
    }

    // 6. Longevity extension for this scenario
    const baseLifespan = gender === "female" ? 81 : 76;
    const lifespanYear = baseLifespan - chronoAge;
    let longevityExtension = 0;
    if (lifespanYear > 0 && lifespanYear < chronologicalLine.length) {
      const targetBioAge = chronologicalLine[lifespanYear]?.bioAge ?? 0;
      const crossPoint = whatIfLine.find(p => p.bioAge >= targetBioAge);
      if (crossPoint) longevityExtension = crossPoint.chronoAge - baseLifespan;
      else longevityExtension = Math.min(15, projectionYears * 0.15);
    }
    longevityExtension = Math.max(0.2, Math.min(12, longevityExtension));

    // 7. Glow & Structural Integrity metrics
    // Glow intensity: 0-1 based on how much the what-if improves over standard
    const gapAt10 = chronologicalLine[10] && whatIfLine[10]
      ? chronologicalLine[10].bioAge - whatIfLine[10].bioAge : 0;
    const glowIntensity = Math.max(0, Math.min(1, gapAt10 / 8));

    // Structural integrity: composite of all pillar scores
    const compositeScore = (
      simPillars.sleepScore * 0.25 +
      simPillars.hrvScore * 0.20 +
      simPillars.adherenceScore * 0.20 +
      simPillars.biomarkerScore * 0.25 +
      simPillars.nutritionScore * 0.10
    );
    const structuralIntegrity = Math.round(compositeScore);

    // Integrity label
    const integrityLabel = structuralIntegrity >= 80 ? "Optimal"
      : structuralIntegrity >= 65 ? "Strong"
      : structuralIntegrity >= 50 ? "Moderate"
      : structuralIntegrity >= 35 ? "Degraded" : "Critical";

    const integrityColor = structuralIntegrity >= 80 ? "#00FFCC"
      : structuralIntegrity >= 65 ? "#00DC82"
      : structuralIntegrity >= 50 ? "#3B82F6"
      : structuralIntegrity >= 35 ? "#E8976C" : "#FF6B6B";

    return {
      chronoAge: chronoAge,
      simBioAge: +simBioAge.toFixed(1),
      simDelta: +(simBioAge - chronoAge).toFixed(1),
      longevityExtension: +longevityExtension.toFixed(1),
      chronologicalLine,
      whatIfLine,
      glowIntensity: +glowIntensity.toFixed(3),
      structuralIntegrity,
      integrityLabel,
      integrityColor,
      simPillars,
      consistencyMultiplier: +consistencyMult.toFixed(2),
    };
  },
});

export const getBiologicalTwin = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const now = Date.now();
    const day7 = now - 7 * 86400000;
    const day14 = now - 14 * 86400000;
    const day30 = now - 30 * 86400000;

    // 1. Chronological age
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();
    const chronoAge = vitals?.age ?? 35;
    const gender = vitals?.gender ?? "male";

    // 2. BioVault
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    // 3. Sleep score (7-day avg)
    let sleepScore = 65;
    try {
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = sleepLogs.filter(s => s.loggedAt >= day7);
      if (recent.length > 0) {
        sleepScore = recent.reduce((s, l) => s + l.sleepScore, 0) / recent.length;
      } else if (vault?.sleepScore) {
        sleepScore = vault.sleepScore;
      }
    } catch { /* ok */ }

    // 4. HRV score (normalized 0-100)
    let hrvScore = 50;
    try {
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", sessionId).gte("measuredAt", day7)
        )
        .collect();
      if (hrvReadings.length > 0) {
        const avgHrv = hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length;
        // Expected HRV by age
        const expected = Math.max(20, 65 - (chronoAge - 20) * 0.8);
        // Score: 100 if HRV is 50% above expected, 50 if at expected, 0 if 50% below
        hrvScore = Math.max(0, Math.min(100, 50 + ((avgHrv - expected) / expected) * 100));
      } else if (vault?.hrvCurrent) {
        const expected = Math.max(20, 65 - (chronoAge - 20) * 0.8);
        hrvScore = Math.max(0, Math.min(100, 50 + ((vault.hrvCurrent - expected) / expected) * 100));
      }
    } catch { /* ok */ }

    // 5. Adherence score (14-day avg)
    let adherenceScore = 60;
    try {
      const adherenceScores = await ctx.db
        .query("adherenceScores")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = adherenceScores.filter(a => a.updatedAt >= day14);
      if (recent.length > 0) {
        adherenceScore = recent.reduce((s, a) => s + a.adherencePercent, 0) / recent.length;
      }
    } catch { /* ok */ }

    // 6. Biomarker composite score
    const crpScore = scoreMarker(vault?.crp, "crp");
    const hba1cScore = scoreMarker(vault?.hba1c, "hba1c");
    const vitDScore = scoreMarker(vault?.vitaminD, "vitaminD");
    const testScore = scoreMarker(vault?.testosteroneTotal, "testosteroneTotal");
    const ferrScore = scoreMarker(vault?.ferritin, "ferritin");
    const biomarkerScore = (crpScore + hba1cScore + vitDScore + testScore + ferrScore) / 5;

    // 7. Nutrition score (from recent food logs)
    let nutritionScore = 55;
    try {
      const foodLogs = await ctx.db
        .query("foodLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = foodLogs.filter(f => f.loggedAt >= day7);
      if (recent.length > 0) {
        // Use longevityScore if available, else estimate from macros
        const scores = recent.map(f => {
          if (f.longevityScore != null && f.longevityScore > 0) return f.longevityScore;
          // Rough estimate: protein-rich, moderate cal = better
          const proteinRatio = f.protein / Math.max(1, f.calories / 4);
          return Math.min(100, 40 + proteinRatio * 60);
        });
        nutritionScore = scores.reduce((s, v) => s + v, 0) / scores.length;
      }
    } catch { /* ok */ }

    // 8. Pillar scores
    const pillars = {
      sleepScore: Math.round(sleepScore),
      hrvScore: Math.round(hrvScore),
      adherenceScore: Math.round(adherenceScore),
      biomarkerScore: Math.round(biomarkerScore),
      nutritionScore: Math.round(nutritionScore),
    };

    // 9. Project both curves across decades
    // Project from current age to age 100
    const projectionYears = 100 - chronoAge;
    const stepSize = 1; // 1 year per point

    const chronologicalLine: Array<{ year: number; chronoAge: number; bioAge: number }> = [];
    const optimizedLine: Array<{ year: number; chronoAge: number; bioAge: number }> = [];

    // Current biological age (from existing trajectory engine logic)
    const hrvAdj = hrvScore > 50 ? -(hrvScore - 50) / 25 : (50 - hrvScore) / 25;
    const biomarkerAdj = biomarkerScore > 50 ? -(biomarkerScore - 50) / 25 : (50 - biomarkerScore) / 25;
    const sleepAdj = sleepScore >= 80 ? -1.5 : sleepScore >= 70 ? -0.5 : sleepScore >= 60 ? 0.5 : 1.5;
    const adhAdj = adherenceScore >= 85 ? -1.0 : adherenceScore >= 70 ? -0.3 : 0.5;
    const currentBioAge = chronoAge + hrvAdj + biomarkerAdj + sleepAdj + adhAdj;

    let standardBioAge = chronoAge; // starts at chrono age
    let optimizedBioAge = currentBioAge; // starts at current bio age

    // Consistency compounding: adherence compounds benefits over time
    const consistencyMultiplier = Math.pow(adherenceScore / 100, 0.3); // 0.85 adherence → 0.95x

    for (let y = 0; y <= projectionYears; y++) {
      const futureChronoAge = chronoAge + y;

      chronologicalLine.push({
        year: y,
        chronoAge: futureChronoAge,
        bioAge: +standardBioAge.toFixed(2),
      });

      optimizedLine.push({
        year: y,
        chronoAge: futureChronoAge,
        bioAge: +optimizedBioAge.toFixed(2),
      });

      // Advance standard aging
      const stdRate = getStandardRate(futureChronoAge);
      standardBioAge += stdRate * stepSize;

      // Advance optimized aging with compounding benefits
      const optRate = computeOptimizedRate(pillars, futureChronoAge);
      // Consistency compounds: each year of adherence slightly improves future rate
      const compoundBonus = Math.min(0.05, y * 0.0008 * consistencyMultiplier);
      optimizedBioAge += Math.max(0.65, optRate - compoundBonus) * stepSize;
    }

    // 10. Calculate Projected Longevity Extension
    // Standard lifespan estimate by gender
    const baseLifespan = gender === "female" ? 81 : 76;
    // Find the biological age at standard lifespan
    const standardAtLifespan = chronologicalLine.find(p => p.chronoAge >= baseLifespan);
    const optimizedAtLifespan = optimizedLine.find(p => p.chronoAge >= baseLifespan);

    // The extension = how many more years until optimized bio-age reaches
    // the same biological age that standard reaches at base lifespan
    let longevityExtension = 0;
    if (standardAtLifespan && optimizedAtLifespan) {
      const targetBioAge = standardAtLifespan.bioAge;
      // Find when optimized line reaches this bio age
      const crossPoint = optimizedLine.find(p => p.bioAge >= targetBioAge);
      if (crossPoint) {
        longevityExtension = crossPoint.chronoAge - baseLifespan;
      } else {
        // Never reaches it within projection — cap at reasonable max
        longevityExtension = Math.min(15, projectionYears * 0.15);
      }
    }

    // Clamp to reasonable range
    longevityExtension = Math.max(0.5, Math.min(12, longevityExtension));

    // 11. Find key inflection points (where gap widens fastest)
    const inflectionPoints: Array<{
      year: number;
      chronoAge: number;
      gap: number;
      label: string;
    }> = [];

    let maxGapGrowth = 0;
    let maxGapYear = 0;
    for (let y = 1; y < chronologicalLine.length; y++) {
      const prevGap = chronologicalLine[y - 1].bioAge - optimizedLine[y - 1].bioAge;
      const currGap = chronologicalLine[y].bioAge - optimizedLine[y].bioAge;
      const growth = currGap - prevGap;
      if (growth > maxGapGrowth) {
        maxGapGrowth = growth;
        maxGapYear = y;
      }
    }

    // Add key decade markers
    [10, 20, 30, 40].forEach(y => {
      if (y < chronologicalLine.length) {
        const gap = chronologicalLine[y].bioAge - optimizedLine[y].bioAge;
        if (gap > 0.5) {
          inflectionPoints.push({
            year: y,
            chronoAge: chronoAge + y,
            gap: +gap.toFixed(1),
            label: `${gap.toFixed(1)} yr gap at age ${chronoAge + y}`,
          });
        }
      }
    });

    // 12. Pillar impact breakdown (which behaviors drive the most gain)
    const totalAdj = Math.abs(hrvAdj) + Math.abs(biomarkerAdj) + Math.abs(sleepAdj) + Math.abs(adhAdj);
    const pillarImpact = [
      {
        key: "sleep",
        label: "Sleep Architecture",
        icon: "🌙",
        score: pillars.sleepScore,
        impact: totalAdj > 0 ? Math.abs(sleepAdj) / totalAdj : 0.25,
        yearsGained: +(longevityExtension * (totalAdj > 0 ? Math.abs(sleepAdj) / totalAdj : 0.25)).toFixed(1),
        status: pillars.sleepScore >= 80 ? "optimal" as const : pillars.sleepScore >= 65 ? "moderate" as const : "needs-work" as const,
      },
      {
        key: "hrv",
        label: "Autonomic Resilience",
        icon: "💓",
        score: pillars.hrvScore,
        impact: totalAdj > 0 ? Math.abs(hrvAdj) / totalAdj : 0.20,
        yearsGained: +(longevityExtension * (totalAdj > 0 ? Math.abs(hrvAdj) / totalAdj : 0.20)).toFixed(1),
        status: pillars.hrvScore >= 70 ? "optimal" as const : pillars.hrvScore >= 50 ? "moderate" as const : "needs-work" as const,
      },
      {
        key: "biomarkers",
        label: "Blood Chemistry",
        icon: "🧬",
        score: pillars.biomarkerScore,
        impact: totalAdj > 0 ? Math.abs(biomarkerAdj) / totalAdj : 0.25,
        yearsGained: +(longevityExtension * (totalAdj > 0 ? Math.abs(biomarkerAdj) / totalAdj : 0.25)).toFixed(1),
        status: pillars.biomarkerScore >= 75 ? "optimal" as const : pillars.biomarkerScore >= 55 ? "moderate" as const : "needs-work" as const,
      },
      {
        key: "adherence",
        label: "Protocol Consistency",
        icon: "📋",
        score: pillars.adherenceScore,
        impact: totalAdj > 0 ? Math.abs(adhAdj) / totalAdj : 0.20,
        yearsGained: +(longevityExtension * (totalAdj > 0 ? Math.abs(adhAdj) / totalAdj : 0.20)).toFixed(1),
        status: pillars.adherenceScore >= 85 ? "optimal" as const : pillars.adherenceScore >= 70 ? "moderate" as const : "needs-work" as const,
      },
      {
        key: "nutrition",
        label: "Cellular Nutrition",
        icon: "🥗",
        score: pillars.nutritionScore,
        impact: 0.10,
        yearsGained: +(longevityExtension * 0.10).toFixed(1),
        status: pillars.nutritionScore >= 75 ? "optimal" as const : pillars.nutritionScore >= 55 ? "moderate" as const : "needs-work" as const,
      },
    ].sort((a, b) => b.yearsGained - a.yearsGained);

    // 13. Confidence score
    const dataPoints = [
      vault ? 1 : 0,
      pillars.sleepScore !== 65 ? 1 : 0,
      pillars.hrvScore !== 50 ? 1 : 0,
      pillars.adherenceScore !== 60 ? 1 : 0,
      pillars.nutritionScore !== 55 ? 1 : 0,
    ];
    const confidence = Math.min(95, 35 + dataPoints.filter(Boolean).length * 12);

    return {
      chronologicalAge: chronoAge,
      currentBioAge: +currentBioAge.toFixed(1),
      currentDelta: +(currentBioAge - chronoAge).toFixed(1),
      baseLifespan,
      longevityExtension: +longevityExtension.toFixed(1),
      chronologicalLine,
      optimizedLine,
      inflectionPoints,
      pillarImpact,
      pillars,
      consistencyMultiplier: +consistencyMultiplier.toFixed(2),
      confidence,
      projectionYears,
    };
  },
});
