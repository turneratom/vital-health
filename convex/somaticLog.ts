import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   SOMATIC LOG — Backend for Subjective Feeling Tracker
   
   Handles:
   • Slider-based somatic channel logging (Neural Drive, Core Temp, etc.)
   • Voice memo metadata storage + transcript linking
   • Recent somatic feed queries (last 24h, 7d)
   • AI Brain correlation: subjective state ↔ active protocols
   ═══════════════════════════════════════════════════════════════ */

/* ── Somatic Channel Definitions ── */
const SOMATIC_CHANNELS = [
  "neural_drive",
  "core_temp",
  "gut_status",
  "joint_mobility",
  "mental_clarity",
  "energy_flux",
] as const;

/* ── Log a single somatic slider entry ── */
export const logSomaticEntry = mutation({
  args: {
    sessionId: v.string(),
    channel: v.string(),
    value: v.number(),
    label: v.string(),
    source: v.string(),
    voiceMemoId: v.optional(v.string()),
    protocolContext: v.optional(v.string()),
    substanceCycleId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("somaticFeedback", {
      sessionId: args.sessionId,
      channel: args.channel,
      value: Math.max(0, Math.min(100, args.value)),
      label: args.label,
      source: args.source,
      voiceMemoId: args.voiceMemoId,
      substanceCycleId: args.substanceCycleId,
      protocolContext: args.protocolContext,
      loggedAt: Date.now(),
    });
  },
});

/* ── Log multiple somatic channels at once (batch submit) ── */
export const logSomaticBatch = mutation({
  args: {
    sessionId: v.string(),
    entries: v.array(
      v.object({
        channel: v.string(),
        value: v.number(),
        label: v.string(),
      })
    ),
    source: v.string(),
    protocolContext: v.optional(v.string()),
    voiceMemoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ids: string[] = [];
    for (const entry of args.entries) {
      const id = await ctx.db.insert("somaticFeedback", {
        sessionId: args.sessionId,
        channel: entry.channel,
        value: Math.max(0, Math.min(100, entry.value)),
        label: entry.label,
        source: args.source,
        voiceMemoId: args.voiceMemoId,
        protocolContext: args.protocolContext,
        loggedAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

/* ── Save voice memo metadata ── */
export const saveVoiceMemo = mutation({
  args: {
    sessionId: v.string(),
    durationSeconds: v.number(),
    transcript: v.optional(v.string()),
    extractedChannels: v.optional(v.string()),
    confidence: v.number(),
    storageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("somaticVoiceMemos", {
      sessionId: args.sessionId,
      durationSeconds: args.durationSeconds,
      transcript: args.transcript,
      extractedChannels: args.extractedChannels,
      confidence: args.confidence,
      storageId: args.storageId,
      loggedAt: Date.now(),
    });
  },
});

/* ── Update somatic entry with AI correlation result ── */
export const updateSomaticCorrelation = mutation({
  args: {
    id: v.id("somaticFeedback"),
    aiCorrelation: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { aiCorrelation: args.aiCorrelation });
  },
});

/* ── Get recent somatic entries (last 24h) ── */
export const getRecentSomatic = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const entries = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .order("desc")
      .collect();
    return entries;
  },
});

/* ── Get somatic history (last 7 days, grouped by channel) ── */
export const getSomaticHistory = query({
  args: { sessionId: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lookback = (args.days ?? 7) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - lookback;
    const entries = await ctx.db
      .query("somaticFeedback")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .order("desc")
      .collect();

    // Group by channel
    const byChannel: Record<string, Array<{ value: number; loggedAt: number; label: string; aiCorrelation?: string }>> = {};
    for (const e of entries) {
      if (!byChannel[e.channel]) byChannel[e.channel] = [];
      byChannel[e.channel].push({
        value: e.value,
        loggedAt: e.loggedAt,
        label: e.label,
        aiCorrelation: e.aiCorrelation ?? undefined,
      });
    }

    // Compute channel averages and trends
    const channelSummaries = Object.entries(byChannel).map(([channel, data]) => {
      const avg = data.reduce((s, d) => s + d.value, 0) / data.length;
      const recent = data.slice(0, 3);
      const older = data.slice(3, 6);
      const recentAvg = recent.length > 0 ? recent.reduce((s, d) => s + d.value, 0) / recent.length : avg;
      const olderAvg = older.length > 0 ? older.reduce((s, d) => s + d.value, 0) / older.length : avg;
      const trend = recentAvg > olderAvg + 5 ? "up" : recentAvg < olderAvg - 5 ? "down" : "stable";
      return { channel, avg: Math.round(avg), trend, dataPoints: data.length, latest: data[0] };
    });

    return { channelSummaries, totalEntries: entries.length, entries };
  },
});

/* ── Get recent voice memos ── */
export const getRecentVoiceMemos = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return await ctx.db
      .query("somaticVoiceMemos")
      .withIndex("by_sessionId_and_loggedAt", (q) =>
        q.eq("sessionId", args.sessionId).gte("loggedAt", cutoff)
      )
      .order("desc")
      .take(10);
  },
});

/* ═══════════════════════════════════════════════════════════════
   AI SOMATIC CORRELATION — Cross-references subjective state
   with active peptide/supplement protocols to detect optimization
   patterns or early protocol drift signals.
   ═══════════════════════════════════════════════════════════════ */

/* ── Protocol → Expected Somatic Effects Map ── */
const PROTOCOL_SOMATIC_MAP: Record<string, Record<string, { expected: "increase" | "decrease" | "stable"; magnitude: number; onset_hours: number }>> = {
  "bpc-157": {
    gut_status: { expected: "increase", magnitude: 20, onset_hours: 48 },
    joint_mobility: { expected: "increase", magnitude: 15, onset_hours: 72 },
  },
  "tb-500": {
    joint_mobility: { expected: "increase", magnitude: 25, onset_hours: 96 },
    energy_flux: { expected: "increase", magnitude: 10, onset_hours: 48 },
  },
  "mk-677": {
    energy_flux: { expected: "increase", magnitude: 15, onset_hours: 24 },
    neural_drive: { expected: "increase", magnitude: 10, onset_hours: 72 },
    gut_status: { expected: "decrease", magnitude: 10, onset_hours: 12 },
  },
  "pt-141": {
    neural_drive: { expected: "increase", magnitude: 20, onset_hours: 2 },
    core_temp: { expected: "increase", magnitude: 15, onset_hours: 1 },
  },
  "semaglutide": {
    gut_status: { expected: "decrease", magnitude: 25, onset_hours: 24 },
    energy_flux: { expected: "decrease", magnitude: 15, onset_hours: 48 },
  },
  "testosterone": {
    neural_drive: { expected: "increase", magnitude: 20, onset_hours: 168 },
    energy_flux: { expected: "increase", magnitude: 25, onset_hours: 168 },
    mental_clarity: { expected: "increase", magnitude: 15, onset_hours: 336 },
  },
  "creatine": {
    mental_clarity: { expected: "increase", magnitude: 10, onset_hours: 168 },
    energy_flux: { expected: "increase", magnitude: 10, onset_hours: 72 },
  },
  "magnesium": {
    neural_drive: { expected: "stable", magnitude: 5, onset_hours: 24 },
    joint_mobility: { expected: "increase", magnitude: 5, onset_hours: 48 },
    mental_clarity: { expected: "increase", magnitude: 10, onset_hours: 24 },
  },
  "ashwagandha": {
    neural_drive: { expected: "decrease", magnitude: 10, onset_hours: 168 },
    mental_clarity: { expected: "increase", magnitude: 15, onset_hours: 336 },
    core_temp: { expected: "stable", magnitude: 0, onset_hours: 0 },
  },
  "omega-3": {
    joint_mobility: { expected: "increase", magnitude: 10, onset_hours: 336 },
    mental_clarity: { expected: "increase", magnitude: 10, onset_hours: 336 },
  },
  "caffeine": {
    neural_drive: { expected: "increase", magnitude: 25, onset_hours: 0.5 },
    energy_flux: { expected: "increase", magnitude: 20, onset_hours: 0.5 },
    core_temp: { expected: "increase", magnitude: 10, onset_hours: 1 },
  },
};

export const correlateSomaticWithProtocols = action({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<{
    correlations: Array<{
      channel: string;
      channelLabel: string;
      currentAvg: number;
      trend: string;
      linkedProtocols: Array<{
        name: string;
        category: string;
        expectedEffect: string;
        magnitude: number;
        alignment: "aligned" | "misaligned" | "neutral";
        signal: string;
      }>;
      driftSignal: string | null;
      optimizationSignal: string | null;
    }>;
    overallAssessment: string;
    generatedAt: number;
  }> => {
    const now = Date.now();

    /* Pull somatic history */
    let somaticHistory: any = null;
    try {
      somaticHistory = await ctx.runQuery(
        "somaticLog:getSomaticHistory" as any,
        { sessionId: args.sessionId, days: 7 }
      );
    } catch { /* continue */ }

    /* Pull active substance cycles */
    let activeCycles: any[] = [];
    try {
      const cycles = await ctx.runQuery(
        "substanceIntegrity:getActiveCycles" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(cycles)) activeCycles = cycles;
    } catch { /* continue */ }

    /* Pull recent protocol logs for supplement context */
    let recentProtocols: any[] = [];
    try {
      const logs = await ctx.runQuery(
        "queries:getTodayProtocolLogs" as any,
        { sessionId: args.sessionId }
      );
      if (Array.isArray(logs)) recentProtocols = logs;
    } catch { /* continue */ }

    const channelLabels: Record<string, string> = {
      neural_drive: "Neural Drive",
      core_temp: "Core Temperature",
      gut_status: "Gut Status",
      joint_mobility: "Joint Mobility",
      mental_clarity: "Mental Clarity",
      energy_flux: "Energy Flux",
    };

    const correlations: Array<{
      channel: string;
      channelLabel: string;
      currentAvg: number;
      trend: string;
      linkedProtocols: Array<{
        name: string;
        category: string;
        expectedEffect: string;
        magnitude: number;
        alignment: "aligned" | "misaligned" | "neutral";
        signal: string;
      }>;
      driftSignal: string | null;
      optimizationSignal: string | null;
    }> = [];

    const summaries = somaticHistory?.channelSummaries ?? [];

    for (const summary of summaries) {
      const { channel, avg, trend } = summary;
      const linkedProtocols: typeof correlations[0]["linkedProtocols"] = [];
      let driftSignal: string | null = null;
      let optimizationSignal: string | null = null;

      // Check each active substance cycle against this channel
      for (const cycle of activeCycles) {
        const substanceKey = cycle.substanceName?.toLowerCase().replace(/[\s-]+/g, "-") ?? "";
        const mapping = PROTOCOL_SOMATIC_MAP[substanceKey];
        if (!mapping || !mapping[channel]) continue;

        const effect = mapping[channel];
        const hoursOnProtocol = cycle.lastDoseAt
          ? (now - cycle.lastDoseAt) / (1000 * 60 * 60)
          : cycle.startedAt
            ? (now - cycle.startedAt) / (1000 * 60 * 60)
            : 0;
        const pastOnset = hoursOnProtocol >= effect.onset_hours;

        let alignment: "aligned" | "misaligned" | "neutral" = "neutral";
        let signal = "";

        if (pastOnset) {
          if (effect.expected === "increase" && trend === "up") {
            alignment = "aligned";
            signal = `${cycle.substanceName} is producing expected ${channelLabels[channel]} improvement — ${avg}/100 trending up`;
          } else if (effect.expected === "increase" && trend === "down") {
            alignment = "misaligned";
            signal = `${cycle.substanceName} should be increasing ${channelLabels[channel]} but subjective report shows decline to ${avg}/100`;
            driftSignal = `Protocol drift: ${cycle.substanceName} → ${channelLabels[channel]} misalignment detected`;
          } else if (effect.expected === "decrease" && trend === "down") {
            alignment = "aligned";
            signal = `Expected ${channelLabels[channel]} reduction from ${cycle.substanceName} confirmed — monitoring at ${avg}/100`;
          } else if (effect.expected === "decrease" && trend === "up") {
            alignment = "aligned";
            signal = `${channelLabels[channel]} improving despite expected reduction from ${cycle.substanceName} — positive adaptation`;
            optimizationSignal = `Positive adaptation: ${channelLabels[channel]} resilient against ${cycle.substanceName} side-effect profile`;
          } else {
            alignment = "neutral";
            signal = `${cycle.substanceName} → ${channelLabels[channel]}: stable at ${avg}/100, within expected range`;
          }
        } else {
          signal = `${cycle.substanceName} onset pending (${Math.round(effect.onset_hours - hoursOnProtocol)}h remaining)`;
        }

        linkedProtocols.push({
          name: cycle.substanceName,
          category: cycle.category,
          expectedEffect: effect.expected,
          magnitude: effect.magnitude,
          alignment,
          signal,
        });
      }

      // Check supplement protocols too
      for (const log of recentProtocols) {
        const protocolKey = log.protocolName?.toLowerCase().replace(/[\s-]+/g, "-") ?? "";
        const mapping = PROTOCOL_SOMATIC_MAP[protocolKey];
        if (!mapping || !mapping[channel]) continue;
        if (linkedProtocols.some((lp) => lp.name.toLowerCase() === protocolKey)) continue;

        const effect = mapping[channel];
        linkedProtocols.push({
          name: log.protocolName,
          category: log.category ?? "supplement",
          expectedEffect: effect.expected,
          magnitude: effect.magnitude,
          alignment: "neutral",
          signal: `${log.protocolName} may influence ${channelLabels[channel]} — monitoring`,
        });
      }

      // Detect drift from low values without protocol explanation
      if (avg < 35 && linkedProtocols.length === 0 && !driftSignal) {
        driftSignal = `${channelLabels[channel]} at ${avg}/100 with no active protocol targeting this channel — unexplained decline`;
      }

      // Detect optimization from high values
      if (avg > 75 && trend === "up" && !optimizationSignal) {
        const aligned = linkedProtocols.filter((lp) => lp.alignment === "aligned");
        if (aligned.length > 0) {
          optimizationSignal = `${channelLabels[channel]} optimizing at ${avg}/100 — ${aligned.map((a) => a.name).join(", ")} protocol synergy confirmed`;
        }
      }

      correlations.push({
        channel,
        channelLabel: channelLabels[channel] ?? channel,
        currentAvg: avg,
        trend,
        linkedProtocols,
        driftSignal,
        optimizationSignal,
      });
    }

    // Overall assessment
    const driftCount = correlations.filter((c) => c.driftSignal).length;
    const optCount = correlations.filter((c) => c.optimizationSignal).length;
    const misaligned = correlations.flatMap((c) => c.linkedProtocols).filter((lp) => lp.alignment === "misaligned").length;

    let overallAssessment: string;
    if (driftCount === 0 && misaligned === 0 && optCount > 0) {
      overallAssessment = `Somatic feedback aligned with protocol architecture — ${optCount} optimization signal${optCount > 1 ? "s" : ""} detected. Current stack is producing measurable subjective improvement.`;
    } else if (driftCount > 0 || misaligned > 0) {
      overallAssessment = `${driftCount + misaligned} somatic-protocol misalignment${driftCount + misaligned > 1 ? "s" : ""} detected. Subjective state diverging from expected protocol response — recommend protocol review within 48h.`;
    } else if (summaries.length === 0) {
      overallAssessment = "Insufficient somatic data — log at least 3 days of subjective readings to enable protocol correlation analysis.";
    } else {
      overallAssessment = "Somatic channels within neutral range. Continue logging to build correlation baseline with active protocols.";
    }

    return {
      correlations,
      overallAssessment,
      generatedAt: now,
    };
  },
});
