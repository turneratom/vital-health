import { useState, useEffect, useRef, useMemo, useCallback, Component, type ReactNode } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { useAnalytics } from "@/lib/useAnalytics";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAccessTier } from "@/components/AccessController";
import { calculateBiologicalAgeOffset, type BioAgeResult } from "@/lib/bioSyncLogic";

/* ── Error Boundary ── */
class ScoreErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

/* ── Constants ── */
const CYAN = "#00FFCC";
const PURPLE = "#AF82FF";
const BLUE = "#6B8AFF";

/* ── Score tier config ── */
function getScoreTier(score: number) {
  if (score >= 90) return { label: "APEX", color: "#FFD700", glow: "rgba(255,215,0,0.4)", tier: "apex" as const };
  if (score >= 75) return { label: "ELITE", color: CYAN, glow: "rgba(0,255,204,0.35)", tier: "elite" as const };
  if (score >= 60) return { label: "STRONG", color: PURPLE, glow: "rgba(175,130,255,0.3)", tier: "strong" as const };
  if (score >= 40) return { label: "BUILDING", color: BLUE, glow: "rgba(107,138,255,0.25)", tier: "building" as const };
  return { label: "STARTING", color: "#FFB86B", glow: "rgba(255,184,107,0.2)", tier: "starting" as const };
}

/* ── Count-up hook: animates from 0 to target on mount ── */
function useCountUp(target: number, duration = 1800, delay = 400): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current && target === value) return;
    hasAnimated.current = true;

    const startTime = performance.now() + delay;
    const startVal = 0;

    function tick(now: number) {
      if (now < startTime) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (target - startVal) * eased);
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, delay, duration]);

  return value;
}

/* ── Protocol completion highlight hook ── */
function useProtocolHighlight() {
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    function onProtocolCompleted() {
      setHighlighted(true);
      setTimeout(() => setHighlighted(false), 2500);
    }
    window.addEventListener("protocol-completed", onProtocolCompleted);
    return () => window.removeEventListener("protocol-completed", onProtocolCompleted);
  }, []);

  return highlighted;
}

/* ── Semi-circular Progress Ring Gauge ── */
function ArcGauge({
  score,
  size = 260,
  ghostMode,
  highlighted,
}: {
  score: number;
  size?: number;
  ghostMode: boolean;
  highlighted: boolean;
}) {
  const displayScore = useCountUp(score, 1800, 300);
  const tier = getScoreTier(displayScore);
  const finalTier = getScoreTier(score);

  const center = size / 2;
  const strokeWidth = 10;
  const outerPad = 32;
  const r = (size - outerPad * 2) / 2;
  const circumference = 2 * Math.PI * r;

  const arcSpan = 270;
  const startAngle = 135;
  const arcLength = circumference * (arcSpan / 360);
  const gapLength = circumference - arcLength;

  const pct = Math.min(displayScore / 100, 1);
  const filledLength = arcLength * pct;
  const unfilledLength = arcLength - filledLength + gapLength;

  const rotationOffset = -circumference * (startAngle / 360);

  /* ── Tick marks ── */
  const ticks = useMemo(() => {
    const count = 100;
    return Array.from({ length: count + 1 }, (_, i) => {
      const angle = startAngle + (i / count) * arcSpan;
      const rad = (angle * Math.PI) / 180;
      const isMajor = i % 10 === 0;
      const isMid = i % 5 === 0 && !isMajor;
      const tickLen = isMajor ? 16 : isMid ? 10 : 6;
      const outerR = r + 18;
      const innerR = outerR - tickLen;
      const x1 = center + innerR * Math.cos(rad);
      const y1 = center + innerR * Math.sin(rad);
      const x2 = center + outerR * Math.cos(rad);
      const y2 = center + outerR * Math.sin(rad);
      const scorePct = i / count;
      const isLit = scorePct <= pct;
      const isAtScore = Math.abs(i - Math.round(pct * count)) <= 1;
      return { x1, y1, x2, y2, isMajor, isMid, isLit, isAtScore, index: i };
    });
  }, [center, r, pct]);

  /* ── Score labels ── */
  const scoreLabels = useMemo(() => {
    return [0, 25, 50, 75, 100].map((val) => {
      const angle = startAngle + (val / 100) * arcSpan;
      const rad = (angle * Math.PI) / 180;
      const labelR = r + 30;
      const x = center + labelR * Math.cos(rad);
      const y = center + labelR * Math.sin(rad);
      return { val, x, y };
    });
  }, [center, r]);

  /* ── Endpoint dot position ── */
  const endAngle = startAngle + pct * arcSpan;
  const endRad = (endAngle * Math.PI) / 180;
  const dotX = center + r * Math.cos(endRad);
  const dotY = center + r * Math.sin(endRad);

  const arcColor = ghostMode ? "rgba(160,160,160,0.5)" : finalTier.color;
  const glowColor = ghostMode ? "transparent" : finalTier.glow;
  const gradId = "eliteArcGrad2";
  const glowId = "eliteGlow2";
  const bgGlowId = "eliteBgGlow2";
  const highlightGlowId = "eliteHighlightGlow";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ambient glow behind gauge */}
      {!ghostMode && (
        <motion.div
          className="absolute rounded-full"
          animate={{
            opacity: highlighted ? 0.9 : 0.5,
            scale: highlighted ? 1.15 : 1,
          }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{
            inset: "10%",
            background: highlighted
              ? `radial-gradient(circle, rgba(52,211,153,0.5) 0%, ${finalTier.glow} 40%, transparent 70%)`
              : `radial-gradient(circle, ${finalTier.glow} 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
      )}

      {/* Protocol completion highlight ring */}
      <AnimatePresence>
        {highlighted && !ghostMode && (
          <motion.div
            className="absolute rounded-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.8, 0.4, 0.6, 0], scale: [0.8, 1.1, 1.05, 1.08, 1.15] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            style={{
              inset: "-5%",
              border: "2px solid rgba(52,211,153,0.4)",
              boxShadow: "0 0 30px rgba(52,211,153,0.3), 0 0 60px rgba(52,211,153,0.15), inset 0 0 30px rgba(52,211,153,0.1)",
            }}
          />
        )}
      </AnimatePresence>

      <svg width={size} height={size} className="relative z-10" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ghostMode ? "rgba(160,160,160,0.4)" : finalTier.color} />
            <stop offset="40%" stopColor={ghostMode ? "rgba(160,160,160,0.5)" : CYAN} />
            <stop offset="100%" stopColor={ghostMode ? "rgba(160,160,160,0.6)" : finalTier.color} />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={bgGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>
          {/* Highlight glow filter — stronger */}
          <filter id={highlightGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Tick marks ── */}
        {ticks.map((tick) => {
          let stroke: string;
          let width: number;
          let opacity = 1;

          if (tick.isAtScore && !ghostMode) {
            stroke = highlighted ? "#34D399" : finalTier.color;
            width = highlighted ? 4 : 3;
          } else if (tick.isLit) {
            stroke = ghostMode ? "rgba(160,160,160,0.25)" : (highlighted ? "#34D399" : finalTier.color);
            width = tick.isMajor ? 2 : 1;
            opacity = ghostMode ? 0.25 : (highlighted ? (tick.isMajor ? 0.9 : 0.6) : (tick.isMajor ? 0.7 : 0.4));
          } else {
            stroke = ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.08)";
            width = tick.isMajor ? 1.5 : 0.75;
            opacity = 1;
          }

          return (
            <line
              key={tick.index}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              opacity={opacity}
              style={
                tick.isAtScore && !ghostMode
                  ? { filter: `drop-shadow(0 0 ${highlighted ? "6" : "3"}px ${highlighted ? "#34D399" : finalTier.color})` }
                  : undefined
              }
            />
          );
        })}

        {/* ── Score labels ── */}
        {scoreLabels.map(({ val, x, y }) => (
          <text
            key={val}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={ghostMode ? "rgba(160,160,160,0.2)" : "rgba(255,255,255,0.2)"}
            fontSize="9"
            fontFamily="monospace"
            fontWeight={val === 0 || val === 100 ? 600 : 400}
          >
            {val}
          </text>
        ))}

        {/* ── Background track ── */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={rotationOffset}
          strokeLinecap="round"
        />

        {/* ── Glow layer behind filled arc ── */}
        {!ghostMode && (
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={highlighted ? "#34D399" : finalTier.color}
            strokeWidth={strokeWidth + (highlighted ? 14 : 8)}
            strokeDasharray={`${filledLength} ${unfilledLength}`}
            strokeDashoffset={rotationOffset}
            strokeLinecap="round"
            opacity={highlighted ? 0.25 : 0.15}
            filter={highlighted ? `url(#${highlightGlowId})` : `url(#${bgGlowId})`}
            style={{ transition: "stroke 0.6s, stroke-width 0.6s, opacity 0.6s, stroke-dasharray 1.8s cubic-bezier(0.4,0,0.2,1)" }}
          />
        )}

        {/* ── Filled arc ── */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledLength} ${unfilledLength}`}
          strokeDashoffset={rotationOffset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1.8s cubic-bezier(0.4,0,0.2,1)",
            filter: ghostMode ? "none" : `drop-shadow(0 0 ${highlighted ? "14" : "8"}px ${highlighted ? "rgba(52,211,153,0.5)" : glowColor})`,
          }}
        />

        {/* ── Endpoint indicator dot ── */}
        {displayScore > 0 && (
          <>
            {!ghostMode && (
              <circle
                cx={dotX}
                cy={dotY}
                r={highlighted ? 14 : 10}
                fill={highlighted ? "#34D399" : finalTier.color}
                opacity={highlighted ? 0.25 : 0.15}
                style={{
                  transition: "r 0.6s, fill 0.6s, cx 1.8s cubic-bezier(0.4,0,0.2,1), cy 1.8s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            )}
            <circle
              cx={dotX}
              cy={dotY}
              r={5}
              fill={highlighted && !ghostMode ? "#34D399" : arcColor}
              style={{
                transition: "fill 0.6s, cx 1.8s cubic-bezier(0.4,0,0.2,1), cy 1.8s cubic-bezier(0.4,0,0.2,1)",
                filter: ghostMode ? "none" : `drop-shadow(0 0 ${highlighted ? "10" : "6"}px ${highlighted ? "rgba(52,211,153,0.6)" : glowColor})`,
              }}
            />
            <circle
              cx={dotX}
              cy={dotY}
              r={2}
              fill="#fff"
              opacity={ghostMode ? 0.2 : (highlighted ? 1 : 0.8)}
              style={{
                transition: "cx 1.8s cubic-bezier(0.4,0,0.2,1), cy 1.8s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </>
        )}
      </svg>

      {/* ── Center content: score number + tier badge ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ paddingTop: 8 }}>
        {/* Count-up number */}
        <motion.span
          className="typo-data leading-none tabular-nums"
          animate={{
            scale: highlighted ? [1, 1.08, 1] : 1,
            color: highlighted && !ghostMode ? "#34D399" : arcColor,
          }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{
            fontSize: size > 240 ? 96 : 80,
            color: arcColor,
            textShadow: ghostMode
              ? "none"
              : highlighted
                ? "0 0 40px rgba(52,211,153,0.5), 0 0 80px rgba(52,211,153,0.3)"
                : `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
            letterSpacing: "-0.02em",
          }}
        >
          {displayScore}
        </motion.span>

        {/* Label */}
        <motion.span
          className="typo-header text-[10px] tracking-[0.25em] mt-0.5"
          animate={{
            color: highlighted && !ghostMode ? "rgba(52,211,153,0.6)" : (ghostMode ? "rgba(160,160,160,0.45)" : "rgba(255,255,255,0.4)"),
          }}
          transition={{ duration: 0.6 }}
        >
          READY FOR TODAY?
        </motion.span>

        {/* Tier badge */}
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: highlighted ? 1.1 : 1,
          }}
          transition={{ delay: highlighted ? 0 : 2.2, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="mt-2.5 px-4 py-1 rounded-full"
          style={{
            background: ghostMode
              ? "rgba(160,160,160,0.06)"
              : highlighted
                ? "rgba(52,211,153,0.12)"
                : `${finalTier.color}10`,
            border: `1px solid ${ghostMode
              ? "rgba(160,160,160,0.12)"
              : highlighted
                ? "rgba(52,211,153,0.35)"
                : `${finalTier.color}30`}`,
            boxShadow: ghostMode
              ? "none"
              : highlighted
                ? "0 0 20px rgba(52,211,153,0.3), inset 0 0 10px rgba(52,211,153,0.08)"
                : `0 0 16px ${glowColor}, inset 0 0 8px ${finalTier.color}08`,
          }}
        >
          <span
            className="typo-label tracking-[0.2em] text-[11px]"
            style={{
              color: ghostMode
                ? "rgba(160,160,160,0.5)"
                : highlighted
                  ? "#34D399"
                  : finalTier.color,
            }}
          >
            {highlighted ? "UPDATING..." : finalTier.label}
          </span>
        </motion.div>

        {/* "Protocol synced" micro-label during highlight */}
        <AnimatePresence>
          {highlighted && !ghostMode && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="mt-1.5 text-[8px] tracking-[0.2em] uppercase"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: "rgba(52,211,153,0.5)",
              }}
            >
              Protocol synced
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Score Info Icon for breakdown pills ── */
function ScoreInfoIcon({ chartKey, ghostMode }: { chartKey: string; ghostMode: boolean }) {
  const { trackInfoClick } = useAnalytics();
  const [show, setShow] = useState(false);
  const tips: Record<string, string> = {
    vitality_fueling: "Points earned from logging meals. More consistent fueling = higher score.",
    vitality_movement: "Points from logged workouts and activity. Stay active to boost this.",
    vitality_hrv: "Heart Rate Variability bonus. Better sleep and recovery improve this.",
    vitality_base: "Baseline points for showing up and engaging with your plan daily.",
  };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); trackInfoClick(chartKey, "vitality_score"); setShow(!show); if (!show) setTimeout(() => setShow(false), 3500); }}
      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
      style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)", border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.08)"}` }}
      aria-label={`What is ${chartKey}?`}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke={ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.3)"} strokeWidth="0.8" />
        <path d="M4.2 3.8C4.2 3.2 4.6 2.8 5 2.8C5.4 2.8 5.8 3.2 5.8 3.8C5.8 4.2 5.4 4.4 5 4.6V5.2" stroke={ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.4)"} strokeWidth="0.8" strokeLinecap="round" />
        <circle cx="5" cy="6.5" r="0.5" fill={ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.4)"} />
      </svg>
    </button>
  );
}

/* ── Breakdown pill ── */
function BreakdownPill({
  label, points, maxPoints, icon, color, ghostMode,
}: {
  label: string; points: number; maxPoints: number; icon: string; color: string; ghostMode: boolean;
}) {
  const pct = Math.min(100, Math.max(0, ((points + maxPoints) / (maxPoints * 2)) * 100));
  const isPositive = points >= 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl px-3 py-2.5 flex-1 min-w-0"
      style={{
        background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span className="typo-label flex-1" style={{ color: ghostMode ? "rgba(160,160,160,0.45)" : undefined }}>
          {label}
        </span>
        <ScoreInfoIcon chartKey={`vitality_${label.toLowerCase().replace(/\s+/g, '_')}`} ghostMode={ghostMode} />
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="typo-data text-2xl tabular-nums"
          style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : isPositive ? color : "#FF6B6B" }}
        >
          {isPositive ? "+" : ""}{points}
        </span>
        <span className="typo-sublabel" style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : undefined }}>
          / {maxPoints}
        </span>
      </div>
      <div
        className="h-[3px] rounded-full overflow-hidden"
        style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.03)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="h-full rounded-full"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.3)"
              : isPositive ? `linear-gradient(90deg, ${color}88, ${color})` : "linear-gradient(90deg, #FF6B6B88, #FF6B6B)",
            boxShadow: ghostMode ? "none" : `0 0 6px ${isPositive ? color : "#FF6B6B"}30`,
          }}
        />
      </div>
    </div>
  );
}

/* ── Local score calculation ── */
function calculateLocalScore(
  foodLogCount: number, activityLogCount: number, currentHrv: number, hrvHistory7d: number[]
): number {
  const base = 50;
  const fueling = Math.min(30, (foodLogCount ?? 0) * 10);
  const movement = (activityLogCount ?? 0) > 0 ? 20 : 0;
  const hrv = calculateHrvPoints(currentHrv ?? 0, hrvHistory7d ?? []);
  return Math.max(1, Math.min(100, base + fueling + movement + hrv));
}

function calculateHrvPoints(currentHrv: number, hrvHistory7d: number[]): number {
  const safeHrv = currentHrv ?? 0;
  const safeHistory = hrvHistory7d ?? [];
  const avg = safeHistory.length > 0
    ? safeHistory.reduce((s, v) => s + (v ?? 0), 0) / safeHistory.length
    : safeHrv;
  if (avg <= 0) return 0;
  const ratio = (safeHrv - avg) / avg;
  return Math.max(-20, Math.min(20, Math.round(ratio * 100)));
}

/* ── Performance Delta Badge (Elite only) ── */
function PerformanceDeltaBadge({ bioAge, ghostMode }: { bioAge: BioAgeResult; ghostMode: boolean }) {
  if (bioAge.confidence === 'insufficient') return null;

  const isYounger = bioAge.direction === 'younger';
  const isAligned = bioAge.direction === 'aligned';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 2.6, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="mt-3 flex flex-col items-center gap-1.5"
    >
      {/* Delta pill */}
      <div
        className="flex items-center gap-1.5 px-3 py-1 rounded-full"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.06)' : `${bioAge.color}12`,
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${bioAge.color}30`}`,
          boxShadow: ghostMode ? 'none' : `0 0 12px ${bioAge.glowColor}`,
        }}
      >
        {/* Arrow icon */}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          {isYounger ? (
            <path d="M5 8V2M5 2L2 5M5 2L8 5" stroke={ghostMode ? 'rgba(160,160,160,0.5)' : bioAge.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : isAligned ? (
            <path d="M2 5H8" stroke={ghostMode ? 'rgba(160,160,160,0.5)' : bioAge.color} strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M5 2V8M5 8L2 5M5 8L8 5" stroke={ghostMode ? 'rgba(160,160,160,0.5)' : bioAge.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
        <span
          className="text-[11px] font-bold tracking-wide tabular-nums"
          style={{
            color: ghostMode ? 'rgba(160,160,160,0.5)' : bioAge.color,
            textShadow: ghostMode ? 'none' : `0 0 8px ${bioAge.glowColor}`,
          }}
        >
          {bioAge.label}
        </span>
      </div>

      {/* Label */}
      <span
        className="text-[8px] tracking-[0.2em] uppercase"
        style={{
          color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.3)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        PERFORMANCE DELTA
      </span>

      {/* Confidence indicator */}
      <div className="flex items-center gap-1">
        {Array.from({ length: bioAge.markersTotal }, (_, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{
              background: i < bioAge.markersUsed
                ? (ghostMode ? 'rgba(160,160,160,0.4)' : bioAge.color)
                : (ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.08)'),
              boxShadow: i < bioAge.markersUsed && !ghostMode ? `0 0 3px ${bioAge.glowColor}` : 'none',
            }}
          />
        ))}
        <span
          className="text-[7px] ml-1 tracking-wider uppercase"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(255,255,255,0.2)' }}
        >
          {bioAge.confidence}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Hook: useBioAgeOffset ── */
function useBioAgeOffset(sessionId: string): BioAgeResult | null {
  // Safely query vitals — getUserVitals returns null when no record exists
  const userVitals = useQuery(
    api.queries.getUserVitals as any,
    sessionId ? { sessionId } : 'skip'
  ) as any;

  // Safely query bioVault — getBioVaultBySession returns null when no record exists
  const bioVaultRaw = useQuery(
    api.queries.getBioVaultBySession as any,
    sessionId ? { sessionId } : 'skip'
  ) as any;

  return useMemo(() => {
    // Guard: if either query is still loading (undefined) or returned null, bail
    if (userVitals === undefined || bioVaultRaw === undefined) return null;
    if (!userVitals || !bioVaultRaw) return null;

    const age = userVitals?.age;
    if (!age || typeof age !== 'number' || age < 18) return null;

    // Extract biomarkers safely with null coalescing
    const vault = Array.isArray(bioVaultRaw) ? bioVaultRaw[0] : bioVaultRaw;
    if (!vault) return null;

    try {
      return calculateBiologicalAgeOffset({
        chronologicalAge: age,
        biomarkers: {
          vitaminD: vault?.vitaminD ?? null,
          ferritin: vault?.ferritin ?? null,
          crp: vault?.crp ?? null,
          hba1c: vault?.hba1c ?? null,
          testosteroneTotal: vault?.testosteroneTotal ?? null,
          testosteroneFree: vault?.testosteroneFree ?? null,
        },
      });
    } catch {
      // If calculation fails for any reason, return null instead of crashing
      return null;
    }
  }, [bioVaultRaw, userVitals]);
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'default';
  let id = sessionStorage.getItem('vive-session-id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('vive-session-id', id);
  }
  return id;
}

/* ── Main inner component ── */
function EliteScoreGaugeInner({
  foodLogCount,
  activityLogCount,
  currentHrv = 82,
  hrvHistory7d = [68, 72, 65, 78, 70, 75, 80],
}: {
  foodLogCount: number;
  activityLogCount: number;
  currentHrv?: number | undefined;
  hrvHistory7d?: number[] | undefined;
}) {
  const ghostMode = useGhostMode();
  const highlighted = useProtocolHighlight();
  const { isElite } = useAccessTier();
  const sessionId = useMemo(() => getSessionId(), []);
  const bioAge = useBioAgeOffset(sessionId);

  const score = calculateLocalScore(foodLogCount, activityLogCount, currentHrv, hrvHistory7d);

  return (
    <div className="flex flex-col items-center w-full">
      <ArcGauge score={score} size={260} ghostMode={ghostMode} highlighted={highlighted} />
      {isElite && bioAge && bioAge.confidence !== 'insufficient' && (
        <PerformanceDeltaBadge bioAge={bioAge} ghostMode={ghostMode} />
      )}
    </div>
  );
}

/* ── Fallback gauge ── */
function FallbackGauge({ foodLogCount, activityLogCount }: { foodLogCount: number; activityLogCount: number }) {
  const ghostMode = useGhostMode();
  const score = calculateLocalScore(foodLogCount, activityLogCount, 82, [68, 72, 65, 78, 70, 75, 80]);
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <ArcGauge score={score} ghostMode={ghostMode} highlighted={false} />
    </div>
  );
}

/* ── Public export with error boundary ── */
export function EliteScoreGauge(props: {
  foodLogCount: number | undefined;
  activityLogCount: number | undefined;
  currentHrv?: number;
  hrvHistory7d?: number[];
}) {
  // Null-coalesce before passing to inner components
  const safeFoodLogCount = props.foodLogCount ?? 0;
  const safeActivityLogCount = props.activityLogCount ?? 0;

  return (
    <ScoreErrorBoundary fallback={<FallbackGauge foodLogCount={safeFoodLogCount} activityLogCount={safeActivityLogCount} />}>
      <EliteScoreGaugeInner
        foodLogCount={safeFoodLogCount}
        activityLogCount={safeActivityLogCount}
        currentHrv={props.currentHrv}
        hrvHistory7d={props.hrvHistory7d}
      />
    </ScoreErrorBoundary>
  );
}
