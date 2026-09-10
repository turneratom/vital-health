import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════════
   VIVE AGE — Biological Age Prediction Algorithm
   
   Aggregates five signal streams into a single "Vive Age" metric:
   1. HRV Signal       — vagal tone / autonomic health (weight: 0.25)
   2. Blood Biomarkers — CRP, HbA1c, ApoB, VitD, etc.  (weight: 0.25)
   3. Sleep Quality     — composite sleep score           (weight: 0.20)
   4. Protocol Adherence — consistency × completeness     (weight: 0.15)
   5. Body Composition  — VO2 proxy from activity data    (weight: 0.15)
   
   Output: Estimated biological age, delta from chronological,
   component breakdowns, and a confidence score.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Weights ── */
const W = {
  hrv: 0.25,
  biomarkers: 0.25,
  sleep: 0.20,
  adherence: 0.15,
  fitness: 0.15,
};

/* ── Biomarker optimal ranges for longevity ── */
const MARKER_RANGES: Record<string, { low: number; high: number; lowerBetter: boolean; ageImpactYears: number }> = {
  crp:               { low: 0,   high: 1.0,  lowerBetter: true,  ageImpactYears: 4 },
  hba1c:             { low: 4.0, high: 5.4,  lowerBetter: true,  ageImpactYears: 5 },
  vitaminD:          { low: 40,  high: 60,   lowerBetter: false, ageImpactYears: 3 },
  testosteroneTotal: { low: 500, high: 900,  lowerBetter: false, ageImpactYears: 2 },
  ferritin:          { low: 40,  high: 150,  lowerBetter: false, ageImpactYears: 2 },
  apoB:              { low: 0,   high: 80,   lowerBetter: true,  ageImpactYears: 4 },
  homocysteine:      { low: 0,   high: 8,    lowerBetter: true,  ageImpactYears: 3 },
  triglycerides:     { low: 0,   high: 100,  lowerBetter: true,  ageImpactYears: 2 },
};

/** Score a single biomarker: -1 (terrible) to +1 (optimal) */
function scoreBiomarker(value: number, range: typeof MARKER_RANGES[string]): number {
  if (value <= 0) return 0;
  const { low, high, lowerBetter } = range;
  if (lowerBetter) {
    if (value <= high) return Math.min(1, (high - value) / high);
    return Math.max(-1, -(value - high) / high);
  }
  if (value >= low && value <= high) {
    return 0.3 + ((value - low) / (high - low)) * 0.7;
  }
  if (value < low) return Math.max(-1, -(low - value) / low);
  return Math.max(-0.5, 0.3 - ((value - high) / high) * 0.5);
}

/** Convert HRV to age-adjustment factor. Higher HRV = younger biology. */
function hrvAgeAdjustment(hrvMs: number, chronoAge: number): number {
  // Expected HRV declines ~1ms/year from age 20 baseline of ~65ms
  const expectedHrv = Math.max(20, 65 - (chronoAge - 20) * 0.8);
  const delta = hrvMs - expectedHrv;
  // Each 5ms above expected ≈ 1 year younger
  return -(delta / 5);
}

/** Convert sleep score to age-adjustment factor */
function sleepAgeAdjustment(sleepScore: number): number {
  // Score 90+ = -2 years, 70 = 0, 50 = +2 years
  if (sleepScore >= 90) return -2;
  if (sleepScore >= 80) return -1;
  if (sleepScore >= 70) return 0;
  if (sleepScore >= 60) return 1;
  return 2;
}

/** Convert adherence % to age-adjustment factor */
function adherenceAgeAdjustment(adherencePct: number): number {
  // 95%+ = -1.5 years, 80% = 0, 60% = +1 year
  if (adherencePct >= 95) return -1.5;
  if (adherencePct >= 85) return -0.8;
  if (adherencePct >= 75) return 0;
  if (adherencePct >= 60) return 0.5;
  return 1.5;
}

/** Estimate VO2 max proxy from activity data */
function fitnessAgeAdjustment(weeklyActivityMinutes: number, avgIntensity: number): number {
  // 150+ min/week moderate = -1.5 years, <60 min = +2 years
  const effectiveMinutes = weeklyActivityMinutes * (avgIntensity / 5);
  if (effectiveMinutes >= 200) return -2;
  if (effectiveMinutes >= 150) return -1.5;
  if (effectiveMinutes >= 100) return -0.5;
  if (effectiveMinutes >= 60) return 0;
  return 2;
}

/* ═══════════════════════════════════════════════════════════════
   QUERY: Compute current Vive Age from all available data
   ═══════════════════════════════════════════════════════════════ */
export const computeViveAge = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const now = Date.now();
    const day7 = now - 7 * 86400000;
    const day14 = now - 14 * 86400000;
    const day30 = now - 30 * 86400000;

    // 1. Get chronological age from userVitals
    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();
    const chronoAge = vitals?.age ?? 35;

    // 2. Get bioVault for biomarker data
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    // 3. Get recent HRV readings (7-day)
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", sessionId).gte("measuredAt", day7)
      )
      .collect();
    const avgHrv = hrvReadings.length > 0
      ? hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length
      : vault?.hrvCurrent ?? 0;

    // 4. Get recent sleep logs (7-day)
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();
    const recentSleep = sleepLogs
      .filter(s => s.loggedAt >= day7)
      .sort((a, b) => b.loggedAt - a.loggedAt);
    const avgSleepScore = recentSleep.length > 0
      ? recentSleep.reduce((s, l) => s + l.sleepScore, 0) / recentSleep.length
      : vault?.sleepScore ?? 70;

    // 5. Get adherence scores (14-day)
    const adherenceScores = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();
    const recentAdherence = adherenceScores
      .filter(a => a.updatedAt >= day14)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const avgAdherence = recentAdherence.length > 0
      ? recentAdherence.reduce((s, a) => s + a.adherencePercent, 0) / recentAdherence.length
      : 70;

    // 6. Get activity logs (7-day) for fitness proxy
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();
    const recentActivity = activityLogs.filter(a => a.loggedAt >= day7);
    const weeklyMinutes = recentActivity.reduce((s, a) => s + a.duration, 0);
    const avgIntensity = recentActivity.length > 0
      ? recentActivity.reduce((s, a) => {
          const i = a.type === 'strength' ? 7 : a.type === 'hiit' ? 8 : a.type === 'cardio' ? 6 : 4;
          return s + i;
        }, 0) / recentActivity.length
      : 4;

    // 7. Get lab results for biomarker scoring
    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();

    // Build biomarker map from vault + lab results
    const biomarkerMap: Record<string, number> = {};
    if (vault) {
      if (vault.crp) biomarkerMap.crp = vault.crp;
      if (vault.hba1c) biomarkerMap.hba1c = vault.hba1c;
      if (vault.vitaminD) biomarkerMap.vitaminD = vault.vitaminD;
      if (vault.testosteroneTotal) biomarkerMap.testosteroneTotal = vault.testosteroneTotal;
      if (vault.ferritin) biomarkerMap.ferritin = vault.ferritin;
    }
    // Lab results override vault (more recent)
    for (const lab of labResults) {
      const key = lab.marker.toLowerCase().replace(/[\s-]/g, '');
      if (key in MARKER_RANGES) biomarkerMap[key] = lab.value;
    }

    // ── Compute component adjustments ──
    const hrvAdj = avgHrv > 0 ? hrvAgeAdjustment(avgHrv, chronoAge) : 0;
    const sleepAdj = sleepAgeAdjustment(avgSleepScore);
    const adherenceAdj = adherenceAgeAdjustment(avgAdherence);
    const fitnessAdj = fitnessAgeAdjustment(weeklyMinutes, avgIntensity);

    // Biomarker composite adjustment
    let biomarkerAdj = 0;
    let biomarkerCount = 0;
    const markerBreakdown: Array<{ key: string; value: number; score: number; impact: number }> = [];
    for (const [key, range] of Object.entries(MARKER_RANGES)) {
      const val = biomarkerMap[key];
      if (val && val > 0) {
        const score = scoreBiomarker(val, range);
        const impact = -score * range.ageImpactYears;
        biomarkerAdj += impact;
        biomarkerCount++;
        markerBreakdown.push({ key, value: val, score, impact });
      }
    }
    if (biomarkerCount > 0) biomarkerAdj /= biomarkerCount;

    // ── Weighted composite Vive Age ──
    const totalAdjustment =
      hrvAdj * W.hrv +
      biomarkerAdj * W.biomarkers +
      sleepAdj * W.sleep +
      adherenceAdj * W.adherence +
      fitnessAdj * W.fitness;

    const viveAge = Math.max(18, Math.round((chronoAge + totalAdjustment) * 10) / 10);
    const delta = Math.round((viveAge - chronoAge) * 10) / 10;

    // Confidence: based on data availability
    const dataPoints = [
      avgHrv > 0 ? 1 : 0,
      biomarkerCount >= 3 ? 1 : biomarkerCount > 0 ? 0.5 : 0,
      recentSleep.length >= 3 ? 1 : recentSleep.length > 0 ? 0.5 : 0,
      recentAdherence.length >= 5 ? 1 : recentAdherence.length > 0 ? 0.5 : 0,
      recentActivity.length >= 3 ? 1 : recentActivity.length > 0 ? 0.5 : 0,
    ];
    const confidence = Math.round((dataPoints.reduce((s, d) => s + d, 0) / dataPoints.length) * 100);

    // Status label
    let status: string;
    let statusColor: string;
    if (delta <= -5) { status = 'Exceptional'; statusColor = '#00FFCC'; }
    else if (delta <= -2) { status = 'Optimized'; statusColor = '#00DC82'; }
    else if (delta <= 0) { status = 'On Track'; statusColor = '#3B82F6'; }
    else if (delta <= 3) { status = 'Needs Attention'; statusColor = '#E8976C'; }
    else { status = 'Regressing'; statusColor = '#FF6B6B'; }

    // Get history for trend
    const history = await ctx.db
      .query("viveAgeHistory")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .collect();
    const sortedHistory = history
      .sort((a, b) => a.calculatedAt - b.calculatedAt)
      .slice(-90); // Last 90 entries

    return {
      chronologicalAge: chronoAge,
      viveAge,
      delta,
      status,
      statusColor,
      confidence,
      components: {
        hrv: { adjustment: Math.round(hrvAdj * 10) / 10, value: Math.round(avgHrv), weight: W.hrv },
        biomarkers: { adjustment: Math.round(biomarkerAdj * 10) / 10, count: biomarkerCount, weight: W.biomarkers, breakdown: markerBreakdown },
        sleep: { adjustment: Math.round(sleepAdj * 10) / 10, score: Math.round(avgSleepScore), weight: W.sleep },
        adherence: { adjustment: Math.round(adherenceAdj * 10) / 10, pct: Math.round(avgAdherence), weight: W.adherence },
        fitness: { adjustment: Math.round(fitnessAdj * 10) / 10, weeklyMin: Math.round(weeklyMinutes), weight: W.fitness },
      },
      history: sortedHistory.map(h => ({
        date: h.dateKey,
        viveAge: h.viveAge,
        chronoAge: h.chronoAge,
        delta: h.delta,
      })),
      calculatedAt: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   MUTATION: Snapshot current Vive Age into history
   ═══════════════════════════════════════════════════════════════ */
export const snapshotViveAge = mutation({
  args: {
    sessionId: v.string(),
    viveAge: v.number(),
    chronoAge: v.number(),
    delta: v.number(),
    confidence: v.number(),
    hrvAdj: v.number(),
    biomarkerAdj: v.number(),
    sleepAdj: v.number(),
    adherenceAdj: v.number(),
    fitnessAdj: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dateKey = new Date(now).toISOString().slice(0, 10);

    // Upsert: one snapshot per day
    const existing = await ctx.db
      .query("viveAgeHistory")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
      )
      .first();

    const data = {
      sessionId: args.sessionId,
      dateKey,
      viveAge: args.viveAge,
      chronoAge: args.chronoAge,
      delta: args.delta,
      confidence: args.confidence,
      hrvAdj: args.hrvAdj,
      biomarkerAdj: args.biomarkerAdj,
      sleepAdj: args.sleepAdj,
      adherenceAdj: args.adherenceAdj,
      fitnessAdj: args.fitnessAdj,
      calculatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("viveAgeHistory", data);
  },
});
