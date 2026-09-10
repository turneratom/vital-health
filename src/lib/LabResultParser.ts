/**
 * LabResultParser — Frontend utility for handling lab report uploads
 * 
 * Handles PDF text extraction (via browser FileReader), orchestrates
 * the AI parse action, and provides optimal range definitions that
 * distinguish between "clinically normal" and "sub-optimal for longevity."
 */

/* ── Biomarker Category & Parsed Biomarker Types (used by LabUploader) ── */

export type BiomarkerCategory =
  | 'vitamins'
  | 'minerals'
  | 'hormones'
  | 'metabolic'
  | 'inflammation'
  | 'thyroid'
  | 'lipids'
  | 'hematology'
  | 'kidney'
  | 'liver'
  | 'cardiac'
  | 'other';

export interface ParsedBiomarker {
  name: string;
  value: number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical';
  category: BiomarkerCategory;
  vaultKey: string | null;
}

/* ── Longevity-Optimal Ranges (stricter than clinical) ── */

export interface LongevityRange {
  key: string;
  label: string;
  unit: string;
  clinicalLow?: number;
  clinicalHigh?: number;
  optimalLow?: number;
  optimalHigh?: number;
  direction: 'higher-better' | 'lower-better' | 'range';
  category: 'metabolic' | 'hormonal' | 'inflammatory' | 'nutrient' | 'lipid' | 'thyroid' | 'hematologic';
}

export const LONGEVITY_RANGES: Record<string, LongevityRange> = {
  vitaminD: {
    key: 'vitaminD', label: 'Vitamin D (25-OH)', unit: 'ng/mL',
    clinicalLow: 30, clinicalHigh: 100,
    optimalLow: 50, optimalHigh: 80,
    direction: 'range', category: 'nutrient',
  },
  ferritin: {
    key: 'ferritin', label: 'Ferritin', unit: 'ng/mL',
    clinicalLow: 12, clinicalHigh: 300,
    optimalLow: 40, optimalHigh: 150,
    direction: 'range', category: 'nutrient',
  },
  crp: {
    key: 'crp', label: 'hs-CRP', unit: 'mg/L',
    clinicalHigh: 3.0,
    optimalHigh: 0.5,
    direction: 'lower-better', category: 'inflammatory',
  },
  hba1c: {
    key: 'hba1c', label: 'HbA1c', unit: '%',
    clinicalHigh: 5.7,
    optimalHigh: 5.2,
    direction: 'lower-better', category: 'metabolic',
  },
  testosteroneTotal: {
    key: 'testosteroneTotal', label: 'Testosterone (Total)', unit: 'ng/dL',
    clinicalLow: 264, clinicalHigh: 916,
    optimalLow: 600, optimalHigh: 900,
    direction: 'range', category: 'hormonal',
  },
  testosteroneFree: {
    key: 'testosteroneFree', label: 'Testosterone (Free)', unit: 'pg/mL',
    clinicalLow: 5, clinicalHigh: 21,
    optimalLow: 15, optimalHigh: 25,
    direction: 'range', category: 'hormonal',
  },
  cortisol: {
    key: 'cortisol', label: 'Cortisol (AM)', unit: 'mcg/dL',
    clinicalLow: 6, clinicalHigh: 23,
    optimalLow: 10, optimalHigh: 16,
    direction: 'range', category: 'hormonal',
  },
  tsh: {
    key: 'tsh', label: 'TSH', unit: 'mIU/L',
    clinicalLow: 0.4, clinicalHigh: 4.5,
    optimalLow: 1.0, optimalHigh: 2.5,
    direction: 'range', category: 'thyroid',
  },
  freeT4: {
    key: 'freeT4', label: 'Free T4', unit: 'ng/dL',
    clinicalLow: 0.8, clinicalHigh: 1.8,
    optimalLow: 1.2, optimalHigh: 1.5,
    direction: 'range', category: 'thyroid',
  },
  homocysteine: {
    key: 'homocysteine', label: 'Homocysteine', unit: 'umol/L',
    clinicalHigh: 15,
    optimalHigh: 8,
    direction: 'lower-better', category: 'inflammatory',
  },
  ldl: {
    key: 'ldl', label: 'LDL-C', unit: 'mg/dL',
    clinicalHigh: 130,
    optimalHigh: 100,
    direction: 'lower-better', category: 'lipid',
  },
  hdl: {
    key: 'hdl', label: 'HDL-C', unit: 'mg/dL',
    clinicalLow: 40,
    optimalLow: 55,
    direction: 'higher-better', category: 'lipid',
  },
  triglycerides: {
    key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL',
    clinicalHigh: 150,
    optimalHigh: 80,
    direction: 'lower-better', category: 'lipid',
  },
  glucose: {
    key: 'glucose', label: 'Glucose (Fasting)', unit: 'mg/dL',
    clinicalLow: 70, clinicalHigh: 100,
    optimalLow: 75, optimalHigh: 90,
    direction: 'range', category: 'metabolic',
  },
  insulin: {
    key: 'insulin', label: 'Insulin (Fasting)', unit: 'uIU/mL',
    clinicalHigh: 25,
    optimalLow: 2, optimalHigh: 5,
    direction: 'lower-better', category: 'metabolic',
  },
  hemoglobin: {
    key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL',
    clinicalLow: 12, clinicalHigh: 17.5,
    optimalLow: 14, optimalHigh: 17,
    direction: 'range', category: 'hematologic',
  },
  b12: {
    key: 'b12', label: 'Vitamin B12', unit: 'pg/mL',
    clinicalLow: 200, clinicalHigh: 1100,
    optimalLow: 500, optimalHigh: 1000,
    direction: 'range', category: 'nutrient',
  },
  folate: {
    key: 'folate', label: 'Folate', unit: 'ng/mL',
    clinicalLow: 3,
    optimalLow: 10, optimalHigh: 25,
    direction: 'higher-better', category: 'nutrient',
  },
  magnesium: {
    key: 'magnesium', label: 'Magnesium (RBC)', unit: 'mg/dL',
    clinicalLow: 4.2, clinicalHigh: 6.8,
    optimalLow: 5.0, optimalHigh: 6.5,
    direction: 'range', category: 'nutrient',
  },
  zinc: {
    key: 'zinc', label: 'Zinc', unit: 'mcg/dL',
    clinicalLow: 60, clinicalHigh: 130,
    optimalLow: 90, optimalHigh: 120,
    direction: 'range', category: 'nutrient',
  },
  iron: {
    key: 'iron', label: 'Iron (Serum)', unit: 'mcg/dL',
    clinicalLow: 60, clinicalHigh: 170,
    optimalLow: 80, optimalHigh: 120,
    direction: 'range', category: 'nutrient',
  },
  omega3Index: {
    key: 'omega3Index', label: 'Omega-3 Index', unit: '%',
    clinicalLow: 4,
    optimalLow: 8,
    direction: 'higher-better', category: 'nutrient',
  },
  igf1: {
    key: 'igf1', label: 'IGF-1', unit: 'ng/mL',
    clinicalLow: 100, clinicalHigh: 350,
    optimalLow: 150, optimalHigh: 250,
    direction: 'range', category: 'hormonal',
  },
  fastingGlucose: {
    key: 'fastingGlucose', label: 'Fasting Glucose', unit: 'mg/dL',
    clinicalLow: 70, clinicalHigh: 100,
    optimalLow: 75, optimalHigh: 88,
    direction: 'range', category: 'metabolic',
  },
};

/* ── Classification Types ── */

export type MarkerClassification = 
  | 'optimal'           // Within longevity-optimal range
  | 'clinically-normal'  // Within clinical range but NOT optimal for longevity
  | 'out-of-range';      // Outside even clinical range

export interface ClassifiedMarker {
  key: string;
  label: string;
  value: number;
  unit: string;
  classification: MarkerClassification;
  category: string;
  optimalRange: string;
  clinicalRange: string;
  delta: string;          // e.g., "12 ng/mL below optimal"
  suggestion: string;     // Protocol adjustment suggestion
  severity: 'green' | 'amber' | 'red';
}

/* ── Classify a single marker against longevity ranges ── */

export function classifyMarker(key: string, value: number): ClassifiedMarker | null {
  const range = LONGEVITY_RANGES[key];
  if (!range) return null;

  let classification: MarkerClassification = 'optimal';
  let severity: 'green' | 'amber' | 'red' = 'green';
  let delta = '';
  let suggestion = '';

  const optLow = range.optimalLow;
  const optHigh = range.optimalHigh;
  const clinLow = range.clinicalLow;
  const clinHigh = range.clinicalHigh;

  const optRange = optLow !== undefined && optHigh !== undefined
    ? `${optLow}–${optHigh} ${range.unit}`
    : optHigh !== undefined
      ? `<${optHigh} ${range.unit}`
      : optLow !== undefined
        ? `>${optLow} ${range.unit}`
        : '—';

  const clinRange = clinLow !== undefined && clinHigh !== undefined
    ? `${clinLow}–${clinHigh} ${range.unit}`
    : clinHigh !== undefined
      ? `<${clinHigh} ${range.unit}`
      : clinLow !== undefined
        ? `>${clinLow} ${range.unit}`
        : '—';

  // Check against optimal range
  if (range.direction === 'lower-better') {
    if (optHigh !== undefined && value > optHigh) {
      if (clinHigh !== undefined && value <= clinHigh) {
        classification = 'clinically-normal';
        severity = 'amber';
        delta = `${(value - optHigh).toFixed(1)} ${range.unit} above optimal`;
      } else {
        classification = 'out-of-range';
        severity = 'red';
        delta = `${(value - (clinHigh ?? optHigh)).toFixed(1)} ${range.unit} above clinical range`;
      }
    }
  } else if (range.direction === 'higher-better') {
    if (optLow !== undefined && value < optLow) {
      if (clinLow !== undefined && value >= clinLow) {
        classification = 'clinically-normal';
        severity = 'amber';
        delta = `${(optLow - value).toFixed(1)} ${range.unit} below optimal`;
      } else {
        classification = 'out-of-range';
        severity = 'red';
        delta = `${((clinLow ?? optLow) - value).toFixed(1)} ${range.unit} below clinical range`;
      }
    }
  } else {
    // range direction
    if (optLow !== undefined && value < optLow) {
      if (clinLow !== undefined && value >= clinLow) {
        classification = 'clinically-normal';
        severity = 'amber';
        delta = `${(optLow - value).toFixed(1)} ${range.unit} below optimal`;
      } else {
        classification = 'out-of-range';
        severity = 'red';
        delta = `${((clinLow ?? optLow) - value).toFixed(1)} ${range.unit} below clinical range`;
      }
    } else if (optHigh !== undefined && value > optHigh) {
      if (clinHigh !== undefined && value <= clinHigh) {
        classification = 'clinically-normal';
        severity = 'amber';
        delta = `${(value - optHigh).toFixed(1)} ${range.unit} above optimal`;
      } else {
        classification = 'out-of-range';
        severity = 'red';
        delta = `${(value - (clinHigh ?? optHigh)).toFixed(1)} ${range.unit} above clinical range`;
      }
    }
  }

  // Generate suggestion based on classification
  if (classification === 'optimal') {
    suggestion = 'Within longevity-optimal range. Maintain current protocol.';
  } else if (classification === 'clinically-normal') {
    suggestion = `Clinically acceptable but sub-optimal for longevity. Consider targeted protocol to reach ${optRange}.`;
  } else {
    suggestion = `Outside clinical range. Consult healthcare provider immediately.`;
  }

  return {
    key,
    label: range.label,
    value,
    unit: range.unit,
    classification,
    category: range.category,
    optimalRange: optRange,
    clinicalRange: clinRange,
    delta,
    suggestion,
    severity,
  };
}

/* ── Classify a full set of markers ── */

export interface ClassifiedMarkersResult {
  all: ClassifiedMarker[];
  optimal: ClassifiedMarker[];
  subOptimal: ClassifiedMarker[];
  outOfRange: ClassifiedMarker[];
}

export function classifyAllMarkers(
  biomarkers: Record<string, number | null>
): ClassifiedMarkersResult {
  const all: ClassifiedMarker[] = [];
  for (const [key, value] of Object.entries(biomarkers)) {
    if (value === null || value === undefined) continue;
    const classified = classifyMarker(key, value);
    if (classified) all.push(classified);
  }
  return {
    all,
    optimal: all.filter((m) => m.classification === 'optimal'),
    subOptimal: all.filter((m) => m.classification === 'clinically-normal'),
    outOfRange: all.filter((m) => m.classification === 'out-of-range'),
  };
}

/* ── Extract text from uploaded PDF/image files ── */

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        // For binary/PDF files, return a placeholder; real extraction
        // happens server-side via the AI parse action.
        resolve('[Binary file uploaded - will be parsed server-side]');
      }
    };
    reader.onerror = () => reject(reader.error);
    if (file.type.startsWith('text/')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

/* ── Map AI-parsed biomarkers to BioVault schema keys ── */

export const BIOVAULT_MAPPABLE_KEYS = [
  'vitaminD', 'testosteroneFree', 'testosteroneTotal',
  'ferritin', 'crp', 'hba1c', 'igf1', 'fastingGlucose',
] as const;

export function mapToBioVaultUpdate(
  biomarkers: Record<string, number | null>
): Record<string, number> {
  const update: Record<string, number> = {};
  for (const key of BIOVAULT_MAPPABLE_KEYS) {
    const val = biomarkers[key];
    if (val !== null && val !== undefined && typeof val === 'number') {
      update[key] = val;
    }
  }
  return update;
}

/* ═══════════════════════════════════════════════════════════════
   AI BIOMARKER EXTRACTION — prompt + parsers used by LabUploader
   ═══════════════════════════════════════════════════════════════ */

export const BIOMARKER_EXTRACTION_PROMPT = `You are a medical lab-report parser. Extract every biomarker from the provided lab report text and return ONLY valid JSON (no prose, no markdown fences).

Return an array of objects with this exact shape:
[
  {
    "name": "Vitamin D (25-OH)",
    "value": 38,
    "unit": "ng/mL",
    "status": "warning",
    "category": "vitamins",
    "vaultKey": "vitaminD"
  }
]

Rules:
- "status" must be one of: "optimal" | "warning" | "critical".
- "category" must be one of: vitamins | minerals | hormones | metabolic | inflammation | thyroid | lipids | hematology | kidney | liver | cardiac | other.
- "vaultKey" is the canonical BioVault key if known (vitaminD, ferritin, crp, hba1c, testosteroneTotal, testosteroneFree, igf1, fastingGlucose), otherwise null.
- Numbers only in "value". Do not include ranges or text.
- Omit any biomarker that cannot be parsed cleanly.`;

/**
 * Parse raw AI response text into an array of ParsedBiomarker.
 * Tolerant of code fences and surrounding prose.
 */
export function parseAIResponse(text: string): ParsedBiomarker[] {
  if (!text || typeof text !== 'string') return [];
  try {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    // Find first JSON array in the string
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return [];

    const jsonSlice = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonSlice);
    if (!Array.isArray(parsed)) return [];

    const allowedCategories: BiomarkerCategory[] = [
      'vitamins', 'minerals', 'hormones', 'metabolic', 'inflammation',
      'thyroid', 'lipids', 'hematology', 'kidney', 'liver', 'cardiac', 'other',
    ];
    const allowedStatus = ['optimal', 'warning', 'critical'] as const;

    const biomarkers: ParsedBiomarker[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const name = typeof item.name === 'string' ? item.name : null;
      const value = typeof item.value === 'number' ? item.value : Number(item.value);
      const unit = typeof item.unit === 'string' ? item.unit : '';
      const status = allowedStatus.includes(item.status) ? item.status : 'optimal';
      const category: BiomarkerCategory = allowedCategories.includes(item.category)
        ? item.category
        : 'other';
      const vaultKey = typeof item.vaultKey === 'string' ? item.vaultKey : null;

      if (!name || !Number.isFinite(value)) continue;
      biomarkers.push({ name, value, unit, status, category, vaultKey });
    }
    return biomarkers;
  } catch {
    return [];
  }
}

/**
 * Regex-based fallback extractor for when no AI is available.
 * Scans text for "Name: value unit" style patterns and maps common markers
 * to vault keys / categories.
 */
export function extractBiomarkersFromText(text: string): ParsedBiomarker[] {
  if (!text || typeof text !== 'string') return [];

  const MARKER_TABLE: Array<{
    patterns: RegExp[];
    name: string;
    defaultUnit: string;
    category: BiomarkerCategory;
    vaultKey: string | null;
  }> = [
    { patterns: [/vitamin\s*d(?:\s*\(?25[-\s]?oh\)?)?/i, /25[-\s]?oh[-\s]?d/i], name: 'Vitamin D (25-OH)', defaultUnit: 'ng/mL', category: 'vitamins', vaultKey: 'vitaminD' },
    { patterns: [/ferritin/i], name: 'Ferritin', defaultUnit: 'ng/mL', category: 'minerals', vaultKey: 'ferritin' },
    { patterns: [/hs[-\s]?crp/i, /c[-\s]?reactive protein/i], name: 'hs-CRP', defaultUnit: 'mg/L', category: 'inflammation', vaultKey: 'crp' },
    { patterns: [/hba1c/i, /hemoglobin a1c/i, /a1c/i], name: 'HbA1c', defaultUnit: '%', category: 'metabolic', vaultKey: 'hba1c' },
    { patterns: [/testosterone\s*(?:total|,\s*total)/i, /total\s*testosterone/i], name: 'Testosterone (Total)', defaultUnit: 'ng/dL', category: 'hormones', vaultKey: 'testosteroneTotal' },
    { patterns: [/testosterone\s*(?:free|,\s*free)/i, /free\s*testosterone/i], name: 'Testosterone (Free)', defaultUnit: 'pg/mL', category: 'hormones', vaultKey: 'testosteroneFree' },
    { patterns: [/\btsh\b/i], name: 'TSH', defaultUnit: 'mIU/L', category: 'thyroid', vaultKey: null },
    { patterns: [/free\s*t4/i, /\bft4\b/i], name: 'Free T4', defaultUnit: 'ng/dL', category: 'thyroid', vaultKey: null },
    { patterns: [/cortisol/i], name: 'Cortisol (AM)', defaultUnit: 'mcg/dL', category: 'hormones', vaultKey: null },
    { patterns: [/homocysteine/i], name: 'Homocysteine', defaultUnit: 'umol/L', category: 'cardiac', vaultKey: null },
    { patterns: [/\bldl\b/i, /ldl[-\s]?c/i], name: 'LDL-C', defaultUnit: 'mg/dL', category: 'lipids', vaultKey: null },
    { patterns: [/\bhdl\b/i, /hdl[-\s]?c/i], name: 'HDL-C', defaultUnit: 'mg/dL', category: 'lipids', vaultKey: null },
    { patterns: [/triglycerides?/i], name: 'Triglycerides', defaultUnit: 'mg/dL', category: 'lipids', vaultKey: null },
    { patterns: [/fasting\s*glucose/i, /glucose\s*(?:,\s*fasting|fasting)/i, /\bglucose\b/i], name: 'Glucose (Fasting)', defaultUnit: 'mg/dL', category: 'metabolic', vaultKey: 'fastingGlucose' },
    { patterns: [/fasting\s*insulin/i, /\binsulin\b/i], name: 'Insulin (Fasting)', defaultUnit: 'uIU/mL', category: 'metabolic', vaultKey: null },
    { patterns: [/igf[-\s]?1/i], name: 'IGF-1', defaultUnit: 'ng/mL', category: 'hormones', vaultKey: 'igf1' },
    { patterns: [/\bb12\b/i, /vitamin\s*b[-\s]?12/i], name: 'Vitamin B12', defaultUnit: 'pg/mL', category: 'vitamins', vaultKey: null },
    { patterns: [/folate/i], name: 'Folate', defaultUnit: 'ng/mL', category: 'vitamins', vaultKey: null },
    { patterns: [/magnesium/i], name: 'Magnesium', defaultUnit: 'mg/dL', category: 'minerals', vaultKey: null },
    { patterns: [/\bzinc\b/i], name: 'Zinc', defaultUnit: 'mcg/dL', category: 'minerals', vaultKey: null },
    { patterns: [/hemoglobin(?!\s*a1c)/i], name: 'Hemoglobin', defaultUnit: 'g/dL', category: 'hematology', vaultKey: null },
  ];

  const results: ParsedBiomarker[] = [];
  const seen = new Set<string>();

  for (const marker of MARKER_TABLE) {
    for (const pattern of marker.patterns) {
      // Find "<name> ... <number> <unit?>" within ~60 chars of the match
      const regex = new RegExp(
        pattern.source + '[^\\n\\r]{0,60}?([0-9]+(?:\\.[0-9]+)?)\\s*([a-zA-Z/%µμ]+(?:\\/[a-zA-Z]+)?)?',
        'i'
      );
      const match = text.match(regex);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = (match[2] || marker.defaultUnit).trim();
        if (!Number.isFinite(value)) break;
        if (seen.has(marker.name)) break;
        seen.add(marker.name);

        // Classify status from longevity ranges when possible
        let status: 'optimal' | 'warning' | 'critical' = 'optimal';
        if (marker.vaultKey) {
          const classified = classifyMarker(marker.vaultKey, value);
          if (classified) {
            status =
              classified.classification === 'out-of-range' ? 'critical' :
              classified.classification === 'clinically-normal' ? 'warning' :
              'optimal';
          }
        }

        results.push({
          name: marker.name,
          value,
          unit,
          status,
          category: marker.category,
          vaultKey: marker.vaultKey,
        });
        break;
      }
    }
  }

  return results;
}

/**
 * Build a BioVault update payload from an array of ParsedBiomarker objects.
 * Only biomarkers with a known vaultKey in BIOVAULT_MAPPABLE_KEYS are included.
 */
export function buildVaultMapping(
  biomarkers: ParsedBiomarker[]
): Record<string, number> {
  const update: Record<string, number> = {};
  if (!Array.isArray(biomarkers)) return update;

  const mappable = new Set<string>(BIOVAULT_MAPPABLE_KEYS as readonly string[]);
  for (const b of biomarkers) {
    if (!b || !b.vaultKey) continue;
    if (!mappable.has(b.vaultKey)) continue;
    if (typeof b.value !== 'number' || !Number.isFinite(b.value)) continue;
    update[b.vaultKey] = b.value;
  }
  return update;
}

export interface BioLinkParseResult {
  biomarkers: ParsedBiomarker[];
  unmatchedLines: string[];
  confidence: number;
}

/**
 * Thin wrapper over extractBiomarkersFromText for QuickSync.
 * No new parsing rules — plumbing only.
 */
export function parseBioLinkText(rawText: string): BioLinkParseResult {
  const biomarkers = extractBiomarkersFromText(rawText);
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const matchedNames = new Set(biomarkers.map((b) => b.name.toLowerCase()));
  const unmatchedLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    for (const name of matchedNames) {
      if (lower.includes(name.split('(')[0].trim())) return false;
    }
    // Also treat lines that clearly fed a parse as matched via value presence
    return !biomarkers.some((b) => lower.includes(String(b.value)));
  });
  const confidence = biomarkers.length === 0
    ? 0
    : Math.min(1, 0.4 + biomarkers.length * 0.1);
  return { biomarkers, unmatchedLines, confidence };
}
