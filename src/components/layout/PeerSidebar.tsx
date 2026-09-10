import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getSessionId } from '@/components/Presence/usePresenceState';

/* ── Tier badge colors ── */
const TIER_CONFIG: Record<string, { color: string; bg: string; label: string; glow: string }> = {
  apex: { color: '#FFD700', bg: 'rgba(255,215,0,0.08)', label: 'APEX', glow: 'rgba(255,215,0,0.3)' },
  titan: { color: '#00F0FF', bg: 'rgba(0,240,255,0.06)', label: 'TITAN', glow: 'rgba(0,240,255,0.2)' },
  vanguard: { color: '#8B8B8B', bg: 'rgba(139,139,139,0.06)', label: 'VANGUARD', glow: 'rgba(139,139,139,0.15)' },
};

/* ── Live pulse dot ── */
function LivePulse({ color = '#00FF88', size = 8 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.6,
        animation: 'peerPulse 1.5s ease-in-out infinite',
      }} />
      <span style={{
        position: 'relative', width: size, height: size, borderRadius: '50%',
        background: color, boxShadow: `0 0 6px ${color}99`,
      }} />
    </span>
  );
}

/* ── Streak fire badge with pulse for 7+ ── */
function StreakBadge({ streak }: { streak: number }) {
  const isElite = streak >= 7;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 6,
      background: isElite ? 'rgba(255,140,0,0.1)' : 'rgba(255,255,255,0.03)',
      border: isElite ? '1px solid rgba(255,140,0,0.2)' : '1px solid rgba(255,255,255,0.05)',
      animation: isElite ? 'streakGlow 2s ease-in-out infinite' : undefined,
    }}>
      <span style={{ fontSize: 10, filter: isElite ? 'drop-shadow(0 0 3px rgba(255,140,0,0.6))' : 'none' }}>
        {isElite ? '🔥' : '⚡'}
      </span>
      <span style={{
        fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
        color: isElite ? '#FF8C00' : 'rgba(255,255,255,0.35)',
        letterSpacing: '0.02em',
      }}>
        {streak}d
      </span>
    </div>
  );
}

/* ── "In Session" indicator ── */
function InSessionBadge() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, marginTop: 3,
      padding: '2px 6px', borderRadius: 5,
      background: 'rgba(175,130,255,0.06)',
      border: '1px solid rgba(175,130,255,0.1)',
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: '#AF82FF',
        boxShadow: '0 0 6px rgba(175,130,255,0.5)',
        animation: 'sessionPulse 1s ease-in-out infinite',
      }} />
      <span style={{
        fontSize: 8, fontWeight: 600, letterSpacing: '0.05em',
        color: 'rgba(175,130,255,0.7)', fontFamily: 'monospace',
      }}>
        IN SESSION
      </span>
    </div>
  );
}

/* ── Rank medal for top 3 ── */
function RankMedal({ rank }: { rank: number }) {
  const medals: Record<number, { emoji: string; color: string }> = {
    1: { emoji: '👑', color: '#FFD700' },
    2: { emoji: '🥈', color: '#C0C0C0' },
    3: { emoji: '🥉', color: '#CD7F32' },
  };
  const medal = medals[rank];
  if (!medal) {
    return (
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.25)',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}>
        {rank}
      </div>
    );
  }
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 7,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, flexShrink: 0,
      background: `${medal.color}0D`,
      border: `1px solid ${medal.color}22`,
      boxShadow: `0 0 8px ${medal.color}15`,
    }}>
      {medal.emoji}
    </div>
  );
}

/* ── Adherence bar with animated fill ── */
function AdherenceBar({ percent, tier }: { percent: number; tier: string }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.vanguard;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 100);
    return () => clearTimeout(t);
  }, [percent]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div style={{
        width: 48, height: 5, borderRadius: 3,
        background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${width}%`, height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${cfg.color}66, ${cfg.color})`,
          boxShadow: `0 0 6px ${cfg.glow}`,
          transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
        color: cfg.color, minWidth: 32, textAlign: 'right',
        textShadow: `0 0 8px ${cfg.glow}`,
      }}>
        {percent}%
      </span>
    </div>
  );
}

/* ── Single peer row ── */
function PeerRow({ entry, isYou, animDelay }: {
  entry: {
    rank: number;
    anonLabel: string;
    avgAdherence: number;
    daysTracked: number;
    tier: string;
    isActive: boolean;
    activeProtocol: string | null;
    inSession: string | null;
    streak: number;
  };
  isYou: boolean;
  animDelay: number;
}) {
  const [hovered, setHovered] = useState(false);
  const hasEliteStreak = entry.streak >= 7;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 12,
        background: isYou
          ? 'rgba(196,164,108,0.06)'
          : hasEliteStreak
            ? hovered ? 'rgba(255,140,0,0.04)' : 'rgba(255,140,0,0.015)'
            : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        border: isYou
          ? '1px solid rgba(196,164,108,0.15)'
          : hasEliteStreak
            ? '1px solid rgba(255,140,0,0.06)'
            : '1px solid transparent',
        transition: 'all 0.25s ease',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
        opacity: 0,
        transform: 'translateX(12px)',
        animation: `peerRowSlide 0.4s ease ${animDelay}s forwards`,
      }}
    >
      {/* Elite streak shimmer */}
      {hasEliteStreak && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,140,0,0.03) 50%, transparent 60%)',
          animation: 'streakShimmer 4s ease-in-out infinite',
        }} />
      )}

      {/* Rank */}
      <RankMedal rank={entry.rank} />

      {/* Avatar + Name + Status */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {entry.isActive && <LivePulse color={entry.inSession ? '#AF82FF' : '#00FF88'} />}
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
            color: isYou ? '#C4A46C' : 'rgba(255,255,255,0.8)',
            fontFamily: "'Inter', system-ui, sans-serif",
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {isYou ? 'You' : entry.anonLabel}
          </span>
          {isYou && (
            <span style={{
              fontSize: 7, fontWeight: 700, letterSpacing: '0.12em',
              color: '#C4A46C', background: 'rgba(196,164,108,0.12)',
              padding: '1px 5px', borderRadius: 4,
            }}>
              YOU
            </span>
          )}
          {entry.streak > 0 && <StreakBadge streak={entry.streak} />}
        </div>

        {/* Status line */}
        {entry.inSession ? (
          <InSessionBadge />
        ) : entry.isActive && entry.activeProtocol ? (
          <div style={{
            fontSize: 9, color: 'rgba(0,255,136,0.5)', marginTop: 3,
            fontFamily: 'monospace', letterSpacing: '0.03em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            ▸ {entry.activeProtocol}
          </div>
        ) : entry.isActive ? (
          <div style={{
            fontSize: 9, color: 'rgba(0,255,136,0.35)', marginTop: 3,
            fontFamily: 'monospace', letterSpacing: '0.03em',
          }}>
            ▸ Online
          </div>
        ) : null}
      </div>

      {/* Adherence */}
      <AdherenceBar percent={entry.avgAdherence} tier={entry.tier} />
    </div>
  );
}

/* ── Fallback row for seeded leaderboard data ── */
function FallbackRow({ user, rank, animDelay }: {
  user: { name: string; adherence: number; tier: string; isCurrentUser: boolean };
  rank: number;
  animDelay: number;
}) {
  const [hovered, setHovered] = useState(false);
  let hash = 0;
  for (let i = 0; i < user.name.length; i++) {
    hash = ((hash << 5) - hash + user.name.charCodeAt(i)) | 0;
  }
  const opId = (Math.abs(hash) % 900) + 100;
  const fakeStreak = user.adherence >= 90 ? 12 : user.adherence >= 80 ? 8 : user.adherence >= 70 ? 5 : user.adherence >= 60 ? 3 : 1;
  const hasEliteStreak = fakeStreak >= 7;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 12,
        background: user.isCurrentUser
          ? 'rgba(196,164,108,0.06)'
          : hasEliteStreak
            ? hovered ? 'rgba(255,140,0,0.04)' : 'rgba(255,140,0,0.015)'
            : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        border: user.isCurrentUser ? '1px solid rgba(196,164,108,0.15)' : '1px solid transparent',
        transition: 'all 0.25s ease',
        position: 'relative', overflow: 'hidden',
        opacity: 0, transform: 'translateX(12px)',
        animation: `peerRowSlide 0.4s ease ${animDelay}s forwards`,
      }}
    >
      {hasEliteStreak && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,140,0,0.03) 50%, transparent 60%)',
          animation: 'streakShimmer 4s ease-in-out infinite',
        }} />
      )}

      <RankMedal rank={rank} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {rank <= 3 && <LivePulse color={rank === 1 ? '#FFD700' : '#00FF88'} />}
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
            color: user.isCurrentUser ? '#C4A46C' : 'rgba(255,255,255,0.8)',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            {user.isCurrentUser ? 'You' : `Operator #${opId}`}
          </span>
          {user.isCurrentUser && (
            <span style={{
              fontSize: 7, fontWeight: 700, letterSpacing: '0.12em',
              color: '#C4A46C', background: 'rgba(196,164,108,0.12)',
              padding: '1px 5px', borderRadius: 4,
            }}>
              YOU
            </span>
          )}
          {fakeStreak > 0 && <StreakBadge streak={fakeStreak} />}
        </div>
      </div>

      <AdherenceBar percent={user.adherence} tier={user.tier} />
    </div>
  );
}

/* ── Cohort Stats Bar ── */
function CohortStats({ entries }: { entries: Array<{ avgAdherence: number; isActive: boolean; streak: number }> }) {
  const avgAdherence = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.avgAdherence, 0) / entries.length)
    : 0;
  const activeCount = entries.filter(e => e.isActive).length;
  const streakers = entries.filter(e => e.streak >= 7).length;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
      padding: '10px 0',
    }}>
      {[
        { label: 'COHORT AVG', value: `${avgAdherence}%`, color: '#00FFCC' },
        { label: 'LIVE NOW', value: `${activeCount}`, color: '#00FF88' },
        { label: '7+ STREAKS', value: `${streakers}`, color: '#FF8C00' },
      ].map((stat) => (
        <div key={stat.label} style={{
          textAlign: 'center', padding: '8px 4px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{
            fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
            color: stat.color, textShadow: `0 0 10px ${stat.color}33`,
          }}>
            {stat.value}
          </div>
          <div style={{
            fontSize: 7, fontWeight: 700, letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace',
            marginTop: 2,
          }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Social pressure motivational line ── */
function SocialPressureBanner({ myRank, totalOperators }: { myRank: number | null; totalOperators: number }) {
  const msg = myRank === null
    ? 'Complete your Script to join the ranks'
    : myRank <= 3
      ? 'You are in the top tier. Stay relentless.'
      : myRank <= Math.ceil(totalOperators * 0.5)
        ? `${myRank - 1} operator${myRank - 1 !== 1 ? 's' : ''} ahead of you. Close the gap.`
        : 'Your cohort is outpacing you. Execute your Script.';

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, marginTop: 4,
      background: 'linear-gradient(135deg, rgba(196,164,108,0.04) 0%, rgba(255,140,0,0.02) 100%)',
      border: '1px solid rgba(196,164,108,0.08)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
        color: 'rgba(196,164,108,0.65)',
        fontFamily: "'Inter', system-ui, sans-serif",
        lineHeight: 1.5, textAlign: 'center',
      }}>
        {msg}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  PEER SIDEBAR — Elite Cohort Leaderboard + Live Presence      */
/* ══════════════════════════════════════════════════════════════ */
export default function PeerSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const sessionId = useMemo(() => getSessionId(), []);
  const peerLeaderboard = useQuery(api.leaderboard.getPeerLeaderboard);
  const fallbackLeaderboard = useQuery(api.leaderboard.listLeaderboard);
  const seedLeaderboard = useMutation(api.leaderboard.seedLeaderboard);
  const health = useQuery(api.queries.connectionHealth);

  const activeCount = health?.activeUsers ?? 0;
  const hasRealData = peerLeaderboard && peerLeaderboard.length > 0;
  const myEntry = peerLeaderboard?.find((e) => e.anonId === sessionId);

  // Auto-seed fallback if empty
  const fallbackEmpty = fallbackLeaderboard && fallbackLeaderboard.length === 0;
  useEffect(() => {
    if (fallbackEmpty && isOpen) {
      seedLeaderboard({}).catch(() => {});
    }
  }, [fallbackEmpty, isOpen, seedLeaderboard]);

  // Build stats for cohort bar
  const cohortEntries = hasRealData
    ? peerLeaderboard!.map(e => ({ avgAdherence: e.avgAdherence, isActive: e.isActive, streak: e.streak }))
    : (fallbackLeaderboard || []).map(u => ({
        avgAdherence: u.adherence,
        isActive: false,
        streak: u.adherence >= 90 ? 12 : u.adherence >= 80 ? 8 : u.adherence >= 70 ? 5 : 3,
      }));

  const totalOperators = hasRealData ? peerLeaderboard!.length : (fallbackLeaderboard?.length ?? 0);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Sidebar panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 360, maxWidth: '90vw',
        zIndex: 9999,
        background: 'linear-gradient(180deg, #0B0B0E 0%, #070710 100%)',
        borderLeft: '1px solid rgba(196,164,108,0.06)',
        boxShadow: '-12px 0 60px rgba(0,0,0,0.7), -4px 0 20px rgba(0,0,0,0.4)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(196,164,108,0.04) 0%, transparent 70%)',
        }} />

        {/* Header */}
        <div style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.25em',
                color: 'rgba(196,164,108,0.45)', fontFamily: 'monospace',
                marginBottom: 4,
              }}>
                PRIVATE COHORT • CLASSIFIED
              </div>
              <div style={{
                fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
                color: 'rgba(255,255,255,0.92)',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                Peer Performance
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              ✕
            </button>
          </div>

          {/* Active users badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            padding: '8px 12px', borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(0,255,136,0.04) 0%, rgba(0,240,255,0.02) 100%)',
            border: '1px solid rgba(0,255,136,0.08)',
          }}>
            <LivePulse />
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
              color: 'rgba(0,255,136,0.7)', fontFamily: 'monospace',
            }}>
              {activeCount} OPERATORS LIVE
            </span>
            <span style={{
              fontSize: 8, color: 'rgba(255,255,255,0.2)',
              fontFamily: 'monospace', marginLeft: 'auto',
              letterSpacing: '0.08em',
            }}>
              7-DAY RANK
            </span>
          </div>

          {/* Cohort stats */}
          <CohortStats entries={cohortEntries} />

          {/* Social pressure banner */}
          <SocialPressureBanner
            myRank={myEntry?.rank ?? null}
            totalOperators={totalOperators}
          />
        </div>

        {/* Leaderboard list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '6px 8px 100px',
          scrollbarWidth: 'none',
        }}>
          {/* Column headers */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 12px 8px', marginBottom: 2,
          }}>
            <span style={{ width: 26, fontSize: 7, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>#</span>
            <span style={{ flex: 1, fontSize: 7, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>OPERATOR</span>
            <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', textAlign: 'right', minWidth: 86 }}>ADHERENCE</span>
          </div>

          {hasRealData ? (
            <>
              {peerLeaderboard!.map((entry, i) => (
                <PeerRow
                  key={entry.anonId}
                  entry={entry}
                  isYou={entry.anonId === sessionId}
                  animDelay={0.05 + i * 0.04}
                />
              ))}
              {!myEntry && (
                <div style={{
                  marginTop: 16, padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(196,164,108,0.03)',
                  border: '1px dashed rgba(196,164,108,0.12)',
                  textAlign: 'center',
                  opacity: 0,
                  animation: 'peerRowSlide 0.4s ease 0.8s forwards',
                }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>🎯</div>
                  <div style={{
                    fontSize: 10, color: 'rgba(196,164,108,0.6)',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: 500, lineHeight: 1.4,
                  }}>
                    Complete today's Script to join the ranks
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {fallbackLeaderboard?.map((user, i) => (
                <FallbackRow
                  key={user._id}
                  user={user}
                  rank={i + 1}
                  animDelay={0.05 + i * 0.04}
                />
              ))}
              {(!fallbackLeaderboard || fallbackLeaderboard.length === 0) && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', margin: '0 auto 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,240,255,0.04)',
                    border: '1px solid rgba(0,240,255,0.08)',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      border: '2px solid rgba(0,240,255,0.3)',
                      borderTopColor: 'rgba(0,240,255,0.6)',
                      animation: 'spin 1s linear infinite',
                    }} />
                  </div>
                  <div style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.3)',
                    fontFamily: 'monospace', letterSpacing: '0.05em',
                  }}>
                    LOADING COHORT DATA...
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer legend */}
        <div style={{
          padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
          background: 'rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 8 }}>
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 2,
                  background: cfg.color, opacity: 0.6,
                  boxShadow: `0 0 4px ${cfg.glow}`,
                }} />
                <span style={{
                  fontSize: 7, fontWeight: 700, letterSpacing: '0.12em',
                  color: cfg.color, opacity: 0.5, fontFamily: 'monospace',
                }}>
                  {cfg.label}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 8 }}>🔥</span>
              <span style={{ fontSize: 7, color: 'rgba(255,140,0,0.4)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>7+ DAY STREAK</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <LivePulse color="#AF82FF" size={6} />
              <span style={{ fontSize: 7, color: 'rgba(175,130,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>IN SESSION</span>
            </div>
          </div>
          <div style={{
            fontSize: 7, color: 'rgba(255,255,255,0.12)',
            textAlign: 'center',
            fontFamily: 'monospace', letterSpacing: '0.06em',
          }}>
            IDENTITIES ANONYMIZED • RANKED BY 7-DAY PROTOCOL ADHERENCE
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes peerPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(2); opacity: 0; }
        }
        @keyframes sessionPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes streakGlow {
          0%, 100% { box-shadow: 0 0 4px rgba(255,140,0,0.1); }
          50% { box-shadow: 0 0 8px rgba(255,140,0,0.25); }
        }
        @keyframes streakShimmer {
          0% { transform: translateX(-200%); }
          50%, 100% { transform: translateX(300%); }
        }
        @keyframes peerRowSlide {
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
