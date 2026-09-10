import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Error Boundary ── */
class GaugeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center py-12">
          <span style={{ color: "rgba(100,100,120,0.5)", fontSize: 13 }}>Score unavailable</span>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Tier config ── */
function getTier(score: number) {
  if (score >= 90) return { label: "APEX", color: "#F59E0B", glow: "rgba(245,158,11,0.35)", ring: "#FCD34D" };
  if (score >= 75) return { label: "ELITE", color: "#10B981", glow: "rgba(16,185,129,0.3)", ring: "#34D399" };
  if (score >= 60) return { label: "STRONG", color: "#3B82F6", glow: "rgba(59,130,246,0.25)", ring: "#60A5FA" };
  if (score >= 40) return { label: "BUILDING", color: "#8B5CF6", glow: "rgba(139,92,246,0.2)", ring: "#A78BFA" };
  return { label: "STARTING", color: "#F97316", glow: "rgba(249,115,22,0.2)", ring: "#FB923C" };
}

/* ── Weighted score calculation ── */
function calculatePerformanceScore(
  caloriesIn: number,
  caloriesOut: number,
  steps: number,
  sleepHours: number,
  caloriesTarget: number,
  stepsTarget: number,
  sleepTarget: number,
): number {
  // Calories balance (30%): how close net is to target (e.g. 2000 cal target)
  const netCalories = caloriesIn - caloriesOut;
  const calRatio = caloriesTarget > 0 ? netCalories / caloriesTarget : 0;
  // Optimal range: 0.8 - 1.1 of target = 100%. Penalize over/under.
  let calScore: number;
  if (calRatio >= 0.8 && calRatio <= 1.1) {
    calScore = 100;
  } else if (calRatio < 0.8) {
    calScore = Math.max(0, (calRatio / 0.8) * 100);
  } else {
    // Over target: penalize gently
    calScore = Math.max(0, 100 - (calRatio - 1.1) * 150);
  }

  // Steps (30%): linear up to target, cap at 120% for bonus
  const stepRatio = stepsTarget > 0 ? steps / stepsTarget : 0;
  const stepScore = Math.min(100, stepRatio * 100);

  // Sleep (40%): optimal 7-9h = 100%, penalize outside
  let sleepScore: number;
  if (sleepHours >= 7 && sleepHours <= 9) {
    sleepScore = 100;
  } else if (sleepHours < 7) {
    sleepScore = Math.max(0, (sleepHours / 7) * 100);
  } else {
    sleepScore = Math.max(0, 100 - (sleepHours - 9) * 20);
  }

  const weighted = calScore * 0.3 + stepScore * 0.3 + sleepScore * 0.4;
  return Math.max(1, Math.min(100, Math.round(weighted)));
}

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 1600, delay = 300): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now() + delay;
    function tick(now: number) {
      if (now < startTime) { rafRef.current = requestAnimationFrame(tick); return; }
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, delay, duration]);

  return value;
}

/* ── Breakdown metric pill ── */
function MetricPill({
  label,
  value,
  unit,
  score,
  icon,
  color,
  ghostMode,
}: {
  label: string;
  value: string;
  unit: string;
  score: number;
  icon: string;
  color: string;
  ghostMode: boolean;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const pillBg = ghostMode ? "rgba(200,200,200,0.04)" : "rgba(255,255,255,0.95)";
  const pillBorder = ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,0,0,0.06)";
  const labelCol = ghostMode ? "rgba(160,160,160,0.5)" : "rgba(100,100,120,0.7)";
  const valueCol = ghostMode ? "rgba(200,200,200,0.7)" : "#1a1a2e";
  const trackBg = ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,0,0,0.04)";
  const barColor = ghostMode ? "rgba(160,160,160,0.3)" : color;

  return (
    <div
      className="flex flex-col gap-1.5 flex-1 min-w-0 rounded-xl px-3 py-2.5"
      style={{
        background: pillBg,
        border: `1px solid ${pillBorder}`,
        boxShadow: ghostMode ? "none" : "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span
          className="font-medium uppercase tracking-wider"
          style={{ fontSize: "9px", color: labelCol, fontFamily: "Inter, system-ui, sans-serif" }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: "18px", color: valueCol, fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        <span style={{ fontSize: "10px", color: labelCol }}>{unit}</span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: trackBg }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          style={{ background: barColor }}
        />
      </div>
    </div>
  );
}

/* ── Main gauge SVG ── */
function PerformanceRing({
  score,
  size = 220,
  ghostMode,
}: {
  score: number;
  size?: number;
  ghostMode: boolean;
}) {
  const displayScore = useCountUp(score, 1600, 200);
  const tier = getTier(displayScore);
  const finalTier = getTier(score);

  const center = size / 2;
  const strokeWidth = 8;
  const pad = 24;
  const r = (size - pad * 2) / 2;
  const circumference = 2 * Math.PI * r;

  const arcSpan = 270;
  const startAngle = 135;
  const arcLength = circumference * (arcSpan / 360);
  const gapLength = circumference - arcLength;

  const pct = Math.min(displayScore / 100, 1);
  const filledLength = arcLength * pct;
  const unfilledLength = arcLength - filledLength + gapLength;
  const rotationOffset = -circumference * (startAngle / 360);

  // Endpoint dot
  const endAngle = startAngle + pct * arcSpan;
  const endRad = (endAngle * Math.PI) / 180;
  const dotX = center + r * Math.cos(endRad);
  const dotY = center + r * Math.sin(endRad);

  // Tick marks
  const ticks = useMemo(() => {
    const count = 50;
    return Array.from({ length: count + 1 }, (_, i) => {
      const angle = startAngle + (i / count) * arcSpan;
      const rad = (angle * Math.PI) / 180;
      const isMajor = i % 10 === 0;
      const tickLen = isMajor ? 10 : 5;
      const outerR = r + 14;
      const innerR = outerR - tickLen;
      return {
        x1: center + innerR * Math.cos(rad),
        y1: center + innerR * Math.sin(rad),
        x2: center + outerR * Math.cos(rad),
        y2: center + outerR * Math.sin(rad),
        isMajor,
        isLit: (i / count) <= pct,
        index: i,
      };
    });
  }, [center, r, pct]);

  const arcColor = ghostMode ? "rgba(160,160,160,0.4)" : finalTier.color;
  const glowColor = ghostMode ? "transparent" : finalTier.glow;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ambient glow */}
      {!ghostMode && (
        <div
          className="absolute rounded-full"
          style={{
            inset: "15%",
            background: `radial-gradient(circle, ${finalTier.glow} 0%, transparent 70%)`,
            filter: "blur(25px)",
            opacity: 0.6,
          }}
        />
      )}

      <svg width={size} height={size} className="relative z-10" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="perfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ghostMode ? "rgba(160,160,160,0.3)" : finalTier.ring} />
            <stop offset="100%" stopColor={ghostMode ? "rgba(160,160,160,0.5)" : finalTier.color} />
          </linearGradient>
          <filter id="perfGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* Tick marks */}
        {ticks.map((t) => (
          <line
            key={t.index}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isLit
              ? (ghostMode ? "rgba(160,160,160,0.2)" : finalTier.color)
              : (ghostMode ? "rgba(160,160,160,0.05)" : "rgba(0,0,0,0.06)")
            }
            strokeWidth={t.isMajor ? 1.5 : 0.75}
            strokeLinecap="round"
            opacity={t.isLit ? (t.isMajor ? 0.7 : 0.4) : 1}
          />
        ))}

        {/* Background track */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke={ghostMode ? "rgba(160,160,160,0.05)" : "rgba(0,0,0,0.04)"}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={rotationOffset}
          strokeLinecap="round"
        />

        {/* Glow layer */}
        {!ghostMode && (
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke={finalTier.color}
            strokeWidth={strokeWidth + 10}
            strokeDasharray={`${filledLength} ${unfilledLength}`}
            strokeDashoffset={rotationOffset}
            strokeLinecap="round"
            opacity={0.12}
            filter="url(#perfGlow)"
            style={{ transition: "stroke-dasharray 1.6s cubic-bezier(0.4,0,0.2,1)" }}
          />
        )}

        {/* Filled arc */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke="url(#perfGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledLength} ${unfilledLength}`}
          strokeDashoffset={rotationOffset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1.6s cubic-bezier(0.4,0,0.2,1)",
            filter: ghostMode ? "none" : `drop-shadow(0 0 8px ${glowColor})`,
          }}
        />

        {/* Endpoint dot */}
        {displayScore > 0 && (
          <>
            {!ghostMode && (
              <circle cx={dotX} cy={dotY} r={10} fill={finalTier.color} opacity={0.15}
                style={{ transition: "cx 1.6s cubic-bezier(0.4,0,0.2,1), cy 1.6s cubic-bezier(0.4,0,0.2,1)" }}
              />
            )}
            <circle cx={dotX} cy={dotY} r={4.5} fill={arcColor}
              style={{
                transition: "cx 1.6s cubic-bezier(0.4,0,0.2,1), cy 1.6s cubic-bezier(0.4,0,0.2,1)",
                filter: ghostMode ? "none" : `drop-shadow(0 0 6px ${glowColor})`,
              }}
            />
            <circle cx={dotX} cy={dotY} r={1.8} fill="white" opacity={ghostMode ? 0.2 : 0.85}
              style={{ transition: "cx 1.6s cubic-bezier(0.4,0,0.2,1), cy 1.6s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </>
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ paddingTop: 4 }}>
        <motion.span
          className="tabular-nums font-bold leading-none"
          style={{
            fontSize: size > 200 ? 72 : 56,
            color: arcColor,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.03em",
            textShadow: ghostMode ? "none" : `0 0 30px ${glowColor}`,
          }}
        >
          {displayScore}
        </motion.span>

        <span
          className="uppercase tracking-widest font-medium mt-0.5"
          style={{
            fontSize: "9px",
            color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(100,100,120,0.5)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Performance Score
        </span>

        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.8, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="mt-2 px-3.5 py-1 rounded-full"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.05)" : `${finalTier.color}0D`,
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : `${finalTier.color}25`}`,
          }}
        >
          <span
            className="uppercase tracking-[0.18em] font-semibold"
            style={{
              fontSize: "10px",
              color: ghostMode ? "rgba(160,160,160,0.5)" : finalTier.color,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {finalTier.label}
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Props ── */
export interface ElitePerformanceGaugeProps {
  caloriesIn: number | undefined;
  caloriesOut: number | undefined;
  steps: number | undefined;
  sleepHours: number | undefined;
  caloriesTarget?: number;
  stepsTarget?: number;
  sleepTarget?: number;
  ghostMode?: boolean;
}

/* ── Main component ── */
function ElitePerformanceGaugeInner({
  caloriesIn: rawCaloriesIn,
  caloriesOut: rawCaloriesOut,
  steps: rawSteps,
  sleepHours: rawSleepHours,
  caloriesTarget = 2000,
  stepsTarget = 8000,
  sleepTarget = 8,
  ghostMode = false,
}: ElitePerformanceGaugeProps) {
  // Null-coalesce all numeric props to prevent .toFixed() crashes
  const caloriesIn = rawCaloriesIn ?? 0;
  const caloriesOut = rawCaloriesOut ?? 0;
  const steps = rawSteps ?? 0;
  const sleepHours = rawSleepHours ?? 0;

  const score = calculatePerformanceScore(
    caloriesIn, caloriesOut, steps, sleepHours,
    caloriesTarget, stepsTarget, sleepTarget,
  );

  // Individual sub-scores for pills
  const netCal = caloriesIn - caloriesOut;
  const calRatio = caloriesTarget > 0 ? netCal / caloriesTarget : 0;
  let calScore: number;
  if (calRatio >= 0.8 && calRatio <= 1.1) calScore = 100;
  else if (calRatio < 0.8) calScore = Math.max(0, (calRatio / 0.8) * 100);
  else calScore = Math.max(0, 100 - (calRatio - 1.1) * 150);

  const stepScore = Math.min(100, stepsTarget > 0 ? (steps / stepsTarget) * 100 : 0);

  let sleepScore: number;
  if (sleepHours >= 7 && sleepHours <= 9) sleepScore = 100;
  else if (sleepHours < 7) sleepScore = Math.max(0, (sleepHours / 7) * 100);
  else sleepScore = Math.max(0, 100 - (sleepHours - 9) * 20);

  const netSign = netCal >= 0 ? "+" : "";
  const safeSteps = steps ?? 0;
  const stepsFormatted = safeSteps >= 1000 ? `${(safeSteps / 1000).toFixed(1)}k` : `${safeSteps}`;

  const headerColor = ghostMode ? "rgba(200,200,200,0.8)" : "#1a1a2e";
  const subColor = ghostMode ? "rgba(160,160,160,0.45)" : "rgba(100,100,120,0.55)";
  const containerBg = ghostMode ? "rgba(200,200,200,0.02)" : "rgba(255,255,255,0.6)";
  const containerBorder = ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center gap-5 w-full rounded-2xl px-4 py-5"
      style={{
        background: containerBg,
        border: `1px solid ${containerBorder}`,
        boxShadow: ghostMode ? "none" : "0 2px 12px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: "18px", color: headerColor, fontFamily: "Inter, system-ui, sans-serif" }}
        >
          Elite Performance
        </span>
        <span style={{ fontSize: "11px", color: subColor, fontFamily: "Inter, system-ui, sans-serif" }}>
          Calories {"\u00B7"} Steps {"\u00B7"} Sleep
        </span>
      </div>

      {/* Gauge */}
      <PerformanceRing score={score} size={220} ghostMode={ghostMode} />

      {/* Breakdown pills */}
      <div className="flex gap-2 w-full max-w-sm">
        <MetricPill
          label="Energy"
          value={`${netSign}${netCal}`}
          unit="kcal"
          score={calScore}
          icon={"\u26A1"}
          color="#22C55E"
          ghostMode={ghostMode}
        />
        <MetricPill
          label="Steps"
          value={stepsFormatted}
          unit={`/ ${((stepsTarget ?? 8000) / 1000).toFixed(0)}k`}
          score={stepScore}
          icon={"\uD83D\uDC5F"}
          color="#3B82F6"
          ghostMode={ghostMode}
        />
        <MetricPill
          label="Sleep"
          value={(sleepHours ?? 0).toFixed(1)}
          unit="hrs"
          score={sleepScore}
          icon={"\uD83D\uDE34"}
          color="#8B5CF6"
          ghostMode={ghostMode}
        />
      </div>

      {/* Weight labels */}
      <div className="flex items-center gap-4">
        {[
          { label: "Energy", weight: "30%", color: "#22C55E" },
          { label: "Steps", weight: "30%", color: "#3B82F6" },
          { label: "Sleep", weight: "40%", color: "#8B5CF6" },
        ].map((w) => (
          <div key={w.label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : w.color }}
            />
            <span
              style={{
                fontSize: "9px",
                color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(100,100,120,0.5)",
                fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              {w.label} {w.weight}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Public export ── */
/* ── Skeleton loader for unresolved data ── */
function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-5 w-full rounded-2xl px-4 py-5 animate-pulse"
      style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.04)" }}>
      <div className="h-5 w-36 rounded bg-gray-200/50" />
      <div className="w-[220px] h-[220px] rounded-full bg-gray-200/30" />
      <div className="flex gap-2 w-full max-w-sm">
        <div className="flex-1 h-20 rounded-xl bg-gray-200/30" />
        <div className="flex-1 h-20 rounded-xl bg-gray-200/30" />
        <div className="flex-1 h-20 rounded-xl bg-gray-200/30" />
      </div>
    </div>
  );
}

/* ── Public export with loading guard + error boundary ── */
export function ElitePerformanceGauge(props: ElitePerformanceGaugeProps) {
  // Loading guard: if ALL core metrics are undefined, show skeleton
  if (
    props.caloriesIn === undefined &&
    props.caloriesOut === undefined &&
    props.steps === undefined &&
    props.sleepHours === undefined
  ) {
    return <GaugeSkeleton />;
  }

  return (
    <GaugeErrorBoundary>
      <ElitePerformanceGaugeInner {...props} />
    </GaugeErrorBoundary>
  );
}
