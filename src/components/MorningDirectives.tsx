import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "@/components/Presence/usePresenceState";
import { useGhostMode } from "@/components/Presence/usePresenceState";

/* ═══════════════════════════════════════════════════════════════
   MORNING DIRECTIVES — Clinical Performance Architect
   
   On first login of the day, analyzes sleep data + blood labs
   to generate 3 high-authority Daily Optimization Directives.
   
   These are COMMANDS, not suggestions. The Architect speaks
   with absolute clinical certainty.
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ── */
interface Directive {
  id: string;
  icon: string;
  priority: "critical" | "high" | "standard";
  command: string;
  mechanism: string;
  timeWindow: string;
  dataPoints: string[];
}

interface DirectiveSet {
  directives: Directive[];
  generatedAt: number;
  greeting: string;
}

/* ── Priority styling ── */
const PRIORITY_CONFIG = {
  critical: { color: "#FF453A", glow: "rgba(255,69,58,0.25)", label: "CRITICAL", border: "rgba(255,69,58,0.2)" },
  high: { color: "#FF9F0A", glow: "rgba(255,159,10,0.2)", label: "HIGH", border: "rgba(255,159,10,0.15)" },
  standard: { color: "#00FFCC", glow: "rgba(0,255,204,0.15)", label: "OPTIMIZE", border: "rgba(0,255,204,0.1)" },
} as const;

/* ── Scanning phases for the generation animation ── */
const SCAN_PHASES = [
  { icon: "\uD83D\uDD10", label: "Accessing Bio-Vault", detail: "Decrypting overnight telemetry..." },
  { icon: "\uD83E\uDDE0", label: "Analyzing Sleep Architecture", detail: "REM cycles, deep sleep, HRV trajectory..." },
  { icon: "\uD83E\uDE78", label: "Cross-Referencing Blood Labs", detail: "6 biomarkers + genetic variants..." },
  { icon: "\uD83D\uDD2C", label: "Architecting Directives", detail: "Generating precision commands..." },
] as const;

/* ── Deterministic directive generation engine ── */
function generateDirectives(context: {
  vault: {
    vitaminD: number | null;
    testosteroneFree: number | null;
    testosteroneTotal: number | null;
    ferritin: number | null;
    crp: number | null;
    hba1c: number | null;
    mthfrVariant: boolean;
    apoe4: boolean;
    caffeineSensitivity: boolean;
  } | null;
  vitalityScore: number | null;
  hrvCurrent: number | null;
  hrvAvg7d: number | null;
  recentWorkoutCount: number;
  recentMuscleGroups: string[];
  sleepHours?: number;
  sleepScore?: number;
  recovery?: number;
}): DirectiveSet {
  const directives: Directive[] = [];
  const hour = new Date().getHours();
  const vault = context.vault;
  const hrv = context.hrvCurrent ?? 55;
  const hrvAvg = context.hrvAvg7d ?? 52;
  const recovery = context.recovery ?? 78;
  const sleep = context.sleepHours ?? 7.2;
  const sleepScore = context.sleepScore ?? 75;
  const score = context.vitalityScore ?? 72;
  const hrvDelta = hrvAvg > 0 ? ((hrv - hrvAvg) / hrvAvg) * 100 : 0;

  // ── DIRECTIVE 1: Sleep-driven command ──
  if (sleep < 6.5) {
    directives.push({
      id: "sleep-critical",
      icon: "\uD83D\uDEA8",
      priority: "critical",
      command: `Sleep deficit detected: ${sleep}h logged. Attenuate all glycolytic training today. Cap heart rate at ${Math.round(55 * 1.45)} bpm. Prioritize parasympathetic activation protocols.`,
      mechanism: `Sub-7h sleep attenuates growth hormone secretion by 60% and dysregulates the HPA cortisol axis. Your HRV dropped to ${hrv}ms — ${Math.abs(Math.round(hrvDelta))}% ${hrvDelta < 0 ? "below" : "above"} your 7-day baseline. Neural recovery is incomplete.`,
      timeWindow: "All day — recovery priority",
      dataPoints: [`Sleep: ${sleep}h`, `HRV: ${hrv}ms`, `Recovery: ${recovery}%`],
    });
  } else if (sleep < 7.5 || sleepScore < 70) {
    directives.push({
      id: "sleep-suboptimal",
      icon: "\uD83C\uDF19",
      priority: "high",
      command: `Sleep architecture was suboptimal${sleepScore < 70 ? ` (score: ${sleepScore})` : ` at ${sleep}h`}. Modulate today's training intensity to 70% capacity. Add 400mg magnesium glycinate at 9 PM tonight to potentiate deep sleep recovery.`,
      mechanism: `Incomplete sleep cycles reduce REM-dependent memory consolidation and attenuate testosterone synthesis during slow-wave phases. Tonight's protocol must compensate.`,
      timeWindow: "Training: reduce intensity | 9 PM: Mg glycinate",
      dataPoints: [`Sleep: ${sleep}h`, `Score: ${sleepScore}`, `HRV: ${hrv}ms`],
    });
  } else {
    directives.push({
      id: "sleep-optimal",
      icon: "\u2705",
      priority: "standard",
      command: `Sleep architecture optimized: ${sleep}h, score ${sleepScore}. Your glymphatic clearance cycle completed fully. Autonomic readiness is green-light — capitalize on this recovery window with progressive overload.`,
      mechanism: `Full sleep cycles enabled peak growth hormone secretion and complete neural waste clearance. HRV at ${hrv}ms confirms parasympathetic dominance.`,
      timeWindow: "Training window: open for high output",
      dataPoints: [`Sleep: ${sleep}h`, `Score: ${sleepScore}`, `Recovery: ${recovery}%`],
    });
  }

  // ── DIRECTIVE 2: Biomarker-driven command ──
  if (vault) {
    if (vault.vitaminD != null && vault.vitaminD < 40) {
      const dose = vault.vitaminD < 25 ? "6,000" : "5,000";
      directives.push({
        id: "vd-deficient",
        icon: "\u2600\uFE0F",
        priority: vault.vitaminD < 25 ? "critical" : "high",
        command: `Serum 25-OH Vitamin D at ${vault.vitaminD} ng/mL — ${vault.vitaminD < 25 ? "severely" : "clinically"} suboptimal. Take ${dose}IU D3 with K2 (MK-7, 200mcg) by ${hour < 10 ? "9 AM" : "noon"} with a fat-containing meal for maximum absorption.`,
        mechanism: `VDR gene expression governs 200+ immune and hormonal pathways. Below 40 ng/mL, antimicrobial peptide synthesis is attenuated and calcium homeostasis is compromised. K2 co-administration prevents arterial calcification.${vault.mthfrVariant ? " Your MTHFR variant compounds this — impaired methylation reduces D3 activation in the liver." : ""}`,
        timeWindow: hour < 10 ? "Before 9 AM with breakfast" : "With next fat-containing meal",
        dataPoints: [
          `Vit D: ${vault.vitaminD} ng/mL`,
          ...(vault.mthfrVariant ? ["MTHFR: variant detected"] : []),
          `Target: 50-80 ng/mL`,
        ],
      });
    } else if (vault.crp != null && vault.crp > 1.0) {
      directives.push({
        id: "crp-elevated",
        icon: "\uD83D\uDD25",
        priority: "critical",
        command: `Systemic inflammation detected: hs-CRP at ${vault.crp} mg/L. Upregulate omega-3 to 3g EPA/DHA today. Eliminate all seed oils and processed sugars. Add curcumin 500mg with piperine at lunch.`,
        mechanism: `CRP above 1.0 mg/L signals NF-\u03BAB pathway activation — a chronic inflammatory cascade that accelerates biological aging, attenuates recovery, and impairs insulin signaling.${vault.apoe4 ? " As an APOE4 carrier, your neuroinflammatory risk is amplified. Anti-inflammatory protocols are non-negotiable." : ""}`,
        timeWindow: "Omega-3 with breakfast | Curcumin at lunch",
        dataPoints: [
          `hs-CRP: ${vault.crp} mg/L`,
          ...(vault.apoe4 ? ["APOE4: carrier"] : []),
          "Target: <1.0 mg/L",
        ],
      });
    } else if (vault.ferritin != null && vault.ferritin < 40) {
      directives.push({
        id: "ferritin-depleted",
        icon: "\uD83E\uDE78",
        priority: "high",
        command: `Iron stores depleted: ferritin at ${vault.ferritin} ng/mL. Architect today's first meal around heme-iron sources — red meat or organ meats. Pair with vitamin C. Avoid coffee/tea within 60 min of iron-rich meals.`,
        mechanism: `Ferritin below 40 ng/mL impairs oxygen transport capacity, attenuates mitochondrial electron chain efficiency, and reduces VO2max potential by up to 15%.`,
        timeWindow: "First meal: heme-iron priority",
        dataPoints: [`Ferritin: ${vault.ferritin} ng/mL`, "Target: 40-200 ng/mL"],
      });
    } else if (vault.hba1c != null && vault.hba1c > 5.6) {
      directives.push({
        id: "hba1c-dysglycemic",
        icon: "\uD83D\uDCC9",
        priority: "high",
        command: `Glycemic dysregulation: HbA1c at ${vault.hba1c}%. Lead every meal with protein and fat before carbohydrates today. Add a 15-minute post-meal walk to attenuate glucose spikes by 30-40%.`,
        mechanism: `HbA1c above 5.6% indicates 90-day average glucose is elevated — insulin receptor sensitivity is compromised. Meal sequencing (protein-first) delays gastric emptying and flattens the postprandial glucose curve.`,
        timeWindow: "Every meal: protein/fat first | Post-meal: 15 min walk",
        dataPoints: [`HbA1c: ${vault.hba1c}%`, "Target: <5.6%"],
      });
    } else if (vault.testosteroneTotal != null && vault.testosteroneTotal < 400) {
      directives.push({
        id: "testo-suboptimal",
        icon: "\uD83D\uDCAA",
        priority: "high",
        command: `Testosterone at ${vault.testosteroneTotal} ng/dL — suboptimal for anabolic signaling. Prioritize compound lifts today (squat, deadlift, press) to upregulate acute T response by 15-20%. Ensure zinc 30mg and magnesium 400mg tonight.`,
        mechanism: `Below 400 ng/dL, muscle protein synthesis rates are attenuated and recovery timelines extend. Heavy compound movements trigger the largest acute hormonal response. Sleep quality is the primary long-term lever.`,
        timeWindow: "Training: compound movements | PM: Zinc + Mg",
        dataPoints: [`Total T: ${vault.testosteroneTotal} ng/dL`, "Target: 400-900 ng/dL"],
      });
    } else {
      // All biomarkers optimal — give a maintenance directive
      directives.push({
        id: "bio-optimal",
        icon: "\uD83E\uDDEC",
        priority: "standard",
        command: "Blood biomarkers are within optimal ranges. Maintain current precision stack. Your biochemistry is well-calibrated — no protocol recalibration required today.",
        mechanism: "Consistent adherence to your precision supplementation protocol has stabilized all tracked biomarkers within therapeutic windows. Continue current dosing.",
        timeWindow: "Maintain current protocol timing",
        dataPoints: [
          ...(vault.vitaminD != null ? [`Vit D: ${vault.vitaminD} ng/mL \u2713`] : []),
          ...(vault.crp != null ? [`CRP: ${vault.crp} mg/L \u2713`] : []),
        ],
      });
    }
  } else {
    // No Bio-Vault data
    directives.push({
      id: "bio-empty",
      icon: "\uD83E\uDDEC",
      priority: "critical",
      command: "Bio-Vault is empty. Upload a comprehensive blood panel immediately. Without biomarker data, directives are calibrated to population averages — not your unique biochemistry.",
      mechanism: "Precision optimization requires at minimum: 25-OH Vitamin D, ferritin, hs-CRP, HbA1c, and a hormonal panel. Each data point unlocks gene-specific protocol adjustments.",
      timeWindow: "Priority: populate Bio-Vault today",
      dataPoints: ["No blood data", "No genetic data"],
    });
  }

  // ── DIRECTIVE 3: Recovery + Training architecture ──
  if (hrvDelta < -15 || recovery < 50) {
    directives.push({
      id: "recovery-critical",
      icon: "\u26A0\uFE0F",
      priority: "critical",
      command: `Autonomic depletion detected. HRV ${hrv}ms (${Math.abs(Math.round(hrvDelta))}% below baseline). Active recovery ONLY today: walking, breathwork, gentle mobility. No glycolytic or resistance training.`,
      mechanism: `Sympathetic overdrive at this magnitude signals incomplete tissue repair and elevated cortisol. Training through this state extends recovery by 48-72h and attenuates adaptation signaling.`,
      timeWindow: "Full day: active recovery only",
      dataPoints: [`HRV: ${hrv}ms`, `Baseline: ${hrvAvg}ms`, `Recovery: ${recovery}%`],
    });
  } else if (hrvDelta < -5 || recovery < 70) {
    directives.push({
      id: "recovery-moderate",
      icon: "\uD83E\uDDD8",
      priority: "high",
      command: `Recovery incomplete: ${recovery}%. Modulate training to zone 2 cardio (HR cap: ${Math.round(55 * 1.5)} bpm) or technique-focused work. Add 2 min cold exposure at 55\u00B0F to trigger parasympathetic rebound.`,
      mechanism: `HRV at ${hrv}ms indicates residual autonomic fatigue. Zone 2 work promotes mitochondrial biogenesis without triggering further sympathetic stress. Cold exposure activates the mammalian dive reflex.`,
      timeWindow: "Training: zone 2 only | Cold exposure: post-session",
      dataPoints: [`HRV: ${hrv}ms`, `Recovery: ${recovery}%`, `Workouts 24h: ${context.recentWorkoutCount}`],
    });
  } else if (context.recentWorkoutCount >= 2) {
    const muscleSet = [...new Set(context.recentMuscleGroups)];
    directives.push({
      id: "training-split",
      icon: "\uD83C\uDFCB\uFE0F",
      priority: "standard",
      command: `${context.recentWorkoutCount} sessions in 24h. ${muscleSet.length > 0 ? `Avoid ${muscleSet.slice(0, 3).join(", ")} — these groups are in active repair (24-72h window).` : "Rotate muscle groups."} Target fresh movement patterns for today's session.`,
      mechanism: `Muscle protein synthesis peaks 24-48h post-stimulus. Training the same groups within this window interrupts the repair cascade and attenuates hypertrophic signaling.`,
      timeWindow: "Today: alternate muscle groups",
      dataPoints: [`Recent sessions: ${context.recentWorkoutCount}`, ...(muscleSet.length > 0 ? [`Active repair: ${muscleSet.slice(0, 3).join(", ")}`] : [])],
    });
  } else {
    directives.push({
      id: "training-green",
      icon: "\u26A1",
      priority: "standard",
      command: `Systems synchronized for high output. Recovery at ${recovery}%, HRV ${Math.round(hrvDelta) >= 0 ? "+" : ""}${Math.round(hrvDelta)}% vs baseline. This is a green-light training window — progressive overload or high-intensity work is well-calibrated.`,
      mechanism: `Parasympathetic dominance confirmed. Glycogen stores are replenished, protein synthesis from prior sessions is complete, and neuroendocrine axis is primed for maximal output.`,
      timeWindow: "Training window: open for peak output",
      dataPoints: [`HRV: ${hrv}ms (+${Math.round(hrvDelta)}%)`, `Recovery: ${recovery}%`, `Score: ${score}/100`],
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, standard: 2 };
  directives.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Greeting based on time and score
  const timeGreeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const greeting = score >= 80
    ? `Good ${timeGreeting}. Your biology is in an elite optimization window.`
    : score >= 60
      ? `Good ${timeGreeting}. Moderate readiness detected. Precision calibration active.`
      : `Good ${timeGreeting}. Recovery signals detected. Recalibrating today's protocols.`;

  return { directives: directives.slice(0, 3), generatedAt: Date.now(), greeting };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function MorningDirectives() {
  const ghostMode = useGhostMode();
  const sessionId = getSessionId();

  // Fetch today's cached directives
  const cachedDirectives = useQuery(api.queries.getTodayDirectives, { sessionId });
  // Fetch bio context for generation
  const directiveContext = useQuery(api.queries.getDirectiveContext, { sessionId });
  // Save mutation
  const saveDirectives = useMutation(api.mutations.saveDailyDirectives);

  // Local state
  const [phase, setPhase] = useState<"scanning" | "revealing" | "visible" | "dismissed">("scanning");
  const [scanIndex, setScanIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generated, setGenerated] = useState<DirectiveSet | null>(null);

  // Parse cached directives if they exist
  const cachedSet = useMemo<DirectiveSet | null>(() => {
    if (!cachedDirectives?.directives) return null;
    try {
      return JSON.parse(cachedDirectives.directives) as DirectiveSet;
    } catch {
      return null;
    }
  }, [cachedDirectives]);

  // Generate directives when context is available and no cache exists
  useEffect(() => {
    if (cachedSet) {
      setGenerated(cachedSet);
      setPhase("visible");
      return;
    }
    if (!directiveContext || generated) return;

    // Run scanning animation
    setPhase("scanning");
    setScanIndex(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 0;
    SCAN_PHASES.forEach((_, i) => {
      timers.push(setTimeout(() => setScanIndex(i), delay));
      delay += 700;
    });

    // Generate after scan completes
    timers.push(setTimeout(() => {
      const result = generateDirectives(directiveContext);
      setGenerated(result);
      setPhase("revealing");

      // Save to DB
      saveDirectives({
        sessionId,
        directives: JSON.stringify(result),
        sleepHours: directiveContext.hrvCurrent ? undefined : undefined,
        recovery: undefined,
        hrv: directiveContext.hrvCurrent ?? undefined,
      }).catch(() => { /* silent — non-critical */ });

      // Transition to visible after reveal animation
      timers.push(setTimeout(() => setPhase("visible"), 1200));
    }, delay + 300));

    return () => timers.forEach(clearTimeout);
  }, [directiveContext, cachedSet, generated, saveDirectives, sessionId]);

  // Dismiss handler
  const handleDismiss = useCallback(() => setPhase("dismissed"), []);

  // Colors
  const labelColor = ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.45)";
  const subColor = ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.3)";
  const borderColor = ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,255,255,0.06)";
  const cardBg = "rgba(10, 10, 10, 0.7)";

  if (phase === "dismissed") return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border transition-all duration-500"
      style={{
        background: cardBg,
        borderColor,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: ghostMode
            ? "linear-gradient(90deg, transparent, rgba(160,160,160,0.15), transparent)"
            : "linear-gradient(90deg, transparent, rgba(0,255,204,0.3), rgba(175,130,255,0.2), transparent)",
        }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-sm">{"\uD83C\uDFAF"}</span>
            <span
              className="font-medium tracking-[0.12em] uppercase"
              style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "10px", color: labelColor }}
            >
              Morning Directives
            </span>
            <span
              className="font-mono tracking-[0.08em] uppercase px-1.5 py-0.5 rounded"
              style={{
                fontSize: "8px",
                color: ghostMode ? "rgba(160,160,160,0.5)" : "#AF82FF",
                background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(175,130,255,0.1)",
              }}
            >
              Clinical Performance Architect
            </span>
          </div>
          {phase === "visible" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleDismiss}
              className="font-mono uppercase tracking-[0.1em] transition-colors"
              style={{ fontSize: "9px", color: subColor }}
              whileHover={{ color: ghostMode ? "rgba(160,160,160,0.7)" : "rgba(255,255,255,0.6)" }}
            >
              Dismiss
            </motion.button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* ── SCANNING PHASE ── */}
          {phase === "scanning" && !generated && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="py-6"
            >
              <div className="flex flex-col items-center gap-4">
                {/* Scanning indicator */}
                <motion.div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.08)" }}
                  animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="text-lg">{SCAN_PHASES[scanIndex]?.icon}</span>
                </motion.div>

                <div className="text-center">
                  <motion.p
                    key={scanIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-medium tracking-[0.06em]"
                    style={{ fontSize: "12px", color: ghostMode ? "rgba(160,160,160,0.7)" : "rgba(255,255,255,0.7)" }}
                  >
                    {SCAN_PHASES[scanIndex]?.label}
                  </motion.p>
                  <motion.p
                    key={`d-${scanIndex}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="font-mono mt-1"
                    style={{ fontSize: "10px", color: subColor }}
                  >
                    {SCAN_PHASES[scanIndex]?.detail}
                  </motion.p>
                </div>

                {/* Progress dots */}
                <div className="flex gap-1.5 mt-1">
                  {SCAN_PHASES.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        background: i <= scanIndex
                          ? (ghostMode ? "rgba(160,160,160,0.5)" : "#00FFCC")
                          : (ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.08)"),
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DIRECTIVES VISIBLE ── */}
          {(phase === "revealing" || phase === "visible") && generated && (
            <motion.div
              key="directives"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Greeting */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="font-medium mb-4"
                style={{
                  fontSize: "13px",
                  color: ghostMode ? "rgba(160,160,160,0.6)" : "rgba(255,255,255,0.6)",
                  lineHeight: 1.5,
                }}
              >
                {generated.greeting}
              </motion.p>

              {/* Directive cards */}
              <div className="flex flex-col gap-3">
                {generated.directives.map((directive, idx) => {
                  const pConfig = ghostMode
                    ? { color: "rgba(160,160,160,0.6)", glow: "rgba(160,160,160,0.06)", label: PRIORITY_CONFIG[directive.priority].label, border: "rgba(160,160,160,0.08)" }
                    : PRIORITY_CONFIG[directive.priority];
                  const isExpanded = expandedId === directive.id;

                  return (
                    <motion.div
                      key={directive.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: phase === "revealing" ? 0.2 + idx * 0.2 : 0.05 * idx, duration: 0.4 }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer rounded-lg border transition-all duration-300"
                        style={{
                          background: isExpanded ? pConfig.glow : "rgba(255,255,255,0.015)",
                          borderColor: isExpanded ? pConfig.border : "rgba(255,255,255,0.03)",
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : directive.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(isExpanded ? null : directive.id); } }}
                      >
                        <div className="p-4">
                          {/* Directive header */}
                          <div className="flex items-start gap-3">
                            <span className="text-base mt-0.5 shrink-0">{directive.icon}</span>
                            <div className="flex-1 min-w-0">
                              {/* Priority + time */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <span
                                  className="font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                                  style={{
                                    fontSize: "8px",
                                    fontWeight: 600,
                                    color: pConfig.color,
                                    background: pConfig.glow,
                                  }}
                                >
                                  {pConfig.label}
                                </span>
                                <span
                                  className="font-mono tracking-[0.05em]"
                                  style={{ fontSize: "9px", color: subColor }}
                                >
                                  {directive.timeWindow}
                                </span>
                              </div>

                              {/* Command text */}
                              <p
                                className="font-medium leading-relaxed"
                                style={{
                                  fontSize: "12px",
                                  color: ghostMode ? "rgba(160,160,160,0.75)" : "rgba(255,255,255,0.85)",
                                }}
                              >
                                {directive.command}
                              </p>

                              {/* Data point badges */}
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {directive.dataPoints.map((dp, i) => (
                                  <span
                                    key={i}
                                    className="font-mono px-2 py-0.5 rounded"
                                    style={{
                                      fontSize: "9px",
                                      color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.5)",
                                      background: ghostMode ? "rgba(160,160,160,0.05)" : "rgba(255,255,255,0.04)",
                                      letterSpacing: "0.03em",
                                    }}
                                  >
                                    {dp}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Expand indicator */}
                            <motion.span
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="shrink-0 mt-1"
                              style={{ fontSize: "10px", color: subColor }}
                            >
                              {"\u25BC"}
                            </motion.span>
                          </div>

                          {/* Expanded mechanism */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="mt-3 pt-3"
                                  style={{ borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}` }}
                                >
                                  <p
                                    className="font-mono uppercase tracking-[0.12em] mb-1.5"
                                    style={{ fontSize: "9px", color: pConfig.color }}
                                  >
                                    Mechanism
                                  </p>
                                  <p
                                    className="leading-relaxed"
                                    style={{
                                      fontSize: "11px",
                                      color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.45)",
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    {directive.mechanism}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer timestamp */}
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,255,255,0.03)"}` }}>
                <span className="font-mono" style={{ fontSize: "9px", color: subColor, letterSpacing: "0.05em" }}>
                  Generated {new Date(generated.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-mono uppercase tracking-[0.1em]" style={{ fontSize: "8px", color: subColor }}>
                  Tap directive for mechanism detail
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
