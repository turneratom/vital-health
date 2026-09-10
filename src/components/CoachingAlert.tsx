import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   COACHING ALERT — Proactive Performance Coach UI
   
   Appears at the top of the Briefing Room ONLY when the backend
   detects a negative trend in the user's 7-day data. Shows the
   specific issue and a concrete correction protocol.
   ═══════════════════════════════════════════════════════════════ */

interface TrendAlert {
  id: string;
  severity: 'warning' | 'critical';
  metric: string;
  title: string;
  description: string;
  correctionProtocol: string;
  icon: string;
  color: string;
  delta: number;
  unit: string;
}

interface NearRecord {
  metric: string;
  currentValue: number;
  bestValue: number;
  unit: string;
  percentAway: number;
  encouragement: string;
  icon: string;
}

interface CoachingAlertProps {
  alerts: TrendAlert[];
  nearRecords: NearRecord[];
  onAskCoach: (question: string) => void;
}

export function CoachingAlert({ alerts, nearRecords, onAskCoach }: CoachingAlertProps) {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [dismissedRecords, setDismissedRecords] = useState(false);

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));
  const visibleRecords = !dismissedRecords ? nearRecords : [];

  if (visibleAlerts.length === 0 && visibleRecords.length === 0) return null;

  const dismissAlert = (id: string) => {
    setDismissedAlerts((prev) => new Set([...prev, id]));
    if (expandedAlert === id) setExpandedAlert(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* ── Near-Record Encouragement ── */}
      <AnimatePresence>
        {visibleRecords.map((record) => (
          <motion.div
            key={`record-${record.metric}`}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="rounded-xl overflow-hidden relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(10,10,14,0.8))',
              border: '1px solid rgba(255,215,0,0.15)',
              boxShadow: '0 0 20px rgba(255,215,0,0.04)',
            }}
          >
            <div className="h-[1.5px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3), rgba(255,215,0,0.5), rgba(255,215,0,0.3), transparent)' }} />
            <div className="px-3.5 py-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}>
                    <span className="text-[12px]">{record.icon}</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(255,215,0,0.9)' }}>Near Personal Best</span>
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.5)' }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <span className="text-[11px] leading-[1.5] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {record.encouragement}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedRecords(true)}
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 transition-all hover:bg-white/[0.06]"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.1)' }}>
                  <span className="text-[10px] font-mono font-bold" style={{ color: '#FFD700' }}>{record.currentValue}{record.unit}</span>
                  <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>current</span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.4)" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.1)' }}>
                  <span className="text-[10px] font-mono font-bold" style={{ color: '#FFD700' }}>{record.bestValue}{record.unit}</span>
                  <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>best</span>
                </div>
                <span className="text-[9px] font-mono font-bold ml-auto" style={{ color: 'rgba(255,215,0,0.6)' }}>{record.percentAway}% away</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Trend Alerts ── */}
      <AnimatePresence>
        {visibleAlerts.map((alert, idx) => {
          const isExpanded = expandedAlert === alert.id;
          const isCritical = alert.severity === 'critical';
          const rgb = isCritical ? '255,69,58' : '255,159,10';

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.35, delay: idx * 0.08, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-xl overflow-hidden relative"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb},0.06), rgba(10,10,14,0.85))`,
                border: `1px solid rgba(${rgb},0.18)`,
                boxShadow: `0 0 20px rgba(${rgb},0.04)`,
              }}
            >
              {/* Top accent line */}
              <div className="h-[1.5px] w-full" style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},0.3), rgba(${rgb},0.5), rgba(${rgb},0.3), transparent)` }} />

              <div className="px-3.5 py-2.5">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `rgba(${rgb},0.1)`,
                        border: `1px solid rgba(${rgb},0.2)`,
                        boxShadow: `0 0 10px rgba(${rgb},0.08)`,
                      }}
                    >
                      <span className="text-[12px]">{alert.icon}</span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[8px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                          style={{
                            background: `rgba(${rgb},0.12)`,
                            color: alert.color,
                            border: `1px solid rgba(${rgb},0.2)`,
                          }}
                        >
                          {isCritical ? 'Critical' : 'Warning'}
                        </span>
                        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: `rgba(${rgb},0.5)` }}>
                          {alert.metric}
                        </span>
                      </div>
                      <span className="text-[11.5px] font-semibold mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {alert.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <span className="text-[11px] font-mono font-bold" style={{ color: alert.color }}>
                        {alert.delta > 0 ? '+' : ''}{alert.delta}{alert.unit === '%' ? '%' : ''}
                      </span>
                      <motion.svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={`rgba(${rgb},0.5)`} strokeWidth="2" strokeLinecap="round"
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </motion.svg>
                    </div>
                  </button>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-1 transition-all hover:bg-white/[0.06]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid rgba(${rgb},0.08)` }}>
                        {/* Description */}
                        <p className="text-[11px] leading-[1.6] mb-2.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {alert.description}
                        </p>

                        {/* Correction Protocol */}
                        <div
                          className="rounded-lg px-3 py-2.5 mb-2.5"
                          style={{
                            background: `rgba(${rgb},0.04)`,
                            border: `1px solid rgba(${rgb},0.1)`,
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={alert.color} strokeWidth="2.5" strokeLinecap="round">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: alert.color }}>
                              Correction Protocol
                            </span>
                          </div>
                          <p className="text-[11px] leading-[1.65]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {alert.correctionProtocol}
                          </p>
                        </div>

                        {/* Ask Coach button */}
                        <button
                          onClick={() => onAskCoach(`Why is my ${alert.metric.toLowerCase()} declining? What should I do about it?`)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200 active:scale-[0.98]"
                          style={{
                            background: `rgba(${rgb},0.08)`,
                            border: `1px solid rgba(${rgb},0.15)`,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={alert.color} strokeWidth="2" strokeLinecap="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="text-[10px] font-semibold tracking-wide" style={{ color: alert.color }}>
                            Ask Coach About This
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
