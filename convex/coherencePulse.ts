import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   COHERENCE PULSE ENGINE
   
   Classifies every logged action into two categories:
   • COHERENCE — Positive actions that strengthen the biological field
     (Cold Plunge, Peptide Admin, Meditation, Supplement, Good Sleep)
     → Emits gold/blue ripple on BiologicalTwin
   
   • DRIFT — Negative signals that weaken the biological field
     (Missed sleep, high inflammation, protocol skip, high tension)
     → Shifts aura to low-frequency red pulse
   
   The LongevityScore feeds into the pulse intensity.
   Recent actions (last 2 hours) have the strongest visual effect.
   ═══════════════════════════════════════════════════════════════ */

export type PulseType = "coherence" | "drift" | "neutral";
export type PulseIntensity = "subtle" | "moderate" | "strong" | "surge";

interface PulseEvent {
  id: string;
  type: PulseType;
  intensity: PulseIntensity;
  label: string;
  icon: string;
  color: string;
  timestamp: number;
  decayMs: number;
}

/* ── Action Classification Map ── */

const COHERENCE_ACTIONS: Record<string, { label: string; icon: string; intensity: PulseIntensity }> = {
  // Interventions
  "cold_plunge":       { label: "Cold Plunge",           icon: "🧊", intensity: "strong" },
  "cold_exposure":     { label: "Cold Exposure",         icon: "🧊", intensity: "strong" },
  "sauna":             { label: "Sauna Session",         icon: "🔥", intensity: "moderate" },
  "breathwork":        { label: "Breathwork",            icon: "🌬️", intensity: "moderate" },
  "box_breathing":     { label: "Box Breathing",         icon: "🫁", intensity: "moderate" },
  "meditation":        { label: "Meditation",            icon: "🧘", intensity: "moderate" },
  "nsdr":              { label: "NSDR Session",          icon: "🧠", intensity: "strong" },
  "yoga_nidra":        { label: "Yoga Nidra",            icon: "🧘", intensity: "moderate" },
  "exercise":          { label: "Exercise",              icon: "💪", intensity: "moderate" },
  "zone2":             { label: "Zone 2 Cardio",         icon: "🏃", intensity: "strong" },
  "strength":          { label: "Strength Training",     icon: "🏋️", intensity: "moderate" },
  "stretching":        { label: "Stretching",            icon: "🤸", intensity: "subtle" },
  // Supplements & Peptides
  "supplement":        { label: "Supplement Taken",       icon: "💊", intensity: "subtle" },
  "peptide_admin":     { label: "Peptide Administration", icon: "💉", intensity: "surge" },
  "bpc_157":           { label: "BPC-157 Admin",          icon: "🧬", intensity: "surge" },
  "cjc_1295":          { label: "CJC-1295 Admin",         icon: "💉", intensity: "surge" },
  "tb_500":            { label: "TB-500 Admin",            icon: "🔬", intensity: "surge" },
  "ss_31":             { label: "SS-31 Admin",             icon: "⚡", intensity: "surge" },
  // Nutrition
  "fasting":           { label: "Fasting Window",         icon: "⏱️", intensity: "moderate" },
  "clean_meal":        { label: "Clean Meal",             icon: "🥗", intensity: "subtle" },
  "hydration":         { label: "Hydration Check",        icon: "💧", intensity: "subtle" },
  // Recovery
  "grounding":         { label: "Grounding",              icon: "🌍", intensity: "subtle" },
  "red_light":         { label: "Red Light Therapy",      icon: "🔴", intensity: "moderate" },
  "hyperbaric":        { label: "Hyperbaric O₂",          icon: "🫧", intensity: "strong" },
  // Protocol completion
  "protocol_complete": { label: "Protocol Completed",     icon: "✅", intensity: "moderate" },
};

const DRIFT_SIGNALS: Record<string, { label: string; icon: string; intensity: PulseIntensity }> = {
  "missed_sleep":       { label: "Sleep Deficit",          icon: "😴", intensity: "strong" },
  "poor_sleep":         { label: "Poor Sleep Quality",     icon: "🌙", intensity: "moderate" },
  "high_inflammation":  { label: "Inflammation Spike",     icon: "🔥", intensity: "strong" },
  "protocol_skip":      { label: "Protocol Skipped",       icon: "⏭️", intensity: "moderate" },
  "high_tension":       { label: "High Somatic Tension",   icon: "⚡", intensity: "moderate" },
  "hrv_drop":           { label: "HRV Decline",            icon: "📉", intensity: "strong" },
  "alcohol":            { label: "Alcohol Intake",          icon: "🍷", intensity: "strong" },
  "processed_food":     { label: "Processed Food",          icon: "🍔", intensity: "moderate" },
  "late_screen":        { label: "Late Screen Exposure",    icon: "📱", intensity: "subtle" },
  "missed_supplement":  { label: "Missed Supplement",       icon: "💊", intensity: "subtle" },
  "stress_spike":       { label: "Stress Spike",            icon: "😤", intensity: "moderate" },
  "dehydration":        { label: "Dehydration",             icon: "🏜️", intensity: "moderate" },
};

/* ═══════════════════════════════════════════════════════════════
   LOG COHERENCE EVENT — Called after any positive action
   ═══════════════════════════════════════════════════════════════ */

export const logCoherenceEvent = mutation({
  args: {
    sessionId: v.string(),
    actionKey: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const coherenceMatch = COHERENCE_ACTIONS[args.actionKey];
    const driftMatch = DRIFT_SIGNALS[args.actionKey];

    const pulseType: PulseType = coherenceMatch ? "coherence" : driftMatch ? "drift" : "neutral";
    const match = coherenceMatch || driftMatch;
    const intensity = match?.intensity ?? "subtle";

    // Decay time based on intensity
    const decayMs = intensity === "surge" ? 120000
      : intensity === "strong" ? 90000
      : intensity === "moderate" ? 60000
      : 30000;

    await ctx.db.insert("coherencePulses", {
      sessionId: args.sessionId,
      actionKey: args.actionKey,
      pulseType,
      intensity,
      label: match?.label ?? args.actionKey,
      icon: match?.icon ?? "◆",
      source: args.source ?? "manual",
      loggedAt: now,
      decayAt: now + decayMs,
    });

    return { pulseType, intensity, label: match?.label ?? args.actionKey };
  },
});

/* ═══════════════════════════════════════════════════════════════
   GET ACTIVE PULSE STATE — Real-time aura for BiologicalTwin
   
   Returns the dominant pulse type and intensity based on
   recent events (last 2 hours). Coherence and drift events
   compete — the dominant signal wins the aura color.
   ═══════════════════════════════════════════════════════════════ */

export const getActivePulseState = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowMs = 2 * 60 * 60 * 1000; // 2-hour window

    try {
      const recentPulses = await ctx.db
        .query("coherencePulses")
        .withIndex("by_sessionId_and_loggedAt", (q: any) =>
          q.eq("sessionId", args.sessionId).gte("loggedAt", now - windowMs)
        )
        .collect();

      if (recentPulses.length === 0) {
        return {
          dominantPulse: "neutral" as PulseType,
          intensity: "subtle" as PulseIntensity,
          coherenceScore: 50,
          recentEvents: [] as PulseEvent[],
          aura: {
            primaryColor: "#3B82F6",
            secondaryColor: "#60A5FA",
            glowColor: "rgba(59,130,246,0.20)",
            pulseSpeed: 4,
            rippleCount: 0,
          },
        };
      }

      // Score: coherence events add, drift events subtract
      const intensityWeight: Record<string, number> = {
        surge: 4, strong: 3, moderate: 2, subtle: 1,
      };

      let coherencePoints = 0;
      let driftPoints = 0;
      const events: PulseEvent[] = [];

      for (const p of recentPulses) {
        const weight = intensityWeight[p.intensity] ?? 1;
        // Time decay: events lose 50% weight after 1 hour
        const age = now - p.loggedAt;
        const timeFactor = age < 600000 ? 1.0 : age < 3600000 ? 0.75 : 0.5;
        const effectiveWeight = weight * timeFactor;

        if (p.pulseType === "coherence") {
          coherencePoints += effectiveWeight;
        } else if (p.pulseType === "drift") {
          driftPoints += effectiveWeight;
        }

        // Only include still-active (non-decayed) events for ripple display
        if (p.decayAt > now) {
          const match = COHERENCE_ACTIONS[p.actionKey] || DRIFT_SIGNALS[p.actionKey];
          events.push({
            id: p._id,
            type: p.pulseType as PulseType,
            intensity: p.intensity as PulseIntensity,
            label: p.label,
            icon: match?.icon ?? p.icon ?? "◆",
            color: p.pulseType === "coherence" ? "#FFD700" : "#FF6B6B",
            timestamp: p.loggedAt,
            decayMs: p.decayAt - now,
          });
        }
      }

      // Coherence score: 0-100 where 50 is neutral
      const total = coherencePoints + driftPoints;
      const coherenceScore = total > 0
        ? Math.round((coherencePoints / total) * 100)
        : 50;

      // Determine dominant pulse
      const dominantPulse: PulseType = coherenceScore > 60 ? "coherence"
        : coherenceScore < 40 ? "drift"
        : "neutral";

      // Determine intensity from the most recent active event
      const activeEvents = events.filter(e => e.decayMs > 0);
      const latestActive = activeEvents.sort((a, b) => b.timestamp - a.timestamp)[0];
      const dominantIntensity: PulseIntensity = latestActive?.intensity ?? "subtle";

      // Calculate aura visual properties
      const aura = dominantPulse === "coherence" ? {
        primaryColor: coherenceScore > 80 ? "#FFD700" : "#00FFCC",
        secondaryColor: coherenceScore > 80 ? "#FFA500" : "#3B82F6",
        glowColor: coherenceScore > 80
          ? `rgba(255,215,0,${0.15 + (coherenceScore - 50) * 0.004})`
          : `rgba(0,255,204,${0.15 + (coherenceScore - 50) * 0.003})`,
        pulseSpeed: dominantIntensity === "surge" ? 1.2
          : dominantIntensity === "strong" ? 1.8
          : dominantIntensity === "moderate" ? 2.5 : 3.5,
        rippleCount: activeEvents.filter(e => e.type === "coherence").length,
      } : dominantPulse === "drift" ? {
        primaryColor: "#FF6B6B",
        secondaryColor: "#EF4444",
        glowColor: `rgba(255,107,107,${0.12 + (50 - coherenceScore) * 0.004})`,
        pulseSpeed: dominantIntensity === "strong" ? 5.0
          : dominantIntensity === "moderate" ? 6.0 : 7.0,
        rippleCount: activeEvents.filter(e => e.type === "drift").length,
      } : {
        primaryColor: "#3B82F6",
        secondaryColor: "#60A5FA",
        glowColor: "rgba(59,130,246,0.15)",
        pulseSpeed: 4.0,
        rippleCount: 0,
      };

      return {
        dominantPulse,
        intensity: dominantIntensity,
        coherenceScore,
        recentEvents: events.slice(0, 8),
        aura,
      };
    } catch {
      return {
        dominantPulse: "neutral" as PulseType,
        intensity: "subtle" as PulseIntensity,
        coherenceScore: 50,
        recentEvents: [] as PulseEvent[],
        aura: {
          primaryColor: "#3B82F6",
          secondaryColor: "#60A5FA",
          glowColor: "rgba(59,130,246,0.15)",
          pulseSpeed: 4,
          rippleCount: 0,
        },
      };
    }
  },
});
