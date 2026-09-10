import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "@/components/Presence/usePresenceState";
import {
  getCollaborationZones,
  subscribeCollaborationZones,
  type CollaborationZone,
} from "@/components/Presence/useProximityGlow";
import type { RemotePresence } from "@/hooks/useConvexPresence";

/* ══════════════════════════════════════════════════════════════ */
/*  TacticalSyncHUD — Context-Aware Floating HUD                */
/*  • SOLO MODE: Minimal pill when no peers within 100px        */
/*  • COLLAB MODE: Expanded menu with Bio-Sync & Focus Alert    */
/*  • QUICK-VOICE: Long-press mic for Web Speech transcription  */
/*  Spring animations for premium feel between modes            */
/* ══════════════════════════════════════════════════════════════ */

const SYNC_TRIGGER_RADIUS = 100;
const HUD_DISMISS_MS = 14000;

/* ── Design tokens ── */
const T = {
  gold: "#C4A46C",
  cyan: "#00F0FF",
  green: "#00FFCC",
  red: "#FF6B6B",
  amber: "#FFB86B",
  violet: "#AF82FF",
  textHi: "rgba(255,255,255,0.92)",
  textMid: "rgba(255,255,255,0.55)",
  textLo: "rgba(255,255,255,0.28)",
  surface: "rgba(10,12,16,0.96)",
  surfaceAlt: "rgba(18,16,22,0.94)",
};

/* ── Spring configs ── */
const SPRING_EXPAND = { type: "spring" as const, stiffness: 280, damping: 26, mass: 0.9 };
const SPRING_COLLAPSE = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };
const SPRING_GENTLE = { type: "spring" as const, stiffness: 200, damping: 22, mass: 1 };

/* ══════════════════════════════════════════════════════════════ */
/*  Voice Command Parser — Keyword extraction engine             */
/* ══════════════════════════════════════════════════════════════ */

interface ParsedVoiceCommand {
  intent: string;
  category: string;
  value: string | undefined;
  numeric: number | undefined;
  confidence: number;
  label: string;
  icon: string;
  color: string;
}

function parseVoiceCommand(transcript: string): ParsedVoiceCommand {
  const t = transcript.toLowerCase().trim();

  // Extract numbers from transcript
  const numMatch = t.match(/(\d+(?:\.\d+)?)/);
  const num = numMatch ? parseFloat(numMatch[1]) : undefined;

  // Word-to-number mapping for spoken numbers
  const wordNums: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  let spokenNum = num;
  if (!spokenNum) {
    for (const [word, val] of Object.entries(wordNums)) {
      if (t.includes(word)) { spokenNum = val; break; }
    }
  }

  // ── Fatigue detection ──
  if (/fatigue|tired|exhausted|wiped|drained|burnt out|burned out/.test(t)) {
    const level = spokenNum ?? 5;
    return {
      intent: "fatigue", category: "recovery",
      value: `Level ${level}`, numeric: level, confidence: 0.92,
      label: `Fatigue L${level}`, icon: "⚡", color: T.red,
    };
  }

  // ── Protocol start ──
  if (/start(?:ed|ing)?|begin(?:ning)?|initiat/.test(t)) {
    const protocols: [RegExp, string, string][] = [
      [/hydration|water|hydrat/, "Hydration Protocol", "nutrition"],
      [/cold\s*(?:exposure|shower|plunge|bath)/, "Cold Exposure", "recovery"],
      [/breath(?:ing|work)?|wim\s*hof|box\s*breath/, "Breathwork", "recovery"],
      [/meditat|mindful/, "Meditation", "recovery"],
      [/stretch|mobil|yoga|flex/, "Mobility Flow", "recovery"],
      [/fast(?:ing)?|intermittent/, "Fasting Protocol", "nutrition"],
      [/sauna|heat\s*(?:exposure|therapy)/, "Sauna Session", "recovery"],
      [/workout|training|exercise|lift|gym/, "Training Session", "movement"],
      [/run(?:ning)?|jog|sprint|cardio/, "Cardio Session", "movement"],
      [/supplement|stack|vitamin|creatine|omega/, "Supplement Stack", "supplements"],
      [/sleep|nap|rest/, "Sleep Protocol", "recovery"],
      [/focus|deep\s*work|flow\s*state/, "Deep Work", "focus"],
    ];
    for (const [rx, name, cat] of protocols) {
      if (rx.test(t)) {
        return {
          intent: "protocol_start", category: cat,
          value: name, numeric: undefined, confidence: 0.9,
          label: `Started ${name}`, icon: "🔄", color: T.cyan,
        };
      }
    }
    // Generic protocol start
    const afterStart = t.replace(/start(?:ed|ing)?|begin(?:ning)?|initiat(?:ed|ing)?/, "").trim();
    const protocolName = afterStart.length > 2
      ? afterStart.split(" ").slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Protocol";
    return {
      intent: "protocol_start", category: "general",
      value: protocolName, numeric: undefined, confidence: 0.75,
      label: `Started ${protocolName}`, icon: "🔄", color: T.cyan,
    };
  }

  // ── Protocol complete ──
  if (/finish(?:ed)?|complet(?:ed|e)|done\s*with|wrapped\s*up/.test(t)) {
    const afterFinish = t.replace(/finish(?:ed)?|complet(?:ed|e)|done\s*with|wrapped\s*up/, "").trim();
    const protocolName = afterFinish.length > 2
      ? afterFinish.split(" ").slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Protocol";
    return {
      intent: "protocol_complete", category: "general",
      value: protocolName, numeric: undefined, confidence: 0.85,
      label: `Completed ${protocolName}`, icon: "✅", color: T.green,
    };
  }

  // ── Energy level ──
  if (/energy|energized|energetic|vigor/.test(t)) {
    const level = spokenNum ?? 7;
    return {
      intent: "energy", category: "vitals",
      value: `Level ${level}`, numeric: level, confidence: 0.88,
      label: `Energy ${level}/10`, icon: "⚡", color: level >= 7 ? T.green : level >= 4 ? T.amber : T.red,
    };
  }

  // ── Focus / Deep work ──
  if (/focus|deep\s*work|flow\s*state|concentrat|zone\s*in/.test(t)) {
    return {
      intent: "focus", category: "focus",
      value: "Deep Work", numeric: undefined, confidence: 0.9,
      label: "Deep Work Mode", icon: "🎯", color: T.cyan,
    };
  }

  // ── Recovery ──
  if (/recover(?:y|ing)?|rest(?:ing)?|deload|chill|relax/.test(t)) {
    return {
      intent: "recovery", category: "recovery",
      value: "Recovery Mode", numeric: undefined, confidence: 0.85,
      label: "Recovery Mode", icon: "💤", color: T.violet,
    };
  }

  // ── Hydration ──
  if (/water|hydrat|drank|drink|fluid|oz|ounce|ml|liter|litre/.test(t)) {
    let amount = spokenNum ?? 250;
    if (/oz|ounce/.test(t)) amount = Math.round(amount * 29.574);
    if (/liter|litre/.test(t)) amount = Math.round(amount * 1000);
    return {
      intent: "hydration", category: "nutrition",
      value: `${amount}ml`, numeric: amount, confidence: 0.88,
      label: `Hydrated ${amount}ml`, icon: "💧", color: T.cyan,
    };
  }

  // ── Supplement ──
  if (/took|take|supplement|creatine|omega|vitamin|magnesium|zinc|ashwagandha|fish\s*oil/.test(t)) {
    const supps: [RegExp, string][] = [
      [/creatine/, "Creatine"],
      [/omega|fish\s*oil/, "Omega-3"],
      [/vitamin\s*d/, "Vitamin D3"],
      [/vitamin\s*c/, "Vitamin C"],
      [/magnesium/, "Magnesium"],
      [/zinc/, "Zinc"],
      [/ashwagandha/, "Ashwagandha"],
      [/melatonin/, "Melatonin"],
      [/caffeine|coffee|espresso/, "Caffeine"],
    ];
    for (const [rx, name] of supps) {
      if (rx.test(t)) {
        return {
          intent: "supplement", category: "supplements",
          value: name, numeric: undefined, confidence: 0.9,
          label: `Took ${name}`, icon: "💊", color: T.gold,
        };
      }
    }
    return {
      intent: "supplement", category: "supplements",
      value: "Supplement", numeric: undefined, confidence: 0.7,
      label: "Logged Supplement", icon: "💊", color: T.gold,
    };
  }

  // ── Mood ──
  if (/mood|feeling|feel|mental|vibe/.test(t)) {
    let level = spokenNum ?? 5;
    if (/great|amazing|fantastic|excellent|awesome|incredible/.test(t)) level = 9;
    else if (/good|well|fine|decent|solid/.test(t)) level = 7;
    else if (/okay|ok|alright|meh|so-so/.test(t)) level = 5;
    else if (/bad|low|rough|terrible|awful|horrible/.test(t)) level = 2;
    return {
      intent: "mood", category: "vitals",
      value: `${level}/10`, numeric: level, confidence: 0.82,
      label: `Mood ${level}/10`, icon: "🧠", color: level >= 7 ? T.green : level >= 4 ? T.amber : T.red,
    };
  }

  // ── Sleep ──
  if (/sl(?:ept|eep)|nap(?:ped)?|rest(?:ed)?.*hour/.test(t)) {
    const hours = spokenNum ?? 7;
    return {
      intent: "sleep", category: "recovery",
      value: `${hours}h`, numeric: hours, confidence: 0.88,
      label: `${hours}h Sleep`, icon: "😴", color: hours >= 7 ? T.green : hours >= 5 ? T.amber : T.red,
    };
  }

  // ── Fallback: generic voice note ──
  return {
    intent: "note", category: "voice",
    value: transcript.slice(0, 60), numeric: undefined, confidence: 0.5,
    label: "Voice Note", icon: "🎙️", color: T.textMid,
  };
}

/* ══════════════════════════════════════════════════════════════ */
/*  Quick-Voice Button — Web Speech API with visual feedback     */
/* ══════════════════════════════════════════════════════════════ */

function QuickVoiceButton({ sessionId }: { sessionId: string }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedVoiceCommand | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyVoiceCommand = useMutation(api.mutations.applyVoiceCommand);

  // Check Web Speech API support
  const isSupported = useMemo(() => {
    return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Speech not supported");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setTranscript("");
    setParsedResult(null);
    setShowResult(false);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === "no-speech") {
        setError("No speech detected");
      } else if (event.error === "not-allowed") {
        setError("Mic access denied");
      } else {
        setError("Try again");
      }
      setTimeout(() => setError(null), 3000);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Process transcript when listening stops and we have text
  useEffect(() => {
    if (!isListening && transcript.length > 0) {
      const parsed = parseVoiceCommand(transcript);
      setParsedResult(parsed);
      setShowResult(true);

      // Apply to Convex
      applyVoiceCommand({
        sessionId,
        transcript,
        parsedIntent: parsed.intent,
        parsedCategory: parsed.category,
        parsedValue: parsed.value,
        parsedNumeric: parsed.numeric,
      }).catch(() => {
        // Silent fail — result already shown locally
      });

      // Auto-dismiss result after 4s
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        setShowResult(false);
        setTranscript("");
        setParsedResult(null);
      }, 4000);
    }
  }, [isListening, transcript, sessionId, applyVoiceCommand]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {/* ── Parsed Result Toast ── */}
      <AnimatePresence>
        {showResult && parsedResult && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={SPRING_COLLAPSE}
            className="absolute bottom-full mb-2 rounded-xl px-3 py-2 flex items-center gap-2 whitespace-nowrap pointer-events-none"
            style={{
              background: T.surface,
              border: `1px solid ${parsedResult.color}30`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 20px ${parsedResult.color}15`,
              backdropFilter: "blur(20px)",
            }}
          >
            <span className="text-sm">{parsedResult.icon}</span>
            <span className="text-[11px] font-semibold" style={{ color: parsedResult.color }}>
              {parsedResult.label}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="3" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error Toast ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute bottom-full mb-2 rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none"
            style={{ background: `${T.red}20`, border: `1px solid ${T.red}30` }}
          >
            <span className="text-[10px] font-medium" style={{ color: T.red }}>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Interim Transcript ── */}
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full mb-2 rounded-xl px-3 py-2 max-w-[200px] pointer-events-none"
            style={{
              background: T.surface,
              border: `1px solid ${T.cyan}20`,
              boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
            }}
          >
            <span className="text-[10px] italic leading-snug block" style={{ color: T.textMid }}>
              {transcript}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mic Button ── */}
      <motion.button
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onMouseLeave={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200"
        style={{
          background: isListening ? `${T.red}25` : "rgba(255,255,255,0.04)",
          border: `1px solid ${isListening ? T.red + "50" : "rgba(255,255,255,0.08)"}`,
          boxShadow: isListening ? `0 0 20px ${T.red}30, 0 0 40px ${T.red}10` : "none",
          cursor: isSupported ? "pointer" : "not-allowed",
          opacity: isSupported ? 1 : 0.35,
        }}
        title={isSupported ? "Hold to speak a voice command" : "Web Speech API not supported"}
      >
        {/* Pulsing ring when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${T.red}40` }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `1.5px solid ${T.red}25` }}
              animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
          </>
        )}

        {/* Mic icon */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={isListening ? T.red : T.textMid}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </motion.button>

      {/* Label */}
      <span className="text-[7px] font-semibold uppercase tracking-[0.15em] mt-1" style={{ color: isListening ? T.red : T.textLo }}>
        {isListening ? "Listening..." : "Voice"}
      </span>
    </div>
  );
}

/* ── Heatmap cell for readiness grid ── */
function HeatCell({ pct, size = 14 }: { pct: number; size?: number }) {
  const color =
    pct >= 80 ? T.green : pct >= 60 ? T.gold : pct >= 35 ? T.amber : T.red;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        background: color,
        opacity: 0.25 + (pct / 100) * 0.75,
        transition: "opacity 0.3s",
      }}
    />
  );
}

/* ── Sparkline bar chart for 7-day readiness ── */
function SparkBars({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: Math.max(2, (v / max) * height),
            borderRadius: 2,
            background: color,
            opacity: 0.3 + (v / max) * 0.7,
            transition: "height 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Solo Focus Pill — Minimal collapsed state + Quick-Voice     */
/* ══════════════════════════════════════════════════════════════ */
function SoloFocusPill({ sessionId }: { sessionId: string }) {
  const focusScore = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
    }
    return 65 + (Math.abs(hash) % 30);
  }, [sessionId]);

  const scoreColor = focusScore >= 85 ? T.green : focusScore >= 70 ? T.gold : T.amber;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, y: 8 }}
      transition={SPRING_COLLAPSE}
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full cursor-default select-none"
      style={{
        background: T.surface,
        border: `1px solid rgba(255,255,255,0.06)`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 16px ${T.cyan}04`,
      }}
    >
      {/* Breathing dot */}
      <motion.div
        className="w-2 h-2 rounded-full"
        style={{ background: T.cyan, boxShadow: `0 0 6px ${T.cyan}50` }}
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.textMid }}>
        Solo Focus
      </span>

      {/* Focus score badge */}
      <div className="flex items-center gap-1 pl-1.5 border-l" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={scoreColor} strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreColor }}>
          {focusScore}%
        </span>
      </div>

      {/* Divider + Quick-Voice */}
      <div className="pl-1.5 border-l" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <QuickVoiceButton sessionId={sessionId} />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Bio-Sync Comparison Panel                                    */
/* ══════════════════════════════════════════════════════════════ */
function BioSyncPanel({
  localSessionId,
  remoteSessionId,
  remoteColor,
  onClose,
}: {
  localSessionId: string;
  remoteSessionId: string;
  remoteColor: string;
  onClose: () => void;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const genData = useCallback((sid: string) => {
    let hash = 0;
    for (let i = 0; i < sid.length; i++) {
      hash = ((hash << 5) - hash + sid.charCodeAt(i)) | 0;
    }
    return Array.from({ length: 7 }, (_, i) => {
      const base = 55 + ((Math.abs(hash) + i * 17) % 40);
      return Math.min(100, base);
    });
  }, []);

  const localData = useMemo(() => genData(localSessionId), [genData, localSessionId]);
  const remoteData = useMemo(() => genData(remoteSessionId), [genData, remoteSessionId]);

  const localAvg = Math.round(localData.reduce((s, v) => s + v, 0) / localData.length);
  const remoteAvg = Math.round(remoteData.reduce((s, v) => s + v, 0) / remoteData.length);
  const syncScore = Math.max(0, 100 - Math.abs(localAvg - remoteAvg) * 2);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 12 }}
      transition={SPRING_EXPAND}
      className="rounded-2xl overflow-hidden"
      style={{
        background: T.surface,
        border: `1px solid ${T.cyan}20`,
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 40px ${T.cyan}08`,
        width: 300,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: `${T.cyan}15`, border: `1px solid ${T.cyan}25` }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: T.cyan }}>
            Bio-Sync Compare
          </span>
        </div>
        <button onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110"
          style={{ color: T.textLo, background: "rgba(255,255,255,0.04)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Side-by-side heatmaps */}
      <div className="px-4 pb-2 flex gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: T.green, boxShadow: `0 0 6px ${T.green}60` }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textMid }}>You</span>
            <span className="text-[11px] font-bold tabular-nums ml-auto"
              style={{ color: localAvg >= 70 ? T.green : localAvg >= 50 ? T.amber : T.red }}>
              {localAvg}%
            </span>
          </div>
          <div className="flex gap-[3px] mb-1.5">
            {localData.map((pct, i) => (
              <div key={i} className="flex flex-col items-center gap-[3px]">
                <HeatCell pct={pct} size={16} />
                <span className="text-[7px] tabular-nums" style={{ color: T.textLo }}>{days[i][0]}</span>
              </div>
            ))}
          </div>
          <SparkBars data={localData} color={T.green} height={24} />
        </div>

        <div className="flex flex-col items-center justify-center gap-1 py-2">
          <div className="w-px flex-1" style={{ background: `${T.cyan}12` }} />
          <span className="text-[8px] font-bold" style={{ color: T.textLo }}>VS</span>
          <div className="w-px flex-1" style={{ background: `${T.cyan}12` }} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: remoteColor, boxShadow: `0 0 6px ${remoteColor}60` }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textMid }}>Peer</span>
            <span className="text-[11px] font-bold tabular-nums ml-auto"
              style={{ color: remoteAvg >= 70 ? T.green : remoteAvg >= 50 ? T.amber : T.red }}>
              {remoteAvg}%
            </span>
          </div>
          <div className="flex gap-[3px] mb-1.5">
            {remoteData.map((pct, i) => (
              <div key={i} className="flex flex-col items-center gap-[3px]">
                <HeatCell pct={pct} size={16} />
                <span className="text-[7px] tabular-nums" style={{ color: T.textLo }}>{days[i][0]}</span>
              </div>
            ))}
          </div>
          <SparkBars data={remoteData} color={remoteColor} height={24} />
        </div>
      </div>

      {/* Sync alignment score */}
      <div className="mx-4 mb-3.5 px-3 py-2.5 rounded-xl flex items-center justify-between"
        style={{ background: `${T.cyan}06`, border: `1px solid ${T.cyan}12` }}>
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }}>
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-[10px] font-medium" style={{ color: T.textMid }}>Sync Alignment</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${syncScore}%`,
                background: syncScore >= 75 ? T.green : syncScore >= 50 ? T.gold : T.red,
                boxShadow: `0 0 6px ${syncScore >= 75 ? T.green : syncScore >= 50 ? T.gold : T.red}40`,
              }} />
          </div>
          <span className="text-[11px] font-bold tabular-nums"
            style={{ color: syncScore >= 75 ? T.green : syncScore >= 50 ? T.gold : T.red }}>
            {syncScore}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Focus Alert Toast                                            */
/* ══════════════════════════════════════════════════════════════ */
function FocusAlertToast({ fromColor, onDismiss }: { fromColor: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.92 }}
      transition={SPRING_GENTLE}
      className="pointer-events-auto w-full max-w-sm rounded-2xl overflow-hidden"
      style={{
        background: T.surface,
        border: `1px solid ${fromColor}35`,
        backdropFilter: "blur(24px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 30px ${fromColor}15, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="h-[2px]" style={{
        background: `linear-gradient(90deg, transparent, ${fromColor}, transparent)`,
        opacity: 0.7,
      }} />
      <div className="px-4 py-3.5 flex items-center gap-3">
        <motion.div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center relative"
          style={{ background: `${fromColor}12`, border: `1px solid ${fromColor}30` }}
          animate={{ boxShadow: [`0 0 0px ${fromColor}00`, `0 0 20px ${fromColor}30`, `0 0 0px ${fromColor}00`] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fromColor} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
            style={{ background: T.red, boxShadow: `0 0 6px ${T.red}80`, animation: "tacticalPulse 1.5s ease-in-out infinite" }} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: T.textHi }}>
            🎯 Focus Alert Received
          </p>
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: T.textMid }}>
            A teammate is entering deep work — minimize disruptions
          </p>
        </div>
        <button onClick={onDismiss}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{ color: T.textLo, background: "rgba(255,255,255,0.04)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <style>{`@keyframes tacticalPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.2); } }`}</style>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Collaborative Protocol Menu — with Quick-Voice integrated    */
/* ══════════════════════════════════════════════════════════════ */
function CollabProtocolMenu({
  sessionId,
  peerColor,
  peerCount,
  focusSent,
  onRequestBioSync,
  onSendFocusAlert,
  onDismiss,
}: {
  sessionId: string;
  peerColor: string;
  peerCount: number;
  focusSent: boolean;
  onRequestBioSync: () => void;
  onSendFocusAlert: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 10 }}
      transition={SPRING_EXPAND}
      className="relative flex flex-col items-center"
      style={{ width: 320 }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 220, height: 220,
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${peerColor}12 0%, transparent 70%)`,
          filter: "blur(30px)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Mode label badge */}
      <motion.div
        layout
        className="mb-3 px-3.5 py-1.5 rounded-full flex items-center gap-2"
        style={{
          background: T.surface,
          border: `1px solid ${T.cyan}30`,
          backdropFilter: "blur(20px)",
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 24px ${T.cyan}08`,
        }}
        animate={{
          boxShadow: [
            `0 4px 24px rgba(0,0,0,0.5), 0 0 24px ${T.cyan}08`,
            `0 4px 24px rgba(0,0,0,0.5), 0 0 36px ${T.cyan}18`,
            `0 4px 24px rgba(0,0,0,0.5), 0 0 24px ${T.cyan}08`,
          ],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: T.cyan }}>
          Collaborative Protocol
        </span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{
            background: peerColor,
            boxShadow: `0 0 6px ${peerColor}80`,
          }} />
          {peerCount > 1 && (
            <span className="text-[8px] font-bold tabular-nums" style={{ color: T.textLo }}>+{peerCount - 1}</span>
          )}
        </div>
      </motion.div>

      {/* Action buttons row — Bio-Sync, Focus Alert, Quick-Voice */}
      <motion.div
        className="flex gap-2.5 items-end"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08 } },
        }}
      >
        {/* Bio-Sync */}
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.8 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={SPRING_EXPAND}
          whileHover={{ scale: 1.06, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRequestBioSync}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition-colors duration-200"
          style={{
            background: T.surfaceAlt,
            border: `1px solid ${T.violet}25`,
            backdropFilter: "blur(16px)",
            boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 16px ${T.violet}06`,
          }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${T.violet}15`, border: `1px solid ${T.violet}25` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.violet} strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-semibold leading-tight" style={{ color: T.violet }}>Bio-Sync</span>
            <span className="text-[8px] leading-tight" style={{ color: T.textLo }}>Compare Readiness</span>
          </div>
        </motion.button>

        {/* Focus Alert */}
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.8 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={SPRING_EXPAND}
          whileHover={{ scale: focusSent ? 1 : 1.06, y: focusSent ? 0 : -1 }}
          whileTap={{ scale: focusSent ? 1 : 0.95 }}
          onClick={onSendFocusAlert}
          disabled={focusSent}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition-colors duration-200"
          style={{
            background: focusSent ? "rgba(14,12,10,0.6)" : T.surfaceAlt,
            border: `1px solid ${focusSent ? T.green + "30" : T.cyan + "25"}`,
            backdropFilter: "blur(16px)",
            boxShadow: focusSent ? "none" : `0 4px 20px rgba(0,0,0,0.35), 0 0 16px ${T.cyan}06`,
            opacity: focusSent ? 0.55 : 1,
          }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: focusSent ? `${T.green}12` : `${T.cyan}15`,
              border: `1px solid ${focusSent ? T.green + "25" : T.cyan + "25"}`,
            }}>
            {focusSent ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-semibold leading-tight"
              style={{ color: focusSent ? T.green : T.cyan }}>
              {focusSent ? "Alert Sent" : "Focus Alert"}
            </span>
            <span className="text-[8px] leading-tight" style={{ color: T.textLo }}>
              {focusSent ? "Delivered ✓" : "Notify Peer"}
            </span>
          </div>
        </motion.button>

        {/* Quick-Voice — integrated into collab menu */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16, scale: 0.8 },
            visible: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={SPRING_EXPAND}
          className="flex flex-col items-center"
        >
          <QuickVoiceButton sessionId={sessionId} />
        </motion.div>
      </motion.div>

      {/* Dismiss */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onDismiss}
        className="mt-2.5 text-[8px] uppercase tracking-[0.2em] transition-colors hover:opacity-70"
        style={{ color: T.textLo }}
      >
        dismiss
      </motion.button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Main TacticalSyncHUD Component — Context-Aware              */
/* ══════════════════════════════════════════════════════════════ */

interface TacticalSyncHUDProps {
  remoteUsers: RemotePresence[];
  ghostMode: boolean;
}

export function TacticalSyncHUD({ remoteUsers, ghostMode }: TacticalSyncHUDProps) {
  const sessionId = getSessionId();
  const sendPing = useMutation(api.peers.sendPing);

  const [zones, setZones] = useState<CollaborationZone[]>([]);
  const [activeHUD, setActiveHUD] = useState<{
    key: string; cx: number; cy: number; peerSessionId: string; peerColor: string;
  } | null>(null);
  const [showBioSync, setShowBioSync] = useState(false);
  const [focusSent, setFocusSent] = useState(false);
  const [incomingFocus, setIncomingFocus] = useState<{ fromColor: string } | null>(null);
  const [hudMode, setHudMode] = useState<"solo" | "collab">("solo");
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to collaboration zone updates
  useEffect(() => {
    const update = () => setZones([...getCollaborationZones()]);
    const unsub = subscribeCollaborationZones(update);
    const interval = setInterval(update, 100);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const closestSync = useMemo(() => {
    if (ghostMode) return null;
    for (const zone of zones) {
      if (zone.intensity < 0.35) continue;
      const parts = zone.key.split(":");
      if (parts.length !== 2) continue;
      const remotePart = parts.find((p) => remoteUsers.some((r) => r.sessionId === p));
      if (!remotePart) continue;
      const remote = remoteUsers.find((r) => r.sessionId === remotePart);
      if (!remote || remote.ghostMode) continue;
      return {
        key: zone.key,
        cx: zone.cx,
        cy: zone.cy,
        peerSessionId: remote.sessionId,
        peerColor: remote.color,
        intensity: zone.intensity,
      };
    }
    return null;
  }, [zones, remoteUsers, ghostMode]);

  const nearbyPeerCount = useMemo(() => {
    if (ghostMode) return 0;
    const peerIds = new Set<string>();
    for (const zone of zones) {
      if (zone.intensity < 0.35) continue;
      const parts = zone.key.split(":");
      parts.forEach((p) => {
        if (remoteUsers.some((r) => r.sessionId === p && !r.ghostMode)) {
          peerIds.add(p);
        }
      });
    }
    return peerIds.size;
  }, [zones, remoteUsers, ghostMode]);

  // Context-aware mode switching with debounce
  useEffect(() => {
    if (modeTransitionRef.current) clearTimeout(modeTransitionRef.current);

    if (closestSync) {
      setHudMode("collab");
      setActiveHUD({
        key: closestSync.key,
        cx: closestSync.cx,
        cy: closestSync.cy,
        peerSessionId: closestSync.peerSessionId,
        peerColor: closestSync.peerColor,
      });
      setFocusSent(false);

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setActiveHUD(null);
        setShowBioSync(false);
        setHudMode("solo");
      }, HUD_DISMISS_MS);
    } else {
      modeTransitionRef.current = setTimeout(() => {
        if (!closestSync) {
          setHudMode("solo");
          setActiveHUD(null);
          setShowBioSync(false);
        }
      }, 600);
    }

    return () => {
      if (modeTransitionRef.current) clearTimeout(modeTransitionRef.current);
    };
  }, [closestSync]);

  useEffect(() => {
    if (activeHUD && closestSync && closestSync.key === activeHUD.key) {
      setActiveHUD((prev) => prev ? { ...prev, cx: closestSync.cx, cy: closestSync.cy } : null);
    }
  }, [closestSync?.cx, closestSync?.cy, closestSync?.key]);

  // Listen for incoming focus alerts
  const activePings = useQuery(api.peers.getActivePings, { sessionId });
  useEffect(() => {
    if (!activePings) return;
    const focusPing = activePings.find((p) => p.pingType === "focus_alert");
    if (focusPing) {
      const sender = remoteUsers.find((r) => r.sessionId === focusPing.fromSessionId);
      setIncomingFocus({ fromColor: sender?.color ?? T.cyan });
    }
  }, [activePings, remoteUsers]);

  const handleRequestBioSync = useCallback(() => {
    setShowBioSync(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setActiveHUD(null);
      setShowBioSync(false);
      setHudMode("solo");
    }, HUD_DISMISS_MS * 2);
  }, []);

  const handleSendFocusAlert = useCallback(async () => {
    if (!activeHUD || focusSent) return;
    setFocusSent(true);
    try {
      await sendPing({
        fromSessionId: sessionId,
        toSessionId: activeHUD.peerSessionId,
        pingType: "focus_alert",
        message: "Focus Alert — entering deep work mode",
        emoji: "🎯",
      });
    } catch {
      // Silent fail
    }
    window.dispatchEvent(
      new CustomEvent("vive-nudge-pulse", {
        detail: {
          targetSessionId: activeHUD.peerSessionId,
          x: activeHUD.cx,
          y: activeHUD.cy,
          color: T.cyan,
          duration: 2500,
        },
      })
    );
  }, [activeHUD, focusSent, sendPing, sessionId]);

  const handleDismiss = useCallback(() => {
    setActiveHUD(null);
    setShowBioSync(false);
    setHudMode("solo");
  }, []);

  const hudPos = useMemo(() => {
    if (!activeHUD) return { x: 0, y: 0 };
    return {
      x: Math.max(180, Math.min(window.innerWidth - 180, activeHUD.cx)),
      y: Math.max(90, Math.min(window.innerHeight - 220, activeHUD.cy - 50)),
    };
  }, [activeHUD?.cx, activeHUD?.cy]);

  return (
    <>
      {/* ── Solo Focus Pill — with Quick-Voice ── */}
      <AnimatePresence mode="wait">
        {hudMode === "solo" && !ghostMode && (
          <motion.div
            key="solo-pill"
            className="fixed z-[299] pointer-events-auto"
            style={{ right: 24, bottom: 100 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            transition={SPRING_COLLAPSE}
          >
            <SoloFocusPill sessionId={sessionId} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collaborative Protocol Menu — with Quick-Voice ── */}
      <AnimatePresence mode="wait">
        {hudMode === "collab" && activeHUD && !showBioSync && (
          <motion.div
            key="collab-hud"
            className="fixed z-[300] pointer-events-auto"
            style={{ left: hudPos.x, top: hudPos.y, transform: "translate(-50%, -50%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CollabProtocolMenu
              sessionId={sessionId}
              peerColor={activeHUD.peerColor}
              peerCount={nearbyPeerCount}
              focusSent={focusSent}
              onRequestBioSync={handleRequestBioSync}
              onSendFocusAlert={handleSendFocusAlert}
              onDismiss={handleDismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bio-Sync Comparison Panel ── */}
      <AnimatePresence>
        {activeHUD && showBioSync && (
          <motion.div
            key="biosync-panel"
            className="fixed z-[301] pointer-events-auto"
            style={{ left: hudPos.x, top: hudPos.y, transform: "translate(-50%, -50%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <BioSyncPanel
              localSessionId={sessionId}
              remoteSessionId={activeHUD.peerSessionId}
              remoteColor={activeHUD.peerColor}
              onClose={() => setShowBioSync(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Incoming Focus Alert Toast ── */}
      <div className="fixed top-20 left-0 right-0 z-[400] flex flex-col items-center gap-2 pointer-events-none px-4">
        <AnimatePresence>
          {incomingFocus && (
            <FocusAlertToast
              key="focus-alert-toast"
              fromColor={incomingFocus.fromColor}
              onDismiss={() => setIncomingFocus(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
