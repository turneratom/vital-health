import { useState, useEffect, useCallback, useRef } from "react";

const STATUS_MESSAGES = [
  "CALIBRATING BIOMETRICS...",
  "SYNCING BIO-VAULT...",
  "SYSTEM READY",
];

const MESSAGE_DURATION = 1200;
const DRAW_DURATION = 1500;
const FADE_OUT_DURATION = 600;

export default function SystemBootSequence({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [drawProgress, setDrawProgress] = useState(0);
  const [phase, setPhase] = useState<"drawing" | "messages" | "ready" | "exit">("drawing");
  const completedRef = useRef(false);

  // SVG draw-in animation
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DRAW_DURATION, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDrawProgress(eased);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setPhase("messages");
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Cycle through status messages
  useEffect(() => {
    if (phase !== "messages") return;
    if (messageIndex >= STATUS_MESSAGES.length - 1) {
      // Last message ("SYSTEM READY") — hold briefly then exit
      const t = setTimeout(() => setPhase("ready"), 800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setMessageIndex((i) => i + 1);
    }, MESSAGE_DURATION);
    return () => clearTimeout(t);
  }, [phase, messageIndex]);

  // Ready → exit transition
  useEffect(() => {
    if (phase !== "ready") return;
    setPhase("exit");
    const t = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, FADE_OUT_DURATION);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  // V-shaped wireframe paths with pulse line
  // Total path length for stroke-dasharray animation
  const vLeftLength = 180;
  const vRightLength = 180;
  const pulseLength = 320;

  const isExiting = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center"
      style={{
        backgroundColor: "#050505",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "scale(0.92)" : "scale(1)",
        transition: `opacity ${FADE_OUT_DURATION}ms ease, transform ${FADE_OUT_DURATION}ms ease`,
      }}
    >
      {/* Wireframe SVG Icon — minimalist V with pulse line */}
      <div className="relative mb-8">
        <svg
          width="120"
          height="100"
          viewBox="0 0 120 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: "drop-shadow(0 0 12px #00F0FF) drop-shadow(0 0 30px rgba(0,240,255,0.3))" }}
        >
          {/* V left stroke */}
          <path
            d="M 15 10 L 60 80"
            stroke="#00F0FF"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              strokeDasharray: vLeftLength,
              strokeDashoffset: vLeftLength * (1 - drawProgress),
              transition: "none",
            }}
          />
          {/* V right stroke */}
          <path
            d="M 105 10 L 60 80"
            stroke="#00F0FF"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              strokeDasharray: vRightLength,
              strokeDashoffset: vRightLength * (1 - Math.max(0, (drawProgress - 0.15) / 0.85)),
              transition: "none",
            }}
          />
          {/* Horizontal pulse line across the V */}
          <path
            d="M 0 45 Q 30 35, 60 45 Q 90 55, 120 45"
            stroke="rgba(0,240,255,0.4)"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            style={{
              strokeDasharray: pulseLength,
              strokeDashoffset: pulseLength * (1 - Math.max(0, (drawProgress - 0.4) / 0.6)),
              transition: "none",
            }}
          />
          {/* Small dot at the V apex — appears at end */}
          <circle
            cx="60"
            cy="80"
            r="3"
            fill="#00F0FF"
            style={{
              opacity: drawProgress >= 0.95 ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />
          {/* Corner accent marks */}
          <path
            d="M 5 5 L 5 15 M 5 5 L 15 5"
            stroke="rgba(0,240,255,0.25)"
            strokeWidth="1"
            strokeLinecap="round"
            style={{
              strokeDasharray: 20,
              strokeDashoffset: 20 * (1 - Math.max(0, (drawProgress - 0.6) / 0.4)),
            }}
          />
          <path
            d="M 115 5 L 115 15 M 115 5 L 105 5"
            stroke="rgba(0,240,255,0.25)"
            strokeWidth="1"
            strokeLinecap="round"
            style={{
              strokeDasharray: 20,
              strokeDashoffset: 20 * (1 - Math.max(0, (drawProgress - 0.65) / 0.35)),
            }}
          />
          <path
            d="M 5 95 L 5 85 M 5 95 L 15 95"
            stroke="rgba(0,240,255,0.25)"
            strokeWidth="1"
            strokeLinecap="round"
            style={{
              strokeDasharray: 20,
              strokeDashoffset: 20 * (1 - Math.max(0, (drawProgress - 0.7) / 0.3)),
            }}
          />
          <path
            d="M 115 95 L 115 85 M 115 95 L 105 95"
            stroke="rgba(0,240,255,0.25)"
            strokeWidth="1"
            strokeLinecap="round"
            style={{
              strokeDasharray: 20,
              strokeDashoffset: 20 * (1 - Math.max(0, (drawProgress - 0.75) / 0.25)),
            }}
          />
        </svg>

        {/* Glow ring behind the icon */}
        <div
          className="absolute inset-0 -m-4 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,240,255,0.06) 0%, transparent 70%)",
            opacity: drawProgress,
            transform: `scale(${0.8 + drawProgress * 0.4})`,
            transition: "none",
          }}
        />
      </div>

      {/* VIVE label */}
      <div
        className="font-mono text-xs tracking-[0.35em] uppercase mb-6"
        style={{
          color: "#00F0FF",
          opacity: phase === "drawing" ? Math.max(0, (drawProgress - 0.5) * 2) : 1,
          textShadow: "0 0 8px rgba(0,240,255,0.5)",
        }}
      >
        VIVE
      </div>

      {/* Status text — monospaced cycling label */}
      <div className="h-5 flex items-center justify-center">
        {phase !== "drawing" && (
          <div
            className="font-mono text-[11px] tracking-[0.15em] uppercase"
            style={{
              color:
                STATUS_MESSAGES[messageIndex] === "SYSTEM READY"
                  ? "#00F0FF"
                  : "#666666",
              textShadow:
                STATUS_MESSAGES[messageIndex] === "SYSTEM READY"
                  ? "0 0 6px rgba(0,240,255,0.4)"
                  : "none",
              animation: "bootTextFadeIn 0.3s ease forwards",
            }}
            key={messageIndex}
          >
            {STATUS_MESSAGES[messageIndex]}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-6 w-32 h-[1px] bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width:
              phase === "drawing"
                ? `${drawProgress * 40}%`
                : phase === "messages"
                  ? `${40 + ((messageIndex + 1) / STATUS_MESSAGES.length) * 50}%`
                  : "100%",
            backgroundColor: "#00F0FF",
            boxShadow: "0 0 6px #00F0FF",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
