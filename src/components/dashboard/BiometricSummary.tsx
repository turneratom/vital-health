import { motion } from "framer-motion";

interface BiometricSummaryProps {
  caloriesIn: number;
  caloriesOut: number;
  steps: number;
  sleepHours: number;
  ghostMode: boolean;
}

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  accentColor: string;
  progress: number;
  ghostMode: boolean;
  index: number;
}

function MetricCard({ label, value, unit, icon, accentColor, progress, ghostMode, index }: MetricCardProps) {
  const cardBg = ghostMode ? "rgba(200,200,200,0.05)" : "rgba(255,255,255,0.95)";
  const cardBorder = ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,0,0,0.06)";
  const labelColor = ghostMode ? "rgba(160,160,160,0.5)" : "rgba(100,100,120,0.7)";
  const valueColor = ghostMode ? "rgba(220,220,220,0.9)" : "#1a1a2e";
  const unitColor = ghostMode ? "rgba(160,160,160,0.4)" : "rgba(100,100,120,0.5)";
  const trackColor = ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,0,0,0.04)";
  const accent = ghostMode ? "rgba(160,160,160,0.4)" : accentColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: index * 0.06 }}
      className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4 min-w-0 flex-1"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: ghostMode ? "none" : "0 1px 3px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.02)",
      }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-0.5"
        style={{
          background: ghostMode ? "rgba(160,160,160,0.06)" : `${accentColor}0D`,
        }}
      >
        {icon}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-0.5">
        <span
          className="font-bold tabular-nums"
          style={{
            fontSize: "20px",
            color: valueColor,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          className="font-medium"
          style={{
            fontSize: "10px",
            color: unitColor,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {unit}
        </span>
      </div>

      {/* Label */}
      <span
        className="font-medium text-center"
        style={{
          fontSize: "10.5px",
          color: labelColor,
          fontFamily: "Inter, system-ui, sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>

      {/* Progress bar */}
      <div
        className="w-full h-[3px] rounded-full overflow-hidden mt-0.5"
        style={{ background: trackColor }}
      >
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, progress)}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.3 + index * 0.08 }}
          style={{ background: accent }}
        />
      </div>
    </motion.div>
  );
}

export function BiometricSummary({ caloriesIn, caloriesOut, steps, sleepHours, ghostMode }: BiometricSummaryProps) {
  const headerColor = ghostMode ? "rgba(200,200,200,0.8)" : "#1a1a2e";
  const subColor = ghostMode ? "rgba(160,160,160,0.45)" : "rgba(100,100,120,0.6)";

  const netBalance = caloriesIn - caloriesOut;
  const balanceLabel = netBalance >= 0 ? `+${netBalance}` : `${netBalance}`;
  const balancePillBg = ghostMode
    ? "rgba(160,160,160,0.06)"
    : netBalance > 300
      ? "rgba(239,68,68,0.08)"
      : netBalance < -200
        ? "rgba(59,130,246,0.08)"
        : "rgba(34,197,94,0.08)";
  const balancePillColor = ghostMode
    ? "rgba(160,160,160,0.5)"
    : netBalance > 300
      ? "#EF4444"
      : netBalance < -200
        ? "#3B82F6"
        : "#22C55E";
  const balancePillBorder = ghostMode
    ? "rgba(160,160,160,0.1)"
    : netBalance > 300
      ? "rgba(239,68,68,0.15)"
      : netBalance < -200
        ? "rgba(59,130,246,0.15)"
        : "rgba(34,197,94,0.15)";

  /* Icons */
  const calInIcon = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#22C55E"} strokeWidth="1.5" fill="none" />
      <path d="M12 7v4M10 9h4" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#22C55E"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const calOutIcon = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M12 22c-1.5-2-6-7-6-11a6 6 0 1112 0c0 4-4.5 9-6 11z" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#F97316"} strokeWidth="1.5" fill="none" />
      <path d="M12 8v5M9.5 11.5l2.5 2.5 2.5-2.5" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#F97316"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const stepsIcon = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l3-6 3 6" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#3B82F6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 14l3-6 3 6" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#3B82F6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M12 14l3-6 3 6" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#3B82F6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );

  const sleepIcon = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "#8B5CF6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );

  const calTarget = 2200;
  const burnTarget = 2000;
  const stepTarget = 8000;
  const sleepTarget = 8;

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <span
            className="font-bold tracking-tight"
            style={{
              fontSize: "18px",
              color: headerColor,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Energy Balance
          </span>
          <span
            className="mt-0.5"
            style={{
              fontSize: "12px",
              color: subColor,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Your biometrics at a glance
          </span>
        </div>

        {/* Net balance pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            background: balancePillBg,
            border: `1px solid ${balancePillBorder}`,
          }}
        >
          <span
            className="font-mono font-semibold tabular-nums"
            style={{
              fontSize: "12px",
              color: balancePillColor,
            }}
          >
            {balanceLabel}
          </span>
          <span
            className="font-medium"
            style={{
              fontSize: "10px",
              color: balancePillColor,
              opacity: 0.7,
            }}
          >
            net
          </span>
        </div>
      </div>

      {/* 4-card horizontal grid */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard
          label="Calories In"
          value={caloriesIn.toLocaleString()}
          unit="kcal"
          icon={calInIcon}
          accentColor="#22C55E"
          progress={(caloriesIn / calTarget) * 100}
          ghostMode={ghostMode}
          index={0}
        />
        <MetricCard
          label="Calories Out"
          value={caloriesOut.toLocaleString()}
          unit="kcal"
          icon={calOutIcon}
          accentColor="#F97316"
          progress={(caloriesOut / burnTarget) * 100}
          ghostMode={ghostMode}
          index={1}
        />
        <MetricCard
          label="Steps"
          value={steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps.toString()}
          unit="steps"
          icon={stepsIcon}
          accentColor="#3B82F6"
          progress={(steps / stepTarget) * 100}
          ghostMode={ghostMode}
          index={2}
        />
        <MetricCard
          label="Sleep"
          value={sleepHours.toFixed(1)}
          unit="hrs"
          icon={sleepIcon}
          accentColor="#8B5CF6"
          progress={(sleepHours / sleepTarget) * 100}
          ghostMode={ghostMode}
          index={3}
        />
      </div>
    </div>
  );
}
