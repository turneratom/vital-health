import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIOLOGICAL TRAJECTORY ENGINE — 90-Day Projection
   
   Computes a 90-day forward projection of biological age based on:
   - Current Vive Age (from bioAgeAlgorithm)
   - Protocol adherence trends (7/14/30-day windows)
   - Biomarker velocity (rate of change)
   - Sleep, HRV, and fitness momentum
   
   Returns structured data for the Trajectory Canvas visualization.
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker optimal ranges ── */
const MARKER_RANGES: Record<string, { low: number; high: number; lowerBetter: boolean; ageImpact: number }> = {
  crp:               { low: 0,   high: 1.0,  lowerBetter: true,  ageImpact: 4 },
  hba1c:             { low: 4.0, high: 5.4,  lowerBetter: true,  ageImpact: 5 },
  vitaminD:          { low: 40,  high: 60,   lowerBetter: false, ageImpact: 3 },
  testosteroneTotal: { low: 500, high: 900,  lowerBetter: false, ageImpact: 2 },
  ferritin:          { low: 40,  high: 150,  lowerBetter: false, ageImpact: 2 },
};

function scoreBiomarker(value: number, range: typeof MARKER_RANGES[string]): number {
  if (!value || value <= 0) return 0;
  const { low, high, lowerBetter } = range;
  if (lowerBetter) {
    if (value <= high) return Math.min(1, (high - value) / (high || 1));
    return Math.max(-1, -(value - high) / (high || 1));
  }
  if (value >= low && value <= high) return 0.3 + ((value - low) / ((high - low) || 1)) * 0.7;
  if (value < low) return Math.max(-1, -(low - value) / (low || 1));
  return Math.max(-0.5, 0.3 - ((value - high) / (high || 1)) * 0.5);
}

function hrvAgeAdj(hrv: number, age: number): number {
  const expected = Math.max(20, 65 - (age - 20) * 0.8);
  return -(hrv - expected) / 5;
}

function sleepAgeAdj(score: number): number {
  if (score >= 90) return -2;
  if (score >= 80) return -1;
  if (score >= 70) return 0;
  if (score >= 60) return 1;
  return 2;
}

function adherenceAgeAdj(pct: number): number {
  if (pct >= 95) return -1.5;
  if (pct >= 85) return -0.8;
  if (pct >= 75) return 0;
  if (pct >= 60) return 0.5;
  return 1.5;
}

/* ═══════════════════════════════════════════════════════════════
   QUERY: get90DayTrajectory
   Returns 90 data points (one per day) projecting biological age
   ═══════════════════════════════════════════════════════════════ */
export const get90DayTrajectory = query({
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

    // 2. BioVault
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    // 3. HRV (7-day avg)
    let avgHrv = vault?.hrvCurrent ?? 48;
    try {
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", sessionId).gte("measuredAt", day7)
        )
        .collect();
      if (hrvReadings.length > 0) {
        avgHrv = hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length;
      }
    } catch { /* table may not exist */ }

    // 4. Sleep (7-day avg)
    let avgSleep = vault?.sleepScore ?? 72;
    try {
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = sleepLogs.filter(s => s.loggedAt >= day7);
      if (recent.length > 0) {
        avgSleep = recent.reduce((s, l) => s + l.sleepScore, 0) / recent.length;
      }
    } catch { /* table may not exist */ }

    // 5. Adherence (14-day)
    let avgAdherence = 70;
    try {
      const adherenceScores = await ctx.db
        .query("adherenceScores")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent = adherenceScores.filter(a => a.updatedAt >= day14);
      if (recent.length > 0) {
        avgAdherence = recent.reduce((s, a) => s + a.adherencePercent, 0) / recent.length;
      }
    } catch { /* table may not exist */ }

    // 6. Compute current bio age
    const hrvAdj = avgHrv > 0 ? hrvAgeAdj(avgHrv, chronoAge) : 0;
    const sleepAdj = sleepAgeAdj(avgSleep);
    const adhAdj = adherenceAgeAdj(avgAdherence);

    let biomarkerAdj = 0;
    if (vault) {
      const markers: Array<[string, number | null | undefined]> = [
        ["crp", vault.crp],
        ["hba1c", vault.hba1c],
        ["vitaminD", vault.vitaminD],
        ["testosteroneTotal", vault.testosteroneTotal],
        ["ferritin", vault.ferritin],
      ];
      let totalWeight = 0;
      let weightedSum = 0;
      for (const [key, val] of markers) {
        if (val != null && typeof val === "number" && val > 0) {
          const range = MARKER_RANGES[key];
          if (range) {
            const score = scoreBiomarker(val, range);
            weightedSum += -score * range.ageImpact;
            totalWeight += range.ageImpact;
          }
        }
      }
      if (totalWeight > 0) biomarkerAdj = weightedSum / totalWeight;
    }

    const currentBioAge = chronoAge + (hrvAdj * 0.25) + (biomarkerAdj * 0.25) + (sleepAdj * 0.20) + (adhAdj * 0.15);
    const currentDelta = currentBioAge - chronoAge;

    // 7. Compute adherence momentum (trend over last 14 days)
    // Positive = improving, negative = declining
    let adherenceMomentum = 0;
    try {
      const adherenceScores = await ctx.db
        .query("adherenceScores")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
        .collect();
      const recent14 = adherenceScores
        .filter(a => a.updatedAt >= day14)
        .sort((a, b) => a.updatedAt - b.updatedAt);
      if (recent14.length >= 3) {
        const firstHalf = recent14.slice(0, Math.floor(recent14.length / 2));
        const secondHalf = recent14.slice(Math.floor(recent14.length / 2));
        const avgFirst = firstHalf.reduce((s, a) => s + a.adherencePercent, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, a) => s + a.adherencePercent, 0) / secondHalf.length;
        adherenceMomentum = (avgSecond - avgFirst) / 100; // -1 to +1
      }
    } catch { /* ok */ }

    // 8. Project 90 days forward with 3 scenarios
    const trajectoryPoints: Array<{
      day: number;
      optimal: number;    // Best case: 95%+ adherence
      projected: number;  // Current trajectory
      decline: number;    // If adherence drops to 40%
    }> = [];

    // Daily improvement rate per scenario (years of bio-age reduction per day)
    const optimalRate = -0.035;   // ~3.15 years improvement over 90 days
    const currentRate = adherenceMomentum >= 0
      ? -0.015 * (avgAdherence / 100) + (adherenceMomentum * 0.005)
      : -0.005 * (avgAdherence / 100) + (adherenceMomentum * 0.01);
    const declineRate = 0.02;     // Aging faster

    for (let d = 0; d <= 90; d++) {
      // Add diminishing returns curve (logarithmic dampening)
      const dampening = 1 - Math.log10(1 + d * 0.03);
      const optimalDamp = Math.max(0.3, dampening);
      const currentDamp = Math.max(0.4, dampening);

      trajectoryPoints.push({
        day: d,
        optimal: Math.max(
          chronoAge - 8,
          currentBioAge + (optimalRate * d * optimalDamp)
        ),
        projected: Math.max(
          chronoAge - 6,
          currentBioAge + (currentRate * d * currentDamp)
        ),
        decline: Math.min(
          chronoAge + 5,
          currentBioAge + (declineRate * d * 0.8)
        ),
      });
    }

    // 9. Key milestones
    const milestones: Array<{
      day: number;
      label: string;
      type: "achievement" | "warning" | "checkpoint";
    }> = [];

    // Find when projected crosses key thresholds
    for (let d = 1; d <= 90; d++) {
      const prev = trajectoryPoints[d - 1].projected;
      const curr = trajectoryPoints[d].projected;
      // Crossing a full year younger
      if (Math.floor(prev) > Math.floor(curr)) {
        milestones.push({
          day: d,
          label: `Bio-Age reaches ${Math.floor(curr)}`,
          type: "achievement",
        });
      }
    }

    // Add 30/60/90 day checkpoints
    [30, 60, 90].forEach(d => {
      const pt = trajectoryPoints[d];
      if (pt) {
        milestones.push({
          day: d,
          label: `Day ${d} checkpoint`,
          type: "checkpoint",
        });
      }
    });

    // 10. Component breakdown for current state
    const components = [
      { key: "hrv", label: "HRV Signal", value: avgHrv, unit: "ms", adjustment: +(hrvAdj * 0.25).toFixed(1), weight: 0.25, status: avgHrv >= 55 ? "optimal" as const : avgHrv >= 40 ? "moderate" as const : "low" as const },
      { key: "biomarkers", label: "Blood Panel", value: 0, unit: "", adjustment: +(biomarkerAdj * 0.25).toFixed(1), weight: 0.25, status: biomarkerAdj <= -0.5 ? "optimal" as const : biomarkerAdj <= 0.5 ? "moderate" as const : "low" as const },
      { key: "sleep", label: "Sleep Quality", value: avgSleep, unit: "score", adjustment: +(sleepAdj * 0.20).toFixed(1), weight: 0.20, status: avgSleep >= 80 ? "optimal" as const : avgSleep >= 65 ? "moderate" as const : "low" as const },
      { key: "adherence", label: "Protocol Adherence", value: avgAdherence, unit: "%", adjustment: +(adhAdj * 0.15).toFixed(1), weight: 0.15, status: avgAdherence >= 85 ? "optimal" as const : avgAdherence >= 70 ? "moderate" as const : "low" as const },
      { key: "fitness", label: "Fitness Load", value: 0, unit: "", adjustment: 0, weight: 0.15, status: "moderate" as const },
    ];

    return {
      chronologicalAge: chronoAge,
      currentBioAge: +currentBioAge.toFixed(1),
      delta: +currentDelta.toFixed(1),
      trajectory: trajectoryPoints,
      milestones,
      components,
      adherenceMomentum: +adherenceMomentum.toFixed(3),
      avgAdherence: +avgAdherence.toFixed(0),
      avgHrv: +avgHrv.toFixed(0),
      avgSleep: +avgSleep.toFixed(0),
      confidence: Math.min(95, 40 + (avgAdherence * 0.3) + (avgHrv > 0 ? 15 : 0) + (vault ? 10 : 0)),
    };
  },
});
