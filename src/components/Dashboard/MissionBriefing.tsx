import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { useMissionProfile, type MissionProfile } from "@/lib/useUserStyle";
import type { ProtocolType } from "@/components/Dashboard/DynamicStatusHeader";

/* ── Protocol-specific briefing content ── */
const PROTOCOL_BRIEFINGS: Record<string, { title: string; message: string; icon: string; color: string }> = {
  'high-performance': {
    title: 'HIGH PERFORMANCE MODE',
    message: 'Your vitality is peaking. Today is the day to push boundaries — increase training intensity, hit your protein targets, and ride this momentum. Your body is ready for the challenge.',
    icon: '\u26A1',
    color: '#00F0FF',
  },
  'active-recovery': {
    title: 'ACTIVE RECOVERY MODE',
    message: 'Your system is signaling for repair. Focus on hydration (3L+ water), gentle movement like walking or yoga, and aim for 8+ hours of sleep tonight. Recovery is where growth happens.',
    icon: '\uD83D\uDEE1\uFE0F',
    color: '#F59E0B',
  },
  'steady-state': {
    title: 'STEADY STATE MODE',
    message: 'You are in a balanced zone. Maintain your current rhythm — consistent meals, moderate activity, and good sleep hygiene. Small daily wins compound into major results.',
    icon: '\uD83C\uDFAF',
    color: '#6EE7B7',
  },
};

/* ── Props ── */
interface MissionBriefingProps {
  foodLogCount: number;
  activityLogCount: number;
  selectedProtocol?: ProtocolType | null;
}

/* ── Time-aware greeting — Athletic Director voice ── */
function getTimeBlock(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getGreeting(block: ReturnType<typeof getTimeBlock>, profile: MissionProfile) {
  const greetings: Record<MissionProfile, Record<string, string>> = {
    core: {
      morning: "Good morning. We've mapped out today's priorities together.",
      afternoon: "Afternoon check-in. Let's see where we stand.",
      evening: "Evening wind-down. We're wrapping up strong today.",
    },
    elite: {
      morning: "Morning. We're in a growth window — let's make it count.",
      afternoon: "Afternoon fuel window is open. We've got momentum.",
      evening: "Evening recovery is underway. We built something today.",
    },
    "hard-truth": {
      morning: "We're up. No wasted reps today — every action is intentional.",
      afternoon: "Midday. We're holding ourselves accountable right now.",
      evening: "Final push of the day. Let's finish what we started.",
    },
  };
  return greetings[profile][block];
}

/* ── Profile accent colors ── */
function getProfileAccent(profile: MissionProfile) {
  switch (profile) {
    case "hard-truth":
      return { primary: "rgba(255,68,68,", label: "#FF4444" };
    case "elite":
      return { primary: "rgba(0,240,255,", label: "#00F0FF" };
    default:
      return { primary: "rgba(0,255,204,", label: "#00FFCC" };
  }
}

/* ── Scanning line animation ── */
function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(0,255,204,0.15) 30%, rgba(0,255,204,0.3) 50%, rgba(0,255,204,0.15) 70%, transparent 100%)",
      }}
      initial={{ top: 0, opacity: 0 }}
      animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "linear" }}
    />
  );
}

/* ── Mission profile badge ── */
const profileBadge: Record<MissionProfile, string> = {
  core: "SIGMA-01",
  elite: "APEX-02",
  "hard-truth": "OMEGA-03",
};

/* ── Active session messages — first-person partner language ── */
const activeMsg: Record<MissionProfile, string> = {
  core: "Our priorities are set. We're moving at a sustainable pace.",
  elite: "Growth protocols are loaded. We're fueling the surplus window.",
  "hard-truth": "We've committed to these targets. Let's see them through.",
};

/* ══════════════════════════════════════════════
   MissionBriefing — Lean greeting & context card
   The 3 protocol cards in GamePlanHero handle
   all objective tracking, so this stays minimal.
   ══════════════════════════════════════════════ */
export function MissionBriefing({ foodLogCount: _f, activityLogCount: _a, selectedProtocol }: MissionBriefingProps) {
  const ghostMode = useGhostMode();
  const missionProfile = useMissionProfile();
  const [currentTime, setCurrentTime] = useState(new Date());

  const accent = getProfileAccent(missionProfile);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const timeBlock = getTimeBlock();
  const greeting = getGreeting(timeBlock, missionProfile);

  const dateStr = currentTime
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  const timeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const accentColor = ghostMode ? "rgba(160,160,160," : accent.primary;
  const borderColor = ghostMode ? "rgba(160,160,160,0.08)" : `${accent.primary}0.08)`;
  const headerGlow = ghostMode ? "transparent" : `${accent.primary}0.03)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden rounded-xl"
      style={{
        background: "rgba(8, 8, 12, 0.7)",
        border: `1px solid ${borderColor}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {!ghostMode && <ScanLine />}

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: ghostMode
            ? "linear-gradient(90deg, transparent, rgba(160,160,160,0.15), transparent)"
            : `linear-gradient(90deg, transparent, ${accentColor}0.25), ${accentColor}0.15), transparent)`,
        }}
      />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between" style={{ background: headerGlow }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{
              background: `${accentColor}0.08)`,
              border: `1px solid ${accentColor}0.12)`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M2 6h6M2 9h4" stroke={ghostMode ? "rgba(160,160,160,0.5)" : `${accentColor}0.7)`} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>

          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <span
                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : `${accentColor}0.6)`, fontFamily: "'Inter', sans-serif" }}
              >
                Mission Briefing
              </span>
              {!ghostMode && (
                <span
                  className="text-[7px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                  style={{
                    background: `${accentColor}0.08)`,
                    color: `${accentColor}0.5)`,
                    border: `1px solid ${accentColor}0.1)`,
                  }}
                >
                  {profileBadge[missionProfile]}
                </span>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-[9px] tracking-[0.15em] uppercase mt-0.5"
              style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)", fontFamily: "'Inter', sans-serif" }}
            >
              {dateStr} {"\u00b7"} {timeStr} LOCAL
            </motion.div>
          </div>
        </div>

        {/* Time block indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{ background: `${accentColor}0.06)`, border: `1px solid ${accentColor}0.1)` }}
        >
          <span className="text-[10px]">
            {timeBlock === "morning" ? "\u2600\uFE0F" : timeBlock === "afternoon" ? "\u26A1" : "\uD83C\uDF19"}
          </span>
          <span
            className="text-[8px] font-bold tracking-[0.15em] uppercase"
            style={{ color: `${accentColor}0.6)`, fontFamily: "'Inter', sans-serif" }}
          >
            {timeBlock}
          </span>
        </motion.div>
      </div>

      {/* Divider */}
      <div
        className="mx-4 h-px"
        style={{
          background: ghostMode
            ? "rgba(160,160,160,0.06)"
            : `linear-gradient(90deg, ${accentColor}0.08), rgba(255,255,255,0.03), transparent)`,
        }}
      />

      {/* Greeting — the core content */}
      <div className="px-4 pt-3 pb-3.5">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-[11px] leading-relaxed"
          style={{ color: ghostMode ? "rgba(200,200,200,0.5)" : "rgba(255,255,255,0.55)", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}
        >
          {greeting}{" "}
          <span style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : "rgba(255,255,255,0.75)" }}>
            {activeMsg[missionProfile]}
          </span>
        </motion.p>

        {/* Protocol-specific briefing overlay */}
        <AnimatePresence mode="wait">
          {selectedProtocol && PROTOCOL_BRIEFINGS[selectedProtocol] && (() => {
            const pb = PROTOCOL_BRIEFINGS[selectedProtocol];
            const pColor = ghostMode ? 'rgba(160,160,160,0.5)' : pb.color;
            return (
              <motion.div
                key={selectedProtocol}
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="mt-3 rounded-lg overflow-hidden"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.04)' : `${pb.color}08`,
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${pb.color}20`}`,
                }}
              >
                <div className="p-3">
                  {/* Protocol header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '12px', filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>
                      {pb.icon}
                    </span>
                    <span
                      className="text-[9px] font-bold tracking-[0.15em] uppercase"
                      style={{ color: pColor, fontFamily: "'Inter', sans-serif" }}
                    >
                      {pb.title}
                    </span>
                    <div
                      className="ml-auto text-[7px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${pColor}15`,
                        color: pColor,
                        border: `1px solid ${pColor}30`,
                      }}
                    >
                      Selected
                    </div>
                  </div>
                  {/* Protocol message */}
                  <p
                    className="text-[10px] leading-relaxed"
                    style={{
                      color: ghostMode ? 'rgba(200,200,200,0.5)' : `${pb.color}CC`,
                      fontFamily: "'Inter', sans-serif",
                      lineHeight: 1.65,
                    }}
                  >
                    {pb.message}
                  </p>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Corner accents */}
      {!ghostMode && (
        <>
          <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{ borderTop: `1px solid ${accentColor}0.15)`, borderLeft: `1px solid ${accentColor}0.15)`, borderTopLeftRadius: "12px" }} />
          <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none" style={{ borderTop: `1px solid ${accentColor}0.15)`, borderRight: `1px solid ${accentColor}0.15)`, borderTopRightRadius: "12px" }} />
        </>
      )}
    </motion.div>
  );
}

export default MissionBriefing;
