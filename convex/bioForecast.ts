import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE BIO-PROJECTION ENGINE
   
   Analyzes last 7 days of ProtocolStack adherence and projects
   likely biomarker trends for the next 7 days. Returns structured
   forecast data for the dashboard Forecast layer.
   ═══════════════════════════════════════════════════════════════ */

/* ── Protocol → Biomarker Impact Map ── */
const PROTOCOL_BIOMARKER_IMPACT: Record<string, { markers: string[]; weight: number }> = {
  supplement: { markers: ["vitaminD", "ferritin", "testosteroneFree"], weight: 0.8 },
  training: { markers: ["crp", "hba1c", "testosteroneTotal"], weight: 0.9 },
  biohacking: { markers: ["crp", "testosteroneTotal", "testosteroneFree"], weight: 0.7 },
  nutrition: { markers: ["hba1c", "ferritin", "crp"], weight: 0.75 },
  recovery: { markers: ["crp", "testosteroneTotal", "testosteroneFree", "hba1c"], weight: 0.85 },
  movement: { markers: ["hba1c", "crp"], weight: 0.6 },
};

/* ── Optimal ranges ── */
const OPTIMAL: Record<string, { min: number; max: number; unit: string; label: string; higherBetter: boolean }> = {
  vitaminD: { min: 40, max: 80, unit: "ng/mL", label: "Vitamin D", higherBetter: true },
  testosteroneTotal: { min: 400, max: 900, unit: "ng/dL", label: "Total T", higherBetter: true },
  testosteroneFree: { min: 15, max: 25, unit: "pg/mL", label: "Free T", higherBetter: true },
  ferritin: { min: 40, max: 200, unit: "ng/mL", label: "Ferritin", higherBetter: true },
  crp: { min: 0, max: 1.0, unit: "mg/L", label: "hs-CRP", higherBetter: false },
  hba1c: { min: 4.0, max: 5.6, unit: "%", label: "HbA1c", higherBetter: false },
};

/* ── Daily improvement rates per marker at 100% adherence (units/day) ── */
const DAILY_IMPROVEMENT_RATES: Record<string, number> = {
  vitaminD: 0.35,
  testosteroneTotal: 3.5,
  testosteroneFree: 0.08,
  ferritin: 0.25,
  crp: -0.015, // negative = decreasing is good
  hba1c: -0.003,
};

/* ── Decay rates when protocols are missed (units/day) ── */
const DAILY_DECAY_RATES: Record<string, number> = {
  vitaminD: -0.15,
  testosteroneTotal: -2.0,
  testosteroneFree: -0.04,
  ferritin: -0.1,
  crp: 0.02,
  hba1c: 0.002,
};

/** Compute a score 0-100 for how close a marker is to optimal */
function markerScore(key: string, value: number): number {
  const opt = OPTIMAL[key];
  if (!opt) return 50;
  if (opt.higherBetter) {
    if (value >= opt.min && value <= opt.max) return 100;
    if (value < opt.min) return Math.max(0, (value / opt.min) * 100);
    return Math.max(0, 100 - ((value - opt.max) / opt.max) * 50);
  } else {
    if (value >= opt.min && value <= opt.max) return 100;
    if (value > opt.max) return Math.max(0, 100 - ((value - opt.max) / opt.max) * 100);
    return 100; // below min for CRP/HbA1c is great
  }
}

/* ═══════════════════════════════════════════════════════════════
   TIME-TRAVEL PROJECTION ENGINE
   
   Projects biomarker trajectories up to +10 years (3650 days)
   using linear regression from current adherence patterns.
   Returns per-marker projected values, composite scores,
   and body-region thermal states for the SomaticBodyMap.
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker → Body Region Mapping ── */
const MARKER_BODY_REGIONS: Record<string, string[]> = {
  vitaminD: ["chest", "arms", "legs", "skin"],
  testosteroneTotal: ["abdomen", "chest", "arms", "legs"],
  testosteroneFree: ["abdomen", "chest", "arms"],
  ferritin: ["gut", "chest", "head"],
  crp: ["chest", "gut", "abdomen", "shoulders", "knees"],
  hba1c: ["gut", "abdomen", "feet", "head"],
};

/* ── Yearly decay multipliers (compounding biological aging) ── */
const AGING_DECAY_PER_YEAR: Record<string, number> = {
  vitaminD: -1.2,
  testosteroneTotal: -8.0,
  testosteroneFree: -0.3,
  ferritin: -0.8,
  crp: 0.08,
  hba1c: 0.02,
};

/* ── Protocol adherence offsets per year at 100% compliance ── */
const ADHERENCE_OFFSET_PER_YEAR: Record<string, number> = {
  vitaminD: 4.5,
  testosteroneTotal: 25,
  testosteroneFree: 0.6,
  ferritin: 3.0,
  crp: -0.12,
  hba1c: -0.04,
};

export const getTimeTravelProjection = query({
  args: { sessionId: v.string(), yearsForward: v.number() },
  handler: async (ctx, args) => {
    const years = Math.max(0, Math.min(10, args.yearsForward));
    const now = Date.now();

    /* ── 1. Get BioVault ── */
    const bioVaultDocs = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const bioVault = bioVaultDocs.length > 0 ? bioVaultDocs[bioVaultDocs.length - 1] : null;

    /* ── 2. Get 7-day adherence ── */
    const allCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const allProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = allProtocols.filter((p) => p.isActive);

    let totalCompleted = 0;
    let totalPossible = 0;
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const dayDone = allCompletions.filter((c) => c.dateKey === dateKey && c.completed).length;
      totalCompleted += dayDone;
      totalPossible += activeProtocols.length || 1;
    }
    const adherenceRate = totalPossible > 0 ? Math.min(1, totalCompleted / totalPossible) : 0;

    /* ── 3. Project each marker ── */
    const markerKeys = ["vitaminD", "testosteroneTotal", "testosteroneFree", "ferritin", "crp", "hba1c"] as const;
    const projections: Array<{
      key: string;
      label: string;
      unit: string;
      current: number;
      projected: number;
      delta: number;
      score: number;
      currentScore: number;
      trajectory: number[];
      affectedRegions: string[];
    }> = [];

    // Generate trajectory at yearly intervals (0..years)
    for (const key of markerKeys) {
      const currentVal = bioVault ? (bioVault as any)[key] : null;
      if (currentVal == null || typeof currentVal !== "number") continue;
      const opt = OPTIMAL[key];
      if (!opt) continue;

      const agingDecay = AGING_DECAY_PER_YEAR[key] || 0;
      const adherenceOffset = ADHERENCE_OFFSET_PER_YEAR[key] || 0;
      const trajectory: number[] = [currentVal];
      let val = currentVal;

      // Step through each year
      const steps = Math.max(1, Math.ceil(years));
      for (let y = 1; y <= steps; y++) {
        const yearFraction = y <= years ? 1 : years - Math.floor(years);
        // Aging decay (always happens)
        val += agingDecay * yearFraction;
        // Adherence benefit (proportional to compliance)
        val += adherenceOffset * adherenceRate * yearFraction;
        // Diminishing returns near optimal ceiling
        if (opt.higherBetter) {
          if (val > opt.max * 1.2) val = opt.max * 1.2;
          if (val < 0) val = 0;
        } else {
          if (val < 0) val = 0;
        }
        trajectory.push(Math.round(val * 100) / 100);
      }

      const projected = trajectory[trajectory.length - 1];
      projections.push({
        key,
        label: opt.label,
        unit: opt.unit,
        current: currentVal,
        projected,
        delta: Math.round((projected - currentVal) * 100) / 100,
        score: Math.round(markerScore(key, projected)),
        currentScore: Math.round(markerScore(key, currentVal)),
        trajectory,
        affectedRegions: MARKER_BODY_REGIONS[key] || [],
      });
    }

    /* ── 4. Compute region thermal states ── */
    const regionScores: Record<string, { total: number; count: number; worst: number }> = {};
    for (const proj of projections) {
      for (const region of proj.affectedRegions) {
        if (!regionScores[region]) regionScores[region] = { total: 0, count: 0, worst: 100 };
        regionScores[region].total += proj.score;
        regionScores[region].count += 1;
        regionScores[region].worst = Math.min(regionScores[region].worst, proj.score);
      }
    }

    const regionThermals: Array<{
      region: string;
      score: number;
      thermal: "peak" | "optimal" | "declining" | "strain" | "critical";
    }> = [];
    for (const [region, data] of Object.entries(regionScores)) {
      const avg = data.count > 0 ? data.total / data.count : 50;
      // Blend average with worst for more dramatic visualization
      const blended = avg * 0.6 + data.worst * 0.4;
      let thermal: "peak" | "optimal" | "declining" | "strain" | "critical";
      if (blended >= 85) thermal = "peak";
      else if (blended >= 70) thermal = "optimal";
      else if (blended >= 50) thermal = "declining";
      else if (blended >= 30) thermal = "strain";
      else thermal = "critical";
      regionThermals.push({ region, score: Math.round(blended), thermal });
    }

    /* ── 5. Composite scores ── */
    const currentComposite = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + p.currentScore, 0) / projections.length)
      : 50;
    const projectedComposite = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + p.score, 0) / projections.length)
      : 50;

    /* ── 6. Status label ── */
    let statusLabel: string;
    let statusThermal: string;
    if (projectedComposite >= 85) { statusLabel = "Performance Peak"; statusThermal = "peak"; }
    else if (projectedComposite >= 70) { statusLabel = "Optimal Range"; statusThermal = "optimal"; }
    else if (projectedComposite >= 50) { statusLabel = "Declining Trajectory"; statusThermal = "declining"; }
    else if (projectedComposite >= 30) { statusLabel = "Strain Accumulating"; statusThermal = "strain"; }
    else { statusLabel = "Critical Degradation"; statusThermal = "critical"; }

    return {
      projections,
      regionThermals,
      currentComposite,
      projectedComposite,
      compositeDelta: projectedComposite - currentComposite,
      adherenceRate: Math.round(adherenceRate * 100),
      yearsForward: years,
      statusLabel,
      statusThermal,
      hasData: projections.length > 0,
      generatedAt: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   90-DAY PREDICTIVE TIMELINE
   
   Projects biomarker values 90 days forward based on current
   protocol adherence. Returns projected values, stability trend,
   and biological age drift detection with tactical fix suggestions.
   ═══════════════════════════════════════════════════════════════ */

/* ── 90-day projection rates (per day at 100% adherence) ── */
const DAILY_90D_IMPROVEMENT: Record<string, number> = {
  vitaminD: 0.28,
  testosteroneTotal: 2.8,
  testosteroneFree: 0.065,
  ferritin: 0.2,
  crp: -0.012,
  hba1c: -0.0025,
};

const DAILY_90D_DECAY: Record<string, number> = {
  vitaminD: -0.12,
  testosteroneTotal: -1.5,
  testosteroneFree: -0.03,
  ferritin: -0.08,
  crp: 0.018,
  hba1c: 0.0018,
};

/* ── Tactical fix templates keyed by declining marker ── */
const TACTICAL_FIXES: Record<string, string[]> = {
  vitaminD: [
    "Add 15min morning sunlight exposure within 30min of waking to boost endogenous D3 synthesis by 40%",
    "Increase Vitamin D3 supplementation to 5000 IU + K2 MK-7 200mcg — retest in 60 days",
    "Stack 10min red light therapy (670nm) post-sunlight to amplify mitochondrial vitamin D activation",
  ],
  testosteroneTotal: [
    "Increase Zone 2 cardio by 20 mins to stabilize resting heart rate and upregulate Leydig cell function",
    "Add compound lifts 3x/week (squat, deadlift, press) — acute T spike of 15-20% per session compounds over 90 days",
    "Enforce 8h sleep minimum + zinc 30mg before bed — 70% of testosterone is produced during deep sleep",
  ],
  testosteroneFree: [
    "Add boron 10mg/day to reduce SHBG binding and increase free T bioavailability by 25%",
    "Implement 2min AM cold exposure to upregulate androgen receptor density",
    "Check SHBG levels — nettle root 500mg may improve free T if SHBG is elevated",
  ],
  ferritin: [
    "Add iron bisglycinate 25mg with vitamin C 500mg on empty stomach AM — avoid coffee within 2h",
    "Increase red meat intake to 3x/week for heme iron absorption (5x more bioavailable than plant iron)",
    "Eliminate calcium supplements within 4h of iron intake — calcium blocks iron absorption by 60%",
  ],
  crp: [
    "Add omega-3 EPA 2g/day to reduce systemic inflammation — CRP typically drops 20-30% within 8 weeks",
    "Implement 2min cold plunge post-training for norepinephrine-mediated anti-inflammatory cascade",
    "Increase Zone 2 cardio by 20 mins 3x/week — myokine release reduces CRP by 15-20% within 6 weeks",
  ],
  hba1c: [
    "Add 15min post-meal walk to blunt glucose spikes by 30-40% — most impactful single intervention for HbA1c",
    "Implement 16:8 intermittent fasting to improve insulin sensitivity and reduce fasting glucose",
    "Replace refined carbs with complex carbs + fiber — soluble fiber reduces HbA1c by 0.2-0.4% over 90 days",
  ],
};

export const get90DayProjection = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();

    /* ── 1. Get BioVault ── */
    const bioVaultDocs = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const bioVault = bioVaultDocs.length > 0 ? bioVaultDocs[bioVaultDocs.length - 1] : null;

    /* ── 2. Get 7-day adherence ── */
    const allCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
    const allProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = allProtocols.filter((p) => p.isActive);

    let totalCompleted = 0;
    let totalPossible = 0;
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const dayDone = allCompletions.filter((c) => c.dateKey === dateKey && c.completed).length;
      totalCompleted += dayDone;
      totalPossible += activeProtocols.length || 1;
    }
    const adherenceRate = totalPossible > 0 ? Math.min(1, totalCompleted / totalPossible) : 0;

    /* ── 3. Project each marker 90 days forward ── */
    const markerKeys = ["vitaminD", "testosteroneTotal", "testosteroneFree", "ferritin", "crp", "hba1c"] as const;
    const projections: Array<{
      key: string;
      label: string;
      unit: string;
      current: number;
      projected90d: number;
      delta: number;
      deltaPct: number;
      direction: "improving" | "stable" | "declining";
      currentScore: number;
      projectedScore: number;
      trajectory: number[]; // 7 points: day 0, 15, 30, 45, 60, 75, 90
    }> = [];

    for (const key of markerKeys) {
      const currentVal = bioVault ? (bioVault as any)[key] : null;
      if (currentVal == null || typeof currentVal !== "number") continue;
      const opt = OPTIMAL[key];
      if (!opt) continue;

      const improvementRate = DAILY_90D_IMPROVEMENT[key] || 0;
      const decayRate = DAILY_90D_DECAY[key] || 0;
      const trajectory: number[] = [currentVal];
      let val = currentVal;

      // Project at 15-day intervals
      for (let interval = 1; interval <= 6; interval++) {
        const days = 15;
        for (let d = 0; d < days; d++) {
          const dailyChange = improvementRate * adherenceRate + decayRate * (1 - adherenceRate);
          val += dailyChange;
          // Clamp
          if (opt.higherBetter) {
            if (val > opt.max * 1.15) val = opt.max * 1.15;
            if (val < 0) val = 0;
          } else {
            if (val < 0) val = 0;
          }
        }
        trajectory.push(Math.round(val * 100) / 100);
      }

      const projected90d = trajectory[trajectory.length - 1];
      const delta = projected90d - currentVal;
      const deltaPct = currentVal !== 0 ? (delta / currentVal) * 100 : 0;

      let direction: "improving" | "stable" | "declining";
      if (opt.higherBetter) {
        direction = delta > 1 ? "improving" : delta < -1 ? "declining" : "stable";
      } else {
        direction = delta < -0.01 ? "improving" : delta > 0.01 ? "declining" : "stable";
      }

      projections.push({
        key,
        label: opt.label,
        unit: opt.unit,
        current: currentVal,
        projected90d,
        delta: Math.round(delta * 100) / 100,
        deltaPct: Math.round(deltaPct * 10) / 10,
        direction,
        currentScore: Math.round(markerScore(key, currentVal)),
        projectedScore: Math.round(markerScore(key, projected90d)),
        trajectory,
      });
    }

    /* ── 4. Composite scores ── */
    const currentComposite = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + p.currentScore, 0) / projections.length)
      : 50;
    const projectedComposite = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + p.projectedScore, 0) / projections.length)
      : 50;
    const stabilityTrend: "up" | "stable" | "down" =
      projectedComposite > currentComposite + 3 ? "up" :
      projectedComposite < currentComposite - 3 ? "down" : "stable";

    /* ── 5. Biological Age Drift Detection ── */
    const decliningMarkers = projections.filter(p => p.direction === "declining");
    const hasDrift = stabilityTrend === "down" || decliningMarkers.length >= 2;
    let driftWarning: {
      active: boolean;
      severity: "moderate" | "high" | "critical";
      message: string;
      tacticalFix: string;
      targetMarker: string;
      targetLabel: string;
    } | null = null;

    if (hasDrift) {
      // Find the worst declining marker
      const worstMarker = decliningMarkers.length > 0
        ? decliningMarkers.sort((a, b) => a.projectedScore - a.currentScore - (b.projectedScore - b.currentScore))[0]
        : projections.sort((a, b) => a.projectedScore - b.projectedScore)[0];

      const scoreDrop = worstMarker ? (worstMarker.currentScore - worstMarker.projectedScore) : 0;
      const severity: "moderate" | "high" | "critical" =
        scoreDrop >= 20 ? "critical" : scoreDrop >= 10 ? "high" : "moderate";

      // Pick a tactical fix
      const fixes = worstMarker ? (TACTICAL_FIXES[worstMarker.key] || TACTICAL_FIXES.crp) : TACTICAL_FIXES.crp;
      const fixIndex = Math.floor((now / 86400000) % fixes.length); // rotate daily
      const tacticalFix = fixes[fixIndex];

      const message = worstMarker
        ? `${worstMarker.label} projected to ${worstMarker.direction === "declining" ? "decline" : "stagnate"} from ${worstMarker.current} to ${worstMarker.projected90d} ${worstMarker.unit} over 90 days at current adherence`
        : "Multiple biomarkers trending below optimal — biological age acceleration detected";

      driftWarning = {
        active: true,
        severity,
        message,
        tacticalFix,
        targetMarker: worstMarker?.key || "crp",
        targetLabel: worstMarker?.label || "hs-CRP",
      };
    }

    return {
      projections,
      currentComposite,
      projectedComposite,
      compositeDelta: projectedComposite - currentComposite,
      stabilityTrend,
      adherenceRate: Math.round(adherenceRate * 100),
      driftWarning,
      hasData: projections.length > 0,
      generatedAt: now,
    };
  },
});

export const getPredictiveForecast = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const day7ago = now - 7 * 24 * 60 * 60 * 1000;

    /* ── 1. Get BioVault for current biomarker values ── */
    const bioVaultDocs = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const bioVault = bioVaultDocs.length > 0 ? bioVaultDocs[bioVaultDocs.length - 1] : null;

    /* ── 2. Get protocol completions for last 7 days ── */
    const allCompletions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId_and_dateKey", (q: any) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();

    /* ── 3. Get active protocols for total count ── */
    const allProtocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = allProtocols.filter((p) => p.isActive);

    /* ── 4. Compute daily adherence for last 7 days ── */
    const dailyAdherence: Array<{ date: string; rate: number; completed: number; total: number; byCategory: Record<string, number> }> = [];
    
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      
      const dayCompletions = allCompletions.filter(
        (c) => c.dateKey === dateKey && c.completed
      );
      
      const total = activeProtocols.length || 1;
      const completed = dayCompletions.length;
      
      // Category breakdown
      const byCategory: Record<string, number> = {};
      for (const comp of dayCompletions) {
        const proto = activeProtocols.find((p) => p._id === comp.protocolItemId);
        if (proto) {
          byCategory[proto.category] = (byCategory[proto.category] || 0) + 1;
        }
      }
      
      dailyAdherence.push({
        date: dateKey,
        rate: Math.min(1, completed / total),
        completed,
        total,
        byCategory,
      });
    }

    const avg7dAdherence = dailyAdherence.length > 0
      ? dailyAdherence.reduce((s, d) => s + d.rate, 0) / dailyAdherence.length
      : 0;

    /* ── 5. Compute category-level adherence ── */
    const categoryTotals: Record<string, number> = {};
    const categoryCompleted: Record<string, number> = {};
    for (const proto of activeProtocols) {
      categoryTotals[proto.category] = (categoryTotals[proto.category] || 0) + 7; // 7 days
    }
    for (const day of dailyAdherence) {
      for (const [cat, count] of Object.entries(day.byCategory)) {
        categoryCompleted[cat] = (categoryCompleted[cat] || 0) + count;
      }
    }
    const categoryAdherence: Record<string, number> = {};
    for (const cat of Object.keys(categoryTotals)) {
      categoryAdherence[cat] = Math.min(1, (categoryCompleted[cat] || 0) / categoryTotals[cat]);
    }

    /* ── 6. Project each biomarker 7 days forward ── */
    const markerKeys = ["vitaminD", "testosteroneTotal", "testosteroneFree", "ferritin", "crp", "hba1c"] as const;
    
    const projections: Array<{
      key: string;
      label: string;
      unit: string;
      current: number;
      projected: number;
      delta: number;
      deltaPct: number;
      direction: "improving" | "stable" | "declining";
      trajectory: number[]; // 8 points: day 0 (now) through day 7
      score: number; // 0-100 projected health score
      currentScore: number;
      impactingProtocols: string[];
    }> = [];

    for (const key of markerKeys) {
      const currentVal = bioVault ? (bioVault as any)[key] : null;
      if (currentVal == null || typeof currentVal !== "number") continue;

      const opt = OPTIMAL[key];
      if (!opt) continue;

      // Determine which protocol categories impact this marker
      const impactingCategories: Array<{ category: string; weight: number }> = [];
      for (const [cat, impact] of Object.entries(PROTOCOL_BIOMARKER_IMPACT)) {
        if (impact.markers.includes(key)) {
          impactingCategories.push({ category: cat, weight: impact.weight });
        }
      }

      // Weighted adherence for this specific marker
      let weightedAdherence = avg7dAdherence;
      if (impactingCategories.length > 0) {
        let totalWeight = 0;
        let weightedSum = 0;
        for (const { category, weight } of impactingCategories) {
          const catAdh = categoryAdherence[category] ?? avg7dAdherence;
          weightedSum += catAdh * weight;
          totalWeight += weight;
        }
        weightedAdherence = totalWeight > 0 ? weightedSum / totalWeight : avg7dAdherence;
      }

      // Project 7 days forward
      const improvementRate = DAILY_IMPROVEMENT_RATES[key] || 0;
      const decayRate = DAILY_DECAY_RATES[key] || 0;
      const trajectory: number[] = [currentVal];
      let val = currentVal;

      for (let d = 1; d <= 7; d++) {
        // Blend improvement and decay based on adherence
        const dailyChange = improvementRate * weightedAdherence + decayRate * (1 - weightedAdherence);
        val += dailyChange;
        
        // Add slight diminishing returns near optimal
        if (opt.higherBetter) {
          if (val > opt.max) val = opt.max + (val - opt.max) * 0.3;
          if (val < 0) val = 0;
        } else {
          if (val < opt.min) val = opt.min;
          if (val < 0) val = 0;
        }
        
        trajectory.push(Math.round(val * 100) / 100);
      }

      const projected = trajectory[7];
      const delta = projected - currentVal;
      const deltaPct = currentVal !== 0 ? (delta / currentVal) * 100 : 0;

      // Direction
      let direction: "improving" | "stable" | "declining";
      if (opt.higherBetter) {
        direction = delta > 0.5 ? "improving" : delta < -0.5 ? "declining" : "stable";
      } else {
        direction = delta < -0.005 ? "improving" : delta > 0.005 ? "declining" : "stable";
      }

      projections.push({
        key,
        label: opt.label,
        unit: opt.unit,
        current: currentVal,
        projected: Math.round(projected * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        deltaPct: Math.round(deltaPct * 10) / 10,
        direction,
        trajectory,
        score: Math.round(markerScore(key, projected)),
        currentScore: Math.round(markerScore(key, currentVal)),
        impactingProtocols: impactingCategories.map((c) => c.category),
      });
    }

    /* ── 7. Compute composite forecast score ── */
    const currentComposite = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + p.currentScore, 0) / projections.length)
      : 50;
    const projectedComposite = projections.length > 0
      ? Math.round(projections.reduce((s, p) => s + p.score, 0) / projections.length)
      : 50;

    /* ── 8. Generate forecast insights ── */
    const insights: Array<{ icon: string; text: string; type: "positive" | "warning" | "neutral" }> = [];

    const improving = projections.filter((p) => p.direction === "improving");
    const declining = projections.filter((p) => p.direction === "declining");

    if (improving.length > 0) {
      const best = improving.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];
      insights.push({
        icon: "📈",
        text: `${best.label} projected to ${best.delta > 0 ? "rise" : "drop"} ${Math.abs(best.deltaPct)}% to ${best.projected} ${best.unit} — protocol adherence is driving improvement.`,
        type: "positive",
      });
    }

    if (declining.length > 0) {
      const worst = declining.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];
      insights.push({
        icon: "⚠️",
        text: `${worst.label} trending toward ${worst.projected} ${worst.unit} — increase ${worst.impactingProtocols.slice(0, 2).join(" and ")} protocol adherence to reverse.`,
        type: "warning",
      });
    }

    if (avg7dAdherence >= 0.8) {
      insights.push({
        icon: "🏆",
        text: `${Math.round(avg7dAdherence * 100)}% adherence over 7 days — compounding biological gains are accelerating.`,
        type: "positive",
      });
    } else if (avg7dAdherence < 0.5) {
      insights.push({
        icon: "🔻",
        text: `Adherence at ${Math.round(avg7dAdherence * 100)}% — biomarker drift is likely without protocol consistency.`,
        type: "warning",
      });
    }

    return {
      projections,
      dailyAdherence,
      avg7dAdherence: Math.round(avg7dAdherence * 100),
      categoryAdherence,
      currentComposite,
      projectedComposite,
      compositeDelta: projectedComposite - currentComposite,
      insights,
      generatedAt: now,
      hasData: projections.length > 0,
    };
  },
});
