import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";

/* ── Score-based action logic ── */
function getAction(score: number, hasData: boolean): {
  headline: string;
  detail: string;
  buttonLabel: string;
  buttonAction: "breather" | "workout";
  noData: boolean;
} {
  // No data yet — welcoming clean-start state
  if (!hasData) {
    return {
      headline: "You\u2019re off to a clean start today!",
      detail: "Log your first meal or activity and watch your day take shape.",
      buttonLabel: "Let\u2019s Get Started",
      buttonAction: "workout",
      noData: true,
    };
  }
  if (score >= 70) {
    return {
      headline: "Ready to move a bit?",
      detail: "Your body\u2019s feeling good. A quick session could make today even better.",
      buttonLabel: "Feel Like a Workout?",
      buttonAction: "workout",
      noData: false,
    };
  }
  if (score >= 40) {
    return {
      headline: "Feel like a quick walk?",
      detail: "Even a short stroll can lift your mood and energy.",
      buttonLabel: "Take a Gentle Walk",
      buttonAction: "breather",
      noData: false,
    };
  }
  return {
    headline: "How about a 5-minute breather?",
    detail: "A little rest goes a long way. You\u2019ve earned a moment to recharge.",
    buttonLabel: "Take a Breather",
    buttonAction: "breather",
    noData: false,
  };
}

/* ── Daily Win logic ── */
function getDailyWin(
  currentScore: number,
  yesterdayScore: number
): { message: string; type: "improved" | "consistent" } | null {
  if (currentScore > yesterdayScore) {
    return {
      message: "You\u2019re doing better than yesterday!",
      type: "improved",
    };
  }
  if (currentScore === yesterdayScore || Math.abs(currentScore - yesterdayScore) < 1) {
    return {
      message: "You\u2019re staying consistent\u2014well done!",
      type: "consistent",
    };
  }
  return null;
}

/* ── Looking Ahead logic ── */
function getLookingAhead(
  currentScore: number,
  yesterdayScore: number | undefined,
  trend: "up" | "down" | "flat"
): { message: string; icon: string; type: "positive" | "nudge" } {
  // Primary: use explicit trend prop
  if (trend === "up") {
    return {
      message: "You\u2019re setting yourself up for a great morning tomorrow!",
      icon: "\u2728",
      type: "positive",
    };
  }
  if (trend === "down") {
    return {
      message: "Try to get to bed 30 minutes early to bounce back tomorrow.",
      icon: "\uD83C\uDF19",
      type: "nudge",
    };
  }
  // Flat trend — use score vs yesterday as fallback
  if (yesterdayScore !== undefined) {
    if (currentScore > yesterdayScore) {
      return {
        message: "You\u2019re setting yourself up for a great morning tomorrow!",
        icon: "\u2728",
        type: "positive",
      };
    }
    if (currentScore < yesterdayScore) {
      return {
        message: "Try to get to bed 30 minutes early to bounce back tomorrow.",
        icon: "\uD83C\uDF19",
        type: "nudge",
      };
    }
  }
  // Absolute score fallback
  if (currentScore >= 60) {
    return {
      message: "You\u2019re setting yourself up for a great morning tomorrow!",
      icon: "\u2728",
      type: "positive",
    };
  }
  return {
    message: "Try to get to bed 30 minutes early to bounce back tomorrow.",
    icon: "\uD83C\uDF19",
    type: "nudge",
  };
}

/* ── Color by action type ── */
function getColors(action: "breather" | "workout", ghostMode: boolean, noData: boolean) {
  if (ghostMode) {
    return {
      bg: "rgba(30,30,30,0.7)",
      border: "rgba(160,160,160,0.1)",
      headline: "rgba(220,220,220,0.85)",
      detail: "rgba(160,160,160,0.5)",
      btnBg: "rgba(200,200,200,0.9)",
      btnText: "#111111",
      btnHover: "rgba(255,255,255,1)",
      label: "rgba(160,160,160,0.4)",
    };
  }
  // No data — soft blue/neutral palette, never red
  if (noData) {
    return {
      bg: "rgba(10,10,10,0.7)",
      border: "rgba(100,160,255,0.2)",
      headline: "rgba(255,255,255,0.95)",
      detail: "rgba(255,255,255,0.5)",
      btnBg: "#5AC8FA",
      btnText: "#000000",
      btnHover: "#7DD6FB",
      label: "rgba(90,200,250,0.7)",
    };
  }
  if (action === "workout") {
    return {
      bg: "rgba(10,10,10,0.7)",
      border: "rgba(48,209,88,0.2)",
      headline: "rgba(255,255,255,0.95)",
      detail: "rgba(255,255,255,0.5)",
      btnBg: "#30D158",
      btnText: "#000000",
      btnHover: "#3BE065",
      label: "rgba(48,209,88,0.7)",
    };
  }
  // Breather — soft amber, no red
  return {
    bg: "rgba(10,10,10,0.7)",
    border: "rgba(255,214,10,0.2)",
    headline: "rgba(255,255,255,0.95)",
    detail: "rgba(255,255,255,0.5)",
    btnBg: "#FFD60A",
    btnText: "#000000",
    btnHover: "#FFE034",
    label: "rgba(255,214,10,0.7)",
  };
}

/* ── Main ActionHero Component ── */
export function ActionHero({
  vitalityScore = 50,
  yesterdayScore,
  trend = "flat",
  hasData = true,
  onAction,
}: {
  vitalityScore?: number;
  yesterdayScore?: number;
  trend?: "up" | "down" | "flat";
  hasData?: boolean;
  onAction?: (action: "breather" | "workout") => void;
}) {
  const ghostMode = useGhostMode();
  const [pressed, setPressed] = useState(false);

  const action = getAction(vitalityScore, hasData);
  const colors = getColors(action.buttonAction, ghostMode, action.noData);

  const prevScore = yesterdayScore ?? Math.max(0, vitalityScore - Math.floor(Math.random() * 4));
  const dailyWin = getDailyWin(vitalityScore, prevScore);
  const lookingAhead = getLookingAhead(vitalityScore, yesterdayScore, trend);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        background: colors.bg,
        borderColor: colors.border,
      }}
    >
      <div className="relative z-10 px-6 py-8 flex flex-col items-center text-center">
        {/* Label */}
        <span
          className="font-semibold tracking-[0.15em] uppercase mb-6"
          style={{
            fontSize: "11px",
            color: colors.label,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {action.noData ? "Welcome Back" : "Your Goal for Today"}
        </span>

        {/* Headline */}
        <h2
          className="font-bold leading-tight mb-3"
          style={{
            fontSize: "26px",
            color: colors.headline,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.02em",
            maxWidth: "320px",
          }}
        >
          {action.headline}
        </h2>

        {/* Detail */}
        <p
          className="leading-relaxed mb-6"
          style={{
            fontSize: "14px",
            color: colors.detail,
            fontFamily: "Inter, system-ui, sans-serif",
            maxWidth: "300px",
          }}
        >
          {action.detail}
        </p>

        {/* ── Daily Win Section ── */}
        <AnimatePresence>
          {dailyWin && !ghostMode && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-[320px] mb-6 rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                background: dailyWin.type === "improved"
                  ? "rgba(48, 209, 88, 0.1)"
                  : "rgba(48, 209, 88, 0.06)",
                border: dailyWin.type === "improved"
                  ? "1px solid rgba(48, 209, 88, 0.25)"
                  : "1px solid rgba(48, 209, 88, 0.15)",
              }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-full"
                style={{
                  width: "32px",
                  height: "32px",
                  background: dailyWin.type === "improved"
                    ? "rgba(48, 209, 88, 0.18)"
                    : "rgba(48, 209, 88, 0.1)",
                  fontSize: "16px",
                }}
              >
                {dailyWin.type === "improved" ? "\uD83C\uDF89" : "\uD83D\uDCAA"}
              </span>
              <span
                className="font-semibold leading-snug text-left"
                style={{
                  fontSize: "14px",
                  color: "#30D158",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {dailyWin.message}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Large CTA Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onClick={() => onAction?.(action.buttonAction)}
          className="w-full max-w-[300px] py-4 rounded-xl font-bold text-base tracking-wide transition-colors duration-200"
          style={{
            background: pressed ? colors.btnHover : colors.btnBg,
            color: colors.btnText,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "16px",
            border: "none",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {action.buttonLabel}
        </motion.button>

        {/* ── Looking Ahead Footer ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          className="w-full max-w-[320px] mt-7 pt-5 flex items-start gap-3"
          style={{
            borderTop: ghostMode
              ? "1px solid rgba(160,160,160,0.08)"
              : lookingAhead.type === "positive"
                ? "1px solid rgba(48, 209, 88, 0.15)"
                : "1px solid rgba(255, 214, 10, 0.15)",
          }}
        >
          {/* Icon */}
          <span
            className="flex-shrink-0 flex items-center justify-center rounded-full mt-0.5"
            style={{
              width: "28px",
              height: "28px",
              background: ghostMode
                ? "rgba(160,160,160,0.08)"
                : lookingAhead.type === "positive"
                  ? "rgba(48, 209, 88, 0.1)"
                  : "rgba(255, 214, 10, 0.1)",
              fontSize: "14px",
            }}
          >
            {lookingAhead.icon}
          </span>

          {/* Text */}
          <div className="flex flex-col gap-1">
            <span
              className="font-semibold tracking-[0.1em] uppercase"
              style={{
                fontSize: "9px",
                color: ghostMode
                  ? "rgba(160,160,160,0.35)"
                  : "rgba(255,255,255,0.3)",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Looking Ahead
            </span>
            <span
              className="leading-snug text-left"
              style={{
                fontSize: "14px",
                color: ghostMode
                  ? "rgba(160,160,160,0.6)"
                  : lookingAhead.type === "positive"
                    ? "rgba(48, 209, 88, 0.85)"
                    : "rgba(255, 214, 10, 0.85)",
                fontFamily: "Inter, system-ui, sans-serif",
                fontWeight: 500,
              }}
            >
              {lookingAhead.message}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default ActionHero;
