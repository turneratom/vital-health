import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   LAB RESULT PARSER — Automated Intelligence for Vive 4.0
   
   Transforms raw lab report text (Quest/Labcorp PDFs) into:
   1. Structured biomarker data stored in labResults table
   2. BioVault updates (inflammation, hormones, metabolic markers)
   3. SomaticBodyMap marker updates (region severity auto-calculated)
   4. AI-generated clinical interpretation sentence
   
   Flow: Upload PDF → Extract text (frontend) → AI parse → 
         Store results → Update BioVault → Update SomaticMap →
         Generate interpretation → Return unified result
   ═══════════════════════════════════════════════════════════════ */

/* ── Biomarker → BioVault Field Mapping ── */
const MARKER_TO_BIOVAULT: Record<string, string> = {
  "vitamin d": "vitaminD",
  "vitamin d (25-oh)": "vitaminD",
  "25-hydroxyvitamin d": "vitaminD",
  "25-oh vitamin d": "vitaminD",
  "testosterone, total": "testosteroneTotal",
  "total testosterone": "testosteroneTotal",
  "testosterone total": "testosteroneTotal",
  "testosterone": "testosteroneTotal",
  "testosterone, free": "testosteroneFree",
  "free testosterone": "testosteroneFree",
  "ferritin": "ferritin",
  "hs-crp": "crp",
  "c-reactive protein": "crp",
  "crp": "crp",
  "high sensitivity crp": "crp",
  "hemoglobin a1c": "hba1c",
  "hba1c": "hba1c",
  "a1c": "hba1c",
  "glycated hemoglobin": "hba1c",
  "igf-1": "igf1",
  "igf-i": "igf1",
  "insulin-like growth factor": "igf1",
  "glucose": "fastingGlucose",
  "glucose, fasting": "fastingGlucose",
  "fasting glucose": "fastingGlucose",
};

/* ── Biomarker → Somatic Region Mapping ── */
const MARKER_TO_SOMATIC: Record<string, { region: string; system: string }> = {
  crp: { region: "gut", system: "inflammatory" },
  hba1c: { region: "abdomen", system: "metabolic" },
  fastingGlucose: { region: "abdomen", system: "metabolic" },
  vitaminD: { region: "lower_back", system: "musculoskeletal" },
  testosteroneTotal: { region: "hips", system: "hormonal" },
  testosteroneFree: { region: "hips", system: "hormonal" },
  ferritin: { region: "chest", system: "hematologic" },
  igf1: { region: "shoulders", system: "hormonal" },
};

/* ── Optimal Ranges for severity calculation ── */
const OPTIMAL_RANGES: Record<string, { min: number; max: number; critLow?: number; critHigh?: number }> = {
  vitaminD: { min: 50, max: 80, critLow: 20 },
  testosteroneTotal: { min: 600, max: 900, critLow: 250 },
  testosteroneFree: { min: 15, max: 25, critLow: 8 },
  ferritin: { min: 40, max: 150, critLow: 12, critHigh: 300 },
  crp: { min: 0, max: 0.5, critHigh: 3.0 },
  hba1c: { min: 4.0, max: 5.2, critHigh: 5.7 },
  igf1: { min: 150, max: 250 },
  fastingGlucose: { min: 75, max: 88, critHigh: 110 },
};

/* ── Calculate severity (0-10) from biomarker value ── */
function calcSeverity(key: string, value: number): number {
  const range = OPTIMAL_RANGES[key];
  if (!range) return 0;

  // Within optimal = 0 severity
  if (value >= range.min && value <= range.max) return 0;

  // Below optimal
  if (value < range.min) {
    if (range.critLow !== undefined && value <= range.critLow) return 9;
    const pctBelow = (range.min - value) / (range.min - (range.critLow ?? range.min * 0.3));
    return Math.min(8, Math.max(2, Math.round(pctBelow * 8)));
  }

  // Above optimal
  if (value > range.max) {
    if (range.critHigh !== undefined && value >= range.critHigh) return 9;
    const pctAbove = (value - range.max) / ((range.critHigh ?? range.max * 2) - range.max);
    return Math.min(8, Math.max(2, Math.round(pctAbove * 8)));
  }

  return 0;
}

/* ── Normalize marker name to BioVault key ── */
function normalizeToBioVaultKey(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (MARKER_TO_BIOVAULT[lower]) return MARKER_TO_BIOVAULT[lower];
  // Fuzzy match
  for (const [pattern, key] of Object.entries(MARKER_TO_BIOVAULT)) {
    if (lower.includes(pattern) || pattern.includes(lower)) return key;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   parseAndIngestLabResults — Main AI Action
   
   1. Sends raw text to LLM for biomarker extraction
   2. Maps extracted markers to BioVault schema
   3. Stores individual results in labResults table
   4. Updates BioVault with new values
   5. Calculates somatic severity for body map
   6. Generates clinical interpretation
   ═══════════════════════════════════════════════════════════════ */

export const parseAndIngestLabResults = action({
  args: {
    sessionId: v.string(),
    rawText: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (!SHIPPER_AI_URL || !SHIPPER_AI_TOKEN) {
      return {
        success: false,
        error: "AI not configured",
        biomarkers: [],
        bioVaultUpdates: {},
        somaticUpdates: [],
        interpretation: null,
      };
    }

    const now = Date.now();

    /* ── Step 1: AI Extraction ── */
    const extractionPrompt = `You are a clinical laboratory data extraction engine for Quest Diagnostics and Labcorp reports. Parse the lab report text and extract EVERY biomarker result.

OUTPUT FORMAT — strict JSON array, no markdown, no explanation:
[{"name": "Vitamin D (25-OH)", "value": 38.2, "unit": "ng/mL", "refLow": 30, "refHigh": 100}]

RULES:
- Always use numeric values (not strings)
- Normalize units to standard: ng/mL, mg/dL, %, U/L, pg/mL, mIU/L, umol/L, g/dL, mcg/dL
- For ">100" or "<0.5" use the number itself
- Include reference ranges when available
- Skip non-numeric results (Negative, Non-reactive, etc.)
- Extract ALL results including CBC, CMP, lipid panel, thyroid, hormones, vitamins
- Return empty array [] if no results found`;

    let extractedBiomarkers: Array<{
      name: string;
      value: number;
      unit: string;
      refLow?: number;
      refHigh?: number;
    }> = [];

    try {
      const resp = await fetch(SHIPPER_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: extractionPrompt },
            { role: "user", content: `Extract all biomarker results:\n\n${args.rawText.slice(0, 12000)}` },
          ],
          temperature: 0.05,
          max_tokens: 4000,
        }),
      });

      if (!resp.ok) {
        return { success: false, error: `AI error: ${resp.status}`, biomarkers: [], bioVaultUpdates: {}, somaticUpdates: [], interpretation: null };
      }

      const data = await resp.json();
      let content = data?.choices?.[0]?.message?.content?.trim() ?? "[]";
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        extractedBiomarkers = parsed.filter(
          (b: any) => b.name && typeof b.value === "number" && b.unit
        );
      }
    } catch (err: any) {
      return { success: false, error: `Extraction failed: ${err?.message}`, biomarkers: [], bioVaultUpdates: {}, somaticUpdates: [], interpretation: null };
    }

    if (extractedBiomarkers.length === 0) {
      return { success: false, error: "No biomarkers found in text", biomarkers: [], bioVaultUpdates: {}, somaticUpdates: [], interpretation: null };
    }

    /* ── Step 2: Map to BioVault + Calculate Severity ── */
    const bioVaultUpdates: Record<string, number> = {};
    const somaticUpdates: Array<{
      region: string;
      system: string;
      severity: number;
      marker: string;
      value: number;
      unit: string;
    }> = [];

    for (const bm of extractedBiomarkers) {
      const vaultKey = normalizeToBioVaultKey(bm.name);
      if (vaultKey) {
        bioVaultUpdates[vaultKey] = bm.value;

        // Calculate somatic severity
        const somaticMapping = MARKER_TO_SOMATIC[vaultKey];
        if (somaticMapping) {
          const severity = calcSeverity(vaultKey, bm.value);
          if (severity > 0) {
            somaticUpdates.push({
              region: somaticMapping.region,
              system: somaticMapping.system,
              severity,
              marker: bm.name,
              value: bm.value,
              unit: bm.unit,
            });
          }
        }
      }
    }

    /* ── Step 3: Store results + update BioVault via mutations ── */
    try {
      await ctx.runMutation(
        "labParser:storeLabResults" as any,
        {
          sessionId: args.sessionId,
          biomarkers: extractedBiomarkers.map((b) => ({
            name: b.name,
            value: b.value,
            unit: b.unit,
            refLow: b.refLow,
            refHigh: b.refHigh,
          })),
          bioVaultUpdates,
          somaticUpdates: somaticUpdates.map((s) => ({
            region: s.region,
            severity: s.severity,
            description: `${s.marker}: ${s.value} ${s.unit} — ${s.system} system flagged`,
          })),
          fileName: args.fileName,
          timestamp: now,
        }
      );
    } catch (err: any) {
      console.error("[LabParser] Store mutation failed:", err);
    }

    /* ── Step 4: Generate Clinical Interpretation ── */
    let interpretation: string | null = null;

    try {
      const interpPrompt = `You are the Vive Biological OS. Given these lab results, generate a single clinical interpretation paragraph (3-4 sentences max). Reference specific values. Identify the most critical finding first. Recommend specific protocols (peptides like BPC-157, supplements, lifestyle changes). Use clinical precision — no hedging.

LAB RESULTS:
${extractedBiomarkers.map((b) => `${b.name}: ${b.value} ${b.unit}${b.refLow !== undefined ? ` (ref: ${b.refLow}-${b.refHigh})` : ""}`).join("\n")}

BIOVAULT MAPPINGS:
${Object.entries(bioVaultUpdates).map(([k, v]) => {
  const range = OPTIMAL_RANGES[k];
  const status = range ? (v >= range.min && v <= range.max ? "OPTIMAL" : v < (range.critLow ?? 0) || v > (range.critHigh ?? Infinity) ? "CRITICAL" : "SUB-OPTIMAL") : "UNKNOWN";
  return `${k}: ${v} — ${status}`;
}).join("\n")}

Return ONLY the interpretation paragraph. No JSON, no markdown.`;

      const interpResp = await fetch(SHIPPER_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: interpPrompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (interpResp.ok) {
        const interpData = await interpResp.json();
        const raw = interpData?.choices?.[0]?.message?.content?.trim();
        if (raw && raw.length > 20) {
          interpretation = raw;
        }
      }
    } catch { /* interpretation is optional */ }

    return {
      success: true,
      error: null,
      biomarkers: extractedBiomarkers,
      bioVaultUpdates,
      somaticUpdates,
      interpretation,
      markersFound: extractedBiomarkers.length,
      vaultFieldsUpdated: Object.keys(bioVaultUpdates).length,
      somaticRegionsAffected: somaticUpdates.length,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   storeLabResults — Mutation to persist parsed results
   ═══════════════════════════════════════════════════════════════ */

export const storeLabResults = mutation({
  args: {
    sessionId: v.string(),
    biomarkers: v.array(v.object({
      name: v.string(),
      value: v.number(),
      unit: v.string(),
      refLow: v.optional(v.number()),
      refHigh: v.optional(v.number()),
    })),
    bioVaultUpdates: v.any(),
    somaticUpdates: v.array(v.object({
      region: v.string(),
      severity: v.number(),
      description: v.string(),
    })),
    fileName: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp;

    // 1. Store each biomarker in labResults table
    for (const bm of args.biomarkers) {
      await ctx.db.insert("labResults", {
        sessionId: args.sessionId,
        marker: bm.name,
        value: bm.value,
        unit: bm.unit,
        source: args.fileName,
        testedAt: now,
        loggedAt: now,
      });
    }

    // 2. Update BioVault with mapped values
    const updates = args.bioVaultUpdates as Record<string, number>;
    if (Object.keys(updates).length > 0) {
      const existing = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...updates,
          updatedAt: now,
          bioStatus: determineBioStatus(updates),
          bioStatusUpdatedAt: now,
        });
      } else {
        await ctx.db.insert("bioVault", {
          sessionId: args.sessionId,
          mthfrVariant: false,
          apoe4: false,
          caffeineSensitivity: false,
          preferredProteins: "",
          dietaryRestrictions: "",
          updatedAt: now,
          ...updates,
        });
      }
    }

    // 3. Store somatic body map entries
    for (const somatic of args.somaticUpdates) {
      try {
        await ctx.db.insert("bodyMapEntries", {
          sessionId: args.sessionId,
          region: somatic.region,
          severity: somatic.severity,
          description: somatic.description,
          source: "lab-parser",
          loggedAt: now,
        });
      } catch { /* table may not exist */ }
    }

    // 4. Log as vault file
    try {
      await ctx.db.insert("vaultFiles", {
        sessionId: args.sessionId,
        fileName: args.fileName,
        fileType: "application/pdf",
        category: "blood-panels",
        fileSize: 0,
        encryptionStatus: "AES-256-GCM",
        uploadedAt: now,
        notes: `Auto-parsed: ${args.biomarkers.length} biomarkers extracted`,
      });
    } catch { /* continue */ }

    return { stored: args.biomarkers.length };
  },
});

/* ── Helper: determine bio status from lab values ── */
function determineBioStatus(updates: Record<string, number>): string {
  const crp = updates.crp;
  const hba1c = updates.hba1c;
  const glucose = updates.fastingGlucose;

  if (crp !== undefined && crp > 3.0) return "inflamed";
  if (hba1c !== undefined && hba1c > 5.7) return "dysglycemic";
  if (glucose !== undefined && glucose > 110) return "hyperglycemic";
  if (crp !== undefined && crp > 1.0) return "sub-optimal";
  return "optimal";
}

/* ═══════════════════════════════════════════════════════════════
   getLabHistory — Query recent lab results for display
   ═══════════════════════════════════════════════════════════════ */

export const getLabHistory = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(100);

    // Group by marker for trend display
    const grouped: Record<string, Array<{ value: number; unit: string; testedAt: number; source: string }>> = {};
    for (const r of results) {
      if (!grouped[r.marker]) grouped[r.marker] = [];
      grouped[r.marker].push({
        value: r.value,
        unit: r.unit,
        testedAt: r.testedAt,
        source: r.source,
      });
    }

    return {
      results,
      grouped,
      totalMarkers: results.length,
      uniqueMarkers: Object.keys(grouped).length,
      latestUpload: results[0]?.loggedAt ?? null,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   getLatestLabSummary — Quick summary for HUD display
   ═══════════════════════════════════════════════════════════════ */

export const getLatestLabSummary = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("labResults")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50);

    if (results.length === 0) return null;

    // Get latest value per marker
    const latest: Record<string, { value: number; unit: string; testedAt: number }> = {};
    for (const r of results) {
      if (!latest[r.marker]) {
        latest[r.marker] = { value: r.value, unit: r.unit, testedAt: r.testedAt };
      }
    }

    // Count flagged markers
    let flagged = 0;
    let optimal = 0;
    for (const [marker, data] of Object.entries(latest)) {
      const vaultKey = normalizeToBioVaultKey(marker);
      if (vaultKey && OPTIMAL_RANGES[vaultKey]) {
        const range = OPTIMAL_RANGES[vaultKey];
        if (data.value >= range.min && data.value <= range.max) {
          optimal++;
        } else {
          flagged++;
        }
      }
    }

    return {
      totalMarkers: Object.keys(latest).length,
      flagged,
      optimal,
      lastUpload: results[0]?.testedAt ?? null,
      latest,
    };
  },
});
