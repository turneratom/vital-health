import { motion } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";

/* ── Metric analysis ── */
interface MetricSnapshot {
  foodCalories: number;
  foodProtein: number;
  foodLogCount: number;
  activityCalories: number;
  activityLogCount: number;
  steps: number;
}

type MetricArea = "sleep" | "activity" | "nutrition";

interface SummaryResult {
  emoji: string;
  headline: string;
  message: string;
  area: MetricArea;
  status: "great" | "good" | "to-do";
}

/**
 * Analyze metrics and return a single friendly sentence.
 * No decimals, no percentages — just plain human language.
 */
function analyzeSummary(metrics: MetricSnapshot): SummaryResult {
  const {
    foodCalories,
    foodProtein,
    foodLogCount,
    activityCalories,
    activityLogCount,
    steps,
  } = metrics;

  const nutritionScore =
    Math.min(40, foodLogCount * 13) +
    Math.min(30, Math.floor((foodCalories / 2000) * 30)) +
    Math.min(30, Math.floor((foodProtein / 120) * 30));

  const activityScore =
    (activityLogCount > 0 ? 40 : 0) +
    Math.min(30, Math.floor((activityCalories / 400) * 30)) +
    Math.min(30, Math.floor((steps / 8000) * 30));

  const sleepScore =
    nutritionScore > 50 && activityScore > 30
      ? 75
      : nutritionScore > 30
        ? 50
        : 25;

  const scores: { area: MetricArea; score: number }[] = [
    { area: "sleep", score: sleepScore },
    { area: "activity", score: activityScore },
    { area: "nutrition", score: nutritionScore },
  ];

  scores.sort((a, b) => a.score - b.score);
  const lowest = scores[0];
  const highest = scores[2];

  if (highest.area === "activity" && highest.score >= 60) {
    return {
      emoji: "🌟",
      headline: "Great",
      message: "You\u2019ve been active and eating well. Keep it up!",
      area: "activity",
      status: "great",
    };
  }

  if (lowest.area === "sleep" && lowest.score < 50) {
    return {
      emoji: "😴",
      headline: "Rest Up",
      message: "You seem tired today. A short nap or early bedtime would help.",
      area: "sleep",
      status: "to-do",
    };
  }

  if (lowest.area === "nutrition" && lowest.score < 40) {
    if (foodLogCount === 0) {
      return {
        emoji: "🍽️",
        headline: "Time to Eat",
        message: "You haven\u2019t eaten yet. A good meal will give you energy.",
        area: "nutrition",
        status: "to-do",
      };
    }
    return {
      emoji: "🥗",
      headline: "Eat a Bit More",
      message: "You\u2019ve eaten lightly. Adding some protein will help you feel stronger.",
      area: "nutrition",
      status: "to-do",
    };
  }

  if (lowest.area === "activity" && lowest.score < 40) {
    if (activityLogCount === 0 && steps < 2000) {
      return {
        emoji: "👟",
        headline: "Get Moving",
        message: "You\u2019ve been still today. Even a short walk makes a difference.",
        area: "activity",
        status: "to-do",
      };
    }
    return {
      emoji: "💪",
      headline: "Good Start",
      message: "You\u2019ve moved a bit. A little more and you\u2019ll hit your goal!",
      area: "activity",
      status: "good",
    };
  }

  if (nutritionScore >= 50 && activityScore >= 50) {
    return {
      emoji: "✨",
      headline: "Great",
      message: "You\u2019re having a solid day. Everything looks good!",
      area: "activity",
      status: "great",
    };
  }

  return {
    emoji: "👍",
    headline: "Good",
    message: "Things are looking okay. One more good choice and you\u2019ll be ahead.",
    area: "nutrition",
    status: "good",
  };
}

/* ── Status colors — warm, natural tones ── */
function getStatusStyle(status: "great" | "good" | "to-do", ghostMode: boolean) {
  if (ghostMode) {
    return {
      bg: "rgba(160,160,160,0.04)",
      border: "rgba(160,160,160,0.08)",
      accent: "#999",
      headlineColor: "rgba(220,220,220,0.8)",
      text: "rgba(200,200,200,0.7)",
      label: "rgba(160,160,160,0.4)",
      dot: "rgba(160,160,160,0.4)",
    };
  }
  switch (status) {
    case "great":
      return {
        bg: "rgba(124, 182, 142, 0.06)",
        border: "rgba(124, 182, 142, 0.15)",
        accent: "#7CB68E",
        headlineColor: "#7CB68E",
        text: "rgba(232, 224, 216, 0.9)",
        label: "rgba(124, 182, 142, 0.6)",
        dot: "#7CB68E",
      };
    case "good":
      return {
        bg: "rgba(196, 164, 108, 0.06)",
        border: "rgba(196, 164, 108, 0.15)",
        accent: "#C4A46C",
        headlineColor: "#C4A46C",
        text: "rgba(232, 224, 216, 0.9)",
        label: "rgba(196, 164, 108, 0.6)",
        dot: "#C4A46C",
      };
    case "to-do":
      return {
        bg: "rgba(232, 151, 108, 0.06)",
        border: "rgba(232, 151, 108, 0.15)",
        accent: "#E8976C",
        headlineColor: "#E8976C",
        text: "rgba(232, 224, 216, 0.9)",
        label: "rgba(232, 151, 108, 0.6)",
        dot: "#E8976C",
      };
  }
}

/* ── Simple Summary Card — "How am I doing today?" ── */
export function SimpleSummary({
  foodCalories,
  foodProtein,
  foodLogCount,
  activityCalories,
  activityLogCount,
  steps,
}: MetricSnapshot) {
  const ghostMode = useGhostMode();

  const summary = analyzeSummary({
    foodCalories,
    foodProtein,
    foodLogCount,
    activityCalories,
    activityLogCount,
    steps,
  });

  const style = getStatusStyle(summary.status, ghostMode);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        background: style.bg,
        borderColor: style.border,
      }}
    >
      <div className="relative z-10 px-6 py-7">
        {/* Emoji + Headline — the "one word" answer */}
        <div className="flex items-center gap-4 mb-4">
          <span style={{ fontSize: "48px", lineHeight: 1 }}>{summary.emoji}</span>
          <div>
            <h2
              className="font-bold"
              style={{
                fontSize: "32px",
                color: style.headlineColor,
                fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {summary.headline}
            </h2>
            <span
              className="font-medium"
              style={{
                fontSize: "13px",
                color: style.label,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              How you're doing today
            </span>
          </div>
        </div>

        {/* Friendly message — large, readable */}
        <p
          className="font-medium leading-relaxed"
          style={{
            fontSize: "18px",
            color: style.text,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.005em",
            lineHeight: "1.6",
          }}
        >
          {summary.message}
        </p>
      </div>
    </motion.div>
  );
}

export default SimpleSummary;
