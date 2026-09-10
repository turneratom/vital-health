import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NEON = "#E8976C";
const NEON_GLOW = "rgba(232,151,108,0.35)";

export type BioMapZone = "all" | "mind" | "cardio" | "metabolic";

/* ── Muscle group types ── */
export type MuscleGroupId =
  | "chest" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "abs" | "obliques" | "upper_back" | "lats" | "lower_back"
  | "glutes" | "quads" | "hamstrings" | "calves"
  | "traps" | "neck";

export interface MuscleRecoveryData {
  muscleGroup: MuscleGroupId;
  workedAt: number;
  intensity: "light" | "moderate" | "heavy";
  workoutName: string;
}

/** Biomarker status for node pulse coloring */
export type BiomarkerStatus = "optimal" | "warning" | "critical" | "neutral";

/** Biomarker node data for FluidCanvas proximity glow */
export interface BiomarkerNodeData {
  id: string;
  label: string;
  status: BiomarkerStatus;
  value?: number;
  unit?: string;
  cx: number;
  cy: number;
}

interface BioMapProps {
  activeZone: BioMapZone;
  onZoneChange: (zone: BioMapZone) => void;
  ghostMode: boolean;
  muscleRecovery?: MuscleRecoveryData[];
  /** Optional biomarker data for status-aware pulse colors */
  biomarkerNodes?: BiomarkerNodeData[];
  /** Callback when a biomarker node is hovered — dispatches to FluidCanvas */
  onBiomarkerHover?: (node: BiomarkerNodeData | null) => void;
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Status → Color mapping for biomarker pulse ── */
/* ══════════════════════════════════════════════════════════════ */
const STATUS_COLORS: Record<BiomarkerStatus, { fill: string; glow: string; pulse: string }> = {
  optimal: { fill: "#7CB68E", glow: "rgba(124,182,142,0.4)", pulse: "rgba(124,182,142,0.25)" },
  warning: { fill: "#C4A46C", glow: "rgba(196,164,108,0.4)", pulse: "rgba(196,164,108,0.25)" },
  critical: { fill: "#D4847A", glow: "rgba(212,132,122,0.4)", pulse: "rgba(212,132,122,0.25)" },
  neutral: { fill: "#E8976C", glow: "rgba(232,151,108,0.25)", pulse: "rgba(232,151,108,0.15)" },
};

/* ══════════════════════════════════════════════════════════════ */
/* ── Recovery status calculation (48–72h model) ── */
/* ══════════════════════════════════════════════════════════════ */
export interface RecoveryStatusResult {
  label: string;
  color: string;
  glowColor: string;
  glowIntensity: number;
  pct: number;
  hoursRemaining: number;
  totalRecoveryHours: number;
  isReady: boolean;
  justBecameReady: boolean;
}

export function getRecoveryStatus(workedAt: number, intensity: string): RecoveryStatusResult {
  const hoursAgo = (Date.now() - workedAt) / (1000 * 60 * 60);
  const recoveryHours = intensity === "heavy" ? 72 : intensity === "moderate" ? 48 : 24;
  const pct = Math.min(1, hoursAgo / recoveryHours);
  const hoursRemaining = Math.max(0, recoveryHours - hoursAgo);
  const isReady = pct >= 1;
  const justBecameReady = isReady && hoursAgo < recoveryHours + 2;

  if (pct < 0.2) return { label: "ACTIVE RECOVERY", color: "#FF3B30", glowColor: "#FF6B6B", glowIntensity: 1, pct, hoursRemaining, totalRecoveryHours: recoveryHours, isReady, justBecameReady };
  if (pct < 0.4) return { label: "IN RECOVERY", color: "#FF6B3B", glowColor: "#FF8C42", glowIntensity: 0.8, pct, hoursRemaining, totalRecoveryHours: recoveryHours, isReady, justBecameReady };
  if (pct < 0.6) return { label: "REBUILDING", color: "#FF9F0A", glowColor: "#FFB347", glowIntensity: 0.55, pct, hoursRemaining, totalRecoveryHours: recoveryHours, isReady, justBecameReady };
  if (pct < 0.8) return { label: "ADAPTING", color: "#FFD60A", glowColor: "#FFD93D", glowIntensity: 0.3, pct, hoursRemaining, totalRecoveryHours: recoveryHours, isReady, justBecameReady };
  if (pct < 1) return { label: "NEARLY READY", color: "#34C759", glowColor: "#6BCB77", glowIntensity: 0.12, pct, hoursRemaining, totalRecoveryHours: recoveryHours, isReady, justBecameReady };
  return { label: "READY", color: "#30D158", glowColor: "#30D158", glowIntensity: 0, pct: 1, hoursRemaining: 0, totalRecoveryHours: recoveryHours, isReady: true, justBecameReady };
}

function formatCountdown(hours: number): string {
  if (hours <= 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Enlarged, anatomically-accurate muscle SVG paths ── */
/* ══════════════════════════════════════════════════════════════ */
const MUSCLE_PATHS: Record<string, { d: string; label: string; cx: number; cy: number }> = {
  neck: { d: "M 112,68 C 114,70 116,72 118,74 L 122,74 C 124,72 126,70 128,68 L 128,78 C 126,80 122,82 120,82 C 118,82 114,80 112,78 Z", label: "Neck", cx: 120, cy: 75 },
  traps: { d: "M 96,82 C 100,78 108,76 120,76 C 132,76 140,78 144,82 L 148,90 C 144,86 134,84 120,84 C 106,84 96,86 92,90 Z", label: "Traps", cx: 120, cy: 83 },
  chest: { d: "M 96,96 C 98,90 108,88 120,88 C 132,88 142,90 144,96 L 144,114 C 142,120 134,124 120,124 C 106,124 98,120 96,114 Z", label: "Chest", cx: 120, cy: 106 },
  shoulders: { d: "M 82,86 C 86,80 92,78 96,84 L 96,102 C 92,106 86,104 82,98 Z M 158,86 C 154,80 148,78 144,84 L 144,102 C 148,106 154,104 158,98 Z", label: "Shoulders", cx: 120, cy: 92 },
  abs: { d: "M 108,124 C 110,122 116,122 120,122 C 124,122 130,122 132,124 L 132,168 C 130,174 124,176 120,176 C 116,176 110,174 108,168 Z", label: "Abs", cx: 120, cy: 148 },
  obliques: { d: "M 96,116 C 98,118 102,120 106,122 L 106,168 C 102,172 98,172 96,168 Z M 144,116 C 142,118 138,120 134,122 L 134,168 C 138,172 142,172 144,168 Z", label: "Obliques", cx: 120, cy: 144 },
  upper_back: { d: "M 100,88 C 106,86 114,86 120,86 C 126,86 134,86 140,88 L 140,108 C 134,112 126,114 120,114 C 114,114 106,112 100,108 Z", label: "Upper Back", cx: 120, cy: 98 },
  lats: { d: "M 92,104 C 90,112 90,122 92,130 L 104,124 L 104,110 Z M 148,104 C 150,112 150,122 148,130 L 136,124 L 136,110 Z", label: "Lats", cx: 120, cy: 118 },
  lower_back: { d: "M 106,140 C 110,138 116,138 120,138 C 124,138 130,138 134,140 L 134,168 C 130,172 124,174 120,174 C 116,174 110,172 106,168 Z", label: "Lower Back", cx: 120, cy: 156 },
  biceps: { d: "M 78,100 C 76,108 74,118 76,130 C 78,134 84,132 86,126 L 88,108 C 86,102 80,98 78,100 Z M 162,100 C 164,108 166,118 164,130 C 162,134 156,132 154,126 L 152,108 C 154,102 160,98 162,100 Z", label: "Biceps", cx: 120, cy: 115 },
  triceps: { d: "M 80,104 C 82,110 86,118 86,126 L 84,132 C 80,136 76,132 76,128 L 78,112 Z M 160,104 C 158,110 154,118 154,126 L 156,132 C 160,136 164,132 164,128 L 162,112 Z", label: "Triceps", cx: 120, cy: 118 },
  forearms: { d: "M 74,134 C 72,144 70,156 72,170 C 74,174 80,172 80,166 L 82,142 C 80,136 76,132 74,134 Z M 166,134 C 168,144 170,156 168,170 C 166,174 160,172 160,166 L 158,142 C 160,136 164,132 166,134 Z", label: "Forearms", cx: 120, cy: 152 },
  glutes: { d: "M 102,172 C 106,170 114,170 120,170 C 126,170 134,170 138,172 L 140,186 C 136,192 128,194 120,194 C 112,194 104,192 100,186 Z", label: "Glutes", cx: 120, cy: 182 },
  quads: { d: "M 100,192 C 98,204 96,222 96,240 C 96,250 102,254 108,250 L 114,206 C 110,198 104,192 100,192 Z M 140,192 C 142,204 144,222 144,240 C 144,250 138,254 132,250 L 126,206 C 130,198 136,192 140,192 Z", label: "Quads", cx: 120, cy: 222 },
  hamstrings: { d: "M 98,196 C 96,208 94,224 96,240 C 98,244 104,242 106,236 L 110,210 C 106,202 100,196 98,196 Z M 142,196 C 144,208 146,224 144,240 C 142,244 136,242 134,236 L 130,210 C 134,202 140,196 142,196 Z", label: "Hamstrings", cx: 120, cy: 218 },
  calves: { d: "M 94,254 C 92,268 92,284 94,300 C 96,304 102,302 102,296 L 102,262 C 100,256 96,252 94,254 Z M 146,254 C 148,268 148,284 146,300 C 144,304 138,302 138,296 L 138,262 C 140,256 144,252 146,254 Z", label: "Calves", cx: 120, cy: 278 },
};

/* ══════════════════════════════════════════════════════════════ */
/* ── Biomarker Node Overlay (hover-triggered neon pulse) ── */
/* ══════════════════════════════════════════════════════════════ */
function BiomarkerNodeOverlay({
  node,
  ghostMode,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  node: BiomarkerNodeData;
  ghostMode: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const colors = STATUS_COLORS[node.status];
  const baseRadius = 5;
  const hoverRadius = 7;
  const r = isHovered ? hoverRadius : baseRadius;

  return (
    <g
      className="cursor-pointer"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onTouchStart={onHoverStart}
      onTouchEnd={onHoverEnd}
      style={{ pointerEvents: "all" }}
    >
      {/* Ambient glow — always visible, intensifies on hover */}
      <circle
        cx={node.cx}
        cy={node.cy}
        r={isHovered ? 28 : 16}
        fill={ghostMode ? "rgba(160,160,160,0.02)" : colors.pulse}
        style={{ transition: "r 0.3s ease, fill 0.3s ease" }}
      >
        {isHovered && !ghostMode && (
          <animate
            attributeName="opacity"
            values="0.3;0.6;0.3"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Expanding pulse ring on hover */}
      {isHovered && !ghostMode && (
        <>
          <circle
            cx={node.cx}
            cy={node.cy}
            r={10}
            fill="none"
            stroke={colors.fill}
            strokeWidth={1.2}
            opacity={0.5}
          >
            <animate attributeName="r" values="10;30;10" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={node.cx}
            cy={node.cy}
            r={8}
            fill="none"
            stroke={colors.fill}
            strokeWidth={0.8}
            opacity={0.3}
          >
            <animate attributeName="r" values="8;22;8" dur="2s" repeatCount="indefinite" begin="0.3s" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" begin="0.3s" />
          </circle>
        </>
      )}

      {/* Core node dot */}
      <circle
        cx={node.cx}
        cy={node.cy}
        r={r}
        fill={ghostMode ? "rgba(160,160,160,0.3)" : colors.fill}
        style={{
          transition: "r 0.25s cubic-bezier(0.4,0,0.2,1), fill 0.3s ease",
          filter: isHovered && !ghostMode
            ? `drop-shadow(0 0 12px ${colors.glow}) drop-shadow(0 0 24px ${colors.pulse})`
            : !ghostMode
              ? `drop-shadow(0 0 4px ${colors.glow})`
              : "none",
        }}
      />

      {/* White-hot center */}
      <circle
        cx={node.cx}
        cy={node.cy}
        r={isHovered ? 2.5 : 1.8}
        fill="rgba(255,255,255,0.85)"
        style={{ transition: "r 0.25s ease" }}
      >
        {isHovered && (
          <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Hover label */}
      {isHovered && (
        <g>
          <rect
            x={node.cx - 32}
            y={node.cy - 22}
            width={64}
            height={14}
            rx={7}
            fill="rgba(0,0,0,0.82)"
            stroke={colors.fill}
            strokeWidth={0.6}
            opacity={0.95}
          />
          <text
            x={node.cx}
            y={node.cy - 13}
            textAnchor="middle"
            fill={colors.fill}
            fontSize="5.5"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            {node.label.toUpperCase()}
            {node.value != null ? ` ${node.value}${node.unit || ""}` : ""}
          </text>
        </g>
      )}
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Individual Muscle Group Renderer ── */
/* ══════════════════════════════════════════════════════════════ */
function MuscleGroupPath({
  id, pathData, recovery, ghostMode, isSelected, onSelect,
}: {
  id: string;
  pathData: { d: string; label: string; cx: number; cy: number };
  recovery: MuscleRecoveryData | undefined;
  ghostMode: boolean;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const status = recovery ? getRecoveryStatus(recovery.workedAt, recovery.intensity) : null;
  const isRecovering = status !== null && !status.isReady;
  const justReady = status?.justBecameReady ?? false;
  const glowIntensity = status?.glowIntensity ?? 0;

  const baseFill = ghostMode
    ? `rgba(160,160,160,${isRecovering ? 0.1 : 0.02})`
    : isRecovering
      ? status!.color
      : justReady
        ? "#30D158"
        : "rgba(232,151,108,0.015)";
  const baseStroke = ghostMode
    ? `rgba(160,160,160,${isRecovering ? 0.2 : 0.06})`
    : isRecovering
      ? status!.color
      : justReady
        ? "#30D158"
        : "rgba(232,151,108,0.06)";
  const fillOpacity = isRecovering
    ? Math.max(0.12, glowIntensity * 0.45)
    : justReady ? 0.18 : 0.02;
  const strokeOpacity = isRecovering
    ? Math.max(0.15, glowIntensity * 0.6)
    : justReady ? 0.4 : 0.06;

  const filterId = `heat-${id}`;

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(isSelected ? null : id)}
      style={{ pointerEvents: "all" }}
    >
      {isRecovering && !ghostMode && (
        <>
          <defs>
            <filter id={filterId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={Math.max(3, glowIntensity * 8)} />
            </filter>
          </defs>
          <path d={pathData.d} fill={status!.glowColor} opacity={glowIntensity * 0.35} filter={`url(#${filterId})`}>
            <animate attributeName="opacity" values={`${glowIntensity * 0.2};${glowIntensity * 0.45};${glowIntensity * 0.2}`} dur="2.5s" repeatCount="indefinite" />
          </path>
        </>
      )}

      {justReady && !ghostMode && (
        <>
          <defs>
            <filter id={`ready-${id}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
          </defs>
          <path d={pathData.d} fill="#30D158" opacity={0.25} filter={`url(#ready-${id})`}>
            <animate attributeName="opacity" values="0.15;0.35;0.15" dur="3s" repeatCount="indefinite" />
          </path>
        </>
      )}

      <path
        d={pathData.d}
        fill={baseFill}
        fillOpacity={fillOpacity}
        stroke={baseStroke}
        strokeWidth={isSelected ? 1.5 : 0.7}
        strokeOpacity={strokeOpacity}
        strokeLinejoin="round"
        style={{
          transition: "fill 0.4s ease, stroke 0.4s ease, fill-opacity 0.4s ease",
          filter: isRecovering && !ghostMode
            ? `drop-shadow(0 0 ${Math.round(glowIntensity * 12)}px ${status!.glowColor})`
            : justReady && !ghostMode
              ? "drop-shadow(0 0 8px rgba(48,209,88,0.5))"
              : "none",
        }}
      />

      {isSelected && (
        <path d={pathData.d} fill="none" stroke={ghostMode ? "rgba(200,200,200,0.5)" : "#fff"} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7}>
          <animate attributeName="stroke-dashoffset" values="0;14" dur="1.5s" repeatCount="indefinite" />
        </path>
      )}

      {isRecovering && glowIntensity > 0.5 && !ghostMode && (
        <circle cx={pathData.cx} cy={pathData.cy} r={6} fill="none" stroke={status!.color} strokeWidth={1} opacity={0.4}>
          <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {justReady && !ghostMode && (
        <>
          <circle cx={pathData.cx} cy={pathData.cy} r={5} fill="#30D158" opacity={0.15}>
            <animate attributeName="r" values="5;18;5" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0;0.2" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx={pathData.cx} cy={pathData.cy} r={3} fill="#30D158" opacity={0.3}>
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Recovery Info Tooltip ── */
/* ══════════════════════════════════════════════════════════════ */
function RecoveryTooltip({ muscleId, recovery, ghostMode }: { muscleId: string; recovery: MuscleRecoveryData | undefined; ghostMode: boolean }) {
  const pathData = MUSCLE_PATHS[muscleId];
  if (!pathData) return null;
  const status = recovery ? getRecoveryStatus(recovery.workedAt, recovery.intensity) : null;
  const hoursAgo = recovery ? Math.round((Date.now() - recovery.workedAt) / (1000 * 60 * 60)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      style={{ bottom: 12 }}
    >
      <div
        className="rounded-xl px-4 py-3 min-w-[220px]"
        style={{
          background: ghostMode ? "rgba(30,30,30,0.95)" : "rgba(15,14,13,0.96)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : status ? `${status.color}44` : "rgba(232,151,108,0.15)"}`,
          backdropFilter: "blur(16px)",
          boxShadow: status && !ghostMode ? `0 8px 32px ${status.color}22, 0 0 60px ${status.color}11` : "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 biomap-recovery-dot" style={{ background: status ? status.color : (ghostMode ? "rgba(160,160,160,0.3)" : NEON), boxShadow: status && !ghostMode ? `0 0 8px ${status.color}, 0 0 16px ${status.color}55` : "none" }} />
          <span className="typo-label text-[12px] tracking-[0.08em]" style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : "rgba(232,224,216,0.92)" }}>{pathData.label}</span>
        </div>

        {recovery && status ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="typo-meta text-[10px] biomap-recovery-label" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : status.color }}>{status.label}</span>
              {status.isReady ? (
                <span className="typo-meta text-[10px] px-2 py-0.5 rounded-full" style={{ color: "#30D158", background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.2)" }}>&#x2713; ENGAGE</span>
              ) : (
                <span className="typo-meta text-[10px] tabular-nums" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(232,224,216,0.5)" }}>{formatCountdown(status.hoursRemaining)} remaining</span>
              )}
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden mb-2 relative" style={{ background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(232,224,216,0.06)" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(status.pct * 100)}%` }} transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }} className="h-full rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : status.isReady ? "linear-gradient(90deg, #34C759, #30D158)" : `linear-gradient(90deg, ${status.color}, ${status.pct > 0.7 ? "#34C759" : status.glowColor})`, boxShadow: !ghostMode ? `0 0 8px ${status.color}44` : "none" }} />
              {!status.isReady && <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.6)" }}>{Math.round(status.pct * 100)}%</span>}
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="typo-sublabel text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,224,216,0.3)" }}>Worked {hoursAgo}h ago</span>
              <span className="typo-sublabel text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,224,216,0.3)" }}>{status.totalRecoveryHours}h recovery window</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="typo-sublabel text-[10px]" style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : "rgba(232,224,216,0.35)" }}>{recovery.workoutName}</span>
              <span className="typo-meta text-[8px] px-1.5 py-0.5 rounded-full" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(232,224,216,0.5)", background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.04)", border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.06)"}` }}>
                {recovery.intensity.toUpperCase()}{recovery.intensity === "heavy" ? " (72h)" : recovery.intensity === "moderate" ? " (48h)" : " (24h)"}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(48,209,88,0.12)", color: ghostMode ? "rgba(160,160,160,0.5)" : "#30D158" }}>&#x2713;</span>
            <div className="flex flex-col">
              <span className="typo-label text-[10px]" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "#30D158" }}>Ready for Engagement</span>
              <span className="typo-sublabel text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,224,216,0.3)" }}>Fully recovered &middot; No active recovery window</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Zone Filter Pulse Nodes ── */
/* ══════════════════════════════════════════════════════════════ */
function ZonePulseNode({ cx, cy, isActive, ghostMode, onClick, label, sublabel, side }: { cx: number; cy: number; isActive: boolean; ghostMode: boolean; onClick: () => void; label: string; sublabel: string; side: "left" | "right" }) {
  const baseColor = ghostMode ? "rgba(160,160,160,0.4)" : NEON;
  const dimColor = ghostMode ? "rgba(160,160,160,0.15)" : "rgba(232,151,108,0.25)";
  const activeColor = isActive ? baseColor : dimColor;
  const labelX = side === "left" ? cx - 22 : cx + 22;
  const textAnchor = side === "left" ? "end" : "start";

  return (
    <g className="cursor-pointer" onClick={onClick} style={{ pointerEvents: "all" }}>
      {isActive && !ghostMode && (
        <circle cx={cx} cy={cy} r={8} fill="none" stroke={NEON} strokeWidth={1} opacity={0.15}>
          <animate attributeName="r" values="8;16;8" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0;0.25" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
      {isActive && !ghostMode && <circle cx={cx} cy={cy} r={8} fill={NEON} opacity={0.06} />}
      <circle cx={cx} cy={cy} r={isActive ? 4.5 : 3} fill={activeColor} style={{ filter: isActive && !ghostMode ? `drop-shadow(0 0 8px ${NEON_GLOW})` : "none", transition: "r 0.3s ease, fill 0.3s ease" }} />
      {isActive && !ghostMode && <circle cx={cx} cy={cy} r={1.5} fill="#fff" opacity={0.7} />}
      <line x1={cx + (side === "left" ? -7 : 7)} y1={cy} x2={labelX + (side === "left" ? 5 : -5)} y2={cy} stroke={isActive ? activeColor : "rgba(255,255,255,0.04)"} strokeWidth={0.5} strokeDasharray={isActive ? "none" : "2 2"} />
      <text x={labelX} y={cy - 4} textAnchor={textAnchor} fill={isActive ? (ghostMode ? "rgba(200,200,200,0.6)" : NEON) : (ghostMode ? "rgba(160,160,160,0.2)" : "rgba(232,224,216,0.2)")} fontSize="7.5" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="0.12em" style={{ textShadow: isActive && !ghostMode ? `0 0 10px ${NEON_GLOW}` : "none" }}>{label}</text>
      <text x={labelX} y={cy + 5} textAnchor={textAnchor} fill={isActive ? (ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,151,108,0.35)") : (ghostMode ? "rgba(160,160,160,0.12)" : "rgba(232,224,216,0.12)")} fontSize="5.5" fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.04em">{sublabel}</text>
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Recovery Legend ── */
/* ══════════════════════════════════════════════════════════════ */
function RecoveryLegend({ ghostMode, hasRecovery }: { ghostMode: boolean; hasRecovery: boolean }) {
  if (!hasRecovery) return null;
  const items = [
    { color: "#FF3B30", label: "Active" },
    { color: "#FF9F0A", label: "Rebuilding" },
    { color: "#FFD60A", label: "Adapting" },
    { color: "#34C759", label: "Nearly Ready" },
    { color: "#30D158", label: "Ready", isReady: true },
  ];
  return (
    <div className="flex items-center justify-center gap-2.5 pt-1 pb-3 flex-wrap">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : item.color, boxShadow: ghostMode ? "none" : `0 0 6px ${item.color}66` }} />
          <span className="typo-sublabel text-[8px] uppercase tracking-wider" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,224,216,0.35)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Recovery Summary Badge ── */
/* ══════════════════════════════════════════════════════════════ */
function RecoverySummaryBadge({ recoveringCount, readyCount, ghostMode }: { recoveringCount: number; readyCount: number; ghostMode: boolean }) {
  if (recoveringCount === 0 && readyCount === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {recoveringCount > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-full biomap-recovery-badge" style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,68,68,0.08)", border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,68,68,0.2)"}`, boxShadow: ghostMode ? "none" : "0 0 20px rgba(255,68,68,0.08)" }}>
          <span className="w-2 h-2 rounded-full biomap-recovery-dot flex-shrink-0" style={{ background: ghostMode ? "rgba(160,160,160,0.4)" : "#FF4444", boxShadow: ghostMode ? "none" : "0 0 6px #FF4444, 0 0 12px rgba(255,68,68,0.4)" }} />
          <span className="typo-meta text-[9px] tracking-[0.1em]" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "#FF6B6B" }}>{recoveringCount} IN RECOVERY</span>
        </motion.div>
      )}
      {readyCount > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(48,209,88,0.08)", border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(48,209,88,0.2)"}`, boxShadow: ghostMode ? "none" : "0 0 20px rgba(48,209,88,0.08)" }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ghostMode ? "rgba(160,160,160,0.4)" : "#30D158", boxShadow: ghostMode ? "none" : "0 0 6px #30D158, 0 0 12px rgba(48,209,88,0.4)" }} />
          <span className="typo-meta text-[9px] tracking-[0.1em]" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "#30D158" }}>{readyCount} READY</span>
        </motion.div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── DEFAULT BIOMARKER NODES (zone-mapped) ── */
/* ══════════════════════════════════════════════════════════════ */
const DEFAULT_BIOMARKER_NODES: BiomarkerNodeData[] = [
  { id: "cortisol", label: "Cortisol", status: "warning", cx: 120, cy: 36, value: 18.2, unit: "μg/dL" },
  { id: "hrv", label: "HRV", status: "optimal", cx: 108, cy: 106, value: 72, unit: "ms" },
  { id: "spo2", label: "SpO2", status: "optimal", cx: 140, cy: 100, value: 98, unit: "%" },
  { id: "glucose", label: "Glucose", status: "warning", cx: 120, cy: 158, value: 105, unit: "mg/dL" },
  { id: "crp", label: "CRP", status: "optimal", cx: 92, cy: 140, value: 0.4, unit: "mg/L" },
  { id: "vitd", label: "Vitamin D", status: "warning", cx: 148, cy: 140, value: 28, unit: "ng/mL" },
];

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN BIOMAP COMPONENT ── */
/* ══════════════════════════════════════════════════════════════ */
export function BioMap({ activeZone, onZoneChange, ghostMode, muscleRecovery = [], biomarkerNodes, onBiomarkerHover }: BioMapProps) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const silhouetteColor = ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,151,108,0.025)";
  const silhouetteStroke = ghostMode ? "rgba(160,160,160,0.1)" : "rgba(232,151,108,0.06)";

  const nodes = biomarkerNodes ?? DEFAULT_BIOMARKER_NODES;

  const recoveryMap = useMemo(() => {
    const map: Record<string, MuscleRecoveryData> = {};
    for (const r of muscleRecovery) {
      const existing = map[r.muscleGroup];
      if (!existing || r.workedAt > existing.workedAt) map[r.muscleGroup] = r;
    }
    return map;
  }, [muscleRecovery]);

  const hasRecovery = muscleRecovery.length > 0;

  const { recoveringMuscles, readyMuscles } = useMemo(() => {
    const recovering: [string, MuscleRecoveryData][] = [];
    const ready: [string, MuscleRecoveryData][] = [];
    for (const [id, r] of Object.entries(recoveryMap)) {
      const s = getRecoveryStatus(r.workedAt, r.intensity);
      if (s.isReady && s.justBecameReady) ready.push([id, r]);
      else if (!s.isReady) recovering.push([id, r]);
    }
    return { recoveringMuscles: recovering, readyMuscles: ready };
  }, [recoveryMap]);

  useEffect(() => {
    if (!selectedMuscle) return;
    const t = setTimeout(() => setSelectedMuscle(null), 6000);
    return () => clearTimeout(t);
  }, [selectedMuscle]);

  const handleSelect = useCallback((id: string | null) => setSelectedMuscle(id), []);

  /** Dispatch biomarker hover event to FluidCanvas for proximity glow */
  const handleBiomarkerHover = useCallback((node: BiomarkerNodeData | null) => {
    setHoveredNode(node?.id ?? null);
    onBiomarkerHover?.(node);

    // Dispatch custom event for FluidCanvas proximity glow
    if (node) {
      const colors = STATUS_COLORS[node.status];
      window.dispatchEvent(new CustomEvent("vive-biomarker-hover", {
        detail: {
          id: node.id,
          status: node.status,
          color: colors.fill,
          glowColor: colors.glow,
          label: node.label,
          cx: node.cx,
          cy: node.cy,
        },
      }));
    } else {
      window.dispatchEvent(new CustomEvent("vive-biomarker-hover", { detail: null }));
    }
  }, [onBiomarkerHover]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mx-5 mb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1" style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,151,108,0.08)" }} />
        <span className="typo-label text-[10px] tracking-[0.2em]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,151,108,0.45)" }}>MUSCLE RECOVERY MAP</span>
        <div className="h-px flex-1" style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,151,108,0.08)" }} />
      </div>

      <div className="flex justify-center mb-3">
        <RecoverySummaryBadge recoveringCount={recoveringMuscles.length} readyCount={readyMuscles.length} ghostMode={ghostMode} />
      </div>

      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: ghostMode ? "rgba(12,12,12,0.4)" : "rgba(15,14,13,0.6)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,151,108,0.06)"}`,
        }}
      >
        {!ghostMode && activeZone !== "all" && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 50% 35% at 50% ${activeZone === "mind" ? "12%" : activeZone === "cardio" ? "35%" : "65%"}, rgba(232,151,108,0.04) 0%, transparent 70%)`, transition: "background 0.5s ease" }} />
        )}

        {!ghostMode && recoveringMuscles.length > 0 && (
          <div className="absolute inset-0 pointer-events-none biomap-ambient-glow" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,100,50,0.03) 0%, transparent 70%)" }} />
        )}

        <div className="flex items-center justify-center pt-5 pb-3 px-2">
          <svg width="240" height="340" viewBox="0 0 240 380" className="block" style={{ maxWidth: "100%" }}>
            <defs>
              <filter id="biomap-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ghostMode ? "rgba(160,160,160,0.04)" : "rgba(232,151,108,0.03)"} />
                <stop offset="100%" stopColor={ghostMode ? "rgba(160,160,160,0.01)" : "rgba(232,151,108,0.005)"} />
              </linearGradient>
            </defs>

            {/* Human Wireframe Silhouette */}
            <g opacity={0.6}>
              <ellipse cx={120} cy={42} rx={14} ry={18} fill={silhouetteColor} stroke={silhouetteStroke} strokeWidth={0.6} />
              <circle cx={114} cy={40} r={1.5} fill={ghostMode ? "rgba(160,160,160,0.08)" : "rgba(232,151,108,0.06)"} />
              <circle cx={126} cy={40} r={1.5} fill={ghostMode ? "rgba(160,160,160,0.08)" : "rgba(232,151,108,0.06)"} />
              <rect x={114} y={60} width={12} height={14} rx={3} fill={silhouetteColor} stroke={silhouetteStroke} strokeWidth={0.4} />
              <path d="M 88,82 C 84,78 78,78 76,84 L 72,104 L 78,140 L 88,172 L 100,182 L 120,186 L 140,182 L 152,172 L 162,140 L 168,104 L 164,84 C 162,78 156,78 152,82 Z" fill="url(#bodyGrad)" stroke={silhouetteStroke} strokeWidth={0.5} />
              <path d="M 76,84 C 70,96 66,114 64,134 C 62,150 62,166 64,176" fill="none" stroke={silhouetteStroke} strokeWidth={0.5} />
              <path d="M 164,84 C 170,96 174,114 176,134 C 178,150 178,166 176,176" fill="none" stroke={silhouetteStroke} strokeWidth={0.5} />
              <ellipse cx={64} cy={180} rx={5} ry={7} fill={silhouetteColor} stroke={silhouetteStroke} strokeWidth={0.3} />
              <ellipse cx={176} cy={180} rx={5} ry={7} fill={silhouetteColor} stroke={silhouetteStroke} strokeWidth={0.3} />
              <path d="M 106,184 C 102,200 98,224 96,248 C 94,270 94,294 96,310 L 96,340" fill="none" stroke={silhouetteStroke} strokeWidth={0.5} />
              <path d="M 134,184 C 138,200 142,224 144,248 C 146,270 146,294 144,310 L 144,340" fill="none" stroke={silhouetteStroke} strokeWidth={0.5} />
              <ellipse cx={96} cy={346} rx={8} ry={5} fill={silhouetteColor} stroke={silhouetteStroke} strokeWidth={0.3} />
              <ellipse cx={144} cy={346} rx={8} ry={5} fill={silhouetteColor} stroke={silhouetteStroke} strokeWidth={0.3} />
              <line x1={120} y1={74} x2={120} y2={184} stroke={ghostMode ? "rgba(160,160,160,0.03)" : "rgba(232,151,108,0.02)"} strokeWidth={0.4} strokeDasharray="3 4" />
            </g>

            {/* Muscle Group Heat-Map Overlays */}
            {Object.entries(MUSCLE_PATHS).map(([id, pathData]) => (
              <MuscleGroupPath key={id} id={id} pathData={pathData} recovery={recoveryMap[id]} ghostMode={ghostMode} isSelected={selectedMuscle === id} onSelect={handleSelect} />
            ))}

            {/* SVG labels on recovering muscles */}
            {!ghostMode && recoveringMuscles
              .filter(([, r]) => getRecoveryStatus(r.workedAt, r.intensity).glowIntensity > 0.5)
              .map(([id]) => {
                const p = MUSCLE_PATHS[id];
                if (!p) return null;
                const s = getRecoveryStatus(recoveryMap[id].workedAt, recoveryMap[id].intensity);
                const countdown = formatCountdown(s.hoursRemaining);
                return (
                  <g key={`label-${id}`}>
                    <rect x={p.cx - 22} y={p.cy - 5} width={44} height={10} rx={5} fill="rgba(0,0,0,0.75)" stroke={s.color} strokeWidth={0.5} opacity={0.85}>
                      <animate attributeName="opacity" values="0.65;0.95;0.65" dur="2.5s" repeatCount="indefinite" />
                    </rect>
                    <text x={p.cx} y={p.cy + 2.5} textAnchor="middle" fill={s.color} fontSize="4.5" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="0.06em">
                      <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" />
                      {countdown} LEFT
                    </text>
                  </g>
                );
              })}

            {/* "READY" labels on just-recovered muscles */}
            {!ghostMode && readyMuscles.map(([id]) => {
              const p = MUSCLE_PATHS[id];
              if (!p) return null;
              return (
                <g key={`ready-label-${id}`}>
                  <rect x={p.cx - 16} y={p.cy - 5} width={32} height={10} rx={5} fill="rgba(0,0,0,0.7)" stroke="#30D158" strokeWidth={0.6} opacity={0.9}>
                    <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
                  </rect>
                  <text x={p.cx} y={p.cy + 2.5} textAnchor="middle" fill="#30D158" fontSize="5" fontFamily="Inter, sans-serif" fontWeight="800" letterSpacing="0.12em">
                    <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
                    READY
                  </text>
                </g>
              );
            })}

            {/* ── Biomarker Node Overlays (hover-triggered neon pulse) ── */}
            {nodes.map((node) => (
              <BiomarkerNodeOverlay
                key={node.id}
                node={node}
                ghostMode={ghostMode}
                isHovered={hoveredNode === node.id}
                onHoverStart={() => handleBiomarkerHover(node)}
                onHoverEnd={() => handleBiomarkerHover(null)}
              />
            ))}

            {/* Zone Filter Pulse Nodes */}
            <ZonePulseNode cx={120} cy={36} isActive={activeZone === "all" || activeZone === "mind"} ghostMode={ghostMode} onClick={() => onZoneChange(activeZone === "mind" ? "all" : "mind")} label="MIND" sublabel="Sleep &middot; Stress" side="right" />
            <ZonePulseNode cx={108} cy={106} isActive={activeZone === "all" || activeZone === "cardio"} ghostMode={ghostMode} onClick={() => onZoneChange(activeZone === "cardio" ? "all" : "cardio")} label="CARDIO" sublabel="HR &middot; HRV &middot; SpO2" side="left" />
            <ZonePulseNode cx={120} cy={158} isActive={activeZone === "all" || activeZone === "metabolic"} ghostMode={ghostMode} onClick={() => onZoneChange(activeZone === "metabolic" ? "all" : "metabolic")} label="METABOLIC" sublabel="Temp &middot; Recovery" side="right" />
          </svg>
        </div>

        <RecoveryLegend ghostMode={ghostMode} hasRecovery={hasRecovery} />

        <AnimatePresence>
          {selectedMuscle && <RecoveryTooltip key={selectedMuscle} muscleId={selectedMuscle} recovery={recoveryMap[selectedMuscle]} ghostMode={ghostMode} />}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeZone !== "all" && (
            <motion.div key={activeZone} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="flex items-center justify-center pb-3 gap-2">
              <button onClick={() => onZoneChange("all")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200" style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,151,108,0.06)", border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(232,151,108,0.15)"}` }}>
                <span className="typo-meta text-[9px] tracking-[0.1em]" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : NEON, textShadow: ghostMode ? "none" : `0 0 6px ${NEON_GLOW}` }}>FILTERING: {activeZone.toUpperCase()}</span>
                <span className="text-[10px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(232,151,108,0.4)" }}>&#x2715;</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!selectedMuscle && hasRecovery && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="text-center mt-2 typo-sublabel text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.25)" : "rgba(232,224,216,0.2)" }}>
          Tap a muscle group to view recovery countdown
        </motion.p>
      )}
    </motion.div>
  );
}
