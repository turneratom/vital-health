import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   INSTANT ONBOARD — Zero-Form AI Brain Parser
   
   Accepts ANY health data (lab text, supplement photo text, 
   free-form description) and returns:
   1. Complete BioVault mapping (biomarkers, genetics, diet)
   2. Inferred North Star goal
   3. Detected supplement stack
   4. User vitals (age, gender, weight)
   5. Personalized first-win protocol recommendations
   
   Goal: App Open → Personalized Protocol in <30 seconds
   ═══════════════════════════════════════════════════════════════ */

const INSTANT_ONBOARD_PROMPT = `You are the Vive Clinical Onboarding Engine. A user has dropped health data into the system. Your job is to extract EVERYTHING possible and return a complete biological profile.

EXTRACT ALL OF THE FOLLOWING (use null for anything not found):

1. BIOMARKERS — Extract every lab value with its numeric result:
   vitaminD, testosteroneTotal, testosteroneFree, ferritin, crp, hba1c, igf1, fastingGlucose
   Plus any others you find (return them in "additionalBiomarkers")

2. USER VITALS:
   age (number), gender ("male"/"female"/"other"), weight (number), weightUnit ("lbs"/"kg")

3. SUPPLEMENTS — List every supplement/medication mentioned

4. GENETIC FLAGS:
   mthfrVariant (boolean), apoe4 (boolean), caffeineSensitivity (boolean)

5. DIETARY INFO:
   preferredProteins (string), dietaryRestrictions (string)

6. SLEEP DATA:
   sleepHours (number if mentioned)

7. INFERRED NORTH STAR — Based on ALL the data, infer the user's primary health goal:
   "longevity" | "peak-output" | "recovery" | "body-recomp"
   Provide confidence (0-1) and a one-sentence reason.

8. DATA QUALITY:
   "high" (lab report with many values), "medium" (partial data), "low" (minimal info)
   Plus a brief note explaining the assessment.

OUTPUT FORMAT (strict JSON, no markdown, no code fences):
{
  "biomarkers": {
    "vitaminD": 42.5,
    "testosteroneTotal": null,
    "testosteroneFree": null,
    "ferritin": 85,
    "crp": 0.8,
    "hba1c": 5.2,
    "igf1": null,
    "fastingGlucose": null
  },
  "additionalBiomarkers": [
    {"name": "TSH", "value": 2.1, "unit": "mIU/L"},
    {"name": "LDL-C", "value": 95, "unit": "mg/dL"}
  ],
  "vitals": {
    "age": 34,
    "gender": "male",
    "weight": 180,
    "weightUnit": "lbs"
  },
  "supplements": ["Vitamin D3", "Magnesium Glycinate", "Omega-3"],
  "geneticFlags": {
    "mthfrVariant": false,
    "apoe4": false,
    "caffeineSensitivity": false
  },
  "diet": {
    "preferredProteins": "chicken, fish, eggs",
    "dietaryRestrictions": "none"
  },
  "sleepHours": 7.5,
  "northStar": {
    "goal": "longevity",
    "confidence": 0.85,
    "reason": "Biomarker profile suggests focus on anti-inflammatory optimization and metabolic health."
  },
  "dataQuality": {
    "level": "high",
    "note": "Complete metabolic panel with 12 analytes extracted.",
    "analytesExtracted": 12
  }
}

RULES:
- Return ONLY the JSON object
- Use null for any value not found in the data
- Be aggressive about extraction — infer from context when possible
- For supplements, normalize names (e.g., "fish oil" → "Omega-3 Fish Oil")
- If data is very sparse, still infer a North Star from whatever is available
- Always provide a northStar even with minimal data`;

export const instantParse = action({
  args: {
    rawText: v.string(),
    inputType: v.string(), // "lab_report" | "supplement_list" | "free_text" | "mixed"
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    data: any;
    error?: string;
    source: "ai" | "local";
  }> => {
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (!SHIPPER_AI_URL || !SHIPPER_AI_TOKEN) {
      // Local fallback — extract what we can with regex
      return {
        success: true,
        data: localFallbackParse(args.rawText),
        source: "local",
      };
    }

    try {
      const response = await fetch(SHIPPER_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: INSTANT_ONBOARD_PROMPT },
            {
              role: "user",
              content: `Parse this ${args.inputType.replace("_", " ")} and extract a complete biological profile:\n\n${args.rawText.slice(0, 12000)}`,
            },
          ],
          temperature: 0.15,
        }),
      });

      if (!response.ok) {
        console.error("[InstantOnboard] AI request failed:", response.status);
        return {
          success: true,
          data: localFallbackParse(args.rawText),
          source: "local",
        };
      }

      const aiData = await response.json();
      const raw = aiData?.choices?.[0]?.message?.content ?? "";

      // Parse JSON from response
      let jsonStr = raw.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const braceStart = jsonStr.indexOf("{");
      const braceEnd = jsonStr.lastIndexOf("}");
      if (braceStart !== -1 && braceEnd !== -1) {
        jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return { success: true, data: parsed, source: "ai" };
      } catch {
        console.warn("[InstantOnboard] Failed to parse AI JSON, using local fallback");
        return {
          success: true,
          data: localFallbackParse(args.rawText),
          source: "local",
        };
      }
    } catch (err) {
      console.error("[InstantOnboard] AI call failed:", err);
      return {
        success: true,
        data: localFallbackParse(args.rawText),
        source: "local",
      };
    }
  },
});

/* ── Local Fallback Parser ── */
function localFallbackParse(text: string): any {
  const lower = text.toLowerCase();
  const biomarkers: Record<string, number | null> = {
    vitaminD: null, testosteroneTotal: null, testosteroneFree: null,
    ferritin: null, crp: null, hba1c: null, igf1: null, fastingGlucose: null,
  };

  // Simple regex extraction for common biomarkers
  const patterns: Record<string, RegExp[]> = {
    vitaminD: [/vitamin\s*d[^:]*?[:=\s]+(\d+\.?\d*)/i, /25-?oh[^:]*?[:=\s]+(\d+\.?\d*)/i],
    ferritin: [/ferritin[^:]*?[:=\s]+(\d+\.?\d*)/i],
    crp: [/(?:hs-?)?crp[^:]*?[:=\s]+(\d+\.?\d*)/i, /c-reactive[^:]*?[:=\s]+(\d+\.?\d*)/i],
    hba1c: [/hba1c[^:]*?[:=\s]+(\d+\.?\d*)/i, /a1c[^:]*?[:=\s]+(\d+\.?\d*)/i],
    testosteroneTotal: [/(?:total\s+)?testosterone[^:]*?[:=\s]+(\d+\.?\d*)/i],
    testosteroneFree: [/free\s+(?:testosterone|t)[^:]*?[:=\s]+(\d+\.?\d*)/i],
    igf1: [/igf-?1[^:]*?[:=\s]+(\d+\.?\d*)/i],
    fastingGlucose: [/(?:fasting\s+)?glucose[^:]*?[:=\s]+(\d+\.?\d*)/i],
  };

  let analytesFound = 0;
  for (const [key, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const match = text.match(regex);
      if (match) {
        biomarkers[key] = parseFloat(match[1]);
        analytesFound++;
        break;
      }
    }
  }

  // Extract supplements
  const supplementKeywords = [
    "vitamin d", "magnesium", "omega-3", "fish oil", "creatine", "ashwagandha",
    "zinc", "l-theanine", "probiotics", "collagen", "melatonin", "b-complex",
    "vitamin c", "iron", "calcium", "turmeric", "curcumin", "coq10",
    "nmn", "nad+", "resveratrol", "berberine", "metformin",
  ];
  const supplements = supplementKeywords.filter(s => lower.includes(s))
    .map(s => s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));

  // Infer goal
  let goal = "longevity";
  let goalConfidence = 0.3;
  let goalReason = "Default goal based on limited data.";
  if (lower.includes("performance") || lower.includes("energy") || lower.includes("focus")) {
    goal = "peak-output"; goalConfidence = 0.6; goalReason = "Performance-oriented language detected.";
  } else if (lower.includes("recovery") || lower.includes("sleep") || lower.includes("stress")) {
    goal = "recovery"; goalConfidence = 0.6; goalReason = "Recovery-focused language detected.";
  } else if (lower.includes("weight") || lower.includes("body") || lower.includes("muscle") || lower.includes("fat")) {
    goal = "body-recomp"; goalConfidence = 0.6; goalReason = "Body composition language detected.";
  } else if (analytesFound > 3) {
    goalConfidence = 0.5; goalReason = "Lab data suggests optimization-focused user.";
  }

  // Extract age
  const ageMatch = text.match(/(?:age|years?\s*old)[:\s]*(\d{2})/i) || text.match(/(\d{2})\s*(?:year|yr|y\/o)/i);
  const weightMatch = text.match(/(\d{2,3})\s*(?:lbs?|pounds?)/i) || text.match(/(\d{2,3})\s*(?:kg|kilograms?)/i);

  return {
    biomarkers,
    additionalBiomarkers: [],
    vitals: {
      age: ageMatch ? parseInt(ageMatch[1]) : null,
      gender: lower.includes("female") ? "female" : lower.includes("male") ? "male" : null,
      weight: weightMatch ? parseFloat(weightMatch[1]) : null,
      weightUnit: weightMatch && lower.includes("kg") ? "kg" : "lbs",
    },
    supplements,
    geneticFlags: {
      mthfrVariant: lower.includes("mthfr"),
      apoe4: lower.includes("apoe4") || lower.includes("apoe 4"),
      caffeineSensitivity: lower.includes("caffeine sensitive") || lower.includes("slow metabolizer"),
    },
    diet: {
      preferredProteins: "chicken, fish, eggs",
      dietaryRestrictions: lower.includes("vegan") ? "vegan" : lower.includes("vegetarian") ? "vegetarian" : lower.includes("gluten") ? "gluten-free" : "none",
    },
    sleepHours: null,
    northStar: { goal, confidence: goalConfidence, reason: goalReason },
    dataQuality: {
      level: analytesFound >= 4 ? "high" : analytesFound >= 2 ? "medium" : "low",
      note: `${analytesFound} biomarkers extracted locally. ${supplements.length} supplements detected.`,
      analytesExtracted: analytesFound,
    },
  };
}
