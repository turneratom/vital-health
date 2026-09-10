import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   AUTO-INSIGHT NOTIFICATION CENTER
   
   Monitors HRV from BiometricAvatar / vitals data and triggers
   a subtle, non-intrusive toast when HRV drops 15%+ below the
   user's 7-day average. Includes a "Start" button that launches
   a 5-minute focused breathing protocol via the ProtocolTimer.
   ═══════════════════════════════════════════════════════════════ */

const WARM = {
  terra: '#E8976C',
  sage: '#7CB68E',
  sky: '#6BA3BE',
  gold: '#C4A46C',
  rose: '#D4847A',
  sand: '#E8E0D8',
  textPrimary: '#E8E0D8',
  textSecondary: '#B0A89E',
  textDim: '#8A7E72',
};

export interface InsightNotification {
  id: string;
  type: 'hrv_low' | 'hr_high' | 'recovery_low' | 'stress_high' | 'info';
  title: string;
  message: string;
  severity: 'warning' | 'critical' | 'info';
  actionLabel?: string;
  actionPayload?: {
    protocolName: string;
    durationSeconds: number;
    icon: string;
    category: string;
  };
  timestamp: number;
  dismissed: boolean;
}

interface NotificationCenterProps {
  /** Current HRV value (from simulated vitals or biometric sync) */
  currentHrv: number | null;
  /** 7-day average HRV (from vitals time series) */
  hrvAvg7d: number | null;
  /** Current heart rate */
  currentHr: number | null;
  /** Current stress level (0-100) */
  currentStress: number | null;
  /** Current recovery score (0-100) */
  currentRecovery: number | null;
  /** Callback to start a breathing protocol in the ProtocolTimer */
  onStartProtocol?: (payload: {
    protocolName: string;
    durationSeconds: number;
    icon: string;
    category: string;
  }) => void;
}

/* ── Threshold constants ── */
const HRV_DROP_THRESHOLD = 0.15; // 15% below 7-day avg
const HR_HIGH_THRESHOLD = 100;   // HR > 100 while stationary
const STRESS_HIGH_THRESHOLD = 70;
const RECOVERY_LOW_THRESHOLD = 45;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min between same-type alerts
const AUTO_DISMISS_MS = 15_000;     // 15s auto-dismiss
const MAX_NOTIFICATIONS = 3;

/* ── Gentle chime for notification ── */
function playInsightChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
    setTimeout(() => { try { ctx.close(); } catch { /* */ } }, 1000);
  } catch { /* silent */ }
}

export function NotificationCenter({
  currentHrv,
  hrvAvg7d,
  currentHr,
  currentStress,
  currentRecovery,
  onStartProtocol,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<InsightNotification[]>([]);
  const lastAlertRef = useRef<Record<string, number>>({});
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Check thresholds and generate notifications ── */
  const checkThresholds = useCallback(() => {
    const now = Date.now();
    const newNotifs: InsightNotification[] = [];

    // HRV drop detection (primary feature)
    if (currentHrv !== null && hrvAvg7d !== null && hrvAvg7d > 0) {
      const dropPct = (hrvAvg7d - currentHrv) / hrvAvg7d;
      if (dropPct >= HRV_DROP_THRESHOLD) {
        const lastAlert = lastAlertRef.current['hrv_low'] || 0;
        if (now - lastAlert > COOLDOWN_MS) {
          lastAlertRef.current['hrv_low'] = now;
          newNotifs.push({
            id: `hrv-${now}`,
            type: 'hrv_low',
            title: 'High Stress Detected',
            message: `HRV dropped ${Math.round(dropPct * 100)}% below your 7-day avg (${Math.round(currentHrv)} vs ${Math.round(hrvAvg7d)} ms). Recovery protocol recommended.`,
            severity: dropPct >= 0.25 ? 'critical' : 'warning',
            actionLabel: 'Start 5m Breathing',
            actionPayload: {
              protocolName: 'Box Breathing',
              durationSeconds: 5 * 60,
              icon: '🫁',
              category: 'recovery',
            },
            timestamp: now,
            dismissed: false,
          });
        }
      }
    }

    // High HR while stationary
    if (currentHr !== null && currentHr > HR_HIGH_THRESHOLD) {
      const lastAlert = lastAlertRef.current['hr_high'] || 0;
      if (now - lastAlert > COOLDOWN_MS) {
        lastAlertRef.current['hr_high'] = now;
        newNotifs.push({
          id: `hr-${now}`,
          type: 'hr_high',
          title: 'Elevated Heart Rate',
          message: `Resting HR at ${Math.round(currentHr)} bpm — consider a calming breathwork session.`,
          severity: 'warning',
          actionLabel: 'Start Breathwork',
          actionPayload: {
            protocolName: 'Box Breathing',
            durationSeconds: 5 * 60,
            icon: '🫁',
            category: 'recovery',
          },
          timestamp: now,
          dismissed: false,
        });
      }
    }

    // High stress
    if (currentStress !== null && currentStress > STRESS_HIGH_THRESHOLD) {
      const lastAlert = lastAlertRef.current['stress_high'] || 0;
      if (now - lastAlert > COOLDOWN_MS) {
        lastAlertRef.current['stress_high'] = now;
        newNotifs.push({
          id: `stress-${now}`,
          type: 'stress_high',
          title: 'Stress Spike',
          message: `Stress index at ${currentStress}% — a short breathing session can help regulate your nervous system.`,
          severity: currentStress > 80 ? 'critical' : 'warning',
          actionLabel: 'Calm Down',
          actionPayload: {
            protocolName: 'Box Breathing',
            durationSeconds: 3 * 60,
            icon: '🧘',
            category: 'recovery',
          },
          timestamp: now,
          dismissed: false,
        });
      }
    }

    // Low recovery
    if (currentRecovery !== null && currentRecovery < RECOVERY_LOW_THRESHOLD) {
      const lastAlert = lastAlertRef.current['recovery_low'] || 0;
      if (now - lastAlert > COOLDOWN_MS) {
        lastAlertRef.current['recovery_low'] = now;
        newNotifs.push({
          id: `recovery-${now}`,
          type: 'recovery_low',
          title: 'Low Recovery',
          message: `Recovery at ${currentRecovery}% — your body needs rest. Consider a gentle breathing protocol.`,
          severity: 'warning',
          actionLabel: 'Recovery Breathing',
          actionPayload: {
            protocolName: 'Box Breathing',
            durationSeconds: 5 * 60,
            icon: '🌙',
            category: 'recovery',
          },
          timestamp: now,
          dismissed: false,
        });
      }
    }

    if (newNotifs.length > 0) {
      playInsightChime();
      setNotifications(prev => {
        const combined = [...newNotifs, ...prev].filter(n => !n.dismissed);
        return combined.slice(0, MAX_NOTIFICATIONS);
      });
    }
  }, [currentHrv, hrvAvg7d, currentHr, currentStress, currentRecovery]);

  /* ── Periodic threshold check ── */
  useEffect(() => {
    // Check immediately
    checkThresholds();
    // Then every 5 seconds
    checkIntervalRef.current = setInterval(checkThresholds, 5000);
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkThresholds]);

  /* ── Auto-dismiss after timeout ── */
  useEffect(() => {
    const timers = notifications
      .filter(n => !n.dismissed)
      .map(n => {
        const age = Date.now() - n.timestamp;
        const remaining = Math.max(0, AUTO_DISMISS_MS - age);
        return setTimeout(() => {
          setNotifications(prev =>
            prev.map(p => p.id === n.id ? { ...p, dismissed: true } : p)
          );
        }, remaining);
      });
    return () => timers.forEach(clearTimeout);
  }, [notifications]);

  /* ── Clean up dismissed notifications after animation ── */
  useEffect(() => {
    const hasDismissed = notifications.some(n => n.dismissed);
    if (!hasDismissed) return;
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => !n.dismissed));
    }, 500);
    return () => clearTimeout(timer);
  }, [notifications]);

  const handleDismiss = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, dismissed: true } : n)
    );
  }, []);

  const handleAction = useCallback((notif: InsightNotification) => {
    if (notif.actionPayload && onStartProtocol) {
      onStartProtocol(notif.actionPayload);
    }
    handleDismiss(notif.id);
  }, [onStartProtocol, handleDismiss]);

  const activeNotifs = useMemo(
    () => notifications.filter(n => !n.dismissed),
    [notifications]
  );

  if (activeNotifs.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: 80, right: 16, left: 16, maxWidth: 400, marginLeft: 'auto' }}
    >
      <AnimatePresence mode="popLayout">
        {activeNotifs.map((notif, i) => (
          <NotificationToast
            key={notif.id}
            notification={notif}
            index={i}
            onDismiss={handleDismiss}
            onAction={handleAction}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  INDIVIDUAL TOAST                                              */
/* ══════════════════════════════════════════════════════════════ */

interface ToastProps {
  notification: InsightNotification;
  index: number;
  onDismiss: (id: string) => void;
  onAction: (notif: InsightNotification) => void;
}

function NotificationToast({ notification, index, onDismiss, onAction }: ToastProps) {
  const isCritical = notification.severity === 'critical';
  const isWarning = notification.severity === 'warning';

  const accentColor = isCritical ? '#FF4444' : isWarning ? '#FFB800' : WARM.sky;
  const glowColor = isCritical
    ? 'rgba(255,68,68,0.15)'
    : isWarning
      ? 'rgba(255,184,0,0.12)'
      : 'rgba(107,163,190,0.12)';
  const borderColor = isCritical
    ? 'rgba(255,68,68,0.25)'
    : isWarning
      ? 'rgba(255,184,0,0.2)'
      : 'rgba(107,163,190,0.15)';

  const iconMap: Record<string, string> = {
    hrv_low: '💓',
    hr_high: '❤️‍🔥',
    stress_high: '⚡',
    recovery_low: '🔋',
    info: 'ℹ️',
  };

  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current) return;
    const el = progressRef.current;
    el.style.transition = 'none';
    el.style.width = '100%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const age = Date.now() - notification.timestamp;
        const remaining = Math.max(0, AUTO_DISMISS_MS - age);
        el.style.transition = `width ${remaining}ms linear`;
        el.style.width = '0%';
      });
    });
  }, [notification.timestamp]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95, x: 40 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        delay: index * 0.05,
      }}
      className="pointer-events-auto mb-2.5"
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(12,10,8,0.95)',
          border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 40px ${glowColor}`,
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 20% 30%, ${glowColor} 0%, transparent 70%)`,
          }}
        />

        {/* Critical pulse border */}
        {isCritical && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              border: '1px solid rgba(255,68,68,0.3)',
              animation: 'insightCriticalPulse 2s ease-in-out infinite',
            }}
          />
        )}

        <div className="relative px-4 py-3.5">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}25`,
              }}
            >
              <span className="text-[16px]">{iconMap[notification.type] || '💡'}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[11px] font-bold tracking-wide"
                  style={{ color: accentColor }}
                >
                  {notification.title}
                </span>
                <span
                  className="text-[7px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    color: `${accentColor}90`,
                    background: `${accentColor}0a`,
                    border: `1px solid ${accentColor}15`,
                  }}
                >
                  {notification.severity === 'critical' ? 'URGENT' : 'INSIGHT'}
                </span>
              </div>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: WARM.textSecondary }}
              >
                {notification.message}
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => onDismiss(notification.id)}
              className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(42,38,34,0.5)',
              }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(138,126,114,0.5)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Action button */}
          {notification.actionLabel && notification.actionPayload && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => onAction(notification)}
                className="flex-1 py-2 rounded-xl font-mono text-[9px] font-bold tracking-[0.1em] uppercase transition-all duration-200 active:scale-[0.97] group relative overflow-hidden"
                style={{
                  background: `${accentColor}10`,
                  border: `1px solid ${accentColor}30`,
                  color: accentColor,
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(105deg, transparent 40%, ${accentColor}08 50%, transparent 60%)`,
                  }}
                />
                <span className="relative flex items-center justify-center gap-2">
                  <span>{notification.actionPayload.icon}</span>
                  <span>{notification.actionLabel}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </span>
              </button>
              <button
                onClick={() => onDismiss(notification.id)}
                className="py-2 px-3 rounded-xl font-mono text-[8px] font-bold tracking-[0.1em] uppercase transition-all duration-200 active:scale-[0.97]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(42,38,34,0.4)',
                  color: WARM.textDim,
                }}
              >
                DISMISS
              </button>
            </div>
          )}
        </div>

        {/* Auto-dismiss progress bar */}
        <div className="h-[2px] w-full" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div
            ref={progressRef}
            className="h-full"
            style={{
              background: `linear-gradient(90deg, ${accentColor}60, ${accentColor}20)`,
            }}
          />
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes insightCriticalPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </motion.div>
  );
}

export default NotificationCenter;
