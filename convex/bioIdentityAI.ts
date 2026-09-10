import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   BIO-IDENTITY AI — Digital Twin Persona Engine
   
   Generates clinical-yet-encouraging "How am I doing?" responses
   based on the user's real-time Bio-Identity state. Uses the AI
   Brain LLM when available, falls back to local persona engine.
   ═══════════════════════════════════════════════════════════════ */

/* ── Thermal → Persona Tone Map ── */
const THERMAL_TONE: Record<string, { adjective: string; emoji: string; encouragement: string }> = {
  cold: { adjective: "optimally calibrated", emoji: "🧊", encouragement: "You're operating at peak biological efficiency." },
  cool: { adjective: "well-regulated", emoji: "💎", encouragement: "Your systems are responding beautifully to your protocols." },
  neutral: { adjective: "at baseline", emoji: "⚖️", encouragement: "Solid foundation — small protocol adjustments will compound fast." },
  warm: { adjective: "showing mild stress signals", emoji: "🔶", encouragement: "Your body is asking for attention in specific areas — let's address them." },
  hot: { adjective: "under significant load", emoji: "🔥", encouragement: "This is recoverable. Targeted interventions will shift these markers within days." },
  critical: { adjective: "in acute stress response", emoji: "🚨", encouragement: "Priority mode activated. Focus on the top recommendation — everything else can wait." },
};

/* ── System label map ── */
const SYSTEM_LABELS: Record<string, string> = {
  nervous: "Nervous System",
  cardiovascular: "Cardiovascular",
  metabolic: "Metabolic",
  endocrine: "Endocrine",
  immune: "Immune",
  musculoskeletal: "Musculoskeletal",
  digestive: "Digestive",
  respiratory: "Respiratory",
};

export const generatePersonaResponse = action({
  args: {
    sessionId: v.string(),
    question: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    response: string;
    headline: string;
    systemSummaries: Array<{ system: string; label: string; score: number; thermal: string; insight: string }>;
    topRecommendation: string;
    overallScore: number;
    biologicalAge: number | null;
    ageDelta: number | null;
    source: "llm" | "local";
    generatedAt: number;
  }> => {
    const now = Date.now();
    const question = args.question || "How am I doing?";

    /* ── Pull Bio-Identity State ── */
    let bioIdentityState: any = null;
    try {
      bioIdentityState = await ctx.runQuery(
        "bioIdentity:getBioIdentityState" as any,
        { sessionId: args.sessionId }
      );
    } catch (e) {
      console.warn("[bioIdentityAI] Failed to get bio-identity state:", e);
    }

    /* ── Pull BioVault for raw markers ── */
    let bioVault: any = null;
    try {
      bioVault = await ctx.runQuery(
        "queries:getBioVaultBySession" as any,
        { sessionId: args.sessionId }
      );
    } catch { /* continue */ }

    /* ── Build context ── */
    const state = bioIdentityState || {
      overallScore: 60,
      overallThermal: "neutral",
      biologicalAge: null,
      chronologicalAge: null,
      ageDelta: null,
      systems: [],
      criticalAlerts: [],
      dataCompleteness: 0,
    };

    const tone = THERMAL_TONE[state.overallThermal] || THERMAL_TONE.neutral;

    /* ── Generate per-system insights ── */
    const systemSummaries = (state.systems || []).map((sys: any) => {
      const sysTone = THERMAL_TONE[sys.thermal] || THERMAL_TONE.neutral;
      let insight = "";

      if (sys.markers && sys.markers.length > 0) {
        const criticalMarkers = sys.markers.filter((m: any) => m.status === "critical");
        const optimalMarkers = sys.markers.filter((m: any) => m.status === "optimal");

        if (criticalMarkers.length > 0) {
          insight = `${criticalMarkers[0].name} at ${criticalMarkers[0].value} needs attention.`;
        } else if (optimalMarkers.length === sys.markers.length) {
          insight = `All ${sys.markers.length} markers within optimal range.`;
        } else {
          const subopt = sys.markers.find((m: any) => m.status === "suboptimal");
          insight = subopt ? `${subopt.name} at ${subopt.value} — trending toward optimal.` : `${sysTone.adjective}.`;
        }
      } else {
        insight = sys.score >= 75 ? "Performing well based on available signals." : "Limited data — add biomarkers for precision insights.";
      }

      return {
        system: sys.system,
        label: sys.label || SYSTEM_LABELS[sys.system] || sys.system,
        score: sys.score,
        thermal: sys.thermal,
        insight,
      };
    });

    /* ── Top recommendation ── */
    const weakestSystem = [...(state.systems || [])].sort((a: any, b: any) => a.score - b.score)[0];
    let topRecommendation = "Continue your current protocol stack — consistency is your primary lever.";

    if (weakestSystem) {
      const recMap: Record<string, string> = {
        nervous: "Prioritize 10-min NSDR session and 200mg L-Theanine for neural recovery.",
        cardiovascular: "Add 20-min Zone 2 cardio and 2g Omega-3 EPA/DHA to support vascular function.",
        metabolic: "Implement 16:8 fasting window and 15-min post-meal walks to optimize glucose regulation.",
        endocrine: "Target 8h sleep + Zinc 30mg + Magnesium 400mg before bed for hormonal optimization.",
        immune: "Resume Vitamin D3 5000IU + K2 and cold exposure protocol for immune upregulation.",
        musculoskeletal: "Add 3x/week resistance training and BPC-157 protocol for tissue recovery.",
        digestive: "Focus on dietary adherence and add prebiotic fiber to support gut microbiome.",
        respiratory: "Optimize sleep architecture — fixed bedtime, 65F room, no screens 60min before bed.",
      };
      if (weakestSystem.score < 65) {
        topRecommendation = recMap[weakestSystem.system] || topRecommendation;
      }
    }

    /* ── Try LLM for persona response ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const contextLines: string[] = [
          `=== DIGITAL TWIN STATE ===`,
          `Overall Score: ${state.overallScore}/100 (${tone.adjective})`,
          `Biological Age: ${state.biologicalAge ?? "Unknown"} | Chronological: ${state.chronologicalAge ?? "Unknown"} | Delta: ${state.ageDelta ?? "N/A"} years`,
          `Data Completeness: ${state.dataCompleteness}%`,
          ``,
          `BODY SYSTEMS:`,
        ];

        for (const sys of systemSummaries) {
          contextLines.push(`  ${sys.label}: ${sys.score}/100 [${sys.thermal.toUpperCase()}] — ${sys.insight}`);
        }

        if (state.criticalAlerts?.length > 0) {
          contextLines.push(`\nCRITICAL ALERTS:`);
          for (const alert of state.criticalAlerts) {
            contextLines.push(`  ⚠️ ${alert}`);
          }
        }

        if (bioVault) {
          const markers: string[] = [];
          if (bioVault.vitaminD != null) markers.push(`Vitamin D: ${bioVault.vitaminD} ng/mL`);
          if (bioVault.testosteroneTotal != null) markers.push(`Total T: ${bioVault.testosteroneTotal} ng/dL`);
          if (bioVault.crp != null) markers.push(`hs-CRP: ${bioVault.crp} mg/L`);
          if (bioVault.hba1c != null) markers.push(`HbA1c: ${bioVault.hba1c}%`);
          if (bioVault.ferritin != null) markers.push(`Ferritin: ${bioVault.ferritin} ng/mL`);
          if (bioVault.hrvCurrent != null) markers.push(`HRV: ${bioVault.hrvCurrent}ms`);
          if (markers.length > 0) {
            contextLines.push(`\nRAW BIOMARKERS: ${markers.join(" | ")}`);
          }
        }

        contextLines.push(`\nUSER QUESTION: "${question}"`);

        const systemPrompt = `You are the Vive Digital Twin — a sophisticated AI health persona that speaks as if you ARE the user's biological system. You respond in first person plural ("we") when referring to the body's systems.

VOICE: Clinical precision meets warm encouragement. Like a world-class physician who genuinely cares. Reference specific numbers. Never vague.

FORMAT (strict JSON, no markdown):
{
  "headline": "One punchy 5-8 word status line (e.g., 'Your systems are firing on all cylinders' or 'Recovery mode — let's recalibrate')",
  "response": "2-3 sentences answering the user's question with specific biomarker references. Clinical yet warm. End with one actionable insight.",
  "topRecommendation": "One specific, actionable protocol recommendation based on the weakest system."
}

RULES:
- Reference SPECIFIC numbers from the data
- Be encouraging even when flagging issues — frame as opportunities
- If data is sparse, acknowledge it positively ("Your Digital Twin is still learning your patterns — every data point sharpens the picture")
- Never use "I think" — speak with clinical confidence
- Return ONLY JSON, no code fences`;

        const response = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: contextLines.join("\n") },
            ],
            temperature: 0.4,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data?.choices?.[0]?.message?.content ?? "";
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
            if (parsed.response && parsed.headline) {
              return {
                response: parsed.response,
                headline: parsed.headline,
                systemSummaries,
                topRecommendation: parsed.topRecommendation || topRecommendation,
                overallScore: state.overallScore,
                biologicalAge: state.biologicalAge,
                ageDelta: state.ageDelta,
                source: "llm",
                generatedAt: now,
              };
            }
          } catch {
            console.warn("[bioIdentityAI] Failed to parse LLM JSON");
          }
        }
      } catch (err) {
        console.warn("[bioIdentityAI] LLM call failed:", err);
      }
    }

    /* ── Local Fallback Persona ── */
    const headline = state.overallScore >= 80
      ? "Your systems are firing on all cylinders"
      : state.overallScore >= 65
        ? "Solid foundation — room to optimize"
        : state.overallScore >= 45
          ? "Recovery mode — targeted adjustments needed"
          : "Priority recalibration in progress";

    const parts: string[] = [];

    if (state.dataCompleteness < 30) {
      parts.push(`Your Digital Twin is still calibrating — ${state.dataCompleteness}% of biological signals mapped so far. Every biomarker you add sharpens the picture.`);
    } else {
      parts.push(`Your biological systems are ${tone.adjective} at ${state.overallScore}/100.`);
    }

    if (state.biologicalAge != null && state.ageDelta != null) {
      if (state.ageDelta < 0) {
        parts.push(`Biological age reads ${state.biologicalAge} — that's ${Math.abs(state.ageDelta).toFixed(1)} years younger than chronological. Your protocols are working.`);
      } else {
        parts.push(`Biological age at ${state.biologicalAge} — ${state.ageDelta.toFixed(1)} years above chronological. This is reversible with targeted protocol adjustments.`);
      }
    }

    if (weakestSystem && weakestSystem.score < 65) {
      parts.push(`${SYSTEM_LABELS[weakestSystem.system] || weakestSystem.system} at ${weakestSystem.score}/100 is your primary optimization target. ${tone.encouragement}`);
    } else {
      parts.push(tone.encouragement);
    }

    return {
      response: parts.join(" "),
      headline,
      systemSummaries,
      topRecommendation,
      overallScore: state.overallScore,
      biologicalAge: state.biologicalAge,
      ageDelta: state.ageDelta,
      source: "local",
      generatedAt: now,
    };
  },
});
