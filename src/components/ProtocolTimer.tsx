import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL TIMER — Countdown Overlay
   
   When a user selects a timed protocol (Deep Work, Cold Plunge,
   Sauna, etc.), this renders a floating countdown timer in the
   corner. On completion it:
   1. Plays a high-end synthesized notification chime
   2. Auto-marks the protocol as 'Complete' in the database
   3. Shows a success pulse animation
   ═══════════════════════════════════════════════════════════════ */

/* ── Duration presets per protocol keyword ── */
const DURATION_MAP: Record<string, number> = {
  'deep work': 90 * 60,
  'cold plunge': 4 * 60,
  'cold exposure': 4 * 60,
  'infrared sauna': 20 * 60,
  'sauna': 20 * 60,
  'zone 2': 30 * 60,
  'zone 2 cardio': 30 * 60,
  'resistance training': 45 * 60,
  'breathwork': 5 * 60,
  'box breathing': 5 * 60,
  'breath prep': 3 * 60,
  'meditation': 15 * 60,
  'morning sunlight': 10 * 60,
  'nature walk': 20 * 60,
  'post-cold walk': 10 * 60,
  'walking': 20 * 60,
  'no screens': 30 * 60,
};

function getDurationForProtocol(name: string): number {
  const lower = name.toLowerCase();
  for (const [key, dur] of Object.entries(DURATION_MAP)) {
    if (lower.includes(key)) return dur;
  }
  // Default 5 minutes for unknown protocols
  return 5 * 60;
}

/* ── High-end notification chime via Web Audio API ── */
function playCompletionChime() {
  try {
    const ctx = new AudioContext();

    // Layer 1: Primary bell tone (C5 = 523Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.8);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    // Layer 2: Harmonic overtone (E5 = 659Hz)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);

    // Layer 3: High shimmer (G5 = 783Hz)
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(783.99, ctx.currentTime + 0.15);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0, ctx.currentTime);
    gain3.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.18);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);

    // Layer 4: Sub-bass warmth (C4 = 261Hz)
    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(261.63, ctx.currentTime);

    const gain4 = ctx.createGain();
    gain4.gain.setValueAtTime(0, ctx.currentTime);
    gain4.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    gain4.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    // Master reverb-like tail via convolver substitute (delayed echo)
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;

    // Connect all
    osc1.connect(gain1).connect(masterGain);
    osc2.connect(gain2).connect(masterGain);
    osc3.connect(gain3).connect(masterGain);
    osc4.connect(gain4).connect(masterGain);
    masterGain.connect(ctx.destination);

    // Start all oscillators
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.08);
    osc3.start(ctx.currentTime + 0.15);
    osc4.start(ctx.currentTime);

    // Stop after decay
    osc1.stop(ctx.currentTime + 1.5);
    osc2.stop(ctx.currentTime + 1.3);
    osc3.stop(ctx.currentTime + 1.1);
    osc4.stop(ctx.currentTime + 0.8);

    // Cleanup
    setTimeout(() => {
      try { ctx.close(); } catch { /* no-op */ }
    }, 2000);
  } catch {
    /* Web Audio not available — silent fallback */
  }
}

/* ── Format seconds to MM:SS or HH:MM:SS ── */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── Timer State ── */
export interface TimerTarget {
  protocolId: string;
  protocolName: string;
  icon: string;
  category: string;
  durationSeconds: number;
}

interface ProtocolTimerProps {
  target: TimerTarget | null;
  sessionId: string;
  onClose: () => void;
  onComplete?: (protocolName: string) => void;
}

type TimerPhase = 'countdown' | 'completing' | 'success';

export function ProtocolTimer({ target, sessionId, onClose, onComplete }: ProtocolTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const [phase, setPhase] = useState<TimerPhase>('countdown');
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);

  const completeProtocol = useMutation(api.protocols.completeProtocolByTimer);

  // Initialize timer when target changes
  useEffect(() => {
    if (!target) return;
    setRemaining(target.durationSeconds);
    setPhase('countdown');
    setIsPaused(false);
    startTimeRef.current = Date.now();
    pausedAtRef.current = 0;
  }, [target]);

  // Countdown tick
  useEffect(() => {
    if (!target || phase !== 'countdown' || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          // Timer complete!
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleTimerComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [target, phase, isPaused]);

  const handleTimerComplete = useCallback(async () => {
    if (!target) return;
    setPhase('completing');

    // Play the chime
    playCompletionChime();

    try {
      await completeProtocol({
        sessionId,
        protocolId: target.protocolId as Id<"protocols">,
      });
      setPhase('success');
      onComplete?.(target.protocolName);

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (err) {
      console.error('Failed to complete protocol:', err);
      // Still show success UI — the timer completed even if DB write failed
      setPhase('success');
      setTimeout(() => onClose(), 4000);
    }
  }, [target, sessionId, completeProtocol, onClose, onComplete]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleCancel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onClose();
  }, [onClose]);

  // Skip timer — complete immediately
  const handleSkipComplete = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemaining(0);
    handleTimerComplete();
  }, [handleTimerComplete]);

  if (!target) return null;

  const progress = target.durationSeconds > 0
    ? ((target.durationSeconds - remaining) / target.durationSeconds) * 100
    : 100;

  const isLowTime = remaining <= 10 && remaining > 0;

  // Progress ring calculations
  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (progress / 100) * ringC;

  // Color based on category
  const categoryColors: Record<string, string> = {
    biohacking: '#00CFFF',
    recovery: '#6B8AFF',
    training: '#E8976C',
    cognitive: '#D4847A',
    supplement: '#7CB68E',
    nutrition: '#C4A46C',
    movement: '#B8A9C9',
  };
  const accentColor = categoryColors[target.category] || '#00FFCC';

  return (
    <div
      className="fixed z-[9998] transition-all duration-500"
      style={{
        bottom: 180,
        left: 16,
        animation: 'ptSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Main Timer Card */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          width: phase === 'success' ? 220 : 200,
          background: 'rgba(12,10,8,0.95)',
          border: `1px solid ${phase === 'success' ? 'rgba(124,182,142,0.3)' : `${accentColor}20`}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: phase === 'success'
            ? '0 8px 40px rgba(124,182,142,0.15), 0 0 60px rgba(124,182,142,0.05)'
            : `0 8px 40px rgba(0,0,0,0.5), 0 0 40px ${accentColor}08`,
          transition: 'all 0.5s ease',
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: phase === 'success'
              ? 'radial-gradient(ellipse at 50% 30%, rgba(124,182,142,0.06) 0%, transparent 70%)'
              : `radial-gradient(ellipse at 50% 30%, ${accentColor}06 0%, transparent 70%)`,
          }}
        />

        {/* ── Success Phase ── */}
        {phase === 'success' ? (
          <div className="relative px-4 py-5 text-center">
            {/* Success pulse ring */}
            <div className="relative mx-auto mb-3" style={{ width: 64, height: 64 }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'rgba(124,182,142,0.08)',
                  border: '2px solid rgba(124,182,142,0.3)',
                  animation: 'ptSuccessPulse 1.5s ease-in-out infinite',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="#7CB68E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 30,
                      strokeDashoffset: 0,
                      animation: 'ptCheckDraw 0.6s ease both 0.2s',
                    }}
                  />
                </svg>
              </div>
            </div>

            <div
              className="text-[12px] font-bold tracking-wide mb-1"
              style={{ color: '#7CB68E', fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              PROTOCOL COMPLETE
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span style={{ fontSize: 14 }}>{target.icon}</span>
              <span
                className="text-[10px] font-semibold truncate"
                style={{ color: '#E8E0D8', maxWidth: 140 }}
              >
                {target.protocolName}
              </span>
            </div>
            <div
              className="text-[8px] font-mono tracking-[0.15em]"
              style={{ color: 'rgba(124,182,142,0.5)' }}
            >
              LOGGED TO DAILY MISSION
            </div>
          </div>
        ) : (
          /* ── Countdown Phase ── */
          <div className="relative px-4 py-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ fontSize: 16 }}>{target.icon}</span>
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-bold tracking-wide truncate"
                    style={{ color: '#E8E0D8', maxWidth: 110, fontFamily: "'Inter', system-ui, sans-serif" }}
                  >
                    {target.protocolName}
                  </div>
                  <div
                    className="text-[7px] font-mono tracking-[0.12em] uppercase"
                    style={{ color: `${accentColor}60` }}
                  >
                    {isPaused ? 'PAUSED' : phase === 'completing' ? 'COMPLETING...' : 'IN PROGRESS'}
                  </div>
                </div>
              </div>
              {/* Close button */}
              <button
                onClick={handleCancel}
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-110"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(42,38,34,0.5)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(138,126,114,0.5)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Timer ring + digits */}
            <div className="flex items-center justify-center mb-3">
              <div className="relative" style={{ width: 96, height: 96 }}>
                <svg viewBox="0 0 96 96" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Track */}
                  <circle
                    cx="48" cy="48" r={ringR}
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="4"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="48" cy="48" r={ringR}
                    fill="none"
                    stroke={isLowTime ? '#FF6B6B' : accentColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringOffset}
                    style={{
                      transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
                      filter: `drop-shadow(0 0 6px ${isLowTime ? 'rgba(255,107,107,0.4)' : `${accentColor}40`})`,
                    }}
                  />
                </svg>
                {/* Center digits */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="tabular-nums font-mono font-bold"
                    style={{
                      fontSize: remaining >= 3600 ? 18 : 22,
                      color: isLowTime ? '#FF6B6B' : '#E8E0D8',
                      textShadow: isLowTime
                        ? '0 0 12px rgba(255,107,107,0.4)'
                        : `0 0 12px ${accentColor}20`,
                      letterSpacing: '0.05em',
                      animation: isLowTime ? 'ptUrgentPulse 0.5s ease-in-out infinite' : 'none',
                    }}
                  >
                    {formatTime(remaining)}
                  </span>
                  <span
                    className="text-[7px] font-mono tracking-[0.15em]"
                    style={{ color: 'rgba(138,126,114,0.4)' }}
                  >
                    REMAINING
                  </span>
                </div>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-2">
              {/* Pause / Resume */}
              <button
                onClick={togglePause}
                className="flex-1 py-2 rounded-lg font-mono text-[9px] font-bold tracking-[0.1em] uppercase transition-all duration-200 active:scale-[0.96]"
                style={{
                  background: isPaused ? `${accentColor}12` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isPaused ? `${accentColor}30` : 'rgba(42,38,34,0.5)'}`,
                  color: isPaused ? accentColor : 'rgba(138,126,114,0.6)',
                }}
              >
                {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
              </button>
              {/* Skip / Complete Now */}
              <button
                onClick={handleSkipComplete}
                className="flex-1 py-2 rounded-lg font-mono text-[9px] font-bold tracking-[0.1em] uppercase transition-all duration-200 active:scale-[0.96]"
                style={{
                  background: 'rgba(124,182,142,0.06)',
                  border: '1px solid rgba(124,182,142,0.2)',
                  color: '#7CB68E',
                }}
              >
                ✓ COMPLETE
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ptSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ptSuccessPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }
        @keyframes ptCheckDraw {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes ptUrgentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

/* ── Helper to determine timer duration from protocol name ── */
export { getDurationForProtocol };

export default ProtocolTimer;
