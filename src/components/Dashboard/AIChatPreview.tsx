import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";

interface ChatMessage {
  id: string;
  role: "user" | "vive";
  text: string;
  timestamp: string;
  tag?: string;
}

/* ── Last 3 messages ── */
const RECENT_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "Log 200mg magnesium glycinate before bed",
    timestamp: "8:42 PM",
    tag: "Supplement",
  },
  {
    id: "m2",
    role: "vive",
    text: "Logged. Mg levels trending optimal. Consider pairing with 50mg zinc picolinate.",
    timestamp: "8:42 PM",
  },
  {
    id: "m3",
    role: "user",
    text: "How did my HRV trend compare to last week?",
    timestamp: "9:15 PM",
    tag: "Vitals",
  },
];

/* ── Suggestion chips data ── */
const SUGGESTION_CHIPS = [
  { id: "lunch", label: "Log your lunch", icon: "🍽" },
  { id: "hydration", label: "Check hydration", icon: "💧" },
  { id: "movement", label: "Log a walk", icon: "🚶" },
  { id: "snack", label: "Log a snack", icon: "🥜" },
  { id: "energy", label: "Rate your energy", icon: "⚡" },
  { id: "stretch", label: "Log a stretch", icon: "🧘" },
];

function getTimeSuggestions(): typeof SUGGESTION_CHIPS {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return SUGGESTION_CHIPS.filter(c => ["lunch", "hydration", "energy"].includes(c.id)).map(c => c.id === "lunch" ? { ...c, label: "Log breakfast", icon: "🥣" } : c);
  if (hour >= 10 && hour < 14) return SUGGESTION_CHIPS.filter(c => ["lunch", "hydration", "movement"].includes(c.id));
  if (hour >= 14 && hour < 17) return SUGGESTION_CHIPS.filter(c => ["snack", "hydration", "stretch"].includes(c.id));
  if (hour >= 17 && hour < 21) return SUGGESTION_CHIPS.filter(c => ["lunch", "movement", "energy"].includes(c.id)).map(c => c.id === "lunch" ? { ...c, label: "Log dinner", icon: "🍽" } : c);
  return SUGGESTION_CHIPS.filter(c => ["hydration", "stretch", "energy"].includes(c.id));
}

/* ── Inject keyframes once ── */
if (typeof document !== "undefined" && !document.getElementById("chat-strip-pulse")) {
  const style = document.createElement("style");
  style.id = "chat-strip-pulse";
  style.textContent = `@keyframes chatStripPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}@keyframes cyanProgressSweep{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`;
  document.head.appendChild(style);
}

/* ── Compact message row ── */
function CompactMessage({
  message,
  ghostMode,
  index,
}: {
  message: ChatMessage;
  ghostMode: boolean;
  index: number;
}) {
  const isVive = message.role === "vive";
  const neon = ghostMode ? "rgba(160,160,160," : "rgba(0,255,204,";

  return (
    <motion.div
      initial={{ opacity: 0, x: isVive ? -6 : 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
      className={`flex items-start gap-1.5 ${isVive ? "" : "flex-row-reverse"}`}
    >
      {/* Avatar dot */}
      {isVive && (
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.1)",
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(0,255,204,0.18)"}`,
          }}
        >
          <span
            className="text-[6px] font-bold"
            style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "#00FFCC" }}
          >
            V
          </span>
        </div>
      )}

      {/* Message content */}
      <div
        className={`flex-1 min-w-0 ${isVive ? "" : "text-right"}`}
      >
        {/* Tag + timestamp inline */}
        <div className={`flex items-center gap-1.5 mb-0.5 ${isVive ? "" : "justify-end"}`}>
          {message.tag && (
            <span
              className="text-[6px] font-mono uppercase tracking-[0.15em] px-1 py-[1px] rounded-full"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.06)",
                color: ghostMode ? "rgba(160,160,160,0.35)" : "rgba(0,255,204,0.4)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.08)"}`,
              }}
            >
              {message.tag}
            </span>
          )}
          <span
            className="text-[6px] font-mono"
            style={{ color: ghostMode ? "rgba(160,160,160,0.2)" : "rgba(255,255,255,0.15)" }}
          >
            {message.timestamp}
          </span>
        </div>

        {/* Text — single line truncated for density */}
        <p
          className="text-[10px] leading-[1.4] font-mono truncate"
          style={{
            color: isVive
              ? ghostMode ? "rgba(200,200,200,0.6)" : "rgba(255,255,255,0.65)"
              : ghostMode ? "rgba(200,200,200,0.5)" : "rgba(255,255,255,0.5)",
          }}
        >
          {message.text}
        </p>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════
   AIChatPreview — Slim Communication Strip
   ══════════════════════════════════════════════ */
export function AIChatPreview({
  onOpenBriefing,
  onOpenCamera,
  onOpenPushToTalk,
  voiceState,
  lastLogTimestamp,
}: {
  onOpenBriefing: (context?: 'chat' | 'camera' | 'voice') => void;
  onOpenCamera?: () => void;
  onOpenPushToTalk?: () => void;
  voiceState?: { isActive: boolean; phase: 'listening' | 'processing' | 'done'; transcript: string };
  lastLogTimestamp?: number | null;
}) {
  const ghostMode = useGhostMode();
  const [hovered, setHovered] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const neon = ghostMode ? "rgba(160,160,160," : "rgba(0,255,204,";
  const neonHex = ghostMode ? "#a0a0a0" : "#00FFCC";

  // Determine if suggestion chips should show (no log in 3 hours)
  const showSuggestions = (() => {
    if (!lastLogTimestamp) return true; // No logs at all — show suggestions
    const threeHoursMs = 3 * 60 * 60 * 1000;
    return Date.now() - lastLogTimestamp > threeHoursMs;
  })();
  const suggestions = getTimeSuggestions();

  // Is Vive processing (from voice command)?
  const isViveThinking = voiceState?.isActive && voiceState?.phase === 'processing';

  const borderColor = hovered
    ? ghostMode ? "rgba(160,160,160,0.16)" : "rgba(0,255,204,0.14)"
    : ghostMode ? "rgba(160,160,160,0.07)" : "rgba(0,255,204,0.05)";

  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenBriefing('chat');
  }, [onOpenBriefing]);

  const handleInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputValue.trim()) {
      onOpenBriefing('chat');
      setInputValue("");
    }
  }, [inputValue, onOpenBriefing]);

  const handleCameraClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenBriefing('camera');
  }, [onOpenBriefing]);

  const handleMicClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenBriefing('voice');
  }, [onOpenBriefing]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full rounded-2xl overflow-hidden group"
      style={{
        background: ghostMode ? "rgba(20,20,22,0.5)" : "rgba(8,8,16,0.45)",
        backdropFilter: "blur(40px) saturate(1.5)",
        WebkitBackdropFilter: "blur(40px) saturate(1.5)",
        border: `1px solid ${borderColor}`,
        boxShadow: hovered
          ? ghostMode
            ? "0 6px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(160,160,160,0.04)"
            : "0 6px 24px rgba(0,0,0,0.35), 0 0 16px rgba(0,255,204,0.02), inset 0 1px 0 rgba(255,255,255,0.03)"
          : "0 3px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02)",
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* ── Cyan Progress Bar — shows when Vive is processing ── */}
      <AnimatePresence>
        {isViveThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute top-0 left-0 right-0 z-20 h-[2px] overflow-hidden rounded-t-2xl"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,240,255,0.08)',
            }}
          >
            {/* Sweeping highlight */}
            <div
              className="absolute inset-0 h-full"
              style={{
                width: '50%',
                background: ghostMode
                  ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.5), transparent)'
                  : 'linear-gradient(90deg, transparent, #00F0FF, rgba(0,240,255,0.4), transparent)',
                animation: 'cyanProgressSweep 1.2s ease-in-out infinite',
                boxShadow: ghostMode ? 'none' : '0 0 8px rgba(0,240,255,0.4)',
              }}
            />
            {/* Static glow base */}
            <div
              className="absolute inset-0"
              style={{
                background: ghostMode
                  ? 'linear-gradient(90deg, rgba(160,160,160,0.1), rgba(160,160,160,0.2), rgba(160,160,160,0.1))'
                  : 'linear-gradient(90deg, rgba(0,240,255,0.1), rgba(0,240,255,0.25), rgba(0,240,255,0.1))',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top gradient line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: ghostMode
            ? "linear-gradient(90deg, transparent, rgba(160,160,160,0.08), transparent)"
            : isViveThinking
              ? "linear-gradient(90deg, transparent, rgba(0,240,255,0.2), transparent)"
              : "linear-gradient(90deg, transparent, rgba(0,255,204,0.1), rgba(191,90,242,0.06), transparent)",
          opacity: hovered || isViveThinking ? 1 : 0.5,
          transition: "opacity 0.3s",
        }}
      />

      {/* Header — clickable to open Briefing Room */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenBriefing('chat')}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBriefing('chat'); } }}
        className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5 cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          {/* Chat icon */}
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.07)" : "rgba(0,255,204,0.07)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.1)"}`,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={neonHex} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
            </svg>
          </div>
          <span
            className="text-[9px] font-mono uppercase tracking-[0.14em] font-semibold"
            style={{ color: `${neon}0.5)` }}
          >
            Vive AI
          </span>
          {/* Live dot */}
          <div
            className="w-1 h-1 rounded-full"
            style={{
              background: ghostMode ? "rgba(100,200,100,0.5)" : "#34D399",
              boxShadow: ghostMode ? "none" : "0 0 4px rgba(52,211,153,0.5)",
              animation: "chatStripPulse 2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Open arrow */}
        <div
          className="flex items-center gap-1 transition-all duration-300"
          style={{
            opacity: hovered ? 0.6 : 0.25,
            transform: hovered ? "translateX(1px)" : "translateX(0)",
          }}
        >
          <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.4)` }}>
            Open
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={`${neon}0.4)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>

      {/* Compact message list — clickable to open Briefing Room */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenBriefing('chat')}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBriefing('chat'); } }}
        className="flex flex-col gap-1.5 px-3.5 pb-2 cursor-pointer"
      >
        {RECENT_MESSAGES.map((msg, i) => (
          <CompactMessage key={msg.id} message={msg} ghostMode={ghostMode} index={i} />
        ))}

        {/* ── Inline Voice Status (from V button long press) ── */}
        <AnimatePresence>
          {voiceState?.isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg mt-0.5"
                style={{
                  background: voiceState.phase === 'processing'
                    ? (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,214,10,0.05)')
                    : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,242,255,0.05)'),
                  border: `1px solid ${voiceState.phase === 'processing'
                    ? (ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,214,10,0.12)')
                    : (ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(0,242,255,0.1)')}`,
                }}
              >
                {/* Pulsing dot */}
                <motion.div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: voiceState.phase === 'processing'
                      ? (ghostMode ? '#a0a0a0' : '#FFD60A')
                      : (ghostMode ? '#a0a0a0' : '#00F2FF'),
                    boxShadow: voiceState.phase === 'processing'
                      ? (ghostMode ? 'none' : '0 0 6px rgba(255,214,10,0.4)')
                      : (ghostMode ? 'none' : '0 0 6px rgba(0,242,255,0.4)'),
                  }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: voiceState.phase === 'processing' ? 0.5 : 0.8, repeat: Infinity }}
                />

                {/* Status + transcript */}
                <div className="flex-1 min-w-0">
                  {voiceState.transcript ? (
                    <p
                      className="text-[9px] font-mono truncate italic"
                      style={{
                        color: voiceState.phase === 'processing'
                          ? (ghostMode ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.65)')
                          : (ghostMode ? 'rgba(200,200,200,0.5)' : 'rgba(255,255,255,0.55)'),
                      }}
                    >
                      &ldquo;{voiceState.transcript}&rdquo;
                    </p>
                  ) : (
                    <p
                      className="text-[9px] font-mono uppercase tracking-wider"
                      style={{
                        color: voiceState.phase === 'processing'
                          ? (ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,214,10,0.6)')
                          : (ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(0,242,255,0.6)'),
                      }}
                    >
                      {voiceState.phase === 'processing' ? 'Thinking...' : 'Listening...'}
                    </p>
                  )}
                </div>

                {/* Mini waveform bars */}
                {voiceState.phase === 'listening' && (
                  <div className="flex items-center gap-[1px] flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="rounded-full"
                        style={{
                          width: 1.5,
                          background: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(0,242,255,0.45)',
                        }}
                        animate={{ height: [2, 6 + Math.random() * 5, 2] }}
                        transition={{ duration: 0.35 + Math.random() * 0.25, repeat: Infinity, delay: i * 0.05 }}
                      />
                    ))}
                  </div>
                )}
                {voiceState.phase === 'processing' && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ background: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,214,10,0.5)' }}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Suggestion Chips — show when no log in 3 hours ── */}
      <AnimatePresence>
        {showSuggestions && !voiceState?.isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden px-3.5 pb-1"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {suggestions.map((chip, i) => (
                <motion.button
                  key={chip.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.06 }}
                  onClick={(e) => { e.stopPropagation(); onOpenBriefing('chat'); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 transition-all duration-200 hover:scale-[1.04] active:scale-95 cursor-pointer"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(0,240,255,0.04)',
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,240,255,0.08)'}`,
                  }}
                >
                  <span className="text-[8px]">{chip.icon}</span>
                  <span
                    className="text-[8px] font-mono"
                    style={{
                      color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(0,240,255,0.45)',
                    }}
                  >
                    {chip.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Rail ── */}
      <div
        className="relative px-3 pb-3 pt-1.5"
        style={{
          borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.05)" : "rgba(255,255,255,0.03)"}`,
        }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-300"
          style={{
            background: inputFocused
              ? ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.06)"
              : ghostMode ? "rgba(160,160,160,0.05)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${
              inputFocused
                ? ghostMode ? "rgba(160,160,160,0.18)" : "rgba(0,255,204,0.15)"
                : ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,255,255,0.05)"
            }`,
            boxShadow: inputFocused
              ? ghostMode
                ? "0 0 12px rgba(160,160,160,0.05), inset 0 1px 0 rgba(160,160,160,0.03)"
                : "0 0 12px rgba(0,255,204,0.04), inset 0 1px 0 rgba(255,255,255,0.02)"
              : "none",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Camera trigger */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleCameraClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCameraClick(e as any); } }}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.05)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.08)"}`,
            }}
            title="Photo log"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "rgba(0,255,204,0.55)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>

          {/* Message input */}
          <form onSubmit={handleInputSubmit} className="flex-1 min-w-0" onClick={handleInputClick}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Speak to Vive..."
              className="w-full bg-transparent text-[10px] font-mono outline-none placeholder:opacity-40"
              style={{
                color: ghostMode ? "rgba(200,200,200,0.7)" : "rgba(255,255,255,0.7)",
                caretColor: neonHex,
              }}
            />
          </form>

          {/* Send button — appears when typing */}
          <AnimatePresence>
            {inputValue.trim() && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleInputSubmit(e as any); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInputSubmit(e as any); } }}
                className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
                style={{
                  background: ghostMode ? "rgba(160,160,160,0.15)" : "rgba(0,255,204,0.15)",
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.2)" : "rgba(0,255,204,0.25)"}`,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={neonHex} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Microphone trigger */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleMicClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleMicClick(e as any); } }}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.05)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.08)"}`,
            }}
            title="Voice log"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(160,160,160,0.45)" : "rgba(0,255,204,0.55)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
        </div>

        {/* Subtle hint row */}
        <div className="flex items-center justify-center gap-3 mt-1.5">
          <span
            className="text-[6px] font-mono uppercase tracking-wider"
            style={{ color: ghostMode ? "rgba(160,160,160,0.18)" : "rgba(255,255,255,0.12)" }}
          >
            📷 Photo
          </span>
          <span
            className="text-[6px] font-mono"
            style={{ color: ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.06)" }}
          >
            ·
          </span>
          <span
            className="text-[6px] font-mono uppercase tracking-wider"
            style={{ color: ghostMode ? "rgba(160,160,160,0.18)" : "rgba(255,255,255,0.12)" }}
          >
            💬 Message
          </span>
          <span
            className="text-[6px] font-mono"
            style={{ color: ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.06)" }}
          >
            ·
          </span>
          <span
            className="text-[6px] font-mono uppercase tracking-wider"
            style={{ color: ghostMode ? "rgba(160,160,160,0.18)" : "rgba(255,255,255,0.12)" }}
          >
            🎙 Voice
          </span>
        </div>
      </div>

      {/* Hover glow */}
      {!ghostMode && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-500"
          style={{
            background: "radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.015) 0%, transparent 60%)",
            opacity: hovered ? 1 : 0,
          }}
        />
      )}
    </motion.div>
  );
}

export default AIChatPreview;
