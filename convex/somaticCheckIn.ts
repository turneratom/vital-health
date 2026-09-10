import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   SOMATIC CHECK-IN ENGINE
   
   Processes hold-to-talk voice briefs through AI sentiment +
   physical stress analysis. Detects multi-day body region
   patterns (e.g., 3 days of back pain) and triggers targeted
   interventions (mobility routines, recovery peptides like BPC-157).
   ═══════════════════════════════════════════════════════════════ */

/* ── Body Region Mapping ── */
const BODY_REGIONS = [
  "head", "neck", "upper_back", "lower_back", "left_shoulder", "right_shoulder",
  "chest", "abdomen", "left_hip", "right_hip", "left_knee", "right_knee",
  "left_ankle", "right_ankle", "left_wrist", "right_wrist", "left_elbow", "right_elbow",
] as const;

/* ── Keyword → Body Region Detection (local fallback) ── */
const REGION_KEYWORDS: Record<string, string[]> = {
  head: ["head", "headache", "migraine", "temple", "skull", "forehead"],
  neck: ["neck", "cervical", "stiff neck", "throat"],
  upper_back: ["upper back", "thoracic", "between shoulders", "shoulder blade", "scapula", "trap", "traps"],
  lower_back: ["lower back", "lumbar", "back pain", "back is tight", "back ache", "spine"],
  left_shoulder: ["left shoulder"],
  right_shoulder: ["right shoulder"],
  chest: ["chest", "pectoral", "sternum", "rib"],
  abdomen: ["stomach", "abdomen", "gut", "abdominal", "belly", "digestive", "bloat"],
  left_hip: ["left hip", "left glute"],
  right_hip: ["right hip", "right glute"],
  left_knee: ["left knee"],
  right_knee: ["right knee"],
  left_ankle: ["left ankle", "left foot"],
  right_ankle: ["right ankle", "right foot"],
  left_wrist: ["left wrist", "left hand"],
  right_wrist: ["right wrist", "right hand"],
  left_elbow: ["left elbow"],
  right_elbow: ["right elbow"],
};

/* ── Generalized keywords (no side specified) ── */
const GENERAL_KEYWORDS: Record<string, string> = {
  shoulder: "left_shoulder",
  shoulders: "left_shoulder",
  hip: "left_hip",
  hips: "left_hip",
  knee: "left_knee",
  knees: "left_knee",
  ankle: "left_ankle",
  foot: "left_ankle",
  feet: "left_ankle",
  wrist: "left_wrist",
  hand: "left_wrist",
  elbow: "left_elbow",
  back: "lower_back",
};

/* ── Sentiment Keywords ── */
const POSITIVE_KEYWORDS = ["good", "great", "focused", "sharp", "energized", "strong", "recovered", "rested", "clear", "motivated", "amazing", "excellent", "fantastic", "powerful", "alert"];
const NEGATIVE_KEYWORDS = ["tired", "exhausted", "sore", "pain", "tight", "stiff", "fatigued", "sluggish", "foggy", "drained", "ache", "hurt", "weak", "heavy", "inflamed", "swollen"];
const STRESS_KEYWORDS = ["stressed", "anxious", "tense", "overwhelmed", "flight", "travel", "jet lag", "poor sleep", "insomnia", "restless"];

/* ── Intervention Database ── */
const INTERVENTIONS: Record<string, {
  title: string;
  description: string;
  duration: string;
  type: "mobility" | "peptide" | "supplement" | "breathwork" | "recovery";
  icon: string;
  regions: string[];
}> = {
  "hip_mobility": {
    title: "Hip Flexor Release Protocol",
    description: "90/90 stretch + pigeon pose + couch stretch — 3 sets each side",
    duration: "12 min",
    type: "mobility",
    icon: "🧘",
    regions: ["left_hip", "right_hip", "lower_back"],
  },
  "thoracic_mobility": {
    title: "Thoracic Spine Mobilization",
    description: "Foam roller extensions + cat-cow + thread the needle — restore T-spine rotation",
    duration: "10 min",
    type: "mobility",
    icon: "🔄",
    regions: ["upper_back", "neck", "chest"],
  },
  "lumbar_decompression": {
    title: "Lumbar Decompression Sequence",
    description: "Dead hang 60s + child's pose + McKenzie extensions + supine twist",
    duration: "15 min",
    type: "mobility",
    icon: "⬇️",
    regions: ["lower_back"],
  },
  "shoulder_rehab": {
    title: "Shoulder Stability Protocol",
    description: "Band pull-aparts + face pulls + external rotations + wall slides",
    duration: "12 min",
    type: "mobility",
    icon: "💪",
    regions: ["left_shoulder", "right_shoulder", "upper_back"],
  },
  "knee_recovery": {
    title: "Knee Joint Recovery",
    description: "Terminal knee extensions + wall sits + foam roll quads/IT band + ankle mobility",
    duration: "10 min",
    type: "mobility",
    icon: "🦵",
    regions: ["left_knee", "right_knee"],
  },
  "neck_release": {
    title: "Cervical Tension Release",
    description: "Chin tucks + levator scapulae stretch + suboccipital release + neck CARs",
    duration: "8 min",
    type: "mobility",
    icon: "🔗",
    regions: ["neck", "head"],
  },
  "bpc157_protocol": {
    title: "BPC-157 Recovery Protocol",
    description: "250mcg BPC-157 subcutaneous near affected area — accelerates tissue repair via angiogenesis and growth factor upregulation",
    duration: "Ongoing",
    type: "peptide",
    icon: "💉",
    regions: ["lower_back", "left_knee", "right_knee", "left_shoulder", "right_shoulder", "left_hip", "right_hip"],
  },
  "tb500_systemic": {
    title: "TB-500 Systemic Repair",
    description: "2mg TB-500 subcutaneous — systemic tissue repair for chronic inflammation patterns",
    duration: "2x/week",
    type: "peptide",
    icon: "🧬",
    regions: ["lower_back", "upper_back", "left_knee", "right_knee", "left_shoulder", "right_shoulder"],
  },
  "magnesium_protocol": {
    title: "Magnesium Glycinate 400mg",
    description: "Take before bed — reduces muscle tension, improves sleep quality, supports recovery",
    duration: "Nightly",
    type: "supplement",
    icon: "💊",
    regions: ["lower_back", "upper_back", "neck", "left_hip", "right_hip"],
  },
  "breathwork_reset": {
    title: "Box Breathing Reset",
    description: "4-4-4-4 box breathing — 10 rounds to downregulate sympathetic nervous system",
    duration: "5 min",
    type: "breathwork",
    icon: "🫁",
    regions: ["head", "neck", "chest"],
  },
  "cold_therapy": {
    title: "Targeted Cold Therapy",
    description: "Ice pack 15min on affected area — reduces acute inflammation and pain signaling",
    duration: "15 min",
    type: "recovery",
    icon: "🧊",
    regions: ["left_knee", "right_knee", "left_shoulder", "right_shoulder", "left_ankle", "right_ankle"],
  },
};

/* ── Local text analysis (fallback when AI unavailable) ── */
function analyzeTextLocally(text: string): {
  sentiment: { score: number; label: string };
  physicalStress: { score: number; label: string };
  regions: Array<{ region: string; severity: number; description: string }>;
  mentalState: string;
} {
  const lower = text.toLowerCase();

  // Sentiment
  const posCount = POSITIVE_KEYWORDS.filter(k => lower.includes(k)).length;
  const negCount = NEGATIVE_KEYWORDS.filter(k => lower.includes(k)).length;
  const stressCount = STRESS_KEYWORDS.filter(k => lower.includes(k)).length;
  const total = posCount + negCount + stressCount || 1;
  const sentimentScore = Math.round(((posCount - negCount - stressCount * 0.5) / total + 1) * 50);
  const sentimentLabel = sentimentScore >= 70 ? "Positive" : sentimentScore >= 40 ? "Neutral" : "Stressed";

  // Physical stress
  const painWords = ["pain", "sore", "tight", "stiff", "ache", "hurt", "inflamed", "swollen", "tender"];
  const painCount = painWords.filter(k => lower.includes(k)).length;
  const physicalScore = Math.min(100, painCount * 25 + negCount * 10);
  const physicalLabel = physicalScore >= 60 ? "High" : physicalScore >= 30 ? "Moderate" : "Low";

  // Region detection
  const regions: Array<{ region: string; severity: number; description: string }> = [];
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const severity = painCount > 0 ? Math.min(80, 40 + painCount * 15) : 30;
        regions.push({ region, severity, description: `Reported: "${kw}" — ${physicalLabel.toLowerCase()} stress detected` });
        break;
      }
    }
  }
  // General keywords
  for (const [kw, region] of Object.entries(GENERAL_KEYWORDS)) {
    if (lower.includes(kw) && !regions.some(r => r.region === region)) {
      const severity = painCount > 0 ? Math.min(80, 40 + painCount * 15) : 30;
      regions.push({ region, severity, description: `Reported: "${kw}" — ${physicalLabel.toLowerCase()} stress detected` });
    }
  }

  // Mental state
  const mentalState = stressCount > 0 ? "Elevated stress — sympathetic dominance likely" :
    posCount > negCount ? "Focused and alert — parasympathetic balance good" :
    negCount > 0 ? "Fatigue detected — recovery may be needed" :
    "Baseline — no strong signals detected";

  return {
    sentiment: { score: Math.max(0, Math.min(100, sentimentScore)), label: sentimentLabel },
    physicalStress: { score: physicalScore, label: physicalLabel },
    regions,
    mentalState,
  };
}

/* ═══════════════════════════════════════════════════════════════
   ACTION: analyzeSomaticBrief
   AI-powered analysis of a voice brief transcript
   ═══════════════════════════════════════════════════════════════ */
export const analyzeSomaticBrief = action({
  args: {
    sessionId: v.string(),
    transcript: v.string(),
    durationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    let analysis: {
      sentiment: { score: number; label: string };
      physicalStress: { score: number; label: string };
      regions: Array<{ region: string; severity: number; description: string }>;
      mentalState: string;
    };
    let source: "llm" | "local" = "local";

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN && args.transcript.length > 10) {
      try {
        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content: `You are a clinical somatic analysis AI. Analyze this voice check-in for:
1. Sentiment (0-100 score, label: Positive/Neutral/Stressed)
2. Physical stress (0-100 score, label: Low/Moderate/High)
3. Body regions mentioned with severity (0-100) and description
4. Mental state assessment (one sentence)

Body regions: ${BODY_REGIONS.join(", ")}
If user says "back" without specifying, use "lower_back".
If user says "shoulder" without side, use "left_shoulder".

Return ONLY JSON:
{
  "sentiment": { "score": 65, "label": "Neutral" },
  "physicalStress": { "score": 45, "label": "Moderate" },
  "regions": [{ "region": "lower_back", "severity": 60, "description": "Tightness from prolonged sitting/travel" }],
  "mentalState": "Focused but physically compromised — recovery protocols recommended"
}`,
              },
              { role: "user", content: args.transcript },
            ],
            temperature: 0.2,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
          let jsonStr = raw;
          const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fence) jsonStr = fence[1].trim();
          const b0 = jsonStr.indexOf("{");
          const b1 = jsonStr.lastIndexOf("}");
          if (b0 !== -1 && b1 !== -1) jsonStr = jsonStr.slice(b0, b1 + 1);
          const parsed = JSON.parse(jsonStr);
          if (parsed.sentiment && parsed.physicalStress) {
            analysis = parsed;
            source = "llm";
          } else {
            analysis = analyzeTextLocally(args.transcript);
          }
        } else {
          analysis = analyzeTextLocally(args.transcript);
        }
      } catch {
        analysis = analyzeTextLocally(args.transcript);
      }
    } else {
      analysis = analyzeTextLocally(args.transcript);
    }

    // Save voice memo
    const memoId = await ctx.runMutation(
      "somaticLog:saveVoiceMemo" as any,
      {
        sessionId: args.sessionId,
        durationSeconds: args.durationSeconds,
        transcript: args.transcript,
        extractedChannels: JSON.stringify(analysis.regions),
        confidence: source === "llm" ? 0.9 : 0.6,
      }
    );

    // Save body map entries
    for (const region of analysis.regions) {
      await ctx.runMutation(
        "somaticCheckIn:saveBodyMapEntry" as any,
        {
          sessionId: args.sessionId,
          region: region.region,
          severity: region.severity,
          description: region.description,
          source: "voice_checkin",
          voiceMemoId: memoId,
        }
      );
    }

    // Save somatic feedback entries
    if (analysis.sentiment.score !== 50) {
      await ctx.runMutation(
        "somaticLog:logSomaticEntry" as any,
        {
          sessionId: args.sessionId,
          channel: "mental_clarity",
          value: analysis.sentiment.score,
          label: analysis.sentiment.label,
          source: "voice_checkin",
          voiceMemoId: memoId,
        }
      );
    }
    if (analysis.physicalStress.score > 0) {
      await ctx.runMutation(
        "somaticLog:logSomaticEntry" as any,
        {
          sessionId: args.sessionId,
          channel: "joint_mobility",
          value: Math.max(0, 100 - analysis.physicalStress.score),
          label: analysis.physicalStress.label === "High" ? "Compromised" : analysis.physicalStress.label === "Moderate" ? "Restricted" : "Mobile",
          source: "voice_checkin",
          voiceMemoId: memoId,
        }
      );
    }

    // Check multi-day patterns
    const patterns = await ctx.runQuery(
      "somaticCheckIn:getMultiDayPatterns" as any,
      { sessionId: args.sessionId }
    );

    // Generate interventions
    const interventions: Array<{
      id: string;
      title: string;
      description: string;
      duration: string;
      type: string;
      icon: string;
      reason: string;
      priority: "high" | "medium" | "low";
    }> = [];

    // Interventions from current regions
    for (const region of analysis.regions) {
      for (const [id, intervention] of Object.entries(INTERVENTIONS)) {
        if (intervention.regions.includes(region.region) && !interventions.some(i => i.id === id)) {
          const isHighSeverity = region.severity >= 60;
          const isPeptide = intervention.type === "peptide";
          // Only suggest peptides for high severity or multi-day patterns
          if (isPeptide && !isHighSeverity) continue;
          interventions.push({
            id,
            ...intervention,
            reason: `${region.description}`,
            priority: isHighSeverity ? "high" : "medium",
          });
        }
      }
    }

    // Interventions from multi-day patterns
    for (const pattern of (patterns ?? [])) {
      if (pattern.consecutiveDays >= 3) {
        for (const [id, intervention] of Object.entries(INTERVENTIONS)) {
          if (intervention.regions.includes(pattern.region) && !interventions.some(i => i.id === id)) {
            interventions.push({
              id,
              ...intervention,
              reason: `${pattern.consecutiveDays} consecutive days of ${pattern.region.replace(/_/g, " ")} discomfort detected`,
              priority: "high",
            });
          }
        }
      }
    }

    // Sort: high priority first, then peptides last within same priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    interventions.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      if (a.type === "peptide" && b.type !== "peptide") return 1;
      if (a.type !== "peptide" && b.type === "peptide") return -1;
      return 0;
    });

    return {
      analysis,
      patterns: patterns ?? [],
      interventions: interventions.slice(0, 5),
      memoId,
      source,
      generatedAt: now,
    };
  },
});

/* ── Save body map entry ── */
export const saveBodyMapEntry = mutation({
  args: {
    sessionId: v.string(),
    region: v.string(),
    severity: v.number(),
    description: v.string(),
    source: v.string(),
    voiceMemoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bodyMapEntries", {
      sessionId: args.sessionId,
      region: args.region,
      severity: Math.max(0, Math.min(100, args.severity)),
      description: args.description,
      source: args.source,
      voiceMemoId: args.voiceMemoId,
      loggedAt: Date.now(),
    });
  },
});

/* ── Get multi-day body region patterns ── */
export const getMultiDayPatterns = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const day7 = now - 7 * 86400000;

    const entries = await ctx.db
      .query("bodyMapEntries")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", day7)
      )
      .order("desc")
      .collect();

    // Group by region and count unique days
    const regionDays: Record<string, Set<string>> = {};
    const regionSeverities: Record<string, number[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.loggedAt).toISOString().slice(0, 10);
      if (!regionDays[entry.region]) {
        regionDays[entry.region] = new Set();
        regionSeverities[entry.region] = [];
      }
      regionDays[entry.region].add(dateKey);
      regionSeverities[entry.region].push(entry.severity);
    }

    // Find consecutive day patterns
    const patterns: Array<{
      region: string;
      consecutiveDays: number;
      avgSeverity: number;
      isEscalating: boolean;
      firstReported: string;
      latestReported: string;
    }> = [];

    for (const [region, days] of Object.entries(regionDays)) {
      const sortedDays = Array.from(days).sort();
      if (sortedDays.length < 2) continue;

      // Count max consecutive days
      let maxConsecutive = 1;
      let currentConsecutive = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prev = new Date(sortedDays[i - 1]);
        const curr = new Date(sortedDays[i]);
        const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
        if (diffDays <= 1.5) {
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 1;
        }
      }

      const severities = regionSeverities[region];
      const avgSeverity = Math.round(severities.reduce((s, v) => s + v, 0) / severities.length);
      const recentSeverities = severities.slice(0, Math.min(3, severities.length));
      const olderSeverities = severities.slice(3, Math.min(6, severities.length));
      const recentAvg = recentSeverities.reduce((s, v) => s + v, 0) / recentSeverities.length;
      const olderAvg = olderSeverities.length > 0 ? olderSeverities.reduce((s, v) => s + v, 0) / olderSeverities.length : recentAvg;

      if (maxConsecutive >= 2) {
        patterns.push({
          region,
          consecutiveDays: maxConsecutive,
          avgSeverity,
          isEscalating: recentAvg > olderAvg + 5,
          firstReported: sortedDays[0],
          latestReported: sortedDays[sortedDays.length - 1],
        });
      }
    }

    return patterns.sort((a, b) => b.consecutiveDays - a.consecutiveDays);
  },
});

/* ── Get recent body map entries for visualization ── */
export const getRecentBodyMap = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return await ctx.db
      .query("bodyMapEntries")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .order("desc")
      .collect();
  },
});
