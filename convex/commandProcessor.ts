import { action, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   COMMAND PROCESSOR — Proactive AI Brain for Command Bar
   
   Analyzes user input + bio-snapshot to generate:
   1. Contextual AI response (clinical-grade)
   2. Executable interventions (one-tap protocol insertion)
   3. Predictive suggestions ("thinking two steps ahead")
   4. Direct protocol HUD updates via intervention execution
   ═══════════════════════════════════════════════════════════════ */

/* ── Somatic State Detection ── */
interface SomaticState {
  detected: boolean;
  state: string;
  severity: "mild" | "moderate" | "severe";
  biologicalDriver: string;
  icon: string;
}

const SOMATIC_PATTERNS: Array<{
  patterns: RegExp[];
  state: string;
  severity: "mild" | "moderate" | "severe";
  biologicalDriver: string;
  icon: string;
}> = [
  {
    patterns: [/sluggish/i, /brain\s*fog/i, /foggy/i, /can'?t\s*focus/i, /unfocused/i, /groggy/i, /mental\s*fatigue/i, /cognitive/i, /slow\s*thinking/i],
    state: "neural_drive_low",
    severity: "moderate",
    biologicalDriver: "Acetylcholine depletion + prefrontal cortex underactivation",
    icon: "🧠",
  },
  {
    patterns: [/tired/i, /exhausted/i, /fatigued/i, /no\s*energy/i, /drained/i, /wiped/i, /burnt?\s*out/i, /low\s*energy/i],
    state: "energy_depleted",
    severity: "moderate",
    biologicalDriver: "Mitochondrial ATP output below threshold + possible cortisol dysregulation",
    icon: "🔋",
  },
  {
    patterns: [/anxious/i, /anxiety/i, /stressed/i, /wired/i, /can'?t\s*relax/i, /racing\s*thoughts/i, /overwhelmed/i, /tense/i],
    state: "sympathetic_overdrive",
    severity: "moderate",
    biologicalDriver: "HPA axis hyperactivation + elevated cortisol + low GABA tone",
    icon: "⚡",
  },
  {
    patterns: [/sore/i, /aching/i, /stiff/i, /pain/i, /inflamed/i, /swollen/i, /hurt/i],
    state: "inflammatory_signal",
    severity: "mild",
    biologicalDriver: "Elevated prostaglandins + possible CRP elevation",
    icon: "🔥",
  },
  {
    patterns: [/can'?t\s*sleep/i, /insomnia/i, /restless/i, /wide\s*awake/i, /trouble\s*sleeping/i],
    state: "sleep_disrupted",
    severity: "moderate",
    biologicalDriver: "Adenosine receptor saturation + melatonin suppression",
    icon: "🌙",
  },
  {
    patterns: [/hungry/i, /craving/i, /starving/i, /need\s*food/i, /low\s*blood\s*sugar/i],
    state: "glycemic_dip",
    severity: "mild",
    biologicalDriver: "Blood glucose below 70mg/dL threshold + ghrelin spike",
    icon: "🍽",
  },
  {
    patterns: [/great/i, /amazing/i, /incredible/i, /on\s*fire/i, /crushing\s*it/i, /peak/i, /dialed\s*in/i],
    state: "peak_state",
    severity: "mild",
    biologicalDriver: "Optimal dopamine-norepinephrine balance + high parasympathetic tone",
    icon: "🏆",
  },
  {
    patterns: [/headache/i, /migraine/i, /head\s*hurts/i, /head\s*pounding/i],
    state: "neurological_stress",
    severity: "moderate",
    biologicalDriver: "Vasodilation + possible dehydration or magnesium depletion",
    icon: "🤕",
  },
];

function detectSomaticState(input: string): SomaticState {
  const lower = input.toLowerCase();
  for (const pattern of SOMATIC_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(lower)) {
        return {
          detected: true,
          state: pattern.state,
          severity: pattern.severity,
          biologicalDriver: pattern.biologicalDriver,
          icon: pattern.icon,
        };
      }
    }
  }
  return { detected: false, state: "", severity: "mild", biologicalDriver: "", icon: "" };
}

/* ── Intervention Library ── */
interface Intervention {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  dosage?: string;
  duration?: string;
  mechanism: string;
  timeToEffect: string;
  priority: number;
}

const INTERVENTION_LIBRARY: Record<string, Intervention[]> = {
  neural_drive_low: [
    { id: "alpha-gpc-300", name: "Alpha-GPC 300mg", icon: "💊", category: "supplement", description: "Cholinergic precursor — direct acetylcholine upregulation", dosage: "300mg sublingual", mechanism: "Crosses BBB, converts to phosphatidylcholine then acetylcholine. Increases prefrontal cortex activation within 30-45 minutes.", timeToEffect: "30-45 min", priority: 95 },
    { id: "nsdr-10", name: "NSDR Session (10 min)", icon: "🧘", category: "recovery", description: "Non-Sleep Deep Rest — dopamine restoration protocol", duration: "10 minutes", mechanism: "Yoga nidra activates parasympathetic NS, restores dopamine by up to 65% (Huberman Lab). Resets prefrontal executive function.", timeToEffect: "10 min", priority: 90 },
    { id: "cold-face-30s", name: "Cold Water Face Immersion", icon: "❄️", category: "biohacking", description: "Mammalian dive reflex — instant norepinephrine spike", duration: "30 seconds", mechanism: "Triggers 200-300% norepinephrine release via trigeminal nerve activation. Clears brain fog within 60 seconds.", timeToEffect: "1 min", priority: 85 },
  ],
  energy_depleted: [
    { id: "creatine-5g", name: "Creatine Monohydrate 5g", icon: "⚡", category: "supplement", description: "ATP regeneration — cellular energy substrate", dosage: "5g in water", mechanism: "Replenishes phosphocreatine stores, directly increasing ATP availability in brain and muscle tissue.", timeToEffect: "45-60 min", priority: 88 },
    { id: "box-breathing-5", name: "Box Breathing (5 min)", icon: "🌬️", category: "recovery", description: "Vagal tone reset — autonomic rebalancing", duration: "5 minutes", mechanism: "5-5-5-5 pattern stimulates vagus nerve, shifts from sympathetic to parasympathetic dominance. Reduces cortisol 15-20%.", timeToEffect: "5 min", priority: 92 },
    { id: "zone2-walk-15", name: "Zone 2 Walk (15 min)", icon: "🚶", category: "movement", description: "Low-intensity movement — mitochondrial activation", duration: "15 minutes", mechanism: "Light aerobic activity at 60% max HR activates mitochondrial biogenesis pathways and increases BDNF.", timeToEffect: "15 min", priority: 80 },
  ],
  sympathetic_overdrive: [
    { id: "ashwagandha-300", name: "Ashwagandha KSM-66 300mg", icon: "🌱", category: "supplement", description: "Cortisol modulator — HPA axis recalibration", dosage: "300mg", mechanism: "Reduces cortisol by 27.9%. GABAergic activity calms amygdala hyperactivation.", timeToEffect: "45-60 min", priority: 90 },
    { id: "l-theanine-200", name: "L-Theanine 200mg", icon: "🍵", category: "supplement", description: "Alpha-wave promoter — calm focus without sedation", dosage: "200mg", mechanism: "Increases alpha brain wave activity, promotes GABA and serotonin production. Anxiolytic without drowsiness.", timeToEffect: "20-30 min", priority: 88 },
    { id: "physiological-sigh-3", name: "Physiological Sigh (3 min)", icon: "🫁", category: "recovery", description: "Double inhale + long exhale — fastest cortisol reset", duration: "3 minutes", mechanism: "Double nasal inhale maximally inflates alveoli, long exhale activates parasympathetic via phrenic nerve. Fastest real-time stress reduction (Stanford).", timeToEffect: "2-3 min", priority: 95 },
  ],
  inflammatory_signal: [
    { id: "omega3-3g", name: "Omega-3 (3g EPA/DHA)", icon: "🐟", category: "supplement", description: "Resolvin precursor — anti-inflammatory cascade", dosage: "3g EPA/DHA", mechanism: "EPA converts to resolvins and protectins that actively resolve inflammation.", timeToEffect: "2-4 hours", priority: 85 },
    { id: "curcumin-500", name: "Curcumin 500mg + Piperine", icon: "🟡", category: "supplement", description: "NF-kB inhibitor — systemic inflammation attenuator", dosage: "500mg with 10mg piperine", mechanism: "Inhibits NF-kB pathway, reducing TNF-a, IL-6, and COX-2 expression. Piperine increases bioavailability 2000%.", timeToEffect: "1-2 hours", priority: 82 },
    { id: "cold-exposure-2", name: "Cold Exposure (2 min)", icon: "❄️", category: "biohacking", description: "Norepinephrine-mediated anti-inflammatory cascade", duration: "2 minutes", mechanism: "Cold triggers norepinephrine release which suppresses TNF-a and IL-6 production.", timeToEffect: "Immediate", priority: 80 },
  ],
  sleep_disrupted: [
    { id: "mag-glycinate-400", name: "Magnesium Glycinate 400mg", icon: "🧲", category: "supplement", description: "GABA-A modulator — sleep architecture optimizer", dosage: "400mg", mechanism: "Glycinate form has calming effect via glycine receptor activation. Magnesium blocks NMDA receptors.", timeToEffect: "30-45 min", priority: 92 },
    { id: "apigenin-50", name: "Apigenin 50mg", icon: "🌼", category: "supplement", description: "GABA-A positive allosteric modulator", dosage: "50mg", mechanism: "Binds GABA-A receptors, reducing sleep onset latency. Also inhibits CD38, preserving NAD+ levels.", timeToEffect: "30 min", priority: 88 },
    { id: "screen-off-protocol", name: "Screen-Off Protocol (Now)", icon: "📵", category: "recovery", description: "Blue light elimination — melatonin preservation", mechanism: "Eliminating 480nm blue light allows pineal gland melatonin secretion to begin.", timeToEffect: "Immediate", priority: 95 },
  ],
  glycemic_dip: [
    { id: "protein-snack", name: "Protein-First Snack (20g)", icon: "🥚", category: "nutrition", description: "Gluconeogenesis substrate — stable glucose restoration", mechanism: "Protein triggers glucagon release for hepatic glucose output while providing amino acids.", timeToEffect: "15-20 min", priority: 90 },
    { id: "electrolytes", name: "Electrolyte Bolus", icon: "💧", category: "supplement", description: "Sodium + potassium + magnesium — cellular hydration", dosage: "1000mg Na, 200mg K, 60mg Mg", mechanism: "Dehydration mimics hypoglycemia symptoms. Electrolyte repletion restores cellular voltage gradient.", timeToEffect: "10 min", priority: 85 },
  ],
  neurological_stress: [
    { id: "mag-threonate-144", name: "Magnesium L-Threonate 144mg", icon: "🧲", category: "supplement", description: "BBB-crossing magnesium — neural tension release", dosage: "144mg elemental Mg", mechanism: "Only magnesium form that crosses blood-brain barrier. Reduces NMDA receptor overactivation.", timeToEffect: "30-45 min", priority: 90 },
    { id: "hydration-500ml", name: "Water + Electrolytes (500ml)", icon: "💧", category: "nutrition", description: "Cerebral perfusion restoration", mechanism: "75% of headaches are dehydration-related. 500ml water with electrolytes restores cerebral blood flow.", timeToEffect: "20 min", priority: 92 },
  ],
  peak_state: [],
};

/* ── Build contextual response ── */
function buildSomaticResponse(somatic: SomaticState, bioSnapshot: any) {
  const interventions = INTERVENTION_LIBRARY[somatic.state] || [];
  const hrv = bioSnapshot?.hrv;
  const hrvAvg = bioSnapshot?.hrvAvg7d;
  const sleep = bioSnapshot?.sleepHours;
  const crp = bioSnapshot?.crp;
  const recovery = bioSnapshot?.recovery;

  let contextualNote = "";
  if (somatic.state === "neural_drive_low") {
    if (sleep != null && sleep < 7) contextualNote = ` Sleep at ${sleep}h is the primary driver — deep sleep deficit reduces acetylcholine synthesis by 30-40%.`;
    else if (hrv != null && hrvAvg != null && hrv < hrvAvg * 0.85) contextualNote = ` HRV at ${hrv}ms (${Math.round(((hrvAvg - hrv) / hrvAvg) * 100)}% below baseline) confirms autonomic stress is attenuating cognitive output.`;
  } else if (somatic.state === "energy_depleted") {
    if (recovery != null && recovery < 60) contextualNote = ` Recovery at ${recovery}% — your body hasn't completed its repair cycles.`;
    else if (crp != null && crp > 1.5) contextualNote = ` hs-CRP at ${crp} mg/L — systemic inflammation is diverting metabolic resources from performance.`;
  } else if (somatic.state === "sympathetic_overdrive") {
    if (hrv != null && hrvAvg != null && hrv < hrvAvg * 0.8) contextualNote = ` HRV confirms sympathetic dominance at ${hrv}ms — ${Math.round(((hrvAvg - hrv) / hrvAvg) * 100)}% below your baseline.`;
  } else if (somatic.state === "inflammatory_signal") {
    if (crp != null && crp > 1.0) contextualNote = ` hs-CRP at ${crp} mg/L confirms active inflammatory signaling. Prioritize resolvin-pathway activation.`;
  } else if (somatic.state === "sleep_disrupted") {
    if (sleep != null && sleep < 6) contextualNote = ` Last recorded sleep: ${sleep}h — chronic deficit is compounding adenosine buildup.`;
  }

  return { interventions: interventions.slice(0, 3), contextualNote, confidence: 0.92 };
}

/* ═══════════════════════════════════════════════════════════════
   processCommand — Main AI Command Processor
   ═══════════════════════════════════════════════════════════════ */
export const processCommand = action({
  args: {
    input: v.string(),
    sessionId: v.string(),
    bioSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const input = args.input.trim();
    const bio = args.bioSnapshot || {};

    /* ── 1. Detect somatic state ── */
    const somatic = detectSomaticState(input);

    if (somatic.detected && somatic.state !== "peak_state") {
      const result = buildSomaticResponse(somatic, bio);

      // Try LLM for richer response
      const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
      const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

      if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
        try {
          const bioContext = Object.entries(bio)
            .filter(([, val]) => val != null && val !== undefined)
            .map(([k, val]) => `${k}: ${val}`)
            .join(", ");

          const systemPrompt = `You are the Vive Clinical Performance Architect. The user reported: "${input}". Detected state: ${somatic.state} (${somatic.biologicalDriver}).${result.contextualNote}

USER BIO-DATA: ${bioContext || "Limited data"}

Respond in EXACTLY 2-3 sentences:
1. Name the biological mechanism causing their symptom (reference their specific numbers)
2. State what interventions you are recommending and why they target the root cause
3. End with: "Execute below to add to your stack."

Use performance verbs: calibrate, architect, modulate, upregulate, attenuate. Never say "I think" or "maybe". Be authoritative and concise.`;

          const response = await fetch(SHIPPER_AI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
            body: JSON.stringify({
              model: "gpt-4.1-mini",
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: input }],
              temperature: 0.3,
              max_tokens: 250,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const llmText = data?.choices?.[0]?.message?.content ?? "";
            if (llmText.length > 20) {
              const cleanText = llmText.replace(/\s*\[ACTION:\w+:\w+\]\s*/g, "").trim();
              return {
                type: "somatic_intervention" as const,
                response: cleanText,
                interventions: result.interventions.map((i) => ({ ...i, executable: true })),
                somaticState: somatic,
                source: "llm" as const,
              };
            }
          }
        } catch { /* fall through */ }
      }

      // Local fallback
      const fallbackText = `${somatic.icon} ${somatic.biologicalDriver}.${result.contextualNote} Recommending ${result.interventions.length} targeted interventions — execute below to add to your stack.`;
      return {
        type: "somatic_intervention" as const,
        response: fallbackText,
        interventions: result.interventions.map((i) => ({ ...i, executable: true })),
        somaticState: somatic,
        source: "local" as const,
      };
    }

    /* ── 2. Peak state ── */
    if (somatic.detected && somatic.state === "peak_state") {
      const score = bio.vitalityScore ?? 78;
      const hrv = bio.hrv ?? 58;
      return {
        type: "affirmation" as const,
        response: `🏆 Biological systems synchronized — Vitality ${score}/100, HRV ${hrv}ms. You're in a compounding window. Every protocol completed now has amplified impact. Capitalize on this state for high-intensity training or deep cognitive work.`,
        interventions: [],
        somaticState: somatic,
        source: "local" as const,
      };
    }

    /* ── 3. Food logging ── */
    const foodLogMatch = input.match(/^(?:log|ate|had|eating)\s+(?:dinner|lunch|breakfast|meal|snack)?:?\s*(.+)/i);
    if (foodLogMatch) {
      const foodDesc = foodLogMatch[1];
      const protein = bio.todayProtein ?? 0;
      const calories = bio.todayCalories ?? 0;
      const proteinTarget = 160;
      let note = "";
      if (protein < proteinTarget * 0.5) note = ` ⚠️ Protein behind schedule — need ${proteinTarget - protein}g across remaining meals.`;
      else if (protein >= proteinTarget) note = " ✓ Protein target achieved.";
      if (bio.hba1c != null && bio.hba1c > 5.4) note += " Lead with protein before carbs to attenuate glucose spike.";

      return {
        type: "food_log" as const,
        response: `Logging: "${foodDesc}". Current intake: ${calories} kcal / ${protein}g protein (target: ${proteinTarget}g).${note}`,
        interventions: [],
        somaticState: { detected: false, state: "", severity: "mild" as const, biologicalDriver: "", icon: "" },
        source: "local" as const,
      };
    }

    /* ── 4. Supplement logging with contextual feedback ── */
    const suppMatch = input.match(/^(?:log|took|taking)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|iu|g|ml)\s+(.+)/i);
    if (suppMatch) {
      const dose = suppMatch[1];
      const unit = suppMatch[2];
      const name = suppMatch[3].trim();
      return {
        type: "supplement_log" as const,
        response: `✓ Logged: ${dose}${unit} ${name}. Entry added to your protocol timeline. ${bio.recovery != null && bio.recovery < 60 ? "Recovery at " + bio.recovery + "% — this supplement timing is strategic for repair-phase absorption." : "Timing noted for protocol adherence tracking."}`,
        interventions: [],
        somaticState: { detected: false, state: "", severity: "mild" as const, biologicalDriver: "", icon: "" },
        source: "local" as const,
      };
    }

    /* ── 5. Default: pass to LLM ── */
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const bioContext = Object.entries(bio)
          .filter(([, val]) => val != null && val !== undefined)
          .map(([k, val]) => `${k}: ${val}`)
          .join(", ");

        const systemPrompt = `You are the Vive Clinical Performance Architect — the world's foremost authority in longevity medicine and elite human performance optimization. You have access to the user's real-time biometric data.

USER BIO-DATA: ${bioContext || "Limited data available"}

RULES:
- Lead with the most critical insight (1-2 sentences)
- Reference their SPECIFIC numbers (HRV, sleep, CRP, etc.)
- Be concise — 3-4 sentences maximum
- Use performance verbs: calibrate, architect, modulate, upregulate, attenuate
- Never say "I think" or "maybe"
- End with a concrete next step`;

        const response = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: input }],
            temperature: 0.4,
            max_tokens: 300,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const llmText = data?.choices?.[0]?.message?.content ?? "";
          if (llmText.length > 10) {
            const cleanText = llmText.replace(/\s*\[ACTION:\w+:\w+\]\s*/g, "").trim();
            return {
              type: "ai_query" as const,
              response: cleanText,
              interventions: [],
              somaticState: { detected: false, state: "", severity: "mild" as const, biologicalDriver: "", icon: "" },
              source: "llm" as const,
            };
          }
        }
      } catch { /* fall through */ }
    }

    return {
      type: "ai_query" as const,
      response: "Processing your request. For best results, ensure your Bio-Vault is populated with recent lab data and wearable metrics.",
      interventions: [],
      somaticState: { detected: false, state: "", severity: "mild" as const, biologicalDriver: "", icon: "" },
      source: "fallback" as const,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   executeIntervention — Insert an AI-suggested intervention
   directly into the user's Protocol Stack (ProtocolMasterHUD)
   ═══════════════════════════════════════════════════════════════ */
export const executeIntervention = mutation({
  args: {
    sessionId: v.string(),
    interventionId: v.string(),
    name: v.string(),
    icon: v.string(),
    category: v.string(),
    description: v.string(),
    dosage: v.optional(v.string()),
    duration: v.optional(v.string()),
    timeOfDay: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const hour = new Date().getHours();
    const timeOfDay = args.timeOfDay || (hour < 12 ? "morning" : hour < 17 ? "performance" : "recovery");

    // Check if this intervention already exists today
    const existing = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const alreadyExists = existing.find(
      (p) => p.name === args.name && p.isActive && p.source === "ai-intervention"
    );

    if (alreadyExists) {
      return { success: true, protocolId: alreadyExists._id, alreadyExisted: true };
    }

    // Get max sort order for this time window
    const windowItems = existing.filter((p) => p.timeOfDay === timeOfDay && p.isActive);
    const maxSort = windowItems.reduce((max, p) => Math.max(max, p.sortOrder), 0);

    // Insert as a new protocol item
    const protocolId = await ctx.db.insert("protocols", {
      sessionId: args.sessionId,
      name: args.name,
      category: args.category,
      icon: args.icon,
      description: args.dosage ? `${args.description} (${args.dosage})` : args.description,
      timeOfDay,
      sortOrder: maxSort + 1,
      isActive: true,
      source: "ai-intervention",
      createdAt: now,
    });

    // Also log the intervention as a journal event
    await ctx.db.insert("journalEvents", {
      sessionId: args.sessionId,
      eventType: "ai_intervention",
      eventKey: args.interventionId,
      value: `AI Brain suggested: ${args.name}${args.dosage ? ` (${args.dosage})` : ""}`,
      numericValue: 0,
      loggedAt: now,
    });

    return { success: true, protocolId, alreadyExisted: false };
  },
});
