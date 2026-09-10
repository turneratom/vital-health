import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════
   HUD PROTOCOL PROGRESS RING
   
   A compact, always-visible ring on the FluidCanvas HUD showing
   today's protocol completion percentage. Pulses on completion,
   shows category breakdown on hover/tap.
   ══════════════════════════════════════════════════════════════ */

function getSessionId(): string {
  try {
    return localStorage.getItem('vive-session-id') || 'guest-user';
  } catch {
    return 'guest-user';
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  supplement: '#C4A46C',
  training: '#E8976C',
  biohacking: '#6BA3BE',
  nutrition: '#7CB68E',
  recovery: '#D4847A',
  movement: '#E8976C',
};

interface RecoveryWindowData {
  bedtimeHour: number;
  wakeHour: number;
  sleepDuration: number;
  urgency: 'now' | 'soon' | 'later' | 'optimal';
  arcColor: string;
  glowColor: string;
}

interface HUDProtocolRingProps {
  /** Compact mode for embedding in tight spaces */
  compact?: boolean;
}

export function HUDProtocolRing({ compact = false }: HUDProtocolRingProps) {
  const sessionId = useMemo(() => getSessionId(), []);
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId });
  const [showDetail, setShowDetail] = useState(false);
  const [prevDone, setPrevDone] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const [recoveryWindow, setRecoveryWindow] = useState<RecoveryWindowData | null>(null);

  // Listen for recovery window broadcasts from BioForecast
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as RecoveryWindowData;
      if (detail && typeof detail.bedtimeHour === 'number') {
        setRecoveryWindow(detail);
      }
    };
    window.addEventListener('vive-recovery-window', handler);
    return () => window.removeEventListener('vive-recovery-window', handler);
  }, []);

  const done = protocolStatus?.done ?? 0;
  const total = protocolStatus?.total ?? 0;
  const percentage = protocolStatus?.percentage ?? 0;

  // Detect new completion for pulse animation
  useEffect(() => {
    if (done > prevDone && prevDone > 0) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 1200);
      return () => clearTimeout(t);
    }
    setPrevDone(done);
  }, [done, prevDone]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    if (!protocolStatus?.items) return [];
    const cats: Record<string, { done: number; total: number }> = {};
    for (const item of protocolStatus.items) {
      if (!cats[item.category]) cats[item.category] = { done: 0, total: 0 };
      cats[item.category].total++;
      if (item.completed) cats[item.category].done++;
    }
    return Object.entries(cats).map(([cat, data]) => ({
      category: cat,
      color: CATEGORY_COLORS[cat] || '#E8976C',
      ...data,
    }));
  }, [protocolStatus?.items]);

  if (total === 0) return null;

  const size = compact ? 38 : 48;
  const strokeW = compact ? 3 : 3.5;
  const radius = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);

  const ringColor = percentage >= 100
    ? '#7CB68E'
    : percentage >= 70
      ? '#C4A46C'
      : '#E8976C';

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShowDetail(true)}
      onMouseLeave={() => setShowDetail(false)}
      onClick={() => setShowDetail(p => !p)}
    >
      {/* Recovery Window Shutdown Arc (outer glow ring) */}
      {recoveryWindow && (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <svg
            width={size + 12}
            height={size + 12}
            viewBox={`0 0 ${size + 12} ${size + 12}`}
            style={{ overflow: 'visible' }}
          >
            {/* Shutdown arc — maps sleep window onto the ring */}
            {(() => {
              const outerR = (size + 12) / 2 - 2;
              const outerC = 2 * Math.PI * outerR;
              const cx = (size + 12) / 2;
              const cy = (size + 12) / 2;
              const arcFraction = Math.min(0.5, recoveryWindow.sleepDuration / 24);
              const arcLen = outerC * arcFraction;
              const bedOffset = -((recoveryWindow.bedtimeHour % 24) / 24) * outerC + outerC * 0.25;
              const isUrgent = recoveryWindow.urgency === 'now' || recoveryWindow.urgency === 'soon';
              return (
                <>
                  <circle
                    cx={cx} cy={cy} r={outerR}
                    fill="none"
                    stroke={recoveryWindow.arcColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${arcLen} ${outerC - arcLen}`}
                    strokeDashoffset={bedOffset}
                    opacity={isUrgent ? 0.8 : 0.5}
                    style={{
                      filter: `drop-shadow(0 0 ${isUrgent ? '6px' : '3px'} ${recoveryWindow.glowColor})`,
                      animation: isUrgent ? 'hudShutdownPulse 2s ease-in-out infinite' : 'none',
                      transition: 'stroke-dasharray 1.5s ease, stroke-dashoffset 1.5s ease, opacity 0.5s',
                    }}
                  />
                  {/* Inner subtle echo */}
                  <circle
                    cx={cx} cy={cy} r={outerR - 2}
                    fill="none"
                    stroke={recoveryWindow.arcColor}
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeDasharray={`${arcLen * 0.7} ${outerC - arcLen * 0.7}`}
                    strokeDashoffset={bedOffset}
                    opacity="0.2"
                  />
                </>
              );
            })()}
          </svg>
          <style>{`
            @keyframes hudShutdownPulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Main ring */}
      <motion.div
        style={{
          position: 'relative',
          width: size,
          height: size,
          cursor: 'pointer',
        }}
        whileTap={{ scale: 0.92 }}
      >
        {/* Completion pulse */}
        <AnimatePresence>
          {justCompleted && (
            <motion.div
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                border: `2px solid ${ringColor}`,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="rgba(232,151,108,0.08)"
            strokeWidth={strokeW}
          />

          {/* Progress arc */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              filter: percentage >= 100
                ? 'drop-shadow(0 0 4px rgba(124,182,142,0.4))'
                : 'drop-shadow(0 0 3px rgba(232,151,108,0.2))',
            }}
          />

          {/* 100% checkmark */}
          {percentage >= 100 && (
            <motion.path
              d={compact
                ? `M${size * 0.35} ${size * 0.52}l${size * 0.1} ${size * 0.1}l${size * 0.2}-${size * 0.2}`
                : `M${size * 0.35} ${size * 0.52}l${size * 0.1} ${size * 0.1}l${size * 0.2}-${size * 0.2}`
              }
              fill="none"
              stroke="#7CB68E"
              strokeWidth={compact ? 2 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            />
          )}
        </svg>

        {/* Center text */}
        {percentage < 100 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'monospace',
              fontSize: compact ? 10 : 13,
              fontWeight: 800,
              color: ringColor,
              lineHeight: 1,
            }}>
              {done}
            </span>
            {!compact && (
              <span style={{
                fontFamily: 'monospace',
                fontSize: 6,
                fontWeight: 600,
                color: 'rgba(232,224,216,0.3)',
                letterSpacing: '0.05em',
                marginTop: 1,
              }}>
                /{total}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Detail popup */}
      <AnimatePresence>
        {showDetail && categoryBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.92 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              bottom: size + 10,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(10, 10, 12, 0.88)',
              border: '1px solid rgba(232,151,108,0.12)',
              borderRadius: 14,
              padding: '12px 14px',
              backdropFilter: 'blur(32px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.4)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset',
              minWidth: 160,
              pointerEvents: 'auto',
              zIndex: 10,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 8, fontWeight: 600,
                letterSpacing: '0.12em', color: 'rgba(232,151,108,0.5)',
                textTransform: 'uppercase',
              }}>
                Protocol Status
              </span>
              <span style={{
                fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
                color: ringColor,
              }}>
                {percentage}%
              </span>
            </div>

            {/* Category bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categoryBreakdown.map(cat => (
                <div key={cat.category}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 3,
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
                      color: cat.color, textTransform: 'capitalize',
                    }}>
                      {cat.category}
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, fontWeight: 600,
                      color: cat.done === cat.total ? '#7CB68E' : 'rgba(232,224,216,0.35)',
                    }}>
                      {cat.done}/{cat.total}
                    </span>
                  </div>
                  <div style={{
                    height: 3, borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.total > 0 ? (cat.done / cat.total) * 100 : 0}%` }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: cat.color,
                        boxShadow: `0 0 6px ${cat.color}33`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 10, height: 10,
              background: 'rgba(10, 10, 12, 0.88)',
              borderRight: '1px solid rgba(232,151,108,0.12)',
              borderBottom: '1px solid rgba(232,151,108,0.12)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HUDProtocolRing;
