import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MuscleRecoveryData } from "@/components/Dashboard/BioMap";
import { getRecoveryStatus } from "@/components/Dashboard/BioMap";
import { setLocalAuraState } from "@/hooks/useConvexPresence";

const WARM = {
  terra: "#E8976C",
  sage: "#7CB68E",
  sky: "#6BA3BE",
  gold: "#C4A46C",
  rose: "#D4847A",
  sand: "#E8E0D8",
  cardBg: "rgba(26,24,22,0.7)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
};

/* ── Aura State definitions ── */
const AURA_STATES = [
  { id: "flow", label: "Flow", icon: "⚡", color: "#00FFCC", glowColor: "rgba(0,255,204,0.4)", description: "Deep focus state" },
  { id: "depleted", label: "Depleted", icon: "🔋", color: "#FF4444", glowColor: "rgba(255,68,68,0.4)", description: "Low energy" },
  { id: "recharging", label: "Recharging", icon: "🌙", color: "#FFB800", glowColor: "rgba(255,184,0,0.4)", description: "Recovery mode" },
  { id: "social", label: "Social", icon: "🤝", color: "#8B5CF6", glowColor: "rgba(139,92,246,0.4)", description: "Open to connect" },
] as const;

type AuraStateId = typeof AURA_STATES[number]["id"];

/* ── Muscle zone SVG paths ── */
const MUSCLE_PATHS: Record<string, { d: string; label: string; cx: number; cy: number }> = {
  neck:       { d: "M95,52 Q100,58 105,52 L107,62 Q100,65 93,62 Z", label: "Neck", cx: 100, cy: 57 },
  chest:      { d: "M78,72 Q82,68 100,66 Q118,68 122,72 L124,92 Q112,96 100,97 Q88,96 76,92 Z", label: "Chest", cx: 100, cy: 82 },
  abs:        { d: "M82,97 Q90,96 100,97 Q110,96 118,97 L116,128 Q108,132 100,133 Q92,132 84,128 Z", label: "Core", cx: 100, cy: 114 },
  obliques:   { d: "M76,92 L82,97 L84,128 Q80,126 76,120 L74,96 Z M124,92 L118,97 L116,128 Q120,126 124,120 L126,96 Z", label: "Obliques", cx: 68, cy: 110 },
  shoulders:  { d: "M68,68 Q72,64 78,66 L78,78 Q72,80 68,76 Z M132,68 Q128,64 122,66 L122,78 Q128,80 132,76 Z", label: "Shoulders", cx: 65, cy: 72 },
  biceps:     { d: "M66,78 L68,76 L70,96 Q66,98 64,94 Z M134,78 L132,76 L130,96 Q134,98 136,94 Z", label: "Biceps", cx: 63, cy: 87 },
  triceps:    { d: "M62,80 L66,78 L64,94 Q60,96 58,92 Z M138,80 L134,78 L136,94 Q140,96 142,92 Z", label: "Triceps", cx: 57, cy: 87 },
  forearms:   { d: "M58,96 L64,94 L62,118 Q58,120 56,116 Z M142,96 L136,94 L138,118 Q142,120 144,116 Z", label: "Forearms", cx: 55, cy: 107 },
  upper_back: { d: "M84,72 Q92,70 100,69 Q108,70 116,72 L114,86 Q108,88 100,89 Q92,88 86,86 Z", label: "Upper Back", cx: 100, cy: 78 },
  lats:       { d: "M76,86 L82,92 L84,108 Q78,106 74,100 Z M124,86 L118,92 L116,108 Q122,106 126,100 Z", label: "Lats", cx: 72, cy: 97 },
  lower_back: { d: "M88,118 Q94,116 100,116 Q106,116 112,118 L110,130 Q106,132 100,133 Q94,132 90,130 Z", label: "Lower Back", cx: 100, cy: 124 },
  glutes:     { d: "M84,133 Q92,132 100,133 Q108,132 116,133 L118,146 Q110,150 100,151 Q90,150 82,146 Z", label: "Glutes", cx: 100, cy: 142 },
  quads:      { d: "M82,148 L90,150 L88,186 Q84,188 80,184 Z M118,148 L110,150 L112,186 Q116,188 120,184 Z", label: "Quads", cx: 82, cy: 168 },
  hamstrings: { d: "M90,150 L100,151 L98,186 L88,186 Z M100,151 L110,150 L112,186 L102,186 Z", label: "Hamstrings", cx: 106, cy: 168 },
  calves:     { d: "M82,190 L90,188 L88,218 Q84,222 80,218 Z M118,190 L110,188 L112,218 Q116,222 120,218 Z", label: "Calves", cx: 82, cy: 205 },
  traps:      { d: "M82,62 Q88,60 95,58 L93,68 Q88,66 82,68 Z M118,62 Q112,60 105,58 L107,68 Q112,66 118,68 Z", label: "Traps", cx: 82, cy: 64 },
};

const CLEAN_BODY = `
  M100,26 C108,26 114,32 114,40 C114,48 108,54 105,57
  L107,62 C114,64 122,66 128,68 C134,72 138,78 140,86
  L142,100 C142,108 140,116 138,120
  L136,118 C134,112 132,104 130,96
  C128,84 126,78 124,74
  L122,72 C120,80 118,92 118,100
  L116,128 C114,134 116,140 118,148
  L120,186 C120,192 118,200 116,210
  L114,224 C112,228 108,230 104,228
  L102,220 L102,186 L110,150
  C108,152 104,154 100,154
  C96,154 92,152 90,150
  L98,186 L98,220 C96,228 92,230 88,228
  L84,224 C82,218 80,210 80,200
  L80,186 L82,148
  C84,140 86,134 84,128
  L82,100 C82,92 80,80 78,72
  L76,74 C74,78 72,84 70,96
  C68,104 66,112 64,118
  L62,120 C60,116 58,108 58,100
  L60,86 C62,78 66,72 72,68
  C78,64 86,62 93,57
  L95,57 C92,54 86,48 86,40
  C86,32 92,26 100,26 Z
`;

interface BiometricAvatarProps {
  muscleRecovery: MuscleRecoveryData[];
  ghostMode: boolean;
}

export function BiometricAvatar({ muscleRecovery, ghostMode }: BiometricAvatarProps) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [showStateSelector, setShowStateSelector] = useState(false);
  const [activeAura, setActiveAura] = useState<AuraStateId | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  /* ── Close radial menu on outside click ── */
  useEffect(() => {
    if (!showStateSelector) return;
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowStateSelector(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("click", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [showStateSelector]);

  /* ── Sync aura state to presence broadcast ── */
  useEffect(() => {
    setLocalAuraState(activeAura);
    // Dispatch event for FluidCanvas glow color changes
    window.dispatchEvent(new CustomEvent("vive-aura-state-change", { detail: { auraState: activeAura } }));
  }, [activeAura]);

  const handleAuraSelect = useCallback((stateId: AuraStateId) => {
    setActiveAura((prev) => (prev === stateId ? null : stateId));
    setShowStateSelector(false);
  }, []);

  const currentAura = AURA_STATES.find((s) => s.id === activeAura);

  /* ── Compute recovery status per muscle group ── */
  const muscleStatus = useMemo(() => {
    const statusMap: Record<string, { color: string; glowColor: string; pct: number; label: string; hoursRemaining: number; intensity: string; workoutName: string }> = {};
    for (const entry of muscleRecovery) {
      const mg = entry.muscleGroup;
      const status = getRecoveryStatus(entry.workedAt, entry.intensity);
      if (!statusMap[mg] || statusMap[mg].pct > status.pct) {
        statusMap[mg] = {
          color: status.color, glowColor: status.glowColor, pct: status.pct,
          label: status.label, hoursRemaining: status.hoursRemaining,
          intensity: entry.intensity, workoutName: entry.workoutName,
        };
      }
    }
    return statusMap;
  }, [muscleRecovery]);

  const overallRecovery = useMemo(() => {
    const values = Object.values(muscleStatus);
    if (values.length === 0) return 100;
    return Math.round((values.reduce((s, v) => s + v.pct, 0) / values.length) * 100);
  }, [muscleStatus]);

  const statusCounts = useMemo(() => {
    const counts = { recovering: 0, rebuilding: 0, ready: 0 };
    Object.values(muscleStatus).forEach((s) => {
      if (s.pct >= 1) counts.ready++;
      else if (s.pct >= 0.6) counts.rebuilding++;
      else counts.recovering++;
    });
    return counts;
  }, [muscleStatus]);

  const handleMuscleClick = useCallback((muscleId: string) => {
    setSelectedMuscle((prev) => (prev === muscleId ? null : muscleId));
  }, []);

  const selectedInfo = selectedMuscle ? muscleStatus[selectedMuscle] : null;
  const selectedPath = selectedMuscle ? MUSCLE_PATHS[selectedMuscle] : null;

  const ghostColor = "rgba(100,160,190,0.12)";
  const ghostStroke = "rgba(100,160,190,0.25)";

  /* ── Aura-influenced border color ── */
  const borderColor = ghostMode
    ? "rgba(160,160,160,0.12)"
    : currentAura
      ? currentAura.color
      : "#C4A46C";

  const auraShadow = currentAura && !ghostMode
    ? `0 0 24px ${currentAura.glowColor}, 0 0 48px ${currentAura.glowColor.replace("0.4", "0.15")}`
    : ghostMode ? "0 4px 20px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(232,224,216,0.04)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="mx-5 mb-5 rounded-2xl overflow-hidden relative"
      style={{
        minHeight: 350,
        zIndex: 10,
        background: ghostMode ? "rgba(12,12,12,0.85)" : "rgba(26,24,22,0.92)",
        backdropFilter: "blur(24px)",
        border: `2px solid ${borderColor}`,
        boxShadow: auraShadow,
        transition: "border-color 0.6s ease, box-shadow 0.8s ease",
      }}
    >
      {/* ── Aura glow overlay ── */}
      {currentAura && !ghostMode && (
        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${currentAura.glowColor.replace("0.4", "0.08")} 0%, transparent 70%)`,
          animation: activeAura === "flow" ? "auraFlowPulse 3s ease-in-out infinite" : activeAura === "depleted" ? "auraDepletedPulse 2s ease-in-out infinite" : activeAura === "recharging" ? "auraRechargePulse 4s ease-in-out infinite" : "auraSocialPulse 2.5s ease-in-out infinite",
        }} />
      )}

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between relative z-10">
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : WARM.textPrimary }}>
            Your Body Right Now
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim }}>
            Tap a muscle to see its recovery status
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Active aura badge ── */}
          {currentAura && !ghostMode && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold"
              style={{
                background: `${currentAura.color}15`,
                border: `1px solid ${currentAura.color}40`,
                color: currentAura.color,
              }}
            >
              <span>{currentAura.icon}</span>
              <span>{currentAura.label}</span>
            </motion.div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.04)" : `${overallRecovery >= 70 ? WARM.sage : overallRecovery >= 40 ? WARM.gold : WARM.rose}0a`,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${overallRecovery >= 70 ? WARM.sage : overallRecovery >= 40 ? WARM.gold : WARM.rose}20`}`,
            }}
          >
            <span className="text-[11px] font-semibold tabular-nums" style={{
              color: ghostMode ? "rgba(160,160,160,0.5)" : overallRecovery >= 70 ? WARM.sage : overallRecovery >= 40 ? WARM.gold : WARM.rose,
            }}>
              {overallRecovery}%
            </span>
            <span className="text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim }}>
              recovered
            </span>
          </div>
        </div>
      </div>

      {/* ── SVG Avatar with State Selector ── */}
      <div className="relative flex justify-center py-2">
        {/* Background glow */}
        {!ghostMode && (
          <div className="absolute pointer-events-none"
            style={{
              width: 200, height: 260, top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              background: currentAura
                ? `radial-gradient(ellipse 50% 40% at 50% 50%, ${currentAura.glowColor.replace("0.4", "0.12")} 0%, transparent 70%)`
                : `radial-gradient(ellipse 50% 40% at 50% 50%, ${WARM.terra}10 0%, transparent 70%)`,
              filter: "blur(30px)",
              transition: "background 0.8s ease",
            }}
          />
        )}

        {/* ── Clickable avatar area for State Selector ── */}
        <div
          className="relative z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowStateSelector((prev) => !prev);
            setSelectedMuscle(null);
          }}
        >
          <svg
            viewBox="40 20 120 220"
            width="220"
            height="280"
            style={{ filter: ghostMode ? "none" : currentAura ? `drop-shadow(0 0 20px ${currentAura.glowColor})` : "drop-shadow(0 0 20px rgba(232,151,108,0.06))" }}
          >
            <defs>
              {Object.entries(muscleStatus).map(([id, status]) => (
                <radialGradient key={`grad-${id}`} id={`muscle-grad-${id}`} cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={ghostMode ? ghostColor : status.color} stopOpacity={ghostMode ? 0.15 : 0.6} />
                  <stop offset="100%" stopColor={ghostMode ? ghostColor : status.color} stopOpacity={ghostMode ? 0.04 : 0.15} />
                </radialGradient>
              ))}
              <radialGradient id="muscle-grad-ghost" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={ghostColor} stopOpacity={0.12} />
                <stop offset="100%" stopColor={ghostColor} stopOpacity={0.03} />
              </radialGradient>
              <linearGradient id="body-outline-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ghostMode ? "rgba(100,160,190,0.2)" : "rgba(232,224,216,0.15)"} />
                <stop offset="50%" stopColor={ghostMode ? "rgba(100,160,190,0.12)" : "rgba(232,224,216,0.08)"} />
                <stop offset="100%" stopColor={ghostMode ? "rgba(100,160,190,0.06)" : "rgba(232,224,216,0.04)"} />
              </linearGradient>
              <filter id="muscleGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="head-grad" cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor={ghostMode ? "rgba(100,160,190,0.08)" : "rgba(232,224,216,0.06)"} />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            <ellipse cx="100" cy="40" rx="14" ry="16" fill="url(#head-grad)"
              stroke={ghostMode ? ghostStroke : "rgba(232,224,216,0.12)"} strokeWidth="0.8" />

            {Object.entries(MUSCLE_PATHS).map(([id, path]) => {
              const status = muscleStatus[id];
              const isSelected = selectedMuscle === id;
              const hasData = !!status;
              const fillId = hasData ? `muscle-grad-${id}` : "muscle-grad-ghost";
              const strokeColor = ghostMode
                ? ghostStroke
                : hasData
                  ? `${status.color}${isSelected ? "80" : "40"}`
                  : "rgba(232,224,216,0.06)";

              return (
                <motion.path
                  key={id}
                  d={path.d}
                  fill={`url(#${fillId})`}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 1.2 : 0.6}
                  className="cursor-pointer"
                  style={{
                    filter: isSelected && hasData && !ghostMode ? "url(#muscleGlow)" : "none",
                    transition: "all 0.3s ease",
                  }}
                  whileHover={{ opacity: 0.9, strokeWidth: 1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.stopPropagation(); handleMuscleClick(id); }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 + Math.random() * 0.3, duration: 0.5 }}
                />
              );
            })}

            {!ghostMode && Object.entries(muscleStatus)
              .filter(([, s]) => s.pct < 0.4)
              .map(([id, status]) => {
                const path = MUSCLE_PATHS[id];
                if (!path) return null;
                return (
                  <circle
                    key={`pulse-${id}`}
                    cx={path.cx}
                    cy={path.cy}
                    r="2"
                    fill={status.color}
                    opacity={0.8}
                    style={{ animation: "statusDotPulse 2s ease-in-out infinite" }}
                  />
                );
              })}
          </svg>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/*  RADIAL STATE SELECTOR — 4 quick-tap aura icons  */}
        {/* ══════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showStateSelector && (
            <motion.div
              ref={selectorRef}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="absolute z-50"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              {/* Backdrop ring */}
              <div className="absolute rounded-full" style={{
                width: 200, height: 200,
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(circle, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.6) 60%, transparent 100%)",
                backdropFilter: "blur(12px)",
              }} />

              {/* Center label */}
              <div className="absolute z-10" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                <div className="text-[9px] font-bold tracking-widest uppercase text-center" style={{ color: "rgba(232,224,216,0.5)", whiteSpace: "nowrap" }}>
                  SET STATE
                </div>
              </div>

              {/* 4 radial buttons at 90° intervals */}
              {AURA_STATES.map((state, i) => {
                const angle = (i * 90 - 90) * (Math.PI / 180); // Start from top
                const radius = 72;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const isActive = activeAura === state.id;

                return (
                  <motion.button
                    key={state.id}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{ opacity: 1, scale: 1, x, y }}
                    exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 28,
                      delay: i * 0.05,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleAuraSelect(state.id); }}
                    className="absolute flex flex-col items-center justify-center rounded-full"
                    style={{
                      width: 56, height: 56,
                      top: "50%", left: "50%",
                      marginTop: -28, marginLeft: -28,
                      background: isActive ? `${state.color}25` : "rgba(26,24,22,0.9)",
                      border: `2px solid ${isActive ? state.color : `${state.color}40`}`,
                      boxShadow: isActive
                        ? `0 0 16px ${state.glowColor}, 0 0 32px ${state.glowColor.replace("0.4", "0.15")}, inset 0 0 12px ${state.glowColor.replace("0.4", "0.1")}`
                        : `0 2px 8px rgba(0,0,0,0.4)`,
                      cursor: "pointer",
                      transition: "border-color 0.2s, box-shadow 0.3s, background 0.2s",
                    }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <span className="text-[18px] leading-none">{state.icon}</span>
                    <span className="text-[7px] font-bold mt-0.5 tracking-wide uppercase" style={{ color: isActive ? state.color : "rgba(232,224,216,0.6)" }}>
                      {state.label}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap hint */}
        {!showStateSelector && !ghostMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-medium tracking-wider uppercase"
            style={{ color: "rgba(232,224,216,0.25)" }}
          >
            tap avatar to set state
          </motion.div>
        )}
      </div>

      {/* ── Selected muscle detail ── */}
      <AnimatePresence>
        {selectedMuscle && selectedPath && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 p-3 rounded-xl"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.03)" : selectedInfo ? `${selectedInfo.color}08` : "rgba(232,224,216,0.03)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : selectedInfo ? `${selectedInfo.color}18` : "rgba(232,224,216,0.06)"}`,
              }}
            >
              {selectedInfo ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : selectedInfo.color }} />
                      <span className="text-[12px] font-semibold" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : WARM.textPrimary }}>
                        {selectedPath.label}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          color: ghostMode ? "rgba(160,160,160,0.5)" : selectedInfo.color,
                          background: ghostMode ? "rgba(160,160,160,0.06)" : `${selectedInfo.color}15`,
                          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${selectedInfo.color}25`}`,
                        }}>
                        {selectedInfo.label}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : WARM.textSecondary }}>
                      {selectedInfo.pct >= 1
                        ? `Fully recovered from ${selectedInfo.workoutName} — ready to train again`
                        : selectedInfo.pct >= 0.6
                          ? `Still rebuilding after ${selectedInfo.workoutName} — ${Math.round(selectedInfo.hoursRemaining)}h to go`
                          : `Recovering from ${selectedInfo.workoutName} — needs about ${Math.round(selectedInfo.hoursRemaining)}h more rest`
                      }
                    </p>
                  </div>
                  <div className="flex flex-col items-center ml-3">
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : selectedInfo.color }}>
                      {Math.round(selectedInfo.pct * 100)}%
                    </span>
                    <span className="text-[8px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim }}>recovered</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.2)" : "rgba(100,160,190,0.3)" }} />
                  <span className="text-[11px]" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : WARM.textSecondary }}>
                    {selectedPath.label} — No recent workout data
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status legend ── */}
      <div className="px-4 pb-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          {[
            { label: "Recovering", count: statusCounts.recovering, color: "#FF3B30" },
            { label: "Rebuilding", count: statusCounts.rebuilding, color: "#FFD60A" },
            { label: "Ready", count: statusCounts.ready, color: "#30D158" },
          ].filter((s) => s.count > 0).map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[9px] font-medium"
              style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : s.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : s.color }} />
              {s.count} {s.label}
            </span>
          ))}
        </div>
        {muscleRecovery.length === 0 && (
          <span className="text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : WARM.textDim }}>
            Log a workout to see your map
          </span>
        )}
      </div>

      {/* ── Aura animation keyframes ── */}
      <style>{`
        @keyframes auraFlowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes auraDepletedPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes auraRechargePulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes auraSocialPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        @keyframes statusDotPulse {
          0%, 100% { opacity: 0.8; r: 2; }
          50% { opacity: 0.3; r: 3; }
        }
      `}</style>
    </motion.div>
  );
}
