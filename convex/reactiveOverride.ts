import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   REACTIVE OVERRIDE ENGINE
   
   Continuously monitors the user's biological state and determines
   whether the dashboard should enter "Recovery Priority" mode.
   
   When triggered, it returns:
   - Override state (active/inactive)
   - Severity level (caution / alert / critical)
   - Specific recovery commands with timing
   - Which standard protocols to suppress
   - A "biological narrative" explaining what's happening inside
   
   This query is REACTIVE — it re-evaluates every time new HRV,
   sleep, or biomarker data arrives via Convex subscriptions.
   ═══════════════════════════════════════════════════════════════ */

export type OverrideSeverity = "critical" | "alert" | "caution";

export interface RecoveryCommand {
  id: string;
  name: string;
  icon: string;
  timing: string;
  instruction: string;
  mechanism: string;
  category: "immediate" | "morning" | "midday" | "evening";
  priority: number;
  replaces?: string;
}

export interface ReactiveOverrideResult {
  /** Whether the override is active */
  isActive: boolean;
  /** Severity of the biological compromise */
  severity: OverrideSeverity | null;
  /** Primary color for the override UI */
  color: string;
  /** Glow color for ambient effects */
  glowColor: string;
  /** Pulsing background gradient */
  bgGradient: string;
  /** Border color */
  borderColor: string;

  /** Headline — what the OS detected */
  headline: string;
  /** Sub-headline — what it means biologically */
  subheadline: string;
  /** Biological narrative — deeper explanation */
  narrative: string;

  /** Detected signals that triggered the override */
  signals: Array<{
    id: string;
    label: string;
    value: string;
    status: "critical" | "warning" | "info";
    icon: string;
  }>;

  /** Recovery commands — ordered by priority */
  commands: RecoveryCommand[];

  /** Protocols to suppress from the standard daily stack */
  suppressedProtocols: string[];

  /** Confidence score 0-100 */
  confidence: number;

  /** Timestamp of last data point used */
  lastDataAt: number;

  /** Bio metrics summary */
  metrics: {
    hrvCurrent: number | null;
    hrvBaseline: number | null;
    hrvDeviationPct: number | null;
    sleepHours: number | null;
    sleepScore: number | null;
    sleepDeepPct: number | null;
    crp: number | null;
    recoveryScore: number | null;
    consecutivePoorDays: number;
  };
}

const SEVERITY_STYLES: Record<OverrideSeverity, {
  color: string; glowColor: string; bgGradient: string; borderColor: string;
}> = {
  critical: {
    color: "#FF6B6B",
    glowColor: "rgba(255,107,107,0.25)",
    bgGradient: "linear-gradient(135deg, rgba(255,107,107,0.12) 0%, rgba(255,60,60,0.04) 50%, rgba(255,107,107,0.08) 100%)",
    borderColor: "rgba(255,107,107,0.30)",
  },
  alert: {
    color: "#E8976C",
    glowColor: "rgba(232,151,108,0.20)",
    bgGradient: "linear-gradient(135deg, rgba(232,151,108,0.10) 0%, rgba(232,151,108,0.03) 50%, rgba(232,151,108,0.06) 100%)",
    borderColor: "rgba(232,151,108,0.25)",
  },
  caution: {
    color: "#F59E0B",
    glowColor: "rgba(245,158,11,0.15)",
    bgGradient: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 50%, rgba(245,158,11,0.05) 100%)",
    borderColor: "rgba(245,158,11,0.20)",
  },
};

/* ── Recovery Command Library ── */
const RECOVERY_COMMANDS: RecoveryCommand[] = [
  {
    id: "electrolyte_load",
    name: "Electrolyte Loading",
    icon: "💧",
    timing: "Now",
    instruction: "500ml water + 1/4 tsp salt + lemon. Cortisol from sleep loss depletes sodium rapidly.",
    mechanism: "Restores sodium/potassium balance disrupted by elevated cortisol",
    category: "immediate",
    priority: 1,
  },
  {
    id: "sunlight_10",
    name: "10-Min Sunlight Protocol",
    icon: "☀️",
    timing: "Within 30 min",
    instruction: "Direct sunlight, no sunglasses. Non-negotiable for circadian reset after poor sleep.",
    mechanism: "Melanopsin receptor activation resets cortisol awakening response",
    category: "immediate",
    priority: 2,
  },
  {
    id: "caffeine_delay",
    name: "Delay Caffeine 90 Min",
    icon: "☕",
    timing: "Wait 90 min post-wake",
    instruction: "Let adenosine clear naturally. Max 200mg caffeine today — no afternoon doses.",
    mechanism: "Prevents adenosine receptor blockade while levels are elevated",
    category: "morning",
    priority: 3,
    replaces: "Morning Coffee",
  },
  {
    id: "zone2_walk",
    name: "20-Min Zone 2 Walk",
    icon: "🚶",
    timing: "Midday",
    instruction: "Easy walk, HR under 120bpm. This is recovery, not training. Outdoors if possible.",
    mechanism: "Myokine release reduces IL-6, clears cortisol metabolites",
    category: "midday",
    priority: 4,
    replaces: "HIIT / Strength Training",
  },
  {
    id: "mag_glycinate",
    name: "Magnesium Glycinate 400mg",
    icon: "💊",
    timing: "200mg lunch + 200mg pre-bed",
    instruction: "Glycinate form crosses BBB for neural recovery. Split dose for sustained effect.",
    mechanism: "GABA receptor agonist, reduces cortisol, supports deep sleep architecture",
    category: "midday",
    priority: 5,
  },
  {
    id: "protein_front",
    name: "40g Protein First Meal",
    icon: "🥩",
    timing: "First meal",
    instruction: "Front-load protein: eggs + meat or quality shake. Skip carb-heavy breakfast today.",
    mechanism: "Tyrosine → dopamine synthesis. Prevents glucose crash amplifying fatigue",
    category: "morning",
    priority: 3,
  },
  {
    id: "cold_face",
    name: "Cold Water Face Immersion",
    icon: "🧊",
    timing: "Morning",
    instruction: "Fill sink with cold water, submerge face 15-30 seconds. Triggers dive reflex.",
    mechanism: "Vagus nerve activation, norepinephrine release, parasympathetic shift",
    category: "immediate",
    priority: 2,
  },
  {
    id: "nap_26",
    name: "26-Min Power Nap",
    icon: "😴",
    timing: "1-3pm only",
    instruction: "Exactly 26 minutes. Dark room. Even rest without sleep helps. Never after 3pm.",
    mechanism: "NASA research: 26-min nap → 54% alertness boost, avoids sleep inertia",
    category: "midday",
    priority: 4,
  },
  {
    id: "omega3_load",
    name: "Omega-3 Loading (3g EPA/DHA)",
    icon: "🐟",
    timing: "Split across meals",
    instruction: "3g EPA/DHA total today. Fish oil capsules or fatty fish (salmon, sardines).",
    mechanism: "EPA competes with arachidonic acid for COX-2, reducing prostaglandin inflammation",
    category: "morning",
    priority: 5,
  },
  {
    id: "screen_off_9pm",
    name: "9pm Screen-Off Protocol",
    icon: "🌙",
    timing: "Tonight 9pm",
    instruction: "All screens off. Blue-blocking glasses if needed. Target 9.5 hours in bed.",
    mechanism: "Single recovery night restores 80% of cognitive function from one night of deprivation",
    category: "evening",
    priority: 1,
  },
  {
    id: "ashwagandha_600",
    name: "Ashwagandha KSM-66 600mg",
    icon: "🌿",
    timing: "300mg AM + 300mg PM",
    instruction: "Split dose morning and evening. Reduces cortisol by 30% within 60 days.",
    mechanism: "Withanolides modulate HPA axis, reduce cortisol, support DHEA production",
    category: "morning",
    priority: 6,
  },
  {
    id: "vitamin_d_bolus",
    name: "Vitamin D3 5000 IU + K2",
    icon: "🌅",
    timing: "With first fat-containing meal",
    instruction: "5000 IU D3 with K2 MK-7 200mcg. Must be taken with dietary fat for absorption.",
    mechanism: "Acute D3 bolus supports immune function and cortisol modulation",
    category: "morning",
    priority: 6,
  },
];

/* ── Command Selection Logic ── */
function selectCommands(
  hrvDeviation: number | null,
  sleepHours: number | null,
  sleepScore: number | null,
  crp: number | null,
  vitaminD: number | null,
  severity: OverrideSeverity,
): RecoveryCommand[] {
  const selected: RecoveryCommand[] = [];
  const ids = new Set<string>();

  function add(id: string) {
    if (ids.has(id)) return;
    const cmd = RECOVERY_COMMANDS.find(c => c.id === id);
    if (cmd) { selected.push(cmd); ids.add(id); }
  }

  // Always include for any override
  add("electrolyte_load");
  add("sunlight_10");

  // Sleep-specific
  if (sleepHours !== null && sleepHours < 6) {
    add("caffeine_delay");
    add("nap_26");
    add("screen_off_9pm");
  }
  if (sleepScore !== null && sleepScore < 60) {
    add("protein_front");
    add("mag_glycinate");
  }

  // HRV crash — nervous system recovery
  if (hrvDeviation !== null && hrvDeviation > 15) {
    add("cold_face");
    add("zone2_walk");
    add("ashwagandha_600");
  }

  // Inflammation markers
  if (crp !== null && crp > 1.5) {
    add("omega3_load");
  }
  if (vitaminD !== null && vitaminD < 35) {
    add("vitamin_d_bolus");
  }

  // Critical severity — add everything restorative
  if (severity === "critical") {
    add("protein_front");
    add("mag_glycinate");
    add("zone2_walk");
    add("screen_off_9pm");
  }

  return selected.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

/* ═══════════════════════════════════════════════════════════════
   getReactiveOverride — Main Query
   
   Reactive Convex query that re-evaluates whenever underlying
   data changes. Returns the dashboard override state.
   ═══════════════════════════════════════════════════════════════ */

export const getReactiveOverride = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<ReactiveOverrideResult> => {
    const { sessionId } = args;

    // ── 1. Pull latest sleep data ──
    const now = Date.now();
    const last48h = now - 48 * 60 * 60 * 1000;

    const recentSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId_and_date", (q: any) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(7);

    const lastNightSleep = recentSleep[0] ?? null;
    const sleepHours = lastNightSleep?.totalHours ?? null;
    const sleepScore = lastNightSleep?.sleepScore ?? null;
    const sleepDeepPct = lastNightSleep?.deepHours && lastNightSleep?.totalHours
      ? Math.round((lastNightSleep.deepHours / lastNightSleep.totalHours) * 100)
      : null;

    // Count consecutive poor sleep days
    let consecutivePoorDays = 0;
    for (const log of recentSleep) {
      if (log.sleepScore < 60 || log.totalHours < 6) {
        consecutivePoorDays++;
      } else {
        break;
      }
    }

    // ── 2. Pull latest HRV data ──
    const recentHrv = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", sessionId).gte("measuredAt", last48h)
      )
      .order("desc")
      .take(20);

    const latestHrv = recentHrv[0] ?? null;
    const hrvCurrent = latestHrv?.value ?? null;

    // Calculate 7-day HRV baseline from bioVault
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();

    const hrvBaseline = bioVault?.hrvAvg7d ?? bioVault?.hrvBaseline ?? null;
    let hrvDeviationPct: number | null = null;
    if (hrvCurrent !== null && hrvBaseline !== null && hrvBaseline > 0) {
      hrvDeviationPct = Math.round(((hrvBaseline - hrvCurrent) / hrvBaseline) * 100);
    }

    const crp = bioVault?.crp ?? null;
    const vitaminD = bioVault?.vitaminD ?? null;

    // ── 3. Calculate recovery score ──
    let recoveryScore = 100;
    if (sleepScore !== null) recoveryScore -= Math.max(0, 80 - sleepScore) * 0.5;
    if (hrvDeviationPct !== null && hrvDeviationPct > 0) recoveryScore -= hrvDeviationPct * 1.2;
    if (crp !== null && crp > 1.0) recoveryScore -= Math.min(crp * 5, 20);
    if (consecutivePoorDays >= 2) recoveryScore -= consecutivePoorDays * 5;
    recoveryScore = Math.max(0, Math.min(100, Math.round(recoveryScore)));

    // ── 4. Determine if override should be active ──
    const signals: ReactiveOverrideResult["signals"] = [];
    let severityScore = 0;

    // HRV crash detection
    if (hrvDeviationPct !== null && hrvDeviationPct > 10) {
      const isCritical = hrvDeviationPct > 25;
      signals.push({
        id: "hrv_crash",
        label: isCritical ? "HRV CRASH" : "HRV BELOW BASELINE",
        value: `${hrvCurrent}ms (−${hrvDeviationPct}%)`,
        status: isCritical ? "critical" : "warning",
        icon: "💓",
      });
      severityScore += isCritical ? 4 : 2;
    }

    // Sleep deprivation
    if (sleepHours !== null && sleepHours < 6) {
      const isCritical = sleepHours < 5;
      signals.push({
        id: "sleep_deficit",
        label: isCritical ? "SEVERE SLEEP DEFICIT" : "SLEEP DEFICIT",
        value: `${sleepHours.toFixed(1)}h (need 7-9h)`,
        status: isCritical ? "critical" : "warning",
        icon: "😴",
      });
      severityScore += isCritical ? 4 : 2;
    }

    // Poor sleep quality
    if (sleepScore !== null && sleepScore < 55) {
      signals.push({
        id: "sleep_quality",
        label: "POOR SLEEP QUALITY",
        value: `Score: ${sleepScore}/100`,
        status: sleepScore < 40 ? "critical" : "warning",
        icon: "📉",
      });
      severityScore += sleepScore < 40 ? 3 : 1;
    }

    // Low deep sleep
    if (sleepDeepPct !== null && sleepDeepPct < 15) {
      signals.push({
        id: "low_deep",
        label: "LOW DEEP SLEEP",
        value: `${sleepDeepPct}% (need >20%)`,
        status: "warning",
        icon: "🧠",
      });
      severityScore += 1;
    }

    // Elevated inflammation
    if (crp !== null && crp > 1.5) {
      signals.push({
        id: "inflammation",
        label: crp > 3 ? "HIGH INFLAMMATION" : "ELEVATED CRP",
        value: `${crp} mg/L`,
        status: crp > 3 ? "critical" : "warning",
        icon: "🔥",
      });
      severityScore += crp > 3 ? 3 : 1;
    }

    // Consecutive poor days
    if (consecutivePoorDays >= 2) {
      signals.push({
        id: "consecutive_poor",
        label: "MULTI-DAY DECLINE",
        value: `${consecutivePoorDays} consecutive poor days`,
        status: consecutivePoorDays >= 3 ? "critical" : "warning",
        icon: "📊",
      });
      severityScore += consecutivePoorDays >= 3 ? 3 : 1;
    }

    // ── 5. Determine severity and activation ──
    const isActive = severityScore >= 2;
    let severity: OverrideSeverity | null = null;
    if (severityScore >= 7) severity = "critical";
    else if (severityScore >= 4) severity = "alert";
    else if (severityScore >= 2) severity = "caution";

    if (!isActive) {
      return {
        isActive: false,
        severity: null,
        color: "rgba(255,255,255,0.1)",
        glowColor: "transparent",
        bgGradient: "none",
        borderColor: "transparent",
        headline: "",
        subheadline: "",
        narrative: "",
        signals: [],
        commands: [],
        suppressedProtocols: [],
        confidence: 0,
        lastDataAt: now,
        metrics: {
          hrvCurrent, hrvBaseline, hrvDeviationPct,
          sleepHours, sleepScore, sleepDeepPct,
          crp, recoveryScore, consecutivePoorDays,
        },
      };
    }

    const styles = SEVERITY_STYLES[severity!];

    // ── 6. Generate headline and narrative ──
    let headline = "";
    let subheadline = "";
    let narrative = "";

    if (severity === "critical") {
      if (hrvDeviationPct !== null && hrvDeviationPct > 20 && sleepHours !== null && sleepHours < 5.5) {
        headline = "Inflammation Detected — Protocol Adjusted";
        subheadline = `HRV crashed ${hrvDeviationPct}% below baseline after ${sleepHours.toFixed(1)}h sleep. Your nervous system is in acute stress response.`;
        narrative = `Your autonomic nervous system is signaling distress. HRV at ${hrvCurrent}ms (baseline: ${hrvBaseline}ms) indicates elevated sympathetic tone — your body is running on cortisol. Combined with ${sleepHours.toFixed(1)} hours of sleep, your prefrontal cortex is operating at ~60% capacity. All high-intensity protocols have been replaced with recovery-first alternatives. Follow these in order.`;
      } else if (consecutivePoorDays >= 3) {
        headline = "Cumulative Recovery Debt — Emergency Protocol";
        subheadline = `${consecutivePoorDays} consecutive days of compromised recovery. Systemic inflammation risk is elevated.`;
        narrative = `Your body has been unable to fully recover for ${consecutivePoorDays} days straight. This creates a compounding effect — each poor night amplifies the next day's cortisol response. CRP${crp ? ` at ${crp} mg/L` : ""} suggests your immune system is already responding to the accumulated stress. Today is a mandatory recovery day.`;
      } else {
        headline = "Biological Override — Recovery Priority";
        subheadline = "Multiple stress signals detected. Today's protocols have been restructured for damage control.";
        narrative = "Your biology is signaling that standard protocols would do more harm than good today. The OS has automatically pivoted to a recovery-first stack designed to stabilize your nervous system and reduce inflammatory load.";
      }
    } else if (severity === "alert") {
      if (sleepHours !== null && sleepHours < 6) {
        headline = "Sleep Debt Active — Protocols Adjusted";
        subheadline = `${sleepHours.toFixed(1)}h sleep detected. Intensity dialed back to protect recovery capacity.`;
        narrative = `With ${sleepHours.toFixed(1)} hours of sleep, your testosterone production dropped ~10-15% overnight, insulin sensitivity is impaired, and reaction time is degraded. The OS has swapped high-intensity training for Zone 2 movement and added targeted supplements to accelerate recovery.`;
      } else if (hrvDeviationPct !== null && hrvDeviationPct > 15) {
        headline = "HRV Below Baseline — Deload Activated";
        subheadline = `HRV ${hrvDeviationPct}% below your 7-day average. Nervous system needs recovery.`;
        narrative = `Your heart rate variability at ${hrvCurrent}ms is significantly below your baseline of ${hrvBaseline}ms. This indicates your parasympathetic nervous system is suppressed — likely from accumulated training load, stress, or poor sleep quality. High-intensity work has been replaced with restorative protocols.`;
      } else {
        headline = "Recovery Signals Detected — Protocol Shift";
        subheadline = "Your biology is requesting a lighter day. Protocols adjusted accordingly.";
        narrative = "Multiple biomarkers suggest your body needs more recovery time. The OS has automatically adjusted today's stack to prioritize restoration over performance.";
      }
    } else {
      headline = "Mild Recovery Signal — Minor Adjustments";
      subheadline = "Slight deviations detected. A few protocols have been fine-tuned.";
      narrative = "Your biology is mostly on track but showing minor stress signals. Small adjustments have been made to optimize your recovery trajectory.";
    }

    // ── 7. Select recovery commands ──
    const commands = selectCommands(hrvDeviationPct, sleepHours, sleepScore, crp, vitaminD, severity!);

    // ── 8. Determine suppressed protocols ──
    const suppressedProtocols: string[] = [];
    if (severity === "critical" || severity === "alert") {
      suppressedProtocols.push("HIIT Training", "Heavy Strength", "Fasted Cardio");
      if (severity === "critical") {
        suppressedProtocols.push("Cold Plunge", "Sauna Protocol", "Intermittent Fasting");
      }
    }

    // ── 9. Calculate confidence ──
    let confidence = 30; // base
    if (hrvCurrent !== null) confidence += 25;
    if (sleepScore !== null) confidence += 20;
    if (crp !== null) confidence += 15;
    if (consecutivePoorDays > 0) confidence += 10;
    confidence = Math.min(98, confidence);

    return {
      isActive: true,
      severity,
      color: styles.color,
      glowColor: styles.glowColor,
      bgGradient: styles.bgGradient,
      borderColor: styles.borderColor,
      headline,
      subheadline,
      narrative,
      signals,
      commands,
      suppressedProtocols,
      confidence,
      lastDataAt: latestHrv?.measuredAt ?? lastNightSleep?.loggedAt ?? now,
      metrics: {
        hrvCurrent, hrvBaseline, hrvDeviationPct,
        sleepHours, sleepScore, sleepDeepPct,
        crp, recoveryScore, consecutivePoorDays,
      },
    };
  },
});
