import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   QUICK-LOG AI PARSER
   
   Parses natural language health entries like:
     "took vitamin d"
     "slept 8 hours"
     "ran 3 miles"
     "feeling great energy 5"
     "hrv 62"
     "cold plunge done"
   
   Returns structured data that maps to existing mutations:
   - logVital (HR, HRV, SpO2, sleep, body temp)
   - logMoodEnergy (mood/energy 1-5)
   - toggleCompletion / oneTapVerify (protocol check-off)
   - logVital for supplement logging
   ═══════════════════════════════════════════════════════════════ */

const QUICK_LOG_SYSTEM_PROMPT = `You are a health data parser for the Vive biometric optimization platform. Parse the user's natural language input into ONE structured action.

RETURN ONLY valid JSON — no markdown, no explanation, no code fences.

ACTION TYPES:

1. VITAL — biometric readings
   {"action":"vital","vitalType":"hrv"|"hr"|"spo2"|"sleep_hours"|"body_temp","value":NUMBER,"unit":"ms"|"bpm"|"%"|"hours"|"°F"}
   Examples: "hrv 62" → {"action":"vital","vitalType":"hrv","value":62,"unit":"ms"}
   "slept 7.5 hours" → {"action":"vital","vitalType":"sleep_hours","value":7.5,"unit":"hours"}
   "heart rate 68" → {"action":"vital","vitalType":"hr","value":68,"unit":"bpm"}
   "spo2 98" → {"action":"vital","vitalType":"spo2","value":98,"unit":"%"}
   "temp 98.2" → {"action":"vital","vitalType":"body_temp","value":98.2,"unit":"°F"}

2. MOOD_ENERGY — subjective ratings (1-5 scale)
   {"action":"mood_energy","mood":NUMBER,"energy":NUMBER}
   Examples: "feeling great" → {"action":"mood_energy","mood":5,"energy":4}
   "tired but happy" → {"action":"mood_energy","mood":4,"energy":2}
   "mood 3 energy 4" → {"action":"mood_energy","mood":3,"energy":4}
   "exhausted" → {"action":"mood_energy","mood":2,"energy":1}
   "energized" → {"action":"mood_energy","mood":4,"energy":5}

3. PROTOCOL — completing a health protocol/supplement/habit
   {"action":"protocol","protocolName":"STRING","category":"supplement"|"training"|"biohacking"|"nutrition"|"recovery"|"movement"}
   Examples: "took vitamin d" → {"action":"protocol","protocolName":"Vitamin D3 + K2","category":"supplement"}
   "took fish oil" → {"action":"protocol","protocolName":"Omega-3 Fish Oil","category":"supplement"}
   "took creatine" → {"action":"protocol","protocolName":"Creatine Monohydrate","category":"supplement"}
   "took magnesium" → {"action":"protocol","protocolName":"Magnesium Glycinate","category":"supplement"}
   "cold plunge done" → {"action":"protocol","protocolName":"Cold Plunge","category":"biohacking"}
   "did sauna" → {"action":"protocol","protocolName":"Infrared Sauna","category":"biohacking"}
   "morning sunlight" → {"action":"protocol","protocolName":"Morning Sunlight","category":"biohacking"}
   "went for a run" → {"action":"protocol","protocolName":"Zone 2 Cardio","category":"training"}
   "lifted weights" → {"action":"protocol","protocolName":"Resistance Training","category":"training"}
   "hit protein target" → {"action":"protocol","protocolName":"Protein Target","category":"nutrition"}
   "drank 3 liters" → {"action":"protocol","protocolName":"Hydration 3L+","category":"nutrition"}
   "breathwork" → {"action":"protocol","protocolName":"Breathwork","category":"biohacking"}
   "meditation" → {"action":"protocol","protocolName":"10-Min Meditation","category":"recovery"}

4. UNKNOWN — cannot parse
   {"action":"unknown","raw":"ORIGINAL_TEXT"}

RULES:
- Return exactly ONE JSON object
- For supplements, match to the closest known protocol name
- For vitals, extract the numeric value
- For mood/energy, infer from sentiment if no explicit number given
- Mood and energy are 1-5 scale (1=terrible, 5=excellent)
- If both mood and energy are mentioned, include both; if only one, infer the other
- Be generous in matching — "vit d" = "Vitamin D3 + K2", "fish oil" = "Omega-3 Fish Oil"
- "walked" or "walk" = Zone 2 Cardio or movement protocol
- "slept" always maps to sleep_hours vital`;

export const parseQuickLogInput = action({
  args: {
    input: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    parsed: any;
    error?: string;
    source: "llm" | "local";
  }> => {
    const input = args.input.trim();
    if (!input) {
      return { success: false, parsed: { action: "unknown", raw: "" }, source: "local" };
    }

    // ── Try local parsing first for common patterns ──
    const localResult = tryLocalParse(input);
    if (localResult) {
      return { success: true, parsed: localResult, source: "local" };
    }

    // ── Fall back to LLM for complex/ambiguous inputs ──
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (!SHIPPER_AI_URL || !SHIPPER_AI_TOKEN) {
      // No AI available — try harder with local parsing
      const fallback = tryFuzzyLocalParse(input);
      return {
        success: fallback.action !== "unknown",
        parsed: fallback,
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
            { role: "system", content: QUICK_LOG_SYSTEM_PROMPT },
            { role: "user", content: input },
          ],
          temperature: 0.1,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        const fallback = tryFuzzyLocalParse(input);
        return {
          success: fallback.action !== "unknown",
          parsed: fallback,
          error: `AI error: ${response.status}`,
          source: "local",
        };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";

      // Clean and parse JSON
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
      }

      const parsed = JSON.parse(cleaned);
      return { success: true, parsed, source: "llm" };
    } catch (err: any) {
      const fallback = tryFuzzyLocalParse(input);
      return {
        success: fallback.action !== "unknown",
        parsed: fallback,
        error: err.message,
        source: "local",
      };
    }
  },
});

/* ═══════════════════════════════════════════════════════════════
   VOICE CHECK-IN PARSER — Evening Debrief Engine
   
   Accepts transcribed voice check-in text like:
     "I felt sluggish today and skipped my peptides"
     "Great energy all day, hit all my protocols"
     "Afternoon crash around 2pm, didn't sleep well"
   
   Returns:
   - Detected events (Energy Dip, Protocol Skip, etc.)
   - Journal entries to log
   - AI-generated protocol adjustment for tomorrow
   ═══════════════════════════════════════════════════════════════ */

const VOICE_CHECKIN_SYSTEM_PROMPT = `You are the Vive Clinical Performance Architect analyzing an evening voice check-in. Parse the user's natural language debrief into structured events and generate ONE specific protocol adjustment for tomorrow.

RETURN ONLY valid JSON — no markdown, no explanation, no code fences.

OUTPUT FORMAT:
{
  "events": [
    {
      "type": "energy_dip" | "protocol_skip" | "sleep_issue" | "mood_shift" | "pain_report" | "positive_signal" | "nutrition_gap",
      "summary": "Brief 1-sentence description",
      "severity": "low" | "medium" | "high",
      "timeOfDay": "morning" | "afternoon" | "evening" | "night" | "unknown",
      "numericValue": NUMBER_OR_NULL
    }
  ],
  "moodScore": 1-5,
  "energyScore": 1-5,
  "protocolsSkipped": ["protocol name strings"],
  "protocolsCompleted": ["protocol name strings"],
  "adjustment": {
    "title": "Specific tactical adjustment title (e.g., 'Add 20min Zone 2 walk post-lunch')",
    "description": "1-2 sentence explanation referencing their specific complaint",
    "category": "supplement" | "training" | "nutrition" | "recovery" | "biohacking" | "sleep",
    "priority": "low" | "medium" | "high",
    "icon": "emoji"
  },
  "rawSentiment": "positive" | "neutral" | "negative" | "mixed"
}

DETECTION RULES:
- "sluggish", "tired", "low energy", "crash", "drained", "fatigued" → energy_dip
- "skipped", "missed", "forgot", "didn't take" → protocol_skip (extract what was skipped)
- "didn't sleep", "insomnia", "woke up", "poor sleep", "restless" → sleep_issue
- "anxious", "stressed", "overwhelmed", "frustrated" → mood_shift
- "pain", "sore", "ache", "hurt", "stiff" → pain_report
- "great", "amazing", "crushed it", "PR", "strong" → positive_signal
- "didn't eat", "skipped meal", "junk food", "sugar" → nutrition_gap

ADJUSTMENT RULES:
- Be SPECIFIC — "Add 200mg L-theanine at 2pm" not "Consider supplements"
- Reference their actual complaint — if they crashed at 2pm, target that window
- If they skipped peptides, suggest a reminder strategy or alternative timing
- If energy dipped, suggest Zone 2 cardio, cold exposure, or nutrition timing fix
- One adjustment only — the highest-leverage intervention for tomorrow`;

export const parseVoiceCheckin = action({
  args: {
    transcript: v.string(),
    sessionId: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    data: {
      events: Array<{
        type: string;
        summary: string;
        severity: string;
        timeOfDay: string;
        numericValue: number | null;
      }>;
      moodScore: number;
      energyScore: number;
      protocolsSkipped: string[];
      protocolsCompleted: string[];
      adjustment: {
        title: string;
        description: string;
        category: string;
        priority: string;
        icon: string;
      };
      rawSentiment: string;
    } | null;
    error: string | null;
    source: "llm" | "local";
  }> => {
    const transcript = args.transcript.trim();
    if (!transcript) {
      return { success: false, data: null, error: "Empty transcript", source: "local" };
    }

    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    // ── Try LLM first for rich parsing ──
    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
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
              { role: "system", content: VOICE_CHECKIN_SYSTEM_PROMPT },
              { role: "user", content: transcript },
            ],
            temperature: 0.2,
            max_tokens: 600,
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const raw = aiData?.choices?.[0]?.message?.content ?? "";

          let jsonStr = raw.trim();
          if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
          }
          const braceStart = jsonStr.indexOf("{");
          const braceEnd = jsonStr.lastIndexOf("}");
          if (braceStart !== -1 && braceEnd !== -1) {
            jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
          }

          try {
            const parsed = JSON.parse(jsonStr);
            return { success: true, data: parsed, error: null, source: "llm" };
          } catch {
            console.warn("[VoiceCheckin] Failed to parse LLM JSON, falling back to local");
          }
        }
      } catch (err: any) {
        console.warn("[VoiceCheckin] LLM call failed:", err.message);
      }
    }

    // ── Local fallback parsing ──
    const lower = transcript.toLowerCase();
    const events: Array<{
      type: string;
      summary: string;
      severity: string;
      timeOfDay: string;
      numericValue: number | null;
    }> = [];

    // Detect energy dips
    const energyDipWords = ["sluggish", "tired", "low energy", "crash", "drained", "fatigued", "exhausted", "lethargic", "no energy"];
    for (const word of energyDipWords) {
      if (lower.includes(word)) {
        const timeOfDay = lower.includes("morning") ? "morning"
          : lower.includes("afternoon") || lower.includes("2pm") || lower.includes("3pm") ? "afternoon"
          : lower.includes("evening") ? "evening" : "unknown";
        events.push({
          type: "energy_dip",
          summary: `Reported feeling ${word}${timeOfDay !== "unknown" ? ` in the ${timeOfDay}` : ""}`,
          severity: ["exhausted", "drained", "crash"].includes(word) ? "high" : "medium",
          timeOfDay,
          numericValue: null,
        });
        break;
      }
    }

    // Detect protocol skips
    const skipPatterns = [
      /(?:skipped|missed|forgot|didn'?t take)\s+(?:my\s+)?(.+?)(?:\.|,|$)/gi,
    ];
    const protocolsSkipped: string[] = [];
    for (const pattern of skipPatterns) {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const skipped = match[1].trim();
        protocolsSkipped.push(skipped);
        events.push({
          type: "protocol_skip",
          summary: `Skipped: ${skipped}`,
          severity: "medium",
          timeOfDay: "unknown",
          numericValue: null,
        });
      }
    }

    // Detect sleep issues
    const sleepWords = ["didn't sleep", "poor sleep", "insomnia", "restless", "woke up", "couldn't sleep"];
    for (const word of sleepWords) {
      if (lower.includes(word)) {
        events.push({
          type: "sleep_issue",
          summary: `Sleep disruption reported: ${word}`,
          severity: "high",
          timeOfDay: "night",
          numericValue: null,
        });
        break;
      }
    }

    // Detect positive signals
    const positiveWords = ["great", "amazing", "crushed it", "strong", "excellent", "fantastic", "pr", "personal record"];
    let isPositive = false;
    for (const word of positiveWords) {
      if (lower.includes(word)) {
        isPositive = true;
        events.push({
          type: "positive_signal",
          summary: `Positive check-in: reported feeling ${word}`,
          severity: "low",
          timeOfDay: "unknown",
          numericValue: null,
        });
        break;
      }
    }

    // Compute mood/energy scores
    const moodScore = isPositive ? 4 : events.some(e => e.severity === "high") ? 2 : 3;
    const energyScore = events.some(e => e.type === "energy_dip") ? 2
      : isPositive ? 4 : 3;

    // Generate local adjustment
    const hasEnergyDip = events.some(e => e.type === "energy_dip");
    const hasProtocolSkip = protocolsSkipped.length > 0;
    const hasSleepIssue = events.some(e => e.type === "sleep_issue");

    let adjustment;
    if (hasEnergyDip) {
      adjustment = {
        title: "Add 15-min Zone 2 walk after lunch",
        description: "Post-meal movement stabilizes blood glucose and prevents the afternoon cortisol crash you experienced. Walk within 30 minutes of eating.",
        category: "training",
        priority: "high" as const,
        icon: "🚶",
      };
    } else if (hasSleepIssue) {
      adjustment = {
        title: "Add Magnesium Glycinate 400mg at 9 PM",
        description: "Magnesium activates the parasympathetic nervous system and promotes GABA activity. Take 1 hour before target sleep time.",
        category: "supplement",
        priority: "high" as const,
        icon: "🌙",
      };
    } else if (hasProtocolSkip) {
      adjustment = {
        title: `Set morning alarm for ${protocolsSkipped[0] || "skipped protocol"}`,
        description: `You missed ${protocolsSkipped[0] || "a protocol"} today. Anchor it to an existing habit — take it immediately after brushing teeth to build automaticity.`,
        category: "recovery",
        priority: "medium" as const,
        icon: "⏰",
      };
    } else {
      adjustment = {
        title: "Maintain current protocol stack",
        description: "Positive signals detected. Continue current protocol adherence and log tomorrow's check-in to track consistency.",
        category: "recovery",
        priority: "low" as const,
        icon: "✅",
      };
    }

    // If no events detected, add a generic one
    if (events.length === 0) {
      events.push({
        type: "positive_signal",
        summary: "Evening check-in logged — no specific issues detected",
        severity: "low",
        timeOfDay: "evening",
        numericValue: null,
      });
    }

    return {
      success: true,
      data: {
        events,
        moodScore,
        energyScore,
        protocolsSkipped,
        protocolsCompleted: [],
        adjustment,
        rawSentiment: isPositive ? "positive" : hasEnergyDip || hasSleepIssue ? "negative" : "neutral",
      },
      error: null,
      source: "local",
    };
  },
});

/* ── Local pattern matching for instant parsing ── */
function tryLocalParse(input: string): any | null {
  const lower = input.toLowerCase().trim();

  // HRV: "hrv 62", "hrv: 65ms"
  const hrvMatch = lower.match(/^hrv[\s:]*(\d+(?:\.\d+)?)\s*(?:ms)?$/);
  if (hrvMatch) return { action: "vital", vitalType: "hrv", value: parseFloat(hrvMatch[1]), unit: "ms" };

  // HR: "hr 68", "heart rate 72", "rhr 58"
  const hrMatch = lower.match(/^(?:hr|heart\s*rate|rhr|resting\s*hr)[\s:]*(\d+(?:\.\d+)?)\s*(?:bpm)?$/);
  if (hrMatch) return { action: "vital", vitalType: "hr", value: parseFloat(hrMatch[1]), unit: "bpm" };

  // SpO2: "spo2 98", "oxygen 97"
  const spo2Match = lower.match(/^(?:spo2|sp02|oxygen|o2)[\s:]*(\d+(?:\.\d+)?)\s*%?$/);
  if (spo2Match) return { action: "vital", vitalType: "spo2", value: parseFloat(spo2Match[1]), unit: "%" };

  // Sleep: "slept 8 hours", "sleep 7.5h", "8 hours sleep"
  const sleepMatch = lower.match(/(?:slept|sleep)\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)?/) ||
    lower.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:of\s*)?sleep$/);
  if (sleepMatch) return { action: "vital", vitalType: "sleep_hours", value: parseFloat(sleepMatch[1]), unit: "hours" };

  // Body temp: "temp 98.6", "body temp 99.1"
  const tempMatch = lower.match(/^(?:body\s*)?temp(?:erature)?[\s:]*(\d+(?:\.\d+)?)\s*(?:°?f)?$/);
  if (tempMatch) return { action: "vital", vitalType: "body_temp", value: parseFloat(tempMatch[1]), unit: "°F" };

  // Mood/Energy explicit: "mood 4 energy 3", "mood 4", "energy 5"
  const moodEnergyMatch = lower.match(/mood[\s:]*(\d)\s*(?:energy|e)[\s:]*(\d)/);
  if (moodEnergyMatch) return { action: "mood_energy", mood: parseInt(moodEnergyMatch[1]), energy: parseInt(moodEnergyMatch[2]) };

  const moodOnly = lower.match(/^mood[\s:]*(\d)$/);
  if (moodOnly) return { action: "mood_energy", mood: parseInt(moodOnly[1]), energy: parseInt(moodOnly[1]) };

  const energyOnly = lower.match(/^energy[\s:]*(\d)$/);
  if (energyOnly) return { action: "mood_energy", mood: parseInt(energyOnly[1]), energy: parseInt(energyOnly[1]) };

  // Direct supplement matches
  const supplementMap: Record<string, string> = {
    "vitamin d": "Vitamin D3 + K2", "vit d": "Vitamin D3 + K2", "d3": "Vitamin D3 + K2",
    "fish oil": "Omega-3 Fish Oil", "omega": "Omega-3 Fish Oil", "omega 3": "Omega-3 Fish Oil", "omega-3": "Omega-3 Fish Oil",
    "creatine": "Creatine Monohydrate",
    "magnesium": "Magnesium Glycinate", "mag": "Magnesium Glycinate",
  };

  for (const [key, name] of Object.entries(supplementMap)) {
    if (lower.includes(key) && (lower.startsWith("took") || lower.startsWith("had") || lower.includes(key))) {
      return { action: "protocol", protocolName: name, category: "supplement" };
    }
  }

  // Direct protocol matches
  const protocolMap: Record<string, { name: string; category: string }> = {
    "cold plunge": { name: "Cold Plunge", category: "biohacking" },
    "cold shower": { name: "Cold Plunge", category: "biohacking" },
    "sauna": { name: "Infrared Sauna", category: "biohacking" },
    "sunlight": { name: "Morning Sunlight", category: "biohacking" },
    "morning sun": { name: "Morning Sunlight", category: "biohacking" },
    "zone 2": { name: "Zone 2 Cardio", category: "training" },
    "cardio": { name: "Zone 2 Cardio", category: "training" },
    "weights": { name: "Resistance Training", category: "training" },
    "lifted": { name: "Resistance Training", category: "training" },
    "resistance": { name: "Resistance Training", category: "training" },
    "protein": { name: "Protein Target", category: "nutrition" },
    "hydration": { name: "Hydration 3L+", category: "nutrition" },
    "water": { name: "Hydration 3L+", category: "nutrition" },
    "breathwork": { name: "Breathwork", category: "biohacking" },
    "meditation": { name: "10-Min Meditation", category: "recovery" },
    "meditated": { name: "10-Min Meditation", category: "recovery" },
  };

  for (const [key, val] of Object.entries(protocolMap)) {
    if (lower.includes(key)) {
      return { action: "protocol", protocolName: val.name, category: val.category };
    }
  }

  return null;
}

/* ── Fuzzy fallback for when LLM is unavailable ── */
function tryFuzzyLocalParse(input: string): any {
  const lower = input.toLowerCase().trim();

  // Try to extract any number
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  const num = numMatch ? parseFloat(numMatch[1]) : null;

  // Sentiment-based mood/energy
  const positiveWords = ["great", "amazing", "excellent", "fantastic", "energized", "strong", "good", "happy", "rested"];
  const negativeWords = ["tired", "exhausted", "bad", "terrible", "sick", "low", "drained", "sluggish", "awful"];
  const neutralWords = ["okay", "ok", "fine", "normal", "average", "meh"];

  if (positiveWords.some((w) => lower.includes(w))) {
    return { action: "mood_energy", mood: 4, energy: 4 };
  }
  if (negativeWords.some((w) => lower.includes(w))) {
    return { action: "mood_energy", mood: 2, energy: 2 };
  }
  if (neutralWords.some((w) => lower.includes(w))) {
    return { action: "mood_energy", mood: 3, energy: 3 };
  }

  // If there's a number and sleep-related words
  if (num && (lower.includes("sleep") || lower.includes("slept") || lower.includes("hour"))) {
    return { action: "vital", vitalType: "sleep_hours", value: num, unit: "hours" };
  }

  // Supplement keywords
  if (lower.includes("took") || lower.includes("supplement") || lower.includes("pill") || lower.includes("capsule")) {
    return { action: "protocol", protocolName: input.replace(/^took\s+/i, ""), category: "supplement" };
  }

  // Exercise keywords
  if (lower.includes("ran") || lower.includes("run") || lower.includes("jog") || lower.includes("walk")) {
    return { action: "protocol", protocolName: "Zone 2 Cardio", category: "training" };
  }

  return { action: "unknown", raw: input };
}
