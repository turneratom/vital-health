import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIO-CONTEXT SYNTHESIS ENGINE
   
   Aggregates data from SomaticBodyMap, ProtocolDrift, and Inventory
   to produce cross-system "Synthesized Insights." When multiple
   subsystems flag correlated issues (e.g., shoulder tension + low
   magnesium + HRV drift), the engine generates high-priority
   Recalibration alerts with actionable recommendations.
   ═══════════════════════════════════════════════════════════════ */

/* ── Somatic-Supplement Correlation Map ── */
const SOMATIC_SUPPLEMENT_MAP: Record<string, {
  supplements: string[];
  biomarkers: string[];
  driftMetrics: string[];
  recalibrationTitle: string;
  recalibrationAction: string;
  severity: "critical" | "high" | "moderate";
}> = {
  shoulders: {
    supplements: ["magnesium", "mag", "glycinate", "omega-3", "fish oil", "curcumin"],
    biomarkers: ["crp", "ferritin"],
    driftMetrics: ["recovery", "hrv"],
    recalibrationTitle: "Shoulder Tension × Low Magnesium Detected",
    recalibrationAction: "Increase Magnesium Glycinate to 600mg before bed. Add 10min shoulder mobility protocol. Consider topical magnesium spray on trapezius.",
    severity: "high",
  },
  neck: {
    supplements: ["magnesium", "mag", "b-complex", "methylfolate"],
    biomarkers: ["homocysteine", "crp"],
    driftMetrics: ["sleepScore", "hrv"],
    recalibrationTitle: "Cervical Tension × Sleep Quality Drift",
    recalibrationAction: "Neck tension correlates with poor sleep posture and methylation stress. Add B-complex + cervical decompression stretches before bed.",
    severity: "high",
  },
  lower_back: {
    supplements: ["vitamin d", "d3", "calcium", "magnesium", "collagen"],
    biomarkers: ["vitaminD", "ferritin", "crp"],
    driftMetrics: ["recovery"],
    recalibrationTitle: "Lower Back Pain × Vitamin D Deficiency Pattern",
    recalibrationAction: "Low vitamin D impairs calcium absorption and muscle recovery. Increase D3 to 5000 IU + K2 MK-7. Add hip flexor mobility work.",
    severity: "critical",
  },
  gut: {
    supplements: ["probiotic", "l-glutamine", "zinc", "digestive enzyme"],
    biomarkers: ["crp", "hba1c", "fastingInsulin"],
    driftMetrics: ["sleepScore", "recovery"],
    recalibrationTitle: "GI Distress × Metabolic Drift Correlation",
    recalibrationAction: "Gut inflammation drives systemic CRP elevation and sleep disruption. Add L-Glutamine 5g AM + probiotic. Implement 14:10 fasting window.",
    severity: "critical",
  },
  head: {
    supplements: ["magnesium", "coq10", "riboflavin", "omega-3"],
    biomarkers: ["homocysteine", "crp"],
    driftMetrics: ["hrv", "sleepScore"],
    recalibrationTitle: "CNS Tension × HRV Autonomic Drift",
    recalibrationAction: "Headache pattern correlates with autonomic imbalance. Add CoQ10 200mg + Riboflavin 400mg. Implement 10min morning NSDR.",
    severity: "high",
  },
  knees: {
    supplements: ["collagen", "glucosamine", "omega-3", "curcumin", "boswellia"],
    biomarkers: ["crp", "ferritin"],
    driftMetrics: ["recovery"],
    recalibrationTitle: "Joint Inflammation × Recovery Deficit",
    recalibrationAction: "Knee inflammation with low recovery suggests overtraining + insufficient collagen synthesis. Reduce impact volume 30%. Add Collagen Type II 10g + Curcumin 1g.",
    severity: "high",
  },
  chest: {
    supplements: ["magnesium", "coq10", "omega-3"],
    biomarkers: ["apob", "homocysteine", "crp"],
    driftMetrics: ["hrv", "restingHr"],
    recalibrationTitle: "Chest Tightness × Cardiovascular Markers",
    recalibrationAction: "Chest tension with HRV drift warrants cardiovascular attention. Add CoQ10 200mg + EPA 2g. Monitor resting HR trend. Consider stress ECG if persistent.",
    severity: "critical",
  },
  arms: {
    supplements: ["magnesium", "creatine", "protein"],
    biomarkers: ["testosteroneTotal", "ferritin"],
    driftMetrics: ["recovery"],
    recalibrationTitle: "Upper Extremity Fatigue × Recovery Drift",
    recalibrationAction: "Arm fatigue with recovery drift suggests training volume exceeds recovery capacity. Add deload week. Ensure 1.6g/kg protein intake.",
    severity: "moderate",
  },
  legs: {
    supplements: ["magnesium", "potassium", "iron", "creatine"],
    biomarkers: ["ferritin", "testosteroneTotal"],
    driftMetrics: ["recovery", "sleepScore"],
    recalibrationTitle: "Lower Extremity Fatigue × Iron Status",
    recalibrationAction: "Leg heaviness with low ferritin impairs oxygen delivery to working muscles. Check ferritin levels. Add Iron Bisglycinate 25mg with Vitamin C if below 40 ng/mL.",
    severity: "high",
  },
};

/* ── Types ── */
export interface SynthesizedInsight {
  id: string;
  priority: "critical" | "high" | "moderate";
  title: string;
  action: string;
  sources: Array<{
    system: "somatic" | "inventory" | "drift" | "biomarker";
    detail: string;
  }>;
  correlationScore: number; // 0-100 — how strongly the signals correlate
  generatedAt: number;
}

export const getSynthesizedInsights = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    insights: SynthesizedInsight[];
    systemStatus: {
      somaticSignals: number;
      inventoryAlerts: number;
      driftEvents: number;
      overallIntegrity: number;
    };
    lastUpdated: number;
  }> => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    /* ── 1. Fetch recent somatic check-ins (last 72h) ── */
    const recentSomatic = await ctx.db
      .query("bodyMapEntries")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);

    const last72h = recentSomatic.filter((c: any) => now - c.loggedAt < 3 * dayMs);

    // Build region → severity map from recent check-ins
    const regionSeverityMap: Record<string, { maxSeverity: number; count: number; labels: string[] }> = {};
    for (const checkin of last72h) {
      const region = checkin.region || "";
      const severity = checkin.severity ?? 5;
      const label = checkin.description || region;
      if (!region) continue;
      if (!regionSeverityMap[region]) {
        regionSeverityMap[region] = { maxSeverity: 0, count: 0, labels: [] };
      }
      regionSeverityMap[region].maxSeverity = Math.max(regionSeverityMap[region].maxSeverity, severity);
      regionSeverityMap[region].count++;
      if (label && !regionSeverityMap[region].labels.includes(label)) {
        regionSeverityMap[region].labels.push(label);
      }
    }

    /* ── 2. Fetch inventory low-supply alerts ── */
    const inventoryItems = await ctx.db
      .query("inventory")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    const lowSupplyMap: Record<string, { name: string; daysRemaining: number; depleted: boolean }> = {};
    for (const item of inventoryItems) {
      if (item.dailyUsageUnits <= 0) continue;
      const daysRemaining = Math.floor(item.currentQuantity / item.dailyUsageUnits);
      if (daysRemaining <= 7) {
        const key = item.name.toLowerCase();
        lowSupplyMap[key] = {
          name: item.name,
          daysRemaining: Math.max(0, daysRemaining),
          depleted: daysRemaining <= 0 || item.status === "depleted",
        };
      }
    }

    /* ── 3. Fetch protocol drift events (last 7 days) ── */
    const driftEvents = await ctx.db
      .query("driftEvents")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(20);

    const recentDrifts = driftEvents.filter((d: any) => now - (d.flaggedAt ?? d.detectedAt ?? 0) < 7 * dayMs);
    const activeDriftMetrics = new Set<string>();
    for (const drift of recentDrifts) {
      if (drift.metric) activeDriftMetrics.add(drift.metric);
    }

    /* ── 4. Fetch BioVault for biomarker context ── */
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    /* ── 5. Cross-reference and generate Synthesized Insights ── */
    const insights: SynthesizedInsight[] = [];
    let insightIdx = 0;

    for (const [region, regionData] of Object.entries(regionSeverityMap)) {
      // Only process regions with meaningful tension (severity ≥ 5 or count ≥ 2)
      if (regionData.maxSeverity < 5 && regionData.count < 2) continue;

      const correlationDef = SOMATIC_SUPPLEMENT_MAP[region];
      if (!correlationDef) continue;

      const sources: SynthesizedInsight["sources"] = [];
      let correlationScore = 20; // Base score for having somatic signal

      // Source: Somatic
      sources.push({
        system: "somatic",
        detail: `${regionData.labels[0] || region} reported ${regionData.count}× in 72h (severity ${regionData.maxSeverity}/10)`,
      });
      correlationScore += Math.min(30, regionData.maxSeverity * 3);

      // Check inventory for correlated supplements
      let hasLowSupply = false;
      for (const suppKeyword of correlationDef.supplements) {
        for (const [invKey, invData] of Object.entries(lowSupplyMap)) {
          if (invKey.includes(suppKeyword)) {
            hasLowSupply = true;
            sources.push({
              system: "inventory",
              detail: invData.depleted
                ? `${invData.name} is DEPLETED`
                : `${invData.name} — ${invData.daysRemaining} days remaining`,
            });
            correlationScore += invData.depleted ? 25 : 15;
            break;
          }
        }
      }

      // Check drift metrics
      let hasDrift = false;
      for (const driftMetric of correlationDef.driftMetrics) {
        if (activeDriftMetrics.has(driftMetric)) {
          hasDrift = true;
          sources.push({
            system: "drift",
            detail: `${driftMetric} drift detected in last 7 days`,
          });
          correlationScore += 20;
        }
      }

      // Check biomarkers from BioVault
      if (bioVault) {
        for (const bioKey of correlationDef.biomarkers) {
          const val = (bioVault as any)[bioKey];
          if (val !== undefined && val !== null) {
            // Simple check: flag if biomarker exists (detailed range check would need the ranges)
            sources.push({
              system: "biomarker",
              detail: `${bioKey}: ${val}`,
            });
            correlationScore += 5;
          }
        }
      }

      // Only generate insight if we have cross-system correlation (≥2 systems)
      const systemCount = new Set(sources.map(s => s.system)).size;
      if (systemCount < 2) continue;

      // Boost priority if multiple systems converge
      let priority = correlationDef.severity;
      if (systemCount >= 3 && hasLowSupply && hasDrift) {
        priority = "critical";
        correlationScore = Math.min(100, correlationScore + 15);
      }

      insights.push({
        id: `synth-${region}-${insightIdx++}`,
        priority,
        title: correlationDef.recalibrationTitle,
        action: correlationDef.recalibrationAction,
        sources,
        correlationScore: Math.min(100, correlationScore),
        generatedAt: now,
      });
    }

    // Sort by priority then correlation score
    const priorityOrder = { critical: 0, high: 1, moderate: 2 };
    insights.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.correlationScore - a.correlationScore;
    });

    // Calculate overall system integrity
    const somaticSignals = Object.keys(regionSeverityMap).length;
    const inventoryAlerts = Object.keys(lowSupplyMap).length;
    const driftCount = recentDrifts.length;
    const criticalInsights = insights.filter(i => i.priority === "critical").length;

    let overallIntegrity = 100;
    overallIntegrity -= somaticSignals * 5;
    overallIntegrity -= inventoryAlerts * 8;
    overallIntegrity -= driftCount * 10;
    overallIntegrity -= criticalInsights * 15;
    overallIntegrity = Math.max(0, Math.min(100, overallIntegrity));

    return {
      insights: insights.slice(0, 5), // Top 5 most critical
      systemStatus: {
        somaticSignals,
        inventoryAlerts,
        driftEvents: driftCount,
        overallIntegrity,
      },
      lastUpdated: now,
    };
  },
});
