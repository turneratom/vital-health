import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";

export interface Milestone {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: "hrv" | "sleep" | "recovery" | "nutrition" | "activity" | "labs";
  unlocked: boolean;
  unlockedAt?: string;
  progress: number; // 0-100
  requirement: string;
}

const defaultMilestones: Milestone[] = [
  {
    id: "hrv-baseline",
    icon: "\u{1F4C8}",
    title: "HRV Baseline Increased",
    description: "Your 30-day HRV average rose above your personal baseline by 5+ ms.",
    category: "hrv",
    unlocked: true,
    unlockedAt: "2 days ago",
    progress: 100,
    requirement: "HRV avg +5ms over 30 days",
  },
  {
    id: "sleep-streak",
    icon: "\u{1F319}",
    title: "Sleep Architect",
    description: "Hit 7+ hours of sleep for 14 consecutive nights.",
    category: "sleep",
    unlocked: true,
    unlockedAt: "5 days ago",
    progress: 100,
    requirement: "14-night streak of 7+ hrs",
  },
  {
    id: "recovery-elite",
    icon: "\u26A1",
    title: "Recovery Elite",
    description: "Maintained a recovery score above 80 for 21 consecutive days.",
    category: "recovery",
    unlocked: false,
    progress: 76,
    requirement: "21-day streak of 80+ recovery",
  },
  {
    id: "fuel-master",
    icon: "\u{1F525}",
    title: "Fuel Master",
    description: "Achieved 90%+ macro target accuracy for 7 consecutive days.",
    category: "nutrition",
    unlocked: false,
    progress: 57,
    requirement: "7-day streak of 90%+ macro accuracy",
  },
  {
    id: "vitd-optimal",
    icon: "\u2600\uFE0F",
    title: "Vitamin D Optimized",
    description: "Brought Vitamin D levels into the optimal range (40-60 ng/mL).",
    category: "labs",
    unlocked: false,
    progress: 88,
    requirement: "Vitamin D 40-60 ng/mL",
  },
  {
    id: "strain-ceiling",
    icon: "\u{1F3CB}\uFE0F",
    title: "Strain Ceiling Breaker",
    description: "Completed 10 workouts at or above your strain ceiling without overtraining.",
    category: "activity",
    unlocked: false,
    progress: 40,
    requirement: "10 high-strain sessions managed",
  },
  {
    id: "ldl-drop",
    icon: "\u2764\uFE0F\u200D\u{1FA79}",
    title: "LDL Optimizer",
    description: "Reduced LDL cholesterol by 10+ mg/dL from your baseline.",
    category: "labs",
    unlocked: false,
    progress: 62,
    requirement: "LDL drop of 10+ mg/dL",
  },
  {
    id: "rhr-drop",
    icon: "\u2764\uFE0F",
    title: "Cardiac Efficiency",
    description: "Resting heart rate dropped 3+ BPM below your 90-day average.",
    category: "hrv",
    unlocked: true,
    unlockedAt: "1 week ago",
    progress: 100,
    requirement: "RHR -3 BPM from 90-day avg",
  },
];

const categoryColors: Record<string, { color: string; bg: string; border: string }> = {
  hrv: { color: "#30D158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" },
  sleep: { color: "#5E5CE6", bg: "rgba(94,92,230,0.08)", border: "rgba(94,92,230,0.2)" },
  recovery: { color: "#00FFCC", bg: "rgba(0,255,204,0.08)", border: "rgba(0,255,204,0.2)" },
  nutrition: { color: "#FF9500", bg: "rgba(255,149,0,0.08)", border: "rgba(255,149,0,0.2)" },
  activity: { color: "#FFB86B", bg: "rgba(255,184,107,0.08)", border: "rgba(255,184,107,0.2)" },
  labs: { color: "#64D2FF", bg: "rgba(100,210,255,0.08)", border: "rgba(100,210,255,0.2)" },
};

export function MilestoneGallery({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const milestones = defaultMilestones;
  const filtered = filter === "all" ? milestones : filter === "unlocked" ? milestones.filter(m => m.unlocked) : milestones.filter(m => !m.unlocked);
  const unlockedCount = milestones.filter(m => m.unlocked).length;

  const textPrimary = ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.92)";
  const textSecondary = ghostMode ? "rgba(180,180,180,0.5)" : "rgba(255,255,255,0.5)";
  const textTertiary = ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.3)";
  const cardBg = ghostMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)";
  const cardBorder = ghostMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.06)";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[15px] font-bold" style={{ color: textPrimary }}>
            Milestone Gallery
          </span>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(175,130,255,0.12)",
              color: ghostMode ? "rgba(160,160,160,0.5)" : "#AF82FF",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : "rgba(175,130,255,0.2)"}`,
            }}
          >
            {unlockedCount}/{milestones.length}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "unlocked", "locked"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize transition-all duration-200"
            style={{
              background: filter === f
                ? ghostMode ? "rgba(160,160,160,0.12)" : "rgba(175,130,255,0.15)"
                : ghostMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)",
              color: filter === f
                ? ghostMode ? "rgba(200,200,200,0.7)" : "#AF82FF"
                : textTertiary,
              border: `1px solid ${filter === f
                ? ghostMode ? "rgba(160,160,160,0.2)" : "rgba(175,130,255,0.3)"
                : cardBorder}`,
            }}
          >
            {f === "all" ? `All (${milestones.length})` : f === "unlocked" ? `Unlocked (${unlockedCount})` : `Locked (${milestones.length - unlockedCount})`}
          </button>
        ))}
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((m, idx) => {
            const catStyle = categoryColors[m.category] || categoryColors.hrv;
            const isSelected = selectedId === m.id;

            return (
              <motion.button
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                onClick={() => setSelectedId(isSelected ? null : m.id)}
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-center overflow-hidden"
                style={{
                  background: cardBg,
                  borderColor: isSelected
                    ? ghostMode ? "rgba(160,160,160,0.2)" : "rgba(175,130,255,0.35)"
                    : cardBorder,
                  opacity: m.unlocked ? 1 : 0.65,
                }}
              >
                {/* Unlocked glow */}
                {m.unlocked && !ghostMode && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 30%, rgba(175,130,255,0.06) 0%, transparent 70%)`,
                    }}
                  />
                )}

                {/* Badge icon */}
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{
                      background: m.unlocked
                        ? ghostMode ? "rgba(160,160,160,0.1)" : catStyle.bg
                        : "rgba(255,255,255,0.03)",
                      border: `1px solid ${m.unlocked
                        ? ghostMode ? "rgba(160,160,160,0.15)" : catStyle.border
                        : "rgba(255,255,255,0.06)"}`,
                      filter: m.unlocked ? "none" : "grayscale(1) opacity(0.4)",
                      boxShadow: m.unlocked && !ghostMode ? `0 0 16px ${catStyle.bg}` : "none",
                    }}
                  >
                    {m.icon}
                  </div>
                  {m.unlocked && (
                    <div
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                      style={{
                        background: ghostMode ? "rgba(160,160,160,0.3)" : "linear-gradient(135deg, #AF82FF, #00FFCC)",
                        boxShadow: ghostMode ? "none" : "0 0 8px rgba(175,130,255,0.4)",
                      }}
                    >
                      \u2713
                    </div>
                  )}
                </div>

                {/* Title */}
                <span
                  className="text-[12px] font-bold leading-tight"
                  style={{ color: m.unlocked ? textPrimary : textSecondary }}
                >
                  {m.title}
                </span>

                {/* Progress bar for locked */}
                {!m.unlocked && (
                  <div className="w-full">
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${m.progress}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.05 }}
                        style={{
                          background: ghostMode
                            ? "rgba(160,160,160,0.3)"
                            : `linear-gradient(90deg, ${catStyle.color}, #AF82FF)`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono mt-1 block" style={{ color: textTertiary }}>
                      {m.progress}%
                    </span>
                  </div>
                )}

                {/* Unlocked date */}
                {m.unlocked && m.unlockedAt && (
                  <span className="text-[10px] font-mono" style={{ color: textTertiary }}>
                    {m.unlockedAt}
                  </span>
                )}

                {/* Expanded detail */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full overflow-hidden"
                    >
                      <div
                        className="mt-2 pt-2 text-left"
                        style={{ borderTop: `0.5px solid ${cardBorder}` }}
                      >
                        <p className="text-[11px] leading-relaxed" style={{ color: textSecondary }}>
                          {m.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded" style={{
                            background: catStyle.bg,
                            color: ghostMode ? "rgba(160,160,160,0.5)" : catStyle.color,
                            border: `0.5px solid ${catStyle.border}`,
                          }}>
                            {m.requirement}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default MilestoneGallery;
