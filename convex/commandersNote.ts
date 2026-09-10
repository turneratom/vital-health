import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   COMMANDER'S NOTE — AI-Generated Weekly Debrief Summary
   
   Cross-references the weekly tactical report data to produce
   a military-style paragraph summarizing the operator's week.
   Uses the Shipper AI proxy with a Commander persona.
   ═══════════════════════════════════════════════════════════════ */

export const generateCommandersNote = action({
  args: {
    readinessScore: v.number(),
    readinessGrade: v.string(),
    overallAdherence: v.number(),
    sleepAvgScore: v.optional(v.number()),
    sleepAvgHours: v.optional(v.number()),
    avgHrv: v.optional(v.number()),
    biomarkerSummary: v.string(),
    topWins: v.array(v.string()),
    topFailures: v.array(v.string()),
    adherenceDelta: v.optional(v.number()),
    sleepDelta: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    const contextLines = [
      `READINESS SCORE: ${args.readinessScore}/100 (${args.readinessGrade})`,
      `PROTOCOL ADHERENCE: ${args.overallAdherence}%${args.adherenceDelta != null ? ` (${args.adherenceDelta > 0 ? "+" : ""}${args.adherenceDelta}% WoW)` : ""}`,
      args.sleepAvgScore != null ? `SLEEP: ${args.sleepAvgScore}/100 avg, ${args.sleepAvgHours ?? "?"}h avg${args.sleepDelta != null ? ` (${args.sleepDelta > 0 ? "+" : ""}${args.sleepDelta} WoW)` : ""}` : "SLEEP: No data",
      args.avgHrv != null ? `HRV: ${args.avgHrv}ms avg` : "HRV: No data",
      `BIOMARKERS: ${args.biomarkerSummary}`,
      `TOP WINS: ${args.topWins.length > 0 ? args.topWins.join("; ") : "None identified"}`,
      `AREAS NEEDING IMPROVEMENT: ${args.topFailures.length > 0 ? args.topFailures.join("; ") : "None critical"}`,
    ];

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const systemPrompt = `You are the Commander — a elite military performance officer delivering a weekly debrief to an operator. Write ONE paragraph (4-6 sentences) summarizing their week.

TONE: Direct, authoritative, zero fluff. Like a Special Forces commander reviewing an operator's field performance. Use military metaphors sparingly but effectively. Acknowledge wins with respect, call out failures without sugar-coating, and end with a clear directive for the coming week.

RULES:
- Reference SPECIFIC numbers from the data (scores, percentages, biomarker values)
- Use action verbs: execute, deploy, fortify, recalibrate, sustain, advance, hold the line, breach, reinforce
- Never say "I think" or "maybe" — speak with command authority
- If performance is strong, acknowledge it briefly then push for the next level
- If performance is weak, be direct about the cost of inaction
- End with ONE clear order for the coming week
- Return ONLY the paragraph text, no quotes, no JSON, no formatting
- Keep it under 120 words`;

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
              { role: "user", content: `Generate the Commander's Note from this weekly data:\n\n${contextLines.join("\n")}` },
            ],
            temperature: 0.4,
            max_tokens: 300,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const note = data?.choices?.[0]?.message?.content?.trim() ?? "";
          if (note.length > 20) {
            return { note, source: "llm" as const };
          }
        }
      } catch (err) {
        console.warn("[commandersNote] LLM call failed, using local fallback:", err);
      }
    }

    // Local fallback
    const score = args.readinessScore;
    const adh = args.overallAdherence;
    let note = "";

    if (score >= 85) {
      note = `Operator, you posted a ${score}/100 readiness score this week with ${adh}% protocol adherence — that is elite-tier execution. `;
      note += args.topWins.length > 0 ? `${args.topWins[0]} stood out as your strongest vector. ` : "";
      note += `Sustain this cadence. The margin between good and exceptional is consistency under pressure. `;
      note += `Next week's directive: hold the line on every protocol and push sleep optimization to unlock the next performance ceiling.`;
    } else if (score >= 65) {
      note = `Solid week, Operator. ${score}/100 readiness with ${adh}% adherence puts you in operational range, but not at your ceiling. `;
      note += args.topFailures.length > 0 ? `${args.topFailures[0]} is the gap costing you the most ground. ` : "";
      note += args.sleepAvgHours != null && args.sleepAvgHours < 7 ? `Sleep at ${args.sleepAvgHours}h is undermining your recovery architecture. ` : "";
      note += `Next week's order: close the adherence gaps and target 80%+ across all protocols. No excuses.`;
    } else if (score >= 40) {
      note = `This week was suboptimal, Operator. ${score}/100 readiness and ${adh}% adherence signals protocol drift that will compound if unchecked. `;
      note += args.topFailures.length > 0 ? `Critical miss: ${args.topFailures[0]}. ` : "";
      note += `Your biomarkers and recovery metrics are feeling the cost of inconsistency. `;
      note += `Standing order for next week: recommit to the fundamentals — sleep, movement, and supplement protocols are non-negotiable.`;
    } else {
      note = `Operator, we need to address this directly. ${score}/100 readiness is compromised status — your biological systems are running without adequate support. `;
      note += `${adh}% adherence means protocols are being abandoned, not executed. `;
      note += args.topFailures.length > 0 ? `${args.topFailures[0]} requires immediate intervention. ` : "";
      note += `This is not sustainable. Next week's directive: execute a minimum viable protocol stack every single day. Rebuild from the ground up.`;
    }

    return { note, source: "local" as const };
  },
});
