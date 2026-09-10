/* ══════════════════════════════════════════════════════════════════════
   BIO-LOGIC — Estimated Baseline Calculator for Vive 4.0
   
   When real lab data or device sync is unavailable, BioLogic generates
   physiologically-grounded estimates for:
   
   • BMR (Basal Metabolic Rate) — Mifflin-St Jeor equation
   • Target HRV ranges — age/sex-stratified population norms
   • Daily hydration goals — weight-based with activity multiplier
   • Resting heart rate estimates — age/sex population medians
   • Caffeine tolerance ceiling — body-weight scaled safe limits
   • TDEE (Total Daily Energy Expenditure) — BMR × activity factor
   
   All outputs carry an `isEstimated: true` flag so the UI can render
   the "Estimated" badge until real device data supersedes them.
   ══════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────────────────── */

export type BiologicalSex = 'male' | 'female' | 'intersex' | 'prefer_not';

export interface PhysicalProfile {
  sex: BiologicalSex;
  /** Age in years (derived from DOB) */
  age: number;
  /** Height in centimeters */
  heightCm: number;
  /** Weight in kilograms */
  weightKg: number;
}

export interface BMREstimate {
  /** Basal Metabolic Rate in kcal/day (Mifflin-St Jeor) */
  bmrKcal: number;
  /** Total Daily Energy Expenditure at sedentary level (BMR × 1.2) */
  tdeeSedentary: number;
  /** TDEE at light activity (BMR × 1.375) */
  tdeeLight: number;
  /** TDEE at moderate activity (BMR × 1.55) */
  tdeeModerate: number;
  /** TDEE at high activity (BMR × 1.725) */
  tdeeHigh: number;
  /** TDEE at athlete level (BMR × 1.9) */
  tdeeAthlete: number;
  /** Equation used */
  method: 'mifflin_st_jeor';
  isEstimated: true;
}

export interface HRVRange {
  /** Lower bound of healthy HRV range (ms) */
  low: number;
  /** Median expected HRV (ms) */
  median: number;
  /** Upper bound of healthy HRV range (ms) */
  high: number;
  /** "Elite" threshold — top 15th percentile */
  eliteThreshold: number;
  /** "Concern" threshold — below this warrants attention */
  concernThreshold: number;
  /** Age-sex cohort label */
  cohort: string;
  isEstimated: true;
}

export interface HydrationGoal {
  /** Base daily water intake in milliliters */
  baseMl: number;
  /** Active day target (base + exercise buffer) */
  activeMl: number;
  /** Hot climate / high-strain target */
  highStrainMl: number;
  /** Minimum safe intake */
  minimumMl: number;
  /** Ounces equivalent of base target */
  baseOz: number;
  isEstimated: true;
}

export interface RestingHREstimate {
  /** Estimated resting heart rate (bpm) */
  rhrBpm: number;
  /** Healthy range lower bound */
  healthyLow: number;
  /** Healthy range upper bound */
  healthyHigh: number;
  /** Athletic range (well-trained) */
  athleticLow: number;
  isEstimated: true;
}

export interface CaffeineLimit {
  /** Safe daily maximum in mg */
  dailyMaxMg: number;
  /** Recommended daily target in mg */
  recommendedMg: number;
  /** Last-intake cutoff hours before bed */
  cutoffHoursBeforeBed: number;
  /** Approximate cups of coffee equivalent */
  coffeeCupsEquiv: number;
  isEstimated: true;
}

/** Complete computed baselines bundle */
export interface ComputedBaselines {
  bmr: BMREstimate;
  hrv: HRVRange;
  hydration: HydrationGoal;
  restingHR: RestingHREstimate;
  caffeine: CaffeineLimit;
  /** Profile used for computation */
  profile: PhysicalProfile;
  /** Timestamp of computation */
  computedAt: number;
  /** All values are estimated until device data arrives */
  isEstimated: true;
}

/* ──────────────────────────────────────────────────────────────────────
   HELPER: Age from DOB string
   ────────────────────────────────────────────────────────────────────── */

export function ageFromDOB(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/* ──────────────────────────────────────────────────────────────────────
   BMR — Mifflin-St Jeor Equation (1990)
   
   Male:   BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161 + 166
   Female: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
   
   Most accurate for non-obese adults (Frankenfield et al., 2005).
   For intersex/prefer_not, we use the average of male and female.
   ────────────────────────────────────────────────────────────────────── */

export function calculateBMR(profile: PhysicalProfile): BMREstimate {
  const { sex, age, heightCm, weightKg } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  let bmr: number;
  if (sex === 'male') {
    bmr = base + 166; // +5 net from original equation
  } else if (sex === 'female') {
    bmr = base;
  } else {
    // Average of male and female for intersex/prefer_not
    bmr = base + 83;
  }

  // Floor at 1000 kcal — physiological minimum
  bmr = Math.max(1000, Math.round(bmr));

  return {
    bmrKcal: bmr,
    tdeeSedentary: Math.round(bmr * 1.2),
    tdeeLight: Math.round(bmr * 1.375),
    tdeeModerate: Math.round(bmr * 1.55),
    tdeeHigh: Math.round(bmr * 1.725),
    tdeeAthlete: Math.round(bmr * 1.9),
    method: 'mifflin_st_jeor',
    isEstimated: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   HRV — Age/Sex-Stratified Population Norms
   
   Based on Nunan et al. (2010) meta-analysis and Shaffer & Ginsberg
   (2017) review of short-term HRV norms. Values represent RMSSD (ms).
   
   HRV declines ~3-5 ms per decade after age 25.
   Males tend to have slightly higher HRV than females until ~55.
   ────────────────────────────────────────────────────────────────────── */

interface HRVNormEntry {
  ageMin: number;
  ageMax: number;
  maleLow: number;
  maleMedian: number;
  maleHigh: number;
  femaleLow: number;
  femaleMedian: number;
  femaleHigh: number;
}

const HRV_NORMS: HRVNormEntry[] = [
  { ageMin: 18, ageMax: 25, maleLow: 42, maleMedian: 62, maleHigh: 95, femaleLow: 38, femaleMedian: 57, femaleHigh: 88 },
  { ageMin: 26, ageMax: 35, maleLow: 36, maleMedian: 55, maleHigh: 85, femaleLow: 33, femaleMedian: 50, femaleHigh: 78 },
  { ageMin: 36, ageMax: 45, maleLow: 30, maleMedian: 48, maleHigh: 74, femaleLow: 28, femaleMedian: 44, femaleHigh: 68 },
  { ageMin: 46, ageMax: 55, maleLow: 24, maleMedian: 40, maleHigh: 62, femaleLow: 23, femaleMedian: 38, femaleHigh: 58 },
  { ageMin: 56, ageMax: 65, maleLow: 19, maleMedian: 33, maleHigh: 52, femaleLow: 19, femaleMedian: 32, femaleHigh: 50 },
  { ageMin: 66, ageMax: 120, maleLow: 15, maleMedian: 27, maleHigh: 44, femaleLow: 15, femaleMedian: 26, femaleHigh: 42 },
];

export function calculateHRVRange(profile: PhysicalProfile): HRVRange {
  const { sex, age } = profile;

  // Find matching age bracket (default to last bracket)
  const norm = HRV_NORMS.find(n => age >= n.ageMin && age <= n.ageMax)
    ?? HRV_NORMS[HRV_NORMS.length - 1];

  const isMale = sex === 'male';
  const isFemale = sex === 'female';

  let low: number, median: number, high: number;

  if (isMale) {
    low = norm.maleLow;
    median = norm.maleMedian;
    high = norm.maleHigh;
  } else if (isFemale) {
    low = norm.femaleLow;
    median = norm.femaleMedian;
    high = norm.femaleHigh;
  } else {
    // Average for intersex/prefer_not
    low = Math.round((norm.maleLow + norm.femaleLow) / 2);
    median = Math.round((norm.maleMedian + norm.femaleMedian) / 2);
    high = Math.round((norm.maleHigh + norm.femaleHigh) / 2);
  }

  // Elite threshold: top ~15th percentile (high + 15%)
  const eliteThreshold = Math.round(high * 1.15);
  // Concern threshold: below the 25th percentile
  const concernThreshold = Math.round(low * 0.85);

  const ageLabel = age < 26 ? '18–25' : age < 36 ? '26–35' : age < 46 ? '36–45'
    : age < 56 ? '46–55' : age < 66 ? '56–65' : '66+';
  const sexLabel = isMale ? 'Male' : isFemale ? 'Female' : 'Average';

  return {
    low,
    median,
    high,
    eliteThreshold,
    concernThreshold,
    cohort: `${sexLabel}, ${ageLabel}`,
    isEstimated: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   HYDRATION — Weight-Based Daily Water Intake
   
   Base formula: 35 mL per kg body weight (EFSA, 2010).
   Active adjustment: +500-750 mL for moderate exercise.
   High-strain: +1000-1500 mL for intense training or heat.
   
   Minimum: 2000 mL (WHO general recommendation).
   ────────────────────────────────────────────────────────────────────── */

export function calculateHydration(profile: PhysicalProfile): HydrationGoal {
  const { weightKg } = profile;

  const baseMl = Math.round(weightKg * 35);
  const activeMl = Math.round(baseMl + 650);
  const highStrainMl = Math.round(baseMl + 1250);
  const minimumMl = Math.max(2000, Math.round(weightKg * 25));

  // Convert to oz (1 mL ≈ 0.033814 oz)
  const baseOz = Math.round(baseMl * 0.033814);

  return {
    baseMl: Math.max(minimumMl, baseMl),
    activeMl: Math.max(minimumMl + 500, activeMl),
    highStrainMl,
    minimumMl,
    baseOz,
    isEstimated: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   RESTING HEART RATE — Age/Sex Population Medians
   
   Based on Quer et al. (2020) large-scale wearable study (n=92,457).
   RHR increases slightly with age, females ~3-5 bpm higher than males.
   ────────────────────────────────────────────────────────────────────── */

export function calculateRestingHR(profile: PhysicalProfile): RestingHREstimate {
  const { sex, age } = profile;

  // Base RHR by age (population median)
  let baseRHR: number;
  if (age < 30) baseRHR = 68;
  else if (age < 40) baseRHR = 70;
  else if (age < 50) baseRHR = 72;
  else if (age < 60) baseRHR = 73;
  else baseRHR = 74;

  // Sex adjustment
  if (sex === 'female') baseRHR += 3;
  else if (sex === 'male') baseRHR -= 1;
  // intersex/prefer_not: use base

  return {
    rhrBpm: baseRHR,
    healthyLow: 60,
    healthyHigh: 80,
    athleticLow: 45,
    isEstimated: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   CAFFEINE — Body-Weight Scaled Safe Limits
   
   FDA guideline: ≤400 mg/day for healthy adults.
   Scaled: ~6 mg/kg is the upper safe boundary (EFSA, 2015).
   Recommended: ~3 mg/kg for sustained alertness without jitter.
   Cutoff: 8-10 hours before bed (caffeine half-life ~5h).
   ────────────────────────────────────────────────────────────────────── */

export function calculateCaffeineLimit(profile: PhysicalProfile): CaffeineLimit {
  const { weightKg } = profile;

  const dailyMaxMg = Math.min(400, Math.round(weightKg * 6));
  const recommendedMg = Math.round(weightKg * 3);
  const coffeeCupsEquiv = Math.round((recommendedMg / 95) * 10) / 10; // ~95mg per cup

  return {
    dailyMaxMg,
    recommendedMg,
    cutoffHoursBeforeBed: 8,
    coffeeCupsEquiv,
    isEstimated: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   MASTER FUNCTION — Compute All Baselines
   
   Single entry point that takes a PhysicalProfile and returns the
   complete ComputedBaselines bundle. This is what gets stored in the
   `computedBaselines` field on the users table.
   ────────────────────────────────────────────────────────────────────── */

export function computeAllBaselines(profile: PhysicalProfile): ComputedBaselines {
  return {
    bmr: calculateBMR(profile),
    hrv: calculateHRVRange(profile),
    hydration: calculateHydration(profile),
    restingHR: calculateRestingHR(profile),
    caffeine: calculateCaffeineLimit(profile),
    profile,
    computedAt: Date.now(),
    isEstimated: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   CONVENIENCE: Build profile from raw onboarding fields
   ────────────────────────────────────────────────────────────────────── */

export function buildProfileFromOnboarding(data: {
  sex: string;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
}): PhysicalProfile {
  return {
    sex: (['male', 'female', 'intersex', 'prefer_not'].includes(data.sex)
      ? data.sex
      : 'prefer_not') as BiologicalSex,
    age: ageFromDOB(data.dateOfBirth),
    heightCm: data.heightCm,
    weightKg: data.weightKg,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   SERIALIZATION — Flatten for Convex storage
   
   Convex doesn't support deeply nested objects in schema, so we
   serialize the full baselines to a JSON string for the
   `computedBaselines` field, and provide a deserializer.
   ────────────────────────────────────────────────────────────────────── */

export function serializeBaselines(baselines: ComputedBaselines): string {
  return JSON.stringify(baselines);
}

export function deserializeBaselines(json: string): ComputedBaselines | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && parsed.isEstimated === true) {
      return parsed as ComputedBaselines;
    }
    return null;
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────
   UI HELPERS — Format values for display
   ────────────────────────────────────────────────────────────────────── */

export function formatBMR(bmr: BMREstimate): string {
  return `${bmr.bmrKcal.toLocaleString()} kcal/day`;
}

export function formatHRVRange(hrv: HRVRange): string {
  return `${hrv.low}–${hrv.high} ms (median ${hrv.median})`;
}

export function formatHydration(h: HydrationGoal): string {
  return `${(h.baseMl / 1000).toFixed(1)}L / ${h.baseOz} oz`;
}

export function formatCaffeine(c: CaffeineLimit): string {
  return `≤${c.recommendedMg} mg (~${c.coffeeCupsEquiv} cups)`;
}

/** Quick summary card data for UI tiles */
export interface BaselineSummaryCard {
  label: string;
  value: string;
  subtext: string;
  icon: string;
  color: string;
  isEstimated: boolean;
}

export function getBaselineSummaryCards(baselines: ComputedBaselines): BaselineSummaryCard[] {
  return [
    {
      label: 'Basal Metabolic Rate',
      value: formatBMR(baselines.bmr),
      subtext: `TDEE moderate: ${baselines.bmr.tdeeModerate.toLocaleString()} kcal`,
      icon: '🔥',
      color: '#FF6B35',
      isEstimated: baselines.bmr.isEstimated,
    },
    {
      label: 'Target HRV Range',
      value: formatHRVRange(baselines.hrv),
      subtext: `Elite: ≥${baselines.hrv.eliteThreshold} ms · Cohort: ${baselines.hrv.cohort}`,
      icon: '💓',
      color: '#AF82FF',
      isEstimated: baselines.hrv.isEstimated,
    },
    {
      label: 'Daily Hydration',
      value: formatHydration(baselines.hydration),
      subtext: `Active: ${(baselines.hydration.activeMl / 1000).toFixed(1)}L · Min: ${(baselines.hydration.minimumMl / 1000).toFixed(1)}L`,
      icon: '💧',
      color: '#00D4FF',
      isEstimated: baselines.hydration.isEstimated,
    },
    {
      label: 'Resting Heart Rate',
      value: `~${baselines.restingHR.rhrBpm} bpm`,
      subtext: `Healthy: ${baselines.restingHR.healthyLow}–${baselines.restingHR.healthyHigh} · Athletic: <${baselines.restingHR.athleticLow}`,
      icon: '❤️',
      color: '#FF4757',
      isEstimated: baselines.restingHR.isEstimated,
    },
    {
      label: 'Caffeine Ceiling',
      value: formatCaffeine(baselines.caffeine),
      subtext: `Max: ${baselines.caffeine.dailyMaxMg} mg · Cutoff: ${baselines.caffeine.cutoffHoursBeforeBed}h before bed`,
      icon: '☕',
      color: '#C4A35A',
      isEstimated: baselines.caffeine.isEstimated,
    },
  ];
}
