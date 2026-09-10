import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const WARM = {
  sage: "#7CB68E",
  gold: "#C4A46C",
  sand: "#E8E0D8",
  cardBg: "rgba(26,24,22,0.92)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
  redline: "#FF3B30",
  redlineGlow: "rgba(255,59,48,0.4)",
  criticalRed: "#FF2D20",
  warningAmber: "#FFB020",
  optimal: "#00FFAA",
  optimalGlow: "rgba(0,255,170,0.4)",
};

interface SquadStatusBadgeProps {
  sessionId: string;
}

export function SquadStatusBadge({ sessionId }: SquadStatusBadgeProps) {
  const readiness = useQuery(api.squadReadiness.getSquadReadinessState);
  const votes = useQuery(api.squadReadiness.getSquadModeVotes);
  const castVote = useMutation(api.squadReadiness.castSquadModeVote);

  const [expanded, setExpanded] = useState(false);
  const [voting, setVoting] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);

  // Track user's existing vote
  useEffect(() => {
    if (votes?.voters) {
      const existing = votes.voters.find((v) => v.sessionId === sessionId);
      if (existing) setMyVote(existing.vote);
    }
  }, [votes, sessionId]);

  // Dispatch vignette event for the global red pulse
  useEffect(() => {
    if (!readiness) return;
    window.dispatchEvent(
      new CustomEvent("vive-squad-readiness", {
        detail: {
          isRedline: readiness.isRedlinePulse,
          status: readiness.status,
          averageReadiness: readiness.averageReadiness,
          belowPercent: readiness.belowThresholdPercent,
        },
      })
    );
  }, [readiness?.isRedlinePulse, readiness?.status, readiness?.averageReadiness]);

  const handleVote = useCallback(
    async (vote: string) => {
      setVoting(true);
      try {
        await castVote({ sessionId, vote });
        setMyVote(vote);
      } catch (e) {
        console.error("Vote failed:", e);
      }
      setVoting(false);
    },
    [sessionId, castVote]
  );

  if (!readiness) return null;

  const { status, averageReadiness, totalPeers, belowThresholdCount, belowThresholdPercent, isRedlinePulse, peerBreakdown } = readiness;

  const statusColor =
    status === "critical" ? WARM.criticalRed : status === "warning" ? WARM.warningAmber : WARM.optimal;
  const statusGlow =
    status === "critical" ? WARM.redlineGlow : status === "warning" ? "rgba(255,176,32,0.4)" : WARM.optimalGlow;
  const statusLabel = status === "critical" ? "CRITICAL" : status === "warning" ? "DEGRADED" : "OPTIMAL";
  const statusEmoji = status === "critical" ? "🔴" : status === "warning" ? "🟡" : "🟢";

  // Sort peers: below threshold first
  const sortedPeers = [...peerBreakdown].sort((a, b) => {
    if (a.isBelow && !b.isBelow) return -1;
    if (!a.isBelow && b.isBelow) return 1;
    return a.recovery - b.recovery;
  });

  return (
    <div className="mx-5 mb-4">
      {/* ── Compact Badge (always visible) ── */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded-2xl overflow-hidden relative group active:scale-[0.98] transition-transform duration-150"
        style={{
          background: isRedlinePulse
            ? `linear-gradient(135deg, rgba(255,59,48,0.08) 0%, rgba(180,20,10,0.05) 100%)`
            : "rgba(26,24,22,0.85)",
          border: `1.5px solid ${isRedlinePulse ? "rgba(255,59,48,0.25)" : "rgba(42,38,34,0.6)"}`,
          boxShadow: isRedlinePulse
            ? `0 0 30px rgba(255,59,48,0.08), inset 0 1px 0 rgba(255,255,255,0.03)`
            : "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Pulse overlay for redline state */}
        {isRedlinePulse && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,59,48,0.12) 0%, transparent 60%)",
              animation: "squadPulseGlow 2s ease-in-out infinite",
            }}
          />
        )}

        <div className="relative flex items-center gap-3 px-4 py-3">
          {/* Status indicator */}
          <div className="relative flex-shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `${statusColor}12`,
                border: `1.5px solid ${statusColor}35`,
              }}
            >
              <span className="text-lg">{statusEmoji}</span>
            </div>
            {isRedlinePulse && (
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  border: `2px solid ${statusColor}50`,
                  animation: "squadRingPulse 1.8s ease-out infinite",
                }}
              />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[12px] font-black uppercase tracking-widest"
                style={{
                  color: statusColor,
                  textShadow: `0 0 12px ${statusGlow}`,
                }}
              >
                SQUAD {statusLabel}
              </span>
              {isRedlinePulse && (
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: statusColor,
                    boxShadow: `0 0 6px ${statusGlow}`,
                    animation: "squadDotPulse 1s ease-in-out infinite",
                  }}
                />
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px]" style={{ color: WARM.textSecondary }}>
                Avg Readiness{" "}
                <span className="font-bold tabular-nums" style={{ color: statusColor }}>
                  {averageReadiness}%
                </span>
              </span>
              <span className="text-[9px]" style={{ color: WARM.textDim }}>
                {belowThresholdCount}/{totalPeers} below 60
              </span>
            </div>
          </div>

          {/* Readiness arc mini-gauge */}
          <div className="flex-shrink-0 relative" style={{ width: 36, height: 36 }}>
            <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={statusColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 14}`}
                strokeDashoffset={`${2 * Math.PI * 14 * (1 - averageReadiness / 100)}`}
                style={{
                  transition: "stroke-dashoffset 1s ease, stroke 0.5s",
                  filter: `drop-shadow(0 0 4px ${statusGlow})`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[10px] font-black tabular-nums"
                style={{ color: statusColor }}
              >
                {averageReadiness}
              </span>
            </div>
          </div>

          {/* Expand chevron */}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="flex-shrink-0"
          >
            <span className="text-[10px]" style={{ color: WARM.textDim }}>▾</span>
          </motion.div>
        </div>
      </motion.button>

      {/* ── Expanded Panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-2xl overflow-hidden"
              style={{
                background: WARM.cardBg,
                border: `1px solid ${WARM.cardBorder}`,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <div className="p-4 space-y-3">
                {/* ── Peer Readiness Grid ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: WARM.gold }}>
                      Peer Readiness Breakdown
                    </span>
                    <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </div>

                  <div className="space-y-1.5">
                    {sortedPeers.map((peer) => {
                      const peerColor = peer.isBelow
                        ? peer.recovery < 45
                          ? WARM.criticalRed
                          : WARM.warningAmber
                        : WARM.sage;
                      return (
                        <div
                          key={peer.peerId}
                          className="flex items-center gap-2.5 p-2 rounded-xl"
                          style={{
                            background: peer.isBelow ? "rgba(255,59,48,0.04)" : "rgba(0,0,0,0.2)",
                            border: `1px solid ${peer.isBelow ? "rgba(255,59,48,0.12)" : "rgba(255,255,255,0.03)"}`,
                          }}
                        >
                          {/* Avatar */}
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{
                              background: `${peerColor}15`,
                              border: `1.5px solid ${peerColor}40`,
                              color: WARM.textPrimary,
                            }}
                          >
                            {peer.peerAvatar}
                          </div>

                          {/* Name + handle */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold truncate" style={{ color: WARM.textPrimary }}>
                                {peer.peerName}
                              </span>
                              <span className="text-[9px]" style={{ color: WARM.textDim }}>
                                {peer.peerHandle}
                              </span>
                            </div>
                          </div>

                          {/* Readiness bar */}
                          <div className="w-16 flex-shrink-0">
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${peer.recovery}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full rounded-full"
                                style={{
                                  background: `linear-gradient(90deg, ${peerColor}, ${peerColor}cc)`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Score */}
                          <span
                            className="text-[12px] font-black tabular-nums flex-shrink-0 w-8 text-right"
                            style={{ color: peerColor }}
                          >
                            {peer.recovery}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Squad Mode Vote ── */}
                {isRedlinePulse && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: WARM.gold }}>
                        Squad Mode Vote
                      </span>
                      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                    </div>

                    <p className="text-[10px] mb-2.5 leading-relaxed" style={{ color: WARM.textSecondary }}>
                      Squad readiness is degraded. Vote to shift the collective mode:
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {/* High Output */}
                      <button
                        onClick={() => handleVote("high_output")}
                        disabled={voting}
                        className="p-3 rounded-xl text-left transition-all duration-200 active:scale-[0.97] group"
                        style={{
                          background: myVote === "high_output" ? "rgba(255,176,32,0.10)" : "rgba(255,255,255,0.02)",
                          border: `1.5px solid ${myVote === "high_output" ? "rgba(255,176,32,0.3)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base">{myVote === "high_output" ? "✅" : "⚡"}</span>
                          <span className="text-[11px] font-bold" style={{ color: myVote === "high_output" ? WARM.warningAmber : WARM.textPrimary }}>
                            High Output
                          </span>
                        </div>
                        <p className="text-[9px] leading-relaxed" style={{ color: WARM.textDim }}>
                          Push through — maintain intensity
                        </p>
                        {votes && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: votes.total > 0 ? `${(votes.highOutput / votes.total) * 100}%` : "0%",
                                  background: WARM.warningAmber,
                                  transition: "width 0.5s ease",
                                }}
                              />
                            </div>
                            <span className="text-[8px] tabular-nums" style={{ color: WARM.textDim }}>
                              {votes.highOutput}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Active Recovery */}
                      <button
                        onClick={() => handleVote("active_recovery")}
                        disabled={voting}
                        className="p-3 rounded-xl text-left transition-all duration-200 active:scale-[0.97] group"
                        style={{
                          background: myVote === "active_recovery" ? "rgba(124,182,142,0.10)" : "rgba(255,255,255,0.02)",
                          border: `1.5px solid ${myVote === "active_recovery" ? "rgba(124,182,142,0.3)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base">{myVote === "active_recovery" ? "✅" : "🧘"}</span>
                          <span className="text-[11px] font-bold" style={{ color: myVote === "active_recovery" ? WARM.sage : WARM.textPrimary }}>
                            Active Recovery
                          </span>
                        </div>
                        <p className="text-[9px] leading-relaxed" style={{ color: WARM.textDim }}>
                          Scale back — prioritize restoration
                        </p>
                        {votes && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: votes.total > 0 ? `${(votes.activeRecovery / votes.total) * 100}%` : "0%",
                                  background: WARM.sage,
                                  transition: "width 0.5s ease",
                                }}
                              />
                            </div>
                            <span className="text-[8px] tabular-nums" style={{ color: WARM.textDim }}>
                              {votes.activeRecovery}
                            </span>
                          </div>
                        )}
                      </button>
                    </div>

                    {votes && votes.total > 0 && (
                      <div className="mt-2 text-center">
                        <span className="text-[9px]" style={{ color: WARM.textDim }}>
                          Current consensus:{" "}
                          <span className="font-bold" style={{ color: votes.winningMode === "active_recovery" ? WARM.sage : WARM.warningAmber }}>
                            {votes.winningMode === "active_recovery" ? "Active Recovery" : "High Output"}
                          </span>
                          {" "}({votes.total} vote{votes.total !== 1 ? "s" : ""})
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Recommendation ── */}
                <div
                  className="p-3 rounded-xl flex items-start gap-2.5"
                  style={{
                    background: isRedlinePulse ? "rgba(255,59,48,0.04)" : "rgba(124,182,142,0.04)",
                    border: `1px solid ${isRedlinePulse ? "rgba(255,59,48,0.12)" : "rgba(124,182,142,0.12)"}`,
                  }}
                >
                  <span className="text-sm mt-0.5">{isRedlinePulse ? "🧬" : "✨"}</span>
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: isRedlinePulse ? WARM.warningAmber : WARM.sage }}>
                      {isRedlinePulse ? "SQUAD RECOVERY RECOMMENDED" : "SQUAD PERFORMING WELL"}
                    </span>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: WARM.textSecondary }}>
                      {isRedlinePulse
                        ? `${belowThresholdPercent}% of the squad is below readiness threshold. Consider shifting to active recovery protocols — breathwork, hydration, and sleep optimization.`
                        : `All systems nominal. Squad readiness averaging ${averageReadiness}%. Continue current protocols and maintain momentum.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes squadPulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes squadRingPulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes squadDotPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
