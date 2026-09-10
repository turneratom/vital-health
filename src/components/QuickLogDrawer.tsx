import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AIFeedbackToast, type ToastData } from './AIFeedbackToast';
import { getTwinSessionId } from '@/lib/twinSession';

/* ═══════════════════════════════════════════════════════════════
   QUICK LOG DRAWER
   
   Slides up from bottom on V-button tap. Three fast-entry modes:
   1. Vitals — HR, HRV, SpO2, Sleep Hours, Body Temp
   2. Protocol Check-in — Today's active protocols as checklist
   3. Mood / Energy — 1-5 scale selectors
   
   Glass-shatter glow animation on protocol completion.
   AIFeedbackToast with one-line insight after each log.
   ═══════════════════════════════════════════════════════════════ */

type Tab = 'vitals' | 'protocols' | 'mood';

interface QuickLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── Vital Config ── */
const VITALS = [
  { key: 'hr', label: 'Heart Rate', unit: 'bpm', icon: '❤️', min: 40, max: 200, step: 1, default: 68 },
  { key: 'hrv', label: 'HRV', unit: 'ms', icon: '📊', min: 10, max: 200, step: 1, default: 72 },
  { key: 'spo2', label: 'SpO₂', unit: '%', icon: '🫁', min: 85, max: 100, step: 1, default: 97 },
  { key: 'sleep_hours', label: 'Sleep', unit: 'hrs', icon: '😴', min: 0, max: 14, step: 0.5, default: 7.5 },
  { key: 'steps', label: 'Steps', unit: 'steps', icon: '🚶', min: 0, max: 50000, step: 100, default: 5000 },
  { key: 'body_temp', label: 'Body Temp', unit: '°F', icon: '🌡️', min: 95, max: 104, step: 0.1, default: 98.6 },
] as const;

const MOOD_LABELS = ['😫', '😕', '😐', '🙂', '😄'];
const ENERGY_LABELS = ['🔋', '🪫', '⚡', '🔥', '⚡⚡'];
const ENERGY_TEXT = ['Depleted', 'Low', 'Moderate', 'High', 'Peak'];
const MOOD_TEXT = ['Terrible', 'Poor', 'Okay', 'Good', 'Great'];

/* ── Tab Button ── */
function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all duration-200"
      style={{
        background: active ? 'rgba(232,151,108,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(232,151,108,0.25)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#E8976C' : 'rgba(255,255,255,0.35)',
      }}
    >
      <span className="text-sm">{icon}</span>
      {label}
    </button>
  );
}

/* ── Numeric Stepper ── */
function NumericStepper({ value, onChange, min, max, step, unit }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
  const decrement = () => onChange(Math.max(min, +(value - step).toFixed(1)));
  const increment = () => onChange(Math.min(max, +(value + step).toFixed(1)));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={decrement}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all duration-150 active:scale-90"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        −
      </button>
      <div className="flex items-baseline gap-1 min-w-[60px] justify-center">
        <span className="text-xl font-bold tabular-nums" style={{ color: '#E8E0D8' }}>
          {step < 1 ? value.toFixed(1) : value}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'rgba(138,126,114,0.5)' }}>{unit}</span>
      </div>
      <button
        onClick={increment}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all duration-150 active:scale-90"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        +
      </button>
    </div>
  );
}

/* ── Vitals Tab ── */
function VitalsTab({ sessionId, onToast }: { sessionId: string; onToast: (t: ToastData) => void }) {
  const logVital = useMutation(api.quickLog.logVital);
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    VITALS.forEach((v) => { init[v.key] = v.default; });
    return init;
  });
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [logged, setLogged] = useState<Record<string, boolean>>({});

  const handleLog = useCallback(async (vital: typeof VITALS[number]) => {
    const value = values[vital.key];
    setSyncing((p) => ({ ...p, [vital.key]: true }));
    try {
      await logVital({
        sessionId,
        vitalType: vital.key,
        value,
        unit: vital.unit,
      });
      setLogged((p) => ({ ...p, [vital.key]: true }));

      // Generate insight text locally (fast, no extra query needed)
      let insight = `${vital.label} logged: ${vital.key === 'sleep_hours' ? value.toFixed(1) : value} ${vital.unit}`;
      if (vital.key === 'hrv' && value > 70) insight = `HRV at ${value}ms — strong recovery signal.`;
      else if (vital.key === 'hrv') insight = `HRV at ${value}ms — consider lighter training.`;
      else if (vital.key === 'hr' && value < 65) insight = `Resting HR ${value} bpm — excellent parasympathetic tone.`;
      else if (vital.key === 'spo2' && value >= 97) insight = `SpO₂ ${value}% — optimal oxygen saturation.`;
      else if (vital.key === 'sleep_hours' && value >= 8) insight = `${value.toFixed(1)}h sleep — great for recovery.`;
      else if (vital.key === 'sleep_hours' && value < 7) insight = `Only ${value.toFixed(1)}h sleep — prioritize rest tonight.`;

      onToast({
        id: `vital-${vital.key}-${Date.now()}`,
        message: insight,
        detail: 'Manual entry saved to twin',
        source: 'Input',
        type: 'activity',
      });
    } catch (err) {
      console.error('Failed to log vital:', err);
    } finally {
      setSyncing((p) => ({ ...p, [vital.key]: false }));
    }
  }, [logVital, sessionId, values, onToast]);

  return (
    <div className="space-y-3 pb-2">
      <div
        className="px-3 py-2 rounded-lg text-[10px] font-mono leading-relaxed"
        style={{
          background: 'rgba(0,255,204,0.04)',
          border: '1px solid rgba(0,255,204,0.1)',
          color: 'rgba(0,255,204,0.65)',
        }}
      >
        Manual vitals — Oura / Whoop / Apple / Garmin live sync is coming later. Entries save to your twin session.
      </div>
      {VITALS.map((vital) => (
        <div
          key={vital.key}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300"
          style={{
            background: logged[vital.key] ? 'rgba(124,182,142,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${logged[vital.key] ? 'rgba(124,182,142,0.15)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-[100px]">
            <span className="text-base">{vital.icon}</span>
            <span className="text-[12px] font-semibold" style={{ color: '#E8E0D8' }}>{vital.label}</span>
          </div>

          <NumericStepper
            value={values[vital.key]}
            onChange={(v) => setValues((p) => ({ ...p, [vital.key]: v }))}
            min={vital.min}
            max={vital.max}
            step={vital.step}
            unit={vital.unit}
          />

          <button
            onClick={() => handleLog(vital)}
            disabled={syncing[vital.key]}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all duration-200 active:scale-95 min-w-[56px]"
            style={{
              background: logged[vital.key]
                ? 'rgba(124,182,142,0.12)'
                : syncing[vital.key]
                  ? 'rgba(232,151,108,0.08)'
                  : 'rgba(232,151,108,0.1)',
              border: `1px solid ${logged[vital.key] ? 'rgba(124,182,142,0.25)' : 'rgba(232,151,108,0.2)'}`,
              color: logged[vital.key] ? '#7CB68E' : '#E8976C',
              opacity: syncing[vital.key] ? 0.6 : 1,
            }}
          >
            {syncing[vital.key] ? (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent" style={{ animation: 'spin 0.8s linear infinite' }} />
              </span>
            ) : logged[vital.key] ? '✓' : 'Log'}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Protocols Tab ── */
function ProtocolsTab({ sessionId, onToast }: { sessionId: string; onToast: (t: ToastData) => void }) {
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, sessionId ? { sessionId } : 'skip');
  const toggleCompletion = useMutation(api.protocols.toggleCompletion);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const handleToggle = useCallback(async (protocolId: string, name: string, wasCompleted: boolean) => {
    setAnimatingId(protocolId);
    try {
      await toggleCompletion({ sessionId, protocolId: protocolId as any });
      if (!wasCompleted) {
        onToast({
          id: `protocol-${protocolId}-${Date.now()}`,
          message: `${name} — checked off`,
          detail: 'Protocol adherence updated',
          source: 'Sync',
          type: 'activity',
        });
      }
    } catch (err) {
      console.error('Failed to toggle protocol:', err);
    } finally {
      setTimeout(() => setAnimatingId(null), 600);
    }
  }, [toggleCompletion, sessionId, onToast]);

  if (!protocolStatus) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 rounded-full border-2 border-orange-500/30 border-t-orange-400" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const { items, done, total, percentage } = protocolStatus;

  return (
    <div className="space-y-3 pb-2">
      {/* Progress bar */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(138,126,114,0.5)' }}>
            Today&apos;s Progress
          </span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: percentage === 100 ? '#7CB68E' : '#E8976C' }}>
            {done}/{total} · {percentage}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: percentage === 100
                ? 'linear-gradient(90deg, #7CB68E, #5A9E6E)'
                : 'linear-gradient(90deg, #E8976C, #C4A46C)',
              boxShadow: percentage === 100 ? '0 0 8px rgba(124,182,142,0.4)' : '0 0 8px rgba(232,151,108,0.3)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>

      {/* Protocol items */}
      {items.map((item) => {
        const isAnimating = animatingId === item._id;
        return (
          <motion.button
            key={item._id}
            onClick={() => handleToggle(item._id, item.name, item.completed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 active:scale-[0.98] relative overflow-hidden"
            style={{
              background: item.completed ? 'rgba(124,182,142,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.completed ? 'rgba(124,182,142,0.15)' : 'rgba(255,255,255,0.05)'}`,
            }}
            animate={isAnimating && item.completed ? {} : {}}
          >
            {/* Glass-shatter glow on completion */}
            <AnimatePresence>
              {isAnimating && !item.completed && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(124,182,142,0.15) 0%, transparent 70%)',
                    boxShadow: 'inset 0 0 20px rgba(124,182,142,0.1)',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Checkbox */}
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-300"
              style={{
                background: item.completed ? 'rgba(124,182,142,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${item.completed ? '#7CB68E' : 'rgba(255,255,255,0.12)'}`,
                boxShadow: item.completed ? '0 0 8px rgba(124,182,142,0.2)' : 'none',
              }}
            >
              {item.completed && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="text-[11px]"
                  style={{ color: '#7CB68E' }}
                >
                  ✓
                </motion.span>
              )}
            </div>

            {/* Icon + Name */}
            <span className="text-base flex-shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <span
                className="text-[12px] font-semibold block truncate transition-all duration-300"
                style={{
                  color: item.completed ? 'rgba(124,182,142,0.7)' : '#E8E0D8',
                  textDecoration: item.completed ? 'line-through' : 'none',
                }}
              >
                {item.name}
              </span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(138,126,114,0.4)' }}>
                {item.timeOfDay}
              </span>
            </div>

            {/* Category pill */}
            <span
              className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: 'rgba(232,151,108,0.06)',
                color: 'rgba(232,151,108,0.4)',
                border: '1px solid rgba(232,151,108,0.08)',
              }}
            >
              {item.category}
            </span>
          </motion.button>
        );
      })}

      {/* 100% celebration */}
      <AnimatePresence>
        {percentage === 100 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl"
            style={{
              background: 'rgba(124,182,142,0.06)',
              border: '1px solid rgba(124,182,142,0.15)',
            }}
          >
            <span className="text-lg">🏆</span>
            <span className="text-[11px] font-semibold" style={{ color: '#7CB68E' }}>
              All protocols complete — Elite Score boosted
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Mood/Energy Tab ── */
function MoodEnergyTab({ sessionId, onToast }: { sessionId: string; onToast: (t: ToastData) => void }) {
  const logMoodEnergy = useMutation(api.quickLog.logMoodEnergy);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [syncing, setSyncing] = useState(false);
  const [logged, setLogged] = useState(false);

  const handleLog = useCallback(async () => {
    setSyncing(true);
    try {
      await logMoodEnergy({ sessionId, mood, energy });
      setLogged(true);
      onToast({
        id: `mood-${Date.now()}`,
        message: `Mood: ${MOOD_TEXT[mood - 1]} · Energy: ${ENERGY_TEXT[energy - 1]}`,
        detail: 'Subjective state logged for pattern analysis',
        source: 'Input',
        type: 'activity',
      });
    } catch (err) {
      console.error('Failed to log mood/energy:', err);
    } finally {
      setSyncing(false);
    }
  }, [logMoodEnergy, sessionId, mood, energy, onToast]);

  return (
    <div className="space-y-5 pb-2">
      {/* Mood selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'rgba(138,126,114,0.5)' }}>
            Mood
          </span>
          <span className="text-[11px] font-semibold" style={{ color: '#E8E0D8' }}>
            {MOOD_TEXT[mood - 1]}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {MOOD_LABELS.map((emoji, i) => {
            const level = i + 1;
            const isActive = level === mood;
            return (
              <button
                key={`mood-${level}`}
                onClick={() => setMood(level)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 active:scale-95"
                style={{
                  background: isActive ? 'rgba(232,151,108,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${isActive ? 'rgba(232,151,108,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  boxShadow: isActive ? '0 0 12px rgba(232,151,108,0.1)' : 'none',
                }}
              >
                <span className="text-2xl" style={{ filter: isActive ? 'none' : 'grayscale(0.6) opacity(0.5)' }}>
                  {emoji}
                </span>
                <span className="text-[8px] font-mono" style={{ color: isActive ? '#E8976C' : 'rgba(138,126,114,0.3)' }}>
                  {level}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Energy selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'rgba(138,126,114,0.5)' }}>
            Energy
          </span>
          <span className="text-[11px] font-semibold" style={{ color: '#E8E0D8' }}>
            {ENERGY_TEXT[energy - 1]}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3, 4, 5].map((level) => {
            const isActive = level === energy;
            const barCount = level;
            return (
              <button
                key={`energy-${level}`}
                onClick={() => setEnergy(level)}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200 active:scale-95"
                style={{
                  background: isActive ? 'rgba(124,182,142,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${isActive ? 'rgba(124,182,142,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  boxShadow: isActive ? '0 0 12px rgba(124,182,142,0.1)' : 'none',
                }}
              >
                {/* Energy bars */}
                <div className="flex items-end gap-0.5 h-5">
                  {Array.from({ length: 5 }).map((_, bi) => (
                    <div
                      key={bi}
                      className="w-1.5 rounded-sm transition-all duration-200"
                      style={{
                        height: `${(bi + 1) * 3 + 2}px`,
                        background: bi < barCount
                          ? (isActive ? '#7CB68E' : 'rgba(124,182,142,0.3)')
                          : 'rgba(255,255,255,0.06)',
                      }}
                    />
                  ))}
                </div>
                <span className="text-[8px] font-mono" style={{ color: isActive ? '#7CB68E' : 'rgba(138,126,114,0.3)' }}>
                  {level}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Log button */}
      <button
        onClick={handleLog}
        disabled={syncing || logged}
        className="w-full py-3 rounded-xl text-[12px] font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.98]"
        style={{
          background: logged
            ? 'rgba(124,182,142,0.12)'
            : 'linear-gradient(135deg, rgba(232,151,108,0.15), rgba(196,164,108,0.1))',
          border: `1px solid ${logged ? 'rgba(124,182,142,0.25)' : 'rgba(232,151,108,0.2)'}`,
          color: logged ? '#7CB68E' : '#E8976C',
          opacity: syncing ? 0.6 : 1,
        }}
      >
        {syncing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent" style={{ animation: 'spin 0.8s linear infinite' }} />
            Syncing...
          </span>
        ) : logged ? (
          '✓ Mood & Energy Logged'
        ) : (
          'Log Mood & Energy'
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DRAWER
   ═══════════════════════════════════════════════════════════════ */

export default function QuickLogDrawer({ isOpen, onClose }: QuickLogDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('vitals');
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';

  // Reset tab when drawer opens
  useEffect(() => {
    if (isOpen) setActiveTab('vitals');
  }, [isOpen]);

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Toast layer (always visible, even when drawer closes) */}
      <AIFeedbackToast toasts={toasts} onDismiss={dismissToast} />

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="ql-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[80]"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={onClose}
            />

            {/* Drawer */}
            <motion.div
              key="ql-drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 z-[81] max-h-[85vh] overflow-hidden rounded-t-2xl"
              style={{
                background: 'rgba(12,11,10,0.97)',
                borderTop: '1px solid rgba(232,151,108,0.1)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 -2px 20px rgba(232,151,108,0.05)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>

              {/* Header */}
              <div className="px-4 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-bold" style={{ color: '#E8E0D8' }}>Quick Log</h2>
                  <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(138,126,114,0.4)' }}>
                    Manual entry · Wearable sync coming later
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.3)',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="px-4 pb-3 flex items-center gap-2">
                <TabButton active={activeTab === 'vitals'} label="Vitals" icon="❤️" onClick={() => setActiveTab('vitals')} />
                <TabButton active={activeTab === 'protocols'} label="Protocols" icon="💊" onClick={() => setActiveTab('protocols')} />
                <TabButton active={activeTab === 'mood'} label="Mood" icon="🧠" onClick={() => setActiveTab('mood')} />
              </div>

              {/* Divider */}
              <div className="mx-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.1), transparent)' }} />

              {/* Content */}
              <div className="px-4 pt-3 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'vitals' && <VitalsTab sessionId={sessionId} onToast={addToast} />}
                    {activeTab === 'protocols' && <ProtocolsTab sessionId={sessionId} onToast={addToast} />}
                    {activeTab === 'mood' && <MoodEnergyTab sessionId={sessionId} onToast={addToast} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
