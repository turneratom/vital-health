import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   SOMATIC CORRELATION ENGINE
   
   Cross-references subjective check-in data (Flow State, Physical
   Readiness) with objective biomarkers from BioVault + lab results
   to produce a unified "Subjective ↔ Objective" correlation view
   for the Trajectory Canvas.
   
   Returns:
   • Correlation coefficient between subjective scores and biomarkers
   • 24-hour bio-age micro-shift based on today's check-in
   • Flagged protocol correlations (e.g., BPC-157 + joint pain)
   • Historical trend overlay data for TrajectoryCanvas
   • Body map region heat data with meal correlations
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker → Subjective Channel Mapping ── */
const BIOMARKER_SUBJECTIVE_MAP: Record<string, {
  subjectiveChannel: "flow_state" | "physical_readiness";
  weight: number;
  optimalRange: [number, number];
  unit: string;
  label: string;
}> = {
  crp: {
    subjectiveChannel: "physical_readiness",
    weight: 0.25,
    optimalRange: [0, 1.0],
    unit: "mg/L",
    label: "hs-CRP (Inflammation)",
  },
  hba1c: {
    subjectiveChannel: "flow_state",
    weight: 0.15,
    optimalRange: [4.0, 5.4],
    unit: "%",
    label: "HbA1c (Metabolic)",
  },
  vitaminD: {
    subjectiveChannel: "flow_state",
    weight: 0.15,
    optimalRange: [40, 60],
    unit: "ng/mL",
    label: "Vitamin D",
  },
  testosteroneTotal: {
    subjectiveChannel: "flow_state",
    weight: 0.20,
    optimalRange: [500, 900],
    unit: "ng/dL",
    label: "Total Testosterone",
  },
  ferritin: {
    subjectiveChannel: "physical_readiness",
    weight: 0.10,
    optimalRange: [40, 150],
    unit: "ng/mL",
    label: "Ferritin (Iron)",
  },
  hrvCurrent: {
    subjectiveChannel: "flow_state",
    weight: 0.25,
    optimalRange: [45, 80],
    unit: "ms",
    label: "HRV (Autonomic)",
  },
  sleepScore: {
    subjectiveChannel: "physical_readiness",
    weight: 0.25,
    optimalRange: [75, 100],
    unit: "score",
    label: "Sleep Quality",
  },
};

function scoreBiomarkerNormalized(value: number, range: [number, number]): number {
  const [low, high] = range;
  const mid = (low + high) / 2;
  const halfRange = (high - low) / 2 || 1;
  if (value >= low && value <= high) {
    return 60 + 40 * (1 - Math.abs(value - mid) / halfRange);
  }
  if (value < low) {
    const deficit = (low - value) / (low || 1);
    return Math.max(10, 60 - deficit * 50);
  }
  const excess = (value - high) / (high || 1);
  return Math.max(10, 60 - excess * 50);
}

/* ── Protocol → Pain/Symptom Correlation ── */
const PROTOCOL_SYMPTOM_CORRELATIONS: Record<string, {
  expectedSymptoms: Array<{
    channel: string;
    direction: "increase" | "decrease";
    onsetDays: number;
    peakDays: number;
    description: string;
  }>;
}> = {
  "bpc-157": {
    expectedSymptoms: [
      { channel: "physical_readiness", direction: "increase", onsetDays: 3, peakDays: 14, description: "Joint/tissue repair acceleration — temporary inflammation possible in first 72h" },
    ],
  },
  "tb-500": {
    expectedSymptoms: [
      { channel: "physical_readiness", direction: "increase", onsetDays: 5, peakDays: 21, description: "Systemic tissue repair — mobility improvement expected after day 5" },
    ],
  },
  "mk-677": {
    expectedSymptoms: [
      { channel: "physical_readiness", direction: "decrease", onsetDays: 1, peakDays: 7, description: "Water retention and joint stiffness common in first week" },
      { channel: "flow_state", direction: "increase", onsetDays: 7, peakDays: 30, description: "Improved sleep quality → better cognitive performance" },
    ],
  },
  "semaglutide": {
    expectedSymptoms: [
      { channel: "physical_readiness", direction: "decrease", onsetDays: 1, peakDays: 14, description: "GI discomfort and fatigue common during titration" },
      { channel: "flow_state", direction: "decrease", onsetDays: 1, peakDays: 7, description: "Appetite suppression may reduce energy and focus initially" },
    ],
  },
  "testosterone": {
    expectedSymptoms: [
      { channel: "flow_state", direction: "increase", onsetDays: 14, peakDays: 42, description: "Cognitive sharpness and motivation improvement" },
      { channel: "physical_readiness", direction: "increase", onsetDays: 21, peakDays: 60, description: "Recovery capacity and physical output increase" },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════
   MEAL → BODY REGION CORRELATION MAP
   
   Maps food properties to body regions they're known to affect.
   Used to generate AI-style correlations between logged meals
   and somatic complaints.
   ═══════════════════════════════════════════════════════════════ */

const INFLAMMATORY_FOOD_KEYWORDS: Record<string, {
  regions: string[];
  mechanism: string;
  delayHours: [number, number]; // min-max hours for symptom onset
}> = {
  // High-lectin foods
  "beans": { regions: ["gut", "abdomen"], mechanism: "Lectin-mediated gut lining irritation → systemic inflammation cascade", delayHours: [2, 6] },
  "lentils": { regions: ["gut", "abdomen"], mechanism: "Lectin + phytate load → intestinal permeability increase", delayHours: [2, 6] },
  "peanut": { regions: ["gut", "abdomen", "head"], mechanism: "Aflatoxin + lectin burden → gut-brain axis disruption", delayHours: [1, 4] },
  "tomato": { regions: ["gut", "abdomen"], mechanism: "Nightshade alkaloids + lectins → mucosal irritation", delayHours: [2, 8] },
  "potato": { regions: ["gut", "abdomen"], mechanism: "Solanine + glycoalkaloids → intestinal barrier stress", delayHours: [3, 8] },
  "eggplant": { regions: ["gut", "abdomen"], mechanism: "Nightshade solanine → inflammatory cytokine release", delayHours: [2, 6] },
  // High-glycemic / processed
  "bread": { regions: ["gut", "abdomen", "head"], mechanism: "Gluten + high-glycemic spike → neuroinflammation + gut permeability", delayHours: [1, 4] },
  "pasta": { regions: ["gut", "abdomen", "head"], mechanism: "Refined carb spike → insulin surge → inflammatory cascade", delayHours: [1, 3] },
  "sugar": { regions: ["head", "gut"], mechanism: "Glucose spike → AGE formation → oxidative stress in neural tissue", delayHours: [0.5, 2] },
  "candy": { regions: ["head", "gut"], mechanism: "Rapid glucose → insulin spike → reactive hypoglycemia → brain fog", delayHours: [0.5, 2] },
  "soda": { regions: ["gut", "head"], mechanism: "Phosphoric acid + fructose → hepatic lipogenesis + gut dysbiosis", delayHours: [0.5, 3] },
  "pizza": { regions: ["gut", "abdomen", "chest"], mechanism: "Gluten + casein + high-glycemic load → multi-system inflammation", delayHours: [1, 4] },
  "fries": { regions: ["gut", "abdomen"], mechanism: "Acrylamide + oxidized seed oils → lipid peroxidation + gut stress", delayHours: [1, 4] },
  "burger": { regions: ["gut", "abdomen"], mechanism: "Advanced glycation end-products from high-heat cooking → systemic inflammation", delayHours: [2, 6] },
  // Dairy
  "milk": { regions: ["gut", "abdomen"], mechanism: "A1 casein → beta-casomorphin-7 → intestinal inflammation", delayHours: [1, 4] },
  "cheese": { regions: ["gut", "abdomen", "head"], mechanism: "Casein + tyramine → histamine response + gut barrier stress", delayHours: [2, 6] },
  "ice cream": { regions: ["gut", "abdomen"], mechanism: "Lactose + sugar + emulsifiers → microbiome disruption", delayHours: [1, 3] },
  // Seed oils
  "fried": { regions: ["gut", "abdomen", "chest"], mechanism: "Oxidized omega-6 → lipid peroxidation → vascular inflammation", delayHours: [2, 8] },
  // Alcohol
  "beer": { regions: ["gut", "abdomen", "head"], mechanism: "Ethanol + gluten → gut permeability + acetaldehyde neurotoxicity", delayHours: [1, 12] },
  "wine": { regions: ["head", "gut"], mechanism: "Histamine + sulfites → vasodilation headache + gut irritation", delayHours: [0.5, 8] },
  "alcohol": { regions: ["head", "gut", "abdomen"], mechanism: "Ethanol → acetaldehyde → mitochondrial dysfunction + gut dysbiosis", delayHours: [1, 12] },
  // Anti-inflammatory (positive)
  "salmon": { regions: ["head", "shoulders", "lower_back"], mechanism: "EPA/DHA → resolvin synthesis → active inflammation resolution", delayHours: [4, 24] },
  "turmeric": { regions: ["gut", "shoulders", "lower_back"], mechanism: "Curcumin → NF-κB inhibition → systemic anti-inflammatory effect", delayHours: [2, 12] },
  "blueberr": { regions: ["head"], mechanism: "Anthocyanins → BDNF upregulation → neuroprotective cascade", delayHours: [2, 8] },
  "broccoli": { regions: ["gut", "chest"], mechanism: "Sulforaphane → Nrf2 pathway activation → cellular defense upregulation", delayHours: [4, 24] },
  "avocado": { regions: ["gut", "abdomen"], mechanism: "Oleic acid + glutathione precursors → gut barrier reinforcement", delayHours: [2, 8] },
  "ginger": { regions: ["gut", "abdomen"], mechanism: "Gingerols → COX-2 inhibition → GI motility improvement", delayHours: [1, 4] },
  "green tea": { regions: ["head", "gut"], mechanism: "EGCG → autophagy activation + gut microbiome diversity support", delayHours: [1, 6] },
  "bone broth": { regions: ["gut", "shoulders", "lower_back"], mechanism: "Glycine + proline → collagen synthesis + intestinal lining repair", delayHours: [2, 12] },
  "sardine": { regions: ["head", "shoulders"], mechanism: "Omega-3 + CoQ10 → mitochondrial membrane integrity + neural repair", delayHours: [4, 24] },
  "walnut": { regions: ["head"], mechanism: "ALA + polyphenols → neuroinflammation reduction + BDNF support", delayHours: [4, 24] },
};

/* ── Body Region Canonical Names ── */
const REGION_ALIASES: Record<string, string> = {
  "stomach": "gut", "belly": "gut", "digestive": "gut", "intestine": "gut", "gi": "gut", "bloat": "gut", "nausea": "gut",
  "brain": "head", "temple": "head", "forehead": "head", "migraine": "head", "headache": "head", "foggy": "head", "fog": "head", "cognitive": "head",
  "neck": "neck", "cervical": "neck", "throat": "neck",
  "shoulder": "shoulders", "trap": "shoulders", "deltoid": "shoulders", "rotator": "shoulders",
  "chest": "chest", "pec": "chest", "thorax": "chest", "rib": "chest", "sternum": "chest", "heart": "chest",
  "upper back": "upper_back", "thoracic": "upper_back", "mid back": "upper_back", "rhomboid": "upper_back",
  "lower back": "lower_back", "lumbar": "lower_back", "sacral": "lower_back", "sciatica": "lower_back", "back": "lower_back",
  "hip": "hips", "glute": "hips", "pelvis": "hips", "groin": "hips",
  "knee": "knees", "patella": "knees", "meniscus": "knees",
  "leg": "legs", "quad": "legs", "hamstring": "legs", "calf": "legs", "shin": "legs", "thigh": "legs",
  "ankle": "feet", "foot": "feet", "plantar": "feet", "achilles": "feet", "toe": "feet",
  "arm": "arms", "bicep": "arms", "tricep": "arms", "elbow": "arms", "forearm": "arms", "wrist": "arms", "hand": "arms",
  "abdomen": "abdomen", "core": "abdomen", "abs": "abdomen", "oblique": "abdomen",
  "skin": "skin", "rash": "skin", "itch": "skin", "acne": "skin",
};

function normalizeRegion(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (REGION_ALIASES[lower]) return REGION_ALIASES[lower];
  for (const [alias, canonical] of Object.entries(REGION_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  return lower;
}

/* ═══════════════════════════════════════════════════════════════
   QUERY: getSomaticBioCorrelation
   Returns the full subjective ↔ objective correlation analysis
   ═══════════════════════════════════════════════════════════════ */
export const getSomaticBioCorrelation = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const now = Date.now();
    const day7 = now - 7 * 86400000;

    // 1. Get BioVault data
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    // 2. Get recent somatic entries (last 7 days)
    const somaticEntries = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", sessionId).gte("loggedAt", day7)
      )
      .order("desc")
      .collect();

    // 3. Get active substance cycles
    let activeCycles: any[] = [];
    try {
      const cycles = await ctx.db
        .query("substanceCycles")
        .withIndex("by_sessionId_and_status", (q: any) =>
          q.eq("sessionId", sessionId).eq("status", "active")
        )
        .collect();
      activeCycles = cycles;
    } catch { /* ok */ }

    // 4. Compute objective biomarker scores
    const biomarkerScores: Array<{
      key: string;
      label: string;
      value: number | null;
      unit: string;
      normalizedScore: number;
      status: "optimal" | "suboptimal" | "critical";
      subjectiveChannel: string;
    }> = [];

    const vaultData: Record<string, number | null | undefined> = vault ? {
      crp: vault.crp,
      hba1c: vault.hba1c,
      vitaminD: vault.vitaminD,
      testosteroneTotal: vault.testosteroneTotal,
      ferritin: vault.ferritin,
      hrvCurrent: vault.hrvCurrent,
      sleepScore: vault.sleepScore,
    } : {};

    let objectiveFlowScore = 0;
    let objectivePhysicalScore = 0;
    let flowWeightTotal = 0;
    let physicalWeightTotal = 0;

    for (const [key, mapping] of Object.entries(BIOMARKER_SUBJECTIVE_MAP)) {
      const rawValue = vaultData[key];
      const hasValue = rawValue != null && typeof rawValue === "number" && rawValue > 0;
      const normalized = hasValue ? scoreBiomarkerNormalized(rawValue!, mapping.optimalRange) : 50;
      const status: "optimal" | "suboptimal" | "critical" = normalized >= 70 ? "optimal" : normalized >= 40 ? "suboptimal" : "critical";

      biomarkerScores.push({
        key,
        label: mapping.label,
        value: hasValue ? rawValue! : null,
        unit: mapping.unit,
        normalizedScore: Math.round(normalized),
        status,
        subjectiveChannel: mapping.subjectiveChannel,
      });

      if (hasValue) {
        if (mapping.subjectiveChannel === "flow_state") {
          objectiveFlowScore += normalized * mapping.weight;
          flowWeightTotal += mapping.weight;
        } else {
          objectivePhysicalScore += normalized * mapping.weight;
          physicalWeightTotal += mapping.weight;
        }
      }
    }

    const objFlow = flowWeightTotal > 0 ? objectiveFlowScore / flowWeightTotal : 50;
    const objPhysical = physicalWeightTotal > 0 ? objectivePhysicalScore / physicalWeightTotal : 50;

    // 5. Compute subjective averages from recent somatic data
    const flowEntries = somaticEntries.filter(e => e.channel === "flow_state" || e.channel === "neural_drive" || e.channel === "mental_clarity");
    const physicalEntries = somaticEntries.filter(e => e.channel === "physical_readiness" || e.channel === "joint_mobility" || e.channel === "energy_flux");

    const subjectiveFlow = flowEntries.length > 0
      ? flowEntries.reduce((s, e) => s + e.value, 0) / flowEntries.length
      : 50;
    const subjectivePhysical = physicalEntries.length > 0
      ? physicalEntries.reduce((s, e) => s + e.value, 0) / physicalEntries.length
      : 50;

    // 6. Compute correlation (how well subjective matches objective)
    const flowCorrelation = 100 - Math.abs(subjectiveFlow - objFlow);
    const physicalCorrelation = 100 - Math.abs(subjectivePhysical - objPhysical);
    const overallCorrelation = (flowCorrelation + physicalCorrelation) / 2;

    // 7. Detect protocol correlations
    const protocolFlags: Array<{
      protocolName: string;
      channel: string;
      daysOnProtocol: number;
      expectedEffect: string;
      currentSubjective: number;
      isAligned: boolean;
      suggestion: string;
    }> = [];

    for (const cycle of activeCycles) {
      const key = cycle.substanceName?.toLowerCase().replace(/[\s-]+/g, "-") ?? "";
      const mapping = PROTOCOL_SYMPTOM_CORRELATIONS[key];
      if (!mapping) continue;

      const daysOn = Math.floor((now - cycle.startedAt) / 86400000);

      for (const symptom of mapping.expectedSymptoms) {
        const relevantEntries = somaticEntries.filter(e =>
          e.channel === symptom.channel ||
          (symptom.channel === "physical_readiness" && (e.channel === "joint_mobility" || e.channel === "energy_flux")) ||
          (symptom.channel === "flow_state" && (e.channel === "neural_drive" || e.channel === "mental_clarity"))
        );
        const avgValue = relevantEntries.length > 0
          ? relevantEntries.reduce((s, e) => s + e.value, 0) / relevantEntries.length
          : 50;

        const isInOnsetWindow = daysOn >= symptom.onsetDays && daysOn <= symptom.peakDays;
        const isAligned = symptom.direction === "increase" ? avgValue >= 50 : avgValue <= 50;

        let suggestion = "";
        if (!isAligned && isInOnsetWindow) {
          if (symptom.direction === "increase" && avgValue < 40) {
            suggestion = `${cycle.substanceName} should be improving ${symptom.channel === "physical_readiness" ? "Physical Readiness" : "Flow State"} by day ${daysOn}. Consider dosage review or adding complementary protocol.`;
          } else if (symptom.direction === "decrease" && avgValue > 60) {
            suggestion = `Unexpected improvement in ${symptom.channel === "physical_readiness" ? "Physical Readiness" : "Flow State"} — ${cycle.substanceName} side effects may be resolving faster than expected.`;
          }
        } else if (!isAligned && daysOn < symptom.onsetDays) {
          suggestion = `${cycle.substanceName} effects on ${symptom.channel === "physical_readiness" ? "Physical Readiness" : "Flow State"} expected to begin around day ${symptom.onsetDays}. Currently day ${daysOn}.`;
        }

        protocolFlags.push({
          protocolName: cycle.substanceName,
          channel: symptom.channel,
          daysOnProtocol: daysOn,
          expectedEffect: symptom.description,
          currentSubjective: Math.round(avgValue),
          isAligned,
          suggestion,
        });
      }
    }

    // 8. Compute 24h bio-age micro-shift from today's check-in
    const todayEntries = somaticEntries.filter(e => e.loggedAt >= now - 86400000);
    const todayAvg = todayEntries.length > 0
      ? todayEntries.reduce((s, e) => s + e.value, 0) / todayEntries.length
      : 50;

    const subjectiveShift = ((todayAvg - 50) / 50) * -0.3;

    // 9. Build 7-day history for trajectory overlay
    const dailyHistory: Array<{
      dayOffset: number;
      subjectiveAvg: number;
      objectiveAvg: number;
    }> = [];

    for (let d = 6; d >= 0; d--) {
      const dayStart = now - (d + 1) * 86400000;
      const dayEnd = now - d * 86400000;
      const dayEntries = somaticEntries.filter(e => e.loggedAt >= dayStart && e.loggedAt < dayEnd);
      const dayAvg = dayEntries.length > 0
        ? dayEntries.reduce((s, e) => s + e.value, 0) / dayEntries.length
        : -1;

      dailyHistory.push({
        dayOffset: 6 - d,
        subjectiveAvg: dayAvg >= 0 ? Math.round(dayAvg) : -1,
        objectiveAvg: Math.round((objFlow + objPhysical) / 2),
      });
    }

    return {
      subjectiveFlow: Math.round(subjectiveFlow),
      subjectivePhysical: Math.round(subjectivePhysical),
      objectiveFlow: Math.round(objFlow),
      objectivePhysical: Math.round(objPhysical),
      flowCorrelation: Math.round(flowCorrelation),
      physicalCorrelation: Math.round(physicalCorrelation),
      overallCorrelation: Math.round(overallCorrelation),
      biomarkerScores,
      protocolFlags,
      subjectiveBioAgeShift: +subjectiveShift.toFixed(2),
      dailyHistory,
      totalCheckIns: somaticEntries.length,
      hasVaultData: vault != null,
      generatedAt: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   QUERY: getBodyMapData
   
   Aggregates body map entries + recent food logs to produce:
   • Per-region heat intensity (severity × recency)
   • Meal correlations for each active region
   • AI-generated insight strings per region
   • Recurring pattern flags (3+ days same region)
   ═══════════════════════════════════════════════════════════════ */
export const getBodyMapData = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const now = Date.now();
    const day3 = now - 3 * 86400000;
    const day7 = now - 7 * 86400000;
    const hours24 = now - 24 * 3600000;
    const hours12 = now - 12 * 3600000;

    // 1. Get body map entries (last 7 days)
    const bodyEntries = await ctx.db
      .query("bodyMapEntries")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", sessionId).gte("loggedAt", day7)
      )
      .order("desc")
      .collect();

    // 2. Get recent food logs (last 24 hours for correlation)
    const recentMeals = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .order("desc")
      .collect();
    const meals24h = recentMeals.filter(m => m.loggedAt >= hours24).slice(0, 20);

    // 3. Get BioVault for biometric context
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .first();

    // 4. Get somatic feedback for additional context
    const somaticRecent = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", sessionId).gte("loggedAt", day3)
      )
      .order("desc")
      .collect();

    // 5. Aggregate body map regions
    const regionMap: Record<string, {
      region: string;
      totalSeverity: number;
      entryCount: number;
      maxSeverity: number;
      latestAt: number;
      descriptions: string[];
      consecutiveDays: number;
    }> = {};

    for (const entry of bodyEntries) {
      const region = normalizeRegion(entry.region);
      if (!regionMap[region]) {
        regionMap[region] = {
          region,
          totalSeverity: 0,
          entryCount: 0,
          maxSeverity: 0,
          latestAt: 0,
          descriptions: [],
          consecutiveDays: 0,
        };
      }
      const r = regionMap[region];
      r.totalSeverity += entry.severity;
      r.entryCount++;
      r.maxSeverity = Math.max(r.maxSeverity, entry.severity);
      r.latestAt = Math.max(r.latestAt, entry.loggedAt);
      if (entry.description && r.descriptions.length < 5) {
        r.descriptions.push(entry.description);
      }
    }

    // 6. Compute consecutive days for recurring pattern detection
    for (const region of Object.keys(regionMap)) {
      const regionEntries = bodyEntries.filter(e => normalizeRegion(e.region) === region);
      const daySet = new Set<string>();
      for (const e of regionEntries) {
        daySet.add(new Date(e.loggedAt).toISOString().slice(0, 10));
      }
      const sortedDays = Array.from(daySet).sort().reverse();
      let consecutive = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < sortedDays.length; i++) {
        const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        if (sortedDays[i] === expected) {
          consecutive++;
        } else break;
      }
      regionMap[region].consecutiveDays = consecutive;
    }

    // 7. Correlate meals with body regions
    const mealCorrelations: Array<{
      region: string;
      mealName: string;
      mealLoggedAt: number;
      hoursAgo: number;
      mechanism: string;
      isAntiInflammatory: boolean;
      confidence: number;
    }> = [];

    for (const meal of meals24h) {
      const mealNameLower = meal.name.toLowerCase();
      for (const [keyword, info] of Object.entries(INFLAMMATORY_FOOD_KEYWORDS)) {
        if (mealNameLower.includes(keyword)) {
          const hoursAgo = (now - meal.loggedAt) / 3600000;
          const [minDelay, maxDelay] = info.delayHours;
          const isInWindow = hoursAgo >= minDelay && hoursAgo <= maxDelay + 4;
          const isAntiInflammatory = keyword === "salmon" || keyword === "turmeric" || keyword === "blueberr" || keyword === "broccoli" || keyword === "avocado" || keyword === "ginger" || keyword === "green tea" || keyword === "bone broth" || keyword === "sardine" || keyword === "walnut";

          for (const affectedRegion of info.regions) {
            // Check if user has reported symptoms in this region recently
            const hasSymptom = regionMap[affectedRegion] && regionMap[affectedRegion].latestAt >= hours12;
            const confidence = hasSymptom ? 0.85 : (isInWindow ? 0.6 : 0.3);

            if (confidence >= 0.3) {
              mealCorrelations.push({
                region: affectedRegion,
                mealName: meal.name,
                mealLoggedAt: meal.loggedAt,
                hoursAgo: Math.round(hoursAgo * 10) / 10,
                mechanism: info.mechanism,
                isAntiInflammatory,
                confidence,
              });
            }
          }
        }
      }
    }

    // 8. Build per-region heat + insight data
    const regions: Array<{
      region: string;
      heatIntensity: number; // 0-100
      severity: "none" | "low" | "moderate" | "high" | "critical";
      entryCount: number;
      maxSeverity: number;
      latestAt: number;
      descriptions: string[];
      consecutiveDays: number;
      isRecurring: boolean;
      mealCorrelations: Array<{
        mealName: string;
        hoursAgo: number;
        mechanism: string;
        isAntiInflammatory: boolean;
        confidence: number;
      }>;
      aiInsight: string | null;
    }> = [];

    for (const [regionKey, data] of Object.entries(regionMap)) {
      const avgSeverity = data.totalSeverity / data.entryCount;
      const recencyFactor = Math.max(0, 1 - (now - data.latestAt) / (7 * 86400000));
      const heatIntensity = Math.min(100, Math.round(avgSeverity * 12 * recencyFactor + data.entryCount * 3));
      const isRecurring = data.consecutiveDays >= 3;

      const severity: "none" | "low" | "moderate" | "high" | "critical" =
        heatIntensity >= 80 ? "critical" :
        heatIntensity >= 60 ? "high" :
        heatIntensity >= 35 ? "moderate" :
        heatIntensity >= 10 ? "low" : "none";

      // Get meal correlations for this region
      const regionMealCorrelations = mealCorrelations
        .filter(mc => mc.region === regionKey)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      // Generate AI insight
      let aiInsight: string | null = null;
      if (regionMealCorrelations.length > 0 && regionMealCorrelations[0].confidence >= 0.6) {
        const topCorrelation = regionMealCorrelations[0];
        if (topCorrelation.isAntiInflammatory) {
          aiInsight = `${topCorrelation.mealName} logged ${topCorrelation.hoursAgo.toFixed(1)}h ago may be providing anti-inflammatory support. ${topCorrelation.mechanism}`;
        } else {
          aiInsight = `Your ${regionKey} discomfort correlates with ${topCorrelation.mealName} logged ${topCorrelation.hoursAgo.toFixed(1)}h ago. ${topCorrelation.mechanism}`;
        }
      } else if (isRecurring) {
        aiInsight = `Recurring ${regionKey} pattern detected — ${data.consecutiveDays} consecutive days. Consider targeted mobility protocol or anti-inflammatory intervention.`;
      } else if (vault?.crp && vault.crp > 2.0 && (regionKey === "gut" || regionKey === "lower_back" || regionKey === "shoulders")) {
        aiInsight = `Elevated hs-CRP (${vault.crp} mg/L) may be contributing to ${regionKey} inflammation. Systemic inflammatory load detected.`;
      } else if (vault?.sleepScore && vault.sleepScore < 65 && regionKey === "head") {
        aiInsight = `Poor sleep quality (score: ${vault.sleepScore}) correlates with cognitive fog and head tension. Prioritize sleep hygiene tonight.`;
      }

      // Add somatic feedback context
      const gutSomatic = somaticRecent.filter(s => s.channel === "gut_status");
      if (regionKey === "gut" && gutSomatic.length > 0 && !aiInsight) {
        const avgGut = gutSomatic.reduce((s, e) => s + e.value, 0) / gutSomatic.length;
        if (avgGut < 40) {
          aiInsight = `Gut status has been below baseline (avg ${Math.round(avgGut)}/100) over the past 3 days. Consider eliminating high-lectin foods and adding L-glutamine.`;
        }
      }

      regions.push({
        region: regionKey,
        heatIntensity,
        severity,
        entryCount: data.entryCount,
        maxSeverity: data.maxSeverity,
        latestAt: data.latestAt,
        descriptions: data.descriptions,
        consecutiveDays: data.consecutiveDays,
        isRecurring,
        mealCorrelations: regionMealCorrelations.map(mc => ({
          mealName: mc.mealName,
          hoursAgo: mc.hoursAgo,
          mechanism: mc.mechanism,
          isAntiInflammatory: mc.isAntiInflammatory,
          confidence: mc.confidence,
        })),
        aiInsight,
      });
    }

    // Sort by heat intensity
    regions.sort((a, b) => b.heatIntensity - a.heatIntensity);

    // 9. Compute overall body stress score
    const totalHeat = regions.reduce((s, r) => s + r.heatIntensity, 0);
    const bodyStressScore = regions.length > 0 ? Math.min(100, Math.round(totalHeat / Math.max(regions.length, 1))) : 0;

    return {
      regions,
      bodyStressScore,
      totalActiveRegions: regions.filter(r => r.heatIntensity > 10).length,
      recurringPatterns: regions.filter(r => r.isRecurring).length,
      mealCorrelationsFound: mealCorrelations.length,
      recentMeals: meals24h.slice(0, 5).map(m => ({
        name: m.name,
        loggedAt: m.loggedAt,
        calories: m.calories,
        protein: m.protein,
      })),
      biometricContext: {
        crp: vault?.crp ?? null,
        sleepScore: vault?.sleepScore ?? null,
        hrvCurrent: vault?.hrvCurrent ?? null,
      },
      generatedAt: now,
    };
  },
});
