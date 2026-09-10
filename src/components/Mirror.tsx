import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   MIRROR — Biological Summary Component
   
   The first thing a user sees when they "check in" on their Profile.
   Displays a 2-sentence AI-generated biological summary that reads
   like a high-level briefing from a top-tier longevity coach.
   ═══════════════════════════════════════════════════════════════ */

interface MirrorProps {
  sessionId: string;
}

interface BioSummary {
  summary: string;
  statusLabel: string;
  statusThermal: 'optimal' | 'good' | 'attention' | 'warning' | 'critical';
  confidence: number;
  keySignals: Array<{ label: string; value: string; status: string }>;
  generatedAt: number;
  source: 'llm' | 'local';
}

const THERMAL_CONFIG: Record<string, { gradient: string; glow: string; accent: string; ring: string; icon: string; pulse: string }> = {
  optimal:   { gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))', glow: 'rgba(34,197,94,0.15)', accent: '#22C55E', ring: 'conic-gradient(from 0deg, #22C55E, #10B981, #22C55E)', icon: '◆', pulse: 'rgba(34,197,94,0.3)' },
  good:      { gradient: 'linear-gradient(135deg, rgba(0,242,255,0.10), rgba(59,130,246,0.06))', glow: 'rgba(0,242,255,0.12)', accent: '#00F2FF', ring: 'conic-gradient(from 0deg, #00F2FF, #3B82F6, #00F2FF)', icon: '◆', pulse: 'rgba(0,242,255,0.25)' },
  attention: { gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.06))', glow: 'rgba(245,158,11,0.12)', accent: '#F59E0B', ring: 'conic-gradient(from 0deg, #F59E0B, #FBBF24, #F59E0B)', icon: '◇', pulse: 'rgba(245,158,11,0.25)' },
  warning:   { gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(239,68,68,0.06))', glow: 'rgba(249,115,22,0.12)', accent: '#F97316', ring: 'conic-gradient(from 0deg, #F97316, #EF4444, #F97316)', icon: '◇', pulse: 'rgba(249,115,22,0.3)' },
  critical:  { gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))', glow: 'rgba(239,68,68,0.15)', accent: '#EF4444', ring: 'conic-gradient(from 0deg, #EF4444, #DC2626, #EF4444)', icon: '▲', pulse: 'rgba(239,68,68,0.35)' },
};

const STATUS_SIGNAL_COLORS: Record<string, string> = {
  optimal: '#22C55E',
  suboptimal: '#F59E0B',
  critical: '#EF4444',
};

export function Mirror({ sessionId }: MirrorProps) {
  const [summary, setSummary] = useState<BioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showSignals, setShowSignals] = useState(false);

  const generateSummary = useAction(api.aiBrain.generateBiologicalSummary);

  const loadSummary = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await generateSummary({ sessionId });
      setSummary(result);
      setHasLoaded(true);
    } catch (err) {
      console.warn('[Mirror] Failed to generate summary:', err);
      setSummary({
        summary: 'Biological systems at baseline — awaiting deeper signal mapping. Add blood panel data and wearable metrics to unlock precision-grade biological intelligence.',
        statusLabel: 'Initializing',
        statusThermal: 'good',
        confidence: 0,
        keySignals: [],
        generatedAt: Date.now(),
        source: 'local',
      });
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [generateSummary, sessionId, isLoading]);

  useEffect(() => {
    if (!hasLoaded) loadSummary();
  }, [hasLoaded, loadSummary]);

  const thermal = summary ? THERMAL_CONFIG[summary.statusThermal] || THERMAL_CONFIG.good : THERMAL_CONFIG.good;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl overflow-hidden mb-4"
      style={{
        background: 'rgba(10,10,14,0.85)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: thermal.gradient,
          opacity: 0.6,
        }}
      />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${thermal.accent}40, transparent)` }}
      />

      <div className="relative p-5">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Status Orb */}
            <div className="relative">
              <motion.div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: thermal.gradient,
                  border: `1.5px solid ${thermal.accent}40`,
                  boxShadow: `0 0 20px ${thermal.glow}`,
                }}
                animate={{ boxShadow: [`0 0 15px ${thermal.pulse}`, `0 0 25px ${thermal.glow}`, `0 0 15px ${thermal.pulse}`] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span style={{ color: thermal.accent, fontSize: 16, fontWeight: 700 }}>{thermal.icon}</span>
              </motion.div>
              {/* Confidence ring */}
              {summary && (
                <svg className="absolute -inset-0.5 w-[44px] h-[44px]" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
                  <motion.circle
                    cx="22" cy="22" r="20"
                    fill="none"
                    stroke={thermal.accent}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - summary.confidence / 100) }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.2em]"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Biological Mirror
                </span>
                {summary?.source === 'llm' && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', color: 'rgba(168,85,247,0.7)' }}
                  >
                    AI
                  </span>
                )}
              </div>
              <AnimatePresence mode="wait">
                {summary ? (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[13px] font-semibold mt-0.5"
                    style={{ color: thermal.accent }}
                  >
                    {summary.statusLabel}
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading"
                    className="text-[13px] font-semibold mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Scanning systems...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={loadSummary}
            disabled={isLoading}
            className="p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <motion.svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round"
              animate={isLoading ? { rotate: 360 } : {}}
              transition={isLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </motion.svg>
          </button>
        </div>

        {/* Summary Text */}
        <AnimatePresence mode="wait">
          {isLoading && !hasLoaded ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="h-3 rounded-full w-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', width: '70%' }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <div className="h-3 rounded-full w-4/5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', width: '85%' }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                />
              </div>
            </motion.div>
          ) : summary ? (
            <motion.p
              key="summary"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-[13px] leading-[1.7] font-light"
              style={{ color: 'rgba(255,255,255,0.72)' }}
            >
              {summary.summary}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* Key Signals Strip */}
        {summary && summary.keySignals.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4"
          >
            <button
              onClick={() => setShowSignals(!showSignals)}
              className="flex items-center gap-1.5 mb-2 group"
            >
              <span
                className="text-[9px] font-mono uppercase tracking-[0.15em]"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Key Signals ({summary.keySignals.length})
              </span>
              <motion.svg
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"
                animate={{ rotate: showSignals ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <path d="M6 9l6 6 6-6" />
              </motion.svg>
            </button>

            <AnimatePresence>
              {showSignals && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2">
                    {summary.keySignals.map((signal, i) => (
                      <motion.div
                        key={signal.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${(STATUS_SIGNAL_COLORS[signal.status] || '#888')}20`,
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: STATUS_SIGNAL_COLORS[signal.status] || '#888' }}
                        />
                        <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {signal.label}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: STATUS_SIGNAL_COLORS[signal.status] || '#888' }}>
                          {signal.value}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Confidence Footer */}
        {summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-between mt-4 pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: 40,
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: thermal.accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${summary.confidence}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  />
                </div>
                <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {summary.confidence}% signal
                </span>
              </div>
            </div>
            <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
              {new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default Mirror;
