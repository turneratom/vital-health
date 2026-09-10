import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/* ═══════════════════════════════════════════════════════════════
   DAILY MISSION — Full Protocol Checklist + Readiness Score
   
   Fetches ALL active protocols (supplements, training, biohacking,
   nutrition, recovery) and renders an interactive checklist.
   Completions persist to Convex and drive a real-time Readiness Score.
   ═══════════════════════════════════════════════════════════════ */

interface DailyMissionProps {
  sessionId: string;
  compact?: boolean;
}

/* ── Category Config ── */
const CATEGORY_META: Record<string, { color: string; label: string; icon: string }> = {
  supplement: { color: '#E8976C', label: 'SUPPLEMENTS', icon: '💊' },
  training:   { color: '#B8A9C9', label: 'TRAINING', icon: '🏋️' },
  biohacking: { color: '#7CB68E', label: 'BIOHACKING', icon: '🧬' },
  nutrition:  { color: '#C4A46C', label: 'NUTRITION', icon: '🥩' },
  recovery:   { color: '#6B8AFF', label: 'RECOVERY', icon: '😴' },
  movement:   { color: '#FF9500', label: 'MOVEMENT', icon: '🚶' },
  cognitive:  { color: '#D4847A', label: 'COGNITIVE', icon: '🧠' },
};

const getCat = (cat: string) => CATEGORY_META[cat] ?? { color: '#E8976C', label: cat.toUpperCase(), icon: '⚡' };

/* ── Readiness Score Ring ── */
function ReadinessRing({ percentage, ghostMode }: { percentage: number; ghostMode?: boolean }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (percentage / 100) * c;

  const color = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.5)';
    if (percentage >= 100) return '#7CB68E';
    if (percentage >= 75) return '#00FFCC';
    if (percentage >= 50) return '#E8976C';
    if (percentage >= 25) return '#C4A46C';
    return '#D4847A';
  }, [percentage, ghostMode]);

  const glowColor = `${color}40`;
  const label = percentage >= 100 ? 'MISSION\nCOMPLETE' : percentage >= 75 ? 'COMBAT\nREADY' : percentage >= 50 ? 'BUILDING' : 'DEPLOYING';

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: 88, height: 88 }}>
        <svg viewBox="0 0 88 88" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="5" />
          {/* Progress */}
          <circle
            cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.5s',
              filter: `drop-shadow(0 0 8px ${glowColor})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold tabular-nums" style={{
            color,
            textShadow: `0 0 12px ${glowColor}`,
            lineHeight: 1,
          }}>
            {percentage}
          </span>
          <span className="font-mono text-[6px] tracking-[0.2em] uppercase mt-0.5 text-center leading-tight whitespace-pre-line" style={{
            color: `${color}88`,
          }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Progress Bar (compact) ── */
function ReadinessBar({ percentage }: { percentage: number }) {
  const color = percentage >= 100 ? '#7CB68E' : percentage >= 50 ? '#E8976C' : '#C4A46C';
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(138,126,114,0.5)' }}>
          Readiness
        </span>
        <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color, textShadow: `0 0 6px ${color}44` }}>
          {percentage}%
        </span>
      </div>
      <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}CC, ${color})`,
            boxShadow: `0 0 8px ${color}40`,
            transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  );
}

/* ── Protocol Item Row ── */
function MissionItem({
  name, icon, description, category, completed, toggling, onToggle, animDelay,
}: {
  name: string; icon: string; description: string; category: string;
  completed: boolean; toggling: boolean; onToggle: () => void; animDelay: number;
}) {
  const [flash, setFlash] = useState(false);
  const cat = getCat(category);

  const handleClick = useCallback(() => {
    if (!completed) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      window.dispatchEvent(new CustomEvent('vive-optimization-pulse', {
        detail: { category, color: cat.color, timestamp: Date.now() },
      }));
    }
    onToggle();
  }, [completed, onToggle, category, cat.color]);

  return (
    <button
      onClick={handleClick}
      disabled={toggling}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left group transition-all duration-300 active:scale-[0.98]"
      style={{
        background: completed ? `${cat.color}06` : 'rgba(255,255,255,0.015)',
        border: `1px solid ${completed ? `${cat.color}15` : 'rgba(42,38,34,0.5)'}`,
        boxShadow: flash ? `0 0 20px ${cat.color}25, inset 0 0 12px ${cat.color}06` : 'none',
        opacity: toggling ? 0.6 : 1,
        animation: `dmSlideIn 0.35s ease both ${animDelay}s`,
      }}
    >
      {/* Checkbox */}
      <div className="relative flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-300" style={{
        background: completed ? `${cat.color}15` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${completed ? cat.color : 'rgba(232,151,108,0.1)'}`,
        boxShadow: completed ? `0 0 8px ${cat.color}30` : 'none',
      }}>
        {completed && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <span className="text-sm flex-shrink-0" style={{ opacity: completed ? 0.4 : 0.9 }}>{icon}</span>

      {/* Label + desc */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold tracking-wide block truncate transition-all duration-300" style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          color: completed ? `${cat.color}70` : '#E8E0D8',
          textDecoration: completed ? 'line-through' : 'none',
          textDecorationColor: `${cat.color}40`,
        }}>
          {name}
        </span>
        <span className="text-[9px] block truncate" style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: 'rgba(138,126,114,0.4)',
        }}>
          {description}
        </span>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color, opacity: 0.5 }} />
        <span className="text-[7px] font-mono tracking-[0.1em] uppercase" style={{
          color: completed ? `${cat.color}60` : 'rgba(138,126,114,0.3)',
        }}>
          {completed ? '✓' : cat.label.slice(0, 4)}
        </span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DAILY MISSION — Main Component
   ═══════════════════════════════════════════════════════════════ */

export function DailyMission({ sessionId, compact = false }: DailyMissionProps) {
  const [mounted, setMounted] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  /* ── Queries ── */
  const protocolStatus = useQuery(
    api.protocols.getTodayProtocolStatus,
    sessionId ? { sessionId } : 'skip'
  );
  const adherenceScore = useQuery(
    api.protocols.getAdherenceScore,
    sessionId ? { sessionId } : 'skip'
  );
  const streakData = useQuery(
    api.protocols.getSupplementStreak,
    sessionId ? { sessionId } : 'skip'
  );

  /* ── Mutations ── */
  const toggleCompletion = useMutation(api.protocols.toggleCompletion);
  const oneTapVerify = useMutation(api.protocols.oneTapVerify);
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore);
  const seedDefaults = useMutation(api.protocols.seedDefaults);

  /* ── Auto-seed if empty ── */
  useEffect(() => {
    if (protocolStatus && protocolStatus.total === 0 && sessionId) {
      seedDefaults({ sessionId });
    }
  }, [protocolStatus?.total, sessionId, seedDefaults]);

  /* ── Toggle handler ── */
  const handleToggle = useCallback(async (protocolId: string) => {
    if (!sessionId || togglingId) return;
    setTogglingId(protocolId);
    try {
      const result = await toggleCompletion({
        sessionId,
        protocolId: protocolId as Id<"protocols">,
      });
      // Also fire oneTapVerify for Elite Score + journal logging
      try {
        await oneTapVerify({
          sessionId,
          protocolId: protocolId as Id<"protocols">,
        });
      } catch { /* non-critical */ }
      // Update adherence score
      try {
        await updateAdherence({ sessionId });
      } catch { /* non-critical */ }

      if (result.completed) {
        setJustCompleted(prev => new Set([...prev, protocolId]));
        setTimeout(() => {
          setJustCompleted(prev => {
            const next = new Set(prev);
            next.delete(protocolId);
            return next;
          });
        }, 1500);
      }
    } finally {
      setTogglingId(null);
    }
  }, [sessionId, togglingId, toggleCompletion, oneTapVerify, updateAdherence]);

  /* ── Derived data ── */
  const items = protocolStatus?.items ?? [];
  const total = protocolStatus?.total ?? 0;
  const done = protocolStatus?.done ?? 0;
  const percentage = protocolStatus?.percentage ?? 0;
  const streak = streakData?.streak ?? 0;

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    // Sort categories: incomplete first, then alphabetical
    return Object.entries(groups).sort(([a, aItems], [b, bItems]) => {
      const aDone = aItems.every(i => i.completed);
      const bDone = bItems.every(i => i.completed);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.localeCompare(b);
    });
  }, [items]);

  const allDone = total > 0 && done === total;

  /* ── Loading state ── */
  if (!protocolStatus) {
    return (
      <div className="rounded-2xl p-5" style={{
        background: 'rgba(26,24,22,0.6)',
        border: '1px solid rgba(42,38,34,0.8)',
      }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{
            borderColor: 'rgba(232,151,108,0.3)',
            borderTopColor: 'transparent',
          }} />
          <span className="text-[11px] font-mono" style={{ color: 'rgba(138,126,114,0.4)' }}>
            Loading mission protocols...
          </span>
        </div>
      </div>
    );
  }

  /* ── Compact mode ── */
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#E8E0D8' }}>
              Daily Mission
            </span>
            <span className="text-[10px] font-mono" style={{
              color: allDone ? '#7CB68E' : '#E8976C',
            }}>
              {done}/{total}
            </span>
            {streak > 0 && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full" style={{
                background: 'rgba(232,151,108,0.06)',
                border: '1px solid rgba(232,151,108,0.12)',
                color: '#E8976C',
              }}>
                {streak >= 7 ? '🔥' : '⚡'} {streak}d
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono font-bold" style={{
            color: allDone ? '#7CB68E' : '#E8976C',
          }}>
            {percentage}%
          </span>
        </div>
        <ReadinessBar percentage={percentage} />
      </div>
    );
  }

  /* ── Full mode ── */
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(26,24,22,0.6)',
        border: `1px solid ${allDone ? 'rgba(124,182,142,0.15)' : 'rgba(42,38,34,0.8)'}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: allDone
          ? '0 4px 32px rgba(0,0,0,0.3), 0 0 40px rgba(124,182,142,0.04)'
          : '0 4px 32px rgba(0,0,0,0.3)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-4" style={{
        borderBottom: '1px solid rgba(42,38,34,0.5)',
      }}>
        <ReadinessRing percentage={percentage} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] tracking-[0.1em] uppercase font-bold" style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              color: '#E8E0D8',
            }}>
              Daily Mission
            </span>
            {allDone && (
              <span className="text-[8px] font-mono px-2 py-0.5 rounded-full" style={{
                background: 'rgba(124,182,142,0.1)',
                border: '1px solid rgba(124,182,142,0.2)',
                color: '#7CB68E',
                animation: 'dmPulse 2s ease-in-out infinite',
              }}>
                ✓ COMPLETE
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono block" style={{ color: 'rgba(138,126,114,0.45)' }}>
            {allDone
              ? 'All protocols verified — mission accomplished'
              : `${total - done} protocol${total - done !== 1 ? 's' : ''} remaining`}
          </span>
          {/* Streak + adherence */}
          <div className="flex items-center gap-3 mt-1.5">
            {streak > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{
                background: 'rgba(232,151,108,0.06)',
                border: '1px solid rgba(232,151,108,0.12)',
              }}>
                <span style={{ fontSize: 8 }}>{streak >= 7 ? '🔥' : '⚡'}</span>
                <span className="text-[8px] font-mono font-semibold" style={{ color: '#E8976C' }}>
                  {streak}d streak
                </span>
              </div>
            )}
            {adherenceScore && adherenceScore.adherencePercent > 0 && (
              <span className="text-[8px] font-mono" style={{ color: 'rgba(138,126,114,0.35)' }}>
                7d avg: {adherenceScore.adherencePercent}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Protocol Groups ── */}
      <div className="px-3 py-2.5 space-y-3">
        {grouped.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-2xl block mb-2">🎯</span>
            <span className="text-[11px] block font-semibold" style={{ color: '#E8E0D8' }}>
              No protocols assigned
            </span>
            <span className="text-[9px] font-mono block mt-1" style={{ color: 'rgba(138,126,114,0.4)' }}>
              Protocols will auto-generate from your bio profile
            </span>
          </div>
        ) : (
          grouped.map(([category, catItems], groupIdx) => {
            const cat = getCat(category);
            const catDone = catItems.filter(i => i.completed).length;
            const catTotal = catItems.length;
            const catComplete = catDone === catTotal;

            return (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-2 px-1 mb-1.5">
                  <span style={{ fontSize: 10 }}>{cat.icon}</span>
                  <span className="text-[8px] font-mono font-bold tracking-[0.15em] uppercase" style={{
                    color: catComplete ? `${cat.color}60` : cat.color,
                  }}>
                    {cat.label}
                  </span>
                  <span className="text-[8px] font-mono tabular-nums" style={{
                    color: catComplete ? `${cat.color}50` : `${cat.color}80`,
                  }}>
                    {catDone}/{catTotal}
                  </span>
                  <div className="flex-1 h-[1px]" style={{ background: `${cat.color}10` }} />
                  {catComplete && (
                    <span className="text-[7px] font-mono" style={{ color: `${cat.color}60` }}>✓</span>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {catItems.map((item, idx) => (
                    <MissionItem
                      key={item._id}
                      name={item.name}
                      icon={item.icon}
                      description={item.description}
                      category={item.category}
                      completed={item.completed}
                      toggling={togglingId === item._id}
                      onToggle={() => handleToggle(item._id)}
                      animDelay={0.03 * (groupIdx * 4 + idx)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Readiness Bar Footer ── */}
      <div className="px-4 pb-3 pt-1" style={{
        borderTop: '1px solid rgba(42,38,34,0.4)',
      }}>
        <ReadinessBar percentage={percentage} />
      </div>

      {/* Ambient scan line */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden" style={{ opacity: 0.015 }}>
        <div className="absolute left-0 w-full h-[1px]" style={{
          background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.6), transparent)',
          animation: 'dmScanline 8s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes dmSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes dmScanline {
          0% { top: -2%; }
          100% { top: 102%; }
        }
        @keyframes dmPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default DailyMission;
