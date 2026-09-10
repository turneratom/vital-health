import { motion } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";

/* ── Vitality score estimation (mirrors EliteScoreGauge logic) ── */
function estimateVitalityScore(foodLogCount: number, activityLogCount: number): number {
  let score = 35;
  score += Math.min(foodLogCount, 4) * 8;
  score += Math.min(activityLogCount, 3) * 10;
  if (foodLogCount >= 3 && activityLogCount >= 1) score += 5;
  return Math.min(score, 100);
}

interface PriorityActionCardProps {
  foodLogCount: number;
  activityLogCount: number;
  onNavigate?: (viewId: string) => void;
}

export function PriorityActionCard({ foodLogCount, activityLogCount, onNavigate }: PriorityActionCardProps) {
  const ghostMode = useGhostMode();
  const score = estimateVitalityScore(foodLogCount, activityLogCount);

  const isLow = score < 70;
  const isHigh = score > 80;

  const config = isLow
    ? {
        icon: "💧",
        title: "Priority: Rest & Hydrate",
        subtitle: "Your vitality score is below optimal. Focus on recovery today.",
        detail: `Score: ${score} — hydration, sleep, and light movement will bring you back up.`,
        buttonLabel: "Open My Health",
        buttonAction: "vitals",
        accentColor: "#6B8AFF",
        accentGlow: "rgba(107,138,255,0.25)",
        accentBg: "rgba(107,138,255,0.06)",
        accentBorder: "rgba(107,138,255,0.2)",
        pulseColor: "rgba(107,138,255,0.15)",
      }
    : isHigh
      ? {
          icon: "⚡",
          title: "Priority: High Performance",
          subtitle: "You're in peak form. Push your limits today.",
          detail: `Score: ${score} — your body is primed for intensity. Make it count.`,
          buttonLabel: "Open Activity",
          buttonAction: "activity",
          accentColor: "#00FFCC",
          accentGlow: "rgba(0,255,204,0.3)",
          accentBg: "rgba(0,255,204,0.06)",
          accentBorder: "rgba(0,255,204,0.2)",
          pulseColor: "rgba(0,255,204,0.15)",
        }
      : {
          icon: "🎯",
          title: "Priority: Stay Consistent",
          subtitle: "You're on track. Keep logging to build momentum.",
          detail: `Score: ${score} — a few more logs today will push you into the elite zone.`,
          buttonLabel: "Log a Meal",
          buttonAction: "journal",
          accentColor: "#FFB86B",
          accentGlow: "rgba(255,184,107,0.25)",
          accentBg: "rgba(255,184,107,0.06)",
          accentBorder: "rgba(255,184,107,0.2)",
          pulseColor: "rgba(255,184,107,0.15)",
        };

  const gm = ghostMode;
  const accent = gm ? "rgba(160,160,160,0.5)" : config.accentColor;
  const glow = gm ? "rgba(160,160,160,0.08)" : config.accentGlow;
  const bg = gm ? "rgba(160,160,160,0.02)" : config.accentBg;
  const border = gm ? "rgba(160,160,160,0.08)" : config.accentBorder;
  const pulse = gm ? "rgba(160,160,160,0.06)" : config.pulseColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background: `linear-gradient(135deg, ${bg}, rgba(10,10,10,0.7))`,
        borderColor: border,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: `0 0 32px ${glow}, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      {/* Animated pulse ring */}
      {!gm && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: `1.5px solid ${pulse}` }}
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${accent}60 30%, ${accent} 50%, ${accent}60 70%, transparent 95%)`,
        }}
      />

      <div className="relative z-10 p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Icon container */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: bg,
              border: `1px solid ${border}`,
              boxShadow: `0 0 16px ${glow}`,
            }}
          >
            <span className="text-2xl">{config.icon}</span>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[8px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                style={{
                  color: accent,
                  background: bg,
                  border: `0.5px solid ${border}`,
                }}
              >
                Priority
              </span>
              <span
                className="text-[8px] font-mono tabular-nums"
                style={{ color: gm ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)" }}
              >
                Score {score}
              </span>
            </div>

            <h3
              className="text-[15px] font-semibold tracking-tight leading-tight"
              style={{ color: gm ? "rgba(200,200,200,0.8)" : "rgba(255,255,255,0.92)" }}
            >
              {config.title}
            </h3>

            <p
              className="text-[11px] font-light leading-relaxed mt-1.5"
              style={{ color: gm ? "rgba(160,160,160,0.45)" : "rgba(255,255,255,0.45)" }}
            >
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* Detail line */}
        <p
          className="text-[10px] font-mono mt-3 leading-relaxed"
          style={{ color: gm ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.3)" }}
        >
          {config.detail}
        </p>

        {/* CTA Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate?.(config.buttonAction)}
          className="mt-4 w-full py-3 rounded-xl text-[12px] font-semibold tracking-[0.06em] uppercase transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
            border: `1px solid ${accent}35`,
            color: accent,
            boxShadow: `0 0 12px ${glow}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${accent}28, ${accent}15)`;
            e.currentTarget.style.boxShadow = `0 0 24px ${glow}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${accent}18, ${accent}08)`;
            e.currentTarget.style.boxShadow = `0 0 12px ${glow}`;
          }}
        >
          {config.buttonLabel} →
        </motion.button>
      </div>
    </motion.div>
  );
}

export default PriorityActionCard;
