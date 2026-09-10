import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════
   DYNAMIC INTERVENTIONS — Proactive Recovery Assistant
   
   Monitors Bio-Projection for predicted 48h declines in HRV,
   Sleep Quality, and Recovery. When a decline is detected, shows
   pulsing urgency cards with one-tap insertion into the daily stack.
   
   Feels like a proactive assistant, not a static checklist.
   ══════════════════════════════════════════════════════════════ */

const WARM = {
  accent: '#E8976C',
  green: '#7CB68E',
  amber: '#C4A46C',
  red: '#D4847A',
  text: '#E8E0D8',
  muted: '#8A7E72',
  bg: 'rgba(26,24,22,0.95)',
  border: 'rgba(232,151,108,0.12)',
};

const SEVERITY_COLORS = {
  critical: { bg: 'rgba(212,132,122,0.08)', border: 'rgba(212,132,122,0.25)', text: '#D4847A', glow: 'rgba(212,132,122,0.15)' },
  warning: { bg: 'rgba(196,164,108,0.06)', border: 'rgba(196,164,108,0.2)', text: '#C4A46C', glow: 'rgba(196,164,108,0.1)' },
};

const CATEGORY_ICONS: Record<string, string> = {
  recovery: '🧘',
  supplement: '💊',
  biohacking: '❄️',
  movement: '🚶',
};

interface DynamicInterventionsProps {
  sessionId: string;
  ghostMode?: boolean;
  compact?: boolean;
}

/* ── Pulsing Urgency Dot ── */
function UrgencyDot({ severity, size = 6 }: { severity: 'critical' | 'warning'; size?: number }) {
  const color = severity === 'critical' ? WARM.red : WARM.amber;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{
        background: color,
        animation: 'diPulse 2s ease-in-out infinite',
      }} />
      <div className="absolute rounded-full" style={{
        inset: -size * 0.5,
        background: `${color}20`,
        animation: 'diPulseRing 2s ease-in-out infinite',
        borderRadius: '50%',
      }} />
    </div>
  );
}

/* ── Decline Indicator Bar ── */
function DeclineBar({ current, projected, label, unit, severity }: {
  current: number; projected: number; label: string; unit: string; severity: 'critical' | 'warning';
}) {
  const colors = SEVERITY_COLORS[severity];
  const delta = Math.abs(current - projected);
  const pctDrop = current > 0 ? Math.round((delta / current) * 100) : 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
    }}>
      <UrgencyDot severity={severity} size={5} />
      <span className="text-[9px] font-mono font-semibold" style={{ color: colors.text }}>
        {label}
      </span>
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-[9px] font-mono tabular-nums" style={{ color: WARM.text }}>
          {Math.round(current)}
        </span>
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4H9M9 4L6 1M9 4L6 7" stroke={colors.text} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: colors.text }}>
          {Math.round(projected)}{unit}
        </span>
        <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{
          background: `${colors.text}10`,
          color: colors.text,
        }}>
          -{pctDrop}%
        </span>
      </div>
    </div>
  );
}

/* ── Intervention Card ── */
function InterventionCard({
  name, icon, description, category, rationale, urgencyScore, matchedDeclines, severity,
  onInsert, onDismiss, isInserting, isInserted, ghostMode,
}: {
  name: string; icon: string; description: string; category: string;
  rationale: string; urgencyScore: number; severity: 'critical' | 'warning';
  matchedDeclines: Array<{ label: string; delta: number; unit: string }>;
  onInsert: () => void; onDismiss: () => void;
  isInserting: boolean; isInserted: boolean; ghostMode: boolean;
}) {
  const [showRationale, setShowRationale] = useState(false);
  const colors = ghostMode
    ? { bg: 'rgba(160,160,160,0.04)', border: 'rgba(160,160,160,0.1)', text: 'rgba(160,160,160,0.5)', glow: 'none' }
    : SEVERITY_COLORS[severity];

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-500"
      style={{
        background: isInserted ? 'rgba(124,182,142,0.04)' : colors.bg,
        border: `1px solid ${isInserted ? 'rgba(124,182,142,0.2)' : colors.border}`,
        boxShadow: isInserted
          ? '0 0 20px rgba(124,182,142,0.06)'
          : severity === 'critical' && !ghostMode
            ? `0 0 24px ${colors.glow}, inset 0 0 12px ${colors.glow}`
            : 'none',
        animation: severity === 'critical' && !isInserted && !ghostMode ? 'diCardPulse 3s ease-in-out infinite' : 'none',
      }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        {/* Icon + Urgency */}
        <div className="relative flex-shrink-0 mt-0.5">
          <span className="text-base" style={{ filter: ghostMode ? 'grayscale(1)' : 'none' }}>{icon}</span>
          {!isInserted && (
            <div className="absolute -top-1 -right-1">
              <UrgencyDot severity={severity} size={5} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {/* AI Brain Badge */}
            <span className="text-[7px] font-mono font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full" style={{
              background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(175,130,255,0.1)',
              color: ghostMode ? 'rgba(160,160,160,0.4)' : '#AF82FF',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(175,130,255,0.2)'}`,
            }}>
              AI BRAIN
            </span>
            <span className="text-[7px] font-mono tracking-[0.1em] uppercase" style={{
              color: isInserted ? WARM.green : colors.text,
            }}>
              {isInserted ? '✓ DEPLOYED' : severity === 'critical' ? 'URGENT' : 'RECOMMENDED'}
            </span>
          </div>

          <span className="text-[11px] font-semibold block truncate" style={{
            color: ghostMode ? 'rgba(160,160,160,0.6)' : WARM.text,
          }}>
            {name}
          </span>
          <span className="text-[9px] font-mono block mt-0.5 leading-relaxed" style={{
            color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(138,126,114,0.5)',
          }}>
            {description}
          </span>

          {/* Matched Declines */}
          {matchedDeclines.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {matchedDeclines.map((d, i) => (
                <span key={i} className="text-[7px] font-mono px-1.5 py-0.5 rounded-full" style={{
                  background: ghostMode ? 'rgba(160,160,160,0.04)' : `${colors.text}08`,
                  color: ghostMode ? 'rgba(160,160,160,0.3)' : `${colors.text}90`,
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${colors.text}15`}`,
                }}>
                  {d.label} ↓{Math.round(d.delta)}{d.unit}
                </span>
              ))}
            </div>
          )}

          {/* Rationale Toggle */}
          <button
            onClick={() => setShowRationale(!showRationale)}
            className="text-[8px] font-mono mt-1.5 flex items-center gap-1 transition-colors"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(175,130,255,0.5)' }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            {showRationale ? 'Hide' : 'Why this?'}
          </button>

          {showRationale && (
            <div className="mt-1.5 px-2 py-1.5 rounded-lg text-[8px] font-mono leading-relaxed" style={{
              background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(175,130,255,0.04)',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(175,130,255,0.1)'}`,
              color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(232,224,216,0.5)',
            }}>
              {rationale}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isInserted && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={onInsert}
              disabled={isInserting}
              className="px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold tracking-[0.08em] uppercase transition-all duration-200 hover:scale-[1.04] active:scale-[0.96]"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.08)'
                  : severity === 'critical'
                    ? `linear-gradient(135deg, ${WARM.red}25, ${WARM.red}15)`
                    : `linear-gradient(135deg, ${WARM.accent}20, ${WARM.accent}10)`,
                color: ghostMode ? 'rgba(160,160,160,0.5)' : (severity === 'critical' ? WARM.red : WARM.accent),
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : (severity === 'critical' ? `${WARM.red}30` : `${WARM.accent}25`)}`,
                boxShadow: ghostMode ? 'none' : `0 2px 8px ${severity === 'critical' ? WARM.red : WARM.accent}15`,
              }}
            >
              {isInserting ? '...' : 'Deploy'}
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 rounded-lg text-[7px] font-mono tracking-wider uppercase transition-opacity hover:opacity-80"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
              }}
            >
              Skip
            </button>
          </div>
        )}

        {isInserted && (
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full" style={{
            background: 'rgba(124,182,142,0.1)',
            border: '1px solid rgba(124,182,142,0.2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={WARM.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Urgency score bar */}
      {!isInserted && (
        <div className="h-[2px] w-full" style={{
          background: `linear-gradient(90deg, transparent, ${colors.text}${Math.min(99, Math.round(urgencyScore * 0.6)).toString().padStart(2, '0')}, transparent)`,
        }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export function DynamicInterventions({ sessionId, ghostMode = false, compact = false }: DynamicInterventionsProps) {
  const [insertingId, setInsertingId] = useState<string | null>(null);
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Queries
  const interventionData = useQuery(
    api.dynamicInterventions.getInterventionRecommendations,
    sessionId ? { sessionId } : 'skip'
  );
  const todayInserted = useQuery(
    api.dynamicInterventions.getTodayDynamicInterventions,
    sessionId ? { sessionId } : 'skip'
  );

  // Mutations
  const insertIntervention = useMutation(api.dynamicInterventions.insertIntervention);
  const dismissIntervention = useMutation(api.dynamicInterventions.dismissIntervention);

  // Track already-inserted interventions
  useEffect(() => {
    if (todayInserted) {
      setInsertedIds(new Set(todayInserted.map((t) => t.interventionId)));
    }
  }, [todayInserted]);

  // Filter out dismissed recommendations
  const visibleRecommendations = useMemo(() => {
    if (!interventionData?.recommendations) return [];
    return interventionData.recommendations.filter((r) => !dismissedIds.has(r.id));
  }, [interventionData?.recommendations, dismissedIds]);

  const handleInsert = useCallback(async (rec: typeof visibleRecommendations[0]) => {
    if (!sessionId || insertingId) return;
    setInsertingId(rec.id);
    try {
      await insertIntervention({
        sessionId,
        interventionId: rec.id,
        name: rec.name,
        category: rec.category,
        icon: rec.icon,
        description: rec.description,
        timeOfDay: rec.timeOfDay,
        rationale: rec.rationale,
      });
      setInsertedIds((prev) => new Set([...prev, rec.id]));
      // Dispatch event for DailyStack refresh
      window.dispatchEvent(new CustomEvent('vive-dynamic-intervention', {
        detail: { id: rec.id, name: rec.name, category: rec.category },
      }));
    } catch (err) {
      console.error('Failed to insert intervention:', err);
    } finally {
      setInsertingId(null);
    }
  }, [sessionId, insertingId, insertIntervention]);

  const handleDismiss = useCallback(async (rec: typeof visibleRecommendations[0]) => {
    if (!sessionId) return;
    setDismissedIds((prev) => new Set([...prev, rec.id]));
    try {
      await dismissIntervention({
        sessionId,
        interventionId: rec.id,
        name: rec.name,
      });
    } catch { /* non-critical */ }
  }, [sessionId, dismissIntervention]);

  // Nothing to show
  if (!interventionData?.hasInterventions && !todayInserted?.length) return null;
  if (visibleRecommendations.length === 0 && !todayInserted?.length) return null;

  const hasCritical = interventionData?.hasCritical ?? false;
  const declines = interventionData?.declines ?? [];

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: ghostMode ? 'rgba(30,30,30,0.6)' : 'rgba(26,24,22,0.6)',
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : (hasCritical ? 'rgba(212,132,122,0.15)' : WARM.border)}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: hasCritical && !ghostMode
          ? '0 4px 24px rgba(0,0,0,0.3), 0 0 30px rgba(212,132,122,0.04)'
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
          {/* Pulsing brain icon */}
          <div className="relative w-8 h-8 flex items-center justify-center rounded-full" style={{
            background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(175,130,255,0.08)',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(175,130,255,0.15)'}`,
            animation: hasCritical && !ghostMode ? 'diBrainPulse 2.5s ease-in-out infinite' : 'none',
          }}>
            <span className="text-sm" style={{ filter: ghostMode ? 'grayscale(1)' : 'none' }}>🧠</span>
            {hasCritical && !ghostMode && (
              <div className="absolute -top-0.5 -right-0.5">
                <UrgencyDot severity="critical" size={6} />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] tracking-[0.12em] uppercase font-semibold" style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : (hasCritical ? WARM.red : '#AF82FF'),
              }}>
                Dynamic Interventions
              </span>
            </div>
            <span className="text-[8px] font-mono block mt-0.5" style={{
              color: ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(138,126,114,0.4)',
            }}>
              {hasCritical
                ? 'CRITICAL — Bio-Projection detected 48h decline'
                : `${visibleRecommendations.length} recovery protocol${visibleRecommendations.length !== 1 ? 's' : ''} recommended`}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full" style={{
            background: ghostMode ? 'rgba(160,160,160,0.3)' : (hasCritical ? WARM.red : '#AF82FF'),
            boxShadow: ghostMode ? 'none' : `0 0 6px ${hasCritical ? WARM.red : '#AF82FF'}60`,
            animation: 'diStatusPulse 2.5s ease-in-out infinite',
          }} />
          <span className="text-[7px] font-mono tracking-[0.1em] uppercase" style={{
            color: ghostMode ? 'rgba(160,160,160,0.25)' : (hasCritical ? `${WARM.red}88` : 'rgba(175,130,255,0.5)'),
          }}>
            {hasCritical ? 'ALERT' : 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Decline Summary */}
      {declines.length > 0 && !compact && (
        <div className="px-3 py-2 space-y-1" style={{
          borderBottom: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)'}`,
        }}>
          <span className="text-[7px] font-mono tracking-[0.15em] uppercase block mb-1" style={{
            color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.35)',
          }}>
            48H PROJECTED DECLINES
          </span>
          {declines.map((d, i) => (
            <DeclineBar
              key={i}
              current={d.currentValue}
              projected={d.projected48h}
              label={d.label}
              unit={d.unit}
              severity={d.severity}
            />
          ))}
        </div>
      )}

      {/* Intervention Cards */}
      <div className="px-3 py-2 space-y-2">
        {visibleRecommendations.map((rec, idx) => (
          <div
            key={rec.id}
            style={{ animation: `diSlideIn 0.4s ease both ${0.1 * idx}s` }}
          >
            <InterventionCard
              name={rec.name}
              icon={rec.icon}
              description={rec.description}
              category={rec.category}
              rationale={rec.rationale}
              urgencyScore={rec.urgencyScore}
              severity={rec.matchedDeclines.some((d) => d.severity === 'critical') ? 'critical' : 'warning'}
              matchedDeclines={rec.matchedDeclines.map((d) => ({
                label: d.label,
                delta: d.delta,
                unit: d.unit,
              }))}
              onInsert={() => handleInsert(rec)}
              onDismiss={() => handleDismiss(rec)}
              isInserting={insertingId === rec.id}
              isInserted={insertedIds.has(rec.id)}
              ghostMode={ghostMode}
            />
          </div>
        ))}
      </div>

      {/* Adherence Context Footer */}
      {interventionData?.adherenceContext && (
        <div className="px-4 pb-3 pt-1 flex items-center justify-between" style={{
          borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)'}`,
        }}>
          <span className="text-[8px] font-mono tracking-wider uppercase" style={{
            color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
          }}>
            7d Adherence: {interventionData.adherenceContext.avg7d}%
          </span>
          <span className="text-[8px] font-mono tracking-wider uppercase" style={{
            color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)',
          }}>
            {interventionData.adherenceContext.isLow ? '⚠ Low adherence amplifies decline' : 'Protocol consistency detected'}
          </span>
        </div>
      )}

      {/* Ambient scan line */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden" style={{ opacity: 0.015 }}>
        <div className="absolute left-0 w-full h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${ghostMode ? 'rgba(160,160,160,0.6)' : '#AF82FF'}, transparent)`,
          animation: 'diScanline 6s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes diPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes diPulseRing {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0; transform: scale(2.5); }
        }
        @keyframes diCardPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(212,132,122,0.06), inset 0 0 8px rgba(212,132,122,0.03); }
          50% { box-shadow: 0 0 24px rgba(212,132,122,0.12), inset 0 0 16px rgba(212,132,122,0.06); }
        }
        @keyframes diBrainPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(175,130,255,0.1); }
          50% { box-shadow: 0 0 20px rgba(175,130,255,0.2), 0 0 40px rgba(212,132,122,0.08); }
        }
        @keyframes diStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes diScanline {
          0% { top: -2%; }
          100% { top: 102%; }
        }
        @keyframes diSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Compact Header Badge — shows count of active interventions ── */
export function DynamicInterventionsBadge({ sessionId, ghostMode = false }: { sessionId: string; ghostMode: boolean }) {
  const interventionData = useQuery(
    api.dynamicInterventions.getInterventionRecommendations,
    sessionId ? { sessionId } : 'skip'
  );

  if (!interventionData?.hasInterventions) return null;

  const count = interventionData.recommendations.length;
  const hasCritical = interventionData.hasCritical;
  const color = ghostMode ? 'rgba(160,160,160,0.5)' : (hasCritical ? WARM.red : '#AF82FF');

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{
      background: ghostMode ? 'rgba(160,160,160,0.04)' : `${color}10`,
      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${color}25`}`,
      animation: hasCritical && !ghostMode ? 'diPulse 2s ease-in-out infinite' : 'none',
    }}>
      <span style={{ fontSize: 8 }}>🧠</span>
      <span className="text-[8px] font-mono font-bold tabular-nums" style={{ color }}>
        {count}
      </span>
    </div>
  );
}

export default DynamicInterventions;
