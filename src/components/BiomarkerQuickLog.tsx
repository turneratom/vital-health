import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';

/* ═══════════════════════════════════════════════════════════════
   BIOMARKER QUICK-LOG — 'K' Hotkey Drawer
   
   Three large high-contrast fields:
   1. Heart Rate Variability (ms)
   2. Hours Slept (hrs)
   3. Subjective Energy (1-10)
   
   Writes to biomarkers table + triggers avatar success pulse.
   ═══════════════════════════════════════════════════════════════ */

interface BiomarkerQuickLogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/* ── Large dial input ── */
function BigDial({ label, icon, value, onChange, min, max, step, unit, color }: {
  label: string; icon: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dec = () => onChange(Math.max(min, +(value - step).toFixed(1)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(1)));

  const startHold = (fn: () => void) => {
    fn();
    holdRef.current = setInterval(fn, 120);
  };
  const stopHold = () => {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
  };

  useEffect(() => () => stopHold(), []);

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(18,16,14,0.95)',
        border: `1.5px solid ${color}22`,
        boxShadow: `0 0 24px ${color}08, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      {/* Progress bar at top */}
      <div className="h-1 w-full" style={{ background: `${color}10` }}>
        <motion.div
          className="h-full rounded-r"
          style={{ background: `linear-gradient(90deg, ${color}60, ${color})` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      <div className="px-5 py-5 flex items-center gap-4">
        {/* Icon + Label */}
        <div className="flex flex-col items-center min-w-[56px]">
          <span className="text-3xl mb-1">{icon}</span>
          <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: `${color}99` }}>
            {label}
          </span>
        </div>

        {/* Stepper */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <button
            onMouseDown={() => startHold(dec)}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={() => startHold(dec)}
            onTouchEnd={stopHold}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all duration-150 active:scale-90 select-none"
            style={{
              background: `${color}0A`,
              border: `1px solid ${color}18`,
              color: `${color}88`,
            }}
          >
            −
          </button>

          <div className="flex items-baseline gap-1.5 min-w-[100px] justify-center">
            <span className="text-4xl font-black tabular-nums tracking-tight" style={{ color: '#E8E0D8' }}>
              {step < 1 ? value.toFixed(1) : value}
            </span>
            <span className="text-xs font-mono font-semibold" style={{ color: `${color}66` }}>
              {unit}
            </span>
          </div>

          <button
            onMouseDown={() => startHold(inc)}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={() => startHold(inc)}
            onTouchEnd={stopHold}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all duration-150 active:scale-90 select-none"
            style={{
              background: `${color}0A`,
              border: `1px solid ${color}18`,
              color: `${color}88`,
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Energy Scale (1-10) ── */
function EnergyScale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const getColor = (level: number) => {
    if (level <= 3) return '#E85454';
    if (level <= 5) return '#E8976C';
    if (level <= 7) return '#C4A46C';
    return '#7CB68E';
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(18,16,14,0.95)',
        border: '1.5px solid rgba(124,182,142,0.12)',
        boxShadow: '0 0 24px rgba(124,182,142,0.04), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <span className="text-3xl">⚡</span>
        <div>
          <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(124,182,142,0.6)' }}>
            Subjective Energy
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-3xl font-black tabular-nums" style={{ color: '#E8E0D8' }}>{value}</span>
            <span className="text-xs font-mono font-semibold" style={{ color: 'rgba(124,182,142,0.5)' }}>/10</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 grid grid-cols-10 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => {
          const isActive = level === value;
          const isFilled = level <= value;
          const c = getColor(level);
          return (
            <button
              key={level}
              onClick={() => onChange(level)}
              className="relative h-10 rounded-lg transition-all duration-200 active:scale-90 flex items-center justify-center"
              style={{
                background: isFilled ? `${c}18` : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${isActive ? c : isFilled ? `${c}30` : 'rgba(255,255,255,0.05)'}`,
                boxShadow: isActive ? `0 0 12px ${c}25, 0 0 4px ${c}15` : 'none',
              }}
            >
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: isFilled ? c : 'rgba(255,255,255,0.15)' }}
              >
                {level}
              </span>
              {isActive && (
                <motion.div
                  layoutId="energy-indicator"
                  className="absolute -bottom-0.5 left-1/2 w-1 h-1 rounded-full -translate-x-1/2"
                  style={{ background: c }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DRAWER
   ═══════════════════════════════════════════════════════════════ */

export default function BiomarkerQuickLog({ isOpen, onClose, onSuccess }: BiomarkerQuickLogProps) {
  const logBiomarkers = useMutation(api.biomarkerQuickLog.logBiomarkers);
  const [hrv, setHrv] = useState(65);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [energy, setEnergy] = useState(6);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';

  // Reset on open
  useEffect(() => {
    if (isOpen) setStatus('idle');
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (status === 'syncing' || status === 'success') return;
    setStatus('syncing');
    try {
      await logBiomarkers({ sessionId, hrv, sleepHours, energy });
      setStatus('success');
      // Dispatch custom event for avatar success pulse
      window.dispatchEvent(new CustomEvent('vive:biomarker-logged', {
        detail: { hrv, sleepHours, energy },
      }));
      onSuccess?.();
      // Auto-close after success animation
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      console.error('Failed to log biomarkers:', err);
      setStatus('idle');
    }
  }, [logBiomarkers, sessionId, hrv, sleepHours, energy, status, onClose, onSuccess]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bql-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="bql-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-[91] max-h-[90vh] overflow-hidden rounded-t-3xl"
            style={{
              background: 'rgba(8,7,6,0.98)',
              borderTop: '1px solid rgba(232,151,108,0.12)',
              boxShadow: '0 -12px 60px rgba(0,0,0,0.6), 0 -2px 24px rgba(232,151,108,0.06)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold" style={{ color: '#E8E0D8' }}>Biomarker Quick-Log</h2>
                  <span
                    className="text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md"
                    style={{
                      background: 'rgba(232,151,108,0.08)',
                      border: '1px solid rgba(232,151,108,0.15)',
                      color: '#E8976C',
                    }}
                  >
                    K
                  </span>
                </div>
                <p className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: 'rgba(138,126,114,0.4)' }}>
                  3-metric fast entry · Syncs to Bio-Vault
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                ✕
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.1), transparent)' }} />

            {/* Fields */}
            <div className="px-5 pt-4 pb-6 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
              {/* HRV */}
              <BigDial
                label="HRV"
                icon="📊"
                value={hrv}
                onChange={setHrv}
                min={10}
                max={200}
                step={1}
                unit="ms"
                color="#6BA3BE"
              />

              {/* Sleep Hours */}
              <BigDial
                label="Sleep"
                icon="😴"
                value={sleepHours}
                onChange={setSleepHours}
                min={0}
                max={14}
                step={0.5}
                unit="hrs"
                color="#C4A46C"
              />

              {/* Subjective Energy */}
              <EnergyScale value={energy} onChange={setEnergy} />

              {/* Submit */}
              <motion.button
                onClick={handleSubmit}
                disabled={status !== 'idle'}
                className="w-full py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 active:scale-[0.98] relative overflow-hidden"
                style={{
                  background: status === 'success'
                    ? 'linear-gradient(135deg, rgba(124,182,142,0.2), rgba(90,158,110,0.15))'
                    : 'linear-gradient(135deg, rgba(232,151,108,0.15), rgba(196,164,108,0.1))',
                  border: `1.5px solid ${status === 'success' ? 'rgba(124,182,142,0.3)' : 'rgba(232,151,108,0.2)'}`,
                  color: status === 'success' ? '#7CB68E' : '#E8976C',
                  opacity: status === 'syncing' ? 0.7 : 1,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Success pulse overlay */}
                <AnimatePresence>
                  {status === 'success' && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.3, 0] }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                      style={{
                        background: 'radial-gradient(ellipse at center, rgba(124,182,142,0.3) 0%, transparent 70%)',
                      }}
                    />
                  )}
                </AnimatePresence>

                {status === 'syncing' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border-2 border-current border-t-transparent"
                      style={{ animation: 'spin 0.8s linear infinite' }}
                    />
                    Syncing to Bio-Vault...
                  </span>
                ) : status === 'success' ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      ✓
                    </motion.span>
                    Biomarkers Logged — Avatar Pulsing
                  </span>
                ) : (
                  'Log All Biomarkers'
                )}
              </motion.button>

              {/* Insight preview */}
              <AnimatePresence>
                {status === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: 'rgba(124,182,142,0.05)',
                      border: '1px solid rgba(124,182,142,0.1)',
                    }}
                  >
                    <span className="text-lg">🧬</span>
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: '#7CB68E' }}>
                        {hrv >= 65 ? 'Strong recovery signal' : 'Recovery below baseline'} · {sleepHours >= 7 ? 'Sleep on target' : 'Sleep deficit detected'} · Energy {energy}/10
                      </p>
                      <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(138,126,114,0.4)' }}>
                        Synced to Bio-Vault · Elite Score recalculating
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
