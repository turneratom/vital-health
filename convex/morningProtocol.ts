import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   MORNING PROTOCOL ENGINE
   
   Connects sleep data + HRV readings to generate a dynamic
   "Morning Protocol" that pivots based on the user's internal
   biology. If HRV is low or sleep was poor, the dashboard
   automatically swaps high-intensity recommendations for
   restorative alternatives.
   
   The dashboard should NEVER look the same every day — it
   reflects the user's biological state each morning.
   ═══════════════════════════════════════════════════════════════ */

export type BioState =
  | "high_inflammation"
  | "sleep_deprived"
  | "overreached"
  | "primed"
  | "optimal";

export interface MorningProtocolItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  duration?: string;
  dosage?: string;
  priority: "critical" | "recommended" | "optional";
  replacedOriginal?: string;
  pivotReason?: string;
}

export interface MorningProtocolResult {
  bioState: BioState;
  bioStateLabel: string;
  bioStateDescription: string;
  bioStateColor: string;
  bioStateIcon: string;
  confidence: number;

  // Underlying data
  lastNightSleep: {
    score: number | null;
    hours: number | null;
    deepPct: number | null;
    remPct: number | null;
    efficiency: number | null;
    quality: "excellent" | "good" | "fair" | "poor" | "unknown";
  };
  currentHrv: {
    value: number | null;
    avg7d: number | null;
    trend: "rising" | "stable" | "declining" | "unknown";
    deviationPct: number | null;
  };
  inflammationScore: number; // 0-100, higher = more inflamed

  // Dynamic protocol
  protocols: MorningProtocolItem[];
  pivotedCount: number;
  originalCount: number;

  // Headline for the dashboard
  headline: string;
  subheadline: string;
  generatedAt: number;
}

/** Determine sleep quality tier */
function sleepQuality(score: number | null, hours: number | null): "excellent" | "good" | "fair" | "poor" | "unknown" {
  if (score === null && hours === null) return "unknown";
  if (score !== null) {
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 50) return "fair";
    return "poor";
  }
  if (hours !== null) {
    if (hours >= 7.5) return "excellent";
    if (hours >= 6.5) return "good";
    if (hours >= 5.5) return "fair";
    return "poor";
  }
  return "unknown";
}

/** Calculate inflammation score from HRV + sleep signals */
function calcInflammationScore(
  hrvValue: number | null,
  hrvAvg7d: number | null,
  sleepScore: number | null,
  sleepHours: number | null,
  deepPct: number | null,
  crp: number | null
): number {
  let score = 0;
  let factors = 0;

  // HRV deviation (biggest signal)
  if (hrvValue !== null && hrvAvg7d !== null && hrvAvg7d > 0) {
    const deviation = ((hrvAvg7d - hrvValue) / hrvAvg7d) * 100;
    if (deviation > 0) {
      score += Math.min(deviation * 2, 40); // max 40 points from HRV
    }
    factors++;
  }

  // Sleep score
  if (sleepScore !== null) {
    const sleepDeficit = Math.max(0, 80 - sleepScore);
    score += Math.min(sleepDeficit * 0.8, 30); // max 30 points from sleep score
    factors++;
  }

  // Sleep hours
  if (sleepHours !== null) {
    const hourDeficit = Math.max(0, 7 - sleepHours);
    score += Math.min(hourDeficit * 8, 20); // max 20 points from sleep hours
    factors++;
  }

  // Deep sleep percentage
  if (deepPct !== null) {
    const deepDeficit = Math.max(0, 20 - deepPct);
    score += Math.min(deepDeficit * 0.5, 10); // max 10 points
    factors++;
  }

  // CRP (direct inflammation marker)
  if (crp !== null) {
    if (crp > 3) score += 25;
    else if (crp > 1) score += 12;
    factors++;
  }

  return factors > 0 ? Math.min(Math.round(score), 100) : 0;
}

/** Determine bio state from inflammation score + sleep + HRV */
function determineBioState(
  inflammationScore: number,
  sleepQual: string,
  hrvDeviation: number | null,
  consecutivePoorDays: number
): BioState {
  // Critical: high inflammation + poor sleep + HRV crash
  if (inflammationScore >= 65 || (inflammationScore >= 45 && consecutivePoorDays >= 3)) {
    return "high_inflammation";
  }
  // Sleep deprived: poor sleep but HRV still okay
  if (sleepQual === "poor" || (sleepQual === "fair" && consecutivePoorDays >= 2)) {
    return "sleep_deprived";
  }
  // Overreached: HRV significantly below baseline
  if (hrvDeviation !== null && hrvDeviation > 15) {
    return "overreached";
  }
  // Primed: good sleep, HRV above average
  if ((sleepQual === "excellent" || sleepQual === "good") && (hrvDeviation === null || hrvDeviation <= 0)) {
    return "primed";
  }
  // Optimal: everything is green
  if (inflammationScore < 15 && (sleepQual === "excellent" || sleepQual === "good")) {
    return "optimal";
  }
  return "primed";
}

const BIO_STATE_CONFIG: Record<BioState, {
  label: string; description: string; color: string; icon: string;
}> = {
  high_inflammation: {
    label: "HIGH INFLAMMATION DETECTED",
    description: "Your body is signaling elevated systemic stress. Today's protocols have been pivoted to prioritize recovery and anti-inflammatory interventions.",
    color: "#FF6B6B",
    icon: "🔴",
  },
  sleep_deprived: {
    label: "SLEEP DEBT ACTIVE",
    description: "Last night's sleep was below recovery threshold. Intensity has been dialed back — focus on parasympathetic activation and early bedtime tonight.",
    color: "#AF82FF",
    icon: "😴",
  },
  overreached: {
    label: "OVERREACH WARNING",
    description: "HRV is significantly below your 7-day baseline. Your nervous system needs deload. High-intensity training has been swapped for restorative movement.",
    color: "#E8976C",
    icon: "⚡",
  },
  primed: {
    label: "PRIMED & READY",
    description: "Sleep and HRV are within optimal range. You're cleared for full-intensity protocols today. Push hard — your biology supports it.",
    color: "#3B82F6",
    icon: "🔵",
  },
  optimal: {
    label: "PEAK STATE",
    description: "All biological signals are green. Sleep was excellent, HRV is above baseline. Today is a day to chase PRs and maximize output.",
    color: "#00FFCC",
    icon: "🟢",
  },
};

/** Generate pivoted protocols based on bio state */
function generatePivotedProtocols(
  bioState: BioState,
  inflammationScore: number,
  sleepHours: number | null,
  hrvValue: number | null,
  hrvAvg: number | null
): MorningProtocolItem[] {
  const protocols: MorningProtocolItem[] = [];

  if (bioState === "high_inflammation") {
    protocols.push(
      {
        id: "mp-zone2",
        name: "Zone 2 Cardio Only",
        icon: "🚶",
        description: "20 min at conversational pace (120-135 BPM). No high-intensity today — elevated inflammation increases injury risk and delays recovery.",
        category: "training",
        duration: "20 min",
        priority: "critical",
        replacedOriginal: "High Intensity Workout",
        pivotReason: `Inflammation score ${inflammationScore}/100. Switching to Zone 2 preserves cardiovascular benefit without cortisol spike.`,
      },
      {
        id: "mp-cold-plunge",
        name: "Cold Plunge — Extended",
        icon: "❄️",
        description: "5 min cold immersion at 50-55°F. Cold exposure activates anti-inflammatory pathways (NF-κB suppression) and boosts norepinephrine 2-3x.",
        category: "biohacking",
        duration: "5 min",
        priority: "critical",
        pivotReason: "Cold exposure is the fastest non-pharmacological anti-inflammatory intervention available.",
      },
      {
        id: "mp-breathwork",
        name: "Restorative Breathwork",
        icon: "🌬️",
        description: "10 min box breathing (4-4-4-4 pattern). Activates vagal tone and shifts autonomic balance toward parasympathetic recovery.",
        category: "recovery",
        duration: "10 min",
        priority: "critical",
        pivotReason: `HRV at ${hrvValue ?? '—'}ms vs ${hrvAvg ?? '—'}ms avg. Breathwork can improve HRV by 8-15% within 24 hours.`,
      },
      {
        id: "mp-curcumin",
        name: "Curcumin + Omega-3 Stack",
        icon: "🟡",
        description: "1000mg Curcumin with piperine + 3g Omega-3 (EPA/DHA). Dual NF-κB inhibition and SPM (Specialized Pro-resolving Mediator) activation.",
        category: "supplement",
        dosage: "1000mg + 3g",
        priority: "critical",
        pivotReason: "Curcumin + Omega-3 synergy reduces CRP by up to 30% over 48 hours.",
      },
      {
        id: "mp-magnesium-boost",
        name: "Magnesium Glycinate — Double Dose",
        icon: "🌙",
        description: "600mg tonight (up from 400mg). Magnesium is a natural muscle relaxant and NMDA receptor modulator that improves deep sleep architecture.",
        category: "supplement",
        dosage: "600mg",
        priority: "recommended",
        replacedOriginal: "Magnesium 400mg",
        pivotReason: "Elevated inflammation depletes magnesium faster. Increasing dose supports recovery and sleep quality.",
      },
      {
        id: "mp-sauna",
        name: "Infrared Sauna — Heat Shock Proteins",
        icon: "🔥",
        description: "25 min at 150-170°F. Heat shock proteins (HSP70/HSP90) activate cellular repair and reduce inflammatory cytokines IL-6 and TNF-α.",
        category: "biohacking",
        duration: "25 min",
        priority: "recommended",
        pivotReason: "Sauna + cold plunge contrast therapy amplifies anti-inflammatory response by 40%.",
      },
      {
        id: "mp-early-bed",
        name: "Lights Out by 9:30 PM",
        icon: "🛏️",
        description: "Move bedtime 1 hour earlier. Extra sleep is the single most powerful recovery tool — each additional hour of sleep reduces CRP by 8%.",
        category: "recovery",
        priority: "recommended",
        replacedOriginal: "Sleep by 10:30 PM",
        pivotReason: "Sleep debt compounds inflammation. Earlier bedtime tonight breaks the cycle.",
      }
    );
  } else if (bioState === "sleep_deprived") {
    protocols.push(
      {
        id: "mp-gentle-movement",
        name: "Gentle Movement Only",
        icon: "🧘",
        description: "20 min yoga flow or walking. Sleep deprivation impairs motor control and reaction time — skip heavy lifts today.",
        category: "training",
        duration: "20 min",
        priority: "critical",
        replacedOriginal: "Resistance Training",
        pivotReason: `Only ${sleepHours ?? '—'}h sleep. Reaction time drops 30% below 6h — heavy training is counterproductive.`,
      },
      {
        id: "mp-sunlight",
        name: "Morning Sunlight — Extended",
        icon: "☀️",
        description: "15 min outdoor light within 30 min of waking. Resets circadian rhythm and suppresses residual melatonin for better alertness.",
        category: "biohacking",
        duration: "15 min",
        priority: "critical",
        pivotReason: "Extended sunlight exposure after poor sleep accelerates circadian realignment by 2-3 hours.",
      },
      {
        id: "mp-caffeine-delay",
        name: "Delay Caffeine 90 Minutes",
        icon: "☕",
        description: "Wait 90 min after waking before coffee. Allows adenosine to clear naturally — prevents afternoon crash and protects tonight's sleep.",
        category: "nutrition",
        priority: "critical",
        pivotReason: "Early caffeine after poor sleep creates a vicious cycle. Delaying preserves sleep architecture tonight.",
      },
      {
        id: "mp-nap",
        name: "Power Nap Window",
        icon: "💤",
        description: "20 min nap between 1-3 PM. NASA research shows a 26-min nap improves performance by 34% and alertness by 54%.",
        category: "recovery",
        duration: "20 min",
        priority: "recommended",
        pivotReason: "Strategic napping compensates for sleep debt without disrupting tonight's sleep onset.",
      },
      {
        id: "mp-glycine",
        name: "Glycine Before Bed",
        icon: "💊",
        description: "3g glycine 30 min before sleep. Lowers core body temperature and improves sleep onset latency by 15-20 minutes.",
        category: "supplement",
        dosage: "3g",
        priority: "recommended",
        pivotReason: "Glycine + Magnesium stack is the most evidence-backed sleep recovery combination.",
      }
    );
  } else if (bioState === "overreached") {
    protocols.push(
      {
        id: "mp-deload",
        name: "Active Recovery — Deload Day",
        icon: "🚶",
        description: "30 min walk + 15 min mobility work. Your nervous system is overreached — today is about restoration, not stimulation.",
        category: "training",
        duration: "45 min",
        priority: "critical",
        replacedOriginal: "Resistance Training",
        pivotReason: `HRV ${hrvValue ?? '—'}ms is ${Math.round(((hrvAvg ?? 50) - (hrvValue ?? 40)) / (hrvAvg ?? 50) * 100)}% below baseline. CNS needs 24-48h recovery.`,
      },
      {
        id: "mp-cold-brief",
        name: "Cold Plunge — Short Burst",
        icon: "❄️",
        description: "3 min cold immersion. Brief cold exposure boosts norepinephrine without adding CNS stress.",
        category: "biohacking",
        duration: "3 min",
        priority: "recommended",
      },
      {
        id: "mp-ashwagandha",
        name: "Ashwagandha KSM-66",
        icon: "🌿",
        description: "600mg with breakfast. Adaptogenic herb that reduces cortisol by 28% and supports HRV recovery.",
        category: "supplement",
        dosage: "600mg",
        priority: "recommended",
        pivotReason: "Ashwagandha is the most studied adaptogen for HRV recovery and cortisol modulation.",
      },
      {
        id: "mp-zone2-light",
        name: "Zone 2 — Light Cardio",
        icon: "🏃",
        description: "20 min at 60-65% max HR. Promotes blood flow and nutrient delivery without sympathetic activation.",
        category: "training",
        duration: "20 min",
        priority: "recommended",
        pivotReason: "Light Zone 2 accelerates parasympathetic recovery while maintaining aerobic base.",
      }
    );
  } else if (bioState === "primed") {
    protocols.push(
      {
        id: "mp-full-training",
        name: "Full Intensity Training",
        icon: "🏋️",
        description: "45 min compound lifts — progressive overload. Your biology supports high output today. Push for PRs.",
        category: "training",
        duration: "45 min",
        priority: "critical",
      },
      {
        id: "mp-cold-standard",
        name: "Cold Plunge",
        icon: "❄️",
        description: "3-5 min cold immersion at 50-55°F. Standard protocol — maintain hormetic stress adaptation.",
        category: "biohacking",
        duration: "3-5 min",
        priority: "recommended",
      },
      {
        id: "mp-standard-supps",
        name: "Standard Supplement Stack",
        icon: "💊",
        description: "D3+K2, Omega-3, Creatine with breakfast. Baseline longevity stack — no adjustments needed.",
        category: "supplement",
        priority: "recommended",
      },
      {
        id: "mp-zone2-afternoon",
        name: "Zone 2 Cardio",
        icon: "🏃",
        description: "30 min at conversational pace. Maintain aerobic base alongside strength training.",
        category: "training",
        duration: "30 min",
        priority: "optional",
      }
    );
  } else {
    // Optimal
    protocols.push(
      {
        id: "mp-peak-training",
        name: "Peak Performance Training",
        icon: "⚡",
        description: "50 min high-intensity compound lifts + finisher. All signals green — maximize today's training stimulus.",
        category: "training",
        duration: "50 min",
        priority: "critical",
      },
      {
        id: "mp-hiit",
        name: "HIIT Finisher",
        icon: "🔥",
        description: "10 min Tabata-style intervals. Peak HRV + excellent sleep = your body can handle maximum intensity.",
        category: "training",
        duration: "10 min",
        priority: "recommended",
      },
      {
        id: "mp-cold-extended",
        name: "Cold Plunge — Extended Protocol",
        icon: "❄️",
        description: "5 min cold immersion. On peak days, extend cold exposure for maximum norepinephrine and brown fat activation.",
        category: "biohacking",
        duration: "5 min",
        priority: "recommended",
      },
      {
        id: "mp-peak-supps",
        name: "Performance Stack",
        icon: "💊",
        description: "D3+K2, Omega-3, Creatine + 200mg Caffeine pre-workout. Full performance stack cleared for peak days.",
        category: "supplement",
        priority: "recommended",
      }
    );
  }

  return protocols;
}

/** Generate headline based on bio state */
function generateHeadline(bioState: BioState, inflammationScore: number, sleepHours: number | null, hrvValue: number | null): { headline: string; subheadline: string } {
  switch (bioState) {
    case "high_inflammation":
      return {
        headline: `High-Inflammation Detected — Protocols Pivoted`,
        subheadline: `Inflammation score ${inflammationScore}/100. Your standard workout has been replaced with Zone 2 + Cold Plunge. ${hrvValue ? `HRV at ${hrvValue}ms.` : ""} Recovery is the priority today.`,
      };
    case "sleep_deprived":
      return {
        headline: `Sleep Debt Active — Intensity Reduced`,
        subheadline: `Only ${sleepHours?.toFixed(1) ?? "—"}h sleep last night. Heavy training swapped for gentle movement. Caffeine delayed 90 min. Focus on circadian reset.`,
      };
    case "overreached":
      return {
        headline: `Nervous System Overreached — Deload Day`,
        subheadline: `HRV ${hrvValue ?? "—"}ms is significantly below your baseline. Today is active recovery only. Your body needs 24-48h to restore autonomic balance.`,
      };
    case "primed":
      return {
        headline: `Primed & Ready — Full Protocols Active`,
        subheadline: `Sleep and HRV are within optimal range. You're cleared for full-intensity training today. Standard supplement stack is go.`,
      };
    case "optimal":
      return {
        headline: `Peak State — All Systems Green`,
        subheadline: `Excellent sleep + above-baseline HRV. Today is a peak performance day. Push hard — your biology fully supports it.`,
      };
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN QUERY — getMorningProtocol
   
   Called by the dashboard on load. Analyzes last night's sleep
   and latest HRV to generate a dynamic protocol set.
   ══════════════════════════════════════════════════════════════ */

export const getMorningProtocol = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<MorningProtocolResult> => {
    const now = Date.now();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;

    // ── 1. Get last night's sleep ──
    const sleepLogs = await ctx.db
      .query("sleepLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Try today's date first (sleep logged this morning), then yesterday
    let lastSleep = sleepLogs.find((s) => s.date === todayKey)
      ?? sleepLogs.find((s) => s.date === yesterdayKey)
      ?? sleepLogs.sort((a, b) => b.loggedAt - a.loggedAt)[0]
      ?? null;

    const sleepScore = lastSleep?.sleepScore ?? null;
    const sleepHours = lastSleep?.totalHours ?? null;
    const deepPct = lastSleep ? (lastSleep.deepHours / Math.max(0.1, lastSleep.totalHours)) * 100 : null;
    const remPct = lastSleep ? (lastSleep.remHours / Math.max(0.1, lastSleep.totalHours)) * 100 : null;
    const sleepEfficiency = lastSleep?.efficiency ?? null;
    const sleepQual = sleepQuality(sleepScore, sleepHours);

    // ── 2. Get latest HRV + 7-day average ──
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const hrvReadings = await ctx.db
      .query("hrvReadings")
      .withIndex("by_sessionId_and_measuredAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("measuredAt", cutoff7d)
      )
      .collect();

    const hrvSorted = hrvReadings.sort((a, b) => b.measuredAt - a.measuredAt);
    const latestHrv = hrvSorted[0]?.value ?? null;
    const hrvAvg7d = hrvSorted.length > 1
      ? Math.round(hrvSorted.slice(1).reduce((s, r) => s + r.value, 0) / (hrvSorted.length - 1))
      : hrvSorted.length === 1 ? hrvSorted[0].value : null;

    // HRV deviation percentage
    const hrvDeviation = (latestHrv !== null && hrvAvg7d !== null && hrvAvg7d > 0)
      ? Math.round(((hrvAvg7d - latestHrv) / hrvAvg7d) * 100 * 10) / 10
      : null;

    // HRV trend (are readings declining over 3+ days?)
    let hrvTrend: "rising" | "stable" | "declining" | "unknown" = "unknown";
    if (hrvSorted.length >= 3) {
      const recent3 = hrvSorted.slice(0, 3);
      const isDecline = recent3[0].value < recent3[1].value && recent3[1].value < recent3[2].value;
      const isRise = recent3[0].value > recent3[1].value && recent3[1].value > recent3[2].value;
      hrvTrend = isDecline ? "declining" : isRise ? "rising" : "stable";
    }

    // Fallback: check eliteScores for HRV if no direct readings
    if (latestHrv === null) {
      const eliteScores = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentScores = eliteScores
        .filter((s) => s.calculatedAt >= cutoff7d)
        .sort((a, b) => b.calculatedAt - a.calculatedAt);
      if (recentScores.length > 0) {
        const fallbackHrv = recentScores[0].currentHrv;
        const fallbackAvg = recentScores.length > 1
          ? Math.round(recentScores.slice(1).reduce((s, r) => s + r.currentHrv, 0) / (recentScores.length - 1))
          : fallbackHrv;
        // Use fallback values
        return buildResult(
          fallbackHrv, fallbackAvg,
          sleepScore, sleepHours, deepPct, remPct, sleepEfficiency, sleepQual,
          hrvTrend, args.sessionId, ctx, now
        );
      }
    }

    // ── 3. Get CRP from bioVault ──
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const crp = vault?.crp ?? null;

    // ── 4. Count consecutive poor sleep days ──
    const recentSleep = sleepLogs
      .sort((a, b) => b.loggedAt - a.loggedAt)
      .slice(0, 7);
    let consecutivePoorDays = 0;
    for (const s of recentSleep) {
      if (s.sleepScore < 60 || s.totalHours < 6) {
        consecutivePoorDays++;
      } else {
        break;
      }
    }

    // ── 5. Calculate inflammation score ──
    const inflammationScore = calcInflammationScore(
      latestHrv, hrvAvg7d, sleepScore, sleepHours, deepPct, crp
    );

    // ── 6. Determine bio state ──
    const bioState = determineBioState(
      inflammationScore, sleepQual, hrvDeviation, consecutivePoorDays
    );

    const config = BIO_STATE_CONFIG[bioState];
    const { headline, subheadline } = generateHeadline(bioState, inflammationScore, sleepHours, latestHrv);

    // ── 7. Generate pivoted protocols ──
    const protocols = generatePivotedProtocols(bioState, inflammationScore, sleepHours, latestHrv, hrvAvg7d);
    const pivotedCount = protocols.filter((p) => p.replacedOriginal).length;

    // ── 8. Calculate confidence ──
    let confidence = 30; // base
    if (lastSleep) confidence += 25;
    if (latestHrv !== null) confidence += 25;
    if (hrvAvg7d !== null && hrvSorted.length >= 3) confidence += 10;
    if (crp !== null) confidence += 10;

    return {
      bioState,
      bioStateLabel: config.label,
      bioStateDescription: config.description,
      bioStateColor: config.color,
      bioStateIcon: config.icon,
      confidence: Math.min(confidence, 100),

      lastNightSleep: {
        score: sleepScore,
        hours: sleepHours,
        deepPct: deepPct !== null ? Math.round(deepPct * 10) / 10 : null,
        remPct: remPct !== null ? Math.round(remPct * 10) / 10 : null,
        efficiency: sleepEfficiency,
        quality: sleepQual,
      },
      currentHrv: {
        value: latestHrv,
        avg7d: hrvAvg7d,
        trend: hrvTrend,
        deviationPct: hrvDeviation,
      },
      inflammationScore,

      protocols,
      pivotedCount,
      originalCount: protocols.length,

      headline,
      subheadline,
      generatedAt: now,
    };
  },
});

/** Helper for fallback HRV path */
async function buildResult(
  hrvValue: number, hrvAvg: number,
  sleepScore: number | null, sleepHours: number | null,
  deepPct: number | null, remPct: number | null,
  sleepEfficiency: number | null, sleepQual: string,
  hrvTrend: string, sessionId: string, ctx: any, now: number
): Promise<MorningProtocolResult> {
  const hrvDeviation = hrvAvg > 0 ? Math.round(((hrvAvg - hrvValue) / hrvAvg) * 100 * 10) / 10 : null;
  const vault = await ctx.db.query("bioVault").withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId)).first();
  const crp = vault?.crp ?? null;

  const sleepLogs = await ctx.db.query("sleepLogs").withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId)).collect();
  const recentSleep = sleepLogs.sort((a: any, b: any) => b.loggedAt - a.loggedAt).slice(0, 7);
  let consecutivePoorDays = 0;
  for (const s of recentSleep) {
    if (s.sleepScore < 60 || s.totalHours < 6) consecutivePoorDays++;
    else break;
  }

  const inflammationScore = calcInflammationScore(hrvValue, hrvAvg, sleepScore, sleepHours, deepPct, crp);
  const bioState = determineBioState(inflammationScore, sleepQual, hrvDeviation, consecutivePoorDays);
  const config = BIO_STATE_CONFIG[bioState];
  const { headline, subheadline } = generateHeadline(bioState, inflammationScore, sleepHours, hrvValue);
  const protocols = generatePivotedProtocols(bioState, inflammationScore, sleepHours, hrvValue, hrvAvg);
  const pivotedCount = protocols.filter((p) => p.replacedOriginal).length;

  return {
    bioState, bioStateLabel: config.label, bioStateDescription: config.description,
    bioStateColor: config.color, bioStateIcon: config.icon, confidence: 65,
    lastNightSleep: {
      score: sleepScore, hours: sleepHours,
      deepPct: deepPct !== null ? Math.round(deepPct * 10) / 10 : null,
      remPct: remPct !== null ? Math.round(remPct * 10) / 10 : null,
      efficiency: sleepEfficiency, quality: sleepQual as any,
    },
    currentHrv: { value: hrvValue, avg7d: hrvAvg, trend: hrvTrend as any, deviationPct: hrvDeviation },
    inflammationScore, protocols, pivotedCount, originalCount: protocols.length,
    headline, subheadline, generatedAt: now,
  };
}
