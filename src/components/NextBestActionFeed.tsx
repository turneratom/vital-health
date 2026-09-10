import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { TimerTarget } from './ProtocolTimer';

/* ═══════════════════════════════════════════════════════════════
   NEXT BEST ACTION FEED — AI-driven contextual recommendations
   Now with EXECUTE buttons that start protocol timers and
   broadcast status to the FluidCanvas in real-time.
   ═══════════════════════════════════════════════════════════════ */

interface ActionRecommendation {
  id: string;
  icon: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  color: string;
  glow: string;
  tag: string;
  /** If set, this action can be executed with a timer */
  executable?: {
    protocolName: string;
    durationSeconds: number;
    category: string;
    presenceStatus: string;
    presenceCategory: string;
  };
}

interface NextBestActionFeedProps {
  totalCaloriesIn: number;
  totalCaloriesOut: number;
  foodLogCount: number;
  activityLogCount: number;
  supplementCount: number;
  recovery: number;
  currentHrv: number;
  hrvHistory7d: number[];
  totalProtein: number;
  eliteScore: number;
  stress: number;
  hoursSinceLastLog: number;
  /** Session ID for presence broadcasting */
  sessionId?: string;
  /** Callback to start the ProtocolTimer with a target */
  onStartTimer?: (target: TimerTarget) => void;
}

/* ── Generate recommendations from live data ── */
function generateRecommendations(props: NextBestActionFeedProps): ActionRecommendation[] {
  const actions: ActionRecommendation[] = [];
  const hour = new Date().getHours();

  // --- Hydration check ---
  if (props.totalCaloriesOut > 200 || props.activityLogCount > 0 || (hour >= 10 && hour <= 16)) {
    const waterTarget = Math.round(2.5 + (props.totalCaloriesOut / 500) * 0.5);
    actions.push({
      id: 'hydration',
      icon: '💧',
      title: `Hydration checkpoint: ${waterTarget}L target`,
      description: props.totalCaloriesOut > 300
        ? `You've burned ${props.totalCaloriesOut} kcal — electrolyte-enhanced water will maintain cognitive output and thermoregulation.`
        : 'Consistent hydration sustains metabolic efficiency. Aim for 500ml in the next 90 minutes.',
      urgency: props.totalCaloriesOut > 400 ? 'high' : 'medium',
      color: '#00BFFF',
      glow: 'rgba(0,191,255,0.4)',
      tag: 'HYDRATION',
      executable: {
        protocolName: '500ml Hydration Protocol',
        durationSeconds: 90 * 60, // 90 min to drink 500ml
        category: 'nutrition',
        presenceStatus: '💧 Hydrating — 500ml',
        presenceCategory: 'nutrition',
      },
    });
  }

  // --- Recovery window ---
  if (props.recovery >= 75 && props.activityLogCount === 0) {
    actions.push({
      id: 'training-window',
      icon: '⚡',
      title: 'Recovery peaked — ideal training window',
      description: `Recovery at ${props.recovery}% with HRV stable. Your nervous system is primed for high-intensity output. This window closes in ~${hour < 12 ? '4-6' : '2-3'} hours.`,
      urgency: 'high',
      color: '#00FFAA',
      glow: 'rgba(0,255,170,0.4)',
      tag: 'PERFORMANCE',
      executable: {
        protocolName: 'Resistance Training',
        durationSeconds: 45 * 60,
        category: 'training',
        presenceStatus: '⚡ Training — Peak Window',
        presenceCategory: 'training',
      },
    });
  } else if (props.recovery < 50 && props.activityLogCount === 0) {
    actions.push({
      id: 'recovery-protocol',
      icon: '🧊',
      title: 'Recovery low — activate restoration protocol',
      description: `Recovery at ${props.recovery}%. Prioritize parasympathetic activation: 10-min breathwork, magnesium glycinate, and zone-1 movement only.`,
      urgency: 'high',
      color: '#FF6B6B',
      glow: 'rgba(255,107,107,0.4)',
      tag: 'RECOVERY',
      executable: {
        protocolName: 'Breathwork Recovery',
        durationSeconds: 10 * 60,
        category: 'recovery',
        presenceStatus: '🧊 Recovery Breathwork',
        presenceCategory: 'recovery',
      },
    });
  }

  // --- Protein deficit ---
  const proteinTarget = 150;
  const proteinPct = (props.totalProtein / proteinTarget) * 100;
  if (proteinPct < 50 && hour >= 12) {
    const deficit = proteinTarget - props.totalProtein;
    actions.push({
      id: 'protein',
      icon: '🥩',
      title: `Protein deficit: ${Math.round(deficit)}g remaining`,
      description: `At ${props.totalProtein}g of ${proteinTarget}g target. Front-load protein in your next meal to support muscle protein synthesis and satiety signaling.`,
      urgency: hour >= 16 ? 'high' : 'medium',
      color: '#FF9F0A',
      glow: 'rgba(255,159,10,0.4)',
      tag: 'NUTRITION',
    });
  }

  // --- Supplement reminder ---
  if (props.supplementCount < 2 && hour >= 8) {
    actions.push({
      id: 'supplements',
      icon: '💊',
      title: 'Protocol incomplete — supplements pending',
      description: props.supplementCount === 0
        ? 'No supplements logged today. Your morning stack (D3, Omega-3, Magnesium) optimizes baseline cellular function.'
        : `${props.supplementCount}/3 logged. Complete your protocol to maintain micronutrient saturation.`,
      urgency: hour >= 14 ? 'high' : 'medium',
      color: '#AF82FF',
      glow: 'rgba(175,130,255,0.4)',
      tag: 'PROTOCOL',
      executable: {
        protocolName: 'Supplement Stack',
        durationSeconds: 5 * 60,
        category: 'supplement',
        presenceStatus: '💊 Taking Supplements',
        presenceCategory: 'supplements',
      },
    });
  }

  // --- HRV trending down ---
  const hrvAvg = props.hrvHistory7d.length > 0
    ? props.hrvHistory7d.reduce((s, v) => s + v, 0) / props.hrvHistory7d.length
    : props.currentHrv;
  if (props.currentHrv > 0 && hrvAvg > 0 && props.currentHrv < hrvAvg * 0.85) {
    actions.push({
      id: 'hrv-alert',
      icon: '📉',
      title: 'HRV below 7-day baseline',
      description: `Current ${props.currentHrv}ms vs ${Math.round(hrvAvg)}ms average. Elevated sympathetic tone detected — consider reducing training intensity and prioritizing sleep architecture tonight.`,
      urgency: 'high',
      color: '#FF453A',
      glow: 'rgba(255,69,58,0.4)',
      tag: 'BIOMETRIC',
      executable: {
        protocolName: 'HRV Recovery Protocol',
        durationSeconds: 15 * 60,
        category: 'recovery',
        presenceStatus: '📉 HRV Recovery Mode',
        presenceCategory: 'recovery',
      },
    });
  }

  // --- Stress management ---
  if (props.stress > 60) {
    actions.push({
      id: 'stress',
      icon: '🧘',
      title: 'Elevated stress — activate vagal tone',
      description: `Stress index at ${props.stress}%. Initiate 4-7-8 breathing protocol or 10-minute cold exposure to downregulate cortisol and restore autonomic balance.`,
      urgency: props.stress > 75 ? 'high' : 'medium',
      color: '#5AC8FA',
      glow: 'rgba(90,200,250,0.4)',
      tag: 'RECOVERY',
      executable: {
        protocolName: '4-7-8 Breathing',
        durationSeconds: 5 * 60,
        category: 'recovery',
        presenceStatus: '🧘 Breathwork — Vagal Tone',
        presenceCategory: 'recovery',
      },
    });
  }

  // --- No food logs yet ---
  if (props.foodLogCount === 0 && hour >= 8) {
    actions.push({
      id: 'first-meal',
      icon: '🍽️',
      title: hour >= 12 ? 'No meals logged — metabolic data gap' : 'Log your first meal',
      description: hour >= 12
        ? 'Zero nutritional data today. Log your intake to calibrate fueling recommendations and maintain your Vitality Score.'
        : 'Capture your first meal to begin today\'s metabolic tracking. Protein-forward meals optimize morning cortisol clearance.',
      urgency: hour >= 12 ? 'high' : 'low',
      color: '#E8976C',
      glow: 'rgba(232,151,108,0.4)',
      tag: 'NUTRITION',
    });
  }

  // --- Sort by urgency, take top 3 ---
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return actions.slice(0, 3);
}

/* ── Single Action Card with Execute Button ── */
function ActionCard({
  action,
  index,
  onExecute,
  isExecuting,
}: {
  action: ActionRecommendation;
  index: number;
  onExecute?: (action: ActionRecommendation) => void;
  isExecuting: boolean;
}) {
  const urgencyDot = action.urgency === 'high'
    ? { bg: '#FF453A', shadow: 'rgba(255,69,58,0.6)' }
    : action.urgency === 'medium'
      ? { bg: '#FF9F0A', shadow: 'rgba(255,159,10,0.5)' }
      : { bg: '#30D158', shadow: 'rgba(48,209,88,0.5)' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex gap-3.5 rounded-2xl px-4 py-3.5 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${action.color}18`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left accent line */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
        style={{
          background: `linear-gradient(180deg, ${action.color}, ${action.color}44)`,
          boxShadow: `0 0 8px ${action.glow}`,
        }}
      />

      {/* Icon badge */}
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center relative"
        style={{
          background: `${action.color}10`,
          border: `1px solid ${action.color}20`,
          boxShadow: `0 0 12px ${action.glow}`,
        }}
      >
        <span className="text-lg leading-none">{action.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Tag + urgency */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className="font-mono uppercase tracking-wider"
            style={{
              fontSize: '8.5px',
              color: `${action.color}99`,
              letterSpacing: '0.1em',
            }}
          >
            {action.tag}
          </span>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: urgencyDot.bg,
              boxShadow: `0 0 6px ${urgencyDot.shadow}`,
              animation: action.urgency === 'high' ? 'statusDotPulse 2s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* Title */}
        <h4
          className="font-semibold leading-snug mb-1"
          style={{
            fontSize: '13px',
            color: 'rgba(224,224,224,0.92)',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          {action.title}
        </h4>

        {/* Description */}
        <p
          className="leading-relaxed"
          style={{
            fontSize: '11.5px',
            color: 'rgba(160,180,200,0.55)',
            fontFamily: 'Inter, system-ui, sans-serif',
            lineHeight: '1.55',
          }}
        >
          {action.description}
        </p>

        {/* Execute Button — only for executable actions */}
        {action.executable && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
            onClick={() => onExecute?.(action)}
            disabled={isExecuting}
            className="mt-2.5 flex items-center gap-2 rounded-lg px-3 py-1.5 group transition-all duration-200 active:scale-[0.96]"
            style={{
              background: isExecuting
                ? `${action.color}08`
                : `${action.color}0C`,
              border: `1px solid ${isExecuting ? `${action.color}15` : `${action.color}25`}`,
              cursor: isExecuting ? 'not-allowed' : 'pointer',
            }}
          >
            {isExecuting ? (
              /* Spinner */
              <svg
                className="animate-spin"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
              >
                <circle cx="12" cy="12" r="10" stroke={`${action.color}30`} strokeWidth="3" />
                <path d="M12 2a10 10 0 019.95 9" stroke={action.color} strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              /* Play icon */
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <polygon
                  points="6,3 20,12 6,21"
                  fill={action.color}
                  opacity="0.8"
                />
              </svg>
            )}
            <span
              className="font-mono font-bold uppercase tracking-wider"
              style={{
                fontSize: '8.5px',
                color: isExecuting ? `${action.color}60` : `${action.color}CC`,
                letterSpacing: '0.12em',
              }}
            >
              {isExecuting ? 'STARTING...' : 'EXECUTE'}
            </span>
            {!isExecuting && (
              <span
                className="font-mono"
                style={{
                  fontSize: '8px',
                  color: `${action.color}50`,
                  marginLeft: '2px',
                }}
              >
                {formatDurationShort(action.executable.durationSeconds)}
              </span>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/** Format seconds to short duration like "90m" or "5m" */
function formatDurationShort(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h${rm}m` : `${h}h`;
  }
  return `${m}m`;
}

/* ── Main Feed Component ── */
export function NextBestActionFeed(props: NextBestActionFeedProps) {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const upsertPresence = useMutation(api.mutations.upsertPresence);
  const logWater = useMutation(api.mutations.logWaterIntake);

  const recommendations = useMemo(() => generateRecommendations(props), [
    props.totalCaloriesIn,
    props.totalCaloriesOut,
    props.foodLogCount,
    props.activityLogCount,
    props.supplementCount,
    props.recovery,
    props.currentHrv,
    props.hrvHistory7d,
    props.totalProtein,
    props.eliteScore,
    props.stress,
    props.hoursSinceLastLog,
  ]);

  const handleExecute = useCallback(async (action: ActionRecommendation) => {
    if (!action.executable || !props.sessionId) return;
    const exec = action.executable;

    setExecutingId(action.id);

    try {
      // 1. Start the ProtocolTimer via callback
      if (props.onStartTimer) {
        const timerTarget: TimerTarget = {
          protocolId: `nba-${action.id}-${Date.now()}`,
          protocolName: exec.protocolName,
          icon: action.icon,
          category: exec.category,
          durationSeconds: exec.durationSeconds,
        };
        props.onStartTimer(timerTarget);
      }

      // 2. Broadcast presence status to FluidCanvas peers
      try {
        await upsertPresence({
          sessionId: props.sessionId,
          x: 0,
          y: 0,
          ghostMode: false,
          color: action.color,
          lastSeen: Date.now(),
          activeProtocol: exec.presenceStatus,
          activeCategory: exec.presenceCategory,
          auraState: 'flow',
        });
      } catch {
        // Presence broadcast is best-effort
      }

      // 3. If hydration, also log 500ml water intake
      if (action.id === 'hydration') {
        try {
          await logWater({
            sessionId: props.sessionId,
            amountMl: 500,
            source: 'next-best-action',
          });
        } catch {
          // Water log is best-effort
        }
      }
    } finally {
      // Brief delay so user sees the "STARTING..." state
      setTimeout(() => setExecutingId(null), 1200);
    }
  }, [props.sessionId, props.onStartTimer, upsertPresence, logWater]);

  if (recommendations.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Section header */}
      <div className="flex items-center gap-2.5 px-0.5 mb-0.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'rgba(0,240,255,0.06)',
            border: '1px solid rgba(0,240,255,0.1)',
            boxShadow: '0 0 10px rgba(0,240,255,0.15)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(0,240,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span
            className="font-bold tracking-tight"
            style={{
              fontSize: '13px',
              color: 'rgba(224,224,224,0.9)',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            Next Best Actions
          </span>
          <span
            style={{
              fontSize: '10px',
              color: 'rgba(0,240,255,0.35)',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            AI-prioritized based on your live data
          </span>
        </div>
      </div>

      {/* Action cards */}
      <AnimatePresence mode="popLayout">
        {recommendations.map((action, i) => (
          <ActionCard
            key={action.id}
            action={action}
            index={i}
            onExecute={handleExecute}
            isExecuting={executingId === action.id}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default NextBestActionFeed;
