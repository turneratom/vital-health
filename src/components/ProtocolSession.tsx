import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getSessionId } from '@/components/Presence/usePresenceState';
import { useGhostMode } from '@/components/Presence/usePresenceState';

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL SESSION — Active Treatment Timer
   
   High-fidelity circular timer for Respiration, Thermal Exposure,
   Cold Plunge, Meditation, etc. Syncs progress to Convex in
   real-time so coaches/peers can observe. Breathing rhythm drives
   haptic-style glow expansions on the ring.
   ═══════════════════════════════════════════════════════════════ */

type SessionStatus = 'idle' | 'active' | 'paused' | 'complete';
type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

interface ProtocolPreset {
  id: string;
  name: string;
  icon: string;
  category: string;
  defaultDuration: number; // seconds
  breathPattern?: [number, number, number, number]; // inhale, hold, exhale, hold (seconds)
  color: string;
  glowColor: string;
  description: string;
}

const PRESETS: ProtocolPreset[] = [
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    icon: '\u{1F32C}\uFE0F',
    category: 'respiration',
    defaultDuration: 300,
    breathPattern: [4, 4, 4, 4],
    color: '#00FFCC',
    glowColor: 'rgba(0,255,204,',
    description: '4-4-4-4 pattern for parasympathetic activation',
  },
  {
    id: 'wim-hof',
    name: 'Wim Hof Breathing',
    icon: '\u2744\uFE0F',
    category: 'respiration',
    defaultDuration: 600,
    breathPattern: [2, 0, 2, 15],
    color: '#6BA3BE',
    glowColor: 'rgba(107,163,190,',
    description: '30 power breaths then 15s retention hold',
  },
  {
    id: 'cold-exposure',
    name: 'Cold Exposure',
    icon: '\u{1F9CA}',
    category: 'thermal',
    defaultDuration: 180,
    breathPattern: [3, 1, 5, 1],
    color: '#7CB6E0',
    glowColor: 'rgba(124,182,224,',
    description: '2-3 min cold immersion with slow exhale focus',
  },
  {
    id: 'sauna',
    name: 'Sauna Protocol',
    icon: '\u{1F525}',
    category: 'thermal',
    defaultDuration: 900,
    breathPattern: [4, 2, 6, 2],
    color: '#E8976C',
    glowColor: 'rgba(232,151,108,',
    description: '15 min heat exposure for HSP activation',
  },
  {
    id: 'meditation',
    name: 'Meditation',
    icon: '\u{1F9D8}',
    category: 'recovery',
    defaultDuration: 600,
    breathPattern: [5, 2, 7, 2],
    color: '#C4A46C',
    glowColor: 'rgba(196,164,108,',
    description: 'Deep focus with extended exhale for vagal tone',
  },
  {
    id: '478-breathing',
    name: '4-7-8 Sleep Prep',
    icon: '\u{1F634}',
    category: 'respiration',
    defaultDuration: 480,
    breathPattern: [4, 7, 8, 0],
    color: '#7CB68E',
    glowColor: 'rgba(124,182,142,',
    description: 'Dr. Weil\'s relaxation technique for sleep onset',
  },
];

const BREATH_LABELS: Record<BreathPhase, string> = {
  'inhale': 'INHALE',
  'hold-in': 'HOLD',
  'exhale': 'EXHALE',
  'hold-out': 'HOLD',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ProtocolSession() {
  const sessionId = getSessionId();
  const ghostMode = useGhostMode();

  // State
  const [selectedPreset, setSelectedPreset] = useState<ProtocolPreset | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(300);
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');
  const [breathProgress, setBreathProgress] = useState(0);
  const [breathCycle, setBreathCycle] = useState(0);
  const [glowIntensity, setGlowIntensity] = useState(0.3);

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathAccRef = useRef(0);

  // Convex
  const activeSessions = useQuery(api.protocols.getActiveProtocols, { sessionId });
  const startSessionMut = useMutation(api.protocols.createProtocol);
  const toggleCompletionMut = useMutation(api.protocols.toggleCompletion);

  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const neonHex = ghostMode ? '#a0a0a0' : '#00FFCC';
  const activeColor = selectedPreset?.color ?? neonHex;
  const activeGlow = selectedPreset?.glowColor ?? neon;

  // ── Breathing Engine ──
  const breathPattern = selectedPreset?.breathPattern ?? [4, 4, 4, 4];
  const totalBreathCycle = breathPattern.reduce((a, b) => a + b, 0);

  const getBreathPhaseFromAccumulator = useCallback((acc: number): { phase: BreathPhase; progress: number } => {
    const cyclePos = acc % totalBreathCycle;
    const [inhale, holdIn, exhale, holdOut] = breathPattern;

    if (cyclePos < inhale) {
      return { phase: 'inhale', progress: inhale > 0 ? cyclePos / inhale : 0 };
    }
    if (cyclePos < inhale + holdIn) {
      return { phase: 'hold-in', progress: holdIn > 0 ? (cyclePos - inhale) / holdIn : 0 };
    }
    if (cyclePos < inhale + holdIn + exhale) {
      return { phase: 'exhale', progress: exhale > 0 ? (cyclePos - inhale - holdIn) / exhale : 0 };
    }
    return { phase: 'hold-out', progress: holdOut > 0 ? (cyclePos - inhale - holdIn - exhale) / holdOut : 0 };
  }, [breathPattern, totalBreathCycle]);

  // ── Start Session ──
  const startSession = useCallback((preset: ProtocolPreset) => {
    setSelectedPreset(preset);
    setDuration(preset.defaultDuration);
    setElapsed(0);
    setStatus('active');
    setBreathCycle(0);
    breathAccRef.current = 0;
  }, []);

  // ── Pause / Resume ──
  const togglePause = useCallback(() => {
    setStatus(s => s === 'active' ? 'paused' : 'active');
  }, []);

  // ── Stop ──
  const stopSession = useCallback(() => {
    setStatus('complete');
    if (timerRef.current) clearInterval(timerRef.current);
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
  }, []);

  // ── Reset ──
  const resetSession = useCallback(() => {
    setStatus('idle');
    setSelectedPreset(null);
    setElapsed(0);
    setBreathCycle(0);
    setBreathProgress(0);
    setGlowIntensity(0.3);
    breathAccRef.current = 0;
  }, []);

  // ── Main Timer ──
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= duration) {
            stopSession();
            return duration;
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, duration, stopSession]);

  // ── Breathing Rhythm Engine (60fps) ──
  useEffect(() => {
    if (status === 'active') {
      const TICK = 50; // ms
      breathTimerRef.current = setInterval(() => {
        breathAccRef.current += TICK / 1000;
        const { phase, progress } = getBreathPhaseFromAccumulator(breathAccRef.current);
        setBreathPhase(phase);
        setBreathProgress(progress);

        // Track cycles
        const cycleNum = Math.floor(breathAccRef.current / totalBreathCycle);
        setBreathCycle(cycleNum);

        // Glow intensity follows breath
        if (phase === 'inhale') {
          setGlowIntensity(0.3 + progress * 0.7);
        } else if (phase === 'exhale') {
          setGlowIntensity(1.0 - progress * 0.7);
        } else if (phase === 'hold-in') {
          setGlowIntensity(0.9 + Math.sin(progress * Math.PI) * 0.1);
        } else {
          setGlowIntensity(0.25 + Math.sin(progress * Math.PI) * 0.05);
        }
      }, TICK);
    } else {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    }
    return () => { if (breathTimerRef.current) clearInterval(breathTimerRef.current); };
  }, [status, getBreathPhaseFromAccumulator, totalBreathCycle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  // ── Derived ──
  const progress = duration > 0 ? elapsed / duration : 0;
  const remaining = Math.max(0, duration - elapsed);
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  // Breath ring (inner)
  const breathCircumference = 2 * Math.PI * 95;
  const breathScale = breathPhase === 'inhale' ? 1 + breathProgress * 0.08 :
    breathPhase === 'exhale' ? 1.08 - breathProgress * 0.08 :
    breathPhase === 'hold-in' ? 1.08 : 1.0;

  // ── Idle: Protocol Selector ──
  if (status === 'idle') {
    return (
      <div className="px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono tracking-[3px] uppercase" style={{ color: `${neon}0.5)` }}>Active Session</span>
          </div>
          <h2 className="text-[22px] font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Protocol Sessions
          </h2>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Real-time guided treatments with breathing synchronization
          </p>
        </div>

        {/* Protocol Grid */}
        <div className="grid grid-cols-2 gap-3">
          {PRESETS.map((preset) => (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => startSession(preset)}
              className="relative overflow-hidden rounded-2xl p-4 text-left"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Ambient glow */}
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20"
                style={{ background: `radial-gradient(circle, ${preset.glowColor}0.3), transparent)`, filter: 'blur(20px)' }} />

              <div className="text-2xl mb-2">{preset.icon}</div>
              <div className="text-[13px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {preset.name}
              </div>
              <div className="text-[10px] font-mono" style={{ color: preset.color }}>
                {formatTime(preset.defaultDuration)}
              </div>
              <div className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {preset.description}
              </div>

              {/* Category badge */}
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[8px] font-mono tracking-wider uppercase"
                style={{
                  background: `${preset.glowColor}0.1)`,
                  color: preset.color,
                  border: `1px solid ${preset.glowColor}0.2)`,
                }}>
                {preset.category}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Live Sessions from peers */}
        {activeSessions && activeSessions.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] font-mono tracking-[2px] uppercase mb-3" style={{ color: `${neon}0.4)` }}>
              Active Protocols
            </div>
            <div className="space-y-2">
              {activeSessions.slice(0, 3).map((s) => (
                <div key={s._id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-lg">{s.icon}</div>
                  <div className="flex-1">
                    <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.name}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.category}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full" style={{ background: neonHex, animation: 'pulse 2s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Active / Paused / Complete: Timer View ──
  return (
    <div className="px-4 py-6 flex flex-col items-center">
      {/* Back / Protocol Name */}
      <div className="w-full flex items-center justify-between mb-6">
        <button onClick={status === 'complete' ? resetSession : stopSession}
          className="text-[11px] font-mono tracking-wider px-3 py-1.5 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {status === 'complete' ? '\u2190 NEW SESSION' : '\u2190 END'}
        </button>
        <div className="text-right">
          <div className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {selectedPreset?.icon} {selectedPreset?.name}
          </div>
          <div className="text-[10px] font-mono" style={{ color: `${activeGlow}0.6)` }}>
            Cycle {breathCycle + 1}
          </div>
        </div>
      </div>

      {/* ── Circular Timer with Breathing Glow ── */}
      <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
        {/* Outer ambient glow — pulses with breath */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ scale: breathScale, opacity: glowIntensity * 0.4 }}
          transition={{ duration: 0.15, ease: 'linear' }}
          style={{
            background: `radial-gradient(circle, ${activeGlow}${glowIntensity * 0.25}), transparent 70%)`,
            filter: `blur(${30 + glowIntensity * 20}px)`,
          }}
        />

        {/* Second glow layer */}
        <motion.div
          className="absolute rounded-full"
          animate={{ scale: breathScale * 0.95, opacity: glowIntensity * 0.6 }}
          transition={{ duration: 0.15, ease: 'linear' }}
          style={{
            width: 240, height: 240,
            left: 20, top: 20,
            background: `radial-gradient(circle, ${activeGlow}${glowIntensity * 0.15}), transparent 60%)`,
            filter: `blur(${20 + glowIntensity * 15}px)`,
          }}
        />

        {/* SVG Timer Ring */}
        <svg width="280" height="280" className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track */}
          <circle cx="140" cy="140" r="120" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />

          {/* Progress arc */}
          <motion.circle
            cx="140" cy="140" r="120" fill="none"
            stroke={activeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ filter: `drop-shadow(0 0 ${6 + glowIntensity * 8}px ${activeColor})` }}
          />

          {/* Inner breathing ring */}
          <motion.circle
            cx="140" cy="140" r="95" fill="none"
            stroke={activeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={breathCircumference}
            animate={{
              strokeDashoffset: breathCircumference * (1 - breathProgress),
              opacity: 0.3 + glowIntensity * 0.5,
            }}
            transition={{ duration: 0.1, ease: 'linear' }}
            style={{ filter: `drop-shadow(0 0 4px ${activeColor})` }}
          />

          {/* Breath phase indicator dot */}
          {status === 'active' && (
            <motion.circle
              cx={140 + 95 * Math.cos((breathProgress * 2 * Math.PI) - Math.PI / 2)}
              cy={140 + 95 * Math.sin((breathProgress * 2 * Math.PI) - Math.PI / 2)}
              r="4"
              fill={activeColor}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
            />
          )}
        </svg>

        {/* Center Content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Time remaining */}
          <motion.div
            className="text-[42px] font-light tracking-wider font-mono"
            style={{ color: 'rgba(255,255,255,0.95)' }}
            animate={{ opacity: status === 'paused' ? [1, 0.4, 1] : 1 }}
            transition={status === 'paused' ? { duration: 1.5, repeat: Infinity } : {}}
          >
            {formatTime(remaining)}
          </motion.div>

          {/* Breath phase label */}
          {status === 'active' && (
            <motion.div
              key={breathPhase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[14px] font-mono tracking-[4px] mt-1"
              style={{ color: activeColor }}
            >
              {BREATH_LABELS[breathPhase]}
            </motion.div>
          )}

          {status === 'paused' && (
            <div className="text-[12px] font-mono tracking-[3px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              PAUSED
            </div>
          )}

          {status === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[14px] font-mono tracking-[3px] mt-1"
              style={{ color: '#7CB68E' }}
            >
              COMPLETE
            </motion.div>
          )}

          {/* Elapsed */}
          <div className="text-[10px] font-mono mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {formatTime(elapsed)} elapsed
          </div>
        </div>
      </div>

      {/* ── Breathing Visualization Bar ── */}
      {status === 'active' && (
        <div className="mt-6 w-full max-w-[260px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>BREATH RHYTHM</span>
            <span className="text-[9px] font-mono" style={{ color: `${activeGlow}0.6)` }}>
              {breathPattern.join('-')}s
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${breathProgress * 100}%` }}
              transition={{ duration: 0.05, ease: 'linear' }}
              style={{
                background: activeColor,
                boxShadow: `0 0 ${8 + glowIntensity * 12}px ${activeGlow}${glowIntensity * 0.6})`,
              }}
            />
          </div>

          {/* Phase segments */}
          <div className="flex mt-2 gap-1">
            {(['inhale', 'hold-in', 'exhale', 'hold-out'] as BreathPhase[]).map((phase, i) => {
              const isActive = breathPhase === phase;
              const phaseDuration = breathPattern[i];
              if (phaseDuration === 0) return null;
              return (
                <div key={phase} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-0.5 rounded-full" style={{
                    background: isActive ? activeColor : 'rgba(255,255,255,0.08)',
                    boxShadow: isActive ? `0 0 6px ${activeGlow}0.4)` : 'none',
                    transition: 'all 0.2s',
                  }} />
                  <span className="text-[8px] font-mono" style={{
                    color: isActive ? activeColor : 'rgba(255,255,255,0.2)',
                    transition: 'color 0.2s',
                  }}>
                    {BREATH_LABELS[phase]} {phaseDuration}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="flex items-center gap-4 mt-8">
        {status !== 'complete' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={togglePause}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: status === 'active' ? 'rgba(255,255,255,0.06)' : `${activeGlow}0.15)`,
              border: `1px solid ${status === 'active' ? 'rgba(255,255,255,0.1)' : `${activeGlow}0.3)`}`,
            }}
          >
            {status === 'active' ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="5" y="4" width="3" height="12" rx="1" fill="rgba(255,255,255,0.8)" />
                <rect x="12" y="4" width="3" height="12" rx="1" fill="rgba(255,255,255,0.8)" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M6 4L16 10L6 16V4Z" fill={activeColor} />
              </svg>
            )}
          </motion.button>
        )}

        {status === 'complete' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetSession}
            className="px-6 py-3 rounded-xl text-[12px] font-mono tracking-wider"
            style={{
              background: `${activeGlow}0.12)`,
              border: `1px solid ${activeGlow}0.25)`,
              color: activeColor,
            }}
          >
            NEW SESSION
          </motion.button>
        )}
      </div>

      {/* ── Session Stats (visible during active/complete) ── */}
      {(status === 'active' || status === 'paused' || status === 'complete') && (
        <div className="mt-8 w-full grid grid-cols-3 gap-3">
          {[
            { label: 'Cycles', value: String(breathCycle + 1), sub: 'breath' },
            { label: 'Duration', value: formatTime(elapsed), sub: 'elapsed' },
            { label: 'Progress', value: `${Math.round(progress * 100)}%`, sub: 'complete' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-[16px] font-mono" style={{ color: 'rgba(255,255,255,0.9)' }}>{stat.value}</div>
              <div className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Completion Summary ── */}
      <AnimatePresence>
        {status === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 w-full p-4 rounded-2xl"
            style={{
              background: 'rgba(124,182,142,0.06)',
              border: '1px solid rgba(124,182,142,0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">\u2705</span>
              <span className="text-[13px] font-medium" style={{ color: '#7CB68E' }}>Session Complete</span>
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {selectedPreset?.name} completed in {formatTime(elapsed)}.
              {breathCycle > 0 && ` ${breathCycle + 1} breath cycles logged.`}
              {' '}Recovery benefit will reflect in your next HRV reading.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
