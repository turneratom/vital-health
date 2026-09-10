import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { CheckoutModal } from './CheckoutModal';

/* ══════════════════════════════════════════════════════════════
   DAILY STACK — Supplement Protocol Widget
   
   Two modes:
   1. Compact (header pill) — progress ring + streak badge, click to expand
   2. Expanded (dropdown panel) — full checklist with checkboxes
   
   Pulls supplements from `protocols` table (category === "supplement").
   Checkboxes sync to `daily_completions` table for streak tracking.
   Also syncs to `protocolCompletions` via oneTapVerify for Elite Score.
   ══════════════════════════════════════════════════════════════ */

export interface DailyStackProps {
  sessionId: string;
  mode?: 'compact' | 'expanded';
  ghostMode?: boolean;
}

/* ── Palette ── */
const WARM = {
  accent: '#E8976C',
  green: '#7CB68E',
  amber: '#C4A46C',
  red: '#D4847A',
  text: '#E8E0D8',
  muted: '#8A7E72',
  bg: 'rgba(26,24,22,0.95)',
  border: 'rgba(232,151,108,0.12)',
  borderSubtle: 'rgba(42,38,34,0.8)',
};

const CATEGORY_COLORS: Record<string, string> = {
  supplement: WARM.accent,
  recovery: WARM.green,
  movement: '#B8A9C9',
  nutrition: WARM.amber,
  cognitive: WARM.red,
};

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/* ── Mini Progress Ring (header) ── */
function MiniRing({ done, total, ghostMode }: { done: number; total: number; ghostMode: boolean }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const r = 10;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  const color = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.5)';
    if (pct >= 100) return WARM.green;
    if (pct >= 50) return WARM.accent;
    return WARM.amber;
  }, [pct, ghostMode]);

  const trackColor = ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(232,151,108,0.06)';

  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="12" cy="12" r={r} fill="none" stroke={trackColor} strokeWidth="2" />
        <circle
          cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="2"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s',
            filter: ghostMode ? 'none' : `drop-shadow(0 0 3px ${color}55)`,
          }}
        />
      </svg>
      <span
        className="absolute text-[7px] font-mono font-bold tabular-nums"
        style={{ color, textShadow: ghostMode ? 'none' : `0 0 4px ${color}44` }}
      >
        {done}
      </span>
    </div>
  );
}

/* ── Full Progress Ring (expanded) ── */
function ProgressRing({ done, total, ghostMode }: { done: number; total: number; ghostMode: boolean }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  const color = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.5)';
    if (pct >= 100) return WARM.green;
    if (pct >= 50) return WARM.accent;
    return WARM.amber;
  }, [pct, ghostMode]);

  const trackColor = ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(232,151,108,0.06)';

  return (
    <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
      <svg viewBox="0 0 44 44" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke={trackColor} strokeWidth="3" />
        <circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s',
            filter: ghostMode ? 'none' : `drop-shadow(0 0 4px ${color}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[11px] font-bold tabular-nums" style={{
          color,
          textShadow: ghostMode ? 'none' : `0 0 6px ${color}44`,
        }}>
          {done}/{total}
        </span>
      </div>
    </div>
  );
}

/* ── Streak Badge ── */
function StreakBadge({ streak, ghostMode, size = 'sm' }: { streak: number; ghostMode: boolean; size?: 'sm' | 'md' }) {
  if (streak <= 0) return null;
  const color = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.5)';
    if (streak >= 7) return WARM.green;
    if (streak >= 3) return WARM.accent;
    return WARM.amber;
  }, [streak, ghostMode]);

  const isSm = size === 'sm';

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{
      background: ghostMode ? 'rgba(160,160,160,0.04)' : `${color}08`,
      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${color}20`}`,
    }}>
      <span style={{ fontSize: isSm ? 8 : 10 }}>{streak >= 7 ? '🔥' : '⚡'}</span>
      <span className="font-mono font-semibold tabular-nums" style={{
        fontSize: isSm ? 8 : 9,
        color,
      }}>
        {streak}d
      </span>
    </div>
  );
}

/* ── Supplement Row ── */
function SupplementRow({
  name, icon, description, completed, onToggle, category, ghostMode, animDelay,
}: {
  name: string; icon: string; description: string; completed: boolean;
  onToggle: () => void; category: string; ghostMode: boolean; animDelay: number;
}) {
  const [flash, setFlash] = useState(false);
  const color = ghostMode ? 'rgba(160,160,160,0.5)' : (CATEGORY_COLORS[category] || WARM.accent);

  const handleClick = useCallback(() => {
    if (!completed) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      // Dispatch pulse for FluidCanvas
      window.dispatchEvent(new CustomEvent('vive-optimization-pulse', {
        detail: { category, color, timestamp: Date.now() },
      }));
    }
    onToggle();
  }, [completed, onToggle, category, color]);

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left group transition-all duration-300 active:scale-[0.98]"
      style={{
        background: completed
          ? (ghostMode ? 'rgba(160,160,160,0.04)' : `${color}06`)
          : 'rgba(255,255,255,0.015)',
        border: `1px solid ${completed
          ? (ghostMode ? 'rgba(160,160,160,0.1)' : `${color}15`)
          : (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.5)')}`,
        boxShadow: flash ? `0 0 20px ${color}25, inset 0 0 12px ${color}06` : 'none',
        animation: `dsSlideIn 0.35s ease both ${animDelay}s`,
      }}
    >
      {/* Checkbox */}
      <div className="relative flex-shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all duration-300" style={{
        background: completed ? `${color}15` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${completed ? color : (ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(232,151,108,0.1)')}`,
        boxShadow: completed ? `0 0 8px ${color}30` : 'none',
      }}>
        {completed && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <span className="text-sm flex-shrink-0" style={{ opacity: completed ? 0.4 : 0.9, filter: ghostMode ? 'grayscale(1)' : 'none' }}>
        {icon}
      </span>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold tracking-wide block truncate transition-all duration-300" style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          color: completed
            ? (ghostMode ? 'rgba(160,160,160,0.35)' : `${color}70`)
            : (ghostMode ? 'rgba(160,160,160,0.6)' : WARM.text),
          textDecoration: completed ? 'line-through' : 'none',
          textDecorationColor: `${color}40`,
        }}>
          {name}
        </span>
        <span className="text-[9px] block truncate" style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.4)',
        }}>
          {description}
        </span>
      </div>

      {/* Status */}
      <span className="text-[7px] font-mono tracking-[0.12em] uppercase flex-shrink-0" style={{
        color: completed
          ? (ghostMode ? 'rgba(160,160,160,0.3)' : `${color}60`)
          : (ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(138,126,114,0.25)'),
      }}>
        {completed ? '✓ DONE' : 'TAP'}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPACT MODE — Header pill with dropdown
   ══════════════════════════════════════════════════════════════ */

function CompactDailyStack({ sessionId, ghostMode = false }: { sessionId: string; ghostMode: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dateKey = getTodayDateKey();

  // Queries
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, sessionId ? { sessionId } : 'skip');
  const dailyCompletions = useQuery(api.protocols.getDailyCompletions, sessionId ? { sessionId, dateKey } : 'skip');
  const streakData = useQuery(api.protocols.getSupplementStreak, sessionId ? { sessionId } : 'skip');

  // Mutations
  const toggleDailyCompletion = useMutation(api.protocols.toggleDailyCompletion);
  const oneTapVerify = useMutation(api.protocols.oneTapVerify);

  // Filter supplements
  const supplements = useMemo(() =>
    (protocolStatus?.items ?? []).filter((item) => item.category === 'supplement'),
    [protocolStatus]
  );

  // Completion map
  const completionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (dailyCompletions) {
      for (const c of dailyCompletions) {
        if (c.completed) map.set(c.protocolId, true);
      }
    }
    return map;
  }, [dailyCompletions]);

  const doneCount = supplements.filter((s) => completionMap.has(s._id)).length;
  const totalCount = supplements.length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const streak = streakData?.streak ?? 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = useCallback(async (item: typeof supplements[0]) => {
    if (!sessionId) return;
    await toggleDailyCompletion({
      sessionId,
      protocolId: item._id,
      protocolName: item.name,
      category: item.category,
    });
    try {
      await oneTapVerify({ sessionId, protocolId: item._id as any });
    } catch { /* non-critical */ }
  }, [sessionId, toggleDailyCompletion, oneTapVerify]);

  if (!sessionId || totalCount === 0) return null;

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger Pill ── */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.04)' : (allDone ? 'rgba(124,182,142,0.06)' : 'rgba(232,151,108,0.04)'),
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : (allDone ? 'rgba(124,182,142,0.12)' : 'rgba(232,151,108,0.08)')}`,
          boxShadow: allDone && !ghostMode ? '0 0 8px rgba(124,182,142,0.08)' : 'none',
        }}
        title={`Daily Stack: ${doneCount}/${totalCount} supplements${streak > 0 ? ` · ${streak}d streak` : ''}`}
      >
        <MiniRing done={doneCount} total={totalCount} ghostMode={ghostMode} />
        <div className="flex flex-col items-start">
          <span className="text-[8px] font-mono tracking-[0.1em] uppercase leading-none" style={{
            color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(138,126,114,0.45)',
          }}>
            Stack
          </span>
          <span className="text-[9px] font-mono font-semibold tabular-nums leading-tight" style={{
            color: ghostMode ? 'rgba(160,160,160,0.5)' : (allDone ? WARM.green : WARM.accent),
          }}>
            {allDone ? 'Done' : `${doneCount}/${totalCount}`}
          </span>
        </div>
        {streak > 0 && <StreakBadge streak={streak} ghostMode={ghostMode} size="sm" />}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          className="absolute top-full mt-2 right-0 w-[320px] rounded-2xl overflow-hidden z-[100]"
          style={{
            background: WARM.bg,
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : WARM.border}`,
            backdropFilter: 'blur(40px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(232,151,108,0.1)',
            animation: 'dsDropdownIn 0.25s ease',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{
            borderBottom: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.6)'}`,
          }}>
            <div className="flex items-center gap-2.5">
              <ProgressRing done={doneCount} total={totalCount} ghostMode={ghostMode} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tracking-[0.12em] uppercase font-semibold" style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: ghostMode ? 'rgba(160,160,160,0.5)' : WARM.accent,
                  }}>
                    Daily Stack
                  </span>
                  <StreakBadge streak={streak} ghostMode={ghostMode} size="md" />
                </div>
                <span className="text-[9px] font-mono block mt-0.5" style={{
                  color: ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(138,126,114,0.4)',
                }}>
                  {allDone ? 'ALL SUPPLEMENTS VERIFIED ✓' : `${totalCount - doneCount} remaining today`}
                </span>
              </div>
            </div>

            {/* Status dot */}
            <div className="flex items-center gap-1.5">
              <div className="w-[6px] h-[6px] rounded-full" style={{
                background: ghostMode ? 'rgba(160,160,160,0.3)' : (allDone ? WARM.green : doneCount > 0 ? WARM.accent : 'rgba(138,126,114,0.3)'),
                boxShadow: allDone && !ghostMode ? `0 0 6px ${WARM.green}60` : doneCount > 0 && !ghostMode ? `0 0 6px ${WARM.accent}60` : 'none',
                animation: 'dsStatusPulse 2.5s ease-in-out infinite',
              }} />
              <span className="text-[7px] font-mono tracking-[0.1em] uppercase" style={{
                color: ghostMode ? 'rgba(160,160,160,0.25)' : (allDone ? WARM.green : doneCount > 0 ? `${WARM.accent}88` : 'rgba(138,126,114,0.3)'),
              }}>
                {allDone ? 'COMPLETE' : doneCount > 0 ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          {/* Supplement List */}
          <div className="px-3 py-2 space-y-1 max-h-[320px] overflow-y-auto" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(232,151,108,0.1) transparent',
          }}>
            {supplements.map((item, idx) => (
              <SupplementRow
                key={item._id}
                name={item.name}
                icon={item.icon}
                description={item.description}
                category={item.category}
                completed={completionMap.has(item._id)}
                onToggle={() => handleToggle(item)}
                ghostMode={ghostMode}
                animDelay={0.03 * idx}
              />
            ))}
          </div>

          {/* Streak Footer */}
          {streakData && streakData.totalDaysLogged > 0 && (
            <div className="px-4 pb-3 pt-1.5 flex items-center justify-between" style={{
              borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)'}`,
            }}>
              <span className="text-[8px] font-mono tracking-wider uppercase" style={{
                color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
              }}>
                Best: {streakData.longestStreak}d
              </span>
              <span className="text-[8px] font-mono tracking-wider uppercase" style={{
                color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
              }}>
                {streakData.totalDaysLogged} days tracked
              </span>
            </div>
          )}

          {/* Ambient scan line */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden" style={{ opacity: 0.02 }}>
            <div className="absolute left-0 w-full h-[1px]" style={{
              background: `linear-gradient(90deg, transparent, ${ghostMode ? 'rgba(160,160,160,0.6)' : WARM.accent}, transparent)`,
              animation: 'dsScanline 8s linear infinite',
            }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes dsDropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dsStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes dsScanline {
          0% { top: -2%; }
          100% { top: 102%; }
        }
        @keyframes dsSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Elite Protocol Data ── */
const ELITE_PROTOCOLS = [
  { icon: '🧬', name: 'NAD+ IV Protocol', desc: '500mg cellular restoration', category: 'longevity' },
  { icon: '💉', name: 'BPC-157 Peptide', desc: '250mcg tissue repair cycle', category: 'longevity' },
  { icon: '🧪', name: 'Rapamycin 2mg', desc: 'Weekly mTOR modulation', category: 'longevity' },
  { icon: '❄️', name: 'Thymosin Alpha-1', desc: '1.6mg immune optimization', category: 'longevity' },
  { icon: '⚡', name: 'Methylene Blue', desc: '15mg mitochondrial support', category: 'cognitive' },
];

/* ── Premium Protocol Lock ── */
function PremiumProtocolSection({ ghostMode, onUpgrade }: { ghostMode: boolean; onUpgrade: () => void }) {
  const color = ghostMode ? 'rgba(160,160,160,0.5)' : WARM.amber;
  const lockColor = ghostMode ? 'rgba(160,160,160,0.4)' : WARM.amber;

  return (
    <div className="relative mt-2">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{
          background: ghostMode ? 'rgba(160,160,160,0.04)' : `${WARM.amber}08`,
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${WARM.amber}18`}`,
        }}>
          <span style={{ fontSize: 8 }}>🔒</span>
          <span className="text-[8px] font-mono font-bold tracking-[0.15em] uppercase" style={{ color: lockColor }}>
            Elite Tier
          </span>
        </div>
        <div className="flex-1 h-[1px]" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : `${WARM.amber}10` }} />
      </div>

      {/* Blurred Protocol Rows */}
      <div className="relative">
        <div className="pointer-events-none select-none space-y-1" style={{ filter: 'blur(5px) saturate(0.4)', opacity: 0.5 }} aria-hidden="true">
          {ELITE_PROTOCOLS.map((p) => (
            <div key={p.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{
              background: 'rgba(255,255,255,0.015)',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.5)'}`,
            }}>
              <div className="w-[18px] h-[18px] rounded-md flex items-center justify-center" style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(196,164,108,0.1)'}`,
              }} />
              <span className="text-sm flex-shrink-0">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold block truncate" style={{ color: WARM.text }}>{p.name}</span>
                <span className="text-[9px] block truncate" style={{ color: 'rgba(138,126,114,0.4)' }}>{p.desc}</span>
              </div>
              <span className="text-[7px] font-mono tracking-[0.12em] uppercase" style={{ color: 'rgba(138,126,114,0.25)' }}>TAP</span>
            </div>
          ))}
        </div>

        {/* Glass overlay with lock + upgrade CTA */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl" style={{
          background: ghostMode ? 'rgba(10,10,10,0.3)' : 'rgba(18,16,14,0.25)',
          backdropFilter: 'blur(6px) saturate(0.7)',
          WebkitBackdropFilter: 'blur(6px) saturate(0.7)',
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(196,164,108,0.1)'}`,
        }}>
          {/* Lock icon */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{
            background: ghostMode ? 'rgba(160,160,160,0.06)' : `${WARM.amber}10`,
            border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${WARM.amber}25`}`,
            boxShadow: ghostMode ? 'none' : `0 0 16px ${WARM.amber}08`,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={lockColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" fill={lockColor} />
            </svg>
          </div>
          <span className="text-[10px] font-semibold mb-0.5" style={{ color: lockColor }}>Advanced Longevity Protocols</span>
          <span className="text-[8px] mb-3 max-w-[200px] text-center leading-relaxed" style={{ color: WARM.muted }}>
            NAD+, Peptides, Rapamycin & more require Elite membership
          </span>
          <button
            onClick={onUpgrade}
            className="px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.08em] uppercase transition-all duration-200 hover:scale-[1.04] active:scale-[0.96]"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.08)' : `linear-gradient(135deg, ${WARM.amber}20, ${WARM.amber}10)`,
              color: lockColor,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${WARM.amber}30`}`,
              boxShadow: ghostMode ? 'none' : `0 2px 10px ${WARM.amber}10`,
            }}
          >
            Upgrade to Elite
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EXPANDED MODE — Full panel widget (for dashboard body)
   ══════════════════════════════════════════════════════════════ */

function ExpandedDailyStack({ sessionId, ghostMode = false }: { sessionId: string; ghostMode: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const dateKey = getTodayDateKey();

  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, sessionId ? { sessionId } : 'skip');
  const dailyCompletions = useQuery(api.protocols.getDailyCompletions, sessionId ? { sessionId, dateKey } : 'skip');
  const streakData = useQuery(api.protocols.getSupplementStreak, sessionId ? { sessionId } : 'skip');
  const toggleDailyCompletion = useMutation(api.protocols.toggleDailyCompletion);
  const oneTapVerify = useMutation(api.protocols.oneTapVerify);

  // Check membership tier — safe defaults when loading (undefined) or missing (null)
  const userPrefs = useQuery(api.queries.getUserPreferences, sessionId ? { sessionId } : 'skip');
  // Three states: undefined = still loading, null = query returned null, object = data ready
  // Safe: default to non-elite during loading AND when prefs missing (new user initialState)
  const prefsLoaded = userPrefs !== undefined;
  const isElite = (prefsLoaded && userPrefs != null)
    ? (userPrefs.membershipTier === 'elite' || userPrefs.userStyle === 'elite')
    : false;
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const supplements = useMemo(() =>
    (protocolStatus?.items ?? []).filter((item) => item.category === 'supplement'),
    [protocolStatus]
  );

  const completionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (dailyCompletions) {
      for (const c of dailyCompletions) {
        if (c.completed) map.set(c.protocolId, true);
      }
    }
    return map;
  }, [dailyCompletions]);

  const doneCount = supplements.filter((s) => completionMap.has(s._id)).length;
  const totalCount = supplements.length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const streak = streakData?.streak ?? 0;

  const handleToggle = useCallback(async (item: typeof supplements[0]) => {
    if (!sessionId) return;
    await toggleDailyCompletion({
      sessionId,
      protocolId: item._id,
      protocolName: item.name,
      category: item.category,
    });
    try {
      await oneTapVerify({ sessionId, protocolId: item._id as any });
    } catch { /* non-critical */ }
  }, [sessionId, toggleDailyCompletion, oneTapVerify]);

  if (!sessionId) {
    return (
      <div className="rounded-2xl p-4 text-center" style={{
        background: 'rgba(26,24,22,0.6)',
        border: `1px solid ${WARM.borderSubtle}`,
      }}>
        <span className="text-[10px] font-mono" style={{ color: WARM.muted }}>Session required</span>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: ghostMode ? 'rgba(30,30,30,0.6)' : 'rgba(26,24,22,0.6)',
        border: `1px solid ${allDone && !ghostMode ? 'rgba(124,182,142,0.15)' : (ghostMode ? 'rgba(160,160,160,0.06)' : WARM.borderSubtle)}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: allDone && !ghostMode
          ? '0 4px 24px rgba(0,0,0,0.3), 0 0 30px rgba(124,182,142,0.04)'
          : '0 4px 24px rgba(0,0,0,0.3)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{
        borderBottom: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(42,38,34,0.5)'}`,
      }}>
        <div className="flex items-center gap-2.5">
          <ProgressRing done={doneCount} total={totalCount} ghostMode={ghostMode} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[0.12em] uppercase font-semibold" style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : WARM.accent,
              }}>
                Daily Stack
              </span>
              <StreakBadge streak={streak} ghostMode={ghostMode} size="md" />
            </div>
            <span className="text-[9px] font-mono block mt-0.5" style={{
              color: ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(138,126,114,0.4)',
            }}>
              {allDone ? 'ALL SUPPLEMENTS VERIFIED ✓' : `${totalCount - doneCount} remaining today`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full" style={{
            background: ghostMode ? 'rgba(160,160,160,0.3)' : (allDone ? WARM.green : doneCount > 0 ? WARM.accent : 'rgba(138,126,114,0.3)'),
            boxShadow: allDone && !ghostMode ? `0 0 6px ${WARM.green}60` : 'none',
            animation: 'dsStatusPulse 2.5s ease-in-out infinite',
          }} />
          <span className="text-[7px] font-mono tracking-[0.1em] uppercase" style={{
            color: ghostMode ? 'rgba(160,160,160,0.25)' : (allDone ? WARM.green : doneCount > 0 ? `${WARM.accent}88` : 'rgba(138,126,114,0.3)'),
          }}>
            {allDone ? 'COMPLETE' : doneCount > 0 ? 'ACTIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Supplement List */}
      <div className="px-3 py-2 space-y-1.5">
        {supplements.length === 0 ? (
          <div className="text-center py-6">
            <span className="text-lg block mb-2">💊</span>
            <span className="text-[10px] block" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.muted }}>
              No supplements in your protocol yet
            </span>
            <span className="text-[9px] font-mono block mt-1" style={{ color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)' }}>
              Add supplements via the Protocol Engine
            </span>
          </div>
        ) : (
          supplements.map((item, idx) => (
            <SupplementRow
              key={item._id}
              name={item.name}
              icon={item.icon}
              description={item.description}
              category={item.category}
              completed={completionMap.has(item._id)}
              onToggle={() => handleToggle(item)}
              ghostMode={ghostMode}
              animDelay={0.03 * idx}
            />
          ))
        )}
      </div>

      {/* Premium Protocol Lock — Elite Tier Section (only render after prefs fully loaded, skip during loading) */}
      {prefsLoaded && !isElite && (
        <div className="px-3 pb-2">
          <PremiumProtocolSection ghostMode={ghostMode} onUpgrade={() => setCheckoutOpen(true)} />
        </div>
      )}

      {/* Streak Footer */}
      {streakData && streakData.totalDaysLogged > 0 && (
        <div className="px-4 pb-3 pt-1" style={{
          borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)'}`,
        }}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono tracking-wider uppercase" style={{
              color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
            }}>
              Best: {streakData.longestStreak}d
            </span>
            <span className="text-[8px] font-mono tracking-wider uppercase" style={{
              color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
            }}>
              {streakData.totalDaysLogged} days tracked
            </span>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} ghostMode={ghostMode} />

      {/* Ambient scan line */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden" style={{ opacity: 0.02 }}>
        <div className="absolute left-0 w-full h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${ghostMode ? 'rgba(160,160,160,0.6)' : WARM.accent}, transparent)`,
          animation: 'dsScanline 8s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes dsStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes dsScanline {
          0% { top: -2%; }
          100% { top: 102%; }
        }
        @keyframes dsSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT — Switches between compact and expanded
   ══════════════════════════════════════════════════════════════ */

export function DailyStack({ sessionId, mode = 'expanded', ghostMode = false }: DailyStackProps) {
  if (mode === 'compact') {
    return <CompactDailyStack sessionId={sessionId} ghostMode={ghostMode} />;
  }
  return <ExpandedDailyStack sessionId={sessionId} ghostMode={ghostMode} />;
}

/* ── Named export for header integration ── */
export function DailyStackHeaderWidget({ sessionId, ghostMode = false }: { sessionId: string; ghostMode: boolean }) {
  return <CompactDailyStack sessionId={sessionId} ghostMode={ghostMode} />;
}

export default DailyStack;
