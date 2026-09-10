import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { useAnalytics } from "@/lib/useAnalytics";

/* ── Help question definitions ── */
const HELP_QUESTIONS = [
  {
    id: "what_is_score",
    icon: "\u2753",
    label: "What is this score?",
    answer:
      "Your score reflects how well you are taking care of yourself today. It goes up when you log meals, stay active, and follow your protocols. Think of it as a simple daily health check-in\u2014not a medical diagnosis, just a friendly nudge.",
  },
  {
    id: "what_should_i_do",
    icon: "\u{1F3AF}",
    label: "What should I do today?",
    answer:
      "Start with the top action on your Today screen\u2014it is the single most impactful thing you can do right now. After that, log a meal or a quick walk. Small wins add up fast. You do not need to be perfect, just consistent.",
  },
  {
    id: "technical_support",
    icon: "\u{1F6E0}\uFE0F",
    label: "Technical Support",
    answer:
      "If something looks broken or you are stuck, try pulling down to refresh. If the issue persists, tap the chat icon on your dashboard and describe the problem\u2014our team will get back to you within 24 hours.",
  },
] as const;

/* ── Floating Help Button ── */
function FloatingHelpButton({ onClick, ghostMode }: { onClick: () => void; ghostMode: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed z-[9998] flex items-center justify-center rounded-full shadow-lg"
      style={{
        bottom: 90,
        right: 20,
        width: 44,
        height: 44,
        background: ghostMode
          ? "rgba(120,120,120,0.15)"
          : "rgba(255,255,255,0.08)",
        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(255,255,255,0.12)"}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      aria-label="Help and support"
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: ghostMode ? "rgba(160,160,160,0.6)" : "rgba(255,255,255,0.7)",
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1,
        }}
      >
        ?
      </span>
    </motion.button>
  );
}

/* ── Question Button ── */
function QuestionButton({
  icon,
  label,
  onClick,
  ghostMode,
  index,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  ghostMode: boolean;
  index: number;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-2xl transition-all duration-200 active:scale-[0.98]"
      style={{
        padding: "20px 24px",
        background: ghostMode
          ? "rgba(160,160,160,0.06)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.08)"}`,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 + index * 0.08, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{
        background: ghostMode
          ? "rgba(160,160,160,0.1)"
          : "rgba(255,255,255,0.07)",
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: ghostMode ? "rgba(160,160,160,0.8)" : "rgba(255,255,255,0.9)",
          fontFamily: "Inter, system-ui, sans-serif",
          letterSpacing: "-0.01em",
          textAlign: "left",
        }}
      >
        {label}
      </span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className="ml-auto flex-shrink-0"
        style={{ opacity: 0.4 }}
      >
        <path
          d="M7.5 5L12.5 10L7.5 15"
          stroke={ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.5)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}

/* ── Answer Panel ── */
function AnswerPanel({
  question,
  onBack,
  ghostMode,
}: {
  question: (typeof HELP_QUESTIONS)[number];
  onBack: () => void;
  ghostMode: boolean;
}) {
  const textColor = ghostMode ? "rgba(160,160,160,0.8)" : "rgba(255,255,255,0.85)";
  const subColor = ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.5)";

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 self-start"
        style={{ color: subColor }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          Back
        </span>
      </button>

      <div className="flex items-center gap-3">
        <span style={{ fontSize: 32 }}>{question.icon}</span>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: textColor,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {question.label}
        </h2>
      </div>

      <p
        style={{
          fontSize: 17,
          lineHeight: 1.7,
          color: textColor,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 400,
          opacity: 0.9,
        }}
      >
        {question.answer}
      </p>
    </motion.div>
  );
}

/* ── Main Overlay Component ── */
export function HelpSupportOverlay() {
  const ghostMode = useGhostMode();
  const { trackInfoClick } = useAnalytics();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<
    (typeof HELP_QUESTIONS)[number] | null
  >(null);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSelectedQuestion(null);
    trackInfoClick("help_opened");
  }, [trackInfoClick]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedQuestion(null);
  }, []);

  const handleSelectQuestion = useCallback(
    (question: (typeof HELP_QUESTIONS)[number]) => {
      setSelectedQuestion(question);
      // Log which question the user clicked — identifies where the UI is confusing
      trackInfoClick(`help_${question.id}`, JSON.stringify({ label: question.label }));
    },
    [trackInfoClick],
  );

  const handleBack = useCallback(() => {
    setSelectedQuestion(null);
  }, []);

  const bgColor = ghostMode ? "rgba(18,18,18,0.97)" : "rgba(8,8,8,0.97)";
  const headerColor = ghostMode ? "rgba(160,160,160,0.85)" : "rgba(255,255,255,0.9)";
  const subColor = ghostMode ? "rgba(160,160,160,0.45)" : "rgba(255,255,255,0.4)";

  return (
    <>
      {/* Floating ? button — always visible when modal is closed */}
      {!isOpen && <FloatingHelpButton onClick={handleOpen} ghostMode={ghostMode} />}

      {/* Full-screen modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[9999] flex flex-col"
            style={{
              background: bgColor,
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Close button */}
            <div className="flex justify-end p-5">
              <motion.button
                onClick={handleClose}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  background: ghostMode
                    ? "rgba(160,160,160,0.08)"
                    : "rgba(255,255,255,0.06)",
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.08)"}`,
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Close help"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                    stroke={ghostMode ? "rgba(160,160,160,0.6)" : "rgba(255,255,255,0.6)"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </motion.button>
            </div>

            {/* Content area */}
            <div className="flex-1 flex flex-col px-6 pb-10 overflow-y-auto">
              <AnimatePresence mode="wait">
                {selectedQuestion ? (
                  <AnswerPanel
                    key="answer"
                    question={selectedQuestion}
                    onBack={handleBack}
                    ghostMode={ghostMode}
                  />
                ) : (
                  <motion.div
                    key="questions"
                    className="flex flex-col gap-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Header */}
                    <motion.div
                      className="mb-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.05 }}
                    >
                      <h1
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: headerColor,
                          fontFamily: "Inter, system-ui, sans-serif",
                          letterSpacing: "-0.03em",
                          marginBottom: 8,
                        }}
                      >
                        How can we help?
                      </h1>
                      <p
                        style={{
                          fontSize: 15,
                          color: subColor,
                          fontFamily: "Inter, system-ui, sans-serif",
                          lineHeight: 1.5,
                        }}
                      >
                        Tap a question below to get a quick answer.
                      </p>
                    </motion.div>

                    {/* Question buttons */}
                    {HELP_QUESTIONS.map((q, i) => (
                      <QuestionButton
                        key={q.id}
                        icon={q.icon}
                        label={q.label}
                        onClick={() => handleSelectQuestion(q)}
                        ghostMode={ghostMode}
                        index={i}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
