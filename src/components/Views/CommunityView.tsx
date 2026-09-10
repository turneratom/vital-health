import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

/* ── Tier Config ── */
const tierConfig = {
  apex: { label: "Apex", color: "#FFD700", glow: "rgba(255,215,0,0.3)", border: "rgba(255,215,0,0.4)", bg: "rgba(255,215,0,0.06)" },
  titan: { label: "Titan", color: "#AF82FF", glow: "rgba(175,130,255,0.25)", border: "rgba(175,130,255,0.3)", bg: "rgba(175,130,255,0.06)" },
  vanguard: { label: "Vanguard", color: "#00FFCC", glow: "rgba(0,255,204,0.2)", border: "rgba(0,255,204,0.25)", bg: "rgba(0,255,204,0.06)" },
};

/* ── Global Baselines ── */
const globalBaselines = [
  { label: "Avg HRV", value: "65ms", userValue: "82ms", delta: "+26%", positive: true },
  { label: "Avg Recovery", value: "72/100", userValue: "84/100", delta: "+17%", positive: true },
  { label: "Avg Adherence", value: "74%", userValue: "88%", delta: "+19%", positive: true },
  { label: "Avg RHR", value: "62 bpm", userValue: "56 bpm", delta: "-10%", positive: true },
];

/* ── Animated Ring Component ── */
function MiniRing({
  value,
  max,
  size = 48,
  ghostMode,
  label,
  colorFn,
}: {
  value: number;
  max: number;
  size?: number;
  ghostMode: boolean;
  label: string;
  colorFn: (v: number, gm: boolean) => string;
}) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnim(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const sw = 3.5;
  const r = (size - sw * 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(anim / max, 1);
  const offset = c - pct * c;
  const center = size / 2;
  const color = colorFn(anim, ghostMode);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}
          strokeWidth={sw}
        />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={color} strokeWidth={sw + 2} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          opacity={0.2}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)", filter: "blur(3px)" }}
        />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color, textShadow: ghostMode ? "none" : `0 0 6px ${color}44` }}>
          {label === "Strain" ? anim.toFixed(1) : `${Math.round(anim)}%`}
        </span>
        <span className="text-[5px] font-mono uppercase tracking-wider" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

const recoveryColor = (v: number, gm: boolean) => {
  if (v >= 85) return gm ? "rgba(160,160,160,0.6)" : "#00FFCC";
  if (v >= 70) return gm ? "rgba(160,160,160,0.5)" : "#6B8AFF";
  return gm ? "rgba(160,160,160,0.4)" : "#FFB86B";
};

const strainColor = (v: number, gm: boolean) => {
  if (v >= 14) return gm ? "rgba(160,160,160,0.6)" : "#FF6B6B";
  if (v >= 8) return gm ? "rgba(160,160,160,0.5)" : "#FFB86B";
  return gm ? "rgba(160,160,160,0.4)" : "#00FFCC";
};

/* ── Apex Crown SVG Badge ── */
function ApexBadge({ size = 14, ghostMode }: { size?: number; ghostMode: boolean }) {
  const color = ghostMode ? "rgba(200,200,200,0.5)" : "#FFD700";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={color}
        opacity={ghostMode ? 0.4 : 0.9}
        style={{ filter: ghostMode ? "none" : `drop-shadow(0 0 4px rgba(255,215,0,0.5))` }}
      />
    </svg>
  );
}

export function CommunityView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "squad">("leaderboard");
  const [nudgedPeers, setNudgedPeers] = useState<Set<string>>(new Set());

  const neon = ghostMode ? "rgba(160,160,160," : "rgba(0,255,204,";
  const purple = ghostMode ? "rgba(160,160,160," : "rgba(175,130,255,";

  // ── Shipper Cloud: Leaderboard ──
  const leaderboardRaw = useQuery(api.leaderboard.listLeaderboard);
  const seedLeaderboard = useMutation(api.leaderboard.seedLeaderboard);

  // ── Shipper Cloud: Peers (Squad) ──
  const peers = useQuery(api.peers.listPeers);
  const seedPeers = useMutation(api.peers.seedPeers);
  const nudgePeerMutation = useMutation(api.peers.nudgePeer);

  // Auto-seed leaderboard
  useEffect(() => {
    if (leaderboardRaw && leaderboardRaw.length === 0) {
      seedLeaderboard();
    }
  }, [leaderboardRaw, seedLeaderboard]);

  // Auto-seed peers
  useEffect(() => {
    if (peers && peers.length === 0) {
      seedPeers();
    }
  }, [peers, seedPeers]);

  const handleNudge = useCallback(async (peerId: string) => {
    if (nudgedPeers.has(peerId)) return;
    setNudgedPeers((prev) => new Set(prev).add(peerId));
    try {
      await nudgePeerMutation({ id: peerId as any });
    } catch {
      // silently handle
    }
    setTimeout(() => {
      setNudgedPeers((prev) => {
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
    }, 3000);
  }, [nudgedPeers, nudgePeerMutation]);

  // Map leaderboard data with ranks
  const leaderboardData = (leaderboardRaw ?? []).map((u, i) => ({
    ...u,
    rank: i + 1,
    tier: u.tier as "apex" | "titan" | "vanguard",
  }));

  // Squad data from Shipper Cloud
  const squadData = peers && peers.length > 0
    ? peers.map((p) => ({
        id: p._id as string,
        name: p.name,
        avatar: p.avatar,
        handle: p.handle,
        recovery: p.recovery,
        strain: p.strain,
        hrv: p.hrv,
        tier: p.tier as "apex" | "titan" | "vanguard",
        status: p.status as "active" | "resting",
        lastActive: p.lastActive,
        nudgedAt: p.nudgedAt,
      }))
    : [];

  // Compute squad averages for AI insight
  const squadHrvAvg = squadData.length > 0
    ? Math.round(squadData.reduce((s, p) => s + p.hrv, 0) / squadData.length)
    : 65;
  const userHrv = 82;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: ghostMode
                ? "rgba(160,160,160,0.08)"
                : "linear-gradient(135deg, rgba(175,130,255,0.15), rgba(0,255,204,0.15))",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : "rgba(175,130,255,0.2)"}`,
            }}
          >
            <span style={{ fontSize: 16 }}>⬡</span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-light tracking-tight"
            style={{ color: ghostMode ? "rgba(220,220,220,0.8)" : "rgba(255,255,255,0.9)" }}
          >
            The Elite Network
          </h1>
        </div>
        <p
          className="text-xs font-mono uppercase tracking-[0.2em] text-center"
          style={{ color: `${neon}0.4)` }}
        >
          Compete · Compare · Evolve
        </p>
      </motion.div>

      {/* ── AI Insight Bot Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: ghostMode ? "rgba(20,20,20,0.6)" : "rgba(10,8,20,0.7)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(175,130,255,0.15)"}`,
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: ghostMode
              ? "linear-gradient(90deg, transparent, rgba(160,160,160,0.3), transparent)"
              : "linear-gradient(90deg, transparent, #AF82FF, #00FFCC, transparent)",
          }}
        />
        <div className="px-5 py-4 flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              background: ghostMode
                ? "rgba(160,160,160,0.08)"
                : "linear-gradient(135deg, rgba(175,130,255,0.2), rgba(0,255,204,0.15))",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(175,130,255,0.2)"}`,
            }}
          >
            <span className="text-sm" style={{ animation: "pulse 3s ease-in-out infinite" }}>🧠</span>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono uppercase tracking-wider font-semibold"
                style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(175,130,255,0.7)" }}
              >
                Vive Brain · Squad Insight
              </span>
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: ghostMode ? "rgba(160,160,160,0.4)" : "#00FFCC",
                  boxShadow: ghostMode ? "none" : "0 0 6px rgba(0,255,204,0.5)",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
            </div>
            <p
              className="text-sm font-light leading-relaxed"
              style={{ color: ghostMode ? "rgba(200,200,200,0.6)" : "rgba(255,255,255,0.75)" }}
            >
              Your Squad{"'"}s average HRV is{" "}
              <span className="font-semibold" style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : "#6B8AFF" }}>{squadHrvAvg}ms</span>{" "}
              today. You{"'"}re leading the pack at{" "}
              <span className="font-semibold" style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : "#00FFCC" }}>{userHrv}ms</span>
              ! Your recovery protocols are paying off — keep the consistency.
            </p>
            <div className="flex items-center gap-2 mt-1">
              {["❤️ HRV", "🏃 Strain", "💊 Protocols"].map((src) => (
                <span
                  key={src}
                  className="text-[8px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(175,130,255,0.08)",
                    color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(175,130,255,0.5)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(175,130,255,0.12)"}`,
                  }}
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Global Baselines ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {globalBaselines.map((b) => (
          <div
            key={b.label}
            className="rounded-xl px-4 py-3 flex flex-col gap-2"
            style={{
              background: ghostMode ? "rgba(20,20,20,0.5)" : "rgba(10,8,20,0.5)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(175,130,255,0.1)"}`,
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.35)` }}>
              {b.label}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-mono" style={{ color: `${neon}0.3)` }}>Global</span>
                <span className="text-sm font-mono font-semibold" style={{ color: ghostMode ? "rgba(200,200,200,0.5)" : "rgba(255,255,255,0.5)" }}>
                  {b.value}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-mono" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(0,255,204,0.4)" }}>You</span>
                <span className="text-sm font-mono font-bold" style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : "#00FFCC" }}>
                  {b.userValue}
                </span>
                <span
                  className="text-[10px] font-mono font-semibold"
                  style={{ color: b.positive ? (ghostMode ? "rgba(100,200,100,0.6)" : "#34D399") : "#FF6B6B" }}
                >
                  {b.delta}
                </span>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Tab Switcher ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1 p-1 rounded-xl mx-auto"
        style={{
          background: ghostMode ? "rgba(20,20,20,0.5)" : "rgba(10,8,20,0.5)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(175,130,255,0.08)"}`,
        }}
      >
        {(["leaderboard", "squad"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all duration-300"
            style={{
              background: activeTab === tab
                ? ghostMode ? "rgba(160,160,160,0.1)" : "rgba(175,130,255,0.12)"
                : "transparent",
              color: activeTab === tab
                ? ghostMode ? "rgba(200,200,200,0.7)" : "rgba(175,130,255,0.8)"
                : `${neon}0.35)`,
              border: activeTab === tab
                ? `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(175,130,255,0.2)"}`
                : "1px solid transparent",
            }}
          >
            {tab === "leaderboard" ? "Global Leaderboard" : "Squad Support"}
          </button>
        ))}
      </motion.div>

      {/* ── Content Area ── */}
      <AnimatePresence mode="wait">
        {activeTab === "leaderboard" && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-2"
          >
            {/* Leaderboard Header */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>Rank</span>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.06)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.12)"}`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: ghostMode ? "rgba(100,200,100,0.5)" : "#34D399",
                      boxShadow: ghostMode ? "none" : "0 0 4px rgba(52,211,153,0.5)",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                  />
                  <span className="text-[8px] font-mono" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(52,211,153,0.7)" }}>
                    Live via Shipper Cloud
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>Vive Score</span>
                <span className="text-[9px] font-mono uppercase tracking-wider w-16 text-right" style={{ color: `${neon}0.3)` }}>Tier</span>
              </div>
            </div>

            {/* Loading state */}
            {!leaderboardRaw && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: ghostMode ? "rgba(160,160,160,0.2)" : "rgba(175,130,255,0.3)", borderTopColor: "transparent" }}
                  />
                  <span className="text-xs font-mono" style={{ color: `${purple}0.5)` }}>Loading leaderboard...</span>
                </div>
              </div>
            )}

            {/* Leaderboard Rows */}
            {leaderboardData.map((user, i) => {
              const tc = tierConfig[user.tier] || tierConfig.vanguard;
              const isExpanded = expandedRow === i;
              const isApex = user.tier === "apex";
              const isUser = user.isCurrentUser;

              return (
                <motion.div
                  key={user._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <button
                    onClick={() => setExpandedRow(isExpanded ? null : i)}
                    className="w-full rounded-xl overflow-hidden transition-all duration-300"
                    style={{
                      background: isUser
                        ? ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.06)"
                        : ghostMode ? "rgba(20,20,20,0.4)" : "rgba(10,8,20,0.4)",
                      border: isUser
                        ? `1.5px solid ${ghostMode ? "rgba(160,160,160,0.25)" : "rgba(0,255,204,0.35)"}`
                        : `1px solid ${
                            isApex && !ghostMode
                              ? "rgba(255,215,0,0.15)"
                              : ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"
                          }`,
                      boxShadow: isUser && !ghostMode
                        ? "0 0 24px rgba(0,255,204,0.12), 0 0 48px rgba(0,255,204,0.04), inset 0 0 20px rgba(0,255,204,0.03)"
                        : isApex && !ghostMode
                          ? `0 0 20px ${tc.glow}, inset 0 0 20px rgba(255,215,0,0.03)`
                          : "none",
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Rank number */}
                        <div className="flex flex-col items-center w-7">
                          <span
                            className="text-sm font-mono font-bold tabular-nums"
                            style={{
                              color: user.rank <= 3
                                ? (ghostMode ? "rgba(200,200,200,0.7)" : tc.color)
                                : `${neon}0.4)`,
                            }}
                          >
                            {user.rank}
                          </span>
                          {user.rank <= 3 && (
                            <div
                              className="w-4 h-[2px] rounded-full mt-0.5"
                              style={{
                                background: ghostMode ? "rgba(160,160,160,0.2)" : `${tc.color}44`,
                              }}
                            />
                          )}
                        </div>

                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center relative"
                          style={{
                            background: ghostMode ? "rgba(160,160,160,0.1)" : `linear-gradient(135deg, ${tc.color}22, ${tc.color}11)`,
                            border: `1.5px solid ${ghostMode ? "rgba(160,160,160,0.15)" : tc.border}`,
                            boxShadow: isApex && !ghostMode ? `0 0 14px ${tc.glow}` : "none",
                          }}
                        >
                          <span className="text-[10px] font-mono font-bold" style={{ color: ghostMode ? "rgba(200,200,200,0.6)" : tc.color }}>
                            {user.avatar}
                          </span>
                          {isApex && (
                            <div className="absolute -top-1.5 -right-1.5">
                              <ApexBadge size={14} ghostMode={ghostMode} />
                            </div>
                          )}
                        </div>

                        {/* Name & Handle */}
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: isUser
                                  ? ghostMode ? "rgba(200,200,200,0.9)" : "#00FFCC"
                                  : ghostMode ? "rgba(200,200,200,0.7)" : "rgba(255,255,255,0.8)",
                                textShadow: isUser && !ghostMode ? "0 0 10px rgba(0,255,204,0.3)" : "none",
                              }}
                            >
                              {user.name}
                            </span>
                            {isUser && (
                              <span
                                className="text-[7px] font-mono uppercase px-1.5 py-0.5 rounded-full font-bold"
                                style={{
                                  background: ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.12)",
                                  color: ghostMode ? "rgba(160,160,160,0.5)" : "#00FFCC",
                                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(0,255,204,0.25)"}`,
                                  boxShadow: ghostMode ? "none" : "0 0 8px rgba(0,255,204,0.15)",
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: `${neon}0.25)` }}>{user.handle}</span>
                        </div>
                      </div>

                      {/* Score & Tier */}
                      <div className="flex items-center gap-5">
                        <div className="flex flex-col items-end">
                          <span
                            className="text-lg font-mono font-bold tabular-nums"
                            style={{
                              color: isUser && !ghostMode ? "#00FFCC" : ghostMode ? "rgba(200,200,200,0.7)" : tc.color,
                              textShadow: (isApex || isUser) && !ghostMode ? `0 0 10px ${isUser ? "rgba(0,255,204,0.4)" : tc.glow}` : "none",
                            }}
                          >
                            {user.adherence}%
                          </span>
                          <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.25)` }}>
                            Adherence
                          </span>
                        </div>
                        <div
                          className="px-2.5 py-1 rounded-full w-20 text-center"
                          style={{
                            background: ghostMode ? "rgba(160,160,160,0.06)" : tc.bg,
                            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : tc.border}`,
                          }}
                        >
                          <span className="text-[9px] font-mono uppercase tracking-wider font-semibold" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : tc.color }}>
                            {tc.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="px-4 pb-4 pt-2"
                            style={{ borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}` }}
                          >
                            <div className="flex items-center justify-around">
                              <MiniRing value={user.recovery} max={100} ghostMode={ghostMode} label="Recovery" colorFn={recoveryColor} />
                              <MiniRing value={user.strain} max={21} ghostMode={ghostMode} label="Strain" colorFn={strainColor} />
                              <div
                                className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl"
                                style={{
                                  background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(107,138,255,0.06)",
                                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(107,138,255,0.1)"}`,
                                }}
                              >
                                <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>HRV</span>
                                <span
                                  className="text-lg font-mono font-bold tabular-nums"
                                  style={{
                                    color: ghostMode ? "rgba(200,200,200,0.6)" : "#6B8AFF",
                                    textShadow: ghostMode ? "none" : "0 0 10px rgba(107,138,255,0.3)",
                                  }}
                                >
                                  {user.hrv}
                                </span>
                                <span className="text-[7px] font-mono" style={{ color: `${neon}0.25)` }}>ms</span>
                              </div>
                            </div>
                            {/* Adherence bar */}
                            <div className="mt-3 px-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>Vive Adherence</span>
                                <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? "rgba(200,200,200,0.5)" : tc.color }}>
                                  {user.adherence}/100
                                </span>
                              </div>
                              <div
                                className="h-1.5 rounded-full overflow-hidden"
                                style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)" }}
                              >
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${user.adherence}%` }}
                                  transition={{ duration: 0.8, delay: 0.2 }}
                                  className="h-full rounded-full"
                                  style={{
                                    background: isUser && !ghostMode
                                      ? "linear-gradient(90deg, #00FFCC, #6B8AFF)"
                                      : ghostMode
                                        ? "rgba(160,160,160,0.3)"
                                        : `linear-gradient(90deg, ${tc.color}88, ${tc.color})`,
                                    boxShadow: ghostMode ? "none" : `0 0 8px ${isUser ? "rgba(0,255,204,0.3)" : tc.glow}`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </motion.div>
              );
            })}

            {/* Leaderboard footer */}
            {leaderboardData.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-center gap-2 py-3"
              >
                <span className="text-[9px] font-mono" style={{ color: `${neon}0.25)` }}>
                  Ranked by Vive Adherence Score · Updated in real-time
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === "squad" && (
          <motion.div
            key="squad"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5"
          >
            {/* Squad Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: `${purple}0.6)` }}>
                  Squad Support
                </span>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.06)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.12)"}`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: ghostMode ? "rgba(100,200,100,0.5)" : "#34D399",
                      boxShadow: ghostMode ? "none" : "0 0 4px rgba(52,211,153,0.5)",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                  />
                  <span className="text-[9px] font-mono" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(52,211,153,0.7)" }}>
                    Live via Shipper Cloud
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono" style={{ color: `${neon}0.3)` }}>
                {squadData.length} peers syncing
              </span>
            </div>

            {/* Loading state */}
            {!peers && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: ghostMode ? "rgba(160,160,160,0.2)" : "rgba(175,130,255,0.3)", borderTopColor: "transparent" }}
                  />
                  <span className="text-xs font-mono" style={{ color: `${purple}0.5)` }}>Loading squad...</span>
                </div>
              </div>
            )}

            {/* ── Peer Cards ── */}
            {squadData.map((member, i) => {
              const tc = tierConfig[member.tier] || tierConfig.vanguard;
              const isActive = member.status === "active";
              const isNudged = nudgedPeers.has(member.id);

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    x: isNudged ? [0, -4, 4, -3, 3, -1, 1, 0] : 0,
                  }}
                  transition={{
                    opacity: { delay: i * 0.1, duration: 0.4 },
                    y: { delay: i * 0.1, duration: 0.4 },
                    x: isNudged ? { duration: 0.5, ease: "easeInOut" } : {},
                  }}
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    background: ghostMode ? "rgba(20,20,20,0.5)" : "rgba(10,8,20,0.5)",
                    border: `1px solid ${
                      isNudged
                        ? ghostMode ? "rgba(160,160,160,0.3)" : "rgba(175,130,255,0.4)"
                        : ghostMode ? "rgba(160,160,160,0.06)" : "rgba(175,130,255,0.1)"
                    }`,
                    backdropFilter: "blur(16px)",
                    boxShadow: isNudged && !ghostMode
                      ? "0 0 30px rgba(175,130,255,0.15), 0 0 60px rgba(0,255,204,0.05)"
                      : "none",
                    transition: "border-color 0.3s, box-shadow 0.3s",
                  }}
                >
                  {/* Nudge pulse overlay */}
                  <AnimatePresence>
                    {isNudged && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.15, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, repeat: 1 }}
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{
                          background: ghostMode
                            ? "rgba(160,160,160,0.1)"
                            : "linear-gradient(135deg, rgba(175,130,255,0.15), rgba(0,255,204,0.1))",
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Top accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[1px]"
                    style={{
                      background: ghostMode
                        ? "linear-gradient(90deg, transparent, rgba(160,160,160,0.15), transparent)"
                        : `linear-gradient(90deg, transparent, ${tc.color}44, transparent)`,
                    }}
                  />

                  <div className="px-5 py-5">
                    {/* Row 1: Avatar + Name + Status + Nudge */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center"
                          style={{
                            background: ghostMode
                              ? "rgba(160,160,160,0.1)"
                              : `linear-gradient(135deg, ${tc.color}22, ${tc.color}11)`,
                            border: `2px solid ${ghostMode ? "rgba(160,160,160,0.15)" : tc.border}`,
                            boxShadow: member.tier === "apex" && !ghostMode ? `0 0 18px ${tc.glow}` : "none",
                          }}
                        >
                          <span
                            className="text-sm font-mono font-bold"
                            style={{ color: ghostMode ? "rgba(200,200,200,0.6)" : tc.color }}
                          >
                            {member.avatar}
                          </span>
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2"
                          style={{
                            background: isActive
                              ? ghostMode ? "rgba(100,200,100,0.6)" : "#34D399"
                              : ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,184,107,0.6)",
                            borderColor: ghostMode ? "#0a0a0a" : "#050505",
                            boxShadow: isActive && !ghostMode ? "0 0 6px rgba(52,211,153,0.5)" : "none",
                          }}
                        />
                        {member.tier === "apex" && (
                          <div className="absolute -top-1.5 -right-1.5">
                            <ApexBadge size={16} ghostMode={ghostMode} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: ghostMode ? "rgba(200,200,200,0.8)" : "rgba(255,255,255,0.9)" }}
                          >
                            {member.name}
                          </span>
                          <span
                            className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full"
                            style={{
                              background: ghostMode ? "rgba(160,160,160,0.06)" : tc.bg,
                              color: ghostMode ? "rgba(160,160,160,0.4)" : tc.color,
                              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : tc.border}`,
                            }}
                          >
                            {tc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono" style={{ color: `${neon}0.3)` }}>{member.handle}</span>
                          <span className="text-[9px]" style={{ color: `${neon}0.2)` }}>·</span>
                          <span
                            className="text-[9px] font-mono"
                            style={{ color: isActive ? (ghostMode ? "rgba(100,200,100,0.5)" : "rgba(52,211,153,0.6)") : `${neon}0.25)` }}
                          >
                            {isActive ? "Active now" : member.lastActive}
                          </span>
                        </div>
                      </div>

                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNudge(member.id);
                        }}
                        whileTap={{ scale: 0.9 }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-300"
                        style={{
                          background: isNudged
                            ? ghostMode ? "rgba(100,200,100,0.1)" : "rgba(0,255,204,0.1)"
                            : ghostMode ? "rgba(160,160,160,0.06)" : "rgba(175,130,255,0.08)",
                          border: `1px solid ${
                            isNudged
                              ? ghostMode ? "rgba(100,200,100,0.2)" : "rgba(0,255,204,0.25)"
                              : ghostMode ? "rgba(160,160,160,0.1)" : "rgba(175,130,255,0.15)"
                          }`,
                          boxShadow: isNudged && !ghostMode ? "0 0 12px rgba(0,255,204,0.15)" : "none",
                        }}
                      >
                        <motion.span
                          animate={isNudged ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
                          transition={{ duration: 0.5 }}
                          style={{ fontSize: 13 }}
                        >
                          {isNudged ? "✨" : "👋"}
                        </motion.span>
                        <span
                          className="text-[10px] font-mono uppercase tracking-wider font-semibold"
                          style={{
                            color: isNudged
                              ? ghostMode ? "rgba(100,200,100,0.6)" : "#00FFCC"
                              : ghostMode ? "rgba(160,160,160,0.5)" : "rgba(175,130,255,0.7)",
                          }}
                        >
                          {isNudged ? "Sent!" : "Nudge"}
                        </span>
                      </motion.button>
                    </div>

                    {/* Row 2: Recovery Ring + Strain Ring + HRV stat + 7d Trend */}
                    <div className="flex items-center justify-between">
                      <MiniRing value={member.recovery} max={100} size={56} ghostMode={ghostMode} label="Recovery" colorFn={recoveryColor} />
                      <MiniRing value={member.strain} max={21} size={56} ghostMode={ghostMode} label="Strain" colorFn={strainColor} />

                      <div
                        className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl"
                        style={{
                          background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(107,138,255,0.06)",
                          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(107,138,255,0.1)"}`,
                        }}
                      >
                        <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>HRV</span>
                        <span
                          className="text-lg font-mono font-bold tabular-nums"
                          style={{
                            color: ghostMode ? "rgba(200,200,200,0.6)" : "#6B8AFF",
                            textShadow: ghostMode ? "none" : "0 0 10px rgba(107,138,255,0.3)",
                          }}
                        >
                          {member.hrv}
                        </span>
                        <span className="text-[7px] font-mono" style={{ color: `${neon}0.25)` }}>ms</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>7d Trend</span>
                        <div className="flex items-end gap-[3px] h-8">
                          {[65, 72, 68, 80, 75, 82, member.recovery].map((val, j) => (
                            <motion.div
                              key={j}
                              initial={{ height: 0 }}
                              animate={{ height: `${(val / 100) * 28}px` }}
                              transition={{ delay: 0.3 + j * 0.05, duration: 0.4 }}
                              className="w-[4px] rounded-full"
                              style={{
                                background: j === 6
                                  ? ghostMode ? "rgba(160,160,160,0.5)" : "#00FFCC"
                                  : ghostMode ? "rgba(160,160,160,0.15)" : "rgba(175,130,255,0.25)",
                                boxShadow: j === 6 && !ghostMode ? "0 0 4px rgba(0,255,204,0.3)" : "none",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Share My Progress Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center mt-3"
            >
              <button
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl transition-all duration-300 active:scale-95"
                style={{
                  background: ghostMode
                    ? "rgba(160,160,160,0.06)"
                    : "linear-gradient(135deg, rgba(175,130,255,0.12), rgba(0,255,204,0.08))",
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : "rgba(175,130,255,0.2)"}`,
                  boxShadow: ghostMode ? "none" : "0 0 20px rgba(175,130,255,0.08)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(160,160,160,0.5)" : "#AF82FF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                <span
                  className="text-xs font-mono uppercase tracking-wider font-semibold"
                  style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(175,130,255,0.8)" }}
                >
                  Share My Progress
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  );
}
