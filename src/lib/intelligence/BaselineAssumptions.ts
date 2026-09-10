/* ══════════════════════════════════════════════════════════════════
   BASELINE ASSUMPTIONS ENGINE
   
   Calculates estimated physiological baselines when real lab/device
   data is missing. Uses validated clinical formulas:
   • BMR — Mifflin-St Jeor (gold standard for RMR estimation)
   • HRV — Age-stratified population norms (Nunan et al. 2010)
   • Hydration — National Academies + body-weight scaling
   • Caffeine — FDA guidelines + sensitivity adjustment
   
   Every returned marker carries `isEstimated: true` until a real
   device sync or lab upload replaces it with live data.
   ══════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────────

export type Sex = "male" | "female";

export interface PhysicalProfile {
  sex: Sex;
  age: number;        // years
  weightKg: number;   // kilograms
  heightCm?: number;  // centimeters (optional — improves BMR accuracy)
}

export interface EstimatedMarker<T = number> {
  value: T;
  unit: string;
  isEstimated: true;
  confidence: "high" | "moderate" | "low";
  formula: string;
  note: string;
}

export interface HRVRange {
  low: number;
  median: number;
  high: number;
}

export interface BaselineEstimates {
  bmr: EstimatedMarker<number>;
  tdee: EstimatedMarker<number>;
  hrvRange: EstimatedMarker<HRVRange>;
  restingHeartRate: EstimatedMarker<{ low: number; high: number }>;
  dailyWaterMl: EstimatedMarker<number>;
  dailyWaterOz: EstimatedMarker<number>;
  caffeineLimitMg: EstimatedMarker<number>;
  caffeineLastIntakeCutoff: EstimatedMarker<string>;
  proteinTargetG: EstimatedMarker<number>;
  sleepTargetHours: EstimatedMarker<number>;
  vo2maxEstimate: EstimatedMarker<{ low: number; high: number }>;
  biologicalAgeOffset: EstimatedMarker<number>;
}

// ── Constants ──────────────────────────────────────────────────────

/** Average height by sex when not provided (CDC NHANES data) */
const DEFAULT_HEIGHT_CM: Record<Sex, number> = {
  male: 175.3,
  female: 161.8,
};

/** Activity multiplier for TDEE — assumes "lightly active" baseline */
const ACTIVITY_MULTIPLIER = 1.375;

/**
 * HRV population norms by age decade (rMSSD, ms)
 * Source: Nunan et al. 2010, Shaffer & Ginsberg 2017
 */
const HRV_NORMS: { maxAge: number; male: HRVRange; female: HRVRange }[] = [
  { maxAge: 25, male: { low: 35, median: 60, high: 105 }, female: { low: 30, median: 55, high: 95 } },
  { maxAge: 35, male: { low: 28, median: 50, high: 90 },  female: { low: 25, median: 45, high: 82 } },
  { maxAge: 45, male: { low: 20, median: 38, high: 72 },  female: { low: 18, median: 35, high: 65 } },
  { maxAge: 55, male: { low: 15, median: 30, high: 58 },  female: { low: 14, median: 28, high: 52 } },
  { maxAge: 65, male: { low: 10, median: 24, high: 48 },  female: { low: 10, median: 22, high: 42 } },
  { maxAge: 999, male: { low: 8, median: 20, high: 40 },  female: { low: 8, median: 18, high: 36 } },
];

/**
 * Resting heart rate norms by age (bpm)
 * Source: AHA guidelines
 */
const RHR_NORMS: { maxAge: number; low: number; high: number }[] = [
  { maxAge: 25, low: 56, high: 72 },
  { maxAge: 35, low: 58, high: 74 },
  { maxAge: 45, low: 60, high: 76 },
  { maxAge: 55, low: 62, high: 78 },
  { maxAge: 65, low: 62, high: 80 },
  { maxAge: 999, low: 60, high: 82 },
];

/**
 * VO2max estimates by age decade (ml/kg/min) — "average" fitness
 * Source: ACSM Guidelines for Exercise Testing
 */
const VO2MAX_NORMS: { maxAge: number; male: { low: number; high: number }; female: { low: number; high: number } }[] = [
  { maxAge: 25, male: { low: 38, high: 52 }, female: { low: 33, high: 47 } },
  { maxAge: 35, male: { low: 35, high: 49 }, female: { low: 30, high: 44 } },
  { maxAge: 45, male: { low: 32, high: 46 }, female: { low: 27, high: 41 } },
  { maxAge: 55, male: { low: 28, high: 42 }, female: { low: 24, high: 37 } },
  { maxAge: 65, male: { low: 24, high: 38 }, female: { low: 21, high: 33 } },
  { maxAge: 999, male: { low: 20, high: 34 }, female: { low: 18, high: 30 } },
];

// ── Core Calculation Functions ─────────────────────────────────────

/**
 * Mifflin-St Jeor BMR (kcal/day)
 * Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age − 5 + 5
 * Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 5 − 161
 */
function calculateBMR(profile: PhysicalProfile): number {
  const h = profile.heightCm ?? DEFAULT_HEIGHT_CM[profile.sex];
  const base = 10 * profile.weightKg + 6.25 * h - 5 * profile.age;
  return Math.round(profile.sex === "male" ? base + 5 : base - 161);
}

/**
 * Lookup age-stratified norm from a table
 */
function lookupByAge<T>(table: { maxAge: number }[], age: number): (typeof table)[number] {
  return (table.find((row) => age <= row.maxAge) ?? table[table.length - 1]) as T & { maxAge: number };
}

/**
 * Daily water intake (ml) — body-weight based
 * Base: 35 ml/kg (European Food Safety Authority)
 * Adjusted: +10% for males (higher lean mass)
 */
function calculateWaterMl(profile: PhysicalProfile): number {
  const base = profile.weightKg * 35;
  const adjusted = profile.sex === "male" ? base * 1.1 : base;
  return Math.round(adjusted / 50) * 50; // Round to nearest 50ml
}

/**
 * Caffeine daily limit (mg)
 * FDA: 400mg general adult max
 * Adjusted: lower for older adults, lower for females (slower clearance during luteal phase)
 */
function calculateCaffeineLimit(profile: PhysicalProfile): number {
  let limit = 400;
  if (profile.age > 55) limit = 300;
  else if (profile.age > 65) limit = 200;
  if (profile.sex === "female") limit = Math.round(limit * 0.85);
  return limit;
}

/**
 * Protein target (g/day)
 * Active adults: 1.6–2.2 g/kg — we use 1.8 g/kg as baseline
 * Adjusted: +0.2 g/kg for age > 50 (sarcopenia prevention)
 */
function calculateProteinTarget(profile: PhysicalProfile): number {
  let multiplier = 1.8;
  if (profile.age > 50) multiplier = 2.0;
  if (profile.age > 65) multiplier = 2.2;
  return Math.round(profile.weightKg * multiplier);
}

/**
 * Sleep target (hours)
 * NSF guidelines: 7–9h for adults, 7–8h for 65+
 */
function calculateSleepTarget(profile: PhysicalProfile): number {
  if (profile.age < 26) return 8.5;
  if (profile.age < 65) return 8.0;
  return 7.5;
}

/**
 * Biological age offset estimate
 * Without real biomarkers, we return 0 (chronological = biological)
 * This is a placeholder that gets replaced by real epigenetic/telomere data
 */
function estimateBioAgeOffset(_profile: PhysicalProfile): number {
  return 0;
}

// ── Main Export ─────────────────────────────────────────────────────

/**
 * Generate complete baseline estimates from physical profile.
 * Every marker is flagged `isEstimated: true` and includes the
 * formula used + confidence level for UI transparency.
 */
export function calculateBaselineEstimates(profile: PhysicalProfile): BaselineEstimates {
  const bmrValue = calculateBMR(profile);
  const tdeeValue = Math.round(bmrValue * ACTIVITY_MULTIPLIER);
  const heightUsed = profile.heightCm ?? DEFAULT_HEIGHT_CM[profile.sex];
  const hasHeight = profile.heightCm !== undefined;

  // HRV lookup
  const hrvRow = lookupByAge<{ male: HRVRange; female: HRVRange }>(HRV_NORMS, profile.age);
  const hrvRange = (hrvRow as any)[profile.sex] as HRVRange;

  // RHR lookup
  const rhrRow = lookupByAge<{ low: number; high: number }>(RHR_NORMS, profile.age);

  // VO2max lookup
  const vo2Row = lookupByAge<{ male: { low: number; high: number }; female: { low: number; high: number } }>(VO2MAX_NORMS, profile.age);
  const vo2Range = (vo2Row as any)[profile.sex] as { low: number; high: number };

  // Water
  const waterMl = calculateWaterMl(profile);
  const waterOz = Math.round(waterMl / 29.5735);

  // Caffeine
  const caffeineLimitMg = calculateCaffeineLimit(profile);

  // Caffeine cutoff — 8–10h before typical bedtime (11pm)
  // Half-life ~5h → 2 half-lives = ~10h for 75% clearance
  const cutoffHour = 13; // 1:00 PM
  const caffeineLastIntakeCutoff = `${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour}:00 ${cutoffHour >= 12 ? "PM" : "AM"}`;

  // Protein
  const proteinTargetG = calculateProteinTarget(profile);

  // Sleep
  const sleepTargetHours = calculateSleepTarget(profile);

  // Bio age offset
  const bioAgeOffset = estimateBioAgeOffset(profile);

  return {
    bmr: {
      value: bmrValue,
      unit: "kcal/day",
      isEstimated: true,
      confidence: hasHeight ? "high" : "moderate",
      formula: "Mifflin-St Jeor",
      note: hasHeight
        ? `Calculated from ${profile.sex}, ${profile.age}y, ${profile.weightKg}kg, ${heightUsed}cm`
        : `Using average ${profile.sex} height (${heightUsed}cm) — add real height for better accuracy`,
    },

    tdee: {
      value: tdeeValue,
      unit: "kcal/day",
      isEstimated: true,
      confidence: "moderate",
      formula: "BMR × 1.375 (lightly active)",
      note: "Assumes light daily activity. Sync a wearable for real energy expenditure.",
    },

    hrvRange: {
      value: hrvRange,
      unit: "ms (rMSSD)",
      isEstimated: true,
      confidence: "moderate",
      formula: "Age-stratified population norms (Nunan 2010)",
      note: `Population range for ${profile.sex}, age ${profile.age}. Your personal baseline may differ significantly.`,
    },

    restingHeartRate: {
      value: { low: (rhrRow as any).low, high: (rhrRow as any).high },
      unit: "bpm",
      isEstimated: true,
      confidence: "low",
      formula: "AHA age-stratified norms",
      note: "Wide population range. Sync a wearable for your actual resting HR.",
    },

    dailyWaterMl: {
      value: waterMl,
      unit: "ml",
      isEstimated: true,
      confidence: "high",
      formula: "35 ml/kg (EFSA) + sex adjustment",
      note: `Based on ${profile.weightKg}kg body weight. Increase 500ml+ on training days.`,
    },

    dailyWaterOz: {
      value: waterOz,
      unit: "oz",
      isEstimated: true,
      confidence: "high",
      formula: "35 ml/kg converted",
      note: `${waterOz} oz daily minimum. Add 16–20 oz per hour of exercise.`,
    },

    caffeineLimitMg: {
      value: caffeineLimitMg,
      unit: "mg",
      isEstimated: true,
      confidence: profile.age > 55 ? "moderate" : "high",
      formula: "FDA 400mg max, adjusted for age/sex",
      note: profile.sex === "female"
        ? "Reduced 15% for hormonal cycle clearance variation"
        : `Standard limit for ${profile.age <= 55 ? "adults" : "adults 55+"}`,
    },

    caffeineLastIntakeCutoff: {
      value: caffeineLastIntakeCutoff,
      unit: "time",
      isEstimated: true,
      confidence: "high",
      formula: "2× caffeine half-life before 11 PM bedtime",
      note: "Last caffeine by 1 PM allows 75% clearance before sleep. Adjust if you sleep earlier.",
    },

    proteinTargetG: {
      value: proteinTargetG,
      unit: "g/day",
      isEstimated: true,
      confidence: "high",
      formula: profile.age > 50
        ? `${profile.age > 65 ? "2.2" : "2.0"} g/kg (sarcopenia prevention)`
        : "1.8 g/kg (active adult)",
      note: `${proteinTargetG}g spread across 3–4 meals for optimal MPS.`,
    },

    sleepTargetHours: {
      value: sleepTargetHours,
      unit: "hours",
      isEstimated: true,
      confidence: "high",
      formula: "National Sleep Foundation guidelines",
      note: `Target ${sleepTargetHours}h. Sync a sleep tracker for personalized optimization.`,
    },

    vo2maxEstimate: {
      value: vo2Range,
      unit: "ml/kg/min",
      isEstimated: true,
      confidence: "low",
      formula: "ACSM age/sex norms (average fitness)",
      note: "Very rough estimate. A real VO2max test or wearable estimate is far more accurate.",
    },

    biologicalAgeOffset: {
      value: bioAgeOffset,
      unit: "years",
      isEstimated: true,
      confidence: "low",
      formula: "Chronological baseline (no biomarker data)",
      note: "Upload lab results or DNA data to calculate your true biological age offset.",
    },
  };
}

// ── Helper: Convert lbs to kg ──────────────────────────────────────

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

// ── Helper: Convert inches to cm ───────────────────────────────────

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}

// ── Helper: Check if a marker has been replaced by real data ───────

export interface MarkerStatus {
  marker: string;
  hasRealData: boolean;
  source: string | null;
  lastUpdated: number | null;
}

/**
 * Compare baseline estimates against bioVault data to determine
 * which markers have been replaced by real device/lab data.
 */
export function getMarkerStatuses(
  bioVault: {
    hrvCurrent?: number | null;
    hrvAvg7d?: number | null;
    sleepScore?: number | null;
    sleepHours?: number | null;
    caffeineTodayMg?: number | null;
    caffeineDailyLimitMg?: number | null;
    bioStatusUpdatedAt?: number | null;
  } | null,
  labResults: { marker: string; source: string; testedAt: number }[] | null,
): MarkerStatus[] {
  const statuses: MarkerStatus[] = [];

  // HRV
  const hasHrv = bioVault?.hrvCurrent != null;
  statuses.push({
    marker: "HRV",
    hasRealData: hasHrv,
    source: hasHrv ? "device_sync" : null,
    lastUpdated: hasHrv ? (bioVault?.bioStatusUpdatedAt ?? null) : null,
  });

  // Sleep
  const hasSleep = bioVault?.sleepScore != null || bioVault?.sleepHours != null;
  statuses.push({
    marker: "Sleep",
    hasRealData: hasSleep,
    source: hasSleep ? "device_sync" : null,
    lastUpdated: hasSleep ? (bioVault?.bioStatusUpdatedAt ?? null) : null,
  });

  // Caffeine
  const hasCaffeine = bioVault?.caffeineTodayMg != null;
  statuses.push({
    marker: "Caffeine",
    hasRealData: hasCaffeine,
    source: hasCaffeine ? "manual_log" : null,
    lastUpdated: null,
  });

  // Lab markers
  const labMarkers = ["Vitamin D", "Testosterone", "Ferritin", "CRP", "HbA1c"];
  for (const m of labMarkers) {
    const match = labResults?.find((r) =>
      r.marker.toLowerCase().includes(m.toLowerCase())
    );
    statuses.push({
      marker: m,
      hasRealData: !!match,
      source: match?.source ?? null,
      lastUpdated: match?.testedAt ?? null,
    });
  }

  return statuses;
}

/**
 * Quick summary: how many markers are still estimated vs real
 */
export function getDataCompleteness(statuses: MarkerStatus[]): {
  total: number;
  real: number;
  estimated: number;
  percentReal: number;
} {
  const total = statuses.length;
  const real = statuses.filter((s) => s.hasRealData).length;
  return {
    total,
    real,
    estimated: total - real,
    percentReal: total > 0 ? Math.round((real / total) * 100) : 0,
  };
}
