import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════
   PROTOCOL ENGINE — Personalized Daily Checklist
   
   Convex-connected daily protocol checklist with FluidCanvas
   aesthetic. Pulls real supplement/intervention data, allows
   real-time toggle completion, grouped by time-of-day.
   ══════════════════════════════════════════════════════════════ */

const SESSION_ID = 'vive-user-001';

/* ── Palette (FluidCanvas aesthetic) ── */
const P = {
  accent: '#E8976C',
  green: '#7CB68E',
  amber: '#C4A46C',
  red: '#D4847A',
  cyan: '#00E5CC',
  violet: '#B8A9C9',
  text: '#E8E0D8',
  muted: '#8A7E72',
  bg: 'rgba(26,24,22,0.95)',
  bgCard: 'rgba(30,28,26,0.7)',
  border: 'rgba(232,151,108,0.12)',
  borderSubtle: 'rgba(42,38,34,0.8)',
};

const CATEGORY_META: Record<string, { color: string; icon: string; label: string }> = {
  supplement: { color: P.accent, icon: '💊', label: 'SUPPLEMENT' },
  recovery: { color: P.green, icon: '🛡️', label: 'RECOVERY' },
  movement: { color: P.violet, icon: '🏃', label: 'MOVEMENT' },
  nutrition: { color: P.amber, icon: '🥩', label: 'NUTRITION' },
  cognitive: { color: P.cyan, icon: '🧠', label: 'COGNITIVE' },
};

const TIME_ORDER: Record<string, number> = {
  morning: 0, afternoon: 1, evening: 2, 'all-day': 3,
};

const TIME_META: Record<string, { label: string; icon: string; color: string }> = {
  morning: { label: 'MORNING', icon: '☀️', color: '#E8976C' },
  afternoon: { label: 'AFTERNOON', icon: '🌤️', color: '#C4A46C' },
  evening: { label: 'EVENING', icon: '🌙', color: '#B8A9C9' },
  'all-day': { label: 'ALL DAY', icon: '⏳', color: P.muted },
};

/* ── Types ── */
interface ProtocolItem {
  _id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  timeOfDay: string;
  sortOrder: number;
  source: string;
  completed: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS RING — Animated circular progress
   ═══════════════════════════════════════════════════════════════ */
function ProgressRing({ done, total, size = 56 }: { done: number; total: number; size?: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const center = size / 2;

  const color = pct >= 100 ? P.green : pct >= 50 ? P.accent : P.amber;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(232,151,108,0.06)" strokeWidth="3.5" />
        <circle
          cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s',
            filter: `drop-shadow(0 0 6px ${color}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[14px] font-bold tabular-nums" style={{
          color, textShadow: `0 0 8px ${color}44`,
        }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STREAK BADGE
   ═══════════════════════════════════════════════════════════════ */
function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  const color = streak >= 7 ? P.green : streak >= 3 ? P.accent : P.amber;
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{
      background: `${color}0A`,
      border: `1px solid ${color}20`,
    }}>
      <span style={{ fontSize: 10 }}>{streak >= 7 ? '🔥' : '⚡'}</span>
      <span className="font-mono font-semibold tabular-nums" style={{ fontSize: 10, color }}>
        {streak}d streak
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL ROW — Individual checklist item
   ═══════════════════════════════════════════════════════════════ */
function ProtocolRow({
  item, onToggle, animDelay,
}: {
  item: ProtocolItem;
  onToggle: () => void;
  animDelay: number;
}) {
  const [flash, setFlash] = useState(false);
  const meta = CATEGORY_META[item.category] || CATEGORY_META.supplement;
  const color = meta.color;

  const handleClick = useCallback(() => {
    if (!item.completed) {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
      window.dispatchEvent(new CustomEvent('vive-optimization-pulse', {
        detail: { category: item.category, color, timestamp: Date.now() },
      }));
    }
    onToggle();
  }, [item.completed, item.category, color, onToggle]);

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left group transition-all duration-300 active:scale-[0.98]"
      style={{
        background: item.completed ? `${color}08` : 'rgba(255,255,255,0.015)',
        border: `1px solid ${item.completed ? `${color}18` : 'rgba(42,38,34,0.5)'}`,
        boxShadow: flash
          ? `0 0 24px ${color}30, inset 0 0 16px ${color}08`
          : item.completed ? `0 0 12px ${color}08` : 'none',
        animation: `peSlideIn 0.35s ease both ${animDelay}s`,
      }}
    >
      {/* Checkbox */}
      <div className="relative flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-300" style={{
        background: item.completed ? `${color}18` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${item.completed ? color : 'rgba(232,151,108,0.12)'}`,
        boxShadow: item.completed ? `0 0 10px ${color}35` : 'none',
      }}>
        {item.completed && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <span className="text-base flex-shrink-0 transition-all duration-300" style={{
        opacity: item.completed ? 0.4 : 0.9,
        transform: item.completed ? 'scale(0.9)' : 'scale(1)',
      }}>
        {item.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-wide truncate transition-all duration-300" style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            color: item.completed ? `${color}70` : P.text,
            textDecoration: item.completed ? 'line-through' : 'none',
            textDecorationColor: `${color}40`,
          }}>
            {item.name}
          </span>
          {item.source === 'ai' && (
            <span className="text-[7px] font-mono tracking-[0.1em] px-1.5 py-0.5 rounded-full" style={{
              background: 'rgba(0,229,204,0.08)',
              color: P.cyan,
              border: '1px solid rgba(0,229,204,0.15)',
            }}>
              AI
            </span>
          )}
        </div>
        <span className="text-[9px] block truncate mt-0.5" style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: 'rgba(138,126,114,0.45)',
        }}>
          {item.description}
        </span>
      </div>

      {/* Category + Status */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[7px] font-mono tracking-[0.12em] uppercase px-1.5 py-0.5 rounded" style={{
          color: `${color}80`,
          background: `${color}08`,
        }}>
          {meta.label}
        </span>
        <span className="text-[7px] font-mono tracking-[0.1em] uppercase" style={{
          color: item.completed ? `${color}60` : 'rgba(138,126,114,0.25)',
        }}>
          {item.completed ? '✓ VERIFIED' : 'TAP'}
        </span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TIME GROUP — Groups protocols by time of day
   ═══════════════════════════════════════════════════════════════ */
function TimeGroup({
  timeOfDay, items, onToggle, baseDelay,
}: {
  timeOfDay: string;
  items: ProtocolItem[];
  onToggle: (id: string) => void;
  baseDelay: number;
}) {
  const meta = TIME_META[timeOfDay] || TIME_META['all-day'];
  const doneCount = items.filter(i => i.completed).length;
  const allDone = items.length > 0 && doneCount === items.length;

  return (
    <div className="space-y-1.5">
      {/* Time header */}
      <div className="flex items-center justify-between px-1 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs">{meta.icon}</span>
          <span className="text-[10px] font-mono tracking-[0.15em] uppercase font-semibold" style={{
            color: allDone ? `${P.green}90` : `${meta.color}80`,
          }}>
            {meta.label}
          </span>
          <span className="text-[9px] font-mono tabular-nums" style={{
            color: allDone ? P.green : 'rgba(138,126,114,0.4)',
          }}>
            {doneCount}/{items.length}
          </span>
        </div>
        {allDone && (
          <span className="text-[7px] font-mono tracking-[0.12em] uppercase px-2 py-0.5 rounded-full" style={{
            color: P.green,
            background: 'rgba(124,182,142,0.08)',
            border: '1px solid rgba(124,182,142,0.15)',
          }}>
            COMPLETE ✓
          </span>
        )}
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item, idx) => (
          <ProtocolRow
            key={item._id}
            item={item}
            onToggle={() => onToggle(item._id)}
            animDelay={baseDelay + idx * 0.04}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AI SUGGESTIONS PANEL
   ═══════════════════════════════════════════════════════════════ */
function AISuggestions({ sessionId }: { sessionId: string }) {
  const suggestions = useQuery(api.protocols.getAISuggestions, { sessionId });
  const createProtocol = useMutation(api.protocols.createProtocol);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const handleAdd = useCallback(async (s: NonNullable<typeof suggestions>[0]) => {
    setAdding(s.name);
    try {
      await createProtocol({
        sessionId,
        name: s.name,
        category: s.category,
        icon: s.icon,
        description: s.description,
        timeOfDay: s.timeOfDay,
        source: 'ai',
      });
      setAdded(prev => new Set(prev).add(s.name));
    } catch { /* ignore */ }
    setAdding(null);
  }, [sessionId, createProtocol]);

  if (!suggestions || suggestions.length === 0) return null;

  const PRIORITY_COLORS: Record<string, string> = {
    high: '#D4847A',
    medium: P.amber,
    low: P.muted,
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: 'rgba(0,229,204,0.03)',
      border: '1px solid rgba(0,229,204,0.1)',
    }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{
        borderBottom: '1px solid rgba(0,229,204,0.06)',
      }}>
        <span className="text-xs">🧬</span>
        <span className="text-[10px] font-mono tracking-[0.15em] uppercase font-semibold" style={{ color: P.cyan }}>
          AI-SUGGESTED PROTOCOLS
        </span>
        <span className="text-[8px] font-mono" style={{ color: 'rgba(0,229,204,0.4)' }}>
          Based on your biomarkers
        </span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {suggestions.map((s) => {
          const isAdded = added.has(s.name);
          const isAdding = adding === s.name;
          const pColor = PRIORITY_COLORS[s.priority] || P.muted;
          return (
            <div key={s.name} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{
              background: isAdded ? 'rgba(124,182,142,0.06)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${isAdded ? 'rgba(124,182,142,0.15)' : 'rgba(42,38,34,0.5)'}`,
            }}>
              <span className="text-base flex-shrink-0 mt-0.5">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: P.text }}>{s.name}</span>
                  <span className="text-[7px] font-mono tracking-[0.1em] uppercase px-1.5 py-0.5 rounded" style={{
                    color: pColor,
                    background: `${pColor}10`,
                  }}>
                    {s.priority}
                  </span>
                </div>
                <span className="text-[9px] block mt-0.5" style={{ color: 'rgba(138,126,114,0.5)' }}>
                  {s.description}
                </span>
                <span className="text-[8px] block mt-1 italic" style={{ color: 'rgba(0,229,204,0.45)' }}>
                  {s.reason}
                </span>
              </div>
              <button
                onClick={() => !isAdded && !isAdding && handleAdd(s)}
                disabled={isAdded || isAdding}
                className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-wider uppercase transition-all duration-300"
                style={{
                  background: isAdded ? 'rgba(124,182,142,0.1)' : 'rgba(0,229,204,0.08)',
                  color: isAdded ? P.green : P.cyan,
                  border: `1px solid ${isAdded ? 'rgba(124,182,142,0.2)' : 'rgba(0,229,204,0.15)'}`,
                  opacity: isAdding ? 0.5 : 1,
                }}
              >
                {isAdded ? '✓ ADDED' : isAdding ? '...' : '+ ADD'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT — ProtocolEngine
   ═══════════════════════════════════════════════════════════════ */
export default function ProtocolEngine() {
  const [mounted, setMounted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const seeded = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Convex Queries ──
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId: SESSION_ID });
  const streakData = useQuery(api.protocols.getSupplementStreak, { sessionId: SESSION_ID });
  const adherenceData = useQuery(api.protocols.getAdherenceScore, { sessionId: SESSION_ID });

  // ── Mutations ──
  const toggleCompletion = useMutation(api.protocols.toggleCompletion);
  const oneTapVerify = useMutation(api.protocols.oneTapVerify);
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore);
  const seedDefaults = useMutation(api.protocols.seedDefaults);

  // ── Seed defaults on first load if empty ──
  useEffect(() => {
    if (protocolStatus && protocolStatus.items.length === 0 && !seeded.current) {
      seeded.current = true;
      seedDefaults({ sessionId: SESSION_ID }).catch(() => {});
    }
  }, [protocolStatus, seedDefaults]);

  // ── Items ──
  const items: ProtocolItem[] = useMemo(() =>
    (protocolStatus?.items ?? []).map(i => ({
      ...i,
      source: i.source ?? 'system',
    })),
    [protocolStatus]
  );

  const done = protocolStatus?.done ?? 0;
  const total = protocolStatus?.total ?? 0;
  const allDone = total > 0 && done === total;
  const streak = streakData?.streak ?? 0;

  // ── Group by time of day ──
  const timeGroups = useMemo(() => {
    const groups = new Map<string, ProtocolItem[]>();
    for (const item of items) {
      const tod = item.timeOfDay || 'all-day';
      if (!groups.has(tod)) groups.set(tod, []);
      groups.get(tod)!.push(item);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => (TIME_ORDER[a] ?? 99) - (TIME_ORDER[b] ?? 99));
  }, [items]);

  // ── Toggle handler ──
  const handleToggle = useCallback(async (protocolId: string) => {
    try {
      await toggleCompletion({ sessionId: SESSION_ID, protocolId: protocolId as any });
    } catch { /* ignore */ }
    try {
      await oneTapVerify({ sessionId: SESSION_ID, protocolId: protocolId as any });
    } catch { /* non-critical */ }
    try {
      await updateAdherence({ sessionId: SESSION_ID });
    } catch { /* non-critical */ }
  }, [toggleCompletion, oneTapVerify, updateAdherence]);

  // ── Category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const cats = new Map<string, { total: number; done: number }>();
    for (const item of items) {
      const cat = item.category;
      if (!cats.has(cat)) cats.set(cat, { total: 0, done: 0 });
      const entry = cats.get(cat)!;
      entry.total++;
      if (item.completed) entry.done++;
    }
    return Array.from(cats.entries());
  }, [items]);

  if (!mounted) return null;

  return (
    <div
      className="relative min-h-screen pb-32"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* ── Header Section ── */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ProgressRing done={done} total={total} size={56} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] tracking-[0.15em] uppercase font-semibold" style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  color: P.accent,
                }}>
                  Protocol Engine
                </h2>
                <StreakBadge streak={streak} />
              </div>
              <span className="text-[10px] font-mono block mt-0.5" style={{
                color: allDone ? P.green : 'rgba(138,126,114,0.5)',
              }}>
                {allDone
                  ? 'ALL PROTOCOLS VERIFIED ✓'
                  : `${total - done} of ${total} remaining today`}
              </span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-[7px] h-[7px] rounded-full" style={{
              background: allDone ? P.green : done > 0 ? P.accent : 'rgba(138,126,114,0.3)',
              boxShadow: allDone ? `0 0 8px ${P.green}60` : done > 0 ? `0 0 8px ${P.accent}60` : 'none',
              animation: 'pePulse 2.5s ease-in-out infinite',
            }} />
            <span className="text-[8px] font-mono tracking-[0.12em] uppercase" style={{
              color: allDone ? P.green : done > 0 ? `${P.accent}88` : 'rgba(138,126,114,0.3)',
            }}>
              {allDone ? 'COMPLETE' : done > 0 ? 'IN PROGRESS' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Category breakdown bar */}
        {categoryBreakdown.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categoryBreakdown.map(([cat, data]) => {
              const meta = CATEGORY_META[cat] || CATEGORY_META.supplement;
              const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
              return (
                <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{
                  background: pct === 100 ? `${meta.color}0A` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${pct === 100 ? `${meta.color}18` : 'rgba(42,38,34,0.5)'}`,
                }}>
                  <span className="text-[10px]">{meta.icon}</span>
                  <span className="text-[8px] font-mono tracking-wider uppercase" style={{
                    color: pct === 100 ? meta.color : 'rgba(138,126,114,0.5)',
                  }}>
                    {cat}
                  </span>
                  <span className="text-[9px] font-mono font-bold tabular-nums" style={{
                    color: pct === 100 ? P.green : meta.color,
                  }}>
                    {data.done}/{data.total}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Adherence Score Bar ── */}
      {adherenceData && adherenceData.totalProtocols > 0 && (
        <div className="mx-4 mb-4 px-4 py-2.5 rounded-xl" style={{
          background: 'rgba(232,151,108,0.04)',
          border: `1px solid ${P.border}`,
        }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono tracking-[0.12em] uppercase" style={{ color: P.muted }}>
              TODAY&apos;S ADHERENCE
            </span>
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{
              color: adherenceData.adherencePercent >= 80 ? P.green
                : adherenceData.adherencePercent >= 50 ? P.accent : P.red,
            }}>
              {adherenceData.adherencePercent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,38,34,0.6)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{
              width: `${adherenceData.adherencePercent}%`,
              background: adherenceData.adherencePercent >= 80
                ? `linear-gradient(90deg, ${P.green}, ${P.green}cc)`
                : adherenceData.adherencePercent >= 50
                  ? `linear-gradient(90deg, ${P.accent}, ${P.accent}cc)`
                  : `linear-gradient(90deg, ${P.red}, ${P.red}cc)`,
              boxShadow: `0 0 8px ${adherenceData.adherencePercent >= 80 ? P.green : P.accent}40`,
            }} />
          </div>
        </div>
      )}

      {/* ── Protocol Checklist (grouped by time) ── */}
      <div className="px-4 space-y-5">
        {items.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{
            background: P.bgCard,
            border: `1px solid ${P.borderSubtle}`,
          }}>
            <span className="text-3xl block mb-3">⚡</span>
            <span className="text-[12px] font-semibold block" style={{ color: P.text }}>
              Initializing Protocol Engine
            </span>
            <span className="text-[10px] font-mono block mt-1" style={{ color: P.muted }}>
              Loading your personalized daily stack...
            </span>
          </div>
        ) : (
          timeGroups.map(([tod, groupItems], gIdx) => (
            <TimeGroup
              key={tod}
              timeOfDay={tod}
              items={groupItems}
              onToggle={handleToggle}
              baseDelay={gIdx * 0.1}
            />
          ))
        )}
      </div>

      {/* ── AI Suggestions Toggle ── */}
      {items.length > 0 && (
        <div className="px-4 mt-6">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-300"
            style={{
              background: showSuggestions ? 'rgba(0,229,204,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${showSuggestions ? 'rgba(0,229,204,0.15)' : 'rgba(42,38,34,0.5)'}`,
            }}
          >
            <span className="text-xs">🧬</span>
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase" style={{
              color: showSuggestions ? P.cyan : P.muted,
            }}>
              {showSuggestions ? 'HIDE AI SUGGESTIONS' : 'VIEW AI SUGGESTIONS'}
            </span>
            <span className="text-[10px] transition-transform duration-300" style={{
              transform: showSuggestions ? 'rotate(180deg)' : 'rotate(0)',
              color: P.muted,
            }}>
              ▼
            </span>
          </button>

          {showSuggestions && (
            <div className="mt-3" style={{ animation: 'peFadeIn 0.3s ease' }}>
              <AISuggestions sessionId={SESSION_ID} />
            </div>
          )}
        </div>
      )}

      {/* ── Completion celebration ── */}
      {allDone && (
        <div className="mx-4 mt-6 px-4 py-4 rounded-xl text-center" style={{
          background: 'rgba(124,182,142,0.06)',
          border: '1px solid rgba(124,182,142,0.15)',
          animation: 'peFadeIn 0.5s ease',
        }}>
          <span className="text-2xl block mb-2">🏆</span>
          <span className="text-[12px] font-semibold block" style={{ color: P.green }}>
            All Protocols Verified
          </span>
          <span className="text-[9px] font-mono block mt-1" style={{ color: 'rgba(124,182,142,0.6)' }}>
            {streak > 0 ? `${streak}-day streak maintained · ` : ''}Elite Score updated in real-time
          </span>
        </div>
      )}

      {/* ── Ambient scan line ── */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden" style={{ opacity: 0.015 }}>
        <div className="absolute left-0 w-full h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${P.accent}, transparent)`,
          animation: 'peScanline 10s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes peSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes peFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes peScanline {
          0% { top: -2%; }
          100% { top: 102%; }
        }
      `}</style>
    </div>
  );
}

export { ProtocolEngine };
