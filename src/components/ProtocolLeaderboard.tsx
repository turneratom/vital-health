import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getSessionId } from '@/components/Presence/usePresenceState';

/* ══════════════════════════════════════════════════════════════════════
   PROTOCOL LEADERBOARD
   
   Real-time stack-ranked list of active users based on Intensity Score.
   
   Intensity Score = f(HR, Duration, Protocol Active):
     - HR Zone Points: Maps HR to training zones (Z1-Z5)
     - Duration Multiplier: Longer sessions = higher score (diminishing returns)
     - Protocol Bonus: Active protocol execution adds 20% bonus
     - HRV Penalty/Bonus: Low HRV = fatigue penalty, High HRV = efficiency bonus
   
   Rank changes trigger local "Rank Up" toast notifications.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Intensity Score Calculation ── */
interface IntensityInput {
  heartRate?: number;
  hrv?: number;
  activeProtocol?: string;
  lastSeen: number;
  isDeepWork?: boolean;
}

function computeIntensityScore(input: IntensityInput): number {
  const hr = input.heartRate ?? 65;
  const hrv = input.hrv ?? 55;
  const hasProtocol = !!input.activeProtocol;

  // HR Zone Points (0-50 base)
  // Z1: <110 = 5-15pts, Z2: 110-130 = 15-25pts, Z3: 130-150 = 25-35pts
  // Z4: 150-170 = 35-45pts, Z5: >170 = 45-50pts
  let hrPoints: number;
  if (hr < 60) hrPoints = 2;
  else if (hr < 110) hrPoints = 5 + ((hr - 60) / 50) * 10;
  else if (hr < 130) hrPoints = 15 + ((hr - 110) / 20) * 10;
  else if (hr < 150) hrPoints = 25 + ((hr - 130) / 20) * 10;
  else if (hr < 170) hrPoints = 35 + ((hr - 150) / 20) * 10;
  else hrPoints = 45 + Math.min(5, (hr - 170) / 10);

  // Duration multiplier — time since last seen as proxy for session length
  // Caps at 30 minutes of sustained activity
  const sessionMs = Date.now() - input.lastSeen;
  const sessionMin = Math.max(0, 30 - sessionMs / 60000); // Inverted: recent = longer session
  const durationMul = 0.5 + Math.min(1.5, sessionMin / 20); // 0.5x to 2.0x

  // Protocol bonus: +20% when actively executing a protocol
  const protocolBonus = hasProtocol ? 1.2 : 1.0;

  // HRV efficiency modifier: high HRV = training efficiently
  // Maps HRV 20-100 to 0.85-1.15 multiplier
  const hrvMod = 0.85 + Math.min(0.3, Math.max(0, (hrv - 20) / 80) * 0.3);

  // Deep work bonus — sustained focus adds a small bonus
  const focusBonus = input.isDeepWork ? 1.08 : 1.0;

  const raw = hrPoints * durationMul * protocolBonus * hrvMod * focusBonus;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/* ── HR Zone label + color ── */
function getHRZone(hr: number): { zone: string; color: string; bg: string } {
  if (hr < 110) return { zone: 'Z1', color: '#6B8AFF', bg: 'rgba(107,138,255,0.12)' };
  if (hr < 130) return { zone: 'Z2', color: '#00CCAA', bg: 'rgba(0,204,170,0.12)' };
  if (hr < 150) return { zone: 'Z3', color: '#FFB86B', bg: 'rgba(255,184,107,0.12)' };
  if (hr < 170) return { zone: 'Z4', color: '#FF6B4A', bg: 'rgba(255,107,74,0.12)' };
  return { zone: 'Z5', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)' };
}

/* ── Tier badge from score ── */
function getTier(score: number): { label: string; color: string; glow: string } {
  if (score >= 85) return { label: 'ELITE', color: '#FFD700', glow: 'rgba(255,215,0,0.4)' };
  if (score >= 65) return { label: 'APEX', color: '#00FFCC', glow: 'rgba(0,255,204,0.3)' };
  if (score >= 45) return { label: 'PRIME', color: '#6B8AFF', glow: 'rgba(107,138,255,0.3)' };
  if (score >= 25) return { label: 'BASE', color: '#FFB86B', glow: 'rgba(255,184,107,0.3)' };
  return { label: 'IDLE', color: 'rgba(255,255,255,0.3)', glow: 'rgba(255,255,255,0.1)' };
}

/* ── Rank change indicator ── */
function RankDelta({ delta }: { delta: number }) {
  if (delta === 0) return (
    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace' }}>—</span>
  );
  if (delta > 0) return (
    <span style={{
      color: '#00FFAA', fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
      textShadow: '0 0 6px rgba(0,255,170,0.5)',
      animation: 'rankUpFlash 0.6s ease',
    }}>
      ▲{delta}
    </span>
  );
  return (
    <span style={{
      color: '#FF6B6B', fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
      opacity: 0.7,
    }}>
      ▼{Math.abs(delta)}
    </span>
  );
}

/* ── Rank Up Toast Notification ── */
interface RankToast {
  id: string;
  message: string;
  fromRank: number;
  toRank: number;
  timestamp: number;
}

function RankUpToast({ toast, onDismiss }: { toast: RankToast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      top: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99998,
      padding: '10px 20px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(0,255,170,0.15) 0%, rgba(0,200,140,0.08) 100%)',
      border: '1px solid rgba(0,255,170,0.3)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,170,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      animation: 'toastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      pointerEvents: 'auto',
    }}>
      {/* Rank badge */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(0,255,170,0.25), rgba(0,200,140,0.1))',
        border: '1px solid rgba(0,255,170,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: '#00FFAA',
        fontFamily: 'monospace',
        textShadow: '0 0 8px rgba(0,255,170,0.6)',
      }}>
        #{toast.toRank}
      </div>
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#00FFAA',
          fontFamily: 'monospace', letterSpacing: '0.05em',
          textShadow: '0 0 6px rgba(0,255,170,0.4)',
        }}>
          RANK UP
        </div>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,0.5)',
          fontFamily: 'monospace',
        }}>
          {toast.message}
        </div>
      </div>
      {/* Sparkle icon */}
      <div style={{ fontSize: 16, marginLeft: 4 }}>✦</div>
    </div>
  );
}

/* ── Intensity Bar ── */
function IntensityBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{
      width: '100%', height: 3, borderRadius: 2,
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        width: `${score}%`,
        height: '100%',
        borderRadius: 2,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 8px ${color}44`,
        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  );
}

/* ── Leaderboard Entry Row ── */
interface LeaderboardEntry {
  sessionId: string;
  displayName: string;
  avatar: string;
  intensityScore: number;
  heartRate: number;
  hrv: number;
  activeProtocol?: string;
  rank: number;
  prevRank: number;
  isCurrentUser: boolean;
  isDeepWork?: boolean;
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const hrZone = getHRZone(entry.heartRate);
  const tier = getTier(entry.intensityScore);
  const rankDelta = entry.prevRank - entry.rank; // positive = moved up

  const isTop3 = entry.rank <= 3;
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 10,
      background: entry.isCurrentUser
        ? 'linear-gradient(135deg, rgba(0,255,204,0.06) 0%, rgba(0,200,160,0.03) 100%)'
        : 'rgba(255,255,255,0.015)',
      border: entry.isCurrentUser
        ? '1px solid rgba(0,255,204,0.15)'
        : '1px solid rgba(255,255,255,0.04)',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      animation: `rowSlideIn ${0.3 + index * 0.05}s ease both`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Current user indicator line */}
      {entry.isCurrentUser && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
          background: '#00FFCC',
          boxShadow: '0 0 8px rgba(0,255,204,0.5)',
          borderRadius: '2px 0 0 2px',
        }} />
      )}

      {/* Rank number */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
        color: isTop3 ? rankColors[entry.rank - 1] : 'rgba(255,255,255,0.4)',
        background: isTop3
          ? `rgba(${entry.rank === 1 ? '255,215,0' : entry.rank === 2 ? '192,192,192' : '205,127,50'},0.1)`
          : 'rgba(255,255,255,0.04)',
        border: isTop3
          ? `1px solid ${rankColors[entry.rank - 1]}33`
          : '1px solid rgba(255,255,255,0.06)',
        textShadow: isTop3 ? `0 0 6px ${rankColors[entry.rank - 1]}66` : 'none',
        flexShrink: 0,
      }}>
        {entry.rank}
      </div>

      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}08)`,
        border: `1.5px solid ${tier.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
        flexShrink: 0,
        boxShadow: entry.isCurrentUser ? `0 0 10px ${tier.glow}` : 'none',
      }}>
        {entry.avatar}
      </div>

      {/* Name + Protocol + Intensity Bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
            color: entry.isCurrentUser ? '#e8e8e8' : 'rgba(255,255,255,0.7)',
            letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.displayName}
          </span>
          {entry.activeProtocol && (
            <span style={{
              fontSize: 7, fontFamily: 'monospace', fontWeight: 600,
              color: '#00FFCC', letterSpacing: '0.08em',
              padding: '1px 5px', borderRadius: 3,
              background: 'rgba(0,255,204,0.08)',
              border: '1px solid rgba(0,255,204,0.15)',
              flexShrink: 0,
            }}>
              {entry.activeProtocol.toUpperCase().slice(0, 12)}
            </span>
          )}
        </div>

        {/* Intensity bar */}
        <IntensityBar score={entry.intensityScore} color={tier.color} />

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {/* HR Zone badge */}
          <span style={{
            fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
            color: hrZone.color, padding: '1px 4px', borderRadius: 2,
            background: hrZone.bg, letterSpacing: '0.05em',
          }}>
            {hrZone.zone} {entry.heartRate}bpm
          </span>

          {/* HRV */}
          <span style={{
            fontSize: 8, fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.3)',
          }}>
            HRV {entry.hrv}ms
          </span>

          {/* Tier badge */}
          <span style={{
            fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
            color: tier.color, letterSpacing: '0.1em',
            marginLeft: 'auto',
          }}>
            {tier.label}
          </span>
        </div>
      </div>

      {/* Score + Rank Delta */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        gap: 2, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 16, fontWeight: 800, fontFamily: 'monospace',
          color: tier.color,
          textShadow: `0 0 8px ${tier.glow}`,
          lineHeight: 1,
        }}>
          {entry.intensityScore}
        </span>
        <RankDelta delta={rankDelta} />
      </div>
    </div>
  );
}

/* ── Avatar names for anonymous sessions ── */
const ANON_NAMES = [
  'Ghost Wolf', 'Iron Hawk', 'Neon Viper', 'Storm Rider', 'Apex Runner',
  'Dark Phoenix', 'Steel Cobra', 'Frost Bear', 'Blaze Fox', 'Shadow Lynx',
  'Titan Pulse', 'Volt Raven', 'Cryo Panther', 'Ember Stag', 'Drift Shark',
];
const ANON_AVATARS = ['🐺', '🦅', '🐍', '⚡', '🏃', '🔥', '🐉', '🐻', '🦊', '🐆', '💪', '🦉', '🐾', '🦌', '🦈'];

function nameForSession(sessionId: string): { name: string; avatar: string } {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ANON_NAMES.length;
  return { name: ANON_NAMES[idx], avatar: ANON_AVATARS[idx] };
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
function ProtocolLeaderboardInner() {
  const allPresence = useQuery(api.queries.listPresence);
  const mySessionId = getSessionId();

  // Track previous ranks for delta calculation
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [toasts, setToasts] = useState<RankToast[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute leaderboard entries from presence data
  const entries: LeaderboardEntry[] = (allPresence ?? [])
    .map((p) => {
      const { name, avatar } = nameForSession(p.sessionId);
      const intensityScore = computeIntensityScore({
        heartRate: p.heartRate,
        hrv: p.hrv,
        activeProtocol: p.activeProtocol,
        lastSeen: p.lastSeen,
        isDeepWork: p.isDeepWork,
      });

      return {
        sessionId: p.sessionId,
        displayName: p.sessionId === mySessionId ? 'You' : name,
        avatar: p.sessionId === mySessionId ? '⚡' : avatar,
        intensityScore,
        heartRate: p.heartRate ?? 65,
        hrv: p.hrv ?? 55,
        activeProtocol: p.activeProtocol,
        rank: 0,
        prevRank: 0,
        isCurrentUser: p.sessionId === mySessionId,
        isDeepWork: p.isDeepWork,
      };
    })
    .sort((a, b) => b.intensityScore - a.intensityScore)
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
      prevRank: prevRanksRef.current.get(entry.sessionId) ?? idx + 1,
    }));

  // Detect rank changes and trigger toasts for current user
  useEffect(() => {
    const myEntry = entries.find((e) => e.isCurrentUser);
    if (!myEntry) return;

    const prevRank = prevRanksRef.current.get(myEntry.sessionId);
    if (prevRank !== undefined && prevRank > myEntry.rank) {
      // Rank improved! Show toast
      const delta = prevRank - myEntry.rank;
      const newToast: RankToast = {
        id: `${Date.now()}-${myEntry.rank}`,
        message: `#${prevRank} → #${myEntry.rank} · +${delta} position${delta > 1 ? 's' : ''}`,
        fromRank: prevRank,
        toRank: myEntry.rank,
        timestamp: Date.now(),
      };
      setToasts((prev) => [...prev.slice(-2), newToast]); // Keep max 3 toasts
    }

    // Update prev ranks for all entries
    const newRanks = new Map<string, number>();
    entries.forEach((e) => newRanks.set(e.sessionId, e.rank));
    prevRanksRef.current = newRanks;
  }, [entries.map((e) => `${e.sessionId}:${e.rank}`).join(',')]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const displayEntries = isExpanded ? entries : entries.slice(0, 5);
  const myRank = entries.find((e) => e.isCurrentUser)?.rank;
  const totalUsers = entries.length;

  // Find the leader's score for the header
  const leaderScore = entries.length > 0 ? entries[0].intensityScore : 0;
  const leaderTier = getTier(leaderScore);

  return (
    <>
      {/* Rank Up Toast Notifications */}
      {toasts.map((toast) => (
        <RankUpToast
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}

      <div style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(10,12,18,0.95) 0%, rgba(8,8,14,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 120, height: 120,
          background: `radial-gradient(circle, ${leaderTier.glow} 0%, transparent 70%)`,
          pointerEvents: 'none', opacity: 0.3,
        }} />

        {/* Header */}
        <div style={{
          padding: '14px 16px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1,
          }}>
            {/* Pulse indicator */}
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: totalUsers > 0 ? '#00FFCC' : 'rgba(255,255,255,0.2)',
              boxShadow: totalUsers > 0 ? '0 0 8px rgba(0,255,204,0.6)' : 'none',
              animation: totalUsers > 0 ? 'statusDotPulse 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              color: 'rgba(0,240,255,0.5)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Live Intensity
            </span>
          </div>

          {/* My rank badge */}
          {myRank && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6,
              background: 'rgba(0,255,204,0.06)',
              border: '1px solid rgba(0,255,204,0.12)',
            }}>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: '#00FFCC', letterSpacing: '0.05em',
              }}>
                #{myRank}
              </span>
              <span style={{
                fontSize: 8, fontFamily: 'monospace',
                color: 'rgba(255,255,255,0.3)',
              }}>
                of {totalUsers}
              </span>
            </div>
          )}

          {/* Active count */}
          <div style={{
            fontSize: 9, fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.25)',
          }}>
            {totalUsers} active
          </div>
        </div>

        {/* Leaderboard rows */}
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayEntries.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px 0',
              color: 'rgba(255,255,255,0.2)', fontSize: 11,
              fontFamily: 'monospace',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>⚡</div>
              No active sessions
              <div style={{ fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.12)' }}>
                Start a protocol to appear on the board
              </div>
            </div>
          ) : (
            displayEntries.map((entry, idx) => (
              <LeaderboardRow key={entry.sessionId} entry={entry} index={idx} />
            ))
          )}
        </div>

        {/* Expand/Collapse toggle */}
        {entries.length > 5 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              width: '100%', padding: '8px 0',
              background: 'rgba(255,255,255,0.02)',
              border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)',
              color: 'rgba(0,240,255,0.4)', fontSize: 9,
              fontFamily: 'monospace', fontWeight: 600,
              letterSpacing: '0.08em', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isExpanded ? '▲ COLLAPSE' : `▼ SHOW ALL ${entries.length} USERS`}
          </button>
        )}

        {/* Footer — score formula hint */}
        <div style={{
          padding: '6px 16px 10px',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <span style={{
            fontSize: 8, fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.15)',
          }}>
            SCORE = HR_ZONE × DURATION × PROTOCOL × HRV_EFF
          </span>
        </div>
      </div>

      {/* Injected keyframes */}
      <style>{`
        @keyframes rankUpFlash {
          0% { transform: scale(1); }
          30% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes toastSlideIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes rowSlideIn {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

const ProtocolLeaderboard = memo(ProtocolLeaderboardInner);
export default ProtocolLeaderboard;
