import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { TimerTarget } from "./ProtocolTimer";

const WARM = {
  terra: "#E8976C",
  sage: "#7CB68E",
  sky: "#6BA3BE",
  gold: "#C4A46C",
  rose: "#D4847A",
  sand: "#E8E0D8",
  cardBg: "rgba(26,24,22,0.92)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
  redline: "#FF3B30",
  redlineGlow: "rgba(255,59,48,0.4)",
  criticalRed: "#FF2D20",
  warningAmber: "#FFB020",
};

const SUPPORT_OPTIONS = [
  { type: "encouragement", emoji: "💪", label: "You got this!", message: "Stay strong — your squad believes in you. One step at a time." },
  { type: "recovery_tip", emoji: "🧘", label: "Recovery tip", message: "Try 10 min of box breathing or a cold plunge to reset your nervous system." },
  { type: "recovery_tip", emoji: "😴", label: "Sleep protocol", message: "Prioritize 8+ hours tonight. Magnesium glycinate 400mg before bed." },
  { type: "check_in", emoji: "👋", label: "Check in", message: "Hey — noticed your vitals dipped. How are you feeling? We're here for you." },
  { type: "encouragement", emoji: "🔥", label: "Motivation", message: "Temporary setback, permanent comeback. Your baseline is still elite." },
  { type: "recovery_tip", emoji: "💧", label: "Hydrate", message: "Dehydration tanks HRV fast. Aim for 3L today with electrolytes." },
];

/* ── Threshold constants ── */
const HRV_REDLINE_THRESHOLD = 40;   // HRV below 40ms = redline
const HR_REDLINE_THRESHOLD = 100;   // HR above 100bpm while stationary = redline
const STRESS_REDLINE_THRESHOLD = 70; // Stress above 70% = redline

interface VitalsSnapshot {
  hr: number;
  spo2: number;
  stress: number;
  recovery: number;
}

interface VitalsRedlineAlert {
  metric: string;
  label: string;
  emoji: string;
  currentValue: number;
  threshold: number;
  unit: string;
  severity: "warning" | "critical";
  direction: "above" | "below";
}

function detectVitalsRedlines(vitals: VitalsSnapshot | null): VitalsRedlineAlert[] {
  if (!vitals) return [];
  const alerts: VitalsRedlineAlert[] = [];

  // Simulate HRV from recovery (recovery 82 → HRV ~65ms, recovery 40 → HRV ~30ms)
  const estimatedHrv = Math.round(vitals.recovery * 0.8);

  if (estimatedHrv < HRV_REDLINE_THRESHOLD) {
    alerts.push({
      metric: "hrv",
      label: "Heart Rate Variability",
      emoji: "💓",
      currentValue: estimatedHrv,
      threshold: HRV_REDLINE_THRESHOLD,
      unit: "ms",
      severity: estimatedHrv < 25 ? "critical" : "warning",
      direction: "below",
    });
  }

  if (vitals.hr > HR_REDLINE_THRESHOLD) {
    alerts.push({
      metric: "hr",
      label: "Resting Heart Rate",
      emoji: "❤️‍🔥",
      currentValue: vitals.hr,
      threshold: HR_REDLINE_THRESHOLD,
      unit: "bpm",
      severity: vitals.hr > 115 ? "critical" : "warning",
      direction: "above",
    });
  }

  if (vitals.stress > STRESS_REDLINE_THRESHOLD) {
    alerts.push({
      metric: "stress",
      label: "Stress Index",
      emoji: "🧠",
      currentValue: vitals.stress,
      threshold: STRESS_REDLINE_THRESHOLD,
      unit: "%",
      severity: vitals.stress > 80 ? "critical" : "warning",
      direction: "above",
    });
  }

  return alerts;
}

interface RedlineOverlayProps {
  sessionId: string;
  ghostMode: boolean;
  /** Real-time vitals from useSimulatedVitals */
  vitals?: VitalsSnapshot | null;
  /** Callback to trigger ProtocolTimer with box breathing */
  onTriggerBoxBreathing?: (target: TimerTarget) => void;
}

export function RedlineOverlay({ sessionId, ghostMode, vitals, onTriggerBoxBreathing }: RedlineOverlayProps) {
  const squadRedlines = useQuery(api.redlineDetection.getSquadRedlines, { currentSessionId: sessionId });
  const myRedline = useQuery(api.redlineDetection.getRedlineStatus, { sessionId });
  const warState = useQuery(api.redlineDetection.getWarState, { sessionId });
  const squadWarAlerts = useQuery(api.redlineDetection.getSquadWarAlerts, { sessionId });
  const deploySupportMut = useMutation(api.redlineDetection.deploySupport);

  const [expandedPeer, setExpandedPeer] = useState<string | null>(null);
  const [sentSupport, setSentSupport] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [warDismissed, setWarDismissed] = useState(false);
  const [squadWarDismissed, setSquadWarDismissed] = useState<Set<string>>(new Set());
  const [vitalsRedlineDismissed, setVitalsRedlineDismissed] = useState(false);
  const [breathingTriggered, setBreathingTriggered] = useState(false);

  const redlinedPeers = useMemo(() => {
    if (!squadRedlines) return [];
    return squadRedlines.filter((p) => p.isRedlined);
  }, [squadRedlines]);

  // Detect vitals-based redlines from SimulatedVitals hook
  const vitalsAlerts = useMemo(() => detectVitalsRedlines(vitals ?? null), [vitals]);
  const hasVitalsRedline = vitalsAlerts.length > 0 && !vitalsRedlineDismissed;
  const vitalsMaxSeverity = vitalsAlerts.some(a => a.severity === "critical") ? "critical" : "warning";

  // Auto-reset dismissed state when vitals return to normal
  useEffect(() => {
    if (vitalsAlerts.length === 0 && vitalsRedlineDismissed) {
      setVitalsRedlineDismissed(false);
      setBreathingTriggered(false);
    }
  }, [vitalsAlerts.length, vitalsRedlineDismissed]);

  // Dispatch edge pulse event for FluidCanvas red glow rendering
  useEffect(() => {
    if (hasVitalsRedline) {
      window.dispatchEvent(new CustomEvent("vive-vitals-redline", {
        detail: { active: true, severity: vitalsMaxSeverity, alerts: vitalsAlerts },
      }));
    } else {
      window.dispatchEvent(new CustomEvent("vive-vitals-redline", {
        detail: { active: false, severity: "nominal", alerts: [] },
      }));
    }
  }, [hasVitalsRedline, vitalsMaxSeverity, vitalsAlerts]);

  // Dispatch war state event to FluidCanvas for red pulse rendering
  useEffect(() => {
    if (warState?.active && !warDismissed) {
      window.dispatchEvent(new CustomEvent("vive-redline-war", {
        detail: { active: true, severity: warState.severity, sessionId },
      }));
    } else {
      window.dispatchEvent(new CustomEvent("vive-redline-war", {
        detail: { active: false, severity: "nominal", sessionId },
      }));
    }
  }, [warState?.active, warState?.severity, warDismissed, sessionId]);

  const handleDeploySupport = useCallback(async (peerId: string, peerName: string, option: typeof SUPPORT_OPTIONS[0]) => {
    setSending(true);
    try {
      await deploySupportMut({
        fromSessionId: sessionId,
        toPeerId: peerId,
        toPeerName: peerName,
        message: option.message,
        supportType: option.type,
      });
      setSentSupport((prev) => new Set(prev).add(`${peerId}-${option.type}`));
    } catch (e) {
      console.error("Failed to deploy support:", e);
    }
    setSending(false);
  }, [sessionId, deploySupportMut]);

  const handleTriggerBoxBreathing = useCallback(() => {
    setBreathingTriggered(true);
    onTriggerBoxBreathing?.({
      protocolId: "box-breathing-emergency",
      protocolName: "Box Breathing",
      icon: "🫁",
      category: "recovery",
      durationSeconds: 5 * 60,
    });
  }, [onTriggerBoxBreathing]);

  if (ghostMode) return null;

  const hasMyRedline = myRedline?.isRedlined;
  const hasSquadRedlines = redlinedPeers.length > 0;
  const isWarActive = warState?.active && !warDismissed;
  const activeSquadWars = (squadWarAlerts ?? []).filter((a) => !squadWarDismissed.has(a._id));

  if (!hasMyRedline && !hasSquadRedlines && !isWarActive && activeSquadWars.length === 0 && !hasVitalsRedline) return null;

  return (
    <div className="mx-5 mb-4 space-y-3">

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── VITALS REDLINE: Threshold-based real-time stress alert ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {hasVitalsRedline && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="rounded-2xl overflow-hidden relative"
            style={{
              background: vitalsMaxSeverity === "critical"
                ? "linear-gradient(135deg, rgba(255,20,20,0.14) 0%, rgba(140,10,10,0.10) 100%)"
                : "linear-gradient(135deg, rgba(255,59,48,0.10) 0%, rgba(180,30,20,0.06) 100%)",
              border: `2px solid ${vitalsMaxSeverity === "critical" ? "rgba(255,20,20,0.55)" : "rgba(255,59,48,0.35)"}`,
              boxShadow: vitalsMaxSeverity === "critical"
                ? "0 0 50px rgba(255,20,20,0.25), 0 0 100px rgba(255,20,20,0.08), inset 0 1px 0 rgba(255,255,255,0.04)"
                : "0 0 35px rgba(255,59,48,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Deep red edge pulse overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: vitalsMaxSeverity === "critical"
                  ? "radial-gradient(ellipse 120% 100% at 50% 0%, rgba(255,20,20,0.22) 0%, transparent 50%)"
                  : "radial-gradient(ellipse 120% 100% at 50% 0%, rgba(255,59,48,0.15) 0%, transparent 50%)",
                animation: "vitalsRedlinePulse 1.4s ease-in-out infinite",
              }}
            />

            {/* Edge glow — deep red pulsing borders */}
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                boxShadow: vitalsMaxSeverity === "critical"
                  ? "inset 0 0 30px rgba(255,20,20,0.15), inset 0 0 60px rgba(255,20,20,0.06)"
                  : "inset 0 0 20px rgba(255,59,48,0.10), inset 0 0 40px rgba(255,59,48,0.04)",
                animation: "vitalsEdgeGlow 1.8s ease-in-out infinite",
              }}
            />

            {/* Scanning line */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.25 }}>
              <div
                className="absolute left-0 right-0 h-px"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,30,20,0.7), transparent)",
                  animation: "vitalsRedlineScan 3s linear infinite",
                }}
              />
            </div>

            <div className="relative p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center relative"
                    style={{
                      background: vitalsMaxSeverity === "critical" ? "rgba(255,20,20,0.18)" : "rgba(255,59,48,0.14)",
                      border: `1.5px solid ${vitalsMaxSeverity === "critical" ? "rgba(255,20,20,0.4)" : "rgba(255,59,48,0.3)"}`,
                    }}
                  >
                    <span className="text-xl" style={{ animation: "vitalsIconPulse 0.9s ease-in-out infinite" }}>
                      {vitalsMaxSeverity === "critical" ? "🚨" : "⚠️"}
                    </span>
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        border: `2px solid ${vitalsMaxSeverity === "critical" ? "rgba(255,20,20,0.5)" : "rgba(255,59,48,0.4)"}`,
                        animation: "vitalsRingPulse 1.6s ease-out infinite",
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-[14px] font-black uppercase tracking-widest"
                        style={{
                          color: vitalsMaxSeverity === "critical" ? "#FF1A1A" : WARM.criticalRed,
                          textShadow: vitalsMaxSeverity === "critical"
                            ? "0 0 24px rgba(255,20,20,0.6)"
                            : "0 0 16px rgba(255,59,48,0.4)",
                        }}
                      >
                        HIGH STRESS DETECTED
                      </h3>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: vitalsMaxSeverity === "critical" ? "#FF1A1A" : WARM.criticalRed,
                          boxShadow: `0 0 10px ${vitalsMaxSeverity === "critical" ? "rgba(255,20,20,0.6)" : WARM.redlineGlow}`,
                          animation: "vitalsAlertDot 0.7s ease-in-out infinite",
                        }}
                      />
                    </div>
                    <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: WARM.textSecondary }}>
                      Real-time vitals breached safety thresholds
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVitalsRedlineDismissed(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span className="text-[10px]" style={{ color: WARM.textDim }}>✕</span>
                </button>
              </div>

              {/* Vitals alert cards */}
              <div className={`grid ${vitalsAlerts.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-2 mb-4`}>
                {vitalsAlerts.map((alert) => (
                  <div
                    key={alert.metric}
                    className="p-3 rounded-xl relative overflow-hidden"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: `1px solid ${alert.severity === "critical" ? "rgba(255,20,20,0.3)" : "rgba(255,59,48,0.2)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{alert.emoji}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: WARM.textSecondary }}>
                        {alert.label}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div
                          className="text-[24px] font-black tabular-nums leading-none"
                          style={{
                            color: alert.severity === "critical" ? "#FF1A1A" : WARM.criticalRed,
                            animation: alert.severity === "critical" ? "vitalsValuePulse 0.8s ease-in-out infinite" : "none",
                          }}
                        >
                          {alert.currentValue}
                          <span className="text-[10px] font-normal ml-0.5">{alert.unit}</span>
                        </div>
                        <div className="text-[9px] mt-1" style={{ color: WARM.textDim }}>
                          Threshold: {alert.direction === "below" ? "<" : ">"}{alert.threshold}{alert.unit}
                        </div>
                      </div>
                      <div
                        className="text-[14px] font-black tabular-nums px-2 py-1 rounded-lg"
                        style={{
                          color: alert.severity === "critical" ? "#FF1A1A" : WARM.warningAmber,
                          background: alert.severity === "critical" ? "rgba(255,20,20,0.1)" : "rgba(255,176,32,0.08)",
                          border: `1px solid ${alert.severity === "critical" ? "rgba(255,20,20,0.2)" : "rgba(255,176,32,0.15)"}`,
                        }}
                      >
                        {alert.direction === "above" ? "↑" : "↓"} {alert.direction === "above" ? "HIGH" : "LOW"}
                      </div>
                    </div>
                    {/* Danger bar */}
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: alert.direction === "below"
                            ? `${Math.max(10, 100 - (alert.currentValue / alert.threshold) * 100)}%`
                            : `${Math.min(100, (alert.currentValue / alert.threshold) * 50)}%`,
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: alert.severity === "critical"
                            ? "linear-gradient(90deg, #FF1A1A, #FF5050)"
                            : "linear-gradient(90deg, #FF3B30, #FF7B70)",
                          animation: "vitalsBarPulse 1.5s ease-in-out infinite",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Quick-Action: Trigger Box Breathing Protocol ── */}
              <button
                onClick={handleTriggerBoxBreathing}
                disabled={breathingTriggered}
                className="w-full p-4 rounded-xl relative overflow-hidden transition-all duration-300 active:scale-[0.98] group"
                style={{
                  background: breathingTriggered
                    ? "rgba(124,182,142,0.08)"
                    : "linear-gradient(135deg, rgba(124,182,142,0.10) 0%, rgba(107,163,190,0.08) 100%)",
                  border: `1.5px solid ${breathingTriggered ? "rgba(124,182,142,0.25)" : "rgba(124,182,142,0.3)"}`,
                  boxShadow: breathingTriggered
                    ? "none"
                    : "0 0 24px rgba(124,182,142,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
                  cursor: breathingTriggered ? "default" : "pointer",
                }}
              >
                {/* Hover shimmer */}
                {!breathingTriggered && (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: "linear-gradient(105deg, transparent 35%, rgba(124,182,142,0.08) 50%, transparent 65%)",
                    }}
                  />
                )}

                <div className="relative flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: breathingTriggered ? "rgba(124,182,142,0.12)" : "rgba(124,182,142,0.15)",
                      border: `1px solid ${breathingTriggered ? "rgba(124,182,142,0.2)" : "rgba(124,182,142,0.3)"}`,
                    }}
                  >
                    <span className="text-lg">{breathingTriggered ? "✅" : "🫁"}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[12px] font-bold uppercase tracking-wide"
                        style={{ color: breathingTriggered ? WARM.sage : "#7CB68E" }}
                      >
                        {breathingTriggered ? "Box Breathing Activated" : "Trigger Box Breathing Protocol"}
                      </span>
                      {!breathingTriggered && (
                        <span
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            color: WARM.sage,
                            background: "rgba(124,182,142,0.12)",
                            border: "1px solid rgba(124,182,142,0.2)",
                          }}
                        >
                          5 MIN
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: WARM.textSecondary }}>
                      {breathingTriggered
                        ? "Timer running — follow the breathing cadence to reset your nervous system."
                        : "4-4-4-4 cadence to activate parasympathetic response and lower stress markers."}
                    </p>
                  </div>
                  {!breathingTriggered && (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(124,182,142,0.1)", border: "1px solid rgba(124,182,142,0.2)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7CB68E" strokeWidth="2.5" strokeLinecap="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              {/* Recovery suggestion */}
              <div
                className="mt-3 p-3 rounded-xl flex items-start gap-2.5"
                style={{
                  background: "rgba(196,164,108,0.05)",
                  border: "1px solid rgba(196,164,108,0.12)",
                }}
              >
                <span className="text-sm mt-0.5">🧬</span>
                <div>
                  <span className="text-[10px] font-semibold" style={{ color: WARM.gold }}>
                    IMMEDIATE RECOVERY ACTIONS
                  </span>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: WARM.textSecondary }}>
                    {vitalsMaxSeverity === "critical"
                      ? "Critical stress detected. Stop all activity. Begin box breathing immediately. Cold water on wrists for 30s. No caffeine for 4 hours."
                      : "Elevated stress markers. Reduce stimulation. Try 5 min breathwork, hydrate with electrolytes, and step outside for natural light."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── WAR STATE: Full-width high-visibility alert ────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isWarActive && warState && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="rounded-2xl overflow-hidden relative"
            style={{
              background: warState.severity === "critical"
                ? "linear-gradient(135deg, rgba(255,45,32,0.15) 0%, rgba(180,20,10,0.12) 100%)"
                : "linear-gradient(135deg, rgba(255,176,32,0.12) 0%, rgba(200,120,10,0.08) 100%)",
              border: `2px solid ${warState.severity === "critical" ? "rgba(255,45,32,0.5)" : "rgba(255,176,32,0.4)"}`,
              boxShadow: warState.severity === "critical"
                ? "0 0 40px rgba(255,45,32,0.2), 0 0 80px rgba(255,45,32,0.08), inset 0 1px 0 rgba(255,255,255,0.05)"
                : "0 0 30px rgba(255,176,32,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: warState.severity === "critical"
                  ? "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,45,32,0.2) 0%, transparent 60%)"
                  : "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,176,32,0.15) 0%, transparent 60%)",
                animation: "warPulse 1.2s ease-in-out infinite",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ opacity: 0.3 }}
            >
              <div
                className="absolute left-0 right-0 h-px"
                style={{
                  background: warState.severity === "critical"
                    ? "linear-gradient(90deg, transparent, rgba(255,45,32,0.8), transparent)"
                    : "linear-gradient(90deg, transparent, rgba(255,176,32,0.6), transparent)",
                  animation: "warScanline 2.5s linear infinite",
                }}
              />
            </div>

            <div className="relative p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center relative"
                    style={{
                      background: warState.severity === "critical" ? "rgba(255,45,32,0.2)" : "rgba(255,176,32,0.2)",
                      border: `1.5px solid ${warState.severity === "critical" ? "rgba(255,45,32,0.4)" : "rgba(255,176,32,0.35)"}`,
                    }}
                  >
                    <span className="text-xl" style={{ animation: "warIconPulse 0.8s ease-in-out infinite" }}>
                      {warState.severity === "critical" ? "🚨" : "⚠️"}
                    </span>
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        border: `2px solid ${warState.severity === "critical" ? "rgba(255,45,32,0.6)" : "rgba(255,176,32,0.5)"}`,
                        animation: "warRingPulse 1.5s ease-out infinite",
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-[14px] font-black uppercase tracking-widest"
                        style={{
                          color: warState.severity === "critical" ? WARM.criticalRed : WARM.warningAmber,
                          textShadow: warState.severity === "critical"
                            ? "0 0 20px rgba(255,45,32,0.5)"
                            : "0 0 15px rgba(255,176,32,0.4)",
                        }}
                      >
                        BIOLOGICAL WAR STATE
                      </h3>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: warState.severity === "critical" ? WARM.criticalRed : WARM.warningAmber,
                          boxShadow: `0 0 8px ${warState.severity === "critical" ? WARM.redlineGlow : "rgba(255,176,32,0.4)"}`,
                          animation: "warDot 0.6s ease-in-out infinite",
                        }}
                      />
                    </div>
                    <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: WARM.textSecondary }}>
                      Vitals breached 20% threshold • Squad notified
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWarDismissed(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span className="text-[10px]" style={{ color: WARM.textDim }}>✕</span>
                </button>
              </div>

              {myRedline && myRedline.alerts.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {myRedline.alerts.map((alert, i) => (
                    <div
                      key={`war-${alert.metric}-${i}`}
                      className="p-3 rounded-xl relative overflow-hidden"
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: `1px solid ${alert.severity === "critical" ? "rgba(255,45,32,0.25)" : "rgba(255,176,32,0.2)"}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{alert.metric === "hrv" ? "💓" : "😴"}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: WARM.textSecondary }}>
                          {alert.metric === "hrv" ? "HRV" : "Sleep"}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-[22px] font-black tabular-nums leading-none" style={{ color: alert.severity === "critical" ? WARM.criticalRed : WARM.warningAmber }}>
                            {alert.currentValue}
                            <span className="text-[10px] font-normal ml-0.5">{alert.metric === "hrv" ? "ms" : ""}</span>
                          </div>
                          <div className="text-[9px] mt-1" style={{ color: WARM.textDim }}>
                            7d avg: {alert.rollingAvg}{alert.metric === "hrv" ? "ms" : ""}
                          </div>
                        </div>
                        <div
                          className="text-[18px] font-black tabular-nums"
                          style={{
                            color: alert.severity === "critical" ? WARM.criticalRed : WARM.warningAmber,
                            textShadow: `0 0 12px ${alert.severity === "critical" ? "rgba(255,45,32,0.4)" : "rgba(255,176,32,0.3)"}`,
                          }}
                        >
                          ↓{alert.dropPercent}%
                        </div>
                      </div>
                      <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(alert.dropPercent * 2, 100)}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            background: alert.severity === "critical"
                              ? "linear-gradient(90deg, #FF2D20, #FF6B60)"
                              : "linear-gradient(90deg, #FFB020, #FFD060)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="p-3 rounded-xl flex items-start gap-2.5"
                style={{ background: "rgba(124,182,142,0.06)", border: "1px solid rgba(124,182,142,0.15)" }}
              >
                <span className="text-sm mt-0.5">🧬</span>
                <div>
                  <span className="text-[10px] font-semibold" style={{ color: WARM.sage }}>
                    EMERGENCY RECOVERY PROTOCOL
                  </span>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: WARM.textSecondary }}>
                    {warState.severity === "critical"
                      ? "Critical threshold breached. Cancel all high-intensity activity. Prioritize: 10 min breathwork, cold exposure 2 min, magnesium 400mg, lights out by 9 PM."
                      : "Warning threshold breached. Reduce training intensity by 50%. Prioritize: hydration 3L, 8+ hours sleep, no caffeine after noon."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── SQUAD WAR ALERTS ───────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {activeSquadWars.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="space-y-2"
          >
            {activeSquadWars.map((alert) => (
              <motion.div
                key={alert._id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{
                  background: "rgba(255,59,48,0.06)",
                  border: "1px solid rgba(255,59,48,0.2)",
                  boxShadow: "0 0 16px rgba(255,59,48,0.06)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255,59,48,0.12)", animation: "warDot 1s ease-in-out infinite" }}
                >
                  <span className="text-sm">{alert.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: WARM.criticalRed }}>
                    Squad War Alert
                  </p>
                  <p className="text-[10px] truncate" style={{ color: WARM.textSecondary }}>
                    {alert.message}
                  </p>
                </div>
                <button
                  onClick={() => setSquadWarDismissed((prev) => new Set(prev).add(alert._id))}
                  className="text-[9px] px-2 py-1 rounded-md"
                  style={{ background: "rgba(255,255,255,0.05)", color: WARM.textDim }}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Personal Redline Warning (non-war) ── */}
      <AnimatePresence>
        {hasMyRedline && myRedline && !isWarActive && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="rounded-2xl overflow-hidden relative"
            style={{
              background: "rgba(255,59,48,0.06)",
              border: "1.5px solid rgba(255,59,48,0.25)",
              boxShadow: "0 0 24px rgba(255,59,48,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,59,48,0.12) 0%, transparent 70%)",
                animation: "redlinePulse 2s ease-in-out infinite",
              }}
            />

            <div className="relative p-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: myRedline.severity === "critical" ? "rgba(255,45,32,0.15)" : "rgba(255,176,32,0.15)",
                    border: `1px solid ${myRedline.severity === "critical" ? "rgba(255,45,32,0.3)" : "rgba(255,176,32,0.3)"}`,
                  }}
                >
                  <span className="text-lg">{myRedline.severity === "critical" ? "🚨" : "⚠️"}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold" style={{ color: myRedline.severity === "critical" ? WARM.criticalRed : WARM.warningAmber }}>
                      BIOLOGICAL REDLINE
                    </h3>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        color: myRedline.severity === "critical" ? "#FF2D20" : "#FFB020",
                        background: myRedline.severity === "critical" ? "rgba(255,45,32,0.12)" : "rgba(255,176,32,0.12)",
                        border: `1px solid ${myRedline.severity === "critical" ? "rgba(255,45,32,0.25)" : "rgba(255,176,32,0.25)"}`,
                      }}
                    >
                      {myRedline.severity}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: WARM.textSecondary }}>
                    Your vitals have dropped below safe thresholds
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {myRedline.alerts.map((alert, i) => (
                  <div
                    key={`${alert.metric}-${i}`}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{alert.metric === "hrv" ? "💓" : "😴"}</span>
                      <div>
                        <span className="text-[11px] font-semibold" style={{ color: WARM.textPrimary }}>
                          {alert.metric === "hrv" ? "Heart Rate Variability" : "Sleep Score"}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px]" style={{ color: WARM.textDim }}>
                            7d avg: {alert.rollingAvg}{alert.metric === "hrv" ? "ms" : ""}
                          </span>
                          <span className="text-[10px]" style={{ color: WARM.textDim }}>→</span>
                          <span className="text-[10px] font-semibold" style={{ color: WARM.criticalRed }}>
                            {alert.currentValue}{alert.metric === "hrv" ? "ms" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-[16px] font-bold tabular-nums"
                        style={{ color: alert.severity === "critical" ? WARM.criticalRed : WARM.warningAmber }}
                      >
                        ↓{alert.dropPercent}%
                      </div>
                      <span className="text-[8px] uppercase tracking-wider" style={{ color: WARM.textDim }}>
                        below avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-3 p-3 rounded-xl flex items-start gap-2.5"
                style={{ background: "rgba(124,182,142,0.06)", border: "1px solid rgba(124,182,142,0.15)" }}
              >
                <span className="text-sm mt-0.5">🧬</span>
                <div>
                  <span className="text-[10px] font-semibold" style={{ color: WARM.sage }}>
                    RECOVERY PROTOCOL ACTIVATED
                  </span>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: WARM.textSecondary }}>
                    Prioritize rest today. Consider: magnesium glycinate before bed, 10 min breathwork, and no caffeine after 2 PM.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Squad Redline Alerts ── */}
      <AnimatePresence>
        {hasSquadRedlines && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: WARM.cardBg,
              border: "1px solid rgba(255,59,48,0.15)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: WARM.redline,
                      boxShadow: `0 0 8px ${WARM.redlineGlow}`,
                      animation: "redlineDot 1.5s ease-in-out infinite",
                    }}
                  />
                  <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: WARM.textPrimary }}>
                    Squad Redline Monitor
                  </h3>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ color: WARM.redline, background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)" }}>
                  {redlinedPeers.length} alert{redlinedPeers.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2">
                {redlinedPeers.map((peer) => {
                  const isExpanded = expandedPeer === peer.peerId;
                  return (
                    <motion.div
                      key={peer.peerId}
                      layout
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: isExpanded ? "rgba(255,59,48,0.05)" : "rgba(0,0,0,0.2)",
                        border: `1px solid ${isExpanded ? "rgba(255,59,48,0.2)" : "rgba(255,255,255,0.04)"}`,
                      }}
                    >
                      <button
                        onClick={() => setExpandedPeer(isExpanded ? null : peer.peerId)}
                        className="w-full p-3 flex items-center gap-3 text-left"
                      >
                        <div className="relative">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold"
                            style={{
                              background: "rgba(255,59,48,0.1)",
                              color: WARM.textPrimary,
                              border: `2px solid ${peer.severity === "critical" ? WARM.criticalRed : WARM.warningAmber}`,
                              boxShadow: `0 0 12px ${peer.severity === "critical" ? "rgba(255,45,32,0.3)" : "rgba(255,176,32,0.2)"}`,
                              animation: "redlinePulse 2s ease-in-out infinite",
                            }}
                          >
                            {peer.peerAvatar}
                          </div>
                          <div
                            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                            style={{
                              background: peer.severity === "critical" ? WARM.criticalRed : WARM.warningAmber,
                              fontSize: 8,
                            }}
                          >
                            {peer.severity === "critical" ? "!" : "⚠"}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold truncate" style={{ color: WARM.textPrimary }}>
                              {peer.peerName}
                            </span>
                            <span className="text-[9px]" style={{ color: WARM.textDim }}>{peer.peerHandle}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {peer.alerts.map((alert, i) => (
                              <span key={i} className="text-[9px] font-medium" style={{ color: peer.severity === "critical" ? WARM.criticalRed : WARM.warningAmber }}>
                                {alert.metric === "hrv" ? "💓" : "😴"} {alert.metric.toUpperCase()} ↓{alert.dropPercent}%
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {peer.supportCount > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: WARM.sage, background: "rgba(124,182,142,0.1)" }}>
                              {peer.supportCount} 💪
                            </span>
                          )}
                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            className="text-[10px]"
                            style={{ color: WARM.textDim }}
                          >
                            ▾
                          </motion.span>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2">
                              {peer.alerts.map((alert, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between p-2.5 rounded-lg"
                                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.03)" }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{alert.metric === "hrv" ? "💓" : "😴"}</span>
                                    <div>
                                      <span className="text-[10px] font-medium" style={{ color: WARM.textPrimary }}>
                                        {alert.metric === "hrv" ? "HRV" : "Sleep"}: {alert.currentValue}{alert.metric === "hrv" ? "ms" : ""}
                                      </span>
                                      <span className="text-[9px] ml-1.5" style={{ color: WARM.textDim }}>
                                        (avg {alert.rollingAvg}{alert.metric === "hrv" ? "ms" : ""})
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums" style={{ color: WARM.criticalRed }}>
                                    ↓{alert.dropPercent}%
                                  </span>
                                </div>
                              ))}

                              <div className="flex items-center gap-2 pt-1">
                                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: WARM.gold }}>
                                  Deploy Support
                                </span>
                                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                {SUPPORT_OPTIONS.map((option) => {
                                  const key = `${peer.peerId}-${option.type}`;
                                  const alreadySent = sentSupport.has(key);
                                  return (
                                    <button
                                      key={`${option.emoji}-${option.label}`}
                                      onClick={() => !alreadySent && handleDeploySupport(peer.peerId, peer.peerName, option)}
                                      disabled={sending || alreadySent}
                                      className="p-2.5 rounded-lg text-left transition-all duration-200"
                                      style={{
                                        background: alreadySent ? "rgba(124,182,142,0.08)" : "rgba(255,255,255,0.02)",
                                        border: `1px solid ${alreadySent ? "rgba(124,182,142,0.2)" : "rgba(255,255,255,0.06)"}`,
                                        opacity: sending ? 0.5 : 1,
                                      }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm">{alreadySent ? "✅" : option.emoji}</span>
                                        <span
                                          className="text-[10px] font-medium"
                                          style={{ color: alreadySent ? WARM.sage : WARM.textPrimary }}
                                        >
                                          {alreadySent ? "Sent" : option.label}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS animations */}
      <style>{`
        @keyframes redlinePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes redlineDot {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 1; }
        }
        @keyframes warPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes warScanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes warIconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes warRingPulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes warDot {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes vitalsRedlinePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes vitalsEdgeGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes vitalsRedlineScan {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes vitalsIconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
        @keyframes vitalsRingPulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.18); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes vitalsAlertDot {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes vitalsValuePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes vitalsBarPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
