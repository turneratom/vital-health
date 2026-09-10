import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════
   PROTOCOL DASHBOARD
   
   Daily habits view: morning sunlight, cold exposure, supplements,
   training, nutrition — grouped by time-of-day with one-tap verify.
   Feeds completion data into the HUD progress ring.
   ══════════════════════════════════════════════════════════════ */

const WARM = {
  terra: '#E8976C',
  sage: '#7CB68E',
  sky: '#6BA3BE',
  gold: '#C4A46C',
  rose: '#D4847A',
  sand: '#E8E0D8',
  cardBg: 'rgba(26,24,22,0.7)',
  cardBorder: 'rgba(42,38,34,0.6)',
  textPrimary: '#E8E0D8',
  textSecondary: '#B0A89E',
  textDim: '#8A7E72',
};

const CATEGORY_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  supplement: { color: '#C4A46C', label: 'Supplements', icon: '\uD83D\uDC8A' },
  training: { color: '#E8976C', label: 'Training', icon: '\uD83C\uDFCB\uFE0F' },
  biohacking: { color: '#6BA3BE', label: 'Bio-Hacking', icon: '\u26A1' },
  nutrition: { color: '#7CB68E', label: 'Nutrition', icon: '\uD83E\uDD57' },
  recovery: { color: '#D4847A', label: 'Recovery', icon: '\uD83D\uDE34' },
  movement: { color: '#E8976C', label: 'Movement', icon: '\uD83D\uDEB6' },
};

const TIME_GROUPS = [
  { key: 'morning', label: 'Morning', icon: '\u2600\uFE0F', range: '6am \u2013 12pm' },
  { key: 'afternoon', label: 'Afternoon', icon: '\uD83C\uDF24\uFE0F', range: '12pm \u2013 6pm' },
  { key: 'evening', label: 'Evening', icon: '\uD83C\uDF19', range: '6pm \u2013 11pm' },
  { key: 'all-day', label: 'All Day', icon: '\uD83D\uDD04', range: 'Anytime' },
];

type CategoryFilter = 'all' | string;

function getSessionId(): string {
  try {
    let id = localStorage.getItem('vive-session-id');
    if (!id) {
      id = 'guest-' + crypto.randomUUID().slice(0, 8);
      localStorage.setItem('vive-session-id', id);
    }
    return id;
  } catch {
    return 'guest-user';
  }
}

/* ── Circular progress for the header ── */
function HeaderProgress({ done, total, percentage }: { done: number; total: number; percentage: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);

  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(232,151,108,0.08)" strokeWidth="4" />
        <motion.circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={percentage >= 100 ? WARM.sage : WARM.terra}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 18, fontWeight: 800,
          color: percentage >= 100 ? WARM.sage : WARM.terra,
          lineHeight: 1,
        }}>
          {percentage}
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: 7, fontWeight: 600,
          color: WARM.textDim, letterSpacing: '0.1em',
          textTransform: 'uppercase', marginTop: 2,
        }}>
          {done}/{total}
        </span>
      </div>
    </div>
  );
}

/* ── Protocol Item Card ── */
function ProtocolCard({
  item,
  onToggle,
  isToggling,
}: {
  item: {
    _id: string;
    name: string;
    category: string;
    icon: string;
    description: string;
    timeOfDay: string;
    completed: boolean;
    source: string;
  };
  onToggle: (id: string) => void;
  isToggling: boolean;
}) {
  const cat = CATEGORY_CONFIG[item.category] || { color: WARM.terra, label: item.category, icon: '\uD83D\uDD18' };
  const [justCompleted, setJustCompleted] = useState(false);

  const handleTap = useCallback(() => {
    if (isToggling) return;
    if (!item.completed) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    }
    onToggle(item._id);
  }, [item._id, item.completed, isToggling, onToggle]);

  return (
    <motion.button
      onClick={handleTap}
      disabled={isToggling}
      layout
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        borderRadius: 16,
        background: item.completed
          ? 'linear-gradient(135deg, rgba(124,182,142,0.08) 0%, rgba(124,182,142,0.03) 100%)'
          : WARM.cardBg,
        border: `1px solid ${item.completed ? 'rgba(124,182,142,0.2)' : WARM.cardBorder}`,
        cursor: isToggling ? 'wait' : 'pointer',
        transition: 'all 0.25s ease',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Completion flash */}
      <AnimatePresence>
        {justCompleted && (
          <motion.div
            initial={{ opacity: 0.6, scale: 0 }}
            animate={{ opacity: 0, scale: 3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%', left: 24,
              width: 40, height: 40,
              borderRadius: '50%',
              background: 'rgba(124,182,142,0.3)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Checkbox */}
      <div style={{
        width: 28, height: 28, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: item.completed ? 'rgba(124,182,142,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${item.completed ? 'rgba(124,182,142,0.4)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.25s ease',
      }}>
        {item.completed ? (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
          >
            <path d="M5 13l4 4L19 7" stroke={WARM.sage} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        ) : (
          <span style={{ fontSize: 14 }}>{item.icon}</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 13, fontWeight: 600,
          color: item.completed ? 'rgba(124,182,142,0.7)' : WARM.textPrimary,
          textDecoration: item.completed ? 'line-through' : 'none',
          textDecorationColor: 'rgba(124,182,142,0.3)',
          lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 10, fontWeight: 400,
          color: item.completed ? 'rgba(124,182,142,0.4)' : WARM.textDim,
          marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.description}
        </div>
      </div>

      {/* Category badge */}
      <div style={{
        padding: '3px 8px', borderRadius: 8, flexShrink: 0,
        background: `${cat.color}10`,
        border: `1px solid ${cat.color}20`,
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 8, fontWeight: 600,
          color: `${cat.color}88`, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {cat.label}
        </span>
      </div>
    </motion.button>
  );
}

/* ── Main Protocol Dashboard ── */
export default function ProtocolDashboard() {
  const sessionId = useMemo(() => getSessionId(), []);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Queries
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId });
  const streak = useQuery(api.protocols.getSupplementStreak, { sessionId });
  const adherence = useQuery(api.protocols.getAdherenceHistory7d, { sessionId });
  const suggestions = useQuery(api.protocols.getAISuggestions, { sessionId });

  // Mutations
  const oneTapVerify = useMutation(api.protocols.oneTapVerify);
  const updateAdherence = useMutation(api.protocols.updateAdherenceScore);
  const seedDefaults = useMutation(api.protocols.seedDefaults);

  // Auto-seed protocols for new users
  useEffect(() => {
    if (protocolStatus && protocolStatus.total === 0) {
      seedDefaults({ sessionId }).catch(() => {});
    }
  }, [protocolStatus?.total, sessionId, seedDefaults]);

  const handleToggle = useCallback(async (protocolId: string) => {
    setTogglingId(protocolId);
    try {
      await oneTapVerify({ sessionId, protocolId: protocolId as any });
      await updateAdherence({ sessionId });
    } catch (err) {
      console.error('[ProtocolDashboard] Toggle failed:', err);
    } finally {
      setTogglingId(null);
    }
  }, [sessionId, oneTapVerify, updateAdherence]);

  // Group items by time of day
  const groupedItems = useMemo(() => {
    if (!protocolStatus?.items) return {};
    const items = filter === 'all'
      ? protocolStatus.items
      : protocolStatus.items.filter(i => i.category === filter);

    const groups: Record<string, typeof items> = {};
    for (const tg of TIME_GROUPS) {
      const matching = items.filter(i => i.timeOfDay === tg.key);
      if (matching.length > 0) groups[tg.key] = matching;
    }
    return groups;
  }, [protocolStatus?.items, filter]);

  // Available categories
  const categories = useMemo(() => {
    if (!protocolStatus?.items) return [];
    const cats = new Set(protocolStatus.items.map(i => i.category));
    return Array.from(cats);
  }, [protocolStatus?.items]);

  const isLoading = !protocolStatus;
  const done = protocolStatus?.done ?? 0;
  const total = protocolStatus?.total ?? 0;
  const percentage = protocolStatus?.percentage ?? 0;

  // 7-day adherence sparkline
  const sparkData = useMemo(() => {
    if (!adherence?.days) return [];
    return adherence.days.map(d => d.adherencePercent);
  }, [adherence?.days]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050505',
      padding: '0 16px 160px',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '24px 0 20px',
      }}>
        <HeaderProgress done={done} total={total} percentage={percentage} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'monospace', fontSize: 8, fontWeight: 600,
            letterSpacing: '0.15em', color: WARM.textDim,
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            Daily Protocol
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 20, fontWeight: 800,
            color: WARM.textPrimary, lineHeight: 1.2,
          }}>
            {percentage >= 100 ? 'All Complete \u2728' : `${done} of ${total}`}
          </div>

          {/* Streak + Adherence */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {streak && streak.streak > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 8,
                background: 'rgba(232,151,108,0.08)',
                border: '1px solid rgba(232,151,108,0.15)',
              }}>
                <span style={{ fontSize: 11 }}>\uD83D\uDD25</span>
                <span style={{
                  fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                  color: WARM.terra,
                }}>
                  {streak.streak}d streak
                </span>
              </div>
            )}
            {adherence && adherence.average > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 8,
                background: 'rgba(124,182,142,0.06)',
                border: '1px solid rgba(124,182,142,0.12)',
              }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
                  color: WARM.sage,
                }}>
                  {adherence.average}% avg
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 7-Day Sparkline ── */}
      {sparkData.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 14, marginBottom: 16,
          background: WARM.cardBg,
          border: `1px solid ${WARM.cardBorder}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.1em', color: WARM.textDim,
              textTransform: 'uppercase',
            }}>
              7-Day Adherence
            </span>
            <span style={{
              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
              color: WARM.terra,
            }}>
              {adherence?.average ?? 0}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 32 }}>
            {sparkData.map((val, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (val / 100) * 32)}px` }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  flex: 1, borderRadius: 4,
                  background: val >= 80
                    ? 'linear-gradient(180deg, rgba(124,182,142,0.6) 0%, rgba(124,182,142,0.2) 100%)'
                    : val >= 50
                      ? 'linear-gradient(180deg, rgba(196,164,108,0.5) 0%, rgba(196,164,108,0.15) 100%)'
                      : 'linear-gradient(180deg, rgba(212,132,122,0.4) 0%, rgba(212,132,122,0.1) 100%)',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {adherence?.days?.map((d, i) => (
              <span key={i} style={{
                fontFamily: 'monospace', fontSize: 7, color: WARM.textDim,
                flex: 1, textAlign: 'center',
              }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(d.dateKey + 'T12:00:00').getDay()]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Category Filter ── */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto',
        paddingBottom: 12, marginBottom: 8,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '6px 14px', borderRadius: 10, flexShrink: 0,
            fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            background: filter === 'all' ? 'rgba(232,151,108,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${filter === 'all' ? 'rgba(232,151,108,0.3)' : 'rgba(255,255,255,0.06)'}`,
            color: filter === 'all' ? WARM.terra : WARM.textDim,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          All
        </button>
        {categories.map(cat => {
          const cfg = CATEGORY_CONFIG[cat] || { color: WARM.terra, label: cat, icon: '\uD83D\uDD18' };
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: '6px 14px', borderRadius: 10, flexShrink: 0,
                fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 5,
                background: filter === cat ? `${cfg.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === cat ? `${cfg.color}35` : 'rgba(255,255,255,0.06)'}`,
                color: filter === cat ? cfg.color : WARM.textDim,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 12 }}>{cfg.icon}</span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Time-Grouped Protocol Cards ── */}
      {isLoading ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '40vh', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, border: '2px solid rgba(232,151,108,0.15)',
            borderTopColor: WARM.terra, borderRadius: '50%',
            animation: 'protoDashSpin 0.8s linear infinite',
          }} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: WARM.textDim }}>
            Loading protocols\u2026
          </span>
        </div>
      ) : Object.keys(groupedItems).length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          borderRadius: 16, background: WARM.cardBg,
          border: `1px solid ${WARM.cardBorder}`,
        }}>
          <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>\uD83C\uDFAF</span>
          <div style={{
            fontFamily: 'monospace', fontSize: 14, fontWeight: 600,
            color: WARM.textPrimary, marginBottom: 6,
          }}>
            No protocols in this category
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 11, color: WARM.textDim,
          }}>
            Switch filters or add new protocols
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {TIME_GROUPS.map(tg => {
            const items = groupedItems[tg.key];
            if (!items) return null;
            const groupDone = items.filter(i => i.completed).length;
            const groupTotal = items.length;

            return (
              <div key={tg.key}>
                {/* Time group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, padding: '0 4px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{tg.icon}</span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                      color: WARM.textPrimary, letterSpacing: '0.03em',
                    }}>
                      {tg.label}
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, fontWeight: 500,
                      color: WARM.textDim,
                    }}>
                      {tg.range}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                    color: groupDone === groupTotal ? WARM.sage : WARM.textDim,
                  }}>
                    {groupDone}/{groupTotal}
                  </div>
                </div>

                {/* Protocol cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(item => (
                    <ProtocolCard
                      key={item._id}
                      item={item}
                      onToggle={handleToggle}
                      isToggling={togglingId === item._id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Suggestions ── */}
      {suggestions && suggestions.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 12, padding: '0 4px',
          }}>
            <span style={{ fontSize: 14 }}>\uD83E\uDDE0</span>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.12em', color: WARM.sky,
              textTransform: 'uppercase',
            }}>
              AI Suggestions
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '14px 16px', borderRadius: 16,
                  background: 'rgba(107,163,190,0.04)',
                  border: '1px solid rgba(107,163,190,0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 600,
                    color: WARM.textPrimary,
                  }}>
                    {s.name}
                  </span>
                  <span style={{
                    marginLeft: 'auto', padding: '2px 8px', borderRadius: 6,
                    fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: s.priority === 'high' ? WARM.rose : s.priority === 'medium' ? WARM.gold : WARM.textDim,
                    background: s.priority === 'high' ? 'rgba(212,132,122,0.1)' : s.priority === 'medium' ? 'rgba(196,164,108,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${s.priority === 'high' ? 'rgba(212,132,122,0.2)' : s.priority === 'medium' ? 'rgba(196,164,108,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    {s.priority}
                  </span>
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 10, fontWeight: 400,
                  color: WARM.textDim, lineHeight: 1.5,
                  paddingLeft: 26,
                }}>
                  {s.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes protoDashSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
