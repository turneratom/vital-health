import { useState, useEffect, useRef, useCallback } from 'react';
// ActivityView module
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

/* ── Activity Ring SVG ── */
function ActivityRing({
  progress,
  size = 220,
  strokeWidth = 14,
  ghostMode,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  ghostMode: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,255,204,0.08)'}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ghostMode ? 'rgba(160,160,160,0.5)' : 'url(#ringGradient)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          style={{
            filter: ghostMode ? 'none' : 'drop-shadow(0 0 8px rgba(0,255,204,0.35))',
          }}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FFCC" />
            <stop offset="100%" stopColor="#00CC99" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-bold tabular-nums tracking-tight"
          style={{
            color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC',
            textShadow: ghostMode ? 'none' : '0 0 20px rgba(0,255,204,0.25)',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {progress}%
        </motion.span>
        <span
          className="text-xs font-medium mt-1 tracking-wide"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(0,255,204,0.5)' }}
        >
          of daily goal
        </span>
      </div>
    </div>
  );
}

/* ── Timer Display (for active session) ── */
function ActiveTimer({
  elapsed,
  ghostMode,
  onStop,
}: {
  elapsed: number;
  ghostMode: boolean;
  onStop: () => void;
}) {
  const totalSec = Math.floor(elapsed / 1000);
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-5"
    >
      {/* Pulsing ring indicator */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-3 h-3 rounded-full"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.5)' : '#00FFCC',
          boxShadow: ghostMode ? 'none' : '0 0 16px rgba(0,255,204,0.5)',
        }}
      />
      <div className="flex items-baseline gap-1">
        <span
          className="text-6xl font-bold tabular-nums tracking-tight"
          style={{
            color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC',
            textShadow: ghostMode ? 'none' : '0 0 24px rgba(0,255,204,0.3)',
          }}
        >
          {mins}:{secs}
        </span>
      </div>
      <p
        className="text-sm font-medium"
        style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(0,255,204,0.45)' }}
      >
        Activity in progress...
      </p>
      <button
        onClick={onStop}
        className="mt-2 px-8 py-3.5 rounded-2xl text-base font-semibold tracking-wide transition-all duration-300"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,90,90,0.12)',
          color: ghostMode ? 'rgba(200,200,200,0.7)' : '#FF5A5A',
          border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(255,90,90,0.25)'}`,
          boxShadow: ghostMode ? 'none' : '0 0 20px rgba(255,90,90,0.1)',
        }}
      >
        End Activity
      </button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Main ActivityView — Simplified
   ═══════════════════════════════════════════════ */
export function ActivityView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';

  // Simulated daily data
  const [steps] = useState(4218);
  const [stepsGoal] = useState(10000);
  const [calories] = useState(312);
  const [caloriesGoal] = useState(600);
  const [activeMinutes] = useState(28);
  const [activeMinutesGoal] = useState(60);

  // Activity session state
  const [isActive, setIsActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const overallProgress = Math.min(
    100,
    Math.round(
      ((steps / stepsGoal) * 0.4 + (calories / caloriesGoal) * 0.3 + (activeMinutes / activeMinutesGoal) * 0.3) * 100
    )
  );

  const tick = useCallback(() => {
    if (startRef.current !== null) {
      setElapsed(Date.now() - startRef.current);
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const handleStart = useCallback(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setIsActive(true);
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const handleStop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    startRef.current = null;
    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Plain-English summaries
  const stepsPercent = Math.round((steps / stepsGoal) * 100);
  const stepsMessage =
    stepsPercent >= 100
      ? "You've crushed your step goal for today! Amazing work."
      : stepsPercent >= 50
        ? `You've walked ${steps.toLocaleString()} steps\u2014${stepsPercent}% of your daily goal. Keep it up!`
        : `You've taken ${steps.toLocaleString()} steps so far. A short walk could get you to halfway!`;

  const calMessage =
    calories >= caloriesGoal
      ? `You've burned ${calories} active calories\u2014goal reached!`
      : `${calories} of ${caloriesGoal} active calories burned. You're ${Math.round((calories / caloriesGoal) * 100)}% there.`;

  const minutesMessage =
    activeMinutes >= activeMinutesGoal
      ? `${activeMinutes} active minutes today\u2014you've hit your target!`
      : `${activeMinutes} of ${activeMinutesGoal} active minutes logged. ${activeMinutesGoal - activeMinutes} more to go.`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-lg mx-auto flex flex-col items-center gap-10 pb-12 pt-4 px-4"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center"
      >
        <h2
          className="text-3xl font-bold tracking-tight"
          style={{
            color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.9)',
          }}
        >
          Activity
        </h2>
        <p
          className="text-sm mt-1.5"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}
        >
          Your progress for today
        </p>
      </motion.div>

      {/* Activity Ring or Active Timer */}
      <AnimatePresence mode="wait">
        {isActive ? (
          <ActiveTimer
            key="timer"
            elapsed={elapsed}
            ghostMode={ghostMode}
            onStop={handleStop}
          />
        ) : (
          <motion.div
            key="ring"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-8"
          >
            <ActivityRing progress={overallProgress} ghostMode={ghostMode} />

            {/* Start Activity Button */}
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-2xl text-lg font-semibold tracking-wide transition-all duration-300"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.1)'
                  : 'linear-gradient(135deg, rgba(0,255,204,0.15), rgba(0,204,153,0.1))',
                color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC',
                border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.25)'}`,
                boxShadow: ghostMode
                  ? 'none'
                  : '0 0 30px rgba(0,255,204,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              ▶ Start Activity
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simple Summary — Plain English */}
      {!isActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="w-full flex flex-col gap-5"
        >
          <div
            className="h-px w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${neon}0.12), transparent)`,
            }}
          />

          <h3
            className="text-lg font-semibold text-center"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.7)' }}
          >
            Today's Summary
          </h3>

          {/* Steps */}
          <SummaryRow
            icon="👟"
            label="Steps"
            value={steps.toLocaleString()}
            goal={stepsGoal.toLocaleString()}
            progress={Math.min(100, stepsPercent)}
            message={stepsMessage}
            ghostMode={ghostMode}
            neon={neon}
            delay={0.6}
          />

          {/* Active Calories */}
          <SummaryRow
            icon="🔥"
            label="Active Calories"
            value={String(calories)}
            goal={String(caloriesGoal)}
            progress={Math.min(100, Math.round((calories / caloriesGoal) * 100))}
            message={calMessage}
            ghostMode={ghostMode}
            neon={neon}
            delay={0.7}
          />

          {/* Active Minutes */}
          <SummaryRow
            icon="⏱️"
            label="Active Minutes"
            value={String(activeMinutes)}
            goal={String(activeMinutesGoal)}
            progress={Math.min(100, Math.round((activeMinutes / activeMinutesGoal) * 100))}
            message={minutesMessage}
            ghostMode={ghostMode}
            neon={neon}
            delay={0.8}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Summary Row Component ── */
function SummaryRow({
  icon,
  label,
  value,
  goal,
  progress,
  message,
  ghostMode,
  neon,
  delay,
}: {
  icon: string;
  label: string;
  value: string;
  goal: string;
  progress: number;
  message: string;
  ghostMode: boolean;
  neon: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl p-5 transition-all duration-300"
      style={{
        background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}`,
      }}
    >
      {/* Top row: icon + label + value */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span
            className="text-sm font-medium"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.6)' }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.9)' }}
          >
            {value}
          </span>
          <span
            className="text-xs"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}
          >
            / {goal}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full overflow-hidden mb-3"
        style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)' }}
      >
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.35)'
              : progress >= 100
                ? 'linear-gradient(90deg, #00FFCC, #00CC99)'
                : 'linear-gradient(90deg, #00FFCC, #00E6B8)',
            boxShadow: ghostMode ? 'none' : '0 0 10px rgba(0,255,204,0.3)',
          }}
        />
      </div>

      {/* Plain English message */}
      <p
        className="text-sm leading-relaxed"
        style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : 'rgba(255,255,255,0.45)' }}
      >
        {message}
      </p>
    </motion.div>
  );
}

export default ActivityView;
