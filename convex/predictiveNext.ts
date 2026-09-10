import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE NEXT ENGINE — "What's Next" Intelligence
   
   Cross-references:
   • Current time of day (circadian window)
   • SomaticBodyMap tension state
   • Latest somatic feedback channels
   • Bio-Vault markers (cortisol proxy via CRP, HRV, sleep)
   • Protocol completion status today
   • Inventory availability
   • Drift events
   
   Returns a ranked list of 1-3 "What's Next" actions with
   precise dosing, timing rationale, and mechanism of action.
   ═══════════════════════════════════════════════════════════════ */

/* ── Circadian Windows ── */
type CircadianWindow = "early_morning" | "morning" | "midday" | "afternoon" | "evening" | "night";

function getCircadianWindow(hour: number): CircadianWindow {
  if (hour >= 5 && hour < 7) return "early_morning";
  if (hour >= 7 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

function getWindowLabel(w: CircadianWindow): string {
  const labels: Record<CircadianWindow, string> = {
    early_morning: "Early Morning",
    morning: "Morning",
    midday: "Midday",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
  };
  return labels[w];
}

/* ── Recommendation Type ── */
export interface PredictiveAction {
  id: string;
  title: string;
  subtitle: string;
  dose: string;
  mechanism: string;
  icon: string;
  accentColor: string;
  priority: "urgent" | "recommended" | "optimal";
  category: "supplement" | "intervention" | "peptide" | "lifestyle";
  circadianRationale: string;
  triggers: string[];
  confidence: number;
  isFutureBio: boolean;
}

/* ── Circadian Protocol Map — what's optimal at each time window ── */
interface CircadianProtocol {
  id: string;
  title: string;
  subtitle: string;
  dose: string;
  mechanism: string;
  icon: string;
  accentColor: string;
  category: "supplement" | "intervention" | "peptide" | "lifestyle";
  windows: CircadianWindow[];
  isFutureBio: boolean;
  /** Signal conditions that boost this recommendation */
  signalBoosts: Array<{
    signal: string;
    check: (ctx: SignalContext) => boolean;
    reason: string;
    priorityBoost: boolean;
  }>;
}

interface SignalContext {
  hrvCurrent: number;
  hrvAvg7d: number;
  hrvPctBelow: number;
  sleepScore: number;
  sleepHours: number;
  crp: number;
  maxTension: number;
  tensionRegions: string[];
  channels: Record<string, number>;
  adherenceRate: number;
  completedProtocols: string[];
  activeDriftCount: number;
  hasInventory: (name: string) => boolean;
  cortisol2pm: boolean; // proxy: CRP > 1.5 + afternoon window
  testosteroneTotal: number;
  vitaminD: number;
  ferritin: number;
  hba1c: number;
}

const CIRCADIAN_PROTOCOLS: CircadianProtocol[] = [
  // ── EARLY MORNING ──
  {
    id: "cn-sunlight",
    title: "Morning Sunlight Exposure",
    subtitle: "Circadian Anchor · Cortisol Pulse",
    dose: "10-20 min direct sunlight",
    mechanism: "Melanopsin activation → suprachiasmatic nucleus entrainment → healthy cortisol awakening response + melatonin timer set for 14-16h later",
    icon: "☀️",
    accentColor: "#F59E0B",
    category: "lifestyle",
    windows: ["early_morning", "morning"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "sleep_poor", check: (c) => c.sleepScore > 0 && c.sleepScore < 70, reason: "Poor sleep last night — morning light resets circadian phase for tonight's recovery", priorityBoost: true },
      { signal: "vitd_low", check: (c) => c.vitaminD > 0 && c.vitaminD < 40, reason: "Vitamin D suboptimal — UVB exposure initiates cholecalciferol synthesis", priorityBoost: false },
    ],
  },
  {
    id: "cn-cold-plunge",
    title: "Cold Exposure Protocol",
    subtitle: "Norepinephrine · Dopamine Surge",
    dose: "2-3 min · 50-59°F water",
    mechanism: "Cold shock → 200-300% norepinephrine increase + 250% dopamine elevation lasting 3-5h. Activates brown adipose tissue thermogenesis",
    icon: "🧊",
    accentColor: "#06B6D4",
    category: "intervention",
    windows: ["early_morning", "morning"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "hrv_low", check: (c) => c.hrvPctBelow > 10, reason: "HRV depressed — cold exposure activates vagal rebound for parasympathetic recovery", priorityBoost: true },
      { signal: "crp_high", check: (c) => c.crp > 1.5, reason: "Elevated inflammation — cold-induced norepinephrine suppresses NF-kB inflammatory cascade", priorityBoost: true },
      { signal: "neural_low", check: (c) => (c.channels["neural_drive"] ?? 60) < 40, reason: "Low neural drive — cold shock triggers catecholamine release for sustained alertness", priorityBoost: false },
    ],
  },
  // ── MORNING ──
  {
    id: "cn-creatine",
    title: "Creatine Monohydrate",
    subtitle: "Cognitive + Muscular ATP",
    dose: "5g · With water",
    mechanism: "Phosphocreatine replenishment — increases brain ATP by 5-15%, supports working memory and reduces mental fatigue. Muscle PCr stores for training",
    icon: "⚡",
    accentColor: "#8B5CF6",
    category: "supplement",
    windows: ["morning"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "energy_low", check: (c) => (c.channels["energy_flux"] ?? 60) < 45, reason: "Low energy flux — creatine directly replenishes cellular ATP stores", priorityBoost: true },
    ],
  },
  // ── MIDDAY ──
  {
    id: "cn-walk",
    title: "Post-Meal Walk",
    subtitle: "Glucose Disposal · GLUT4",
    dose: "15-20 min moderate pace",
    mechanism: "Skeletal muscle contraction activates GLUT4 transporters — reduces postprandial glucose spike by 30-40% without insulin. Supports metabolic flexibility",
    icon: "🚶",
    accentColor: "#10B981",
    category: "lifestyle",
    windows: ["midday"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "hba1c_high", check: (c) => c.hba1c > 5.4, reason: "HbA1c trending up — post-meal movement is the highest-leverage glucose intervention", priorityBoost: true },
      { signal: "low_adherence", check: (c) => c.adherenceRate < 0.5, reason: "Low protocol adherence — a simple walk is the lowest-friction re-entry point", priorityBoost: false },
    ],
  },
  // ── AFTERNOON ──
  {
    id: "cn-ltheanine-pm",
    title: "L-Theanine",
    subtitle: "Alpha Wave · Calm Focus",
    dose: "200mg",
    mechanism: "Crosses BBB → increases alpha brain wave activity. Modulates GABA, serotonin, and dopamine for calm alertness without sedation. Antagonizes caffeine jitter",
    icon: "🍵",
    accentColor: "#34D399",
    category: "supplement",
    windows: ["afternoon"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "cortisol_proxy", check: (c) => c.cortisol2pm, reason: "Afternoon cortisol likely elevated (CRP + time) — L-Theanine attenuates cortisol via GABAergic modulation", priorityBoost: true },
      { signal: "tension_high", check: (c) => c.maxTension >= 5, reason: "Somatic tension detected — L-Theanine reduces neuromuscular tension via alpha wave induction", priorityBoost: true },
    ],
  },
  // ── EVENING ──
  {
    id: "cn-mag-glycinate",
    title: "Magnesium Glycinate",
    subtitle: "GABA Activation · Sleep Prep",
    dose: "400mg",
    mechanism: "Glycinate chelate → high bioavailability Mg²⁺ that activates GABA-A receptors. Reduces cortisol, lowers core body temperature, and promotes melatonin synthesis",
    icon: "🧲",
    accentColor: "#818CF8",
    category: "supplement",
    windows: ["evening"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "sleep_poor", check: (c) => c.sleepScore > 0 && c.sleepScore < 65, reason: "Sleep architecture compromised — Mg activates parasympathetic nervous system for deeper slow-wave sleep", priorityBoost: true },
      { signal: "tension_high", check: (c) => c.maxTension >= 4, reason: "Residual tension from today — Mg glycinate relaxes skeletal muscle via calcium channel modulation", priorityBoost: true },
      { signal: "hrv_low", check: (c) => c.hrvPctBelow > 12, reason: "HRV below baseline — evening Mg restores vagal tone during sleep for next-day autonomic recovery", priorityBoost: false },
    ],
  },
  {
    id: "cn-apigenin",
    title: "Apigenin",
    subtitle: "CD38 Inhibitor · NAD+ Sparing",
    dose: "50mg",
    mechanism: "Flavonoid that inhibits CD38 enzyme (the primary NAD+ consumer), preserving cellular NAD+ levels. Also activates GABA-A for anxiolytic effect without next-day grogginess",
    icon: "🌼",
    accentColor: "#FBBF24",
    category: "supplement",
    windows: ["evening"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "sleep_poor", check: (c) => c.sleepScore > 0 && c.sleepScore < 60, reason: "Poor sleep — Apigenin's GABA-A activation promotes sleep onset without melatonin dependency", priorityBoost: true },
    ],
  },
  // ── NIGHT ──
  {
    id: "cn-ltheanine-night",
    title: "L-Theanine for REM Recovery",
    subtitle: "Optimal REM Architecture",
    dose: "200mg",
    mechanism: "Promotes alpha-to-theta wave transition — supports REM sleep density and dream consolidation. Reduces sleep-onset latency without suppressing REM like alcohol or THC",
    icon: "🌙",
    accentColor: "#6366F1",
    category: "supplement",
    windows: ["night"],
    isFutureBio: false,
    signalBoosts: [
      { signal: "cortisol_proxy", check: (c) => c.cortisol2pm, reason: "Elevated cortisol earlier today — L-Theanine ensures cortisol doesn't fragment tonight's REM cycles", priorityBoost: true },
      { signal: "crp_high", check: (c) => c.crp > 2.0, reason: "Systemic inflammation elevated — quality REM sleep is the body's primary anti-inflammatory recovery window", priorityBoost: false },
    ],
  },
  // ── FUTURE BIO: BPC-157 ──
  {
    id: "cn-bpc157",
    title: "BPC-157",
    subtitle: "Tissue Repair Peptide",
    dose: "250-500mcg · Subcutaneous",
    mechanism: "Gastric pentadecapeptide — upregulates VEGF for angiogenesis, accelerates tendon/ligament repair via FAK-paxillin pathway. Gut-brain axis modulation",
    icon: "🧬",
    accentColor: "#EC4899",
    category: "peptide",
    windows: ["morning", "evening"],
    isFutureBio: true,
    signalBoosts: [
      { signal: "tension_severe", check: (c) => c.maxTension >= 7, reason: "Severe musculoskeletal tension — BPC-157 accelerates soft tissue repair at injury sites", priorityBoost: true },
      { signal: "gut_low", check: (c) => (c.channels["gut_status"] ?? 60) < 35, reason: "Gut status declining — BPC-157 repairs intestinal lining and modulates gut-brain axis", priorityBoost: true },
      { signal: "crp_high", check: (c) => c.crp > 2.5, reason: "High CRP with tissue complaints — BPC-157 reduces inflammation via NO-mediated pathways", priorityBoost: false },
    ],
  },
  // ── FUTURE BIO: CJC-1295 ──
  {
    id: "cn-cjc1295",
    title: "CJC-1295 + Ipamorelin",
    subtitle: "GH Secretagogue Stack",
    dose: "100mcg CJC / 100mcg Ipa",
    mechanism: "GHRH analog + ghrelin mimetic — pulsatile GH release without cortisol/prolactin elevation. Enhances Stage 3/4 deep sleep architecture",
    icon: "💉",
    accentColor: "#F472B6",
    category: "peptide",
    windows: ["night"],
    isFutureBio: true,
    signalBoosts: [
      { signal: "sleep_poor", check: (c) => c.sleepScore > 0 && c.sleepScore < 55, reason: "Severely compromised sleep — CJC/Ipa enhances deep sleep via pulsatile GH during first sleep cycle", priorityBoost: true },
      { signal: "recovery_low", check: (c) => c.hrvPctBelow > 20, reason: "Chronic recovery deficit — GH secretagogue accelerates tissue repair and glycogen replenishment", priorityBoost: true },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN QUERY: getWhatsNext
   ═══════════════════════════════════════════════════════════════ */

export const getWhatsNext = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    actions: PredictiveAction[];
    circadianWindow: string;
    windowLabel: string;
    hour: number;
    contextLine: string;
    dataCompleteness: number;
    calculatedAt: number;
  }> => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const hour = new Date().getHours();
    const window = getCircadianWindow(hour);
    const windowLabel = getWindowLabel(window);

    try {
      /* ── Gather signals ── */

      // HRV
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", now - 7 * dayMs)
        )
        .collect();
      const latestHrv = hrvReadings.length > 0
        ? hrvReadings.sort((a, b) => b.measuredAt - a.measuredAt)[0].value : 0;
      const avgHrv7d = hrvReadings.length > 0
        ? hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length : 0;
      const hrvPctBelow = avgHrv7d > 0 ? Math.max(0, ((avgHrv7d - latestHrv) / avgHrv7d) * 100) : 0;

      // Sleep
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const latestSleep = sleepLogs
        .filter(s => now - s.loggedAt < 2 * dayMs)
        .sort((a, b) => b.loggedAt - a.loggedAt)[0];
      const sleepScore = latestSleep?.sleepScore ?? 0;
      const sleepHours = latestSleep?.totalHours ?? 0;

      // Somatic body map (24h)
      const bodyMapEntries = await ctx.db
        .query("bodyMapEntries")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - dayMs)
        )
        .collect();
      const maxTension = bodyMapEntries.length > 0
        ? Math.max(...bodyMapEntries.map(e => e.severity)) : 0;
      const tensionRegions = bodyMapEntries.filter(e => e.severity >= 5).map(e => e.region);

      // Somatic channels
      const somaticFeedback = await ctx.db
        .query("somaticFeedback")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - dayMs)
        )
        .collect();
      const channels: Record<string, number> = {};
      for (const fb of somaticFeedback.sort((a, b) => b.loggedAt - a.loggedAt)) {
        if (!(fb.channel in channels)) channels[fb.channel] = fb.value;
      }

      // Bio-Vault
      const bioVault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .first();

      // Protocol adherence today
      const dateKey = new Date().toISOString().slice(0, 10);
      const protocols = await ctx.db
        .query("protocols")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const activeProtocols = protocols.filter(p => p.isActive);
      const completions = await ctx.db
        .query("protocolCompletions")
        .withIndex("by_sessionId_and_dateKey", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("dateKey", dateKey)
        )
        .collect();
      const completedIds = new Set(completions.filter(c => c.completed).map(c => c.protocolItemId));
      const completedNames = activeProtocols
        .filter(p => completedIds.has(p._id))
        .map(p => p.name.toLowerCase());
      const adherenceRate = activeProtocols.length > 0
        ? completedIds.size / activeProtocols.length : 0;

      // Inventory
      const inventoryItems = await ctx.db
        .query("inventory")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const inventoryNames = new Set(inventoryItems.filter(i => i.status === "active" && i.currentQuantity > 0).map(i => i.name.toLowerCase()));

      // Drift events
      const activeDrifts = await ctx.db
        .query("driftEvents")
        .withIndex("by_sessionId_and_status", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("status", "active")
        )
        .collect();

      /* ── Build signal context ── */
      const cortisol2pm = (bioVault?.crp ?? 0) > 1.5 && (window === "afternoon" || window === "evening" || window === "night");

      const signalCtx: SignalContext = {
        hrvCurrent: latestHrv,
        hrvAvg7d: avgHrv7d,
        hrvPctBelow,
        sleepScore,
        sleepHours,
        crp: bioVault?.crp ?? 0,
        maxTension,
        tensionRegions,
        channels,
        adherenceRate,
        completedProtocols: completedNames,
        activeDriftCount: activeDrifts.length,
        hasInventory: (name: string) => {
          const lower = name.toLowerCase();
          for (const n of inventoryNames) {
            if (n.includes(lower) || lower.includes(n)) return true;
          }
          return false;
        },
        cortisol2pm,
        testosteroneTotal: bioVault?.testosteroneTotal ?? 0,
        vitaminD: bioVault?.vitaminD ?? 0,
        ferritin: bioVault?.ferritin ?? 0,
        hba1c: bioVault?.hba1c ?? 0,
      };

      /* ── Score each protocol for current window ── */
      const scored: Array<{
        protocol: CircadianProtocol;
        score: number;
        matchedTriggers: string[];
        hasPriorityBoost: boolean;
      }> = [];

      for (const proto of CIRCADIAN_PROTOCOLS) {
        // Must match current circadian window
        if (!proto.windows.includes(window)) continue;

        // Skip if already completed today (fuzzy match)
        const alreadyDone = completedNames.some(n =>
          n.includes(proto.title.toLowerCase().split(" ")[0]) ||
          proto.title.toLowerCase().includes(n.split(" ")[0])
        );
        if (alreadyDone) continue;

        let score = 10; // base score for being in the right window
        const matchedTriggers: string[] = [];
        let hasPriorityBoost = false;

        for (const boost of proto.signalBoosts) {
          try {
            if (boost.check(signalCtx)) {
              score += boost.priorityBoost ? 30 : 15;
              matchedTriggers.push(boost.reason);
              if (boost.priorityBoost) hasPriorityBoost = true;
            }
          } catch {
            // Skip failed checks
          }
        }

        // Future Bio compounds need ≥2 signal matches
        if (proto.isFutureBio && matchedTriggers.length < 2) continue;

        // Boost score if we have the supplement in inventory
        if (proto.category === "supplement" && signalCtx.hasInventory(proto.title.split(" ")[0])) {
          score += 5;
        }

        scored.push({ protocol: proto, score, matchedTriggers, hasPriorityBoost });
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      /* ── Build actions (top 3) ── */
      const actions: PredictiveAction[] = scored.slice(0, 3).map((s, i) => {
        const p = s.protocol;
        const priority: "urgent" | "recommended" | "optimal" =
          s.hasPriorityBoost ? "urgent" : s.score >= 30 ? "recommended" : "optimal";

        // Build circadian rationale
        let circadianRationale = "";
        if (window === "early_morning" || window === "morning") {
          circadianRationale = `It's ${hour}:00 — your cortisol awakening response peaks within 30-60min of waking. ${p.title} aligns with this window for maximum biological impact.`;
        } else if (window === "midday") {
          circadianRationale = `It's ${hour}:00 — postprandial window. ${p.title} leverages the post-meal metabolic state for optimal absorption and glucose management.`;
        } else if (window === "afternoon") {
          circadianRationale = `It's ${hour}:00 — afternoon cortisol should be declining. ${s.matchedTriggers.length > 0 ? s.matchedTriggers[0].split(" — ")[0] + "." : p.title + " supports the natural cortisol downslope."}`;
        } else if (window === "evening") {
          circadianRationale = `It's ${hour}:00 — melatonin synthesis begins in ~2h. ${p.title} prepares your nervous system for optimal sleep architecture tonight.`;
        } else {
          circadianRationale = `It's ${hour}:00 — deep sleep window approaching. ${p.title} maximizes recovery during the first 90-min sleep cycle.`;
        }

        // If we have specific signal data, make it personal
        if (s.matchedTriggers.length > 0 && cortisol2pm && p.id.includes("theanine")) {
          circadianRationale = `It's ${hour}:00. Based on elevated inflammatory markers logged earlier, we recommend ${p.dose} ${p.title} for optimal REM sleep recovery.`;
        }

        return {
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          dose: p.dose,
          mechanism: p.mechanism,
          icon: p.icon,
          accentColor: p.accentColor,
          priority,
          category: p.category,
          circadianRationale,
          triggers: s.matchedTriggers.length > 0
            ? s.matchedTriggers.map(t => t.split(" — ")[0])
            : [`${windowLabel} circadian window`],
          confidence: Math.min(95, 50 + s.matchedTriggers.length * 15 + (s.hasPriorityBoost ? 10 : 0)),
          isFutureBio: p.isFutureBio,
        };
      });

      /* ── Data completeness ── */
      let dp = 0;
      if (hrvReadings.length > 0) dp++;
      if (latestSleep) dp++;
      if (bodyMapEntries.length > 0) dp++;
      if (somaticFeedback.length > 0) dp++;
      if (bioVault) dp++;
      if (activeProtocols.length > 0) dp++;
      if (inventoryItems.length > 0) dp++;
      const dataCompleteness = Math.round((dp / 7) * 100);

      /* ── Context line ── */
      const contextParts: string[] = [];
      if (sleepScore > 0) contextParts.push(`Sleep ${sleepScore}/100`);
      if (latestHrv > 0) contextParts.push(`HRV ${Math.round(latestHrv)}ms`);
      if (maxTension >= 4) contextParts.push(`Tension ${tensionRegions[0] || "active"}`);
      if (adherenceRate > 0) contextParts.push(`${Math.round(adherenceRate * 100)}% adherence`);
      const contextLine = contextParts.length > 0
        ? contextParts.join(" · ")
        : "Add bio-data to unlock precision recommendations";

      return {
        actions,
        circadianWindow: window,
        windowLabel,
        hour,
        contextLine,
        dataCompleteness,
        calculatedAt: now,
      };
    } catch {
      return {
        actions: [],
        circadianWindow: window,
        windowLabel,
        hour,
        contextLine: "Predictive engine initializing…",
        dataCompleteness: 0,
        calculatedAt: now,
      };
    }
  },
});
