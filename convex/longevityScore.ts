import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   LONGEVITY SCORE ENGINE — Central Intelligence Hub
   
   Cross-references ALL bio-subsystems to produce:
   1. A composite LongevityScore (0-100)
   2. A "Daily Prescription" — ranked list of actions
   3. Trend-based recommendations (Low HRV + High Tension = Mg)
   4. Future Bio flags for advanced compounds (BPC-157, CJC-1295)
   
   Data Sources:
   • SomaticBodyMap → tension regions + severity
   • HRV Readings → autonomic nervous system state
   • Sleep Logs → recovery architecture
   • Inventory → supplement coverage gaps
   • Protocol Drift → sustained deviations
   • Bio-Vault → blood markers + genetic toggles
   • Elite Score → protocol adherence
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ── */

export type PrescriptionPriority = "critical" | "high" | "moderate" | "maintenance";

export interface PrescriptionItem {
  id: string;
  title: string;
  subtitle: string;
  dose: string;
  reason: string;
  icon: string;
  priority: PrescriptionPriority;
  category: "supplement" | "intervention" | "peptide" | "lifestyle" | "order";
  timing: string;
  /** Cross-system signals that triggered this recommendation */
  triggers: string[];
  /** If true, this is a Future Bio compound (peptide/advanced) */
  isFutureBio: boolean;
  /** Confidence score 0-100 based on data completeness */
  confidence: number;
}

export interface LongevityScoreResult {
  /** Composite score 0-100 */
  score: number;
  /** Score breakdown by subsystem */
  breakdown: {
    autonomic: number;    // HRV + RHR (0-25)
    recovery: number;     // Sleep + strain (0-25)
    adherence: number;    // Protocol completion (0-25)
    integrity: number;    // Inventory + drift stability (0-25)
  };
  /** Trend direction */
  trend: "improving" | "stable" | "declining";
  /** Daily Prescription — ranked action list */
  prescription: PrescriptionItem[];
  /** Top 3 priority items for the HUD */
  topPrescription: PrescriptionItem[];
  /** Summary line for the HUD */
  summaryLine: string;
  /** Data completeness 0-100 */
  dataCompleteness: number;
  /** Timestamp */
  calculatedAt: number;
}

/* ── Future Bio Compound Library ── */

interface FutureBioCompound {
  id: string;
  name: string;
  category: string;
  icon: string;
  dose: string;
  timing: string;
  mechanism: string;
  /** Biomarker/signal triggers */
  triggers: Array<{
    signal: string;
    condition: (value: number, baseline: number) => boolean;
    reason: string;
  }>;
}

const FUTURE_BIO_COMPOUNDS: FutureBioCompound[] = [
  {
    id: "bpc-157",
    name: "BPC-157",
    category: "Tissue Repair Peptide",
    icon: "🧬",
    dose: "250-500mcg",
    timing: "2× daily · Subcutaneous",
    mechanism: "Gastric pentadecapeptide — upregulates VEGF for angiogenesis, accelerates tendon/ligament repair via FAK-paxillin pathway",
    triggers: [
      {
        signal: "somatic_tension",
        condition: (severity: number) => severity >= 6,
        reason: "High somatic tension detected — BPC-157 accelerates soft tissue repair and reduces inflammatory signaling at injury sites",
      },
      {
        signal: "gut_status",
        condition: (value: number) => value < 40,
        reason: "Gut status declining — BPC-157 is a gastric peptide that repairs intestinal lining and modulates gut-brain axis signaling",
      },
      {
        signal: "crp",
        condition: (value: number) => value > 2.0,
        reason: "Elevated CRP with tissue complaints — BPC-157 reduces systemic inflammation via NO-mediated pathways",
      },
    ],
  },
  {
    id: "cjc-1295",
    name: "CJC-1295 + Ipamorelin",
    category: "Growth Hormone Secretagogue",
    icon: "💉",
    dose: "100mcg CJC / 100mcg Ipa",
    timing: "PM · Before bed · Subcutaneous",
    mechanism: "GHRH analog + ghrelin mimetic — pulsatile GH release without cortisol/prolactin elevation, supports deep sleep architecture",
    triggers: [
      {
        signal: "sleep_score",
        condition: (value: number) => value < 60,
        reason: "Poor sleep architecture — CJC-1295/Ipamorelin enhances Stage 3/4 deep sleep via pulsatile GH release during first sleep cycle",
      },
      {
        signal: "recovery",
        condition: (value: number) => value < 45,
        reason: "Chronically low recovery — GH secretagogue stack accelerates tissue repair and glycogen replenishment",
      },
      {
        signal: "igf1",
        condition: (value: number) => value < 150,
        reason: "Low IGF-1 detected — CJC-1295 restores physiological GH pulsatility without supraphysiological peaks",
      },
    ],
  },
  {
    id: "tb-500",
    name: "TB-500 (Thymosin Beta-4)",
    category: "Systemic Repair Peptide",
    icon: "🔬",
    dose: "2.5mg",
    timing: "2× weekly · Subcutaneous",
    mechanism: "Thymosin beta-4 fragment — promotes cell migration, reduces inflammation, supports cardiac and neural tissue repair",
    triggers: [
      {
        signal: "joint_mobility",
        condition: (value: number) => value < 35,
        reason: "Joint mobility severely compromised — TB-500 promotes synovial fluid production and cartilage repair via actin sequestration",
      },
      {
        signal: "somatic_tension",
        condition: (severity: number) => severity >= 7,
        reason: "Severe musculoskeletal tension — TB-500 accelerates systemic tissue repair and reduces fibrosis",
      },
    ],
  },
  {
    id: "ss-31",
    name: "SS-31 (Elamipretide)",
    category: "Mitochondrial Peptide",
    icon: "⚡",
    dose: "5mg",
    timing: "AM · Subcutaneous",
    mechanism: "Targets cardiolipin in inner mitochondrial membrane — restores electron transport chain efficiency, reduces ROS production",
    triggers: [
      {
        signal: "energy_flux",
        condition: (value: number) => value < 35,
        reason: "Sustained low energy flux — SS-31 directly repairs mitochondrial membrane integrity for ATP production recovery",
      },
      {
        signal: "hrv_decline",
        condition: (pctBelow: number) => pctBelow > 20,
        reason: "HRV declining >20% — mitochondrial dysfunction in cardiac tissue may be contributing to autonomic dysregulation",
      },
    ],
  },
  {
    id: "pt-141",
    name: "PT-141 (Bremelanotide)",
    category: "Melanocortin Agonist",
    icon: "🧠",
    dose: "1.75mg",
    timing: "As needed · Subcutaneous",
    mechanism: "MC4R agonist — acts centrally on hypothalamus, not peripherally. Supports libido and motivation via dopaminergic pathways",
    triggers: [
      {
        signal: "neural_drive",
        condition: (value: number) => value < 30,
        reason: "Critically low neural drive — PT-141 activates melanocortin-4 receptors in the hypothalamus to restore motivational drive",
      },
      {
        signal: "testosterone_low",
        condition: (value: number) => value < 400,
        reason: "Low testosterone with neural drive decline — PT-141 provides central nervous system support while hormonal optimization is underway",
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN QUERY: getLongevityScore
   ═══════════════════════════════════════════════════════════════ */

export const getLongevityScore = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<LongevityScoreResult> => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    try {
      /* ── Gather all data sources ── */

      // 1. HRV data (7 days)
      const hrvReadings = await ctx.db
        .query("hrvReadings")
        .withIndex("by_sessionId_and_measuredAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("measuredAt", now - 7 * dayMs)
        )
        .collect();

      const latestHrv = hrvReadings.length > 0
        ? hrvReadings.sort((a, b) => b.measuredAt - a.measuredAt)[0].value
        : 0;
      const avgHrv7d = hrvReadings.length > 0
        ? hrvReadings.reduce((s, r) => s + r.value, 0) / hrvReadings.length
        : 0;
      const hrvPctBelow = avgHrv7d > 0 ? Math.max(0, ((avgHrv7d - latestHrv) / avgHrv7d) * 100) : 0;

      // 2. Sleep data (3 days)
      const sleepLogs = await ctx.db
        .query("sleepLogs")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const recentSleep = sleepLogs
        .filter(s => now - s.loggedAt < 3 * dayMs)
        .sort((a, b) => b.loggedAt - a.loggedAt);
      const latestSleep = recentSleep[0];
      const sleepScore = latestSleep?.sleepScore ?? 0;
      const sleepHours = latestSleep?.totalHours ?? 0;

      // 3. Somatic body map entries (24h)
      const bodyMapEntries = await ctx.db
        .query("bodyMapEntries")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - dayMs)
        )
        .collect();
      const highTensionEntries = bodyMapEntries.filter(e => e.severity >= 5);
      const maxTensionSeverity = bodyMapEntries.length > 0
        ? Math.max(...bodyMapEntries.map(e => e.severity))
        : 0;
      const tensionRegions = highTensionEntries.map(e => e.region);

      // 4. Somatic feedback channels (latest)
      const somaticFeedback = await ctx.db
        .query("somaticFeedback")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - dayMs)
        )
        .collect();
      const channelValues: Record<string, number> = {};
      for (const fb of somaticFeedback) {
        if (!channelValues[fb.channel] || fb.loggedAt > (somaticFeedback.find(f => f.channel === fb.channel && f !== fb)?.loggedAt ?? 0)) {
          channelValues[fb.channel] = fb.value;
        }
      }

      // 5. Inventory
      const inventoryItems = await ctx.db
        .query("inventory")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .collect();
      const activeInventory = inventoryItems.filter(i => i.status === "active" && i.dailyUsageUnits > 0);
      const lowStockItems = activeInventory.filter(i => {
        const daysLeft = i.dailyUsageUnits > 0 ? Math.floor(i.currentQuantity / i.dailyUsageUnits) : 999;
        return daysLeft <= 7;
      });
      const inventoryCoverage = activeInventory.length > 0
        ? (activeInventory.length - lowStockItems.length) / activeInventory.length
        : 1;

      // 6. Drift events
      const activeDrifts = await ctx.db
        .query("driftEvents")
        .withIndex("by_sessionId_and_status", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("status", "active")
        )
        .collect();

      // 7. Bio-Vault
      const bioVault = await ctx.db
        .query("bioVault")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .first();

      // 8. Protocol adherence (today)
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
      const completedCount = completions.filter(c => c.completed).length;
      const adherenceRate = activeProtocols.length > 0
        ? completedCount / activeProtocols.length
        : 0;

      // 9. Elite Score
      const eliteScore = await ctx.db
        .query("eliteScores")
        .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
        .first();

      /* ── Calculate Subsystem Scores ── */

      // Autonomic (0-25): HRV relative to baseline + RHR
      const hrvScore = latestHrv > 0
        ? Math.min(25, Math.round((Math.min(latestHrv / 80, 1.25)) * 20))
        : 10;
      const hrvTrendBonus = hrvPctBelow < 5 ? 5 : hrvPctBelow < 15 ? 2 : 0;
      const autonomicScore = Math.min(25, hrvScore + hrvTrendBonus);

      // Recovery (0-25): Sleep + strain recovery
      const sleepComponent = sleepScore > 0 ? Math.round((sleepScore / 100) * 15) : 7;
      const sleepHoursBonus = sleepHours >= 7 ? 5 : sleepHours >= 6 ? 3 : 0;
      const tensionPenalty = Math.min(5, Math.round(maxTensionSeverity * 0.5));
      const recoveryScore = Math.min(25, Math.max(0, sleepComponent + sleepHoursBonus + 5 - tensionPenalty));

      // Adherence (0-25): Protocol completion rate
      const adherenceScore = Math.min(25, Math.round(adherenceRate * 25));

      // Integrity (0-25): Inventory coverage + drift stability
      const inventoryComponent = Math.round(inventoryCoverage * 15);
      const driftPenalty = Math.min(10, activeDrifts.length * 3);
      const integrityScore = Math.min(25, Math.max(0, inventoryComponent + 10 - driftPenalty));

      const compositeScore = Math.max(1, Math.min(100, autonomicScore + recoveryScore + adherenceScore + integrityScore));

      /* ── Determine Trend ── */
      const prevHrvAvg = hrvReadings.length >= 4
        ? hrvReadings.slice(0, Math.floor(hrvReadings.length / 2)).reduce((s, r) => s + r.value, 0) / Math.floor(hrvReadings.length / 2)
        : avgHrv7d;
      const trend: "improving" | "stable" | "declining" =
        latestHrv > prevHrvAvg * 1.05 ? "improving"
        : latestHrv < prevHrvAvg * 0.92 ? "declining"
        : "stable";

      /* ── Data Completeness ── */
      let dataPoints = 0;
      if (hrvReadings.length > 0) dataPoints++;
      if (latestSleep) dataPoints++;
      if (bodyMapEntries.length > 0) dataPoints++;
      if (somaticFeedback.length > 0) dataPoints++;
      if (activeInventory.length > 0) dataPoints++;
      if (bioVault) dataPoints++;
      if (activeProtocols.length > 0) dataPoints++;
      if (eliteScore) dataPoints++;
      const dataCompleteness = Math.round((dataPoints / 8) * 100);

      /* ═══════════════════════════════════════════════════════════
         DAILY PRESCRIPTION ENGINE
         Cross-reference signals to generate ranked recommendations
         ═══════════════════════════════════════════════════════════ */

      const prescription: PrescriptionItem[] = [];

      // ── RULE 1: Low HRV + High Tension → Magnesium L-Threonate ──
      if (hrvPctBelow > 12 && maxTensionSeverity >= 5) {
        prescription.push({
          id: "rx-mag-threonate",
          title: "Magnesium L-Threonate",
          subtitle: "Autonomic + Somatic Recovery",
          dose: "500mg",
          reason: `HRV ${Math.round(hrvPctBelow)}% below baseline + ${tensionRegions[0] || "body"} tension at ${maxTensionSeverity}/10 — Mg-Threonate crosses BBB to restore parasympathetic tone and reduce neuromuscular tension`,
          icon: "🧲",
          priority: "critical",
          category: "supplement",
          timing: "PM · 1hr before bed",
          triggers: [`HRV: ${latestHrv}ms (↓${Math.round(hrvPctBelow)}%)`, `Tension: ${tensionRegions.join(", ")} (${maxTensionSeverity}/10)`],
          isFutureBio: false,
          confidence: Math.min(95, 60 + dataCompleteness * 0.35),
        });
      }

      // ── RULE 2: Low HRV alone → Ashwagandha + Box Breathing ──
      if (hrvPctBelow > 15 && maxTensionSeverity < 5) {
        prescription.push({
          id: "rx-ashwagandha",
          title: "Ashwagandha KSM-66",
          subtitle: "Cortisol Modulation",
          dose: "600mg",
          reason: `HRV ${Math.round(hrvPctBelow)}% below 7-day average — cortisol likely elevated. Ashwagandha modulates HSD11B1 enzyme to lower cortisol and restore HRV within 48-72h`,
          icon: "🧘",
          priority: "high",
          category: "supplement",
          timing: "PM · With dinner",
          triggers: [`HRV: ${latestHrv}ms vs ${Math.round(avgHrv7d)}ms avg`],
          isFutureBio: false,
          confidence: Math.min(90, 55 + dataCompleteness * 0.35),
        });
        prescription.push({
          id: "rx-box-breathing",
          title: "Box Breathing (4-4-4-4)",
          subtitle: "Vagal Tone Activation",
          dose: "5 minutes",
          reason: "Immediate parasympathetic activation — stimulates vagus nerve to shift autonomic balance within 3-5 minutes",
          icon: "🌬️",
          priority: "high",
          category: "intervention",
          timing: "Now · Before next task",
          triggers: [`HRV below baseline`],
          isFutureBio: false,
          confidence: 85,
        });
      }

      // ── RULE 3: Poor Sleep + High Tension → Glycine + Apigenin ──
      if (sleepScore < 65 && maxTensionSeverity >= 4) {
        prescription.push({
          id: "rx-glycine-sleep",
          title: "Glycine + Apigenin Stack",
          subtitle: "Sleep Architecture Repair",
          dose: "3g Glycine + 50mg Apigenin",
          reason: `Sleep score ${sleepScore}/100 with active tension in ${tensionRegions[0] || "body"} — Glycine lowers core temp for sleep onset, Apigenin activates GABA-A receptors for deeper slow-wave sleep`,
          icon: "🌙",
          priority: "critical",
          category: "supplement",
          timing: "PM · 30min before bed",
          triggers: [`Sleep: ${sleepScore}/100`, `Tension: ${maxTensionSeverity}/10`],
          isFutureBio: false,
          confidence: Math.min(90, 60 + dataCompleteness * 0.3),
        });
      }

      // ── RULE 4: Poor Sleep alone → NSDR ──
      if (sleepScore < 60 && sleepScore > 0 && maxTensionSeverity < 4) {
        prescription.push({
          id: "rx-nsdr",
          title: "NSDR / Yoga Nidra",
          subtitle: "Non-Sleep Deep Rest",
          dose: "20 minutes",
          reason: `Sleep score ${sleepScore}/100 — NSDR replenishes dopamine stores and provides 2-3h equivalent rest without full sleep cycle`,
          icon: "🧘",
          priority: "high",
          category: "intervention",
          timing: "Early PM · 1-3pm window",
          triggers: [`Sleep: ${sleepScore}/100`, `Hours: ${sleepHours}h`],
          isFutureBio: false,
          confidence: 80,
        });
      }

      // ── RULE 5: High CRP + Tension → Omega-3 + Curcumin ──
      if (bioVault?.crp != null && bioVault.crp > 1.5 && maxTensionSeverity >= 3) {
        prescription.push({
          id: "rx-antiinflam",
          title: "Anti-Inflammatory Stack",
          subtitle: "Omega-3 EPA + Curcumin",
          dose: bioVault.crp > 3 ? "4g EPA + 1g Curcumin" : "2g EPA + 500mg Curcumin",
          reason: `CRP: ${bioVault.crp} mg/L with somatic tension — dual-pathway inflammation reduction via ALOX5 (EPA) and NF-kB (Curcumin)`,
          icon: "🐟",
          priority: bioVault.crp > 3 ? "critical" : "high",
          category: "supplement",
          timing: "AM · With fat-containing meal",
          triggers: [`CRP: ${bioVault.crp} mg/L`, `Tension: ${maxTensionSeverity}/10`],
          isFutureBio: false,
          confidence: 92,
        });
      }

      // ── RULE 6: Low Vitamin D + Poor Recovery ──
      if (bioVault?.vitaminD != null && bioVault.vitaminD < 30 && recoveryScore < 15) {
        prescription.push({
          id: "rx-vitd-recovery",
          title: "Vitamin D3 + K2 (High Dose)",
          subtitle: "Immune + Recovery Support",
          dose: "10,000 IU",
          reason: `Vitamin D: ${bioVault.vitaminD} ng/mL with compromised recovery — D3 modulates 200+ genes including immune function and muscle repair pathways`,
          icon: "☀️",
          priority: "high",
          category: "supplement",
          timing: "AM · With fat-containing meal",
          triggers: [`Vit D: ${bioVault.vitaminD} ng/mL`, `Recovery: ${recoveryScore}/25`],
          isFutureBio: false,
          confidence: 90,
        });
      }

      // ── RULE 7: MTHFR + Low Energy ──
      if (bioVault?.mthfrVariant && (channelValues["energy_flux"] ?? 60) < 40) {
        prescription.push({
          id: "rx-methylb-energy",
          title: "Methylated B-Complex",
          subtitle: "MTHFR Methylation Support",
          dose: "1 capsule (5-MTHF + MeCbl)",
          reason: "MTHFR variant with low energy flux — impaired methylation reduces SAMe production, affecting mitochondrial energy metabolism and neurotransmitter synthesis",
          icon: "🧬",
          priority: "critical",
          category: "supplement",
          timing: "AM · With breakfast",
          triggers: ["MTHFR variant", `Energy: ${channelValues["energy_flux"] ?? "—"}/100`],
          isFutureBio: false,
          confidence: 95,
        });
      }

      // ── RULE 8: Active Drift → Recalibration ──
      for (const drift of activeDrifts.slice(0, 2)) {
        prescription.push({
          id: `rx-drift-${drift.metric}`,
          title: `Recalibrate: ${drift.metric}`,
          subtitle: `${Math.round(drift.avgDeviation)}% sustained deviation`,
          dose: "Protocol adjustment",
          reason: `${drift.metric} has drifted ${Math.round(drift.avgDeviation)}% for ${drift.consecutiveDays} consecutive days — baseline recalibration needed to prevent compounding degradation`,
          icon: "⚡",
          priority: drift.avgDeviation > 20 ? "critical" : "high",
          category: "lifestyle",
          timing: "Today · Review protocol stack",
          triggers: [`Drift: ${drift.metric} ↓${Math.round(drift.avgDeviation)}%`, `${drift.consecutiveDays} days`],
          isFutureBio: false,
          confidence: 85,
        });
      }

      // ── RULE 9: Low Inventory → Order ──
      for (const item of lowStockItems.slice(0, 2)) {
        const daysLeft = item.dailyUsageUnits > 0 ? Math.floor(item.currentQuantity / item.dailyUsageUnits) : 0;
        prescription.push({
          id: `rx-order-${item._id}`,
          title: `Reorder: ${item.name}`,
          subtitle: daysLeft <= 0 ? "DEPLETED — order now" : `${daysLeft} days remaining`,
          dose: "Restock",
          reason: `${item.name} supply ${daysLeft <= 0 ? "depleted" : "running low"} — gap in protocol coverage degrades LongevityScore integrity subsystem`,
          icon: "📦",
          priority: daysLeft <= 0 ? "critical" : "moderate",
          category: "order",
          timing: "Today",
          triggers: [`${item.name}: ${daysLeft}d supply`],
          isFutureBio: false,
          confidence: 100,
        });
      }

      // ── RULE 10: Low Adherence → Protocol Reminder ──
      if (adherenceRate < 0.5 && activeProtocols.length > 0) {
        prescription.push({
          id: "rx-adherence",
          title: "Complete Daily Protocols",
          subtitle: `${completedCount}/${activeProtocols.length} done today`,
          dose: `${activeProtocols.length - completedCount} remaining`,
          reason: `Protocol adherence at ${Math.round(adherenceRate * 100)}% — each missed protocol compounds biological drift. Consistency is the #1 predictor of longevity outcomes`,
          icon: "✅",
          priority: adherenceRate < 0.25 ? "critical" : "high",
          category: "lifestyle",
          timing: "Now",
          triggers: [`Adherence: ${Math.round(adherenceRate * 100)}%`],
          isFutureBio: false,
          confidence: 100,
        });
      }

      /* ═══════════════════════════════════════════════════════════
         FUTURE BIO — Peptide Recommendations
         Only surface when multiple signals converge
         ═══════════════════════════════════════════════════════════ */

      for (const compound of FUTURE_BIO_COMPOUNDS) {
        const matchedTriggers: string[] = [];

        for (const trigger of compound.triggers) {
          let triggered = false;

          switch (trigger.signal) {
            case "somatic_tension":
              if (maxTensionSeverity > 0 && trigger.condition(maxTensionSeverity, 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "gut_status":
              if (channelValues["gut_status"] != null && trigger.condition(channelValues["gut_status"], 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "crp":
              if (bioVault?.crp != null && trigger.condition(bioVault.crp, 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "sleep_score":
              if (sleepScore > 0 && trigger.condition(sleepScore, 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "recovery":
              if (trigger.condition(recoveryScore * 4, 0)) { // scale 0-25 to 0-100
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "igf1":
              if (bioVault?.igf1 != null && trigger.condition(bioVault.igf1, 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "joint_mobility":
              if (channelValues["joint_mobility"] != null && trigger.condition(channelValues["joint_mobility"], 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "energy_flux":
              if (channelValues["energy_flux"] != null && trigger.condition(channelValues["energy_flux"], 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "hrv_decline":
              if (trigger.condition(hrvPctBelow, 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "neural_drive":
              if (channelValues["neural_drive"] != null && trigger.condition(channelValues["neural_drive"], 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
            case "testosterone_low":
              if (bioVault?.testosteroneTotal != null && trigger.condition(bioVault.testosteroneTotal, 0)) {
                matchedTriggers.push(trigger.reason);
                triggered = true;
              }
              break;
          }
        }

        // Only recommend if ≥2 signals converge (high confidence)
        if (matchedTriggers.length >= 2) {
          prescription.push({
            id: `rx-fb-${compound.id}`,
            title: compound.name,
            subtitle: compound.category,
            dose: compound.dose,
            reason: matchedTriggers[0],
            icon: compound.icon,
            priority: matchedTriggers.length >= 3 ? "high" : "moderate",
            category: "peptide",
            timing: compound.timing,
            triggers: matchedTriggers.map((_, i) => matchedTriggers[i].split(" — ")[0]),
            isFutureBio: true,
            confidence: Math.min(85, 40 + matchedTriggers.length * 15 + dataCompleteness * 0.2),
          });
        }
      }

      /* ── Sort by priority ── */
      const priorityOrder: Record<PrescriptionPriority, number> = {
        critical: 0, high: 1, moderate: 2, maintenance: 3,
      };
      prescription.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.confidence - a.confidence;
      });

      /* ── Summary Line ── */
      const criticalCount = prescription.filter(p => p.priority === "critical").length;
      const futureBioCount = prescription.filter(p => p.isFutureBio).length;
      const summaryLine = criticalCount > 0
        ? `${criticalCount} critical action${criticalCount > 1 ? "s" : ""} required — ${prescription[0]?.title}`
        : futureBioCount > 0
          ? `${prescription.length} recommendations · ${futureBioCount} Future Bio compound${futureBioCount > 1 ? "s" : ""} flagged`
          : prescription.length > 0
            ? `${prescription.length} optimizations available — score: ${compositeScore}/100`
            : `All systems nominal — LongevityScore: ${compositeScore}/100`;

      return {
        score: compositeScore,
        breakdown: {
          autonomic: autonomicScore,
          recovery: recoveryScore,
          adherence: adherenceScore,
          integrity: integrityScore,
        },
        trend,
        prescription,
        topPrescription: prescription.slice(0, 3),
        summaryLine,
        dataCompleteness,
        calculatedAt: now,
      };
    } catch (error) {
      // Safe fallback
      return {
        score: 50,
        breakdown: { autonomic: 12, recovery: 13, adherence: 12, integrity: 13 },
        trend: "stable",
        prescription: [],
        topPrescription: [],
        summaryLine: "Calculating LongevityScore — add more data for precision",
        dataCompleteness: 0,
        calculatedAt: now,
      };
    }
  },
});
