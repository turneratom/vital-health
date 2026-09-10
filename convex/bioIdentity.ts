import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIO-IDENTITY ENGINE — Digital Twin State Processor
   
   Aggregates BioVault, somatic feedback, lab results, sleep,
   HRV, and protocol adherence into a unified visual state map
   for the Bio-Identity Avatar (Digital Twin).
   
   Each body system gets a health score (0-100) and a thermal
   state that drives the heat map visualization.
   ═══════════════════════════════════════════════════════════════ */

/* ── Thermal state thresholds ── */
type ThermalState = "cold" | "cool" | "neutral" | "warm" | "hot" | "critical";

function scoreToThermal(score: number): ThermalState {
  if (score >= 90) return "cold";       // optimal — cool blue
  if (score >= 75) return "cool";       // good — teal
  if (score >= 60) return "neutral";    // baseline — green
  if (score >= 40) return "warm";       // attention — amber
  if (score >= 20) return "hot";        // warning — orange
  return "critical";                     // danger — red
}

/* ── Body system definitions ── */
const BODY_SYSTEMS = [
  "nervous",      // Brain + HRV + neural drive
  "cardiovascular", // Heart rate, HRV baseline, CRP
  "metabolic",    // HbA1c, fasting glucose, IGF-1
  "endocrine",    // Testosterone, cortisol proxy (CRP + sleep)
  "immune",       // CRP, Vitamin D, ferritin
  "musculoskeletal", // Joint mobility, workout recovery
  "digestive",    // Gut status somatic, dietary adherence
  "respiratory",  // Sleep efficiency, respiratory rate
] as const;

type BodySystem = typeof BODY_SYSTEMS[number];

interface SystemState {
  system: BodySystem;
  label: string;
  score: number;
  thermal: ThermalState;
  icon: string;
  primaryDriver: string;
  trend: "improving" | "stable" | "declining" | "unknown";
  markers: Array<{ name: string; value: string; status: "optimal" | "suboptimal" | "critical" }>;
}

interface BioIdentityState {
  overallScore: number;
  overallThermal: ThermalState;
  biologicalAge: number | null;
  chronologicalAge: number | null;
  ageDelta: number | null;
  systems: SystemState[];
  dominantSystem: string;
  criticalAlerts: string[];
  lastUpdated: number;
  dataCompleteness: number; // 0-100
}

/* ── Optimal ranges (mirrors aiBrain.ts) ── */
const OPTIMAL: Record<string, { min: number; max: number }> = {
  vitaminD: { min: 40, max: 80 },
  testosteroneTotal: { min: 400, max: 900 },
  testosteroneFree: { min: 15, max: 25 },
  ferritin: { min: 40, max: 200 },
  crp: { min: 0, max: 1.0 },
  hba1c: { min: 4.0, max: 5.6 },
  igf1: { min: 100, max: 300 },
  fastingGlucose: { min: 70, max: 100 },
};

function markerScore(key: string, value: number | undefined | null): number {
  if (value == null) return -1; // no data
  const range = OPTIMAL[key];
  if (!range) return 70;
  if (value >= range.min && value <= range.max) return 95;
  if (value < range.min) {
    const pctBelow = (range.min - value) / range.min;
    return Math.max(10, Math.round(95 - pctBelow * 120));
  }
  const pctAbove = (value - range.max) / range.max;
  return Math.max(10, Math.round(95 - pctAbove * 120));
}

function markerStatus(key: string, value: number | undefined | null): "optimal" | "suboptimal" | "critical" {
  if (value == null) return "suboptimal";
  const range = OPTIMAL[key];
  if (!range) return "optimal";
  if (value >= range.min && value <= range.max) return "optimal";
  const pctOff = value < range.min
    ? (range.min - value) / range.min
    : (value - range.max) / range.max;
  return pctOff > 0.25 ? "critical" : "suboptimal";
}

/* ═══════════════════════════════════════════════════════════════
   getBioIdentityState — Main query for the Digital Twin
   ═══════════════════════════════════════════════════════════════ */
export const getBioIdentityState = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<BioIdentityState> => {
    const now = Date.now();

    /* ── Pull all data sources ── */
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const vitals = await ctx.db
      .query("userVitals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Latest somatic feedback (last 48h)
    const cutoff48h = now - 48 * 60 * 60 * 1000;
    const somaticLogs = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff48h)
      )
      .collect();

    // Latest sleep log
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(3);

    // HRV readings (last 7 days)
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    // Vive Age history
    const ageHistory = await ctx.db
      .query("viveAgeHistory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(7);

    // Protocol adherence (last 7 days)
    const adherenceRecords = await ctx.db
      .query("adherenceScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(7);

    // Workout logs (last 7 days)
    const workoutLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff7d)
      )
      .collect();

    // Elite score
    const eliteScores = await ctx.db
      .query("eliteScores")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(1);

    /* ── Extract somatic channel values ── */
    const somaticMap: Record<string, number> = {};
    for (const log of somaticLogs) {
      // Keep latest per channel
      if (!somaticMap[log.channel] || log.loggedAt > (somaticMap[`${log.channel}_at`] || 0)) {
        somaticMap[log.channel] = log.value;
        somaticMap[`${log.channel}_at`] = log.loggedAt;
      }
    }

    /* ── Compute data completeness ── */
    let dataPoints = 0;
    let maxPoints = 20;
    if (bioVault) {
      if (bioVault.vitaminD != null) dataPoints++;
      if (bioVault.testosteroneTotal != null) dataPoints++;
      if (bioVault.testosteroneFree != null) dataPoints++;
      if (bioVault.ferritin != null) dataPoints++;
      if (bioVault.crp != null) dataPoints++;
      if (bioVault.hba1c != null) dataPoints++;
      if (bioVault.igf1 != null) dataPoints++;
      if (bioVault.fastingGlucose != null) dataPoints++;
      if (bioVault.hrvCurrent != null) dataPoints++;
      if (bioVault.sleepScore != null) dataPoints++;
    }
    if (sleepLogs.length > 0) dataPoints += 2;
    if (hrvReadings.length > 0) dataPoints += 2;
    if (somaticLogs.length > 0) dataPoints += 2;
    if (workoutLogs.length > 0) dataPoints++;
    if (vitals) dataPoints++;
    if (adherenceRecords.length > 0) dataPoints += 2;
    const dataCompleteness = Math.min(100, Math.round((dataPoints / maxPoints) * 100));

    /* ── Compute per-system scores ── */
    const latestSleep = sleepLogs[0] || null;
    const avgAdherence = adherenceRecords.length > 0
      ? adherenceRecords.reduce((s, r) => s + r.adherencePercent, 0) / adherenceRecords.length
      : 50;

    const systems: SystemState[] = [];

    // 1. NERVOUS SYSTEM
    const nervousMarkers: SystemState["markers"] = [];
    let nervousScore = 65;
    const neuralDrive = somaticMap["neural_drive"];
    const mentalClarity = somaticMap["mental_clarity"];
    if (neuralDrive != null) {
      nervousScore = neuralDrive;
      nervousMarkers.push({ name: "Neural Drive", value: `${neuralDrive}/100`, status: neuralDrive > 70 ? "optimal" : neuralDrive > 40 ? "suboptimal" : "critical" });
    }
    if (mentalClarity != null) {
      nervousScore = neuralDrive != null ? Math.round((nervousScore + mentalClarity) / 2) : mentalClarity;
      nervousMarkers.push({ name: "Mental Clarity", value: `${mentalClarity}/100`, status: mentalClarity > 70 ? "optimal" : mentalClarity > 40 ? "suboptimal" : "critical" });
    }
    if (bioVault?.hrvCurrent) {
      const hrvScore = Math.min(100, Math.round((bioVault.hrvCurrent / 80) * 100));
      nervousScore = nervousMarkers.length > 0 ? Math.round((nervousScore + hrvScore) / 2) : hrvScore;
      nervousMarkers.push({ name: "HRV", value: `${bioVault.hrvCurrent}ms`, status: bioVault.hrvCurrent > 50 ? "optimal" : bioVault.hrvCurrent > 30 ? "suboptimal" : "critical" });
    }
    systems.push({
      system: "nervous", label: "Nervous System", score: nervousScore,
      thermal: scoreToThermal(nervousScore), icon: "🧠",
      primaryDriver: neuralDrive != null ? "Neural Drive" : bioVault?.hrvCurrent ? "HRV" : "Baseline",
      trend: "unknown", markers: nervousMarkers,
    });

    // 2. CARDIOVASCULAR
    const cardioMarkers: SystemState["markers"] = [];
    let cardioScore = 65;
    if (bioVault?.hrvCurrent && bioVault?.hrvBaseline) {
      const ratio = bioVault.hrvCurrent / bioVault.hrvBaseline;
      cardioScore = Math.min(100, Math.round(ratio * 80));
      cardioMarkers.push({ name: "HRV Ratio", value: `${Math.round(ratio * 100)}%`, status: ratio > 0.9 ? "optimal" : ratio > 0.7 ? "suboptimal" : "critical" });
    }
    const crpScore = markerScore("crp", bioVault?.crp);
    if (crpScore >= 0) {
      cardioScore = cardioMarkers.length > 0 ? Math.round((cardioScore + crpScore) / 2) : crpScore;
      cardioMarkers.push({ name: "hs-CRP", value: `${bioVault?.crp?.toFixed(1)} mg/L`, status: markerStatus("crp", bioVault?.crp) });
    }
    systems.push({
      system: "cardiovascular", label: "Cardiovascular", score: cardioScore,
      thermal: scoreToThermal(cardioScore), icon: "❤️",
      primaryDriver: crpScore >= 0 ? "hs-CRP" : "HRV Baseline",
      trend: "unknown", markers: cardioMarkers,
    });

    // 3. METABOLIC
    const metaMarkers: SystemState["markers"] = [];
    const scores: number[] = [];
    const hba1cS = markerScore("hba1c", bioVault?.hba1c);
    if (hba1cS >= 0) { scores.push(hba1cS); metaMarkers.push({ name: "HbA1c", value: `${bioVault?.hba1c}%`, status: markerStatus("hba1c", bioVault?.hba1c) }); }
    const glucS = markerScore("fastingGlucose", bioVault?.fastingGlucose);
    if (glucS >= 0) { scores.push(glucS); metaMarkers.push({ name: "Fasting Glucose", value: `${bioVault?.fastingGlucose} mg/dL`, status: markerStatus("fastingGlucose", bioVault?.fastingGlucose) }); }
    const igfS = markerScore("igf1", bioVault?.igf1);
    if (igfS >= 0) { scores.push(igfS); metaMarkers.push({ name: "IGF-1", value: `${bioVault?.igf1} ng/mL`, status: markerStatus("igf1", bioVault?.igf1) }); }
    const metaScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 60;
    systems.push({
      system: "metabolic", label: "Metabolic", score: metaScore,
      thermal: scoreToThermal(metaScore), icon: "⚡",
      primaryDriver: scores.length > 0 ? metaMarkers[0].name : "Baseline",
      trend: "unknown", markers: metaMarkers,
    });

    // 4. ENDOCRINE
    const endoMarkers: SystemState["markers"] = [];
    const endoScores: number[] = [];
    const tTotalS = markerScore("testosteroneTotal", bioVault?.testosteroneTotal);
    if (tTotalS >= 0) { endoScores.push(tTotalS); endoMarkers.push({ name: "Total T", value: `${bioVault?.testosteroneTotal} ng/dL`, status: markerStatus("testosteroneTotal", bioVault?.testosteroneTotal) }); }
    const tFreeS = markerScore("testosteroneFree", bioVault?.testosteroneFree);
    if (tFreeS >= 0) { endoScores.push(tFreeS); endoMarkers.push({ name: "Free T", value: `${bioVault?.testosteroneFree} pg/mL`, status: markerStatus("testosteroneFree", bioVault?.testosteroneFree) }); }
    // Sleep as cortisol proxy
    if (latestSleep) {
      const sleepScore = Math.min(100, Math.round(latestSleep.sleepScore));
      endoScores.push(sleepScore);
      endoMarkers.push({ name: "Sleep (Cortisol Proxy)", value: `${sleepScore}/100`, status: sleepScore > 75 ? "optimal" : sleepScore > 50 ? "suboptimal" : "critical" });
    }
    const endoScore = endoScores.length > 0 ? Math.round(endoScores.reduce((a, b) => a + b, 0) / endoScores.length) : 60;
    systems.push({
      system: "endocrine", label: "Endocrine", score: endoScore,
      thermal: scoreToThermal(endoScore), icon: "🧬",
      primaryDriver: endoMarkers.length > 0 ? endoMarkers[0].name : "Baseline",
      trend: "unknown", markers: endoMarkers,
    });

    // 5. IMMUNE
    const immuneMarkers: SystemState["markers"] = [];
    const immuneScores: number[] = [];
    if (crpScore >= 0) { immuneScores.push(crpScore); immuneMarkers.push({ name: "hs-CRP", value: `${bioVault?.crp?.toFixed(1)} mg/L`, status: markerStatus("crp", bioVault?.crp) }); }
    const vitDScore = markerScore("vitaminD", bioVault?.vitaminD);
    if (vitDScore >= 0) { immuneScores.push(vitDScore); immuneMarkers.push({ name: "Vitamin D", value: `${bioVault?.vitaminD} ng/mL`, status: markerStatus("vitaminD", bioVault?.vitaminD) }); }
    const ferScore = markerScore("ferritin", bioVault?.ferritin);
    if (ferScore >= 0) { immuneScores.push(ferScore); immuneMarkers.push({ name: "Ferritin", value: `${bioVault?.ferritin} ng/mL`, status: markerStatus("ferritin", bioVault?.ferritin) }); }
    const immuneScore = immuneScores.length > 0 ? Math.round(immuneScores.reduce((a, b) => a + b, 0) / immuneScores.length) : 60;
    systems.push({
      system: "immune", label: "Immune", score: immuneScore,
      thermal: scoreToThermal(immuneScore), icon: "🛡️",
      primaryDriver: immuneMarkers.length > 0 ? immuneMarkers[0].name : "Baseline",
      trend: "unknown", markers: immuneMarkers,
    });

    // 6. MUSCULOSKELETAL
    const msMarkers: SystemState["markers"] = [];
    let msScore = 60;
    const jointMobility = somaticMap["joint_mobility"];
    if (jointMobility != null) {
      msScore = jointMobility;
      msMarkers.push({ name: "Joint Mobility", value: `${jointMobility}/100`, status: jointMobility > 70 ? "optimal" : jointMobility > 40 ? "suboptimal" : "critical" });
    }
    if (workoutLogs.length > 0) {
      const workoutScore = Math.min(100, Math.round(workoutLogs.length * 15 + 40));
      msScore = msMarkers.length > 0 ? Math.round((msScore + workoutScore) / 2) : workoutScore;
      msMarkers.push({ name: "Training Volume", value: `${workoutLogs.length} sessions/7d`, status: workoutLogs.length >= 3 ? "optimal" : workoutLogs.length >= 1 ? "suboptimal" : "critical" });
    }
    systems.push({
      system: "musculoskeletal", label: "Musculoskeletal", score: msScore,
      thermal: scoreToThermal(msScore), icon: "💪",
      primaryDriver: msMarkers.length > 0 ? msMarkers[0].name : "Baseline",
      trend: "unknown", markers: msMarkers,
    });

    // 7. DIGESTIVE
    const digestMarkers: SystemState["markers"] = [];
    let digestScore = 65;
    const gutStatus = somaticMap["gut_status"];
    if (gutStatus != null) {
      digestScore = gutStatus;
      digestMarkers.push({ name: "Gut Status", value: `${gutStatus}/100`, status: gutStatus > 70 ? "optimal" : gutStatus > 40 ? "suboptimal" : "critical" });
    }
    // Protocol adherence as dietary proxy
    if (avgAdherence > 0) {
      const adhScore = Math.round(avgAdherence);
      digestScore = digestMarkers.length > 0 ? Math.round((digestScore + adhScore) / 2) : adhScore;
      digestMarkers.push({ name: "Protocol Adherence", value: `${Math.round(avgAdherence)}%`, status: avgAdherence > 80 ? "optimal" : avgAdherence > 50 ? "suboptimal" : "critical" });
    }
    systems.push({
      system: "digestive", label: "Digestive", score: digestScore,
      thermal: scoreToThermal(digestScore), icon: "🦠",
      primaryDriver: digestMarkers.length > 0 ? digestMarkers[0].name : "Baseline",
      trend: "unknown", markers: digestMarkers,
    });

    // 8. RESPIRATORY
    const respMarkers: SystemState["markers"] = [];
    let respScore = 70;
    if (latestSleep) {
      respScore = Math.round(latestSleep.efficiency);
      respMarkers.push({ name: "Sleep Efficiency", value: `${latestSleep.efficiency}%`, status: latestSleep.efficiency > 85 ? "optimal" : latestSleep.efficiency > 70 ? "suboptimal" : "critical" });
      if (latestSleep.respiratoryRate) {
        const rrScore = latestSleep.respiratoryRate >= 12 && latestSleep.respiratoryRate <= 18 ? 90 : 55;
        respScore = Math.round((respScore + rrScore) / 2);
        respMarkers.push({ name: "Respiratory Rate", value: `${latestSleep.respiratoryRate} bpm`, status: rrScore > 70 ? "optimal" : "suboptimal" });
      }
    }
    const coreTemp = somaticMap["core_temp"];
    if (coreTemp != null) {
      const tempScore = coreTemp > 30 && coreTemp < 70 ? 85 : coreTemp > 70 ? Math.max(20, 100 - coreTemp) : 50;
      respScore = respMarkers.length > 0 ? Math.round((respScore + tempScore) / 2) : tempScore;
      respMarkers.push({ name: "Core Temperature", value: `${coreTemp}/100`, status: tempScore > 70 ? "optimal" : tempScore > 40 ? "suboptimal" : "critical" });
    }
    systems.push({
      system: "respiratory", label: "Respiratory", score: respScore,
      thermal: scoreToThermal(respScore), icon: "🫁",
      primaryDriver: respMarkers.length > 0 ? respMarkers[0].name : "Baseline",
      trend: "unknown", markers: respMarkers,
    });

    /* ── Compute trends from age history ── */
    if (ageHistory.length >= 2) {
      // Simple trend: compare latest vs 3-day-ago
      // This is a proxy — real trend would need per-system history
    }

    /* ── Overall score ── */
    const overallScore = Math.round(systems.reduce((s, sys) => s + sys.score, 0) / systems.length);

    /* ── Critical alerts ── */
    const criticalAlerts: string[] = [];
    for (const sys of systems) {
      if (sys.thermal === "critical") {
        criticalAlerts.push(`${sys.label}: Critical — ${sys.primaryDriver} requires immediate attention`);
      } else if (sys.thermal === "hot") {
        criticalAlerts.push(`${sys.label}: Elevated — ${sys.primaryDriver} trending toward threshold`);
      }
    }

    /* ── Dominant system (lowest score = most attention needed) ── */
    const sorted = [...systems].sort((a, b) => a.score - b.score);
    const dominantSystem = sorted[0]?.system || "nervous";

    /* ── Biological age ── */
    const latestAge = ageHistory[0] || null;

    return {
      overallScore,
      overallThermal: scoreToThermal(overallScore),
      biologicalAge: latestAge?.viveAge ?? null,
      chronologicalAge: latestAge?.chronoAge ?? (vitals?.age ?? null),
      ageDelta: latestAge?.delta ?? null,
      systems,
      dominantSystem,
      criticalAlerts,
      lastUpdated: now,
      dataCompleteness,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   saveBioIdentitySnapshot — Persist avatar state for fast reload
   ═══════════════════════════════════════════════════════════════ */
export const saveBioIdentitySnapshot = mutation({
  args: {
    sessionId: v.string(),
    overallScore: v.number(),
    overallThermal: v.string(),
    systemScores: v.string(), // JSON stringified
    dataCompleteness: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bioIdentityState")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const data = {
      sessionId: args.sessionId,
      overallScore: args.overallScore,
      overallThermal: args.overallThermal,
      systemScores: args.systemScores,
      dataCompleteness: args.dataCompleteness,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("bioIdentityState", data);
  },
});
