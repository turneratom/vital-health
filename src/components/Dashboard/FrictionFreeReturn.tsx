import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { useMissionProfile, useMacroProfile, type MissionProfile } from "@/lib/useUserStyle";

/* ── Types ── */
interface NextStep {
  id: string;
  label: string;
  detail: string;
  icon: string;
  action: string;
}

interface FrictionFreeReturnProps {
  hoursAgo: number;
  daysSinceActive: number;
  nextStep: NextStep;
  onDismiss: () => void;
  onNavigate: (action: string) => void;
}

/* ── Profile accent ── */
function getAccent(profile: MissionProfile) {
  switch (profile) {
    case "hard-truth":
      return { r: 255, g: 68, b: 68, hex: "#FF4444", label: "OMEGA-03" };
    case "elite":
      return { r: 0, g: 240, b: 255, hex: "#00F0FF", label: "APEX-02" };
    default:
      return { r: 0, g: 255, b: 204, hex: "#00FFCC", label: "SIGMA-01" };
  }
}

/* ── Boot text typewriter ── */
function useTypewriter(text: string, speed = 30, delay = 600) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return { displayed, done };
}

/* ── Scanning line ── */
function ScanLine({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none z-10"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color}26 30%, ${color}4D 50%, ${color}26 70%, transparent 100%)`,
      }}
      initial={{ top: 0, opacity: 0 }}
      animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 5, ease: "linear" }}
    />
  );
}

/* ── System boot lines ── */
function BootLine({ text, delay, accent }: { text: string; delay: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-2"
    >
      <span className="text-[9px] font-mono" style={{ color: `${accent}80` }}>
        {"\u25B8"}
      </span>
      <span className="text-[10px] font-mono tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
        {text}
      </span>
    </motion.div>
  );
}

/* ── Main Component ── */
export function FrictionFreeReturn({
  hoursAgo,
  daysSinceActive,
  nextStep,
  onDismiss,
  onNavigate,
}: FrictionFreeReturnProps) {
  const ghostMode = useGhostMode();
  const profile = useMissionProfile();
  const macros = useMacroProfile();
  const accent = getAccent(profile);
  const accentRgba = `rgba(${accent.r},${accent.g},${accent.b},`;

  const [phase, setPhase] = useState<"boot" | "greeting" | "ready">("boot");
  const [showNextStep, setShowNextStep] = useState(false);

  // Greeting message — supportive, no guilt
  const greetingText = daysSinceActive <= 3
    ? "Ready when you are. Let\u2019s pick up at Protocol Alpha."
    : daysSinceActive <= 7
      ? "Systems held steady while you were away. All protocols intact."
      : "Welcome back, Operator. Your baseline is preserved. Let\u2019s rebuild momentum.";

  const { displayed: typedGreeting, done: greetingDone } = useTypewriter(
    greetingText,
    25,
    phase === "greeting" ? 200 : 99999
  );

  // Phase transitions
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("greeting"), 1800);
    const t2 = setTimeout(() => setPhase("ready"), 3200);
    const t3 = setTimeout(() => setShowNextStep(true), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleNextStep = useCallback(() => {
    onNavigate(nextStep.action);
    onDismiss();
  }, [nextStep.action, onNavigate, onDismiss]);

  const borderColor = ghostMode ? "rgba(160,160,160,0.08)" : `${accentRgba}0.1)`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl mb-5"
        style={{
          background: "rgba(6, 6, 10, 0.85)",
          border: `1px solid ${borderColor}`,
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
        }}
      >
        {!ghostMode && <ScanLine color={accent.hex} />}

        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: ghostMode
              ? "linear-gradient(90deg, transparent, rgba(160,160,160,0.15), transparent)"
              : `linear-gradient(90deg, transparent, ${accentRgba}0.3), ${accentRgba}0.15), transparent)`,
          }}
        />

        {/* Ambient glow */}
        {!ghostMode && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${accentRgba}0.04) 0%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
        )}

        <div className="relative z-10 px-5 pt-5 pb-4">
          {/* Header: Systems Operational */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Pulse dot */}
              <div className="relative flex items-center justify-center w-4 h-4">
                <motion.div
                  className="absolute w-4 h-4 rounded-full"
                  style={{ background: ghostMode ? "rgba(160,160,160,0.15)" : `${accentRgba}0.15)` }}
                  animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.5)" : accent.hex,
                    boxShadow: ghostMode ? "none" : `0 0 8px ${accentRgba}0.5)`,
                  }}
                />
              </div>

              <div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-[11px] font-bold tracking-[0.2em] uppercase"
                  style={{
                    color: ghostMode ? "rgba(160,160,160,0.6)" : accent.hex,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Systems Operational
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-[9px] tracking-[0.15em] uppercase mt-0.5"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  {accent.label} {"\u00b7"} All protocols intact
                </motion.div>
              </div>
            </div>

            {/* Dismiss */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              onClick={onDismiss}
              className="text-[9px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full transition-all duration-200"
              style={{
                color: "rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "rgba(255,255,255,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.color = "rgba(255,255,255,0.3)";
              }}
            >
              Dismiss
            </motion.button>
          </div>

          {/* Boot sequence lines */}
          <AnimatePresence>
            {phase === "boot" && (
              <motion.div
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-1.5 mb-3 overflow-hidden"
              >
                <BootLine text="Initializing session recovery..." delay={0.2} accent={accent.hex} />
                <BootLine text="Scanning protocol history..." delay={0.5} accent={accent.hex} />
                <BootLine text="Baseline preserved. No data loss detected." delay={0.8} accent={accent.hex} />
                <BootLine text="Calibrating next objective..." delay={1.1} accent={accent.hex} />
                <BootLine text={`Status: ${daysSinceActive}d since last activity \u2014 all systems nominal.`} delay={1.4} accent={accent.hex} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Greeting — typewriter effect */}
          <AnimatePresence>
            {(phase === "greeting" || phase === "ready") && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4"
              >
                <p
                  className="text-[13px] leading-relaxed font-medium"
                  style={{
                    color: ghostMode ? "rgba(200,200,200,0.7)" : "rgba(255,255,255,0.8)",
                    fontFamily: "'Inter', sans-serif",
                    lineHeight: 1.6,
                  }}
                >
                  {phase === "greeting" ? typedGreeting : greetingText}
                  {phase === "greeting" && !greetingDone && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      style={{ color: accent.hex }}
                    >
                      {"\u2588"}
                    </motion.span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 2.5, duration: 0.5 }}
            className="h-px mb-4 origin-left"
            style={{
              background: ghostMode
                ? "rgba(160,160,160,0.08)"
                : `linear-gradient(90deg, ${accentRgba}0.15), rgba(255,255,255,0.03), transparent)`,
            }}
          />

          {/* Next Step — the primary CTA */}
          <AnimatePresence>
            {showNextStep && (
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                onClick={handleNextStep}
                className="w-full group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300"
                style={{
                  background: ghostMode ? "rgba(160,160,160,0.04)" : `${accentRgba}0.04)`,
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${accentRgba}0.1)`}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = ghostMode ? "rgba(160,160,160,0.06)" : `${accentRgba}0.07)`;
                  e.currentTarget.style.borderColor = ghostMode ? "rgba(160,160,160,0.12)" : `${accentRgba}0.2)`;
                  e.currentTarget.style.transform = "scale(1.01)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ghostMode ? "rgba(160,160,160,0.04)" : `${accentRgba}0.04)`;
                  e.currentTarget.style.borderColor = ghostMode ? "rgba(160,160,160,0.08)" : `${accentRgba}0.1)`;
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {/* Shimmer effect */}
                {!ghostMode && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `linear-gradient(105deg, transparent 40%, ${accentRgba}0.06) 50%, transparent 60%)`,
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "linear" }}
                  />
                )}

                <div className="relative z-10 flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.06)" : `${accentRgba}0.08)`,
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : `${accentRgba}0.12)`}`,
                    }}
                  >
                    <span className="text-xl">{nextStep.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold tracking-[0.15em] uppercase"
                        style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : `${accentRgba}0.7)` }}
                      >
                        Next Step
                      </span>
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: ghostMode ? "rgba(160,160,160,0.4)" : accent.hex }}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <p
                      className="text-[12px] font-semibold tracking-[0.05em] mb-0.5"
                      style={{
                        color: ghostMode ? "rgba(200,200,200,0.7)" : "rgba(255,255,255,0.85)",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {nextStep.label}
                    </p>
                    <p
                      className="text-[10px] leading-relaxed"
                      style={{
                        color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.4)",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {nextStep.detail}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div
                    className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : `${accentRgba}0.5)` }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Macro reminder strip */}
          <AnimatePresence>
            {showNextStep && !ghostMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3 px-3 py-2 rounded-lg flex items-center justify-between"
                style={{
                  background: `${accentRgba}0.03)`,
                  border: `1px solid ${accentRgba}0.06)`,
                }}
              >
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: `${accentRgba}0.5)` }}
                >
                  {macros.label}
                </span>
                <div className="flex items-center gap-3">
                  {[
                    { label: "P", val: macros.protein },
                    { label: "C", val: macros.carbs },
                    { label: "F", val: macros.fat },
                  ].map((m) => (
                    <span key={m.label} className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span style={{ color: `${accentRgba}0.6)` }}>{m.label}</span> {m.val}g
                    </span>
                  ))}
                  <span className="text-[9px] font-semibold tabular-nums" style={{ color: `${accentRgba}0.7)` }}>
                    {macros.calories}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reassurance footer */}
          <AnimatePresence>
            {showNextStep && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center mt-3 text-[9px] tracking-[0.1em]"
                style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'Inter', sans-serif" }}
              >
                No catch-up required {"\u00b7"} Your streak resets with your next action
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Corner accents */}
        {!ghostMode && (
          <>
            <div className="absolute top-0 left-0 w-4 h-4 pointer-events-none" style={{ borderTop: `1px solid ${accentRgba}0.2)`, borderLeft: `1px solid ${accentRgba}0.2)`, borderTopLeftRadius: "16px" }} />
            <div className="absolute top-0 right-0 w-4 h-4 pointer-events-none" style={{ borderTop: `1px solid ${accentRgba}0.2)`, borderRight: `1px solid ${accentRgba}0.2)`, borderTopRightRadius: "16px" }} />
            <div className="absolute bottom-0 left-0 w-4 h-4 pointer-events-none" style={{ borderBottom: `1px solid ${accentRgba}0.1)`, borderLeft: `1px solid ${accentRgba}0.1)`, borderBottomLeftRadius: "16px" }} />
            <div className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none" style={{ borderBottom: `1px solid ${accentRgba}0.1)`, borderRight: `1px solid ${accentRgba}0.1)`, borderBottomRightRadius: "16px" }} />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default FrictionFreeReturn;
