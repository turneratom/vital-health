import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   QUICK-SYNC — Frictionless Biomarker Ingestion Engine
   
   Accepts parsed biomarker data from the frontend Bio-Link parser,
   batch-commits to BioVault, logs the ingestion event, and triggers
   longevity forecast recalculation. Zero manual entry required.
   
   Supports: ApoB, Lp(a), HbA1c, Vitamin D, Testosterone, hs-CRP,
   Ferritin, and 50+ additional clinical biomarkers.
   ═══════════════════════════════════════════════════════════════ */

/* ── Optimal ranges for longevity scoring ── */
const LONGEVITY_OPTIMAL: Record<string, { min: number; max: number; higherBetter: boolean; weight: number; label: string; unit: string }> = {
  vitaminD:          { min: 40, max: 80, higherBetter: true, weight: 0.12, label: "Vitamin D", unit: "ng/mL" },
  testosteroneTotal: { min: 500, max: 1000, higherBetter: true, weight: 0.10, label: "Total T", unit: "ng/dL" },
  testosteroneFree:  { min: 15, max: 25, higherBetter: true, weight: 0.08, label: "Free T", unit: "pg/mL" },
  ferritin:          { min: 40, max: 200, higherBetter: true, weight: 0.07, label: "Ferritin", unit: "ng/mL" },
  crp:               { min: 0, max: 1.0, higherBetter: false, weight: 0.18, label: "hs-CRP", unit: "mg/L" },
  hba1c:             { min: 4.0, max: 5.4, higherBetter: false, weight: 0.17, label: "HbA1c", unit: "%" },
  apoB:              { min: 0, max: 80, higherBetter: false, weight: 0.14, label: "ApoB", unit: "mg/dL" },
  lpA:               { min: 0, max: 30, higherBetter: false, weight: 0.08, label: "Lp(a)", unit: "nmol/L" },
  homocysteine:      { min: 4, max: 8, higherBetter: false, weight: 0.06, label: "Homocysteine", unit: "µmol/L" },
};

function markerScore(key: string, value: number): number {
  const opt = LONGEVITY_OPTIMAL[key];
  if (!opt) return 50;
  if (opt.higherBetter) {
    if (value >= opt.min && value <= opt.max) return 100;
    if (value < opt.min) return Math.max(0, (value / opt.min) * 100);
    return Math.max(0, 100 - ((value - opt.max) / opt.max) * 50);
  } else {
    if (value >= opt.min && value <= opt.max) return 100;
    if (value > opt.max) return Math.max(0, 100 - ((value - opt.max) / opt.max) * 100);
    return 100;
  }
}

function markerGrade(score: number): "A+" | "A" | "B" | "C" | "D" | "F" {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Batch commit parsed biomarkers from Quick-Sync paste/upload */
export const commitQuickSync = mutation({
  args: {
    sessionId: v.string(),
    biomarkers: v.array(v.object({
      name: v.string(),
      value: v.number(),
      unit: v.string(),
      status: v.string(),
      category: v.string(),
      vaultKey: v.optional(v.string()),
    })),
    rawTextPreview: v.string(),
    parseConfidence: v.number(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    /* ── 1. Extract vault-mappable biomarkers ── */
    const vaultUpdates: Record<string, number> = {};
    const allMarkerScores: Array<{ key: string; value: number; score: number; grade: string; label: string; unit: string }> = [];

    for (const bm of args.biomarkers) {
      if (bm.vaultKey) {
        vaultUpdates[bm.vaultKey] = bm.value;
        const score = markerScore(bm.vaultKey, bm.value);
        const opt = LONGEVITY_OPTIMAL[bm.vaultKey];
        allMarkerScores.push({
          key: bm.vaultKey,
          value: bm.value,
          score,
          grade: markerGrade(score),
          label: opt?.label ?? bm.name,
          unit: opt?.unit ?? bm.unit,
        });
      }
    }

    /* ── 2. Load previous BioVault for delta comparison ── */
    const existing = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const previousValues: Record<string, number | null> = {};
    if (existing) {
      for (const key of Object.keys(vaultUpdates)) {
        previousValues[key] = (existing as any)[key] ?? null;
      }
    }

    /* ── 3. Upsert BioVault with new values ── */
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...vaultUpdates,
        bioStatus: "lab-synced",
        bioStatusUpdatedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("bioVault", {
        sessionId: args.sessionId,
        ...vaultUpdates,
        mthfrVariant: false,
        apoe4: false,
        caffeineSensitivity: false,
        preferredProteins: "mixed",
        dietaryRestrictions: "none",
        bioStatus: "lab-synced",
        bioStatusUpdatedAt: now,
        updatedAt: now,
      });
    }

    /* ── 4. Log each biomarker as a journal event for timeline ── */
    for (const bm of args.biomarkers) {
      await ctx.db.insert("journalEvents", {
        sessionId: args.sessionId,
        eventType: "quick_sync_biomarker",
        eventKey: bm.name,
        value: `${bm.value} ${bm.unit}`,
        numericValue: bm.value,
        loggedAt: now,
      });
    }

    /* ── 5. Log the ingestion job ── */
    await ctx.db.insert("ingestionJobs", {
      sessionId: args.sessionId,
      jobType: "quick_sync",
      status: "completed",
      metricsProcessed: args.biomarkers.length,
      metricsInterpolated: 0,
      sensorsChecked: 0,
      dropoutsDetected: 0,
      startedAt: now,
      completedAt: now,
    });

    /* ── 6. Compute longevity impact summary with deltas ── */
    const compositeScore = allMarkerScores.length > 0
      ? Math.round(
          allMarkerScores.reduce((sum, m) => {
            const w = LONGEVITY_OPTIMAL[m.key]?.weight ?? 0.1;
            return sum + m.score * w;
          }, 0) /
          allMarkerScores.reduce((sum, m) => sum + (LONGEVITY_OPTIMAL[m.key]?.weight ?? 0.1), 0)
        )
      : null;

    /* Compute previous composite for delta */
    let previousComposite: number | null = null;
    if (existing && allMarkerScores.length > 0) {
      const prevScores: Array<{ key: string; score: number }> = [];
      for (const ms of allMarkerScores) {
        const prevVal = previousValues[ms.key];
        if (prevVal != null) {
          prevScores.push({ key: ms.key, score: markerScore(ms.key, prevVal) });
        }
      }
      if (prevScores.length > 0) {
        previousComposite = Math.round(
          prevScores.reduce((sum, m) => sum + m.score * (LONGEVITY_OPTIMAL[m.key]?.weight ?? 0.1), 0) /
          prevScores.reduce((sum, m) => sum + (LONGEVITY_OPTIMAL[m.key]?.weight ?? 0.1), 0)
        );
      }
    }

    const flagged = args.biomarkers.filter(b => b.status !== "optimal");
    const critical = args.biomarkers.filter(b => b.status === "critical");

    /* Build per-marker deltas */
    const markerDeltas = allMarkerScores.map(ms => {
      const prevVal = previousValues[ms.key];
      const prevScore = prevVal != null ? markerScore(ms.key, prevVal) : null;
      return {
        ...ms,
        previousValue: prevVal,
        previousScore: prevScore,
        scoreDelta: prevScore != null ? ms.score - prevScore : null,
        direction: prevScore == null ? "new" as const :
          ms.score > prevScore ? "improved" as const :
          ms.score < prevScore ? "declined" as const : "stable" as const,
      };
    });

    return {
      committed: args.biomarkers.length,
      vaultKeysUpdated: Object.keys(vaultUpdates).length,
      compositeScore,
      previousComposite,
      compositeDelta: compositeScore != null && previousComposite != null ? compositeScore - previousComposite : null,
      compositeGrade: compositeScore != null ? markerGrade(compositeScore) : null,
      flaggedCount: flagged.length,
      criticalCount: critical.length,
      markerDeltas,
      source: args.source ?? "paste",
      timestamp: now,
    };
  },
});

/** Get Quick-Sync history for a session */
export const getQuickSyncHistory = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(20);

    return jobs
      .filter(j => j.jobType === "quick_sync")
      .map(j => ({
        id: j._id,
        metricsProcessed: j.metricsProcessed,
        completedAt: j.completedAt,
        status: j.status,
      }));
  },
});

/** Get longevity forecast impact after Quick-Sync */
export const getLongevityImpact = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!bioVault) return null;

    const markers: Array<{
      key: string;
      label: string;
      value: number | null;
      score: number;
      grade: string;
      status: "optimal" | "warning" | "critical";
      unit: string;
      weight: number;
    }> = [];

    let totalWeight = 0;
    let weightedScore = 0;

    for (const [key, meta] of Object.entries(LONGEVITY_OPTIMAL)) {
      const val = (bioVault as any)[key];
      if (val == null || typeof val !== "number") {
        markers.push({
          key, label: meta.label, value: null, score: 0,
          grade: "—", status: "warning", unit: meta.unit, weight: meta.weight,
        });
        continue;
      }
      const score = markerScore(key, val);
      let status: "optimal" | "warning" | "critical" = "optimal";
      if (meta.higherBetter) {
        status = val >= meta.min ? "optimal" : val >= meta.min * 0.7 ? "warning" : "critical";
      } else {
        status = val <= meta.max ? "optimal" : val <= meta.max * 1.5 ? "warning" : "critical";
      }
      totalWeight += meta.weight;
      weightedScore += score * meta.weight;
      markers.push({
        key, label: meta.label, value: val, score,
        grade: markerGrade(score), status, unit: meta.unit, weight: meta.weight,
      });
    }

    const compositeScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    return {
      markers,
      compositeScore,
      compositeGrade: markerGrade(compositeScore),
      lastUpdated: bioVault.updatedAt,
      bioStatus: bioVault.bioStatus,
      markersWithData: markers.filter(m => m.value != null).length,
      totalMarkers: markers.length,
    };
  },
});
