import { query } from "./_generated/server";
import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   DAILY VECTOR ENGINE
   
   Aggregates BioVault biomarkers, SomaticFeedback check-ins,
   protocol adherence, and dashboard data into:
   
   1. A single "Status" verdict: "Optimizing" | "Recovery Needed" | etc.
   2. Three "Action Orbits" — the top 3 most critical actions for today
   3. A confidence score for the overall assessment
   
   This replaces the traditional stat-list dashboard with a
   single-glance intelligence layer.
   ═══════════════════════════════════════════════════════════════ */

/* ── Optimal Ranges ── */
const OPTIMAL: Record<string, { min: number; max: number; unit: string }> = {
  vitaminD: { min: 40, max: 80, unit: "ng/mL" },
  testosteroneTotal: { min: 400, max: 900, unit: "ng/dL" },
  testosteroneFree: { min: 15, max: 25, unit: "pg/mL" },
  ferritin: { min: 40, max: 200, unit: "ng/mL" },
  crp: { min: 0, max: 1.0, unit: "mg/L" },
  hba1c: { min: 4.0, max: 5.6, unit: "%" },
};

interface ActionOrbit {
  id: string;
  icon: string;
  category: "peptide" | "hydration" | "movement" | "supplement" | "recovery" | "nutrition" | "sleep" | "protocol";
  title: string;
  detail: string;
  urgency: "critical" | "high" | "moderate";
  reason: string;
}

type VectorStatus =
  | "Peak Performance"
  | "Optimizing"
  | "Steady State"
  | "Recovery Needed"
  | "Recalibration Required"
  | "Data Insufficient";

export const getDailyVector = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    status: VectorStatus;
    statusDetail: string;
    statusColor: string;
    vitalityScore: number | null;
    actionOrbits: ActionOrbit[];
    dataSignals: number;
    somaticSnapshot: { flow: number | null; physical: number | null; painZones: string[] } | null;
    biomarkerFlags: Array<{ key: string; label: string; value: number; status: "optimal" | "suboptimal" | "critical" }>;
    protocolAdherence: { done: number; total: number; rate: number };
    hrvCurrent: number | null;
    sleepHours: number | null;
    generatedAt: number;
  }> => {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCutoff = startOfDay.getTime();

    /* ── 1. BioVault ── */
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    /* ── 2. Somatic Check-ins (today) ── */
    let somaticSnapshot: { flow: number | null; physical: number | null; painZones: string[] } | null = null;
    try {
      const somaticLogs = await ctx.db
        .query("somaticFeedback")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
        )
        .collect();
      if (somaticLogs.length > 0) {
        const latest = somaticLogs[somaticLogs.length - 1];
        somaticSnapshot = {
          flow: (latest as any).flowState ?? (latest as any).cognitiveScore ?? null,
          physical: (latest as any).physicalReadiness ?? (latest as any).physicalScore ?? null,
          painZones: (latest as any).painZones ?? (latest as any).activeZones ?? [],
        };
      }
    } catch { /* somaticFeedback may be empty */ }

    /* ── 3. Protocol Logs (today) ── */
    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", todayCutoff)
      )
      .collect();

    /* ── 4. Protocol Status ── */
    let protocolDone = 0;
    let protocolTotal = 0;
    try {
      const completions = await ctx.db
        .query("protocolCompletions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const todayCompletions = completions.filter((c) => c.completedAt >= todayCutoff);
      protocolDone = todayCompletions.filter((c) => c.completed).length;
      protocolTotal = Math.max(protocolDone, 8); // assume ~8 daily protocols
    } catch {
      protocolDone = protocolLogs.length;
      protocolTotal = Math.max(protocolDone, 8);
    }
    const adherenceRate = protocolTotal > 0 ? protocolDone / protocolTotal : 0;

    /* ── 5. Elite/Vitality Score ── */
    let vitalityScore: number | null = null;
    try {
      const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
      const scores = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recent = scores.filter((s) => s.calculatedAt >= cutoff7d).sort((a, b) => b.calculatedAt - a.calculatedAt);
      if (recent.length > 0) vitalityScore = recent[0].score;
    } catch { /* continue */ }

    /* ── 6. Dashboard Data (food/activity) ── */
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const todayFood = foodLogs.filter((l) => l.loggedAt >= todayCutoff);
    const totalCaloriesIn = todayFood.reduce((s, l) => s + l.calories, 0);
    const totalProtein = todayFood.reduce((s, l) => s + l.protein, 0);

    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const todayActivity = activityLogs.filter((l) => l.loggedAt >= todayCutoff);
    const totalCaloriesOut = todayActivity.reduce((s, l) => s + l.calories, 0);

    /* ── 7. Assess Biomarkers ── */
    const biomarkerFlags: Array<{ key: string; label: string; value: number; status: "optimal" | "suboptimal" | "critical" }> = [];
    let dataSignals = 0;

    if (bioVault) {
      const markers: Array<{ key: string; label: string }> = [
        { key: "vitaminD", label: "Vitamin D" },
        { key: "testosteroneTotal", label: "Total T" },
        { key: "testosteroneFree", label: "Free T" },
        { key: "ferritin", label: "Ferritin" },
        { key: "crp", label: "hs-CRP" },
        { key: "hba1c", label: "HbA1c" },
      ];
      for (const m of markers) {
        const val = (bioVault as any)[m.key];
        if (val != null && typeof val === "number") {
          dataSignals++;
          const range = OPTIMAL[m.key];
          let status: "optimal" | "suboptimal" | "critical" = "optimal";
          if (range) {
            if (val < range.min) {
              const pctBelow = ((range.min - val) / range.min) * 100;
              status = pctBelow > 25 ? "critical" : "suboptimal";
            } else if (val > range.max) {
              const pctAbove = ((val - range.max) / range.max) * 100;
              status = pctAbove > 25 ? "critical" : "suboptimal";
            }
          }
          biomarkerFlags.push({ key: m.key, label: m.label, value: val, status });
        }
      }
    }

    const hrvCurrent = bioVault?.hrvCurrent ?? null;
    const sleepHours = bioVault?.sleepHours ?? null;
    if (hrvCurrent) dataSignals++;
    if (sleepHours) dataSignals++;
    if (somaticSnapshot) dataSignals += 2;
    dataSignals += Math.min(protocolLogs.length, 10);
    dataSignals += Math.min(todayFood.length, 5);
    dataSignals += Math.min(todayActivity.length, 5);

    /* ── 8. Compute Status ── */
    let status: VectorStatus = "Steady State";
    let statusDetail = "";
    let statusColor = "#3B82F6";

    const flowLow = somaticSnapshot?.flow != null && somaticSnapshot.flow < 35;
    const physicalLow = somaticSnapshot?.physical != null && somaticSnapshot.physical < 35;
    const hasPain = !!(somaticSnapshot?.painZones && somaticSnapshot.painZones.length > 0);

    if (dataSignals < 3) {
      status = "Data Insufficient";
      statusDetail = "Seed biometric data to unlock precision status analysis";
      statusColor = "rgba(255,255,255,0.28)";
    } else {
      const criticalCount = biomarkerFlags.filter((f) => f.status === "critical").length;
      const suboptimalCount = biomarkerFlags.filter((f) => f.status === "suboptimal").length;
      const hrvLow = hrvCurrent != null && hrvCurrent < 40;
      const sleepDeprived = sleepHours != null && sleepHours < 6;

      if (criticalCount >= 2 || (hrvLow && sleepDeprived)) {
        status = "Recalibration Required";
        statusDetail = "Multiple biological systems flagged — prioritize recovery protocols";
        statusColor = "#FF6B6B";
      } else if (criticalCount >= 1 || sleepDeprived || (flowLow && physicalLow)) {
        status = "Recovery Needed";
        statusDetail = "Key markers require attention — shift to recovery-first approach";
        statusColor = "#E8976C";
      } else if (vitalityScore != null && vitalityScore >= 85 && adherenceRate >= 0.8) {
        status = "Peak Performance";
        statusDetail = "All systems synchronized — maintain current protocol architecture";
        statusColor = "#00FFCC";
      } else if ((vitalityScore != null && vitalityScore >= 65) || (adherenceRate >= 0.6 && suboptimalCount === 0)) {
        status = "Optimizing";
        statusDetail = "Biological trajectory ascending — protocol adherence is compounding";
        statusColor = "#00DC82";
      } else {
        status = "Steady State";
        statusDetail = "Baseline maintained — increase protocol adherence to accelerate gains";
        statusColor = "#3B82F6";
      }
    }

    /* ── 9. Generate Action Orbits (top 3) ── */
    const candidates: ActionOrbit[] = [];

    // CRP-driven hydration
    const crpFlag = biomarkerFlags.find((f) => f.key === "crp");
    if (crpFlag && crpFlag.status !== "optimal") {
      candidates.push({
        id: "hydration-crp",
        icon: "💧",
        category: "hydration",
        title: `Hydration: +32oz`,
        detail: `hs-CRP at ${crpFlag.value.toFixed(1)} mg/L — hydration reduces systemic inflammation`,
        urgency: crpFlag.status === "critical" ? "critical" : "high",
        reason: `CRP ${crpFlag.value > 1.5 ? "elevated" : "suboptimal"} — water intake modulates IL-6`,
      });
    }

    // Sleep debt recovery
    if (sleepHours != null && sleepHours < 7) {
      candidates.push({
        id: "sleep-debt",
        icon: "🌙",
        category: "sleep",
        title: `Sleep: Target ${Math.max(8, Math.ceil(sleepHours + 1.5))}h tonight`,
        detail: `${sleepHours.toFixed(1)}h last night — cortisol dysregulation accelerates aging`,
        urgency: sleepHours < 5.5 ? "critical" : "high",
        reason: "Sleep debt compounds — each hour below 7h adds 0.3y to biological age",
      });
    }

    // HRV recovery
    if (hrvCurrent != null && hrvCurrent < 45) {
      candidates.push({
        id: "hrv-recovery",
        icon: "💓",
        category: "recovery",
        title: "Session: 10m Box Breathing",
        detail: `HRV at ${hrvCurrent}ms — vagal tone needs immediate upregulation`,
        urgency: hrvCurrent < 30 ? "critical" : "high",
        reason: "Box breathing increases HRV by 15-20% within a single session",
      });
    }

    // Peptide protocols from protocol logs
    const peptideProtocols = protocolLogs.filter((l) =>
      l.protocolName.toLowerCase().includes("bpc") ||
      l.protocolName.toLowerCase().includes("tb-") ||
      l.protocolName.toLowerCase().includes("cjc") ||
      l.protocolName.toLowerCase().includes("peptide")
    );
    if (peptideProtocols.length === 0 && hasPain) {
      candidates.push({
        id: "peptide-pain",
        icon: "💉",
        category: "peptide",
        title: "Pin: 250mcg BPC-157",
        detail: `Pain zones flagged (${somaticSnapshot!.painZones.join(", ")}) — peptide protocol not logged`,
        urgency: "high",
        reason: "BPC-157 accelerates tissue repair via VEGF upregulation",
      });
    }

    // Movement gap
    if (todayActivity.length === 0) {
      const hour = new Date().getHours();
      if (hour >= 8) {
        candidates.push({
          id: "movement-gap",
          icon: "🏃",
          category: "movement",
          title: `Session: 15m Zone 2`,
          detail: "No movement logged today — myokine release is offline",
          urgency: hour >= 14 ? "high" : "moderate",
          reason: "Zone 2 cardio triggers mitochondrial biogenesis + anti-inflammatory IL-6",
        });
      }
    }

    // Protein target
    const userWeight = 180; // fallback
    const proteinTarget = Math.round(userWeight * 0.8);
    if (totalProtein < proteinTarget * 0.5 && new Date().getHours() >= 12) {
      candidates.push({
        id: "protein-deficit",
        icon: "🥩",
        category: "nutrition",
        title: `Protein: +${proteinTarget - totalProtein}g needed`,
        detail: `${totalProtein}g of ${proteinTarget}g target — muscle protein synthesis requires consistent intake`,
        urgency: totalProtein < proteinTarget * 0.3 ? "high" : "moderate",
        reason: "Sub-threshold protein intake accelerates sarcopenia and impairs recovery",
      });
    }

    // Vitamin D deficiency
    const vitDFlag = biomarkerFlags.find((f) => f.key === "vitaminD");
    if (vitDFlag && vitDFlag.status !== "optimal") {
      candidates.push({
        id: "vitamin-d",
        icon: "☀️",
        category: "supplement",
        title: "Supplement: D3 5000 IU + K2",
        detail: `Vitamin D at ${vitDFlag.value} ng/mL — below optimal 40-80 range`,
        urgency: vitDFlag.status === "critical" ? "critical" : "moderate",
        reason: "Vitamin D modulates 200+ genes including immune and hormonal pathways",
      });
    }

    // Ferritin depletion
    const ferritinFlag = biomarkerFlags.find((f) => f.key === "ferritin");
    if (ferritinFlag && ferritinFlag.status === "critical") {
      candidates.push({
        id: "iron-depletion",
        icon: "🩸",
        category: "supplement",
        title: "Supplement: Iron Bisglycinate 25mg",
        detail: `Ferritin at ${ferritinFlag.value} ng/mL — oxygen transport compromised`,
        urgency: "critical",
        reason: "Low ferritin impairs mitochondrial electron chain + thyroid conversion",
      });
    }

    // Protocol adherence push
    if (adherenceRate < 0.5 && protocolTotal > 0) {
      candidates.push({
        id: "adherence-push",
        icon: "📋",
        category: "protocol",
        title: `Complete ${protocolTotal - protocolDone} remaining protocols`,
        detail: `${Math.round(adherenceRate * 100)}% adherence — below 80% threshold for compounding`,
        urgency: adherenceRate < 0.3 ? "high" : "moderate",
        reason: "Protocol consistency is the #1 predictor of biological age reversal",
      });
    }

    // Somatic-driven recovery
    if (physicalLow && !hasPain) {
      candidates.push({
        id: "somatic-recovery",
        icon: "🧊",
        category: "recovery",
        title: "Session: 2m Cold Plunge",
        detail: `Physical readiness at ${somaticSnapshot?.physical}/100 — norepinephrine boost needed`,
        urgency: "moderate",
        reason: "Cold exposure increases norepinephrine 200-300%, restoring physical readiness",
      });
    }

    // Sort by urgency and take top 3
    const urgencyOrder = { critical: 0, high: 1, moderate: 2 };
    candidates.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    const actionOrbits = candidates.slice(0, 3);

    return {
      status,
      statusDetail,
      statusColor,
      vitalityScore,
      actionOrbits,
      dataSignals,
      somaticSnapshot,
      biomarkerFlags,
      protocolAdherence: { done: protocolDone, total: protocolTotal, rate: adherenceRate },
      hrvCurrent: hrvCurrent as number | null,
      sleepHours: sleepHours as number | null,
      generatedAt: now,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   AI-Enhanced Status — Uses LLM to generate a precision
   1-sentence status message from the Daily Vector data
   ═══════════════════════════════════════════════════════════════ */

export const generateAIStatus = action({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    aiStatus: string;
    aiOrbits: Array<{ title: string; detail: string; icon: string }>;
    source: "llm" | "local";
  }> => {
    const vector = await ctx.runQuery(
      "dailyVector:getDailyVector" as any,
      { sessionId: args.sessionId }
    );

    if (!vector) {
      return {
        aiStatus: "Biological baseline establishing — seed data to unlock precision analysis.",
        aiOrbits: [],
        source: "local",
      };
    }

    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const contextLines = [
          `Status: ${vector.status}`,
          `Vitality Score: ${vector.vitalityScore ?? "N/A"}`,
          `Protocol Adherence: ${Math.round(vector.protocolAdherence.rate * 100)}% (${vector.protocolAdherence.done}/${vector.protocolAdherence.total})`,
          `HRV: ${vector.hrvCurrent ?? "N/A"}ms`,
          `Sleep: ${vector.sleepHours ?? "N/A"}h`,
          `Biomarker Flags: ${vector.biomarkerFlags.map((f: { label: string; value: number; status: string }) => `${f.label}=${f.value} [${f.status}]`).join(", ") || "none"}`,
          `Somatic: Flow=${vector.somaticSnapshot?.flow ?? "N/A"}, Physical=${vector.somaticSnapshot?.physical ?? "N/A"}, Pain=${vector.somaticSnapshot?.painZones?.join(",") || "none"}`,
          `Data Signals: ${vector.dataSignals}`,
          `Action Orbits: ${vector.actionOrbits.map((o: ActionOrbit) => o.title).join(" | ")}`,
        ];

        const response = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SHIPPER_AI_TOKEN}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content: `You are the Vive Clinical Performance Architect. Generate a 1-sentence status message (max 20 words) that captures the user's current biological state with clinical precision. Use performance verbs: calibrate, synchronize, optimize, modulate, upregulate. Reference specific numbers. Return ONLY the sentence, no quotes, no JSON.`,
              },
              {
                role: "user",
                content: contextLines.join("\n"),
              },
            ],
            temperature: 0.3,
            max_tokens: 60,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiStatus = data?.choices?.[0]?.message?.content?.trim() ?? "";
          if (aiStatus.length > 10) {
            return {
              aiStatus,
              aiOrbits: vector.actionOrbits.map((o: ActionOrbit) => ({ title: o.title, detail: o.detail, icon: o.icon })),
              source: "llm",
            };
          }
        }
      } catch { /* fall through to local */ }
    }

    return {
      aiStatus: vector.statusDetail,
      aiOrbits: vector.actionOrbits.map((o: ActionOrbit) => ({ title: o.title, detail: o.detail, icon: o.icon })),
      source: "local",
    };
  },
});
