import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   RECOVERY PATCH ENGINE — Holistic Wellness Crisis Response
   
   When a user inputs something like "slept 4 hours, feel like trash",
   this engine:
   1. Detects the wellness crisis signals (sleep deprivation, fatigue, etc.)
   2. Pulls Vitamin D, Testosterone, DHEA, CRP from bioVault
   3. Cross-references to identify compounding risk factors
   4. Generates a specific Recovery Patch — a set of instructions
      to mitigate the damage for that day
   
   No menus. No options. Just a direct conversational fix.
   ═══════════════════════════════════════════════════════════════ */

/* ── Wellness Crisis Detection Patterns ── */
const CRISIS_PATTERNS: Array<{
  pattern: RegExp;
  signals: string[];
  severity: number;
  category: "sleep" | "energy" | "cognitive" | "pain" | "stress" | "mood";
}> = [
  { pattern: /slept?\s*(\d+\.?\d*)\s*h/i, signals: ["sleep_deficit"], severity: 0, category: "sleep" },
  { pattern: /(\d+\.?\d*)\s*hours?\s*(?:of\s*)?sleep/i, signals: ["sleep_deficit"], severity: 0, category: "sleep" },
  { pattern: /no\s*sleep|didn'?t\s*sleep|barely\s*slept/i, signals: ["severe_sleep_deficit"], severity: 3, category: "sleep" },
  { pattern: /feel\s*(?:like\s*)?(?:trash|garbage|shit|terrible|awful|horrible|dead)/i, signals: ["severe_fatigue", "low_mood"], severity: 3, category: "energy" },
  { pattern: /exhausted|wiped|destroyed|wrecked|crushed/i, signals: ["severe_fatigue"], severity: 3, category: "energy" },
  { pattern: /brain\s*fog|foggy|can'?t\s*(?:think|focus|concentrate)/i, signals: ["cognitive_impairment"], severity: 2, category: "cognitive" },
  { pattern: /tired|fatigued|drained|no\s*energy|low\s*energy/i, signals: ["fatigue"], severity: 2, category: "energy" },
  { pattern: /headache|migraine|head\s*(?:is\s*)?(?:pounding|killing)/i, signals: ["headache"], severity: 2, category: "pain" },
  { pattern: /stressed|anxious|overwhelmed|can'?t\s*relax/i, signals: ["stress_response"], severity: 2, category: "stress" },
  { pattern: /sore|aching|stiff|pain/i, signals: ["inflammation_pain"], severity: 1, category: "pain" },
  { pattern: /hungover|hang\s*over/i, signals: ["hangover", "dehydration", "liver_stress"], severity: 3, category: "energy" },
  { pattern: /sluggish|groggy|zombie/i, signals: ["fatigue", "cognitive_impairment"], severity: 2, category: "energy" },
  { pattern: /depressed|down|sad|hopeless/i, signals: ["low_mood"], severity: 2, category: "mood" },
  { pattern: /wired|can'?t\s*sleep|insomnia|restless/i, signals: ["hyperarousal"], severity: 2, category: "stress" },
  { pattern: /nauseous|nausea|sick/i, signals: ["nausea"], severity: 2, category: "pain" },
  { pattern: /dizzy|lightheaded|faint/i, signals: ["low_blood_pressure", "dehydration"], severity: 2, category: "pain" },
];

/* ── Recovery Protocol Library ── */
interface RecoveryAction {
  id: string;
  name: string;
  icon: string;
  timing: string;
  instruction: string;
  mechanism: string;
  priority: number;
  conditions: string[];
  contraindications?: string[];
}

const RECOVERY_ACTIONS: RecoveryAction[] = [
  // Sleep deficit recovery
  {
    id: "electrolytes_am",
    name: "Electrolyte Loading",
    icon: "💧",
    timing: "Immediately",
    instruction: "500ml water with 1/4 tsp salt + squeeze of lemon. Cortisol spikes from sleep loss deplete sodium.",
    mechanism: "Restores sodium/potassium balance disrupted by cortisol surge from sleep deprivation",
    priority: 1,
    conditions: ["sleep_deficit", "severe_sleep_deficit", "fatigue", "severe_fatigue", "dehydration"],
  },
  {
    id: "sunlight_10min",
    name: "10-Min Sunlight Exposure",
    icon: "☀️",
    timing: "Within 30 min of waking",
    instruction: "Get outside for 10 minutes of direct sunlight. No sunglasses. This is non-negotiable for cortisol reset.",
    mechanism: "Resets circadian clock via melanopsin receptors, suppresses melatonin, initiates cortisol awakening response",
    priority: 1,
    conditions: ["sleep_deficit", "severe_sleep_deficit", "fatigue", "cognitive_impairment", "low_mood"],
  },
  {
    id: "caffeine_delay",
    name: "Delay Caffeine 90 Min",
    icon: "☕",
    timing: "Wait until 90 min post-wake",
    instruction: "Do NOT drink coffee immediately. Wait 90 minutes to let adenosine clear naturally. Then limit to 200mg max today.",
    mechanism: "Prevents adenosine receptor blockade while levels are still high, avoiding afternoon crash",
    priority: 2,
    conditions: ["sleep_deficit", "severe_sleep_deficit", "cognitive_impairment"],
  },
  {
    id: "cold_face_splash",
    name: "Cold Water Face Immersion",
    icon: "🧊",
    timing: "Morning",
    instruction: "Fill sink with cold water, submerge face for 15-30 seconds. Triggers mammalian dive reflex.",
    mechanism: "Activates vagus nerve, releases norepinephrine, shifts from sympathetic to parasympathetic dominance",
    priority: 2,
    conditions: ["fatigue", "severe_fatigue", "cognitive_impairment", "stress_response", "hyperarousal"],
  },
  {
    id: "magnesium_glycinate",
    name: "Magnesium Glycinate 400mg",
    icon: "💊",
    timing: "With lunch + before bed",
    instruction: "200mg with lunch, 200mg 1 hour before bed. Glycinate form crosses BBB for neural recovery.",
    mechanism: "GABA receptor agonist, reduces cortisol, supports deep sleep architecture recovery",
    priority: 1,
    conditions: ["sleep_deficit", "severe_sleep_deficit", "stress_response", "hyperarousal", "inflammation_pain"],
  },
  {
    id: "vitamin_d_bolus",
    name: "Vitamin D3 5000 IU",
    icon: "🌅",
    timing: "With first meal (fat-containing)",
    instruction: "Take 5000 IU D3 with K2 MK-7 200mcg alongside a meal containing fat for absorption.",
    mechanism: "Acute D3 bolus supports immune function and cortisol modulation when levels are suboptimal",
    priority: 2,
    conditions: ["low_vitamin_d"],
  },
  {
    id: "zinc_30mg",
    name: "Zinc Picolinate 30mg",
    icon: "⚡",
    timing: "With dinner",
    instruction: "30mg zinc picolinate with dinner. Supports overnight testosterone synthesis.",
    mechanism: "Direct cofactor for 5-alpha reductase and aromatase regulation in Leydig cells",
    priority: 2,
    conditions: ["low_testosterone"],
  },
  {
    id: "ashwagandha",
    name: "Ashwagandha KSM-66 600mg",
    icon: "🌿",
    timing: "Morning + evening (300mg each)",
    instruction: "300mg with breakfast, 300mg before bed. Reduces cortisol by 30% within 60 days.",
    mechanism: "Withanolides modulate HPA axis, reduce cortisol, support DHEA production",
    priority: 2,
    conditions: ["stress_response", "severe_fatigue", "low_mood", "low_testosterone"],
  },
  {
    id: "protein_front_load",
    name: "40g Protein First Meal",
    icon: "🥩",
    timing: "First meal of the day",
    instruction: "Front-load 40g protein in your first meal. Eggs + meat or a quality shake. No carb-heavy breakfast today.",
    mechanism: "Tyrosine from protein → dopamine synthesis. Prevents glucose crash that amplifies fatigue",
    priority: 1,
    conditions: ["fatigue", "severe_fatigue", "cognitive_impairment", "low_mood"],
  },
  {
    id: "zone2_walk",
    name: "20-Min Zone 2 Walk",
    icon: "🚶",
    timing: "Midday (11am-1pm)",
    instruction: "Easy walk, HR under 120bpm. Not a workout — this is a recovery protocol. Sunlight bonus if outdoors.",
    mechanism: "Myokine release reduces IL-6, improves insulin sensitivity, clears cortisol metabolites",
    priority: 2,
    conditions: ["fatigue", "severe_fatigue", "inflammation_pain", "low_mood", "stress_response"],
  },
  {
    id: "nap_protocol",
    name: "26-Min Power Nap",
    icon: "😴",
    timing: "Between 1-3pm ONLY",
    instruction: "Set alarm for exactly 26 minutes. Lie down in dark room. Even if you don't sleep, the rest helps. Do NOT nap after 3pm.",
    mechanism: "NASA research: 26-min nap improves alertness 54% and performance 34%. Avoids sleep inertia.",
    priority: 1,
    conditions: ["sleep_deficit", "severe_sleep_deficit", "severe_fatigue"],
  },
  {
    id: "early_sleep",
    name: "9pm Screen-Off Protocol",
    icon: "🌙",
    timing: "Tonight at 9pm",
    instruction: "All screens off at 9pm. Blue-blocking glasses if needed. Target 9.5 hours in bed to recover sleep debt.",
    mechanism: "Single night of recovery sleep restores 80% of cognitive function lost from one night of deprivation",
    priority: 1,
    conditions: ["sleep_deficit", "severe_sleep_deficit"],
  },
  {
    id: "omega3_loading",
    name: "Omega-3 Loading Dose",
    icon: "🐟",
    timing: "With meals",
    instruction: "3g EPA/DHA split across meals today. Fish oil or eat fatty fish (salmon, sardines).",
    mechanism: "EPA directly competes with arachidonic acid for COX-2, reducing prostaglandin-mediated inflammation",
    priority: 2,
    conditions: ["inflammation_pain", "high_crp"],
  },
  {
    id: "l_theanine",
    name: "L-Theanine 200mg",
    icon: "🍵",
    timing: "Morning (stack with delayed caffeine)",
    instruction: "200mg L-theanine now. When you have coffee at 90 min, add another 100mg. Smooth focus without jitters.",
    mechanism: "Increases alpha brain waves, promotes calm focus. Synergistic with caffeine for sustained attention",
    priority: 2,
    conditions: ["cognitive_impairment", "stress_response", "hyperarousal"],
  },
  {
    id: "ginger_anti_nausea",
    name: "Ginger Root Tea",
    icon: "🫚",
    timing: "Immediately",
    instruction: "Fresh ginger sliced in hot water, or 500mg ginger capsule. Settles stomach within 20 minutes.",
    mechanism: "Gingerols block 5-HT3 serotonin receptors in the gut, reducing nausea signaling",
    priority: 1,
    conditions: ["nausea", "hangover"],
  },
  {
    id: "nad_precursor",
    name: "NAC 600mg + B-Complex",
    icon: "🧬",
    timing: "Morning",
    instruction: "N-Acetyl Cysteine 600mg + B-complex vitamin. Critical for liver detox and glutathione replenishment.",
    mechanism: "NAC is the rate-limiting precursor for glutathione synthesis. B vitamins support methylation under stress.",
    priority: 1,
    conditions: ["hangover", "liver_stress", "severe_fatigue"],
  },
];

/* ── AI System Prompt for Recovery Patch ── */
const RECOVERY_PATCH_PROMPT = `You are a precision longevity physician responding to a patient's wellness crisis. They've told you how they feel. You have their blood panel data.

Generate a Recovery Patch — a direct, conversational response that:
1. Acknowledges their state in ONE sentence (clinical but empathetic)
2. Cross-references their blood panel data to explain WHY they feel this way
3. Delivers 3-5 specific recovery actions for TODAY

RETURN ONLY valid JSON — no markdown, no code fences:
{
  "acknowledgment": "One sentence acknowledging their state with clinical precision.",
  "bloodPanelInsight": "One sentence connecting their symptoms to their specific blood panel values. Reference exact numbers.",
  "recoveryActions": [
    {
      "name": "Action Name",
      "icon": "emoji",
      "timing": "When to do it",
      "instruction": "Exact instruction",
      "mechanism": "Why this works (one sentence)"
    }
  ],
  "criticalWarning": "Optional — only if their blood panel + symptoms suggest something serious. null otherwise.",
  "tonightProtocol": "One sentence about what to do tonight to recover."
}

TONE: Direct. No hedging. Like a physician who actually cares. "Your Vitamin D at 22 ng/mL is compounding the fatigue — your immune system is running on fumes."
NEVER say "I recommend" or "you might want to." Say "Do this." or "Take this."`;

/* ═══════════════════════════════════════════════════════════════
   generateRecoveryPatch — Main Action
   ═══════════════════════════════════════════════════════════════ */

export const generateRecoveryPatch = action({
  args: {
    input: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    isWellnessCrisis: boolean;
    acknowledgment: string;
    bloodPanelInsight: string;
    recoveryActions: Array<{
      id: string;
      name: string;
      icon: string;
      timing: string;
      instruction: string;
      mechanism: string;
      priority: number;
    }>;
    criticalWarning: string | null;
    tonightProtocol: string;
    detectedSignals: string[];
    severity: number;
    bloodPanel: {
      vitaminD: number | null;
      testosteroneTotal: number | null;
      testosteroneFree: number | null;
      dhea: number | null;
      crp: number | null;
      ferritin: number | null;
      hba1c: number | null;
    };
    sleepHours: number | null;
    source: "ai" | "local";
  }> => {
    const input = args.input.trim();

    // ── 1. Detect wellness crisis signals ──
    const detectedSignals: string[] = [];
    let totalSeverity = 0;
    let sleepHours: number | null = null;
    const categories = new Set<string>();

    for (const cp of CRISIS_PATTERNS) {
      const match = input.match(cp.pattern);
      if (match) {
        // Extract sleep hours if present
        if (cp.category === "sleep" && match[1]) {
          sleepHours = parseFloat(match[1]);
          if (sleepHours < 5) {
            detectedSignals.push("severe_sleep_deficit");
            totalSeverity += 3;
          } else if (sleepHours < 7) {
            detectedSignals.push("sleep_deficit");
            totalSeverity += 2;
          }
        } else {
          detectedSignals.push(...cp.signals);
          totalSeverity += cp.severity;
        }
        categories.add(cp.category);
      }
    }

    // Not a wellness crisis — return early
    if (detectedSignals.length === 0) {
      return {
        isWellnessCrisis: false,
        acknowledgment: "",
        bloodPanelInsight: "",
        recoveryActions: [],
        criticalWarning: null,
        tonightProtocol: "",
        detectedSignals: [],
        severity: 0,
        bloodPanel: { vitaminD: null, testosteroneTotal: null, testosteroneFree: null, dhea: null, crp: null, ferritin: null, hba1c: null },
        sleepHours: null,
        source: "local",
      };
    }

    // ── 2. Pull blood panel from bioVault ──
    let bioVault: any = null;
    try {
      bioVault = await ctx.runQuery(
        "queries:getBioVaultBySession" as any,
        { sessionId: args.sessionId }
      );
    } catch { /* continue without */ }

    const bloodPanel = {
      vitaminD: bioVault?.vitaminD ?? null,
      testosteroneTotal: bioVault?.testosteroneTotal ?? null,
      testosteroneFree: bioVault?.testosteroneFree ?? null,
      dhea: bioVault?.dhea ?? null,
      crp: bioVault?.crp ?? null,
      ferritin: bioVault?.ferritin ?? null,
      hba1c: bioVault?.hba1c ?? null,
    };

    // Add blood-panel-derived signals
    if (bloodPanel.vitaminD !== null && bloodPanel.vitaminD < 30) detectedSignals.push("low_vitamin_d");
    if (bloodPanel.testosteroneTotal !== null && bloodPanel.testosteroneTotal < 400) detectedSignals.push("low_testosterone");
    if (bloodPanel.crp !== null && bloodPanel.crp > 1.5) detectedSignals.push("high_crp");
    if (bloodPanel.ferritin !== null && bloodPanel.ferritin < 30) detectedSignals.push("low_ferritin");

    const uniqueSignals = [...new Set(detectedSignals)];

    // ── 3. Select recovery actions based on signals ──
    const matchedActions = RECOVERY_ACTIONS
      .filter(a => a.conditions.some(c => uniqueSignals.includes(c)))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6);

    // ── 4. Try AI for personalized response ──
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const contextLines = [
          `Patient says: "${input}"`,
          `Detected signals: ${uniqueSignals.join(", ")}`,
          `Severity: ${totalSeverity}/10`,
          sleepHours !== null ? `Sleep last night: ${sleepHours} hours` : "Sleep: unknown",
          "",
          "BLOOD PANEL:",
          bloodPanel.vitaminD !== null ? `  Vitamin D: ${bloodPanel.vitaminD} ng/mL ${bloodPanel.vitaminD < 30 ? "[LOW]" : bloodPanel.vitaminD < 40 ? "[SUBOPTIMAL]" : "[OK]"}` : "  Vitamin D: not tested",
          bloodPanel.testosteroneTotal !== null ? `  Total Testosterone: ${bloodPanel.testosteroneTotal} ng/dL ${bloodPanel.testosteroneTotal < 400 ? "[LOW]" : "[OK]"}` : "  Total Testosterone: not tested",
          bloodPanel.testosteroneFree !== null ? `  Free Testosterone: ${bloodPanel.testosteroneFree} pg/mL` : "  Free Testosterone: not tested",
          bloodPanel.crp !== null ? `  hs-CRP: ${bloodPanel.crp} mg/L ${bloodPanel.crp > 1.5 ? "[ELEVATED]" : "[OK]"}` : "  hs-CRP: not tested",
          bloodPanel.ferritin !== null ? `  Ferritin: ${bloodPanel.ferritin} ng/mL ${bloodPanel.ferritin < 30 ? "[LOW]" : "[OK]"}` : "  Ferritin: not tested",
          bloodPanel.hba1c !== null ? `  HbA1c: ${bloodPanel.hba1c}% ${bloodPanel.hba1c > 5.7 ? "[ELEVATED]" : "[OK]"}` : "  HbA1c: not tested",
          "",
          "Available recovery actions (use these as a base, personalize):",
          ...matchedActions.map(a => `  - ${a.name}: ${a.instruction}`),
        ];

        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: RECOVERY_PATCH_PROMPT },
              { role: "user", content: contextLines.join("\n") },
            ],
            temperature: 0.3,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content ?? "";
          let jsonStr = raw.trim();
          const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fence) jsonStr = fence[1].trim();
          const b0 = jsonStr.indexOf("{");
          const b1 = jsonStr.lastIndexOf("}");
          if (b0 !== -1 && b1 !== -1) jsonStr = jsonStr.slice(b0, b1 + 1);

          const parsed = JSON.parse(jsonStr);
          if (parsed.acknowledgment && parsed.recoveryActions) {
            const aiActions = (parsed.recoveryActions || []).map((a: any, i: number) => ({
              id: `ai_${i}`,
              name: a.name || "Recovery Action",
              icon: a.icon || "💊",
              timing: a.timing || "Today",
              instruction: a.instruction || "",
              mechanism: a.mechanism || "",
              priority: i + 1,
            }));

            return {
              isWellnessCrisis: true,
              acknowledgment: parsed.acknowledgment,
              bloodPanelInsight: parsed.bloodPanelInsight || buildLocalBloodInsight(bloodPanel, uniqueSignals),
              recoveryActions: aiActions.slice(0, 5),
              criticalWarning: parsed.criticalWarning || null,
              tonightProtocol: parsed.tonightProtocol || "Screen-off at 9pm. Magnesium 400mg. Target 9+ hours in bed.",
              detectedSignals: uniqueSignals,
              severity: Math.min(10, totalSeverity),
              bloodPanel,
              sleepHours,
              source: "ai",
            };
          }
        }
      } catch { /* fall through to local */ }
    }

    // ── 5. Local fallback ──
    const acknowledgment = buildLocalAcknowledgment(uniqueSignals, sleepHours, totalSeverity);
    const bloodPanelInsight = buildLocalBloodInsight(bloodPanel, uniqueSignals);
    const criticalWarning = buildCriticalWarning(bloodPanel, uniqueSignals, sleepHours);
    const tonightProtocol = uniqueSignals.some(s => s.includes("sleep"))
      ? "Tonight: all screens off at 9pm. Magnesium glycinate 400mg. Room at 65°F. Target 9.5 hours in bed to begin repaying sleep debt."
      : "Tonight: wind down by 9:30pm. Magnesium 200mg. Avoid alcohol — it fragments deep sleep architecture.";

    return {
      isWellnessCrisis: true,
      acknowledgment,
      bloodPanelInsight,
      recoveryActions: matchedActions.map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        timing: a.timing,
        instruction: a.instruction,
        mechanism: a.mechanism,
        priority: a.priority,
      })),
      criticalWarning,
      tonightProtocol,
      detectedSignals: uniqueSignals,
      severity: Math.min(10, totalSeverity),
      bloodPanel,
      sleepHours,
      source: "local",
    };
  },
});

/* ── Local Acknowledgment Builder ── */
function buildLocalAcknowledgment(signals: string[], sleepHours: number | null, severity: number): string {
  if (signals.includes("severe_sleep_deficit") || (sleepHours !== null && sleepHours < 4)) {
    return `${sleepHours !== null ? sleepHours + " hours" : "Severe sleep deprivation"} — your prefrontal cortex is running at roughly 60% capacity, cortisol is spiked, and insulin sensitivity is tanked for the day. Here's your damage control protocol.`;
  }
  if (signals.includes("hangover")) {
    return "Your liver is processing ethanol metabolites, you're dehydrated, and glutathione stores are depleted. Here's your recovery protocol — follow it in order.";
  }
  if (severity >= 3) {
    return "Your system is in a compromised state. Multiple stress signals detected. Here's your Recovery Patch — these are prioritized actions to stabilize your biology today.";
  }
  if (signals.includes("cognitive_impairment")) {
    return "Brain fog detected — likely a combination of sleep quality, blood sugar regulation, and neurotransmitter depletion. Here's how to clear it.";
  }
  return "Suboptimal state detected. Here's your Recovery Patch to get back on track today.";
}

/* ── Local Blood Panel Insight Builder ── */
function buildLocalBloodInsight(bloodPanel: any, signals: string[]): string {
  const insights: string[] = [];

  if (bloodPanel.vitaminD !== null && bloodPanel.vitaminD < 30) {
    insights.push(`Vitamin D at ${bloodPanel.vitaminD} ng/mL is compounding your fatigue — immune function and serotonin synthesis are both compromised`);
  }
  if (bloodPanel.testosteroneTotal !== null && bloodPanel.testosteroneTotal < 400) {
    insights.push(`Testosterone at ${bloodPanel.testosteroneTotal} ng/dL means recovery capacity is reduced — sleep deprivation drops T by an additional 10-15%`);
  }
  if (bloodPanel.crp !== null && bloodPanel.crp > 1.5) {
    insights.push(`CRP at ${bloodPanel.crp} mg/L indicates existing inflammation — today's stress load will amplify this`);
  }
  if (bloodPanel.ferritin !== null && bloodPanel.ferritin < 30) {
    insights.push(`Ferritin at ${bloodPanel.ferritin} ng/mL means oxygen transport is already compromised — fatigue is partially iron-driven`);
  }

  if (insights.length === 0) {
    if (bloodPanel.vitaminD === null && bloodPanel.testosteroneTotal === null) {
      return "No blood panel data available — upload your labs to unlock precision recovery protocols that target your specific deficiencies.";
    }
    return "Your blood panel markers are within acceptable ranges. Today's state is likely acute — the recovery patch below will address it.";
  }

  return insights.slice(0, 2).join(". ") + ".";
}

/* ── Critical Warning Builder ── */
function buildCriticalWarning(bloodPanel: any, signals: string[], sleepHours: number | null): string | null {
  if (sleepHours !== null && sleepHours <= 3 && bloodPanel.crp !== null && bloodPanel.crp > 2.0) {
    return "⚠️ Severe sleep deprivation combined with elevated CRP creates a high-risk inflammatory state. Avoid intense exercise today — it will amplify inflammation, not reduce it. Focus on recovery protocols only.";
  }
  if (bloodPanel.ferritin !== null && bloodPanel.ferritin < 15) {
    return "⚠️ Ferritin critically low. Your fatigue may be partially iron-deficiency driven. Consider seeing your physician for iron infusion evaluation.";
  }
  return null;
}
