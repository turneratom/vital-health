import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   CORRELATION ENGINE — Protocol Adherence × Biomarker Trends
   
   Pulls 30-day protocol completion history and cross-references
   with BioVault biomarker data to surface habit→health correlations.
   
   NEW: Missed-protocol detection generates biomarker impact alerts
   proving that specific habits move specific blood-work numbers.
   ═══════════════════════════════════════════════════════════════ */

/* ── Protocol → Biomarker Impact Map ──
   Maps protocol names/keywords to the biomarkers they influence,
   the direction of impact, and the mechanism of action. */
interface ProtocolBiomarkerLink {
  markerKey: string;
  markerName: string;
  direction: "increase" | "decrease";
  mechanism: string;
  impactWeight: number; // 0-1, how strongly this protocol affects the marker
  scriptFix: string; // Actionable recommendation
}

const PROTOCOL_BIOMARKER_MAP: Record<string, ProtocolBiomarkerLink[]> = {
  // Sunlight protocols
  sunlight: [
    {
      markerKey: "vitaminD",
      markerName: "Vitamin D",
      direction: "increase",
      mechanism: "UVB-triggered cholecalciferol synthesis in skin",
      impactWeight: 0.85,
      scriptFix: "Resume 7am Sunlight Protocol (10-20min direct exposure). Add Vitamin D3 5000 IU + K2 MK-7 as bridge.",
    },
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Circadian cortisol regulation reduces systemic inflammation",
      impactWeight: 0.35,
      scriptFix: "Morning light exposure within 30min of waking resets cortisol curve, lowering inflammatory markers.",
    },
    {
      markerKey: "testosteroneTotal",
      markerName: "Total Testosterone",
      direction: "increase",
      mechanism: "Vitamin D is a precursor to steroidogenesis; morning light optimizes LH pulsatility",
      impactWeight: 0.3,
      scriptFix: "Consistent AM sunlight supports hypothalamic-pituitary-gonadal axis. Resume 7am exposure.",
    },
  ],
  // Magnesium / mineral protocols
  magnesium: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Magnesium glycinate modulates NF-κB inflammatory pathway",
      impactWeight: 0.6,
      scriptFix: "Resume Magnesium Glycinate 400mg before bed. Pair with 9pm Digital Detox for cortisol suppression.",
    },
    {
      markerKey: "hba1c",
      markerName: "HbA1c",
      direction: "decrease",
      mechanism: "Magnesium improves insulin receptor sensitivity and glucose uptake",
      impactWeight: 0.4,
      scriptFix: "Magnesium deficiency impairs insulin signaling. Resume 400mg Glycinate nightly.",
    },
    {
      markerKey: "testosteroneFree",
      markerName: "Free Testosterone",
      direction: "increase",
      mechanism: "Magnesium reduces SHBG binding, freeing bioavailable testosterone",
      impactWeight: 0.35,
      scriptFix: "Magnesium lowers SHBG. Resume nightly Glycinate 400mg to restore free T levels.",
    },
  ],
  // Cold exposure
  cold: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Cold-induced norepinephrine surge activates anti-inflammatory pathways",
      impactWeight: 0.55,
      scriptFix: "Resume Cold Plunge 2min @ 50°F post-training. Norepinephrine spike reduces CRP within 72h.",
    },
    {
      markerKey: "testosteroneTotal",
      markerName: "Total Testosterone",
      direction: "increase",
      mechanism: "Cold exposure upregulates Leydig cell function via hormetic stress",
      impactWeight: 0.25,
      scriptFix: "Cold exposure triggers hormetic testosterone response. Resume 2min cold immersion 3x/week.",
    },
  ],
  // Sleep / digital detox
  sleep: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Deep sleep suppresses IL-6 and TNF-α inflammatory cytokines",
      impactWeight: 0.7,
      scriptFix: "Enforce 9pm Screen-Off + Sleep Protocol. Poor sleep elevates CRP by 25-40% within 3 days.",
    },
    {
      markerKey: "hba1c",
      markerName: "HbA1c",
      direction: "decrease",
      mechanism: "Sleep deprivation impairs glucose tolerance and insulin sensitivity",
      impactWeight: 0.5,
      scriptFix: "Resume full Sleep Protocol. Even 2 nights of poor sleep raises fasting glucose by 15-20%.",
    },
    {
      markerKey: "testosteroneTotal",
      markerName: "Total Testosterone",
      direction: "increase",
      mechanism: "70% of daily testosterone is produced during deep sleep phases",
      impactWeight: 0.65,
      scriptFix: "Resume Sleep Protocol immediately. Testosterone drops 10-15% after just 5 days of <6h sleep.",
    },
    {
      markerKey: "testosteroneFree",
      markerName: "Free Testosterone",
      direction: "increase",
      mechanism: "Sleep quality directly modulates SHBG and free androgen index",
      impactWeight: 0.55,
      scriptFix: "Deep sleep phases are critical for free T. Enforce 9pm Screen-Off + 10pm lights out.",
    },
  ],
  detox: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Blue light cessation normalizes melatonin, reducing oxidative stress markers",
      impactWeight: 0.4,
      scriptFix: "Resume 9pm Digital Detox. Blue light after 9pm suppresses melatonin and elevates cortisol.",
    },
  ],
  // Exercise / movement
  exercise: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Regular exercise releases IL-6 from muscles, triggering anti-inflammatory cascade",
      impactWeight: 0.6,
      scriptFix: "Resume Movement Protocol. Consistent training reduces baseline CRP by 20-30% over 4 weeks.",
    },
    {
      markerKey: "hba1c",
      markerName: "HbA1c",
      direction: "decrease",
      mechanism: "Skeletal muscle contraction activates GLUT4 glucose transporters independent of insulin",
      impactWeight: 0.65,
      scriptFix: "Resume daily Movement Protocol. Post-meal walks alone can reduce HbA1c by 0.3% over 8 weeks.",
    },
    {
      markerKey: "testosteroneTotal",
      markerName: "Total Testosterone",
      direction: "increase",
      mechanism: "Compound resistance training triggers acute testosterone elevation",
      impactWeight: 0.5,
      scriptFix: "Resume strength training 3-4x/week. Compound lifts (squat, deadlift) maximize T response.",
    },
    {
      markerKey: "ferritin",
      markerName: "Ferritin",
      direction: "increase",
      mechanism: "Exercise-induced hepcidin regulation improves iron metabolism",
      impactWeight: 0.2,
      scriptFix: "Moderate exercise supports iron homeostasis. Avoid excessive endurance which depletes ferritin.",
    },
  ],
  movement: [
    {
      markerKey: "hba1c",
      markerName: "HbA1c",
      direction: "decrease",
      mechanism: "Post-meal walking blunts glucose spikes by 30-50%",
      impactWeight: 0.55,
      scriptFix: "Resume 10-min post-meal walks. This single habit can reduce HbA1c by 0.2-0.4% in 8 weeks.",
    },
  ],
  walk: [
    {
      markerKey: "hba1c",
      markerName: "HbA1c",
      direction: "decrease",
      mechanism: "Post-meal walking blunts glucose spikes by 30-50%",
      impactWeight: 0.55,
      scriptFix: "Resume 10-min post-meal walks. This single habit can reduce HbA1c by 0.2-0.4% in 8 weeks.",
    },
  ],
  // Supplements
  omega: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "EPA/DHA resolve inflammation via specialized pro-resolving mediators (SPMs)",
      impactWeight: 0.65,
      scriptFix: "Resume Omega-3 EPA/DHA 3g daily. SPMs actively resolve inflammation, not just suppress it.",
    },
  ],
  fish: [
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "EPA/DHA resolve inflammation via specialized pro-resolving mediators",
      impactWeight: 0.65,
      scriptFix: "Resume Fish Oil / Omega-3 EPA/DHA 3g daily with meals.",
    },
  ],
  vitamin: [
    {
      markerKey: "vitaminD",
      markerName: "Vitamin D",
      direction: "increase",
      mechanism: "Direct supplementation of cholecalciferol (D3)",
      impactWeight: 0.9,
      scriptFix: "Resume Vitamin D3 5000 IU + K2 MK-7 daily with fat-containing meal for absorption.",
    },
  ],
  iron: [
    {
      markerKey: "ferritin",
      markerName: "Ferritin",
      direction: "increase",
      mechanism: "Iron bisglycinate supplementation replenishes ferritin stores",
      impactWeight: 0.85,
      scriptFix: "Resume Iron Bisglycinate 25mg + Vitamin C 500mg on empty stomach. Retest in 8 weeks.",
    },
  ],
  zinc: [
    {
      markerKey: "testosteroneTotal",
      markerName: "Total Testosterone",
      direction: "increase",
      mechanism: "Zinc is essential for Leydig cell testosterone synthesis",
      impactWeight: 0.45,
      scriptFix: "Resume Zinc Picolinate 30mg daily. Zinc deficiency directly suppresses T production.",
    },
    {
      markerKey: "testosteroneFree",
      markerName: "Free Testosterone",
      direction: "increase",
      mechanism: "Zinc inhibits aromatase, reducing testosterone-to-estrogen conversion",
      impactWeight: 0.4,
      scriptFix: "Resume Zinc 30mg daily. Aromatase inhibition preserves free testosterone levels.",
    },
  ],
  creatine: [
    {
      markerKey: "testosteroneTotal",
      markerName: "Total Testosterone",
      direction: "increase",
      mechanism: "Creatine may increase DHT conversion and support androgen receptor density",
      impactWeight: 0.2,
      scriptFix: "Resume Creatine Monohydrate 5g daily. Supports overall androgen metabolism.",
    },
  ],
  fasting: [
    {
      markerKey: "hba1c",
      markerName: "HbA1c",
      direction: "decrease",
      mechanism: "Time-restricted eating improves insulin sensitivity and reduces fasting glucose",
      impactWeight: 0.5,
      scriptFix: "Resume 16:8 fasting window. Consistent TRE reduces HbA1c by 0.2-0.5% over 12 weeks.",
    },
    {
      markerKey: "crp",
      markerName: "hs-CRP",
      direction: "decrease",
      mechanism: "Fasting activates autophagy and reduces oxidative stress markers",
      impactWeight: 0.35,
      scriptFix: "Resume intermittent fasting protocol. Autophagy activation reduces systemic inflammation.",
    },
  ],
};

/* ── Helper: match protocol name to biomarker links ── */
function matchProtocolToLinks(protocolName: string): ProtocolBiomarkerLink[] {
  const lower = protocolName.toLowerCase();
  const links: ProtocolBiomarkerLink[] = [];
  const seen = new Set<string>();

  for (const [keyword, mappings] of Object.entries(PROTOCOL_BIOMARKER_MAP)) {
    if (lower.includes(keyword)) {
      for (const m of mappings) {
        const key = `${m.markerKey}-${keyword}`;
        if (!seen.has(key)) {
          seen.add(key);
          links.push(m);
        }
      }
    }
  }
  return links;
}

/* ── Biomarker Impact Alert ── */
export interface BiomarkerAlert {
  markerKey: string;
  markerName: string;
  severity: "caution" | "warning" | "critical";
  missedDays: number;
  missedProtocols: Array<{
    name: string;
    icon: string;
    category: string;
    consecutiveMissedDays: number;
  }>;
  projectedImpact: string;
  mechanism: string;
  scriptFix: string;
  impactScore: number; // 0-100, how much this is projected to affect the marker
  direction: "worsening" | "stalling";
}

// ── Get protocol adherence history for the last N days ──
export const getProtocolAdherenceHistory = query({
  args: { sessionId: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lookback = (args.days ?? 30) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - lookback;

    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const recentCompletions = completions.filter(
      (c) => c.completedAt >= cutoff && c.completed
    );

    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const protocolMap = new Map(
      protocols.map((p) => [p._id, { name: p.name, category: p.category, icon: p.icon }])
    );

    const byProtocol: Record<string, {
      protocolId: string;
      name: string;
      category: string;
      icon: string;
      completionDates: string[];
      totalCompletions: number;
      streakDays: number;
    }> = {};

    for (const c of recentCompletions) {
      const proto = protocolMap.get(c.protocolItemId as any);
      if (!proto) continue;

      const dateKey = new Date(c.completedAt).toISOString().slice(0, 10);
      const key = c.protocolItemId;

      if (!byProtocol[key]) {
        byProtocol[key] = {
          protocolId: key,
          name: proto.name,
          category: proto.category,
          icon: proto.icon,
          completionDates: [],
          totalCompletions: 0,
          streakDays: 0,
        };
      }

      if (!byProtocol[key].completionDates.includes(dateKey)) {
        byProtocol[key].completionDates.push(dateKey);
      }
      byProtocol[key].totalCompletions++;
    }

    const today = new Date();
    for (const key of Object.keys(byProtocol)) {
      const dates = byProtocol[key].completionDates.sort().reverse();
      let streak = 0;
      for (let i = 0; i < dates.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedKey = expected.toISOString().slice(0, 10);
        if (dates.includes(expectedKey)) {
          streak++;
        } else {
          break;
        }
      }
      byProtocol[key].streakDays = streak;
    }

    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const protocolLogs = await ctx.db
      .query("protocolLogs")
      .withIndex("by_sessionId_and_loggedAt", (q: any) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .collect();

    const totalDays = args.days ?? 30;
    const dailyRates: Array<{ date: string; rate: number; completed: number; total: number }> = [];
    const totalProtocols = protocols.filter((p) => p.isActive).length || 1;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (totalDays - 1 - i));
      const dk = d.toISOString().slice(0, 10);
      const dayCompletions = recentCompletions.filter((c) => {
        const cd = new Date(c.completedAt).toISOString().slice(0, 10);
        return cd === dk;
      });
      const uniqueProtocols = new Set(dayCompletions.map((c) => c.protocolItemId));
      const completed = uniqueProtocols.size;
      dailyRates.push({
        date: dk,
        rate: Math.round((completed / totalProtocols) * 100),
        completed,
        total: totalProtocols,
      });
    }

    return {
      protocols: Object.values(byProtocol).sort(
        (a, b) => b.totalCompletions - a.totalCompletions
      ),
      dailyRates,
      bioVault: vault
        ? {
            vitaminD: vault.vitaminD ?? null,
            ferritin: vault.ferritin ?? null,
            crp: vault.crp ?? null,
            hba1c: vault.hba1c ?? null,
            testosteroneFree: vault.testosteroneFree ?? null,
            testosteroneTotal: vault.testosteroneTotal ?? null,
            hrvCurrent: vault.hrvCurrent ?? null,
            updatedAt: vault.updatedAt,
          }
        : null,
      totalCompletions: recentCompletions.length,
      avgDailyRate:
        dailyRates.length > 0
          ? Math.round(
              dailyRates.reduce((s, d) => s + d.rate, 0) / dailyRates.length
            )
          : 0,
      protocolLogCount: protocolLogs.length,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   BIOMARKER IMPACT ALERTS — Missed Protocol → Blood-Work Projection
   
   Detects when a user has missed specific protocols for 3+ days
   and generates alerts explaining how it's affecting their
   biomarker projections in real-time.
   ═══════════════════════════════════════════════════════════════ */

export const getBiomarkerImpactAlerts = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const lookback7d = 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - lookback7d;

    // 1. Get all active protocols
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const activeProtocols = protocols.filter((p) => p.isActive);

    if (activeProtocols.length === 0) return { alerts: [], missedProtocols: [] };

    // 2. Get completions in the last 7 days
    const completions = await ctx.db
      .query("protocolCompletions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const recentCompletions = completions.filter(
      (c) => c.completedAt >= cutoff && c.completed
    );

    // 3. For each protocol, calculate consecutive missed days (from today backwards)
    const today = new Date();
    const missedProtocols: Array<{
      protocolId: string;
      name: string;
      icon: string;
      category: string;
      consecutiveMissedDays: number;
      biomarkerLinks: ProtocolBiomarkerLink[];
    }> = [];

    for (const proto of activeProtocols) {
      const protoCompletions = recentCompletions.filter(
        (c) => c.protocolItemId === (proto._id as any)
      );
      const completedDates = new Set(
        protoCompletions.map((c) =>
          new Date(c.completedAt).toISOString().slice(0, 10)
        )
      );

      // Count consecutive missed days from today
      let missed = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dk = d.toISOString().slice(0, 10);
        if (!completedDates.has(dk)) {
          missed++;
        } else {
          break;
        }
      }

      // Only flag if missed 3+ consecutive days
      if (missed >= 3) {
        const links = matchProtocolToLinks(proto.name);
        if (links.length > 0) {
          missedProtocols.push({
            protocolId: proto._id as string,
            name: proto.name,
            icon: proto.icon,
            category: proto.category,
            consecutiveMissedDays: missed,
            biomarkerLinks: links,
          });
        }
      }
    }

    // 4. Get BioVault for current marker values
    const vault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // 5. Aggregate alerts by biomarker
    const alertMap: Record<string, BiomarkerAlert> = {};

    for (const mp of missedProtocols) {
      for (const link of mp.biomarkerLinks) {
        if (!alertMap[link.markerKey]) {
          // Determine severity based on max missed days across all protocols affecting this marker
          const severity: BiomarkerAlert["severity"] =
            mp.consecutiveMissedDays >= 6
              ? "critical"
              : mp.consecutiveMissedDays >= 4
                ? "warning"
                : "caution";

          // Calculate projected impact score
          const dayFactor = Math.min(1, mp.consecutiveMissedDays / 7);
          const impactScore = Math.round(link.impactWeight * dayFactor * 100);

          // Build projected impact description
          const currentVal = vault
            ? (vault as Record<string, unknown>)[link.markerKey]
            : null;
          let projectedImpact: string;
          if (currentVal != null && typeof currentVal === "number") {
            const pctChange = Math.round(
              link.impactWeight * dayFactor * 15
            );
            if (link.direction === "increase") {
              projectedImpact = `${link.markerName} projected to decline ~${pctChange}% from ${currentVal} ${link.direction === "increase" ? "without" : "with"} this protocol`;
            } else {
              projectedImpact = `${link.markerName} projected to rise ~${pctChange}% from ${currentVal} without this protocol`;
            }
          } else {
            projectedImpact = `${link.markerName} trajectory ${link.direction === "increase" ? "declining" : "worsening"} without this protocol`;
          }

          alertMap[link.markerKey] = {
            markerKey: link.markerKey,
            markerName: link.markerName,
            severity,
            missedDays: mp.consecutiveMissedDays,
            missedProtocols: [],
            projectedImpact,
            mechanism: link.mechanism,
            scriptFix: link.scriptFix,
            impactScore,
            direction:
              link.direction === "increase" ? "worsening" : "worsening",
          };
        }

        // Add this protocol to the alert's missed list
        const existing = alertMap[link.markerKey].missedProtocols;
        if (!existing.find((p) => p.name === mp.name)) {
          existing.push({
            name: mp.name,
            icon: mp.icon,
            category: mp.category,
            consecutiveMissedDays: mp.consecutiveMissedDays,
          });
        }

        // Update severity to worst case
        if (mp.consecutiveMissedDays > alertMap[link.markerKey].missedDays) {
          alertMap[link.markerKey].missedDays = mp.consecutiveMissedDays;
          alertMap[link.markerKey].severity =
            mp.consecutiveMissedDays >= 6
              ? "critical"
              : mp.consecutiveMissedDays >= 4
                ? "warning"
                : "caution";
        }

        // Use the highest-impact script fix
        const currentLink = mp.biomarkerLinks.find(
          (l) => l.markerKey === link.markerKey
        );
        if (
          currentLink &&
          currentLink.impactWeight > link.impactWeight
        ) {
          alertMap[link.markerKey].scriptFix = currentLink.scriptFix;
          alertMap[link.markerKey].mechanism = currentLink.mechanism;
        }
      }
    }

    // Sort alerts by severity (critical first) then impact score
    const severityOrder = { critical: 0, warning: 1, caution: 2 };
    const alerts = Object.values(alertMap).sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.impactScore - a.impactScore;
    });

    return {
      alerts,
      missedProtocols: missedProtocols.map((mp) => ({
        name: mp.name,
        icon: mp.icon,
        category: mp.category,
        consecutiveMissedDays: mp.consecutiveMissedDays,
        affectedMarkers: mp.biomarkerLinks.map((l) => l.markerName),
      })),
    };
  },
});
