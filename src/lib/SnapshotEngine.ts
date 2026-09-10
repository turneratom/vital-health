/* ═══════════════════════════════════════════════════════════════════
   SNAPSHOT ENGINE — Pure Logic Layer for Zero-Friction Data Capture
   
   Handles:
   1. Meal photo classification & macro estimation heuristics
   2. Lab report text pre-processing for AI extraction
   3. Score impact calculations (Vive Age, Readiness, Elite Score)
   4. Upload state management & progress tracking
   5. Nutrition quality scoring for longevity optimization
   
   This module is framework-agnostic — no React, no Convex imports.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Types ── */
export interface MealEstimate {
  items: MealItem[];
  totals: MacroTotals;
  mealType: string;
  qualityScore: number;
  qualityNotes: string;
  longevityFlags: string[];
  concerns: string[];
}

export interface MealItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface LabExtraction {
  biomarkers: Record<string, number | null>;
  analytesCount: number;
  flagged: BiomarkerFlag[];
  scoreImpact: ScoreImpact;
}

export interface BiomarkerFlag {
  key: string;
  name: string;
  value: number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical';
  reason: string;
}

export interface ScoreImpact {
  viveAgeDelta: number;
  readinessDelta: number;
  biomarkerScore: number;
}

export type SnapshotType = 'meal' | 'lab';

export interface SnapshotUploadState {
  id: string;
  type: SnapshotType;
  file: File | null;
  previewUrl: string | null;
  description: string;
  phase: 'idle' | 'uploading' | 'analyzing' | 'review' | 'committing' | 'complete' | 'error';
  progress: number;
  processingStep: string;
  result: MealEstimate | LabExtraction | null;
  error: string | null;
  storageId: string | null;
  committedAt: number | null;
}

/* ═══════════════════════════════════════════════════════════════
   MEAL QUALITY SCORING — Longevity-optimized nutrition grading
   ═══════════════════════════════════════════════════════════════ */

const LONGEVITY_FOODS = new Set([
  'salmon', 'sardines', 'mackerel', 'blueberries', 'avocado', 'olive oil',
  'walnuts', 'almonds', 'spinach', 'kale', 'broccoli', 'sweet potato',
  'turmeric', 'ginger', 'green tea', 'dark chocolate', 'bone broth',
  'fermented', 'kimchi', 'sauerkraut', 'kombucha', 'tempeh', 'miso',
  'quinoa', 'lentils', 'chickpeas', 'flaxseed', 'chia seeds',
]);

const INFLAMMATORY_FOODS = new Set([
  'fried', 'deep fried', 'processed', 'hot dog', 'soda', 'candy',
  'chips', 'fries', 'pizza', 'donut', 'pastry', 'margarine',
  'corn syrup', 'artificial', 'fast food', 'nuggets',
]);

/** Score a meal for longevity optimization (0-10) */
export function scoreMealQuality(items: MealItem[], totals: MacroTotals): {
  score: number;
  flags: string[];
  concerns: string[];
  notes: string;
} {
  let score = 5; // baseline
  const flags: string[] = [];
  const concerns: string[] = [];
  const allNames = items.map(i => i.name.toLowerCase()).join(' ');

  // Protein ratio scoring
  const proteinCals = totals.protein * 4;
  const proteinRatio = proteinCals / Math.max(1, totals.calories);
  if (proteinRatio >= 0.35) { score += 2; flags.push('high-protein'); }
  else if (proteinRatio >= 0.25) { score += 1; flags.push('adequate-protein'); }
  else { score -= 1; concerns.push('low-protein'); }

  // Longevity food bonus
  let longevityCount = 0;
  for (const food of LONGEVITY_FOODS) {
    if (allNames.includes(food)) longevityCount++;
  }
  if (longevityCount >= 3) { score += 2; flags.push('longevity-rich'); }
  else if (longevityCount >= 1) { score += 1; flags.push('contains-longevity-foods'); }

  // Inflammatory food penalty
  let inflammatoryCount = 0;
  for (const food of INFLAMMATORY_FOODS) {
    if (allNames.includes(food)) inflammatoryCount++;
  }
  if (inflammatoryCount >= 2) { score -= 2; concerns.push('inflammatory'); }
  else if (inflammatoryCount >= 1) { score -= 1; concerns.push('contains-processed-foods'); }

  // Omega-3 bonus
  if (allNames.includes('salmon') || allNames.includes('sardine') || allNames.includes('mackerel') || allNames.includes('flax')) {
    flags.push('high-omega-3');
    score += 1;
  }

  // Fiber estimation
  if (totals.fiber >= 8) { flags.push('high-fiber'); score += 1; }

  // Calorie appropriateness
  if (totals.calories > 1200) { concerns.push('very-high-calorie'); score -= 1; }
  else if (totals.calories > 800) { concerns.push('high-calorie'); }

  // Anti-inflammatory markers
  if (allNames.includes('turmeric') || allNames.includes('ginger')) {
    flags.push('anti-inflammatory');
    score += 1;
  }

  // Late night penalty
  const hour = new Date().getHours();
  if (hour >= 21 && totals.carbs > 30) {
    concerns.push('late-night-carbs');
    score -= 1;
  }

  score = Math.max(1, Math.min(10, score));

  const notes = [
    `${totals.protein}g protein (${Math.round(proteinRatio * 100)}% of calories)`,
    longevityCount > 0 ? `${longevityCount} longevity food${longevityCount > 1 ? 's' : ''}` : null,
    inflammatoryCount > 0 ? `${inflammatoryCount} inflammatory item${inflammatoryCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return { score, flags, concerns, notes };
}

/* ═══════════════════════════════════════════════════════════════
   READINESS IMPACT — How a meal affects daily readiness score
   ═══════════════════════════════════════════════════════════════ */

export function computeMealReadinessImpact(
  totals: MacroTotals,
  qualityScore: number,
  dailyMealCount: number,
  dailyProteinTotal: number,
): {
  fuelingScore: number;
  proteinProgress: number;
  readinessDelta: number;
  message: string;
} {
  const proteinTarget = 150; // g/day
  const proteinProgress = Math.min(100, Math.round((dailyProteinTotal / proteinTarget) * 100));

  // Fueling score: protein progress + meal frequency + quality
  const fuelingScore = Math.round(
    (proteinProgress * 0.4) +
    (Math.min(100, (dailyMealCount / 4) * 100) * 0.3) +
    (qualityScore * 10 * 0.3)
  );

  // Readiness delta: positive for good meals, negative for poor ones
  let readinessDelta = 0;
  if (qualityScore >= 8) readinessDelta = 3;
  else if (qualityScore >= 6) readinessDelta = 1;
  else if (qualityScore <= 3) readinessDelta = -2;

  // Protein bonus
  if (totals.protein >= 40) readinessDelta += 2;
  else if (totals.protein >= 25) readinessDelta += 1;

  const message = readinessDelta > 0
    ? `+${readinessDelta} readiness — ${qualityScore >= 8 ? 'elite fueling' : 'solid nutrition'}`
    : readinessDelta < 0
      ? `${readinessDelta} readiness — consider higher protein, less processed`
      : 'Neutral impact on readiness';

  return { fuelingScore, proteinProgress, readinessDelta, message };
}

/* ═══════════════════════════════════════════════════════════════
   LAB SCORE IMPACT — How new biomarkers affect Vive Age
   ═══════════════════════════════════════════════════════════════ */

const ELITE_RANGES: Record<string, { name: string; min?: number; max?: number; unit: string; ageImpact: number }> = {
  crp:               { name: 'hs-CRP',        max: 0.5,  unit: 'mg/L',   ageImpact: 2.0 },
  hba1c:             { name: 'HbA1c',         max: 5.4,  unit: '%',      ageImpact: 2.5 },
  vitaminD:          { name: 'Vitamin D',     min: 40,   max: 60,  unit: 'ng/mL',  ageImpact: 1.5 },
  testosteroneTotal: { name: 'Testosterone',  min: 600,  max: 900, unit: 'ng/dL',  ageImpact: 1.0 },
  apoB:              { name: 'ApoB',          max: 80,   unit: 'mg/dL',  ageImpact: 2.0 },
  homocysteine:      { name: 'Homocysteine',  max: 8,    unit: 'umol/L', ageImpact: 1.5 },
  triglycerides:     { name: 'Triglycerides', max: 80,   unit: 'mg/dL',  ageImpact: 1.0 },
  ldl:               { name: 'LDL-C',        max: 100,  unit: 'mg/dL',  ageImpact: 1.5 },
  hdl:               { name: 'HDL-C',        min: 55,   unit: 'mg/dL',  ageImpact: 1.0 },
  glucose:           { name: 'Glucose',       min: 75,   max: 90,  unit: 'mg/dL',  ageImpact: 1.5 },
  ferritin:          { name: 'Ferritin',      min: 40,   max: 150, unit: 'ng/mL',  ageImpact: 0.5 },
  igf1:              { name: 'IGF-1',         min: 150,  max: 250, unit: 'ng/mL',  ageImpact: 1.0 },
};

export function computeLabScoreImpact(biomarkers: Record<string, number | null>): ScoreImpact {
  let biomarkerScore = 70;
  let viveAgeDelta = 0;
  let optimalCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  for (const [key, range] of Object.entries(ELITE_RANGES)) {
    const val = biomarkers[key];
    if (typeof val !== 'number') continue;

    let isOptimal = true;

    if (range.min !== undefined && range.max !== undefined) {
      if (val < range.min || val > range.max) {
        isOptimal = false;
        const deviation = val < range.min
          ? (range.min - val) / range.min
          : (val - range.max) / range.max;
        if (deviation > 0.25) {
          criticalCount++;
          viveAgeDelta += range.ageImpact;
        } else {
          warningCount++;
          viveAgeDelta += range.ageImpact * 0.4;
        }
      }
    } else if (range.max !== undefined && val > range.max) {
      isOptimal = false;
      const deviation = (val - range.max) / range.max;
      if (deviation > 0.5) { criticalCount++; viveAgeDelta += range.ageImpact; }
      else { warningCount++; viveAgeDelta += range.ageImpact * 0.4; }
    } else if (range.min !== undefined && val < range.min) {
      isOptimal = false;
      const deviation = (range.min - val) / range.min;
      if (deviation > 0.25) { criticalCount++; viveAgeDelta += range.ageImpact; }
      else { warningCount++; viveAgeDelta += range.ageImpact * 0.4; }
    }

    if (isOptimal) {
      optimalCount++;
      viveAgeDelta -= range.ageImpact * 0.3;
    }
  }

  biomarkerScore += optimalCount * 3;
  biomarkerScore -= warningCount * 2;
  biomarkerScore -= criticalCount * 5;
  biomarkerScore = Math.max(0, Math.min(100, biomarkerScore));

  return {
    viveAgeDelta: Math.round(viveAgeDelta * 10) / 10,
    readinessDelta: Math.round(optimalCount * 2 - warningCount - criticalCount * 3),
    biomarkerScore,
  };
}

/* ═══════════════════════════════════════════════════════════════
   UPLOAD STATE FACTORY — Create initial snapshot state
   ═══════════════════════════════════════════════════════════════ */

export function createSnapshotState(type: SnapshotType, file?: File): SnapshotUploadState {
  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    file: file || null,
    previewUrl: file ? URL.createObjectURL(file) : null,
    description: '',
    phase: 'idle',
    progress: 0,
    processingStep: '',
    result: null,
    error: null,
    storageId: null,
    committedAt: null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   PROCESSING PHASES — Animation step definitions
   ═══════════════════════════════════════════════════════════════ */

export const MEAL_PROCESS_PHASES = [
  { label: 'IDENTIFYING FOOD ITEMS', icon: '🔍', duration: 800 },
  { label: 'ESTIMATING PORTIONS', icon: '📏', duration: 1000 },
  { label: 'CALCULATING MACROS', icon: '🧮', duration: 900 },
  { label: 'SCORING QUALITY', icon: '⭐', duration: 700 },
  { label: 'UPDATING READINESS', icon: '📊', duration: 600 },
];

export const LAB_PROCESS_PHASES = [
  { label: 'AUTHENTICATING DOCUMENT', icon: '🔐', duration: 600 },
  { label: 'EXTRACTING BIOMARKERS', icon: '🧬', duration: 1400 },
  { label: 'CROSS-REFERENCING RANGES', icon: '📊', duration: 1000 },
  { label: 'COMPUTING VIVE AGE DELTA', icon: '🧠', duration: 800 },
  { label: 'UPDATING BIO-VAULT', icon: '🔒', duration: 500 },
];

/** Get the appropriate processing phases for a snapshot type */
export function getProcessPhases(type: SnapshotType) {
  return type === 'meal' ? MEAL_PROCESS_PHASES : LAB_PROCESS_PHASES;
}

/** Format a quality score as a color */
export function qualityColor(score: number): string {
  if (score >= 8) return '#34D399';
  if (score >= 6) return '#F59E0B';
  if (score >= 4) return '#FB923C';
  return '#FF453A';
}

/** Format a biomarker status as a color */
export function statusColor(status: 'optimal' | 'warning' | 'critical'): string {
  if (status === 'optimal') return '#34D399';
  if (status === 'warning') return '#FFD60A';
  return '#FF453A';
}

/** Accepted file types */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
export const DOC_TYPES = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) || /\.(jpg|jpeg|png|heic|heif|webp)$/i.test(file.name);
}

export function isLabDocument(file: File): boolean {
  return file.type === 'application/pdf' || /\.(pdf|csv|xlsx?)$/i.test(file.name);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
