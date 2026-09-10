import { useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { useMissionProfile, type MissionProfile } from '@/lib/useUserStyle';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAnalytics } from '@/lib/useAnalytics';

/* ── Accent colors per mission profile ── */
function getAccent(profile: MissionProfile) {
  switch (profile) {
    case 'hard-truth': return { color: '#FF4444', dim: 'rgba(255,68,68,' };
    case 'elite': return { color: '#00F0FF', dim: 'rgba(0,240,255,' };
    default: return { color: '#00FFCC', dim: 'rgba(0,255,204,' };
  }
}

const GREEN = '#30D158';

/* ── Protocol display config ── */
interface ProtocolDisplay {
  id: string;
  icon: string;
  title: string;
  summaryMap: Record<string, { label: string; detail: string; icon: string }>;
}

const PROTOCOL_DISPLAY: ProtocolDisplay[] = [
  {
    id: 'physical',
    icon: '\uD83C\uDFCB\uFE0F',
    title: 'Physical',
    summaryMap: {
      strength: { label: 'Strength Focus', detail: 'Upper/Lower Split \u00B7 ~45 min', icon: '\uD83D\uDCAA' },
      recovery: { label: 'Active Recovery', detail: 'Mobility + Zone 1 \u00B7 ~40 min', icon: '\uD83E\uDDD8' },
      cardio: { label: 'Cardio Session', detail: 'HIIT + Steady State \u00B7 ~35 min', icon: '\uD83C\uDFC3' },
    },
  },
  {
    id: 'nutrition',
    icon: '\uD83E\uDD57',
    title: 'Nutrition',
    summaryMap: {
      deficit: { label: 'Caloric Deficit', detail: '~1,800 kcal \u00B7 160g protein', icon: '\u2B07\uFE0F' },
      surplus: { label: 'Caloric Surplus', detail: '~3,200 kcal \u00B7 200g protein', icon: '\u2B06\uFE0F' },
      maintenance: { label: 'Maintenance Mode', detail: '~2,400 kcal \u00B7 180g protein', icon: '\u2696\uFE0F' },
    },
  },
  {
    id: 'supplement',
    icon: '\uD83D\uDC8A',
    title: 'Supplements',
    summaryMap: {
      performance: { label: 'Performance Stack', detail: 'Creatine, Citrulline, Caffeine + Bio-Markers', icon: '\u26A1' },
      recovery: { label: 'Recovery Stack', detail: 'Mag-Threonate, Ashwagandha, Glycine + Bio-Markers', icon: '\uD83E\uDDD8' },
      longevity: { label: 'Longevity Stack', detail: 'NMN, Resveratrol, Sulforaphane + Bio-Markers', icon: '\uD83E\uDDEC' },
    },
  },
];

/* ── Props ── */
interface TodaysProtocolProps {
  onStartSession: () => void;
  onNavigateToDashboard?: () => void;
}

/* ══════════════════════════════════════════════
   Today's Protocol — Unified Summary
   Pulls from the 3 Game Plan cards on Dashboard
   Read-only view with "Set Plan on Dashboard" CTAs
   ══════════════════════════════════════════════ */
export function TodaysProtocol({ onNavigateToDashboard }: TodaysProtocolProps) {
  const ghostMode = useGhostMode();
  const missionProfile = useMissionProfile();
  const accent = getAccent(missionProfile);

  const sessionId = typeof window !== 'undefined'
    ? (sessionStorage.getItem('vive-session-id') || 'default')
    : 'default';

  // Fetch today's intake answers from the Dashboard Game Plan cards
  let savedIntake: Array<{ protocol: string; answer: string; summary: string }> | undefined;
  try {
    savedIntake = useQuery(api.queries.getTodayIntake, { sessionId }) as any;
  } catch {
    // Convex not connected
  }

  // Build a lookup map: protocol -> answer
  const intakeMap = useMemo(() => {
    const map: Record<string, { answer: string; summary: string }> = {};
    if (savedIntake) {
      for (const entry of savedIntake) {
        map[entry.protocol] = { answer: entry.answer, summary: entry.summary };
      }
    }
    return map;
  }, [savedIntake]);

  const configuredCount = PROTOCOL_DISPLAY.filter(p => intakeMap[p.id]).length;
  const allConfigured = configuredCount === 3;

  // Track plan completion rate
  const { trackPlanCompletion } = useAnalytics();
  const lastTrackedRef = useRef(-1);
  useEffect(() => {
    if (savedIntake !== undefined && configuredCount !== lastTrackedRef.current) {
      lastTrackedRef.current = configuredCount;
      if (configuredCount > 0) {
        trackPlanCompletion(configuredCount, 3);
      }
    }
  }, [configuredCount, savedIntake, trackPlanCompletion]);

  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.92)';
  const textSecondary = ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.5)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.28)';
  const cardBg = ghostMode ? 'rgba(20,20,22,0.5)' : 'rgba(12,12,18,0.55)';
  const cardBorder = ghostMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.05)';
  const accentDim = ghostMode ? 'rgba(160,160,160,' : accent.dim;
  const accentColor = ghostMode ? 'rgba(200,200,200,0.7)' : accent.color;

  const handleGoToDashboard = () => {
    if (onNavigateToDashboard) {
      onNavigateToDashboard();
    }
  };

  return (
    <motion.div
      layout
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: ghostMode ? 'none' : `0 2px 16px rgba(0,0,0,0.3), inset 0 0 0 1px ${accentDim}0.04)`,
      }}
    >
      {/* Top accent line */}
      {!ghostMode && (
        <div className="absolute top-0 left-4 right-4 h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${accentDim}0.2), ${accentDim}0.12), transparent)`,
        }} />
      )}

      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.06)' : `${accentDim}0.06)`,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${accentDim}0.1)`}`,
            }}
          >
            {'\uD83C\uDFAF'}
          </div>
          <div>
            <span
              className="text-[12px] font-semibold block"
              style={{ color: textPrimary, fontFamily: "'Inter', sans-serif" }}
            >
              Today{'\u2019'}s Plan
            </span>
            <span
              className="text-[9px] font-mono uppercase tracking-[0.12em]"
              style={{ color: textTertiary }}
            >
              {allConfigured ? 'All plans active' : `${configuredCount}/3 configured`}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          {allConfigured && (
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.4)' : GREEN,
                boxShadow: ghostMode ? 'none' : `0 0 6px ${GREEN}60`,
              }}
            />
          )}
          <span
            className="text-[9px] font-mono uppercase tracking-[0.12em]"
            style={{
              color: allConfigured
                ? (ghostMode ? 'rgba(160,160,160,0.5)' : GREEN)
                : textTertiary,
            }}
          >
            {allConfigured ? 'Locked' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{
        background: ghostMode ? 'rgba(160,160,160,0.06)' : `linear-gradient(90deg, transparent, ${accentDim}0.06), transparent)`,
      }} />

      {/* Protocol rows */}
      <div className="px-4 py-2.5 flex flex-col gap-0">
        {PROTOCOL_DISPLAY.map((protocol, i) => {
          const intake = intakeMap[protocol.id];
          const isSet = !!intake;
          const display = isSet ? protocol.summaryMap[intake.answer] : null;

          return (
            <motion.div
              key={protocol.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.06, duration: 0.3 }}
              className="flex items-center gap-3 py-2.5"
              style={{
                borderBottom: i < PROTOCOL_DISPLAY.length - 1
                  ? `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'}`
                  : 'none',
              }}
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{
                  background: isSet
                    ? (ghostMode ? 'rgba(160,160,160,0.06)' : `${accentDim}0.06)`)
                    : (ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.02)'),
                  border: `1px solid ${isSet
                    ? (ghostMode ? 'rgba(160,160,160,0.1)' : `${accentDim}0.1)`)
                    : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)')}`,
                }}
              >
                {protocol.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: textPrimary, fontFamily: "'Inter', sans-serif" }}
                  >
                    {protocol.title}
                  </span>
                  {isSet && display && (
                    <span className="text-xs">{display.icon}</span>
                  )}
                </div>
                {isSet && display ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: accentColor, fontFamily: "'Inter', sans-serif" }}
                    >
                      {display.label}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: textTertiary }}>{'\u00B7'}</span>
                    <span
                      className="text-[9px] font-mono tracking-wide"
                      style={{ color: textSecondary }}
                    >
                      {display.detail}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-[10px] font-mono mt-0.5 block"
                    style={{ color: textTertiary }}
                  >
                    Not configured
                  </span>
                )}
              </div>

              {/* Status indicator or CTA */}
              <div className="flex-shrink-0">
                {isSet ? (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: ghostMode ? 'rgba(160,160,160,0.06)' : `${accentDim}0.08)`,
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${accentDim}0.12)`}`,
                    }}
                  >
                    <span
                      className="text-[8px] font-bold"
                      style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : GREEN }}
                    >
                      {'\u2713'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleGoToDashboard}
                    className="text-[8px] font-mono font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      color: ghostMode ? 'rgba(160,160,160,0.5)' : `${accentDim}0.6)`,
                      background: ghostMode ? 'rgba(160,160,160,0.04)' : `${accentDim}0.04)`,
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${accentDim}0.08)`}`,
                    }}
                  >
                    Set on Dashboard
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom summary */}
      {!allConfigured && (
        <div className="px-4 pb-3">
          <button
            onClick={handleGoToDashboard}
            className="w-full py-2 rounded-xl text-[10px] font-semibold tracking-[0.04em] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.04)' : `${accentDim}0.04)`,
              color: ghostMode ? 'rgba(200,200,200,0.5)' : `${accentDim}0.55)`,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${accentDim}0.08)`}`,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Configure remaining on Dashboard {'\u2192'}
          </button>
        </div>
      )}

      {/* All configured accent */}
      {allConfigured && (
        <div className="px-4 pb-3 pt-0.5">
          <div className="flex items-center justify-center gap-2">
            <div className="h-px flex-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)' }} />
            <span
              className="text-[8px] font-mono uppercase tracking-[0.2em]"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.25)' : `${accentDim}0.3)` }}
            >
              {'\u2713'} All protocols synced from Dashboard
            </span>
            <div className="h-px flex-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)' }} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
